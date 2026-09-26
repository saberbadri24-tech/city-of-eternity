(()=>{'use strict';
const API='https://city-of-eternity.onrender.com';
const services=[
{id:'website',name:'AI Website Build',description:'ساخت سایت حرفه‌ای',price:149},
{id:'teaser',name:'Marketing Teaser',description:'تیزر تبلیغاتی',price:49},
{id:'fix',name:'Website Fix',description:'رفع خطا و بهینه‌سازی',price:39},
{id:'growth',name:'Growth & SEO',description:'رشد و SEO',price:79},
{id:'automation',name:'Business Automation',description:'خودکارسازی فرایند',price:99},
{id:'ai-agent',name:'AI Agent Integration',description:'اتصال AI Agent',price:129}
];
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>'$'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
async function get(path,opts={}){const r=await fetch(API+path,{...opts,headers:{'content-type':'application/json',...(opts.headers||{})},credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));return d}
async function load(){
 $('#services').innerHTML=services.map(x=>'<div class="service"><div><b>'+esc(x.name)+' · '+money(x.price)+'</b><p>'+esc(x.description)+'</p></div><button class="btn" data-service="'+x.id+'">سفارش</button></div>').join('');
 document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>startOrder(b.dataset.service));
 try{
  const d=await get('/api/free-admin'); const rows=d.requests||[];
  $('#leads').textContent=rows.length;
  const approved=rows.filter(x=>x.status==='approved').length;
  $('#orders').textContent=approved;
  $('#status').textContent='سرنخ‌های واقعی ورودی: '+rows.length+' · تأییدشده: '+approved;
 }catch(e){$('#status').textContent='برای آمار کامل، ورود مدیر لازم است.'}
}
async function startOrder(service){
 const s=services.find(x=>x.id===service); if(!s)return;
 const name=prompt('نام / شرکت:'); if(!name)return;
 const email=prompt('ایمیل واقعی مشتری:'); if(!email)return;
 const description=prompt('نیاز دقیق مشتری:'); if(!description)return;
 try{
  const lead=await get('/api/free-request',{method:'POST',body:JSON.stringify({name,email,country:'International',request:description})});
  if(!lead.ok)throw Error(lead.error||'lead_error');
  const order=await get('/api/order',{method:'POST',body:JSON.stringify({accountId:'web-'+lead.id,service:s.id,description:description+' | Lead: '+lead.id,currency:'USD',amount:s.price})});
  if(!order.ok)throw Error(order.error||'order_error');
  location.href='payment.html?order='+encodeURIComponent(order.order.id)+'&amount='+encodeURIComponent(Math.round(s.price*1000))+'&ton=0';
 }catch(e){$('#status').textContent='سفارش ثبت نشد: '+e.message}
}
$('#run').onclick=async()=>{const b=$('#run');b.disabled=true;$('#status').textContent='در حال پردازش سرنخ‌ها و سفارش‌های واقعی…';try{const d=await get('/api/free-admin');const rows=d.requests||[];const qualified=rows.filter(x=>x.status==='approved');$('#status').textContent='پردازش انجام شد. سرنخ واقعی: '+rows.length+' · تأییدشده: '+qualified.length+'. ارسال خودکار تبلیغاتی انجام نمی‌شود.';await load()}catch(e){$('#status').textContent='نیاز به ورود مدیر: '+e.message}finally{b.disabled=false}};
$('#refresh').onclick=load;load();
})();