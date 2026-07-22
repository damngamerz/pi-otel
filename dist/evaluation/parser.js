import { safeDimension } from "../privacy/sanitization.js";
const REQUIRED_NAMES = ["task_success", "instruction_following", "relevance", "correctness"];
const VALID_LABELS = new Set(["poor", "fair", "good", "excellent"]);
export function parseJudgeResult(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    const candidateText = fenced ?? (firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text);
    let parsed;
    try {
        parsed = JSON.parse(candidateText);
    }
    catch {
        const preview = candidateText.length > 200 ? candidateText.slice(0, 200) + "..." : candidateText;
        throw new Error(`Judge returned unparseable JSON: ${preview}`);
    }
    const scores = (parsed.scores ?? []).map((entry) => {
        if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
            throw new Error("Judge returned a non-numeric score");
        }
        return {
            name: safeDimension(entry.name, "", 64),
            score: entry.score,
            label: safeDimension(entry.label, "", 16),
        };
    });
    if (scores.length !== REQUIRED_NAMES.length ||
        REQUIRED_NAMES.some((name) => !scores.some((score) => score.name === name)) ||
        scores.some((score) => score.score < 0 || score.score > 1 || !VALID_LABELS.has(score.label))) {
        throw new Error("Judge returned invalid score names, values, or labels");
    }
    const orderedScores = REQUIRED_NAMES.map((name) => {
        const score = scores.find((candidate) => candidate.name === name);
        if (!score)
            throw new Error(`Judge omitted required score: ${name}`);
        return score;
    });
    return {
        scores: orderedScores,
        summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 1_200) : "",
        issues: Array.isArray(parsed.issues)
            ? parsed.issues
                .filter((issue) => typeof issue === "string")
                .slice(0, 3)
                .map((issue) => issue.trim().slice(0, 300))
            : [],
    };
}
//# sourceMappingURL=parser.js.map