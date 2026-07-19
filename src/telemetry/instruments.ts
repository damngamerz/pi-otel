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

export function createInstruments(meter: Meter): Instruments {
	return {
		operationDuration: meter.createHistogram("gen_ai.client.operation.duration", {
			description: "Duration of GenAI client operations",
			unit: "s",
		}),
		tokenUsage: meter.createHistogram("gen_ai.client.token.usage", {
			description: "Tokens used by GenAI client operations",
			unit: "{token}",
		}),
		toolCallsPerOperation: meter.createHistogram("gen_ai.client.tool_calls_per_operation", {
			description: "Tool calls made during one agent operation",
			unit: "{call}",
			advice: { explicitBucketBoundaries: Array.from({ length: 33 }, (_, index) => index) },
		}),
		toolCalls: meter.createCounter("gen_ai.client.tool.calls", {
			description: "Tool calls made by Pi",
			unit: "{call}",
		}),
		toolErrors: meter.createCounter("pi.agent.tool.errors", {
			description: "Failed Pi tool executions",
			unit: "{error}",
		}),
		toolDuration: meter.createHistogram("pi.agent.tool.duration", {
			description: "Pi tool execution duration",
			unit: "s",
		}),
		promptCount: meter.createCounter("pi.agent.prompts", {
			description: "Pi agent prompts",
			unit: "{prompt}",
		}),
		turnCount: meter.createCounter("pi.agent.turns", {
			description: "Pi LLM turns",
			unit: "{turn}",
		}),
		sessionDuration: meter.createHistogram("pi.agent.session.duration", {
			description: "Pi session duration",
			unit: "s",
		}),
		costUsd: meter.createCounter("pi.agent.cost", {
			description: "Cost reported by Pi",
			unit: "USD",
		}),
		timeToFirstToken: meter.createHistogram("pi.agent.time_to_first_token", {
			description: "Time from provider request to first streamed delta",
			unit: "s",
		}),
		evaluationScore: meter.createHistogram("gen_ai.evaluation.score", {
			description: "Validated LLM evaluation score",
			unit: "1",
		}),
	};
}
