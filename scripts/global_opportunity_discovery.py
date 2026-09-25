import datetime as dt
import html
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NOW=dt.datetime.now(dt.timezone.utc).isoformat()
SOURCES=ROOT/"guard-sources.json"; DISCOVERY=ROOT/"guard-discovery.json"
UA="ANIL-X-Immortal-Guard/14.0-Global-MultiFeed"

FIXED=[
("TON Ecosystem","https://ton.org/ecosystem","ecosystem"),("TON Blog","https://blog.ton.org/","announcements"),
("Ethereum Ecosystem","https://ethereum.org/en/ecosystem/","ecosystem"),("Solana Ecosystem","https://solana.com/ecosystem","ecosystem"),
("Base Ecosystem","https://www.base.org/ecosystem","ecosystem"),("Arbitrum Ecosystem","https://arbitrum.io/ecosystem","ecosystem"),
("Optimism Ecosystem","https://www.optimism.io/ecosystem","ecosystem"),("Polygon Ecosystem","https://polygon.technology/ecosystem","ecosystem"),
("Avalanche","https://www.avax.network/","ecosystem"),("Starknet","https://www.starknet.io/ecosystem/","ecosystem"),
("zkSync","https://www.zksync.io/ecosystem","ecosystem"),("Scroll","https://scroll.io/ecosystem","ecosystem"),
("Linea","https://linea.build/ecosystem","ecosystem"),("Celestia","https://celestia.org/ecosystem/","ecosystem"),
("Cosmos","https://cosmos.network/ecosystem","ecosystem"),("NEAR","https://near.org/ecosystem/","ecosystem"),
("Sui","https://sui.io/ecosystem","ecosystem"),("Aptos","https://aptosfoundation.org/ecosystem","ecosystem"),
("Polkadot","https://polkadot.com/ecosystem","ecosystem"),("Chainlink","https://chain.link/ecosystem","ecosystem"),
("Berachain","https://www.berachain.com/","ecosystem"),("Monad","https://www.monad.xyz/","ecosystem"),
("Sei","https://www.sei.io/","ecosystem"),("Injective","https://injective.com/","ecosystem"),
("Mantle","https://www.mantle.xyz/","ecosystem"),("Hyperliquid","https://hyperliquid.xyz/","ecosystem"),
("Movement","https://movementlabs.xyz/","ecosystem"),("Mina","https://minaprotocol.com/","ecosystem"),
("Internet Computer","https://internetcomputer.org/","ecosystem"),("Hedera","https://hedera.com/","ecosystem"),
("Algorand","https://algorand.co/","ecosystem"),("Cardano","https://cardano.org/","ecosystem"),
("Tezos","https://tezos.com/","ecosystem"),("Kaspa","https://kaspa.org/","ecosystem"),
("Gitcoin","https://www.gitcoin.co/","grants-rewards"),("Immunefi","https://immunefi.com/","bug-bounty"),
("HackerOne","https://www.hackerone.com/","bug-bounty"),("Code4rena","https://code4rena.com/","bug-bounty"),
("Sherlock","https://www.sherlock.xyz/","bug-bounty"),("Layer3","https://layer3.xyz/","quest-rewards"),
("Galxe","https://galxe.com/","quest-rewards"),("Zealy","https://zealy.io/","quest-rewards"),
("QuestN","https://questn.com/","quest-rewards"),("CoinMarketCap Airdrops","https://coinmarketcap.com/airdrop/","airdrop-discovery"),
("Binance Airdrop Portal","https://www.binance.com/en/airdrop","airdrop-portal"),("Binance Alpha","https://www.binance.com/en/alpha","rewards"),
("Binance Research","https://research.binance.com/","research"),("Coinbase Learn","https://www.coinbase.com/learn","rewards-education")]

