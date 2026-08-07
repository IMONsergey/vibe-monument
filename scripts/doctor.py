#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from vibeos.cli import main
raise SystemExit(main(['--root',str(ROOT),'doctor',*sys.argv[1:]]))
