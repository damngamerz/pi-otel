# Metrics

## GenAI metrics

| Metric | Type | Unit |
|---|---|---|
| `gen_ai.client.operation.duration` | Histogram | seconds |
| `gen_ai.client.token.usage` | Histogram | tokens |
| `gen_ai.client.tool_calls_per_operation` | Histogram | calls |
| `gen_ai.client.tool.calls` | Counter | calls |
| `gen_ai.evaluation.score` | Histogram | ratio |

## Pi metrics

| Metric | Type | Unit |
|---|---|---|
| `pi.agent.prompts` | Counter | prompts |
| `pi.agent.turns` | Counter | turns |
| `pi.agent.tool.duration` | Histogram | seconds |
| `pi.agent.tool.errors` | Counter | errors |
| `pi.agent.session.duration` | Histogram | seconds |
| `pi.agent.time_to_first_token` | Histogram | seconds |
| `pi.agent.cost` | Counter | USD |

Metric labels are intentionally low-cardinality. Session IDs, trace IDs, prompts, paths, and numeric evaluation values are not used as labels.

Evaluation results are represented both as score histograms and as `gen_ai.evaluation.result` events on a correlated evaluation span.
