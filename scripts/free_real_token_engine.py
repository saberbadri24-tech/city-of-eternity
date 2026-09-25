import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NOW=dt.datetime.now(dt.timezone.utc).isoformat()
DISCOVERY=ROOT/"guard-discovery.json"; SOURCES=ROOT/"guard-sources.json"; WALLET=ROOT/"guard-wallet.json"
OUT=ROOT/"guard-free-real-tokens.json"; HISTORY=ROOT/"guard-opportunity-history.json"
UA="ANIL-X-Immortal-Guard/14.0-Free-Real-Token-Hunter"
TIMEOUT=10; MAX_BODY=650_000; WORKERS=16

LIVE=("claim now","claim is live","claim is open","claim available","redeem now","withdraw now",
      "distribution is live","distribution is now live","tokens are being distributed",
      "tokens will be sent","tokens have been distributed","available to claim","claim your tokens")
FREE=("no purchase","no purchase required","no trading required","no trade required","no deposit",
      "no deposit required","no holding","no holding required","without purchase","without trading",
      "without deposit","without holding","free to claim","free claim","free distribution","no fee required",
      "at no cost","completely free")
REQUIRED=("kyc required","kyc is required","know your customer is required","captcha required",
          "wallet connection required","connect your wallet to claim","sign transaction to claim",
          "signature required to claim","approve transaction to claim","deposit required","trade required",
          "trading required","purchase required","hold required","holding required","complete tasks to claim",
          "complete quests to claim","invite friends to claim","referral required","stake required",
          "staking required","bridge required","pay a fee","login required","account required","registration required")
TOKEN_ID=("contract address","token address","token contract","contract:","ca:","erc-20","erc20","jetton",
          "spl token","token mint","mint address","token symbol","ticker")
SPEC=("points program","testnet points","potential airdrop","future airdrop","airdrop speculation",
      "maybe eligible","coming soon","waitlist","points only","points can be redeemed later")

