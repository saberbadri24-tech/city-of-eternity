#!/usr/bin/env python3
"""Fail-closed capability contract for every Guard brain.
The model may propose; the contract decides what an agent can read/write/do.
"""
import json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONTRACT=ROOT/"guard-agent-contract.json"
FORBIDDEN={"SIGN_WALLET","TRANSFER_ASSETS","BYPASS_KYC","BYPASS_CAPTCHA","AUTO_CLAIM","CHANGE_POLICY","EXPORT_SECRETS"}
def main():
    data=json.loads(CONTRACT.read_text(encoding="utf-8"))
    agents=data.get("agents",[])
    violations=[]
    seen=set()
    for a in agents:
        aid=a.get("id")
        if not aid or aid in seen: violations.append("duplicate-or-empty-agent-id")
        seen.add(aid)
        caps=set(a.get("capabilities",[]))
        denied=set(a.get("deniedCapabilities",[]))
        if caps & FORBIDDEN: violations.append(f"forbidden-capability:{aid}")
        if not FORBIDDEN.issubset(denied): violations.append(f"missing-deny:{aid}")
        if a.get("trust") not in {"UNTRUSTED","VERIFIED_READONLY","OWNER_APPROVED"}: violations.append(f"bad-trust:{aid}")
        if a.get("trust")!="OWNER_APPROVED" and a.get("canAct") is not False: violations.append(f"non-owner-can-act:{aid}")
    if data.get("policy")!="FAIL_CLOSED": violations.append("policy-not-fail-closed")
    digest=hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    report={"status":"PASS" if not violations else "FAIL","agentCount":len(agents),"violations":sorted(set(violations)),"contractHash":digest}
    (ROOT/"guard-agent-contract-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("AGENT_CONTRACT="+report["status"])
    if violations: raise SystemExit(1)
if __name__=="__main__": main()
