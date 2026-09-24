#!/usr/bin/env python3
"""Immortal Guard Evolution Engine — bounded, evidence-first system auditor.

This is deliberately not a self-modifying agent. It observes the repository, scores
capability maturity, detects engineering gaps, and emits a reversible upgrade plan.
"""
from __future__ import annotations
import datetime as dt, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc)

CAPABILITIES = [
    ("discovery","Global discovery fabric","scripts/global_opportunity_discovery.py","Automated multilingual discovery"),
    ("verification","Evidence-first verification","scripts/verify_global_discovery.py","Resolved-source and evidence checks"),
    ("free_token","Strict free-real-token lane","scripts/free_real_token_engine.py","Rejects unsupported free-token claims"),
    ("airdrop_plus","Airdrop+ advisory lane","scripts/airdrop_guard.py","Advisory scan with optional model providers"),
    ("intelligence","Opportunity intelligence","scripts/opportunity_intelligence.py","Ranking, lifecycle and history"),
    ("high_value","High-value portfolio brain","scripts/high_value_opportunity_engine.py","Five deterministic scoring brains"),
    ("receipts","Read-only TON receipt monitor","scripts/guard_ton_receipts.py","Receipt observation without signing"),
    ("approval","Owner approval boundary","javidan-approval-queue-ui.js","Consequential actions remain gated"),
    ("resilience","Adversarial resilience lab","scripts/guard_resilience_lab.py","Malformed/untrusted input tests"),
    ("modular","Modular core","scripts/guard_modular_core.py","Dependency-light degraded operation"),
    ("preflight","Fail-closed preflight","scripts/guard_final_preflight.py","Integrity and policy gate"),
    ("learning","Evidence learning","guard-learning.json","Observational feedback only"),
    ("future","Evolution auditor","scripts/guard_evolution_engine.py","Bounded gap detection and upgrade proposals"),
    ("horizon","2050 horizon planner","scripts/guard_horizon_engine.py","Scenario-based future capability map"),
]

def exists(rel):
    return (ROOT / rel).exists()

def load_json(name):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except Exception:
        return {}

def main():
    implemented = []
    gaps = []
    for key, name, path, purpose in CAPABILITIES:
        code = exists(path)
        state = "IMPLEMENTED" if code else "MISSING"
        row = {"id": key, "name": name, "purpose": purpose, "path": path, "implementation": state}
        if code: implemented.append(row)
        else: gaps.append(row)

    workflow = (ROOT / ".github/workflows/anilx-crypto-guard.yml").read_text(encoding="utf-8") if (ROOT / ".github/workflows/anilx-crypto-guard.yml").exists() else ""
    secret_state = {
        "geminiConfigured": bool(__import__("os").environ.get("GEMINI_API_KEY")),
        "anthropicConfigured": bool(__import__("os").environ.get("ANTHROPIC_API_KEY")),
        "openaiConfigured": bool(__import__("os").environ.get("OPENAI_API_KEY")),
        "toncenterConfigured": bool(__import__("os").environ.get("TONCENTER_API_KEY")),
    }
    live_ai = any(secret_state.values())
    recommendations = [
        {"priority":"P0","id":"model_provider_health","reason":"Model-assisted verification is optional and must never be mistaken for live multi-model operation.","action":"Expose provider availability in every run report; keep deterministic fallback active."},
        {"priority":"P0","id":"source_gap_feedback","reason":"Configured feeds are not the whole internet.","action":"Record uncovered categories, failed domains, stale feeds and candidate source suggestions; quarantine new sources until verified."},
        {"priority":"P1","id":"evidence_graph","reason":"A flat row is weaker than claim-level provenance.","action":"Preserve claim, source, retrieval time, hash and conflict relationships."},
        {"priority":"P1","id":"anomaly_guard","reason":"Sudden zero-result or volume spikes can indicate upstream failure.","action":"Compare current counts with recent history and mark anomalies instead of silently accepting them."},
        {"priority":"P1","id":"effort_reward_frontier","reason":"Maximum reward alone can waste owner time.","action":"Model estimated effort, requirements, fees, deadline pressure and reversibility separately."},
        {"priority":"P2","id":"future-opportunity-lanes","reason":"Opportunity surfaces are expanding beyond classic airdrops.","action":"Add AI safety, open-source, research, security, grants, hackathons and creator/maintainer programs as separate lanes."},
    ]
    intelligence = load_json("guard-intelligence.json")
    high = load_json("guard-high-value.json")
    report = {
        "guard":"ANIL X Immortal Guard",
        "engine":"Evolution Engine",
        "version":"1.0-2050-ready",
        "generatedAt":NOW.isoformat(),
        "maturityModel":{"implemented":len(implemented),"missing":len(gaps),"modelAssistedLive":live_ai,
                        "note":"Maturity is an engineering status, not a performance guarantee."},
        "capabilities":implemented + gaps,
        "providerAvailability":secret_state,
        "observedState":{
            "trackedIntelligence":len(intelligence.get("trackedLeads",[])) if isinstance(intelligence,dict) else 0,
            "highValueCandidates":high.get("summary",{}).get("highValueCandidates",0) if isinstance(high,dict) else 0,
        },
        "upgradeQueue":recommendations,
        "selfModificationPolicy":"PROPOSE_ONLY: generated plans never rewrite production code or trust policy.",
        "nextCycle":"Observe -> detect gap -> propose -> test -> review -> deploy -> measure -> rollback if degraded",
    }
    (ROOT/"guard-capabilities.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"evolution_audit_complete","implemented":len(implemented),"missing":len(gaps),"modelAssistedLive":live_ai},ensure_ascii=False))

if __name__=="__main__": main()
