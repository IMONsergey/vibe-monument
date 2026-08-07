# Contributing to VibeOS

VibeOS is deliberately resistant to prompt/framework bloat.

A core addition should satisfy all of these:

1. It addresses an observed failure mode, not merely a plausible-sounding best practice.
2. It has a clear trigger/scope and does not duplicate an existing skill/policy.
3. It can be tested mechanically, by routing cases, executable fixtures, or a real-task benchmark when possible.
4. It does not increase always-loaded context without a strong reason.
5. It preserves canonical single-source instructions; the generated Codex plugin must be rebuilt rather than hand-edited.

Before proposing a change run:

```bash
python scripts/check_all.py
```

If a new mechanism adds ceremony but does not improve correctness, reviewability, safety, or human burden in its target class, remove it.
