# Cullinos Compose → k3s cutover checklist

Run during a maintenance window. Keep Cloudflare orange-cloud off or pause during DNS/TLS changes if needed.

## Prerequisites

- [ ] R2 daily + hourly backup succeeded recently (`docs/BACKUP_ROLLBACK.md`)
- [ ] `bash scripts/prod/snapshot-release.sh` on current Compose stack
- [ ] GitHub secrets ready: `KUBE_CONFIG` (base64 kubeconfig with `server: https://95.135.254.46:6443`), `PRODUCTION_APP_SECRETS_ENV`, `STAGING_APP_SECRETS_ENV`, optional `GHCR_PULL_TOKEN`, `SENTRY_DSN`
- [ ] Staging DNS A records created: `staging-api`, `staging-admin`, `staging-manage`, `staging-platform`, `staging-pos`, `staging-kds`, `staging-guest`, `staging-waiter`, `staging` → VM IP
- [ ] Firewall: TCP 80, 443, 6443 (restrict 6443 to GitHub Actions IP ranges if possible)

## Install cluster

```bash
# On VM as root
cd /opt/cullinos && git pull
bash infrastructure/k8s/scripts/install-k3s.sh
```

Port conflict note: k3s Traefik binds **80/443**. Host nginx must stop before Traefik can take traffic:

```bash
systemctl stop nginx   # after staging validate, before prod cutover
# or temporarily move Traefik: edit /etc/rancher/k3s/config.yaml and restart k3s
```

Until cutover, keep Compose + nginx for production; validate **staging** only on high ports or temporarily free 80/443.

### Staging-only Traefik on alternate ports (optional)

If you must keep nginx on 80/443 during soak:

```bash
# /etc/rancher/k3s/config.yaml
# disable traefik temporarily and use NodePort for staging smoke, OR
# stop nginx only during short staging HTTPS tests
```

Preferred path: stop nginx → Traefik owns 80/443 → staging hosts work → migrate DB → switch prod hosts → disable Compose.

## Deploy staging

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl apply -k infrastructure/k8s/overlays/staging
# Or trigger GitHub Action: Deploy Staging
kubectl -n staging get pods
curl -sf https://staging-api.cullinos.com/api/v1/health
```

## Migrate production data

```bash
# Compose still up
bash infrastructure/k8s/scripts/migrate-from-compose.sh
```

## Production cutover

1. `kubectl apply -k infrastructure/k8s/overlays/production` (or Deploy Production workflow)
2. Apply secrets from GitHub / `kubectl create secret generic cullinos-secrets ...`
3. `kubectl -n production exec deploy/api -- npx prisma db push --schema=packages/prisma/prisma/schema.prisma`
4. Confirm `kubectl -n production get ingress` and Traefik routes
5. Point existing prod DNS (already on VM) through Traefik; disable host nginx
6. Stop Compose: `cd /opt/cullinos && docker compose -f docker-compose.prod.yml down` (keep volumes until soak period ends)
7. Monitor Grafana + Sentry + uptime workflow for 24–48h
8. After soak: remove Compose volumes only if intentional

## Rollback

- **App only:** Redeploy previous image tag via `Deploy Production` workflow_dispatch (`image_tag=<sha>`).
- **Full Compose restore:** Start nginx + `docker compose -f docker-compose.prod.yml up -d`, restore DB from R2 if needed (`docs/BACKUP_ROLLBACK.md`).
