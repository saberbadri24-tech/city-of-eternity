const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
export default async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 const rate=Number(Netlify.env.USD_IRR_RATE||0);
 if(!Number.isFinite(rate)||rate<=0)return json({ok:false,error:'usd_irr_rate_not_configured',currency:'USD',target:'IRR',source:'environment'});
 return json({ok:true,from:'USD',to:'IRR',rate,source:'environment',tomanRate:rate/10});
};
export const config={path:'/api/fx'};
