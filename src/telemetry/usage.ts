import { finiteNumber, safeDimension } from "../privacy/sanitization.js";

export interface ModelUsage {
	provider: string;
	model: string;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	costUsd: number;
}

export function extractUsage(
	message: unknown,
	fallbackProvider = "unknown",
	fallbackModel = "unknown",
): ModelUsage {
	if (!message || typeof message !== "object") {
		return {
			provider: fallbackProvider,
			model: fallbackModel,
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			costUsd: 0,
		};
	}
	const candidate = message as {
		provider?: unknown;
		model?: unknown;
		usage?: {
			input?: unknown;
			output?: unknown;
			cacheRead?: unknown;
			cacheWrite?: unknown;
			cost?: { total?: unknown };
		};
	};
	return {
		provider: safeDimension(candidate.provider, fallbackProvider),
		model: safeDimension(candidate.model, fallbackModel),
		input: finiteNumber(candidate.usage?.input),
		output: finiteNumber(candidate.usage?.output),
		cacheRead: finiteNumber(candidate.usage?.cacheRead),
		cacheWrite: finiteNumber(candidate.usage?.cacheWrite),
		costUsd: finiteNumber(candidate.usage?.cost?.total),
	};
}
