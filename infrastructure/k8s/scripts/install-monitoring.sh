#!/usr/bin/env bash
# Apply lightweight Prometheus + Grafana stack.
# First install needs GRAFANA_ADMIN_PASSWORD; later runs keep the existing Secret.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl -n monitoring get secret grafana-admin >/dev/null 2>&1; then
  : "${GRAFANA_ADMIN_PASSWORD:?Set GRAFANA_ADMIN_PASSWORD (16+ chars) for the first install}"
  if [ "${#GRAFANA_ADMIN_PASSWORD}" -lt 16 ]; then
    echo "GRAFANA_ADMIN_PASSWORD must be at least 16 characters" >&2
    exit 1
  fi
  kubectl -n monitoring create secret generic grafana-admin \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$GRAFANA_ADMIN_PASSWORD"
fi

kubectl apply -f "$ROOT/monitoring/stack.yaml"
echo "DNS: grafana.cullinos.com → VM IP"
kubectl -n monitoring rollout status deployment/prometheus --timeout=180s || true
kubectl -n monitoring rollout status deployment/grafana --timeout=180s || true
