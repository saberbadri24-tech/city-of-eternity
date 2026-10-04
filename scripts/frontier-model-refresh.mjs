#!/usr/bin/env node
import fs from "node:fs/promises";
const out=new URL("../frontier-model-catalog.json",import.meta.url);
const providers=[
{id:"openai",env:"OPENAI_API_KEY",url:"https://api.openai.com/v1/models",headers:key=>({Authorization:`Bearer ${key}`})},
{id:"anthropic",env:"ANTHROPIC_API_KEY",url:"https://api.anthropic.com/v1/models",headers:key=>({"x-api-key":key,"anthropic-version":"2023-06-01"})},
{id:"google_gemini",env:"GEMINI_API_KEY",url:"https://generativelanguage.googleapis.com/v1beta/models",headers:()=>({})}
];
async function fetchCatalog(p){
 const key=process.env[p.env]; if(!key)return {provider:p.id,configured:false,models:[],error:"credential_missing"};
 try{
  const url=p.id==="google_gemini"?`${p.url}?key=${encodeURIComponent(key)}`:p.url;
  const r=await fetch(url,{headers:p.headers(key),signal:AbortSignal.timeout(15000)}),body=await r.json().catch(()=>({}));
  if(!r.ok)return {provider:p.id,configured:true,models:[],error:`http_${r.status}`};
  const models=(body.data||body.models||[]).map(x=>({id:x.id||x.name||null,name:x.name||x.id||null,inputTokenLimit:x.inputTokenLimit??null,outputTokenLimit:x.outputTokenLimit??null,supportedGenerationMethods:x.supportedGenerationMethods??null})).filter(x=>x.id||x.name);
  return {provider:p.id,configured:true,models};
 }catch(e){return {provider:p.id,configured:true,models:[],error:String(e?.message||e).slice(0,180)}}
}
const results=[]; for(const p of providers)results.push(await fetchCatalog(p));
const preferred={
 openai:["gpt-6-astra","gpt-6.1-sol","gpt-6-luna"],
 anthropic:["claude-opus-5","claude-fable-5","claude-sonnet-5"],
 google_gemini:["gemini-3.8-flash","gemini-3.7-flash","gemini-3.1-pro-preview"]
};
for(const item of results){
 const ids=new Set(item.models.map(x=>String(x.id||x.name||"").replace(/^models\//,"")));
 item.preferred=preferred[item.provider]?.find(id=>ids.has(id))||preferred[item.provider]?.[0]||null;
}
const normalized={schemaVersion:2,sourcePolicy:"official provider model APIs only",providers:results};
let previous=null;try{previous=JSON.parse(await fs.readFile(out,"utf8"))}catch{}
const stable=JSON.stringify(normalized),oldStable=previous?JSON.stringify({schemaVersion:previous.schemaVersion,sourcePolicy:previous.sourcePolicy,providers:previous.providers}):"";
if(stable!==oldStable){
 await fs.writeFile(out,JSON.stringify({...normalized,generatedAt:new Date().toISOString()},null,2)+"\n");
 console.log(JSON.stringify({status:"frontier_catalog_changed",providers:results.map(x=>({provider:x.provider,configured:x.configured,count:x.models.length,error:x.error||null}))}));
}else console.log(JSON.stringify({status:"frontier_catalog_unchanged",providers:results.map(x=>({provider:x.provider,configured:x.configured,count:x.models.length,error:x.error||null}))}));
