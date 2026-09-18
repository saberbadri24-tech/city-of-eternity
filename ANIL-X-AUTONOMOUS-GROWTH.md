# ANIL X — Autonomous Cloud Growth Architecture

## Objective
Keep ANIL X continuously improving without pretending that an AI can safely rewrite production every second.

## Loop
observe -> research -> propose -> sandbox -> test -> score -> approve/promote -> deploy -> verify -> learn

## Cadence
- Every request: lightweight telemetry + health signals
- Every 5 minutes: health/latency/error checks
- Hourly: detect regressions and stale content
- Daily: research + competitor/technology scan + improvement proposals
- Weekly: deeper architecture review and cleanup
- Event-driven: security/payment/runtime alerts immediately

## Cloud state
Persist durable improvement state in a site-scoped cloud store:
- research findings
- candidate improvements
- test/evaluation results
- deployment/rollback metadata
- product metrics
- content freshness
- approved capabilities

Do not store raw private prompts by default. Prefer derived, non-sensitive signals.

## Safe autonomy boundary
The system can autonomously:
- research public sources
- detect regressions
- generate proposals
- create sandbox candidates
- run deterministic tests
- compare candidates
- prepare release notes
- recommend promotion

The system must not autonomously:
- spend money
- change payment settlement
- expose secrets
- alter DNS/domain ownership
- publish destructive production changes
- rewrite security controls without review

## Continuous-learning rule
New methods are not automatically better. A candidate replaces an existing method only when:
1. tests pass,
2. performance is not worse,
3. security/privacy checks pass,
4. rollback is available,
5. the change is within an approved autonomy policy.

## Key principle
ANIL X should be **continuously improving, not continuously mutating**.
