import assert from "node:assert/strict";
import test from "node:test";
import { latestEvaluationPair, messageText } from "../src/privacy/content-policy.js";
import { anonymize, safeDimension, safeTelemetryIdentifier } from "../src/privacy/sanitization.js";
import { containsLikelySecret } from "../src/privacy/secret-detector.js";

test("extracts only user and assistant text from the latest exchange", () => {
	const pair = latestEvaluationPair([
		{ type: "message", message: { role: "user", content: [{ type: "text", text: "first" }] } },
		{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "old" }] } },
		{ type: "message", message: { role: "toolResult", content: [{ type: "text", text: "secret output" }] } },
		{ type: "message", message: { role: "user", content: [{ type: "text", text: "latest" }] } },
		{
			type: "message",
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "hidden" },
					{ type: "text", text: "answer" },
					{ type: "toolCall", name: "bash", arguments: { command: "cat .env" } },
				],
			},
		},
	]);
	assert.deepEqual(pair, { userRequest: "latest", assistantResponse: "answer" });
});

test("messageText ignores thinking and tool calls", () => {
	assert.equal(
		messageText({
			content: [
				{ type: "thinking", thinking: "private reasoning" },
				{ type: "text", text: "visible" },
			],
		}),
		"visible",
	);
});

test("detects common credential formats", () => {
	assert.equal(containsLikelySecret("Authorization: Bearer abcdefghijklmnopqrstuvwxyz"), true);
	assert.equal(containsLikelySecret("-----BEGIN OPENSSH PRIVATE KEY-----"), true);
	assert.equal(containsLikelySecret("password=correct-horse-battery-staple"), true);
	assert.equal(containsLikelySecret("client_secret=abcdefghijklmnop"), true);
	assert.equal(containsLikelySecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue"), true);
	assert.equal(containsLikelySecret("postgres://user:password@db.example.com/app"), true);
	assert.equal(containsLikelySecret("normal source code without credentials"), false);
});

test("telemetry identifiers reject paths, identity, secrets, and content-like values", () => {
	assert.equal(safeTelemetryIdentifier("openai-codex"), "openai-codex");
	assert.equal(safeTelemetryIdentifier("accounts/provider/models/model-1"), "redacted");
	assert.equal(safeTelemetryIdentifier("provider@example.com"), "redacted");
	assert.equal(safeTelemetryIdentifier("/home/alice/private-model"), "redacted");
	assert.equal(safeTelemetryIdentifier("src/private/customer-name.ts"), "redacted");
	assert.equal(safeTelemetryIdentifier("vendor/model-family/model-1"), "redacted");
	assert.equal(safeTelemetryIdentifier("read /home/alice/secret.txt"), "redacted");
	assert.equal(safeTelemetryIdentifier("client_secret=abcdefghijklmnop"), "redacted");
});

test("anonymization is stable and does not expose the source", () => {
	const value = "/home/user/.pi/agent/sessions/private.jsonl";
	assert.equal(anonymize(value), anonymize(value));
	assert.equal(anonymize(value).length, 16);
	assert.equal(anonymize(value).includes("user"), false);
});

test("safe dimensions remove control characters and cap length", () => {
	assert.equal(safeDimension(" provider\nname ", "unknown", 20), "provider name");
	assert.equal(safeDimension("123456", "unknown", 4), "1234");
});
