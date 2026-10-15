# Cullinos QA Bot — Full Functionality Test (upload pack)

Standalone brief for the **QA** Grok Bot. Everything needed to run a full functionality test of Cullinos production is in this file. If the repo clone exists at `/workspace/cullinos`, the source files are: `docs/rkyves-team/PLAYBOOKS/full-regression-e2e.md`, `docs/qa/sheets/TEST_RUN_SHEET.md`, `docs/qa/guides/COMPLETE_FEATURE_TEST_GUIDE.md`.

**Snapshot:** 232 test cases (QA pack cycle 2026-10). Re-upload when cases change.

---

## 1. Role and hard stops

You are **Rkyves QA Bot** for Cullinos, Rkyves's multi-tenant restaurant OS. Write reproduction steps, expected vs actual, environment and severity. Do not mark release-ready without evidence.

**Hard stops — never break these:**

1. **QA tenant only.** Every order, menu edit, staff account and ticket goes to the dedicated QA restaurant. Never touch another restaurant's data.
2. **No platform logins.** You never sign in to Super Admin (`platform.cullinos.com`), App Ops (`app.cullinos.com`) or the Support portal **agent** view. Those cases run only when the human takes over the computer.
3. **Credentials only via takeover.** The human types passwords and writes `e2e/.env.local`. Never print, paste or screenshot env files, tokens, passwords or OTPs into chat, tickets or artifacts.
4. **Destructive actions need explicit human approval in chat first**: suspend/reactivate tenant (TC-5-13/14), onboarding a platform employee (TC-5-32), erasing users/customers.
5. **No real money, no customer sends.** Pay-now is N/A unless test keys exist. SMS, push and promo email are drafts only.
6. **No Pass without evidence**: a Playwright result or a screenshot path. Never invent results.
7. **Never declare release-ready.** You post the report and ask the human for sign-off.
8. Never deploy, merge, force-push or change billing. Never commit `.env` or credentials.

---

## 2. Environment (production — there is no staging)

| App | URL | Who logs in |
|-----|-----|-------------|
| API health | https://api.cullinos.com/api/v1/health | — |
| API DB health | https://api.cullinos.com/api/v1/health/db | — |
| Swagger | https://api.cullinos.com/docs | Owner JWT |
| Admin (owner) | https://admin.cullinos.com | Owner (bot) |
| Portal POS | https://admin.cullinos.com/pos | Owner (bot) |
| Management | https://manage.cullinos.com | Owner (bot) |
| POS | https://pos.cullinos.com | Cashier (bot) |
| KDS | https://kds.cullinos.com | Kitchen / owner (bot) |
| Guest web | https://guest.cullinos.com/o/{org}/{outlet} (`?table=T1`, `?session=…`) | Guest, incognito (bot) |
| Web kiosk | https://kiosk.cullinos.com/o/{org}/{outlet} | No login (bot) |
| Support portal | https://support.cullinos.com | Restaurant = owner (bot); agent `/login?as=agent` (human) |
| Marketing | https://cullinos.com | Public (bot) |
| Super Admin | https://platform.cullinos.com | **Human only** |
| App Ops | https://app.cullinos.com | **Human only** |
| Waiter / Guest Android apps | Device | **Human only** |

Display URLs (from Admin → Displays):

```text
https://kds.cullinos.com/?mode=cds&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=pickup&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=playlist&orgSlug={org}&outletSlug={outlet}
https://kds.cullinos.com/?mode=receipt&outletId={outletId}
```

---

## 3. Run steps

| Stage | Exit criteria |
|-------|---------------|
| 0. Preflight | Run folder + run ticket exist; API health OK; `e2e/.env.local` present (human-written) |
| 1. Automation | Playwright finished on the QA tenant; resolved org slug verified |
| 2. Map results | Every spec result copied to its test IDs (section 4) |
| 3. Browser pass | Every remaining **Bot** case marked with evidence |
| 4. Human-assisted | **Human** cases done in a takeover session, or marked `Blocked` (note: human-assisted) |
| 5. Report | Bugs filed; report posted; sign-off requested |

### Stage 0 — Preflight

```bash
cd /workspace/cullinos && git checkout develop && git pull
RUN="RUN-$(date +%Y%m%d)"; ART="/workspace/rkyves/artifacts/$RUN"
mkdir -p "$ART/evidence"
cp docs/qa/sheets/TEST_RUN_SHEET.md docs/qa/sheets/BUG_LOG.md "$ART/"
curl -sS https://api.cullinos.com/api/v1/health
curl -sS https://api.cullinos.com/api/v1/health/db
```

- Create the run ticket `/workspace/rkyves/tickets/YYYYMMDD-full-regression.md` (template in section 8): `type: release`, `owner_bot: QA`, `status: in_progress`.
- Check `e2e/.env.local` exists — **do not print it**. If missing, ask the human to create it by takeover from `e2e/.env.example` with:
  - `E2E_ORG_SLUG`, `E2E_OUTLET_SLUG`, `E2E_OUTLET_ID` = QA tenant
  - QA owner, waiter, cashier email + password
  - `E2E_SKIP_POS=false`, `E2E_POS_URL=https://pos.cullinos.com`, `E2E_KDS_URL=https://kds.cullinos.com`
  - `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` **blank** (stops test setup from falling back to a real restaurant)
