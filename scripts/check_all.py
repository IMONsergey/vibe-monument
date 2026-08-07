#!/usr/bin/env python3
from __future__ import annotations
import subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(*args):
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, check=True)

run(sys.executable,"-m","compileall","-q","vibeos")
run(sys.executable,"-m","unittest","discover","-s","tests","-v")
run(str(ROOT/"bin"/"vibeos"),"benchmark","routing")
run(str(ROOT/"bin"/"vibeos"),"benchmark","replay")
run(sys.executable,"evals/harness.py","validate")
run(str(ROOT/"bin"/"vibeos"),"codex","install")
run(str(ROOT/"bin"/"vibeos"),"doctor")
print("ALL CHECKS PASSED — CODEX NATIVE")
