import type { ModelUsage } from "../telemetry/usage.js";

export interface EvaluationScore {
	name: string;
	score: number;
	label: string;
}

export interface EvaluationResult {
	scores: EvaluationScore[];
	summary: string;
	issues: string[];
}

export interface EvaluationBatch {
	provider: string;
	model: string;
	durationSeconds: number;
	usage: ModelUsage;
	scores: EvaluationScore[];
}
