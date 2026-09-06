# QA Export Pack

Generated files for hiring manual testers. Regenerate from repo root:

```bash
npm run qa:export
```

## PDF (`pdf/`)

| File | Source |
|------|--------|
| Whats_New.pdf | WHATS_NEW.md |
| QA_Tester_Handbook.pdf | TESTER_HANDBOOK.md |
| Quick_Reference_Card.pdf | QUICK_REFERENCE_CARD.md |
| Employee_Brief.pdf | EMPLOYEE_BRIEF.md |

If PDF generation fails (no Chrome/Edge), HTML files are written to `html/` — open in browser → Print → Save as PDF.

HTML sources are always generated alongside PDFs for easy re-printing.

## Excel (`excel/`)

| File | Purpose |
|------|---------|
| TEST_RUN_SHEET.xlsx | **160** test cases with Pass/Fail/Blocked/N/A dropdowns |
| BUG_LOG.xlsx | Defect log with severity dropdowns |
| CREDENTIALS_LOG.xlsx | Credential worksheet (no password columns) |

Copy Excel files to `docs/qa/runs/RUN-YYYYMMDD/` before filling (that folder is gitignored).
