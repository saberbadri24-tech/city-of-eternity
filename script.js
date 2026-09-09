(() => {
  'use strict';
  const input = document.getElementById('requestInput');
  const form = document.getElementById('requestForm');
  const count = document.getElementById('charCount');
  const result = document.getElementById('routeResult');
  const chips = document.querySelectorAll('[data-request]');
  const routes = [
    {keys:['تیزر','ویدیو','فیلم','کلیپ','محتوا ویدیویی'], title:'مسیر تولید تیزر', desc:'از ایده تا نسخه نهایی و آماده انتشار.', steps:['ایده و هدف','سناریو و متن','طراحی تصویر','تولید و تدوین','صدا و نسخه‌ها','انتشار و رشد']},
    {keys:['سایت','وب‌سایت','وبسایت','فروشگاه','لندینگ','صفحه اینترنتی'], title:'مسیر ساخت سایت', desc:'هدف، ساختار، طراحی، اجرا و رشد را یکجا جلو می‌بریم.', steps:['هدف و مخاطب','ساختار و محتوا','طراحی','توسعه','تست و انتشار','SEO و رشد']},
    {keys:['پیش‌نمایش','پیش نمایش','نمونه قبل','قبل از ساخت','prototype','پروتوتایپ','ماکت'], title:'مسیر پیش‌نمایش', desc:'اول ببین، بررسی کن و اصلاح کن؛ بعد وارد اجرای اصلی شو.', steps:['تعریف ایده','نمونه اولیه','پیش‌نمایش','بازخورد','اصلاح','تأیید نهایی']},
    {keys:['خطا','خراب','درست نمی','مشکل','ارور','کند','کار نمی‌کنه','کار نمیکنه','رفع'], title:'مسیر رفع مشکل', desc:'مشکل را از تشخیص تا تست نهایی دنبال می‌کنیم.', steps:['دریافت مشکل','تشخیص','اولویت‌بندی','راه‌حل','اجرا','تست و تحویل']},
    {keys:['فروش','مشتری','رشد','تبلیغ','سئو','seo','بازدید','درآمد'], title:'مسیر رشد', desc:'از هدف کسب‌وکار تا جذب، تبدیل و اندازه‌گیری.', steps:['هدف','مخاطب','پیشنهاد','جذب','تبدیل','اندازه‌گیری']}
  ];
  const fallback = {title:'مسیر اختصاصی Anil X', desc:'نیازی نیست اسم خدمت را بدانی؛ خواسته‌ات را تبدیل به یک مسیر قابل اجرا می‌کنیم.', steps:['فهم خواسته','کشف نیازهای مرتبط','ساخت مسیر','پیش‌نمایش','اجرا','ادامه و رشد']};
  const normalize = s => String(s).trim().toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک');
  const findRoute = text => { const t=normalize(text); return routes.find(r=>r.keys.some(k=>t.includes(normalize(k)))) || fallback; };
  const faNum = n => String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
  function updateCount(){ count.textContent = `${faNum(input.value.length)} / ۱۰۰۰`; }
  function renderRoute(text, apiRoute=null){
    const route=apiRoute || findRoute(text); result.innerHTML='';
    const h=document.createElement('h3'); h.textContent=route.title;
    const p=document.createElement('p'); p.textContent=route.desc;
    const ul=document.createElement('ol'); ul.className='route-list';
    route.steps.forEach(step=>{const li=document.createElement('li');li.textContent=step;ul.appendChild(li);});
    result.append(h,p,ul); result.hidden=false; result.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  chips.forEach(chip=>chip.addEventListener('click',()=>{input.value=chip.dataset.request;updateCount();renderRoute(input.value);}));
  input.addEventListener('input',updateCount);
  form.addEventListener('submit',async e=>{e.preventDefault(); const text=input.value.trim(); if(!text){input.focus();return;}
    const go=form.querySelector('.go'); const old=go.innerHTML; go.disabled=true; go.innerHTML='<span>در حال تحلیل…</span><b>…</b>';
    try{const r=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})}); const data=await r.json(); if(data.ok){renderRoute(text,data.route); if(data.followUp){const note=document.createElement('p'); note.className='route-followup'; note.textContent=data.followUp; result.appendChild(note);}} else renderRoute(text);} catch{renderRoute(text)} finally{go.disabled=false;go.innerHTML=old;}
  });
  updateCount();
})();