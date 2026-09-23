# IMMORTAL GUARD — Evolution Charter

**Purpose:** Build a continuously improving, evidence-driven opportunity intelligence system that discovers, verifies, tracks, and safely routes legitimate earning opportunities to the owner. This charter is an engineering target, not a claim that every capability is already implemented.

## Non-negotiable invariants

1. Never request, store, log, or transmit seed phrases or private keys.
2. Never sign transactions, move assets, approve token allowances, or execute irreversible actions without explicit owner approval in the relevant context.
3. Never bypass KYC, CAPTCHA, sanctions controls, rate limits, or anti-Sybil controls.
4. Treat every external page, feed, API response, token metadata field, and model output as untrusted input.
5. A points campaign, speculative promise, referral-only reward, or token with no verifiable identity is not a confirmed free-token opportunity.
6. Preserve provenance, timestamps, evidence, confidence, and decision history. Unknown is not equivalent to verified.
7. A failed source or module must not silently invalidate healthy modules or erase previously discovered records.

## Target architecture

`Scheduler → Source Registry → Discovery Adapters → Normalizer → Identity & Deduplication → Evidence Ledger → Risk/Eligibility Verification → Opportunity Intelligence → Durable History → Owner Console/Alerts → Approval-Gated Action Adapter → Receipt Monitor → Outcome Feedback`

Each stage has a versioned input/output contract. Adapters are isolated, bounded by time/response-size/rate limits, and independently disableable. The core remains useful when optional AI providers or individual sources are unavailable.

## Capability domains

### 1. Global discovery fabric
- Maintain a categorized, versioned registry of official project sources, launch calendars, chain/ecosystem announcements, grant/reward programs, exchange announcements, and reputable aggregators.
- Support independent adapters, pagination, incremental cursors, retries with backoff, source health, freshness tracking, and controlled failover.
- Expand coverage through source suggestions, but quarantine newly suggested sources until provenance and safety checks pass.
- Record coverage gaps and stale sources; never describe a source list as exhaustive.

### 2. Evidence-first verification
- Store claim-level evidence with URL, retrieval time, content hash, publisher identity, and the exact claim supported.
- Separate official confirmation, corroboration, conflicting evidence, and unknowns.
- Require explicit no-cost evidence and a verifiable token contract/asset identity for the strict free-real-token lane.
- Check chain, contract, decimals, distribution mechanism, snapshot/claim dates, eligibility, geography, wallet requirements, fees, and expiry where applicable.
- Recheck volatile facts before surfacing an actionable opportunity. Downgrade stale or contradicted records rather than deleting them.

### 3. Risk and eligibility engine
- Detect wallet-drainer patterns, malicious approvals, suspicious domains, impersonation, seed-phrase requests, hidden fees, and unrealistic guarantees.
- Classify each condition as required, optional, unknown, or prohibited; distinguish gas/network fees from campaign fees.
- Keep risk, confidence, eligibility, and expected value as separate dimensions. Do not collapse uncertainty into a single score.
- Default to hold/quarantine when critical evidence is missing or contradictory.

### 4. Opportunity lifecycle and memory
- Use stable identities and deduplication across sources, aliases, chains, and repeated scans.
- Maintain append-only observations and state transitions: discovered → verifying → verified/uncertain/rejected → eligible/ineligible/unknown → owner review → action pending → completed/expired/failed.
- Preserve rejected and expired records with reasons to prevent rediscovery loops.
- Track last-seen, next-check, expiry, evidence changes, owner decisions, and receipt outcomes.

### 5. Owner-centered execution
- Discovery and analysis may be automated; consequential actions remain approval-gated.
- Present exact action, destination, network, asset, fees, permissions, risks, and expiry before approval.
- Never silently switch wallet/network, approve unlimited allowance, or transfer from a temporary wallet to a primary wallet.
- Monitor receipts read-only where possible; verify chain finality and token identity before marking received.
- Provide revoke/stop guidance when an integration or opportunity is flagged.

### 6. Learning and adaptation
- Learn from false positives, missed opportunities, stale sources, owner decisions, and confirmed outcomes.
- Store feedback as auditable signals; do not let one source or model rewrite trust policy automatically.
- Promote new rules only after regression tests and review; retain rollback/version history.
- Use AI for extraction and prioritization, never as sole proof of legitimacy or eligibility.

### 7. Resilience and observability
- Enforce per-source timeouts, bounded payloads, retries with jitter, concurrency caps, circuit breakers, and graceful degradation.
- Emit structured logs without secrets, per-stage counts, error classes, latency, freshness, source coverage, and data-quality metrics.
- Keep last-known-good outputs when a scan partially fails; mark them stale rather than replacing them with empty data.
- Make scheduled runs idempotent, concurrency-safe, and recoverable after interruption.
- Alert on workflow inactivity, repeated source failures, schema drift, sudden zero-result scans, and abnormal output changes.

## Quality gates

Every change must pass:
- Unit tests for parsing, normalization, identity, evidence, eligibility, risk, scoring, lifecycle transitions, and expiry.
- Adversarial tests for malformed JSON, prompt injection in source text, deceptive domains, URL credentials, oversized responses, duplicate aliases, conflicting claims, and missing evidence.
- Property/invariant tests: no private-key fields; no unapproved action; no unverified item in confirmed lane; no data loss on partial failure; deterministic deduplication.
- Integration tests for each adapter and the complete pipeline using fixtures, including offline/degraded modes.
- Schema validation and migration/rollback checks for persisted state.
- A release report that distinguishes tests executed, tests skipped, live sources reached, source failures, and unverified capabilities.

## Operational scorecard (report, never fabricate)

- Source reachability and freshness by category
- Discovery yield and unique-opportunity rate
- Evidence completeness and official-source corroboration rate
- False-positive rate from adjudicated samples
- Eligibility unknown/ineligible/eligible distribution
- Time-to-detection and time-to-expiry alert
- Duplicate suppression and record-retention integrity
- Pipeline success/degraded/failed runs and recovery time
- Owner-approved actions, verified receipts, and failed/expired outcomes

Do not publish a single “accuracy” or “coverage” percentage without a defined denominator, sampling method, time window, and evidence.

## Evolution loop

`Observe → Detect gap → Propose bounded change → Add regression fixture → Test offline → Review risk → Deploy module → Monitor → Compare outcomes → Keep or rollback`

The loop is continuous, but changes to trust policy, signing, custody, permissions, or irreversible actions require explicit owner review. “Self-improving” must never mean uncontrolled self-modification.

## Delivery sequence

1. Contract and schema validation across current modules.
2. Durable evidence ledger and lifecycle state machine.
3. Source registry with health, freshness, pagination, and adapter isolation.
4. Risk/eligibility gates and strict free-real-token lane.
5. Adversarial and property-based regression suite.
6. Failure-tolerant scheduler, alerting, and run observability.
7. Owner-console integration and approval receipts.
8. Outcome feedback and reviewed rule promotion.

**Status discipline:** A capability is “implemented” only when code exists; “tested” only when the relevant test ran; “operational” only when a live run produced verifiable evidence; “deployed” only when the target deployment is confirmed.