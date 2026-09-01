# Cullinos Manual QA Pack

Production-focused manual testing documentation for full functionality verification across all Cullinos apps.

## New tester? Start here

**[QA_QUICK_START.md](./QA_QUICK_START.md)** — portal URLs, credential worksheet, 30-minute first steps, and app cheat sheet. Read this before anything else.

## Documents

| File | Purpose |
|------|---------|
| [QA_QUICK_START.md](./QA_QUICK_START.md) | **Onboarding guide** — URLs, credentials, day-1 steps for new testers |
| [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) | Master test plan — phases, workflows, expected results, known limitations |
| [CREDENTIALS_LOG.md](./CREDENTIALS_LOG.md) | Template to record logins, org slugs, outlet IDs, and URLs |
| [BUG_LOG.md](./BUG_LOG.md) | Template for structured defect tracking |
| [TEST_RUN_SHEET.md](./TEST_RUN_SHEET.md) | Per-run execution checklist (Pass / Fail / Blocked / N/A) |

## How to use

1. **Start a new run** — copy the three templates into a dated folder:
   ```text
   docs/qa/runs/RUN-YYYYMMDD/
   ├── CREDENTIALS_LOG.md   (filled)
   ├── BUG_LOG.md           (filled as issues found)
   └── TEST_RUN_SHEET.md    (filled during execution)
   ```
2. **Follow the plan** — execute phases in order from [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md).
3. **Log everything** — credentials (references only), defects, and pass/fail status per test case.
4. **Never commit secrets** — the `runs/` folder is gitignored; store real passwords in a password manager.

## Test context

| Setting | Value |
|---------|-------|
| Environment | Production |
| Tenant | Fresh onboard via Super Admin (not demo seed) |
| Plan | `enterprise` (unlocks all modules) |
| Staff | 1 employee (Waiter) created by owner in Admin → Staff |

### Role assignment

| Role | Who tests | How created |
|------|-----------|-------------|
| Super Admin | Platform ops (you) | Existing platform login |
| Owner | You | Super Admin onboarding |
| Staff (1 person) | Your employee | Admin → Staff |
| Guest customer | You (incognito / second browser) | No login |

## Production URLs

| App | URL |
|-----|-----|
| API health | https://api.cullinos.com/api/v1/health |
| API DB health | https://api.cullinos.com/api/v1/health/db |
| Swagger | https://api.cullinos.com/docs |
| Super Admin | https://platform.cullinos.com |
| Admin | https://admin.cullinos.com |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| Customer storefront | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |

### Local-only apps (optional)

POS and KDS are not deployed to Vercel. To test cashier and kitchen screens against production:

```bash
# From repo root, with env pointing at production API
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/pos
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/kds
```

| App | Local port | Notes |
|-----|------------|-------|
| POS | 5173 | Requires Cashier account |
| KDS | 5174 | Kitchen: `?outletId=<id>` — Pickup: `?outletId=<id>&mode=pickup` |

## Preflight checklist

Complete before starting Phase 1:

- [ ] `GET https://api.cullinos.com/api/v1/health` returns OK
- [ ] `GET https://api.cullinos.com/api/v1/health/db` returns OK
- [ ] Super Admin login works at https://platform.cullinos.com
- [ ] Password manager or secure storage ready for credentials
- [ ] Two browsers ready (main + incognito for guest ordering)
- [ ] Run folder created: `docs/qa/runs/RUN-YYYYMMDD/`
- [ ] Templates copied into run folder
- [ ] Optional: local POS/KDS configured against production API

## Recommended schedule (single tester + one employee)

| Day | Phases | Activities |
|-----|--------|------------|
| 1 | 0–1 | Preflight, onboard tenant, wizard, menu, create staff |
| 2 | 2 | Employee: Waiter flow; You: guest checkout, KDS verify |
| 3 | 3–5 | Admin modules, Management, Super Admin ops |
| 4 | 6–7 | Marketing site, Swagger API smoke |

## Security

- **Do not** paste production passwords into markdown files or commit them to git.
- Use password-manager references (e.g. "PM entry #42") in the Credentials Log.
- Super Admin access: use your secure credential store (e.g. `secrets-export.txt` locally — never commit).
- QA tenant only for destructive tests (suspend/reactivate, plan changes).

## Known limitations (not bugs)

See [MANUAL_TEST_PLAN.md — Out of scope](./MANUAL_TEST_PLAN.md#out-of-scope--expected-na-items).

## Related docs

- [README.md](../../README.md) — Quick start and smoke checklist
- [e2e/README.md](../../e2e/README.md) — Automated E2E alternative
- [DEPLOYMENT.md](../DEPLOYMENT.md) — Production domains and env vars
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System topology
