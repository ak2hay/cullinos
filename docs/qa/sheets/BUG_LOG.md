# Bug & Issue Log — RUN-YYYYMMDD

> Copy this template to `docs/qa/runs/RUN-YYYYMMDD/` for each test run.  
> Link defects to test case IDs from [TEST_RUN_SHEET.md](./TEST_RUN_SHEET.md).

---

## Run metadata

| Field | Value |
|-------|-------|
| Run ID | RUN-YYYYMMDD |
| Tester | |
| Environment | Production |
| Tenant slug | |
| Date range | |

---

## Summary

Update counts as issues are found and closed.

| Severity | Open | Closed | Total |
|----------|------|--------|-------|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 |
| Low | 0 | 0 | 0 |
| Known limitation | 0 | — | 0 |

---

## Severity definitions

| Level | Definition | Example |
|-------|------------|---------|
| Critical | Blocks core flow; no workaround | Cannot login, orders fail to create |
| High | Major feature broken; workaround difficult | KOT never appears; checkout fails |
| Medium | Feature partially broken | Wrong totals, UI glitch with workaround |
| Low | Cosmetic or minor inconvenience | Typo, alignment issue |
| Known limitation | Documented gap, not a defect | Razorpay pay-now without keys |

---

## Issue types

- **Bug** — Unexpected behavior vs spec
- **UX** — Confusing flow but technically works
- **Missing feature** — Expected capability absent
- **Known limitation** — Documented Phase 2 / out-of-scope item
- **Environment** — Infra/config issue (not app code)

---

## Open issues (quick list)

| ID | Severity | Module | Title | Status |
|----|----------|--------|-------|--------|
| | | | | |

---

## Defect template

Copy the block below for each new issue. Increment ID: BUG-001, BUG-002, …

---

### BUG-001

| Field | Value |
|-------|-------|
| **ID** | BUG-001 |
| **Date found** | |
| **Reporter** | |
| **Test case ID** | e.g. TC-2.1-04 |
| **Phase / Module** | e.g. Phase 2 — Waiter |
| **App / URL** | |
| **Role used** | Super Admin / Owner / Waiter / Cashier / Guest |
| **Severity** | Critical / High / Medium / Low |
| **Type** | Bug / UX / Missing feature / Known limitation / Environment |
| **Status** | Open / Retest / Closed / Won't fix |

#### Steps to reproduce

1. 
2. 
3. 

#### Expected

```
(What should happen)
```

#### Actual

```
(What happened instead)
```

#### Evidence

| Type | Location |
|------|----------|
| Screenshot | `runs/RUN-YYYYMMDD/evidence/BUG-001-screenshot.png` |
| Console error | |
| Network (HAR) | |
| API response | |

#### Related entities

| Field | Value |
|-------|-------|
| Order ID | |
| Outlet ID | |
| User email | |
| Other IDs | |

#### Workaround

```
(If any)
```

#### Retest

| Field | Value |
|-------|-------|
| Retest date | |
| Retested by | |
| Result | Pass / Fail |
| Notes | |

---

### BUG-002

| Field | Value |
|-------|-------|
| **ID** | BUG-002 |
| **Date found** | |
| **Reporter** | |
| **Test case ID** | |
| **Phase / Module** | |
| **App / URL** | |
| **Role used** | |
| **Severity** | |
| **Type** | |
| **Status** | Open |

#### Steps to reproduce

1. 
2. 

#### Expected

```

```

#### Actual

```

```

#### Evidence

| Type | Location |
|------|----------|
| Screenshot | |

#### Related entities

| Field | Value |
|-------|-------|
| Order ID | |

#### Workaround

```

```

#### Retest

| Field | Value |
|-------|-------|
| Retest date | |
| Result | |

---

## Known limitations log (not bugs)

Record expected gaps so they are not filed as defects.

| ID | Module | Description | Documented in plan |
|----|--------|-------------|-------------------|
| KL-003 | POS/KDS DNS | If pos/kds.cullinos.com unreachable, use local fallback or mark Blocked | Yes |
| KL-004 | Razorpay | Pay-now requires production payment keys | Yes |
| KL-005 | Order Display / CDS | Prefer Admin `/displays` launcher; local KDS `?mode=pickup` only as fallback | Yes |
| KL-006 | Production — stock deduction | Stock deducts only when batch is linked to a recipe with ingredients; batches without a recipe are still marked complete | Yes |
| KL-007 | Business-type nav | Banquets / Brands / Guests / Rooms hidden on restaurant tenant — mark N/A | Yes |

~~KL-001 Admin Tables placeholder~~ and ~~KL-002 Admin Inventory placeholder~~ are **retired** — those UIs are real features now.

---

## Closed issues archive

| ID | Title | Severity | Closed date | Resolution |
|----|-------|----------|-------------|------------|
| BUG-FX-001 | Settings / Setup tab returns "Module not entitled: settings" | High | 2026-09-03 | Added `settings` and `reports` to all plans in seed + plan-bootstrap. Auto-syncs missing entitlements on API startup. |
| BUG-FX-002 | Events scheduling fails silently | High | 2026-09-03 | Added `events` + `production` to professional/enterprise/qsr plans. EventsPage now auto-selects outlet and shows success/error feedback. |
| BUG-FX-003 | Production batches — no feedback on Schedule/Complete | Medium | 2026-09-03 | ProductionPage shows success toast on schedule and complete; errors surfaced. Added note about recipe-based stock deduction. |
| BUG-FX-004 | Menu delete appears to do nothing | Medium | 2026-09-03 | MenuPage now shows success/error banners on delete (and create/update). API already uses soft-delete; deleted items/categories are filtered from lists. |
| BUG-FX-005 | Pickup Queue URL hardcoded to localhost:5174 | Low | 2026-09-03 | PickupQueuePage now computes correct URL for dev vs production. KDS now supports `?mode=pickup&outletId=…` — shows public customer-facing preparing/ready board (no login required). |
| BUG-FX-006 | OnboardingWizard hides settings save errors | Low | 2026-09-03 | Business Info step now shows API errors inline so entitlement or network failures are visible. |

---

## Sign-off

| Field | Value |
|-------|-------|
| All Critical/High addressed or accepted | Y / N |
| Known limitations documented | Y / N |
| Reviewer | |
| Date | |