def fetch(url):
    for attempt in range(2):
        try:
            if not url.startswith("https://"): return "","",None
            req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html,application/xhtml+xml,*/*;q=0.8"})
            with urllib.request.urlopen(req,timeout=TIMEOUT) as r:return r.geturl(),r.read(MAX_BODY).decode("utf-8","ignore"),r.status
        except Exception:
            if attempt:break
    return "","",None

def clean(body):
    body=html.unescape(body or "")
    import re
    body=re.sub(r"<script[\s\S]*?</script>"," ",body,flags=re.I)
    body=re.sub(r"<style[\s\S]*?</style>"," ",body,flags=re.I)
    return re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",body)).strip()

def domain(url):
    try:return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:return ""

def trusted_domains():
    try:data=json.loads(SOURCES.read_text(encoding="utf-8"))
    except Exception:data={"sources":[]}
    return {domain(x.get("url","")) for x in data.get("sources",[]) if x.get("url")}

def hits(text,terms):
    low=text.lower();return [x for x in terms if x in low]

def canonical(body):
    import re
    m=re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)',body or "",re.I)
    return html.unescape(m.group(1)).strip() if m else ""

def stable_id(name,url):
    return "free-"+hashlib.sha256((name+"|"+url).encode()).hexdigest()[:20]

def evidence_windows(text,terms,window=110):
    low=text.lower();out=[]
    for term in terms:
        p=low.find(term)
        if p>=0:out.append({"term":term,"context":text[max(0,p-window):min(len(text),p+len(term)+window)]})
    return out[:12]

def evaluate(item,trusted):
    source=item.get("resolvedUrl") or item.get("canonicalUrl") or item.get("url","")
    final,body,status=fetch(source);text=clean(body);d=domain(final or source)
    live=hits(text,LIVE);free=hits(text,FREE);required=hits(text,REQUIRED);token=hits(text,TOKEN_ID);spec=hits(text,SPEC)
    official=item.get("verification")=="resolved-official-source" and d in trusted and bool(d)
    reasons=[]
    if not official:reasons.append("official_source_not_proven")
    if not(status and 200<=status<300):reasons.append("source_unavailable")
    if not live:reasons.append("no_live_distribution_evidence")
    if not free:reasons.append("no_explicit_no_cost_evidence")
    if required:reasons.append("owner_or_cost_condition_detected")
    if not token:reasons.append("token_identity_not_proven")
    if spec and not live:reasons.append("speculative_or_points_language_detected")
    accepted=not reasons
    return {"accepted":accepted,"id":stable_id(str(item.get("title") or "token"),final or source),
      "name":item.get("title") or "Verified token distribution","officialUrl":final or source,
      "canonicalUrl":canonical(body) or None,"officialDomain":d or None,"httpStatus":status,
      "evidence":{"live":live[:12],"free":free[:12],"tokenIdentity":token[:12],"requiredConditions":required[:20],
                  "speculative":spec[:12],"liveContext":evidence_windows(text,LIVE),"freeContext":evidence_windows(text,FREE)},
      "rejectionReasons":reasons,"status":"VERIFIED_FREE_REAL_TOKEN" if accepted else "REJECTED",
      "executionMode":"PASSIVE_RECEIPT_ONLY" if accepted else "NONE","verifiedAt":NOW}

def main():
    try:discovery=json.loads(DISCOVERY.read_text(encoding="utf-8"))
    except Exception:discovery={"items":[]}
    trusted=trusted_domains()
    try:wallet=json.loads(WALLET.read_text(encoding="utf-8"))
    except Exception:wallet={}
    temp=wallet.get("temporaryWalletAddress")
    items=discovery.get("items",[])[:5000]
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        results=list(ex.map(lambda x:evaluate(x,trusted),items))
    accepted=[];rejected=[];seen=set()
    for r in results:
        if r["id"] in seen:continue
        seen.add(r["id"])
        if r["accepted"]:
            r["temporaryWalletAddress"]=temp or None
            r["policy"]="Passive receipt monitoring only; no automatic signing, claiming, or transfer."
            accepted.append(r)
        else:rejected.append(r)
    try:history=json.loads(HISTORY.read_text(encoding="utf-8"))
    except Exception:history={"version":"1.0","items":[]}
    old={x.get("id"):x for x in history.get("items",[]) if x.get("id")}
    for r in accepted+rejected:
        old[r["id"]]={**old.get(r["id"],{}),"id":r["id"],"name":r["name"],"source":r["officialUrl"],
          "firstSeenAt":old.get(r["id"],{}).get("firstSeenAt",NOW),"lastSeenAt":NOW,
          "strictFreeTokenStatus":r["status"],"strictFreeTokenReasons":r["rejectionReasons"],"ownerApprovalRequired":True}
    history["items"]=list(old.values());history["count"]=len(old);history["updatedAt"]=NOW
    HISTORY.write_text(json.dumps(history,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    OUT.write_text(json.dumps({
      "guard":"ANIL X Immortal Guard","engine":"Free Real Token Hunter X","version":"14.0-strict-fast","updatedAt":NOW,
      "definition":"Live official token distribution + explicit no-cost evidence + token identity; gated/speculative/points opportunities excluded.",
      "verifiedCount":len(accepted),"tokens":accepted,"rejectedCount":len(rejected),"rejected":rejected[-500:],
      "temporaryWalletAddress":temp or None,"automaticClaim":False,"automaticSigning":False,"automaticTransfer":False,
      "privateKeys":"never-collected","ownerGate":"Required for any opportunity-specific action.","receiptMode":"Passive on-chain monitoring only."
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"free_real_token_hunter_complete","verifiedFreeRealTokens":len(accepted),"rejected":len(rejected),"scanned":len(results),"capacity":5000,"coverageMode":"dynamic-discovery"},ensure_ascii=False))
if __name__=="__main__":main()
