import { createHash } from "node:crypto";
import type { EvaluationMode } from "../config.js";

export class EvaluationDeduplicator {
	private readonly fingerprints = new Set<string>();

	has(fingerprint: string): boolean {
		return this.fingerprints.has(fingerprint);
	}

	mark(fingerprint: string): void {
		this.fingerprints.add(fingerprint);
	}

	clear(): void {
		this.fingerprints.clear();
	}
}

export function shouldEvaluate(
	mode: EvaluationMode,
	sampleRate: number,
	fingerprint: string,
	force = false,
): boolean {
	if (force) return mode !== "off";
	if (mode === "always") return true;
	if (mode !== "sample") return false;
	const digest = createHash("sha256").update(fingerprint).digest();
	const value = digest.readUInt32BE(0) / 0xffff_ffff;
	return value < sampleRate;
}
