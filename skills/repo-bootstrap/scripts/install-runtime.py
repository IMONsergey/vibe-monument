#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

MANAGED_BEGIN = "<!-- IMON-VIBEOS-CODEX:BEGIN -->"
MANAGED_END = "<!-- IMON-VIBEOS-CODEX:END -->"


def copy_path(src: Path, dst: Path, *, overwrite: bool = True) -> None:
    if not src.exists():
        raise FileNotFoundError(src)
    if src.is_dir():
        if dst.exists() and overwrite:
            shutil.rmtree(dst)
        if not dst.exists():
            shutil.copytree(src, dst)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if overwrite or not dst.exists():
            shutil.copy2(src, dst)


def plugin_or_source_root() -> tuple[Path, Path]:
    root = Path(__file__).resolve().parents[3]
    runtime = root / "runtime"
    return root, runtime if runtime.exists() else root


def project_config_template(runtime_root: Path) -> str:
    template = runtime_root / ".vibeos" / "config.template.toml"
    if template.exists():
        return template.read_text(encoding="utf-8")
    src = runtime_root / ".vibeos" / "config.toml"
    text = src.read_text(encoding="utf-8")
    text = re.sub(r'^project_name\s*=.*$', 'project_name = "UNCONFIGURED"', text, flags=re.M)
    text = re.sub(r'^mode\s*=.*$', 'mode = "project"', text, flags=re.M)
    text = re.sub(r'^runtime\s*=.*$', 'runtime = "codex"', text, flags=re.M)
    # Project commands must be discovered from the target, never inherited from VibeOS itself.
    for key in ("install", "dev", "lint", "typecheck", "test", "build", "e2e"):
        text = re.sub(rf'^{key}\s*=.*$', f'{key} = ""', text, flags=re.M)
    return text


def install(target: Path) -> None:
    source_root, runtime_root = plugin_or_source_root()
    target = target.resolve()
    if not (target / ".git").exists():
        print("WARN: target has no .git directory; continuing because Codex may be operating in a worktree/export", file=sys.stderr)

    # Runtime/control plane. These are VibeOS-owned paths.
    for rel in ["vibeos", "bin/vibeos", "workflows", "policies", "templates", "agents"]:
        copy_path(runtime_root / rel, target / rel, overwrite=True)
    copy_path(runtime_root / ".vibeos" / "router.toml", target / ".vibeos" / "router.toml", overwrite=True)
    schemas = runtime_root / ".vibeos" / "schemas"
    if schemas.exists():
        copy_path(schemas, target / ".vibeos" / "schemas", overwrite=True)

    cfg = target / ".vibeos" / "config.toml"
    if not cfg.exists():
        cfg.parent.mkdir(parents=True, exist_ok=True)
        cfg.write_text(project_config_template(runtime_root), encoding="utf-8")

    # Stable project context skeletons are only created when absent.
    source_context = runtime_root / "context"
    if source_context.exists():
        for src in source_context.glob("*.md"):
            copy_path(src, target / "context" / src.name, overwrite=False)

    # Keep VibeOS kernel separate from the project's own AGENTS.md and add only a managed pointer.
    kernel_src = runtime_root / "AGENTS.md"
    copy_path(kernel_src, target / "AGENTS.vibeos.md", overwrite=True)
    agents = target / "AGENTS.md"
    existing = agents.read_text(encoding="utf-8") if agents.exists() else ""
    block = f'''{MANAGED_BEGIN}\n## IMON VibeOS 2 — Codex operating layer\n\nFor software engineering work, read and follow `./AGENTS.vibeos.md` in addition to this project's local rules. VibeOS targets OpenAI Codex only. When VibeOS and project-specific rules conflict semantically, surface the conflict instead of silently choosing.\n{MANAGED_END}'''
    if MANAGED_BEGIN in existing and MANAGED_END in existing:
        pattern = re.compile(re.escape(MANAGED_BEGIN) + r".*?" + re.escape(MANAGED_END), re.S)
        merged = pattern.sub(block, existing)
    else:
        merged = existing.rstrip() + ("\n\n" if existing.strip() else "") + block + "\n"
    agents.write_text(merged, encoding="utf-8")

    (target / "work" / "specs").mkdir(parents=True, exist_ok=True)
    (target / "work" / "plans").mkdir(parents=True, exist_ok=True)
    (target / "work" / "reviews").mkdir(parents=True, exist_ok=True)
    (target / "work" / "handoffs").mkdir(parents=True, exist_ok=True)
    (target / "work" / "learnings").mkdir(parents=True, exist_ok=True)
    (target / "work" / "visual-qa").mkdir(parents=True, exist_ok=True)
    (target / "evidence").mkdir(parents=True, exist_ok=True)

    # Let VibeOS detect target-project commands after the files exist.
    subprocess.run([str(target / "bin" / "vibeos"), "--root", str(target), "bootstrap"], cwd=target, check=True)
    print(f"Installed VibeOS Codex project runtime into {target}")
    print("Next: ./bin/vibeos doctor")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    install(target)
