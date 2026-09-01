# QA Credentials Log — RUN-YYYYMMDD

> **Security:** Store real passwords in a password manager only.  
> This file tracks references and non-secret identifiers.  
> **Do NOT commit filled credentials to git.** Copy this template to `docs/qa/runs/RUN-YYYYMMDD/`.

---

## Run metadata

| Field | Value |
|-------|-------|
| Run ID | RUN-YYYYMMDD |
| Tester name | |
| Date started | |
| Date ended | |
| Environment | Production |
| Tenant purpose | Fresh onboard — full QA |
| Business type chosen | restaurant |
| Plan | enterprise |

---

## Production URLs (reference)

| App | URL |
|-----|-----|
| API health | https://api.cullinos.com/api/v1/health |
| API DB health | https://api.cullinos.com/api/v1/health/db |
| Swagger | https://api.cullinos.com/docs |
| Super Admin | https://platform.cullinos.com |
| Admin | https://admin.cullinos.com |
| Management | https://manage.cullinos.com |
| Waiter | https://waiter.cullinos.com |
| Customer storefront | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Marketing | https://cullinos.com |
| KDS (local) | http://localhost:5174?outletId={outletId} |
| KDS pickup (local) | http://localhost:5174?outletId={outletId}&mode=pickup |
| POS (local) | http://localhost:5173 |

---

## Platform — Super Admin

| Field | Value |
|-------|-------|
| Role | Super Admin |
| Email | |
| Password ref | PM entry # |
| Login URL | https://platform.cullinos.com/login |
| Login verified | Y / N — date: |
| Notes | |

---

## Tenant (created this run)

| Field | Value |
|-------|-------|
| Org name | |
| Org slug | |
| Org ID | |
| Outlet name | |
| Outlet slug | |
| Outlet ID | |
| Brand slug | |
| Plan | enterprise |
| Subscription status | |
| Owner name | |
| Owner email | |
| Owner password ref | PM entry # |
| Admin URL | https://admin.cullinos.com |
| Storefront URL | https://order.cullinos.com/{orgSlug}/{outletSlug} |
| Onboard date/time | |
| Onboard success message (paste) | |

### Owner settings snapshot

| Field | Value |
|-------|-------|
| businessType | |
| operatingMode | |
| GSTIN (test) | |
| enabledOrderTypes | |

---

## Staff — primary employee (1 person)

| Field | Value |
|-------|-------|
| Name | |
| Role | waiter |
| Email | |
| Password ref | PM entry # |
| Outlet(s) assigned | |
| Created date | |
| Waiter login verified | Y / N — date: |
| Notes | |

---

## Optional accounts

### Cashier (for local POS only)

| Field | Value |
|-------|-------|
| Name | |
| Role | cashier |
| Email | |
| Password ref | PM entry # |
| Outlet(s) assigned | |
| POS login verified | Y / N — date: |

### Manager (optional)

| Field | Value |
|-------|-------|
| Name | |
| Role | manager |
| Email | |
| Password ref | PM entry # |
| Notes | |

---

## Second outlet (for Management tests)

| Field | Value |
|-------|-------|
| Outlet name | |
| Outlet slug | |
| Outlet ID | |
| Created via | Swagger / API / other |
| Notes | |

---

## Menu test data created

| Type | Name / slug | Price | Notes |
|------|-------------|-------|-------|
| Category 1 | | | |
| Category 2 | | | |
| Item 1 | | | |
| Item 2 | | | |
| Item 3 | | | |
| Item 4 | | | |
| Item with modifier | | | |

---

## Tables (if created via API)

| Table ID | Label | Status | Created via |
|----------|-------|--------|-------------|
| | T1 | | Swagger |
| | T2 | | Swagger |

---

## Orders placed (for cross-reference)

| Order ID | Source | Type | Placed by | Date/time | Notes |
|----------|--------|------|-----------|-----------|-------|
| | waiter | dine_in | employee | | |
| | customer | online | guest | | |
| | pos | takeaway | cashier | | |

---

## API / technical

| Item | Value |
|------|-------|
| Owner JWT captured | Y / N — date: |
| JWT expiry noted | |
| Swagger session used | Y / N |
| Gateway token | N/A unless testing offline sync |
| Local POS env | `VITE_API_URL=https://api.cullinos.com/api/v1` |
| Local KDS env | `VITE_API_URL=https://api.cullinos.com/api/v1` |

---

## Password manager index

Use this section to map PM entries to accounts without storing passwords here.

| PM entry # | Account | Email |
|------------|---------|-------|
| | Super Admin | |
| | Owner | |
| | Waiter (employee) | |
| | Cashier (optional) | |

---

## Handoff notes

Space for credentials or access details shared with the employee (verbal/PM only — do not paste passwords):

```
(Notes for team handoff)
```

---

## Change log

| Date | Change | By |
|------|--------|-----|
| | Initial tenant onboarded | |
| | Staff account created | |
| | Tenant suspended (QA test) | |
| | Tenant reactivated | |
