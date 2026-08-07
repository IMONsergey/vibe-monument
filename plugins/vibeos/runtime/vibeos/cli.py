from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

from . import __version__
from .codex import build_codex_plugin, codex_status, install_codex_repo_layout
from .benchmark import routing_benchmark, validate_replay_seeds, validate_task_bank
from .bootstrap import bootstrap
from .config import find_root, load_config, load_router
from .doctor import run_doctor
from .evidence import close as evidence_close
from .evidence import record as evidence_record
from .evidence import run_command as evidence_run
from .evidence import start as evidence_start
from .guard import classify
from .memory import lint_memory
from .repomap import build_map, write_map
from .router import SIGNALS, route_task


def _root(args: argparse.Namespace) -> Path:
    return find_root(Path(args.root) if getattr(args, "root", None) else None)


def _print(data: object, as_json: bool = False) -> None:
    if as_json or isinstance(data, (dict, list)):
        print(json.dumps(data, ensure_ascii=False, indent=2, default=str))
    else:
        print(data)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="vibeos", description="IMON VibeOS 2 engineering runtime")
    p.add_argument("--root", help="VibeOS repository root (auto-detected by default)")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="show project/runtime status")
    b = sub.add_parser("bootstrap", help="detect project commands and build repo map")
    b.add_argument("--name")

    m = sub.add_parser("map", help="build mechanical repository map")
    m.add_argument("--stdout", action="store_true")

    r = sub.add_parser("route", help="route a task by intent + risk signals")
    r.add_argument("--intent", required=True, choices=["fast", "fast_patch", "build", "bug", "ui", "research", "epic", "review", "ship", "migration", "dependency", "incident"])
    r.add_argument("--signal", action="append", default=[], choices=list(SIGNALS))
    r.add_argument("--json", action="store_true")

    d = sub.add_parser("doctor", help="validate VibeOS structure and Codex-native package")
    d.add_argument("--json", action="store_true")

    g = sub.add_parser("guard", help="classify a proposed shell command")
    g.add_argument("command", nargs=argparse.REMAINDER)

    ev = sub.add_parser("evidence", help="manage evidence ledger")
    evsub = ev.add_subparsers(dest="evidence_cmd", required=True)
    es = evsub.add_parser("start")
    es.add_argument("label")
    er = evsub.add_parser("run")
    er.add_argument("--label", required=True)
    er.add_argument("--run-id")
    er.add_argument("command", nargs=argparse.REMAINDER)
    erec = evsub.add_parser("record")
    erec.add_argument("--label", required=True)
    erec.add_argument("--status", required=True, choices=["pass", "fail"])
    erec.add_argument("--artifact", default="")
    erec.add_argument("--note", default="")
    erec.add_argument("--run-id")
    ec = evsub.add_parser("close")
    ec.add_argument("--run-id")

    cx = sub.add_parser("codex", help="manage the Codex-native repository/plugin surfaces")
    cxsub = cx.add_subparsers(dest="codex_cmd", required=True)
    cxsub.add_parser("install", help="install repository-local Codex skill discovery and build the plugin")
    cxsub.add_parser("build-plugin", help="rebuild plugins/vibeos and marketplace metadata")
    cxsub.add_parser("status", help="show Codex-native integration status")

    mem = sub.add_parser("memory", help="memory hygiene commands")
    memsub = mem.add_subparsers(dest="memory_cmd", required=True)
    memsub.add_parser("lint")

    bench = sub.add_parser("benchmark", help="run VibeOS framework benchmarks")
    bsub = bench.add_subparsers(dest="benchmark_cmd", required=True)
    bsub.add_parser("routing")
    bsub.add_parser("tasks")
    bsub.add_parser("replay")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = _root(args)

    if args.cmd == "status":
        cfg = load_config(root)
        result = run_doctor(root)
        _print({"root": str(root), "version": __version__, "project_name": cfg.get("project_name"), "doctor": result["stats"], "errors": len(result["errors"]), "warnings": len(result["warnings"])})
        return 1 if result["errors"] else 0
    if args.cmd == "bootstrap":
        _print(bootstrap(root, args.name))
        return 0
    if args.cmd == "map":
        if args.stdout:
            _print(build_map(root))
        else:
            print(write_map(root).relative_to(root))
        return 0
    if args.cmd == "route":
        result = route_task(load_router(root), load_config(root), args.intent, set(args.signal))
        data = {
            "workflow": result.workflow, "risk": result.risk, "reasons": result.reasons,
            "required_skills": result.required_skills, "conditional_skills": result.conditional_skills,
            "fresh_review": result.fresh_review, "security_review": result.security_review, "require_full_spec": result.require_full_spec,
        }
        if args.json:
            _print(data, True)
        else:
            print(f"{result.workflow} (risk {result.risk}/100)")
            for reason in result.reasons: print(f"- {reason}")
            print("core skills: " + ", ".join(result.required_skills))
        return 0
    if args.cmd == "doctor":
        result = run_doctor(root)
        if args.json:
            _print(result, True)
        else:
            stats = result["stats"]
            print(f"VibeOS doctor: {stats.get('skills', 0)} skills, {stats.get('workflows', 0)} workflows, {stats.get('routing_cases', 0)} routing cases")
            for item in result["warnings"]: print(f"WARN: {item}")
            for item in result["errors"]: print(f"ERROR: {item}")
            print(f"{'FAILED' if result['errors'] else 'OK'}: {len(result['errors'])} error(s), {len(result['warnings'])} warning(s)")
        return 1 if result["errors"] else 0
    if args.cmd == "guard":
        command = " ".join(args.command).strip()
        result = classify(command)
        _print({"decision": result.decision, "reasons": result.reasons, "command": command})
        return 2 if result.decision == "DENY" else (1 if result.decision == "CONFIRM" else 0)
    if args.cmd == "evidence":
        if args.evidence_cmd == "start": _print(evidence_start(root, args.label)); return 0
        if args.evidence_cmd == "run":
            command = list(args.command)
            if command and command[0] == "--": command = command[1:]
            _print(evidence_run(root, args.label, command, args.run_id)); return 0
        if args.evidence_cmd == "record": _print(evidence_record(root, args.label, args.status, args.artifact, args.note, args.run_id)); return 0
        if args.evidence_cmd == "close":
            result = evidence_close(root, args.run_id); _print(result); return 0 if result["status"] == "PASS" else 1
    if args.cmd == "codex":
        if args.codex_cmd == "install":
            for line in install_codex_repo_layout(root): print(line)
            _print(build_codex_plugin(root))
            return 0
        if args.codex_cmd == "build-plugin":
            _print(build_codex_plugin(root)); return 0
        if args.codex_cmd == "status":
            _print(codex_status(root)); return 0
    if args.cmd == "memory" and args.memory_cmd == "lint":
        result = lint_memory(root, int(load_config(root).get("memory", {}).get("volatile_fact_max_age_days", 7)))
        _print(result); return 1 if result["errors"] else 0
    if args.cmd == "benchmark":
        if args.benchmark_cmd == "routing":
            result = routing_benchmark(root); _print(result); return 1 if result["failed"] else 0
        if args.benchmark_cmd == "tasks":
            result = validate_task_bank(root); _print(result); return 1 if result["errors"] else 0
        if args.benchmark_cmd == "replay":
            result = validate_replay_seeds(root); _print(result); return 1 if result["errors"] else 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
