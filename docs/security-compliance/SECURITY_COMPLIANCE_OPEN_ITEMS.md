# Security & Compliance — Open Items

**Purpose:** Single list of what is still missing after the Priority 0–5 security pass and Legal Guide reconciliation.  
**Source of truth for statuses:** [`Rkyves_Security_Compliance_Master_Requirements.md`](../../Rkyves_Security_Compliance_Master_Requirements.md) §1.  
**How to finish external work:** [`EXTERNAL_COMPLIANCE_RUNBOOK.md`](EXTERNAL_COMPLIANCE_RUNBOOK.md).  
**Legal evidence slots:** [`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md).

Status vocabulary: `NOT STARTED` | `IN PROGRESS` | `IMPLEMENTED — NOT VERIFIED` | `VERIFIED` | `BLOCKED` | `NOT APPLICABLE — JUSTIFIED`

---

## How to use this document

| Audience | Use |
|---|---|
| Engineering | Section A — implement in-repo; update status in requirements MD when done + tested |
| Owner / ops / counsel | Section B — follow the runbook; record evidence dates |
| AI coding agents | Prefer Section A for code; never invent credentials or mark legal items `VERIFIED` without evidence |

---

## A. Code-level gaps (engineering can fix in this repo)

| ID | Gap | Why it matters | Suggested approach / files | Status |
|---|---|---|---|---|
| C-IDOR-SWEEP | Residual IDOR / BOLA coverage | Not every mutating controller has `@RequirePermissions` + org-scoped tests | Audit controllers under `apps/api/src/modules/*`; extend `org-scope.util.ts` usage; add cross-tenant negative tests | IMPLEMENTED — NOT VERIFIED (helpers exist; full sweep residual) |
| C-LOGIN-REDIS | Login backoff is in-memory only | Multi-instance API loses shared failure counters | Store buckets in Redis (same as throttler); keep progressive delay, no permanent lockout | IMPLEMENTED — NOT VERIFIED (in-memory); Redis upgrade NOT STARTED |
| C-UPLOAD-MAGIC | Uploads trust client MIME | MIME spoofing can bypass type checks | Magic-byte sniff in `marketing-upload.service.ts` after SVG ban | NOT STARTED |
| C-CSP-TIGHTEN | Marketing CSP allows `unsafe-inline` / `unsafe-eval` | Weakens XSS defenses | Tighten `apps/web/next.config.ts` CSP; test Turnstile/analytics | IMPLEMENTED — NOT VERIFIED (CSP present but loose) |
| C-AUDIT-AUTHZ | Authz denials / webhook sig failures not fully audited | Harder to detect abuse | Log in `PermissionsGuard` / payment webhook reject paths via `AuditService` | NOT STARTED (auth login events exist) |
| C-A11Y | No axe CI / WCAG program | Legal Guide §48.2.6; launch risk | Skip-link + axe in CI for `apps/web`; document scope in evidence register | IMPLEMENTED — NOT VERIFIED (ad-hoc aria/alt only) |
| C-SDK-INVENTORY | Third-party SDK inventory incomplete | Store declarations / DPDP vendor review | Document guest Flutter + web + API deps (Firebase, MSG91, Razorpay, Cashfree, CF) into evidence register | IN PROGRESS |
| C-REFRESH-E2E | `/auth/refresh` lacks E2E | Refresh rotation may break clients silently | Add API/integration or Playwright auth refresh path | IMPLEMENTED — NOT VERIFIED (endpoint exists) |
| C-CI-SECURITY-RUN | Security workflow not confirmed green | Dependabot/CodeQL/`npm audit` may fail on first run | Run `.github/workflows/security.yml` on GitHub; fix audit findings | IMPLEMENTED — NOT VERIFIED (workflow present) |
| C-TOKEN-STORAGE | Bearer tokens in browser storage | XSS can steal sessions | Document residual; longer-term HttpOnly cookie migration (POS/offline impact) | IMPLEMENTED — NOT VERIFIED (documented residual) |
| C-REQUIRE-PERMS | Sparse RBAC on some modules | Vertical privilege escalation | Expand `@RequirePermissions` beyond users/pos/inventory/coupons/reports | IN PROGRESS |

**Out of code scope here:** Cloudflare UI, DNS, counsel, Play Console, GSC — see Section B.

---

## B. External gaps (owner / counsel / cloud / DNS / stores)

| ID | Gap | Blocker | Runbook section |
|---|---|---|---|
| E-SMTP-PROD | Production SMTP + MFA (`AUTH_SKIP_EMAIL_OTP=false`) | SMTP credentials / deliverability | [§1 Production secrets & SMTP](EXTERNAL_COMPLIANCE_RUNBOOK.md#1-production-secrets--smtp) |
| E-NGINX | Deploy/reload hardened nginx configs | VM access | [§2 Nginx reload](EXTERNAL_COMPLIANCE_RUNBOOK.md#2-deployreload-nginx-security-headers) |
| E-CF | Cloudflare WAF, rate limits, origin protection | Cloudflare account | [§3 Cloudflare](EXTERNAL_COMPLIANCE_RUNBOOK.md#3-cloudflare-waf--rate-limits--origin-protection) |
| E-RESTORE | Backup **restore** drill (not only backup create) | Staging/prod maintenance window | [§4 Backup restore drill](EXTERNAL_COMPLIANCE_RUNBOOK.md#4-backup-restore-drill) |
| E-EMAIL-DNS | SPF/DKIM/DMARC for `mail.*` and `news.*` | DNS access | [§5 Email DNS](EXTERNAL_COMPLIANCE_RUNBOOK.md#5-email-dns-transactional-vs-marketing) |
| E-MONITOR | APM / error monitoring (e.g. Sentry) | Account + DSN | [§6 Monitoring](EXTERNAL_COMPLIANCE_RUNBOOK.md#6-monitoring-sentry) |
| E-SEO-ACCOUNTS | Google Search Console, Bing Webmaster, GBP | Accounts | [§7 SEO accounts](EXTERNAL_COMPLIANCE_RUNBOOK.md#7-google-search-console-bing-google-business-profile) |
| E-COUNSEL | DPDP + ToS/Privacy match-to-processing | Counsel | [§8 Legal counsel](EXTERNAL_COMPLIANCE_RUNBOOK.md#8-legal-counsel-review-tos--privacy--dpdp) |
| E-TM | Trademark / IP search (India + markets) | Owner / attorney | [§9 Trademark](EXTERNAL_COMPLIANCE_RUNBOOK.md#9-trademark--ip-search) |
| E-STORE | Play Data Safety / App Privacy declarations | Store consoles | [§10 Store declarations](EXTERNAL_COMPLIANCE_RUNBOOK.md#10-google-play--app-store-data-declarations) |
| E-CHILDREN | Children’s privacy / age-gate product decision | Product decision | [§11 Children’s privacy](EXTERNAL_COMPLIANCE_RUNBOOK.md#11-childrens-privacy-product-decision) |
| E-PENTEST | Final security testing / authorized pen-test | Schedule + scope | [§12 Final security test](EXTERNAL_COMPLIANCE_RUNBOOK.md#12-final-security-testing--pen-test) |
| E-CF-COUNTRY | Country ≠ IN Managed Challenge | Product decision (intl users?) | Recorded under [§3](EXTERNAL_COMPLIANCE_RUNBOOK.md#3-cloudflare-waf--rate-limits--origin-protection) — do **not** enable blindly |

All Section B items are currently **BLOCKED** or **IN PROGRESS** until the runbook verification checkbox is completed and evidence is dated.

---

## Already done in code (do not re-open without regression)

For context, these were implemented in the security pass (many remain **IMPLEMENTED — NOT VERIFIED** pending prod checks):

- Production hard-block of `AUTH_SKIP_EMAIL_OTP`
- Central `getJwtSecret()` fail-closed in production
- Swagger disabled in production
- SVG upload ban + multer size limits
- Aggregator webhook secret masking + regenerate
- Timing-safe `INTERNAL_API_KEY` compare
- Login progressive backoff + auth audit events
- `POST /auth/refresh`
- Cashfree webhook timestamp replay window
- API/SPA nginx HSTS/headers/`limit_req` (in repo)
- `ENCRYPTION_KEY` required in production
- Dependabot + security GitHub workflow
- `llms.txt`, marketing SEO surfaces, SPA `noindex`, marketing From separation
- Privacy module (consent / export / erase / retention)

---

## Update rules

1. After finishing a **code** item: add/adjust tests, then update this table + requirements MD status register.  
2. After finishing an **external** item: fill the evidence date in [`LEGAL_EVIDENCE_REGISTER.md`](LEGAL_EVIDENCE_REGISTER.md) (or ops notes) and only then change status toward `VERIFIED`.  
3. Never mark legal / DPDP / trademark / store declarations `VERIFIED` from page presence alone.
