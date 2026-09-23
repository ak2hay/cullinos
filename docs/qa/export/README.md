# QA Export Pack

Generated files for hiring manual testers and sharing with the team.

## Regenerate

From repo root:

```bash
npm install
npm run qa:export
```

Or:

```bash
node scripts/generate-qa-pdf.mjs    # markdown → HTML → PDF
node scripts/generate-qa-excel.mjs  # Excel templates
```

## Folder layout

```text
export/
├── pdf/     ← share with testers
├── html/    ← open in browser → Print → Save as PDF if Chrome missing
└── excel/   ← copy into docs/qa/runs/RUN-YYYYMMDD/
```

## PDF (`pdf/`)

| File | Source |
|------|--------|
| **Complete_Feature_Test_Guide.pdf** | `guides/COMPLETE_FEATURE_TEST_GUIDE.md` |
| Whats_New.pdf | `guides/WHATS_NEW.md` |
| QA_Tester_Handbook.pdf | `guides/TESTER_HANDBOOK.md` |
| Manual_Test_Plan.pdf | `guides/MANUAL_TEST_PLAN.md` |
| QA_Quick_Start.pdf | `guides/QA_QUICK_START.md` |
| Quick_Reference_Card.pdf | `guides/QUICK_REFERENCE_CARD.md` |
| Employee_Brief.pdf | `guides/EMPLOYEE_BRIEF.md` |

If PDF generation fails (no Chrome/Edge), use the matching file in `html/`.

## Excel (`excel/`)

| File | Purpose |
|------|---------|
| TEST_RUN_SHEET.xlsx | **190** test cases with Pass/Fail/Blocked/N/A |
| BUG_LOG.xlsx | Defect log |
| CREDENTIALS_LOG.xlsx | Slugs / emails (no password columns) |

```powershell
$run = "docs/qa/runs/RUN-$(Get-Date -Format yyyyMMdd)"
New-Item -ItemType Directory -Force -Path "$run/evidence" | Out-Null
Copy-Item docs/qa/export/excel/*.xlsx $run/
```
