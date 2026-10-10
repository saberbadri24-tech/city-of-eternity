import assert from 'node:assert/strict';
import http from 'node:http';
import {proxyToUpstream} from '../functions/api/render-upstream-proxy.mjs';

const read=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks).toString('utf8')};
const upstream=http.createServer(async(req,res)=>{
  const body=await read(req);
  res.statusCode=200;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('x-upstream-test','passed');
  if(req.url.startsWith('/api/admin/password/login'))res.setHeader('set-cookie','session=issued.signature; Path=/; HttpOnly; Secure; SameSite=Lax');
  res.end(JSON.stringify({method:req.method,url:req.url,origin:req.headers.origin,cookie:req.headers.cookie||'',forwardedHost:req.headers['x-forwarded-host']||'',body}));
});
await new Promise((resolve,reject)=>upstream.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
const upstreamPort=upstream.address().port;
const upstreamBase='http://127.0.0.1:'+upstreamPort;
const proxy=http.createServer((req,res)=>{void proxyToUpstream(req,res,upstreamBase,{allowHttpLocal:true})});
await new Promise((resolve,reject)=>proxy.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
const proxyBase='http://127.0.0.1:'+proxy.address().port;
try{
  const get=await fetch(proxyBase+'/api/health?check=1',{headers:{origin:proxyBase,cookie:'session=owner.token; theme=dark','x-test-header':'ok'}});
  assert.equal(get.status,200);
  assert.equal(get.headers.get('x-upstream-test'),'passed');
  const g=await get.json();
  assert.equal(g.method,'GET');
  assert.equal(g.url,'/api/health?check=1');
  assert.equal(g.origin,upstreamBase,'proxy must set upstream origin to satisfy same-origin checks');
  assert.equal(g.cookie,'session=owner.token; theme=dark','owner session cookies must be forwarded');
  assert.equal(g.forwardedHost,new URL(proxyBase).host,'original regional host must be preserved for diagnostics');

  const post=await fetch(proxyBase+'/api/admin/password/login',{method:'POST',headers:{origin:proxyBase,cookie:'session=owner.token','content-type':'application/json'},body:JSON.stringify({password:'test-only'})});
  assert.equal(post.status,200);
  const p=await post.json();
  assert.equal(p.method,'POST');
  assert.equal(p.body,'{"password":"test-only"}','POST bodies must be forwarded without corruption');
  assert.match(post.headers.get('set-cookie')||'',/^session=issued\.signature/,'HttpOnly session cookie must survive the proxy');

  const denied=await new Promise(resolve=>{
    const s=http.createServer((req,res)=>{void proxyToUpstream(req,res,'https://example.com')});
    s.listen(0,'127.0.0.1',async()=>{const r=await fetch('http://127.0.0.1:'+s.address().port+'/api/test');const d=await r.json();s.close();resolve({status:r.status,data:d})});
  });
  assert.equal(denied.status,502,'unapproved upstreams must fail closed');
  assert.equal(denied.data.error,'upstream_unavailable');
  console.log('ANIL X regional proxy tests: PASS (allowlisted upstream, origin, cookies, POST body, fail-closed)');
}finally{
  await new Promise(resolve=>proxy.close(resolve));
  await new Promise(resolve=>upstream.close(resolve));
}
