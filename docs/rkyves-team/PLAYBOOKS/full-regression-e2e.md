# Playbook: Full functionality test

**Owner:** QA  
**Group:** Release (or DM to QA)  
**Skill:** `/rkyves-qa`

Hybrid run: Playwright e2e first, then a browser pass over every remaining case in [`docs/qa/sheets/TEST_RUN_SHEET.md`](../../qa/sheets/TEST_RUN_SHEET.md). Click paths: [`docs/qa/guides/COMPLETE_FEATURE_TEST_GUIDE.md`](../../qa/guides/COMPLETE_FEATURE_TEST_GUIDE.md). There is no staging — every run hits **production** on the dedicated QA tenant.

## Stages

| Stage | Owner | Exit criteria |
|-------|-------|---------------|
| 0. Preflight | QA | Run folder + run ticket exist; API health OK; `e2e/.env.local` present (human-written) |
| 1. Automation | QA | Playwright finished on the pinned QA tenant; `.runtime-env.json` slug verified |
| 2. Map results | QA | Every spec result copied to its TC rows (table below) |
| 3. Browser pass | QA | Every remaining bot-runnable TC marked with evidence |
| 4. Human-assisted | Human + QA | Platform / device / destructive cases done via takeover, or left `Blocked (human-assisted)` |
| 5. Report | QA | Run ticket `review`; bugs filed; sign-off requested from human |

## Hard stops

- **Tenant pin.** `E2E_ORG_SLUG` / `E2E_OUTLET_SLUG` = QA tenant; `E2E_SUPER_ADMIN_*` **blank**. Without a super admin token, [`e2e/global-setup.ts`](../../../e2e/global-setup.ts) cannot fall back to discovering *any* active production org or auto-provisioning one. After Stage 1, if `orgSlug` in `e2e/.runtime-env.json` ≠ QA slug → stop the run, set ticket `blocked`, ping human.
- **No platform logins for bots** ([PLATFORM_STAFF.md](../PLATFORM_STAFF.md)). Super Admin, App Ops and Support **agent** cases run only in a human computer-takeover session.
- **Credentials** only via takeover (human writes `e2e/.env.local`). Never echo env files, tokens or passwords into chat, tickets, artifacts or screenshots.
- **Destructive cases** (TC-5-13/14 suspend/reactivate, employee onboarding) need explicit human approval in chat first, QA tenant only.
- **No real money.** Razorpay pay-now is N/A unless tenant test keys exist. No customer-facing sends (SMS, push, promo email): drafts only.
- **Evidence or it didn't pass.** Pass = Playwright result or screenshot path. Never invent results; never declare release-ready.

## Stage 0 — Preflight

```bash
cd /workspace/cullinos && git checkout develop && git pull
RUN="RUN-$(date +%Y%m%d)"; ART="/workspace/rkyves/artifacts/$RUN"
mkdir -p "$ART/evidence"
cp docs/qa/sheets/TEST_RUN_SHEET.md docs/qa/sheets/BUG_LOG.md "$ART/"
curl -sS https://api.cullinos.com/api/v1/health
curl -sS https://api.cullinos.com/api/v1/health/db
```

- Create `/workspace/rkyves/tickets/YYYYMMDD-full-regression.md` per [HANDOFF.md](../HANDOFF.md): `type: release`, `owner_bot: QA`, `status: in_progress`.
- Confirm `e2e/.env.local` exists (do not print it). If missing, ask the human to create it by takeover from `e2e/.env.example` with: QA org/outlet slugs + outlet id, QA owner, waiter and cashier creds, `E2E_SKIP_POS=false`, `E2E_POS_URL=https://pos.cullinos.com`, `E2E_KDS_URL=https://kds.cullinos.com`, super admin fields blank.

## Stage 1 — Automation

```bash
npm ci && npx playwright install chromium
npx playwright test --project=api --project=web --project=admin --project=management \
  --project=pos --project=kds --project=order-flow
node -e "console.log(require('./e2e/.runtime-env.json').orgSlug)"   # must equal QA slug
cp -r playwright-report e2e-results.json "$ART/"; cp -r test-results "$ART/" 2>/dev/null || true
```

