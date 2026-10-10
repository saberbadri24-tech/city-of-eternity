#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root=process.cwd();
const skip=new Set(["node_modules",".git",".next","dist","build"]);
const files=[];
const htmlFiles=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(/\.(js|mjs|cjs)$/.test(ent.name)) files.push(p);
    else if(/\.html?$/i.test(ent.name)) htmlFiles.push(p);
  }
}
walk(root);
let failed=0;
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match,index=0;
  while((match=re.exec(html))){
    const attrs=match[1]||'',body=match[2]||'';
    const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()||'';
    if(/\bsrc\s*=/.test(attrs)||type==='module'||(type&&!/^(text|application)\/(javascript|ecmascript)$/.test(type))||!body.trim()) continue;
    index++;
    try { new Function(body); }
    catch(error){
      failed++;
      process.stderr.write("\nINLINE SCRIPT SYNTAX FAIL: "+file+" #"+index+"\n"+String(error?.message||error)+"\n");
    }
  }
}
for(const file of files){
  const r=spawnSync(process.execPath,["--check",file],{stdio:"pipe",encoding:"utf8"});
  if(r.status!==0){
    failed++;
    process.stderr.write("\nSYNTAX FAIL: "+file+"\n"+(r.stderr||r.stdout||"") );
  }
}
if(failed) process.exit(1);
console.log("ANIL X predeploy syntax gate: PASS ("+files.length+" JS/MJS/CJS files; "+htmlFiles.length+" HTML files scanned for inline script syntax)");
