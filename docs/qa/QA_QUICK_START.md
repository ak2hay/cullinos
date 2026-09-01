# Cullinos QA — Quick Start Guide

**For new testers.** Read this first, then use the detailed [Manual Test Plan](./MANUAL_TEST_PLAN.md) and [Test Run Sheet](./TEST_RUN_SHEET.md).

---

## What is Cullinos?

Cullinos is Rkyves’s restaurant platform. One backend powers several **web apps**, each for a different job:

| Who uses it | App | What they do |
|-------------|-----|--------------|
| Rkyves platform team | **Super Admin** | Onboard restaurants, manage subscriptions |
| Restaurant owner / manager | **Admin** | Menu, staff, orders, reports, settings |
| Multi-outlet chains | **Management** | Compare outlets, stock transfers, franchise |
| Floor staff | **Waiter** | Take table orders |
| Cashier | **POS** *(local only)* | Counter / takeaway billing |
| Kitchen | **KDS** *(local only)* | See kitchen tickets (KOTs) |
| Guest / customer | **Customer** | Order online via QR or link |
| Public | **Marketing site** | cullinos.com — no login |

**Your test setup:** Production environment, **fresh restaurant** created via Super Admin, **one Waiter** staff account for floor tests.

---

## Portal URLs (Production)

Bookmark these. All production testing uses these domains.

### Main apps (login required)

| App | URL | Who logs in |
|-----|-----|-------------|
| **Super Admin** | https://platform.cullinos.com | Platform ops (Rkyves) |
| **Admin** (owner dashboard) | https://admin.cullinos.com | Restaurant owner |
| **Management** (chains) | https://manage.cullinos.com | Owner (Enterprise plan) |
| **Waiter** (floor) | https://waiter.cullinos.com | Waiter staff |

### No login

| App | URL | Notes |
|-----|-----|-------|
| **Customer storefront** | https://order.cullinos.com/`{orgSlug}`/`{outletSlug}` | Replace slugs after tenant is created |
| **Marketing website** | https://cullinos.com | Public pages |

**Example storefront** (demo org — do not use for your QA run if testing fresh tenant):

`https://order.cullinos.com/demo-restaurant/main-outlet`

### API & developer tools

| Tool | URL | Purpose |
|------|-----|---------|
| API health | https://api.cullinos.com/api/v1/health | Quick “is API up?” check |
| API DB health | https://api.cullinos.com/api/v1/health/db | Database connectivity |
| **Swagger (API docs)** | https://api.cullinos.com/docs | Test API-only features, create tables if needed |

### Local-only apps (optional)

POS and KDS are **not** hosted on the web. Run from your machine against production API:

| App | Local URL | Start command (from repo root) |
|-----|-----------|--------------------------------|
| **POS** | http://localhost:5173 | See [Local setup](#local-setup-optional) |
| **KDS (kitchen)** | http://localhost:5174?outletId=`{outletId}` | Same |
| **KDS (pickup)** | http://localhost:5174?outletId=`{outletId}`&mode=pickup | Same |

---

## Credentials — fill this in before testing

> **Important:** Do **not** put real passwords in files you commit to git.  
> Ask your team lead for production passwords, or use a password manager.  
> Copy this section into `docs/qa/runs/RUN-YYYYMMDD/CREDENTIALS_LOG.md` and fill it there (that folder is gitignored).

### Where passwords come from

| Role | How you get login |
|------|-------------------|
| **Super Admin** | Team lead shares platform login (stored locally in `secrets-export.txt` — **never commit that file**) |
| **Owner** | Created when Super Admin **onboards** a new restaurant — you choose email/password during onboard |
| **Waiter (your 1 employee)** | Owner creates in **Admin → Staff** — you set email/password there |
| **Cashier** *(optional, for POS)* | Same as Waiter — create in Admin → Staff if testing local POS |
| **Guest customer** | No login — use incognito browser |

### Credential worksheet (copy & fill in)

```
RUN ID:          RUN-YYYYMMDD
Tester name:     
Date:            

── PLATFORM (Rkyves) ──────────────────────────
Super Admin URL:   https://platform.cullinos.com
Super Admin email: ___________________________
Password:          (password manager / ask team lead)

── QA RESTAURANT (created this run) ───────────
Restaurant name:   e.g. QA Test Kitchen
Org slug:          ___________________________  ← needed for storefront URL
Outlet name:       e.g. Main Outlet
Outlet slug:       ___________________________
Outlet ID:         ___________________________  ← needed for KDS URL
Plan:              enterprise

Owner URL:         https://admin.cullinos.com
Owner email:       ___________________________
Owner password:    (password manager)

Storefront URL:    https://order.cullinos.com/{orgSlug}/{outletSlug}

── STAFF (1 employee) ─────────────────────────
Name:              ___________________________
Role:              Waiter
Waiter URL:        https://waiter.cullinos.com
Email:             ___________________________
Password:          (password manager)

── OPTIONAL ───────────────────────────────────
Cashier email:     ___________________________  (only if testing POS)
Management URL:    https://manage.cullinos.com  (login as owner)
```

