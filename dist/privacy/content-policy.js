export function isAssistantMessage(message) {
    return !!message && typeof message === "object" && message.role === "assistant";
}
export function messageText(message) {
    if (!message || typeof message !== "object")
        return "";
    const content = message.content;
    if (typeof content === "string")
        return content.trim();
    if (!Array.isArray(content))
        return "";
    return content
        .filter((part) => {
        return (!!part &&
            typeof part === "object" &&
            part.type === "text" &&
            typeof part.text === "string");
    })
        .map((part) => part.text)
        .join("\n")
        .trim();
}
export function latestEvaluationPair(entries) {
    let assistantIndex = -1;
    let assistantResponse = "";
    for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        if (entry?.type !== "message" || !isAssistantMessage(entry.message))
            continue;
        assistantResponse = messageText(entry.message);
        if (assistantResponse) {
            assistantIndex = index;
            break;
        }
    }
    if (assistantIndex < 0)
        return undefined;
    for (let index = assistantIndex - 1; index >= 0; index--) {
        const entry = entries[index];
        if (entry?.type !== "message" || entry.message?.role !== "user")
            continue;
        const userRequest = messageText(entry.message);
        if (userRequest)
            return { userRequest, assistantResponse };
    }
    return undefined;
}
//# sourceMappingURL=content-policy.js.map