import type { EvaluationBatch } from "../evaluation/types.js";
import type { TelemetryProviders } from "./providers.js";
export interface RuntimeStats {
    prompts: number;
    turns: number;
    toolCalls: number;
    toolErrors: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    evaluationRuns: number;
    evaluationCostUsd: number;
}
export declare class TelemetryRuntime {
    private readonly providers;
    readonly stats: RuntimeStats;
    private sessionContext;
    private sessionId;
    private sessionStartedAt;
    private agentSpan;
    private agentContext;
    private lastCompletedAgentContext;
    private turnSpan;
    private turnContext;
    private activeLlm;
    private readonly activeTools;
    private toolsInCurrentOperation;
    constructor(providers: TelemetryProviders);
    startSession(anonymizedSessionId: string): void;
    startAgent(): void;
    startTurn(turnIndex: number): void;
    startLlm(providerValue: string, modelValue: string): void;
    noteProviderResponse(status: number): void;
    noteFirstToken(): void;
    finishLlm(message?: unknown, errorType?: string): void;
    startTool(toolCallId: string, toolName: string): void;
    finishTool(toolCallId: string, isError: boolean): void;
    finishTurn(message?: unknown): void;
    finishAgent(): void;
    recordEvaluation(batch: EvaluationBatch): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=traces.d.ts.map