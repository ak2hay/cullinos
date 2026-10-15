# Cullinos — Product & Feature Guide

**Cullinos** is Rkyves’s multi-tenant **restaurant operating system**: one cloud backend, role-specific apps, GST-native billing, and growth channels from QR ordering to a consumer marketplace app.

| | |
|---|---|
| **Product** | Cullinos Restaurant Operating System |
| **Company** | Rkyves |
| **Site** | https://cullinos.com |
| **Contact** | hello@rkyves.com · Mumbai, India |
| **Doc version** | 2026-09 |

Related client share pack (PDF): [docs/client/](./client/README.md) — Brochure, Product Overview, User Manual (`npm run client:export`).

---

## 1. What Cullinos is

Cullinos replaces fragmented tools (separate POS, kitchen printers, spreadsheets, delivery tablets, and marketing apps) with **one live system**:

- Cashier bills on **POS**
- Kitchen cooks from **KDS**
- Floor staff take orders on **Waiter**
- Guests order via **QR / online storefront** or the **Cullinos Cullinos App**
- Owners run menu, stock, staff, CRM, and reports from **Admin**
- Chains compare outlets from **Management**
- Rkyves operates tenants from **Super Admin**

Every order channel writes to the same kitchen and the same GST-ready ledger.

### Design principles

| Principle | Meaning |
|-----------|---------|
| **GST-native** | CGST / SGST / IGST on invoices — not an afterthought |
| **Role-specific apps** | Each role gets a focused UI, not one overloaded dashboard |
| **One source of truth** | Menu, prices, stock, and orders sync across apps |
| **India-first growth** | Phone OTP, Razorpay, MSG91 SMS, Swiggy/Zomato aggregators |
| **Plan-gated scale** | Starter → QSR → Professional → Enterprise → Hospitality |

---

## 2. Apps & surfaces

| App | URL / delivery | Who uses it | Purpose |
|-----|----------------|-------------|---------|
| **API** | api.cullinos.com | All clients | NestJS REST + Socket.IO |
| **Admin** | admin.cullinos.com | Owner / manager | Ops, menu, CRM, Cullinos App marketing, Portal POS |
| **POS** | pos.cullinos.com (+ Windows Electron) | Cashier | Counter & takeaway billing |
| **KDS** | kds.cullinos.com (+ Windows Electron) | Kitchen | Live tickets; CDS / promo / receipt modes |
| **Waiter** | Cullinos Waiter Android app | Floor staff | Table map, table-side orders, QR sessions |
| **Customer** | *(decommissioned web)* → Cullinos App | Guests | Use Android Cullinos App / guest deep links |
| **Guest** | Android app · guest.cullinos.com deep links | Consumers | Marketplace discover + outlet ordering |
| **Management** | manage.cullinos.com | Multi-outlet ops | Network KPIs, stock transfer, franchise |
| **Super Admin** | platform.cullinos.com | Rkyves | Tenants, plans, CMS |
| **Cullinos App Ops** | app.cullinos.com | Rkyves | Guest users, rich FCM, marketplace, Discover, banners, runtime |
| **Web** | cullinos.com | Prospects | Marketing site, pricing, blog |

---

## 3. Feature catalogue

### 3.1 Front of house

| Feature | Description |
|---------|-------------|
| **Point of Sale** | Touch checkout, modifiers, holds, takeaway, GST receipts, cash / Razorpay |
| **Portal POS** | Full cashier UI inside Admin (`/pos`) for counter teams |
| **Cashier shifts** | Open/close shifts and cash-drawer accountability |
| **Waiter app** | Mobile table map, table-side ordering, live status |
| **Table management** | Tables, capacity, merge/transfer, service requests |
| **Table sessions & QR** | Waiter starts session → guest scans → shared ticket |
| **Reservations** | Book tables from Admin; public book-link for guests |
| **Kitchen Display (KDS)** | Live KOTs, station routing, item ready states |
| **Order Display (CDS)** | Customer-facing Preparing → Ready board |
| **Promo display** | In-venue promo playlists on TV / tablet |
| **Kitchen Order Tickets (KOT)** | Ticket generation for print or screen |
| **Pickup queue** | Counter / QSR ready-queue workflows |

### 3.2 Customer channels

