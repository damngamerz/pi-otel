# Changelog

All notable changes to this project will be documented here.

## 0.1.2

- feat: tolerant JSON parser fallback for judge responses
- feat: add thinking-content detection in judge errors
- feat: `reasoning: "off"` for judge calls
- feat: increase judge maxTokens from 1_200 to 4_000
- feat: Grafana URL shown in /otel-status output
- build: bump @types/node to 25.9.5

## 0.1.1

- fix: safe JSON.parse in judge parser (no judge-response leak in errors)
- fix: env var empty string handled as unset, not falsy
- fix: tighten authorization regex boundary in secret detector
- fix: add ghp_, npm_ token patterns for secret detection
- feat: model pinning via piOtel.provider / piOtel.evaluation.provider
- feat: SpanLink correlation between evaluation and agent traces
- feat: broader secret pattern coverage
- feat: add /otel-eval-history command surface
- feat: lifecycle tests with in-memory OTel exporters
- docs: fix GenAI hyphen, add missing metrics to README
- docs: remove stale protocol field from PLAN.md
- docs: add screenshot preview to README
- ci: improved project settings error messages

## 0.1.0

- Add privacy-conscious Pi traces and GenAI metrics over OTLP/HTTP.
- Add optional manual, sampled, and always-on remote response evaluation.
- Add credential detection, deterministic sampling, and evaluation trace correlation.
- Add a pinned loopback-only Grafana LGTM example and provisioned dashboard.
