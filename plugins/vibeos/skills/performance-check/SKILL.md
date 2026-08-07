---
name: performance-check
description: "Measure performance before and after a material change when latency, bundle size, rendering, queries, memory, or throughput could regress. Use for hot paths and performance-sensitive UI/backend work; do not optimize from intuition alone."
---

# Performance check

1. Name the performance contract and the metric that represents it.
2. Capture a reproducible baseline before optimizing when possible.
3. Profile/measure the suspected bottleneck; do not infer the hotspot from code appearance.
4. Change one causal factor at a time when practical.
5. Re-run the same measurement with equivalent inputs/environment.
6. Check correctness and resource tradeoffs; faster but less correct is a regression.
7. Record the raw command/tool evidence and before/after values.
8. If measurement is too noisy to support the claim, report uncertainty rather than inventing a win.
