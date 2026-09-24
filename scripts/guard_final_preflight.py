#!/usr/bin/env python3
"""Fail-closed integrity gate for Immortal Guard before and after every run."""
from __future__ import annotations
import json, py_compile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REQUIRED_JSON=[
"guard-discovery.json","guard-intelligence.json","guard-high-value.json","guard-sources.json",
"guard-learning.json","guard-receipts.json","guard-approvals.json","guard-wallet.json",
"guard-capabilities.json","guard-horizon.json","guard-future-signals.json","guard-threat-report.json",
"guard-agent-contract.json","guard-agent-contract-report.json","guard-evidence-ledger.json",
"guard-anomaly-report.json","guard-replay-report.json"]
REQUIRED_SCRIPTS=[
"airdrop_guard.py","free_real_token_engine.py","global_opportunity_discovery.py","guard_final_preflight.py",
"guard_modular_core.py","guard_module_engine.py","guard_resilience_lab.py","guard_source_health.py",
"guard_ton_receipts.py","high_value_opportunity_engine.py","opportunity_intelligence.py",
"test_free_real_token_engine.py","test_high_value_opportunity_engine.py","test_opportunity_intelligence.py",
"test_guard_evolution.py","verify_global_discovery.py","guard_evolution_engine.py","guard_horizon_engine.py",
"future_opportunity_scout.py","guard_threat_engine.py","test_guard_threat_engine.py",
"guard_agent_contract.py","guard_evidence_ledger.py","guard_anomaly_engine.py","guard_replay_engine.py"]
def load(name):
 p=ROOT/name
 if not p.exists(): raise AssertionError(f"missing state: {name}")
 v=json.loads(p.read_text(encoding="utf-8"))
 if not isinstance(v,(dict,list)): raise AssertionError(f"invalid JSON root: {name}")
 return v
def main():
 for n in REQUIRED_SCRIPTS: py_compile.compile(str(ROOT/"scripts"/n),doraise=True)
 for n in REQUIRED_JSON: load(n)
 high=load("guard-high-value.json")
 assert high.get("targetIsPlanningOnly") is True and high.get("monthlyIncomeTargetUsd")==10000 and high.get("highValueFloorUsd")==2000
 assert isinstance(high.get("portfolioPlan"),dict) and high["portfolioPlan"].get("potentialValueUsd",0)>=0 and high["portfolioPlan"].get("targetGapUsd",0)>=0
 for row in high.get("ranked",[]):
  assert row.get("ownerApprovalRequired") is True and row.get("automaticAction") is False and row.get("estimatedRewardUsd",0)>=0
  if row.get("expired"): assert row.get("highValueLane") is False
  if row.get("highValueLane"): assert row.get("estimatedRewardUsd",0)>=2000
 intel=load("guard-intelligence.json")
 for row in intel.get("trackedLeads",[]): assert row.get("ownerApprovalRequired") is True and row.get("automaticAction") is False and row.get("claimExecuted") is False
 discovery=load("guard-discovery.json")
 for row in discovery.get("items",[]): assert row.get("action")=="never-auto-claim" and row.get("executionGate")=="OWNER_APPROVAL_REQUIRED"
 future=load("guard-future-signals.json")
 for row in future.get("items",[]): assert row.get("action")=="never-auto-claim" and row.get("executionGate")=="OWNER_APPROVAL_REQUIRED"
 assert load("guard-horizon.json").get("baseYear")==2026 and any(x.get("year")==2050 for x in load("guard-horizon.json").get("horizons",[]))
 assert load("guard-capabilities.json").get("selfModificationPolicy")=="PROPOSE_ONLY"
 assert load("guard-threat-report.json").get("status")=="PASS" and load("guard-threat-report.json").get("violations")==[]
 assert load("guard-agent-contract.json").get("policy")=="FAIL_CLOSED"
 assert load("guard-agent-contract-report.json").get("status")=="PASS"
 assert load("guard-replay-report.json").get("status")=="PASS"
 wallet=load("guard-wallet.json")
 assert wallet.get("privateKey") in (None,"",False) and wallet.get("seedPhrase") in (None,"",False) and wallet.get("mnemonic") in (None,"",False)
 print("FINAL_GUARD_PREFLIGHT=PASS")
if __name__=="__main__": main()
