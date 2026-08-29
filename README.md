# Cullinos — Restaurant Operating System

**Cullinos** is a unified restaurant platform by Rkyves. One cloud backend powers POS, KDS, waiter apps, online ordering, inventory, and enterprise management — with offline support via the Local Gateway.

## Monorepo structure

```
cullinos/
├── apps/
│   ├── api/           NestJS REST API + WebSocket (all domain modules)
│   ├── admin/         Owner/manager dashboard
│   ├── pos/           Cashier POS (touch-optimized)
│   ├── kds/           Kitchen display
│   ├── waiter/        Waiter mobile web app
│   ├── customer/      QR + online ordering storefront
│   ├── management/    Enterprise multi-outlet console
│   ├── super-admin/   Rkyves platform admin
│   ├── web/           Marketing website (cullinos.com)
│   └── gateway/       Electron Local Gateway + offline sync
├── packages/
│   ├── database/      Prisma schema (~80 models), migrations, seed
│   ├── shared/        Types, constants, validators
│   ├── auth/          JWT + RBAC helpers
│   ├── ui/            Design tokens (charcoal + amber/gold)
│   ├── events/        Domain event types
│   ├── tax-engine/    GST-first tax calculation
│   ├── sync/          Offline sync protocol
│   └── integrations/  Hardware/payment adapter interfaces
└── infrastructure/
    └── docker/        PostgreSQL 16 + Redis 7
```

## Prerequisites

- **Node.js** 20+ (LTS recommended; Node 26 works with `--ignore-scripts` for gateway)
- **Docker** (PostgreSQL + Redis)
- **Visual Studio Build Tools** (optional — only if you rebuild native Electron deps)

**Note:** The Local Gateway uses a JSON file-based sync queue (no native SQLite dependency) so it builds on Windows without Visual Studio.

## Quick start

### 1. Install dependencies

```bash
cd cullinos
npm install
```

If install fails on `better-sqlite3` (native module), use:

```bash
npm install --ignore-scripts
npm approve-scripts prisma @prisma/client @prisma/engines turbo esbuild
npm rebuild prisma @prisma/client @prisma/engines turbo
```

Gateway development additionally requires [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload.

### 2. Environment

```bash
cp .env.example .env
```

### 3. Start infrastructure

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### 4. Database setup

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 5. Run development servers

| App | Command | URL |
|-----|---------|-----|
| API | `npm run api:dev` | http://localhost:3000 |
| Admin | `npm run admin:dev` | http://localhost:5173 |
| POS | `npm run pos:dev` | http://localhost:5174 |
| KDS | `npm run kds:dev` | http://localhost:5175 |
| Waiter | `npm run waiter:dev` | http://localhost:5176 |
| Customer | `npm run customer:dev` | http://localhost:5177 |
| Web | `npm run web:dev` | http://localhost:5180 |

Or start everything: `npm run dev`

### 6. First login

1. Open [http://localhost:5173](http://localhost:5173) (Admin)
2. **Register** a new organization — creates owner account + default outlet
3. Sign in and select your outlet from the header

**API docs:** [http://localhost:3000/docs](http://localhost:3000/docs)  
**Health:** [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in dev mode |
| `npm run build` | Build all packages and apps |
| `npm run typecheck` | TypeScript check across monorepo |
| `npm run test` | Run tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations (dev) |
| `npm run db:seed` | Seed plans, permissions, super admin |

## Architecture highlights

- **Multi-tenant:** Every query scoped by `organization_id`; RBAC with granular permissions
- **Unified Order Engine:** All channels (POS, QR, online, waiter, delivery) funnel through one service
- **Offline-first POS/KDS:** Local Gateway (Electron + SQLite) syncs idempotently when online
- **India-first tax:** GST (CGST/SGST/IGST) via `packages/tax-engine`
- **Feature entitlements:** Subscription plans gate modules at API + UI level

## Implementation status (vs. plan)

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Monorepo, Docker, Prisma, API skeleton, admin shell, CI | ✅ Done |
| 1 | Auth, org/outlet, RBAC, audit | ✅ API + admin login |
| 2 | Menu engine | 🔶 API scaffolded |
| 3 | Order engine + POS + KOT | 🔶 API + POS UI scaffolded |
| 4 | Tables + KDS + Waiter | 🔶 API + apps scaffolded |
| 5–17 | Billing, inventory, CRM, etc. | 🔶 API modules present; UI varies |

## Brand

- **Product:** Cullinos — Restaurant Operating System
- **Palette:** Deep charcoal (`#0F0F1A`) + warm amber/gold (`#D4A017`)
- **Typography:** Inter (UI), JetBrains Mono (order numbers)
- **Customer channels:** "Powered by Rkyves" footer

## License

Proprietary — Rkyves. All rights reserved.
