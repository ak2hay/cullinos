# Cullinos Architecture

Cullinos is a restaurant operating system built as an npm workspaces monorepo orchestrated by Turborepo. A single NestJS API backs multiple client applications, all hosted on a self-managed VM in production.

## High-level topology

```
                    ┌─────────────────────────────────────┐
                    │    VM (95.135.254.46) — Production   │
                    │  API · PostgreSQL · Redis · nginx   │
                    │  All frontends (static SPAs + web)  │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS / WebSocket
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
   ┌─────▼─────┐           ┌───────▼───────┐         ┌───────▼───────┐
   │   Admin   │           │  Management   │         │ Super Admin   │
   │  (nginx)  │           │    (nginx)    │         │   (nginx)     │
   └───────────┘           └───────────────┘         └───────────────┘

   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Waiter · POS │  │ KDS · Customer│  │ Marketing    │
   │  (browser)   │  │  (browser)   │  │ (Next.js)    │
   └──────────────┘  └──────────────┘  └──────────────┘
```

## Applications

| App | Package | Port (dev) | Role |
|-----|---------|------------|------|
| API | `@cullinos/api` | 3000 | REST + WebSocket backend |
| Admin | `@cullinos/admin` | 5181 | Single-outlet owner/manager dashboard |
| Management | `@cullinos/management` | 5182 | Enterprise multi-outlet console |
| Super Admin | `@cullinos/super-admin` | 5183 | Rkyves platform tenant administration |
| POS | `@cullinos/pos` | 5173 | Cashier point of sale |
| KDS | `@cullinos/kds` | 5174 | Kitchen display |
| Waiter | `@cullinos/waiter` | 5175 | Floor staff |
| Customer | `@cullinos/customer` | 5176 | QR / online ordering |
| Web | `@cullinos/web` | 5180 | Marketing site |

## Shared packages

- **`@cullinos/prisma`** — Prisma schema, migrations, seed data
- **`@cullinos/shared`** — Types, constants, validators, permissions
- **`@cullinos/auth`** — JWT and password utilities
- **`@cullinos/ui`** — Design tokens consumed by React apps
- **`@cullinos/sync`** — Cloud sync contracts (used by API)

## Data flow

1. **Online clients** call `/api/v1/*` with organization-scoped JWTs.
2. **Super admin** uses a separate JWT strategy via `POST /api/v1/super-admin/login`.
3. **POS/KDS** are browser apps at `pos.cullinos.com` and `kds.cullinos.com`, connecting directly to the cloud API.
4. **QR ordering** uses session-based table links: waiter starts session → guest scans QR → items merge into table order → KDS receives KOT via WebSocket.

## Multi-tenancy

Each restaurant organization is a tenant. Users, outlets, menus, orders, and inventory are scoped by `organizationId`. Super-admin routes operate across tenants for platform operations (suspend, subscription, health).

## Infrastructure

- **Local dev:** Docker Compose provides PostgreSQL 16 and Redis 7 (`docker/`).
- **Production:** Self-hosted VM with Docker Compose (`docker-compose.prod.yml`), nginx reverse proxy, Let's Encrypt SSL.
- **CI:** GitHub Actions workflow at `infrastructure/ci/.github/workflows/ci.yml` runs lint, typecheck, and test on PRs.

## Security notes

- Super-admin and tenant auth use separate secrets and guards.
- Desktop apps use `contextIsolation` — no Node APIs in renderer.
- All production secrets live in VM `.env` only (never in frontend bundles).
