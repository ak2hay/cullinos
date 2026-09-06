# Test Run Sheet — RUN-YYYYMMDD

> Copy to `docs/qa/runs/RUN-YYYYMMDD/` and mark each case during execution.  
> **Pass** = expected result | **Fail** = defect (log in BUG_LOG) | **Blocked** = cannot test | **N/A** = not applicable

---

## Run header

| Field | Value |
|-------|-------|
| Run ID | RUN-YYYYMMDD |
| Tester | |
| Employee (Waiter) | |
| Tenant slug | |
| Outlet slug | |
| Date started | |
| Date completed | |

### Results summary

| Result | Count |
|--------|-------|
| Pass | |
| Fail | |
| Blocked | |
| N/A | |
| **Total** | 160 |

---

## How to mark results

Put **X** in exactly one column per row: Pass | Fail | Blocked | N/A

---

## Phase 0 — Preflight

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-0-01 | API health endpoint returns OK | | | | | |
| TC-0-02 | API DB health endpoint returns OK | | | | | |
| TC-0-03 | Swagger docs page loads | | | | | |
| TC-0-04 | Super Admin login succeeds | | | | | |
| TC-0-05 | Run folder and templates copied to runs/RUN-YYYYMMDD | | | | | |
| TC-0-06 | Two browsers ready (main + incognito) | | | | | |

---

## Phase 1 — Tenant bootstrap

### 1.1 Super Admin onboarding

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-1.1-01 | Onboard restaurant form opens | | | | | |
| TC-1.1-02 | Submit with enterprise plan succeeds | | | | | |
| TC-1.1-03 | Success message shows owner email and Admin URL | | | | | |
| TC-1.1-04 | New tenant appears in tenant list as active | | | | | |
| TC-1.1-05 | Org slug recorded in Credentials Log | | | | | |

### 1.2 Owner onboarding wizard

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-1.2-01 | Owner login at admin.cullinos.com succeeds | | | | | |
| TC-1.2-02 | Onboarding wizard accessible at /onboarding | | | | | |
| TC-1.2-03 | Business type restaurant selected and saved | | | | | |
| TC-1.2-04 | Business info step (name, GSTIN) saves | | | | | |
| TC-1.2-05 | Wizard reaches Done step without error | | | | | |

### 1.3 Test data setup

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-1.3-01 | Create category 1 in Menu | | | | | |
| TC-1.3-02 | Create category 2 in Menu | | | | | |
| TC-1.3-03 | Create 4+ menu items with varied prices | | | | | |
| TC-1.3-04 | Create staff account — role Waiter | | | | | |
| TC-1.3-05 | Assign waiter to main outlet | | | | | |
| TC-1.3-06 | Settings page shows correct businessType | | | | | |
| TC-1.3-07 | Create 2+ tables via Admin → Tables | | | | | |
| TC-1.3-08 | Create staff account — role Cashier (for POS) | | | | | |

### 1.4 Auth recovery

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-1.4-01 | Admin forgot-password page loads and accepts email | | | | | |
| TC-1.4-02 | Super Admin forgot-password page loads and accepts email | | | | | |
| TC-1.4-03 | Change-password page reachable after owner login | | | | | |

---

## Phase 2 — Core operational workflows

### 2.1 Waiter → KDS dine-in

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.1-01 | Employee login at waiter.cullinos.com | | | | | |
| TC-2.1-02 | Main outlet selectable | | | | | |
| TC-2.1-03 | Table grid displays tables | | | | | |
| TC-2.1-04 | Open table — menu loads | | | | | |
| TC-2.1-05 | Add 2+ items to order | | | | | |
| TC-2.1-06 | Confirm order — success with order number | | | | | |
| TC-2.1-07 | KDS at kds.cullinos.com shows KOT within ~5s | | | | | |
| TC-2.1-08 | Admin Orders lists dine-in order | | | | | |
| TC-2.1-09 | Order total matches items ordered | | | | | |
| TC-2.1-10 | Show QR to customers — session link works | | | | | |
| TC-2.1-11 | End session — guest link expires on refresh | | | | | |

### 2.2 POS counter (production)

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.2-01 | POS loads at pos.cullinos.com | | | | | |
| TC-2.2-02 | Cashier login succeeds | | | | | |
| TC-2.2-03 | Add items — cart subtotal correct | | | | | |
| TC-2.2-04 | Set order type takeaway | | | | | |
| TC-2.2-05 | Hold order — appears in held panel | | | | | |
| TC-2.2-06 | Resume held order | | | | | |
| TC-2.2-07 | Checkout quick order confirms | | | | | |

