import { promises as fs } from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const workflows=path.join(root,'.github','workflows');
const files=await fs.readdir(workflows);
const wf=[];
for(const name of files.filter(x=>/\.(yml|yaml)$/.test(x))) wf.push({name,text:await fs.readFile(path.join(workflows,name),'utf8')});

const errors=[];
const scheduled=(needle)=>wf.filter(x=>x.text.includes(needle)&&/cron:\s*["']?\*\/5/.test(x.text)).map(x=>x.name);

const revenueScheduled=scheduled('/api/revenue/fleet/run');
if(revenueScheduled.length!==1||revenueScheduled[0]!=='anilx-autonomy.yml') errors.push('Revenue fleet must have exactly one scheduled owner: anilx-autonomy.yml; found '+revenueScheduled.join(', '));

const autoScheduled=scheduled('/api/autopilot');
if(autoScheduled.length) errors.push('Legacy /api/autopilot must not have a 5-minute schedule: '+autoScheduled.join(', '));

const keepwarm=wf.filter(x=>/cron:\s*["']?\*\/5/.test(x.text)&&/city-of-eternity\.onrender\.com\/(api\/health|api\/payment-config|\s*$)/.test(x.text)).map(x=>x.name);
if(keepwarm.length>1) errors.push('Duplicate 5-minute keepwarm workflows: '+keepwarm.join(', '));

const runtimeFiles=['worker.js','render-server.mjs','functions/api/execution-readiness.mjs','functions/api/guard-live.mjs','revenue-super-os.json'];
for(const rel of runtimeFiles){
 const c=await fs.readFile(path.join(root,rel),'utf8');
 if(/TON_TEMP_WALLET_ADDRESS|GUARD_TEMP_WALLET_ADDRESS|TON_TEMP_ADDRESS|TEMP_TON_WALLET|TEMP_WALLET_ADDRESS|TON_RECEIVING_ADDRESS/.test(c))
   errors.push(rel+': obsolete temporary-wallet runtime dependency remains');
}
const renderYaml=await fs.readFile(path.join(root,'render.yaml'),'utf8').catch(()=> '');
if(renderYaml && /^\s*-?\s*type:\s*cron\b/m.test(renderYaml)) errors.push('render.yaml still declares a duplicate Render cron; automation is GitHub-owned');

for(const x of wf){
 if(/node-version:\s*22/.test(x.text) && /(production|browser|execution-fabric|final-gate)/i.test(x.name))
   errors.push(x.name+': Node 22 conflicts with production Node 24 contract');
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('ANIL X system-integrity audit: PASS');
console.log('Workflows inspected:',wf.length);
