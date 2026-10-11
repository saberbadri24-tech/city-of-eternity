import fs from 'node:fs';
import { runLocalEngineChain } from '../functions/api/anil-engine-chain.mjs';
import { buildCorePlan } from '../functions/api/anil-core-engine.mjs';

const cases = [
  {input:'واریزا و پرداخت کیف پول را بررسی کن', expected:'payment-integrity'},
  {input:'Guard airdrop opportunity source verification', expected:'guard-security'},
  {input:'Fix website bug and run tests', expected:'code-quality'},
  {input:'افزایش فروش و درآمد مشتریان', expected:'revenue-operations'},
  {input:'Research and verify sources', expected:'research-verification'},
  {input:'Review security and access permissions', expected:'security-governance'},
  {input:'Build website dashboard and test buttons', expected:'website-operations'},
  {input:'Write a customer email', expected:'writing-communication'},
  {input:'Create a new digital product and build a prototype', expected:'creation-factory'},
  {input:'Analyze spreadsheet data and calculate totals', expected:'data-analysis'},
  {input:'Create an automation workflow', expected:'workflow-automation'},
  {input:'Help with customer support FAQ', expected:'customer-support'},
  {input:'Explain a concept step by step', expected:'learning-explanation'},
  {input:'Create a marketing content strategy', expected:'content-strategy'},
  {input:'سلام، برای بهبود ANIL X برنامه بده', expected:'website-operations'},
  {input:'برنامه برای بهبود پنل مديريت آنيل', expected:'website-operations'},
  {input:'واريزا و پرداخت كيف پول را بررسي کن', expected:'payment-integrity'},
  {input:'گارد جاویدان فرصت ایردراپ را بررسی کن', expected:'guard-security'}
];
const results = cases.map(item => {
  const out = runLocalEngineChain(item.input);
  return {
    name: item.expected,
    ok: out.plan.engines.some(engine => engine.id === item.expected) &&
      out.execution.performed === false &&
      out.execution.status === 'not_executed' &&
      out.orchestration.providerIndependent === true &&
      Array.isArray(out.chain) && out.chain.length >= 10
  };
});
const localTroubleshooting = runLocalEngineChain('رفع خطای سایت');
results.push({
  name:'local engine chain prioritizes explicit troubleshooting intent',
  ok:localTroubleshooting.selectedEngine==='Code Quality & Repair Engine' &&
    localTroubleshooting.plan.engines.some(engine=>engine.id==='code-quality')
});
const troubleshootingPlan = buildCorePlan('رفع خطای سایت');
results.push({
  name:'troubleshooting intent outranks website topic overlap',
  ok:troubleshootingPlan.routeId==='debug'
});
const websitePlan = buildCorePlan('یک سایت جدید بساز');
results.push({
  name:'plain website-build requests retain website route',
  ok:websitePlan.routeId==='website'
});
const sensitive = runLocalEngineChain('انتقال وجه از کیف پول را انجام بده');
results.push({
  name:'sensitive wallet actions require owner approval',
  ok:sensitive.requiresOwnerApproval===true && sensitive.execution.performed===false
});
const arabicWallet = runLocalEngineChain('انتقال از کیف پول اصلی را انجام بده');
results.push({
  name:'Persian transfer synonyms remain owner-gated',
  ok:arabicWallet.requiresOwnerApproval===true && arabicWallet.execution.performed===false
});
const unknown = runLocalEngineChain('Please help me solve a problem');
results.push({
  name:'general reasoning fallback remains available',
  ok:unknown.selectedEngine==='ANIL Core Reasoning Engine' &&
    unknown.orchestration.externalProviderRequired===false
});
const planSource = fs.readFileSync(new URL('../functions/api/plan.mjs', import.meta.url), 'utf8');
results.push({
  name:'runtime plan uses first-party specialist engines',
  ok:!(/https:\/\/[a-z0-9.-]+\/v1\/(?:messages|chat\/completions)/i.test(planSource)) &&
    planSource.includes('externalModelsCalled:false')
});
const workerSource = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
results.push({
  name:'owner chat routes through the first-party serial engine chain',
  ok:workerSource.includes("if(u.pathname==='/api/admin/secretary')return secretary(req,env)") &&
    workerSource.includes("handlePlan(new Request('https://anilx.internal/api/plan'") &&
    workerSource.includes("action:'serial_engine_chain_fallback'") &&
    workerSource.includes("execution:planData.execution||{performed:false,status:'not_executed'}")
});
const ownerChatIndex = workerSource.indexOf('// Internal-first owner chat: do not invoke hosted LLM/bot providers for ordinary conversation.');
const ownerChatEnd = workerSource.indexOf('\nexport default', ownerChatIndex);
const ownerChatSource = workerSource.slice(ownerChatIndex, ownerChatEnd);
results.push({
  name:'owner chat uses first-party serial engines without hosted-model calls',
  ok:ownerChatIndex >= 0 && ownerChatEnd > ownerChatIndex &&
    ownerChatSource.includes("action:'serial_engine_chain_primary'") &&
    ownerChatSource.includes('externalModelsCalled:false') &&
    !/https:\/\/api\.[a-z0-9.-]+\//i.test(ownerChatSource) &&
    !ownerChatSource.includes('analysisRequest') &&
    !ownerChatSource.includes('verify:true')
});
results.push({
  name:'owner chat keeps execution evidence-gated without provider error disclosure',
  ok:ownerChatSource.includes("action:'serial_engine_chain_fallback'") &&
    ownerChatSource.includes("performed:false") &&
    !ownerChatSource.includes('providerFailures')
});

const engineChainSource = fs.readFileSync(new URL('../functions/api/anil-engine-chain.mjs', import.meta.url), 'utf8');
const analyzeSource = fs.readFileSync(new URL('../netlify/functions/analyze.mjs', import.meta.url), 'utf8');
results.push({
  name:'multipurpose creation engine is registered and selected for creation tasks',
  ok:engineChainSource.includes("id: 'creation-factory'") &&
    engineChainSource.includes("Multipurpose Creation & Build Engine")
});
const orchestration = JSON.parse(fs.readFileSync(new URL('../ANIL-X-AI-ORCHESTRATION.json', import.meta.url), 'utf8'));
results.push({
  name:'legacy model council is removed from orchestration contract',
  ok:!Object.prototype.hasOwnProperty.call(orchestration, 'council') &&
    orchestration.engine_chain?.name === 'ANIL-MULTIPURPOSE-SERIAL-CREATION-ENGINE' &&
    orchestration.engine_chain?.rules?.threeModelCouncil === false
});

results.push({
  name:'hosted three-model verification is removed from the runtime analysis adapter',
  ok:!analyzeSource.includes('Optional council verification') &&
    !analyzeSource.includes('council={claude:false,gemini:false}') &&
    analyzeSource.includes('verification:"disabled"')
});
const failed = results.filter(item => !item.ok);
for (const result of results) console.log((result.ok?'PASS ':'FAIL ')+result.name);
if (failed.length) process.exit(1);
console.log('ANIL X multipurpose serial creation engine gate: PASS ('+results.length+' checks)');
