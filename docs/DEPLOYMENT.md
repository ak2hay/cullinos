# Cullinos — Production Deployment

## Services

| Component | Host | Domain |
|-----------|------|--------|
| API | Railway | `api.cullinos.com` |
| Database | Neon | (connection string in env) |
| Redis | Upstash | `REDIS_URL` |
| Admin | Vercel | `admin.cullinos.com` |
| Management | Vercel | `manage.cullinos.com` |
| Super Admin | Vercel | `platform.cullinos.com` |
| Customer | Vercel | `order.cullinos.com` |
| Waiter | Vercel | `waiter.cullinos.com` |

## Railway (API)

1. Connect GitHub repo (e.g. `ak2hay/cullinos`).
2. **Root Directory** must be the **repo root** (leave blank) — not `apps/api`.
3. Builder: **Railpack** — see [`railpack.json`](railpack.json), [`railway.toml`](railway.toml), [`railway.json`](railway.json).
4. **Build command** must be `npm run build:api` (not `npm run build` — that builds all 18 apps and fails without Prisma client).
5. If prepare still fails with “No start command detected”, set env `RAILPACK_START_CMD=node index.js` and redeploy (clear build cache).
6. Set variables from `secrets-export.txt` (or your password manager).
7. Add custom domain `api.cullinos.com`.
8. Set `API_PORT` = `${{PORT}}` if not using default PORT binding (API uses `PORT` or `API_PORT`).

## Vercel (frontends)

Create one project per app; set **Root Directory** to the app folder (e.g. `apps/admin`).

Each app has a `vercel.json` with monorepo build commands.

**Environment (all frontends):**
```
VITE_API_URL=https://api.cullinos.com/api/v1
```

**KDS only:**
```
VITE_WS_URL=https://api.cullinos.com
```

## Database

From repo root with `.env` pointing at Neon:

```bash
npm run db:push
npm run db:seed
```

## Verify

- `GET https://api.cullinos.com/api/v1/health`
- `GET https://api.cullinos.com/api/v1/health/db`
- `https://api.cullinos.com/docs` — Swagger
- Register at `https://admin.cullinos.com/register`
