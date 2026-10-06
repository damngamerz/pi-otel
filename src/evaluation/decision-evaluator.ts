/**
 * Generic decision-model evaluator (Clef / Jev / Perplexity decider).
 *
 * Calls a decision model through an OpenAI-compatible endpoint using the
 * experimental `questions` response format, then maps typed answers to
 * pi-otel's EvaluationScore shape (0-1 + label).
 */

import type { PiOtelConfig } from "../config.js";
import type { EvaluationPair } from "../privacy/content-policy.js";
import { safeDimension } from "../privacy/sanitization.js";
import type { ModelUsage } from "../telemetry/usage.js";
import type { EvaluationBatch, EvaluationScore } from "./types.js";

/** HTTP timeout for a decision call. Matches the existing judge timeout. */
const TIMEOUT_MS = 90_000;

/** Transient upstream failures (503 capacity, 429) that are worth retrying once. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 529]);

/** Default per-field character cap, mirrors piOtel.evaluation.maxCharsPerField. */
const DEFAULT_MAX_CHARS = 12_000;

// No VALID_LABELS constant: labels are derived from scoreToLabel bands, and
// safeDimension already guards the name field.

/**
 * The four pi-otel evaluation dimensions, expressed as ordered score criteria.
 * The mapped 0-1 value is the probability-weighted position on this scale.
 */
export const DIMENSION_QUESTIONS = {
	task_success: {
		instructions: "Did the assistant response successfully complete the task the user requested?",
		criteria: ["failed", "partial", "mostly", "complete"],
	},
	instruction_following: {
		instructions: "Did the assistant follow the explicit instructions in the user request?",
		criteria: ["ignored", "drift", "partial", "followed"],
	},
	relevance: {
		instructions: "Is the assistant response relevant to what the user asked?",
		criteria: ["irrelevant", "adjacent", "partially_relevant", "on_point"],
	},
	correctness: {
		instructions: "Is the assistant response factually and technically correct?",
		criteria: ["wrong", "unclear", "partially_correct", "correct"],
	},
} as const;

/** Maps a 0-1 score to pi-otel's label scale. */
export function scoreToLabel(score: number): string {
	if (score >= 0.8) return "excellent";
	if (score >= 0.6) return "good";
	if (score >= 0.4) return "fair";
	return "poor";
}

/**
 * Probability-weighted position of a score question's answer.
 * probabilities are keyed by zero-based criterion index (as returned by the
 * `questions` response format).
 */
export function scoreValue(probabilities: Record<string, number> | undefined): number | null {
	const entries = Object.entries(probabilities ?? {});
	if (entries.length === 0) return null;
	let weighted = 0;
	let total = 0;
	for (const [index, probability] of entries) {
		const position = Number(index);
		if (!Number.isInteger(position) || position < 0) return null;
		if (typeof probability !== "number" || !Number.isFinite(probability)) return null;
		weighted += probability * position;
		total += probability;
	}
	if (total <= 0) return null;
	// Normalize to [0, 1] over the observed distribution, scaled by the number
	// of criteria minus one (the max achievable weighted position).
	const maxIndex = Math.max(...entries.map(([index]) => Number(index)));
	if (maxIndex <= 0) return null;
	const count = maxIndex + 1;
	return Math.min(1, Math.max(0, weighted / (count - 1) / total));
}

/** Provider profiles for OpenAI-compatible decision endpoints. */
export const DECISION_PROVIDERS = {
	requesty: {
		baseURL: "https://router.requesty.ai/v1",
		chatPath: "/chat/completions",
		apiKeyEnv: "REQUESTY_API_KEY",
		responseFormatKey: "response_format",
	},
} as const;

export interface DecisionConfig {
	providerName: string;
	baseURL: string;
	apiKey: string;
	model: string;
	maxCharsPerField: number;
	confidenceFloor: number;
}

/** Resolves the effective decision config from piOtel.evaluation config. */
export function resolveDecisionConfig(evaluationConfig: PiOtelConfig["evaluation"]): DecisionConfig {
	const decision = (evaluationConfig as { decision?: Record<string, unknown> }).decision ?? {};
	const providerName = (decision.provider as string | undefined) ?? "requesty";
	const provider = DECISION_PROVIDERS[providerName as keyof typeof DECISION_PROVIDERS];
	if (!provider) {
		throw new Error(
			`piOtel.evaluation.decision.provider must be one of: ${Object.keys(DECISION_PROVIDERS).join(", ")}`,
		);
	}
	const apiKey = ((decision.apiKey as string | undefined) ?? process.env[provider.apiKeyEnv] ?? "").trim();
	if (!apiKey) {
		throw new Error(`No API key available for decision provider ${providerName} (${provider.apiKeyEnv})`);
	}
	const model = (evaluationConfig.model ?? "").trim();
	if (!model) {
		throw new Error("piOtel.evaluation.model is required when evaluation.provider is decision");
	}
	return {
		providerName,
		baseURL: ((decision.baseURL as string | undefined) ?? provider.baseURL).replace(/\/$/, ""),
		apiKey,
		model,
		maxCharsPerField: evaluationConfig.maxCharsPerField,
		confidenceFloor:
			typeof decision.confidenceFloor === "number" && Number.isFinite(decision.confidenceFloor)
				? decision.confidenceFloor
				: 0.5,
	};
}

/** Builds the `questions` response_format body for the four dimensions. */
export function buildQuestions(): Record<string, unknown> {
	const questions: Record<string, unknown> = {};
	for (const [name, definition] of Object.entries(DIMENSION_QUESTIONS)) {
		questions[name] = {
			type: "score",
			instructions: definition.instructions,
			criteria: [...definition.criteria],
		};
	}
	return questions;
}

