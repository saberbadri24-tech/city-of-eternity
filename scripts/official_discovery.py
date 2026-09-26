import json, re, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
UA="ANIL-X-Immortal-Guard/16.0-Official"
KEYS=("airdrop","claim","reward","bounty","grant","incentive","distribution","quest","learn","earn","bug bounty")
def fetch(url):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html,*/*;q=0.8"})
        with urllib.request.urlopen(req,timeout=12) as r:
            return r.geturl(),r.read(350000).decode("utf-8","ignore"),r.status
    except Exception:
        return url,"",None
def domain(url):
    return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
def main():
    src=json.loads((ROOT/"guard-sources.json").read_text(encoding="utf-8"))
    items=[]
    for s in src.get("sources",[]):
        url=s.get("url","")
        if not url.startswith("https://"): continue
        final,body,status=fetch(url)
        if not body: continue
        text=re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",body)).strip()
        low=text.lower()
        signals=[k for k in KEYS if k in low]
        if signals:
            items.append({"title":s.get("name","Official source"),"url":final,"publisher":s.get("name",""),
                          "resolvedUrl":final,"resolvedDomain":domain(final),"httpStatus":status,
                          "verification":"resolved-official-source","signals":signals,
                          "action":"VERIFY_AND_REVIEW","discoveredAt":datetime.now(timezone.utc).isoformat(),
                          "executionGate":"OWNER_APPROVAL_REQUIRED"})
    out={"guard":"ANIL X Immortal Guard","engine":"Official Source Discovery","version":"16.0",
         "updatedAt":datetime.now(timezone.utc).isoformat(),"count":len(items),"items":items,
         "policy":"Official-source discovery only; no automatic signing, KYC/CAPTCHA bypass or transfer."}
    (ROOT/"guard-official-discovery.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"officialCandidates":len(items)}))
if __name__=="__main__": main()
