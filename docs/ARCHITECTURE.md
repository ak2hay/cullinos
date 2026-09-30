# Cullinos Architecture

Cullinos is a restaurant operating system built as an npm workspaces monorepo orchestrated by Turborepo. A single NestJS API backs multiple client applications (web SPAs, Next.js marketing, Flutter Guest, Electron shells). Production is a self-managed VM running **k3s** (see [DEPLOYMENT.md](./DEPLOYMENT.md)); CI/CD ships images via GitHub Actions → GHCR.

Full product/feature catalogue: [PRODUCT.md](./PRODUCT.md).

## High-level topology

```
                    ┌─────────────────────────────────────┐
                    │    VM — k3s (staging + production)  │
                    │  API · PostgreSQL · Redis · Traefik │
                    │  SPA images · Next.js web · Grafana │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS / WebSocket
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
   ┌─────▼─────┐           ┌───────▼───────┐         ┌───────▼───────┐
   │   Admin   │           │  Management   │         │ Super Admin   │
   │  (SPA)    │           │    (SPA)      │         │   (SPA)       │
   └───────────┘           └───────────────┘         └───────────────┘

   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Waiter · POS │  │ KDS · Customer│  │ Marketing    │  │ Guest app    │
   │  (browser /  │  │  (browser)   │  │ (Next.js)    │  │ (Flutter +   │
   │   Electron)  │  │              │  │              │  │  deep links) │
   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

## Applications

| App | Package | Port (dev) | Role |
|-----|---------|------------|------|
| API | `@cullinos/api` | 3000 | REST + WebSocket backend |
| Admin | `@cullinos/admin` | 5181 | Owner/manager dashboard + Portal POS |
| Management | `@cullinos/management` | 5182 | Enterprise multi-outlet console |
| Super Admin | `@cullinos/super-admin` | 5183 | Platform tenant + marketing CMS |
| App Ops | `@cullinos/app-ops` | 5184 | Cullinos App ops (users, rich push, marketplace) |
| POS | `@cullinos/pos` | 5173 | Cashier point of sale |
| KDS | `@cullinos/kds` | 5174 | Kitchen display (+ CDS / promo / receipt modes) |
| Cullinos Waiter | Flutter `apps/waiter_mobile` | — | Floor staff Android app (phone + tablet) |
| Cullinos App | Flutter `apps/guest` | — | Marketplace + QR / outlet ordering (Android) |
| Web | `@cullinos/web` | 5180 | Marketing site |
| POS Desktop | `@cullinos/pos-desktop` | — | Windows Electron shell |
| KDS Desktop | `@cullinos/kds-desktop` | — | Windows Electron shell |

## Shared packages

- **`@cullinos/prisma`** — Prisma schema, migrations, seed data
- **`@cullinos/shared`** — Types, permissions, plan features, marketing copy
- **`@cullinos/auth`** — JWT and password utilities
- **`@cullinos/ui`** — Design tokens consumed by React apps
- **`@cullinos/tax-engine`** — GST tax calculation
- **`@cullinos/integrations`** — Aggregator adapters (Swiggy/Zomato) and integration types
- **`@cullinos/sync`** — Cloud sync contracts (used by API)
- **`@cullinos/events`** — Domain event types
- **`@cullinos/ai-contracts`** — AI insight contracts plus Rkyves Grok Bot role/handoff types (`docs/rkyves-team/`)

## Major API domains

| Domain | Examples |
|--------|----------|
| Platform | auth, organizations, outlets, users, subscriptions, platform-config, super-admin, privacy |
| FOH / orders | menu, tables, reservations, orders, pos, kot, kitchen, payments, promo-display |
| Supply | inventory, recipes, purchasing, production, central-kitchen, wastage, erp-export |
| Growth | customers, loyalty, coupons, delivery, promo, sms, feedback, aggregators |
| Guest app | guest auth/profile, marketplace, guest orders, banners, push |
| Hospitality | hospitality guests/rooms/banquets, franchise, storefront, analytics, reports |

## Data flow

1. **Online clients** call `/api/v1/*` with organization-scoped JWTs.
2. **Super admin** uses a separate JWT strategy via `POST /api/v1/super-admin/login`.
3. **POS/KDS** are browser (and optional Electron) apps at `pos.cullinos.com` / `kds.cullinos.com`, connecting to the cloud API.
4. **QR ordering** uses session-based table links: waiter starts session → guest scans QR → items merge into table order → KDS receives KOT via WebSocket.
5. **Guest app** authenticates via phone OTP / Firebase; marketplace and orders hit the same API; FCM delivers push.
6. **Aggregators** receive webhooks and map external orders into the unified order pipeline.

## Multi-tenancy

Each restaurant organization is a tenant. Users, outlets, menus, orders, and inventory are scoped by `organizationId`. Super-admin routes operate across tenants for platform operations (suspend, subscription, health, Guest marketing CMS).

## Infrastructure

- **Local dev:** Docker Compose provides PostgreSQL 16 and Redis 7 (`docker/`).
- **Production:** Self-hosted VM with Docker Compose (`docker-compose.prod.yml`), nginx reverse proxy, Let's Encrypt SSL.
- **CI:** GitHub Actions workflow at `infrastructure/ci/.github/workflows/ci.yml` runs lint, typecheck, and test on PRs.

## Security notes

- Super-admin and tenant auth use separate secrets and guards.
- Desktop apps use `contextIsolation` — no Node APIs in renderer.
- All production secrets live in VM `.env` only (never in frontend bundles).
- Privacy module supports consent, export/erase, and retention workflows.
