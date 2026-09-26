(()=>{'use strict';
const API=window.ANILX_API_URL||'https://city-of-eternity.onrender.com';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function get(path,opts={}){const r=await fetch(API+path,{...opts,headers:{'content-type':'application/json',...(opts.headers||{})},credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));return d}
function money(n){return '$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})}
async function load(){
 try{const d=await get('/api/revenue/summary');$('#leads').textContent=d.counts.leads;$('#orders').textContent=d.counts.orders;$('#paid').textContent=d.counts.paid;$('#revenue').textContent=money(d.revenue)}catch(e){$('#status').textContent='خلاصه فعلاً قابل دریافت نیست: '+e.message}
 try{const d=await get('/api/revenue/catalog');$('#services').innerHTML=(d.services||[]).map(x=>'<div class="service"><div><b>'+esc(x.name)+'</b><p>'+esc(x.description)+'</p></div><button class="btn" data-service="'+esc(x.id)+'">شروع سفارش</button></div>').join('');document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>startOrder(b.dataset.service))}catch(e){$('#services').innerHTML='<div class="status">کاتالوگ قابل دریافت نیست.</div>'}
}
async function startOrder(service){const description=prompt('شرح کوتاه نیاز مشتری:');if(!description)return;try{const d=await get('/api/order',{method:'POST',body:JSON.stringify({accountId:'public',service,description,currency:'USD',amount:0})});location.href='payment.html?order='+encodeURIComponent(d.order.id)}catch(e){$('#status').textContent='ساخت سفارش انجام نشد: '+e.message}}
$('#run').onclick=async()=>{const b=$('#run');b.disabled=true;$('#status').textContent='چرخه درآمد در حال اجرا…';try{const d=await get('/api/revenue/run',{method:'POST',body:'{}'});$('#status').textContent=d.message||'چرخه اجرا شد.';await load()}catch(e){$('#status').textContent='چرخه متوقف شد: '+e.message}finally{b.disabled=false}};
$('#refresh').onclick=load;load();
})();