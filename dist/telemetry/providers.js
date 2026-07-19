import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader, } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { safeTelemetryIdentifier } from "../privacy/sanitization.js";
import { createInstruments } from "./instruments.js";
export class TelemetryProviders {
    tracerProvider;
    meterProvider;
    tracer;
    instruments;
    constructor(config, version, overrides = {}) {
        const resource = resourceFromAttributes({
            "service.name": safeTelemetryIdentifier(config.serviceName, "pi"),
            "service.version": version,
            "deployment.environment.name": "local",
        });
        const traceExporter = overrides.traceExporter ??
            new OTLPTraceExporter({
                url: `${config.endpoint}/v1/traces`,
                headers: config.headers,
                timeoutMillis: 5_000,
            });
        const metricExporter = overrides.metricExporter ??
            new OTLPMetricExporter({
                url: `${config.endpoint}/v1/metrics`,
                headers: config.headers,
                timeoutMillis: 5_000,
            });
        this.tracerProvider = new NodeTracerProvider({
            resource,
            spanProcessors: config.signals.traces
                ? [
                    new BatchSpanProcessor(traceExporter, {
                        maxQueueSize: 512,
                        maxExportBatchSize: 128,
                        scheduledDelayMillis: 1_000,
                        exportTimeoutMillis: 5_000,
                    }),
                ]
                : [],
        });
        this.meterProvider = new MeterProvider({
            resource,
            readers: config.signals.metrics
                ? [
                    new PeriodicExportingMetricReader({
                        exporter: metricExporter,
                        exportIntervalMillis: overrides.metricIntervalMs ?? 10_000,
                        exportTimeoutMillis: 5_000,
                    }),
                ]
                : [],
        });
        this.tracer = this.tracerProvider.getTracer("@damngamerz/pi-otel", version);
        this.instruments = createInstruments(this.meterProvider.getMeter("@damngamerz/pi-otel", version));
    }
    async forceFlush() {
        const results = await Promise.allSettled([
            this.tracerProvider.forceFlush(),
            this.meterProvider.forceFlush(),
        ]);
        const failures = results
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason);
        if (failures.length > 0)
            throw new AggregateError(failures, "OpenTelemetry flush failed");
    }
    async shutdown() {
        const failures = [];
        try {
            await this.forceFlush();
        }
        catch (error) {
            failures.push(error);
        }
        const results = await Promise.allSettled([this.tracerProvider.shutdown(), this.meterProvider.shutdown()]);
        for (const result of results) {
            if (result.status === "rejected")
                failures.push(result.reason);
        }
        if (failures.length > 0)
            throw new AggregateError(failures, "OpenTelemetry shutdown failed");
    }
}
//# sourceMappingURL=providers.js.map