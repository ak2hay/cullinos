#!/usr/bin/env bash
# Create/update cullinos-secrets in a namespace from a local env file.
# Usage: bash create-secrets.sh production /path/to/secrets.env
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="${1:?namespace required}"
ENV_FILE="${2:?env file required}"
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create secret generic cullinos-secrets \
  --from-env-file="$ENV_FILE" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "Applied cullinos-secrets in $NS"
