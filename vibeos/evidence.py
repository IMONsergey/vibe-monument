from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Any

from .guard import classify
from .utils import dump_json, utc_now


def _state_dir(root: Path) -> Path:
    p = root / ".vibeos" / "state"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _evidence_dir(root: Path) -> Path:
    p = root / "evidence"
    p.mkdir(parents=True, exist_ok=True)
    return p


def start(root: Path, label: str) -> dict[str, Any]:
    run_id = f"{utc_now()[:10].replace('-', '')}-{uuid.uuid4().hex[:8]}"
    data = {"version": 1, "run_id": run_id, "label": label, "created_at": utc_now(), "checks": [], "status": "OPEN"}
    path = _evidence_dir(root) / f"{run_id}.json"
    dump_json(path, data)
    (_state_dir(root) / "current-evidence").write_text(run_id + "\n", encoding="utf-8")
    return data


def _current_id(root: Path, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    marker = _state_dir(root) / "current-evidence"
    if not marker.exists():
        raise FileNotFoundError("no current evidence run; start one with `vibeos evidence start <label>`")
    return marker.read_text(encoding="utf-8").strip()


def _load(root: Path, run_id: str) -> tuple[Path, dict[str, Any]]:
    path = _evidence_dir(root) / f"{run_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"evidence run not found: {run_id}")
    return path, json.loads(path.read_text(encoding="utf-8"))


def run_command(root: Path, label: str, command: list[str], run_id: str | None = None, timeout: int = 600) -> dict[str, Any]:
    if not command:
        raise ValueError("missing command after --")
    rid = _current_id(root, run_id)
    path, data = _load(root, rid)
    rendered = " ".join(command)
    guard = classify(rendered)
    if guard.decision != "ALLOW":
        raise PermissionError(f"command guard: {guard.decision}: {', '.join(guard.reasons)}")
    proc = subprocess.run(command, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, env=os.environ.copy())
    check = {
        "kind": "command",
        "label": label,
        "command": command,
        "started_at": utc_now(),
        "exit_code": proc.returncode,
        "passed": proc.returncode == 0,
        "stdout_tail": proc.stdout[-12000:],
        "stderr_tail": proc.stderr[-12000:],
    }
    data["checks"].append(check)
    dump_json(path, data)
    return check


def record(root: Path, label: str, status: str, artifact: str = "", note: str = "", run_id: str | None = None) -> dict[str, Any]:
    rid = _current_id(root, run_id)
    path, data = _load(root, rid)
    passed = status.lower() in {"pass", "passed", "ok", "true", "success"}
    check = {"kind": "record", "label": label, "passed": passed, "artifact": artifact, "note": note, "recorded_at": utc_now()}
    data["checks"].append(check)
    dump_json(path, data)
    return check


def close(root: Path, run_id: str | None = None) -> dict[str, Any]:
    rid = _current_id(root, run_id)
    path, data = _load(root, rid)
    data["closed_at"] = utc_now()
    data["status"] = "PASS" if data["checks"] and all(c.get("passed") for c in data["checks"]) else "FAIL"
    dump_json(path, data)
    return data
