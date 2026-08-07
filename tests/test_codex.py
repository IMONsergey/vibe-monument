from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from vibeos.codex import build_codex_plugin
from vibeos.config import load_config

ROOT = Path(__file__).resolve().parents[1]


class CodexNativeTests(unittest.TestCase):
    def test_framework_is_codex_only_and_plugin_matches_marketplace(self):
        cfg = load_config(ROOT)
        self.assertEqual(cfg.get("runtime"), "codex")
        self.assertIs(cfg.get("codex_only"), True)
        for forbidden in ("CLAUDE.md", ".claude", ".cursor", "adapters"):
            self.assertFalse((ROOT / forbidden).exists(), forbidden)

        build_codex_plugin(ROOT)
        manifest = json.loads((ROOT / "plugins/vibeos/.codex-plugin/plugin.json").read_text())
        market = json.loads((ROOT / ".agents/plugins/marketplace.json").read_text())
        self.assertEqual(manifest["name"], "vibeos")
        self.assertEqual(manifest["skills"], "./skills/")
        self.assertTrue({"Interactive", "Read", "Write"}.issubset(manifest["interface"]["capabilities"]))
        entry = next(p for p in market["plugins"] if p["name"] == "vibeos")
        self.assertEqual(entry["source"]["path"], "./plugins/vibeos")
        self.assertEqual(entry["policy"]["products"], ["CODEX"])
        self.assertTrue((ROOT / "plugins/vibeos/runtime/bin/vibeos").exists())

    def test_plugin_bootstrap_installs_project_mode_without_clobbering_agents(self):
        installer = ROOT / "skills/repo-bootstrap/scripts/install-runtime.py"
        with tempfile.TemporaryDirectory() as td:
            target = Path(td)
            subprocess.run(["git", "init", "-q"], cwd=target, check=True)
            (target / "AGENTS.md").write_text("# Existing project rules\n\nKeep this.\n", encoding="utf-8")
            (target / "package.json").write_text(json.dumps({"scripts": {"test": "node --test", "build": "echo build"}}), encoding="utf-8")
            subprocess.run(["python3", str(installer), str(target)], cwd=target, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            agents = (target / "AGENTS.md").read_text(encoding="utf-8")
            self.assertIn("Keep this.", agents)
            self.assertIn("IMON-VIBEOS-CODEX:BEGIN", agents)
            cfg = load_config(target)
            self.assertEqual(cfg.get("mode"), "project")
            self.assertEqual(cfg.get("runtime"), "codex")
            self.assertIs(cfg.get("codex_only"), True)
            proc = subprocess.run([str(target / "bin/vibeos"), "--root", str(target), "doctor"], cwd=target, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)


if __name__ == "__main__":
    unittest.main()
