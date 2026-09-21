/* ANIL X — Javidan persistent approval queue UI v1 */
(()=>{"use strict";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){
 const grid=document.querySelector("#approvalGrid"),E=window.JavidanOpportunityEngine;
 if(!grid||!E)return;
 const q=E.queueList();
 grid.innerHTML="<div class='guard-item' style='grid-column:1/-1'><b>📌 صف تأیید پایدار</b><p>موارد تا زمان انقضا باقی می‌مانند؛ بدون امضای خودکار. وضعیت فقط در همین مرورگر ذخیره می‌شود.</p>"+(q.length?q.map(x=>{
   const expired=x.status==="EXPIRED",ready=x.status==="READY_FOR_USER_REVIEW";
   return "<div style='border-top:1px solid #292216;padding:10px 0;margin-top:8px'><b>"+esc(x.title)+"</b><br><span style='color:#929aaa'>"+esc(x.status)+" · امتیاز "+esc(x.score)+"</span>"+
   (x.officialUrl?"<br><a target='_blank' rel='noopener noreferrer' href='"+esc(x.officialUrl)+"' style='color:#d9c48a'>منبع رسمی</a>":"")+
   (expired?"<br><span style='color:#e0a070'>مهلت تمام شده</span>":(ready?"<br><span style='color:#9ce0b4'>آماده بررسی مالک</span>":"<button class='approve' data-qready='"+esc(x.id)+"' style='margin-top:8px'>بازبینی مجدد</button>"))+
   "<button class='approve stop' data-qremove='"+esc(x.id)+"' style='margin-top:8px'>حذف از صف</button></div>";
 }).join(""):"<div style='color:#929aaa'>صف خالی است.</div>")+"</div>";
 grid.querySelectorAll("[data-qready]").forEach(b=>b.addEventListener("click",()=>{
   try{E.queuePrepare(b.dataset.qready);render()}catch(e){alert("بازبینی انجام نشد: "+(e.message||e))}
 }));
 grid.querySelectorAll("[data-qremove]").forEach(b=>b.addEventListener("click",()=>{E.queueRemove(b.dataset.qremove);render()}));
}
document.addEventListener("javidan:scan-results",render);
setInterval(render,5000);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();