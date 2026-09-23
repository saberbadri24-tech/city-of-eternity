import datetime as dt
import json, os, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "guard-receipts.json"
WALLET = ROOT / "guard-wallet.json"
NOW = dt.datetime.now(dt.timezone.utc).isoformat()

def load(path, default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception: return default

def main():
    wallet = load(WALLET, {})
    address = (wallet.get("temporaryWalletAddress") or "").strip()
    old = load(OUT, {"version":"1.0","address":address,"items":[]})
    if not address:
        old.update({"updatedAt":NOW,"status":"WAITING_FOR_TEMP_WALLET"})
        OUT.write_text(json.dumps(old,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        return
    params = urllib.parse.urlencode({"account":address,"limit":50,"sort":"desc"})
    url = "https://toncenter.com/api/v3/transactions?" + params
    req = urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"ANIL-X-Immortal-Guard/8.0"})
    key = os.getenv("TONCENTER_API_KEY", "")
    if key: req.add_header("X-API-Key", key)
    try:
        with urllib.request.urlopen(req,timeout=20) as res: data=json.loads(res.read().decode("utf-8","ignore"))
        txs = data.get("transactions",[])
        seen={x.get("hash") for x in old.get("items",[]) if x.get("hash")}
        for tx in txs:
            h=tx.get("hash")
            if not h or h in seen: continue
            msg=tx.get("in_msg") or {}
            dest=msg.get("destination") or ""
            incoming = (dest == address) or bool(msg.get("source"))
            if not incoming: continue
            old.setdefault("items",[]).append({
                "hash":h,"lt":tx.get("lt"),"utime":tx.get("utime"),
                "destination":dest,"source":msg.get("source"),
                "valueNanoTON":msg.get("value"),"verifiedOnChain":True,
                "observedAt":NOW,"status":"RECEIVED_TEMP"})
        old["items"]=old.get("items",[])[-1000:]
        old.update({"version":"1.0","address":address,"updatedAt":NOW,"status":"OK","provider":"TON Center v3"})
    except Exception as exc:
        old.update({"version":"1.0","address":address,"updatedAt":NOW,"status":"PROVIDER_ERROR","errorType":type(exc).__name__})
    OUT.write_text(json.dumps(old,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":old.get("status"),"receipts":len(old.get("items",[]))},ensure_ascii=False))

if __name__ == "__main__": main()