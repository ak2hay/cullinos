#!/usr/bin/env bash
# Shared helpers for Cullinos prod backup / rollback scripts.
# shellcheck disable=SC2034

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cullinos}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
WWW_DIR="${WWW_DIR:-/var/www/cullinos}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/v1/health}"

API_IMAGE="${API_IMAGE:-cullinos-api}"
WEB_IMAGE="${WEB_IMAGE:-cullinos-web}"

load_app_env() {
  if [[ -f "$APP_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
    set +a
  fi
  BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/cullinos}"
  BACKUP_KEEP_LOCAL_DAYS="${BACKUP_KEEP_LOCAL_DAYS:-0}"
  BACKUP_KEEP_R2_DAYS="${BACKUP_KEEP_R2_DAYS:-30}"
  RELEASE_KEEP_COUNT="${RELEASE_KEEP_COUNT:-5}"
  BACKUP_INCLUDE_IMAGES="${BACKUP_INCLUDE_IMAGES:-weekly}"
  BACKUP_HOURLY_KEEP_HOURS="${BACKUP_HOURLY_KEEP_HOURS:-72}"
  BACKUP_ALERT_WEBHOOK="${BACKUP_ALERT_WEBHOOK:-}"
  BACKUP_ALERT_ON="${BACKUP_ALERT_ON:-fail}"
  RELEASES_DIR="$BACKUP_LOCAL_DIR/releases"
  DAILY_DIR="$BACKUP_LOCAL_DIR/daily"
  HOURLY_DIR="$BACKUP_LOCAL_DIR/hourly"
  LAST_BACKUP_JSON="$BACKUP_LOCAL_DIR/LAST_BACKUP.json"
  LAST_HOURLY_JSON="$BACKUP_LOCAL_DIR/LAST_HOURLY.json"
  CURRENT_LINK="$RELEASES_DIR/CURRENT"
  PREVIOUS_LINK="$RELEASES_DIR/PREVIOUS"
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Run as root on the production VM." >&2
    exit 1
  fi
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

git_sha7() {
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" rev-parse --short=7 HEAD 2>/dev/null || echo "nogit"
  else
    echo "nogit"
  fi
}

make_release_id() {
  echo "$(date -u +%Y%m%d-%H%M%S)-$(git_sha7)"
}

image_id_of() {
  local ref="$1"
  docker image inspect -f '{{.Id}}' "$ref" 2>/dev/null || true
}

running_image_of() {
  local container="$1"
  docker inspect -f '{{.Image}}' "$container" 2>/dev/null || true
}

tag_running_or_named() {
  # tag_running_or_named <container> <base_image_name> <tag>
  local container="$1"
  local base="$2"
  local tag="$3"
  local src
  src="$(running_image_of "$container")"
  if [[ -z "$src" ]]; then
    # Fall back to compose project image name
    src="$(image_id_of "${base}:current")"
    if [[ -z "$src" ]]; then
      src="$(docker images -q --filter "reference=${base}" | head -n1 || true)"
    fi
  fi
  if [[ -z "$src" ]]; then
    echo "Cannot find image for $base (container $container)." >&2
    return 1
  fi
  docker tag "$src" "${base}:${tag}"
}

r2_endpoint() {
  if [[ -n "${R2_BACKUP_ENDPOINT:-}" ]]; then
    echo "$R2_BACKUP_ENDPOINT"
    return
  fi
  if [[ -n "${R2_ENDPOINT:-}" ]]; then
    echo "$R2_ENDPOINT"
    return
  fi
  if [[ -z "${R2_ACCOUNT_ID:-}" ]]; then
    echo ""
    return
  fi
  echo "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
}

r2_configured() {
  [[ -n "${R2_BACKUP_BUCKET:-}" && -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]] || return 1
  local ep
  ep="$(r2_endpoint)"
  [[ -n "$ep" ]]
}

# Prefer AWS CLI v2 (/usr/local/bin/aws) — Ubuntu awscli 1.x / old boto3 often fail TLS to R2.
# Falls back to scripts/prod/r2_sync.py (boto3).
r2_sync_upload() {
  local local_dir="$1"
  local s3_uri="$2"
  local ep
  ep="$(r2_endpoint)"
  if [[ -x /usr/local/bin/aws ]]; then
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
    /usr/local/bin/aws s3 sync "${local_dir%/}/" "$s3_uri" --endpoint-url "$ep"
    return $?
  fi
  R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}" \
  R2_ENDPOINT="$ep" \
  R2_BACKUP_ENDPOINT="${R2_BACKUP_ENDPOINT:-}" \
  R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  python3 "$(dirname "${BASH_SOURCE[0]}")/r2_sync.py" "$local_dir" "$s3_uri"
}

r2_sync_download() {
  local s3_uri="$1"
  local local_dir="$2"
  local ep
  ep="$(r2_endpoint)"
  mkdir -p "$local_dir"
  if [[ -x /usr/local/bin/aws ]]; then
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
    /usr/local/bin/aws s3 sync "$s3_uri" "${local_dir%/}/" --endpoint-url "$ep"
    return $?
  fi
  R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}" \
  R2_ENDPOINT="$ep" \
  R2_BACKUP_ENDPOINT="${R2_BACKUP_ENDPOINT:-}" \
  R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  python3 "$(dirname "${BASH_SOURCE[0]}")/r2_sync.py" --download "$s3_uri" "$local_dir"
}