### 2.3 Customer guest ordering

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.3-01 | Storefront loads in incognito | | | | | |
| TC-2.3-02 | Menu shows Phase 1 categories and items | | | | | |
| TC-2.3-03 | Add item to cart — badge updates | | | | | |
| TC-2.3-04 | Cart page shows correct items/totals | | | | | |
| TC-2.3-05 | Checkout form accepts name and phone | | | | | |
| TC-2.3-06 | Pay later places order successfully | | | | | |
| TC-2.3-07 | Order confirmation page displayed | | | | | |
| TC-2.3-08 | Admin Orders shows online/QR source order | | | | | |
| TC-2.3-09 | QR table param ?table=T1 binds table (if exists) | | | | | |
| TC-2.3-10 | Pay now Razorpay flow | | | | | |
| TC-2.3-11 | Customer login modal opens without blocking guest checkout | | | | | |

### 2.4 Order Display (CDS)

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.4-01 | Admin Order Display (/cds) page loads | | | | | |
| TC-2.4-02 | CDS / KDS pickup URL copyable and opens | | | | | |
| TC-2.4-03 | Order appears in Preparing column | | | | | |
| TC-2.4-04 | Order moves to Ready when marked | | | | | |

### 2.5 Admin Portal POS

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.5-01 | Owner opens Admin /pos with POS permission | | | | | |
| TC-2.5-02 | Add items — cart subtotal correct | | | | | |
| TC-2.5-03 | Hold and resume order in Portal POS | | | | | |
| TC-2.5-04 | Checkout confirms order from Portal POS | | | | | |

### 2.6 Digital Ordering (kiosk) launcher

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-2.6-01 | Admin Digital Ordering (/kiosk) page loads | | | | | |
| TC-2.6-02 | Launcher shows usable storefront / kiosk URL | | | | | |

---

## Phase 3 — Admin back office

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-3-01 | Dashboard loads with KPI cards | | | | | |
| TC-3-02 | Dashboard revenue reflects test orders | | | | | |
| TC-3-03 | Menu — edit existing item price | | | | | |
| TC-3-04 | Menu — create new item | | | | | |
| TC-3-05 | Menu — toggle item availability | | | | | |
| TC-3-06 | Orders — all Phase 2 orders visible | | | | | |
| TC-3-07 | Orders — status and source correct | | | | | |
| TC-3-08 | Tables — create table via Admin UI | | | | | |
| TC-3-09 | Inventory — list/view stock items | | | | | |
| TC-3-10 | Customers — loyalty tiers list loads | | | | | |
| TC-3-11 | Customers — coupons list loads | | | | | |
| TC-3-12 | Events — create new event | | | | | |
| TC-3-13 | Events — event appears in list | | | | | |
| TC-3-14 | Production — schedule batch (if applicable) | | | | | |
| TC-3-15 | Production — complete batch (if applicable) | | | | | |
| TC-3-16 | Order Display launcher — URL includes correct outletId | | | | | |
| TC-3-17 | Staff — employee listed | | | | | |
| TC-3-18 | Reports — revenue section loads | | | | | |
| TC-3-19 | Reports — top items non-empty after orders | | | | | |
| TC-3-20 | Settings — save valid JSON config | | | | | |
| TC-3-21 | Settings — invalid JSON shows error | | | | | |
| TC-3-22 | Logout and re-login persists session | | | | | |
| TC-3-23 | Recipes — create recipe | | | | | |
| TC-3-24 | Recipes — recipe appears in list | | | | | |
| TC-3-25 | Loyalty page loads | | | | | |
| TC-3-26 | Delivery page loads (list/status) | | | | | |
| TC-3-27 | Promo Email page loads | | | | | |
| TC-3-28 | Promo Email — compose draft or send without crash | | | | | |
| TC-3-29 | Billing page loads | | | | | |
| TC-3-30 | Kitchen Display launcher opens usable KDS URL | | | | | |
| TC-3-31 | Inventory — add or adjust stock item | | | | | |
| TC-3-32 | Staff without POS_ACCESS denied or redirected from /pos | | | | | |
| TC-3-33 | Banquets page (N/A on restaurant tenant) | | | | | |
| TC-3-34 | Brands page (N/A on restaurant tenant) | | | | | |
| TC-3-35 | Guests page (N/A on restaurant tenant) | | | | | |
| TC-3-36 | Rooms page (N/A on restaurant tenant) | | | | | |

---

