from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path
from typing import Any

from .config import load_config
from .repomap import write_map
from .utils import atomic_write


def _quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def detect_commands(root: Path) -> dict[str, str]:
    commands = {k: "" for k in ("install", "dev", "lint", "typecheck", "test", "build", "e2e")}

    pkg = root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            scripts = data.get("scripts", {})
            manager = "npm"
            if (root / "pnpm-lock.yaml").exists(): manager = "pnpm"
            elif (root / "yarn.lock").exists(): manager = "yarn"
            elif (root / "bun.lockb").exists() or (root / "bun.lock").exists(): manager = "bun"
            commands["install"] = {"npm": "npm ci", "pnpm": "pnpm install --frozen-lockfile", "yarn": "yarn install --frozen-lockfile", "bun": "bun install --frozen-lockfile"}[manager]
            run = "npm run" if manager == "npm" else manager
            for key, candidates in {
                "dev": ("dev", "start"), "lint": ("lint",), "typecheck": ("typecheck", "type-check", "check-types"),
                "test": ("test",), "build": ("build",), "e2e": ("e2e", "test:e2e", "playwright"),
            }.items():
                for name in candidates:
                    if name in scripts:
                        commands[key] = f"{run} {name}"
                        break
        except json.JSONDecodeError:
            pass

    pyproject = root / "pyproject.toml"
    if pyproject.exists() and not commands["test"]:
        try:
            with pyproject.open("rb") as fh:
                data = tomllib.load(fh)
            tools = data.get("tool", {})
            if "pytest" in tools or (root / "pytest.ini").exists(): commands["test"] = "pytest"
            if "ruff" in tools: commands["lint"] = "ruff check ."
            if "mypy" in tools: commands["typecheck"] = "mypy ."
        except (tomllib.TOMLDecodeError, OSError):
            pass
    elif (root / "requirements.txt").exists() and not commands["install"]:
        commands["install"] = "python -m pip install -r requirements.txt"

    if (root / "Cargo.toml").exists():
        commands.update({"test": commands["test"] or "cargo test", "build": commands["build"] or "cargo build", "lint": commands["lint"] or "cargo clippy --all-targets --all-features -- -D warnings"})
    if (root / "go.mod").exists():
        commands.update({"test": commands["test"] or "go test ./...", "build": commands["build"] or "go build ./..."})

    return commands


def _replace_section(text: str, section: str, values: dict[str, str]) -> str:
    header = f"[{section}]"
    start = text.find(header)
    if start < 0:
        raise ValueError(f"missing TOML section {header}")
    after_header = text.find("\n", start) + 1
    next_section = text.find("\n[", after_header)
    end = len(text) if next_section < 0 else next_section + 1
    body = "".join(f"{k} = {_quote(v)}\n" for k, v in values.items())
    return text[:after_header] + body + text[end:]


def bootstrap(root: Path, project_name: str | None = None) -> dict[str, Any]:
    cfg_path = root / ".vibeos" / "config.toml"
    text = cfg_path.read_text(encoding="utf-8")
    commands = detect_commands(root)
    text = _replace_section(text, "commands", commands)
    name = project_name or root.name
    text = re.sub(r'^project_name\s*=\s*"[^"]*"', f"project_name = {_quote(name)}", text, count=1, flags=re.MULTILINE)
    atomic_write(cfg_path, text)
    map_path = write_map(root)
    config = load_config(root)
    return {"project_name": name, "commands": commands, "repo_map": str(map_path.relative_to(root)), "config_version": config.get("version")}