# List day prefixes under cullinos/daily/ and delete older than cutoff (YYYY-MM-DD).
r2_prune_daily() {
  local cutoff="$1"
  python3 - <<PY
import os, sys
try:
    import boto3
    from botocore.config import Config
except ImportError:
    print("boto3 missing - apt-get install -y python3-boto3", file=sys.stderr)
    raise SystemExit(1)

bucket = os.environ["R2_BACKUP_BUCKET"]
account = os.environ.get("R2_ACCOUNT_ID", "").strip()
endpoint = (
    os.environ.get("R2_BACKUP_ENDPOINT", "").strip()
    or os.environ.get("R2_ENDPOINT", "").strip()
    or (f"https://{account}.r2.cloudflarestorage.com" if account else "")
)
client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name=os.environ.get("AWS_DEFAULT_REGION", "auto"),
    config=Config(signature_version="s3v4"),
)
cutoff = "${cutoff}"
prefix = "cullinos/daily/"
resp = client.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter="/")
for p in resp.get("CommonPrefixes") or []:
    day = p["Prefix"][len(prefix):].rstrip("/")
    if len(day) == 10 and day < cutoff:
        print(f"deleting s3://{bucket}/{prefix}{day}/")
        # delete all objects under day
        token = None
        while True:
            kw = {"Bucket": bucket, "Prefix": f"{prefix}{day}/"}
            if token:
                kw["ContinuationToken"] = token
            page = client.list_objects_v2(**kw)
            objs = [{"Key": o["Key"]} for o in page.get("Contents") or []]
            if objs:
                client.delete_objects(Bucket=bucket, Delete={"Objects": objs})
            token = page.get("NextContinuationToken")
            if not token:
                break
PY
}

wait_health() {
  local attempts="${1:-36}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -sf "$HEALTH_URL" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
      return 0
    fi
    # Also accept simple ok without strict JSON spacing
    if curl -sf "$HEALTH_URL" | grep -q 'ok'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

prune_old_releases() {
  local keep="${RELEASE_KEEP_COUNT:-5}"
  mkdir -p "$RELEASES_DIR"
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
  local i=0
  local id
  for id in "${releases[@]}"; do
    i=$((i + 1))
    if ((i > keep)); then
      echo "Pruning old release $id"
      rm -rf "$RELEASES_DIR/$id"
      docker image rm -f "${API_IMAGE}:${id}" "${WEB_IMAGE}:${id}" 2>/dev/null || true
    fi
  done
}

write_compose_override_images() {
  local out="$1"
  local api_ref="$2"
  local web_ref="$3"
  cat >"$out" <<EOF
# Generated — forces image tags (no rebuild) for rollback / pinned release.
services:
  api:
    image: ${api_ref}
    pull_policy: never
  web:
    image: ${web_ref}
    pull_policy: never
EOF
}

# --- Backup status + alerts -------------------------------------------------

should_include_images() {
  case "${BACKUP_INCLUDE_IMAGES:-weekly}" in
    always|ALWAYS) return 0 ;;
    never|NEVER) return 1 ;;
    weekly|WEEKLY|"")
      # Sunday UTC
      [[ "$(date -u +%u)" == "7" ]]
      ;;
    *)
      echo "Unknown BACKUP_INCLUDE_IMAGES=${BACKUP_INCLUDE_IMAGES} (use weekly|always|never)" >&2
      return 1
      ;;
  esac
}

dir_size_bytes() {
  local d="$1"
  if [[ -d "$d" ]]; then
    du -sb "$d" 2>/dev/null | awk '{print $1}'
  else
    echo 0
  fi
}

