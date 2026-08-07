#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shlex
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "evals" / "fixtures"
RESULTS = ROOT / "evals" / "results"


def fixture_ids() -> list[str]:
    return sorted(p.name for p in FIXTURES.iterdir() if p.is_dir() and (p / "task.json").exists())


def hidden_check(fixture: Path, workspace: Path) -> tuple[bool, str]:
    proc = subprocess.run(["python", str(fixture / "hidden_test.py"), str(workspace)], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return proc.returncode == 0, (proc.stdout + proc.stderr)[-12000:]


def overlay_vibeos(workspace: Path) -> None:
    for name in ["AGENTS.md", "skills", "workflows", "policies", "templates", "agents", "bin", "vibeos", ".vibeos"]:
        src = ROOT / name
        dst = workspace / name
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True, symlinks=False)
        else:
            shutil.copy2(src, dst)
    agents_dir = workspace / ".agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    skills_link = agents_dir / "skills"
    if not skills_link.exists():
        skills_link.symlink_to("../skills", target_is_directory=True)


def init_git(workspace: Path) -> str:
    subprocess.run(["git", "init", "-q"], cwd=workspace, check=True)
    subprocess.run(["git", "config", "user.email", "vibeos-eval@example.invalid"], cwd=workspace, check=True)
    subprocess.run(["git", "config", "user.name", "VibeOS Eval"], cwd=workspace, check=True)
    subprocess.run(["git", "add", "-A"], cwd=workspace, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "fixture baseline"], cwd=workspace, check=True)
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=workspace, text=True).strip()


def run_one(task_id: str, variant: str, agent_command: str, keep: bool = False) -> dict:
    fixture = FIXTURES / task_id
    task = json.loads((fixture / "task.json").read_text())
    temp = Path(tempfile.mkdtemp(prefix=f"vibeos-{task_id}-{variant}-"))
    workspace = temp / "workspace"
    shutil.copytree(fixture / "repo", workspace)
    if variant == "vibeos":
        overlay_vibeos(workspace)
    start_sha = init_git(workspace)
    prompt_file = temp / "prompt.txt"
    prompt_file.write_text(task["request"] + "\n", encoding="utf-8")

    before_ok, before_output = hidden_check(fixture, workspace)
    if before_ok:
        raise RuntimeError(f"fixture {task_id} is invalid: hidden test already passes at baseline")

    replacements = {
        "workspace": shlex.quote(str(workspace)),
        "prompt_file": shlex.quote(str(prompt_file)),
        "variant": shlex.quote(variant),
        "task_id": shlex.quote(task_id),
    }
    command = agent_command.format(**replacements)
    started = time.perf_counter()
    proc = subprocess.run(command, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=workspace)
    elapsed = time.perf_counter() - started
    passed, hidden_output = hidden_check(fixture, workspace)
    diff = subprocess.run(["git", "diff", "--stat"], cwd=workspace, text=True, stdout=subprocess.PIPE).stdout
    result = {
        "task_id": task_id,
        "variant": variant,
        "starting_commit": start_sha,
        "agent_exit_code": proc.returncode,
        "hidden_passed": passed,
        "elapsed_seconds": round(elapsed, 3),
        "diff_stat": diff.strip(),
        "agent_stdout_tail": proc.stdout[-12000:],
        "agent_stderr_tail": proc.stderr[-12000:],
        "hidden_output_tail": hidden_output,
        "workspace": str(workspace) if keep else None,
        "command": command,
    }
    if not keep:
        shutil.rmtree(temp, ignore_errors=True)
    return result


def validate_fixtures() -> dict:
    failures=[]
    for task_id in fixture_ids():
        fixture=FIXTURES/task_id
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)/'base'; sol=Path(td)/'solution'
            shutil.copytree(fixture/'repo',base); shutil.copytree(fixture/'solution',sol)
            baseline,_=hidden_check(fixture,base); solution,out=hidden_check(fixture,sol)
            if baseline or not solution:
                failures.append({'task_id':task_id,'baseline_should_fail':baseline,'solution_should_pass':solution,'output':out})
    return {'fixtures':len(fixture_ids()),'failed':len(failures),'failures':failures}


def main() -> int:
    p=argparse.ArgumentParser(description='Codex A/B harness for VibeOS executable agent fixtures')
    sub=p.add_subparsers(dest='cmd',required=True)
    sub.add_parser('list')
    sub.add_parser('validate')
    run=sub.add_parser('run')
    run.add_argument('--task',action='append',required=True,choices=fixture_ids())
    run.add_argument('--variant',action='append',choices=['vanilla','vibeos'],default=[])
    run.add_argument('--agent-command',required=True,help='Codex shell template; use {workspace} and {prompt_file} placeholders')
    run.add_argument('--keep-workspace',action='store_true')
    args=p.parse_args()
    if args.cmd=='list':
        for x in fixture_ids(): print(x)
        return 0
    if args.cmd=='validate':
        result=validate_fixtures(); print(json.dumps(result,indent=2)); return 1 if result['failed'] else 0
    variants=args.variant or ['vanilla','vibeos']
    rows=[]
    for task in args.task:
        for variant in variants:
            rows.append(run_one(task,variant,args.agent_command,args.keep_workspace))
    RESULTS.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    path=RESULTS/f'{stamp}-benchmark.json'
    path.write_text(json.dumps(rows,indent=2)+'\n')
    print(path.relative_to(ROOT))
    print(json.dumps(rows,indent=2))
    return 0 if all(r['hidden_passed'] for r in rows) else 1

if __name__=='__main__':
    raise SystemExit(main())
