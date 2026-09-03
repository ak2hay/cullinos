# Cullinos QA — Employee Brief

**Role:** Manual QA Tester (Production)  
**Duration:** ~4 days (6–8 hours per day)  
**Environment:** Production (cullinos.com)

---

## Your goal

Test all **127 test cases** on the live Cullinos platform. Record results in Excel. Log every failure with steps and screenshots. Return completed work to your team lead.

---

## What you will receive

| # | File | Purpose |
|---|------|---------|
| 1 | QA_Tester_Handbook.pdf | Step-by-step instructions — **read first** |
| 2 | Quick_Reference_Card.pdf | 1-page desk reference |
| 3 | TEST_RUN_SHEET.xlsx | Mark Pass / Fail / Blocked / N/A for each test |
| 4 | BUG_LOG.xlsx | One row per bug found |
| 5 | CREDENTIALS_LOG.xlsx | Record URLs, slugs, IDs (no real passwords) |

Your team lead will also share **Super Admin login** securely on Day 1.

---

## Daily schedule

| Day | Work | Deliverable |
|-----|------|-------------|
| **1** | Health checks, create test restaurant, menu, 1 waiter staff | Phase 0 + 1 rows filled in Excel |
| **2** | Waiter orders, guest checkout, optional KDS/POS | Phase 2 rows filled |
| **3** | Admin modules, Management, Super Admin | Phase 3 + 4 + 5 rows filled |
| **4** | Marketing website, Swagger API tests, sign-off | Phase 6 + 7 rows filled; all files returned |

---

## Your deliverables (end of Day 4)

1. **TEST_RUN_SHEET.xlsx** — all 127 test cases marked; Summary and Sign-off sheets complete
2. **BUG_LOG.xlsx** — every Fail has a bug row with steps, expected, actual, screenshot path
3. **CREDENTIALS_LOG.xlsx** — org slug, outlet slug, outlet ID, emails (password refs only)
4. **evidence/** folder — PNG screenshots named like `BUG-001-screenshot.png`
5. Zip all of the above and send to team lead

---

## How to mark results

| Result | When |
|--------|------|
| **Pass** | Feature works as the handbook describes |
| **Fail** | Wrong behavior — **must** add a bug row + screenshot |
| **Blocked** | You cannot run the test (no access, POS not installed, etc.) |
| **N/A** | Test does not apply (e.g. Razorpay without keys, 1 outlet for comparison) |

**Rule:** Mark tests the **same day** you run them. Do not leave rows blank.

---

## When to escalate (ask team lead)

- Super Admin login does not work
- Health check URLs return errors
- "Failed to fetch" on login pages
- You cannot create tables and Waiter shows empty grid
- Swagger returns 401 after following the JWT guide
- Unsure if something is a bug or a known limitation

Mark the test **Blocked** and message your team lead. Do not mark **Pass** if unsure.

---

## What NOT to do

| Do not | Why |
|--------|-----|
| Put real passwords in Excel, email, or chat | Security policy |
| Suspend or delete **real customer** tenants | Use QA test tenant only |
| Publish marketing CMS changes to live site | Needs team lead approval |
| Mark Fail for Admin Tables/Inventory placeholders | Documented known limitations |
| Skip Fail tests without logging a bug | Every Fail needs a BUG_LOG row |
| Test on demo/local accounts for final sign-off | Production fresh tenant required |

---

## Known limitations (not bugs)

These are expected. Mark **N/A** or note in bug log as "Known limitation":

- Admin **Tables** and **Inventory** pages are placeholders
- **POS** and **KDS** run locally only (not on cullinos.com URLs)
- **Pay now (Razorpay)** needs payment keys — use Pay later
- **Outlet comparison** needs 2+ outlets

Full list is in the Tester Handbook Section 11.

---

## Skills needed

- Basic web browsing (Chrome)
- Using Excel (dropdowns, filling rows)
- Taking screenshots (Windows: Win+Shift+S)
- Following written step-by-step instructions
- Optional: opening Swagger and copying a login token (handbook Section 9)

No coding required. Swagger section has a beginner-friendly guide.

---

## Contact

Your team lead is your first point of contact for access, blockers, and sign-off review.

---

## Quick start (first 30 minutes)

1. Read Quick Reference Card
2. Open health URL — confirm API is up
3. Login to Super Admin (credentials from team lead)
4. Onboard test restaurant (enterprise plan)
5. Login to Admin as owner — start onboarding wizard

Full steps: **QA_Tester_Handbook.pdf** Section 5.
