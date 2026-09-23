import datetime as dt
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
DISCOVERY = ROOT / "guard-discovery.json"
SOURCES = ROOT / "guard-sources.json"
WALLET = ROOT / "guard-wallet.json"
OUT = ROOT / "guard-free-real-tokens.json"
HISTORY = ROOT / "guard-opportunity-history.json"

UA = "ANIL-X-Immortal-Guard/13.0-Free-Real-Token-Hunter-X"
TIMEOUT = 15
MAX_BODY = 600_000

# STRICT LANE:
# Admit only a live, publicly evidenced token distribution that requires
# no new money, trade, deposit, hold, stake, referral, quest, KYC, CAPTCHA,
# login, wallet connection/signature, or paid fee.
# The Guard may monitor passive incoming transfers, but never signs or
# moves funds automatically.

LIVE = (
    "claim now", "claim is live", "claim is open", "claim available",
    "redeem now", "withdraw now", "distribution is live",
    "distribution is now live", "tokens are being distributed",
    "tokens will be sent", "tokens have been distributed"
)
FREE = (
    "no purchase", "no purchase required", "no trading", "no trade required",
    "no deposit", "no deposit required", "no holding", "no holding required",
    "without purchase", "without trading", "without deposit", "without holding",
    "free to claim", "free claim", "free distribution", "no fee"
)
BLOCK = (
    "kyc", "know your customer", "captcha", "connect wallet",
    "wallet connection", "sign transaction", "wallet signature",
    "approve transaction", "deposit required", "trade required",
    "trading volume", "purchase required", "hold required", "holding required",
    "complete tasks", "complete quests", "invite friends", "referral required",
    "stake required", "staking required", "bridge required", "pay a fee",
    "login required", "account required", "registration required"
)
TOKEN_ID = (
    "contract address", "token address", "token contract", "contract:",
    "ca:", "erc-20", "erc20", "jetton", "spl token", "token mint",
    "mint address", "token symbol", "ticker"
)
FAKE_WORDS = (
    "points", "points program", "testnet points", "potential airdrop",
    "future airdrop", "airdrop speculation", "maybe eligible",
    "coming soon", "waitlist"
)

def fetch(url):
    try:
        if not url.startswith("https://"):
            return "", "", None
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"},
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.geturl(), r.read(MAX_BODY).decode("utf-8", "ignore"), r.status
    except Exception:
        return "", "", None

def clean(body):
    body = html.unescape(body or "")
    body = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.I)
    body = re.sub(r"<style[\s\S]*?</style>", " ", body, flags=re.I)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()

def domain(url):
    try:
        return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:
        return ""

def trusted_domains():
    try:
        data = json.loads(SOURCES.read_text(encoding="utf-8"))
    except Exception:
        data = {"sources": []}
    return {domain(x.get("url", "")) for x in data.get("sources", []) if x.get("url")}

def hits(text, terms):
    low = text.lower()
    return [x for x in terms if x in low]

def canonical(body):
    m = re.search(
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)',
        body or "", re.I,
    )
    return html.unescape(m.group(1)).strip() if m else ""

def token_contract_evidence(text):
    # Keep evidence, not arbitrary extracted addresses, because a page can
    # contain unrelated wallet/contract addresses.
    return hits(text, TOKEN_ID)

def stable_id(name, url):
    raw = (name + "|" + url).encode("utf-8")
    return "free-" + hashlib.sha256(raw).hexdigest()[:20]

