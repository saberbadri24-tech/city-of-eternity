"""Regression tests for Guard's offline intelligence scoring and normalization."""
import unittest
from scripts.opportunity_intelligence import identity, parse_date, score


class OpportunityIntelligenceTests(unittest.TestCase):
    def test_verified_token_requires_explicit_source_trust_for_trust_bonus(self):
        base = {"status": "VERIFIED_FREE_REAL_TOKEN", "evidence": {"live": ["a"], "free": ["b"], "tokenIdentity": ["c"]}}
        self.assertEqual(score(base), 50)
        base["officialDomain"] = True
        self.assertEqual(score(base), 60)

    def test_conditions_and_rejection_evidence_cancel_score(self):
        item = {"status": "VERIFIED_FREE_REAL_TOKEN", "evidence": {"live": ["a"], "free": ["b"], "tokenIdentity": ["c"], "requiredConditions": ["pay"]}}
        self.assertEqual(score(item), 0)
        item["evidence"].pop("requiredConditions")
        item["rejectionReasons"] = ["not-free"]
        self.assertEqual(score(item), 0)

    def test_identity_is_stable_for_same_explicit_id(self):
        self.assertEqual(identity({"id": "ABC"}), identity({"id": "ABC", "name": "changed"}))

    def test_timezone_naive_dates_are_normalized(self):
        parsed = parse_date("2026-09-23T12:00:00")
        self.assertIsNotNone(parsed)
        self.assertIsNotNone(parsed.tzinfo)

    def test_invalid_date_is_unknown(self):
        self.assertIsNone(parse_date("not-a-date"))


if __name__ == "__main__":
    unittest.main()
