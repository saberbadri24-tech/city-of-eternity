#!/usr/bin/env python3
"""Unlock Value Engine — chooses the next verification with the largest expected uncertainty reduction.

This is not an opportunity score. It optimizes investigative leverage: which single
missing fact, if verified, can unlock or clarify the most observed Guard records.
It is deterministic, evidence-bound, fail-closed, and never claims/signs/transfers.
"""
from __future__ import annotations
import hashlib, json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
FILES=("guard-opportunities.json","guard-free-real-tokens.json","guard-discovery.json",
       "guard-source-health.json","guard-opportunity-graph.json","guard-evidence-ledger.json",
       "guard-action-plans.json","guard-novelty.json")

def load(n):
    try:return json.loads((ROOT/n).read_text(encoding="utf-8"))
    except Exception:return None

def rows(v):
    if isinstance(v,list): return [x for x in v if isinstance(x,dict)]
    if isinstance(v,dict):
        for k in ("opportunities","items","candidates","records","entries"):
            if isinstance(v.get(k),list): return [x for x in v[k] if isinstance(x,dict)]
    return []

def text(v):
    if isinstance(v,(list,dict)): return json.dumps(v,ensure_ascii=False).lower()
    return str(v or "").lower()

def ident(o):
    raw="|".join(str(o.get(k,"")).strip().lower() for k in
                 ("project","chain","contractAddress","url","title"))
    return hashlib.sha256(raw.encode()).hexdigest()[:20]

def domain(o):
    try:return urlparse(str(o.get("url") or o.get("resolvedUrl") or "")).netloc.lower()
    except Exception:return ""

def main():
    pools=[]
    for n in FILES:
        v=load(n)
        if v is not None:pools.extend(rows(v))
    unique={}
    for o in pools:
        k=str(o.get("id") or ident(o))
        if k not in unique: unique[k]=o
        else:
            for f,v in o.items():
                if unique[k].get(f) in (None,"",[],{}) and v not in (None,"",[],{}):
                    unique[k][f]=v
    items=list(unique.values())

    dims=("identity","official_source","reward","eligibility","deadline","claim_method",
          "contract","chain","wallet_requirement","risk")
    missing=Counter(); owners=Counter(); affected=defaultdict(set); candidates=[]
    for o in items:
        blob=text(o)
        observed=set()
        if o.get("project") or o.get("title") or o.get("url"): observed.add("identity")
        if o.get("resolvedDomain") or o.get("publisher") or domain(o) in set():
            observed.add("official_source")
        if o.get("reward") or o.get("rewardEvidence") or "reward" in blob or "bounty" in blob: observed.add("reward")
        if o.get("eligibility") or o.get("eligibilitySignals") or "eligib" in blob: observed.add("eligibility")
        if o.get("deadline") or "deadline" in blob or "ends" in blob: observed.add("deadline")
        if o.get("claim") or o.get("claimMethod") or o.get("claimSignal") or "claim" in blob: observed.add("claim_method")
        if o.get("contractAddress"): observed.add("contract")
        if o.get("chain"): observed.add("chain")
        if "wallet" in blob or o.get("walletRequirement"): observed.add("wallet_requirement")
        if o.get("risk") or "risk" in blob or "scam" in blob: observed.add("risk")
        miss=[d for d in dims if d not in observed]
        for d in miss:
            missing[d]+=1
            affected[d].add(str(o.get("id") or ident(o)))
        if miss:
            candidates.append((o,miss,observed))

    actions={
      "official_source":"resolve and verify the project’s official source/domain",
      "reward":"verify an explicit reward/bounty/grant statement from an official source",
      "eligibility":"verify current eligibility requirements from an official source",
      "deadline":"verify the current deadline/status from an official source",
      "claim_method":"verify the official claim mechanism and whether it is currently open",
      "contract":"verify the official contract address from project documentation",
      "chain":"verify the network/chain from official documentation",
      "wallet_requirement":"verify whether and which wallet interaction is required",
      "risk":"verify security/risk indicators and official warnings",
      "identity":"resolve the project identity to a stable official reference",
    }
    scored=[]
    for o,miss,obs in candidates:
        dcount=len(miss)
        dom=domain(o)
        pressure=0
        if o.get("claimSignal") or o.get("claim"): pressure+=3
        if o.get("eligibilitySignal") or o.get("eligibility"): pressure+=2
        if o.get("rewardEvidence") or o.get("reward"): pressure+=2
        if o.get("contractAddress"): pressure+=2
        for d in miss:
            breadth=len(affected[d])
            redundancy=1
            if dom: redundancy=1+sum(1 for x in items if domain(x)==dom and domain(x))
            # Heuristic: leverage rises when a missing fact affects many records,
            # but is discounted when the candidate itself has little observed signal.
            signal=max(1, len(obs)+pressure)
            gain=min(1.0, breadth/25.0)
            confidence=min(1.0, signal/10.0)
            score=100*gain*(0.55+0.45*confidence)*(1+min(0.5,(redundancy-1)/10))
            scored.append({
              "checkId":hashlib.sha256((d+"|"+str(o.get("id") or ident(o))).encode()).hexdigest()[:20],
              "opportunityId":str(o.get("id") or ident(o)),
              "title":o.get("title") or o.get("project") or o.get("url"),
              "missingDimension":d,
              "unlockScore":round(score,2),
              "affectedObservedRecords":breadth,
              "observedSignalCount":len(obs),
              "sourceDomain":dom or None,
              "verificationAction":actions[d],
              "reason":"prioritize a missing fact whose verification can reduce uncertainty across multiple observed records",
              "costClass":"LOW" if d in ("identity","official_source","deadline","reward","eligibility") else "MEDIUM",
              "hypothesisOnly":True,
              "noInventedClaim":True,
              "ownerApprovalRequired":True
            })
    scored.sort(key=lambda x:(-x["unlockScore"],-x["affectedObservedRecords"],x["checkId"]))
    top=scored[:100]
    out={
      "schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),
      "engine":"Immortal Guard Unlock Value Engine","method":"expected verification impact / information leverage",
      "recordsObserved":len(items),"checksGenerated":len(scored),
      "topNextChecks":top,
      "dimensionDemand":dict(missing.most_common()),
      "safety":{"hypothesisOnly":True,"autoClaim":False,"autoSign":False,"autoTransfer":False,
                "privateKeysCollected":False,"kycCaptchaAntiSybilBypass":False},
      "limitations":["Scores are deterministic prioritization heuristics, not financial forecasts.",
                     "Only facts present in Guard artifacts are used; no reward, claim path, contract or eligibility is invented.",
                     "Verification remains owner-approved and external actions are not executed."]
    }
    (ROOT/"guard-unlock-value.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"recordsObserved":len(items),"checksGenerated":len(scored),
                      "top":top[0] if top else None},ensure_ascii=False))

if __name__=="__main__":main()