def evaluate(item, trusted):
    source = item.get("resolvedUrl") or item.get("canonicalUrl") or item.get("url", "")
    final, body, status = fetch(source)
    text = clean(body)
    d = domain(final or source)
    live = hits(text, LIVE)
    free = hits(text, FREE)
    blocked = hits(text, BLOCK)
    token = token_contract_evidence(text)
    fake = hits(text, FAKE_WORDS)

    # Official-domain proof is mandatory. A news article is never enough.
    official = (
        item.get("verification") == "resolved-official-source"
        and d in trusted
        and bool(d)
    )

    reasons = []
    if not official:
        reasons.append("official_source_not_proven")
    if not (status and 200 <= status < 300):
        reasons.append("source_unavailable")
    if not live:
        reasons.append("no_live_distribution_evidence")
    if not free:
        reasons.append("no_explicit_no-cost_evidence")
    if blocked:
        reasons.append("owner_or_cost_condition_detected")
    if not token:
        reasons.append("token_identity_not_proven")
    if fake:
        reasons.append("speculative_or_points_language_detected")

    accepted = not reasons
    return {
        "accepted": accepted,
        "id": stable_id(str(item.get("title") or "token"), final or source),
        "name": item.get("title") or "Verified token distribution",
        "officialUrl": final or source,
        "canonicalUrl": canonical(body) or None,
        "officialDomain": d or None,
        "httpStatus": status,
        "evidence": {
            "live": live[:12],
            "free": free[:12],
            "tokenIdentity": token[:12],
            "blocked": blocked[:20],
            "speculative": fake[:12],
        },
        "rejectionReasons": reasons,
        "status": "VERIFIED_FREE_REAL_TOKEN" if accepted else "REJECTED",
        "executionMode": "PASSIVE_RECEIPT_ONLY" if accepted else "NONE",
        "verifiedAt": NOW,
    }

def main():
    try:
        discovery = json.loads(DISCOVERY.read_text(encoding="utf-8"))
    except Exception:
        discovery = {"items": []}
    trusted = trusted_domains()

    try:
        wallet = json.loads(WALLET.read_text(encoding="utf-8"))
    except Exception:
        wallet = {}
    temp = wallet.get("temporaryWalletAddress")

    accepted = []
    rejected = []
    seen = set()

    for item in discovery.get("items", []):
        result = evaluate(item, trusted)
        if result["id"] in seen:
            continue
        seen.add(result["id"])
        if result["accepted"]:
            result["temporaryWalletAddress"] = temp or None
            result["policy"] = (
                "Eligible for passive receipt monitoring only. "
                "No automatic signing, claiming, or temporary-to-permanent transfer."
            )
            accepted.append(result)
        else:
            rejected.append(result)

    # Preserve durable discovery history; this engine never deletes a found item.
    try:
        history = json.loads(HISTORY.read_text(encoding="utf-8"))
    except Exception:
        history = {"version": "1.0", "items": []}
    old = {x.get("id"): x for x in history.get("items", []) if x.get("id")}
    for result in accepted + rejected:
        hid = result["id"]
        previous = old.get(hid, {})
        old[hid] = {
            **previous,
            "id": hid,
            "name": result["name"],
            "source": result["officialUrl"],
            "firstSeenAt": previous.get("firstSeenAt", NOW),
            "lastSeenAt": NOW,
            "strictFreeTokenStatus": result["status"],
            "strictFreeTokenReasons": result["rejectionReasons"],
            "ownerApprovalRequired": True,
        }
    history["items"] = list(old.values())
    history["count"] = len(history["items"])
    history["updatedAt"] = NOW
    HISTORY.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    output = {
        "guard": "ANIL X Immortal Guard",
        "engine": "Free Real Token Hunter X",
        "version": "13.0-strict",
        "updatedAt": NOW,
        "definition": (
            "Real token + live distribution + explicit no-cost/no-new-condition evidence. "
            "Points, speculative airdrops, trading campaigns and gated claims are excluded."
        ),
        "verifiedCount": len(accepted),
        "tokens": accepted,
        "rejectedCount": len(rejected),
        "rejected": rejected[-250:],
        "temporaryWalletAddress": temp or None,
        "automaticClaim": False,
        "automaticSigning": False,
        "automaticTransfer": False,
        "privateKeys": "never-collected",
        "ownerGate": "Required for any opportunity-specific action.",
        "receiptMode": "Passive on-chain monitoring only.",
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "free_real_token_hunter_complete",
        "verifiedFreeRealTokens": len(accepted),
        "rejected": len(rejected),
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
