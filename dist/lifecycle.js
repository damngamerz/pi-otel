import { isAssistantMessage } from "./privacy/content-policy.js";
export function containsStreamDelta(event) {
    if (!event || typeof event !== "object")
        return false;
    const candidate = event;
    return ((candidate.type === "text_delta" ||
        candidate.type === "thinking_delta" ||
        candidate.type === "toolcall_delta") &&
        typeof candidate.delta === "string" &&
        candidate.delta.length > 0);
}
export function isAssistantStreamUpdate(message, event) {
    return isAssistantMessage(message) && containsStreamDelta(event);
}
//# sourceMappingURL=lifecycle.js.map