| Feature | Description |
|---------|-------------|
| **QR dine-in ordering** | Scan table QR; order into the active session |
| **Table system toggle** | Per outlet in **Settings → General → Table system**. Any business category can turn tables on or off; unset follows the category default (restaurant, cafe, bar on; QSR, bakery, food truck, cloud kitchen, catering off). Off hides Tables / Reservations, blocks table sessions and table orders, and keeps existing table data |
| **Counter QR (token ordering)** | When an outlet's tables are off, one counter QR (`guest.cullinos.com/o/{org}/{outlet}`) replaces table codes. Guests pick Eat in / Takeaway (as allowed), pay at the counter, and get a token (6-character pickup code + order number) shown on their phone, the KDS ticket, and the pickup / CDS display |
| **Online storefront** | Branded menu at `guest.cullinos.com/{org}/{outlet}` |
| **Digital Ordering / kiosk** | Self-serve kiosk mode + launcher URLs in Admin |
| **Guest checkout** | Name + phone; login optional |
| **Customer OTP auth** | Phone OTP (MSG91) for returning customers |
| **Loyalty portal** | Public loyalty view on the storefront |
| **Cullinos Cullinos App** | Android marketplace: nearby outlets, banners, order, reorder, push |
| **Deep links** | `https://guest.cullinos.com/o/{org}/{outlet}` and `cullinos://…` |

### 3.3 Guest marketplace (Cullinos App)

| Feature | Description |
|---------|-------------|
| **Nearby marketplace** | Discover outlets by location |
| **Outlet browse & order** | Menu, cart, dine-in / takeaway / delivery |
| **Auth** | Phone OTP, Firebase, optional PIN |
| **Orders & reorder** | History, detail, reorder preview |
| **Favorites & reviews** | Guest engagement signals |
| **Addresses & devices** | Delivery addresses; FCM device registry |
| **Loyalty wallets** | Points / stamps surfaced in-app |
| **Push notifications** | Order status + marketing campaigns |
| **App listing (Admin)** | Control marketplace presence for your outlet |
| **Guest banners** | Home / discover creative (org + platform) |
| **Guest push campaigns** | Targeted push from Super Admin App Ops (`/guest-ops/push`). Not routed in tenant Admin. |
| **Coupons & offers** | Codes validated at Guest / Customer checkout |
| **Featured ranking** | Platform can pin / feature outlets in Discover |
| **Discover CMS** | Curated home sections (cuisine packs, seasonal rows) |
| **Review moderation** | Platform hide/remove of Guest outlet reviews |
| **Guest user support** | Super Admin lookup, export, and DPDP erase for GuestUsers |

### 3.4 Menu & back office

| Feature | Description |
|---------|-------------|
| **Menu management** | Categories, items, modifiers, pricing, availability |
| **Inventory** | Stock levels, adjustments, outlet visibility |
| **Recipes & costing** | Ingredient links for cost and production |
| **Purchasing & POs** | Purchase orders and goods receipt |
| **Suppliers** | Supplier directory for procurement |
| **Wastage** | Waste logging against stock |
| **Production & batches** | Scale recipes, schedule and complete batches |
| **Central kitchen** | Indents / fulfillment across linked outlets |
| **Brands** | Multi-brand / cloud-kitchen catalogues |
| **ERP day-book export** | Accounting-friendly daily export |
| **Staff & roles** | RBAC (owner, manager, cashier, waiter, kitchen, …) |
| **Devices & print profiles** | Register devices; receipt / KOT print config |
| **Settings & onboarding** | Business type wizard, GSTIN, order types |
| **Billing (SaaS)** | Subscription plan, invoices, entitlements |

### 3.5 Orders & payments

| Feature | Description |
|---------|-------------|
| **Unified orders** | Create, confirm, status, hold/resume, cancel |
| **Discounts & split** | Line/order discounts; split bill support |
| **Payments** | Cash + Razorpay / Cashfree capture. Cancel refunds the captured amount on the tenant gateway when the payment id is stored; otherwise staff confirm a dashboard refund |
| **Tax engine** | Tax groups and GST calculation (`@cullinos/tax-engine`) |
| **Delivery management** | Track delivery orders from Admin |
| **Aggregators** | Swiggy / Zomato via UrbanPiper: orders land in POS for accept/reject with prep time, status push-back (accepted, food ready, dispatched, cancelled), menu push, per-outlet item stock and store pause, unknown-item linking, settlement reconciliation |
| **Feedback surveys** | Post-order survey links + public submit |

### 3.6 CRM & growth

| Feature | Description |
|---------|-------------|
| **Customer CRM** | Profiles, history, tiers |
| **Loyalty** | Stamps, points, rewards (admin + public) |
| **Coupons** | Discount codes across channels |
| **Promo email** | Compose and send from Super Admin (`/promo-email`). Not routed in tenant Admin |
| **SMS campaigns** | MSG91 marketing SMS (prepaid portal wallet) |
| **WhatsApp e-bills** | Platform MSG91 WhatsApp; owner enable + per-message wallet charge |
| **Events / pop-ups** | Event-driven pre-orders |
| **Privacy & consent** | Consent, export/erase, retention (DPDP-oriented) |