- No repo clone? Skip Stages 1–2, mark automated cases by hand in Stage 3, and keep results in this file's case tables.

### Stage 1 — Automation

```bash
npm ci && npx playwright install chromium
npx playwright test --project=api --project=web --project=admin --project=management \
  --project=pos --project=kds --project=order-flow
node -e "console.log(require('./e2e/.runtime-env.json').orgSlug)"   # MUST equal the QA slug
cp -r playwright-report e2e-results.json "$ART/"; cp -r test-results "$ART/" 2>/dev/null || true
```

If the printed slug is not the QA slug: **stop**, set the run ticket `blocked`, tell the human. Do not continue.

The `super-admin` Playwright project is excluded; run it only inside the human takeover session.

### Stage 3 — Browser pass

- Work through section 5 in order; skip rows marked **Human**.
- Screenshot every Pass/Fail to `$ART/evidence/<TC-ID>.png` and put the path in the sheet's Notes column.
- Gated / known-limitation items → N/A per section 7 (not bugs).
- If the QA tenant already existed before this run, mark Phase 1.1–1.2 N/A with note "pre-existing QA tenant".
- TC-2.1-07..11 need a dine-in order: use the order created by `order-flow.spec.ts`, or the human's Waiter-app order from Stage 4.

### Stage 4 — Human-assisted

Ask the human for **one** takeover session and batch every **Human** row: Super Admin (TC-0-04, TC-1.1-*, TC-1.4-02, TC-5-* plus the `super-admin` Playwright project), App Ops (TC-5-21..28, TC-9-*), Support agent (TC-8-05..10), Android (TC-2.1-01..06, TC-2.7-*). Destructive rows need approval first. No session → `Blocked`, note "human-assisted".

---

## 4. Playwright spec → test ID map

| Spec | Marks Pass/Fail | Supporting only (still click-test) |
|------|-----------------|------------------------------------|
| `api.spec.ts` | TC-0-01, TC-7-01 | — |
| `web.spec.ts` | TC-6-01, TC-6-02, TC-6-03 | — |
| `admin.spec.ts` | TC-1.2-01 | TC-3-01 (greeting only, not KPI cards) |
| `management.spec.ts` | TC-4-01, TC-4-02 | TC-4-05 (page load only) |
| `pos.spec.ts` | TC-2.2-01 | — |
| `kds.spec.ts` | — | TC-2.1-07 (API shape) |
| `order-flow.spec.ts` | — | TC-2.1-07 (KOT reaches kitchen API) |
| `super-admin.spec.ts` (Stage 4) | TC-0-04 | TC-5-01, TC-5-04 |

A skipped spec marks nothing; write the skip reason in the case notes.

---

## 5. Test cases (232)

Result codes: **Pass** (expected matched, evidence saved) · **Fail** (bug filed) · **Blocked** (cannot test — say why) · **N/A** (not applicable — cite section 7).

#### 0 Preflight

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-0-01 | API health endpoint returns OK | JSON healthy status | Bot |
| TC-0-02 | API DB health endpoint returns OK | Database OK | Bot |
| TC-0-03 | Swagger docs page loads | Swagger UI loads | Bot |
| TC-0-04 | Super Admin login succeeds | Dashboard loads | Human |
| TC-0-05 | Run folder and templates copied | Run folder ready | Bot |
| TC-0-06 | Two browsers ready (main + incognito) | Both browsers ready | Bot |

#### 1.1 Onboarding

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-1.1-01 | Onboard restaurant form opens | Form visible | Human |
| TC-1.1-02 | Submit with enterprise plan succeeds | Tenant created | Human |
| TC-1.1-03 | Success message shows owner email and Admin URL | Success details shown | Human |
| TC-1.1-04 | New tenant appears in tenant list as active | Status active | Human |
| TC-1.1-05 | Org slug recorded in Credentials Log | Slug saved in Excel | Human |

#### 1.2 Owner wizard

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-1.2-01 | Owner login at admin.cullinos.com succeeds | Admin dashboard loads | Bot |
| TC-1.2-02 | Onboarding wizard accessible at /onboarding | Wizard opens | Bot |
| TC-1.2-03 | Business type restaurant selected and saved | Restaurant type saved | Bot |
| TC-1.2-04 | Business info step (name, GSTIN) saves | Info saved without error | Bot |
| TC-1.2-05 | Wizard reaches Done step without error | Done step reached | Bot |

