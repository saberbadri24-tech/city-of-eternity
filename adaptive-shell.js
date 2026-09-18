(()=>{'use strict';
const KEY='anilx_session_v1';
const safe=(f,d)=>{try{return f()}catch{return d}};
const state=safe(()=>JSON.parse(localStorage.getItem(KEY)||'{}'),{});
const save=()=>safe(()=>localStorage.setItem(KEY,JSON.stringify(state)),null);
const composer=()=>document.querySelector('#requestInput')||document.querySelector('#q');
const setRequest=(v)=>{const el=composer();if(!el)return false;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();return true};
const examples=[
 ['ساخت سایت','می‌خواهم یک سایت حرفه‌ای برای کسب‌وکارم بسازم'],
 ['رفع مشکل','سایتم مشکل دارد؛ بررسی و راه‌حل بده'],
 ['رشد کسب‌وکار','می‌خواهم مشتری و فروش بیشتری بگیرم'],
 ['ساخت تیزر','برای محصولم یک تیزر حرفه‌ای می‌خواهم'],
 ['کشف ANIL X','می‌خواهم دنیای مخفی ANIL X را کشف کنم']
];
function inject(){
 if(document.querySelector('#axAdaptiveShell'))return;
 const input=composer(); if(!input)return;
 const shell=document.createElement('div');shell.id='axAdaptiveShell';
 shell.innerHTML='<div class="ax-examples-title">از نتیجه شروع کن</div><div class="ax-examples"></div><div class="ax-resume" hidden></div><button class="ax-guest" type="button">ورود مهم نیست؛ اول امتحان کن</button>';
 const list=shell.querySelector('.ax-examples');
 examples.forEach(([label,value])=>{const b=document.createElement('button');b.type='button';b.dataset.value=value;b.textContent=label;list.appendChild(b)});
 input.parentNode.insertBefore(shell,input.nextSibling);
 shell.addEventListener('click',e=>{
  const v=e.target.dataset.value;
  if(v){setRequest(v);state.lastRequest=v;state.lastSeen=Date.now();save();return}
  if(e.target.classList.contains('ax-guest')){state.guest=true;state.lastSeen=Date.now();save();e.target.textContent='حالت مهمان فعال است · بدون کیف پول';document.documentElement.dataset.axGuest='true'}
 });
 const last=state.lastRequest;
 if(last){const r=shell.querySelector('.ax-resume');r.hidden=false;r.innerHTML='<button type="button" class="ax-resume-btn">ادامه: '+String(last).slice(0,90)+'</button>';r.onclick=()=>setRequest(last)}
 if(state.guest)document.documentElement.dataset.axGuest='true';
}
function css(){
 if(document.querySelector('#axAdaptiveStyle'))return;
 const s=document.createElement('style');s.id='axAdaptiveStyle';s.textContent=
 '#axAdaptiveShell{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:10px 0 0;padding:8px 0}'+
 '#axAdaptiveShell .ax-examples-title{width:100%;font-size:11px;letter-spacing:.08em;opacity:.7}'+
 '#axAdaptiveShell .ax-examples{display:flex;flex-wrap:wrap;gap:7px}'+
 '#axAdaptiveShell button{font:inherit;border:1px solid rgba(216,173,79,.24);background:rgba(216,173,79,.045);color:inherit;border-radius:999px;padding:8px 11px;cursor:pointer}'+
 '#axAdaptiveShell .ax-guest{margin-inline-start:auto}'+
 '#axAdaptiveShell .ax-resume{width:100%;opacity:.85}'+
 '[data-ax-guest="true"] #ton-connect{opacity:.7}'+
 '@media(max-width:600px){#axAdaptiveShell .ax-guest{width:100%;margin-inline-start:0}.ax-examples{overflow:auto;flex-wrap:nowrap!important;max-width:100%}}';
 document.head.appendChild(s);
}
function boot(){css();inject()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();