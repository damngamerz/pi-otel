export interface EvaluationPair {
    userRequest: string;
    assistantResponse: string;
}
export declare function isAssistantMessage(message: unknown): boolean;
export declare function messageText(message: unknown): string;
export declare function latestEvaluationPair(entries: readonly unknown[]): EvaluationPair | undefined;
//# sourceMappingURL=content-policy.d.ts.map