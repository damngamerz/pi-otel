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
export declare class ConfigError extends Error {
    constructor(message: string);
}
export declare function validateSettingsFile(value: unknown, source?: string): SettingsFile | undefined;
export declare function validateEndpoint(endpoint: string, allowRemoteEndpoint: boolean): string;
/**
 * Validates a model string identifier.
 * Must be non-empty, contain no whitespace, path separators, or "..".
 * Returns the trimmed string on success.
 */
export declare function validateModel(model: string): string;
export declare function resolveConfigFromSources(globalSettingsInput: unknown, projectSettingsInput: unknown, env?: NodeJS.ProcessEnv): PiOtelConfig;
export declare function resolveConfig(cwd: string, projectTrusted: boolean): PiOtelConfig;
export {};
//# sourceMappingURL=config.d.ts.map