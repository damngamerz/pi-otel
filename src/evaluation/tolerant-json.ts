/**
 * Attempt to repair common LLM JSON issues: trailing commas,
 * // and /* * / comments, missing commas between objects/arrays/strings.
 */
export function tolerantJsonParse(source: string): unknown {
	let repaired = "";
	let i = 0;

	while (i < source.length) {
		const char = source[i];
		if (char === undefined) break;

		if (char === '"') {
			repaired += char;
			i++;
			while (i < source.length) {
				const s = source[i];
				if (s === undefined) break;
				repaired += s;
				if (s === "\\" && i + 1 < source.length) {
					repaired += source[i + 1] ?? "";
					i += 2;
					continue;
				}
				i++;
				if (s === '"') break;
			}
			continue;
		}

		// // comments
		if (char === "/" && i + 1 < source.length && source[i + 1] === "/") {
			i += 2;
			while (i < source.length && source[i] !== "\n") i++;
			continue;
		}

		// /* */ comments
		if (char === "/" && i + 1 < source.length && source[i + 1] === "*") {
			i += 2;
			while (i < source.length && !(source[i] === "*" && i + 1 < source.length && source[i + 1] === "/")) {
				i++;
			}
			i += 2;
			continue;
		}

		// trailing commas
		if (char === ",") {
			i++;
			while (i < source.length && /\s/.test(source[i] ?? "")) i++;
			if (i < source.length) {
				const next = source[i];
				if (next === "}" || next === "]") continue;
			}
			repaired += ",";
			continue;
		}

		// missing commas between }/{, ]/[, }/", ]/"
		if (char === "}" || char === "]") {
			repaired += char;
			i++;
			while (i < source.length && /\s/.test(source[i] ?? "")) i++;
			if (i < source.length) {
				const next = source[i];
				if (next === "{" || next === "[" || next === '"') {
					repaired += ",";
				}
			}
			continue;
		}

		if (/\s/.test(char)) {
			repaired += char;
			i++;
			continue;
		}

		repaired += char;
		i++;
	}

	return JSON.parse(repaired);
}
