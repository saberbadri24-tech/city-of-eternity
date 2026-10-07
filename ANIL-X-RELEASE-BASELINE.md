# ANIL X Global Release Baseline

This commit is the single release baseline for the current ANIL X production state.

Baseline parent: fa3169404ba3470c165d43e3dd91cb68982b722c
Baseline scope:
- ANIL X public site
- Badrkhan public customer chat
- ANIL owner assistant / Control Plane
- unified Immortal Guard / Super Airdrop
- Revenue Fleet and payment/customer path
- production QA, browser QA, contract gates, execution gates
- Render production service: anil-x-live

Release rule:
- From this commit forward, production readiness is judged only against this commit and its descendants.
- Older failed/intermediate commits are historical only and are not release criteria.
- City of Eternity remains separate and is not part of this release scope.

Final release requires all applicable current-commit gates to pass and Render anil-x-live to be live on the same commit lineage.
