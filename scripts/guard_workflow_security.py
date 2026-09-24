#!/usr/bin/env python3
"""Static supply-chain and workflow abuse gate for Immortal Guard."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WF=ROOT/".github/workflows/anilx-crypto-guard.yml"
def main():
    s=WF.read_text(encoding="utf-8")
    violations=[]
    refs=re.findall(r"uses:\s*([^\s#]+)",s)
    for ref in refs:
        if "@" not in ref or not re.fullmatch(r"[0-9a-f]{40}",ref.split("@",1)[1]):
            violations.append("ACTION_NOT_FULL_SHA:"+ref)
    if "permissions:\n  contents: write" not in s:
        violations.append("MISSING_EXPLICIT_CONTENTS_WRITE")
    if "pull_request_target:" in s:
        violations.append("FORBIDDEN_PULL_REQUEST_TARGET")
    if re.search(r"(?i)\b(curl|wget)\b[^\n]*\|\s*(sh|bash)",s):
        violations.append("REMOTE_SCRIPT_PIPE")
    if re.search(r"(?m)^\s*set\s+-x\s*$",s):
        violations.append("SHELL_TRACE_ENABLED")
    if re.search(r"(?i)echo\s+.*\$\{\{\s*secrets\.",s):
        violations.append("SECRET_ECHO_PATTERN")
    report={"engine":"Guard Workflow Security Gate","version":"1.1","status":"PASS" if not violations else "FAIL","actions":refs,"violations":sorted(set(violations)),"policy":"Pinned actions, explicit token scope, no remote shell piping, no shell tracing, no secret echo."}
    (ROOT/"guard-workflow-security.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("WORKFLOW_SECURITY="+report["status"])
    if violations: raise SystemExit(1)
if __name__=="__main__": main()
