import { complete, type UserMessage } from "@earendil-works/pi-ai/compat";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PiOtelConfig } from "../config.js";
import type { EvaluationPair } from "../privacy/content-policy.js";
import { messageText } from "../privacy/content-policy.js";
import { extractUsage } from "../telemetry/usage.js";
import { parseJudgeResult } from "./parser.js";
import { JUDGE_SYSTEM_PROMPT } from "./prompt.js";
import type { EvaluationBatch, EvaluationResult } from "./types.js";

export interface RemoteEvaluation {
	batch: EvaluationBatch;
	result: EvaluationResult;
	truncated: boolean;
}

export async function runRemoteEvaluation(
	ctx: ExtensionContext,
	pair: EvaluationPair,
	config: PiOtelConfig["evaluation"],
): Promise<RemoteEvaluation> {
	const model = ctx.modelRegistry.find(config.provider, config.model);
	if (!model) throw new Error(`Judge model not found: ${config.provider}/${config.model}`);
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok || !auth.apiKey) {
		throw new Error(auth.ok ? `No authentication available for ${config.provider}` : auth.error);
	}

	const userRequest = pair.userRequest.slice(0, config.maxCharsPerField);
	const assistantResponse = pair.assistantResponse.slice(0, config.maxCharsPerField);
	const truncated =
		userRequest.length !== pair.userRequest.length ||
		assistantResponse.length !== pair.assistantResponse.length;
	const judgeMessage: UserMessage = {
		role: "user",
		content: [
			{
				type: "text",
				text: JSON.stringify({ user_request: userRequest, assistant_response: assistantResponse }),
			},
		],
		timestamp: Date.now(),
	};
	const startedAt = performance.now();
	const response = await complete(
		model,
		{ systemPrompt: JUDGE_SYSTEM_PROMPT, messages: [judgeMessage] },
		{
			apiKey: auth.apiKey,
			...(auth.headers ? { headers: auth.headers } : {}),
			...(auth.env ? { env: auth.env } : {}),
			maxTokens: 4_000,
			cacheRetention: "none",
			timeoutMs: 90_000,
			maxRetries: 1,
			signal: AbortSignal.timeout(90_000),
			reasoning: "off",
		},
	);
	const responseText = messageText(response);
	if (!responseText) {
		const content = (response as { content?: unknown }).content;
		const hadThinking =
			Array.isArray(content) &&
			content.some(
				(part: unknown) =>
					!!part &&
					typeof part === "object" &&
					"type" in (part as Record<string, unknown>) &&
					(part as Record<string, unknown>).type === "thinking" &&
					typeof (part as Record<string, unknown>).thinking === "string" &&
					((part as Record<string, unknown>).thinking as string).trim().length > 0,
			);
		throw new Error(
			`Judge returned no text (stopReason=${response.stopReason}${hadThinking ? "; thinking content was produced but no text" : ""})`,
		);
	}
	const result = parseJudgeResult(responseText);
	return {
		batch: {
			provider: config.provider,
			model: config.model,
			durationSeconds: Math.max(0, (performance.now() - startedAt) / 1_000),
			usage: extractUsage(response, config.provider, config.model),
			scores: result.scores,
		},
		result,
		truncated,
	};
}