QUERIES=[
"site:*.org token airdrop claim live no purchase required","site:*.com token distribution claim now free no purchase",
"site:*.org \"tokens are being distributed\" crypto","site:*.com \"free to claim\" token \"contract address\"",
"site:*.com \"claim is live\" token airdrop","site:*.com \"distribution is live\" token crypto",
"site:*.com \"no purchase\" \"airdrop\" token","site:*.com \"no deposit\" \"airdrop\" token",
"site:*.com \"no trading\" \"airdrop\" token","site:*.com \"token address\" \"claim now\" crypto",
"site:*.com \"jetton\" \"claim\" TON","site:*.com \"token mint\" \"claim\" Solana",
"site:*.com \"contract address\" \"claim\" Base","site:*.com \"contract address\" \"claim\" Arbitrum",
"site:*.com \"contract address\" \"claim\" Ethereum","site:*.com \"contract address\" \"claim\" BNB",
"site:*.com \"contract address\" \"claim\" Polygon","site:*.com \"contract address\" \"claim\" Sui",
"site:*.com \"contract address\" \"claim\" Aptos","crypto airdrop claim official token distribution when:3d",
"web3 free token claim official no purchase when:3d","crypto token distribution live official when:3d",
"TON free token distribution official when:3d",
"site:immunefi.com bug bounty $10000 crypto","site:hackerone.com crypto bug bounty $10000","site:code4rena.com contest prize pool crypto","site:sherlock.xyz contest prize pool crypto","web3 security bounty $50000 live official","smart contract bug bounty $100000 official","crypto grant $10000 application open web3","web3 grant $50000 application open","crypto hackathon $10000 prize pool 2026","web3 hackathon $50000 prize pool 2026","developer bounty $10000 blockchain open","retroactive rewards program web3 official 2026","protocol rewards claim official 2026","crypto ecosystem incentive program rewards official 2026","liquidity mining rewards official program 2026","testnet rewards official blockchain 2026","DeFi trading competition prize pool $10000 official","NFT creator grant $10000 web3 official","token airdrop claim gratis criptomoneda cuando:3d","recompensa crypto bounty 10000 cuando:7d","airdrop token gratuit quand:3d","prime crypto bounty 10000 quand:7d","kostenloser token airdrop jetzt wenn:3d","crypto bounty 10000 euro deutsch wenn:7d","airdrop cripto gratis quando:3d","recompensa web3 10000 quando:7d","ücretsiz token airdrop resmi ne zaman:3d","kripto ödül bounty 10000 resmi:7d","крипто airdrop бесплатно когда:3d","награда bounty 10000 crypto когда:7d","免费代币空投 领取 近3天","区块链 赏金 10000 美元 近7天","暗号資産 エアドロップ 無料 直近3日","web3 バウンティ 10000ドル 直近7日","무료 토큰 에어드롭 클레임 최근 3일","웹3 바운티 10000달러 최근 7일"]

def fetch(url,timeout=12):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/rss+xml,application/xml,text/html;q=0.8,*/*;q=0.4"})
        with urllib.request.urlopen(req,timeout=timeout) as r:return r.read(400_000).decode("utf-8","ignore")
    except Exception:return ""

def news_candidates():
    out=[]
    for q in QUERIES:
        raw=fetch("https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":q,"hl":"en-US","gl":"US","ceid":"US:en"}))
        if not raw:continue
        try:root=ET.fromstring(raw)
        except ET.ParseError:continue
        for item in root.findall(".//item"):
            title=html.unescape(item.findtext("title","")).strip(); link=html.unescape(item.findtext("link","")).strip()
            if not title or not link.startswith("http"):continue
            source=item.find("source"); publisher=source.text.strip() if source is not None and source.text else ""
            out.append({"title":title[:240],"url":link,"publisher":publisher[:120],"discoveredAt":NOW,
                        "verification":"unverified-discovery","action":"never-auto-claim"})
    seen=set(); unique=[]
    for x in out:
        key=x["url"].split("#",1)[0]
        if key not in seen:seen.add(key);unique.append(x)
    return unique[:5000]

def main():
    registry=json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {"sources":[]}
    existing={x.get("url"):x for x in registry.get("sources",[]) if x.get("url")}
    for name,url,typ in FIXED:existing.setdefault(url,{"name":name,"url":url,"type":typ,"status":"pending-scan"})
    news=news_candidates()
    DISCOVERY.write_text(json.dumps({"guard":"ANIL X Immortal Guard","engine":"Airdrop+ X Global Discovery",
        "version":"15.0-multilingual-multifeed","updatedAt":NOW,"queries":QUERIES,"count":len(news),"items":news,"capacity":5000,"coverageMode":"dynamic-multifeed; not limited to fixed registry",
        "policy":"Discovery only. No claim, signing, wallet connection, KYC/CAPTCHA bypass, or transfer."},
        ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    registry["sources"]=list(existing.values());registry["lastDiscovery"]=NOW;registry["discoveryCount"]=len(news)
    SOURCES.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"global_discovery_complete","fixedSources":len(existing),"newsCandidates":len(news)},ensure_ascii=False))
if __name__=="__main__":main()
