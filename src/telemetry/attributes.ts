export const BASE_GEN_AI_ATTRIBUTES = {
	"gen_ai.system": "pi",
} as const;

export function modelAttributes(provider: string, model: string, operation = "chat") {
	return {
		...BASE_GEN_AI_ATTRIBUTES,
		"gen_ai.operation.name": operation,
		"gen_ai.provider.name": provider,
		"gen_ai.request.model": model,
		"gen_ai.response.model": model,
	};
}
