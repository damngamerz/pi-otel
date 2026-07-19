import { complete } from "@earendil-works/pi-ai/compat";
import { messageText } from "../privacy/content-policy.js";
import { extractUsage } from "../telemetry/usage.js";
import { parseJudgeResult } from "./parser.js";
import { JUDGE_SYSTEM_PROMPT } from "./prompt.js";
export async function runRemoteEvaluation(ctx, pair, config) {
    const model = ctx.modelRegistry.find(config.provider, config.model);
    if (!model)
        throw new Error(`Judge model not found: ${config.provider}/${config.model}`);
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
        throw new Error(auth.ok ? `No authentication available for ${config.provider}` : auth.error);
    }
    const userRequest = pair.userRequest.slice(0, config.maxCharsPerField);
    const assistantResponse = pair.assistantResponse.slice(0, config.maxCharsPerField);
    const truncated = userRequest.length !== pair.userRequest.length ||
        assistantResponse.length !== pair.assistantResponse.length;
    const judgeMessage = {
        role: "user",
        content: [
            {
                type: "text",
                text: JSON.stringify({ user_request: userRequest, assistant_response: assistantResponse }),
            },
        ],
        timestamp: Date.now(),
    };
    const startedAt = performance.now();
    const response = await complete(model, { systemPrompt: JUDGE_SYSTEM_PROMPT, messages: [judgeMessage] }, {
        apiKey: auth.apiKey,
        ...(auth.headers ? { headers: auth.headers } : {}),
        ...(auth.env ? { env: auth.env } : {}),
        maxTokens: 1_200,
        cacheRetention: "none",
        timeoutMs: 90_000,
        maxRetries: 1,
        signal: AbortSignal.timeout(90_000),
    });
    const responseText = messageText(response);
    if (!responseText)
        throw new Error(`Judge returned no text (${response.stopReason})`);
    const result = parseJudgeResult(responseText);
    return {
        batch: {
            provider: config.provider,
            model: config.model,
            durationSeconds: Math.max(0, (performance.now() - startedAt) / 1_000),
            usage: extractUsage(response, config.provider, config.model),
            scores: result.scores,
        },
        result,
        truncated,
    };
}
//# sourceMappingURL=evaluator.js.map