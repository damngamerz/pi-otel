# Privacy model

## Baseline telemetry

Baseline traces and metrics include only:

- provider and model names
- token and cache-token counts
- request, turn, tool, and session durations
- tool names and error status
- cost reported by Pi
- anonymized session identifiers

Provider, model, tool, error, and evaluation identifiers must match a bounded identifier syntax. Values containing path separators—including hierarchical model IDs—or resembling identity data, secrets, or free-form content are exported as `redacted`.

They exclude:

- prompts and responses
- thinking or reasoning text
- provider payloads
- tool arguments and results
- shell commands
- file paths and cwd
- usernames, hostnames, and email addresses

## Remote evaluation

Remote evaluation is disabled by default. When enabled, the latest user request and assistant text are sent to the configured Pi model. Tool results, thinking blocks, images, provider payloads, and system prompts are not included.

Safeguards:

- likely credentials and private keys cause a hard skip by default
- each text field is capped before transmission
- duplicate exchanges are evaluated once
- judge prompts and explanations are not exported through OTel
- only bounded scores, score labels, judge model, usage, latency, and cost are recorded

Secret detection is defense in depth, not a guarantee. Do not enable remote evaluation for conversations that may contain sensitive data unless the configured provider and organizational policy permit it.
