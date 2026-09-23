# Cullinos — Complete Feature Testing Guide

**Purpose:** Exhaustive click-by-click manual tests for every active portal, page, and major action.  
**Companion docs:** Day plan → [TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md) · Score sheet → [../sheets/TEST_RUN_SHEET.md](../sheets/TEST_RUN_SHEET.md) · Bugs → [../sheets/BUG_LOG.md](../sheets/BUG_LOG.md) · Credentials → [../sheets/CREDENTIALS_LOG.md](../sheets/CREDENTIALS_LOG.md)  
**PDF:** [../export/pdf/Complete_Feature_Test_Guide.pdf](../export/pdf/Complete_Feature_Test_Guide.pdf) (regenerate with `npm run qa:export`)

**How to mark:** Check each `[ ]` as you go. Record Pass / Fail / Blocked / N/A on the Test Run Sheet. Failures → Bug Log + screenshot.

**Environment:** Production (default). Local ports and CLI commands are in the appendix.

---

## Quick URL card (bookmark these)

| Portal | Production URL | Who |
|--------|----------------|-----|
| Super Admin | https://platform.cullinos.com | Rkyves platform |
| Admin (owner) | https://admin.cullinos.com | Owner / manager |
| Portal POS | https://admin.cullinos.com/pos | Staff with `POS_ACCESS` |
| Management | https://manage.cullinos.com | Multi-outlet owner |
| POS | https://pos.cullinos.com | Cashier |
| KDS | https://kds.cullinos.com | Kitchen |
| Guest deep link | https://guest.cullinos.com/o/`{org}`/`{outlet}` | Diner |
| Guest + table | `…/o/{org}/{outlet}?table=T1` | QR dine-in |
| Guest + session | `…/o/{org}/{outlet}?session={token}` | Waiter QR session |
| Marketing | https://cullinos.com | Public |
| API health | https://api.cullinos.com/api/v1/health | Preflight |
| API DB health | https://api.cullinos.com/api/v1/health/db | Preflight |
| Swagger | https://api.cullinos.com/docs | API smoke |

---

## Useful commands

### Regenerate QA pack (PDF + Excel)

From repo root:

```bash
npm install
npm run qa:export
```

Outputs:

- PDFs → `docs/qa/export/pdf/`
- HTML (print fallback) → `docs/qa/export/html/`
- Excel → `docs/qa/export/excel/`

### Start a test run folder

```powershell
# PowerShell (Windows)
$run = "docs/qa/runs/RUN-$(Get-Date -Format yyyyMMdd)"
New-Item -ItemType Directory -Force -Path "$run/evidence" | Out-Null
Copy-Item docs/qa/export/excel/*.xlsx $run/
```

```bash
# bash / Git Bash
RUN="docs/qa/runs/RUN-$(date +%Y%m%d)"
mkdir -p "$RUN/evidence"
cp docs/qa/export/excel/*.xlsx "$RUN/"
```

### Preflight health checks

```bash
curl -sS https://api.cullinos.com/api/v1/health
curl -sS https://api.cullinos.com/api/v1/health/db
```

### Optional local apps (against production API)

```bash
# POS — http://localhost:5173
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/pos

# KDS — http://localhost:5174
VITE_API_URL=https://api.cullinos.com/api/v1 VITE_WS_URL=https://api.cullinos.com npm run dev --workspace=@cullinos/kds

# Admin — http://localhost:5181
npm run dev --workspace=@cullinos/admin

# Super Admin — http://localhost:5183
npm run dev --workspace=@cullinos/super-admin

# Management — http://localhost:5182
npm run dev --workspace=@cullinos/management

# Marketing web — http://localhost:5180
npm run dev --workspace=@cullinos/web
```

### Display URL patterns (from Admin → Displays)

Replace slugs after tenant setup:

```text
https://kds.cullinos.com/?mode=cds&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=pickup&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=playlist&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=receipt&outletId={outletId}
```

---

## Table of contents

