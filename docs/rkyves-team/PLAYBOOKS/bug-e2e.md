# Playbook: Bug Fix

**Group:** Bug Fix  
**Skill:** `/rkyves-orchestrate-e2e`

## Stages

| Stage | Owner | Exit criteria |
|-------|-------|---------------|
| 1. Triage | Customer Success | Repro steps, severity, affected app/role |
| 2. Reproduce | QA (or Dev) | Confirmed on staging/local; ticket updated |
| 3. Fix | Dev Backend / Frontend / Flutter | Branch + PR to develop |
| 4. Verify | QA | Fix confirmed; regression notes |
| 5. Reply draft | Customer Success | Draft customer reply (human sends) |
| 6. Human gate | Human | Merge; optional notify customer |

## Bug report minimum (CS → ticket)

- Environment: staging / production / app version
- Steps to reproduce
- Expected vs actual
- Org/outlet context if multi-tenant (no secrets)
- Screenshots in `/workspace/rkyves/artifacts/` if useful

## Severity

| Level | Meaning |
|-------|---------|
| P0 | Outage / payments broken / data leak risk |
| P1 | Major feature broken, workaround poor |
| P2 | Degraded UX, workaround exists |
| P3 | Cosmetic / minor |

P0: also notify **Incident** group if production impact.
