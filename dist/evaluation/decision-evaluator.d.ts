/**
 * Generic decision-model evaluator (Clef / Jev / Perplexity decider).
 *
 * Calls a decision model through an OpenAI-compatible endpoint using the
 * experimental `questions` response format, then maps typed answers to
 * pi-otel's EvaluationScore shape (0-1 + label).
 */
import type { PiOtelConfig } from "../config.js";
import type { EvaluationPair } from "../privacy/content-policy.js";
import type { EvaluationBatch, EvaluationScore } from "./types.js";
/**
 * The four pi-otel evaluation dimensions, expressed as ordered score criteria.
 * The mapped 0-1 value is the probability-weighted position on this scale.
 */
export declare const DIMENSION_QUESTIONS: {
    readonly task_success: {
        readonly instructions: "Did the assistant response successfully complete the task the user requested?";
        readonly criteria: readonly ["failed", "partial", "mostly", "complete"];
    };
    readonly instruction_following: {
        readonly instructions: "Did the assistant follow the explicit instructions in the user request?";
        readonly criteria: readonly ["ignored", "drift", "partial", "followed"];
    };
    readonly relevance: {
        readonly instructions: "Is the assistant response relevant to what the user asked?";
        readonly criteria: readonly ["irrelevant", "adjacent", "partially_relevant", "on_point"];
    };
    readonly correctness: {
        readonly instructions: "Is the assistant response factually and technically correct?";
        readonly criteria: readonly ["wrong", "unclear", "partially_correct", "correct"];
    };
};
/** Maps a 0-1 score to pi-otel's label scale. */
export declare function scoreToLabel(score: number): string;
/**
 * Probability-weighted position of a score question's answer.
 * probabilities are keyed by zero-based criterion index (as returned by the
 * `questions` response format).
 */
export declare function scoreValue(probabilities: Record<string, number> | undefined): number | null;
/** Provider profiles for OpenAI-compatible decision endpoints. */
export declare const DECISION_PROVIDERS: {
    readonly requesty: {
        readonly baseURL: "https://router.requesty.ai/v1";
        readonly chatPath: "/chat/completions";
        readonly apiKeyEnv: "REQUESTY_API_KEY";
        readonly responseFormatKey: "response_format";
    };
};
export interface DecisionConfig {
    providerName: string;
    baseURL: string;
    apiKey: string;
    model: string;
    maxCharsPerField: number;
    confidenceFloor: number;
}
/** Resolves the effective decision config from piOtel.evaluation config. */
export declare function resolveDecisionConfig(evaluationConfig: PiOtelConfig["evaluation"]): DecisionConfig;
/** Builds the `questions` response_format body for the four dimensions. */
export declare function buildQuestions(): Record<string, unknown>;
/** Extracts the assistant JSON object from a chat-completions payload. */
export declare function parseDecisionAnswer(payload: unknown): Record<string, unknown>;
/**
 * Runs one evaluation exchange against a decision model.
 * Returns the same shape as runRemoteEvaluation: batch (EvaluationBatch) plus
 * scores/summary/issues for the notify path.
 */
export declare function runDecisionEvaluation(pair: EvaluationPair, config: DecisionConfig, fetchImpl?: typeof fetch): Promise<{
    batch: EvaluationBatch;
    scores: EvaluationScore[];
    issues: string[];
    summary: string;
}>;
//# sourceMappingURL=decision-evaluator.d.ts.map