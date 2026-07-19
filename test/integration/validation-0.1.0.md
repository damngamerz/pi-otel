# v0.1.0 release-candidate validation

Validated locally on 2026-07-19 with Node.js 22.22.2, npm 10.9.7, Pi 0.80.10, Docker Compose v5.3.1, and Grafana LGTM 0.29.1.

## Automated and package checks

- `npm run check`: formatting, linting, type checking, unit tests, and clean build passed.
- `npm audit --omit=dev --audit-level=high`: zero production vulnerabilities.
- `npm run --silent sbom`: valid CycloneDX JSON generated.
- `npm pack --dry-run --ignore-scripts`: only intended runtime, documentation, attribution, and example files included.
- A real tarball was installed into a clean temporary project with scripts disabled; package import and Pi extension loading passed.
- GitHub Actions YAML and `docker compose config --quiet` parsed successfully.

## Pi RPC and evaluation smoke test

A clean tarball installation was loaded by Pi RPC. One prompt exercised session, agent, turn, LLM, and shutdown handlers with evaluation mode `always` using `openai-codex/gpt-5.4-mini`.

Observed results:

- all four bounded evaluation scores were exported with value `1`
- evaluation, LLM, turn, and agent spans shared the expected trace
- no prompt text, response text, local path, username, hostname, email address, tool payload, or reasoning text appeared in sampled Tempo span payloads

The authenticated evaluation smoke test is intentionally manual because CI has no model credentials.

## Fresh Grafana LGTM example

The packaged Compose example was started on alternate loopback ports and reached `healthy`. Grafana provisioned dashboard UID `damngamerz-pi-otel` at `/d/damngamerz-pi-otel/atdamngamerz-pi-otel`. The stack was removed after verification.

## Release status

These checks validate the release candidate only. No npm publication or GitHub release was performed.