The `super-admin` project is excluded (needs platform creds). Run it only inside a human takeover session in Stage 4.

## Stage 2 — Map spec results to TC IDs

| Spec | Marks Pass/Fail | Supporting only (still click-test) |
|------|-----------------|------------------------------------|
| `api.spec.ts` | TC-0-01, TC-7-01 | — |
| `web.spec.ts` | TC-6-01, TC-6-02, TC-6-03 | — |
| `admin.spec.ts` | TC-1.2-01 | TC-3-01 (greeting only, not KPI cards) |
| `management.spec.ts` | TC-4-01, TC-4-02 | TC-4-05 (page load only) |
| `pos.spec.ts` | TC-2.2-01 | — |
| `kds.spec.ts` | — | TC-2.1-07 (API shape) |
| `order-flow.spec.ts` | — | TC-2.1-07 (KOT reaches kitchen API) |
| `super-admin.spec.ts` (Stage 4) | TC-0-04 | TC-5-01, TC-5-04 |

A skipped spec marks nothing; note the skip reason in the TC row.

## Stage 3 — Browser pass

Work phase by phase in TEST_RUN_SHEET order, following the matching COMPLETE_FEATURE_TEST_GUIDE section. Bot-runnable roles: Owner, Cashier, Waiter (web), Guest (incognito), Support portal **restaurant** login.

- Screenshot each Pass/Fail to `$ART/evidence/<TC-ID>.png`; put the path in the Notes column.
- Business-type gated pages → N/A per guide §2 (Gating matrix).
- Known limitations (BUG_LOG KL-*) → N/A with the KL id, not a bug.

## Stage 4 — Human-assisted cases

Ask the human for one takeover session and batch these:

| Area | Cases |
|------|-------|
| Super Admin | TC-0-04, TC-1.1-*, TC-1.4-02, TC-5-* (+ `super-admin` Playwright project) |
| App Ops | TC-5-21..28, TC-9-* |
| Support agent | TC-8-05..10 |
| Android (Waiter / Guest app) | TC-2.1-01..06, TC-2.7-* |
| Destructive | TC-5-13, TC-5-14, TC-5-32 (approval required) |

If no session happens, mark them `Blocked` with note `human-assisted`.

## Stage 5 — Report

- Each Fail → bug ticket `/workspace/rkyves/tickets/YYYYMMDD-bug-<slug>.md` (`type: bug`, `group: Bug Fix`) **and** a BUG_LOG row in `$ART/BUG_LOG.md` with the TC id. Severity map: Critical = P0, High = P1, Medium = P2, Low = P3 ([bug-e2e.md](./bug-e2e.md)). P0 with production impact → also ping **Incident**.
- Fill the TEST_RUN_SHEET results summary and Fail / Blocked summary.
- Post in the group / DM:

```
Full functionality test RUN-YYYYMMDD — develop @ <sha>, QA tenant <slug>
Pass X | Fail X | Blocked X | N/A X | Total <sheet total>
P0/P1: <ticket ids or none>
Human-assisted still open: <TC ids or none>
Evidence: /workspace/rkyves/artifacts/RUN-YYYYMMDD/
Requesting human sign-off — not release-ready until approved.
```

- Set run ticket `status: review`, add a timeline row, tick `Human approvals needed → Other: QA sign-off`.

## Kickoff (paste from phone)

```
@Release Outcome: Full functionality test of production on the QA tenant.
Owner this stage: @QA
Playbook: docs/rkyves-team/PLAYBOOKS/full-regression-e2e.md
Constraints: QA tenant only; no platform logins (I'll take over for Super Admin / App Ops / Support agent); no destructive cases without my OK; no customer sends.
Done when: run report posted with counts, P0/P1 tickets, evidence path, and sign-off request.
Ticket: /workspace/rkyves/tickets/YYYYMMDD-full-regression.md
```
