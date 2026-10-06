import assert from "node:assert/strict";
import test from "node:test";
import {
	buildQuestions,
	DECISION_PROVIDERS,
	parseDecisionAnswer,
	resolveDecisionConfig,
	runDecisionEvaluation,
	scoreToLabel,
	scoreValue,
} from "../src/evaluation/decision-evaluator.js";

const baseConfig = {
	providerName: "requesty",
	baseURL: "https://router.requesty.ai/v1",
	apiKey: "test-key",
	model: "sference/clef",
	maxCharsPerField: 12_000,
	confidenceFloor: 0.5,
};

const pair = { userRequest: "Fix the retry logic.", assistantResponse: "Done, added retries with backoff." };

/** Builds a chat-format payload with the given score answers. */
function chatPayload(
	answers: Record<string, unknown>,
	usage = { prompt_tokens: 420, completion_tokens: 1, total_tokens: 421 },
) {
	return {
		choices: [{ message: { role: "assistant", content: JSON.stringify(answers) } }],
		usage,
		model: "Cloudflare/clef",
	};
}

/** Builds a native-format payload (OpenRouter Decisions / TypeSafe systemone). */
function nativePayload(
	answers: Record<string, unknown>,
	usage = { input_tokens: 476, output_tokens: 70, cost: 0.000019992 },
) {
	return { id: "gen-dec-1", model: "jev-1.13.0-20260917", provider: "TypeSafe", answers, usage };
}

function mockFetch(payload: unknown, status = 200, capture?: (body: unknown) => void) {
	return (async (_url: string, init?: RequestInit) => {
		if (capture) capture(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify(payload), { status });
	}) as typeof fetch;
}

function scoreAnswers() {
	return {
		task_success: {
			type: "score",
			score: 3,
			confidence: 0.88,
			legend: {},
			probabilities: { "0": 0.05, "1": 0.05, "2": 0.4, "3": 0.5 },
		},
		instruction_following: {
			type: "score",
			score: 3,
			confidence: 0.91,
			legend: {},
			probabilities: { "0": 0.02, "1": 0.03, "2": 0.35, "3": 0.6 },
		},
		relevance: {
			type: "score",
			score: 3,
			confidence: 0.95,
			legend: {},
			probabilities: { "0": 0.01, "1": 0.02, "2": 0.3, "3": 0.67 },
		},
		correctness: {
			type: "score",
			score: 1,
			confidence: 0.42,
			legend: {},
			probabilities: { "0": 0.3, "1": 0.45, "2": 0.2, "3": 0.05 },
		},
	};
}

test("scoreValue maps probability distributions to weighted 0-1 positions", () => {
	assert.ok(Math.abs(scoreValue({ "0": 0.1, "1": 0.2, "2": 0.4, "3": 0.3 })! - 0.6333) < 0.001);
	assert.equal(scoreValue({ "0": 0, "1": 0, "2": 0, "3": 1 }), 1.0);
	assert.equal(scoreValue({ "0": 1, "1": 0, "2": 0, "3": 0 }), 0.0);
	assert.equal(scoreValue({}), null);
	assert.equal(scoreValue({ "0": "high" as unknown as number }), null);
	assert.equal(scoreValue({ x: 1 }), null);
	assert.ok(Math.abs(scoreValue({ "0": 0, "1": 0, "2": 0.25, "3": 0.75 })! - 0.9167) < 0.001);
});

test("scoreToLabel uses the pi-otel label bands", () => {
	assert.equal(scoreToLabel(0.0), "poor");
	assert.equal(scoreToLabel(0.39), "poor");
	assert.equal(scoreToLabel(0.4), "fair");
	assert.equal(scoreToLabel(0.59), "fair");
	assert.equal(scoreToLabel(0.6), "good");
	assert.equal(scoreToLabel(0.79), "good");
	assert.equal(scoreToLabel(0.8), "excellent");
});

test("buildQuestions emits one score question per dimension with ordered criteria", () => {
	const questions = buildQuestions();
	const names = Object.keys(questions);
	assert.deepEqual([...names].sort(), ["correctness", "instruction_following", "relevance", "task_success"]);
	for (const name of names) {
		const question = questions[name] as { type: string; criteria: string[] };
		assert.equal(question.type, "score");
		assert.ok(question.criteria.length >= 2);
	}
});

