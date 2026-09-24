import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class EvolutionTests(unittest.TestCase):
    def test_required_safety_contract(self):
        p=(ROOT/"scripts/guard_evolution_engine.py").read_text(encoding="utf-8")
        self.assertIn("PROPOSE_ONLY", p)
        self.assertIn("selfModificationPolicy", p)

    def test_horizon_has_2050_gate(self):
        p=(ROOT/"scripts/guard_horizon_engine.py").read_text(encoding="utf-8")
        self.assertIn('"year":2050', p)
        self.assertIn("no private keys", p)

    def test_outputs_are_json_when_present(self):
        for name in ("guard-capabilities.json","guard-horizon.json"):
            path=ROOT/name
            if path.exists():
                data=json.loads(path.read_text(encoding="utf-8"))
                self.assertIsInstance(data,dict)

if __name__=="__main__":
    unittest.main()
