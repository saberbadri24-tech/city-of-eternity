#!/usr/bin/env python3
"""Fail-closed Action Planner.

Turns verified evidence into an owner-ready action checklist. It deliberately
does NOT click websites, sign transactions, solve CAPTCHAs, bypass KYC/anti-Sybil,
or move assets. Unknown claim methods are explicitly UNSUPPORTED.
"""
from __future__ import annotations
import json
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(n):
    try:return json.loads((ROOT/n).read_text(encoding="utf-8"))
    except Exception:return {}
def arr(v):
    if isinstance(v,list):return [x for x in v if isinstance(x,dict)]
    if isinstance(v,dict):
        for k in ("opportunities","items","candidates"):
            if isinstance(v.get(k),list):return [x for x in v[k] if isinstance(x,dict)]
    return []
def main():
    pools=[]
    for n in ("guard-opportunities.json","guard-free-real-tokens.json","guard-discovery.json"): pools+=arr(load(n))
    plans=[]; seen=set()
    for o in pools:
        ident=str(o.get("id") or o.get("url") or o.get("project") or o.get("title") or "").strip()
        if not ident or ident in seen:continue
        seen.add(ident)
        claim=o.get("claim") or o.get("claimMethod") or o.get("action")
        eligibility=o.get("eligibility") or o.get("eligibilitySignals")
        evidence=o.get("evidence") or o.get("sources") or []
        if not claim:
            status="UNSUPPORTED_NO_VERIFIED_CLAIM_METHOD"
        elif isinstance(claim,str) and any(w in claim.lower() for w in ("kyc","captcha","anti-sybil","login")):
            status="OWNER_WEB_ACTION"
        elif o.get("contractAddress"):
            status="OWNER_SIGN_REQUIRED_UNTIL_ABI_VERIFIED"
        else:
            status="OWNER_REVIEW"
        plans.append({"id":ident,"title":o.get("title") or o.get("project") or ident,
                      "status":status,"claimMethodObserved":claim,"eligibilityObserved":eligibility,
                      "evidence":evidence,"url":o.get("url"),"ownerApprovalRequired":True,
                      "nextStep":"verify official claim method, then prepare unsigned action; owner signs/acts"})
    out={"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "engine":"Immortal Guard Action Planner","planCount":len(plans),"plans":plans[:1000],
         "safety":{"privateKeysCollected":False,"autoSign":False,"autoClaim":False,
                   "autoTransfer":False,"kycCaptchaAntiSybilBypass":False}}
    (ROOT/"guard-action-plans.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"plans":len(plans)}))
if __name__=="__main__":main()
