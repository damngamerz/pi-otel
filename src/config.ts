import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type EvaluationMode = "off" | "manual" | "sample" | "always";

export interface PiOtelConfig {
	enabled: boolean;
	endpoint: string;
	allowRemoteEndpoint: boolean;
	headers: Record<string, string>;
	serviceName: string;
	signals: {
		traces: boolean;
		metrics: boolean;
	};
	provider?: string;
	model?: string;
	evaluation: {
		mode: EvaluationMode;
		sampleRate: number;
		provider: string;
		model: string;
		maxCharsPerField: number;
		blockLikelySecrets: boolean;
	};
}

interface PartialPiOtelConfig {
	enabled?: boolean;
	endpoint?: string;
	allowRemoteEndpoint?: boolean;
	headers?: Record<string, string>;
	serviceName?: string;
	signals?: Partial<PiOtelConfig["signals"]>;
	provider?: string;
	model?: string;
	evaluation?: Partial<PiOtelConfig["evaluation"]>;
}

export interface SettingsFile {
	piOtel?: PartialPiOtelConfig;
}

const DEFAULTS: PiOtelConfig = {
	enabled: true,
	endpoint: "http://127.0.0.1:4318",
	allowRemoteEndpoint: false,
	headers: {},
	serviceName: "pi",
	signals: { traces: true, metrics: true },
	evaluation: {
		mode: "off",
		sampleRate: 0.1,
		provider: "openai-codex",
		model: "gpt-5.4-mini",
		maxCharsPerField: 12_000,
		blockLikelySecrets: true,
	},
};

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
	const allowedSet = new Set(allowed);
	const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
	if (unknown) throw new ConfigError(`${path}.${unknown} is not a supported setting`);
}

function requireBoolean(value: unknown, path: string): boolean {
	if (typeof value !== "boolean") throw new ConfigError(`${path} must be a boolean`);
	return value;
}

function requireString(value: unknown, path: string): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new ConfigError(`${path} must be a non-empty string`);
	}
	return value;
}

function requireNumber(value: unknown, path: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new ConfigError(`${path} must be a finite number`);
	}
	return value;
}

function validateHeaders(value: unknown): Record<string, string> {
	if (!isRecord(value)) throw new ConfigError("piOtel.headers must be an object of string values");
	const headers: Record<string, string> = {};
	for (const [key, headerValue] of Object.entries(value)) {
		if (typeof headerValue !== "string" || !key.trim() || !headerValue) {
			throw new ConfigError("piOtel.headers must contain only non-empty string keys and values");
		}
		headers[key] = headerValue;
	}
	return headers;
}

