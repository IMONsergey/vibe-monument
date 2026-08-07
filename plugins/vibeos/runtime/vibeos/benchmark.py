from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import load_config, load_router
from .router import route_task


def routing_benchmark(root: Path) -> dict[str, Any]:
    router = load_router(root)
    config = load_config(root)
    cases_path = root / "evals" / "ROUTING_CASES.jsonl"
    total = 0
    passed = 0
    failures: list[dict[str, Any]] = []
    for line_no, line in enumerate(cases_path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        total += 1
        case = json.loads(line)
        result = route_task(router, config, case["intent"], set(case.get("signals", [])))
        if result.workflow == case["expected"]:
            passed += 1
        else:
            failures.append({"line": line_no, "id": case.get("id"), "expected": case["expected"], "actual": result.workflow, "risk": result.risk})
    return {"total": total, "passed": passed, "failed": total - passed, "pass_rate": (passed / total if total else 0.0), "failures": failures}


def validate_task_bank(root: Path) -> dict[str, Any]:
    required = {"id", "class", "request", "starting_commit", "acceptance", "permissions"}
    errors: list[str] = []
    count = 0
    for path in sorted((root / "evals" / "tasks").glob("*.json")):
        count += 1
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"{path.name}: invalid JSON: {exc}")
            continue
        missing = sorted(required - set(data))
        if missing:
            errors.append(f"{path.name}: missing {', '.join(missing)}")
    return {"tasks": count, "errors": errors}


def validate_replay_seeds(root: Path) -> dict[str, Any]:
    path = root / "evals" / "replay" / "PUBLIC_REPLAY_SEEDS.jsonl"
    required = {"id", "repository", "repository_url", "target_sha", "task", "class", "base_rule", "oracle", "status", "provenance"}
    errors: list[str] = []
    seen: set[str] = set()
    count = 0
    if not path.exists():
        return {"seeds": 0, "errors": ["missing evals/replay/PUBLIC_REPLAY_SEEDS.jsonl"]}
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        count += 1
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"line {line_no}: invalid JSON: {exc}")
            continue
        missing = sorted(required - set(row))
        if missing:
            errors.append(f"line {line_no}: missing {', '.join(missing)}")
            continue
        if row["id"] in seen:
            errors.append(f"line {line_no}: duplicate id {row['id']}")
        seen.add(row["id"])
        sha = str(row["target_sha"])
        if len(sha) != 40 or any(ch not in "0123456789abcdef" for ch in sha.lower()):
            errors.append(f"line {line_no}: invalid target_sha")
        if row["oracle"] != row["target_sha"]:
            errors.append(f"line {line_no}: oracle must equal target_sha for replay candidates")
        if row["status"] not in {"candidate", "certified", "rejected"}:
            errors.append(f"line {line_no}: invalid status {row['status']}")
        if not str(row["repository_url"]).startswith("https://github.com/"):
            errors.append(f"line {line_no}: replay corpus must use public GitHub URLs")
    return {"seeds": count, "errors": errors}
