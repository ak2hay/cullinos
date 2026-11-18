#!/usr/bin/env bash
# Build Vite frontends for VM deployment (run from repo root).
#
#   bash scripts/build-frontends.sh              # every SPA, in parallel
#   bash scripts/build-frontends.sh admin pos    # only those apps
#
# Shared packages build once via turbo, then the apps build together
# (FRONTEND_BUILD_CONCURRENCY, default 4). The marketing site is not built
# here: production serves it from the web image (Dockerfile.web). Set
# INCLUDE_WEB=1 to also run the Next.js build locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export VITE_API_URL="${VITE_API_URL:-https://api.cullinos.com/api/v1}"
export VITE_WS_URL="${VITE_WS_URL:-https://api.cullinos.com}"
export VITE_KDS_URL="${VITE_KDS_URL:-https://kds.cullinos.com}"
export VITE_POS_URL="${VITE_POS_URL:-https://pos.cullinos.com}"
export VITE_KIOSK_APP_URL="${VITE_KIOSK_APP_URL:-https://kiosk.cullinos.com}"
export VITE_ADMIN_URL="${VITE_ADMIN_URL:-https://admin.cullinos.com}"
export VITE_GUEST_APP_URL="${VITE_GUEST_APP_URL:-https://guest.cullinos.com}"
export VITE_PLATFORM_URL="${VITE_PLATFORM_URL:-https://platform.cullinos.com}"
export VITE_SUPER_ADMIN_URL="${VITE_SUPER_ADMIN_URL:-https://platform.cullinos.com}"
export VITE_APP_OPS_URL="${VITE_APP_OPS_URL:-https://app.cullinos.com}"
export VITE_MARKETING_WEB_URL="${VITE_MARKETING_WEB_URL:-https://cullinos.com}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.cullinos.com/api/v1}"

ALL=(admin management super-admin app-ops pos kds kiosk guest-web)
if [[ $# -gt 0 ]]; then
  APPS=("$@")
else
  APPS=("${ALL[@]}")
fi

for app in "${APPS[@]}"; do
  if [[ ! -f "apps/${app}/package.json" ]]; then
    echo "Unknown frontend app: $app" >&2
    exit 1
  fi
done

filters=()
for app in "${APPS[@]}"; do
  filters+=("--filter=@cullinos/${app}")
done

CONCURRENCY="${FRONTEND_BUILD_CONCURRENCY:-4}"
echo ">>> Building ${APPS[*]} (turbo concurrency ${CONCURRENCY})"
npx turbo run build "${filters[@]}" --concurrency="$CONCURRENCY" --output-logs=new-only

if [[ "${INCLUDE_WEB:-0}" == "1" ]]; then
  echo ">>> Building @cullinos/web (Next.js marketing, local only)"
  npm run build -w @cullinos/web
fi

OUT="${ROOT}/dist-frontends"
rm -rf "$OUT"
mkdir -p "$OUT"

for app in "${APPS[@]}"; do
  src="${ROOT}/apps/${app}/dist"
  if [[ ! -f "${src}/index.html" ]]; then
    echo "Missing dist for $app" >&2
    exit 1
  fi
  if [[ "$app" == "guest-web" ]]; then
    rm -rf "${OUT}/guest-landing"
    cp -r "$src" "${OUT}/guest-landing"
    mkdir -p "${OUT}/guest-landing/.well-known"
    cp "${ROOT}/infrastructure/www/guest-landing/.well-known/assetlinks.json" \
      "${OUT}/guest-landing/.well-known/assetlinks.json"
  else
    cp -r "$src" "${OUT}/${app}"
  fi
done

# Phone storefront replaces the download-only guest landing. Waiter stays static.
# A partial app list leaves waiter-landing out unless this was a full build.
if [[ $# -eq 0 ]]; then
  mkdir -p "${OUT}/waiter-landing"
  cp -r "${ROOT}/infrastructure/www/waiter-landing/." "${OUT}/waiter-landing/"
fi

# ANDROID_ASSETLINKS_SHA256: comma-separated Play app signing + upload key SHA-256 fingerprints.
# Empty defaults to the public guest release cert fingerprint.
ASSETLINKS="${OUT}/guest-landing/.well-known/assetlinks.json"
if [[ -f "$ASSETLINKS" ]]; then
  if [[ -z "${ANDROID_ASSETLINKS_SHA256:-}" ]]; then
    ANDROID_ASSETLINKS_SHA256="C9:FB:AC:87:AE:DE:AF:84:A1:6D:B9:77:14:5A:09:03:78:B1:99:82:CA:F3:F4:BA:C1:D2:AB:2E:08:47:DF:57"
  fi
  FPS="$(echo "$ANDROID_ASSETLINKS_SHA256" | tr ',' '\n' | sed '/^$/d; s/.*/"&"/' | paste -sd, -)"
  # shellcheck disable=SC2016
  sed -i "s|\"REPLACE_WITH_PLAY_OR_UPLOAD_CERT_SHA256\"|${FPS}|" "$ASSETLINKS"
fi

echo "Frontend bundles ready in dist-frontends/"
echo "Routine deploy: python scripts/fast-deploy.py"
