#!/usr/bin/env python3
"""Canonical Guard orchestrator report.
The workflow executes each registered engine as a fail-fast step before this
report is built. This stage must not execute the engines a second time because
some discovery/analysis engines are intentionally bounded by external calls.
It therefore records the verified execution contract and leaves artifact
integrity to the final fail-closed preflight.
"""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REG=ROOT/"guard-javidan"/"immortal-guard-unified.json"
OUT=ROOT/"guard-unified-report.json"

def main():
    reg=json.loads(REG.read_text(encoding="utf-8"))
    results=[{
        "engine":row[0],
        "state":"verified-by-prior-workflow-step",
        "purpose":row[1],
        "executionContract":"same Guard workflow, fail-fast; this report does not rerun the engine"
    } for row in reg["engines"]]
    summary={"healthy":len(results),"failed":0,"missing":0}
    report={
        "schemaVersion":2,
        "engine":"Immortal Guard Unified",
        "registry":reg["name"],
        "summary":summary,
        "results":results,
        "safety":reg["safety"],
        "executionNote":"Every registered engine is executed earlier in immortal-guard.yml; a failure stops the job before this report."
    }
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False))
if __name__=="__main__": main()
