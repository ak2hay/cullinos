# Cullinos — Restaurant Operating System

Cullinos is Rkyves's multi-tenant restaurant platform — one cloud backend, role-specific apps (POS, kitchen, floor, guest, admin), offline-capable operations, and GST-native billing.

## Apps

| App | Port | Purpose |
|-----|------|---------|
| API | 3000 | NestJS REST + WebSocket |
| POS | 5173 | Cashier terminal |
| KDS | 5174 | Kitchen display |
| Waiter | 5175 | Floor staff |
| Customer | 5176 | QR / online ordering |
| Admin | 5181 | Owner dashboard |
| Management | 5182 | Multi-outlet chains |
| Super Admin | 5183 | Platform ops |
| Web | 5180 | Marketing site |
| Gateway | — | Electron offline sync |

## Quick start

```bash
cp .env.example .env
npm run docker:up
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Demo logins (after `npm run db:seed`):

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Platform Super Admin** | `superadmin@cullinos.com` | `demo1234` | Onboards restaurants, issues owner credentials |
| **Restaurant owner** | `owner@cullinos.com` | `demo1234` | Admin app — creates all staff manually under Staff |
| **Staff (waiter, etc.)** | *(created by owner)* | *(set by owner)* | Owner adds accounts in Admin → Staff |

### Credential model

1. **Rkyves / Super Admin** onboards a restaurant (Super Admin → Tenants → *Onboard restaurant*) and receives **owner email + password** to hand off.
2. **Owner** signs into Admin, completes setup, and **manually creates** waiter, cashier, and manager logins under **Staff**.
3. Staff use those credentials in Waiter, POS, KDS, etc. There is no self-service signup.

Order Online storefront: `http://localhost:5176/demo-restaurant/main-outlet`

## Smoke test checklist

Manual checks (automated alternative: `npm run test:e2e` — see [`e2e/README.md`](e2e/README.md)):

- **Waiter** — login, select outlet, open table, add item, confirm order (KOT on KDS)
- **Management** — dashboard KPIs, outlet comparison, stock transfer, franchise list
- **Order Online** — browse menu at `/{orgSlug}/{outletSlug}`, cart, checkout
- **Super Admin** — list tenants, suspend/activate, update subscription plan
- **API** — `GET http://localhost:3000/api/v1/health`

## Brand

- Charcoal `#0F0F1A` + Amber `#D4A017`
- Inter (UI) + JetBrains Mono (order numbers)
- Customer channels: "Powered by Rkyves"

## License

Proprietary — Rkyves