export function validateSettingsFile(value: unknown, source = "settings"): SettingsFile | undefined {
	if (value == null) return undefined;
	if (!isRecord(value)) throw new ConfigError(`${source} must contain a JSON object`);
	if (value.piOtel == null) return {};
	if (!isRecord(value.piOtel)) throw new ConfigError("piOtel must be an object");
	const raw = value.piOtel;
	assertAllowedKeys(
		raw,
		[
			"enabled",
			"endpoint",
			"allowRemoteEndpoint",
			"headers",
			"serviceName",
			"signals",
			"provider",
			"model",
			"evaluation",
		],
		"piOtel",
	);
	const parsed: PartialPiOtelConfig = {};
	if (raw.enabled !== undefined) parsed.enabled = requireBoolean(raw.enabled, "piOtel.enabled");
	if (raw.endpoint !== undefined) parsed.endpoint = requireString(raw.endpoint, "piOtel.endpoint");
	if (raw.allowRemoteEndpoint !== undefined) {
		parsed.allowRemoteEndpoint = requireBoolean(raw.allowRemoteEndpoint, "piOtel.allowRemoteEndpoint");
	}
	if (raw.headers !== undefined) parsed.headers = validateHeaders(raw.headers);
	if (raw.serviceName !== undefined) {
		parsed.serviceName = requireString(raw.serviceName, "piOtel.serviceName");
	}
	if (raw.provider !== undefined) {
		parsed.provider = requireString(raw.provider, "piOtel.provider");
	}
	if (raw.model !== undefined) {
		parsed.model = validateModel(requireString(raw.model, "piOtel.model"));
	}
	if (raw.signals !== undefined) {
		if (!isRecord(raw.signals)) throw new ConfigError("piOtel.signals must be an object");
		assertAllowedKeys(raw.signals, ["traces", "metrics"], "piOtel.signals");
		const signals: Partial<PiOtelConfig["signals"]> = {};
		if (raw.signals.traces !== undefined) {
			signals.traces = requireBoolean(raw.signals.traces, "piOtel.signals.traces");
		}
		if (raw.signals.metrics !== undefined) {
			signals.metrics = requireBoolean(raw.signals.metrics, "piOtel.signals.metrics");
		}
		parsed.signals = signals;
	}
	if (raw.evaluation !== undefined) {
		if (!isRecord(raw.evaluation)) throw new ConfigError("piOtel.evaluation must be an object");
		assertAllowedKeys(
			raw.evaluation,
			["mode", "sampleRate", "provider", "model", "maxCharsPerField", "blockLikelySecrets"],
			"piOtel.evaluation",
		);
		const evaluation: Partial<PiOtelConfig["evaluation"]> = {};
		if (raw.evaluation.mode !== undefined) evaluation.mode = normalizeMode(raw.evaluation.mode);
		if (raw.evaluation.sampleRate !== undefined) {
			evaluation.sampleRate = requireNumber(raw.evaluation.sampleRate, "piOtel.evaluation.sampleRate");
		}
		if (raw.evaluation.provider !== undefined) {
			evaluation.provider = requireString(raw.evaluation.provider, "piOtel.evaluation.provider");
		}
		if (raw.evaluation.model !== undefined) {
			evaluation.model = requireString(raw.evaluation.model, "piOtel.evaluation.model");
		}
		if (raw.evaluation.maxCharsPerField !== undefined) {
			evaluation.maxCharsPerField = requireNumber(
				raw.evaluation.maxCharsPerField,
				"piOtel.evaluation.maxCharsPerField",
			);
		}
		if (raw.evaluation.blockLikelySecrets !== undefined) {
			evaluation.blockLikelySecrets = requireBoolean(
				raw.evaluation.blockLikelySecrets,
				"piOtel.evaluation.blockLikelySecrets",
			);
		}
		parsed.evaluation = evaluation;
	}
	return { piOtel: parsed };
}

function readSettings(path: string): SettingsFile | undefined {
	try {
		return validateSettingsFile(JSON.parse(readFileSync(path, "utf8")), path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		if (error instanceof ConfigError) throw error;
		throw new ConfigError(`Unable to parse ${path}`);
	}
}

function envBoolean(value: string | undefined): boolean | undefined {
	if (value == null) return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === "") return undefined;
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}

