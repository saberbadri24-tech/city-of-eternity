import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const files = {
  pay: read('../functions/api/pay.js'),
  readiness: read('../functions/api/execution-readiness.mjs'),
  autopilot: read('../functions/api/autopilot.mjs'),
  server: read('../render-server.mjs'),
  webhook: read('../functions/api/variza-webhook.js')
};
const aliases = [
  'VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY',
  'VARIZA_API_TOKEN','VARIZA_SECRET','VARIZA_API',
  'VARIZA_ACCESS_TOKEN','VARIZA_BEARER_TOKEN'
];
const checks = [
  ['payment creation accepts every documented Variza API alias', aliases.every(k => files.pay.includes(k))],
  ['execution readiness accepts every documented Variza API alias', aliases.every(k => files.readiness.includes(k))],
  ['revenue autopilot reports every documented Variza API alias', aliases.every(k => files.autopilot.includes(k))],
  ['Render health reports every documented Variza API alias', aliases.every(k => files.server.includes(k))],
  ['Variza webhook verifies HMAC signatures', files.webhook.includes('invalid_signature') && files.webhook.includes('await hmac(secret, body)')],
  ['Variza webhook rejects paid-amount mismatches', files.webhook.includes('amount_mismatch') && files.webhook.includes('Number(payload.amount) === Number(order.providerAmount ?? order.amount)')],
  ['payment creation requires durable accounting', files.pay.includes('durable_payment_storage_required')]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (failed.length) process.exit(1);
console.log('ANIL X payment-integrity gate: PASS (' + checks.length + ' checks)');
