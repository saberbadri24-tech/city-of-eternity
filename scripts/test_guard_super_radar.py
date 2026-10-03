import importlib.util
from pathlib import Path

p=Path(__file__).with_name("guard_super_radar.py")
spec=importlib.util.spec_from_file_location("fusion",p)
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

a={"url":"https://example.com/a","officialEligible":True,"score":80}
b={"url":"https://example.com/a","officialEligible":False,"score":20}
assert m.ident(a,"a") == m.ident(b,"b"), "cross-lane identity must dedupe"
assert m.official({"executionGate":"UNOFFICIAL"}) is False
assert m.official({"verification":"resolved-official-source","url":"https://example.com/a"}) is True
assert m.official({"officialVerified":True}) is True
assert m.score({"score":"75"}) == 75.0
print("guard_super_radar self-test: PASS")
