# Integration tests

Authenticated Pi RPC smoke tests are intentionally not part of default CI because they require provider credentials and incur model cost.

Before a release, validate against the current supported Pi version:

1. start the example LGTM stack
2. load `dist/index.js` with Pi RPC mode
3. send a harmless prompt
4. exercise a successful and failed tool
5. test `manual`, `sample`, and `always` evaluation modes
6. verify metrics in Prometheus and correlated spans in Tempo
7. inspect exported telemetry for conversation content, paths, and identity data

Record the Pi version and verification result in the release notes. Recorded release-candidate runs are stored beside this checklist; see [validation-0.1.0.md](validation-0.1.0.md).
