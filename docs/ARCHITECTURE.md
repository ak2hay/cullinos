# Cullinos Architecture

Cullinos is a restaurant operating system built as an npm workspaces monorepo orchestrated by Turborepo. A single NestJS API backs multiple client applications; optional local infrastructure supports offline-first outlet operations.

## High-level topology

```
                    ┌─────────────────────────────────────┐
                    │         Cloud (Rkyves hosted)        │
                    │  API · PostgreSQL · Redis · Sync    │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS / WebSocket
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
   ┌─────▼─────┐           ┌───────▼───────┐         ┌───────▼───────┐
   │   Admin   │           │  Management   │         │ Super Admin   │
   │  (5173)   │           │    (5178)     │         │   (5179)      │
   └───────────┘           └───────────────┘         └───────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │              Outlet LAN — Cullinos Local Gateway                 │
   │  Electron · Express (4000) · SQLite sync queue · Hardware stubs │
   │         serves / proxies POS (5174) and KDS (5175)             │
   └─────────────────────────────────────────────────────────────────┘
```

## Applications

| App | Package | Port | Role |
|-----|---------|------|------|
| API | `@cullinos/api` | 3000 | REST + WebSocket backend |
| Admin | `@cullinos/admin` | 5173 | Single-outlet owner/manager dashboard |
| Management | `@cullinos/management` | 5178 | Enterprise multi-outlet console |
| Super Admin | `@cullinos/super-admin` | 5179 | Rkyves platform tenant administration |
| POS | `@cullinos/pos` | 5174 | Cashier point of sale |
| KDS | `@cullinos/kds` | 5175 | Kitchen display |
| Gateway | `@cullinos/gateway` | 4000 | Local offline hub (Electron) |

## Shared packages

- **`@cullinos/database`** — Prisma schema, migrations, seed data
- **`@cullinos/shared`** — Types, constants, validators, permissions
- **`@cullinos/auth`** — JWT and password utilities
- **`@cullinos/ui`** — Design tokens consumed by React apps
- **`@cullinos/sync`** — Cloud sync contracts (used by API and gateway)

## Data flow

1. **Online clients** call `/api/v1/*` with organization-scoped JWTs.
2. **Super admin** uses a separate JWT strategy via `POST /api/v1/super-admin/login`.
3. **Local gateway** queues mutations in SQLite when offline, then pushes batches to `POST /api/v1/sync/push` when connectivity returns.
4. **Hardware** (printers, cash drawers) is abstracted behind adapter interfaces in the gateway; production drivers plug in later.

## Multi-tenancy

Each restaurant organization is a tenant. Users, outlets, menus, orders, and inventory are scoped by `organizationId`. Super-admin routes operate across tenants for platform operations (suspend, subscription, health).

## Infrastructure

- **Local dev:** Docker Compose provides PostgreSQL 16 and Redis 7 (`infrastructure/docker/`).
- **CI:** GitHub Actions workflow at `infrastructure/ci/.github/workflows/ci.yml` runs lint, typecheck, and test on PRs.

## Security notes

- Gateway preload exposes a minimal IPC bridge (`contextBridge`) — no Node APIs in renderer.
- Super-admin and tenant auth use separate secrets and guards.
- Gateway sync requires `CULLINOS_GATEWAY_TOKEN` (device/org-scoped JWT) for cloud push.