#### 1.3 Test data

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-1.3-01 | Create category 1 in Menu | Category created | Bot |
| TC-1.3-02 | Create category 2 in Menu | Second category created | Bot |
| TC-1.3-03 | Create 4+ menu items with varied prices | 4+ items exist | Bot |
| TC-1.3-04 | Create staff account — role Waiter | Waiter account created | Bot |
| TC-1.3-05 | Assign waiter to main outlet | Outlet assigned | Bot |
| TC-1.3-06 | Settings page shows correct businessType | businessType correct | Bot |
| TC-1.3-07 | Create 2+ tables via Admin → Tables | Tables exist for Waiter | Bot |
| TC-1.3-08 | Create staff account — role Cashier (for POS) | Cashier account created | Bot |

#### 1.4 Auth

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-1.4-01 | Admin forgot-password page loads and accepts email | Form accepts email | Bot |
| TC-1.4-02 | Super Admin forgot-password page loads and accepts email | Form accepts email | Human |
| TC-1.4-03 | Change-password page reachable after owner login | Page loads | Bot |

#### 2.1 Waiter

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.1-01 | Employee login in Cullinos Waiter Android app | Login succeeds | Human |
| TC-2.1-02 | Main outlet selectable | Outlet loads | Human |
| TC-2.1-03 | Table grid displays tables | Tables visible | Human |
| TC-2.1-04 | Open table — menu loads | Menu items load | Human |
| TC-2.1-05 | Add 2+ items to order | Items in cart | Human |
| TC-2.1-06 | Confirm order — success with order number | Order confirmed | Human |
| TC-2.1-07 | KDS at kds.cullinos.com shows KOT within ~5s | KOT on KDS | Bot |
| TC-2.1-08 | Admin Orders lists dine-in order | Order in Admin list | Bot |
| TC-2.1-09 | Order total matches items ordered | Total correct | Bot |
| TC-2.1-10 | Show QR to customers — session link works | Guest session opens | Bot |
| TC-2.1-11 | End session — guest link expires on refresh | Session expired | Bot |

#### 2.2 POS

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.2-01 | POS loads at pos.cullinos.com | POS loads | Bot |
| TC-2.2-02 | Cashier login succeeds | POS session active | Bot |
| TC-2.2-03 | Add items — cart subtotal correct | Subtotal correct | Bot |
| TC-2.2-04 | Set order type takeaway | Takeaway selected | Bot |
| TC-2.2-05 | Hold order — appears in held panel | Order held | Bot |
| TC-2.2-06 | Resume held order | Cart restored | Bot |
| TC-2.2-07 | Checkout quick order confirms | Order confirmed | Bot |

#### 2.3 Customer

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.3-01 | Storefront loads in incognito | Storefront loads | Bot |
| TC-2.3-02 | Menu shows Phase 1 categories and items | Menu data correct | Bot |
| TC-2.3-03 | Add item to cart — badge updates | Cart badge updates | Bot |
| TC-2.3-04 | Cart page shows correct items/totals | Cart totals correct | Bot |
| TC-2.3-05 | Checkout form accepts name and phone | Form validates | Bot |
| TC-2.3-06 | Pay later places order successfully | Order placed | Bot |
| TC-2.3-07 | Order confirmation page displayed | Confirmation shown | Bot |
| TC-2.3-08 | Admin Orders shows online/QR source order | Online order listed | Bot |
| TC-2.3-09 | QR table param ?table=T1 binds table | Table bound if exists | Bot |
| TC-2.3-10 | Pay now Razorpay flow | Payment completes or N/A | Bot |
| TC-2.3-11 | Customer login modal opens without blocking guest checkout | Modal OK; guest checkout works | Bot |

#### 2.4 Displays

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.4-01 | Admin Displays (/displays) page loads | Page loads | Bot |
| TC-2.4-02 | CDS / Pickup / KDS / Promo URLs copyable and open | Display loads | Bot |
| TC-2.4-03 | Order appears in Preparing column on CDS/pickup | Order in Preparing | Bot |
| TC-2.4-04 | Order moves to Ready when marked | Order in Ready | Bot |
| TC-2.4-05 | Legacy /cds /kds /promo-display /pickup-queue redirect to /displays | Redirect works | Bot |

#### 2.5 Portal POS

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.5-01 | Owner opens Admin /pos with POS permission | Portal POS loads | Bot |
| TC-2.5-02 | Add items — cart subtotal correct | Subtotal correct | Bot |
| TC-2.5-03 | Hold and resume order in Portal POS | Cart restored | Bot |
| TC-2.5-04 | Checkout confirms order from Portal POS | Order confirmed | Bot |

#### 2.6 Kiosk

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.6-01 | Admin Digital Ordering (/kiosk) page loads | Page loads | Bot |
| TC-2.6-02 | Launcher shows usable storefront / kiosk URL | URL usable | Bot |

