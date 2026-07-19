import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PiOtelConfig } from "../config.js";
import type { TelemetryRuntime } from "../telemetry/traces.js";
export declare function registerStatusCommand(pi: ExtensionAPI, getConfig: () => PiOtelConfig | undefined, getRuntime: () => TelemetryRuntime | undefined): void;
//# sourceMappingURL=status.d.ts.map