### Demo credentials (local dev only — NOT for production QA)

If you run the app **locally** with `npm run db:seed`, these demo accounts exist:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@cullinos.com` | `demo1234` |
| Owner | `owner@cullinos.com` | `demo1234` |

Local app ports: API `3000`, Admin `5181`, Waiter `5175`, Customer `5176`, etc. — see root [README.md](../../README.md).

**Production QA uses a fresh tenant**, not these demo accounts.

---

## Who tests what?

One QA person switches roles; one employee tests Waiter only.

| Role | Person | App | When |
|------|--------|-----|------|
| Super Admin | You | platform.cullinos.com | Day 1 — onboard restaurant |
| Owner | You | admin.cullinos.com | Day 1–4 — setup, admin, reports |
| Waiter | Your employee | waiter.cullinos.com | Day 2 — table orders |
| Guest | You (incognito) | order.cullinos.com/... | Day 2 — online checkout |
| Owner | You | manage.cullinos.com | Day 3 — chain features |

You need **two browsers**: normal window (staff/owner) + **incognito** (guest customer).

---

## Start testing in 30 minutes

### Step 1 — Preflight (5 min)

Open in browser and confirm each works:

1. https://api.cullinos.com/api/v1/health → should show healthy JSON  
2. https://api.cullinos.com/api/v1/health/db → database OK  
3. https://platform.cullinos.com → Super Admin login page loads  

Checklist: [README preflight](./README.md#preflight-checklist)

### Step 2 — Create QA restaurant (10 min)

1. Login to **Super Admin**  
2. Click **Onboard restaurant**  
3. Fill in:
   - Restaurant name: `QA Test Kitchen` (or unique name)
   - First outlet: `Main Outlet`
   - Plan: **`enterprise`**
   - Owner name, email, password (save in password manager)
4. Copy the success message — it has the Admin URL and owner email  
5. Write **org slug** and **outlet slug** in your credential worksheet  

### Step 3 — Owner setup (10 min)

1. Login to **Admin** with owner credentials  
2. Go to **Setup** (`/onboarding`) — choose business type **Restaurant**  
3. Complete the wizard (business info, GSTIN test value `27AAAAA0000A1Z5`, etc.)  
4. **Menu** (`/menu`) — create 2 categories and at least 4 items  
5. **Staff** (`/staff`) — add your 1 employee as **Waiter**, assign main outlet  
6. Share waiter login with your employee (securely — not in git)  

### Step 4 — First real test (5 min)

**Employee:** Login to Waiter → select outlet → open a table → add items → confirm order  

**You:** Check **Admin → Orders** — the order should appear  

If **no tables** show in Waiter: Admin Tables UI is not built yet — create tables via **Swagger** (`POST /api/v1/tables`) or ask your lead. This is a known limitation, not necessarily a bug.

---

## What to test next (4-day plan)

| Day | Focus | Document |
|-----|-------|----------|
| **1** | Preflight + onboard + menu + staff | This guide + Phase 1 in [Manual Test Plan](./MANUAL_TEST_PLAN.md) |
| **2** | Waiter orders, guest checkout, KDS | Phase 2 + mark [Test Run Sheet](./TEST_RUN_SHEET.md) |
| **3** | Admin modules, Management, Super Admin | Phases 3–5 |
| **4** | Marketing site + API (Swagger) | Phases 6–7 |

Full details: [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md)  
Track pass/fail: [TEST_RUN_SHEET.md](./TEST_RUN_SHEET.md) (95 test cases)  
Log bugs: [BUG_LOG.md](./BUG_LOG.md)

---

## App cheat sheet — what each page does

### Admin (owner) — https://admin.cullinos.com

| Menu | Path | What to check |
|------|------|---------------|
| Dashboard | `/` | Revenue, order counts after you place test orders |
| Menu | `/menu` | Add/edit categories and items |
| Orders | `/orders` | All orders from Waiter, Customer, POS |
| Tables | `/tables` | Placeholder only (Phase 2) — use Waiter + API |
| Inventory | `/inventory` | Placeholder only (Phase 2) — use Swagger |
| Customers | `/customers` | Loyalty tiers, coupons (read-only) |
| Events | `/events` | Food truck pop-up events |
| Production | `/production` | Bakery batches |
| Pickup Queue | `/pickup-queue` | Link for pickup display |
| Staff | `/staff` | Create waiter/cashier/manager logins |
| Reports | `/reports` | Revenue, top items |
| Settings | `/settings` | Org config (JSON) |
| Setup | `/onboarding` | Initial wizard |

### Super Admin — https://platform.cullinos.com

| Menu | Path | What to check |
|------|------|---------------|
| Tenants | `/` | List restaurants, onboard, suspend |
| Subscriptions | `/subscriptions` | Change plan per tenant |
| System Health | `/health` | Platform metrics |
| Marketing | `/marketing/*` | Edit website content (careful on production) |

### Management — https://manage.cullinos.com

| Menu | Path | What to check |
|------|------|---------------|
| Overview | `/` | Multi-outlet KPIs |
| Reports | `/reports` | Network reports |
| Comparison | `/comparison` | Needs 2+ outlets |
| Stock Transfer | `/stock-transfer` | Needs 2+ outlets |
| Franchise | `/franchise` | Franchise list |

### Waiter — https://waiter.cullinos.com

1. Login → pick outlet  
2. Tap a table  
3. Add menu items → confirm → order goes to kitchen  

### Customer — https://order.cullinos.com/{orgSlug}/{outletSlug}

1. Browse menu (no login)  
2. Cart → Checkout  
3. Name + phone → **Pay later** → order placed  

---

## Local setup (optional)

Only needed for **POS** and **KDS** testing on production API.

**Prerequisites:** Node.js, repo cloned, `npm install`

```bash
# Terminal 1 — POS (cashier)
cd a:\cullinos
set VITE_API_URL=https://api.cullinos.com/api/v1
set VITE_WS_URL=https://api.cullinos.com
npm run dev --workspace=@cullinos/pos

# Terminal 2 — KDS (kitchen)
set VITE_API_URL=https://api.cullinos.com/api/v1
set VITE_WS_URL=https://api.cullinos.com
npm run dev --workspace=@cullinos/kds
```

Then open:

- POS: http://localhost:5173 (login as **Cashier** — create in Admin → Staff)  
- KDS: http://localhost:5174?outletId=**YOUR_OUTLET_ID**

Get `outletId` from Admin Settings, Swagger, or your credential worksheet.

---

## Common issues (not bugs)

| Problem | What to do |
|---------|------------|
| No tables in Waiter | Create via Swagger — Admin Tables page is not ready yet |
| POS/KDS URL not on internet | Expected — run locally (see above) |
| Management comparison empty | Add a second outlet via API, or mark test Blocked |
| Pay now fails on Customer | Razorpay may not be configured — use Pay later |
| Login “Failed to fetch” | Frontends must point to `api.cullinos.com` — tell your lead if prod is misconfigured |

---

## Files you will use daily

| File | Use |
|------|-----|
| **This guide** | URLs, credentials worksheet, first-day steps |
| [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) | Full workflows and expected results |
| [TEST_RUN_SHEET.md](./TEST_RUN_SHEET.md) | Mark Pass / Fail / Blocked / N/A per test |
| [BUG_LOG.md](./BUG_LOG.md) | Record every failure with steps to reproduce |
| [CREDENTIALS_LOG.md](./CREDENTIALS_LOG.md) | Detailed credential template for each run |

**Per run:** copy templates to `docs/qa/runs/RUN-YYYYMMDD/` (private, not committed).

---

## Quick reference card (print or pin)

```
PRODUCTION PORTALS
──────────────────────────────────────────────────
Super Admin   https://platform.cullinos.com
Admin         https://admin.cullinos.com
Management    https://manage.cullinos.com
Waiter        https://waiter.cullinos.com
Customer      https://order.cullinos.com/{orgSlug}/{outletSlug}
Marketing     https://cullinos.com
Swagger       https://api.cullinos.com/docs
Health        https://api.cullinos.com/api/v1/health

TEST ORDER
──────────────────────────────────────────────────
1. Super Admin → Onboard (enterprise plan)
2. Admin → Menu + Staff (1 waiter)
3. Waiter → Table order
4. Admin → Orders (verify)
5. Customer → Checkout incognito (verify)
6. TEST_RUN_SHEET → mark all 95 cases

NEVER commit real passwords to git.
```

---

## Need help?

1. Read [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) for the phase you're on  
2. Check [ARCHITECTURE.md](../ARCHITECTURE.md) for how apps connect  
3. Ask your team lead for Super Admin access and tenant slugs  
4. Log blockers in [BUG_LOG.md](./BUG_LOG.md) with screenshots
