import assert from "node:assert/strict";
import test from "node:test";
import { AggregationTemporality, InMemoryMetricExporter } from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { SpanStatusCode } from "@opentelemetry/api";
import { resolveConfigFromSources } from "../src/config.js";
import { TelemetryProviders } from "../src/telemetry/providers.js";
import { TelemetryRuntime } from "../src/telemetry/traces.js";

function assistantMessage() {
	return {
		role: "assistant",
		provider: "test-provider",
		model: "test-model",
		content: [{ type: "text", text: "response" }],
		usage: {
			input: 50,
			output: 15,
			cacheRead: 5,
			cacheWrite: 2,
			cost: { total: 0.0005 },
		},
	};
}

function create() {
	const config = resolveConfigFromSources(undefined, undefined, {});
	const spanExporter = new InMemorySpanExporter();
	const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
	const providers = new TelemetryProviders(config, "lifecycle-test", {
		traceExporter: spanExporter,
		metricExporter,
		metricIntervalMs: 60_000,
	});
	const runtime = new TelemetryRuntime(providers);
	return { runtime, spanExporter, metricExporter };
}

test("full lifecycle produces expected span hierarchy and metrics", async () => {
	const { runtime, spanExporter, metricExporter } = create();

	runtime.startSession("lifecycle-session");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startLlm("test-provider", "test-model");
	runtime.noteProviderResponse(200);
	runtime.noteFirstToken();
	runtime.finishLlm(assistantMessage());
	runtime.startTool("tool-1", "read");
	runtime.startTool("tool-2", "grep");
	runtime.finishTool("tool-1", false);
	runtime.finishTool("tool-2", true);
	runtime.finishTurn();
	runtime.finishAgent();
	await runtime.forceFlush();

	const spans = spanExporter.getFinishedSpans();
	const spanNames = spans.map((s) => s.name);

	assert.ok(spanNames.includes("invoke_agent pi"), "agent span exists");
	assert.ok(spanNames.includes("pi turn"), "turn span exists");
	assert.ok(spanNames.includes("chat test-model"), "LLM span exists");
	assert.ok(spanNames.includes("execute_tool read"), "tool read span exists");
	assert.ok(spanNames.includes("execute_tool grep"), "tool grep span exists");

	const toolSpans = spans.filter((s) => s.name.startsWith("execute_tool"));
	assert.equal(toolSpans.length, 2, "two tool spans created");
	const errorTool = toolSpans.find((s) => s.attributes["error.type"] === "tool_error");
	assert.ok(errorTool, "error tool span has error.type");
	assert.equal(errorTool?.status.code, SpanStatusCode.ERROR);

	const traceIds = new Set(spans.map((s) => s.spanContext().traceId));
	assert.equal(traceIds.size, 1, "all spans share same trace");

	const metrics = metricExporter.getMetrics();
	const metricNames = metrics
		.flatMap((r) => r.scopeMetrics)
		.flatMap((s) => s.metrics)
		.map((m) => m.descriptor.name);

	const expected = [
		"gen_ai.client.operation.duration",
		"gen_ai.client.token.usage",
		"gen_ai.client.tool.calls",
		"pi.agent.tool.duration",
		"pi.agent.tool.errors",
		"pi.agent.prompts",
		"pi.agent.turns",
		"pi.agent.time_to_first_token",
		"pi.agent.cost",
		"gen_ai.client.tool_calls_per_operation",
	];
	for (const name of expected) {
		assert.ok(metricNames.includes(name), `metric ${name} missing`);
	}

	assert.equal(runtime.stats.prompts, 1);
	assert.equal(runtime.stats.turns, 1);
	assert.equal(runtime.stats.toolCalls, 2);
	assert.equal(runtime.stats.toolErrors, 1);
	assert.equal(runtime.stats.inputTokens, 50);
	assert.equal(runtime.stats.outputTokens, 15);

	await runtime.shutdown();
});

test("orphan handling: double startAgent cleans up first agent", async () => {
	const { runtime, spanExporter } = create();

	runtime.startSession("orphan-test");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startLlm("p", "m");
	runtime.finishLlm(assistantMessage());
	runtime.startAgent(); // second startAgent without finishAgent

	await runtime.forceFlush();
	const spans = spanExporter.getFinishedSpans();

	const agentSpans = spans.filter((s) => s.name === "invoke_agent pi");
	assert.ok(agentSpans.length >= 1, "first agent span was ended");
	assert.equal(runtime.stats.prompts, 2);

	await runtime.shutdown();
});

test("tool cleanup: finishTurn with active tools closes them as errors", async () => {
	const { runtime, spanExporter } = create();

	runtime.startSession("cleanup-test");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startTool("orphan-1", "bash");
	runtime.startTool("orphan-2", "read");
	runtime.finishTurn();
	await runtime.forceFlush();

	const spans = spanExporter.getFinishedSpans();
	const toolSpans = spans.filter((s) => s.name.startsWith("execute_tool"));

	assert.equal(toolSpans.length, 2, "both orphan tools should be spans");
	for (const ts of toolSpans) {
		assert.equal(ts.status.code, SpanStatusCode.ERROR, `orphan ${ts.name} should be error`);
	}

	const readSpan = toolSpans.find((s) => s.name === "execute_tool read");
	assert.ok(readSpan, "read tool span exists");
	assert.equal(readSpan?.attributes["error.type"], undefined);

	assert.equal(runtime.stats.toolCalls, 2);
	assert.equal(runtime.stats.toolErrors, 0, "orphan tools not counted as errors");

	await runtime.shutdown();
});
