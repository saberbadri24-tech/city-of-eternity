import {promises as fs} from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const ignoredDirs=new Set(['.git','node_modules','.github']);
const files=[];
async function walk(dir){
  for(const e of await fs.readdir(dir,{withFileTypes:true})){
    if(ignoredDirs.has(e.name))continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())await walk(p);
    else files.push(p);
  }
}
await walk(root);

const sourceFiles=files.filter(p=>/\.(html|js|mjs|mts|json|yml|yaml|toml)$/.test(p));
const legacyPatterns=[
  {name:'legacy AppDeploy',re:/appdeploy\.ai/i},
  {name:'legacy built-in admin password',re:/BUILTIN_ADMIN_PASSWORD|Sm\*114411/},
  {name:'legacy GitHub Pages URL',re:/saberbadri24-tech\.github\.io\/city-of-eternity/i},
];
const errors=[];
for(const file of sourceFiles){
  const c=await fs.readFile(file,'utf8');
  for(const x of legacyPatterns)if(file.endsWith('scripts/predeploy-static-check.mjs'))continue; else if(x.re.test(c))errors.push(path.relative(root,file)+': '+x.name);
}

for(const file of files.filter(p=>/\.(js|mjs)$/.test(p))){
  const rel=path.relative(root,file);
  const {spawnSync}=await import('node:child_process');
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)errors.push(rel+': JS syntax check failed: '+(r.stderr||r.stdout).trim());
}

const localRef=/\b(?:href|src)\\s*=\\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;
for(const file of files.filter(p=>p.endsWith('.html'))){
  const c=await fs.readFile(file,'utf8');
  let m;
  while((m=localRef.exec(c))){
    const ref=m[1];
    if(/^(?:https?:|mailto:|tel:|data:|javascript:|\/)/i.test(ref))continue;
    const target=path.resolve(path.dirname(file),ref);
    try{await fs.access(target)}catch{errors.push(path.relative(root,file)+': missing local asset/link '+ref)}
  }
}
const adminHtml=await fs.readFile(path.join(root,'admin.html'),'utf8').catch(()=> '');
const adminJs=await fs.readFile(path.join(root,'admin.js'),'utf8').catch(()=> '');
if(adminHtml&&adminJs){
  const ids=new Set([...adminHtml.matchAll(/\\bid=[\"']([^\"']+)[\"']/g)].map(m=>m[1]));
  const refs=[...adminJs.matchAll(/\\$\\(['\"]#([^'\"]+)['\"]\\)/g)].map(m=>m[1]);
  const missing=[...new Set(refs.filter(id=>!ids.has(id)))];
  if(missing.length) errors.push('admin.js references missing admin.html element IDs: '+missing.join(', '));
}
if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ANIL X static predeploy audit: PASS');
console.log('Files checked:',sourceFiles.length);
