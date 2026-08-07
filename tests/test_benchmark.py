from pathlib import Path
import unittest

from vibeos.benchmark import routing_benchmark, validate_replay_seeds

ROOT = Path(__file__).resolve().parents[1]


class BenchmarkTests(unittest.TestCase):
    def test_routing_bank_passes(self):
        result = routing_benchmark(ROOT)
        self.assertGreaterEqual(result["total"], 150)
        self.assertEqual(result["failed"], 0)

    def test_public_replay_seeds_are_valid(self):
        result = validate_replay_seeds(ROOT)
        self.assertEqual(result["errors"], [])
        self.assertGreaterEqual(result["seeds"], 40)


if __name__ == "__main__":
    unittest.main()
