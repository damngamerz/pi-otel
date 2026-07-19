export interface ModelUsage {
    provider: string;
    model: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    costUsd: number;
}
export declare function extractUsage(message: unknown, fallbackProvider?: string, fallbackModel?: string): ModelUsage;
//# sourceMappingURL=usage.d.ts.map