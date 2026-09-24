#!/usr/bin/env python3
"""Fail-closed integrity gate for Immortal Guard before and after every run."""
from __future__ import annotations
import json
import py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_JSON = [
    "guard-discovery.json", "guard-intelligence.json", "guard-high-value.json",
    "guard-sources.json", "guard-learning.json", "guard-receipts.json",
    "guard-approvals.json", "guard-wallet.json", "guard-capabilities.json", "guard-horizon.json", "guard-future-signals.json",
]

REQUIRED_SCRIPTS = [
    "airdrop_guard.py", "free_real_token_engine.py", "global_opportunity_discovery.py",
    "guard_final_preflight.py", "guard_modular_core.py", "guard_module_engine.py",
    "guard_resilience_lab.py", "guard_source_health.py", "guard_ton_receipts.py",
    "high_value_opportunity_engine.py", "opportunity_intelligence.py",
    "test_free_real_token_engine.py", "test_high_value_opportunity_engine.py",
    "test_opportunity_intelligence.py", "test_guard_evolution.py", "verify_global_discovery.py", "guard_evolution_engine.py", "guard_horizon_engine.py", "future_opportunity_scout.py",
]

def load(name):
    p = ROOT / name
    if not p.exists():
        raise AssertionError(f"missing state: {name}")
    value = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(value, (dict, list)):
        raise AssertionError(f"invalid JSON root: {name}")
    return value

def main():
    for name in REQUIRED_SCRIPTS:
        py_compile.compile(str(ROOT / "scripts" / name), doraise=True)

    for name in REQUIRED_JSON:
        load(name)

    high = load("guard-high-value.json")
    assert isinstance(high, dict)
    assert high.get("targetIsPlanningOnly") is True
    assert high.get("monthlyIncomeTargetUsd") == 10000
    assert high.get("highValueFloorUsd") == 2000
    assert isinstance(high.get("portfolioPlan"), dict)
    assert high["portfolioPlan"].get("potentialValueUsd", 0) >= 0
    assert high["portfolioPlan"].get("targetGapUsd", 0) >= 0
    assert high.get("policy")

    for row in high.get("ranked", []):
        assert row.get("ownerApprovalRequired") is True
        assert row.get("automaticAction") is False
        assert row.get("estimatedRewardUsd", 0) >= 0
        if row.get("expired"):
            assert row.get("highValueLane") is False
        if row.get("highValueLane"):
            assert row.get("estimatedRewardUsd", 0) >= 2000
    for row in high.get("portfolio", []):
        assert row.get("estimatedRewardUsd", 0) > 0
        assert row.get("projectIdentity")


    intel = load("guard-intelligence.json")
    for row in intel.get("trackedLeads", []):
        assert row.get("ownerApprovalRequired") is True
        assert row.get("automaticAction") is False
        assert row.get("claimExecuted") is False

    discovery = load("guard-discovery.json")
    for row in discovery.get("items", []):
        assert row.get("action") == "never-auto-claim"
        assert row.get("executionGate") == "OWNER_APPROVAL_REQUIRED"

    horizon = load("guard-horizon.json")
    assert horizon.get("baseYear") == 2026
    assert any(x.get("year") == 2050 for x in horizon.get("horizons", []))
    capabilities = load("guard-capabilities.json")
    assert capabilities.get("selfModificationPolicy") == "PROPOSE_ONLY"

    future = load("guard-future-signals.json")
    for row in future.get("items", []):
        assert row.get("action") == "never-auto-claim"
        assert row.get("executionGate") == "OWNER_APPROVAL_REQUIRED"

    wallet = load("guard-wallet.json")
    assert isinstance(wallet, dict)
    assert wallet.get("privateKey") in (None, "", False)
    assert wallet.get("seedPhrase") in (None, "", False)
    assert wallet.get("mnemonic") in (None, "", False)

    print("FINAL_GUARD_PREFLIGHT=PASS")

if __name__ == "__main__":
    main()
