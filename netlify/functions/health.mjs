export default async () => new Response(JSON.stringify({ok:true,service:'anil-x',status:'ready',time:new Date().toISOString()}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const config={path:'/api/health'};
