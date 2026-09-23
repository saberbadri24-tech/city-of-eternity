import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
SOURCES = ROOT / "guard-sources.json"
DISCOVERY = ROOT / "guard-discovery.json"

UA = "ANIL-X-Immortal-Guard/8.0 Global-Discovery"

FIXED = [
    ("TON Ecosystem", "https://ton.org/ecosystem", "ecosystem"),
    ("TON Blog", "https://blog.ton.org/", "announcements"),
    ("Ethereum Ecosystem", "https://ethereum.org/en/ecosystem/", "ecosystem"),
    ("Solana Ecosystem", "https://solana.com/ecosystem", "ecosystem"),
    ("Base Ecosystem", "https://www.base.org/ecosystem", "ecosystem"),
    ("Arbitrum Ecosystem", "https://arbitrum.io/ecosystem", "ecosystem"),
    ("Optimism Ecosystem", "https://www.optimism.io/ecosystem", "ecosystem"),
    ("Polygon Ecosystem", "https://polygon.technology/ecosystem", "ecosystem"),
    ("Avalanche Ecosystem", "https://www.avax.network/", "ecosystem"),
    ("Starknet Ecosystem", "https://www.starknet.io/ecosystem/", "ecosystem"),
    ("zkSync Ecosystem", "https://www.zksync.io/ecosystem", "ecosystem"),
    ("Scroll Ecosystem", "https://scroll.io/ecosystem", "ecosystem"),
    ("Linea Ecosystem", "https://linea.build/ecosystem", "ecosystem"),
    ("Celestia Ecosystem", "https://celestia.org/ecosystem/", "ecosystem"),
    ("Cosmos Ecosystem", "https://cosmos.network/ecosystem", "ecosystem"),
    ("NEAR Ecosystem", "https://near.org/ecosystem/", "ecosystem"),
    ("Sui Ecosystem", "https://sui.io/ecosystem", "ecosystem"),
    ("Aptos Ecosystem", "https://aptosfoundation.org/ecosystem", "ecosystem"),
    ("Polkadot Ecosystem", "https://polkadot.com/ecosystem", "ecosystem"),
    ("Chainlink Ecosystem", "https://chain.link/ecosystem", "ecosystem"),
    ("Gitcoin", "https://www.gitcoin.co/", "grants-rewards"),
    ("Immunefi", "https://immunefi.com/", "bug-bounty"),
    ("HackerOne", "https://www.hackerone.com/", "bug-bounty"),
    ("Code4rena", "https://code4rena.com/", "bug-bounty"),
    ("Sherlock", "https://www.sherlock.xyz/", "bug-bounty"),
    ("Layer3", "https://layer3.xyz/", "quest-rewards"),
    ("Galxe", "https://galxe.com/", "quest-rewards"),
    ("Zealy", "https://zealy.io/", "quest-rewards"),
    ("QuestN", "https://questn.com/", "quest-rewards"),
    ("CoinMarketCap Airdrops", "https://coinmarketcap.com/airdrop/", "airdrop-discovery"),
    ("Binance Airdrop Portal", "https://www.binance.com/en/airdrop", "airdrop-portal"),
    ("Binance Research", "https://research.binance.com/", "research"),
    ("Coinbase Learn", "https://www.coinbase.com/learn", "rewards-education"),
]

QUERIES = [
    "crypto airdrop claim official",
    "web3 token airdrop eligibility official",
    "testnet rewards points token official",
    "crypto quest rewards official",
    "web3 bug bounty reward official",
    "TON airdrop rewards official",
]

def fetch(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml,text/html;q=0.9,*/*;q=0.5"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(500_000).decode("utf-8", "ignore")
    except Exception:
        return ""

def news_candidates():
    out = []
    for q in QUERIES:
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
            "q": q + " when:7d",
            "hl": "en-US", "gl": "US", "ceid": "US:en"
        })
        raw = fetch(url)
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for item in root.findall(".//item"):
            title = html.unescape(item.findtext("title", "")).strip()
            link = html.unescape(item.findtext("link", "")).strip()
            if not title or not link or not link.startswith("http"):
                continue
            source = item.find("source")
            publisher = source.text.strip() if source is not None and source.text else ""
            out.append({
                "title": title[:240],
                "url": link,
                "publisher": publisher[:120],
                "discoveredAt": NOW,
                "verification": "unverified-discovery",
                "action": "never-auto-claim"
            })
    # Deduplicate exact URLs while retaining the first observation.
    seen, unique = set(), []
    for x in out:
        if x["url"] not in seen:
            seen.add(x["url"])
            unique.append(x)
    return unique[:250]

def main():
    registry = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {"sources": []}
    existing = {x.get("url"): x for x in registry.get("sources", []) if x.get("url")}

    for name, url, typ in FIXED:
        existing.setdefault(url, {"name": name, "url": url, "type": typ, "status": "pending-scan"})

    news = news_candidates()
    # Discovery URLs are kept separately. They are NOT promoted to actionable sources
    # until the normal guard verifies the page and applies the owner-approval gate.
    discovery = {
        "guard": "ANIL X Immortal Guard",
        "engine": "Airdrop+ X Global Discovery",
        "updatedAt": NOW,
        "queries": QUERIES,
        "count": len(news),
        "items": news,
        "policy": "Discovery only. No claim, signing, wallet connection, KYC/CAPTCHA bypass, or transfer."
    }
    DISCOVERY.write_text(json.dumps(discovery, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    registry["sources"] = list(existing.values())
    registry["lastDiscovery"] = NOW
    registry["discoveryCount"] = len(news)
    SOURCES.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status":"global_discovery_complete","fixedSources":len(existing),"newsCandidates":len(news)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
