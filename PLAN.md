# `@damngamerz/pi-otel` implementation plan

## Goal

Publish a security-conscious Pi package that exports local OpenTelemetry traces and metrics for Pi agent activity and can optionally evaluate completed responses with a remote LLM judge.

The public package must be safe by default:

- baseline telemetry never contains conversation or tool content
- remote evaluation is disabled by default
- local OTLP endpoints are the default
- Docker and system services are never changed during package installation

## Package boundaries

The repository will contain three independent pieces:

1. **Pi extension** — instruments Pi lifecycle events and exports OTLP.
2. **Optional evaluator** — scores completed responses when explicitly enabled.
3. **Example local backend** — pinned Grafana LGTM Compose configuration and dashboard.

The npm package will be named `@damngamerz/pi-otel` and start at version `0.1.0`.

Repository remote: `git@github.com:damngamerz/pi-otel.git`.

## Proposed structure

```text
pi-otel/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── lifecycle.ts
│   ├── commands/
│   │   ├── status.ts
│   │   └── flush.ts
│   ├── telemetry/
│   │   ├── providers.ts
│   │   ├── instruments.ts
│   │   ├── traces.ts
│   │   ├── attributes.ts
│   │   └── usage.ts
│   ├── evaluation/
│   │   ├── evaluator.ts
│   │   ├── prompt.ts
│   │   ├── parser.ts
│   │   ├── sampling.ts
│   │   └── types.ts
│   └── privacy/
│       ├── content-policy.ts
│       ├── secret-detector.ts
│       └── sanitization.ts
├── test/
│   ├── config.test.ts
│   ├── lifecycle.test.ts
│   ├── metrics.test.ts
│   ├── traces.test.ts
│   ├── privacy.test.ts
│   ├── evaluator.test.ts
│   └── integration/
├── examples/
│   └── grafana-lgtm/
│       ├── compose.yaml
│       ├── dashboard.json
│       ├── provisioning.yaml
│       └── README.md
├── docs/
│   ├── configuration.md
│   ├── privacy.md
│   ├── metrics.md
│   ├── evaluation.md
│   └── operations.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── codeql.yml
│   │   └── release.yml
│   └── dependabot.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── SECURITY.md
├── LICENSE
├── NOTICE
├── ACKNOWLEDGEMENTS.md
├── LICENSES/
│   └── Apache-2.0.txt
└── CHANGELOG.md
```

## Configuration contract

Use a namespaced `piOtel` key to avoid collisions with other Pi extensions:

```jsonc
{
  "piOtel": {
    "enabled": true,
    "endpoint": "http://127.0.0.1:4318",
    "serviceName": "pi",
    "signals": {
      "traces": true,
      "metrics": true
    },
    "evaluation": {
      "mode": "off",
      "sampleRate": 0.1,
      "provider": "openai-codex",
      "model": "gpt-5.4-mini",
      "maxCharsPerField": 12000,
      "blockLikelySecrets": true
    }
  }
}
```

Evaluation modes:

- `off` — default; no conversation content leaves Pi
- `manual` — evaluate only through `/otel-eval-last`
- `sample` — evaluate a deterministic percentage of settled responses
- `always` — evaluate every settled response

Environment variables will override file configuration. Remote OTLP endpoints will require an explicit `allowRemoteEndpoint` setting and HTTPS.

## Pi lifecycle mapping

| Pi event | Telemetry behavior |
|---|---|
| `session_start` | Initialize providers and anonymized session state |
| `agent_start` | Start `invoke_agent` root span |
| `turn_start` | Start Pi turn span |
| `before_provider_request` | Start GenAI client span |
| `message_update` | Record time to first token without content |
| `message_end` | Record model, token, cost, and duration data |
| `tool_execution_start` | Start tool span using only the tool name |
| `tool_execution_end` | Record duration and error status |
| `agent_end` | Finish and retain context for evaluation correlation |
| `agent_settled` | Apply evaluation mode and optionally invoke judge |
| `session_shutdown` | Force-flush and shut down providers |

Evaluation spans will share the evaluated agent trace context. Judge prompts, responses, and explanations will never be written to OTel.

## Metrics

Standards-aligned metrics:

- `gen_ai.client.operation.duration`
- `gen_ai.client.token.usage`
- `gen_ai.client.tool_calls_per_operation`
- `gen_ai.client.tool.calls`
- `gen_ai.evaluation.score`

Pi-specific metrics:

- `pi.agent.prompts`
- `pi.agent.turns`
- `pi.agent.tool.duration`
- `pi.agent.tool.errors`
- `pi.agent.session.duration`
- `pi.agent.time_to_first_token`
- `pi.agent.cost`

Metric attributes must remain low-cardinality. Session IDs, trace IDs, file paths, prompts, and numeric score values must not become metric labels.

## Evaluation design

The first evaluator will produce four bounded scores:

- task success
- instruction following
- relevance
- correctness

Rules:

- scores must be between `0` and `1`
- labels are limited to `poor`, `fair`, `good`, and `excellent`
- malformed judge output is rejected
- duplicate exchanges are evaluated once
- likely credentials and private keys cause a hard skip
- user and assistant text are capped before transmission
- judge usage, latency, and cost are recorded separately
- no evaluation explanation is exported through OTel

The evaluator implementation must be isolated behind an interface so additional evaluators can be added later without changing lifecycle instrumentation.

## Privacy and security requirements

