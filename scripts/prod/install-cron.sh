#!/usr/bin/env bash
# Install daily + hourly backup cron + directories on the production VM.
# Usage (on VM as root): /opt/cullinos/scripts/prod/install-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_common.sh"

require_root
load_app_env

mkdir -p "$BACKUP_LOCAL_DIR/releases" "$BACKUP_LOCAL_DIR/daily" "$BACKUP_LOCAL_DIR/hourly" /var/log
chmod 700 "$BACKUP_LOCAL_DIR"

chmod +x \
  "$SCRIPT_DIR/backup.sh" \
  "$SCRIPT_DIR/backup-db-hourly.sh" \
  "$SCRIPT_DIR/rollback.sh" \
  "$SCRIPT_DIR/snapshot-release.sh" \
  "$SCRIPT_DIR/restore-backup.sh" \
  "$SCRIPT_DIR/install-cron.sh" \
  "$SCRIPT_DIR/r2_sync.py"

DAILY_LINE="0 2 * * * /bin/bash $SCRIPT_DIR/backup.sh >> /var/log/cullinos-backup.log 2>&1"
HOURLY_LINE="5 * * * * /bin/bash $SCRIPT_DIR/backup-db-hourly.sh >> /var/log/cullinos-backup-hourly.log 2>&1"

existing="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$existing" \
  | grep -v 'scripts/prod/backup.sh' \
  | grep -v 'scripts/prod/backup-db-hourly.sh' \
  || true)"
{
  printf '%s\n' "$filtered"
  echo "$DAILY_LINE"
  echo "$HOURLY_LINE"
} | grep -v '^$' | crontab -

echo "==> Installed cron:"
echo "    $DAILY_LINE"
echo "    $HOURLY_LINE"
echo "==> Backup dir: $BACKUP_LOCAL_DIR"
echo "==> Status: $LAST_BACKUP_JSON / $LAST_HOURLY_JSON"
echo "==> Logs: /var/log/cullinos-backup.log , /var/log/cullinos-backup-hourly.log"
echo ""
echo "Optional .env:"
echo "  BACKUP_ALERT_WEBHOOK=https://hooks.slack.com/...   # or Discord webhook"
echo "  BACKUP_ALERT_ON=fail|always                       # default fail"
echo "  BACKUP_INCLUDE_IMAGES=weekly|always|never         # default weekly (Sunday UTC)"
echo "  BACKUP_KEEP_LOCAL_DAYS=0                          # 0=R2-only (default); >0 keep N days local"
echo "  BACKUP_HOURLY_KEEP_HOURS=72                       # R2 hourly retention only"
