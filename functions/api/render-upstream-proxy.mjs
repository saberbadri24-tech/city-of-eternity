import {Buffer} from 'node:buffer';

const HOP_BY_HOP=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade','content-length','content-encoding','host']);
const MAX_PROXY_BODY=512*1024;

async function readBody(req){
  let total=0;const chunks=[];
  for await(const chunk of req){total+=chunk.length;if(total>MAX_PROXY_BODY)throw Object.assign(new Error('request_body_too_large'),{statusCode:413});chunks.push(chunk)}
  return chunks.length?Buffer.concat(chunks):undefined;
}

export async function proxyToUpstream(req,res,upstreamBase,options={}){
  try{
    const upstream=new URL(String(upstreamBase||''));
    const localTest=options.allowHttpLocal===true&&upstream.protocol==='http:'&&['127.0.0.1','localhost'].includes(upstream.hostname);
    const productionAllowed=upstream.protocol==='https:'&&upstream.hostname==='anil-x-live.onrender.com';
    if(!localTest&&!productionAllowed)throw new Error('upstream_not_allowed');
    const target=new URL(req.url||'/',upstream.origin);
    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers||{})){
      if(value==null||HOP_BY_HOP.has(name.toLowerCase()))continue;
      headers.set(name,Array.isArray(value)?value.join(', '):String(value));
    }
    headers.set('origin',upstream.origin);
    headers.set('x-forwarded-host',String(req.headers?.host||''));
    headers.set('x-forwarded-proto','https');
    headers.delete('content-length');
    const method=String(req.method||'GET').toUpperCase();
    const body=method==='GET'||method==='HEAD'?undefined:await readBody(req);
    const fetchImpl=options.fetchImpl||fetch;
    const response=await fetchImpl(target,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(30000)});
    res.statusCode=response.status;
    for(const [name,value] of response.headers){
      const lower=name.toLowerCase();
      if(HOP_BY_HOP.has(lower)||lower==='set-cookie')continue;
      res.setHeader(name,value);
    }
    const cookies=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];
    if(cookies.length)res.setHeader('set-cookie',cookies);
    else if(response.headers.get('set-cookie'))res.setHeader('set-cookie',response.headers.get('set-cookie'));
    const bytes=Buffer.from(await response.arrayBuffer());
    res.setHeader('content-length',String(bytes.byteLength));
    res.end(bytes);
  }catch(error){
    if(res.headersSent){res.destroy();return}
    const status=Number(error?.statusCode)===413?413:502;
    res.statusCode=status;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.end(JSON.stringify({ok:false,error:status===413?'request_body_too_large':'upstream_unavailable'}));
  }
}
