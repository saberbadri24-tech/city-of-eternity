#!/usr/bin/env python3
"""Immortal Guard High-Value Opportunity Engine.
Evidence-first portfolio ranking with deterministic learning and safety gates.
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
STALE_HOURS = 96

def load(name):
    try: return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError): return {}

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
    n=float(m.group(1).replace(",",""))
    return n*(1000 if m.group(2) in ("k","K") else 1000000 if m.group(2) in ("m","M") else 1)

def reward(item):
    vals=[number(item.get(k)) for k in ("rewardUsd","maxRewardUsd","estimatedRewardUsd","potentialRewardUsd","reward","prize","bounty","grant")]
    evidence=item.get("evidence",{})
    if isinstance(evidence,dict): vals += [number(x) for x in evidence.get("reward",[]) if isinstance(x,(str,int,float))]
    vals += [number(x) for x in item.get("rewardEvidence",[]) if isinstance(x,(str,int,float))]
    return min(REWARD_CAP_USD, max(vals+[0]))

def project_identity(item):
    for key in ("projectId","project_id","opportunityId","opportunity_id","slug"):
        v=str(item.get(key) or "").strip().lower()
        if v: return "id:"+v
    name=str(item.get("project") or item.get("projectName") or item.get("name") or "").strip().lower()
    domain=str(item.get("resolvedDomain") or item.get("officialDomainName") or "").strip().lower()
    if name and domain: return "project:"+re.sub(r"[^a-z0-9]+","-",domain+"-"+name).strip("-")
    if name: return "name:"+re.sub(r"[^a-z0-9]+","-",name).strip("-")
    url=str(item.get("canonicalUrl") or item.get("url") or "").strip().lower()
    return "url:"+url if url else ""

def deadline(item):
    for key in ("deadlineAt","deadline","endDate","expiresAt","expiry","expires"):
        raw=item.get(key)
        if not raw: continue
        try:
            s=str(raw).replace("Z","+00:00")
            d=dt.datetime.fromisoformat(s)
            if d.tzinfo is None: d=d.replace(tzinfo=dt.timezone.utc)
            return d
        except ValueError: pass
    return None

def age_hours(item):
    for key in ("verifiedAt","updatedAt","discoveredAt","publishedAt","createdAt"):
        raw=item.get(key)
        if not raw: continue
        try:
            s=str(raw).replace("Z","+00:00")
            d=dt.datetime.fromisoformat(s)
            if d.tzinfo is None: d=d.replace(tzinfo=dt.timezone.utc)
            return max(0,(NOW-d).total_seconds()/3600)
        except ValueError: pass
    return None

def signal(item, words):
    blob=json.dumps(item,ensure_ascii=False).lower()
    return any(w in blob for w in words)

def brain_scores(x, learning):
    r=x["estimatedRewardUsd"]
    verified=x.get("strictlyVerifiedFreeRealToken") or x.get("status")=="VERIFIED_FREE_REAL_TOKEN"
    official=x.get("officialDomain") is True or x.get("sourceTrust")=="official" or x.get("verification")=="resolved-official-source"
    fresh=x["ageHours"] is not None and x["ageHours"] <= 24
    stale=x["ageHours"] is not None and x["ageHours"] > STALE_HOURS
    deposit=signal(x,("deposit required","pay to enter","buy to qualify","stake required","funding required"))
    kyc=signal(x,("kyc","captcha","sybil"))
    corroboration=int(x.get("corroborationCount",0))
    # Learning is observational only: it adjusts evidence confidence, never invents reward probability.
    history_bonus=min(5, int(learning.get("officialVerificationRate",0)*5)) if learning else 0
    value=min(40, 10 + 30*(r/HIGH_VALUE_FLOOR_USD)) if r else 0
    evidence=25 if verified else (15 if official else 5)
    evidence=min(25,evidence + min(5,corroboration) + history_bonus)
    freshness=15 if fresh else (5 if not stale else 0)
    feasibility=10 - (5 if deposit else 0) - (2 if kyc else 0)
    risk=10 if official and not x.get("rejectionReasons") else 2
    if stale: risk=max(0,risk-5)
    if x.get("bountyOrGrantSignal"): evidence=min(25,evidence+3)
    return {"valueBrain":round(min(40,value),2),"evidenceBrain":max(0,evidence),
            "freshnessBrain":freshness,"feasibilityBrain":max(0,feasibility),"riskBrain":max(0,risk)}

def main():
    intel=load("guard-intelligence.json"); discovery=load("guard-discovery.json")
    learning=load("guard-learning.json")
    outcomes=learning.get("outcomes",[]) if isinstance(learning,dict) else []
    recent=[o for o in outcomes[-100:] if isinstance(o,dict) and o.get("type")=="discovery_verification"]
    official_rate=(sum(o.get("officialSourceMatches",0) for o in recent)/max(1,sum(o.get("discovered",0) for o in recent)))
    learning_model={"officialVerificationRate":round(official_rate,4),"sampleRuns":len(recent),
                    "rule":"historical verification quality only; no fabricated success probability"}

    candidates={}
    for row in items(intel)+items(discovery):
        key=project_identity(row)
        if key: candidates[key]={**candidates.get(key,{}),**row}

    ranked=[]
    for raw in candidates.values():
        x=dict(raw); x["estimatedRewardUsd"]=reward(x); x["rewardType"]=reward_type(x)
        x["ageHours"]=age_hours(x); d=deadline(x)
        x["deadlineAt"]=d.isoformat() if d else None
        x["expired"]=bool(d and d <= NOW)
        x["projectIdentity"]=project_identity(x)
        x["corroborationCount"]=int(x.get("corroborationCount",0))
        if x["expired"]: x["estimatedRewardUsd"]=0.0
        brains=brain_scores(x,learning_model); x["brainScores"]=brains
        x["highValueLane"]=x["estimatedRewardUsd"] >= HIGH_VALUE_FLOOR_USD and not x["expired"]
        x["monthlyTargetContributionUsd"]=round(min(x["estimatedRewardUsd"],MONTHLY_TARGET_USD),2)
        x["ownerApprovalRequired"]=True; x["automaticAction"]=False
        x["stale"]=x["ageHours"] is not None and x["ageHours"] > STALE_HOURS
        total=sum(brains.values()); x["highValueScore"]=round(min(100,total),2)
        x["priority"]="H1_HIGH_VALUE" if x["highValueLane"] and not x["stale"] else ("H2_STANDARD" if total>=35 and not x["expired"] else "H3_RESEARCH")
        ranked.append(x)

    ranked.sort(key=lambda x:(x["priority"]!="H1_HIGH_VALUE",-x["highValueScore"],-x["estimatedRewardUsd"]))
    # Greedy portfolio: distinct sources first, until the planning target is covered by potential value.
    portfolio=[]; used_projects=set(); total=0.0
    for x in ranked:
        project=x.get("projectIdentity") or project_identity(x)
        if project and project in used_projects: continue
        if x.get("rewardType")=="prize_pool": continue
        if x["estimatedRewardUsd"] <= 0 or x.get("expired"): continue
        portfolio.append({"id":x.get("id") or x.get("opportunityId") or x.get("url"),
                          "estimatedRewardUsd":x["estimatedRewardUsd"],"priority":x["priority"],
                          "highValueScore":x["highValueScore"],"projectIdentity":project})
        total += x["estimatedRewardUsd"]
        if project: used_projects.add(project)
        if total >= MONTHLY_TARGET_USD: break

    report={
      "guard":"ANIL X Immortal Guard","engine":"High-Value Opportunity Engine","version":"2.0",
      "generatedAt":NOW.isoformat(),"monthlyIncomeTargetUsd":MONTHLY_TARGET_USD,
      "highValueFloorUsd":HIGH_VALUE_FLOOR_USD,"targetIsPlanningOnly":True,
      "learning":learning_model,
      "portfolioPlan":{"potentialValueUsd":round(total,2),"targetGapUsd":round(max(0,MONTHLY_TARGET_USD-total),2),
                       "coveredByPotentialValue":total>=MONTHLY_TARGET_USD,"candidateCount":len(portfolio),"note":"Potential reward is not expected income or a guarantee."},
      "summary":{"tracked":len(ranked),"highValueCandidates":sum(x["highValueLane"] for x in ranked),
                 "freshHighValueCandidates":sum(x["highValueLane"] and not x["stale"] for x in ranked),
                 "potentialValueUsd":round(sum(x["estimatedRewardUsd"] for x in ranked),2)},
      "portfolio":portfolio,"ranked":ranked[:250],
      "brains":["value","evidence","freshness","feasibility","risk"],
      "policy":"Potential rewards are not guaranteed income. No claim, signing, KYC/CAPTCHA bypass, wallet connection, or transfer is automatic; owner approval is mandatory."
    }
    (ROOT/"guard-high-value.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"high_value_complete",**report["summary"],"portfolioPotentialUsd":round(total,2)},ensure_ascii=False))

if __name__=="__main__": main()
