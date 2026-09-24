#!/usr/bin/env python3
"""Detect feed failures and impossible jumps without blocking safe discovery."""
import json,datetime as dt
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(n):
    try:return json.loads((ROOT/n).read_text(encoding="utf-8"))
    except Exception:return {}
def main():
    d=load("guard-discovery.json"); s=load("guard-source-health.json"); prev=load("guard-anomaly-report.json")
    count=len(d.get("items",[])) if isinstance(d,dict) else 0
    sources=s.get("sources",0) if isinstance(s,dict) else 0
    old=prev.get("current",{}) if isinstance(prev,dict) else {}
    flags=[]
    if old and old.get("discoveryCount",0)>0:
        ratio=count/max(1,old["discoveryCount"])
        if ratio<0.05: flags.append("DISCOVERY_COLLAPSE")
        if ratio>20: flags.append("DISCOVERY_SPIKE")
    if sources and count==0: flags.append("ZERO_RESULTS_WITH_SOURCES")
    report={"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"status":"ANOMALY" if flags else "NORMAL","flags":sorted(set(flags)),
      "current":{"discoveryCount":count,"sourceCount":sources},"previous":old,
      "policy":"Anomalies quarantine confidence; they never create rewards or authorize actions."}
    (ROOT/"guard-anomaly-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("ANOMALY_GUARD="+report["status"])
if __name__=="__main__": main()
