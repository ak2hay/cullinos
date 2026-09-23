#!/usr/bin/env bash
# Dump Postgres from a k3s namespace (for R2 / off-box backup).
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="${1:-production}"
OUT="${2:-/var/backups/cullinos/k8s-${NS}-$(date +%Y%m%d-%H%M%S).sql}"
mkdir -p "$(dirname "$OUT")"
PG_POD="$(kubectl -n "$NS" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')"
kubectl -n "$NS" exec "$PG_POD" -- pg_dump -U cullinos -d cullinos > "$OUT"
echo "Wrote $OUT"
