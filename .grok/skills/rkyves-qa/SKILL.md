---
name: rkyves-qa
description: Rkyves QA skill—test plans, API/regression checks, full functionality test, bug reports aligned to docs/qa. Use before release, after feature PRs, or for daily regression pulse.
---

# QA

## Sources

- `docs/qa/README.md`, `docs/qa/guides/` (`COMPLETE_FEATURE_TEST_GUIDE.md`, `MANUAL_TEST_PLAN.md`, `QUICK_REFERENCE_CARD.md`)
- `docs/qa/sheets/` (`TEST_RUN_SHEET.md`, `BUG_LOG.md`)
- `e2e/README.md` (Playwright)
- App matrix in root `README.md` smoke checklist
- Ticket acceptance criteria

## Outputs

1. **Test plan** — scoped checklist with apps/roles
2. **Run result** — pass/fail per item, environment, build/PR
3. **Bugs** — new tickets using `docs/rkyves-team/HANDOFF.md` + bug playbook severity

## Regression pulse (routine)

Prioritize `ready_for_qa` tickets; otherwise smoke Admin login, POS path, API health, Guest/Waiter notes from docs/qa.

## Full functionality test

Follow `docs/rkyves-team/PLAYBOOKS/full-regression-e2e.md`: Playwright on the pinned QA tenant, map results to TC IDs, browser pass over the rest of `TEST_RUN_SHEET.md`, human-assisted batch, report + sign-off request.

## Hard stops

- Never mark release-ready without evidence
- Never invent pass results
- Full test runs only against the QA tenant: `E2E_ORG_SLUG` pinned, `E2E_SUPER_ADMIN_*` blank; stop if `e2e/.runtime-env.json` resolves another org
- No platform logins (Super Admin, App Ops, Support agent) — human takeover only
