import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TelemetryRuntime } from "../telemetry/traces.js";

export function registerFlushCommand(pi: ExtensionAPI, getRuntime: () => TelemetryRuntime | undefined): void {
	pi.registerCommand("otel-flush", {
		description: "Force-flush Pi OpenTelemetry spans and metrics",
		handler: async (_args, ctx) => {
			const runtime = getRuntime();
			if (!runtime) {
				ctx.ui.notify("Pi OTel is not initialized for this session.", "warning");
				return;
			}
			try {
				await runtime.forceFlush();
				ctx.ui.notify("Pi OpenTelemetry buffers flushed.", "info");
			} catch (error) {
				ctx.ui.notify(
					`Pi OpenTelemetry flush failed: ${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			}
		},
	});
}
