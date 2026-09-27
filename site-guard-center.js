(()=>{'use strict';
const $=s=>document.querySelector(s);
const LIVE='https://saberbadri24-tech.github.io/immortal-guard/data/opportunities.json';
const fa=n=>String(n??0).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function j(url){const r=await fetch(url+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(url);return r.json()}
async function load(){const root=$('#axGuardCenter');if(!root)return;try{
 const o=await j(LIVE),items=Array.isArray(o.items)?o.items:[],verified=items.filter(x=>['ALLOW','VERIFIED'].includes(String(x.action||x.status||'').toUpperCase())&&Number(x.score||0)>=70),eligible=verified;
 const rows=verified.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,6);
 $('#axGuardMetrics').innerHTML=[['کاندید رادار',o.count??items.length],['بررسی‌شده',items.filter(x=>x.evidence||x.securityGate).length],['هم‌راستا',eligible.length],['صف مالک',items.filter(x=>String(x.action||'').toUpperCase()==='REVIEW').length]].map(x=>'<div><b>'+fa(x[1])+'</b><small>'+x[0]+'</small></div>').join('');
 $('#axGuardAI').innerHTML='<span class="ok">Guard Radar LIVE</span> · <span class="warn">داده زنده از Immortal Guard X</span>';
 $('#axGuardOpps').innerHTML=rows.map((x,i)=>'<article><b>'+fa(i+1)+'. '+esc(x.title||x.name||'فرصت')+'</b><small>امتیاز '+fa(x.score||0)+' · '+esc(x.domain||x.publisher||'منبع')+' · '+esc(x.action||x.status||'REVIEW')+'</small><a href="'+esc(x.officialUrl||x.resolvedUrl||x.url||'#')+'" target="_blank" rel="noopener noreferrer">منبع ↗</a></article>').join('')||'<p>فعلاً فرصت رسمیِ تأییدشده با شواهد کافی ثبت نشده است.</p>';
 $('#axGuardState').textContent='آخرین داده Guard: '+String(o.updatedAt||'نامشخص')+' · بدون claim، امضا یا انتقال خودکار.';
}catch(e){$('#axGuardState').textContent='فید زنده Guard فعلاً در دسترس نیست؛ داشبورد مستقل Guard را باز کن.'}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();setInterval(load,60000);
})();