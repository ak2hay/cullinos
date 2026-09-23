# External Compliance Runbook

**Purpose:** Step-by-step guide for Rkyves/Cullinos **owner and ops** to close external security, DNS, SEO, store, and legal gaps.  
**Gap index:** [`SECURITY_COMPLIANCE_OPEN_ITEMS.md`](SECURITY_COMPLIANCE_OPEN_ITEMS.md) (Section B).  
**Do not** invent credentials, disable MFA to “make it work,” or mark legal items VERIFIED without evidence.

Recommended order (launch risk): **§1 → §2 → §3 → §4 → §5 → §6**, then SEO (§7), then legal/store (§8–§11), then pen-test (§12).

---

## 1. Production secrets & SMTP

### Goal
API boots in production with MFA email OTP enabled; secrets are strong and non-placeholder.

### Prerequisites
- VM or host with production `.env`
- Working transactional SMTP (e.g. Brevo) that can deliver to staff inboxes

### Steps
1. On the production host, open `.env` (never commit it).
2. Confirm:
   - `NODE_ENV=production`
   - `AUTH_SKIP_EMAIL_OTP=false` (or unset)
   - `JWT_SECRET` ≥ 32 chars, not starting with `change-me` / `dev-secret`
   - `ENCRYPTION_KEY` set (64-char hex or strong passphrase)
   - `INTERNAL_API_KEY` non-placeholder
   - `CORS_ORIGINS` explicit allowlist (no `*`)
