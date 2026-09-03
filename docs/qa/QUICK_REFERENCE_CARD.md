# Cullinos QA — Quick Reference Card

Print this page and keep it at your desk.

---

## Production portals

| App | URL |
|-----|-----|
| Super Admin | https://platform.cullinos.com |
| Admin | https://admin.cullinos.com |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| Customer | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |
| Swagger | https://api.cullinos.com/docs |
| Health | https://api.cullinos.com/api/v1/health |

---

## 4-day test order

| Day | Focus |
|-----|-------|
| **1** | Preflight + onboard restaurant + menu + staff |
| **2** | Waiter orders + guest checkout + optional KDS |
| **3** | Admin + Management + Super Admin |
| **4** | Marketing site + Swagger API |

---

## Minimum test flow

1. Super Admin → **Onboard restaurant** (enterprise plan)
2. Admin → **Menu** + **Staff** (1 waiter)
3. Waiter → **Table order**
4. Admin → **Orders** (verify)
5. Customer → **Checkout** in incognito (verify)
6. TEST_RUN_SHEET → mark all **127 cases**

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
- Admin Tables/Inventory placeholders are **not bugs**
- POS/KDS: local only — mark **Blocked** if not set up

---

## Files to return

- TEST_RUN_SHEET.xlsx (all 127 rows filled)
- BUG_LOG.xlsx (one row per failure)
- CREDENTIALS_LOG.xlsx (no passwords)
- evidence/ folder (screenshots)
