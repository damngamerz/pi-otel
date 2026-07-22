# @damngamerz/pi-otel

Privacy-conscious OpenTelemetry traces, metrics, and optional response evaluation for the [Pi coding agent](https://pi.dev).

- GenAI semantic traces for agent, LLM, and tool activity
- token, cost, latency, error, and tool metrics
- optional manual, sampled, or always-on LLM evaluation
- correlated `gen_ai.evaluation.result` events
- pinned local Grafana LGTM example
- remote evaluation **off by default**

## Privacy first

Baseline telemetry never contains prompts, responses, thinking, provider payloads, tool arguments/results, shell commands, paths, cwd, usernames, hostnames, or email addresses.

Remote evaluation changes that boundary by sending the latest user request and assistant text to the configured judge model. It is disabled by default, content-limited, deduplicated, and blocked when likely credentials or private keys are detected. See [the privacy model](docs/privacy.md).

## Quick preview

![pi-otel Grafana dashboard](./examples/grafana-lgtm/dashboard-screenshot.png)

The example telemetry Grafana stack ships with a pre-built dashboard showing real-time telemetry.

## Install

```bash
pi install npm:@damngamerz/pi-otel
```

For a pinned install:

```bash
pi install npm:@damngamerz/pi-otel@0.1.1
```

## Local Grafana quick start

```bash
cd examples/grafana-lgtm
docker compose up -d
```

Open <http://127.0.0.1:33000/d/damngamerz-pi-otel/atdamngamerz-pi-otel>.

The extension exports OTLP/HTTP to `http://127.0.0.1:4318` by default.

## Configure

Add `piOtel` to `~/.pi/agent/settings.json` or a trusted project's `.pi/settings.json`:

```jsonc
{
  "piOtel": {
    "enabled": true,
    "endpoint": "http://127.0.0.1:4318",
    "evaluation": {
      "mode": "off",
      "provider": "openai-codex",
      "model": "gpt-5.4-mini"
    }
  }
}
```

Evaluation modes:

- `off` — no remote evaluation; default
- `manual` — evaluate through `/otel-eval-last`
- `sample` — deterministically evaluate a configured fraction
- `always` — evaluate every settled response

See [configuration](docs/configuration.md) for every setting and environment override.

## Commands

```text
/otel-status
/otel-flush
/otel-eval-last
```

## Telemetry

Primary metrics include:

- `gen_ai.client.operation.duration`
- `gen_ai.client.token.usage`
- `gen_ai.client.tool_calls_per_operation`
- `gen_ai.client.tool.calls`
- `gen_ai.evaluation.score`
- `pi.agent.prompts`
- `pi.agent.turns`
- `pi.agent.tool.duration`
- `pi.agent.tool.errors`
- `pi.agent.session.duration`
- `pi.agent.cost`
- `pi.agent.time_to_first_token`

See [metrics](docs/metrics.md) for the full reference.

## Security

Pi packages execute with the user's full permissions. Review extension source before installation and pin versions in sensitive environments.

This package:

- has no install or postinstall scripts
- does not start Docker or modify system services
- rejects remote OTLP endpoints unless explicitly enabled and protected by HTTPS
- rejects endpoint URLs containing credentials
- keeps baseline telemetry content-free

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Development

```bash
npm install --ignore-scripts
npm run check
npm pack --dry-run
```

## Acknowledgements

This project gratefully credits **Oleksii Nikiforov (`NikiforovAll`)** and the original [`NikiforovAll/pi-otel`](https://github.com/NikiforovAll/pi-otel) project. Its work directly inspired this package, and the Grafana dashboard is adapted from that project under Apache-2.0.

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md), [NOTICE](NOTICE), and [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt).

## License

Original package code is MIT licensed. The adapted Grafana dashboard remains subject to its Apache-2.0 attribution and notice.
