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
export declare function resolveConfigFromSources(globalSettingsInput: unknown, projectSettingsInput: unknown, env?: NodeJS.ProcessEnv): PiOtelConfig;
export declare function resolveConfig(cwd: string, projectTrusted: boolean): PiOtelConfig;
export {};
//# sourceMappingURL=config.d.ts.map