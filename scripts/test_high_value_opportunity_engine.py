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

    def test_same_project_cannot_double_count_portfolio(self):
        out=self.run_engine({"trackedLeads":[
            {"id":"a1","projectId":"same","rewardUsd":6000,"url":"https://a.example/1"},
            {"id":"a2","projectId":"same","rewardUsd":6000,"url":"https://a.example/2"},
            {"id":"b","projectId":"other","rewardUsd":5000}]})
        self.assertEqual(out["portfolioPlan"]["potentialValueUsd"],11000)
        self.assertEqual(out["portfolioPlan"]["candidateCount"],2)

    def test_prize_pool_not_counted_as_individual_reward(self):
        out=self.run_engine({"trackedLeads":[
            {"id":"pool","prize":50000,"projectId":"contest"},
            {"id":"b","rewardUsd":2500,"projectId":"b"}]})
        self.assertEqual(out["portfolioPlan"]["potentialValueUsd"],2500)
        self.assertEqual(out["ranked"][0]["rewardType"],"prize_pool" if out["ranked"][0]["id"]=="pool" else "individual_reward")

    def test_expired_opportunity_is_excluded(self):
        out=self.run_engine({"trackedLeads":[
            {"id":"old","rewardUsd":5000,"deadline":"2020-01-01T00:00:00+00:00"}]})
        row=out["ranked"][0]
        self.assertTrue(row["expired"])
        self.assertFalse(row["highValueLane"])
        self.assertEqual(out["portfolioPlan"]["potentialValueUsd"],0)

if __name__=="__main__":
    unittest.main()