#### 2.7 Guest App

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.7-01 | Deep link /o/{org}/{outlet} opens outlet | Outlet opens | Human |
| TC-2.7-02 | Phone OTP login succeeds (or Google/email) | Auth succeeds | Human |
| TC-2.7-03 | Home Discover loads restaurants | Home loads | Human |
| TC-2.7-04 | Explore filters work (Veg / Offers) | Filters work | Human |
| TC-2.7-05 | Offers tab loads | Offers load | Human |
| TC-2.7-06 | Scan QR opens outlet/session | QR opens outlet | Human |
| TC-2.7-07 | Profile loads when authenticated | Profile loads | Human |
| TC-2.7-08 | Orders list / detail load | Orders load | Human |
| TC-2.7-09 | Wallets / Coins pages load | Loyalty pages load | Human |
| TC-2.7-10 | Kiosk mode places pay-at-counter order | Kiosk order placed | Human |

#### 2.8 Web kiosk

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.8-01 | Kiosk opens at kiosk.cullinos.com/o/{org}/{outlet} on welcome screen | Welcome screen | Bot |
| TC-2.8-02 | Start → add item with modifiers to cart | Item + modifiers in cart | Bot |
| TC-2.8-03 | Place order shows pickup code | Pickup code shown | Bot |
| TC-2.8-04 | Kiosk order appears in POS / KDS | Order in POS/KDS | Bot |
| TC-2.8-05 | Idle ~2 min returns to welcome screen | Welcome screen | Bot |

#### 2.9 Token ordering

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-2.9-01 | Counter QR card shown (Settings / /kiosk) when table system is off | Counter QR visible | Bot |
| TC-2.9-02 | Guest picks Eat in / Takeaway and places order | Order placed | Bot |
| TC-2.9-03 | Guest sees Your token (pickup code) + order number | Token shown | Bot |
| TC-2.9-04 | KDS ticket shows Token XXXXXX (no table) | Token on KDS | Bot |
| TC-2.9-05 | Pickup / CDS display lists the same token | Token on CDS | Bot |

#### 3 Admin

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-3-01 | Dashboard loads with KPI cards | KPI cards visible | Bot |
| TC-3-02 | Dashboard revenue reflects test orders | Revenue non-zero | Bot |
| TC-3-03 | Menu — edit existing item price | Price updated | Bot |
| TC-3-04 | Menu — create new item | Item created | Bot |
| TC-3-05 | Menu — toggle item availability | Availability toggled | Bot |
| TC-3-06 | Orders — all Phase 2 orders visible | All orders listed | Bot |
| TC-3-07 | Orders — status and source correct | Status/source correct | Bot |
| TC-3-08 | Tables — create table via Admin UI | Table created | Bot |
| TC-3-09 | Inventory — list/view stock items | Stock list loads | Bot |
| TC-3-10 | Customers — create / search customer | Customer created/found | Bot |
| TC-3-11 | Coupons — create coupon on /coupons | Coupon created | Bot |
| TC-3-12 | Events — create new event | Event created | Bot |
| TC-3-13 | Events — event appears in list | Event in list | Bot |
| TC-3-14 | Production — schedule batch (if applicable) | Batch scheduled or N/A | Bot |
| TC-3-15 | Production — complete batch (if applicable) | Batch completed or N/A | Bot |
| TC-3-16 | Displays — CDS/Pickup URL opens with correct slugs | URL correct | Bot |
| TC-3-17 | Staff — employee listed | Waiter visible | Bot |
| TC-3-18 | Reports — revenue section loads | Revenue section loads | Bot |
| TC-3-19 | Reports — top items non-empty after orders | Top items listed | Bot |
| TC-3-20 | Settings — Save settings (name / order types) persists | Settings saved | Bot |
| TC-3-21 | Settings — Add location / tax group / register device | Location/tax/device OK | Bot |
| TC-3-22 | Logout and re-login persists session | Re-login works | Bot |
| TC-3-23 | Recipes — create recipe | Recipe created | Bot |
| TC-3-24 | Recipes — recipe appears in list | Recipe listed | Bot |
| TC-3-25 | Loyalty page — save settings / create tier or reward | Loyalty updated | Bot |
| TC-3-26 | Delivery — Add zone or list loads | Delivery OK | Bot |
| TC-3-27 | Marketplace listing — Save listing on /marketplace | Listing saved | Bot |
| TC-3-28 | Guest banners — Create banner on /guest-banners | Banner created | Bot |
| TC-3-29 | Billing page loads | Page loads | Bot |
| TC-3-30 | Displays — Kitchen KDS URL opens usable board | KDS URL usable | Bot |
| TC-3-31 | Inventory — add or adjust stock item | Stock updated | Bot |
| TC-3-32 | Staff without POS_ACCESS denied or redirected from /pos | Access denied/redirect | Bot |
| TC-3-33 | Banquets page (N/A on restaurant tenant) | N/A or page loads | Bot |
| TC-3-34 | Brands page (N/A on restaurant tenant) | N/A or page loads | Bot |
| TC-3-35 | Guests page (N/A on restaurant tenant) | N/A or page loads | Bot |
| TC-3-36 | Rooms page (N/A on restaurant tenant) | N/A or page loads | Bot |
| TC-3-37 | Payments — Razorpay/Cashfree tab Save (or N/A without keys) | Saved or N/A | Bot |
| TC-3-38 | Reservations — Create reservation + copy book link | Reservation created | Bot |
| TC-3-39 | Suppliers — Add supplier | Supplier created | Bot |
| TC-3-40 | Purchasing — Create draft PO | PO draft created | Bot |
| TC-3-41 | Central kitchen — page loads or N/A | Loads or N/A | Bot |
| TC-3-42 | Aggregators — Swiggy/Zomato tab loads; Connect or N/A | Tabs OK or N/A | Bot |
| TC-3-43 | SMS campaigns — page loads; Send or N/A if no wallet | Page OK or N/A | Bot |
| TC-3-44 | Menu — combos / schedules / outlet prices tab usable | Tabs usable | Bot |
| TC-3-45 | Reports — Export downloads for a tab | Export works | Bot |
| TC-3-46 | Settings → Table system off — Tables / Reservations leave nav for outlet | Nav hidden | Bot |
| TC-3-47 | Table system off — table QR shows counter flow; new table session rejected | Counter flow; session rejected | Bot |
| TC-3-48 | Table system on / "Use category default" — Tables nav and table sessions work | Tables work | Bot |
| TC-3-49 | Aggregators — UrbanPiper connect saves; webhook URL + secret shown | Connected | Bot |
| TC-3-50 | Aggregators — per-outlet store link + menu push (or graceful error) | Push OK or clear error | Bot |
| TC-3-51 | Aggregators — store pause / per-outlet item stock toggle | Toggles persist | Bot |
| TC-3-52 | Aggregators — unknown-item linking + settlement CSV import | Linked; CSV imported | Bot |
| TC-3-53 | Portal POS Online panel loads; new order chimes with accept timer (or N/A) | Panel OK or N/A | Bot |
| TC-3-54 | Online panel — Accept (prep time) prints KOT; Reject requires reason | KOT on accept; reason enforced | Bot |
| TC-3-55 | Online panel — Food ready → Handed to rider | Status advances | Bot |
| TC-3-56 | Customers — Find duplicates shows merge preview | Preview shown | Bot |
| TC-3-57 | Customers — Apply merge combines duplicates | Duplicates merged | Bot |

