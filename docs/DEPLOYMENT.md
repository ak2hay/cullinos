# Cullinos — Production Deployment

## Architecture

**Backend is fully self-hosted on the VM.** No Railway, Neon, Upstash, or Render for API/DB/Redis.

| Component | Host | Domain |
|-----------|------|--------|
| API | OnLiveServer VM | `api.cullinos.com` |
| Postgres | OnLiveServer VM (Docker) | internal `postgres:5432` |
| Redis | OnLiveServer VM (Docker) | internal `redis:6379` |
| Admin | Vercel | `admin.cullinos.com` |
| Management | Vercel | `manage.cullinos.com` |
| Super Admin | Vercel | `platform.cullinos.com` |
| Customer | Vercel | `order.cullinos.com` |
| Waiter | Vercel | `waiter.cullinos.com` |
| Marketing | Vercel | `cullinos.com` |

Production stack: [`docker-compose.prod.yml`](../docker-compose.prod.yml).

| Setting | Value |
|---------|--------|
| Server IP | `95.135.254.46` |
| App directory | `/opt/cullinos` |
| API (HTTP) | `http://95.135.254.46/api/v1/health` |
| API (production domain) | `https://api.cullinos.com` |

## Deploy / update API

From your dev machine:

```bash
export DEPLOY_PASSWORD='your-root-password'
python scripts/remote-deploy.py
```

Or on the server after `git pull`:

```bash
cd /opt/cullinos
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T api npm run db:push
docker compose -f docker-compose.prod.yml exec -T api npm run db:seed
```

### VM `.env` (on server)

Copy from [`.env.production.example`](../.env.production.example):

```
DATABASE_URL=postgresql://cullinos:<password>@postgres:5432/cullinos
REDIS_URL=redis://redis:6379
```

`postgres` and `redis` are Docker service names on the VM network — not external hosts.

### SSL (after DNS)

1. Point `api.cullinos.com` A record → `95.135.254.46`
2. On server: `apt install -y certbot python3-certbot-nginx`
3. `certbot --nginx -d api.cullinos.com`
4. Copy [`infrastructure/nginx/api.cullinos.com.conf`](../infrastructure/nginx/api.cullinos.com.conf) and reload nginx

### Stack

| Service | Container | Notes |
|---------|-----------|-------|
| API | `cullinos-api` | Port 3000, localhost only (nginx proxies) |
| Postgres | `cullinos-postgres` | Persistent volume `cullinos_pg_data` |
| Redis | `cullinos-redis` | Persistent volume `cullinos_redis_data` |

## Vercel (frontends only)

Create one project per app; set **Root Directory** to the app folder (e.g. `apps/admin`).

**Environment (all frontends):**
```
VITE_API_URL=https://api.cullinos.com/api/v1
VITE_WS_URL=https://api.cullinos.com
```

JWT, `DATABASE_URL`, and `REDIS_URL` stay on the VM only — never on Vercel.

**Customer (`apps/customer`) only:**
```
VITE_ORG_SLUG=demo-restaurant
VITE_OUTLET_SLUG=main-outlet
```

**Marketing site (`apps/web`) only:** see env vars in previous docs (`RESEND_API_KEY`, etc.).

## Local development

Use local Postgres/Redis (see [`.env.example`](../.env.example)) or `docker compose -f docker-compose.prod.yml` on a dev machine.

```bash
npm run db:push
npm run db:seed
```

## Verify production

- `GET https://api.cullinos.com/api/v1/health`
- `GET https://api.cullinos.com/api/v1/health/db`
- `https://api.cullinos.com/docs` — Swagger
