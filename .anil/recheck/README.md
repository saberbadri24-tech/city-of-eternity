# ANIL X — RECHECK QUEUE

Items intentionally parked because they are not safe to mark green without stronger live evidence.

## YELLOW-01 — Control-plane duplicate branch
- File: functions/api/anil-control-plane.mjs
- Issue: duplicate read_render_logs branch in the read-only adapter chain.
- Current state: harmless duplicate, not executed as a separate behavior.
- Recheck: remove duplicate and run full CI/live QA.

## YELLOW-02 — Direct GitHub adapter configuration
- Adapter supports direct API when GITHUB_TOKEN/GH_TOKEN exists.
- Otherwise controlled GitHub Actions path is used.
- Recheck: verify runtime secret configuration without exposing secret values.

## YELLOW-03 — Direct Render API adapter configuration
- Adapter supports direct Render API when RENDER_API_KEY/RENDER_TOKEN exists.
- Otherwise runtime health/deploy evidence is used.
- Recheck: verify runtime secret configuration without exposing secret values.

## YELLOW-04 — Revenue readiness
- Real revenue must remain $0 until a real settled payment is evidenced.
- Recheck: Variza + USD/IRR FX + durable accounting + end-to-end customer checkout.

## YELLOW-05 — AI provider liveness
- Configured model aliases must not be treated as proof of live provider access.
- Recheck: perform a real provider health test when credentials are available.

## YELLOW-06 — Immortal Guard provider verification
- Guard remains safe/approval-gated.
- Recheck: confirm current Astra/Claude/Gemini run evidence and opportunity verification.

## Rule
Do not convert any item to GREEN from configuration alone. Each item needs fresh runtime/CI evidence.