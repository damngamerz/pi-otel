# Operations

## Commands

- `/otel-status` — endpoint health, evaluation mode, and current-session counters
- `/otel-flush` — force-flush trace and metric buffers
- `/otel-eval-last` — evaluate the latest exchange when evaluation is enabled

## Local backend

Use the pinned Compose stack under `examples/grafana-lgtm/`.

```bash
cd examples/grafana-lgtm
docker compose up -d
docker compose ps
```

The example binds OTLP and Grafana ports to `127.0.0.1` only.

## Disable

Set this in Pi settings:

```json
{
  "piOtel": {
    "enabled": false
  }
}
```

Or set `PI_OTEL_ENABLED=0`.

## Uninstall

```bash
pi remove npm:@damngamerz/pi-otel
```

The package does not install or manage Docker services, systemd units, credentials, or data directories.
