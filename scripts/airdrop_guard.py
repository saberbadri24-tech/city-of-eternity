import datetime as dt
import hashlib
import json
import re
import urllib.request
import urllib.parse
from urllib.error import HTTPError, URLError
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
FILES = {
    "rewards": ROOT / "rewards.json",
    "sources": ROOT / "guard-sources.json",
    "wallet": ROOT / "guard-wallet.json",
    "learning": ROOT / "guard-learning.json",
    "status": ROOT / "guard-status.json",
    "opportunities": ROOT / "guard-opportunities.json",
    "approvals": ROOT / "guard-approvals.json",
    "history": ROOT / "guard-opportunity-history.json",
    "discovery": ROOT / "guard-discovery.json",
    "adapters": ROOT / "guard-claim-adapters.json",
}

def load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def fetch(url):
    if not url.startswith("https://"):
        return None, "Only HTTPS sources are accepted."
    req = urllib.request.Request(url, headers={"User-Agent": "ANIL-X-Immortal-Guard/7.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, response.read(250_000).decode("utf-8", "ignore")[:100_000]
    except HTTPError as exc:
        return exc.code, ""
    except (URLError, TimeoutError, OSError) as exc:
        return None, type(exc).__name__

def review_locally(name, url, body):
    """First-party deterministic evidence review; never calls external model APIs."""
    low = body.lower()
    requirements = [term for term in ("kyc", "captcha", "register", "connect wallet", "signature", "login", "fee", "gas") if term in low]
    explicit_claim = any(term in low for term in ("claim is open", "claim now", "claim available", "redeem now", "withdraw now"))
    auto_distribution = any(term in low for term in ("automatically distributed", "automatically sent", "sent directly to your wallet"))
    risk_flags = []
    for term in ("seed phrase", "private key", "connect wallet to claim", "pay a fee to claim", "guaranteed profit", "urgent claim"):
        if term in low:
            risk_flags.append(term)
    return {
        "engine": "guard-local-evidence-review",
        "status": "completed",
        "sourceName": name,
        "sourceUrl": url,
        "signals": {
            "explicitClaimLanguage": explicit_claim,
            "automaticDistributionLanguage": auto_distribution,
            "requirements": requirements,
            "riskFlags": risk_flags
        },
        "nextSafeStep": "verify the official source, eligibility, fees, and requirements; owner review required; no transaction executed"
    }

def main():
    rewards = load(FILES["rewards"], {"guard": "ANIL X Immortal Guard", "sources": []})
    registry = load(FILES["sources"], {"sources": []})
    wallet = load(FILES["wallet"], {})
    learning = load(FILES["learning"], {"version": "1.0", "weights": {}, "outcomes": []})
    history = load(FILES["history"], {"version": "1.0", "items": []})
    discovery = load(FILES["discovery"], {"items": []})
    adapters = load(FILES["adapters"], {"version": "1.0", "adapters": []})
    sources = {x.get("url"): x for x in rewards.get("sources", []) if x.get("url")}
    for item in registry.get("sources", []):
        if item.get("url"):
            sources.setdefault(item["url"], item)
    trusted_domains = {
        re.sub(r"^www\.", "", urllib.parse.urlparse(x.get("url", "")).netloc.lower())
        for x in registry.get("sources", [])
        if x.get("url")
    }
    for item in discovery.get("items", []):
        resolved = item.get("resolvedUrl") or item.get("canonicalUrl")
        resolved_domain = re.sub(r"^www\.", "", (item.get("resolvedDomain") or "").lower())
        if resolved and resolved_domain in trusted_domains and item.get("verification") == "resolved-official-source":
            sources.setdefault(resolved, {
                "name": item.get("title") or item.get("name") or "Verified discovery",
                "url": resolved,
                "type": "verified-discovery",
            })

    opportunities, approvals, blockers = [], [], []
    engine_reviews = 0
    for source in sources.values():
        code, body = fetch(source.get("url", ""))
        source["httpStatus"] = code
        source["lastScan"] = NOW
        if code is None or not 200 <= code < 300:
            source.update({"status": "unavailable", "actionStage": "SOURCE_BLOCKED"})
            blockers.append({"source": source.get("name"), "httpStatus": code})
            continue

        text = re.sub(r"\s+", " ", body)
        low = text.lower()
        signals = [term for term in ("airdrop", "claim", "reward", "token", "points", "quest", "snapshot", "deadline") if term in low]
        requirements = [term for term in ("kyc", "captcha", "register", "connect wallet", "signature", "login") if term in low]
        explicit_claim = any(term in low for term in ("claim is open", "claim now", "claim available", "redeem now", "withdraw now"))
        auto_distribution = any(term in low for term in ("automatically distributed", "automatically sent", "sent directly to your wallet"))
        # First-party deterministic risk and eligibility evaluator.
        local_review = {
            "role": "local-risk-triage",
            "blocked_by_kyc_or_captcha": any(x in requirements for x in ("kyc", "captcha")),
            "owner_interaction_required": any(x in requirements for x in ("register", "connect wallet", "signature", "login")),
            "explicit_claim_language": explicit_claim,
            "automatic_distribution_language": auto_distribution,
        }
        ai = review_locally(source.get("name", "source"), source.get("url", ""), text)
        engine_reviews += 1
        owner_needed = local_review["blocked_by_kyc_or_captcha"] or local_review["owner_interaction_required"]
        stage = "WAITING_OWNER" if owner_needed else ("CLAIM_PATH_DETECTED" if explicit_claim or auto_distribution else "WATCH")
        oid = re.sub(r"[^a-z0-9-]+", "-", source.get("name", "opportunity").lower()).strip("-")
        op = {
            "id": oid, "name": source.get("name"), "source": source.get("url"), "type": source.get("type", "unknown"),
            "signals": signals, "requirements": requirements, "actionStage": stage,
            "detectedAt": NOW, "temporaryWalletConfigured": bool(wallet.get("temporaryWalletAddress")),
            "temporaryWalletAddress": wallet.get("temporaryWalletAddress") or None,
            "claim": "not-executed; protocol-specific adapter and eligibility verification required",
            "adapter": next((a for a in adapters.get("adapters", []) if a.get("source") == source.get("url") or a.get("domain") == urllib.parse.urlparse(source.get("url","")).netloc.lower().removeprefix("www.")), None),
            "executionMode": "monitor-and-queue-only", "walletSigning": "never-automatic",
            "localReview": local_review, "evidenceReview": ai,
        }
        opportunities.append(op)
        existing = {x.get("id"): x for x in history.get("items", []) if x.get("id")}
        previous = existing.get(oid, {})
        existing[oid] = {
            **previous,
            "id": oid,
            "name": op["name"],
            "source": op["source"],
            "type": op["type"],
            "firstSeenAt": previous.get("firstSeenAt", NOW),
            "lastSeenAt": NOW,
            "lastActionStage": stage,
            "lastSignals": signals,
            "lastRequirements": requirements,
            "status": previous.get("status", "WAITING_OWNER_APPROVAL"),
            "ownerApprovalRequired": True,
            "claimExecuted": False
        }
        history["items"] = list(existing.values())
        if stage != "WATCH":
            approvals.append({
                "id": oid, "name": op["name"], "source": op["source"], "requiresOwnerApproval": True,
                "status": "owner-action-required" if owner_needed else "claim-path-detected-not-executed",
                "action": "Review the official claim flow. This scan did not submit a claim or move funds.", "createdAt": NOW,
            })

    # Fail-safe: empty/failed source set never implies successful collection.
    configured = {"independent_engine": True, "external_engine_reviews": False}
    report = {
        "guard": "ANIL X Immortal Guard", "engine": "Airdrop+ X", "version": "7.0-safe-advisory",
        "lastScan": NOW, "sourcesScanned": len(sources), "sourcesReachable": len(opportunities),
        "claimPathsDetected": sum(x["actionStage"] == "CLAIM_PATH_DETECTED" for x in opportunities),
        "waitingOwner": sum(x["actionStage"] == "WAITING_OWNER" for x in opportunities),
        "mode": "discover -> inspect -> triage -> queue; no claim execution",
        "financialActions": "no automated claim/transfer; owner approval required for wallet signatures and transfers",
        "temporaryWallet": "configured" if wallet.get("temporaryWalletAddress") else "not-configured",
        "walletPrivateKeys": "never-collected", "automaticSigning": False,
        "independentEngines": {"configured": configured, "reviewsThisRun": engine_reviews, "status": "active"},
        "blockers": blockers,
    }
    rewards["sources"] = list(sources.values())
    rewards["lastScan"] = NOW
    rewards["guardVersion"] = "7.0-safe-advisory"
    rewards["policy"] = "Monitoring and advisory only. No project-specific claim adapter verified; no claim transaction executed. Never collect private keys or bypass KYC/CAPTCHA/Sybil controls."
    save(FILES["rewards"], rewards)
    save(FILES["status"], report)
    save(FILES["opportunities"], {"guard": "ANIL X Immortal Guard", "updatedAt": NOW, "opportunities": opportunities})
    history["updatedAt"] = NOW
    history["count"] = len(history.get("items", []))
    save(FILES["history"], history)
    durable_approvals = [{
        "id": item.get("id"), "name": item.get("name"), "source": item.get("source"),
        "requiresOwnerApproval": True, "status": item.get("status", "WAITING_OWNER_APPROVAL"),
        "lastActionStage": item.get("lastActionStage"), "createdAt": item.get("firstSeenAt"),
        "updatedAt": item.get("lastSeenAt")
    } for item in history.get("items", [])]
    save(FILES["approvals"], {"guard": "ANIL X Immortal Guard", "updatedAt": NOW, "count": len(durable_approvals), "approvals": durable_approvals})
    learning["lastUpdate"] = NOW
    save(FILES["learning"], learning)
    print(json.dumps({"status": "scan_complete", "sources": len(sources), "reachable": len(opportunities), "blockers": len(blockers), "independentEngineReviews": engine_reviews}, ensure_ascii=False))

if __name__ == "__main__":
    main()
