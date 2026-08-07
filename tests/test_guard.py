import unittest

from vibeos.guard import classify


class GuardTests(unittest.TestCase):
    def test_safe_command_allowed(self):
        self.assertEqual(classify("python -m unittest").decision, "ALLOW")

    def test_force_push_requires_confirmation(self):
        self.assertEqual(classify("git push --force origin main").decision, "CONFIRM")

    def test_hard_reset_requires_confirmation(self):
        self.assertEqual(classify("git reset --hard HEAD~1").decision, "CONFIRM")

    def test_root_rm_denied(self):
        self.assertEqual(classify("rm -rf /").decision, "DENY")

    def test_drop_table_requires_confirmation(self):
        self.assertEqual(classify("psql -c 'DROP TABLE users'").decision, "CONFIRM")


if __name__ == "__main__":
    unittest.main()
