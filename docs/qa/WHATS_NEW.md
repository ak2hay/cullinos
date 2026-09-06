# Cullinos QA — What's New for Testers

**Cycle:** 2026-09 (share with the latest QA pack)  
**Case count:** **160** test cases (was 127)

Read this before Day 1. Full steps stay in [TESTER_HANDBOOK.md](./TESTER_HANDBOOK.md).

---

## Production apps (updated)

| App | URL | Notes |
|-----|-----|-------|
| POS | https://pos.cullinos.com | **Hosted** — not local-only |
| KDS | https://kds.cullinos.com | **Hosted** — not local-only |
| Admin Portal POS | https://admin.cullinos.com/pos | In-admin counter POS (permission `POS_ACCESS`) |
| Order Display (CDS) | Admin → `/cds` | Replaces Pickup Queue (`/pickup-queue` redirects here) |

Local POS/KDS remains an optional fallback only.

---

## New or upgraded features to test

### Admin (owner)

| Feature | Path | What changed |
|---------|------|--------------|
| **Tables** | `/tables` | Real create/edit UI (no longer a placeholder) |
| **Inventory** | `/inventory` | Real stock UI (no longer a placeholder) |
| **Recipes** | `/recipes` | Full recipes UI (also still in Swagger) |
| **Loyalty** | `/loyalty` | Dedicated loyalty page |
| **Delivery** | `/delivery` | Delivery orders UI |
| **Promo Email** | `/promo-email` | Compose / send promo campaigns |
| **Billing** | `/billing` | Subscription / billing page |
| **Kitchen Display** | `/kds` | Launcher for KDS URL |
| **Order Display** | `/cds` | Customer-facing preparing/ready board launcher |
| **Digital Ordering** | `/kiosk` | Kiosk / storefront launcher |
| **Portal POS** | `/pos` | Hold / resume / checkout in Admin |
| **Forgot / Change password** | `/forgot-password`, `/change-password` | Auth recovery flows |

### Business-type gated (often **N/A** on restaurant tenant)

| Feature | Path | Visible when |
|---------|------|--------------|
| Banquets | `/banquets` | Banquet / events business type |
| Brands | `/brands` | Cloud kitchen / multi-brand |
| Guests | `/hospitality/guests` | Hotel / room service |
| Rooms | `/hospitality/rooms` | Hotel / room service |

Primary QA tenant: **enterprise** + **restaurant** (medium or large size so Tables, KDS, Inventory, Loyalty, Recipes, Delivery appear). Mark gated pages **N/A** unless you create a second tenant of that type.

### Customer storefront

- Guest checkout still works without login (incognito).
- Optional **customer login** modal — test that browse/checkout still works as guest, and login UI opens without crashing.

### Super Admin

| Feature | Path |
|---------|------|
| Plans | `/plans` |
| Promo Email | `/promo-email` |
| Testimonials editor | `/marketing/testimonials` |
| Design Lab | `/marketing/design-lab` |
| Settings | `/settings` |
| Forgot password | `/forgot-password` |

---

## Known limitations (updated)

| Still expected | Not a bug anymore |
|----------------|-------------------|
| Razorpay pay-now without keys → **N/A** | Admin Tables placeholder |
| Outlet comparison needs 2+ outlets | Admin Inventory placeholder |
| Banquets / Brands / Guests / Rooms hidden on restaurant → **N/A** | POS/KDS “local only” |

---

## Share pack

After `npm run qa:export`, send:

1. `Whats_New.pdf` (this doc)
2. `QA_Tester_Handbook.pdf`
3. `Quick_Reference_Card.pdf`
4. `Employee_Brief.pdf`
5. `TEST_RUN_SHEET.xlsx` / `BUG_LOG.xlsx` / `CREDENTIALS_LOG.xlsx`

Hand off Super Admin login securely on Day 1 (password manager — never in Excel).