3. Set SMTP:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` (prefer `mail.yourdomain.com` identity)
4. Restart API; confirm it **starts** (boot asserts fail if OTP skip or weak secrets).
5. Log in as a staff user and complete **email OTP** end-to-end.

### Verification
- [ ] API process stays up after restart
- [ ] Login requires OTP in production
- [ ] OTP email arrives; login succeeds

### Evidence
Record date + “SMTP MFA verified” in ops notes; keep secrets out of git.

### Related paths
- [`apps/api/src/common/cors.util.ts`](../../apps/api/src/common/cors.util.ts) — `assertProductionSecurityConfig`
- [`.env.production.example`](../../.env.production.example)

---

## 2. Deploy/reload nginx security headers

### Goal
Live edge serves HSTS, security headers, API `limit_req`, and SPA asset caching from repo configs.

### Prerequisites
- SSH to production VM
- Repo configs reviewed: `infrastructure/nginx/api.cullinos.com.conf`, `cullinos-frontends.conf`

### Steps
1. Diff live nginx site files against repo under `infrastructure/nginx/`.
2. Copy updated configs to `/etc/nginx/sites-available/` (or your install path).
3. `sudo nginx -t`
4. `sudo systemctl reload nginx` (or `service nginx reload`)
5. Curl checks:
   ```bash
   curl -sI https://api.cullinos.com/api/v1/health | grep -i strict-transport
   curl -sI https://admin.cullinos.com/ | grep -i content-security-policy
   ```

### Verification
- [ ] `nginx -t` OK and reload succeeded
- [ ] API responses include `Strict-Transport-Security` (or are behind CF that adds HSTS)
- [ ] SPA responses include security headers / CSP as configured

### Evidence
Ops note: date, hostname, `nginx -t` output summary.

### Related paths
- [`infrastructure/nginx/api.cullinos.com.conf`](../../infrastructure/nginx/api.cullinos.com.conf)
- [`infrastructure/nginx/cullinos-frontends.conf`](../../infrastructure/nginx/cullinos-frontends.conf)
- [`DEPLOYMENT.md`](../DEPLOYMENT.md)

---

## 3. Cloudflare WAF / rate limits / origin protection

### Goal
Edge absorbs floods and challenges abusive auth traffic without locking out legitimate users.

**Full ordered runbook for this area:** this section. Short checklist also in [`CLOUDFLARE_SECURITY.md`](CLOUDFLARE_SECURITY.md).

### Prerequisites
- Cloudflare account with Cullinos zones proxied (orange cloud) where intended
- Ability to edit WAF / Rate limiting / Firewall rules

### Steps
1. Confirm DNS for `api`, `admin`, `cullinos.com`, etc. is proxied as designed.
2. **Safe rules (apply):**
   - Block URI path contains `/xmlrpc.php`
   - Rate limit `/api/v1/auth/*` (login, OTP, forgot/reset) — Managed Challenge on burst
   - Rate limit contact form / guest OTP endpoints separately (tune after observing traffic)
3. **Origin protection:** restrict origin firewall so public 80/443 prefer Cloudflare IPs; keep SSH for admins.
4. **Product decision — record explicitly:**
   - [ ] **Do not** enable `ip.src.country != IN` → Managed Challenge unless product confirms international users are out of scope
   - [ ] HTTP/1.0 block only after checking monitoring agents
5. Watch Analytics / Security events for 24–48h; tune thresholds.

### Verification
- [ ] xmlrpc rule active
- [ ] Auth rate limit active and not blocking normal staff login
- [ ] Country≠IN decision written in evidence notes (enabled **or** explicitly rejected)

### Evidence
Screenshot or rule IDs + date in ops notes; update open-items `E-CF` when done.

### Related paths
- [`CLOUDFLARE_SECURITY.md`](CLOUDFLARE_SECURITY.md)
- [`DEPLOYMENT.md`](../DEPLOYMENT.md)

---

## 4. Backup restore drill

### Goal
Prove recovery works — not only that backups are created.

### Prerequisites
- Backups already writing (see [`BACKUP_ROLLBACK.md`](../BACKUP_ROLLBACK.md))
- Maintenance window or non-prod restore target preferred

### Steps
1. Confirm last backup status:
   ```bash
   cat /var/backups/cullinos/LAST_BACKUP.json
   ```
2. On an authorized environment, run restore for a known date:
   ```bash
   bash /opt/cullinos/scripts/prod/restore-backup.sh YYYY-MM-DD
   ```
   (Type `RESTORE` when prompted; prefer staging if available.)
3. Verify API health and spot-check one org’s data after restore.
4. If only app rollback needed (DB fine), practice:
   ```bash
   bash /opt/cullinos/scripts/prod/rollback.sh --list
   ```
5. Record restore duration and any issues.

### Verification
- [ ] Restore completed without secret leakage in logs
- [ ] Health endpoints OK after restore
- [ ] Date recorded below

### Evidence
| Field | Value |
|---|---|
| Drill date | |
| Backup id / date restored | |
| Environment (prod/staging) | |
| Outcome | |
| Operator | |

Also note in [`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md) / ops log.

### Related paths
- [`BACKUP_ROLLBACK.md`](../BACKUP_ROLLBACK.md)

---

## 5. Email DNS (transactional vs marketing)

### Goal
Isolate reputation: transactional on `mail.*`, marketing on `news.*`, with SPF/DKIM/DMARC.

### Prerequisites
- DNS access for the apex domain
- SMTP provider dashboards (e.g. Brevo) for DKIM records
- App already supports `SMTP_FROM_EMAIL` and `SMTP_MARKETING_FROM_EMAIL`

### Steps
1. Create / confirm sending domains:
   - Transactional: e.g. `mail.cullinos.com` (or provider subdomain)
   - Marketing: e.g. `news.cullinos.com`
2. In SMTP provider, verify both domains; copy SPF/DKIM/DMARC records into DNS.
3. Set production env:
   - `SMTP_FROM_EMAIL` → transactional address
   - `SMTP_MARKETING_FROM_EMAIL` → marketing address
4. Send one OTP (transactional) and one promo (marketing); confirm From headers and inbox placement.
5. Check DMARC aggregate reports after a few days.

### Verification
- [ ] DNS records publish (`dig TXT` / provider “verified”)
- [ ] OTP From ≠ promo From (or documented intentional fallback)
- [ ] Unsubscribe still works on marketing mail

### Evidence
Date + domain names verified; provider screenshot optional.

### Related paths
- [`apps/api/src/modules/mail/mail.service.ts`](../../apps/api/src/modules/mail/mail.service.ts)
- Platform config keys `SMTP_MARKETING_FROM_*`

---

## 6. Monitoring (Sentry)

### Goal
Capture production API/web errors with alerts (beyond `/health`).

**Chosen path:** [Sentry](https://sentry.io) (free tier is enough to start). Alternatives (Datadog, etc.) are fine if already licensed — record DSN location the same way.

### Prerequisites
- Sentry org/project
- Ability to set production env vars and redeploy

### Steps
1. Create Sentry projects: `cullinos-api`, `cullinos-web` (optional: admin SPA later).
2. Copy DSNs into production secrets (e.g. `SENTRY_DSN` for API; `NEXT_PUBLIC_SENTRY_DSN` only if browser SDK is intentionally public).
3. Wire SDKs in a follow-up engineering task if not already present; until then, at minimum configure uptime checks (Cloudflare / UptimeRobot) on:
   - `https://api.cullinos.com/api/v1/health`
   - `https://cullinos.com/`
4. Set alert: email/Slack on new issue + downtime.
5. Trigger a test error in staging; confirm alert fires.

### Verification
- [ ] Uptime check green for 24h
- [ ] (If Sentry wired) test event visible in project
- [ ] On-call destination documented

### Evidence
Project URLs + alert channel; date enabled.

### Related paths
- [`apps/api/src/health.controller.ts`](../../apps/api/src/health.controller.ts)
- [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md)

---

## 7. Google Search Console, Bing, Google Business Profile

### Goal
Marketing site discoverable and monitored for indexing issues.

### Prerequisites
- Access to `cullinos.com` DNS or HTML file upload
- Business identity for GBP (if applicable)

### Steps
1. **Google Search Console:** add `https://cullinos.com`, verify (DNS TXT or HTML), submit `https://cullinos.com/sitemap.xml`.
2. **Bing Webmaster Tools:** import from GSC or verify separately; submit sitemap.
3. **Google Business Profile:** claim/update only if Rkyves has a physical location / local business listing that applies.
4. Confirm `robots.txt` allows crawl; `llms.txt` is reachable at `/llms.txt`.

### Verification
- [ ] GSC property verified; sitemap processed
- [ ] Bing property verified
- [ ] GBP claimed **or** recorded N/A with reason

### Evidence
Dates in marketing ops notes; open-items `E-SEO-ACCOUNTS`.

### Related paths
- [`apps/web/src/app/sitemap.ts`](../../apps/web/src/app/sitemap.ts)
- [`apps/web/public/llms.txt`](../../apps/web/public/llms.txt)

---

## 8. Legal counsel review (ToS / Privacy / DPDP)

### Goal
Published policies match real processing; DPDP obligations assessed for India-facing products.

### Prerequisites
- Counsel or qualified privacy advisor
- Current pages: `/terms`, `/privacy`
- Inventory in requirements MD §1 + this repo’s privacy module behavior

### Steps
1. Export / share with counsel:
   - Live Privacy + Terms URLs
   - Personal-data inventory (requirements MD §1)
   - Sub-processors: Firebase, MSG91, Razorpay, Cashfree, Cloudflare, SMTP provider, R2
   - [`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md) open questions
2. Walk through signup, OTP, ordering, marketing unsubscribe, export/erase flows.
3. Update policy text if counsel requires changes (engineering PR).
4. Document breach notification jurisdiction timelines into [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md).
5. Counsel signs off in writing (email PDF attached to evidence register).

### Verification
- [ ] Written counsel review dated
- [ ] Policy diffs merged if required
- [ ] Open questions in evidence register closed or deferred with owners

### Evidence
Fill rows in [`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md): ToS, Privacy, Legal review record, DPDP notes.

### Related paths
- [`apps/web/src/app/privacy/page.tsx`](../../apps/web/src/app/privacy/page.tsx)
- [`apps/api/src/modules/privacy/`](../../apps/api/src/modules/privacy/)

---

## 9. Trademark / IP search

### Goal
Reduce brand conflict risk for “Cullinos” / “Rkyves” before heavy marketing spend.

### Prerequisites
- Owner or IP attorney
- Target markets list (at least India)

### Steps
1. Search [IP India](https://www.ipindia.gov.in/) trademark resources for Cullinos / Rkyves (and logos).
2. Search Google Play / App Store / web for confusingly similar names.
3. Confirm commercial licenses for fonts, stock images, templates used on marketing + apps.
4. Review third-party OSS licenses for redistribution obligations (`package-lock` / Flutter deps).
5. Store notes (date, search terms, outcome) — do **not** treat domain availability as trademark clearance.

### Verification
- [ ] Search notes filed with date
- [ ] Asset license list attached or linked
- [ ] Open conflicts escalated to counsel if any

### Evidence
[`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md) rows: Trademark / IP search; Asset / software licenses.

---

## 10. Google Play / App Store data declarations

### Goal
Store listings match actual SDK data collection for the guest app.

### Prerequisites
- Play Console (and App Store Connect if iOS ships)
- SDK inventory (Firebase, FCM, etc.)

### Steps
1. Complete technical checklist: [`PLAY_STORE_CHECKLIST.md`](../guest-app/PLAY_STORE_CHECKLIST.md).
2. Audit installed SDKs (not only first-party code).
3. Fill Play **Data safety** form consistently with `/privacy`.
4. If iOS: create Privacy Nutrition Labels / PrivacyInfo as required.
5. Keep Privacy Policy URL stable and linked from the store listing.

### Verification
- [ ] Data safety form submitted / published
- [ ] Policy URL live and consistent
- [ ] iOS privacy labels done **or** N/A documented

### Evidence
[`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md): Google Play Data Safety; Apple App Privacy.

### Related paths
- [`PLAY_STORE_CHECKLIST.md`](../guest-app/PLAY_STORE_CHECKLIST.md)
- [`apps/guest/`](../../apps/guest/)

---

## 11. Children’s privacy product decision

### Goal
Document whether the guest/ordering product is directed at children and what controls apply.

### Prerequisites
- Product owner decision
- Counsel input if targeting minors or collecting child data

### Steps
1. Answer: Is the guest app / order flow **directed to children** under applicable law? (Yes / No / Unclear)
2. If **No**: write short applicability note (age range, marketing, design) and store in evidence register → may be `NOT APPLICABLE — JUSTIFIED` with counsel concurrence.
3. If **Yes** or **Unclear**: engage counsel; decide age-gate / parental consent; open engineering ticket for gate UI.
4. Align `/privacy` children’s section with the decision.

### Verification
- [ ] Written decision dated (N/A justified **or** controls planned)
- [ ] Privacy page updated if needed

### Evidence
[`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md): Children’s privacy applicability.

---

## 12. Final security testing / pen-test

### Goal
Independent validation of Priority 0–2 controls in a production-like environment.

### Prerequisites
- §§1–4 substantially complete (secrets, nginx, Cloudflare, restore)
- Written authorization for the test scope and target hosts
- **Never** run unauthorized flood/k6 against third-party infrastructure

### Steps
1. Define scope: API (`api.cullinos.com`), admin/customer SPAs, auth, webhooks, tenant isolation.
2. Hire or schedule internal security review / pen-test with rules of engagement.
3. Provide tester accounts (non-production data preferred) + out-of-band contact.
4. Fix critical/high findings; retest.
5. Archive report (access-controlled); update requirements MD Final security testing status.

### Verification
- [ ] Report received
- [ ] Critical/high closed or accepted with risk owners
- [ ] Requirements MD “Final security testing” updated

### Evidence
Report location (secure drive); date; remediations linked to PRs.

### Related paths
- Requirements MD §44 Final Pre-Launch Gate
- [`SECURITY_COMPLIANCE_OPEN_ITEMS.md`](SECURITY_COMPLIANCE_OPEN_ITEMS.md)

---

## Quick checklist (owner)

- [ ] §1 SMTP + MFA production
- [ ] §2 Nginx reload
- [ ] §3 Cloudflare (safe rules + country decision recorded)
- [ ] §4 Restore drill dated
- [ ] §5 Email DNS
- [ ] §6 Monitoring / uptime
- [ ] §7 GSC / Bing / GBP
- [ ] §8 Counsel ToS/Privacy/DPDP
- [ ] §9 Trademark / IP
- [ ] §10 Store declarations
- [ ] §11 Children’s decision
- [ ] §12 Pen-test / final security test
