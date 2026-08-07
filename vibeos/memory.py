from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

PATH_RE = re.compile(r"`([^`]+/[^`]+)`")
DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")


def lint_memory(root: Path, max_volatile_age_days: int = 7) -> dict[str, Any]:
    warnings: list[str] = []
    errors: list[str] = []
    learnings = root / "work" / "learnings"
    handoffs = root / "work" / "handoffs"

    for path in sorted(learnings.glob("*.md")):
        if path.name == ".gitkeep":
            continue
        text = path.read_text(encoding="utf-8")
        if "evidence:" not in text.lower():
            warnings.append(f"{path.relative_to(root)}: no evidence field/reference")
        if not DATE_RE.search(text) and not DATE_RE.search(path.name):
            warnings.append(f"{path.relative_to(root)}: no date found")
        for raw in PATH_RE.findall(text):
            if raw.startswith(("http://", "https://")):
                continue
            candidate = (root / raw).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                continue
            if not candidate.exists():
                warnings.append(f"{path.relative_to(root)}: stale path reference `{raw}`")

    names: set[str] = set()
    for path in sorted(handoffs.glob("*.md")):
        if path.name == ".gitkeep":
            continue
        if path.name in names:
            errors.append(f"duplicate handoff filename: {path.name}")
        names.add(path.name)

    return {"errors": errors, "warnings": warnings, "max_volatile_age_days": max_volatile_age_days}
