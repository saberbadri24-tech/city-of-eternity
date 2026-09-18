(()=>{'use strict';
const KEY='anilx_experience_dna_v1', DISC='anilx_discoveries_v2';
const now=()=>Date.now();
const safe=(fn,fb)=>{try{return fn()}catch{return fb}};
let dna=safe(()=>JSON.parse(localStorage.getItem(KEY)||'{}'),{});
dna.events=Array.isArray(dna.events)?dna.events.slice(-80):[];
dna.scores=dna.scores&&typeof dna.scores==='object'?dna.scores:{};
dna.prefs=dna.prefs&&typeof dna.prefs==='object'?dna.prefs:{};
const save=()=>safe(()=>localStorage.setItem(KEY,JSON.stringify(dna)),null);
const bump=(k,n=1)=>{dna.scores[k]=(dna.scores[k]||0)+n};
const record=(type,data={})=>{dna.events.push({type,t:now(),...data});if(dna.events.length>80)dna.events.shift();save()};
const infer=()=>{
 const s=dna.scores;
 const ranked=(keys)=>keys.reduce((a,k)=>a+(s[k]||0),0);
 dna.prefs.mode=ranked(['fast','direct'])>ranked(['guided','explore'])?'direct':ranked(['guided','explore'])>ranked(['fast','direct'])?'guided':'adaptive';
 dna.prefs.format=ranked(['voice','visual'])>ranked(['text'])?'rich':'text';
 dna.prefs.discovery=ranked(['puzzle','explore'])>=2;
 dna.prefs.goal=['business','create','fix','learn','discover'].sort((a,b)=>(s[b]||0)-(s[a]||0))[0]||'discover';
 save();
};
const classify=(text)=>{
 const x=String(text||'').toLowerCase();
 const hits=[];
 const add=(k,re)=>{if(re.test(x)){hits.push(k);bump(k)}};
 add('business',/فروش|مشتری|درآمد|کسب.?وکار|سئو|sales|growth|business/);
 add('create',/ساخت|طراحی|تیزر|ویدیو|سایت|فروشگاه|create|website/);
 add('fix',/خطا|ارور|خراب|مشکل|کند|fix|bug|error/);
 add('learn',/یادگیری|آموزش|یاد.?بگیر|learn|course/);
 add('voice',/صحبت|صدا|voice/);
 add('visual',/عکس|تصویر|ویدیو|نمونه|visual/);
 add('fast',/سریع|فوری|همین الان|بدون توضیح|فقط انجام/);
 add('direct',/مستقیم|برو انجام|تمومش کن|direct/);
 add('guided',/راهنمایی|قدم.?به.?قدم|توضیح|guide/);
 add('puzzle',/معما|رمز|راز|سرنخ|پازل|puzzle/);
 return hits;
};
const adapt=()=>{
 infer();
 document.documentElement.dataset.axMode=dna.prefs.mode||'adaptive';
 document.documentElement.dataset.axFormat=dna.prefs.format||'text';
 document.body.classList.toggle('ax-discovery-mode',!!dna.prefs.discovery);
 const badge=document.querySelector('#audienceBadge');
 if(badge&&dna.prefs.goal) badge.textContent='تجربه زنده · '+({business:'کسب‌وکار',create:'خلق',fix:'حل مشکل',learn:'یادگیری',discover:'کشف'}[dna.prefs.goal]||'شخصی');
};
const trackClicks=()=>{
 document.addEventListener('click',e=>{
   const el=e.target.closest('button,a,[data-request],[data-chat]');
   if(!el)return;
   const text=(el.dataset.request||el.dataset.chat||el.textContent||'').trim();
   const h=classify(text);
   if(text)record('interaction',{text:text.slice(0,120),hits:h});
   if(/معما|راز|کشف|inspect|کاوش/i.test(text))bump('puzzle'),bump('explore');
   adapt();
 },{passive:true});
};
const trackSearch=()=>{
 const input=document.querySelector('#requestInput');
 if(!input)return;
 let started=0;
 input.addEventListener('focus',()=>{started=now();record('search_focus')},{passive:true});
 input.addEventListener('input',()=>{if(input.value.trim()) classify(input.value)});
 input.addEventListener('blur',()=>{const q=input.value.trim();if(q)record('search',{q:q.slice(0,240),dwell:Math.min(now()-(started||now()),120000),hits:classify(q)});adapt()},{passive:true});
};
const personalPanel=()=>{
 if(document.querySelector('#axDNA'))return;
 const b=document.body, box=document.createElement('div');box.id='axDNA';
 box.innerHTML='<button id="axDNAOpen" type="button" aria-label="تنظیم تجربه">◈ تجربه من</button><div id="axDNAPanel" hidden><b>تجربه ANIL X</b><span id="axDNAState"></span><button data-dna="direct">مستقیم</button><button data-dna="guided">راهنما</button><button data-dna="rich">تصویری/صوتی</button><button data-dna="simple">ساده</button><button data-dna="reset">بازنشانی</button></div>';
 b.appendChild(box);
 const st=box.querySelector('#axDNAState');
 const render=()=>{st.textContent='حالت: '+(dna.prefs.mode==='direct'?'سریع و مستقیم':dna.prefs.mode==='guided'?'راهنما':'تطبیقی')+' · داده فقط روی این دستگاه'};
 box.querySelector('#axDNAOpen').onclick=()=>{const p=box.querySelector('#axDNAPanel');p.hidden=!p.hidden;render()};
 box.addEventListener('click',e=>{const v=e.target.dataset.dna;if(!v)return;
   if(v==='reset'){dna={events:[],scores:{},prefs:{}};save()}
   else if(v==='direct'){bump('direct',5);bump('fast',3)}
   else if(v==='guided'){bump('guided',5)}
   else if(v==='rich'){bump('voice',4);bump('visual',4)}
   else if(v==='simple'){bump('text',5)}
   infer();adapt();render();
 });
 render();
};
const discovery=()=>{
 let d=safe(()=>JSON.parse(localStorage.getItem(DISC)||'[]'),[]);
 const unlock=id=>{if(!d.includes(id)){d.push(id);safe(()=>localStorage.setItem(DISC,JSON.stringify(d)),null);record('unlock',{id})}};
 const brand=document.querySelector('.brand'); if(brand)brand.addEventListener('dblclick',()=>unlock('double-gate'));
 let taps=0,timer=0;
 document.addEventListener('click',e=>{if(!e.target.closest('.xmark'))return;taps++;clearTimeout(timer);timer=setTimeout(()=>taps=0,1400);if(taps>=4){taps=0;unlock('fourfold-gate');const n=document.createElement('div');n.textContent='✦ یک مسیر پنهان برای تو باز شد';n.style.cssText='position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 20px;border:1px solid #d8ad4f;border-radius:18px;background:#0b0805;color:#ffe0a0;box-shadow:0 20px 80px #000;font:700 13px system-ui';document.body.append(n);setTimeout(()=>n.remove(),3000)}},{passive:true});
};
const css=()=>{if(document.querySelector('#axDNAStyle'))return;const s=document.createElement('style');s.id='axDNAStyle';s.textContent='#axDNA{position:fixed;left:12px;bottom:12px;z-index:9990;font:10px system-ui;color:#f0d18a;pointer-events:none}#axDNAOpen{pointer-events:auto;border:1px solid rgba(216,173,79,.28);background:rgba(8,6,4,.58);color:#f0d18a;border-radius:999px;padding:5px 8px;font-size:10px;opacity:.72;box-shadow:0 4px 16px rgba(0,0,0,.16)}#axDNAOpen:hover{opacity:1}#axDNAPanel{pointer-events:auto;margin-top:5px;display:flex;flex-direction:column;gap:4px;padding:7px;border:1px solid rgba(216,173,79,.18);border-radius:12px;background:rgba(8,6,4,.82);box-shadow:0 8px 24px rgba(0,0,0,.18)}#axDNAPanel button{border:1px solid rgba(216,173,79,.25);background:rgba(8,6,4,.55);color:#f0d18a;border-radius:9px;padding:6px 8px;font-size:10px}#axDNAPanel span{color:#968a77;padding:3px}.ax-discovery-mode .heritage-card,.ax-discovery-mode .hero-orbit{filter:saturate(1.12)}[data-ax-mode="direct"] .composer em{display:none}@media(max-width:600px){#axDNA{left:7px;bottom:7px}#axDNAOpen{padding:4px 7px;font-size:9px}}';document.head.appendChild(s)};
const boot=()=>{css();personalPanel();trackClicks();trackSearch();discovery();adapt();record('session',{lang:navigator.language||'unknown',width:innerWidth,ref:document.referrer?new URL(document.referrer).hostname:'direct'});};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();