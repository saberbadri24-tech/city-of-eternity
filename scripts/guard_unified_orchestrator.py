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
    for row in reg["engines"]:
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
