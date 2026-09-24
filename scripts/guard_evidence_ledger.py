#!/usr/bin/env python3
"""Append-only evidence integrity ledger.
Records hashes and provenance; it never grants authority to evidence.
"""
import hashlib,json,datetime as dt
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/"guard-evidence-ledger.json"
def canon(x): return json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(",",":"))
def main():
    intel=json.loads((ROOT/"guard-intelligence.json").read_text(encoding="utf-8"))
    disc=json.loads((ROOT/"guard-discovery.json").read_text(encoding="utf-8"))
    rows=[]
    for src in (intel.get("trackedLeads",[]) if isinstance(intel,dict) else []) + (disc.get("items",[]) if isinstance(disc,dict) else []):
        if not isinstance(src,dict): continue
        rows.append({"id":src.get("id") or src.get("opportunityId") or src.get("url"),"url":src.get("canonicalUrl") or src.get("url"),"domain":src.get("resolvedDomain") or src.get("officialDomainName"),"verification":src.get("verification"),"retrievedAt":src.get("verifiedAt") or src.get("resolvedAt") or src.get("discoveredAt")})
    rows=[r for r in rows if r["id"]]
    old=json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"version":1,"entries":[]}
    entries=old.get("entries",[])
    prior=entries[-1]["entryHash"] if entries else "GENESIS"
    new=[]
    known={e.get("evidenceKey") for e in entries}
    for r in rows[:1000]:
        key=hashlib.sha256(canon(r).encode()).hexdigest()
        if key in known: continue
        payload={"evidenceKey":key,"previousHash":prior,"record":r,"recordedAt":dt.datetime.now(dt.timezone.utc).isoformat()}
        payload["entryHash"]=hashlib.sha256(canon(payload).encode()).hexdigest()
        prior=payload["entryHash"]; new.append(payload)
    entries.extend(new)
    # verify complete chain before writing
    prev="GENESIS"
    for e in entries:
        body={k:v for k,v in e.items() if k!="entryHash"}
        if e.get("previousHash")!=prev or hashlib.sha256(canon(body).encode()).hexdigest()!=e.get("entryHash"):
            raise SystemExit("EVIDENCE_LEDGER=FAIL")
        prev=e["entryHash"]
    STATE.write_text(json.dumps({"version":1,"entries":entries,"headHash":prev},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"PASS","entries":len(entries),"added":len(new),"headHash":prev}))
if __name__=="__main__": main()
