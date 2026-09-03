# Cullinos QA Tester Handbook

**For new testers.** Read Sections 1–2 first, then follow the day-by-day checklists. Mark results in your Excel Test Run Sheet.

---

## How to use this handbook

| Step | Action |
|------|--------|
| 1 | Read Sections 1–2 below |
| 2 | Open `CREDENTIALS_LOG.xlsx` — save a copy named `CREDENTIALS_RUN-YYYYMMDD.xlsx` |
| 3 | **Day 1:** health checks → Super Admin onboard → Admin wizard → menu + 1 waiter staff |
| 4 | Open `TEST_RUN_SHEET.xlsx` — mark each test **Pass / Fail / Blocked / N/A** the same day you run it |
| 5 | Any **Fail** → add a row in `BUG_LOG.xlsx` + save a screenshot in your `evidence/` folder |
| 6 | **Days 2–4:** follow the day checklists in order |
| 7 | Last day: complete the Sign-off sheet in Excel; send all Excel files + evidence zip to your team lead |

---

## 1. Welcome — what is Cullinos?

Cullinos is a restaurant software platform made by Rkyves. One backend powers several websites, each for a different job:

| Who uses it | Website name | What they do |
|-------------|--------------|--------------|
| Rkyves platform team | **Super Admin** | Create restaurants, manage subscriptions |
| Restaurant owner | **Admin** | Menu, staff, orders, reports, settings |
| Multi-outlet chains | **Management** | Compare outlets, stock transfers |
| Floor staff | **Waiter** | Take table orders |
| Cashier | **POS** *(local only)* | Counter / takeaway billing |
| Kitchen | **KDS** *(local only)* | See kitchen tickets |
| Guest customer | **Customer** | Order online (no login) |
| Public visitors | **Marketing site** | cullinos.com — no login |

**Your job:** Test all **127 test cases** on **production** using a **fresh test restaurant** you create on Day 1.

---

## 2. Before Day 1 — what you need

### Tools

- **Google Chrome** (or Edge) — main browser
- **Incognito / private window** — for guest customer tests (Ctrl+Shift+N in Chrome)
- **Screenshot tool** — Windows: Win+Shift+S
- **Excel** — to fill in Test Run Sheet, Bug Log, Credentials Log
- **Folder for evidence** — e.g. `RUN-20260902/evidence/` for bug screenshots

### Files from your team lead

You should receive these 5 files:

1. `QA_Tester_Handbook.pdf` (this document)
2. `Quick_Reference_Card.pdf`
3. `TEST_RUN_SHEET.xlsx`
4. `BUG_LOG.xlsx`
5. `CREDENTIALS_LOG.xlsx`

### Access from your team lead

- **Super Admin login** — shared securely on Day 1 morning (password manager or verbal). **Never write real passwords in Excel or email.**

### Production URLs — bookmark these

| App | URL |
|-----|-----|
| Super Admin | https://platform.cullinos.com |
| Admin (owner) | https://admin.cullinos.com |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| Customer storefront | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing site | https://cullinos.com |
| Swagger (API docs) | https://api.cullinos.com/docs |
| API health | https://api.cullinos.com/api/v1/health |
| API DB health | https://api.cullinos.com/api/v1/health/db |

Replace `{orgSlug}` and `{outletSlug}` with values from Day 1 setup.

---

## 3. Glossary

| Term | Meaning |
|------|---------|
| **Slug** | Short name in the URL (e.g. `qa-test-kitchen`) |
| **Outlet** | One restaurant location (branch) |
| **Org / Tenant** | The restaurant business account |
| **KOT** | Kitchen Order Ticket — order sent to kitchen |
| **JWT / Token** | Secret login key used by API tools (Swagger) |
| **Incognito** | Private browser window — acts like a guest with no saved login |
| **Pass** | Feature works as expected |
| **Fail** | Wrong behavior — you **must** log a bug |
| **Blocked** | Cannot test (missing access, tool not installed) |
| **N/A** | Not applicable (e.g. payment not configured) |
| **Swagger** | Web page to test backend API directly |
| **Enterprise plan** | Highest plan — unlocks all modules for testing |

---

## 4. Result codes — simple rules

| Code | When to use |
|------|-------------|
| **Pass** | Works exactly as this handbook describes |
| **Fail** | Wrong behavior, error, or missing feature → log in BUG_LOG.xlsx |
| **Blocked** | You cannot run the test (no Super Admin access, POS not installed) |
| **N/A** | Test does not apply (Razorpay pay-now without keys, only 1 outlet for comparison tests) |

---

