#!/usr/bin/env python3
"""Novelty + Change Engine — finds what materially changed since the last radar run."""
from __future__ import annotations
import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(n):
    try:return json.loads((ROOT/n).read_text(encoding="utf-8"))
    except Exception:return None
def flat(v):
    if isinstance(v,list): return [x for x in v if isinstance(x,dict)]
    if isinstance(v,dict):
        for k in ("opportunities","items","candidates"):
            if isinstance(v.get(k),list): return [x for x in v[k] if isinstance(x,dict)]
    return []
def key(x):
    raw="|".join(str(x.get(k,"")).strip().lower() for k in ("project","chain","contractAddress","url","title"))
    return hashlib.sha256(raw.encode()).hexdigest()[:20]
def sig(x):
    fields=("status","eligibility","reward","claim","action","evidence","risk","updatedAt","lastVerified")
    return hashlib.sha256(json.dumps({k:x.get(k) for k in fields},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def main():
    current={}
    for n in ("guard-opportunities.json","guard-free-real-tokens.json","guard-discovery.json"):
        for x in flat(load(n)): current[key(x)]=x
    previous=load("guard-novelty-state.json") or {}
    old=previous.get("items",{}) if isinstance(previous,dict) else {}
    changes=[]
    for k,x in current.items():
        s=sig(x)
        if k not in old: typ="NEW"
        elif old[k].get("sig")!=s: typ="CHANGED"
        else: continue
        changes.append({"id":k,"type":typ,"title":x.get("title") or x.get("project") or x.get("url"),
                        "reward":x.get("reward"),"url":x.get("url"),"evidence":x.get("evidence"),
                        "risk":x.get("risk"),"action":x.get("action")})
    state={"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "engine":"Immortal Guard Novelty Engine","items":{k:{"sig":sig(v)} for k,v in current.items()}}
    (ROOT/"guard-novelty-state.json").write_text(json.dumps(state,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    out={"schemaVersion":1,"generatedAt":state["generatedAt"],"engine":"Immortal Guard Novelty Engine",
         "newCount":sum(x["type"]=="NEW" for x in changes),"changedCount":sum(x["type"]=="CHANGED" for x in changes),
         "materialChanges":changes[:200],"rule":"only observed field changes; no reward or claim invented"}
    (ROOT/"guard-novelty.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"new":out["newCount"],"changed":out["changedCount"]}))
if __name__=="__main__":main()
