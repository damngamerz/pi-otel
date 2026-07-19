# Local Grafana LGTM example

This optional Compose stack provides Grafana, Tempo, Prometheus, Loki, and an OpenTelemetry Collector on loopback-only ports.

## Start

```bash
docker compose up -d
```

Open <http://127.0.0.1:33000/d/damngamerz-pi-otel/atdamngamerz-pi-otel>.

Default endpoints:

- OTLP gRPC: `127.0.0.1:4317`
- OTLP HTTP: `http://127.0.0.1:4318`
- Grafana: `http://127.0.0.1:33000`

Override host ports when necessary:

```bash
GRAFANA_PORT=34000 OTLP_HTTP_PORT=14318 docker compose up -d
```

The image is pinned by version and digest, Linux capabilities are dropped, and all host bindings use `127.0.0.1`.

## Start after reboot

The example uses `restart: unless-stopped`. Ensure Docker itself is enabled at boot:

```bash
systemctl is-enabled docker
```

Use `restart: always` if the container must restart after reboot even when it was manually stopped previously.

## Stop and remove

```bash
docker compose down
```

Telemetry is ephemeral and is removed with the container.

## Dashboard attribution

The dashboard is adapted from [`NikiforovAll/pi-otel`](https://github.com/NikiforovAll/pi-otel), Copyright 2026 Oleksii Nikiforov, under Apache-2.0. See the repository `NOTICE` and `LICENSES/Apache-2.0.txt` files.
