import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE = Path(__file__).with_name("free_real_token_engine.py")
spec = importlib.util.spec_from_file_location("free_real_token_engine", MODULE)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class StrictTokenHunterTests(unittest.TestCase):
    def setUp(self):
        self.item = {
            "title": "Example Token",
            "url": "https://project.example/claim",
            "resolvedUrl": "https://project.example/claim",
            "verification": "resolved-official-source",
        }
        self.trusted = {"project.example"}
        self.html = (
            '<html><head><link rel="canonical" href="https://project.example/claim"></head>'
            '<body>Claim is live. Free to claim. Token contract address: 0x1234567890abcdef</body></html>'
        )

    def run_eval(self, item=None, body=None, status=200, final=None):
        with patch.object(engine, "fetch", return_value=(final or "https://project.example/claim", body if body is not None else self.html, status)):
            return engine.evaluate(item or self.item, self.trusted)

    def test_accepts_explicit_live_free_token_evidence(self):
        result = self.run_eval()
        self.assertTrue(result["accepted"])
        self.assertEqual(result["status"], "VERIFIED_FREE_REAL_TOKEN")

    def test_rejects_missing_no_cost_evidence(self):
        body = "Claim is live. Token contract address: 0x1234567890abcdef"
        result = self.run_eval(body=body)
        self.assertFalse(result["accepted"])
        self.assertIn("no_explicit_no_cost_evidence", result["rejectionReasons"])

    def test_rejects_required_trade_condition(self):
        body = self.html.replace("Free to claim.", "Free to claim. Trading required.")
        result = self.run_eval(body=body)
        self.assertFalse(result["accepted"])
        self.assertIn("owner_or_cost_condition_detected", result["rejectionReasons"])

    def test_rejects_untrusted_redirect_domain(self):
        result = self.run_eval(final="https://phish.example/claim")
        self.assertFalse(result["accepted"])
        self.assertIn("official_source_not_proven", result["rejectionReasons"])

    def test_rejects_unverified_discovery(self):
        item = {**self.item, "verification": "unverified-discovery"}
        result = self.run_eval(item=item)
        self.assertFalse(result["accepted"])
        self.assertIn("official_source_not_proven", result["rejectionReasons"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
