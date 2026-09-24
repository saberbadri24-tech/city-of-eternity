import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT=Path(__file__).with_name("high_value_opportunity_engine.py")

class HighValueEngineTests(unittest.TestCase):
    def run_engine(self, payload):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            (root/"guard-intelligence.json").write_text(json.dumps(payload),encoding="utf-8")
            (root/"guard-discovery.json").write_text(json.dumps({"items":[]}),encoding="utf-8")
            (root/"guard-learning.json").write_text(json.dumps({"outcomes":[]}),encoding="utf-8")
            code=SCRIPT.read_text(encoding="utf-8").replace(
                'ROOT = Path(__file__).resolve().parents[1]', f'ROOT = Path({str(root)!r})')
            p=root/"engine.py"; p.write_text(code,encoding="utf-8")
            subprocess.run([sys.executable,str(p)],capture_output=True,text=True,check=True)
            return json.loads((root/"guard-high-value.json").read_text(encoding="utf-8"))

    def test_high_value_lane_and_safety(self):
        out=self.run_engine({"trackedLeads":[{"id":"x","name":"Big","rewardUsd":2500,
            "officialDomain":True,"strictlyVerifiedFreeRealToken":True,"freshness":"FRESH_24H"}]})
        row=out["ranked"][0]
        self.assertTrue(row["highValueLane"]); self.assertEqual(row["priority"],"H1_HIGH_VALUE")
        self.assertTrue(row["ownerApprovalRequired"]); self.assertFalse(row["automaticAction"])

    def test_low_value_not_high_lane(self):
        out=self.run_engine({"trackedLeads":[{"id":"x","name":"Small","rewardUsd":100}]})
        self.assertFalse(out["ranked"][0]["highValueLane"])

    def test_portfolio_target_planning(self):
        out=self.run_engine({"trackedLeads":[
            {"id":"a","rewardUsd":6000,"source":"a.example"},
            {"id":"b","rewardUsd":5000,"source":"b.example"}]})
        self.assertTrue(out["portfolioPlan"]["coveredByPotentialValue"])
        self.assertEqual(out["portfolioPlan"]["targetGapUsd"],0)

    def test_stale_high_value_is_demoted(self):
        out=self.run_engine({"trackedLeads":[{"id":"x","rewardUsd":5000,
            "updatedAt":"2020-01-01T00:00:00+00:00"}]})
        row=out["ranked"][0]
        self.assertTrue(row["stale"]); self.assertNotEqual(row["priority"],"H1_HIGH_VALUE")

if __name__=="__main__":
    unittest.main()
