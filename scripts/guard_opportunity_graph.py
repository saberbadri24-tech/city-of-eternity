#!/usr/bin/env python3
"""Opportunity Graph Engine — cross-source relationship discovery.

Builds a local graph of projects, domains, chains, contracts, evidence and
opportunities. It never invents a claim path: edges exist only when observed
in Guard artifacts. The output exposes convergence (same opportunity reported
by independent sources) and blind spots (valuable records lacking evidence).
"""
from __future__ import annotations
import hashlib, json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def load(name):
    try: return json.loads((ROOT/name).read_text(encoding="utf-8"))
    except Exception: return None

def items(v):
    if isinstance(v, list): return [x for x in v if isinstance(x,dict)]
    if isinstance(v,dict):
        x=v.get("opportunities",v.get("items",v.get("candidates",[])))
        return [y for y in x if isinstance(y,dict)] if isinstance(x,list) else []
    return []

def norm(x): return str(x or "").strip().lower()

def main():
    pools=[]
    for n in ("guard-discovery.json","guard-opportunities.json","guard-free-real-tokens.json","guard-intelligence.json"):
        v=load(n)
        if v is not None: pools += items(v)
    nodes={}
    edges=[]
    seen=set()
    def node(kind,key,label=""):
        nid=hashlib.sha256((kind+"|"+norm(key)).encode()).hexdigest()[:16]
        nodes.setdefault(nid,{"id":nid,"type":kind,"key":key,"label":label or key})
        return nid
    for o in pools:
        oid=norm(o.get("id") or o.get("project") or o.get("title") or o.get("url"))
        if not oid: continue
        on=node("opportunity",oid,o.get("title") or o.get("project") or oid)
        for kind,field in (("project","project"),("chain","chain"),("domain","url"),("contract","contractAddress")):
            val=o.get(field)
            if val:
                tn=node(kind,str(val))
                k=(on,tn,field)
                if k not in seen: edges.append({"from":on,"to":tn,"relation":field}); seen.add(k)
        for s in o.get("sources",[]) if isinstance(o.get("sources"),list) else []:
            tn=node("source",str(s)); k=(on,tn,"source")
            if k not in seen: edges.append({"from":on,"to":tn,"relation":"source"}); seen.add(k)
    degree=defaultdict(int)
    for e in edges: degree[e["from"]]+=1; degree[e["to"]]+=1
    convergence=[]
    for nid,n in nodes.items():
        if n["type"]=="opportunity" and degree[nid]>=3:
            convergence.append({"id":nid,"label":n["label"],"connections":degree[nid]})
    blind=[]
    for nid,n in nodes.items():
        if n["type"]=="opportunity" and degree[nid]<=1:
            blind.append({"id":nid,"label":n["label"],"connections":degree[nid]})
    out={"schemaVersion":1,"generatedAt":now(),"engine":"Immortal Guard Opportunity Graph",
         "nodeCount":len(nodes),"edgeCount":len(edges),"nodes":list(nodes.values()),
         "edges":edges,"convergenceSignals":sorted(convergence,key=lambda x:-x["connections"])[:100],
         "blindSpots":blind[:100],
         "safety":"observational-only; no claim/signature/transfer action"}
    (ROOT/"guard-opportunity-graph.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"nodes":len(nodes),"edges":len(edges),"convergence":len(convergence),"blindSpots":len(blind)}))
if __name__=="__main__": main()
