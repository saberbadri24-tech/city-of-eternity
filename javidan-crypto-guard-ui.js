/* ANIL X — Javidan Opportunity admin adapter v2 */
(()=>{"use strict";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function boot(){
 const toggle=document.querySelector("#guardToggle"),panel=document.querySelector("#guardPanel"),grid=document.querySelector("#guardGrid"),status=document.querySelector("#status");
 if(!toggle||!panel||!grid)return;
 toggle.addEventListener("click",()=>panel.classList.toggle("open"));
 const box=document.createElement("div");box.className="guard-item";
 box.innerHTML="<b>🛡️ شکار فرصت‌های جاویدان</b><p>داده واقعی عمومی از بازار و پروتکل‌ها؛ اول کشف و ارزیابی، بعد تأیید مالک.</p>";
 const addr=document.createElement("input");addr.type="text";addr.inputMode="text";addr.autocomplete="off";addr.placeholder="آدرس عمومی EVM (اختیاری)";addr.dir="ltr";addr.style.cssText="width:100%;margin:8px 0;padding:10px;border-radius:8px;border:1px solid #3a3325;background:#111;color:#eee";box.appendChild(addr); const walletBtn=document.createElement("button");walletBtn.className="approve";walletBtn.type="button";walletBtn.textContent="بررسی کیف پول (فقط خواندنی)"; const btn=document.createElement("button");btn.className="approve";btn.type="button";btn.textContent="جستجوی فرصت‌ها";
 const out=document.createElement("div");out.style.cssText="margin-top:12px;color:#c8ced8;font-size:13px;line-height:1.8";
 box.append(walletBtn,btn,out);grid.prepend(box);
 let busy=false;
 walletBtn.addEventListener("click",async()=>{
  const address=addr.value.trim();
  if(!address){out.textContent="آدرس عمومی را وارد کن؛ Seed و Private Key هرگز وارد نمی‌شوند.";return}
  walletBtn.disabled=true; walletBtn.textContent="در حال بررسی…";
  try{
   const data=await window.JavidanOpportunityEngine.scanWallet(address);
   out.innerHTML="<b>بررسی فقط‌خواندنی انجام شد</b><br>"+data.chains.map(x=>"<div style='padding:6px 0'>"+esc(x.name)+" · "+(x.error?"خطا":"فعال")+" · nonce: "+(x.nonce??"-")+"</div>").join("");
  }catch(e){out.textContent="بررسی انجام نشد: "+esc(e.message||e)}
  finally{walletBtn.disabled=false;walletBtn.textContent="بررسی کیف پول (فقط خواندنی)"}
 });
 btn.addEventListener("click",async()=>{
  if(busy)return;busy=true;btn.disabled=true;btn.textContent="در حال شکار…";out.textContent="در حال بررسی منابع واقعی…";
  try{
   if(!window.JavidanOpportunityEngine)throw new Error("opportunity_engine_missing");
   const data=window.JavidanOpportunityEngine.safeSummary(await window.JavidanOpportunityEngine.scan());
   const selfTest=window.JavidanGuardSelfTest?.run?.();
   const rows=data.opportunities||[];
   if(!rows.length){out.textContent="در این اسکن فرصت قابل‌ارزیابی پیدا نشد.";return}
   out.innerHTML="<div style='margin-bottom:10px'>منابع: "+(data.sources.defiLlama?"DefiLlama ✓ ":"")+" "+(data.sources.coinGecko?"CoinGecko ✓":"")+"</div>"+
    rows.map((x,i)=>{
      const isYield=x.type==="defi_yield"; const isAirdrop=x.type==="airdrop";
      const risk=isYield?" · ریسک: "+x.riskScore+"/100":(isAirdrop?" · "+(x.officialVerified?"دامنه رسمی تأیید شد":"دامنه رسمی تأیید نشد"):"");
      const val=isYield?" · APY: "+x.apy+"% · TVL: $"+Math.round(x.tvlUsd).toLocaleString():(isAirdrop?" · وضعیت: "+x.action:" · تغییر ۲۴س: "+Number(x.change24h||0).toFixed(2)+"%");
      const link=x.url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'" style="color:#d9c48a">بررسی منبع رسمی</a>':"منبع مستقیم موجود نیست";
      return "<div style='padding:9px 0;border-bottom:1px solid #292216'><b>"+(i+1)+". "+esc(x.title)+"</b><br>امتیاز: "+x.score+val+risk+"<br><span style='color:#8f99a9'>"+esc(x.reason)+"</span><br>"+link+"</div>"
    }).join("");
   if(status)status.textContent="گارد جاویدان: فرصت‌ها پیدا شدند · تست امنیت: "+(selfTest?.ok?"✓":"خطا");
  }catch(e){out.textContent="جستجو انجام نشد: "+String(e&&e.message||e);if(status)status.textContent="گارد جاویدان: خطا"}
  finally{busy=false;btn.disabled=false;btn.textContent="جستجوی دوباره"}
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();