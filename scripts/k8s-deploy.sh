#!/usr/bin/env bash
# Deploys one kustomize overlay at an immutable image tag (short git SHA):
#   1. stateful/infra objects (Postgres, Redis, config, policies) at the new manifests
#   2. Prisma migrations in a one-off Job using the *new* API image
#   3. app Deployments (API, web, SPAs) at the new tag, then a DB-aware smoke test
# If step 3 fails, app Deployments are rolled back with `kubectl rollout undo`.
# Migrations are forward-only and are NOT reverted by the rollback.
#
# Usage: scripts/k8s-deploy.sh <namespace> <overlay-dir> <image-tag> [skip-migrate]
set -euo pipefail

NS="$1"
OVERLAY="$2"
TAG="$3"
SKIP_MIGRATE="${4:-false}"
REGISTRY="ghcr.io/ak2hay"
APPS=(api web spa-admin spa-management spa-super-admin spa-app-ops spa-pos spa-kds spa-kiosk spa-guest-landing spa-waiter-landing)
APP_SELECTOR="app notin ($(IFS=,; echo "${APPS[*]}"))"

if ! [[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Invalid image tag: $TAG" >&2
  exit 1
fi

if [ -z "$(kubectl -n "$NS" get secret cullinos-secrets -o jsonpath='{.data.REDIS_PASSWORD}' 2>/dev/null)" ]; then
  echo "cullinos-secrets in $NS has no REDIS_PASSWORD; add it (see infrastructure/k8s/secrets.example.env)." >&2
  exit 1
fi

RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT
kubectl kustomize "$OVERLAY" \
  | sed -E "s#(image: ${REGISTRY//./\\.}/cullinos-[a-z-]+):[A-Za-z0-9._-]+#\1:${TAG}#" > "$RENDERED"

echo "==> Infra objects"
kubectl -n "$NS" apply -f "$RENDERED" -l "$APP_SELECTOR"
kubectl -n "$NS" rollout status deployment/postgres --timeout=300s
kubectl -n "$NS" rollout status deployment/redis --timeout=180s

if [ "$SKIP_MIGRATE" != "true" ]; then
  JOB="db-migrate-$(echo "$TAG" | tr '[:upper:]._' '[:lower:]--' | cut -c1-40)"
  echo "==> Migrations ($JOB)"
  kubectl -n "$NS" delete job "$JOB" --ignore-not-found --wait=true
  sed "s|__IMAGE__|${REGISTRY}/cullinos-api:${TAG}|; s|__NAME__|${JOB}|" \
    infrastructure/k8s/jobs/db-migrate.yaml | kubectl -n "$NS" apply -f -
  deadline=$(( $(date +%s) + 900 ))
  while :; do
    succeeded="$(kubectl -n "$NS" get job "$JOB" -o jsonpath='{.status.succeeded}')"
    failed="$(kubectl -n "$NS" get job "$JOB" -o jsonpath='{.status.failed}')"
    if [ "${succeeded:-0}" -ge 1 ]; then break; fi
    if [ "${failed:-0}" -ge 1 ] || [ "$(date +%s)" -gt "$deadline" ]; then
      kubectl -n "$NS" logs "job/$JOB" --tail=200 || true
      echo "Migration failed; app Deployments were not changed." >&2
      exit 1
    fi
    sleep 5
  done
  kubectl -n "$NS" logs "job/$JOB" --tail=50 || true
fi

rollback() {
  echo "==> Deploy failed; rolling back app Deployments" >&2
  for d in "${APPS[@]}"; do
    kubectl -n "$NS" rollout undo "deployment/$d" || true
  done
  for d in "${APPS[@]}"; do
    kubectl -n "$NS" rollout status "deployment/$d" --timeout=300s || true
  done
  exit 1
}

echo "==> App rollout at tag $TAG"
kubectl -n "$NS" apply -f "$RENDERED" || rollback
for d in "${APPS[@]}"; do
  kubectl -n "$NS" rollout status "deployment/$d" --timeout=300s || rollback
done

echo "==> Smoke /health/db"
kubectl -n "$NS" run "smoke-$RANDOM" --labels=app=smoke --rm -i --restart=Never \
  --image=curlimages/curl:8.5.0 -- curl -sf --max-time 10 http://api/api/v1/health/db || rollback

echo "Deployed $TAG to $NS"
