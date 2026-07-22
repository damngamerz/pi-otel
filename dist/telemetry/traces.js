import { SpanKind, SpanStatusCode, context, trace, } from "@opentelemetry/api";
import { safeTelemetryIdentifier } from "../privacy/sanitization.js";
import { BASE_GEN_AI_ATTRIBUTES, modelAttributes } from "./attributes.js";
import { extractUsage } from "./usage.js";
export class TelemetryRuntime {
    providers;
    stats = {
        prompts: 0,
        turns: 0,
        toolCalls: 0,
        toolErrors: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        evaluationRuns: 0,
        evaluationCostUsd: 0,
    };
    sessionContext = context.active();
    sessionId = "ephemeral";
    sessionStartedAt = 0;
    agentSpan;
    agentContext = context.active();
    lastCompletedAgentContext;
    lastAgentSpanContext;
    turnSpan;
    turnContext = context.active();
    activeLlm;
    activeTools = new Map();
    toolsInCurrentOperation = 0;
    constructor(providers) {
        this.providers = providers;
    }
    startSession(anonymizedSessionId) {
        this.sessionId = anonymizedSessionId;
        this.sessionContext = context.active();
        this.sessionStartedAt = performance.now();
    }
    startAgent() {
        this.finishAgent();
        this.stats.prompts++;
        this.providers.instruments.promptCount.add(1, BASE_GEN_AI_ATTRIBUTES);
        this.agentSpan = this.providers.tracer.startSpan("invoke_agent pi", {
            kind: SpanKind.INTERNAL,
            attributes: {
                ...BASE_GEN_AI_ATTRIBUTES,
                "gen_ai.operation.name": "invoke_agent",
                "gen_ai.agent.name": "pi",
                "gen_ai.conversation.id": this.sessionId,
            },
        }, this.sessionContext);
        this.agentContext = trace.setSpan(this.sessionContext, this.agentSpan);
        this.toolsInCurrentOperation = 0;
    }
    startTurn(turnIndex) {
        this.finishTurn();
        this.stats.turns++;
        this.providers.instruments.turnCount.add(1, BASE_GEN_AI_ATTRIBUTES);
        this.turnSpan = this.providers.tracer.startSpan("pi turn", {
            kind: SpanKind.INTERNAL,
            attributes: { "pi.turn.index": turnIndex },
        }, this.agentContext);
        this.turnContext = trace.setSpan(this.agentContext, this.turnSpan);
    }
    startLlm(providerValue, modelValue) {
        this.finishLlm(undefined, "retry");
        const provider = safeTelemetryIdentifier(providerValue);
        const model = safeTelemetryIdentifier(modelValue, "redacted", 128);
        const span = this.providers.tracer.startSpan(`chat ${model}`, {
            kind: SpanKind.CLIENT,
            attributes: modelAttributes(provider, model),
        }, this.turnContext);
        this.activeLlm = {
            span,
            startedAt: performance.now(),
            provider,
            model,
            firstTokenSeen: false,
        };
    }
    noteProviderResponse(status) {
        if (this.activeLlm)
            this.activeLlm.responseStatus = status;
    }
    noteFirstToken() {
        if (!this.activeLlm || this.activeLlm.firstTokenSeen)
            return;
        this.activeLlm.firstTokenSeen = true;
        this.providers.instruments.timeToFirstToken.record(Math.max(0, (performance.now() - this.activeLlm.startedAt) / 1_000), modelAttributes(this.activeLlm.provider, this.activeLlm.model));
    }
    finishLlm(message, errorType) {
        if (!this.activeLlm)
            return;
        const llm = this.activeLlm;
        this.activeLlm = undefined;
        const usage = extractUsage(message, llm.provider, llm.model);
        const provider = safeTelemetryIdentifier(usage.provider);
        const model = safeTelemetryIdentifier(usage.model, "redacted", 128);
        const attributes = modelAttributes(provider, model);
        this.providers.instruments.operationDuration.record(Math.max(0, (performance.now() - llm.startedAt) / 1_000), {
            ...attributes,
            ...(errorType ? { "error.type": safeTelemetryIdentifier(errorType) } : {}),
        });
        for (const [tokenType, amount] of [
            ["input", usage.input],
            ["output", usage.output],
            ["cache_read", usage.cacheRead],
            ["cache_write", usage.cacheWrite],
        ]) {
            if (amount > 0) {
                this.providers.instruments.tokenUsage.record(amount, {
                    ...attributes,
                    "gen_ai.token.type": tokenType,
                });
            }
        }
        if (usage.costUsd > 0)
            this.providers.instruments.costUsd.add(usage.costUsd, attributes);
        this.stats.inputTokens += usage.input;
        this.stats.outputTokens += usage.output;
        this.stats.costUsd += usage.costUsd;
        llm.span.setAttributes({
            ...attributes,
            "gen_ai.usage.input_tokens": usage.input,
            "gen_ai.usage.output_tokens": usage.output,
            "pi.usage.cache_read_tokens": usage.cacheRead,
            "pi.usage.cache_write_tokens": usage.cacheWrite,
            "pi.cost.usd": usage.costUsd,
            ...(llm.responseStatus != null ? { "http.response.status_code": llm.responseStatus } : {}),
        });
        if (errorType || (llm.responseStatus != null && llm.responseStatus >= 400)) {
            llm.span.setStatus({
                code: SpanStatusCode.ERROR,
                message: errorType ?? `HTTP ${llm.responseStatus}`,
            });
        }
        else {
            llm.span.setStatus({ code: SpanStatusCode.OK });
        }
        llm.span.end();
    }
    startTool(toolCallId, toolName) {
        const name = safeTelemetryIdentifier(toolName, "redacted", 64);
        const attributes = {
            ...BASE_GEN_AI_ATTRIBUTES,
            "gen_ai.tool.name": name,
            "tool.name": name,
        };
        this.stats.toolCalls++;
        this.toolsInCurrentOperation++;
        this.providers.instruments.toolCalls.add(1, attributes);
        const span = this.providers.tracer.startSpan(`execute_tool ${name}`, { kind: SpanKind.INTERNAL, attributes }, this.turnContext);
        this.activeTools.set(toolCallId, { span, startedAt: performance.now(), name });
    }
    finishTool(toolCallId, isError) {
        const tool = this.activeTools.get(toolCallId);
        if (!tool)
            return;
        this.activeTools.delete(toolCallId);
        const attributes = {
            ...BASE_GEN_AI_ATTRIBUTES,
            "gen_ai.tool.name": tool.name,
            "tool.name": tool.name,
        };
        this.providers.instruments.toolDuration.record(Math.max(0, (performance.now() - tool.startedAt) / 1_000), attributes);
        if (isError) {
            this.stats.toolErrors++;
            this.providers.instruments.toolErrors.add(1, attributes);
            tool.span.setAttribute("error.type", "tool_error");
            tool.span.setStatus({ code: SpanStatusCode.ERROR, message: "Tool execution failed" });
        }
        else {
            tool.span.setStatus({ code: SpanStatusCode.OK });
        }
        tool.span.end();
    }
    finishTurn(message) {
        if (this.activeLlm && message)
            this.finishLlm(message);
        this.finishLlm(undefined, "incomplete");
        for (const [toolCallId, tool] of this.activeTools) {
            tool.span.setStatus({ code: SpanStatusCode.ERROR, message: "Tool span incomplete" });
            tool.span.end();
            this.activeTools.delete(toolCallId);
        }
        this.turnSpan?.setStatus({ code: SpanStatusCode.OK });
        this.turnSpan?.end();
        this.turnSpan = undefined;
        this.turnContext = this.agentContext;
    }
    finishAgent() {
        this.finishTurn();
        if (!this.agentSpan)
            return;
        this.providers.instruments.toolCallsPerOperation.record(this.toolsInCurrentOperation, {
            ...BASE_GEN_AI_ATTRIBUTES,
            "gen_ai.operation.name": "invoke_agent",
        });
        this.lastCompletedAgentContext = this.agentContext;
        this.lastAgentSpanContext = this.agentSpan.spanContext();
        this.agentSpan.setStatus({ code: SpanStatusCode.OK });
        this.agentSpan.end();
        this.agentSpan = undefined;
        this.agentContext = this.sessionContext;
        this.toolsInCurrentOperation = 0;
    }
    recordEvaluation(batch) {
        const provider = safeTelemetryIdentifier(batch.provider);
        const model = safeTelemetryIdentifier(batch.model, "redacted", 128);
        const attributes = modelAttributes(provider, model, "evaluate");
        this.providers.instruments.operationDuration.record(Math.max(0, batch.durationSeconds), attributes);
        for (const [tokenType, amount] of [
            ["input", batch.usage.input],
            ["output", batch.usage.output],
            ["cache_read", batch.usage.cacheRead],
            ["cache_write", batch.usage.cacheWrite],
        ]) {
            if (amount > 0) {
                this.providers.instruments.tokenUsage.record(amount, {
                    ...attributes,
                    "gen_ai.token.type": tokenType,
                });
            }
        }
        if (batch.usage.costUsd > 0) {
            this.providers.instruments.costUsd.add(batch.usage.costUsd, attributes);
        }
        this.stats.evaluationRuns++;
        this.stats.evaluationCostUsd += batch.usage.costUsd;
        const spanOptions = {
            kind: SpanKind.CLIENT,
            attributes: {
                ...attributes,
                "gen_ai.usage.input_tokens": batch.usage.input,
                "gen_ai.usage.output_tokens": batch.usage.output,
                "pi.cost.usd": batch.usage.costUsd,
            },
        };
        if (this.lastAgentSpanContext) {
            spanOptions.links = [{ context: this.lastAgentSpanContext }];
        }
        const span = this.providers.tracer.startSpan(`evaluate ${model}`, spanOptions, this.lastCompletedAgentContext ?? this.sessionContext);
        for (const result of batch.scores) {
            if (result.score < 0 || result.score > 1)
                continue;
            const evaluationAttributes = {
                "gen_ai.evaluation.name": safeTelemetryIdentifier(result.name, "redacted", 64),
                "gen_ai.evaluation.score.label": safeTelemetryIdentifier(result.label, "redacted", 32),
                "gen_ai.evaluation.evaluator.provider": provider,
                "gen_ai.evaluation.evaluator.model": model,
            };
            this.providers.instruments.evaluationScore.record(result.score, evaluationAttributes);
            span.addEvent("gen_ai.evaluation.result", {
                ...evaluationAttributes,
                "gen_ai.evaluation.score.value": result.score,
            });
        }
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
    }
    async forceFlush() {
        await this.providers.forceFlush();
    }
    async shutdown() {
        this.finishAgent();
        if (this.sessionStartedAt > 0) {
            this.providers.instruments.sessionDuration.record(Math.max(0, (performance.now() - this.sessionStartedAt) / 1_000), BASE_GEN_AI_ATTRIBUTES);
        }
        await this.providers.shutdown();
    }
}
//# sourceMappingURL=traces.js.map