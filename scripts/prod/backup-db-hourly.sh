#!/usr/bin/env bash
# Hourly Postgres dump -> Cloudflare R2 (local staging only; purge after successful upload).
# R2 retention: BACKUP_HOURLY_KEEP_HOURS (default 72). Local file deleted after R2 success.
# Usage (on VM as root): /opt/cullinos/scripts/prod/backup-db-hourly.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

DAY="$(date -u +%Y-%m-%d)"
HOUR="$(date -u +%H)"
LABEL="${DAY}T${HOUR}"
DEST_DIR="$HOURLY_DIR/$DAY"
FILE="$DEST_DIR/${HOUR}.sql.gz"
R2_OK=0
ERR_MSG=""
EXIT_CODE=0
SIZE=0

finish() {
  local ec=$?
  if [[ "$EXIT_CODE" -eq 0 && "$ec" -ne 0 ]]; then
    EXIT_CODE=$ec
    [[ -n "$ERR_MSG" ]] || ERR_MSG="hourly backup failed (exit $ec)"
  fi
  local ok=0
  [[ "$EXIT_CODE" -eq 0 ]] && ok=1
  if [[ "$SIZE" -eq 0 && -f "$FILE" ]]; then
    SIZE="$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE" 2>/dev/null || echo 0)"
  fi
  write_backup_status "$LAST_HOURLY_JSON" "$ok" "hourly" "$LABEL" "$R2_OK" "$SIZE" "$ERR_MSG"
  if [[ "$ok" -eq 1 ]]; then
    send_backup_alert 1 "hourly" "$LABEL" "r2=${R2_OK} size=${SIZE}"
  else
    send_backup_alert 0 "hourly" "$LABEL" "${ERR_MSG:-exit $EXIT_CODE}"
  fi
  exit "$EXIT_CODE"
}
trap finish EXIT

mkdir -p "$DEST_DIR"
chmod 700 "$BACKUP_LOCAL_DIR" 2>/dev/null || true

echo "==> Hourly DB backup $LABEL (staging -> R2)"

if ! docker ps --format '{{.Names}}' | grep -qx cullinos-postgres; then
  ERR_MSG="cullinos-postgres not running"
  echo "ERROR: $ERR_MSG" >&2
  EXIT_CODE=1
  exit 1
fi

docker exec cullinos-postgres \
  pg_dump -U cullinos -d cullinos --no-owner --no-acl \
  | gzip -c >"$FILE"
chmod 600 "$FILE"
SIZE="$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE" 2>/dev/null || echo 0)"

if ! r2_configured; then
  ERR_MSG="R2 not configured"
  echo "WARNING: $ERR_MSG — local hourly dump kept at $FILE." >&2
  EXIT_CODE=1
  exit 1
fi

S3_URI="s3://${R2_BACKUP_BUCKET}/cullinos/hourly/${DAY}/${HOUR}.sql.gz"
echo "==> Uploading $S3_URI"
if r2_upload_file "$FILE" "$S3_URI"; then
  R2_OK=1
  export R2_BACKUP_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ACCOUNT_ID
  export R2_ENDPOINT R2_BACKUP_ENDPOINT
  r2_prune_hourly "${BACKUP_HOURLY_KEEP_HOURS}" || true
  echo "==> Local hourly dump removed after R2 upload (R2-only mode)"
  rm -f "$FILE"
  # Remove empty day dirs under hourly/
  find "$HOURLY_DIR" -mindepth 1 -maxdepth 1 -type d -empty -delete 2>/dev/null || true
  rmdir "$DEST_DIR" 2>/dev/null || true
else
  ERR_MSG="R2 hourly upload failed"
  echo "ERROR: $ERR_MSG (local dump kept at $FILE)" >&2
  EXIT_CODE=1
  exit 1
fi

echo "==> Hourly backup complete: $LABEL R2 ok=$R2_OK size=$SIZE"
EXIT_CODE=0
