#!/usr/bin/env python3
from pathlib import Path
from vibeos.cli import main
ROOT=Path(__file__).resolve().parents[1]
raise SystemExit(main(["--root",str(ROOT),"codex","build-plugin"]))
