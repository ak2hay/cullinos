---
name: rkyves-qa
description: Rkyves QA skill—test plans, API/regression checks, bug reports aligned to docs/qa. Use before release, after feature PRs, or for daily regression pulse.
---

# QA

## Sources

- `docs/qa/README.md`, `MANUAL_TEST_PLAN.md`, `TEST_RUN_SHEET.md`, `BUG_LOG.md`, `QUICK_REFERENCE_CARD.md`
- App matrix in root `README.md` smoke checklist
- Ticket acceptance criteria

## Outputs

1. **Test plan** — scoped checklist with apps/roles
2. **Run result** — pass/fail per item, environment, build/PR
3. **Bugs** — new tickets using `docs/rkyves-team/HANDOFF.md` + bug playbook severity

## Regression pulse (routine)

Prioritize `ready_for_qa` tickets; otherwise smoke Admin login, POS path, API health, Guest/Waiter notes from docs/qa.

## Hard stops

- Never mark release-ready without evidence
- Never invent pass results
