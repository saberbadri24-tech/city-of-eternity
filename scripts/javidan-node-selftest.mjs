import fs from 'node:fs';
import vm from 'node:vm';

const context = {
  window: {},
  console,
  Date,
  URL,
  URLSearchParams,
  AbortController,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error('network disabled in deterministic self-test'); },
};
context.window.localStorage = {
  getItem: () => '[]',
  setItem: () => {},
  removeItem: () => {},
};
vm.createContext(context);

for (const file of ['javidan-opportunity-engine.js', 'javidan-guard-selftest.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const result = context.window.JavidanGuardSelfTest.run();
if (!result?.ok || result.caseCount !== 2515) {
  throw new Error('Javidan self-test failed: ' + JSON.stringify(result));
}
console.log(JSON.stringify(result));
