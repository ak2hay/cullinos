#!/usr/bin/env bash
# Cullinos VM bootstrap — run on a fresh Ubuntu/Debian server as root.
# Usage: curl -sSL <raw-url> | bash   OR   bash scripts/deploy-vm.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cullinos}"
REPO_URL="${REPO_URL:-https://github.com/ak2hay/cullinos.git}"
BRANCH="${BRANCH:-main}"

echo "==> Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git nginx ufw

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Cloning/updating repository..."
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

if [[ ! -f .env ]]; then
  echo "==> Creating .env from template — EDIT SECRETS before starting!"
  cp .env.production.example .env
  POSTGRES_PW="$(openssl rand -hex 16)"
  sed -i "s/change-me-strong-password/$POSTGRES_PW/g" .env
  sed -i "s/change-me-min-32-chars/$(openssl rand -hex 32)/g" .env
  sed -i "s/change-me-32-byte-hex/$(openssl rand -hex 32)/g" .env
  sed -i "s/change-me-internal-provision-key/$(openssl rand -hex 24)/g" .env
  echo "Generated .env with random secrets. Review at $APP_DIR/.env"
fi

echo "==> Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Waiting for API health..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    echo "API is healthy."
    break
  fi
  sleep 5
done

echo "==> Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T api sh -c "npm run db:push" || true

echo "==> Installing nginx site config..."
mkdir -p /var/www/certbot
cp infrastructure/nginx/api.cullinos.com.conf /etc/nginx/sites-available/cullinos-api.conf
ln -sf /etc/nginx/sites-available/cullinos-api.conf /etc/nginx/sites-enabled/cullinos-api.conf
rm -f /etc/nginx/sites-enabled/default

# HTTP-only config for initial certbot (before SSL certs exist)
cat > /etc/nginx/sites-available/cullinos-api-http.conf <<'NGINX'
server {
    listen 80;
    server_name api.cullinos.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/cullinos-api-http.conf /etc/nginx/sites-enabled/cullinos-api.conf
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo "Cullinos API deployed to $APP_DIR"
echo "Health: curl http://127.0.0.1:3000/api/v1/health"
echo ""
echo "Next steps:"
echo "  1. Point api.cullinos.com A record to this server's IP"
echo "  2. apt install -y certbot python3-certbot-nginx"
echo "  3. certbot --nginx -d api.cullinos.com"
echo "  4. Replace HTTP nginx config with SSL version:"
echo "     cp $APP_DIR/infrastructure/nginx/api.cullinos.com.conf /etc/nginx/sites-available/cullinos-api.conf"
echo "     nginx -t && systemctl reload nginx"
echo "  5. Seed DB (first time): docker compose -f docker-compose.prod.yml exec api npm run db:seed"
echo "============================================"