## 5. Day 1 — Setup (Phases 0 and 1)

**Goal:** Confirm production works, create a test restaurant, add menu and staff.

**Time:** ~6–8 hours  
**Apps:** Super Admin, Admin  
**Excel tests:** TC-0-01 through TC-1.3-07

### Morning — Preflight (Phase 0)

1. Open https://api.cullinos.com/api/v1/health  
   - **Expected:** JSON text showing healthy status → mark TC-0-01 **Pass**
2. Open https://api.cullinos.com/api/v1/health/db  
   - **Expected:** Database OK → mark TC-0-02 **Pass**
3. Open https://api.cullinos.com/docs  
   - **Expected:** Swagger API docs page loads → mark TC-0-03 **Pass**
4. Go to https://platform.cullinos.com — login with Super Admin credentials from team lead  
   - **Expected:** Dashboard loads → mark TC-0-04 **Pass**
5. Create a folder for this run (e.g. `RUN-20260902/`) and copy your Excel files there  
   - Mark TC-0-05 **Pass**
6. Open a second browser window in **Incognito** mode — keep it ready for Day 2  
   - Mark TC-0-06 **Pass**

### Midday — Create test restaurant (Phase 1.1)

1. In Super Admin, click **Onboard restaurant** → mark TC-1.1-01 **Pass** when form opens
2. Fill the form:
   - Restaurant name: `QA Test Kitchen` (or unique name with today's date)
   - First outlet name: `Main Outlet`
   - Plan: **enterprise**
   - Owner name, email, password (save in password manager — **not** in Excel)
3. Click Submit  
   - **Expected:** Success message with owner email and Admin URL → TC-1.1-02, TC-1.1-03 **Pass**
4. Find the new tenant in the list — status should be **active** → TC-1.1-04 **Pass**
5. Write **org slug** and **outlet slug** in CREDENTIALS_LOG.xlsx → TC-1.1-05 **Pass**

### Afternoon — Owner setup (Phases 1.2 and 1.3)

1. Go to https://admin.cullinos.com — login with owner credentials → TC-1.2-01 **Pass**
2. Go to **Setup** (`/onboarding`) if not redirected → TC-1.2-02 **Pass**
3. Select business type: **Restaurant** → TC-1.2-03 **Pass**
4. Complete wizard steps:
   - Business info: name, GSTIN test value `27AAAAA0000A1Z5`
   - Follow remaining steps (menu, tables, tax, staff guidance)
   - Reach the **Done** step without errors → TC-1.2-04, TC-1.2-05 **Pass**
5. Go to **Menu** (`/menu`):
   - Create **2 categories** → TC-1.3-01, TC-1.3-02 **Pass**
   - Create **4 or more items** with different prices → TC-1.3-03 **Pass**
6. Go to **Staff** (`/staff`):
   - Click **Add staff member**
   - Name, email, password, role: **Waiter**, assign main outlet → TC-1.3-04, TC-1.3-05 **Pass**
7. Go to **Settings** (`/settings`) — confirm businessType is correct → TC-1.3-06 **Pass**
8. **If Waiter will need tables (Day 2):** If Admin Tables page is empty, create tables via Swagger (see Section 9) → TC-1.3-07 **Pass** or **N/A** if tables already exist

**End of Day 1:** All Phase 0 and Phase 1 rows marked in Excel. Credentials Log filled (no real passwords — use "PM entry #" only).

---

## 6. Day 2 — Orders (Phase 2)

**Goal:** Test real order flows — waiter, customer, optional KDS/POS.  
**Time:** ~6–8 hours  
**Apps:** Waiter, Customer (incognito), Admin, optional local KDS/POS  
**Excel tests:** TC-2.1-01 through TC-2.4-04

### 6.1 Waiter dine-in order (TC-2.1-xx)

1. Go to https://waiter.cullinos.com — login as Waiter staff → TC-2.1-01 **Pass**
2. Select main outlet → TC-2.1-02 **Pass**
3. Check table grid shows tables → TC-2.1-03 **Pass**  
   - If no tables: use Swagger to create tables (Section 9) or mark **Blocked** and tell team lead
4. Tap/open a table — menu should load → TC-2.1-04 **Pass**
5. Add 2 or more items → TC-2.1-05 **Pass**
6. Confirm order — note the order number → TC-2.1-06 **Pass**
7. **Optional KDS:** If team lead set up local KDS (`http://localhost:5174?outletId=YOUR_OUTLET_ID`), check KOT appears within ~5 seconds → TC-2.1-07 **Pass** or **Blocked**
8. In Admin → **Orders** (`/orders`) — find the dine-in order → TC-2.1-08 **Pass**
9. Verify order total matches items → TC-2.1-09 **Pass**

### 6.2 POS counter — local only (TC-2.2-xx)

Only if team lead installed local POS. Otherwise mark all TC-2.2-xx as **Blocked**.

1. Open http://localhost:5173 — login as Cashier (create in Admin → Staff if needed)
2. Add items, check cart subtotal
3. Set order type to takeaway
4. Hold order, then resume it
5. Checkout (quick order)

Mark each step Pass/Fail/Blocked in Excel.

### 6.3 Guest online order (TC-2.3-xx)

Use **Incognito** window — you are a customer with no login.

1. Open `https://order.cullinos.com/{orgSlug}/{outletSlug}` → TC-2.3-01 **Pass**
2. Menu shows your Day 1 categories and items → TC-2.3-02 **Pass**
3. Add item to cart — badge/count updates → TC-2.3-03 **Pass**
4. Open cart — items and totals correct → TC-2.3-04 **Pass**
5. Checkout — enter name and phone → TC-2.3-05 **Pass**
6. Choose **Pay later** — order places successfully → TC-2.3-06, TC-2.3-07 **Pass**
7. Admin → Orders — online/QR order visible → TC-2.3-08 **Pass**
8. Retry storefront with `?table=T1` on URL if table T1 exists → TC-2.3-09 **Pass** or **N/A**
9. **Pay now (Razorpay):** Mark TC-2.3-10 **N/A** unless team lead confirms payment keys are configured

### 6.4 Pickup queue (TC-2.4-xx)

1. Admin → **Pickup Queue** (`/pickup-queue`) — page loads → TC-2.4-01 **Pass**
2. Copy KDS pickup URL and open it → TC-2.4-02 **Pass** or **Blocked** if no local KDS
3. Place a counter/online order — appears in Preparing → TC-2.4-03 **Pass** or **N/A**
4. Mark ready — moves to Ready column → TC-2.4-04 **Pass** or **N/A**

For restaurant-only setup, pickup tests may be **N/A**.

---

## 7. Day 3 — Back office and platform (Phases 3, 4, 5)

**Goal:** Test Admin modules, Management, Super Admin.  
**Time:** ~6–8 hours  
**Apps:** Admin, Management, Super Admin

### 7.1 Admin back office (TC-3-xx)

Login as **Owner** at https://admin.cullinos.com. Visit each page and verify:

| Page | Path | What to check |
|------|------|---------------|
| Dashboard | `/` | KPI cards load; revenue reflects Day 2 orders |
| Menu | `/menu` | Edit price, create item, toggle availability |
| Orders | `/orders` | All Day 2 orders visible with correct status/source |
| Tables | `/tables` | Page loads (placeholder UI — **not a bug**) |
| Inventory | `/inventory` | Page loads (placeholder UI — **not a bug**) |
| Customers | `/customers` | Loyalty tiers and coupons lists load (see §7.4 for stamp/coupon testing) |
| Events | `/events` | Create event; appears in list |
| Production | `/production` | Schedule/complete batch if applicable, else **N/A** |
| Pickup Queue | `/pickup-queue` | URL includes correct outletId |
| Staff | `/staff` | Waiter employee listed |
| Reports | `/reports` | Revenue and top items (non-empty after orders) |
| Settings | `/settings` | Save valid JSON; invalid JSON shows error |
| Login | `/login` | Logout and re-login works |

Mark TC-3-01 through TC-3-22 in Excel.

### 7.2 Enterprise Management (TC-4-xx)

Login as **Owner** at https://manage.cullinos.com.

1. Overview dashboard — KPIs load → TC-4-01, TC-4-02, TC-4-03 **Pass**
2. Reports page loads → TC-4-04 **Pass**
3. Outlet comparison — needs 2+ outlets → TC-4-05 **Pass** or **Blocked/N/A** if only 1 outlet
4. Stock transfer — needs 2+ outlets → TC-4-06 **Pass** or **Blocked/N/A**
5. Franchise page loads → TC-4-07 **Pass**
6. If needed, add second outlet via Swagger → TC-4-08

### 7.4 CRM & Loyalty (TC-3-xx)

**Background:** The Admin Customers page is read-only — it displays loyalty tiers and active coupons. There is no UI button to add stamps; stamps are added via API (Swagger).

**Pre-seeded data (demo org):**
- Loyalty tier: Stamp Card — 10 stamps = 100 points = free drink reward
- Coupon: `WELCOME10` — 10% off, minimum order ₹200

**Stamp test steps:**
1. Place an order via the Customer app so a customer record exists.
2. Open Swagger at `https://api.cullinos.com/docs` (or `http://localhost:3000/docs` locally).
3. Click **Authorize** — paste your owner Bearer token.
4. `GET /api/v1/customers` → find the customer `id` from the response.
5. `POST /api/v1/loyalty/customers/{customerId}/stamp` — execute 10 times.
6. After 10 stamps the tier reward triggers automatically (100 loyalty points, stamp count resets).
7. Admin Customers page → Loyalty tiers section shows the tier → **Pass**.

**Coupon test steps:**
1. Add items to cart in Customer app totalling ≥ ₹200.
2. At checkout enter coupon code **`WELCOME10`**.
3. Verify 10% discount is applied → **Pass**.

---

### 7.3 Super Admin platform (TC-5-xx)

Login at https://platform.cullinos.com. **Use QA test tenant only** for destructive tests.

1. Find QA tenant in list → TC-5-01 **Pass**
2. Subscriptions — change plan for QA tenant → TC-5-02, TC-5-03 **Pass**
3. System Health — metrics load → TC-5-04 **Pass**
4. Marketing section — open each editor (Hero, Pages, Theme, Pricing, Navigation, Blog, Media) → TC-5-05 through TC-5-12 **Pass**
5. **Destructive (QA tenant only):**
   - Suspend tenant — owner cannot login to Admin → TC-5-13 **Pass**
   - Reactivate tenant — owner can login again → TC-5-14 **Pass**

**Do not** publish breaking changes to the live marketing website without team lead approval.

---

## 8. Day 4 — Marketing site and API (Phases 6 and 7)

**Goal:** Check public website pages and API smoke tests.  
**Time:** ~6–8 hours  
**Apps:** cullinos.com, Swagger

### 8.1 Marketing website (TC-6-xx)

Open each URL in a normal browser (no login). Page should load without errors:

| Page | URL |
|------|-----|
| Home | https://cullinos.com/ |
| Features | https://cullinos.com/features |
| Pricing | https://cullinos.com/pricing |
| Integrations | https://cullinos.com/integrations |
| About | https://cullinos.com/about |
| Blog | https://cullinos.com/blog |
| Blog article | https://cullinos.com/blog/{any-slug} |
| Contact | https://cullinos.com/contact |
| Privacy | https://cullinos.com/privacy |
| Terms | https://cullinos.com/terms |
| Solutions — restaurants | https://cullinos.com/solutions/restaurants |
| Solutions — cafes | https://cullinos.com/solutions/cafes |
| Solutions — food-trucks | https://cullinos.com/solutions/food-trucks |
| Solutions — bakeries | https://cullinos.com/solutions/bakeries |
| Solutions — chains | https://cullinos.com/solutions/chains |
| Solutions — hospitality | https://cullinos.com/solutions/hospitality |

Mark TC-6-01 through TC-6-16. Contact form: submit is OK, or graceful error without crash → TC-6-08.

### 8.2 API smoke tests via Swagger (TC-7-xx)

See **Section 9 — Swagger mini-guide** below. Run each API check and mark TC-7-01 through TC-7-14.

---

## 9. Swagger mini-guide (for Day 4)

Swagger lets you test backend features that have no website UI yet.

### Step A — Get your login token (JWT)

1. Login to **Admin** as Owner at https://admin.cullinos.com
2. Press **F12** to open Developer Tools
3. Click the **Network** tab
4. Click any page in Admin (e.g. Dashboard) to trigger requests
5. Click a request to `api.cullinos.com` in the list
6. In **Request Headers**, find `Authorization: Bearer eyJ...` (long text)
7. Copy everything **after** `Bearer ` — that is your JWT token
8. Mark TC-7-01 **Pass**

### Step B — Authorize in Swagger

1. Open https://api.cullinos.com/docs
2. Click the **Authorize** button (lock icon, top right)
3. In the value field, type: `Bearer YOUR_TOKEN_HERE` (paste your token)
4. Click **Authorize**, then **Close**

### Step C — Run API smoke tests

| Test ID | What to do | Expected |
|---------|------------|----------|
| TC-7-02 | Find Billing → GET list invoices | HTTP 200, JSON response |
| TC-7-03 | KOT → GET list for your outlet | HTTP 200, tickets listed |
| TC-7-04 | Tax → GET config | HTTP 200, tax settings |
| TC-7-05 | Recipes → POST create one, then GET list | HTTP 200/201 |
| TC-7-06 | Purchasing → POST create PO draft | HTTP 200/201 |
| TC-7-07 | Wastage → POST log one entry | HTTP 200/201 |
| TC-7-08 | Delivery → GET list orders | HTTP 200 |
| TC-7-09 | Hospitality → POST create guest | HTTP 200/201 |
| TC-7-10 | Hospitality → POST create room | HTTP 200/201 |
| TC-7-11 | Audit → GET recent entries | HTTP 200 |
| TC-7-12 | Notifications → GET list | HTTP 200 |
| TC-7-13 | Devices → GET list | HTTP 200 |
| TC-7-14 | Integrations → GET list | HTTP 200 |

Write HTTP status codes in the **Notes** column of your Test Run Sheet.

### Step D — Create tables via Swagger (if Waiter has no tables)

1. With Swagger authorized (Step B), find **Tables** → `POST /api/v1/tables`
2. Click **Try it out**
3. Use a body like:
   ```json
   {
     "outletId": "YOUR_OUTLET_ID",
     "label": "T1",
     "capacity": 4
   }
   ```
4. Click **Execute** — expect HTTP 201
5. Repeat for T2 if needed

Get `outletId` from CREDENTIALS_LOG or Admin Settings.

---

## 10. Optional — Local POS and KDS

POS and KDS are **not** on the public internet. Ask your team lead to help set these up, or mark POS/KDS tests as **Blocked**.

**Only if Node.js and the project are installed on your PC:**

```bash
# Terminal 1 — POS
cd path\to\cullinos
set VITE_API_URL=https://api.cullinos.com/api/v1
set VITE_WS_URL=https://api.cullinos.com
npm run dev --workspace=@cullinos/pos

# Terminal 2 — KDS
set VITE_API_URL=https://api.cullinos.com/api/v1
set VITE_WS_URL=https://api.cullinos.com
npm run dev --workspace=@cullinos/kds
```

- POS: http://localhost:5173 (login as **Cashier** — create in Admin → Staff)
- KDS: http://localhost:5174?outletId=**YOUR_OUTLET_ID**

---

## 11. Known limitations — NOT bugs

Do **not** file these as defects. Mark test **N/A** or note "Known limitation" in BUG_LOG:

| Item | Why |
|------|-----|
| Admin Tables page | Placeholder UI — use Waiter + Swagger for tables |
| Admin Inventory page | Placeholder UI — use Swagger for inventory |
| POS/KDS on production URLs | Local apps only — run on your PC or mark Blocked |
| Razorpay pay-now | Needs payment keys — use Pay later instead |
| Gateway offline sync | Needs Electron app on restaurant LAN |
| Outlet comparison with 1 outlet | Needs 2+ outlets — mark N/A or add outlet via API |
| Staff password reset in UI | May not exist — note if missing, do not fail unless spec says otherwise |

---

## 12. How to report a bug

When any test is **Fail**:

1. Open `BUG_LOG.xlsx`
2. Add a new row:
   - **Bug ID:** BUG-001, BUG-002, …
   - **Date found**
   - **Test ID:** e.g. TC-2.1-06
   - **Module:** e.g. Waiter
   - **Title:** Short description
   - **Severity:** Critical / High / Medium / Low
   - **Steps:** Numbered steps to reproduce
   - **Expected:** What should happen
   - **Actual:** What happened instead
   - **Screenshot path:** e.g. `evidence/BUG-001-screenshot.png`
   - **Status:** Open
3. Take a screenshot (Win+Shift+S) and save to your `evidence/` folder
4. Link Bug ID in the Test Run Sheet **Bug ID** column

### Severity guide

| Level | Example |
|-------|---------|
| **Critical** | Cannot login, orders fail to create |
| **High** | KOT never appears, checkout fails |
| **Medium** | Wrong totals but workaround exists |
| **Low** | Typo, small UI alignment issue |

---

## 13. Sign-off (last day)

Before sending work to your team lead:

- [ ] All 127 test cases marked Pass / Fail / Blocked / N/A in TEST_RUN_SHEET.xlsx
- [ ] Summary sheet counts look correct
- [ ] Every **Fail** has a row in BUG_LOG.xlsx
- [ ] CREDENTIALS_LOG.xlsx filled (no real passwords)
- [ ] Known limitations noted separately from open bugs
- [ ] Sign-off sheet completed in Excel
- [ ] Zip and send: 3 Excel files + evidence folder

---

## 14. Need help?

1. Check the **Quick Reference Card** (1-page PDF)
2. Ask your team lead for Super Admin access or outlet IDs
3. Mark tests **Blocked** if you are stuck — do not guess Pass/Fail
4. Read `EMPLOYEE_BRIEF.pdf` for job expectations and rules
