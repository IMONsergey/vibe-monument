from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from vibeos.bootstrap import detect_commands
from vibeos.repomap import build_map


class BootstrapTests(unittest.TestCase):
    def test_detects_pnpm_scripts(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9'\n")
            (root / "package.json").write_text(json.dumps({"scripts": {"dev": "vite", "test": "vitest", "build": "vite build", "typecheck": "tsc --noEmit"}}))
            commands = detect_commands(root)
            self.assertEqual(commands["install"], "pnpm install --frozen-lockfile")
            self.assertEqual(commands["dev"], "pnpm dev")
            self.assertEqual(commands["test"], "pnpm test")
            self.assertEqual(commands["typecheck"], "pnpm typecheck")

    def test_repo_map_detects_languages_and_tests(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "src").mkdir()
            (root / "tests").mkdir()
            (root / "src" / "app.ts").write_text("export const x = 1\n")
            (root / "tests" / "app.test.ts").write_text("test('x',()=>{})\n")
            result = build_map(root)
            self.assertEqual(result["languages"]["TypeScript"], 2)
            self.assertTrue(result["tests_sample"])


if __name__ == "__main__":
    unittest.main()