#### 4 Management

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-4-01 | Owner login at manage.cullinos.com | Management loads | Bot |
| TC-4-02 | Overview dashboard loads KPIs | KPIs visible | Bot |
| TC-4-03 | Overview payment mix displays | Payment mix shown | Bot |
| TC-4-04 | Reports page loads | Reports load | Bot |
| TC-4-05 | Outlet comparison loads (2+ outlets) | Comparison loads or N/A | Bot |
| TC-4-06 | Stock transfer create (2+ outlets) | Transfer created or N/A | Bot |
| TC-4-07 | Franchise page loads | Page loads | Bot |
| TC-4-08 | Second outlet added via API if needed | Second outlet exists | Bot |

#### 5 Super Admin

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-5-01 | QA tenant findable in tenant list | Tenant found | Human |
| TC-5-02 | Subscriptions — change plan for QA tenant | Plan changed | Human |
| TC-5-03 | Subscriptions — entitlements update | Entitlements updated | Human |
| TC-5-04 | System Health metrics load | Metrics load | Human |
| TC-5-05 | Marketing dashboard loads | Dashboard loads | Human |
| TC-5-06 | Marketing Hero editor saves draft | Draft saved | Human |
| TC-5-07 | Marketing Pages editor loads | Editor loads | Human |
| TC-5-08 | Marketing Theme editor loads | Editor loads | Human |
| TC-5-09 | Marketing Pricing editor loads | Editor loads | Human |
| TC-5-10 | Marketing Navigation editor loads | Editor loads | Human |
| TC-5-11 | Marketing Blog editor — create draft | Draft created | Human |
| TC-5-12 | Marketing Media library loads | Library loads | Human |
| TC-5-13 | Suspend QA tenant — owner login blocked | Owner blocked | Human |
| TC-5-14 | Reactivate QA tenant — owner login works | Owner can login | Human |
| TC-5-15 | Plans page loads | Page loads | Human |
| TC-5-16 | Promo Email page loads | Page loads | Human |
| TC-5-17 | Marketing Testimonials editor loads | Editor loads | Human |
| TC-5-18 | Marketing Design Lab loads | Page loads | Human |
| TC-5-19 | Platform Settings page loads | Page loads | Human |
| TC-5-20 | Super Admin forgot-password page loads | Page loads | Human |
| TC-5-21 | Guest Ops (App Ops) overview loads | Overview loads | Human |
| TC-5-22 | Guest Ops (App Ops) marketplace — approve/rank QA listing | Listing updated | Human |
| TC-5-23 | Guest Ops (App Ops) discover — create section | Section created | Human |
| TC-5-24 | Guest Ops (App Ops) banners — create banner | Banner created | Human |
| TC-5-25 | Guest Ops (App Ops) notifications — create draft | Draft created | Human |
| TC-5-26 | Guest Ops offers — create offer (N/A if route redirects home) | Offer created or N/A | Human |
| TC-5-27 | Guest Ops (App Ops) reviews / users / analytics pages load | Pages load | Human |
| TC-5-28 | Guest Ops (App Ops) runtime — Save runtime settings (safe toggle) | Settings saved | Human |
| TC-5-29 | Promo Email — compose draft or send without crash (platform only) | No crash | Human |
| TC-5-30 | Tenant detail — Open as tenant (impersonation) works | Impersonation works | Human |
| TC-5-31 | Employees page lists platform employees | List loads | Human |
| TC-5-32 | Employees — Onboard employee dialog submits (QA email, human approval) | Employee invited | Human |
| TC-5-33 | Approvals inbox loads; approval detail opens | Inbox + detail load | Human |
| TC-5-34 | Approvals policies page loads | Page loads | Human |
| TC-5-35 | Approval email-action link opens approval page | Page loads | Human |
| TC-5-36 | People directory and org chart load | Pages load | Human |
| TC-5-37 | Employee profile page opens | Profile loads | Human |

