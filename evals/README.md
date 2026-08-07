# VibeOS evals

This directory separates four different questions that are often incorrectly collapsed into one benchmark.

## 1. Does the framework mechanically work?

```bash
python scripts/check_all.py
```

## 2. Does deterministic routing behave at risk boundaries?

```bash
./bin/vibeos benchmark routing
```

`ROUTING_CASES.jsonl` includes natural-language scenario text plus explicit intent/risk signals and the expected workflow. This validates the risk engine; it does **not** prove an LLM will infer every signal correctly from arbitrary prose.

## 3. Can a coding agent solve controlled hidden-check fixtures?

```bash
python evals/harness.py validate
python evals/harness.py list
```

To run an external coding agent, pass a command template containing `{workspace}` and `{prompt_file}`. Run both `vanilla` and `vibeos` with the same model/version/permissions.

Example command shapes are intentionally not hard-coded because CLI flags and sandbox behavior are version-sensitive. Verify your installed agent CLI before benchmarking.

## 4. Does VibeOS improve real engineering outcomes?

Follow `BENCHMARK_PLAN.md` using 100 historical tasks from real repositories. That is the evidence required for any broad superiority claim.
