import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DISCOVERY = ROOT / "guard-discovery.json"
SOURCES = ROOT / "guard-sources.json"
LEARNING = ROOT / "guard-learning.json"
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
UA = "ANIL-X-Immortal-Guard/9.0 Verification"

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})
        with urllib.request.urlopen(req, timeout=18) as r:
            body = r.read(350_000).decode("utf-8", "ignore")
            return r.geturl(), body, r.status
    except Exception as exc:
        return "", "", None

def domain(url):
    try:
        return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:
        return ""

def canonical(body):
    m = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', body, re.I)
    return html.unescape(m.group(1)).strip() if m else ""

def strip_text(body):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(body))).strip()

def main():
    discovery = json.loads(DISCOVERY.read_text(encoding="utf-8"))
    registry = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {"sources":[]}
    learning = json.loads(LEARNING.read_text(encoding="utf-8")) if LEARNING.exists() else {"version":"1.0","weights":{},"outcomes":[]}

    official_domains = {domain(x.get("url","")) for x in registry.get("sources", []) if x.get("url")}
    official_domains.discard("")
    verified = []
    for item in discovery.get("items", []):
        final_url, body, status = fetch(item.get("url",""))
        final_domain = domain(final_url)
        canon = canonical(body)
        text = strip_text(body)[:100000].lower()
        reward_matches = re.findall(r"(?:\\$|usd\\s*)[0-9][0-9,]*(?:\\.[0-9]+)?\\s*(?:k|m)?", text, re.I)\n        bounty_signal = any(x in text for x in ("bug bounty", "bounty program", "prize pool", "grant", "hackathon"))\n        claim_signal = any(x in text for x in (
            "claim now", "claim is live", "claim is open", "claim available",
            "redeem now", "airdrop claim", "token claim", "withdraw now"
        ))
        eligibility_signal = any(x in text for x in (
            "eligibility", "eligible", "snapshot", "points", "requirements", "deadline"
        ))
        official_source_match = final_domain in official_domains if final_domain else False
        if status and 200 <= status < 400:
            verification = "resolved-official-source" if official_source_match else "resolved-third-party-or-publisher"
        else:
            verification = "unresolved"
        item.update({
            "verifiedAt": NOW,
            "resolvedUrl": final_url or None,
            "canonicalUrl": canon or None,
            "resolvedDomain": final_domain or None,
            "httpStatus": status,
            "verification": verification,
            "claimSignal": claim_signal,\n            "bountyOrGrantSignal": bounty_signal,\n            "rewardEvidence": reward_matches[:20],
            "eligibilitySignal": eligibility_signal,
            "action": "never-auto-claim",
            "executionGate": "OWNER_APPROVAL_REQUIRED"
        })
        verified.append(item)

    discovery["items"] = verified
    discovery["updatedAt"] = NOW
    discovery["verification"] = {
        "status": "complete",
        "resolved": sum(bool(x.get("resolvedUrl")) for x in verified),
        "officialSourceMatches": sum(x.get("verification") == "resolved-official-source" for x in verified),
        "claimSignals": sum(bool(x.get("claimSignal")) for x in verified),
        "eligibilitySignals": sum(bool(x.get("eligibilitySignal")) for x in verified),
        "rule": "A publisher/news page is discovery evidence only. It is never treated as a project claim page unless the resolved domain is in the trusted source registry."
    }
    DISCOVERY.write_text(json.dumps(discovery, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

    outcomes = learning.setdefault("outcomes", [])
    outcomes.append({
        "timestamp": NOW,
        "type": "discovery_verification",
        "discovered": len(verified),
        "resolved": discovery["verification"]["resolved"],
        "officialSourceMatches": discovery["verification"]["officialSourceMatches"],
        "claimSignals": discovery["verification"]["claimSignals"],
        "eligibilitySignals": discovery["verification"]["eligibilitySignals"]
    })
    learning["lastUpdate"] = NOW
    learning["verificationEngine"] = "resolve -> canonical -> trusted-domain check -> claim/eligibility signal extraction"
    learning["safetyGate"] = "No discovery item can auto-claim. Owner approval remains mandatory for opportunity-specific actions."
    learning["outcomes"] = outcomes[-200:]
    LEARNING.write_text(json.dumps(learning, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"status":"verification_complete", **discovery["verification"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
