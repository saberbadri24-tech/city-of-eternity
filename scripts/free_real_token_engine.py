import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
DISCOVERY = ROOT / "guard-discovery.json"
FREE = ROOT / "guard-free-real-tokens.json"
SOURCES = ROOT / "guard-sources.json"
WALLET = ROOT / "guard-wallet.json"

UA = "ANIL-X-Immortal-Guard/12.0-Free-Real-Token-Engine"

# A candidate is admitted only when the public evidence supports all of:
# real token + live distribution + no new money/trade/hold/task consideration.
# Login/KYC/CAPTCHA/signature are never bypassed and are excluded from this lane.

FREE_MARKERS = (
    "free of charge", "no purchase", "no purchase required",
    "no trade", "no trading required", "no deposit", "no deposit required",
    "no holding", "no holding required", "without purchase", "without trading",
    "without deposit", "without holding", "no task", "no tasks required",
)
LIVE_MARKERS = (
    "claim now", "claim is live", "claim is open", "claim available",
    "redeem now", "withdraw now", "distribution is live", "distribution is now live",
)
BLOCK_MARKERS = (
    "kyc", "captcha", "connect wallet", "wallet signature", "sign transaction",
    "deposit required", "trade required", "trading volume", "purchase required",
    "hold required", "complete tasks", "invite friends", "referral required",
    "stake required", "bridge required", "pay a fee",
)
TOKEN_MARKERS = (
    "contract address", "token address", "token contract", "ca:",
    "erc-20", "erc20", "jetton", "spl token", "token mint", "mint address",
)

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})
        with urllib.request.urlopen(req, timeout=18) as r:
            return r.geturl(), r.read(500_000).decode("utf-8", "ignore"), r.status
    except Exception:
        return "", "", None

def clean(body):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(body))).strip()

def domain(url):
    try:
        return urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""

def official_domains():
    try:
        data=json.loads(SOURCES.read_text(encoding="utf-8"))
    except Exception:
        data={"sources":[]}
    return {domain(x.get("url","")) for x in data.get("sources",[]) if x.get("url")}

def score(text):
    low=text.lower()
    live=[x for x in LIVE_MARKERS if x in low]
    free=[x for x in FREE_MARKERS if x in low]
    blocked=[x for x in BLOCK_MARKERS if x in low]
    token=[x for x in TOKEN_MARKERS if x in low]
    return live, free, blocked, token

def main():
    try:
        discovery=json.loads(DISCOVERY.read_text(encoding="utf-8"))
    except Exception:
        discovery={"items":[]}
    trusted=official_domains()
    wallet={}
    try:
        wallet=json.loads(WALLET.read_text(encoding="utf-8"))
    except Exception:
        pass
    temp=wallet.get("temporaryWalletAddress")

    candidates=[]
    rejected=[]
    for item in discovery.get("items",[]):
        url=item.get("resolvedUrl") or item.get("canonicalUrl") or item.get("url","")
        if not url:
            continue
        d=domain(url)
        if item.get("verification")!="resolved-official-source" or d not in trusted:
            rejected.append({"title":item.get("title"),"reason":"not-officially-verified","url":url})
            continue
        final,body,status=fetch(url)
        text=clean(body)
        live,free,blocked,token=score(text)
        # "Unconditional" means no new money, trade, deposit, holding, task,
        # referral, KYC/CAPTCHA, wallet signature or paid fee is required.
        if not (200 <= (status or 0) < 300):
            rejected.append({"title":item.get("title"),"reason":"source-unavailable","url":url})
            continue
        if not live:
            rejected.append({"title":item.get("title"),"reason":"no-live-claim-evidence","url":final or url})
            continue
        if not free:
            rejected.append({"title":item.get("title"),"reason":"no-explicit-free-evidence","url":final or url})
            continue
        if blocked:
            rejected.append({"title":item.get("title"),"reason":"has-new-condition-or-owner-action","blockedSignals":blocked[:12],"url":final or url})
            continue
        if not token:
            rejected.append({"title":item.get("title"),"reason":"token-identity-not-evidenced","url":final or url})
            continue
        candidates.append({
            "id": re.sub(r"[^a-z0-9-]+","-",str(item.get("title") or "token").lower()).strip("-"),
            "name": item.get("title") or "Verified token distribution",
            "officialUrl": final or url,
            "officialDomain": d,
            "httpStatus": status,
            "liveEvidence": live,
            "freeEvidence": free,
            "tokenEvidence": token,
            "conditionSignals": [],
            "action": "DIRECT_TO_TEMP_WALLET_WHEN_PROTOCOL_PUSHES",
            "temporaryWalletAddress": temp or None,
            "execution": "PASSIVE_RECEIPT_ONLY",
            "status": "VERIFIED_FREE_REAL_TOKEN",
            "verifiedAt": NOW
        })

    out={
        "guard":"ANIL X Immortal Guard",
        "engine":"Free Real Token Hunter X",
        "version":"12.0-strict",
        "updatedAt":NOW,
        "definition":"Only live, real-token distributions with explicit evidence of no purchase/trade/deposit/holding/task and no KYC/CAPTCHA/signature/login requirement.",
        "count":len(candidates),
        "tokens":candidates,
        "rejectedCount":len(rejected),
        "rejectedSample":rejected[-100:],
        "temporaryWalletAddress":temp or None,
        "transferPolicy":"Never auto-transfer temporary wallet to permanent wallet.",
        "signingPolicy":"Never store or use seed/private keys; never bypass KYC/CAPTCHA/anti-Sybil or signatures."
    }
    FREE.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"free_real_token_scan_complete","verified":len(candidates),"rejected":len(rejected)},ensure_ascii=False))

if __name__=="__main__":
    main()
