#!/usr/bin/env bash
# Daily full-app backup -> Cloudflare R2 (local staging only; purge after successful upload).
# Images: BACKUP_INCLUDE_IMAGES=weekly|always|never (default weekly = Sunday UTC).
# Usage (on VM as root): /opt/cullinos/scripts/prod/backup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

DAY="$(date -u +%Y-%m-%d)"
DEST="$DAILY_DIR/$DAY"
STAGING="$DAILY_DIR/.staging-$DAY"
R2_OK=0
INCLUDE_IMAGES=0
ERR_MSG=""
EXIT_CODE=0
PACK_SIZE=0

finish() {
  local ec=$?
  if [[ "$EXIT_CODE" -eq 0 && "$ec" -ne 0 ]]; then
    EXIT_CODE=$ec
    [[ -n "$ERR_MSG" ]] || ERR_MSG="backup failed (exit $ec)"
  fi
  local size="$PACK_SIZE"
  if [[ "$size" -eq 0 && -d "$DEST" ]]; then
    size="$(dir_size_bytes "$DEST")"
  fi
  local ok=0
  [[ "$EXIT_CODE" -eq 0 ]] && ok=1
  write_backup_status "$LAST_BACKUP_JSON" "$ok" "daily" "$DAY" "$R2_OK" "$size" "$ERR_MSG"
  if [[ "$ok" -eq 1 ]]; then
    send_backup_alert 1 "daily" "$DAY" "r2=${R2_OK} size=${size} images=${INCLUDE_IMAGES}"
  else
    send_backup_alert 0 "daily" "$DAY" "${ERR_MSG:-exit $EXIT_CODE}"
  fi
  exit "$EXIT_CODE"
}
trap finish EXIT

rm -rf "$STAGING"
mkdir -p "$STAGING" "$DAILY_DIR"

echo "==> Daily backup $DAY (staging -> R2)"

# --- Postgres ---
echo "==> pg_dump"
if docker ps --format '{{.Names}}' | grep -qx cullinos-postgres; then
  docker exec cullinos-postgres \
    pg_dump -U cullinos -d cullinos --no-owner --no-acl \
    | gzip -c >"$STAGING/postgres.sql.gz"
else
  ERR_MSG="cullinos-postgres not running"
  echo "ERROR: $ERR_MSG" >&2
  EXIT_CODE=1
  exit 1
fi

# --- Redis (best-effort) ---
echo "==> Redis RDB (best-effort)"
if docker ps --format '{{.Names}}' | grep -qx cullinos-redis; then
  docker exec cullinos-redis redis-cli SAVE >/dev/null 2>&1 || true
  vol="$(docker volume ls -q | grep -E 'cullinos_redis_data$' | head -n1 || true)"
  if [[ -n "$vol" ]]; then
    docker run --rm -v "${vol}:/data:ro" -v "$STAGING:/out" alpine \
      sh -c 'if [ -f /data/dump.rdb ]; then gzip -c /data/dump.rdb > /out/redis.rdb.gz; fi' \
      || true
  fi
fi

# --- Frontends ---
echo "==> Frontends"
if [[ -d "$WWW_DIR" ]]; then
  tar -C "$(dirname "$WWW_DIR")" -czf "$STAGING/frontends.tar.gz" "$(basename "$WWW_DIR")"
fi

# --- Marketing uploads volume ---
echo "==> Uploads volume (if any)"
up_vol="$(docker volume ls -q | grep -E 'cullinos_marketing_uploads$' | head -n1 || true)"
if [[ -n "$up_vol" ]]; then
  docker run --rm -v "${up_vol}:/data:ro" -v "$STAGING:/out" alpine \
    sh -c 'if [ "$(ls -A /data 2>/dev/null)" ]; then tar -C /data -czf /out/uploads.tar.gz .; fi' \
    || true
fi

# --- Config ---
echo "==> Config"
umask 077
mkdir -p "$STAGING/config"
[[ -f "$APP_DIR/.env" ]] && cp -a "$APP_DIR/.env" "$STAGING/config/.env" && chmod 600 "$STAGING/config/.env"
[[ -f "$COMPOSE_FILE" ]] && cp -a "$COMPOSE_FILE" "$STAGING/config/docker-compose.prod.yml"
[[ -f /etc/nginx/sites-available/cullinos-api.conf ]] && \
  cp -a /etc/nginx/sites-available/cullinos-api.conf "$STAGING/config/cullinos-api.conf"
[[ -f /etc/nginx/sites-available/cullinos-frontends.conf ]] && \
  cp -a /etc/nginx/sites-available/cullinos-frontends.conf "$STAGING/config/cullinos-frontends.conf"
if [[ -d "$APP_DIR/secrets" ]]; then
  tar -C "$APP_DIR" -czf "$STAGING/config/secrets.tar.gz" secrets
