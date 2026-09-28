#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root=process.cwd();
const skip=new Set(["node_modules",".git",".next","dist","build"]);
const files=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(/\.(js|mjs|cjs)$/.test(ent.name)) files.push(p);
  }
}
walk(root);
let failed=0;
for(const file of files){
  const r=spawnSync(process.execPath,["--check",file],{stdio:"pipe",encoding:"utf8"});
  if(r.status!==0){
    failed++;
    process.stderr.write("\nSYNTAX FAIL: "+file+"\n"+(r.stderr||r.stdout||"") );
  }
}
if(failed) process.exit(1);
console.log("ANIL X predeploy syntax gate: PASS ("+files.length+" JS/MJS/CJS files)");
