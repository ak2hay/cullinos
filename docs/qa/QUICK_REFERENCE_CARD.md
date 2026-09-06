# Cullinos QA — Quick Reference Card

Print this page and keep it at your desk.

---

## Production portals

| App | URL |
|-----|-----|
| Super Admin | https://platform.cullinos.com |
| Admin | https://admin.cullinos.com |
| Portal POS | https://admin.cullinos.com/pos |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| POS | https://pos.cullinos.com |
| KDS | https://kds.cullinos.com |
| Customer | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |
| Swagger | https://api.cullinos.com/docs |
| Health | https://api.cullinos.com/api/v1/health |

---

## 4-day test order

| Day | Focus |
|-----|-------|
| **1** | Preflight + onboard + menu + tables + Waiter + Cashier |
| **2** | Waiter + POS + KDS + guest checkout + CDS + Portal POS |
| **3** | Admin modules (new pages) + Management + Super Admin |
| **4** | Marketing site + Swagger API |

---

## Minimum test flow

1. Super Admin → **Onboard restaurant** (enterprise plan)
2. Admin → **Menu** + **Tables** + **Staff** (Waiter + Cashier)
3. Waiter → **Table order** → KDS verifies KOT
4. POS / Portal POS → hold / resume / checkout
5. Customer → **Checkout** in incognito (verify)
6. TEST_RUN_SHEET → mark all **160 cases**

---

## Result codes

| Code | Meaning |
|------|---------|
| **Pass** | Works as expected |
| **Fail** | Bug — log in BUG_LOG.xlsx + screenshot |
| **Blocked** | Cannot test (missing access/tools) |
| **N/A** | Not applicable |

---

## Rules

- **Never** put real passwords in Excel or email
- Use **Incognito** for guest customer tests
- **QA tenant only** for suspend/reactivate tests
- Banquets / Brands / Guests / Rooms on restaurant → usually **N/A**
- POS/KDS: use production URLs first

---

## Files to return

- TEST_RUN_SHEET.xlsx (all 160 rows filled)
- BUG_LOG.xlsx (one row per failure)
- CREDENTIALS_LOG.xlsx (no passwords)
- evidence/ folder (screenshots)