/** Truncates a field to the configured cap, mirroring the existing judge. */
function truncateField(text: string, maxCharsPerField: number): string {
	const limit =
		typeof maxCharsPerField === "number" && maxCharsPerField > 0 ? maxCharsPerField : DEFAULT_MAX_CHARS;
	return text.slice(0, limit);
}

/** Extracts the assistant JSON object from a chat-completions payload. */
export function parseDecisionAnswer(payload: unknown): Record<string, unknown> {
	const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices;
	const content = choices?.[0]?.message?.content;
	if (typeof content !== "string" || content.trim() === "") {
		throw new Error("Decision model returned no assistant content");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error("Decision model returned unparseable JSON in assistant content");
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Decision model returned non-object JSON");
	}
	return parsed as Record<string, unknown>;
}

/** Maps chat-completions usage into the ModelUsage shape the telemetry layer expects. */
function extractChatUsage(payload: unknown): ModelUsage {
	const usage = (payload as { usage?: Record<string, number> })?.usage ?? {};
	const model = (payload as { model?: string })?.model ?? "unknown";
	return {
		provider: "decision",
		model,
		input: usage.prompt_tokens ?? 0,
		output: usage.completion_tokens ?? 0,
		cacheRead: 0,
		cacheWrite: 0,
		costUsd: usage.cost ?? 0,
	};
}

interface RawDecisionResult {
	scores: EvaluationScore[];
	issues: string[];
	summary: string;
	usage: ModelUsage;
	durationSeconds: number;
}

/** Parses a chat-completions payload into scores, issues, and usage. */
function parseDecisionPayload(
	payload: unknown,
	config: DecisionConfig,
	startedAt: number,
): RawDecisionResult {
	const answers = parseDecisionAnswer(payload);
	const durationSeconds = Math.max(0, (performance.now() - startedAt) / 1_000);

	const scores: EvaluationScore[] = [];
	const issues: string[] = [];
	let minConfidence = 1;
	for (const [name, answer] of Object.entries(answers)) {
		const typed = answer as { type?: string; confidence?: number; probabilities?: Record<string, number> };
		if (typed?.type !== "score") {
			throw new Error(`Decision model returned unexpected answer type for ${name}`);
		}
		const value = scoreValue(typed.probabilities);
		if (value === null) {
			throw new Error(`Decision model returned invalid probabilities for ${name}`);
		}
		scores.push({ name: safeDimension(name, "", 64), score: value, label: scoreToLabel(value) });
		const confidence = typeof typed.confidence === "number" ? typed.confidence : 0;
		minConfidence = Math.min(minConfidence, confidence);
		if (confidence < config.confidenceFloor) {
			issues.push(`low confidence on ${name} (${confidence.toFixed(2)} < ${config.confidenceFloor})`);
		}
	}

	const summary =
		issues.length > 0
			? `decision model · min confidence ${minConfidence.toFixed(2)} · ${issues.length} low-confidence dimension(s)`
			: `decision model · all dimensions confident (min ${minConfidence.toFixed(2)})`;

	return {
		scores,
		issues,
		summary,
		usage: extractChatUsage(payload),
		durationSeconds,
	};
}

/** Builds the request body for one decision call. */
function buildRequestBody(pair: EvaluationPair, config: DecisionConfig): string {
	const userRequest = truncateField(pair.userRequest, config.maxCharsPerField);
	const assistantResponse = truncateField(pair.assistantResponse, config.maxCharsPerField);
	const provider = DECISION_PROVIDERS[config.providerName as keyof typeof DECISION_PROVIDERS];
	return JSON.stringify({
		model: config.model,
		messages: [
			{
				role: "user",
				content: JSON.stringify({ user_request: userRequest, assistant_response: assistantResponse }),
			},
		],
		[provider.responseFormatKey]: { type: "questions", questions: buildQuestions() },
	});
}

/**
 * Runs one evaluation exchange against a decision model.
 * Returns the same shape as runRemoteEvaluation: batch (EvaluationBatch) plus
 * scores/summary/issues for the notify path.
 */
export async function runDecisionEvaluation(
	pair: EvaluationPair,
	config: DecisionConfig,
	fetchImpl: typeof fetch = fetch,
): Promise<{ batch: EvaluationBatch; scores: EvaluationScore[]; issues: string[]; summary: string }> {
	const provider = DECISION_PROVIDERS[config.providerName as keyof typeof DECISION_PROVIDERS];
	const startedAt = performance.now();

	const doFetch = async (): Promise<Response> =>
		fetchImpl(`${config.baseURL}${provider.chatPath}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: buildRequestBody(pair, config),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});

	let response = await doFetch();
	if (!response.ok && RETRYABLE_STATUS.has(response.status)) {
		// Single retry on transient upstream failures (decision capacity
		// hiccups show as 503).
		await new Promise((resolve) => setTimeout(resolve, 2_000));
		response = await doFetch();
		if (!response.ok) {
			throw new Error(`Decision model request failed after retry: ${response.status} ${response.statusText}`);
		}
	} else if (!response.ok) {
		throw new Error(`Decision model request failed: ${response.status} ${response.statusText}`);
	}

	const payload: unknown = await response.json();
	const result = parseDecisionPayload(payload, config, startedAt);

	return {
		batch: {
			provider: config.providerName,
			model: config.model,
			durationSeconds: result.durationSeconds,
			usage: result.usage,
			scores: result.scores,
		},
		scores: result.scores,
		issues: result.issues,
		summary: result.summary,
	};
}

// Labels are derived from scoreToLabel; the label field mirrors parser.ts behavior.
