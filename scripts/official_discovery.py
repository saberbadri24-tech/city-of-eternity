import json, re, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
UA="ANIL-X-Immortal-Guard/17.0-Official"
KEYS=("airdrop","claim","reward","bounty","grant","incentive","distribution","quest","learn","earn","bug bounty","campaign")
MAX_LINKS_PER_SOURCE=8
MAX_BODY=350000
def fetch(url):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html,*/*;q=0.8"})
        with urllib.request.urlopen(req,timeout=12) as r:
            return r.geturl(),r.read(MAX_BODY).decode("utf-8","ignore"),r.status
    except Exception:
        return url,"",None
def domain(url):
    return urllib.parse.urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
def normalize(base,href):
    try:
        u=urllib.parse.urljoin(base,href)
        p=urllib.parse.urlparse(u)
        if p.scheme!="https" or not p.netloc:return None
        return urllib.parse.urlunparse((p.scheme,p.netloc,p.path or "/",p.params,p.query,""))
    except Exception:return None
def links(base,body):
    out=[]
    seen=set()
    for href,anchor in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',body,re.I|re.S):
        u=normalize(base,href)
        if not u or domain(u)!=domain(base) or u in seen:continue
        label=re.sub(r"<[^>]+>"," ",anchor).strip().lower()
        blob=(label+" "+u.lower())
        if not any(k in blob for k in KEYS):continue
        seen.add(u);out.append((u,label[:180]))
        if len(out)>=MAX_LINKS_PER_SOURCE:break
    return out
def candidate(name,url,publisher,status,signals,kind="source"):
    return {"title":name,"url":url,"publisher":publisher,"resolvedUrl":url,"resolvedDomain":domain(url),
            "httpStatus":status,"verification":"resolved-official-source","signals":signals,
            "candidateType":kind,"action":"VERIFY_AND_REVIEW",
            "discoveredAt":datetime.now(timezone.utc).isoformat(),
            "executionGate":"OWNER_APPROVAL_REQUIRED"}
def main():
    src=json.loads((ROOT/"guard-sources.json").read_text(encoding="utf-8"))
    items=[];seen=set();source_stats=[]
    for s in src.get("sources",[]):
        root=s.get("url","")
        if not root.startswith("https://"):continue
        final,body,status=fetch(root)
        if not body:
            source_stats.append({"source":s.get("name",""),"status":"unreachable","linksInspected":0});continue
        text=re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",body)).strip()
        low=text.lower();signals=[k for k in KEYS if k in low]
        if signals:
            x=candidate(s.get("name","Official source"),final,s.get("name",""),status,signals,"source")
            key=final.lower()
            if key not in seen:seen.add(key);items.append(x)
        child_links=links(final,body)
        inspected=0
        for child,label in child_links:
            cfinal,cbody,cstatus=fetch(child);inspected+=1
            if not cbody or cstatus is None:continue
            ctext=re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",cbody)).strip();clow=ctext.lower()
            cs=[k for k in KEYS if k in clow]
            if not cs:continue
            title=(label or child).strip()[:180]
            key=cfinal.lower()
            if key in seen:continue
            seen.add(key)
            items.append(candidate(title,cfinal,s.get("name",""),cstatus,cs,"linked-official-page"))
        source_stats.append({"source":s.get("name",""),"status":"ok","linksInspected":inspected,"rootSignals":len(signals)})
    # Keep the freshest and most directly relevant candidates; duplicates are already removed by canonical URL.
    items=sorted(items,key=lambda x:(x.get("candidateType")!="linked-official-page", -len(x.get("signals",[]))))[:2000]
    out={"guard":"ANIL X Immortal Guard","engine":"Official Source Discovery","version":"17.0",
         "updatedAt":datetime.now(timezone.utc).isoformat(),"count":len(items),"items":items,
         "crawl":{"sameDomainOnly":True,"maxLinksPerSource":MAX_LINKS_PER_SOURCE,"sources":len(source_stats),
                  "pagesDiscovered":len(items)},
         "sourceStats":source_stats,
         "policy":"Official-source discovery only; linked pages are restricted to the same verified domain; no automatic signing, KYC/CAPTCHA bypass or transfer."}
    (ROOT/"guard-official-discovery.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"officialCandidates":len(items),"sources":len(source_stats)}))
if __name__=="__main__": main()
