#!/usr/bin/env python3
"""Immortal Guard High-Value Opportunity Engine.

Builds a transparent, multi-brain ranking layer for higher-value opportunities.
It never claims, signs, bypasses KYC/CAPTCHA, or transfers assets.
"""
from __future__ import annotations
import datetime as dt
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc)
MONTHLY_TARGET_USD = 10000
HIGH_VALUE_FLOOR_USD = 2000
REWARD_CAP_USD = 250000

def load(name):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}

def items(value):
    if isinstance(value, list): return [x for x in value if isinstance(x, dict)]
    if isinstance(value, dict):
        for k in ("trackedLeads","rankedVerifiedOpportunities","opportunities","items","tokens","results"):
            if isinstance(value.get(k), list): return [x for x in value[k] if isinstance(x, dict)]
    return []

def number(v):
    if isinstance(v, (int,float)): return float(v)
    m = re.search(r"(?<![A-Za-z])\$?\s*([0-9][0-9,]*(?:\.\d+)?)\s*(k|K|m|M)?", str(v or ""))
    if not m: return 0.0
    n=float(m.group(1).replace(",","")); return n*(1000 if m.group(2) in ("k","K") else 1000000 if m.group(2) in ("m","M") else 1)

def reward(item):
    fields=("rewardUsd","maxRewardUsd","estimatedRewardUsd","potentialRewardUsd","reward","prize","bounty","grant")
    vals=[number(item.get(k)) for k in fields]
    evidence=item.get("evidence",{})
    if isinstance(evidence,dict):
        vals += [number(x) for x in evidence.get("reward",[]) if isinstance(x,(str,int,float))]
    vals += [number(x) for x in item.get("rewardEvidence",[]) if isinstance(x,(str,int,float))]
    return min(REWARD_CAP_USD, max(vals+[0]))

def brain_scores(x):
    r=x["estimatedRewardUsd"]
    verified=x.get("strictlyVerifiedFreeRealToken") or x.get("status")=="VERIFIED_FREE_REAL_TOKEN"
    official=x.get("officialDomain") is True or x.get("sourceTrust")=="official"
    fresh=x.get("freshness")=="FRESH_24H"
    # Independent lenses: value, evidence, feasibility, freshness, risk.
    value=min(40, 10 + 30*(r/HIGH_VALUE_FLOOR_USD)) if r else 0
    evidence=25 if verified else (15 if official else 5)
    freshness=15 if fresh else 5
    feasibility=10 if not any(k in str(x).lower() for k in ("kyc","captcha","deposit required","pay to enter")) else 0
    risk=10 if official and not x.get("rejectionReasons") else 2
    if x.get("bountyOrGrantSignal"): evidence=min(25,evidence+5)
    return {"valueBrain":round(min(40,value),2),"evidenceBrain":evidence,"freshnessBrain":freshness,"feasibilityBrain":feasibility,"riskBrain":risk}

def main():
    intel=load("guard-intelligence.json")
    discovery=load("guard-discovery.json")
    candidates={}
    for row in items(intel)+items(discovery):
        key=str(row.get("id") or row.get("opportunityId") or row.get("url") or row.get("source") or row.get("name") or "").strip().lower()
        if not key: continue
        candidates[key]={**candidates.get(key,{}),**row}
    ranked=[]
    for x in candidates.values():
        x=dict(x); x["estimatedRewardUsd"]=reward(x)
        brains=brain_scores(x); x["brainScores"]=brains
        x["highValueLane"]=x["estimatedRewardUsd"] >= HIGH_VALUE_FLOOR_USD
        x["monthlyTargetContributionUsd"]=round(min(x["estimatedRewardUsd"],MONTHLY_TARGET_USD),2)
        x["ownerApprovalRequired"]=True; x["automaticAction"]=False
        total=sum(brains.values())
        x["highValueScore"]=round(min(100,total),2)
        x["priority"]="H1_HIGH_VALUE" if x["highValueLane"] else ("H2_STANDARD" if total>=35 else "H3_RESEARCH")
        ranked.append(x)
    ranked.sort(key=lambda x:(x["priority"]!="H1_HIGH_VALUE",-x["estimatedRewardUsd"],-x["highValueScore"]))
    report={
      "guard":"ANIL X Immortal Guard","engine":"High-Value Opportunity Engine","version":"1.0",
      "generatedAt":NOW.isoformat(),"monthlyIncomeTargetUsd":MONTHLY_TARGET_USD,
      "highValueFloorUsd":HIGH_VALUE_FLOOR_USD,
      "targetIsPlanningOnly":True,
      "summary":{"tracked":len(ranked),"highValueCandidates":sum(x["highValueLane"] for x in ranked),
                 "potentialValueUsd":round(sum(x["estimatedRewardUsd"] for x in ranked),2)},
      "ranked":ranked[:250],
      "brains":["value","evidence","freshness","feasibility","risk"],
      "policy":"Potential rewards are not guaranteed income. No claim, signing, KYC/CAPTCHA bypass, wallet connection, or transfer is automatic; owner approval is mandatory."
    }
    (ROOT/"guard-high-value.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"high_value_complete",**report["summary"]},ensure_ascii=False))

if __name__=="__main__": main()