fi
tar -C "$STAGING" -czf "$STAGING/config.tar.gz" config
rm -rf "$STAGING/config"

# --- Docker images (optional / weekly) ---
API_REF="${API_IMAGE}:current"
WEB_REF="${WEB_IMAGE}:current"
if ! docker image inspect "$API_REF" >/dev/null 2>&1; then
  API_REF="$(docker inspect -f '{{.Config.Image}}' cullinos-api 2>/dev/null || echo "")"
fi
if ! docker image inspect "$WEB_REF" >/dev/null 2>&1; then
  WEB_REF="$(docker inspect -f '{{.Config.Image}}' cullinos-web 2>/dev/null || echo "")"
fi

if should_include_images; then
  INCLUDE_IMAGES=1
  echo "==> docker save api + web (BACKUP_INCLUDE_IMAGES=${BACKUP_INCLUDE_IMAGES})"
  SAVE_ARGS=()
  [[ -n "$API_REF" ]] && docker image inspect "$API_REF" >/dev/null 2>&1 && SAVE_ARGS+=("$API_REF")
  [[ -n "$WEB_REF" ]] && docker image inspect "$WEB_REF" >/dev/null 2>&1 && SAVE_ARGS+=("$WEB_REF")
  if [[ ${#SAVE_ARGS[@]} -gt 0 ]]; then
    docker save "${SAVE_ARGS[@]}" | gzip -c >"$STAGING/images.tar.gz"
  else
    echo "Warning: no api/web images to save." >&2
  fi
else
  echo "==> Skipping docker save (BACKUP_INCLUDE_IMAGES=${BACKUP_INCLUDE_IMAGES}; release tags cover rollback)"
fi

# --- Manifest ---
GIT_SHA="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")"
CURRENT_RELEASE=""
[[ -f "$RELEASES_DIR/CURRENT_ID" ]] && CURRENT_RELEASE="$(cat "$RELEASES_DIR/CURRENT_ID")"
cat >"$STAGING/manifest.json" <<EOF
{
  "day": "$DAY",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_sha": "$GIT_SHA",
  "current_release": "$CURRENT_RELEASE",
  "app_dir": "$APP_DIR",
  "api_image": "$API_REF",
  "web_image": "$WEB_REF",
  "include_images": $INCLUDE_IMAGES,
  "backup_include_images": "${BACKUP_INCLUDE_IMAGES}",
  "health_url": "$HEALTH_URL"
}
EOF

# Promote staging -> final (replace same-day pack)
rm -rf "$DEST"
mkdir -p "$DEST"
mv "$STAGING"/* "$DEST/"
rm -rf "$STAGING"
PACK_SIZE="$(dir_size_bytes "$DEST")"

# R2 upload
if r2_configured; then
  echo "==> Uploading to R2 s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/"
  if r2_sync_upload "$DEST" "s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/"; then
    R2_OK=1
    echo "==> Pruning R2 daily backups older than ${BACKUP_KEEP_R2_DAYS} days"
    cutoff="$(date -u -d "-${BACKUP_KEEP_R2_DAYS} days" +%Y-%m-%d 2>/dev/null \
      || date -u -v-"${BACKUP_KEEP_R2_DAYS}"d +%Y-%m-%d 2>/dev/null \
      || true)"
    if [[ -n "$cutoff" ]]; then
      export R2_BACKUP_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ACCOUNT_ID
      export R2_ENDPOINT R2_BACKUP_ENDPOINT
      r2_prune_daily "$cutoff" || true
    fi
    # Local retention: 0 = R2-only (delete after upload); >0 = keep N days
    keep="${BACKUP_KEEP_LOCAL_DAYS:-0}"
    if [[ "$keep" == "0" ]]; then
      echo "==> Local pack removed after R2 upload (R2-only mode)"
      rm -rf "$DEST"
      # Also drop any leftover day dirs when R2-only
      find "$DAILY_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -exec rm -rf {} + 2>/dev/null || true
      find "$DAILY_DIR" -mindepth 1 -maxdepth 1 -type d -name '.staging-*' -exec rm -rf {} + 2>/dev/null || true
    else
      echo "==> Pruning local daily backups older than ${keep} days"
      find "$DAILY_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+${keep}" -exec rm -rf {} +
    fi
  else
    ERR_MSG="R2 upload failed"
    echo "ERROR: $ERR_MSG (local pack kept at $DEST)" >&2
    EXIT_CODE=1
    exit 1
  fi
else
  ERR_MSG="R2 not configured"
  echo "WARNING: R2 backup not configured (set R2_BACKUP_BUCKET + R2 keys)." >&2
  echo "         Local backup kept at $DEST." >&2
  EXIT_CODE=1
  exit 1
fi

echo "==> Backup complete: day=$DAY R2 ok=$R2_OK images=$INCLUDE_IMAGES size=$PACK_SIZE"
EXIT_CODE=0
