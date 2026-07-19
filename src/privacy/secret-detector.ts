const SECRET_PATTERNS = [
	/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
	/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/,
	/\bAKIA[0-9A-Z]{16}\b/,
	/\bAIza[0-9A-Za-z_-]{30,}\b/,
	/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
	/\bauthorization\s*:\s*bearer\s+[A-Za-z0-9_./+=-]{16,}/i,
	/\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|accountkey)\s*[:=]\s*["']?[^\s"']{8,}/i,
	/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@/i,
];

export function containsLikelySecret(text: string): boolean {
	return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
