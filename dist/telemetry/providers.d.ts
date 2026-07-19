import type { Tracer } from "@opentelemetry/api";
import { MeterProvider, type PushMetricExporter } from "@opentelemetry/sdk-metrics";
import { type SpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { PiOtelConfig } from "../config.js";
import { type Instruments } from "./instruments.js";
export interface ProviderOverrides {
    traceExporter?: SpanExporter;
    metricExporter?: PushMetricExporter;
    metricIntervalMs?: number;
}
export declare class TelemetryProviders {
    readonly tracerProvider: NodeTracerProvider;
    readonly meterProvider: MeterProvider;
    readonly tracer: Tracer;
    readonly instruments: Instruments;
    constructor(config: PiOtelConfig, version: string, overrides?: ProviderOverrides);
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=providers.d.ts.map