### 3.7 Enterprise & hospitality

| Feature | Description |
|---------|-------------|
| **Multi-outlet console** | Network KPIs, outlet comparison |
| **Stock transfer** | Move inventory between outlets |
| **Franchise tools** | Franchisee visibility |
| **Advanced analytics** | Network dashboards and exports |
| **API access** | Integrate custom workflows |
| **Hospitality guests** | Hotel guest profiles |
| **Rooms & room posting** | In-room dining; charge to folio |
| **Banquets** | Large-event menus and billing |
| **Room service** | Orders routed for hotel F&B |

### 3.8 Platform (Rkyves Super Admin)

| Feature | Description |
|---------|-------------|
| **Tenant onboarding** | Create org, issue owner credentials |
| **Suspend / activate** | Lifecycle control |
| **Plans & entitlements** | Module feature flags per plan |
| **Tenant access (impersonation)** | Only through an approved, time-boxed grant on a support ticket (read-only or full, 15 min–8 h). Read-only sessions cannot write; every action is logged with the staff employee ID and ticket |
| **Support desk** | Tickets per tenant with priority, SLA due times, team/assignee routing, internal notes and timeline |
| **Platform config** | SMTP, Razorpay, MSG91, WhatsApp (MSG91), FCM, R2, OpenAI, wallet messaging rates, … |
| **Marketing CMS** | Hero, pages, pricing, blog, media, theme |
| **Cullinos App Ops** | Full Cullinos App portal under `/guest-ops`: marketplace moderation & featuring, Discover CMS, banners (all scopes), segmented/scheduled push, offers featuring, review moderation, GuestUser support/privacy, analytics, app runtime (force/soft update, maintenance, remote legal URLs) |
| **Health & audit** | Platform health, audit trails |
| **Platform team & roles** | Rkyves employees with employee IDs, departments, nested teams and managers. Six system roles plus custom roles from a risk-rated permission catalog; role assignments to people or teams, scoped globally, by region or to a set of tenants, optionally time-bound. Permissions gate every Super Admin route and App Ops (`guest_ops.manage`); last active Owner is protected. See [`docs/rkyves-team/PLATFORM_STAFF.md`](rkyves-team/PLATFORM_STAFF.md) |
| **Approvals** | Configurable maker-checker policies (N approvers, approver roles or team, expiry, conditions) on sensitive actions such as tenant delete, plan changes, large wallet adjustments, settings, critical role grants, tenant access, exports and bulk jobs. Approvals inbox with notifications |
| **People ops** | Directory, org chart, bulk invite, joiner/mover/leaver (offboarding revokes access and hands over work), shifts and on-call rotations |
| **Staff activity log** | Append-only, hash-chained log of every Super Admin and tenant-access request with employee ID; chain verification; approval-gated export |
| **Access governance** | Access review campaigns, session management, IP allowlists (global/team/role), step-up OTP for high-risk actions, just-in-time temporary roles |
| **Ops reports** | SLA and workload dashboard, saved views, approval-gated CSV exports and bulk tenant jobs |

---

## 4. Integrations

| Integration | Status | Use |
|-------------|--------|-----|
| **Razorpay** | Available | Online payments, Guest/Customer verify, subscription collect |
| **MSG91** | Available | Phone OTP widget / Flow SMS; marketing SMS; WhatsApp templates |
| **WhatsApp (MSG91)** | Available | Cullinos platform number; tenant e-bill receipts (wallet-metered); Super Admin marketing drafts |
| **Firebase Auth + FCM** | Available | Guest auth; order & marketing push |
| **SMTP / Brevo** | Available | Staff email OTP, promo email |
| **Resend** | Available | Owner onboarding credential emails |
| **Cloudflare R2** | Available | Marketing CMS media |
| **Swiggy / Zomato** | Available (via UrbanPiper) | Restaurant's own UrbanPiper credentials. Orders, status push-back, menu and stock sync, settlements. Direct per-aggregator webhooks remain for legacy setups (no menu sync) |
| **Print / Local Gateway** | Available | Thermal receipts, KOT, cash drawer, scanners |
| **ERP day-book export** | Available | Accounting export (not a full ERP connector) |
| **Hotel PMS** | Roadmap | Deeper folio sync beyond room posting |
| **OpenAI** | Configured | Future AI / marketing assist |

---

## 5. Plans (India, INR)

List prices; Enterprise and Hospitality are quoted per customer ("Contact us").

