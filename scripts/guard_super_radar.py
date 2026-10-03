#!/usr/bin/env python3
"""Immortal Guard Super Radar Fusion — one canonical view of every Guard/Airdrop+ lane."""
from __future__ import annotations
import json, hashlib
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NOW=datetime.now(timezone.utc)

def load(name):
    try:
        return json.loads((ROOT/name).read_text(encoding="utf-8"))
    except Exception:
        return {}

def rows(data):
    for key in ("items","ranked","opportunities","candidates","trackedLeads"):
        value=data.get(key) if isinstance(data,dict) else None
        if isinstance(value,list):
            return [x for x in value if isinstance(x,dict)]
    return []

def ident(x, lane):
    raw=str(x.get("id") or x.get("opportunityId") or x.get("url") or x.get("officialUrl") or x.get("project") or x.get("title") or x.get("name") or "")
    return hashlib.sha256((lane+"|"+raw.strip().lower()).encode()).hexdigest()[:20]

def official(x):
    if x.get("officialVerified") is True or x.get("officialEligible") is True:
        return True
    gate=str(x.get("executionGate") or "").upper()
    return "OFFICIAL" in gate

def score(x):
    for k in ("score","priorityScore","opportunityScore","finalScore"):
        try:
            return float(x.get(k))
        except Exception:
            pass
    return 0.0

def main():
    specs=[
        ("airdrop_plus","guard-opportunities.json"),
        ("free_real_token","guard-free-real-tokens.json"),
        ("high_value","guard-high-value.json"),
        ("global_discovery","guard-discovery.json"),
        ("intelligence","guard-intelligence.json"),
    ]
    merged={}
    counts={}
    for lane,file in specs:
        data=load(file); src=rows(data); counts[lane]=len(src)
        for x in src:
            key=ident(x,lane)
            item=dict(x)
            item["_lane"]=lane
            item["_fusionId"]=key
            item["_official"]=official(x)
            item["_score"]=score(x)
            # Prefer explicit provenance and URLs; never manufacture them.
            merged.setdefault(key,item)
            if score(item)<score(x): merged[key]=item
    ranked=sorted(merged.values(),key=lambda x:(x["_official"],x["_score"]),reverse=True)
    plans=load("guard-action-plans.json")
    status=load("guard-status.json")
    evidence=load("guard-evidence-ledger.json")
    health=load("guard-source-health.json")
    ai=(status.get("automation",{}) if isinstance(status,dict) else {})
    out={
      "schemaVersion":1,
      "engine":"Immortal Guard Super Radar Fusion",
      "generatedAt":NOW.isoformat(timespec="seconds"),
      "identity":"Super Airdrop = Immortal Guard = Airdrop+ opportunity control plane",
      "lanes":counts,
      "summary":{
        "totalCandidates":len(ranked),
        "officialCandidates":sum(1 for x in ranked if x["_official"]),
        "highPriority":sum(1 for x in ranked if x["_score"]>=70),
        "actionPlans":int(plans.get("planCount",0)) if isinstance(plans,dict) else 0,
        "evidenceRecords":len(rows(evidence)),
      },
      "policy":{
        "officialSourceRequired":True,
        "ownerApprovalRequired":True,
        "autoSign":False,
        "autoClaim":False,
        "autoTransfer":False,
        "kycCaptchaAntiSybilBypass":False,
        "privateKeysCollected":False,
      },
      "automation":{
        "radarCadence":"5m",
        "freshness":"generated on each successful Guard cycle",
        "ai":ai,
      },
      "sourceHealth":health.get("summary",health.get("counts",{})) if isinstance(health,dict) else {},
      "items":ranked[:2000],
    }
    (ROOT/"guard-super-radar.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"super_radar_fused","candidates":len(ranked),"official":out["summary"]["officialCandidates"]},ensure_ascii=False))

if __name__=="__main__":
    main()