function envNumber(value: string | undefined): number | undefined {
	if (value == null || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHeaders(value: string | undefined): Record<string, string> {
	if (!value) return {};
	const headers: Record<string, string> = {};
	for (const pair of value.split(",")) {
		const equals = pair.indexOf("=");
		if (equals <= 0) continue;
		const key = pair.slice(0, equals).trim();
		const headerValue = pair.slice(equals + 1).trim();
		if (key && headerValue) headers[key] = headerValue;
	}
	return headers;
}

function merge(base: PiOtelConfig, override?: PartialPiOtelConfig): PiOtelConfig {
	if (!override) return base;
	return {
		...base,
		...override,
		headers: { ...base.headers, ...(override.headers ?? {}) },
		signals: { ...base.signals, ...(override.signals ?? {}) },
		evaluation: { ...base.evaluation, ...(override.evaluation ?? {}) },
	};
}

function normalizeMode(value: unknown): EvaluationMode {
	if (value === "off" || value === "manual" || value === "sample" || value === "always") {
		return value;
	}
	throw new ConfigError("piOtel.evaluation.mode must be off, manual, sample, or always");
}

export function validateEndpoint(endpoint: string, allowRemoteEndpoint: boolean): string {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		throw new ConfigError("piOtel.endpoint must be a valid HTTP or HTTPS base URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ConfigError("piOtel.endpoint must use HTTP or HTTPS");
	}
	if (url.username || url.password) {
		throw new ConfigError("piOtel.endpoint must not contain credentials; use OTLP headers instead");
	}
	if (url.pathname !== "/" || url.search || url.hash) {
		throw new ConfigError("piOtel.endpoint must be a base URL without a path, query, or fragment");
	}
	const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
	const loopback = loopbackHosts.has(url.hostname);
	if (!allowRemoteEndpoint && !loopback) {
		throw new ConfigError("Remote OTLP endpoints require piOtel.allowRemoteEndpoint=true");
	}
	if (!loopback && url.protocol !== "https:") {
		throw new ConfigError("Remote OTLP endpoints must use HTTPS");
	}
	return `${url.protocol}//${url.host}`;
}

/**
 * Validates a model string identifier.
 * Must be non-empty, contain no whitespace, path separators, or "..".
 * Returns the trimmed string on success.
 */
export function validateModel(model: string): string {
	if (!model.trim()) throw new ConfigError("piOtel.model must be a non-empty string");
	if (/\s/.test(model)) throw new ConfigError("piOtel.model must not contain whitespace");
	if (model.includes("..")) throw new ConfigError("piOtel.model must not contain path sequences");
	if (model.includes("://")) throw new ConfigError("piOtel.model must not contain URL schemes");
	if (model.startsWith("/")) throw new ConfigError("piOtel.model must not start with a path separator");
	if (model.startsWith("\\\\")) throw new ConfigError("piOtel.model must not start with a UNC path");
	return model.trim();
}

export function resolveConfigFromSources(
	globalSettingsInput: unknown,
	projectSettingsInput: unknown,
	env: NodeJS.ProcessEnv = process.env,
): PiOtelConfig {
	const globalSettings = validateSettingsFile(globalSettingsInput, "global settings");
	const projectSettings = validateSettingsFile(projectSettingsInput, "project settings");
	let config = merge(DEFAULTS, globalSettings?.piOtel);
	config = merge(config, projectSettings?.piOtel);

	const allowRemoteEndpoint = envBoolean(env.PI_OTEL_ALLOW_REMOTE_ENDPOINT) ?? config.allowRemoteEndpoint;
	const endpoint = env.PI_OTEL_ENDPOINT ?? env.OTEL_EXPORTER_OTLP_ENDPOINT ?? config.endpoint;
	const mode = normalizeMode(env.PI_OTEL_EVALUATION_MODE ?? config.evaluation.mode);
	const sampleRate = envNumber(env.PI_OTEL_EVALUATION_SAMPLE_RATE) ?? config.evaluation.sampleRate;
	const maxChars = envNumber(env.PI_OTEL_EVALUATION_MAX_CHARS) ?? config.evaluation.maxCharsPerField;
	if (sampleRate < 0 || sampleRate > 1) {
		throw new ConfigError("piOtel.evaluation.sampleRate must be between 0 and 1");
	}
	if (!Number.isInteger(maxChars) || maxChars < 256 || maxChars > 100_000) {
		throw new ConfigError("piOtel.evaluation.maxCharsPerField must be an integer from 256 to 100000");
	}

	return {
		...config,
		enabled: envBoolean(env.PI_OTEL_ENABLED) ?? config.enabled,
		endpoint: validateEndpoint(endpoint, allowRemoteEndpoint),
		allowRemoteEndpoint,
		headers: {
			...config.headers,
			...parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
		},
		serviceName: env.OTEL_SERVICE_NAME ?? config.serviceName,
		...((env.PI_OTEL_PROVIDER ?? config.provider) !== undefined
			? { provider: env.PI_OTEL_PROVIDER ?? config.provider }
			: {}),
		...((env.PI_OTEL_MODEL ?? config.model) !== undefined
			? { model: env.PI_OTEL_MODEL ?? config.model }
			: {}),
		signals: {
			traces: envBoolean(env.PI_OTEL_TRACES) ?? config.signals.traces,
			metrics: envBoolean(env.PI_OTEL_METRICS) ?? config.signals.metrics,
		},
		evaluation: {
			...config.evaluation,
			mode,
			sampleRate,
			provider: env.PI_OTEL_EVALUATION_PROVIDER ?? config.evaluation.provider,
			model: env.PI_OTEL_EVALUATION_MODEL ?? config.evaluation.model,
			maxCharsPerField: maxChars,
			blockLikelySecrets:
				envBoolean(env.PI_OTEL_EVALUATION_BLOCK_SECRETS) ?? config.evaluation.blockLikelySecrets,
		},
	};
}

export function resolveConfig(cwd: string, projectTrusted: boolean): PiOtelConfig {
	const globalSettings = readSettings(join(homedir(), ".pi", "agent", "settings.json"));
	let projectSettings: SettingsFile | undefined;
	if (projectTrusted) {
		try {
			projectSettings = readSettings(join(cwd, ".pi", "settings.json"));
		} catch (error) {
			if (error instanceof ConfigError) {
				throw new ConfigError(
					`Failed to load project settings at ${join(cwd, ".pi", "settings.json")}: ${error.message}`,
				);
			}
			throw error;
		}
	}
	return resolveConfigFromSources(globalSettings, projectSettings);
}
