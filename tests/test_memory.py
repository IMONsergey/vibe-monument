from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from vibeos.memory import lint_memory


class MemoryTests(unittest.TestCase):
    def test_stale_path_is_reported(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "work" / "learnings").mkdir(parents=True)
            (root / "work" / "handoffs").mkdir(parents=True)
            (root / "work" / "learnings" / "2026-08-07-example.md").write_text("evidence: yes\nUse `src/missing.py`.\n")
            result = lint_memory(root)
            self.assertTrue(any("stale path" in w for w in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
