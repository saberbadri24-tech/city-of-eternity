#!/usr/bin/env python3
"""ANIL X Immortal Guard resilience lab.
Offline, deterministic QA for malformed/untrusted opportunity records.
It never claims, signs, connects wallets, or transfers assets.
"""
from __future__ import annotations
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

VERSION = "1.0.0"

@dataclass
class Finding:
    code: str
    severity: str
    detail: str


def safe_text(value, limit=4000):
    if not isinstance(value, str):
        return ""
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value).strip()[:limit]


def stable_key(item):
    if not isinstance(item, dict):
        item = {"raw": str(item)}
    explicit = safe_text(str(item.get("id", "")), 200).lower()
    if explicit:
        return explicit
    url = safe_text(str(item.get("url") or item.get("source") or item.get("link") or ""), 2000).lower().rstrip("/")
    title = safe_text(str(item.get("title") or item.get("name") or ""), 500).lower()
    basis = url or title or json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:32]


def inspect(item):
    findings = []
    if not isinstance(item, dict):
        return [Finding("NOT_OBJECT", "high", "Record is not a JSON object")]
    url = safe_text(str(item.get("url") or item.get("source") or item.get("link") or ""), 2000)
    if not url:
        findings.append(Finding("MISSING_SOURCE", "high", "No source URL; cannot independently verify"))
    else:
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            findings.append(Finding("UNSAFE_URL", "high", "Require an absolute HTTPS source URL"))
        if parsed.username or parsed.password:
            findings.append(Finding("URL_CREDENTIALS", "critical", "Embedded URL credentials rejected"))
    evidence = item.get("evidence") if isinstance(item.get("evidence"), dict) else {}
    required = evidence.get("requiredConditions") or item.get("requiredConditions") or []
    if required:
        findings.append(Finding("CONDITION_PRESENT", "high", "Required actions/conditions need owner review; not a free-token pass"))
    if item.get("status") != "VERIFIED_FREE_REAL_TOKEN":
        findings.append(Finding("NOT_STRICT_VERIFIED", "medium", "Keep as lead; do not present as verified free token"))
    if not evidence.get("live") or not evidence.get("free") or not evidence.get("tokenIdentity"):
        findings.append(Finding("EVIDENCE_INCOMPLETE", "high", "Live distribution, no-cost, and token identity evidence are all required"))
    if item.get("automaticAction") is True or item.get("claimExecuted") is True:
        findings.append(Finding("AUTOMATION_POLICY_VIOLATION", "critical", "Claim execution must remain disabled"))
    return findings


def run_suite():
    cases = [
        ("valid-looking-but-unverified", {"id":"a", "url":"https://example.org/claim", "status":"LEAD"}, "NOT_STRICT_VERIFIED"),
        ("http-source", {"id":"b", "url":"http://example.org/claim"}, "UNSAFE_URL"),
        ("missing-source", {"id":"c", "name":"mystery drop"}, "MISSING_SOURCE"),
        ("credential-url", {"id":"d", "url":"https://user:pass@example.org"}, "URL_CREDENTIALS"),
        ("conditional-airdrop", {"id":"e", "url":"https://example.org", "requiredConditions":["deposit"]}, "CONDITION_PRESENT"),
        ("incomplete-proof", {"id":"f", "url":"https://example.org", "status":"VERIFIED_FREE_REAL_TOKEN", "evidence":{"live":[],"free":[],"tokenIdentity":[]}}, "EVIDENCE_INCOMPLETE"),
        ("unsafe-auto-claim", {"id":"g", "url":"https://example.org", "automaticAction":True}, "AUTOMATION_POLICY_VIOLATION"),
        ("non-object", "malformed", "NOT_OBJECT"),
    ]
    results = []
    for name, item, expected in cases:
        codes = [f.code for f in inspect(item)]
        results.append({"case":name, "expected":expected, "passed":expected in codes, "findings":codes})
    dedupe = stable_key({"id":"Same"}) == stable_key({"id":"Same", "title":"different"})
    results.append({"case":"stable-dedupe", "expected":"same id yields same key", "passed":dedupe, "findings":[] if dedupe else ["DEDUPE_FAILED"]})
    return {"engine":"Guard Resilience Lab", "version":VERSION, "generatedAt":datetime.now(timezone.utc).isoformat(), "cases":len(results), "passed":sum(bool(x["passed"]) for x in results), "failed":sum(not x["passed"] for x in results), "results":results, "policy":"Offline QA only. No wallet interaction or asset movement."}

if __name__ == "__main__":
    report = run_suite()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(1 if report["failed"] else 0)
