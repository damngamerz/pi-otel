const SECRET_PATTERNS = [
	/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
	/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/,
	/\b(?:ghp|ghs|ghr)_[A-Za-z0-9]{36,}\b/,
	/\bnpm_[A-Za-z0-9]{36,}\b/,
	/\bAKIA[0-9A-Z]{16}\b/,
	/\bAIza[0-9A-Za-z_-]{30,}\b/,
	/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
	/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
	/(?:^|[\r\n])\s*authorization\s*:\s*bearer\s+[A-Za-z0-9_./+=-]{16,}/i,
	/\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|passphrase|private_key|pwd|accountkey)\s*[:=]\s*["']?[^\s"']{8,}/i,
	/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@/i,
	/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b(?=[^\n]*ssh-\w+)/i,
];

export function containsLikelySecret(text: string): boolean {
	return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
