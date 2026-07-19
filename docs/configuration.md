# Configuration

Configuration is read from `~/.pi/agent/settings.json` and, for trusted projects, `.pi/settings.json`. Project values override global values; environment variables override both.

```jsonc
{
  "piOtel": {
    "enabled": true,
    "endpoint": "http://127.0.0.1:4318",
    "allowRemoteEndpoint": false,
    "headers": {},
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

## Evaluation modes

| Mode | Behavior |
|---|---|
| `off` | Default. No conversation content is sent to an evaluator. |
| `manual` | `/otel-eval-last` evaluates the latest exchange. |
| `sample` | Deterministically evaluates `sampleRate` of settled exchanges. Manual evaluation remains available. |
| `always` | Evaluates every settled exchange. Manual evaluation remains available. |

`sample` decisions are stable for the same exchange, so retries do not change selection.

## Environment variables

| Variable | Purpose |
|---|---|
| `PI_OTEL_ENABLED` | Enable or disable the extension |
| `PI_OTEL_ENDPOINT` | OTLP base URL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Standard OTLP base URL fallback |
| `OTEL_EXPORTER_OTLP_HEADERS` | Comma-separated `key=value` headers |
| `OTEL_SERVICE_NAME` | OTel service name |
| `PI_OTEL_ALLOW_REMOTE_ENDPOINT` | Permit non-loopback OTLP endpoints |
| `PI_OTEL_TRACES` | Enable traces |
| `PI_OTEL_METRICS` | Enable metrics |
| `PI_OTEL_EVALUATION_MODE` | `off`, `manual`, `sample`, or `always` |
| `PI_OTEL_EVALUATION_SAMPLE_RATE` | Number from `0` to `1` |
| `PI_OTEL_EVALUATION_PROVIDER` | Pi judge provider |
| `PI_OTEL_EVALUATION_MODEL` | Pi judge model ID |
| `PI_OTEL_EVALUATION_MAX_CHARS` | Per-field limit from `256` to `100000` |
| `PI_OTEL_EVALUATION_BLOCK_SECRETS` | Enable likely-secret blocking |

## Remote collectors

Remote endpoints are rejected unless `allowRemoteEndpoint` is explicitly enabled, and non-loopback endpoints must use HTTPS. Use OTLP headers for remote credentials; credentials embedded in endpoint URLs are always rejected. Malformed or incorrectly typed `piOtel` settings are rejected rather than coerced.
