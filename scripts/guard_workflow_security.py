#!/usr/bin/env python3
"""Static security gate for the Guard workflow."""
import re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 s=(ROOT/".github/workflows/anilx-crypto-guard.yml").read_text(encoding="utf-8")
 violations=[]
 for ref in re.findall(r"uses:\s*([^\s#]+)",s):
  if "@" not in ref: violations.append("ACTION_WITHOUT_REF:"+ref); continue
  ownerver=ref.split("@",1)[1]
  if not re.fullmatch(r"[0-9a-f]{40}",ownerver): violations.append("ACTION_NOT_SHA_PINNED:"+ref)
 if "permissions:\n  contents: write" not in s: violations.append("missing-explicit-content-write")
 report={"status":"PASS" if not violations else "FAIL","actions":re.findall(r"uses:\s*([^\s#]+)",s),"violations":sorted(set(violations))}
 (ROOT/"guard-workflow-security.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("WORKFLOW_SECURITY="+report["status"])
 if violations: raise SystemExit(1)
if __name__=="__main__": main()
