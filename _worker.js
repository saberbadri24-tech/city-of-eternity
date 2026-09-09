export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, service: 'ANIL X', runtime: 'cloudflare-pages-worker' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      try {
        const body = await request.json();
        const text = String(body?.text || '').trim().toLowerCase();
        const routes = [
          { id:'video', keys:['تیزر','ویدیو','فیلم','کلیپ'], title:'مسیر تولید تیزر', desc:'از ایده تا نسخه نهایی و آماده انتشار.', steps:['ایده و هدف','سناریو و متن','طراحی تصویر','تولید و تدوین','صدا و نسخه‌ها','انتشار و رشد'] },
          { id:'website', keys:['سایت','وب سایت','وب‌سایت','وبسایت','فروشگاه','لندینگ'], title:'مسیر ساخت سایت', desc:'هدف، ساختار، طراحی، اجرا و رشد را یکجا جلو می‌بریم.', steps:['هدف و مخاطب','ساختار و محتوا','طراحی','توسعه','تست و انتشار','SEO و رشد'] },
          { id:'fix', keys:['خطا','خراب','درست نمی','مشکل','ارور','کند','کار نمی','رفع'], title:'مسیر رفع مشکل', desc:'مشکل را از تشخیص تا تست نهایی دنبال می‌کنیم.', steps:['دریافت مشکل','تشخیص','اولویت‌بندی','راه‌حل','اجرا','تست و تحویل'] },
          { id:'growth', keys:['فروش','مشتری','رشد','تبلیغ','سئو','seo','بازدید','درآمد'], title:'مسیر رشد', desc:'از هدف کسب‌وکار تا جذب، تبدیل و اندازه‌گیری.', steps:['هدف','مخاطب','پیشنهاد','جذب','تبدیل','اندازه‌گیری'] }
        ];
        const route = routes.find(r => r.keys.some(k => text.includes(k))) || { id:'custom', title:'مسیر اختصاصی ANIL X', desc:'خواسته‌ات را به قدم‌های قابل اجرا تبدیل می‌کنیم.', steps:['فهم خواسته','کشف نیاز','ساخت مسیر','پیش‌نمایش','اجرا','ادامه و رشد'] };
        return new Response(JSON.stringify({ ok:true, route, confidence:0.92 }), { headers:{'content-type':'application/json; charset=utf-8'} });
      } catch {
        return new Response(JSON.stringify({ ok:false, error:'invalid_request' }), { status:400, headers:{'content-type':'application/json; charset=utf-8'} });
      }
    }

    return env.ASSETS.fetch(request);
  }
};