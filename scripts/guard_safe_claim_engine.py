#!/usr/bin/env python3
"""Fail-closed auto-claim lane for claims that require no signature.

This engine NEVER discovers or invents a claim endpoint. An adapter must be
declared for the exact official domain and explicitly prove:
- no wallet signature
- no seed/private key
- no KYC/CAPTCHA/anti-Sybil bypass
- direct receipt to the configured temporary wallet
- idempotent/safe request semantics

Without such an adapter the opportunity is queued for the owner.
"""
from __future__ import annotations
import json, hashlib, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
NOW=datetime.now(timezone.utc).isoformat()
FREE=ROOT/"guard-free-real-tokens.json"
ADAPTERS=ROOT/"guard-claim-adapters.json"
OUT=ROOT/"guard-auto-claim.json"
WALLET=ROOT/"guard-wallet.json"

def load(p,d):
    try:return json.loads(p.read_text(encoding="utf-8"))
    except Exception:return d

def domain(url):
    try:return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:return ""

def main():
    free=load(FREE,{"tokens":[]})
    adapters=load(ADAPTERS,{"adapters":[]})
    wallet=load(WALLET,{})
    temp=wallet.get("temporaryWalletAddress")
    by_domain={str(a.get("domain","")).lower().removeprefix("www."):a for a in adapters.get("adapters",[]) if isinstance(a,dict)}
    attempted=[];queued=[];blocked=[]
    for item in free.get("tokens",[]):
        d=domain(item.get("officialUrl",""))
        a=by_domain.get(d)
        safe=bool(a and a.get("mode")=="NO_SIGNATURE_DIRECT_RECEIPT"
            and a.get("requiresOwnerApproval") is False
            and a.get("signing") is False
            and a.get("privateKeys") is False
            and a.get("kycBypass") is False
            and a.get("captchaBypass") is False
            and a.get("antiSybilBypass") is False
            and a.get("directToTemporaryWallet") is True
            and a.get("idempotent") is True)
        if not safe:
            queued.append({"id":item.get("id"),"name":item.get("name"),"domain":d,
                           "status":"OWNER_REVIEW_REQUIRED","reason":"no verified no-signature direct-receipt adapter"})
            continue
        # An adapter must supply an exact official endpoint template; never scrape or invent it.
        endpoint=str(a.get("claimEndpoint","")).replace("{temporaryWallet}",str(temp or ""))
        if not endpoint.startswith("https://") or domain(endpoint)!=d or not temp:
            blocked.append({"id":item.get("id"),"status":"BLOCKED","reason":"adapter endpoint or temporary wallet missing"})
            continue
        # No generic auto-POST is allowed: adapters must explicitly opt into an exact HTTP method
        # and request schema. This prevents arbitrary page content from becoming executable code.
        if a.get("method")!="POST" or not isinstance(a.get("bodyTemplate"),dict):
            blocked.append({"id":item.get("id"),"status":"BLOCKED","reason":"adapter contract incomplete"})
            continue
        body={k:str(v).replace("{temporaryWallet}",str(temp)) for k,v in a["bodyTemplate"].items()}
        try:
            req=urllib.request.Request(endpoint,data=json.dumps(body).encode(),method="POST",
                headers={"Content-Type":"application/json","User-Agent":"ANIL-X-Immortal-Guard-SafeClaim/1.0"})
            with urllib.request.urlopen(req,timeout=15) as resp:
                raw=resp.read(10000).decode("utf-8","ignore")
                attempted.append({"id":item.get("id"),"name":item.get("name"),"status":"SUBMITTED_NO_SIGNATURE",
                    "httpStatus":resp.status,"responseHash":hashlib.sha256(raw.encode()).hexdigest()[:24],"submittedAt":NOW})
        except Exception as exc:
            attempted.append({"id":item.get("id"),"name":item.get("name"),"status":"SUBMISSION_FAILED","error":type(exc).__name__})
    OUT.write_text(json.dumps({
      "guard":"ANIL X Immortal Guard","engine":"Safe No-Signature Claim Lane","updatedAt":NOW,
      "submitted":attempted,"queued":queued,"blocked":blocked,
      "automaticClaim":True if attempted else False,"automaticSigning":False,"automaticTransfer":False,
      "privateKeys":"never-collected","policy":"Only exact, pre-verified, idempotent, official no-signature direct-receipt adapters may submit."
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"safe_claim_lane_complete","submitted":len(attempted),"queued":len(queued),"blocked":len(blocked)},ensure_ascii=False))
if __name__=="__main__":main()
