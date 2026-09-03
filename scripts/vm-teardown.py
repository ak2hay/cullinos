#!/usr/bin/env python3
"""One-shot remote teardown for Cullinos VM backend. Run locally — not for CI."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

TEARDOWN_SCRIPT = f"""set -e
if [ -d {APP_DIR} ]; then
  cd {APP_DIR}
  docker compose -f docker-compose.prod.yml down 2>/dev/null || true
fi

for vol in $(docker volume ls -q | grep cullinos || true); do
  docker volume rm "$vol" 2>/dev/null || true
done

rm -f /etc/nginx/sites-enabled/cullinos-api.conf
rm -f /etc/nginx/sites-available/cullinos-api.conf
rm -f /etc/nginx/sites-available/cullinos-api-http.conf
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx
fi

rm -rf {APP_DIR}

docker image prune -a -f 2>/dev/null || true

if command -v certbot >/dev/null 2>&1; then
  certbot delete --cert-name api.cullinos.com --non-interactive 2>/dev/null || true
fi

echo "VM teardown complete"
docker ps -a | grep cullinos || echo "No cullinos containers remain"
"""


def main() -> int:
    if not PASSWORD:
        print("DEPLOY_PASSWORD is required", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    stdin, stdout, stderr = client.exec_command(TEARDOWN_SCRIPT, timeout=600)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode()
    err = stderr.read().decode()
    client.close()

    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
