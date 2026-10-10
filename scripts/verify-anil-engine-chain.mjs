import { runLocalEngineChain } from '../functions/api/anil-engine-chain.mjs';

const cases = [
  {input:'واریزا و پرداخت کیف پول را بررسی کن', expected:'payment-integrity'},
  {input:'Guard airdrop opportunity source verification', expected:'guard-security'},
  {input:'Fix website bug and run tests', expected:'code-quality'},
  {input:'افزایش فروش و درآمد مشتریان', expected:'revenue-operations'},
  {input:'Research and verify sources', expected:'research-verification'}
];
const results = cases.map(item => {
  const out = runLocalEngineChain(item.input);
  return {
    name: item.expected,
    ok: out.plan.engines.some(engine => engine.id === item.expected) &&
      out.execution.performed === false &&
      out.execution.status === 'not_executed' &&
      out.orchestration.providerIndependent === true &&
      Array.isArray(out.chain) && out.chain.length >= 5
  };
});
const sensitive = runLocalEngineChain('انتقال وجه از کیف پول را انجام بده');
results.push({
  name:'sensitive wallet actions require owner approval',
  ok:sensitive.requiresOwnerApproval===true && sensitive.execution.performed===false
});
const failed = results.filter(x => !x.ok);
for (const r of results) console.log((r.ok?'PASS ':'FAIL ')+r.name);
if (failed.length) process.exit(1);
console.log('ANIL X independent engine-chain gate: PASS ('+results.length+' checks)');
