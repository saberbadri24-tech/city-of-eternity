#!/usr/bin/env node
const wallet = process.env.TON_MAIN_WALLET || "";
const password = process.env.ANIL_ADMIN_PASSWORD || "";

const walletLooksValid = /^UQ[A-Za-z0-9_-]{46,}$/.test(wallet);
const passwordLooksValid = /^.{9}$/.test(password);

const result = {
  status: walletLooksValid && passwordLooksValid ? "owner_runtime_ready" : "owner_runtime_blocked",
  checks: {
    TON_MAIN_WALLET: { configured: Boolean(wallet), formatValid: walletLooksValid },
    ANIL_ADMIN_PASSWORD: { configured: Boolean(password), formatValid: passwordLooksValid }
  },
  safety: {
    secretValuesPrinted: false,
    secretValuesCommitted: false
  }
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "owner_runtime_ready" ? 0 : 1);