- No prompt, response, thinking, tool arguments, tool results, shell commands, cwd, username, hostname, email, or provider payloads in baseline telemetry.
- Hash session identifiers before placing them on spans.
- Reject non-loopback OTLP endpoints unless explicitly enabled.
- Never add install, postinstall, or service-management scripts.
- Keep Docker configuration under `examples/` and require explicit user startup.
- Pin container images by version and digest.
- Publish an SBOM and checksums for each release.
- Run dependency audit, CodeQL, and tests before publishing.
- Add a documented vulnerability-reporting process in `SECURITY.md`.

## Package manifest

The package should compile to `dist/` and expose only the built extension:

```jsonc
{
  "name": "@damngamerz/pi-otel",
  "version": "0.1.0",
  "license": "MIT",
  "keywords": ["pi-package", "opentelemetry", "otel", "gen-ai", "evaluation"],
  "files": ["dist", "examples", "README.md", "LICENSE", "NOTICE", "ACKNOWLEDGEMENTS.md", "LICENSES"],
  "pi": {
    "extensions": ["./dist/index.js"]
  },
  "peerDependencies": {
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-coding-agent": "*"
  }
}
```

OpenTelemetry libraries remain normal runtime dependencies. Direct versions should be pinned and updated through Dependabot.

## Testing strategy

### Unit tests

- configuration precedence and validation
- loopback endpoint enforcement
- metric attribute sanitization
- usage extraction
- secret detection
- judge JSON parsing
- deterministic sampling
- evaluation deduplication

### Lifecycle tests

Use a fake Pi extension API and in-memory OTel exporters to verify:

- correct span hierarchy
- parallel tool correlation
- retry and incomplete-span handling
- force-flush during shutdown
- no duplicate evaluation
- no high-cardinality metric labels

### Privacy tests

Inject prompts, credentials, paths, shell commands, and tool output, then assert none appear in exported telemetry.

### Integration tests

- run against the supported Pi version in RPC mode
- verify successful and failed tool spans
- verify periodic and shutdown exports
- verify manual, sampled, and always-on evaluation
- verify Grafana dashboard queries against LGTM

## Documentation

The README should lead with:

1. what is collected
2. what is never collected
3. how remote evaluation changes the privacy boundary
4. minimal installation
5. local Grafana setup

Dedicated documentation should cover configuration, metric names, evaluation cost, secret blocking, Docker startup, upgrades, and uninstalling.

## License and acknowledgements

- License all original `@damngamerz/pi-otel` code under the MIT License.
- Credit **Oleksii Nikiforov (`NikiforovAll`)** prominently in the README and `ACKNOWLEDGEMENTS.md` for the original [`NikiforovAll/pi-otel`](https://github.com/NikiforovAll/pi-otel) project and Grafana dashboard that inspired this work.
- Treat the adapted Grafana dashboard as Apache-2.0-derived material rather than silently relicensing it as MIT.
- Include the complete Apache-2.0 license text in `LICENSES/Apache-2.0.txt`.
- Add a `NOTICE` entry containing the upstream project URL, `Copyright 2026 Oleksii Nikiforov`, its Apache-2.0 license, and a statement that the dashboard was modified by the `@damngamerz/pi-otel` project.
- Add an SPDX/license note beside the dashboard documenting that the dashboard remains under Apache-2.0 while the package's original code is MIT.
- Ensure npm tarballs include `LICENSE`, `NOTICE`, `ACKNOWLEDGEMENTS.md`, and `LICENSES/Apache-2.0.txt`.
- Confirm package-name availability before publishing.

## CI and release

CI gates:

1. formatting and linting
2. strict type checking
3. unit and integration tests
4. production dependency audit
5. package-content inspection with `npm pack --dry-run`
6. SBOM generation
7. CodeQL scan

Publishing:

- use npm Trusted Publishing through GitHub Actions
- require a version tag matching `package.json`
- publish with provenance
- attach SBOM and checksums to the GitHub release
- never publish from a developer workstation

## Implementation phases

### Phase 1 — repository foundation

- connect the local working tree to `git@github.com:damngamerz/pi-otel.git`
- package metadata and build configuration
- MIT license for original code
- Apache-2.0 preservation and explicit credit for Oleksii Nikiforov's upstream dashboard
- notice, acknowledgements, security policy, and CI skeleton
- configuration schema and tests

### Phase 2 — operational telemetry

- OTel providers and instruments
- Pi lifecycle mapping
- status and flush commands
- privacy and integration tests

### Phase 3 — optional evaluation

- evaluator interface and remote judge
- four evaluation modes
- secret blocking, sampling, and deduplication
- trace correlation and evaluation dashboard panels

### Phase 4 — local backend example

- hardened pinned LGTM Compose stack
- provisioned Grafana dashboard
- startup and troubleshooting documentation

### Phase 5 — beta release

- security review
- clean audit and SBOM
- npm provenance release as `0.1.0`
- feedback from a small Pi user group

## Release acceptance criteria

- all tests and security scans pass
- production dependency audit has no high or critical findings
- telemetry privacy tests prove content exclusion
- remote evaluation is disabled by default
- every evaluation mode is documented and tested
- dashboard works from a fresh Compose startup
- npm tarball contains only intended files
- README and release artifacts visibly credit Oleksii Nikiforov and preserve the dashboard's Apache-2.0 notice
- install and uninstall work on a clean Pi environment
