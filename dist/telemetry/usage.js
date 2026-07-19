import { finiteNumber, safeDimension } from "../privacy/sanitization.js";
export function extractUsage(message, fallbackProvider = "unknown", fallbackModel = "unknown") {
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
    const candidate = message;
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
//# sourceMappingURL=usage.js.map