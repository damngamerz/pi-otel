import assert from "node:assert/strict";
import test from "node:test";
import { parseJudgeResult } from "../src/evaluation/parser.js";
import { EvaluationDeduplicator, shouldEvaluate } from "../src/evaluation/sampling.js";

const validResult = {
	scores: [
		{ name: "task_success", score: 0.9, label: "excellent" },
		{ name: "instruction_following", score: 0.8, label: "good" },
		{ name: "relevance", score: 0.7, label: "good" },
		{ name: "correctness", score: 0.6, label: "fair" },
	],
	summary: "Useful response",
	issues: ["One issue"],
};

test("parses strict judge JSON and preserves score order", () => {
	const result = parseJudgeResult(JSON.stringify(validResult));
	assert.deepEqual(
		result.scores.map((score) => score.name),
		["task_success", "instruction_following", "relevance", "correctness"],
	);
	assert.equal(result.summary, "Useful response");
});

test("accepts fenced JSON", () => {
	const result = parseJudgeResult(`\`\`\`json\n${JSON.stringify(validResult)}\n\`\`\``);
	assert.equal(result.scores[0]?.score, 0.9);
});

test("rejects malformed or out-of-range scores", () => {
	assert.throws(() =>
		parseJudgeResult(
			JSON.stringify({
				...validResult,
				scores: validResult.scores.map((score, index) => (index === 0 ? { ...score, score: 2 } : score)),
			}),
		),
	);
	assert.throws(() =>
		parseJudgeResult(
			JSON.stringify({
				...validResult,
				scores: validResult.scores.map((score, index) => (index === 0 ? { ...score, score: "high" } : score)),
			}),
		),
	);
});

test("sampling is deterministic", () => {
	const first = shouldEvaluate("sample", 0.5, "same exchange");
	for (let index = 0; index < 20; index++) {
		assert.equal(shouldEvaluate("sample", 0.5, "same exchange"), first);
	}
});

test("evaluation deduplication survives branch navigation until the session resets", () => {
	const deduplicator = new EvaluationDeduplicator();
	deduplicator.mark("exchange-a");
	deduplicator.mark("exchange-b");
	assert.equal(deduplicator.has("exchange-a"), true);
	assert.equal(deduplicator.has("exchange-b"), true);
	deduplicator.clear();
	assert.equal(deduplicator.has("exchange-a"), false);
	assert.equal(deduplicator.has("exchange-b"), false);
});

test("evaluation modes have explicit behavior", () => {
	assert.equal(shouldEvaluate("off", 1, "x"), false);
	assert.equal(shouldEvaluate("manual", 1, "x"), false);
	assert.equal(shouldEvaluate("always", 0, "x"), true);
	assert.equal(shouldEvaluate("manual", 0, "x", true), true);
	assert.equal(shouldEvaluate("off", 1, "x", true), false);
});
