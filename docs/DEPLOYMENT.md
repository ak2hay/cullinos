# Cullinos — Production Deployment (VM-only)

All apps run on your OnLiveServer VM (`95.135.254.46`). No Vercel or external frontend hosts.

## Architecture

| Component | Host | Domain |
|-----------|------|--------|
| API + WebSocket | Docker on VM | `api.cullinos.com` |
| Postgres + Redis | Docker on VM | internal only |
| Admin | nginx static | `admin.cullinos.com` |
| Management | nginx static | `manage.cullinos.com` |
| Super Admin | nginx static | `platform.cullinos.com` |
| Customer (QR ordering) | nginx static | `order.cullinos.com` |
| Waiter | nginx static | `waiter.cullinos.com` |
| POS (browser) | nginx static | `pos.cullinos.com` |
| KDS (browser) | nginx static | `kds.cullinos.com` |
| Marketing | Docker Next.js | `cullinos.com` |

Stack: [`docker-compose.prod.yml`](../docker-compose.prod.yml)

## QR table ordering

1. Waiter taps a table → **Show QR to customers** or **Take order on waiter app**
2. Session QR URL: `https://order.cullinos.com/{orgSlug}/{outletSlug}?session={token}`
3. Guests scan, add dishes, checkout → items merge into the table’s shared order
4. Waiter taps **End session** when the table is cleared (QR stops working)

## Deploy / update

From your dev machine:

```bash
export DEPLOY_PASSWORD='your-root-password'
python scripts/remote-deploy.py
```

On the server after `git pull`:

```bash
cd /opt/cullinos
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm -T api npx prisma db push --schema=packages/prisma/prisma/schema.prisma
bash scripts/build-frontends.sh
sudo mkdir -p /var/www/cullinos
sudo cp -r dist-frontends/* /var/www/cullinos/
sudo nginx -t && sudo systemctl reload nginx
```

### VM `.env`

Copy from [`.env.production.example`](../.env.production.example):

```
DATABASE_URL=postgresql://cullinos:<password>@postgres:5432/cullinos
REDIS_URL=redis://redis:6379
CUSTOMER_APP_URL=https://order.cullinos.com
CORS_ORIGINS=https://admin.cullinos.com,https://manage.cullinos.com,https://platform.cullinos.com,https://order.cullinos.com,https://waiter.cullinos.com,https://pos.cullinos.com,https://kds.cullinos.com,https://cullinos.com
```

### nginx

- API: [`infrastructure/nginx/api.cullinos.com.conf`](../infrastructure/nginx/api.cullinos.com.conf)
- Frontends: [`infrastructure/nginx/cullinos-frontends.conf`](../infrastructure/nginx/cullinos-frontends.conf)

DNS: point all subdomains A → `95.135.254.46` (disable Cloudflare proxy during initial certbot)

| Subdomain | Purpose |
|-----------|---------|
| `api` | API + WebSocket |
| `admin`, `manage`, `platform`, `order`, `waiter` | SPAs |
| `pos`, `kds` | POS / KDS browser apps |
| `cullinos.com`, `www` | Marketing site |

SSL: automated by `scripts/remote-deploy.py` via certbot after DNS propagates.

### Build frontends locally

```bash
npm run build:frontends
# Output in dist-frontends/
```

Env baked in at build time:

```
VITE_API_URL=https://api.cullinos.com/api/v1
VITE_WS_URL=https://api.cullinos.com
```

## POS & KDS (browser)

Cashier and kitchen staff use the web apps — no desktop installer required:

| App | URL |
|-----|-----|
| POS | https://pos.cullinos.com |
| KDS | https://kds.cullinos.com |

Ensure DNS A records for `pos` and `kds` point to the VM (`95.135.254.46`).

## Local development

```bash
cp .env.example .env
npm run docker:up
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Verify production

- `GET https://api.cullinos.com/api/v1/health`
- `GET https://api.cullinos.com/api/v1/health/db`
- `https://waiter.cullinos.com` — waiter login
- `https://pos.cullinos.com` — cashier login
- `https://kds.cullinos.com` — kitchen login
- `https://order.cullinos.com/demo-restaurant/main-outlet?session=...` — after starting session from waiter
