#!/usr/bin/env python3
"""Immortal Core Threat Engine: adversarial, fail-closed security contract."""
from __future__ import annotations
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RULES=[
("T01","untrusted-content-cannot-authorize","External discovery text must never grant execution authority."),
("T02","agent-cannot-escalate","An agent may only use tools explicitly assigned to its role."),
("T03","provenance-required","Sensitive decisions must retain source/provenance context."),
("T04","approval-required","Consequential actions require explicit owner approval."),
("T05","custody-isolated","No private key, seed phrase or mnemonic may enter Guard secret state."),
("T06","no-policy-self-edit","Evolution code may propose changes but cannot rewrite trust policy."),
("T07","no-auto-claim","Discovery and intelligence lanes cannot execute claims."),
("T08","no-auto-sign","No autonomous wallet signing is permitted."),
("T09","no-auto-transfer","No autonomous asset transfer is permitted."),
("T10","replayable-state","Security decisions should be reproducible from recorded state."),
]
def load(name): return json.loads((ROOT/name).read_text(encoding="utf-8"))
def nonempty_sensitive_values(obj):
    keys={"privatekey","private_key","seedphrase","seed_phrase","mnemonic","secret"}; found=[]
    def walk(v,path=""):
        if isinstance(v,dict):
            for k,val in v.items():
                nk=str(k).replace("-","_").lower()
                if nk in keys and val not in (None,"",False,[],{}): found.append(path+"/"+str(k))
                walk(val,path+"/"+str(k))
        elif isinstance(v,list):
            for i,val in enumerate(v): walk(val,f"{path}[{i}]")
    walk(obj); return found
def main():
    wallet=load("guard-wallet.json"); discovery=load("guard-discovery.json"); intel=load("guard-intelligence.json"); caps=load("guard-capabilities.json")
    violations=[]
    # Normalize serialization only; policy remains fail-closed unless exactly PROPOSE_ONLY.
    policy=str(caps.get("selfModificationPolicy","")).strip().upper()
    if policy!="PROPOSE_ONLY": violations.append("T06")
    if nonempty_sensitive_values(wallet): violations.append("T05")
    for row in discovery.get("items",[]):
        if row.get("action")!="never-auto-claim" or row.get("executionGate")!="OWNER_APPROVAL_REQUIRED": violations.append("T07")
    for row in intel.get("trackedLeads",[]):
        if row.get("ownerApprovalRequired") is not True or row.get("automaticAction") is not False: violations.append("T04")
        if row.get("claimExecuted") is True: violations.append("T07")
    violations=sorted(set(violations))
    report={"engine":"Immortal Core Threat Engine","version":"1.3","status":"PASS" if not violations else "FAIL","rules":RULES,"violations":violations,"observedPolicy":policy,"boundaryHash":hashlib.sha256("\n".join(f"{a}:{b}" for a,b,_ in RULES).encode()).hexdigest(),"policy":"Internal adversarial validation only; untrusted content is never treated as authority."}
    (ROOT/"guard-threat-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("IMMORTAL_CORE_THREAT="+report["status"])
    if violations: print("IMMORTAL_CORE_VIOLATIONS="+",".join(violations))
    if violations: raise SystemExit(1)
if __name__=="__main__": main()
