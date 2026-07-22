import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerFlushCommand } from "./commands/flush.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerStatusCommand } from "./commands/status.js";
import { ConfigError, resolveConfig, type PiOtelConfig } from "./config.js";
import { runRemoteEvaluation } from "./evaluation/evaluator.js";
import { EvaluationDeduplicator, shouldEvaluate } from "./evaluation/sampling.js";
import { isAssistantStreamUpdate } from "./lifecycle.js";
import { isAssistantMessage, latestEvaluationPair } from "./privacy/content-policy.js";
import { anonymize } from "./privacy/sanitization.js";
import { containsLikelySecret } from "./privacy/secret-detector.js";
import { TelemetryProviders } from "./telemetry/providers.js";
import { TelemetryRuntime } from "./telemetry/traces.js";

export const VERSION = "0.1.2";
const STATUS_ID = "damngamerz-pi-otel";
const JUDGE_STATUS_ID = "damngamerz-pi-otel-judge";

export default function piOtel(pi: ExtensionAPI): void {
	let config: PiOtelConfig | undefined;
	let providers: TelemetryProviders | undefined;
	let runtime: TelemetryRuntime | undefined;
	const evaluatedExchangeHashes = new EvaluationDeduplicator();
	let evaluationInFlight = false;

	registerStatusCommand(
		pi,
		() => config,
		() => runtime,
	);
	registerFlushCommand(pi, () => runtime);

	const evaluateLatest = async (ctx: ExtensionContext, force: boolean): Promise<void> => {
		if (!config || !runtime || evaluationInFlight) return;
		if (config.evaluation.mode === "off") {
			if (force) {
				ctx.ui.notify(
					"Remote evaluation is disabled. Set piOtel.evaluation.mode to manual, sample, or always.",
					"warning",
				);
			}
			return;
		}
		const pair = latestEvaluationPair(ctx.sessionManager.getBranch());
		if (!pair) {
			if (force) ctx.ui.notify("No completed user/assistant pair is available to evaluate.", "warning");
			return;
		}
		const exchangeHash = anonymize(`${pair.userRequest}\0${pair.assistantResponse}`);
		if (!shouldEvaluate(config.evaluation.mode, config.evaluation.sampleRate, exchangeHash, force)) return;
		if (evaluatedExchangeHashes.has(exchangeHash)) {
			if (force) ctx.ui.notify("The latest exchange has already been evaluated.", "info");
			return;
		}

		if (
			config.evaluation.blockLikelySecrets &&
			(containsLikelySecret(pair.userRequest) || containsLikelySecret(pair.assistantResponse))
		) {
			ctx.ui.notify(
				"Remote evaluation skipped: the latest exchange appears to contain a credential or private key.",
				"warning",
			);
			return;
		}

		evaluatedExchangeHashes.mark(exchangeHash);
		evaluationInFlight = true;
		ctx.ui.setStatus(
			JUDGE_STATUS_ID,
			ctx.ui.theme.fg("warning", `Evaluating with ${config.evaluation.provider}/${config.evaluation.model}`),
		);
		try {
			const evaluation = await runRemoteEvaluation(ctx, pair, config.evaluation);
			runtime.recordEvaluation(evaluation.batch);
			await runtime.forceFlush();
			ctx.ui.notify(
				[
					`Evaluation (${config.evaluation.provider}/${config.evaluation.model}):`,
					...evaluation.result.scores.map(
						(score) => `  ${score.name}: ${score.score.toFixed(2)} (${score.label})`,
					),
					evaluation.result.summary ? `Summary: ${evaluation.result.summary}` : "",
					...evaluation.result.issues.map((issue) => `- ${issue}`),
					evaluation.truncated
						? `Note: input was limited to ${config.evaluation.maxCharsPerField} characters per field.`
						: "",
				]
					.filter(Boolean)
					.join("\n"),
				"info",
			);
		} catch (error) {
			ctx.ui.notify(
				`Remote evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		} finally {
			evaluationInFlight = false;
			ctx.ui.setStatus(JUDGE_STATUS_ID, undefined);
		}
	};

	pi.registerCommand("otel-eval-last", {
		description: "Evaluate the latest Pi response when remote evaluation is enabled",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();
			await evaluateLatest(ctx, true);
		},
	});

	registerHistoryCommand(pi, (ctx, force) => evaluateLatest(ctx, force));

	pi.on("session_start", async (_event, ctx) => {
		try {
			config = resolveConfig(ctx.cwd, ctx.isProjectTrusted());
			if (!config.enabled) return;
			providers = new TelemetryProviders(config, VERSION);
			runtime = new TelemetryRuntime(providers);
			runtime.startSession(anonymize(ctx.sessionManager.getSessionId?.() ?? "ephemeral"));
			evaluatedExchangeHashes.clear();
			evaluationInFlight = false;
			if (ctx.hasUI) {
				ctx.ui.setStatus(STATUS_ID, ctx.ui.theme.fg("dim", `OTel · eval:${config.evaluation.mode}`));
			}
		} catch (error) {
			config = undefined;
			providers = undefined;
			runtime = undefined;
			ctx.ui.notify(
				`Pi OTel disabled: ${error instanceof ConfigError ? error.message : String(error)}`,
				"error",
			);
		}
	});

	pi.on("agent_start", async () => runtime?.startAgent());
	pi.on("turn_start", async (event) => runtime?.startTurn(event.turnIndex));
	pi.on("before_provider_request", async (_event, ctx) => {
		runtime?.startLlm(ctx.model?.provider ?? "unknown", ctx.model?.id ?? "unknown");
	});
	pi.on("after_provider_response", async (event) => runtime?.noteProviderResponse(event.status));
	pi.on("message_update", async (event) => {
		if (isAssistantStreamUpdate(event.message, event.assistantMessageEvent)) runtime?.noteFirstToken();
	});
	pi.on("message_end", async (event) => {
		if (isAssistantMessage(event.message)) runtime?.finishLlm(event.message);
	});
	pi.on("tool_execution_start", async (event) => {
		runtime?.startTool(event.toolCallId, event.toolName);
	});
	pi.on("tool_execution_end", async (event) => {
		runtime?.finishTool(event.toolCallId, event.isError ?? false);
	});
	pi.on("turn_end", async (event) => {
		runtime?.finishTurn(isAssistantMessage(event.message) ? event.message : undefined);
	});
	pi.on("agent_end", async () => runtime?.finishAgent());
	pi.on("agent_settled", async (_event, ctx) => {
		if (config?.evaluation.mode === "sample" || config?.evaluation.mode === "always") {
			await evaluateLatest(ctx, false);
		}
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		try {
			await runtime?.shutdown();
		} catch (error) {
			ctx.ui.notify(
				`Pi OpenTelemetry shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
		if (ctx.hasUI) {
			ctx.ui.setStatus(STATUS_ID, undefined);
			ctx.ui.setStatus(JUDGE_STATUS_ID, undefined);
		}
		config = undefined;
		providers = undefined;
		runtime = undefined;
	});
}
