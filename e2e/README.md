# Production E2E Tests

Browser smoke tests for all Cullinos apps against production (or any deployed environment).

## Prerequisites

### 1. Dedicated sandbox tenant

Use a **non-production restaurant org** for tests that create orders. Recommended setup:

| Role | How to get it |
|------|----------------|
| Super Admin | Platform account (e.g. `superadmin@cullinos.com`) |
| Owner | Onboard via Super Admin → Tenants, or use seeded demo org |
| Waiter / Cashier | Owner creates in Admin → Staff |
| Outlet + tables + menu | Owner completes onboarding or use `npm run db:seed` on the target DB |

### 2. Environment file

```bash
cp e2e/.env.example e2e/.env.local
```

Global setup will:
- Log in as super admin and **discover** an active org/outlet, or
- **Auto-provision** a sandbox tenant when `E2E_AUTO_PROVISION=true`

Fill in super admin credentials at minimum. Owner credentials are used for login tests; auto-provision creates `e2e-owner@cullinos.com` if needed.

**Vercel frontends** must be built with `VITE_API_URL=https://api.cullinos.com/api/v1` or browser login tests show "Failed to fetch". Redeploy after updating env vars.

### 3. Install browsers (first time only)

```bash
npx playwright install chromium
```

## Run

```bash
npm run test:e2e          # all specs
npm run test:e2e:report   # open HTML report after a run
npm run test:e2e:ui       # interactive UI mode
```

## Failure data

On failure Playwright writes:

| Artifact | Path |
|----------|------|
| HTML report | `playwright-report/` |
| JSON summary | `e2e-results.json` |
| Screenshots, traces, videos | `test-results/` |

## What's covered

- API health + auth
- Marketing site pages
- Admin, Management, Super Admin (read-only tenant ops)
- POS, KDS, Waiter, Customer storefront
- Cross-app Waiter → KDS order flow

Not covered: Gateway POS/KDS (local only — skipped by default), payment checkout, destructive super-admin actions.
Waiter/order-flow tests skip automatically when the test outlet has no tables.
