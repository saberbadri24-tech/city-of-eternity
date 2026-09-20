const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const items=[
 {id:'site',title:'ساخت سایت',tags:['site','website','فروشگاه','سایت'],action:'ساخت سایت حرفه‌ای'},
 {id:'teaser',title:'ساخت تیزر',tags:['video','teaser','تیزر','ویدیو'],action:'ساخت تیزر تبلیغاتی'},
 {id:'fix',title:'رفع مشکل',tags:['fix','bug','error','خطا','ارور'],action:'رفع مشکل سایت'},
 {id:'growth',title:'رشد کسب‌وکار',tags:['growth','seo','فروش','مشتری','رشد'],action:'رشد کسب‌وکار و سئو'},
 {id:'preview',title:'پیش‌نمایش',tags:['preview','prototype','پیش‌نمایش'],action:'پیش‌نمایش بساز'},
 {id:'global',title:'Anil World',tags:['global','world','بین‌المللی'],action:'مسیر بین‌المللی ANIL X'}
];
export default async(req)=>{const q=(new URL(req.url).searchParams.get('q')||'').toLowerCase();const results=q?items.filter(x=>x.title.toLowerCase().includes(q)||x.tags.some(t=>q.includes(t)||t.includes(q))):items;return json({ok:true,source:'anil-x-discovery-catalog',results})};
export const config={path:'/api/discovery'};
