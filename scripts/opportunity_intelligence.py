#!/usr/bin/env python3
"""Rank evidence-backed Guard opportunities; preserve leads and never execute claims."""
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc)


def load(name, default):
    try:
        value = json.loads((ROOT / name).read_text(encoding="utf-8"))
        return value if isinstance(value, (dict, list)) else default
    except (OSError, ValueError):
        return default


def items_of(value, *keys):
    if isinstance(value, list):
        return [x for x in value if isinstance(x, dict)]
    if isinstance(value, dict):
        for key in keys:
            found = value.get(key)
            if isinstance(found, list):
                return [x for x in found if isinstance(x, dict)]
    return []


def parse_date(value):
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None


def identity(item):
    for key in ("id", "opportunityId", "slug"):
        if item.get(key):
            return str(item[key]).strip().lower()
    url = str(item.get("url") or item.get("source") or item.get("link") or "").strip().lower().rstrip("/")
    name = str(item.get("name") or item.get("title") or "").strip().lower()
    raw = url or name or json.dumps(item, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def score(item):
    evidence = item.get("evidence") or {}
    if not isinstance(evidence, dict):
        evidence = {}
    points = 35 if item.get("status") == "VERIFIED_FREE_REAL_TOKEN" else 0
    points += min(20, 5 * len(evidence.get("live", [])))
    points += min(15, 5 * len(evidence.get("free", [])))
    points += min(15, 5 * len(evidence.get("tokenIdentity", [])))
    # Domain suffix alone is not proof of an official source.
    points += 10 if item.get("officialDomain") is True or item.get("sourceTrust") == "official" else 0
    points -= 100 if evidence.get("requiredConditions") else 0
    points -= 100 if item.get("rejectionReasons") else 0
    return max(0, min(100, points))


def main():
    strict = load("guard-free-real-tokens.json", {})
    history = load("guard-opportunity-history.json", {"items": []})
    discovery = load("guard-discovery.json", {"items": []})
    receipts = load("guard-receipts.json", {"items": []})
    strict_items = items_of(strict, "tokens", "items")
    history_items = items_of(history, "items", "opportunities")
    discovery_items = items_of(discovery, "items", "opportunities", "results")

    # Merge by stable identity; keep leads from all inputs, including unverified ones.
    merged = {}
    for origin, collection in (("history", history_items), ("discovery", discovery_items), ("strict", strict_items)):
        for item in collection:
            key = identity(item)
            row = merged.setdefault(key, {"id": key, "sourcesSeenIn": []})
            origins = row["sourcesSeenIn"]
            row.update(item)
            row["sourcesSeenIn"] = list(dict.fromkeys(origins + [origin]))
            row["id"] = key

    ranked = []
    for item in merged.values():
        row = dict(item)
        row["intelligenceScore"] = score(row)
        row["strictlyVerifiedFreeRealToken"] = row.get("status") == "VERIFIED_FREE_REAL_TOKEN"
        seen = parse_date(row.get("lastSeenAt") or row.get("discoveredAt") or row.get("firstSeenAt"))
        expiry = parse_date(row.get("expiresAt") or row.get("deadline") or row.get("claimDeadline"))
        row["lastSeenAgeHours"] = round(max(0, (NOW - seen).total_seconds() / 3600), 2) if seen else None
        row["freshness"] = "FRESH_24H" if seen and NOW - seen <= dt.timedelta(hours=24) else ("STALE" if seen else "UNKNOWN")
        row["expiryStatus"] = "EXPIRED" if expiry and expiry < NOW else ("EXPIRING_24H" if expiry and expiry - NOW <= dt.timedelta(hours=24) else ("SCHEDULED" if expiry else "NO_CONFIRMED_DEADLINE"))
        row["priority"] = "P1_NOW" if row["strictlyVerifiedFreeRealToken"] and row["intelligenceScore"] >= 75 and row["expiryStatus"] != "EXPIRED" else ("P2_REVIEW" if row["intelligenceScore"] >= 30 else "P3_UNVERIFIED_LEAD")
        row["ownerApprovalRequired"] = True
        row["automaticAction"] = False
        row["claimExecuted"] = False
        ranked.append(row)

    ranked.sort(key=lambda x: (x["expiryStatus"] == "EXPIRED", x["priority"] != "P1_NOW", -x["intelligenceScore"], x.get("name", "")))
    status_counts = {}
    for item in history_items:
        status = item.get("strictFreeTokenStatus", item.get("status", "UNKNOWN"))
        status_counts[status] = status_counts.get(status, 0) + 1
    summary = {
        "discoverySignals": len(discovery_items),
        "durableHistoryRecords": len(history_items),
        "uniqueTrackedOpportunities": len(ranked),
        "strictVerifiedFreeTokens": sum(1 for x in ranked if x["strictlyVerifiedFreeRealToken"]),
        "receiptRecords": len(items_of(receipts, "items", "receipts")),
        "expiringWithin24h": sum(1 for x in ranked if x["expiryStatus"] == "EXPIRING_24H"),
        "expired": sum(1 for x in ranked if x["expiryStatus"] == "EXPIRED"),
        "staleOrUnknown": sum(1 for x in ranked if x["freshness"] != "FRESH_24H"),
        "historyStatuses": status_counts,
    }
    report = {
        "guard": "ANIL X Immortal Guard", "engine": "Opportunity Intelligence Layer", "version": "2.1",
        "generatedAt": NOW.isoformat(), "summary": summary,
        "rankedVerifiedOpportunities": [x for x in ranked if x["strictlyVerifiedFreeRealToken"]],
        "trackedLeads": ranked,
        "policy": "Ranking is advisory. No claim, signing, wallet connection, KYC/CAPTCHA bypass, or transfer is initiated. Owner approval is required for every opportunity-specific action.",
    }
    (ROOT / "guard-intelligence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "intelligence_complete", **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