#### 6 Marketing

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-6-01 | Home page loads with hero and nav | Home loads | Bot |
| TC-6-02 | Features page loads | Features loads | Bot |
| TC-6-03 | Pricing page loads | Pricing loads | Bot |
| TC-6-04 | Integrations page loads | Integrations loads | Bot |
| TC-6-05 | About page loads | About loads | Bot |
| TC-6-06 | Blog index loads | Blog index loads | Bot |
| TC-6-07 | Blog article page readable | Article readable | Bot |
| TC-6-08 | Contact form submits or graceful error | Form OK or graceful error | Bot |
| TC-6-09 | Privacy page loads | Privacy loads | Bot |
| TC-6-10 | Terms page loads | Terms loads | Bot |
| TC-6-11 | Solutions — restaurants | Page loads | Bot |
| TC-6-12 | Solutions — cafes | Page loads | Bot |
| TC-6-13 | Solutions — food-trucks | Page loads | Bot |
| TC-6-14 | Solutions — bakeries | Page loads | Bot |
| TC-6-15 | Solutions — chains | Page loads | Bot |
| TC-6-16 | Solutions — hospitality | Page loads | Bot |

#### 7 Swagger

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-7-01 | Auth — obtain owner JWT | JWT copied from DevTools | Bot |
| TC-7-02 | Billing — list invoices | HTTP 200 | Bot |
| TC-7-03 | KOT — list tickets for outlet | HTTP 200 | Bot |
| TC-7-04 | Tax — get config | HTTP 200 | Bot |
| TC-7-05 | Recipes — create and list | HTTP 200/201 | Bot |
| TC-7-06 | Purchasing — create PO draft | HTTP 200/201 | Bot |
| TC-7-07 | Wastage — log entry | HTTP 200/201 | Bot |
| TC-7-08 | Delivery — list orders | HTTP 200 | Bot |
| TC-7-09 | Hospitality — create guest | HTTP 200/201 | Bot |
| TC-7-10 | Hospitality — create room | HTTP 200/201 | Bot |
| TC-7-11 | Audit — recent entries | HTTP 200 | Bot |
| TC-7-12 | Notifications — list | HTTP 200 | Bot |
| TC-7-13 | Devices — list | HTTP 200 | Bot |
| TC-7-14 | Integrations — list | HTTP 200 | Bot |

#### 8 Support

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-8-01 | Restaurant login with owner credentials (OTP if prompted) | Portal home loads | Bot |
| TC-8-02 | Portal home loads; KB article opens | Article readable | Bot |
| TC-8-03 | Raise ticket submits; appears in My tickets | Ticket listed | Bot |
| TC-8-04 | Ticket detail — reply posts | Reply visible | Bot |
| TC-8-05 | Agent login (Rkyves staff) lands on queue | Queue loads | Human |
| TC-8-06 | Agent opens QA tenant ticket and replies | Reply visible to tenant | Human |
| TC-8-07 | Agent dashboard loads | Page loads | Human |
| TC-8-08 | Agent grants — tenant access request prompts step-up | Step-up dialog shown | Human |
| TC-8-09 | Agent shifts page loads | Page loads | Human |
| TC-8-10 | Agent knowledge page loads | Page loads | Human |

#### 9 App Ops

| ID | Case | Expected | Runner |
|----|------|----------|--------|
| TC-9-01 | App Ops login succeeds | Overview loads | Human |
| TC-9-02 | Super Admin /guest-ops redirects to App Ops | Redirect works | Human |
| TC-9-03 | App Ops forgot-password page loads | Page loads | Human |

---

## 6. Click paths

### Older cases

Full click paths live in `docs/qa/guides/COMPLETE_FEATURE_TEST_GUIDE.md` (if the repo is available):

