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
    raw=str(x.get("opportunityId") or x.get("id") or x.get("officialUrl") or x.get("url") or x.get("contractAddress") or x.get("project") or x.get("name") or x.get("title") or "")
    return hashlib.sha256(raw.strip().lower().encode()).hexdigest()[:20]

def official(x):
    # Never infer official provenance from a label alone.
    if x.get("officialVerified") is True:
        return True
    if x.get("verification") == "resolved-official-source" and str(x.get("resolvedUrl") or x.get("url") or "").startswith("https://"):
        return True
    return False

def radar_score(x):
    base=score(x)
    reward=0.0
    for k in ("rewardUsd","estimatedRewardUsd","maxRewardUsd","potentialRewardUsd","bounty","grant"):
        try: reward=max(reward,float(x.get(k) or 0))
        except Exception: pass
    reward_points=min(25.0,reward/1000.0) if reward else 0.0
    evidence_points=min(20.0,float(x.get("corroborationCount") or 0)*4)
    fresh_points=0.0
    for k in ("verifiedAt","updatedAt","discoveredAt"):
        if x.get(k):
            try:
                from datetime import datetime,timezone
                d=datetime.fromisoformat(str(x[k]).replace("Z","+00:00"))
                if d.tzinfo is None:d=d.replace(tzinfo=timezone.utc)
                age=max(0,(NOW-d).total_seconds()/3600)
                fresh_points=20.0 if age<=6 else 14.0 if age<=24 else 7.0 if age<=72 else 0.0
                break
            except Exception: pass
    eligibility=15.0 if x.get("eligibility") or x.get("eligibilitySignals") else 5.0
    friction=10.0
    blob=json.dumps(x,ensure_ascii=False).lower()
    if any(k in blob for k in ("deposit required","pay to enter","buy to qualify")): friction-=7.0
    if any(k in blob for k in ("kyc","captcha")): friction-=4.0
    return round(min(100.0,max(base,reward_points+evidence_points+fresh_points+eligibility+friction)),2)

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
            item["_score"]=radar_score(x)
            # Prefer explicit provenance and URLs; never manufacture them.
            existing=merged.get(key)
            if existing is None:
                merged[key]=item
            else:
                # Merge provenance without allowing a weaker lane to erase stronger evidence.
                existing["_lanes"]=sorted(set(existing.get("_lanes",[existing.get("_lane")]))|{lane})
                existing["_official"]=bool(existing.get("_official")) or item["_official"]
                if score(item)>score(existing):
                    existing.update(item)
                    existing["_lanes"]=sorted(set(existing.get("_lanes",[]))|set(existing.get("_lanes",[])))
    if not any(counts.values()):
        raise RuntimeError("super_radar_no_input_lanes")
    ranked=sorted(merged.values(),key=lambda x:(x["_official"],x["_score"],str(x.get("title") or x.get("name") or "")),reverse=True)
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
        "actionableOfficial":sum(1 for x in ranked if x["_official"] and x["_score"]>=70 and x.get("actionStage") not in ("WATCH","UNSUPPORTED_NO_VERIFIED_CLAIM_METHOD")),
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
