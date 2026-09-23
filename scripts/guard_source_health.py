#!/usr/bin/env python3
"""Build a transparent health/coverage report for Guard's discovery registry.
No wallet operations, claims, or external side effects."""
import datetime as dt
import json
import urllib.parse
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "guard-sources.json"
DISCOVERY = ROOT / "guard-discovery.json"
OUT = ROOT / "guard-source-health.json"
NOW = dt.datetime.now(dt.timezone.utc).isoformat()


def host(url):
    try:
        return (urllib.parse.urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def main():
    registry = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}
    discovery = json.loads(DISCOVERY.read_text(encoding="utf-8")) if DISCOVERY.exists() else {}
    sources = registry.get("sources", [])
    valid, invalid = [], []
    for item in sources:
        url = str(item.get("url", ""))
        if url.startswith("https://") and host(url):
            valid.append(item)
        else:
            invalid.append({"name": item.get("name", ""), "url": url, "reason": "invalid_or_non_https_url"})
    domains = sorted({host(x["url"]) for x in valid})
    types = Counter(str(x.get("type", "uncategorized")) for x in valid)
    candidates = discovery.get("items", [])
    publishers = Counter(str(x.get("publisher", "unknown")) for x in candidates)
    report = {
        "guard": "ANIL X Immortal Guard",
        "updatedAt": NOW,
        "status": "healthy" if valid and not invalid else "degraded",
        "sourceCount": len(sources),
        "validHttpsSourceCount": len(valid),
        "invalidSourceCount": len(invalid),
        "uniqueOfficialDomains": len(domains),
        "sourceTypes": dict(types),
        "discoveryCandidateCount": len(candidates),
        "uniqueNewsPublishers": len(publishers),
        "topPublishers": [{"publisher": k, "count": v} for k, v in publishers.most_common(20)],
        "invalidSources": invalid[:100],
        "sourceDomains": domains,
        "limitations": [
            "Registry presence does not prove a source is reachable or currently distributing rewards.",
            "News candidates are leads only; they are not verified or claim-authorized.",
            "This report performs no wallet connection, signing, claiming, or transfer."
        ]
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "sources": len(sources), "validHttps": len(valid), "invalid": len(invalid), "candidates": len(candidates)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