test("parseDecisionAnswer handles both chat and native payload shapes", () => {
	const answers = scoreAnswers();
	assert.deepEqual(parseDecisionAnswer(chatPayload(answers)), answers);
	const native = nativePayload(answers);
	assert.deepEqual(parseDecisionAnswer(native), answers);
	assert.throws(
		() => parseDecisionAnswer({ choices: [{ message: { content: "not json" } }] }),
		/unparseable/,
	);
	assert.throws(() => parseDecisionAnswer({ choices: [] }), /no assistant content/);
	assert.throws(() => parseDecisionAnswer({ answers: "not-an-object" }), /no assistant content|unparseable/);
});

test("chat wire format sends response_format questions and maps scores", async () => {
	let captured: unknown;
	const result = await runDecisionEvaluation(
		pair,
		baseConfig,
		mockFetch(chatPayload(scoreAnswers()), 200, (body) => {
			captured = body;
		}),
	);
	const body = captured as { model: string; messages: unknown[]; response_format: { type: string } };
	assert.equal(body.model, "sference/clef");
	assert.equal(body.messages.length, 1);
	assert.equal(body.response_format.type, "questions");
	assert.equal(result.scores.length, 4);
	assert.equal(result.batch.provider, "requesty");
	assert.equal(result.batch.model, "sference/clef");
	assert.equal(result.batch.usage.input, 420);
	assert.ok(result.batch.durationSeconds >= 0, `durationSeconds was ${result.batch.durationSeconds}`);
	assert.ok(result.summary.includes("confidence"));
	// correctness probabilities [.3, .45, .2, .05] → weighted 0.7 / 3 ≈ 0.233
	const correctness = result.scores.find((s) => s.name === "correctness")!;
	assert.ok(correctness.score < 0.4);
	assert.equal(correctness.label, "poor");
	// confidence 0.42 < floor 0.5 → flagged
	assert.ok(result.issues.some((issue) => issue.includes("correctness") && issue.includes("0.42")));
	assert.equal(result.issues.length, 1);
});

test("native wire format sends state/questions at top level and handles weighted float scores", async () => {
	let captured: unknown;
	const nativeConfig = { ...baseConfig, providerName: "openrouter", baseURL: "https://openrouter.ai/api" };
	const result = await runDecisionEvaluation(
		pair,
		nativeConfig,
		mockFetch(nativePayload(scoreAnswers()), 200, (body) => {
			captured = body;
		}),
	);
	const body = captured as { model: string; state: string; questions: Record<string, unknown> };
	assert.equal(body.model, "sference/clef");
	assert.ok(typeof body.state === "string" && body.state.includes("user_request"));
	assert.ok(Object.keys(body.questions).length === 4);
	assert.equal(result.batch.provider, "openrouter");
	assert.equal(result.batch.model, "sference/clef");
	// native usage shape: input_tokens/output_tokens/cost
	assert.equal(result.batch.usage.input, 476);
	assert.equal(result.batch.usage.output, 70);
	assert.equal(result.batch.usage.costUsd, 0.000019992);
	// integer score index still maps via probabilities on native wire
	const correctness = result.scores.find((s) => s.name === "correctness")!;
	assert.ok(correctness.score < 0.4);
});

test("native weighted-float score is used directly", async () => {
	const answers = {
		task_success: {
			type: "score",
			score: 1.99,
			confidence: 0.99,
			probabilities: { "0": 0, "1": 0, "2": 1 },
			legend: {},
		},
		instruction_following: {
			type: "score",
			score: 0.51,
			confidence: 0.42,
			probabilities: { "0": 0.3, "1": 0.45, "2": 0.2, "3": 0.05 },
			legend: {},
		},
		relevance: {
			type: "score",
			score: 0.9,
			confidence: 0.95,
			probabilities: { "0": 0.02, "1": 0.08, "2": 0.2, "3": 0.7 },
			legend: {},
		},
		correctness: {
			type: "score",
			score: 0.7,
			confidence: 0.8,
			probabilities: { "0": 0.1, "1": 0.2, "2": 0.3, "3": 0.4 },
			legend: {},
		},
	};
	const result = await runDecisionEvaluation(
		pair,
		{ ...baseConfig, providerName: "openrouter" },
		mockFetch(nativePayload(answers)),
	);
	const taskSuccess = result.scores.find((s) => s.name === "task_success")!;
	assert.ok(Math.abs(taskSuccess.score - 0.995) < 0.01, `expected ~0.995, got ${taskSuccess.score}`); // 1.99 rescaled by 2-criterion legend range
	assert.ok(result.issues.some((issue) => issue.includes("instruction_following")));
});

