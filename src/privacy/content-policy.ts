export interface EvaluationPair {
	userRequest: string;
	assistantResponse: string;
}

export function isAssistantMessage(message: unknown): boolean {
	return !!message && typeof message === "object" && (message as { role?: unknown }).role === "assistant";
}

export function messageText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "text"; text: string } => {
			return (
				!!part &&
				typeof part === "object" &&
				(part as { type?: unknown }).type === "text" &&
				typeof (part as { text?: unknown }).text === "string"
			);
		})
		.map((part) => part.text)
		.join("\n")
		.trim();
}

export function latestEvaluationPair(entries: readonly unknown[]): EvaluationPair | undefined {
	let assistantIndex = -1;
	let assistantResponse = "";
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index] as { type?: unknown; message?: unknown };
		if (entry?.type !== "message" || !isAssistantMessage(entry.message)) continue;
		assistantResponse = messageText(entry.message);
		if (assistantResponse) {
			assistantIndex = index;
			break;
		}
	}
	if (assistantIndex < 0) return undefined;

	for (let index = assistantIndex - 1; index >= 0; index--) {
		const entry = entries[index] as { type?: unknown; message?: { role?: unknown } };
		if (entry?.type !== "message" || entry.message?.role !== "user") continue;
		const userRequest = messageText(entry.message);
		if (userRequest) return { userRequest, assistantResponse };
	}
	return undefined;
}
