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
| Marketing | Vercel | `cullinos.com` |

## Railway (API)

1. Connect GitHub repo (e.g. `ak2hay/cullinos`).
2. **Root Directory** must be the **repo root** (leave blank) — not `apps/api`.
3. Builder: **Railpack** — see [`railpack.json`](railpack.json), [`railway.toml`](railway.toml), [`railway.json`](railway.json).
4. **Build command** must be `npm run build:api` (not `npm run build` — that builds all 18 apps and fails without Prisma client).
5. If prepare still fails with “No start command detected”, set env `RAILPACK_START_CMD=node index.js` and redeploy (clear build cache).
6. Set variables from `secrets-export.txt` (or your password manager).
7. Add custom domain `api.cullinos.com`.
8. Do **not** set `API_PORT` on Railway — Railway injects `PORT` automatically. Use `API_PORT=3000` only in local `.env`.

## Vercel (frontends)

Create one project per app; set **Root Directory** to the app folder (e.g. `apps/admin`).

Each app has a `vercel.json` with monorepo build commands.

**Environment (all frontends):**
```
VITE_API_URL=https://api.cullinos.com/api
VITE_WS_URL=https://api.cullinos.com
```

**Customer (`apps/customer`) only:**
```
VITE_ORG_SLUG=demo-restaurant
VITE_OUTLET_SLUG=main-outlet
```
Storefront URLs: `https://order.cullinos.com/{orgSlug}/{outletSlug}` (e.g. `/demo-restaurant/main-outlet`).

**KDS only:**
```
VITE_WS_URL=https://api.cullinos.com
```

**Marketing site (`apps/web`) only:**
```
NEXT_PUBLIC_SITE_URL=https://cullinos.com
NEXT_PUBLIC_ADMIN_URL=https://admin.cullinos.com
NEXT_PUBLIC_REGISTER_URL=https://admin.cullinos.com/register
RESEND_API_KEY=<optional — enables contact form email>
CONTACT_TO_EMAIL=hello@rkyves.com
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

Add custom domains `cullinos.com` and `www.cullinos.com` (redirect www → apex).

### Marketing site Vercel settings (`apps/web`)

The Next.js marketing app is **not** a Vite SPA. Do **not** copy settings from `apps/admin`.

| Setting | Value |
|---------|--------|
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Build Command | *(from `vercel.json` — leave default or use)* `cd ../.. && npx turbo run build --filter=@cullinos/web` |
| Install Command | `cd ../.. && npm ci` |
| **Output Directory** | **Leave empty** — do not set `dist` |
| Include files outside Root Directory | Enabled (monorepo) |

If Output Directory is set to `dist`, the build compiles but deploy fails with:
`The Next.js output directory "dist" was not found`. Clear that field and redeploy.

### Vite frontends (`apps/admin`, etc.)

| Setting | Value |
|---------|--------|
| Output Directory | `dist` |
| Framework Preset | Vite |

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
- Marketing site at `https://cullinos.com`
