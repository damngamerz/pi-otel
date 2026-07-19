# Security policy

## Supported versions

Security fixes are provided for the latest published minor release.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for [`damngamerz/pi-otel`](https://github.com/damngamerz/pi-otel/security/advisories/new).

Include:

- affected version
- reproduction steps
- expected impact
- suggested mitigation, if known

Reports will be acknowledged as soon as practical. Please allow time for a coordinated fix before public disclosure.

## Security model

Pi extensions execute with the user's full system permissions. Review package source before installation and pin versions in sensitive environments.

Baseline telemetry intentionally excludes prompts, responses, thinking, tool arguments/results, shell commands, paths, and local identity. Remote evaluation changes that boundary and is disabled by default.