0. [How to use & result codes](#0-how-to-use--result-codes)
1. [Setup & sample data (no Demo button)](#1-setup--sample-data-no-demo-button)
2. [Gating matrix (when to mark N/A)](#2-gating-matrix-when-to-mark-na)
3. [Cross-portal journeys](#3-cross-portal-journeys)
4. [Super Admin](#4-super-admin--platformcullinoscom)
5. [Admin / Owner portal](#5-admin--owner-portal--admincullinoscom)
6. [Management](#6-management--managecullinoscom)
7. [POS](#7-pos--poscullinoscom)
8. [KDS & public displays](#8-kds--public-displays--kdscullinoscom)
9. [Waiter Android](#9-waiter-android--cullinos-waiter)
10. [Cullinos App (Guest)](#10-cullinos-app-guest)
11. [Marketing website](#11-marketing-website--cullinoscom)
12. [Appendix — URLs, ports & commands](#12-appendix--urls-ports--commands)

---

## 0. How to use & result codes

| Code | Meaning |
|------|---------|
| **Pass** | Steps completed; expected result matched |
| **Fail** | Unexpected behaviour — log bug with steps + screenshot |
| **Blocked** | Cannot run (missing access, outage, dependency failed) |
| **N/A** | Feature hidden by business type, plan, permission, or no gateway keys |

| Who | Portal | Login |
|-----|--------|-------|
| Rkyves platform | Super Admin | Platform credentials (secure handoff) |
| Restaurant owner | Admin, Management | Created by Super Admin onboard |
| Floor / cashier / kitchen | Waiter, POS, KDS | Created by Owner in **Admin → Staff** |
| Diner | Cullinos App | Phone OTP / Google / guest browse; checkout may require auth |
| Public | Marketing site | None |

**There is no Admin “Demo data” button.** Sample categories are seeded only when the owner finishes **Complete setup** on the onboarding wizard. Everything else (items, tables, staff) you create manually — see Chapter 1.

---

## 1. Setup & sample data (no Demo button)

Use a **fresh QA restaurant** (do not reuse the public demo org for scored runs).

### 1.1 Create the tenant

1. [ ] Open https://platform.cullinos.com → **Sign in**
2. [ ] Go to **Tenants** → **Onboard restaurant**
3. [ ] Fill: Restaurant name*, Business category **Restaurant**, size **Medium** or **Large**, First outlet name*, Plan **Enterprise**, Owner name, Owner email*
4. [ ] Click **Create tenant**
5. [ ] Copy one-time owner password (**Reveal once**) into your password manager — record slug/email in Credentials Log (no password in git)
6. [ ] Confirm new tenant appears as **active**

**Expected:** Success message with Admin URL and owner email; tenant list shows the new org.

### 1.2 Owner first login & wizard

1. [ ] Open https://admin.cullinos.com → sign in with owner email + temporary password
2. [ ] If forced: **Change password** → **Save new password**
3. [ ] Complete onboarding steps with **Continue** / **Back**:
   - Business details (category, size, name*, GSTIN, timezone, currency)
   - Your features (read-only chips)
   - Menu categories (sample categories will be seeded)
   - Tables / Tax / Staff tips as shown
4. [ ] Last step → **Complete setup**

**Expected:** `setupCompleted`; sample **menu categories** appear under **Menu**; Setup nav item may hide; dashboard loads.

### 1.3 Minimum test data (create manually)

1. [ ] **Menu** → **items** → **Add item** — create 4+ items across 2 categories (varied prices). Optional: variants, modifiers, **Upload photo**
2. [ ] **Tables** → **Add floor** (if needed) → **Add table** → **Create table** — at least 2 tables. Open detail → **Generate QR** / **Download QR**
3. [ ] **Staff** → **Add staff member**:
   - Waiter: name, phone (for OTP), email, temp password, role **Waiter**, assign outlet → **Create account**
   - Cashier: same with role **Cashier**
4. [ ] **Settings** → enable order types you need → **Save settings**; optionally **Create tax group**, **Register device**, **Add location**
5. [ ] **Payments** (optional for pay-now): configure Razorpay and/or Cashfree → **Save**; without keys mark pay-now **N/A**
6. [ ] **Displays** → copy KDS / CDS / Pickup / Promo URLs for later
7. [ ] **Digital Ordering** (`/kiosk`) → copy storefront / kiosk links

Record org slug, outlet slug, outletId, staff emails in Credentials Log.

---

## 2. Gating matrix (when to mark N/A)

| Feature / path | Visible when | Typical restaurant QA |
|----------------|--------------|------------------------|
| Tables, Reservations | Business feature `TABLES` | Pass |
| Displays (KDS/CDS/Promo) | `KDS` | Pass |
| Inventory, Recipes, Purchasing, Suppliers | Inventory / purchasing features | Pass on medium+ |
| Loyalty, Coupons | `LOYALTY` | Pass |
| Delivery | `DELIVERY` | Pass |
| Marketplace, Guest banners | `ONLINE_ORDERING` | Pass |
| Digital Ordering / kiosk | `QR_ORDERING` | Pass |
| Central kitchen | `MULTI_OUTLET` + transfer permission | Often N/A until 2nd outlet / CK |
| Banquets | `BANQUET` | **N/A** on plain restaurant |
| Brands | `MULTI_BRAND` | **N/A** |
| Guests / Rooms | `ROOM_SERVICE` | **N/A** (hospitality tenant) |
| Events / Production | `EVENTS` / `PRODUCTION` | May be N/A by type |
| Portal POS `/pos` | Permission `POS_ACCESS` | Pass for owner |
| Billing | `ORG_MANAGE_SETTINGS` | Pass for owner |
| Razorpay / Cashfree pay-now | Keys configured | **N/A** without keys |
| QSR ERP ↔ POS switch | Cafe / bakery / food_truck / qsr parent | N/A on classic restaurant |
| Management comparison / stock transfer | 2+ outlets | Needs second outlet |

Nav also filters by staff **permissions**. Staff without a permission should not see or should be denied the route.

---

## 3. Cross-portal journeys

### Journey A — Floor order → kitchen → reports

1. [ ] Waiter: login → open table → **Add items** → **Confirm order** / **Send to kitchen**
2. [ ] KDS: ticket appears within ~5s → **Mark Preparing** → **Mark Ready** → **Mark Served**
3. [ ] Admin **Orders**: dine-in order listed with correct total/source
4. [ ] Admin **Reports** → **Today** → Daily summary / Item-wise reflect the order

### Journey B — QR guest session

1. [ ] Waiter table → **Start QR session** / **Show QR** → **Copy link**
2. [ ] Incognito or Guest app: open link → menu loads with table/session
3. [ ] Guest adds items → checkout (pay later or UPI if keys exist)
4. [ ] Waiter **End session** → guest refresh fails or session ends
5. [ ] Admin Orders shows online/QR source

### Journey C — Counter POS

1. [ ] POS login as Cashier → **Open shift** if required
2. [ ] Add items → **Pickup** → **Hold** → **Resume** → **Pay full** → **Cash**
3. [ ] Optional e-bill **SMS** / **Email** / **Dismiss**
4. [ ] Admin Orders + Reports updated

### Journey D — CDS board

1. [ ] Admin **Displays** → copy CDS or Pickup URL → open in new tab
2. [ ] Place a takeaway/POS order
3. [ ] Order appears in **Preparing**; after kitchen ready → **Ready**

### Journey E — Marketplace listing (Cullinos App)

1. [ ] Admin **App listing** → enable **List on Cullinos App** → hours/photos → **Save listing**
2. [ ] Super Admin **Guest Ops → Marketplace** → **Approve** / Featured / rank **Set**
3. [ ] Guest app **Home** / **Explore** shows outlet (may need geo / discover config)

---

## 4. Super Admin — platform.cullinos.com

**Who:** Platform ops only.

### 4.1 Auth

#### Login (`/login`)

1. [ ] Open login → enter email/password → **Sign in**
2. [ ] If OTP: enter code → **Verify and sign in**; try **Resend code**
3. [ ] **Forgot password?** link works

**Expected:** Lands on Dashboard.

#### Forgot password (`/forgot-password`)

1. [ ] **Send reset code** with valid email
2. [ ] **Update password** with code + new password (or confirm UI accepts flow without crashing)

### 4.2 Dashboard (`/`)

1. [ ] KPIs and recent tenants load without error
2. [ ] Nav links work: Tenants, Plans, Subscriptions, Cullinos App, Settings, System health, Marketing

### 4.3 Tenants (`/tenants`)

1. [ ] List loads; search/filter by status/plan if present
2. [ ] **Onboard restaurant** → fill required fields → **Create tenant** (use a throwaway QA org or skip if already created in Ch.1)
3. [ ] Row **Open** → tenant detail
4. [ ] **Suspend** (reason) → owner Admin login blocked
5. [ ] **Activate** → owner login works again
6. [ ] **Delete** only on disposable QA tenant (type name → **Delete forever**) — skip on shared tenants
7. [ ] **Load more** if many tenants

#### Tenant detail (`/tenants/:id`)

1. [ ] **Open as tenant** (impersonation) → Admin opens with banner; exit cleanly
2. [ ] **Collect payment** / **Reset password** UI opens without crash (complete only on QA tenant)
3. [ ] Suspend / Activate from detail matches list behaviour

### 4.4 Plans (`/plans`)

1. [ ] Plans list loads
2. [ ] **Create plan** → **Create** (QA-only; or cancel)
3. [ ] Row **Edit** → **Save**

### 4.5 Subscriptions (`/subscriptions`)

1. [ ] Select QA tenant → change plan → **Update subscription**
2. [ ] Confirm entitlements update (Admin modules appear/disappear as expected)

### 4.6 Promo email (`/promo-email`)

1. [ ] Page loads
2. [ ] Compose draft → **Send campaign** only to internal test list (or cancel after validating UI)

**Note:** Promo email is **platform** only — not Admin.

### 4.7 Cullinos App — Guest Ops

#### Overview (`/guest-ops`)

1. [ ] KPIs load; section links open marketplace, discover, banners, push, offers, reviews, users, analytics, runtime
2. [ ] If maintenance banner: **Edit runtime settings**

#### Marketplace (`/guest-ops/marketplace`)

1. [ ] Filters/search work
2. [ ] Toggle Featured / Listed; rank **Set**
3. [ ] **Approve** / **Reject** / **Force unlist** / **Clear unlist** on QA listing

#### Discover (`/guest-ops/discover`)

1. [ ] **Create section** → **Save changes**
2. [ ] **Edit** / **Delete** section

#### Banners (`/guest-ops/banners`)

1. [ ] **Create banner** → **Save changes**
2. [ ] **Edit**, **Deactivate**, **Delete**

#### Push (`/guest-ops/push`)

1. [ ] **Create draft** → **Save draft**
2. [ ] **Schedule** or **Send now** only to test devices; **Cancel** draft if unused

#### Offers (`/guest-ops/offers`)

1. [ ] **Create offer** → **Save changes**
2. [ ] **Edit**, **Deactivate**, **Delete**

#### Reviews (`/guest-ops/reviews`)

1. [ ] Filter/search
2. [ ] **Hide**, **Remove**, **Restore**

#### Users (`/guest-ops/users`)

1. [ ] **Search** guest user
2. [ ] **Export JSON**
3. [ ] **Erase user** only on disposable test account

#### Analytics (`/guest-ops/analytics`)

1. [ ] 30-day metrics load (read-only)

#### Runtime (`/guest-ops/runtime`)

1. [ ] Edit theme/maintenance/flags carefully → **Save runtime settings** (prefer QA-safe toggles; reverse after)

Legacy redirects: `/guest-banners`, `/guest-push`, `/guest-coupons` → guest-ops equivalents.

### 4.8 Settings (`/settings`)

1. [ ] Open page → **Refresh**
2. [ ] Change a safe field → **Save**

### 4.9 System health (`/health`)

1. [ ] Metrics load → **Refresh**

### 4.10 Marketing CMS

#### Hub (`/marketing`)

1. [ ] Hub links open all editors
2. [ ] **Publish site** only when intentionally publishing (or skip)

#### Media (`/marketing/media`)

1. [ ] **Upload file** → appears in library
2. [ ] **Delete** test file

#### Hero (`/marketing/hero`)

1. [ ] Edit slide → **Save slide**

#### Pages (`/marketing/pages`)

1. [ ] Edit block → **Save block**

#### Theme (`/marketing/theme`)

1. [ ] Edit → **Save theme draft**

#### Pricing (`/marketing/pricing`)

1. [ ] Edit cards → **Save**

#### Testimonials (`/marketing/testimonials`)

1. [ ] **Add testimonial** → **Save**; **Delete** test entry

#### Navigation (`/marketing/navigation`)

1. [ ] Edit item → **Save**

#### Blog (`/marketing/blog`)

1. [ ] **Create draft** → **Save**; **Delete** test draft

#### Design lab (`/marketing/design-lab`)

1. [ ] **Generate suggestions** / seed presets if present → apply only as draft

### 4.11 Sign out

1. [ ] **Sign out** → login page; session cleared

---

## 5. Admin / Owner portal — admin.cullinos.com

**Who:** Owner / managers with ERP permissions. QSR orgs may see **ERP | POS** switch; cashiers may be POS-only.

### 5.1 Auth & onboarding

#### Login (`/login`)

1. [ ] Email/password → **Sign in**; optional **Keep me signed in**
2. [ ] OTP path if challenged: **Verify and sign in**, **Resend code**, **Back to sign in**
3. [ ] **Forgot password?**

#### Forgot password (`/forgot-password`)

1. [ ] **Send reset code** → **Update password** (or confirm UI)

#### Change password (`/change-password`)

1. [ ] Forced after temp password → **Save new password**
2. [ ] Impersonation: **Back to dashboard** if shown

#### Onboarding (`/onboarding`)

1. [ ] Reachable when `!setupCompleted` or via Settings → **Open restaurant setup**
2. [ ] Walk all steps → **Complete setup** (seeds sample categories)

### 5.2 Dashboard (`/`)

1. [ ] KPI cards load
2. [ ] Toggle trend **7d** / **14d** / **30d**
3. [ ] Chart mode **Revenue** / **Orders**
4. [ ] After test orders, revenue/order counts look sane

### 5.3 Portal POS (`/pos`)

**Gate:** `POS_ACCESS`

1. [ ] Open **/pos** (or POS mode switch)
2. [ ] **Open shift** if prompted
3. [ ] Tap categories / items; cart subtotal correct
4. [ ] Set **Pickup** or **Eat in**
5. [ ] **Hold (H)** → Held panel → **Resume**
6. [ ] **Pay full** → **Cash (Enter)** or **UPI / card** (UPI N/A without keys)
7. [ ] E-bill: **SMS** / **Email** / **Dismiss**
8. [ ] **Close shift**
9. [ ] Staff without POS access denied or redirected

### 5.4 Menu (`/menu`)

**Gate:** `MENU_READ`

#### Categories tab

1. [ ] **Add category** → save → appears in list
2. [ ] **Edit** / **Save changes**; **Delete** unused test category

#### Items tab

1. [ ] **Add item** → category, name, price, flags → **Add item**
2. [ ] **Add variant** / **Add group** / **Add modifier** → save
3. [ ] **Upload photo** after save
4. [ ] Toggle Online; **Edit** price; **Delete** disposable item

#### Combos tab

1. [ ] **Create combo** → **Add item** lines → save
2. [ ] **Edit** / **Delete**

#### Schedules tab

1. [ ] **Create schedule** → save → **Edit** / **Delete**

#### Outlet prices tab

1. [ ] With outlet selected, edit price/availability → **Save**

### 5.5 Orders (`/orders`)

1. [ ] List shows Phase 2 orders; filter **Scheduled / pre-orders only** if used
2. [ ] Open row → detail **Close**
3. [ ] Advance status: **CONFIRMED** → **PREPARING** → **READY** → **SERVED** → **COMPLETED** (and **CANCELLED** on a throwaway order)

### 5.6 Tables (`/tables`)

**Gate:** `TABLES`

1. [ ] **Add floor**; filter **All** / floor / **Unassigned**
2. [ ] **Add table** → **Create table**
3. [ ] Detail: **Edit table** → **Save changes**; status select
4. [ ] **Generate QR** / **Regenerate QR** → **Download QR** → **Copy URL**
5. [ ] **Print QR sheet**
6. [ ] Takeaway QR: **Download QR (800 px)** / **Copy URL**
7. [ ] Select two tables → **Merge selected** / **Transfer** (if available)
8. [ ] **Delete table** on disposable table only

### 5.7 Reservations (`/reservations`)

**Gate:** `TABLES`

1. [ ] **Copy public book link** → opens booking surface
2. [ ] **Create reservation** → appears in list
3. [ ] Row **Confirm** / **Cancel**

### 5.8 Inventory (`/inventory`)

**Gate:** Inventory feature + `INVENTORY_READ`

1. [ ] **Add item** → **Create item**
2. [ ] **Edit** → **Apply adjustment**; **Record wastage**
3. [ ] **Filter low-stock** / **Show all**
4. [ ] **Transfer stock** → **Transfer** (needs destinations)
5. [ ] **Delete** disposable item

### 5.9 Recipes (`/recipes`)

**Gate:** `RECIPES`

1. [ ] **Add recipe** → **Add ingredient** → **Create recipe**
2. [ ] **Edit** / **Save changes**; **Delete**

### 5.10 Purchasing (`/purchasing`)

**Gate:** Purchasing + `PURCHASE_READ` (create supplier first)

1. [ ] **New PO** → **Create draft PO**
2. [ ] Row **Send** → **Receive (GRN)**

### 5.11 Suppliers (`/suppliers`)

1. [ ] **Add supplier** → **Save supplier**
2. [ ] Row **Delete** disposable supplier

### 5.12 Central kitchen (`/central-kitchen`)

**Gate:** `MULTI_OUTLET` + transfer permission — often **N/A**

1. [ ] **Add hub** → **Create hub**
2. [ ] **New indent** → **Submit indent**
3. [ ] **Plan route**; indent **Fulfill**

### 5.13 Customers (`/customers`)

1. [ ] Form **Create** (optional **Opt in to promotional email**)
2. [ ] **Search**
3. [ ] Row **Add stamp**; detail **Redeem points**; **Close**
4. [ ] **Export** / **Erase** only on disposable test customer

### 5.14 Loyalty (`/loyalty`)

**Gate:** `LOYALTY`

1. [ ] Toggle **Stamp card enabled** → **Save settings**
2. [ ] **Create tier**; **Remove** disposable tier
3. [ ] **Add reward** → **Enable** / **Disable** / **Remove**

### 5.15 Coupons (`/coupons`)

1. [ ] **Create coupon** (Active) → list shows it
2. [ ] **Edit** / **Save changes**; **Deactivate**; **Delete**

### 5.16 Guests & Rooms (hospitality)

**Gate:** `ROOM_SERVICE` — **N/A** on restaurant

1. [ ] `/hospitality/guests` — list loads; **Erase** only disposable
2. [ ] `/hospitality/rooms` — table loads (read-only)

### 5.17 Events (`/events`)

**Gate:** `EVENTS` — may be N/A

1. [ ] **Schedule event** → appears in list

### 5.18 Banquets (`/banquets`)

**Gate:** `BANQUET` — usually **N/A**

1. [ ] **Add package**; **Add booking**

### 5.19 Brands (`/brands`)

**Gate:** `MULTI_BRAND` — usually **N/A**

1. [ ] **Add brand**

### 5.20 Production (`/production`)

**Gate:** `PRODUCTION` — may be N/A

1. [ ] **Schedule batch** → **Mark complete**

### 5.21 Displays (`/displays`)

**Gate:** `KDS`  
Legacy bookmarks `/kds`, `/cds`, `/promo-display`, `/pickup-queue` redirect here.

1. [ ] For Kitchen / CDS / Pickup / Promo: **Copy URL** → **Open in new tab ↗**
2. [ ] **Refresh** active displays / device status
3. [ ] Promo: **Add slide** → **Remove** test slide

### 5.22 Digital Ordering (`/kiosk`)

**Gate:** `QR_ORDERING`

1. [ ] **Copy** / **Open in new tab** for Ordering kiosk, Phone menu QR, Receipt printer station as shown
2. [ ] Kiosk URL opens Guest kiosk mode (pay at counter)

### 5.23 Delivery (`/delivery`)

**Gate:** `DELIVERY`

1. [ ] Page lists delivery orders/zones
2. [ ] **Add zone** → saved

### 5.24 Aggregators (`/aggregators`)

**Gate:** `REPORTS_READ`

1. [ ] Tabs **Swiggy** / **Zomato**
2. [ ] **Connect** / **Disconnect** (sandbox or N/A without credentials)
3. [ ] **Generate secret** / **Regenerate secret**
4. [ ] Per outlet: **Connected**, **Menu sync**, **Sync now**

### 5.25 Payments (`/payments`)

**Gate:** `SETTINGS_READ`

1. [ ] Tabs **Razorpay** / **Cashfree**
2. [ ] Toggle **Active**, **Default for online payments** → **Save Razorpay** / **Save Cashfree**
3. [ ] Outlet **Edit** → **Use outlet-specific keys** / prefer provider → **Save outlet** / **Cancel**
4. [ ] Without real keys: save may fail validation — mark pay-now flows **N/A**

### 5.26 App listing / Marketplace (`/marketplace`)

**Gate:** Online ordering + outlet/settings update

1. [ ] Enable **List on Cullinos App**
2. [ ] **Upload image** / **Add photo** → **Set cover**; set hours (**Open** / **Close** / **Closed**)
3. [ ] **Save listing**

### 5.27 Guest banners (`/guest-banners`)

1. [ ] **Create banner** → **Save changes**
2. [ ] **Edit** / **Delete**

### 5.28 SMS campaigns (`/sms-campaigns`)

**Gate:** `SETTINGS_UPDATE`

1. [ ] Link **Top up wallet** / **Open Billing** works
2. [ ] Select **All opted-in** or recipients → **Send campaign** only if wallet funded (else Blocked/N/A)

### 5.29 Staff (`/staff`)

1. [ ] **Add staff member** → fill name*, phone, email*, temp password*, role → outlets → **Create account**
2. [ ] Status **active** / **inactive**
3. [ ] **Delete** disposable staff (not owner)

### 5.30 Reports (`/reports`)

1. [ ] Presets **Today** / **7 days** / **30 days**
2. [ ] Tabs: **Daily summary**, **Item-wise**, **Category**, **Payment methods**, **Discounts**, **Cancellations**, **Food cost**
3. [ ] Choose export type → **Export** downloads/opens

### 5.31 Settings (`/settings`)

**Gate:** `SETTINGS_READ` — form UI (not JSON editor)

1. [ ] Edit restaurant name, phone, email, GSTIN, city, address → **Save settings**
2. [ ] Toggle **Dine-in**, **Takeaway / pickup**, **Home delivery**, **QR ordering** → Save
3. [ ] Toggle **Enable pre-orders & scheduling** if shown → Save
4. [ ] **Open restaurant setup** → onboarding
5. [ ] **Add location** → name* → **Add location**
6. [ ] **Create tax group** (group name, rate name, %)
7. [ ] **Register device** (Printer / KDS / POS)

**Expected:** Toast/success; values persist after refresh. Invalid empty required fields blocked by UI.

### 5.32 Billing (`/billing`)

1. [ ] Subscription status loads
2. [ ] **Pay / activate** / **Open payment page** (complete only if intentional)
3. [ ] Wallet **Top up ₹…** presets (N/A without payment)

### 5.33 Logout

1. [ ] Sign out → re-login works; session persistence matches “Keep me signed in”

---

## 6. Management — manage.cullinos.com

**Who:** Chain / multi-outlet owners (Enterprise).

### 6.1 Login (`/login`)

1. [ ] **Sign in** with owner credentials

### 6.2 Overview (`/`)

1. [ ] KPIs, outlets, payment mix load
2. [ ] Brand / outlet selectors (**All brands**, **All outlets**)

### 6.3 Reports (`/reports`)

1. [ ] Consolidated revenue / recent orders load

### 6.4 Outlet comparison (`/comparison`)

1. [ ] Filters **Date**, **City**, **Zone**, **State**
2. [ ] Needs **2+ outlets** — else N/A / empty

### 6.5 Stock transfer (`/stock-transfer`)

1. [ ] Select **From outlet**, **To outlet**, **Inventory item**, **Quantity** → **Submit transfer**
2. [ ] N/A with single outlet

### 6.6 Franchise (`/franchise`)

1. [ ] Franchisees table loads

### 6.7 Sign out

1. [ ] **Sign out**

---

## 7. POS — pos.cullinos.com

**Who:** Cashier (and owners with POS access). Desktop Electron uses the same SPA.

### 7.1 Login (`/login`)

1. [ ] **Open register** with cashier email/password; **Keep me signed in**

### 7.2 Register (`/`)

1. [ ] **Open shift** / later **Close shift**
2. [ ] Search **Search items… ( / )**; category tabs; **Recent**
3. [ ] Add items; cart subtotal correct; qty / **Remove item**
4. [ ] **Find** loyalty phone if testing loyalty
5. [ ] Order type **Pickup** / **Eat in**
6. [ ] Coupon / Discount / Tip / **Pay amount** as available
7. [ ] **Hold (H)** → **Resume** from Held orders
8. [ ] **Split selected items** (optional)
9. [ ] **Pay full** → **Cash (Enter)** or **UPI / card**
10. [ ] E-bill **SMS** / **Email** / **Dismiss**
11. [ ] Header **Sign out**

**Expected:** Order in Admin Orders; KDS ticket if kitchen flow enabled.

---

## 8. KDS & public displays — kds.cullinos.com

### 8.1 Kitchen login (`/login`)

1. [ ] **Open KDS**; OTP: **Verify and open KDS**, **Resend code**, **Back to sign in**

### 8.2 Kitchen board (`/`)

1. [ ] Select **Outlet** → live tickets
2. [ ] **Refresh**; fullscreen; ticket **Mark Preparing** → **Mark Ready** → **Mark Served**
3. [ ] **Logout**

### 8.3 Order status / CDS (public)

URL from Admin Displays, e.g. `?mode=cds&orgSlug=…&outletSlug=…` or `?mode=pickup&…`

1. [ ] Board loads without login
2. [ ] Columns **Preparing** / **Ready** update with live orders
3. [ ] Fullscreen works

### 8.4 Promo playlist (public)

`?mode=playlist&orgSlug=…&outletSlug=…`

1. [ ] Slides auto-play from Admin promo content
2. [ ] **Enter fullscreen** / **Exit fullscreen**

### 8.5 Receipt mode

`?mode=receipt&outletId=…`

1. [ ] Auth + outlet as required
2. [ ] **Reprint last** works after a print event

---

## 9. Waiter Android — Cullinos Waiter

**Package:** floor staff. Accounts from Admin → Staff (Waiter).

### 9.1 Splash & login

1. [ ] App opens splash → login
2. [ ] Phone **Send OTP** → **Verify OTP** / **Resend OTP**, or **Use email instead** → **Sign in**
3. [ ] **Keep me signed in**

### 9.2 Floor (`/`)

1. [ ] Outlet picker; floor filter **All floors**
2. [ ] Table grid shows Admin tables; tap table

### 9.3 Table detail (`/table/:tableId`)

1. [ ] **Assign table** → occupied
2. [ ] **Add items** → cart → **Send to kitchen** / **Confirm order**
3. [ ] **Mark served**
4. [ ] **Start QR session** / **Show QR** → **Copy link** → **OK**
5. [ ] **End session**
6. [ ] **Transfer table** / **Merge tables**
7. [ ] **Collect payment** → **Confirm cash** or **Online (UPI / card)** → **Paid**

### 9.4 Calls (`/calls`)

1. [ ] Filters **Open** / **Acknowledged** / **All**
2. [ ] **Acknowledge** → **Done**
3. [ ] Sound/haptic respect More settings

### 9.5 Orders hub (`/orders`)

1. [ ] Filters; mark **Served**

### 9.6 More / settings (`/more`)

1. [ ] Change outlet; language → **Confirm language**
2. [ ] Toggle **Call alert sound**, **Call haptic feedback**
3. [ ] **Log out**

---

## 10. Cullinos App (Guest)

**Android app** + deep links `https://guest.cullinos.com/o/{org}/{outlet}` (± `?table=` / `?session=`).  
Decommissioned customer web is **out of scope**.

### 10.1 Auth (`/login`)

1. [ ] **Continue with Google** / **Email** / **Phone**
2. [ ] Phone: **Send OTP** → **Verify & continue** / **Resend OTP**
3. [ ] PIN: **Sign in with PIN** / **Save PIN & continue**
4. [ ] **Change number**, **Other options**

### 10.2 Marketplace shell

#### Home (`/`)

1. [ ] Quick **Dine In** / **Takeaway** / **Delivery** / **Offers**
2. [ ] Nearby restaurants list; **Retry** on error

#### Explore (`/explore`)

1. [ ] Filters **Veg Only**, **Offers Only**, radius
2. [ ] Open a restaurant → outlet shell

#### Offers (`/offers`)

1. [ ] Offers list loads

#### Scan (`/scan`)

1. [ ] Camera; **Album**, **Light**; scan table QR → outlet/session

#### Profile (`/profile`) — auth required

1. [ ] Links **Orders**, **Loyalty**, **Coins**
2. [ ] **Edit** profile → **Save** / **Cancel**
3. [ ] Addresses **Edit** / **Set default**
4. [ ] Privacy / Terms; **Log out**

### 10.3 Location (`/location/map`)

1. [ ] Pin location → confirm for discover/delivery

### 10.4 Notifications / orders / loyalty

1. [ ] `/notifications` list loads when logged in
2. [ ] `/orders` → open `/orders/:id`; empty state **Explore restaurants** / **Scan a table QR**
3. [ ] `/wallets` and `/coins` load

### 10.5 Outlet ordering

1. [ ] Open `/o/{org}/{outlet}` (from Admin Digital Ordering or QR)
2. [ ] **Menu** → category **All** → **ADD +** on item
3. [ ] Item detail → qty → **Add to Cart | ₹…** → **View Cart**
4. [ ] Cart: notes **Save**; **Clear Cart**; **Proceed to Checkout**
5. [ ] Checkout (auth): **Delivery** / **Dine In** / **Takeaway**; **ASAP** / **Schedule for later**; coupon **Apply**; tip; pay **UPI** / **Card** / **Wallet** or pay-later → **Pay ₹…**
6. [ ] Confirm **Paid** / success; order in Admin Orders

### 10.6 Kiosk (`…/kiosk`)

1. [ ] No login required
2. [ ] **Pickup** / **Eat in** → add items → **Place order · Pay at counter · ₹…**
3. [ ] Success → **New order**
4. [ ] Ticket appears for counter/kitchen as designed

### 10.7 Legal

1. [ ] `/privacy`, `/terms` → **Open in browser** if offered

---

## 11. Marketing website — cullinos.com

No login. CMS content comes from Super Admin Marketing.

| Path | Steps |
|------|--------|
| `/` | [ ] Hero + nav; **Start free trial** / **Contact**; cookie **Accept** / **Decline** |
| `/features` | [ ] Page loads; CTA |
| `/about` | [ ] Page loads; CTAs |
| `/pricing` | [ ] Plans; **Start free trial** / **Contact sales** |
| `/contact` | [ ] **Send message** → `/thank-you` or graceful error |
| `/thank-you` | [ ] **Back to home** |
| `/integrations` | [ ] Loads; **Contact us** |
| `/blog` | [ ] Index; **Subscribe via RSS** |
| `/blog/[slug]` | [ ] Article readable |
| `/solutions/restaurants` | [ ] Loads |
| `/solutions/cafes` | [ ] Loads |
| `/solutions/bakeries` | [ ] Loads |
| `/solutions/food-trucks` | [ ] Loads |
| `/solutions/chains` | [ ] Loads |
| `/solutions/hospitality` | [ ] Loads |
| `/privacy` | [ ] Loads |
| `/terms` | [ ] Loads |
| `/unsubscribe` | [ ] Token flow or Privacy link |

Nav/footer: **Home**, **Features**, **About**, **Pricing**, **Contact**, Product/Solutions links.

---

## 12. Appendix — URLs, ports & commands

### Production URLs (full)

| App | URL | Notes |
|-----|-----|-------|
| Super Admin | https://platform.cullinos.com | Onboard, Guest Ops, Marketing CMS |
| Super Admin login | https://platform.cullinos.com/login | |
| Super Admin tenants | https://platform.cullinos.com/tenants | |
| Super Admin guest-ops | https://platform.cullinos.com/guest-ops | |
| Super Admin promo email | https://platform.cullinos.com/promo-email | Not in Admin |
| Admin | https://admin.cullinos.com | Owner ERP |
| Admin login | https://admin.cullinos.com/login | |
| Admin Portal POS | https://admin.cullinos.com/pos | Needs `POS_ACCESS` |
| Admin Displays | https://admin.cullinos.com/displays | KDS/CDS/Pickup/Promo |
| Admin Digital Ordering | https://admin.cullinos.com/kiosk | Storefront / kiosk links |
| Admin Payments | https://admin.cullinos.com/payments | Gateway keys |
| Admin Settings | https://admin.cullinos.com/settings | Form UI (not JSON) |
| Management | https://manage.cullinos.com | Multi-outlet |
| POS | https://pos.cullinos.com | Cashier terminal |
| KDS kitchen | https://kds.cullinos.com | Staff login |
| Guest outlet | https://guest.cullinos.com/o/{orgSlug}/{outletSlug} | Replace slugs |
| Guest kiosk | https://guest.cullinos.com/o/{orgSlug}/{outletSlug}/kiosk | Pay at counter |
| Marketing | https://cullinos.com | Public site |
| API health | https://api.cullinos.com/api/v1/health | Expect healthy JSON |
| API DB health | https://api.cullinos.com/api/v1/health/db | |
| Swagger | https://api.cullinos.com/docs | Authorize with Bearer JWT |

### Local ports (optional)

| App | Port | Dev command |
|-----|------|-------------|
| Marketing web | 5180 | `npm run dev --workspace=@cullinos/web` |
| Admin | 5181 | `npm run dev --workspace=@cullinos/admin` |
| Management | 5182 | `npm run dev --workspace=@cullinos/management` |
| Super Admin | 5183 | `npm run dev --workspace=@cullinos/super-admin` |
| POS | 5173 | See commands above (set `VITE_API_URL`) |
| KDS | 5174 | See commands above (set `VITE_API_URL`) |

### Pack & evidence commands

```bash
# Regenerate all PDFs + Excel from markdown
npm run qa:export

# PDF only
node scripts/generate-qa-pdf.mjs

# Excel only
node scripts/generate-qa-excel.mjs
```

### Out of scope

- Decommissioned **Customer web** (`apps/customer`) and **Waiter web** (`apps/waiter`)
- Admin orphan pages without routes (`GuestPushPage`, `PromoEmailPage`) — use Super Admin Guest Ops / Promo email
- Live payment capture without configured keys → **N/A**
- Destructive Super Admin delete on non-QA tenants → skip

---

## Sign-off (optional)

| Field | Value |
|-------|-------|
| Tester | |
| Run ID | RUN-YYYYMMDD |
| Tenant slug | |
| Guide version date | 2026-09-20 |
| Incomplete sections | |
| Signature | |
