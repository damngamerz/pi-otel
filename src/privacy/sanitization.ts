import { createHash } from "node:crypto";
import { containsLikelySecret } from "./secret-detector.js";

const IDENTIFIER_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:+-";

function hasSafeIdentifierCharacters(value: string): boolean {
	return (
		/[A-Za-z0-9]/.test(value[0] ?? "") &&
		[...value].every((character) => IDENTIFIER_CHARACTERS.includes(character))
	);
}

export function finiteNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function safeDimension(value: unknown, fallback = "unknown", maxLength = 128): string {
	if (typeof value !== "string") return fallback;
	const normalized = value.trim().replace(/[\r\n\t]/g, " ");
	if (!normalized) return fallback;
	return normalized.slice(0, maxLength);
}

export function safeTelemetryIdentifier(value: unknown, fallback = "redacted", maxLength = 128): string {
	if (typeof value !== "string") return fallback;
	const candidate = value.trim();
	if (
		!candidate ||
		candidate.length > maxLength ||
		containsLikelySecret(candidate) ||
		/\s/.test(candidate) ||
		/@/.test(candidate) ||
		candidate.startsWith("/") ||
		candidate.startsWith("\\\\") ||
		/^[A-Za-z]:[\\/]/.test(candidate) ||
		candidate.includes("..") ||
		candidate.includes("://") ||
		candidate.includes("/") ||
		!hasSafeIdentifierCharacters(candidate)
	) {
		return fallback;
	}
	return candidate;
}

export function anonymize(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
