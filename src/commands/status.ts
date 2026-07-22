import { createConnection } from "node:net";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PiOtelConfig } from "../config.js";
import type { TelemetryRuntime } from "../telemetry/traces.js";

const GRAFANA_URL = "http://127.0.0.1:33000";

function probe(endpoint: string, timeoutMs = 500): Promise<boolean> {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return Promise.resolve(false);
	}
	const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
	return new Promise((resolve) => {
		const socket = createConnection({ host: url.hostname, port });
		let settled = false;
		const finish = (result: boolean) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(result);
		};
		socket.setTimeout(timeoutMs);
		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", () => finish(false));
	});
}

export function registerStatusCommand(
	pi: ExtensionAPI,
	getConfig: () => PiOtelConfig | undefined,
	getRuntime: () => TelemetryRuntime | undefined,
): void {
	pi.registerCommand("otel-status", {
		description: "Show @damngamerz/pi-otel status and session counters",
		handler: async (_args, ctx) => {
			const config = getConfig();
			const runtime = getRuntime();
			if (!config || !runtime) {
				ctx.ui.notify("Pi OTel is not initialized for this session.", "warning");
				return;
			}
			let reachable: boolean;
			try {
				reachable = await probe(config.endpoint);
			} catch {
				reachable = false;
			}
			const stats = runtime.stats;
			ctx.ui.notify(
				[
					`OTLP:        ${config.endpoint} (${reachable ? "reachable" : "unreachable"})`,
					`Grafana:     ${GRAFANA_URL}`,
					`Evaluation:  ${config.evaluation.mode} via ${config.evaluation.provider}/${config.evaluation.model}`,
					"Capture:     baseline metadata only; evaluation content follows the configured mode",
					`Prompts:     ${stats.prompts}`,
					`Turns:       ${stats.turns}`,
					`Tools:       ${stats.toolCalls} (${stats.toolErrors} errors)`,
					`Tokens:      ${stats.inputTokens} input / ${stats.outputTokens} output`,
					`Agent cost:  $${stats.costUsd.toFixed(6)}`,
					`Evaluations: ${stats.evaluationRuns} ($${stats.evaluationCostUsd.toFixed(6)})`,
				].join("\n"),
				reachable ? "info" : "warning",
			);
		},
	});
}
