# Cullinos Manual QA Pack

Production-focused manual testing for every Cullinos portal.

```text
docs/qa/
├── README.md                 ← you are here
├── guides/                   ← how to test (markdown)
│   ├── COMPLETE_FEATURE_TEST_GUIDE.md   ★ click every feature
│   ├── TESTER_HANDBOOK.md               day 1–4 plan
│   ├── MANUAL_TEST_PLAN.md
│   ├── QA_QUICK_START.md
│   ├── WHATS_NEW.md
│   ├── EMPLOYEE_BRIEF.md
│   └── QUICK_REFERENCE_CARD.md
├── sheets/                   ← fillable markdown templates
│   ├── TEST_RUN_SHEET.md     (190 cases)
│   ├── BUG_LOG.md
│   └── CREDENTIALS_LOG.md
├── export/                   ← generated pack for hires
│   ├── pdf/                  ★ share these
│   ├── html/                 print fallback
│   └── excel/
└── runs/                     ← private per-run copies (gitignored)
    └── RUN-YYYYMMDD/
```

---

## New tester? Start here

1. **[guides/WHATS_NEW.md](guides/WHATS_NEW.md)** — what changed this cycle  
2. **[guides/COMPLETE_FEATURE_TEST_GUIDE.md](guides/COMPLETE_FEATURE_TEST_GUIDE.md)** — every portal/page click-path (+ URLs & commands)  
3. **[guides/TESTER_HANDBOOK.md](guides/TESTER_HANDBOOK.md)** — day-by-day plan  
4. **[guides/QA_QUICK_START.md](guides/QA_QUICK_START.md)** — URLs + 30-minute first steps  

**PDF pack (after export):** [`export/pdf/Complete_Feature_Test_Guide.pdf`](export/pdf/Complete_Feature_Test_Guide.pdf)

---

## Commands

### Regenerate PDF + Excel

From repo root:

```bash
npm install
npm run qa:export
```

Or separately:

```bash
node scripts/generate-qa-pdf.mjs
node scripts/generate-qa-excel.mjs
```

### Preflight API

```bash
curl -sS https://api.cullinos.com/api/v1/health
curl -sS https://api.cullinos.com/api/v1/health/db
```

### Start a run folder (Windows PowerShell)

```powershell
$run = "docs/qa/runs/RUN-$(Get-Date -Format yyyyMMdd)"
New-Item -ItemType Directory -Force -Path "$run/evidence" | Out-Null
Copy-Item docs/qa/export/excel/*.xlsx $run/
```

### Start a run folder (bash)

```bash
RUN="docs/qa/runs/RUN-$(date +%Y%m%d)"
mkdir -p "$RUN/evidence"
cp docs/qa/export/excel/*.xlsx "$RUN/"
```

---

## Hire pack (share these files)

| # | File | Purpose |
|---|------|---------|
| 1 | [`export/pdf/Whats_New.pdf`](export/pdf/Whats_New.pdf) | New features |
| 2 | [`export/pdf/Complete_Feature_Test_Guide.pdf`](export/pdf/Complete_Feature_Test_Guide.pdf) | **Full click-path guide** |
| 3 | [`export/pdf/QA_Tester_Handbook.pdf`](export/pdf/QA_Tester_Handbook.pdf) | Day plan |
| 4 | [`export/pdf/QA_Quick_Start.pdf`](export/pdf/QA_Quick_Start.pdf) | URLs + first 30 min |
| 5 | [`export/pdf/Manual_Test_Plan.pdf`](export/pdf/Manual_Test_Plan.pdf) | Phase overview |
| 6 | [`export/pdf/Quick_Reference_Card.pdf`](export/pdf/Quick_Reference_Card.pdf) | 1-page desk card |
| 7 | [`export/pdf/Employee_Brief.pdf`](export/pdf/Employee_Brief.pdf) | Job expectations |
| 8 | [`export/excel/TEST_RUN_SHEET.xlsx`](export/excel/TEST_RUN_SHEET.xlsx) | Mark **190** cases |
| 9 | [`export/excel/BUG_LOG.xlsx`](export/excel/BUG_LOG.xlsx) | Defects |
| 10 | [`export/excel/CREDENTIALS_LOG.xlsx`](export/excel/CREDENTIALS_LOG.xlsx) | Slugs / emails only |

Hand Super Admin login securely (password manager) — never in Excel.

---

## Markdown sources

### Guides (`guides/`)

| File | Purpose |
|------|---------|
| [COMPLETE_FEATURE_TEST_GUIDE.md](guides/COMPLETE_FEATURE_TEST_GUIDE.md) | Master click-path guide + URLs/commands |
| [WHATS_NEW.md](guides/WHATS_NEW.md) | Cycle changelog |
| [TESTER_HANDBOOK.md](guides/TESTER_HANDBOOK.md) | Day 1–4 |
| [QA_QUICK_START.md](guides/QA_QUICK_START.md) | Quick start |
| [MANUAL_TEST_PLAN.md](guides/MANUAL_TEST_PLAN.md) | Phase plan |
| [EMPLOYEE_BRIEF.md](guides/EMPLOYEE_BRIEF.md) | Hire brief |
| [QUICK_REFERENCE_CARD.md](guides/QUICK_REFERENCE_CARD.md) | Printable card |

### Sheets (`sheets/`)

| File | Purpose |
|------|---------|
| [TEST_RUN_SHEET.md](sheets/TEST_RUN_SHEET.md) | **190** cases (source of truth for Excel) |
| [BUG_LOG.md](sheets/BUG_LOG.md) | Defect template |
| [CREDENTIALS_LOG.md](sheets/CREDENTIALS_LOG.md) | Credential template |

---

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
| Waiter | Cullinos Waiter Android |
| POS | https://pos.cullinos.com |
| KDS | https://kds.cullinos.com |
| Cullinos App | https://guest.cullinos.com/o/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |

---

## Test context

| Setting | Value |
|---------|-------|
| Environment | Production |
| Tenant | Fresh onboard via Super Admin |
| Plan | `enterprise` |
| Business type | `restaurant` (medium/large) |
| Staff | 1 Waiter + 1 Cashier via Admin → Staff |
| Cases | **190** |

---

## Security

- Do **not** commit passwords or filled `runs/` folders.
- Use password-manager references in Credentials Log.
- Destructive Super Admin actions only on QA tenants.

## Related

- [Root README](../../README.md) · [PRODUCT.md](../PRODUCT.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [e2e/README.md](../../e2e/README.md)
