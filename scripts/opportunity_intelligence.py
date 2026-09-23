#!/usr/bin/env python3
"""Offline intelligence layer: prioritize evidence-backed opportunities without executing claims."""
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc)

def load(name, default):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def parse_date(value):
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

def score(item):
    evidence = item.get("evidence") or {}
    points = 0
    points += 35 if item.get("status") == "VERIFIED_FREE_REAL_TOKEN" else 0
    points += min(20, 5 * len(evidence.get("live", [])))
    points += min(15, 5 * len(evidence.get("free", [])))
    points += min(15, 5 * len(evidence.get("tokenIdentity", [])))
    points += 10 if item.get("officialDomain") else 0
    points -= 100 if evidence.get("requiredConditions") else 0
    points -= 100 if item.get("rejectionReasons") else 0
    return max(0, min(100, points))

def main():
    strict = load("guard-free-real-tokens.json", {})
    history = load("guard-opportunity-history.json", {"items": []})
    discovery = load("guard-discovery.json", {"items": []})
    receipts = load("guard-receipts.json", {"items": []})
    candidates = strict.get("tokens", [])
    ranked = []
    for item in candidates:
        row = dict(item)
        row["intelligenceScore"] = score(item)
        row["priority"] = "P1_NOW" if row["intelligenceScore"] >= 75 else "P2_REVIEW"
        row["ownerApprovalRequired"] = True
        row["automaticAction"] = False
        ranked.append(row)
    ranked.sort(key=lambda x: (-x["intelligenceScore"], x.get("name", "")))
    hist_items = history.get("items", [])
    status_counts = {}
    for item in hist_items:
        key = item.get("strictFreeTokenStatus", item.get("status", "UNKNOWN"))
        status_counts[key] = status_counts.get(key, 0) + 1
    report = {
        "guard": "ANIL X Immortal Guard",
        "engine": "Opportunity Intelligence Layer",
        "version": "1.0",
        "generatedAt": NOW.isoformat(),
        "summary": {
            "discoverySignals": len(discovery.get("items", [])),
            "durableHistoryRecords": len(hist_items),
            "strictVerifiedFreeTokens": len(candidates),
            "receiptRecords": len(receipts.get("items", [])),
            "historyStatuses": status_counts,
        },
        "rankedVerifiedOpportunities": ranked,
        "policy": "Ranking is advisory only. No claim, signing, wallet connection, or transfer is initiated.",
    }
    (ROOT / "guard-intelligence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "intelligence_complete", **report["summary"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