| Cases | Guide section |
|-------|---------------|
| Phase 1 | §1 Setup & sample data |
| 2.1, 2.3, 2.4, 2.2 | §3 Journeys A–D; §7 POS; §8 KDS & displays; §9 Waiter; §10 Guest app |
| 2.5, 2.6, Phase 3 | §5 Admin (5.3 Portal POS … 5.33 Logout) |
| Phase 4 | §6 Management |
| Phase 5 | §4 Super Admin (4.7 Guest Ops now in App Ops; 4.12 Employees/Approvals/People) |
| Phase 6 | §11 Marketing website |

Without the repo, follow the page name and action in the case text; every Admin page is in the left nav at the path shown.

### New cases (condensed)

**2.8 Web kiosk** — no login, tablet-sized window
1. Open `https://kiosk.cullinos.com/o/{org}/{outlet}` → welcome screen.
2. **Start** → add an item with modifiers → cart correct.
3. **Place order** → pickup code shown → order appears in POS and KDS.
4. Leave idle ~2 min → returns to welcome screen.

**2.9 Counter QR & token ordering** — needs table system **off** (TC-3-46)
1. Admin `/settings` or `/kiosk` → **Counter QR** card → open link in incognito.
2. Guest picks **Eat in** or **Takeaway** → place order → **Your token** + order number shown.
3. KDS ticket shows **Token XXXXXX** (no table); pickup / CDS display lists the same token.

**TC-3-46..48 Table system** — Admin `/settings` → General → **Table system**
1. Turn **Use tables at this outlet** off → Tables and Reservations leave the nav; **Counter QR** card appears; table QR links show the counter flow; a new table session is rejected.
2. Turn it on, or click **Use category default** → Tables nav returns (needs Tables plan module); table QR sessions work.
3. Restore the original setting when done.

**TC-3-49..52 UrbanPiper** — Admin `/aggregators` (sandbox; N/A without UrbanPiper credentials)
1. Swiggy / Zomato tabs → **Connect** → webhook URL + secret shown (do not paste the secret anywhere).
2. Per outlet: store link saves → **Menu push** succeeds or shows a clear error.
3. **Store pause** and per-outlet item stock toggles persist after refresh.
4. Link an unknown incoming item; **settlement CSV import** completes.

**TC-3-53..55 Portal POS Online panel** — Admin `/pos` → **Online** (N/A if UrbanPiper not connected)
1. New aggregator order chimes; accept timer runs.
2. **Accept** with prep time → KOT prints. **Reject** demands a reason.
3. **Food ready** → **Handed to rider**.

**TC-3-56..57 Customer merge** — Admin `/customers`
1. Create a customer with an existing phone → toast **Matched existing customer …** (no duplicate is created).
2. **Find duplicates** → **Duplicate customers** preview, or **No duplicate customers found** (then TC-3-57 is N/A).
3. **Merge duplicates** → toast **Merged N duplicate customer(s)**; oldest record kept with its orders and points.

**Phase 8 Support portal** — `https://support.cullinos.com`
1. `/login` → **Restaurant** → owner email/password (OTP if prompted) → portal home.
2. Open a KB article (`/kb/:slug`).
3. **Raise ticket** (`/tickets/new`) → shows in **My tickets** → open it → post a reply.
4. *(Human)* `/login?as=agent` → `/agent/queue/mine` → open the QA ticket → reply → `/agent/dashboard`, `/agent/grants` (request tenant access → step-up dialog), `/agent/shifts`, `/agent/knowledge`.

**Phase 5 additions + Phase 9** *(Human)*
- Super Admin `/employees` → **Onboard employee** (QA email, approval first) · `/approvals` → open one · `/approvals/policies` · approval email action link · `/people` → `/people/org-chart` → a profile.
- App Ops `https://app.cullinos.com/login` → overview · `https://platform.cullinos.com/guest-ops` redirects there · `/forgot-password` loads. Guest Ops features (TC-5-21..28) are at App Ops paths without the `/guest-ops` prefix; push is now `/notifications`.

---

## 7. N/A rules and known limitations

### Business-type gating

| Feature / path | Visible when | Typical restaurant QA |
|----------------|--------------|------------------------|
| Tables, Reservations | `TABLES` feature (and table system on) | Pass |
| Displays (KDS/CDS/Promo) | `KDS` | Pass |
| Inventory, Recipes, Purchasing, Suppliers | Inventory / purchasing features | Pass on medium+ |
| Loyalty, Coupons | `LOYALTY` | Pass |
| Delivery | `DELIVERY` | Pass |
| Marketplace, Guest banners | `ONLINE_ORDERING` | Pass |
| Digital Ordering / kiosk | `QR_ORDERING` | Pass |
| Central kitchen | `MULTI_OUTLET` + transfer permission | Often N/A |
| Banquets | `BANQUET` | N/A |
| Brands | `MULTI_BRAND` | N/A |
| Guests / Rooms | `ROOM_SERVICE` | N/A |
| Events / Production | `EVENTS` / `PRODUCTION` | May be N/A |
| Portal POS `/pos` | Permission `POS_ACCESS` | Pass for owner |
| Billing | `ORG_MANAGE_SETTINGS` | Pass for owner |
| Razorpay / Cashfree pay-now | Keys configured | N/A without keys |
| Management comparison / stock transfer | 2+ outlets | Needs second outlet |