test("retries once on transient 503 and fails after second failure", async () => {
	let calls = 0;
	const flaky: typeof fetch = (async () => {
		calls++;
		return new Response("Decision capacity unavailable", { status: 503 });
	}) as typeof fetch;
	await assert.rejects(runDecisionEvaluation(pair, baseConfig, flaky), /after retry: 503/);
	assert.equal(calls, 2);
});

test("non-retryable errors fail immediately", async () => {
	let calls = 0;
	const failing: typeof fetch = (async () => {
		calls++;
		return new Response("unauthorized", { status: 401 });
	}) as typeof fetch;
	await assert.rejects(runDecisionEvaluation(pair, baseConfig, failing), /401/);
	assert.equal(calls, 1);
});

test("unexpected answer type throws", async () => {
	const answers = { task_success: { type: "noul", noul: 0.9 } };
	await assert.rejects(
		runDecisionEvaluation(pair, baseConfig, mockFetch(chatPayload(answers))),
		/unexpected answer type/,
	);
});

test("invalid probabilities throw", async () => {
	const answers = { task_success: { type: "score", confidence: 0.9, probabilities: {} } };
	await assert.rejects(
		runDecisionEvaluation(pair, baseConfig, mockFetch(chatPayload(answers))),
		/invalid probabilities/,
	);
});

test("resolveDecisionConfig validates model, api key, and provider", () => {
	const env = process.env.REQUESTY_API_KEY;
	try {
		// CI may not have REQUESTY_API_KEY set; the config layer must fall back
		// to the explicit apiKey before rejecting.
		if (process.env.REQUESTY_API_KEY) delete process.env.REQUESTY_API_KEY;
		const resolved = resolveDecisionConfig({
			mode: "always",
			sampleRate: 1,
			provider: "decision",
			model: "sference/clef",
			maxCharsPerField: 12_000,
			blockLikelySecrets: true,
			decision: { provider: "requesty", apiKey: "explicit-key" },
		} as Parameters<typeof resolveDecisionConfig>[0]);
		assert.equal(resolved.apiKey, "explicit-key");
		assert.equal(resolved.providerName, "requesty");
		assert.equal(resolved.confidenceFloor, 0.5);
	} finally {
		if (env === undefined) delete process.env.REQUESTY_API_KEY;
		else process.env.REQUESTY_API_KEY = env;
	}

	assert.throws(
		() =>
			resolveDecisionConfig({
				mode: "always",
				sampleRate: 1,
				provider: "decision",
				model: "",
				maxCharsPerField: 12_000,
				blockLikelySecrets: true,
			} as Parameters<typeof resolveDecisionConfig>[0]),
		/model is required/,
	);

	assert.throws(
		() =>
			resolveDecisionConfig({
				mode: "always",
				sampleRate: 1,
				provider: "decision",
				model: "x",
				maxCharsPerField: 12_000,
				blockLikelySecrets: true,
				decision: { provider: "unknown-provider" },
			} as Parameters<typeof resolveDecisionConfig>[0]),
		/provider must be one of/,
	);
});

test("provider profiles cover all documented routes", () => {
	assert.equal(DECISION_PROVIDERS.requesty.apiKeyEnv, "REQUESTY_API_KEY");
	assert.equal(DECISION_PROVIDERS.openrouter.apiKeyEnv, "OPENROUTER_API_KEY");
	assert.equal(DECISION_PROVIDERS.typesafe.apiKeyEnv, "TYPESAFE_API_KEY");
	assert.equal(DECISION_PROVIDERS.requesty.wire, "chat");
	assert.equal(DECISION_PROVIDERS.openrouter.wire, "native");
	assert.equal(DECISION_PROVIDERS.typesafe.wire, "native");
});