## Phase 4 — Enterprise Management

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-4-01 | Owner login at manage.cullinos.com | | | | | |
| TC-4-02 | Overview dashboard loads KPIs | | | | | |
| TC-4-03 | Overview payment mix displays | | | | | |
| TC-4-04 | Reports page loads | | | | | |
| TC-4-05 | Outlet comparison loads (2+ outlets) | | | | | |
| TC-4-06 | Stock transfer create (2+ outlets) | | | | | |
| TC-4-07 | Franchise page loads | | | | | |
| TC-4-08 | Second outlet added via API if needed | | | | | |

---

## Phase 5 — Super Admin platform ops

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-5-01 | QA tenant findable in tenant list | | | | | |
| TC-5-02 | Subscriptions — change plan for QA tenant | | | | | |
| TC-5-03 | Subscriptions — entitlements update | | | | | |
| TC-5-04 | System Health metrics load | | | | | |
| TC-5-05 | Marketing dashboard loads | | | | | |
| TC-5-06 | Marketing Hero editor saves draft | | | | | |
| TC-5-07 | Marketing Pages editor loads | | | | | |
| TC-5-08 | Marketing Theme editor loads | | | | | |
| TC-5-09 | Marketing Pricing editor loads | | | | | |
| TC-5-10 | Marketing Navigation editor loads | | | | | |
| TC-5-11 | Marketing Blog editor — create draft | | | | | |
| TC-5-12 | Marketing Media library loads | | | | | |
| TC-5-13 | Suspend QA tenant — owner login blocked | | | | | |
| TC-5-14 | Reactivate QA tenant — owner login works | | | | | |
| TC-5-15 | Plans page loads | | | | | |
| TC-5-16 | Promo Email page loads | | | | | |
| TC-5-17 | Marketing Testimonials editor loads | | | | | |
| TC-5-18 | Marketing Design Lab loads | | | | | |
| TC-5-19 | Platform Settings page loads | | | | | |
| TC-5-20 | Super Admin forgot-password page loads | | | | | |

---

## Phase 6 — Marketing website (public)

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-6-01 | Home page loads with hero and nav | | | | | |
| TC-6-02 | Features page loads | | | | | |
| TC-6-03 | Pricing page loads | | | | | |
| TC-6-04 | Integrations page loads | | | | | |
| TC-6-05 | About page loads | | | | | |
| TC-6-06 | Blog index loads | | | | | |
| TC-6-07 | Blog article page readable | | | | | |
| TC-6-08 | Contact form submits or graceful error | | | | | |
| TC-6-09 | Privacy page loads | | | | | |
| TC-6-10 | Terms page loads | | | | | |
| TC-6-11 | Solutions — restaurants | | | | | |
| TC-6-12 | Solutions — cafes | | | | | |
| TC-6-13 | Solutions — food-trucks | | | | | |
| TC-6-14 | Solutions — bakeries | | | | | |
| TC-6-15 | Solutions — chains | | | | | |
| TC-6-16 | Solutions — hospitality | | | | | |

---

## Phase 7 — API smoke (Swagger)

| ID | Test case | Pass | Fail | Blocked | N/A | Notes |
|----|-----------|:----:|:----:|:-------:|:---:|-------|
| TC-7-01 | Auth — obtain owner JWT | | | | | |
| TC-7-02 | Billing — list invoices | | | | | |
| TC-7-03 | KOT — list tickets for outlet | | | | | |
| TC-7-04 | Tax — get config | | | | | |
| TC-7-05 | Recipes — create and list | | | | | |
| TC-7-06 | Purchasing — create PO draft | | | | | |
| TC-7-07 | Wastage — log entry | | | | | |
| TC-7-08 | Delivery — list orders | | | | | |
| TC-7-09 | Hospitality — create guest | | | | | |
| TC-7-10 | Hospitality — create room | | | | | |
| TC-7-11 | Audit — recent entries | | | | | |
| TC-7-12 | Notifications — list | | | | | |
| TC-7-13 | Devices — list | | | | | |
| TC-7-14 | Integrations — list | | | | | |

---

## Fail / Blocked summary

| Test ID | Bug ID | Reason |
|---------|--------|--------|
| | | |

---

## Sign-off

| Field | Value |
|-------|-------|
| All Critical/High failures logged in BUG_LOG | Y / N |
| Credentials Log completed (no passwords in git) | Y / N |
| Known limitations separated from open bugs | Y / N |
| Tester signature | |
| Reviewer signature | |
| Sign-off date | |

### Comments

```

(Final notes, environment issues, follow-up actions)

```
