import type { EvaluationMode } from "../config.js";
export declare class EvaluationDeduplicator {
    private readonly fingerprints;
    has(fingerprint: string): boolean;
    mark(fingerprint: string): void;
    clear(): void;
}
export declare function shouldEvaluate(mode: EvaluationMode, sampleRate: number, fingerprint: string, force?: boolean): boolean;
//# sourceMappingURL=sampling.d.ts.map