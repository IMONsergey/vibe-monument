from __future__ import annotations

import unittest
from pathlib import Path

from vibeos.config import load_config, load_router
from vibeos.router import route_task

ROOT = Path(__file__).resolve().parents[1]


class RouterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.router = load_router(ROOT)
        cls.config = load_config(ROOT)

    def test_fast_stays_fast_without_risk(self):
        result = route_task(self.router, self.config, "fast", set())
        self.assertEqual(result.workflow, "FAST_PATCH")
        self.assertLessEqual(result.risk, 20)

    def test_fast_unclear_escalates(self):
        result = route_task(self.router, self.config, "fast", {"unclear_acceptance"})
        self.assertEqual(result.workflow, "BUILD")

    def test_fast_ui_routes_ui(self):
        result = route_task(self.router, self.config, "fast", {"user_facing_ui"})
        self.assertEqual(result.workflow, "UI")

    def test_migration_hard_route(self):
        result = route_task(self.router, self.config, "bug", {"data_model_or_migration"})
        self.assertEqual(result.workflow, "MIGRATION")
        self.assertTrue(result.require_full_spec)

    def test_incident_precedes_migration(self):
        result = route_task(self.router, self.config, "build", {"data_model_or_migration", "incident_or_outage"})
        self.assertEqual(result.workflow, "INCIDENT")

    def test_migration_precedes_dependency(self):
        result = route_task(self.router, self.config, "build", {"data_model_or_migration", "external_dependency_change"})
        self.assertEqual(result.workflow, "MIGRATION")

    def test_auth_triggers_security_review(self):
        result = route_task(self.router, self.config, "build", {"auth_permissions_security"})
        self.assertTrue(result.security_review)

    def test_unknown_signal_rejected(self):
        with self.assertRaises(ValueError):
            route_task(self.router, self.config, "build", {"made_up"})


if __name__ == "__main__":
    unittest.main()
