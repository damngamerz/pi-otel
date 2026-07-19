import { isAssistantMessage } from "./privacy/content-policy.js";

export function containsStreamDelta(event: unknown): boolean {
	if (!event || typeof event !== "object") return false;
	const candidate = event as { type?: unknown; delta?: unknown };
	return (
		(candidate.type === "text_delta" ||
			candidate.type === "thinking_delta" ||
			candidate.type === "toolcall_delta") &&
		typeof candidate.delta === "string" &&
		candidate.delta.length > 0
	);
}

export function isAssistantStreamUpdate(message: unknown, event: unknown): boolean {
	return isAssistantMessage(message) && containsStreamDelta(event);
}