| Plan | Monthly | Yearly | Best for | Highlights |
|------|---------|--------|----------|------------|
| **Starter** | ₹1,499/mo | ₹14,999/yr (save ₹2,989) | Single outlet launch | POS, KDS, tables, QR + online ordering, reports |
| **QSR / Food SMB** | ₹2,499/mo | ₹24,999/yr (save ₹4,989) | Cafes, trucks, counters | + counter mode, pickup queue, loyalty, production |
| **Professional** | ₹4,999/mo | ₹49,999/yr (save ₹9,989) | Growing restaurants | + inventory, CRM, delivery, up to 3 outlets |
| **Enterprise** | Contact us | Contact us | Chains & franchise | + multi-outlet, multi-brand, franchise, analytics, API. Custom pricing based on outlets, POS terminals, users, integrations and requirements. |
| **Hospitality** | Contact us | Contact us | Hotels & resorts | + room service, room posting, banquet, PMS-ready. Custom pricing based on rooms, outlets, terminals and integrations. |

Enterprise and Hospitality cannot be self-activated from Admin Billing; existing subscribers on those plans keep their stored price. The public catalog stores them at `0` with `contactSales: true`.

Entitlement keys live in `packages/shared` (`FEATURES` / `PLAN_FEATURES` / `PUBLIC_PLAN_CATALOG`).

**Custom quotes:** Super Admin creates a **private** plan row (hidden from marketing and `GET /subscriptions/plans`), then assigns it to one or more restaurants via Subscriptions / tenant management. Tenants see their assigned plan on Billing but cannot self-serve onto other private plans.

---

## 6. Who we serve

| Vertical | How Cullinos fits |
|----------|-------------------|
| Restaurants | Tables, waiter, QR dine-in, KDS, full back office |
| Cafes & QSR | Counter POS, Order Display, loyalty, kiosk |
| Food trucks & pop-ups | Mobile POS, events, quick service |
| Bakeries | Production batches, recipes, pre-orders |
| Cloud kitchens | Multi-brand menus, delivery, aggregators |
| Catering | Events, pre-orders, production planning |
| Bars & pubs | Tables/tabs, auto-created Bar station with per-category ticket routing, happy-hour pricing (Menu → Happy hours, enforced server-side), pour-size recipes with bottle stock, liquor stock register (Inventory → Stock register, CSV), State Excise tax group |
| Hotels & resorts | Room service, rooms, banquets (Hospitality / Enterprise) |

---

## 7. Typical day-to-day flows

1. **Owner** — Admin → menu, staff, stock, reports, Guest banners / SMS  
2. **Waiter** — Open table → order or show QR → kitchen sees KOT  
3. **Cashier** — POS / Portal POS → cart → hold or pay → receipt  
4. **Kitchen** — KDS tickets → mark ready → optional CDS board  
5. **Guest (web)** — Scan QR or open storefront → checkout  
6. **Guest (app)** — Discover outlet → order → push updates  
7. **Chain ops** — Management → KPIs, compare outlets, stock transfer  

Credential model: Super Admin onboards restaurant → owner creates staff in Admin → Staff. No public staff self-signup.

---

## 8. Architecture (summary)

- **Monorepo** — Turborepo + npm workspaces  
- **API** — NestJS, Prisma, PostgreSQL, Redis, Socket.IO  
- **Clients** — Vite React SPAs, Next.js marketing, Flutter Guest, Electron shells  
- **Tenancy** — `organizationId` scoping; Super Admin cross-tenant  
- **Production** — Self-hosted VM (API, DB, Redis, nginx SPAs, Next.js web)  

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 9. Document map

| Document | Audience | Path |
|----------|----------|------|
| **This guide** | Internal + detailed product reference | `docs/PRODUCT.md` |
| **Brochure** | Prospects | `docs/client/export/pdf/Cullinos_Brochure.pdf` |
| **Product Overview** | Decision makers | `docs/client/export/pdf/Cullinos_Product_Overview.pdf` |
| **User Manual** | Owners & staff | `docs/client/export/pdf/Cullinos_User_Manual.pdf` |
| **Agency & Creator Brief** | Marketing agencies, creators | `docs/client/AGENCY_BRIEF.md` · `docs/client/export/pdf/Cullinos_Agency_Brief.pdf` |
| **Architecture** | Engineers | `docs/ARCHITECTURE.md` |
| **Deployment** | Ops | `docs/DEPLOYMENT.md` |
| **Cullinos App** | Mobile / release | `apps/guest/README.md`, `docs/guest-app/` |
| **QA pack** | Testers | `docs/qa/` |
| **Marketing copy** | Website | `packages/shared/src/marketing.ts` |

Regenerate client PDFs after editing `scripts/generate-client-pdfs.mjs`:

```bash
npm run client:export
```