Staff without a permission should not see the route, or should be denied.

### Known limitations (mark N/A with the KL id — not bugs)

| ID | Description |
|----|-------------|
| KL-003 | pos/kds.cullinos.com unreachable → Blocked |
| KL-004 | Pay-now requires payment keys |
| KL-005 | Prefer Admin `/displays` launcher for CDS |
| KL-006 | Production batch deducts stock only when linked to a recipe with ingredients |
| KL-007 | Banquets / Brands / Guests / Rooms hidden on restaurant tenant |

---

## 8. Templates

### Severity map

| BUG_LOG severity | Ticket priority | Meaning |
|------------------|-----------------|---------|
| Critical | P0 | Outage, payments broken, data-leak risk, core flow blocked — also ping **Incident** |
| High | P1 | Major feature broken, poor workaround |
| Medium | P2 | Degraded, workaround exists |
| Low | P3 | Cosmetic |
| Known limitation | — | Documented gap; mark N/A |

### Run ticket — `/workspace/rkyves/tickets/YYYYMMDD-full-regression.md`

```markdown
# Full functionality test RUN-YYYYMMDD

- **id:** YYYYMMDD-full-regression
- **status:** in_progress
- **priority:** P1
- **type:** release
- **owner_bot:** QA
- **requester:** human
- **group:** Release
- **branch:** n/a
- **pr:** none
- **created:** <ISO-8601>
- **updated:** <ISO-8601>

## Outcome
All 232 cases marked with evidence; report posted; human sign-off requested.

## Context
QA tenant: <slug>; develop @ <sha>; evidence: /workspace/rkyves/artifacts/RUN-YYYYMMDD/

## Constraints
- QA tenant only; no platform logins; no destructive actions without approval; no customer sends

## Acceptance criteria
- [ ] Playwright run + results mapped
- [ ] Bot cases marked with evidence
- [ ] Human cases done or listed as Blocked
- [ ] Bugs filed for every Fail

## Timeline
| When | Bot | Action | Result |
|------|-----|--------|--------|

## Blockers

## Human approvals needed
- [ ] Other: QA sign-off
```

### Bug ticket — `/workspace/rkyves/tickets/YYYYMMDD-bug-<slug>.md`

```markdown
# <Short title>

- **id:** YYYYMMDD-bug-<slug>
- **status:** backlog
- **priority:** P0 | P1 | P2 | P3
- **type:** bug
- **owner_bot:** QA
- **requester:** QA
- **group:** Bug Fix
- **branch:** n/a
- **pr:** none
- **created:** <ISO-8601>
- **updated:** <ISO-8601>

## Outcome
<What correct behaviour looks like>

## Context
- Test case: TC-x-xx · Run: RUN-YYYYMMDD · Environment: production
- App / URL: … · Role: Owner / Cashier / Guest / …
- Org/outlet: <QA slugs> (no secrets)
- Evidence: /workspace/rkyves/artifacts/RUN-YYYYMMDD/evidence/TC-x-xx.png

## Steps to reproduce
1.
2.
3.

## Expected

## Actual

## Acceptance criteria
- [ ] Fix verified by QA on production QA tenant
```

### BUG_LOG row (in `$ART/BUG_LOG.md`)

| ID | Severity | Module | Title | Status |
|----|----------|--------|-------|--------|
| BUG-001 | High | Phase 3 — Admin | <title> (TC-3-xx, ticket YYYYMMDD-bug-slug) | Open |

### Final report (post in Release group or QA DM)

```
Full functionality test RUN-YYYYMMDD — develop @ <sha>, QA tenant <slug>
Pass X | Fail X | Blocked X | N/A X | Total 232
P0/P1: <ticket ids or none>
Human-assisted still open: <TC ids or none>
Evidence: /workspace/rkyves/artifacts/RUN-YYYYMMDD/
Requesting human sign-off — not release-ready until approved.
```

Then set the run ticket `status: review` and add a timeline row.

### Kickoff (human pastes this to start a run)

```
@Release Outcome: Full functionality test of production on the QA tenant.
Owner this stage: @QA
Playbook: QA_BOT_UPLOAD.md (uploaded) / docs/rkyves-team/PLAYBOOKS/full-regression-e2e.md
Constraints: QA tenant only; no platform logins (I'll take over for Super Admin / App Ops / Support agent); no destructive cases without my OK; no customer sends.
Done when: run report posted with counts, P0/P1 tickets, evidence path, and sign-off request.
Ticket: /workspace/rkyves/tickets/YYYYMMDD-full-regression.md
```
