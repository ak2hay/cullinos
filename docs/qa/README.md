# Cullinos Manual QA Pack

Production-focused manual testing documentation for full functionality verification across all Cullinos apps.

## New tester? Start here

**[WHATS_NEW.md](./WHATS_NEW.md)** — features added in this QA cycle (share with testers first).

**[TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md)** — plain-English step-by-step guide (Day 1–4). Best for fresh hires.

**[QA_QUICK_START.md](./QA_QUICK_START.md)** — portal URLs, credential worksheet, 30-minute first steps, and app cheat sheet.

## For hiring a tester

Give your employee the QA pack from [`export/`](export/):

| # | File | Purpose |
|---|------|---------|
| 1 | `export/pdf/Whats_New.pdf` | New features for this cycle — read first |
| 2 | `export/pdf/QA_Tester_Handbook.pdf` | Full step-by-step instructions |
| 3 | `export/pdf/Quick_Reference_Card.pdf` | 1-page desk reference (print) |
| 4 | `export/pdf/Employee_Brief.pdf` | Job expectations, deliverables, rules |
| 5 | `export/excel/TEST_RUN_SHEET.xlsx` | Mark Pass / Fail / Blocked / N/A (**160** cases) |
| 6 | `export/excel/BUG_LOG.xlsx` | Log defects with steps and screenshots |
| 7 | `export/excel/CREDENTIALS_LOG.xlsx` | Record slugs, IDs, emails (no real passwords) |

### Generate the pack

From repo root:

```bash
npm install
npm run qa:export
```

This writes PDFs to `docs/qa/export/pdf/` and Excel files to `docs/qa/export/excel/`.

Regenerate after changing test cases in [`TEST_RUN_SHEET.md`](./TEST_RUN_SHEET.md) or handbook content.

### Start a test run

1. Run `npm run qa:export` (or copy existing export files).
2. Copy the Excel files into a dated folder:
   ```text
   docs/qa/runs/RUN-YYYYMMDD/
   ├── TEST_RUN_SHEET.xlsx
   ├── BUG_LOG.xlsx
   ├── CREDENTIALS_LOG.xlsx
   └── evidence/
       └── BUG-001-screenshot.png
   ```
3. Share PDF handbook + What's New + Excel files with the tester (Google Drive, USB, etc.).
4. Hand off Super Admin login securely on Day 1 (password manager — never in Excel).
5. Daily check-in: review Excel Summary sheet and new bug rows.

The `runs/` folder is gitignored — do not commit filled credentials or evidence.

## Documents

| File | Purpose |
|------|---------|
| [WHATS_NEW.md](./WHATS_NEW.md) | **What's new this cycle** — share with testers |
| [TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md) | **Fresh tester guide** — Day 1–4 checklists, glossary, Swagger help |
| [EMPLOYEE_BRIEF.md](./EMPLOYEE_BRIEF.md) | Job brief for hires — deliverables, rules, escalation |
| [QUICK_REFERENCE_CARD.md](./QUICK_REFERENCE_CARD.md) | 1-page printable reference |
| [QA_QUICK_START.md](./QA_QUICK_START.md) | URLs, credentials, 30-minute first steps |
| [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) | Master test plan — phases, workflows, expected results |
| [CREDENTIALS_LOG.md](./CREDENTIALS_LOG.md) | Markdown credential template |
| [BUG_LOG.md](./BUG_LOG.md) | Markdown defect template |
| [TEST_RUN_SHEET.md](./TEST_RUN_SHEET.md) | Markdown test checklist (**160** cases) — source for Excel export |

## How to use (markdown workflow)

1. **Start a new run** — copy templates into a dated folder:
   ```text
   docs/qa/runs/RUN-YYYYMMDD/
   ├── CREDENTIALS_LOG.md   (filled)
   ├── BUG_LOG.md           (filled as issues found)
   └── TEST_RUN_SHEET.md    (filled during execution)
   ```
   Or use the Excel export workflow above (recommended for hires).
2. **Follow the plan** — execute phases in order from [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) or [TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md).
3. **Log everything** — credentials (references only), defects, and pass/fail status per test case.
4. **Never commit secrets** — the `runs/` folder is gitignored; store real passwords in a password manager.

## Test context

| Setting | Value |
|---------|-------|
| Environment | Production |
| Tenant | Fresh onboard via Super Admin (not demo seed) |
| Plan | `enterprise` (unlocks all modules) |
| Business type | `restaurant` (medium/large size preferred) |
| Staff | 1 Waiter + 1 Cashier created by owner in Admin → Staff |

### Role assignment

| Role | Who tests | How created |
|------|-----------|-------------|
| Super Admin | Platform ops (you) | Existing platform login |
| Owner | You | Super Admin onboarding |
| Staff (Waiter) | Your employee | Admin → Staff |
| Staff (Cashier) | You / employee | Admin → Staff |
| Guest customer | You (incognito / second browser) | No login required |

## Production URLs

| App | URL |
|-----|-----|
| API health | https://api.cullinos.com/api/v1/health |
| API DB health | https://api.cullinos.com/api/v1/health/db |
| Swagger | https://api.cullinos.com/docs |
| Super Admin | https://platform.cullinos.com |
| Admin | https://admin.cullinos.com |
| Admin Portal POS | https://admin.cullinos.com/pos |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| POS | https://pos.cullinos.com |
| KDS | https://kds.cullinos.com |
| Customer storefront | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |

### Local dev (optional fallback)

```bash
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/pos
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/kds
```

| App | Local port |
|-----|------------|
| POS | 5173 |
| KDS | 5174 |

## Preflight checklist

Complete before starting Phase 1:

- [ ] `GET https://api.cullinos.com/api/v1/health` returns OK
- [ ] `GET https://api.cullinos.com/api/v1/health/db` returns OK
- [ ] Super Admin login works at https://platform.cullinos.com
- [ ] Password manager or secure storage ready for credentials
- [ ] Two browsers ready (main + incognito for guest ordering)
- [ ] Run folder created: `docs/qa/runs/RUN-YYYYMMDD/`
- [ ] Templates copied into run folder

## Recommended schedule (single tester + one employee)

| Day | Phases | Activities |
|-----|--------|------------|
| 1 | 0–1 | Preflight, onboard tenant, wizard, menu, tables, Waiter + Cashier |
| 2 | 2 | Waiter, production POS/KDS, guest checkout, CDS, Portal POS |
| 3 | 3–5 | Admin modules (incl. new pages), Management, Super Admin ops |
| 4 | 6–7 | Marketing site, Swagger API smoke |

## Security

- **Do not** paste production passwords into markdown files or commit them to git.
- Use password-manager references (e.g. "PM entry #42") in the Credentials Log.
- Super Admin access: use your secure credential store (e.g. `secrets-export.txt` locally — never commit).
- QA tenant only for destructive tests (suspend/reactivate, plan changes).

## Known limitations (not bugs)

See [MANUAL_TEST_PLAN.md — Out of scope](./MANUAL_TEST_PLAN.md#out-of-scope--expected-na-items) and [WHATS_NEW.md](./WHATS_NEW.md).

## Related docs

- [README.md](../../README.md) — Quick start and smoke checklist
- [e2e/README.md](../../e2e/README.md) — Automated E2E alternative
- [DEPLOYMENT.md](../DEPLOYMENT.md) — Production domains and env vars
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System topology
- [Client documents](../client/README.md) — Brochure, Product Overview, User Manual (share with clients)
