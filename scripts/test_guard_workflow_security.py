#!/usr/bin/env python3
"""Regression tests for the Guard workflow security contract."""
import json, subprocess, unittest, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WF=ROOT/".github/workflows/anilx-crypto-guard.yml"
class WorkflowSecurityTests(unittest.TestCase):
    def test_security_gate_passes(self):
        p=subprocess.run(["python3","scripts/guard_workflow_security.py"],cwd=ROOT,capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)
        report=json.loads((ROOT/"guard-workflow-security.json").read_text())
        self.assertEqual(report["status"],"PASS")
        self.assertEqual(report["violations"],[])
    def test_no_high_risk_constructs(self):
        s=WF.read_text()
        self.assertNotIn("pull_request_target:",s)
        self.assertNotRegex(s,r"(?i)\b(curl|wget)\b[^\n]*\|\s*(sh|bash)")
        self.assertNotRegex(s,r"(?m)^\s*set\s+-x\s*$")
        self.assertNotRegex(s,r"(?i)echo\s+.*\$\{\{\s*secrets\.")
        for ref in re.findall(r"uses:\s*([^\s#]+)",s):
            self.assertRegex(ref,r"@[0-9a-f]{40}$")
if __name__=="__main__":
    unittest.main()
