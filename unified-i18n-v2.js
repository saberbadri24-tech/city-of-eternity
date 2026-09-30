(()=>{'use strict';
const LANGS={
 en:['English','ltr'],fa:['فارسی','rtl'],ar:['العربية','rtl'],tr:['Türkçe','ltr'],ru:['Русский','ltr'],de:['Deutsch','ltr'],fr:['Français','ltr'],es:['Español','ltr'],pt:['Português','ltr'],it:['Italiano','ltr'],hi:['हिन्दी','ltr'],ur:['اردو','rtl'],'zh-CN':['中文','ltr'],ja:['日本語','ltr'],ko:['한국어','ltr'],id:['Bahasa Indonesia','ltr'],nl:['Nederlands','ltr'],pl:['Polski','ltr']};
const KEY='anilx-language-v2',CACHE='anilx-i18n-cache-v2';
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const get=()=>{const q=new URLSearchParams(location.search).get('lang');if(q&&LANGS[q])return q;const saved=localStorage.getItem(KEY);if(saved&&LANGS[saved])return saved;const browser=(navigator.language||'en').toLowerCase();const hit=Object.keys(LANGS).find(x=>browser===x.toLowerCase()||browser.startsWith(x.toLowerCase()+'-'));return hit||'en'};
let lang=get();window.ANILX_LANGUAGE=lang;
const original=new Map(),cache=(()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'{}')}catch{return {}}})();
function setup(){
 document.documentElement.lang=lang;document.documentElement.dir=LANGS[lang][1];
 if(document.querySelector('#axLanguage'))return;
 const host=document.querySelector('.nav-right');if(!host)return;
 const box=document.createElement('label');box.id='axLanguage';box.style.cssText='display:inline-flex;align-items:center;gap:5px;margin-inline:4px';
 box.innerHTML='<span style="font-size:12px;opacity:.7">🌐</span><select aria-label="Language" style="border:1px solid rgba(216,173,79,.3);background:#0c0906;color:#ffe7ad;border-radius:999px;padding:7px 10px;font:inherit;max-width:145px">'+Object.entries(LANGS).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v[0])+'</option>').join('')+'</select>';
 host.prepend(box);box.querySelector('select').value=lang;box.querySelector('select').addEventListener('change',e=>switchLang(e.target.value));
}
function nodes(){
 const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){
  const p=n.parentElement;if(!p||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION|CODE)$/.test(p.tagName))return NodeFilter.FILTER_REJECT;
  const t=n.nodeValue.trim();if(t.length<2||/^([←→·•|/]+)$/.test(t))return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_ACCEPT;
 }});while(w.nextNode())out.push(w.currentNode);return out;
}
function remember(){
 nodes().forEach(n=>{if(!original.has(n))original.set(n,n.nodeValue)});
 document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(n=>{if(!original.has(n))original.set(n,n.getAttribute('placeholder')||'')});
}
async function translateBatch(items,target){
 const joined=items.map((x,i)=>'[[AX'+i+']] '+x).join('\n');
 const r=await fetch('/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:joined,target}),cache:'no-store'});
 const d=await r.json();if(!d.ok)return items;
 const lines=String(d.text||'').split(/\n/),out=new Array(items.length).fill('');
 for(let i=0;i<items.length;i++){const marker='[[AX'+i+']]';const line=lines.find(x=>x.includes(marker));if(line)out[i]=line.slice(line.indexOf(marker)+marker.length).trim()}
 return out.map((x,i)=>x||items[i]);
}
async function apply(target){
 remember();
 for(const n of nodes())n.nodeValue=original.get(n)||n.nodeValue;
 document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(n=>n.setAttribute('placeholder',original.get(n)||n.getAttribute('placeholder')||''));
 if(target==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr';window.ANILX_LANGUAGE='en';return}
 const ns=nodes(),items=ns.map(n=>(original.get(n)||n.nodeValue).trim()).filter(Boolean);
 const unique=[...new Set(items)],translated={};
 for(let i=0;i<unique.length;i+=10){const part=unique.slice(i,i+10);const key=target+'|'+part.join('\n');if(cache[key]){part.forEach((x,j)=>translated[x]=cache[key].split('\n')[j]||x);continue}
  try{const got=await translateBatch(part,target);got.forEach((x,j)=>translated[part[j]]=x);cache[key]=got.join('\n');localStorage.setItem(CACHE,JSON.stringify(cache));}catch{part.forEach(x=>translated[x]=x)}
 }
 ns.forEach(n=>{const t=(original.get(n)||n.nodeValue).trim();if(translated[t])n.nodeValue=n.nodeValue.replace(t,translated[t])});
 document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(async n=>{const t=original.get(n)||'';if(!t)return;try{const got=await translateBatch([t],target);n.setAttribute('placeholder',got[0]||t)}catch{}});
 document.documentElement.lang=target;document.documentElement.dir=LANGS[target][1];window.ANILX_LANGUAGE=target;
}
async function switchLang(next){if(!LANGS[next])return;lang=next;localStorage.setItem(KEY,next);const u=new URL(location.href);u.searchParams.set('lang',next);history.replaceState({},'',u);setup();await apply(next);window.dispatchEvent(new CustomEvent('anilx:language',{detail:{language:next}}))}
function boot(){setup();if(lang!=='en')apply(lang);else{remember();document.documentElement.lang='en';document.documentElement.dir='ltr'}window.ANILX_LANGUAGE=lang}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();