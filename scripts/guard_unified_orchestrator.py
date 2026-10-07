#!/usr/bin/env python3
"""Canonical Immortal Guard orchestrator.
Runs the registry's independent engines in a deterministic, fail-visible order.
It does not sign, transfer, claim, bypass KYC/CAPTCHA, or touch private keys.
"""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"guard-javidan"/"immortal-guard-unified.json"
OUT=ROOT/"guard-unified-report.json"
def main():
    reg=json.loads(REG.read_text(encoding="utf-8"))
    results=[]
    priority={
        "global_opportunity_discovery.py":10,"official_discovery.py":20,"verify_global_discovery.py":30,
        "free_real_token_engine.py":40,"airdrop_guard.py":50,"guard_source_health.py":60,
        "opportunity_intelligence.py":70,"high_value_opportunity_engine.py":80,"guard_ton_receipts.py":90,
        "guard_threat_engine.py":100,"guard_evidence_ledger.py":110,"guard_anomaly_engine.py":120,
        "guard_replay_engine.py":130,"guard_workflow_security.py":140,"guard_agent_contract.py":150,
        "guard_evolution_engine.py":160,"guard_horizon_engine.py":170,"guard_modular_core.py":180,
        "guard_opportunity_graph.py":190,"guard_novelty_engine.py":200,"guard_action_planner.py":210,
        "guard_unlock_value_engine.py":220,"guard_super_radar.py":230,"guard_final_preflight.py":240
    }
    ordered=sorted(reg["engines"],key=lambda row:priority.get(row[0],1000))
    for row in ordered:
        script=ROOT/"scripts"/row[0]
        if not script.exists():
            results.append({"engine":row[0],"state":"missing","purpose":row[1]}); continue
        try:
            p=subprocess.run([sys.executable,str(script)],cwd=str(ROOT),capture_output=True,text=True,timeout=180)
            results.append({"engine":row[0],"state":"healthy" if p.returncode==0 else "failed","purpose":row[1],"returncode":p.returncode,"stdout":p.stdout[-1200:],"stderr":p.stderr[-1200:]})
        except Exception as e:
            results.append({"engine":row[0],"state":"failed","purpose":row[1],"error":type(e).__name__})
    summary={"healthy":sum(x["state"]=="healthy" for x in results),"failed":sum(x["state"]=="failed" for x in results),"missing":sum(x["state"]=="missing" for x in results)}
    report={"schemaVersion":1,"engine":"Immortal Guard Unified","registry":reg["name"],"summary":summary,"results":results,"safety":reg["safety"]}
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False))
    if summary["failed"] or summary["missing"]: raise SystemExit(1)
if __name__=="__main__": main()
