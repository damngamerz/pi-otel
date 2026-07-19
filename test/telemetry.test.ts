import assert from "node:assert/strict";
import test from "node:test";
import { AggregationTemporality, InMemoryMetricExporter } from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { resolveConfigFromSources } from "../src/config.js";
import { TelemetryProviders } from "../src/telemetry/providers.js";
import { TelemetryRuntime } from "../src/telemetry/traces.js";
import { extractUsage } from "../src/telemetry/usage.js";

function assistantMessage() {
	return {
		role: "assistant",
		provider: "test-provider",
		model: "test-model",
		content: [{ type: "text", text: "TOP SECRET RESPONSE" }],
		usage: {
			input: 100,
			output: 20,
			cacheRead: 10,
			cacheWrite: 5,
			cost: { total: 0.001 },
		},
	};
}

test("exports correlated spans and metrics without conversation or tool content", async () => {
	const config = resolveConfigFromSources(undefined, undefined, {});
	const spanExporter = new InMemorySpanExporter();
	const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
	const providers = new TelemetryProviders(config, "test", {
		traceExporter: spanExporter,
		metricExporter,
		metricIntervalMs: 60_000,
	});
	const runtime = new TelemetryRuntime(providers);

	runtime.startSession("anonymous-session");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startLlm("test-provider", "test-model");
	runtime.noteProviderResponse(200);
	runtime.noteFirstToken();
	runtime.finishLlm(assistantMessage());
	runtime.startTool("tool-call-1", "read");
	runtime.finishTool("tool-call-1", false);
	runtime.finishTurn();
	runtime.finishAgent();
	runtime.recordEvaluation({
		provider: "judge-provider",
		model: "judge-model",
		durationSeconds: 0.5,
		usage: extractUsage(undefined, "judge-provider", "judge-model"),
		scores: [{ name: "correctness", score: 0.9, label: "excellent" }],
	});
	await runtime.forceFlush();

	const spans = spanExporter.getFinishedSpans();
	const names = spans.map((span) => span.name);
	assert.ok(names.includes("invoke_agent pi"));
	assert.ok(names.includes("chat test-model"));
	assert.ok(names.includes("execute_tool read"));
	assert.ok(names.includes("evaluate judge-model"));
	const agentSpan = spans.find((span) => span.name === "invoke_agent pi");
	const evaluationSpan = spans.find((span) => span.name === "evaluate judge-model");
	assert.equal(evaluationSpan?.spanContext().traceId, agentSpan?.spanContext().traceId);

	const rawSpans = JSON.stringify(
		spans.map((span) => ({
			name: span.name,
			attributes: span.attributes,
			events: span.events,
			resource: span.resource.attributes,
		})),
	);
	for (const forbidden of [
		"TOP SECRET RESPONSE",
		"tool-call-1",
		"/home/user",
		"user.email",
		"host.name",
		"tool.args",
	]) {
		assert.equal(rawSpans.includes(forbidden), false, `unexpected telemetry content: ${forbidden}`);
	}

	const metricNames = metricExporter
		.getMetrics()
		.flatMap((resource) => resource.scopeMetrics)
		.flatMap((scope) => scope.metrics)
		.map((metric) => metric.descriptor.name);
	assert.ok(metricNames.includes("gen_ai.client.operation.duration"));
	assert.ok(metricNames.includes("gen_ai.client.token.usage"));
	assert.ok(metricNames.includes("gen_ai.evaluation.score"));

	const rawMetrics = JSON.stringify(metricExporter.getMetrics());
	assert.equal(rawMetrics.includes("TOP SECRET RESPONSE"), false);
	assert.equal(rawMetrics.includes("gen_ai.evaluation.score.value"), false);
	await runtime.shutdown();
});

test("redacts content-like provider, model, tool, and service metadata", async () => {
	const config = resolveConfigFromSources(
		{ piOtel: { serviceName: "/home/alice/private-service" } },
		undefined,
		{},
	);
	const spanExporter = new InMemorySpanExporter();
	const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
	const providers = new TelemetryProviders(config, "test", {
		traceExporter: spanExporter,
		metricExporter,
		metricIntervalMs: 60_000,
	});
	const runtime = new TelemetryRuntime(providers);
	runtime.startSession("session");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startLlm("provider@example.com", "/home/alice/private-model");
	runtime.finishLlm({
		...assistantMessage(),
		provider: "provider@example.com",
		model: "/home/alice/private-model",
	});
	runtime.startTool("tool-id", "read /home/alice/secret.txt");
	runtime.finishTool("tool-id", false);
	runtime.finishTurn();
	runtime.finishAgent();
	await runtime.forceFlush();
	const exported = JSON.stringify([
		spanExporter.getFinishedSpans().map((span) => ({ name: span.name, attributes: span.attributes })),
		metricExporter.getMetrics(),
	]);
	for (const forbidden of [
		"provider@example.com",
		"/home/alice/private-model",
		"read /home/alice/secret.txt",
		"/home/alice/private-service",
	]) {
		assert.equal(exported.includes(forbidden), false, `unexpected identifier content: ${forbidden}`);
	}
	assert.equal(exported.includes("redacted"), true);
	await runtime.shutdown();
});

test("forceFlush surfaces exporter failures after attempting every signal", async () => {
	const calls: string[] = [];
	const providers = Object.create(TelemetryProviders.prototype) as TelemetryProviders;
	Object.assign(providers, {
		tracerProvider: {
			forceFlush: async () => {
				calls.push("traces");
				throw new Error("trace export failed");
			},
		},
		meterProvider: {
			forceFlush: async () => {
				calls.push("metrics");
				throw new Error("metric export failed");
			},
		},
	});
	await assert.rejects(() => providers.forceFlush(), AggregateError);
	assert.deepEqual(calls.sort(), ["metrics", "traces"]);
});

test("records tool errors without tool arguments", async () => {
	const config = resolveConfigFromSources(undefined, undefined, {});
	const spanExporter = new InMemorySpanExporter();
	const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
	const providers = new TelemetryProviders(config, "test", {
		traceExporter: spanExporter,
		metricExporter,
		metricIntervalMs: 60_000,
	});
	const runtime = new TelemetryRuntime(providers);
	runtime.startSession("session");
	runtime.startAgent();
	runtime.startTurn(0);
	runtime.startTool("sensitive-call-id", "bash");
	runtime.finishTool("sensitive-call-id", true);
	runtime.finishTurn();
	runtime.finishAgent();
	await runtime.forceFlush();
	assert.equal(runtime.stats.toolErrors, 1);
	const toolSpan = spanExporter.getFinishedSpans().find((span) => span.name === "execute_tool bash");
	assert.equal(toolSpan?.attributes["error.type"], "tool_error");
	assert.equal(
		JSON.stringify({
			name: toolSpan?.name,
			attributes: toolSpan?.attributes,
			events: toolSpan?.events,
		}).includes("sensitive-call-id"),
		false,
	);
	await runtime.shutdown();
});
