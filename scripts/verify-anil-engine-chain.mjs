import fs from 'node:fs';
import { runLocalEngineChain } from '../functions/api/anil-engine-chain.mjs';

const cases = [
  {input:'واریزا و پرداخت کیف پول را بررسی کن', expected:'payment-integrity'},
  {input:'Guard airdrop opportunity source verification', expected:'guard-security'},
  {input:'Fix website bug and run tests', expected:'code-quality'},
  {input:'افزایش فروش و درآمد مشتریان', expected:'revenue-operations'},
  {input:'Research and verify sources', expected:'research-verification'},
  {input:'Review security and access permissions', expected:'security-governance'},
  {input:'Build website dashboard and test buttons', expected:'website-operations'},
  {input:'Write a customer email', expected:'writing-communication'},
  {input:'Analyze spreadsheet data and calculate totals', expected:'data-analysis'},
  {input:'Create an automation workflow', expected:'workflow-automation'},
  {input:'Help with customer support FAQ', expected:'customer-support'},
  {input:'Explain a concept step by step', expected:'learning-explanation'},
  {input:'Create a marketing content strategy', expected:'content-strategy'}
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
const sensitive = runLocalEngineChain('انتقال وجه از کیف پول را انجام بده');
results.push({
  name:'sensitive wallet actions require owner approval',
  ok:sensitive.requiresOwnerApproval===true && sensitive.execution.performed===false
});
const unknown = runLocalEngineChain('Please help me solve a problem');
results.push({
  name:'general reasoning fallback remains available',
  ok:unknown.selectedEngine==='ANIL Core Reasoning Engine' &&
    unknown.orchestration.externalProviderRequired===false
});
const planSource = fs.readFileSync(new URL('../functions/api/plan.mjs', import.meta.url), 'utf8');
results.push({
  name:'runtime plan does not call external model providers',
  ok:!(/\bopenai\s*\(|\bclaude\s*\(|\bgemini\s*\(/i.test(planSource)) &&
    planSource.includes('externalModelsCalled:false')
});
const workerSource = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
results.push({
  name:'owner chat routes to independent council when external providers fail',
  ok:workerSource.includes("if(u.pathname==='/api/admin/secretary')return secretary(req,env)") &&
    workerSource.includes("handlePlan(new Request('https://anilx.internal/api/plan'") &&
    workerSource.includes("action:'independent_council_fallback'") &&
    workerSource.includes("execution:planData.execution||{performed:false,status:'not_executed'}")
});
const failed = results.filter(item => !item.ok);
for (const result of results) console.log((result.ok?'PASS ':'FAIL ')+result.name);
if (failed.length) process.exit(1);
console.log('ANIL X independent engine council gate: PASS ('+results.length+' checks)');
