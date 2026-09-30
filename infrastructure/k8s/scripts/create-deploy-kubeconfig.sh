#!/usr/bin/env bash
# Create a GitHub Actions deploy identity limited to one namespace and print its kubeconfig
# (base64) for the environment secret KUBE_CONFIG. Run as root on the k3s node. Safe to re-run.
#
# Usage: bash create-deploy-kubeconfig.sh <production|staging>
#   PUBLIC_IP   API server address written into the kubeconfig (default 95.135.254.46)
set -euo pipefail

NS="${1:-}"
if [[ "$NS" != "production" && "$NS" != "staging" ]]; then
  echo "Usage: $0 <production|staging>" >&2
  exit 1
fi
PUBLIC_IP="${PUBLIC_IP:-95.135.254.46}"
SA="github-deployer"
OUT="/root/kube-config-${NS}.b64"
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "==> RBAC for ${SA} in ${NS}"
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${SA}
  namespace: ${NS}
---
apiVersion: v1
kind: Secret
metadata:
  name: ${SA}-token
  namespace: ${NS}
  annotations:
    kubernetes.io/service-account.name: ${SA}
type: kubernetes.io/service-account-token
---
# Everything scripts/k8s-deploy.sh and the deploy workflow touch, in this namespace only.
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${SA}
  namespace: ${NS}
rules:
  - apiGroups: [""]
    resources: [configmaps, secrets, services, persistentvolumeclaims, pods, events]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [""]
    resources: [pods/log]
    verbs: [get]
  - apiGroups: [""]
    resources: [pods/attach]
    verbs: [create, get]
  - apiGroups: [apps]
    resources: [deployments, replicasets]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [batch]
    resources: [jobs, cronjobs]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [networking.k8s.io]
    resources: [networkpolicies, ingresses]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [policy]
    resources: [poddisruptionbudgets]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [traefik.io]
    resources: [middlewares]
    verbs: [get, list, watch, create, update, patch, delete]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${SA}
  namespace: ${NS}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ${SA}
subjects:
  - kind: ServiceAccount
    name: ${SA}
    namespace: ${NS}
---
# The workflow and overlay apply the Namespace object itself; allow that one namespace only.
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ${SA}-namespace-${NS}
rules:
  - apiGroups: [""]
    resources: [namespaces]
    resourceNames: [${NS}]
    verbs: [get, patch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${SA}-namespace-${NS}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ${SA}-namespace-${NS}
subjects:
  - kind: ServiceAccount
    name: ${SA}
    namespace: ${NS}
EOF

echo "==> Waiting for token"
TOKEN=""
for _ in $(seq 1 30); do
  TOKEN="$(kubectl -n "$NS" get secret "${SA}-token" -o jsonpath='{.data.token}' | base64 -d || true)"
  [[ -n "$TOKEN" ]] && break
  sleep 1
done
if [[ -z "$TOKEN" ]]; then
  echo "Token was not issued for ${SA}-token" >&2
  exit 1
fi
CA="$(kubectl -n "$NS" get secret "${SA}-token" -o jsonpath='{.data.ca\.crt}')"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
chmod 600 "$TMP"
cat > "$TMP" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: cullinos
    cluster:
      server: https://${PUBLIC_IP}:6443
      certificate-authority-data: ${CA}
users:
  - name: ${SA}-${NS}
    user:
      token: ${TOKEN}
contexts:
  - name: ${SA}-${NS}
    context:
      cluster: cullinos
      user: ${SA}-${NS}
      namespace: ${NS}
current-context: ${SA}-${NS}
EOF

echo "==> Verifying permissions"
can() { kubectl --kubeconfig "$TMP" auth can-i "$@" 2>/dev/null || true; }
fail=0
for check in "create deployments -n ${NS}" "create jobs -n ${NS}" "create secrets -n ${NS}" "patch namespace/${NS}"; do
  [[ "$(can $check)" == "yes" ]] || { echo "  missing: $check" >&2; fail=1; }
done
for check in "create deployments -n kube-system" "get secrets -n kube-system" "create namespaces" "delete namespace/${NS}"; do
  [[ "$(can $check)" == "no" ]] || { echo "  too broad: $check" >&2; fail=1; }
done
if (( fail )); then
  echo "Permission check failed; KUBE_CONFIG not written." >&2
  exit 1
fi
echo "  ok: scoped to ${NS}"

umask 077
base64 -w0 "$TMP" > "$OUT"
echo ""
echo "Wrote ${OUT} (base64 kubeconfig, mode 600). Store it as the '${NS}' environment secret KUBE_CONFIG, e.g. from your machine:"
echo "  scp root@${PUBLIC_IP}:${OUT} ."
echo "  gh secret set KUBE_CONFIG --env ${NS} < kube-config-${NS}.b64"
echo "then delete the copies: rm kube-config-${NS}.b64 (local) and ${OUT} (VM)."
echo "Revoke later with: kubectl -n ${NS} delete secret ${SA}-token"
