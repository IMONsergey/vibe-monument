from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from vibeos.evidence import close, run_command, start


class EvidenceTests(unittest.TestCase):
    def test_command_run_and_close(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = start(root, "unit")
            check = run_command(root, "python", ["python", "-c", "print('ok')"], data["run_id"])
            self.assertTrue(check["passed"])
            final = close(root, data["run_id"])
            self.assertEqual(final["status"], "PASS")

    def test_guard_blocks_destructive_command(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data = start(root, "unit")
            with self.assertRaises(PermissionError):
                run_command(root, "bad", ["git", "reset", "--hard", "HEAD"], data["run_id"])


if __name__ == "__main__":
    unittest.main()
