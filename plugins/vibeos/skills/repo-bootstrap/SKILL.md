---
name: repo-bootstrap
description: "Install or refresh the VibeOS Codex project runtime, detect the repository's real commands, and initialize its control plane. Use once when enabling VibeOS in a repository or after the build/test stack changes materially."
---

# Bootstrap a repository for VibeOS in Codex

This skill is designed to work when loaded from the installed **VibeOS Codex plugin** or from the VibeOS source repository.

1. Resolve this skill's directory as `SKILL_DIR` — the absolute directory containing this `SKILL.md`.
2. Run the bundled installer against the current repository:

```bash
python3 "$SKILL_DIR/scripts/install-runtime.py" "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

3. The installer must preserve the project's existing `AGENTS.md` content. It writes the VibeOS kernel to `AGENTS.vibeos.md` and manages only the marked VibeOS pointer block in `AGENTS.md`.
4. Inspect the generated `.vibeos/config.toml`. Correct only commands the detector could not resolve safely; never invent commands that are absent from manifests/configuration/CI.
5. Inspect `.vibeos/cache/repo-map.json` for obvious generated/vendor noise or missing important areas.
6. Fill stable project/domain/architecture context from repository evidence and explicit human input; do not fabricate product facts.
7. Run `./bin/vibeos doctor` and resolve errors before treating the local VibeOS runtime as healthy.

Do not create `.claude`, `.cursor`, OpenCode, or generic agent-adapter files. VibeOS 2 targets OpenAI Codex only.
