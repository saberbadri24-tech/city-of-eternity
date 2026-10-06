import {cp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('..');
const out=path.resolve('web');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const publicFiles=[
  'index.html','admin.html','admin.js','admin.css','account.html','payment.html',
  'prizes.html','feedback.html','services.html','privacy.html','terms.html','support.html',
  'style.css','script.js','completion-layer.js','experience-dna.js','adaptive-shell.js',
  'webmcp.js','tonconnect.js','anilx-enhance.js','experience-layer.js','unified-i18n-v3.js',
  'manifest.webmanifest','sw.js','icon.png'
];

for(const name of publicFiles){
  try{await cp(path.join(root,name),path.join(out,name),{recursive:true})}
  catch(e){console.log('skip',name,e.code)}
}
console.log('ANIL X mobile public+owner shell staged; private Guard/Revenue/Settlement pages are intentionally excluded.');
