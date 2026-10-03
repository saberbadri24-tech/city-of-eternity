const attempts=new Map();

const b64u=s=>btoa(String.fromCharCode(...new Uint8Array(s))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const b64uJson=s=>btoa(s).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const json=(d,status=200,headers={})=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const secretOf=env=>typeof env?.ANIL_ADMIN_PASSWORD==='string'?env.ANIL_ADMIN_PASSWORD.normalize('NFKC'):'';

async function sign(value,secret){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64u(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}
function ipOf(req){return String(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,120)}
async function readGate(env,key){
  try{return env?.PAYMENTS?await env.PAYMENTS.get(key,'json')||{count:0,blockedUntil:0}:attempts.get(key)||{count:0,blockedUntil:0}}
  catch{return attempts.get(key)||{count:0,blockedUntil:0}}
}
async function writeGate(env,key,value){
  attempts.set(key,value);
  try{if(env?.PAYMENTS)await env.PAYMENTS.put(key,JSON.stringify(value))}catch{}
}

export async function adminLogin(req,env){
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  const secret=secretOf(env);
  if(secret.length<10)return json({ok:false,error:'admin_password_not_configured'},503);
  const ip=ipOf(req),key='admin/login/'+b64uJson(ip),now=Date.now(),gate=await readGate(env,key);
  if(Number(gate.blockedUntil)>now)return json({ok:false,error:'too_many_attempts'},429);
  const body=await req.json().catch(()=>null);
  const pass=typeof body?.password==='string'?body.password.normalize('NFKC'):'';
  if(!pass||pass!==secret){
    const count=Number(gate.count||0)+1;
    await writeGate(env,key,{count,blockedUntil:count>=5?now+900000:0});
    return json({ok:false,error:'invalid_credentials'},401);
  }
  await writeGate(env,key,{count:0,blockedUntil:0});
  const payload=b64uJson(JSON.stringify({sub:'admin',iat:now,exp:now+43200000,v:2}));
  const sig=await sign(payload,secret);
  return json({ok:true,expiresAt:now+43200000},200,{'set-cookie':`session=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`});
}

export async function adminAuth(req,env){
  const secret=secretOf(env);
  if(secret.length<12)return false;
  const raw=req.headers.get('cookie')||'';
  const m=raw.match(/(?:^|; )session=([^;]+)/);
  if(!m)return false;
  const [body,sig]=m[1].split('.');
  if(!body||!sig)return false;
  const expected=await sign(body,secret);
  if(sig!==expected)return false;
  try{
    const padded=body.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-body.length%4)%4);
    const data=JSON.parse(atob(padded));
    return data.sub==='admin'&&Number(data.exp)>Date.now();
  }catch{return false}
}

export function adminConfigured(env){return secretOf(env).length>=10}

export async function adminSelfTest(env){
  if(!adminConfigured(env))return {ok:false,configured:false,loginStatus:503,sessionValid:false,secretExposed:false};
  const secret=secretOf(env);
  const loginReq=new Request('https://internal/api/admin/password/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:secret})});
  const loginRes=await adminLogin(loginReq,env);
  const cookie=loginRes.headers.get('set-cookie')||'';
  const sessionReq=new Request('https://internal/api/admin/secretary',{method:'POST',headers:{cookie}});
  const sessionValid=loginRes.status===200&&await adminAuth(sessionReq,env);
  return {ok:sessionValid,configured:true,loginStatus:loginRes.status,sessionValid,secretExposed:false};
}