write_backup_status() {
  # write_backup_status <json_path> <ok 0|1> <kind> <label> <r2 0|1> <size_bytes> <error>
  local path="$1"
  local ok="$2"
  local kind="$3"
  local label="$4"
  local r2="$5"
  local size="$6"
  local err="${7:-}"
  mkdir -p "$(dirname "$path")"
  OK="$ok" KIND="$kind" LABEL="$label" R2="$r2" SIZE="${size:-0}" ERR="$err" STATUS_PATH="$path" \
  python3 - <<'PY'
import json, os
from datetime import datetime, timezone
import socket
doc = {
  "ok": os.environ.get("OK") == "1",
  "kind": os.environ.get("KIND", ""),
  "label": os.environ.get("LABEL", ""),
  "r2": os.environ.get("R2") == "1",
  "size_bytes": int(os.environ.get("SIZE") or 0),
  "error": os.environ.get("ERR") or None,
  "finished_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "host": socket.gethostname(),
}
path = os.environ["STATUS_PATH"]
with open(path, "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
PY
}

send_backup_alert() {
  # send_backup_alert <ok 0|1> <kind> <label> <detail>
  local ok="$1"
  local kind="$2"
  local label="$3"
  local detail="${4:-}"
  local webhook="${BACKUP_ALERT_WEBHOOK:-}"
  [[ -n "$webhook" ]] || return 0

  local on="${BACKUP_ALERT_ON:-fail}"
  if [[ "$on" == "fail" && "$ok" == "1" ]]; then
    return 0
  fi

  local status="OK"
  [[ "$ok" == "1" ]] || status="FAILED"
  local text
  text="Cullinos backup ${status}: kind=${kind} label=${label}"
  [[ -n "$detail" ]] && text="${text} — ${detail}"

  # Slack/Discord-compatible JSON body
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "content": sys.argv[1]}))' "$text")"
  curl -sS -m 15 -X POST -H 'Content-Type: application/json' -d "$payload" "$webhook" >/dev/null 2>&1 || true
}

r2_upload_file() {
  local local_file="$1"
  local s3_uri="$2"
  local ep
  ep="$(r2_endpoint)"
  if [[ -x /usr/local/bin/aws ]]; then
    AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
    /usr/local/bin/aws s3 cp "$local_file" "$s3_uri" --endpoint-url "$ep"
    return $?
  fi
  # boto3 single-file via temp dir sync
  local tmp
  tmp="$(mktemp -d)"
  cp -a "$local_file" "$tmp/$(basename "$local_file")"
  local parent="${s3_uri%/}"
  parent="${parent%/*}/"
  r2_sync_upload "$tmp" "$parent"
  local rc=$?
  rm -rf "$tmp"
  return $rc
}

r2_prune_hourly() {
  local keep_hours="${1:-72}"
  python3 - <<PY
import os, sys
from datetime import datetime, timedelta, timezone
try:
    import boto3
    from botocore.config import Config
except ImportError:
    # Prefer aws cli prune fallback
    raise SystemExit(0)

bucket = os.environ["R2_BACKUP_BUCKET"]
account = os.environ.get("R2_ACCOUNT_ID", "").strip()
endpoint = (
    os.environ.get("R2_BACKUP_ENDPOINT", "").strip()
    or os.environ.get("R2_ENDPOINT", "").strip()
    or (f"https://{account}.r2.cloudflarestorage.com" if account else "")
)
client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name=os.environ.get("AWS_DEFAULT_REGION", "auto"),
    config=Config(signature_version="s3v4"),
)
keep = int("${keep_hours}")
cutoff = datetime.now(timezone.utc) - timedelta(hours=keep)
prefix = "cullinos/hourly/"
token = None
to_delete = []
while True:
    kw = {"Bucket": bucket, "Prefix": prefix}
    if token:
        kw["ContinuationToken"] = token
    page = client.list_objects_v2(**kw)
    for obj in page.get("Contents") or []:
        key = obj["Key"]
        # cullinos/hourly/YYYY-MM-DD/HH.sql.gz
        parts = key[len(prefix):].split("/")
        if len(parts) != 2 or not parts[1].endswith(".sql.gz"):
            continue
        day, fname = parts[0], parts[1]
        hour = fname.split(".")[0]
        try:
            ts = datetime.strptime(f"{day}T{hour}", "%Y-%m-%dT%H").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if ts < cutoff:
            to_delete.append({"Key": key})
    token = page.get("NextContinuationToken")
    if not token:
        break
for i in range(0, len(to_delete), 1000):
    chunk = to_delete[i:i+1000]
    if chunk:
        print(f"deleting {len(chunk)} hourly objects")
        client.delete_objects(Bucket=bucket, Delete={"Objects": chunk})
PY
}
