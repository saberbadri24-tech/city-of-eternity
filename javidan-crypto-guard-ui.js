/* ANIL X — Javidan admin adapter */
(()=>{"use strict";
function boot(){
  const toggle=document.querySelector("#guardToggle"),panel=document.querySelector("#guardPanel"),grid=document.querySelector("#guardGrid"),status=document.querySelector("#status");
  if(!toggle||!panel||!grid||!window.JavidanCryptoGuard)return;
  toggle.addEventListener("click",()=>panel.classList.toggle("open"));
  const box=document.createElement("div");box.className="guard-item";box.innerHTML="<b>🔎 کشف رمزارز</b><p>فقط داده بازار عمومی؛ بدون معامله و بدون دریافت کلید خصوصی.</p>";
  const btn=document.createElement("button");btn.className="approve";btn.type="button";btn.textContent="اسکن بازار";
  const out=document.createElement("div");out.style.cssText="margin-top:12px;color:#c8ced8;font-size:13px;line-height:1.8";
  box.append(btn,out);grid.prepend(box);
  let busy=false;
  btn.addEventListener("click",async()=>{
    if(busy)return;busy=true;btn.disabled=true;btn.textContent="در حال بررسی…";out.textContent="در حال دریافت داده بازار…";
    try{
      const result=await window.JavidanCryptoGuard.scan();
      const summary=window.JavidanCryptoGuard.safeSummary(result);
      if(!summary.candidates.length){out.textContent="موردی که از فیلترهای گارد عبور کند پیدا نشد.";return}
      out.innerHTML=summary.candidates.map((x,i)=>"<div style='padding:7px 0;border-bottom:1px solid #292216'><b>"+(i+1)+". "+esc(x.name)+" ("+esc(x.symbol)+")</b><br>امتیاز گارد: "+x.score+" · رتبه: "+x.rank+" · حجم ۲۴س: $"+Math.round(x.volume24hUsd).toLocaleString()+" · تغییر ۲۴س: "+Number(x.change24hPct||0).toFixed(2)+"%</div>").join("");
      if(summary.stale)out.insertAdjacentHTML("afterbegin","<div>⚠️ منبع لحظه‌ای در دسترس نبود؛ داده ذخیره‌شده نمایش داده شد.</div>");
      if(status)status.textContent="گارد جاویدان: اسکن انجام شد";
    }catch(e){out.textContent="اسکن انجام نشد: "+String(e&&e.message||e);if(status)status.textContent="گارد جاویدان: خطا در منبع داده"}
    finally{busy=false;btn.disabled=false;btn.textContent="اسکن دوباره"}
  });
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();