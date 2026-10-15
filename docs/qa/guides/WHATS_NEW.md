# Cullinos QA — What's New for Testers

**Cycle:** 2026-09 (share with the latest QA pack)  
**Case count:** **232** test cases (was 190) — new: web kiosk (2.8), token ordering (2.9), table system / UrbanPiper / Online panel / customer merge (TC-3-46..57), platform employees / approvals / people (TC-5-31..37), Support portal (Phase 8), App Ops (Phase 9)

Read this before Day 1. Full click-by-click steps: **[COMPLETE_FEATURE_TEST_GUIDE.md](./COMPLETE_FEATURE_TEST_GUIDE.md)**. Day plan: [TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md).

---

## Production apps (updated)

| App | URL | Notes |
|-----|-----|-------|
| POS | https://pos.cullinos.com | **Hosted** — not local-only |
| KDS | https://kds.cullinos.com | **Hosted** — not local-only |
| Admin Portal POS | https://admin.cullinos.com/pos | In-admin counter POS (permission `POS_ACCESS`) |
| **Displays hub** | Admin → `/displays` | Single hub for KDS / CDS / Pickup / Promo URLs. Legacy `/kds`, `/cds`, `/promo-display`, `/pickup-queue` **redirect here** |
| Cullinos App | Deep link `guest.cullinos.com/o/{org}/{outlet}` + Android | Replaces customer web |
| Waiter | Cullinos Waiter Android | Replaces waiter web |

Local POS/KDS remains an optional fallback only.

---

## New or upgraded features to test

### Admin (owner)

| Feature | Path | What changed |
|---------|------|--------------|
| **Tables** | `/tables` | Real create/edit UI (no longer a placeholder) |
| **Reservations** | `/reservations` | Bookings + public book-link |
| **Inventory** | `/inventory` | Real stock UI (no longer a placeholder) |
| **Recipes** | `/recipes` | Full recipes UI |
| **Purchasing / Suppliers** | `/purchasing`, `/suppliers` | POs, GRN, supplier directory |
| **Central kitchen** | `/central-kitchen` | Indents / fulfillment (multi-outlet) |
| **Loyalty** | `/loyalty` | Dedicated loyalty page |
| **Delivery** | `/delivery` | Delivery orders UI |
| **Swiggy & Zomato** | `/aggregators` | UrbanPiper connect (sandbox/production), webhook URLs + secret, per-outlet store link, menu push, store pause, per-outlet item stock, unknown-item linking, settlement CSV import |
| **Payments** | `/payments` | Tenant Razorpay / Cashfree keys |
| **SMS campaigns** | `/sms-campaigns` | MSG91 marketing SMS |
| **Cullinos App** | `/marketplace`, `/guest-banners`, `/coupons` | Listing, banners, offers |
| **Displays** | `/displays` | Unified launcher + promo slides |
| **Billing** | `/billing` | Subscription / billing page |
| **Digital Ordering** | `/kiosk` | Kiosk / storefront launcher |
| **Portal POS** | `/pos` | Hold / resume / checkout in Admin. Start typing anywhere to search (no `/` needed); Hold is now **Alt+H**. **Online** panel shows Swiggy/Zomato orders with chime, accept timer, Accept (prep time) / Reject (reason) / Food ready / Handed to rider, KOT prints on accept |
| **Settings** | `/settings` | **Form UI** (restaurant details, order types, locations, tax, devices) — **not** a JSON editor |
| **Table system (per outlet)** | `/settings` → General → **Table system** | Toggle "Use tables at this outlet" for any business category; "Use category default" resets it. **Off:** Tables / Reservations disappear from nav for that outlet, a **Counter QR** card appears (also on `/kiosk`), table QR links show the counter flow, new table sessions are rejected. **On** (e.g. QSR): Tables nav appears (needs the Tables plan module) and table QR sessions work |
| **Token ordering** | Counter QR → guest web | Guest picks Eat in / Takeaway, places order, sees **Your token** (pickup code) + order number. KDS ticket shows **Token XXXXXX** for orders without a table; pickup / CDS display lists the same code |
| **Forgot / Change password** | `/forgot-password`, `/change-password` | Auth recovery flows |

**Removed from Admin:** Promo Email and Guest Push pages are **not** routed in Admin. Use:

- Promo Email → Super Admin `/promo-email`
- Guest push → Super Admin `/guest-ops/push`

**No “Demo data” button.** Sample menu categories are seeded only when the owner clicks **Complete setup** on onboarding.

### Business-type gated (often **N/A** on restaurant tenant)

| Feature | Path | Visible when |
|---------|------|--------------|
| Banquets | `/banquets` | Banquet / events business type |
| Brands | `/brands` | Cloud kitchen / multi-brand |
| Guests | `/hospitality/guests` | Hotel / room service |
| Rooms | `/hospitality/rooms` | Hotel / room service |
| Central kitchen | `/central-kitchen` | Multi-outlet / central kitchen plans |

Primary QA tenant: **enterprise** + **restaurant** (medium or large size so Tables, KDS, Inventory, Loyalty, Recipes, Delivery appear). Mark gated pages **N/A** unless you create a second tenant of that type.

### Cullinos App (Guest)

- Phone OTP / PIN / Google auth, marketplace Discover / Explore / Offers / Profile
- Outlet order, cart, checkout, kiosk (pay at counter)
- Deep links: `https://guest.cullinos.com/o/{org}/{outlet}`
- See `apps/guest/README.md` and Complete Feature Test Guide chapter 10

### Super Admin

| Feature | Path |
|---------|------|
| Plans | `/plans` |
| Guest App Ops | `/guest-ops` (marketplace, discover, banners, push, offers, reviews, users, analytics, runtime) |
| Promo Email | `/promo-email` |
| Testimonials editor | `/marketing/testimonials` |
| Design Lab | `/marketing/design-lab` |
| Settings | `/settings` |
| Forgot password | `/forgot-password` |
| Impersonation | Tenants → **Open as tenant** |

---

## Known limitations (updated)

| Still expected | Not a bug anymore |
|----------------|-------------------|
| Razorpay pay-now without keys → **N/A** | Admin Tables placeholder |
| Outlet comparison needs 2+ outlets | Admin Inventory placeholder |
| Banquets / Brands / Guests / Rooms hidden on restaurant → **N/A** | POS/KDS “local only” |
| Swiggy/Zomato needs an UrbanPiper account; without it, test on UrbanPiper sandbox or mark **N/A** | Settings as JSON editor |
| Direct Swiggy/Zomato webhook menu sync is rejected (use UrbanPiper menu push) | Aggregators "Coming soon" page |
| Admin `/promo-email` 404 | Expected — use Super Admin |

---

## Product docs for context

- **Complete Feature Test Guide:** [COMPLETE_FEATURE_TEST_GUIDE.md](./COMPLETE_FEATURE_TEST_GUIDE.md)
- Full feature guide: [../../PRODUCT.md](../../PRODUCT.md)
- Client brochure / overview / manual: [../../client/README.md](../../client/README.md)
- Architecture: [../../ARCHITECTURE.md](../../ARCHITECTURE.md)

---

## Share pack

Regenerate Excel/PDF after markdown changes:

```bash
npm run qa:export
```

Then share `export/pdf/` + `export/excel/` with testers. Case count in Excel should match **232** after regenerate.
