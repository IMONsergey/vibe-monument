from __future__ import annotations

import tomllib
from pathlib import Path
from typing import Any


def find_root(start: Path | None = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / ".vibeos").is_dir() and (candidate / "AGENTS.md").is_file():
            return candidate
    raise FileNotFoundError("VibeOS root not found (expected .vibeos/ and AGENTS.md)")


def load_toml(path: Path) -> dict[str, Any]:
    with path.open("rb") as fh:
        return tomllib.load(fh)


def load_config(root: Path) -> dict[str, Any]:
    return load_toml(root / ".vibeos" / "config.toml")


def load_router(root: Path) -> dict[str, Any]:
    return load_toml(root / ".vibeos" / "router.toml")
