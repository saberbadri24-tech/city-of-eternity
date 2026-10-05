(()=>{'use strict';
const API='';
const services=[
{id:'website',name:'AI Website Build',description:'ساخت سایت حرفه‌ای',price:79},
{id:'teaser',name:'Marketing Teaser',description:'تیزر تبلیغاتی',price:29},
{id:'fix',name:'Website Fix',description:'رفع خطا و بهینه‌سازی',price:19},
{id:'growth',name:'Growth & SEO',description:'رشد و SEO',price:199},
{id:'automation',name:'Business Automation',description:'خودکارسازی فرایند',price:79},
{id:'ai-agent',name:'AI Agent Integration',description:'اتصال AI Agent',price:199}
];
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>'$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
async function get(path,opts={}){const r=await fetch(API+path,{...opts,headers:{'content-type':'application/json',...(opts.headers||{})},credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));return d}
function fleetState(x){return x.status==='ACTIVE'?'🟢 قابل‌اجرا':x.status==='OWNER_GATED'?'🟡 مالک‌محور':x.status.endsWith('REQUIRED')?'🟠 پیش‌نیاز خارجی':'🔵 آماده‌سازی'}
function renderFleet(items){const box=$('#fleet');if(!box)return;box.innerHTML=(items||[]).map(x=>'<div class="service"><div><b>'+esc(x.name)+'</b><p>'+esc(x.monetization)+' · '+esc(x.prereq)+'</p></div><span>'+fleetState(x)+'</span></div>').join('')}
function programState(x){const s=x?.status||'READY';return s==='LIVE'?'🟢 فعال':s==='OWNER_GATED'?'🟡 تأیید مالک':s==='READY_ACCOUNT'?'🟠 نیازمند حساب':s==='READY_PARTNER'?'🟠 نیازمند برنامه شریک':s==='READY_ASSET'?'🟠 نیازمند محصول واقعی':s==='READY_PRODUCT'?'🟠 نیازمند محصول/API':'🔵 آماده راه‌اندازی'}
function renderPrograms(items){const box=$('#programs');if(!box)return;box.innerHTML=(items||[]).map(x=>'<div class="service"><div><b>'+esc(x.name)+'</b><p>'+esc(x.description||'')+' · '+esc(x.paymentRoute||'')+'</p></div><span>'+programState(x)+'</span></div>').join('')}
async function load(){
 try{
  const e=await get('/api/revenue/engines');$('#engines').innerHTML=(e.engines||[]).map(x=>'<div class="service"><div><b>'+esc(x.name)+'</b><p>'+esc(x.mode||'')+'</p></div><span>'+((x.active)?'🟢 فعال':'⚪ متوقف')+'</span></div>').join('');
 }catch(e){$('#engines').innerHTML='<div class="status">وضعیت موتورهای زنده فعلاً قابل دریافت نیست.</div>'}
 try{const f=await get('/api/revenue/fleet');renderFleet(f.engines||[]);const p=await get('/api/revenue/programs');renderPrograms(p.programs||[]);const w=p.walletRouting||{};$('#status').textContent='مسیر تسویه: '+(w.varizaConfigured?'واریزا آماده':'واریزا تنظیم نشده')+' · TON: '+(w.tonConfigured?'متصل به مقصد تنظیم‌شده':'مقصد TON تنظیم نشده');}catch(e){renderPrograms([])}
 $('#services').innerHTML=services.map(x=>'<div class="service"><div><b>'+esc(x.name)+' · '+money(x.price)+'</b><p>'+esc(x.description)+'</p></div><button class="btn" data-service="'+x.id+'">سفارش</button></div>').join('');
 document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>startOrder(b.dataset.service));
 try{
  const d=await get('/api/revenue/summary');
  $('#leads').textContent=d.counts?.leads||0;
  $('#orders').textContent=d.counts?.orders||0;
  $('#paid').textContent=d.counts?.paid||0;
  $('#revenue').textContent=money(d.revenue||0);
  $('#status').textContent+=' · سرنخ '+(d.counts?.leads||0)+' · سفارش '+(d.counts?.orders||0)+' · پرداخت واقعی '+(d.counts?.paid||0);
 }catch(e){$('#status').textContent+=' · آمار کامل فعلاً در دسترس نیست.'}
}
async function startOrder(service){
 const s=services.find(x=>x.id===service); if(!s)return;
 const name=prompt('نام / شرکت:'); if(!name)return;
 const email=prompt('ایمیل واقعی مشتری:'); if(!email)return;
 const description=prompt('نیاز دقیق مشتری:'); if(!description)return;
 try{
  const lead=await get('/api/revenue/hunt',{method:'POST',body:JSON.stringify({email,country:'International',market:'International',request:description,source:'revenue-engine'})});
  if(!lead.ok)throw Error(lead.error||'lead_error');
  const checkout=await get('/api/revenue/checkout',{method:'POST',body:JSON.stringify({leadId:lead.lead.id,email,service:s.id,description})});
  if(!checkout.ok)throw Error(checkout.error||'checkout_error');
  if(checkout.payment?.ready&&checkout.payment?.payUrl){location.href=checkout.payment.payUrl;return}
  const reason=checkout.payment?.error||'payment_not_ready';
  throw Error(reason==='payment_not_configured'?'پرداخت واقعی هنوز پیکربندی نشده است':reason==='fx_unavailable'?'نرخ USD/تومان برای پرداخت واقعی تنظیم نشده است':reason==='storage_unavailable'?'ذخیره‌سازی پایدار سفارش تنظیم نشده است':reason);
 }catch(e){$('#status').textContent='سفارش ثبت نشد: '+e.message}
}
$('#run').onclick=async()=>{const b=$('#run');b.disabled=true;$('#status').textContent='چرخه خودکار درآمد در حال اجراست…';try{const d=await get('/api/revenue/fleet/run',{method:'POST'});$('#status').textContent='چرخه اجرا شد · ارتقا: '+(d.promoted||0)+' · واجدشرایط: '+(d.qualified||0)+' · پیشنهاد: '+(d.offers||0);await load()}catch(e){$('#status').textContent='چرخه اجرا نشد: '+e.message}finally{b.disabled=false}};
$('#refresh').onclick=load;load();
})();