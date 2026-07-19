import { createHash } from "node:crypto";
export class EvaluationDeduplicator {
    fingerprints = new Set();
    has(fingerprint) {
        return this.fingerprints.has(fingerprint);
    }
    mark(fingerprint) {
        this.fingerprints.add(fingerprint);
    }
    clear() {
        this.fingerprints.clear();
    }
}
export function shouldEvaluate(mode, sampleRate, fingerprint, force = false) {
    if (force)
        return mode !== "off";
    if (mode === "always")
        return true;
    if (mode !== "sample")
        return false;
    const digest = createHash("sha256").update(fingerprint).digest();
    const value = digest.readUInt32BE(0) / 0xffff_ffff;
    return value < sampleRate;
}
//# sourceMappingURL=sampling.js.map