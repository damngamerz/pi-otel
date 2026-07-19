import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PiOtelConfig } from "../config.js";
import type { EvaluationPair } from "../privacy/content-policy.js";
import type { EvaluationBatch, EvaluationResult } from "./types.js";
export interface RemoteEvaluation {
    batch: EvaluationBatch;
    result: EvaluationResult;
    truncated: boolean;
}
export declare function runRemoteEvaluation(ctx: ExtensionContext, pair: EvaluationPair, config: PiOtelConfig["evaluation"]): Promise<RemoteEvaluation>;
//# sourceMappingURL=evaluator.d.ts.map