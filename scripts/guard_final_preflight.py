#!/usr/bin/env python3
"""Final deterministic integrity gate for Immortal Guard."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_JSON = [
    "guard-discovery.json","guard-intelligence.json","guard-high-value.json",
    "guard-sources.json","guard-learning.json","guard-receipts.json",
    "guard-approvals.json","guard-wallet.json",
]

def load(name):
    p=ROOT/name
    if not p.exists(): raise AssertionError(f"missing state: {name}")
    return json.loads(p.read_text(encoding="utf-8"))

def main():
    for name in REQUIRED_JSON: load(name)
    high=load("guard-high-value.json")
    assert high.get("targetIsPlanningOnly") is True
    assert high.get("monthlyIncomeTargetUsd")==10000
    assert high.get("highValueFloorUsd")==2000
    assert isinstance(high.get("portfolioPlan"),dict)
    assert high["portfolioPlan"].get("potentialValueUsd",0)>=0
    assert high["portfolioPlan"].get("targetGapUsd",0)>=0
    assert high.get("policy")

    for row in high.get("ranked",[]):
        assert row.get("ownerApprovalRequired") is True
        assert row.get("automaticAction") is False
        assert row.get("estimatedRewardUsd",0)>=0
        if row.get("highValueLane"): assert row.get("estimatedRewardUsd",0)>=2000

    intel=load("guard-intelligence.json")
    for row in intel.get("trackedLeads",[]):
        assert row.get("ownerApprovalRequired") is True
        assert row.get("automaticAction") is False
        assert row.get("claimExecuted") is False

    discovery=load("guard-discovery.json")
    for row in discovery.get("items",[]):
        assert row.get("action")=="never-auto-claim"
        assert row.get("executionGate")=="OWNER_APPROVAL_REQUIRED"

    print("FINAL_GUARD_PREFLIGHT=PASS")

if __name__=="__main__": main()
