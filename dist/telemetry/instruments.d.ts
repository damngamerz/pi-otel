import type { Counter, Histogram, Meter } from "@opentelemetry/api";
export interface Instruments {
    operationDuration: Histogram;
    tokenUsage: Histogram;
    toolCallsPerOperation: Histogram;
    toolCalls: Counter;
    toolErrors: Counter;
    toolDuration: Histogram;
    promptCount: Counter;
    turnCount: Counter;
    sessionDuration: Histogram;
    costUsd: Counter;
    timeToFirstToken: Histogram;
    evaluationScore: Histogram;
}
export declare function createInstruments(meter: Meter): Instruments;
//# sourceMappingURL=instruments.d.ts.map