import unittest, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class ThreatTests(unittest.TestCase):
    def test_report_contract(self):
        p=ROOT/"guard-threat-report.json"
        self.assertTrue(p.exists())
        x=json.loads(p.read_text())
        self.assertEqual(x["status"],"PASS")
        self.assertEqual(x["violations"],[])
    def test_wallet_no_custody_material(self):
        x=json.loads((ROOT/"guard-wallet.json").read_text())
        for k in ("privateKey","seedPhrase","mnemonic"):
            self.assertFalse(x.get(k))
if __name__=="__main__": unittest.main()
