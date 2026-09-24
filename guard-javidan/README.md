# ANIL X — Guard Javidan

## Control plane
- Discovery: public-source discovery only.
- Verification: official-source/evidence gate.
- Intelligence: Astra deterministic triage + optional Gemini/Claude advisory review.
- Security: fail-closed Immortal Guard contract.
- Owner gate: admin login + TON Connect for any consequential wallet signature.

## Money flow
1. A reward that is directly payable to the configured public destination may be monitored as a direct receipt.
2. Otherwise the opportunity is queued until the official claim path is verified.
3. No seed/private key is collected.
4. No automatic wallet signature.
5. No automatic transfer from temporary to main wallet.
6. Main-wallet movement requires the owner session and an explicit wallet signature.

## Operational files
- `../guard-wallet.json`
- `../guard-status.json`
- `../guard-approvals.json`
- `../guard-receipts.json`
- `../guard-claim-adapters.json`
- `../guard-agent-contract.json`
- `../scripts/airdrop_guard.py`
- `../scripts/free_real_token_engine.py`
- `../scripts/guard_ton_receipts.py`
