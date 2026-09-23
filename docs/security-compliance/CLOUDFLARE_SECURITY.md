# Cloudflare / edge protection — owner checklist

**Status:** BLOCKED pending Cloudflare account access. Do not apply country≠IN challenge without product decision.

**Full ordered runbook:** [`EXTERNAL_COMPLIANCE_RUNBOOK.md`](EXTERNAL_COMPLIANCE_RUNBOOK.md) §3 (Cloudflare WAF / rate limits / origin protection). Gap index: [`SECURITY_COMPLIANCE_OPEN_ITEMS.md`](SECURITY_COMPLIANCE_OPEN_ITEMS.md) (`E-CF`).

## Recommended (safe) rules

1. Block URI path containing `/xmlrpc.php` (WordPress probe; Cullinos does not use XML-RPC).
2. Rate-limit `/api/v1/auth/*` (login, OTP, forgot/reset) with Managed Challenge on burst.
3. Rate-limit expensive public endpoints (contact, guest OTP) separately.

## Review before applying

- `ip.src.country != IN` → Managed Challenge: may break international customers/franchise users.
- `HTTP/1.0` block: verify monitoring agents and legacy clients first.

## Origin protection

- Prefer Cloudflare proxy + firewall allowing only Cloudflare IPs to origin 443/80 where feasible.
- Preserve SSH administrative access.
- Reload nginx configs from `infrastructure/nginx/` after review (`api.cullinos.com.conf`, `cullinos-frontends.conf`).
