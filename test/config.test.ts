import assert from "node:assert/strict";
import test from "node:test";
import { ConfigError, resolveConfigFromSources, validateEndpoint } from "../src/config.js";

test("uses privacy-safe defaults", () => {
	const config = resolveConfigFromSources(undefined, undefined, {});
	assert.equal(config.endpoint, "http://127.0.0.1:4318");
	assert.equal(config.evaluation.mode, "off");
	assert.equal(config.allowRemoteEndpoint, false);
	assert.equal(config.evaluation.blockLikelySecrets, true);
});

test("merges global and project settings without dropping nested values", () => {
	const config = resolveConfigFromSources(
		{ piOtel: { signals: { traces: false }, evaluation: { mode: "manual" } } },
		{ piOtel: { signals: { metrics: false }, evaluation: { model: "judge-model" } } },
		{},
	);
	assert.deepEqual(config.signals, { traces: false, metrics: false });
	assert.equal(config.evaluation.mode, "manual");
	assert.equal(config.evaluation.model, "judge-model");
	assert.equal(config.evaluation.blockLikelySecrets, true);
});

test("environment variables override settings", () => {
	const config = resolveConfigFromSources(undefined, undefined, {
		PI_OTEL_EVALUATION_MODE: "sample",
		PI_OTEL_EVALUATION_SAMPLE_RATE: "0.25",
		PI_OTEL_EVALUATION_MAX_CHARS: "4096",
		PI_OTEL_TRACES: "false",
		OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer token,x-team=dev",
	});
	assert.equal(config.evaluation.mode, "sample");
	assert.equal(config.evaluation.sampleRate, 0.25);
	assert.equal(config.evaluation.maxCharsPerField, 4096);
	assert.equal(config.signals.traces, false);
	assert.deepEqual(config.headers, { Authorization: "Bearer token", "x-team": "dev" });
});

test("rejects remote endpoints unless explicitly allowed and encrypted", () => {
	assert.throws(() => validateEndpoint("https://otel.example.com", false), ConfigError);
	assert.throws(() => validateEndpoint("http://otel.example.com", true), ConfigError);
	assert.equal(validateEndpoint("https://otel.example.com", true), "https://otel.example.com");
});

test("rejects malformed settings instead of treating strings as booleans", () => {
	assert.throws(
		() =>
			resolveConfigFromSources(
				{
					piOtel: {
						allowRemoteEndpoint: "false",
						endpoint: "https://otel.example.com",
					},
				},
				undefined,
				{},
			),
		ConfigError,
	);
	assert.throws(
		() => resolveConfigFromSources({ piOtel: { headers: { Authorization: 42 } } }, undefined, {}),
		ConfigError,
	);
});

test("rejects endpoints containing paths or credentials", () => {
	assert.throws(() => validateEndpoint("http://127.0.0.1:4318/v1/traces", false), ConfigError);
	assert.throws(() => validateEndpoint("http://user:pass@127.0.0.1:4318", false), ConfigError);
});

test("validates sampling and content limits", () => {
	assert.throws(
		() => resolveConfigFromSources(undefined, undefined, { PI_OTEL_EVALUATION_SAMPLE_RATE: "2" }),
		ConfigError,
	);
	assert.throws(
		() => resolveConfigFromSources(undefined, undefined, { PI_OTEL_EVALUATION_MAX_CHARS: "100" }),
		ConfigError,
	);
});
