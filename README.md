# Cullinos — Restaurant Operating System

Cullinos is Rkyves's multi-tenant restaurant platform — one cloud backend, role-specific web apps (POS, kitchen, floor, admin), the Cullinos App (Android), GST-native billing, and India-first integrations (per-restaurant Razorpay/Cashfree, MSG91, Swiggy/Zomato).

**Product docs:** [docs/PRODUCT.md](docs/PRODUCT.md) (full feature guide) · [docs/client/](docs/client/README.md) (brochure / overview / manual PDFs)

## Apps

| App | Port | Purpose |
|-----|------|---------|
| API | 3000 | NestJS REST + WebSocket |
| POS | 5173 | Cashier terminal (production: https://pos.cullinos.com) |
| KDS | 5174 | Kitchen display + CDS / promo modes (https://kds.cullinos.com) |
| Cullinos Waiter (Android) | — | Floor staff phone + tablet app |
| Cullinos App (Android) | — | Marketplace + QR / dine-in / takeaway / delivery (deep links via guest.cullinos.com) |
| Admin | 5181 | Owner dashboard (ops, CRM, Cullinos App marketing, Portal POS) |
| Management | 5182 | Multi-outlet chains |
| Super Admin | 5183 | Platform ops + marketing CMS |
| Web | 5180 | Marketing site |

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
| **Platform Super Admin** | `akshrkd@gmail.com` | `Missyou@1` | Onboards restaurants, issues owner credentials |
| **Restaurant owner** | `owner@cullinos.com` | `demo1234` | Admin app — creates all staff manually under Staff |
| **Staff (waiter, etc.)** | *(created by owner)* | *(set by owner)* | Owner adds accounts in Admin → Staff |

### Credential model

1. **Rkyves / Super Admin** onboards a restaurant (Super Admin → Tenants → *Onboard restaurant*) and receives **owner email + password** to hand off.
2. **Owner** signs into Admin, completes setup, and **manually creates** waiter, cashier, and manager logins under **Staff**.
3. Staff use those credentials in Waiter, POS, KDS, etc. There is no self-service signup.
4. **Online diner payments:** each restaurant configures its own **Razorpay** and/or **Cashfree** keys under Admin → **Payments** (org default + optional outlet override). Platform `RAZORPAY_*` env is for Cullinos SaaS billing only.

Cullinos App (Android): see `apps/guest/README.md` — deep links `https://guest.cullinos.com/o/{org}/{outlet}`

## Smoke test checklist

Manual checks (automated alternative: `npm run test:e2e` — see [`e2e/README.md`](e2e/README.md)):

- **Cullinos Waiter** — Android app: floor, QR sessions, ordering, service calls (KOT on KDS)
- **Management** — dashboard KPIs, outlet comparison, stock transfer, franchise list
- **Cullinos App** — marketplace, QR table order, takeaway/delivery checkout
- **Admin** — reservations, aggregators, Payments (Razorpay/Cashfree), Cullinos App (banners / push), purchasing
- **Super Admin** — list tenants, suspend/activate, update subscription plan
- **API** — `GET http://localhost:3000/api/v1/health`

## Contributing & deploy

Multi-developer workflow: `feature/*` → `develop` (staging) → `main` (production). See [CONTRIBUTING.md](CONTRIBUTING.md).

CI/CD ships images to **GHCR** and deploys to **k3s** on the VM. Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Docs

| Doc | Path |
|-----|------|
| Full product & features | [docs/PRODUCT.md](docs/PRODUCT.md) |
| Client brochure / overview / manual | [docs/client/](docs/client/README.md) (`npm run client:export`) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Deployment (GitHub → GHCR → k3s) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Contributing / branch model | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Rkyves Grok Bot employee team | [docs/rkyves-team/](docs/rkyves-team/README.md) |
| Agent / bot company rules | [AGENTS.md](AGENTS.md) |
| Cullinos App | [apps/guest/README.md](apps/guest/README.md) |
| Cullinos Waiter | [apps/waiter_mobile/README.md](apps/waiter_mobile/README.md) |
| QA pack | [docs/qa/](docs/qa/README.md) |

## Brand

- Charcoal `#0F0F1A` + Amber `#D4A017`
- Inter (UI) + JetBrains Mono (order numbers)
- Customer channels: "Powered by Rkyves"

## License

Proprietary — Rkyves
