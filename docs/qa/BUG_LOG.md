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
| Known limitation | Documented gap, not a defect | Admin Tables placeholder |

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
| KL-001 | Admin Tables | Phase 2 placeholder UI | Yes |
| KL-002 | Admin Inventory | Phase 2 placeholder UI | Yes |
| KL-003 | POS/KDS | Local apps only on production | Yes |
| KL-004 | Razorpay | Pay-now requires keys | Yes |
| KL-005 | Gateway sync | Requires Electron + LAN | Yes |

---

## Closed issues archive

| ID | Title | Severity | Closed date | Resolution |
|----|-------|----------|-------------|------------|
| | | | | |

---

## Sign-off

| Field | Value |
|-------|-------|
| All Critical/High addressed or accepted | Y / N |
| Known limitations documented | Y / N |
| Reviewer | |
| Date | |
