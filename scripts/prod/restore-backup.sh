#!/usr/bin/env bash
# Restore a daily backup (local or from R2). Destructive — requires typing RESTORE.
# Usage (on VM as root):
#   /opt/cullinos/scripts/prod/restore-backup.sh 2026-09-16
#   /opt/cullinos/scripts/prod/restore-backup.sh 2026-09-16 --from-r2
#   /opt/cullinos/scripts/prod/restore-backup.sh 2026-09-16 --skip-redis
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

DAY=""
FROM_R2=0
SKIP_REDIS=0
for arg in "$@"; do
  case "$arg" in
    --from-r2) FROM_R2=1 ;;
    --skip-redis) SKIP_REDIS=1 ;;
    -h|--help)
      echo "Usage: $0 YYYY-MM-DD [--from-r2] [--skip-redis]"
      exit 0
      ;;
    *)
      if [[ -z "$DAY" ]]; then
        DAY="$arg"
      else
        echo "Unknown arg: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$DAY" || ! "$DAY" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Usage: $0 YYYY-MM-DD [--from-r2] [--skip-redis]" >&2
  exit 1
fi

SRC="$DAILY_DIR/$DAY"
mkdir -p "$DAILY_DIR"

if [[ "$FROM_R2" -eq 1 ]]; then
  if ! r2_configured; then
    echo "R2 not configured." >&2
    exit 1
  fi
  echo "==> Fetching s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/ -> $SRC"
  mkdir -p "$SRC"
  r2_sync_download "s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/" "$SRC"
fi

if [[ ! -d "$SRC" || ! -f "$SRC/manifest.json" ]]; then
  echo "Backup not found at $SRC (try --from-r2)." >&2
  exit 1
fi

echo "About to RESTORE backup $DAY from $SRC"
echo "This will replace Postgres data, frontends, and reload api/web images."
echo -n "Type RESTORE to continue: "
read -r confirm
if [[ "$confirm" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

echo "==> Stopping api + web"
compose stop api web || true

# Config (optional restore of .env — keep existing if operator prefers)
if [[ -f "$SRC/config.tar.gz" ]]; then
  echo "==> Extracting config pack"
  tmp="$(mktemp -d)"
  tar -C "$tmp" -xzf "$SRC/config.tar.gz"
  if [[ -f "$tmp/config/docker-compose.prod.yml" ]]; then
    cp -a "$tmp/config/docker-compose.prod.yml" "$COMPOSE_FILE"
  fi
  if [[ -f "$tmp/config/.env" ]]; then
    cp -a "$tmp/config/.env" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
  fi
  if [[ -f "$tmp/config/cullinos-api.conf" ]]; then
    cp -a "$tmp/config/cullinos-api.conf" /etc/nginx/sites-available/cullinos-api.conf
  fi
  if [[ -f "$tmp/config/cullinos-frontends.conf" ]]; then
    cp -a "$tmp/config/cullinos-frontends.conf" /etc/nginx/sites-available/cullinos-frontends.conf
  fi
  if [[ -f "$tmp/config/secrets.tar.gz" ]]; then
    tar -C "$APP_DIR" -xzf "$tmp/config/secrets.tar.gz"
  fi
  rm -rf "$tmp"
  # Reload env after config restore
  load_app_env
fi

# Images
if [[ -f "$SRC/images.tar.gz" ]]; then
  echo "==> Loading Docker images"
  gunzip -c "$SRC/images.tar.gz" | docker load
  docker image inspect "${API_IMAGE}:current" >/dev/null 2>&1 || true
  docker image inspect "${WEB_IMAGE}:current" >/dev/null 2>&1 || true
else
  echo "Note: no images.tar.gz in this pack (slim/weekday backup). Using existing :current images or rebuild."
fi

# Frontends
if [[ -f "$SRC/frontends.tar.gz" ]]; then
  echo "==> Restoring frontends"
  mkdir -p "$(dirname "$WWW_DIR")"
  rm -rf "$WWW_DIR"
  tar -C "$(dirname "$WWW_DIR")" -xzf "$SRC/frontends.tar.gz"
fi

# Uploads volume
if [[ -f "$SRC/uploads.tar.gz" ]]; then
  echo "==> Restoring marketing uploads volume"
  up_vol="$(docker volume ls -q | grep -E 'cullinos_marketing_uploads$' | head -n1 || true)"
  if [[ -z "$up_vol" ]]; then
    compose up -d --no-build postgres redis 2>/dev/null || true
    docker volume create cullinos_marketing_uploads >/dev/null 2>&1 || true
    up_vol="$(docker volume ls -q | grep -E 'cullinos_marketing_uploads$' | head -n1 || true)"
  fi
  if [[ -n "$up_vol" ]]; then
    docker run --rm -v "${up_vol}:/data" -v "$SRC:/backup:ro" alpine \
      sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -C /data -xzf /backup/uploads.tar.gz'
  fi
fi

# Ensure postgres is up for restore
echo "==> Ensuring postgres is running"
compose up -d --no-build postgres redis
sleep 5
for _ in $(seq 1 30); do
  if docker exec cullinos-postgres pg_isready -U cullinos -d cullinos >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Postgres restore
if [[ -f "$SRC/postgres.sql.gz" ]]; then
  echo "==> Restoring Postgres (drop/recreate public schema objects via dump)"
  # Terminate connections and restore into cullinos DB
  docker exec -i cullinos-postgres \
    psql -U cullinos -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cullinos' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS cullinos;
CREATE DATABASE cullinos OWNER cullinos;
SQL
  gunzip -c "$SRC/postgres.sql.gz" | docker exec -i cullinos-postgres \
    psql -U cullinos -d cullinos -v ON_ERROR_STOP=1
else
  echo "Warning: no postgres.sql.gz in backup." >&2
fi

# Redis optional
if [[ "$SKIP_REDIS" -eq 0 && -f "$SRC/redis.rdb.gz" ]]; then
  echo "==> Restoring Redis RDB"
  compose stop redis || true
  vol="$(docker volume ls -q | grep -E 'cullinos_redis_data$' | head -n1 || true)"
  if [[ -n "$vol" ]]; then
    docker run --rm -v "${vol}:/data" -v "$SRC:/backup:ro" alpine \
      sh -c 'rm -f /data/dump.rdb; gunzip -c /backup/redis.rdb.gz > /data/dump.rdb'
  fi
  compose up -d --no-build redis
fi

echo "==> Starting api + web"
override="$SRC/docker-compose.release.yml"
if [[ ! -f "$override" ]]; then
  write_compose_override_images \
    "$override" \
    "${API_IMAGE}:current" \
    "${WEB_IMAGE}:current"
fi
docker compose -f "$COMPOSE_FILE" -f "$override" up -d --no-build api web

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || true
fi

echo "==> Waiting for API health..."
if wait_health 48; then
  echo "==> Restore complete: $DAY"
  exit 0
fi

echo "==> API health failed after restore — check: docker compose -f $COMPOSE_FILE logs --tail=100 api" >&2
exit 1
