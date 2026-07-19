# Response evaluation

The optional remote judge evaluates four dimensions:

- `task_success`
- `instruction_following`
- `relevance`
- `correctness`

Scores are validated numbers from `0` to `1`. Labels are restricted to `poor`, `fair`, `good`, and `excellent`. Invalid judge output is rejected rather than recorded.

## Correlation

Evaluation spans inherit the evaluated agent trace context. This makes the quality score visible beside the original Pi request, LLM calls, and tool activity without adding trace IDs to metric labels.

## Manual evaluation

Enable manual mode:

```json
{
  "piOtel": {
    "evaluation": {
      "mode": "manual"
    }
  }
}
```

Then run:

```text
/otel-eval-last
```

## Cost

Judge requests consume additional provider tokens. Judge token usage, latency, and cost are recorded under `gen_ai.operation.name=evaluate`. Use `manual` or `sample` mode when cost must be bounded.
