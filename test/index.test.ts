import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piOtel from "../src/index.js";

test("registers the complete Pi lifecycle and command surface", () => {
	const handlers = new Map<string, unknown>();
	const commands = new Map<string, unknown>();
	const eventSubscriptions: string[] = [];
	const pi = {
		on(event: string, handler: unknown) {
			handlers.set(event, handler);
		},
		registerCommand(name: string, command: unknown) {
			commands.set(name, command);
		},
		events: {
			on(event: string) {
				eventSubscriptions.push(event);
			},
		},
	} as unknown as ExtensionAPI;

	piOtel(pi);

	assert.deepEqual([...handlers.keys()].sort(), [
		"after_provider_response",
		"agent_end",
		"agent_settled",
		"agent_start",
		"before_provider_request",
		"message_end",
		"message_update",
		"session_shutdown",
		"session_start",
		"tool_execution_end",
		"tool_execution_start",
		"turn_end",
		"turn_start",
	]);
	assert.deepEqual([...commands.keys()].sort(), [
		"otel-eval-history",
		"otel-eval-last",
		"otel-flush",
		"otel-status",
	]);
	assert.deepEqual(eventSubscriptions, []);
});
