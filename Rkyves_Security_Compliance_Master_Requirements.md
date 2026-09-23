# Rkyves Security, Compliance, Privacy & Website Launch Master Requirements

**Document purpose:** Implementation reference for Rkyves websites, applications, SaaS products, APIs, infrastructure, CI/CD pipelines, AI features, and multi-tenant systems.

**Primary use:** This file is intended to be placed in the project repository/project files so an AI coding assistant such as Cursor can read it and use it as an implementation checklist.

**Status:** Implementation in progress (reconciled 2026-09-19). Security Priority 0–3 controls exist in code with unit-test evidence where noted. Legal Guide items (§48) assessed against codebase; counsel review remains BLOCKED. Do not mark legal items VERIFIED without evidence.

**Open items & external runbook:** [`docs/security-compliance/`](docs/security-compliance/README.md) — [`OPEN_ITEMS`](docs/security-compliance/SECURITY_COMPLIANCE_OPEN_ITEMS.md) · [`RUNBOOK`](docs/security-compliance/EXTERNAL_COMPLIANCE_RUNBOOK.md) · [`EVIDENCE`](docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md)

> **Important implementation rule:** Do not mark a requirement as complete merely because code exists. A requirement is complete only after the implementation has been reviewed and, where applicable, tested in a production-like environment.

---



## 1. Current Status


| Area                                   | Status                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Requirements collection                | Complete                                                                   |
| Priority 0 — Critical exposure         | IMPLEMENTED — NOT VERIFIED (unit tests for key locks; prod deploy pending) |
| Priority 1 — Auth / abuse              | IMPLEMENTED — NOT VERIFIED                                                 |
| Priority 2 — Infra / headers / backups | IMPLEMENTED — NOT VERIFIED (Cloudflare/restore BLOCKED)                    |
| Priority 3 — CI/CD / AI                | IMPLEMENTED — NOT VERIFIED (AI runtime N/A)                                |
| Priority 4 — Website / SEO             | Partial — marketing pages exist; GSC/Bing/GBP BLOCKED                      |
| Priority 5 — DPDP (technical)          | IMPLEMENTED — NOT VERIFIED; legal sign-off BLOCKED                         |
| Legal / app-builder launch (§48)       | Partially implemented in product surfaces; counsel / store / TM BLOCKED    |
| Email subdomain separation             | IMPLEMENTED — NOT VERIFIED (DNS BLOCKED)                                   |
| Final security testing                 | Not started (production)                                                   |
| Final compliance sign-off              | BLOCKED — counsel required                                                 |




### Requirement Status Register

Statuses: `NOT STARTED` | `IN PROGRESS` | `IMPLEMENTED — NOT VERIFIED` | `VERIFIED` | `BLOCKED` | `NOT APPLICABLE — JUSTIFIED`


| ID                | Status                     | Location                                          | Verification     | Blocker                       |
| ----------------- | -------------------------- | ------------------------------------------------- | ---------------- | ----------------------------- |
| P0-AUTH_SKIP      | VERIFIED                   | `apps/api/src/common/cors.util.ts`                | Unit tests       | None                          |
| P0-JWT-secret     | VERIFIED                   | `apps/api/src/common/jwt-secret.util.ts`          | Unit tests       | None                          |
| P0-Swagger        | IMPLEMENTED — NOT VERIFIED | `apps/api/src/main.ts`                            | Code review      | Deploy check                  |
| P0-SVG-upload     | VERIFIED                   | `marketing-upload.service.ts`                     | Unit tests       | None                          |
| P0-IDOR           | VERIFIED                   | `org-scope.util.ts`                               | Unit tests       | Residual controller sweep     |
| P0-XSS-theme      | VERIFIED                   | `MarketingThemeStyles.tsx`                        | Unit tests       | None                          |
| P1-login-backoff  | VERIFIED                   | `auth.service.ts`                                 | Unit tests       | Multi-node Redis residual     |
| P1-refresh        | IMPLEMENTED — NOT VERIFIED | `POST /auth/refresh`                              | Code             | E2E                           |
| P1-webhook-replay | VERIFIED                   | Cashfree 5m window                                | Unit tests       | None                          |
| P2-API-headers    | IMPLEMENTED — NOT VERIFIED | `infrastructure/nginx/api.cullinos.com.conf`      | Config           | Nginx reload                  |
| P2-ENCRYPTION_KEY | VERIFIED                   | `cors.util.ts`, `privacy.crypto.ts`               | Unit tests       | None                          |
| P2-Cloudflare     | BLOCKED                    | `docs/security-compliance/CLOUDFLARE_SECURITY.md` | —                | Account access                |
| P2-restore-drill  | BLOCKED                    | `docs/BACKUP_ROLLBACK.md`                         | —                | Owner drill                   |
| P3-CI-security    | IMPLEMENTED — NOT VERIFIED | `.github/workflows/security.yml`, Dependabot      | Workflow present | First CI run                  |
| P3-AI-runtime     | NOT APPLICABLE — JUSTIFIED | No runtime LLM                                    | —                | Enable AI later               |
| P3-llms.txt       | IMPLEMENTED — NOT VERIFIED | `apps/web/public/llms.txt`                        | File present     | Prod fetch                    |
| P4-marketing      | IMPLEMENTED — NOT VERIFIED | `apps/web` (robots/sitemap/OG/404/cookie)         | Pages exist      | Prod crawl                    |
| P4-GSC-Bing-GBP   | BLOCKED                    | External                                          | —                | Accounts                      |
| Email-DNS         | BLOCKED                    | `SMTP_MARKETING_FROM_*`                           | Code ready       | SPF/DKIM/DMARC                |
| DPDP-technical    | IMPLEMENTED — NOT VERIFIED | `apps/api/src/modules/privacy/`                   | Privacy module   | Counsel                       |
| DPDP-legal        | BLOCKED                    | —                                                 | —                | Legal review                  |
| L-ToS             | IMPLEMENTED — NOT VERIFIED | `apps/web/src/app/terms`                          | Page exists      | Counsel review                |
| L-Privacy         | IMPLEMENTED — NOT VERIFIED | `apps/web/src/app/privacy`                        | Page exists      | Counsel + match-to-processing |
| L-Cookie          | IMPLEMENTED — NOT VERIFIED | `CookieBanner.tsx`                                | Code             | Counsel                       |
| L-TM-IP           | BLOCKED                    | Evidence register stub                            | —                | Owner trademark search        |
| L-Store           | IN PROGRESS                | `docs/guest-app/PLAY_STORE_CHECKLIST.md`          | Partial          | Play/App Store submission     |
| L-Children        | BLOCKED                    | Policy text only                                  | —                | Product age-gate decision     |
| L-Email-mkt       | IMPLEMENTED — NOT VERIFIED | unsubscribe + marketing From                      | Code             | Consent evidence audit        |
| L-AI-disclose     | NOT APPLICABLE — JUSTIFIED | No user-facing AI output yet                      | —                | Reassess when AI ships        |
| L-A11y            | IMPLEMENTED — NOT VERIFIED | Ad-hoc aria / alt                                 | Partial          | axe CI + WCAG assessment      |
| L-Payment-IAP     | NOT APPLICABLE — JUSTIFIED | Guest payments via Razorpay/Cashfree web, not IAP | Documented       | Reassess if IAP added         |
| L-Evidence        | IN PROGRESS                | `docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md` | Stub             | Fill evidence slots           |




### Personal data inventory (DPDP — technical)


| Data                             | Collected via       | Purpose                     | Retention note                         |
| -------------------------------- | ------------------- | --------------------------- | -------------------------------------- |
| Staff email, name, password hash | Admin auth          | Access / MFA                | Active account + audit                 |
| Customer/guest phone, name       | OTP / guest app     | Ordering, loyalty           | Erasure APIs + retention job           |
| Order / payment metadata         | POS / online        | Fulfillment, billing        | Business records; PII redacted in logs |
| Consent records                  | Privacy APIs        | Notice + purpose limitation | Audit trail                            |
| Guest ID document (encrypted)    | Hospitality         | Check-in                    | `ENCRYPTION_KEY` required in prod      |
| Marketing prefs                  | Promo / unsubscribe | Marketing with consent      | Unsubscribe tokens                     |


Grievance: `privacy@rkyves.com`. Incident stub: `docs/security-compliance/INCIDENT_RESPONSE.md`.

---



# 2. Website Credibility Checklist

1. Custom 404 page — branded error page instead of a default server error.
2. CTA above the fold — clear call-to-action visible without scrolling.
3. Unique meta title for every page.
4. Unique meta description for every page.
5. Open Graph image configured for social previews.
6. Favicon configured.
7. `robots.txt` configured.
8. `sitemap.xml` configured.
9. Image alt text.
10. Responsive mobile breakpoints.
11. Sticky mobile CTA.
12. Loading states.
13. Form error states.
14. Post-submission thank-you page.
15. Privacy Policy.
16. Terms of Service.
17. Cookie banner.
18. Analytics.
19. Real business/contact address or legitimate contact information.

---



# 3. Website Launch Checklist



## Technical & SEO Basics

1. Remove horizontal scrolling.
2. Add meta descriptions.
3. Add favicon.
4. Fix page titles.
5. Compress images.
6. Make email addresses clickable with `mailto:` links.
7. Fix broken links.



## Mobile & Usability

1. Add a mobile menu.
2. Remove placeholder text such as Lorem Ipsum.
3. Test on a physical mobile device.
4. Create an empty-state page for no content/data.
5. Optimize layouts for mobile screens.
6. Fix mobile overflow issues.



## Feedback & Error Handling

1. Add error messages for failed user actions.
2. Add success messages for completed actions.
3. Create a custom 404 error page.
4. Make phone numbers clickable with `tel:` links.

---



# 4. SEO, Search & AI-Search Setup

1. Set up and verify Google Search Console.
2. Submit and monitor `sitemap.xml`.
3. Install Google Analytics.
4. Set up and verify Bing Webmaster Tools.
5. Create and maintain `llms.txt`.
6. Implement Open Graph tags/images.
7. Perform SEO setup across pages.
8. Optimize content for AI answers using clear sections, bullet points, direct Q&A formats, and conversational phrasing.
9. Fix page-speed issues.
10. Compress large images.
11. Target relevant long-tail keywords.
12. Add descriptive image alt text.
13. Build relevant internal links.
14. Promote relevant pages through social media and appropriate industry/community channels.
15. Claim/update Google Business Profile where applicable to the business and location.

---



# 5. Performance & Caching

1. Configure caching as part of production readiness.
2. Cache static assets such as images, CSS, JavaScript, fonts, and versioned files.
3. Edge-cache suitable public pages where appropriate.
4. Use caching to reduce repeated application and database work.
5. Ensure cache invalidation/versioning is safe when assets or content change.
6. Avoid caching private/user-specific responses in shared/public caches.
7. Review CDN and origin cache behavior before production launch.

---



# 6. Email Architecture

Use separate subdomains for transactional application email and marketing/broadcast email.

## Transactional / App Email

Example: `mail.yourdomain.com`

Use for:

- Invoices
- Billing
- Signups
- Password resets
- Other transactional application messages



## Marketing Email

Example: `news.yourdomain.com`

Use for:

- Newsletters
- Promotional campaigns
- Bulk/broadcast messages



## Security / Reputation Objective

- Isolate marketing deliverability problems from critical transactional mail.
- Prevent high-volume promotional sending behavior from damaging the reputation of transactional application email.
- Keep transactional and marketing sending infrastructure logically separated.

---



# 7. Core Security Checks — 1–18

1. Exposed DB credentials / open DB permissions — prevent unauthorized database access.
2. Public `.env` files / hardcoded secrets — keep API keys and tokens out of source code.
3. Weak authentication / missing authorization checks — enforce authentication and authorization.
4. Cross-user access — users must only access their own data.
5. Cloud service misconfiguration — secure cloud storage and API endpoints.
6. Unprotected admin routes — restrict administrative panels.
7. Exposed production debug tools — disable debugging features in production.
8. Logs leak secrets — sanitize log outputs.
9. Verbose production errors — return generic user-facing errors.
10. Secrets in Git / JavaScript — scan repositories and client bundles.
11. Client-only security — enforce security decisions on the server.
12. Input validation — validate/sanitize inputs to prevent SQL and NoSQL injection.
13. Force HTTPS.
14. Hash passwords with strong password hashing.
15. Bot protection.
16. Session expiry.
17. Expiring password-reset links/tokens.
18. Safe logging and database least privilege.

---



# 8. Input & Injection — 19–23

1. **XSS** — prevent malicious script injection in browsers.
2. **CSRF** — prevent unauthorized commands from trusted-user contexts.
3. **Insecure file uploads** — validate file type, size, content, and storage behavior.
4. **Path traversal** — block unauthorized filesystem access.
5. **SSRF** — prevent server-side requests to internal/private networks.

---



# 9. Authentication & Sessions — 24–26

1. Broken password reset — secure recovery flows and expiring recovery tokens.
2. Weak session management — use secure, HTTP-only cookies and appropriate cookie protections.
3. JWT secrets — keep signing keys private and strong.

---



# 10. Infrastructure & Network — 27–31

1. Permissive CORS — restrict unauthorized origins.
2. Rate limits — prevent API abuse and bot flooding.
3. Exposed environments — protect `.env` files and configuration.
4. Default credentials — change all stock/default passwords.
5. Unsigned webhooks — verify incoming webhook signatures.

---



# 11. Data & Operations — 32–36

1. Frontend payment checks — never trust frontend financial validation; validate transactions on the backend.
2. **IDOR / BOLA** — enforce object-level user permissions.
3. APIs + user input — sanitize and validate incoming parameters.
4. Exposed logs — keep sensitive data out of public/client console logs.
5. Exposed source maps — disable or appropriately protect production source maps.

---



# 12. Supply Chain, AI & Infrastructure — 37–54

1. Vulnerable dependencies — address outdated/insecure third-party libraries.
2. Malicious packages — assess package provenance and avoid untrusted packages.
3. Prompt injection — protect AI features from malicious instructions embedded in untrusted input.
4. Unpermissioned AI access — do not give AI tools unauthorized system/data access.
5. Excessive DB permissions — grant only required database privileges.
6. Missing audit logs — record relevant system events and user actions.
7. No security monitoring — provide monitoring for suspicious activity.
8. No backups/restore — maintain reliable recovery mechanisms.
9. Exposed internal dashboards — restrict administrative panels.
10. Missing security headers — implement appropriate HTTP security headers.
11. Insecure cookie settings — secure cookies against theft/misuse.
12. Unencrypted data — protect sensitive data in transit and at rest as applicable.
13. Poor tenant isolation — prevent cross-tenant access.
14. Unreviewed code — human security review of AI-generated code before deployment.
15. Mass assignment — allow only explicitly permitted fields in application models.
16. Command injection — prevent attacker-controlled OS command execution.
17. Insecure deserialization — safely process untrusted serialized data.
18. Misconfigured OAuth — correctly configure authentication and authorization flows.

---



# 13. Authentication, Abuse, CI/CD & AI — 55–70

1. **No MFA** — provide multi-factor authentication for user/admin accounts where applicable.
2. **Account enumeration** — avoid revealing whether usernames/emails exist.
3. **Business logic abuse** — test for unintended actions and financial/logic bypasses.
4. **Race conditions** — protect security-sensitive concurrent operations.
5. **Webhook replay** — prevent reuse of valid webhook requests.
6. **Insecure CI/CD** — secure build and deployment pipelines.
7. **Untrusted build actions** — do not run unverified build scripts/actions.
8. **Unpinned build dependencies** — use controlled, verified package versions.
9. **Checks fail open** — security failures must not silently become allow decisions.
10. **Missing timeouts** — apply appropriate connection/process/request timeouts.
11. **Sensitive information leaks** — prevent exposure of API keys, secrets, internal data.
12. **Invalid AI output** — validate and constrain LLM output before trusting or executing it.
13. **Excessive AI permissions** — least privilege for AI agents and tools.
14. **Sensitive browser storage** — avoid insecure storage of tokens/private data.
15. **Open redirects** — validate redirect destinations.
16. **Unsecured endpoints** — authenticate/authorize and validate all protected routes.

---



# 14. Authentication Hardening Requirements

1. Lock an account after 5 failed login attempts, subject to a design that does not create an easy account-lockout denial-of-service vector.
2. Add increasing or controlled delay after failed login attempts.
3. Log every failed login attempt.
4. Include source IP address in security logs where appropriate.
5. Detect repeated attack-like attempts from the same IP.
6. Apply appropriate blocking, throttling, or challenge controls to abusive IP behavior.
7. Limit OTP verification attempts.
8. Expire OTPs quickly and prevent reuse.
9. Rate-limit login, OTP, registration, password reset, and other authentication endpoints.
10. Never expose authentication secrets to frontend code.

---



# 15. IDOR / BOLA — Critical Requirement

**Broken Object-Level Authorization / IDOR is a dedicated high-priority requirement.**

For every API/resource operation:

- Verify the authenticated user's identity.
- Verify that the user has permission for the specific object.
- Verify tenant ownership where multi-tenancy exists.
- Perform authorization on the backend before reading, updating, deleting, downloading, exporting, or acting on a resource.
- Never trust an object ID supplied by the frontend as proof of ownership.
- Test both horizontal access (user A → user B's object) and vertical access (normal user → admin/restricted object).
- Apply checks consistently across REST APIs, GraphQL resolvers, server actions, file downloads, exports, background jobs, and direct database access paths.

---



# 16. Secure Authentication Copy-Paste Review Prompt

Use this prompt with an AI coding assistant during security review:

> Act as a senior security engineer. Review the authentication system of this project and make it secure. Ensure passwords are securely hashed, sessions expire, email verification is enabled, password reset tokens expire, login attempts are rate limited, OTP attempts are limited, and authentication secrets are never exposed to the frontend. Refactor insecure authentication logic and add appropriate security tests.

---



# 17. Unauthorized Data Access Review Prompt

> Review all API endpoints and database queries. Ensure every request verifies that the logged-in user owns the data being accessed or has an explicit permission to access it. Prevent insecure direct object reference (IDOR) and broken object-level authorization (BOLA) vulnerabilities by enforcing ownership and authorization checks before reading, modifying, deleting, downloading, exporting, or acting on any resource.

---



# 18. Secure Deployment & Monitoring Review Prompt

> Configure the application for secure deployment. Enforce HTTPS, ensure secrets are stored securely, restrict direct database access from the public internet, disable production debug features, and add logging for authentication attempts, API errors, security events, and unusual traffic patterns so suspicious behavior can be detected.

---



# 19. Abuse & Bot Protection Review Prompt

> Add abuse protection to the application. Implement rate limiting for login attempts, OTP verification, API endpoints, account creation, password resets, and AI generation requests. Prevent bots or automated scripts from repeatedly calling expensive endpoints or scraping data. Add appropriate throttling, challenge, or blocking behavior based on risk.

---



# 20. Secrets & API-Key Review Prompt

> Scan the entire project for secrets and credentials. Ensure API keys, database service keys, signing keys, tokens, and other credentials are never exposed in frontend code or committed to the repository. Move secrets to secure server-side environment/configuration mechanisms and ensure they are only used where required. Check Git history and production bundles where applicable.

---



# 21. Input Validation Review Prompt

> Identify every place where user-controlled input enters the system, including forms, APIs, uploads, headers, cookies, path parameters, query parameters, and AI-generated values. Add strict validation and safe handling to prevent SQL injection, NoSQL injection, command injection, XSS, path traversal, SSRF, unsafe file uploads, and unsafe deserialization. Reject invalid data and enforce strict types and limits.

---



# 22. AI Security Requirements

For every Rkyves AI feature:

- Treat user-provided and externally retrieved content as untrusted.
- Defend against prompt injection.
- Keep AI credentials server-side.
- Use least-privilege tool permissions.
- Do not allow an AI agent to access systems/data it does not need.
- Validate structured AI output against a schema.
- Never execute arbitrary AI-generated commands without explicit security controls.
- Apply authorization independently of AI output.
- Rate-limit expensive AI operations.
- Log appropriate AI security events without leaking sensitive prompts/secrets.
- Human-review AI-generated code before production deployment.

---



# 23. Dependency & CI/CD Security

- Track third-party dependencies.
- Identify vulnerable/outdated packages.
- Avoid untrusted/malicious packages.
- Pin or otherwise control dependency versions in builds.
- Review build scripts and CI actions.
- Do not run unverified scripts/actions.
- Protect CI/CD secrets.
- Restrict deployment permissions.
- Ensure security checks fail closed.
- Scan source repositories and build artifacts for secrets.
- Review generated frontend bundles for accidental secret exposure.
- Require human review for security-sensitive changes.

---



# 24. Logging, Audit & Monitoring

Implement appropriate security observability for:

- Successful and failed authentication events.
- OTP failures.
- Password reset activity.
- Authorization failures.
- Suspicious API activity.
- Rate-limit events.
- Webhook validation failures.
- Important administrative actions.
- Security configuration changes.
- Application errors.
- Unusual traffic patterns.

Logging requirements:

- Do not log passwords.
- Do not log OTP values.
- Do not log API keys/tokens.
- Do not expose secrets in client console logs.
- Sanitize sensitive fields.
- Protect access to logs.
- Define retention appropriate to the system and applicable compliance requirements.

---



# 25. Backups & Recovery

- Maintain automated backups/snapshots of critical data.
- Define backup frequency.
- Protect backups from unauthorized access.
- Test restoration, not only backup creation.
- Define recovery procedures.
- Monitor backup failures.
- Consider recovery objectives appropriate to each production service.

---



# 26. Cloudflare / HTTP Flood / DDoS Protection

The supplied security guide describes a layered model:

**Visitor → Cloudflare → VPS/Nginx → Application → Database**

Cloudflare layer:

- DDoS protection.
- WAF/security rules.
- Rate limiting.
- CDN/cache.

Origin layer:

- Prevent direct-origin bypass.
- Restrict public web access at the VPS firewall appropriately.
- Preserve required administrative access such as SSH.
- Do not blindly change production firewall rules.

Nginx/application/database:

- Request limiting.
- Application-level limits.
- Database connection/query protection.
- Monitoring.



## Recorded Cloudflare Rules



### Rule A — Non-India traffic

- Field: `ip.src.country`
- Operator: `does not equal`
- Value: `IN`
- Recorded action: Managed Challenge.

**Review before applying:** This can affect legitimate international users.

### Rule B — XML-RPC

- Field: `http.request.uri.path`
- Operator: `contains`
- Value: `/xmlrpc.php`
- Recorded action: Block.

**Review before applying:** Only block if the application does not require XML-RPC.

### Rule C — HTTP/1.0

- Field: `http.request.version`
- Operator: `equals`
- Value: `HTTP/1.0`
- Recorded action: Block.

**Review before applying:** Verify compatibility with legitimate traffic before production enforcement.

## Cloudflare Rate Limiting

Create rate limits based on legitimate traffic patterns. Consider separate protections for:

- Login
- OTP
- Password reset
- APIs
- Search
- Expensive operations
- AI generation

For suspicious bursts, a managed challenge can be considered instead of immediately blocking every request.

---



# 27. Nginx Protection

The supplied guide included this conceptual example:

```nginx
limit_req_zone $binary_remote_addr zone=website_limit:10m rate=10r/s;

server {
    location / {
        limit_req zone=website_limit burst=20 nodelay;
    }
}
```

This is a **conceptual example**, not a universal production value. Tune it for the application.

If Nginx is behind Cloudflare, configure real-client-IP handling correctly before using client-IP-based rate limiting.

---



# 28. Authorized Load / DDoS Testing

Use high-volume testing only against infrastructure Rkyves owns or is explicitly authorized to test.

The supplied guide describes k6 testing for HTTP-flood/Layer-7 DoS validation.

Test process:

1. Use the approved k6 test script.
2. Set the target to an authorized environment.
3. Establish a baseline.
4. Monitor CPU, RAM, load, bandwidth, TCP connections, Nginx errors, application workers, database connections, slow queries, RPS, latency, and errors.
5. Apply edge/origin/application protections.
6. Repeat the authorized test.
7. Compare protected results against baseline.

**Important:** VUs are not the same as requests per second. Measure both request behavior and system impact.

---



# 29. DPDP Act — Major Rkyves Compliance Workstream

Treat India's **Digital Personal Data Protection (DPDP) Act, 2023** and applicable rules as a major Rkyves compliance workstream.

Potential Rkyves scope includes websites, customer accounts, SaaS products, POS/ERP systems, restaurant systems, APIs, analytics, marketing, and multi-tenant platforms.

Requirements to assess and implement as applicable:

- Personal-data inventory.
- Identify what personal data is collected.
- Purpose limitation.
- Data minimization.
- Clear privacy notice.
- Consent management where applicable.
- Consent withdrawal mechanism.
- Data-principal/user rights handling.
- Complaint/grievance mechanism.
- Data deletion/retention process.
- Security safeguards.
- Access control and least privilege.
- Encryption/protection of sensitive data.
- Data breach/incident response.
- Audit/security logs.
- Third-party/vendor data-processing controls.
- Cloud/database security.
- Data-sharing controls.
- Children's data requirements where applicable.
- Consent/notice records.
- Data retention schedules.
- Privacy-by-design for new products.
- Customer/vendor contractual responsibilities.
- Privacy Policy aligned with actual processing.
- Cookie/tracking practices reviewed for applicability.
- Unauthorized personal-data access testing.
- Multi-tenant isolation.
- User-data request workflow.
- Incident/breach workflow.

**Do not claim legal compliance until the actual implementation, applicable obligations, documentation, and legal review have been completed.**

---



# 30. Website Legal & Privacy Surface

Before launch, verify:

- Privacy Policy is present and accessible.
- Terms of Service are present and accessible.
- Cookie/tracking behavior is documented and appropriately handled.
- Contact/business information is legitimate.
- Data collection matches documented privacy practices.
- Forms explain relevant data use where required.
- Account deletion/data request mechanisms are implemented where applicable.
- Third-party integrations are inventoried.
- Analytics and marketing technologies are identified.
- Production error pages do not expose personal or internal information.

---



# 31. Web Security Headers

Review and configure appropriate headers for the deployed architecture, including as applicable:

- Content Security Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Appropriate framing protection / `frame-ancestors`
- Secure cookie attributes

Do not blindly copy a header policy without testing application compatibility.

---



# 32. Cookies & Browser Storage

For authentication/session cookies, review:

- `Secure`
- `HttpOnly`
- Appropriate `SameSite`
- Expiration/session lifetime
- Domain/path scope

Avoid storing sensitive authentication tokens or private data in insecure browser storage. Review every use of `localStorage`, `sessionStorage`, and client-side state.

---



# 33. API & Webhook Security

For every API:

- Authentication where required.
- Authorization.
- IDOR/BOLA checks.
- Input validation.
- Rate limiting.
- Request size limits.
- Timeouts.
- Error handling.
- Logging without secrets.
- Appropriate CORS.
- Safe response data.
- Pagination/limits for expensive queries.

For webhooks:

- Verify signatures.
- Prevent replay attacks.
- Validate timestamps/nonces where applicable.
- Validate payload schema.
- Rate-limit suspicious traffic.
- Do not trust webhook payloads without verification.

---



# 34. Input Size & DoS Controls

Apply limits before expensive processing.

Examples:

- Password maximum length.
- Request body size.
- File upload size.
- Image dimensions/processing limits.
- Search/query limits.
- Pagination limits.
- Regex execution safety.
- Timeouts on network/database operations.
- Rate limits on expensive operations.

The supplied vulnerability guide specifically identifies extremely long passwords as a potential CPU-exhaustion vector when expensive password hashing is applied without input limits.

---



# 35. Regex / ReDoS

- Avoid complex AI-generated regex unless reviewed.
- Prefer established validation libraries where suitable.
- Test potentially dangerous regex patterns.
- Use static analysis where available.
- Apply request/process timeouts.
- Do not allow attacker-controlled input to trigger catastrophic backtracking.

---



# 36. Production Error Handling

Production responses should:

- Avoid stack traces.
- Avoid database errors.
- Avoid internal filesystem paths.
- Avoid secret/configuration details.
- Avoid implementation details that help attackers.
- Return useful but appropriately generic messages.

Detailed diagnostics belong in protected server-side logs.

---



# 37. File Upload Security

For every upload:

- Allow only required file types.
- Validate actual file content, not only extension.
- Enforce size limits.
- Rename uploaded files safely.
- Prevent path traversal.
- Store uploads outside executable web paths where appropriate.
- Scan files where required by the threat model.
- Restrict access to uploaded objects.
- Prevent direct execution of uploaded content.

---



# 38. Database Security

- No public database access unless explicitly required and protected.
- Use least-privilege DB users.
- Never expose DB credentials.
- Never commit DB credentials.
- Validate/sanitize database inputs.
- Prevent SQL/NoSQL injection.
- Review indexes and expensive queries.
- Prevent unbounded queries.
- Review connection limits.
- Monitor slow queries.
- Protect backups.

---



# 39. Multi-Tenant Security

For products such as SaaS/Cullinos-style multi-tenant systems:

- Every request must resolve the authenticated tenant.
- Every object query must include tenant scoping where required.
- Never trust a tenant ID supplied by the client.
- Verify user-to-tenant membership server-side.
- Verify object ownership/authorization.
- Test cross-tenant reads, updates, deletes, exports, downloads, and background jobs.
- Separate tenant data logically and/or physically according to risk and architecture.
- Include tenant isolation in automated security tests.

---



# 40. Payment / Financial Logic

- Never rely on frontend payment success/failure state.
- Validate payment status on the backend.
- Verify provider signatures/webhooks.
- Prevent duplicate/replayed transactions.
- Enforce authorization for refunds, credits, discounts, and financial actions.
- Protect business logic from price/quantity/discount manipulation.
- Log important financial actions without exposing sensitive payment data.

---



# 41. OAuth & Authentication Integrations

Review:

- Redirect URI validation.
- State protection.
- Token handling.
- Scope minimization.
- Secret storage.
- Token expiration/revocation.
- Server-side validation.
- Account linking behavior.
- Misconfiguration that could allow unauthorized account access.

---



# 42. Security Review Workflow for Cursor / AI Coding Agents

When implementing this document:

1. **Inventory the project first.**
  - Framework.
  - Frontend.
  - Backend.
  - Database.
  - Authentication.
  - APIs.
  - Cloud provider.
  - CDN/WAF.
  - CI/CD.
  - Third-party integrations.
  - AI integrations.
  - Email provider.
  - Analytics.
  - Current environment configuration.
2. **Do not rewrite the application blindly.**
  - Preserve existing functionality.
  - Make targeted changes.
  - Explain architectural conflicts before destructive changes.
3. **Implement security server-side.**
  - Frontend controls are UX controls, not authorization controls.
4. **Add automated tests.**
  - Authentication.
  - Authorization.
  - IDOR/BOLA.
  - Tenant isolation.
  - Input validation.
  - Rate limits.
  - Webhook signatures.
  - Password reset.
  - OTP.
  - Payment authorization.
  - Security headers.
5. **Scan for secrets.**
6. **Review dependencies.**
7. **Review production configuration.**
8. **Run security/lint/type/test/build checks.**
9. **Perform manual security review of high-risk paths.**
10. **Only then mark items complete.**

---



# 43. Definition of Done

A requirement is **DONE** only when:

- Implementation exists.
- It is enabled in the intended environment.
- Relevant automated tests pass.
- Manual verification is completed where appropriate.
- No obvious regression is introduced.
- Configuration/secrets are handled securely.
- Documentation is updated where required.
- Evidence of verification is recorded.

Use these statuses:

- `NOT STARTED`
- `IN PROGRESS`
- `IMPLEMENTED — NOT VERIFIED`
- `VERIFIED`
- `BLOCKED`
- `NOT APPLICABLE — JUSTIFIED`

---



# 44. Final Pre-Launch Gate

Before production release, verify:

### Website

- [ ] HTTPS
- [ ] Custom 404
- [ ] Loading/error/success states
- [ ] Mobile responsive
- [ ] No horizontal overflow
- [ ] Mobile menu
- [ ] Clickable email/phone
- [ ] No placeholders
- [ ] Broken links fixed
- [ ] Favicon
- [ ] Titles/descriptions
- [ ] Open Graph
- [ ] `robots.txt`
- [ ] `sitemap.xml`
- [ ] Alt text
- [ ] Privacy Policy
- [ ] Terms
- [ ] Cookie handling
- [ ] Analytics
- [ ] Legitimate contact/business information



### SEO / Search

- [ ] Google Search Console
- [ ] Bing Webmaster Tools
- [ ] Google Analytics
- [ ] Google Business Profile where applicable
- [ ] SEO setup
- [ ] Page speed
- [ ] Internal links
- [ ] Long-tail content
- [ ] AI-search-friendly content
- [ ] `llms.txt`



### Authentication

- [ ] Strong password hashing
- [ ] MFA where applicable
- [ ] Email verification
- [ ] Session expiry
- [ ] Secure cookies
- [ ] Login rate limiting
- [ ] Login delay
- [ ] Lockout/anti-abuse design
- [ ] OTP attempt limits
- [ ] Password-reset token expiry
- [ ] Failed-login logging
- [ ] Enumeration resistance



### Authorization

- [ ] Server-side authorization
- [ ] IDOR/BOLA protection
- [ ] Cross-user access tests
- [ ] Cross-tenant access tests
- [ ] Admin route protection
- [ ] Object ownership checks



### Application Security

- [ ] XSS
- [ ] CSRF
- [ ] SQL/NoSQL injection
- [ ] Command injection
- [ ] SSRF
- [ ] Path traversal
- [ ] File-upload security
- [ ] Mass assignment
- [ ] Open redirect
- [ ] Secure deserialization
- [ ] API validation
- [ ] Webhook signature/replay protection
- [ ] Payment backend validation



### Infrastructure

- [ ] Cloudflare
- [ ] WAF
- [ ] Rate limiting
- [ ] Origin protection
- [ ] Nginx limits
- [ ] Security headers
- [ ] Database not publicly exposed
- [ ] Least-privilege credentials
- [ ] Default credentials removed
- [ ] Debug disabled
- [ ] Secrets protected
- [ ] Dependency review
- [ ] CI/CD security
- [ ] Backups
- [ ] Restore test
- [ ] Monitoring
- [ ] Audit logging



### AI

- [ ] Prompt-injection controls
- [ ] AI least privilege
- [ ] Tool permission controls
- [ ] AI output validation
- [ ] AI request rate limits
- [ ] AI secrets server-side
- [ ] Human security review of AI-generated code



### Compliance

- [ ] DPDP applicability assessed
- [ ] Personal-data inventory
- [ ] Privacy notice
- [ ] Consent/withdrawal mechanisms where applicable
- [ ] User/data-principal rights workflow
- [ ] Retention/deletion
- [ ] Vendor/data-processing review
- [ ] Breach/incident process
- [ ] Audit/security controls
- [ ] Multi-tenant privacy controls
- [ ] Legal/compliance review before claiming compliance



### Legal (see §48 — do not duplicate checklist items here)

- [ ] Complete §48.5 Legal Pre-Launch Gate
- [ ] Evidence slots filled in `docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md`

---



# 45. Source Material Incorporated

This document consolidates the requirements supplied during the Rkyves security/compliance planning discussion, including:

- Website Credibility Checklist.
- Website Launch Checklist.
- Google/Bing/SEO/AI-search checklist.
- Email subdomain separation guidance.
- SEO and caching requirements.
- “7 Vulnerabilities of Vibe-Coded Apps” security guide.
- HTTP Flood & DDoS Protection Guide.
- Core Security Checks.
- Core Security Categories 19–70.
- Authentication hardening requirements.
- Six AI/vibe-coded application security checks and associated review prompts.
- IDOR/BOLA requirement.
- Cloudflare rule requirements.
- DPDP Act compliance workstream.
- Legal Guide for App Builders — 2026 Edition (supplied source; consolidated as §48, cross-referenced to avoid duplication with §6/§22/§29/§30/§40/§44).

---



# 46. Implementation Notes

This document is a **requirements and implementation checklist**, not proof that the project currently satisfies the requirements.

Any item requiring legal interpretation, compliance certification, production infrastructure access, cloud configuration, or third-party account verification must be separately verified.

The implementation agent should never:

- expose secrets,
- disable security controls merely to make tests pass,
- trust frontend authorization,
- claim compliance without evidence,
- make destructive infrastructure changes without review,
- run high-volume security tests against systems without authorization.



### Duplicate consolidation log (2026-09-19)

When the Legal Guide for App Builders (2026) was appended, it overlapped existing sections. Consolidation rules:


| Legal Guide topic             | Canonical home    | What remained in §48                                     |
| ----------------------------- | ----------------- | -------------------------------------------------------- |
| Terms of Service              | §2 #16, §30       | Product-specific counsel review requirement              |
| Privacy Policy                | §2 #15, §29, §30  | Must-match-real-processing + store consistency           |
| User data security controls   | §7–§14, §24–§25   | Jurisdiction-specific breach notification deadlines only |
| Payment backend security      | §40               | IAP / store-payment applicability only                   |
| Children's data (technical)   | §29 DPDP          | Age-gate / applicability assessment                      |
| Email subdomain separation    | §6                | Consent evidence + unsubscribe (marketing rules)         |
| AI security (injection/tools) | §22               | AI **disclosure/transparency** only                      |
| Alt text                      | §2 #9, §4 #48     | Full a11y / WCAG program                                 |
| Status vocabulary             | §47 Phase 2 / §43 | Pointer only (not restated)                              |
| Compliance gate bullets       | §44               | Legal gate kept in §48.5; §44 links here                 |


**Numbering fix:** Cursor prompt remains `# 47`. Legal Guide renumbered to `# 48` (was a second `# 47`).

Evidence stub: `docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md`.

# 47. Cursor-Ready Implementation Prompt

Copy the prompt below into Cursor when you want Cursor to implement this security/compliance specification.

```text
You are the senior security engineer and implementation agent for the Rkyves project.

Your job is to inspect the existing repository first, understand the current architecture, then implement the requirements in this document without breaking existing functionality.

SOURCE OF TRUTH
- Treat `Rkyves_Security_Compliance_Master_Requirements.md` as the security/compliance implementation specification.
- Do not invent that a requirement is satisfied.
- Do not mark an item VERIFIED unless you have actually verified it with appropriate evidence.
- Preserve existing product behavior unless a change is required for security, compliance, reliability, or the explicit requirements below.

PHASE 1 — REPOSITORY DISCOVERY
Before changing code, inspect the repository and identify:

1. Frontend framework and build system.
2. Backend framework/runtime.
3. Database and ORM/query layer.
4. Authentication and authorization implementation.
5. API routes/endpoints/server actions/GraphQL resolvers.
6. Admin routes and privileged functionality.
7. Multi-tenant architecture and tenant/user relationship.
8. File upload/download functionality.
9. Payment/billing functionality.
10. Webhook endpoints and signature verification.
11. Email provider and email-sending architecture.
12. AI/LLM integrations and agent/tool permissions.
13. Environment variables and secret-management approach.
14. Cloud provider, VPS, CDN, Cloudflare, Nginx and networking configuration.
15. CI/CD pipeline and deployment configuration.
16. Package/dependency manifests and lockfiles.
17. Logging, monitoring, audit logging and error reporting.
18. Backup/restore configuration.
19. Existing SEO, sitemap, robots, analytics and Open Graph implementation.
20. Privacy Policy, Terms, cookie/tracking implementation and other compliance surfaces.
21. Existing tests, linting, type checking and security tooling.

Do not start by rewriting files. First build a concise architecture map and identify where each requirement belongs.

PHASE 2 — CREATE AN IMPLEMENTATION STATUS
Maintain a machine-readable and human-readable status for every applicable requirement in this document.

Use exactly these statuses:
- NOT STARTED
- IN PROGRESS
- IMPLEMENTED — NOT VERIFIED
- VERIFIED
- BLOCKED
- NOT APPLICABLE — JUSTIFIED

Rules:
- Do not use VERIFIED simply because code was written.
- IMPLEMENTED — NOT VERIFIED means implementation exists but sufficient verification has not yet been completed.
- BLOCKED means the requirement cannot currently be completed because of a dependency, missing credential, infrastructure limitation, product decision, third-party limitation, legal decision, or other concrete blocker.
- NOT APPLICABLE — JUSTIFIED requires a written reason.
- Never silently delete or skip a requirement.
- If a requirement cannot be verified in the current environment, leave it IMPLEMENTED — NOT VERIFIED or BLOCKED and explain why.

PHASE 3 — MAP REQUIREMENTS TO THE CODEBASE
For every requirement:
1. Identify relevant files, routes, components, services, middleware, database models, infrastructure configuration, CI/CD configuration or external configuration.
2. Determine whether the requirement is already implemented.
3. Identify the security gap.
4. Implement the smallest safe change that satisfies the requirement.
5. Add or update automated tests where appropriate.
6. Record the files changed and verification performed.
7. Update the status.

Do not assume that similar-looking controls are equivalent. For example:
- Frontend hiding a button is NOT authorization.
- An object ID is NOT proof of ownership.
- A successful backup job is NOT proof that restore works.
- A configured security header is NOT proof that the resulting policy is correct.
- A secret existing in `.env` is NOT proof that it is unavailable to the frontend.
- A rate limiter existing in code is NOT proof that the correct endpoints and thresholds are protected.

PHASE 4 — PRIORITY ORDER
Implement in this order unless repository dependencies require a different safe order:

Priority 0 — Critical exposure prevention
- Public `.env`/secrets
- Hardcoded credentials
- Public database exposure
- Broken authentication
- Missing authorization
- IDOR/BOLA
- Cross-tenant access
- Admin-route exposure
- Command injection
- SQL/NoSQL injection
- SSRF
- XSS
- Unsafe file uploads
- Exposed production debug tools

Priority 1 — Authentication and abuse prevention
- Password hashing
- MFA where applicable
- Session expiry
- Secure cookies
- Password-reset token expiry
- Email verification
- Login rate limiting
- Login delay
- Account lockout/anti-abuse design
- OTP limits/expiry/reuse prevention
- Account enumeration resistance
- API rate limiting
- Webhook signature/replay protection

Priority 2 — Data and infrastructure security
- Least-privilege database access
- Encryption/protection of sensitive data
- Security headers
- CORS
- Origin protection
- Cloudflare/WAF/rate limiting
- Nginx limits
- Timeouts/request-size limits
- Logging/audit trails
- Monitoring
- Backups and restore testing

Priority 3 — Application, AI, CI/CD and supply chain
- Input validation
- Mass assignment
- Open redirects
- Unsafe deserialization
- OAuth configuration
- Dependency vulnerabilities
- Package trust
- CI/CD permissions
- Pinned/controlled build dependencies
- Secret scanning
- Source-map exposure
- Prompt injection
- AI output validation
- AI least privilege
- AI tool permissions

Priority 4 — Website launch, SEO and performance
- HTTPS
- 404/error/success/loading states
- Mobile responsiveness
- Overflow fixes
- Favicon
- Meta titles/descriptions
- Open Graph
- robots.txt
- sitemap.xml
- alt text
- internal links
- page speed
- caching
- analytics
- Google Search Console
- Bing Webmaster Tools
- llms.txt
- Google Business Profile where applicable
- clickable email/phone
- removal of placeholder content

Priority 5 — Privacy/compliance
- DPDP applicability and obligations
- Personal-data inventory
- Privacy notice
- Consent/withdrawal mechanisms where applicable
- Data-principal/user rights workflow
- Retention/deletion
- Vendor/third-party data processing
- Incident/breach process
- Multi-tenant privacy controls
- Compliance documentation

IMPORTANT:
Do not claim legal compliance merely because technical controls were implemented. Mark legal/compliance items as VERIFIED only when the actual required documentation, configuration, evidence and applicable review have been completed.

PHASE 5 — SECURITY IMPLEMENTATION RULES

AUTHENTICATION
- Use strong password hashing.
- Never store plaintext passwords.
- Protect authentication secrets server-side.
- Implement session expiration.
- Use secure, HTTP-only cookies where cookie-based sessions are used.
- Apply appropriate SameSite/Secure settings.
- Expire password-reset tokens.
- Expire OTPs and prevent reuse.
- Limit OTP attempts.
- Rate-limit authentication endpoints.
- Add controlled login delays after failures.
- Implement account lockout carefully so attackers cannot trivially lock out arbitrary users.
- Avoid account enumeration through error messages, timing, password-reset responses or registration responses.
- Implement MFA where applicable.

AUTHORIZATION / IDOR / BOLA
- Every protected object operation must perform backend authorization.
- Verify authenticated user.
- Verify tenant membership where applicable.
- Verify object ownership or explicit permission.
- Never trust frontend-supplied user IDs or tenant IDs.
- Never treat object IDs as proof of ownership.
- Protect reads, writes, deletes, downloads, exports and actions.
- Test horizontal privilege escalation and vertical privilege escalation.
- Test background jobs and asynchronous workers as well as HTTP endpoints.

SECRETS
- Search source files, configuration, Git-tracked files and build artifacts for secrets.
- Never expose server-only secrets through public environment-variable prefixes.
- Never commit credentials.
- Do not print secrets to logs.
- Ensure secrets are server-side only.
- Use the project's existing secure secret-management mechanism where available.
- Do not expose database service keys or signing keys to the client.

INPUT SECURITY
- Validate every user-controlled input.
- Use strict schemas/types.
- Enforce request-size and field-size limits.
- Protect against SQL injection and NoSQL injection.
- Protect against XSS.
- Protect against command injection.
- Protect against SSRF.
- Protect against path traversal.
- Protect file uploads.
- Protect deserialization.
- Avoid dangerous dynamic evaluation.
- Review regex for ReDoS.

API SECURITY
- Authenticate protected endpoints.
- Authorize every resource/object.
- Validate parameters and request bodies.
- Apply rate limits.
- Apply timeouts.
- Limit expensive queries.
- Avoid unbounded database operations.
- Return safe errors.
- Do not expose secrets or internal implementation details.

WEBHOOKS
- Verify provider signatures.
- Validate payloads.
- Prevent replay attacks where applicable.
- Use timestamp/nonce/idempotency mechanisms where appropriate.
- Reject invalid signatures.
- Rate-limit abuse.
- Do not trust frontend claims about webhook state.

PAYMENTS
- Never trust frontend payment status.
- Verify transaction state server-side.
- Verify provider signatures/webhooks.
- Prevent duplicate/replayed transactions.
- Authorize refunds, credits, discounts and other financial actions.
- Protect price/quantity/discount logic from manipulation.

MULTI-TENANCY
- Resolve tenant from authenticated context.
- Do not trust tenant IDs supplied by the client.
- Enforce tenant scoping in database queries.
- Verify user-to-tenant membership.
- Test cross-tenant read/update/delete/download/export access.
- Include tenant isolation in automated tests.

AI SECURITY
- Treat user input and retrieved content as untrusted.
- Defend against prompt injection.
- Validate structured LLM output against schemas.
- Never blindly execute LLM-generated commands.
- Keep AI credentials server-side.
- Apply least privilege to AI agents/tools.
- Do not allow AI to bypass normal authorization.
- Rate-limit expensive AI operations.
- Log security events without exposing secrets or unnecessary sensitive content.

CI/CD
- Protect CI/CD secrets.
- Minimize pipeline permissions.
- Review third-party actions.
- Do not execute untrusted build scripts.
- Control dependency versions.
- Scan dependencies.
- Scan for secrets.
- Require review for security-sensitive changes.
- Ensure security checks fail closed.

LOGGING / MONITORING
Log appropriate security events including:
- Failed/successful authentication
- OTP failures
- Password resets
- Authorization failures
- Rate-limit events
- Webhook failures
- Administrative actions
- Security configuration changes
- Suspicious traffic
- Important application errors

Never log:
- Passwords
- OTP values
- API keys
- Access/refresh tokens
- Private credentials
- Other secrets

CLOUD / CLOUDFLARE
- Inspect existing Cloudflare configuration before changing it.
- Do not blindly apply country blocking.
- Recorded rule for review: `ip.src.country != "IN"` → Managed Challenge.
- Recorded rule for review: URI contains `/xmlrpc.php` → Block.
- Recorded rule for review: HTTP version equals `HTTP/1.0` → Block.
- Only block `/xmlrpc.php` if the application does not require it.
- Verify that international users are not unintentionally blocked/challenged if the product requires international access.
- Add rate limits appropriate to login, OTP, API, search and expensive endpoints.
- Protect the origin from direct bypass where infrastructure supports it.
- Preserve required administrative access.
- Do not make production firewall changes without checking required ports/services.

CACHE
- Cache public static assets.
- Use versioned assets/invalidation.
- Edge-cache suitable public pages.
- Never accidentally cache private/user-specific responses in shared caches.
- Verify authenticated/private responses are not publicly cached.

WEBSITE
- Enforce HTTPS.
- Remove horizontal overflow.
- Fix titles and descriptions.
- Add favicon.
- Add Open Graph metadata/images.
- Add robots.txt and sitemap.xml.
- Add alt text.
- Add loading/error/success/empty states.
- Add custom 404.
- Add mobile menu and responsive layouts.
- Make phone/email links clickable.
- Remove placeholders.
- Fix broken links.
- Configure analytics.
- Configure SEO.
- Set up Google Search Console.
- Set up Bing Webmaster Tools.
- Create/update llms.txt.
- Review page speed and image compression.

EMAIL
- Separate transactional email from marketing email.
- Transactional example: `mail.yourdomain.com`.
- Marketing example: `news.yourdomain.com`.
- Do not mix high-volume promotional traffic with critical transactional mail.
- Protect email credentials and sending infrastructure.

DPDP
- Identify personal data and processing purposes.
- Minimize collection.
- Maintain appropriate privacy notice.
- Implement consent/withdrawal mechanisms where applicable.
- Provide applicable data-principal rights mechanisms.
- Establish retention/deletion processes.
- Review vendors and third parties.
- Establish incident/breach response.
- Do not claim DPDP compliance without confirming applicable obligations and evidence.

PHASE 6 — TESTING

After each security area:
1. Run existing tests.
2. Add tests for new security controls.
3. Run lint.
4. Run type checking if available.
5. Run build.
6. Run targeted security tests.
7. Test negative cases, not just successful cases.

At minimum test:
- User A cannot access User B's object.
- Tenant A cannot access Tenant B's object.
- Normal user cannot access admin resources.
- Invalid/expired tokens fail.
- Expired password-reset links fail.
- Expired/reused OTPs fail.
- OTP attempt limits work.
- Login rate limits work.
- Repeated abusive requests are throttled/challenged/blocked as designed.
- Invalid webhook signatures fail.
- Replayed webhooks fail where replay protection is required.
- Invalid input is rejected.
- Oversized requests/uploads are rejected.
- Production errors do not leak internals.
- Secrets are not present in client bundles.
- Security headers are present and appropriate.
- Private responses are not publicly cached.
- Database is not unnecessarily public.

Do not run high-volume k6/DDoS testing against systems unless the target is owned by Rkyves or explicit authorization exists.

PHASE 7 — STATUS UPDATES

Update the status table/checklist in this document after implementation.

For each requirement, record:
- Requirement ID
- Status
- Implementation location/file(s)
- What changed
- Verification performed
- Remaining risk
- Blocker, if any

Example:

| ID | Status | Location | Verification | Blocker |
|---|---|---|---|---|
| 33 | VERIFIED | `server/api/orders.ts` | Cross-user authorization tests pass | None |
| 28 | IMPLEMENTED — NOT VERIFIED | `middleware/rateLimit.ts` | Unit tests pass; production traffic not tested | Production tuning pending |
| 37 | BLOCKED | External service | Cannot verify ownership | DNS/account access required |

Do not change NOT STARTED to VERIFIED without evidence.

PHASE 8 — BLOCKERS

When blocked:
- Clearly state the exact blocker.
- Identify whether it is code, infrastructure, credentials, DNS, Cloudflare, third-party service, product decision, legal/compliance review, or missing information.
- Do not bypass the control to make the checklist green.
- Do not invent credentials/configuration.
- Provide the smallest next action needed to unblock it.
- Keep the requirement BLOCKED until verified.

PHASE 9 — FINAL REPORT

At the end, produce:

1. Executive summary.
2. Repository architecture discovered.
3. Requirements implemented.
4. Requirements already present.
5. Requirements implemented but not verified.
6. Verified requirements.
7. Blocked requirements.
8. Not-applicable requirements and justification.
9. Files changed.
10. Database/schema migrations.
11. Environment variables added/changed (never reveal secret values).
12. Infrastructure/Cloudflare changes required or made.
13. Tests added.
14. Tests executed and results.
15. Build/lint/type-check results.
16. Security risks remaining.
17. Manual actions required from the Rkyves owner.
18. Recommended next verification steps.

FINAL RULE:
A green-looking checklist is not the objective. The objective is a genuinely safer, testable and maintainable Rkyves application. Never hide a failed test, unresolved blocker, missing external configuration, or unverified requirement just to report completion.
```



## Cursor execution mode

When starting work, Cursor should first respond with:

- A repository architecture summary.
- A requirement-to-codebase mapping.
- A list of high-risk findings.
- A proposed implementation sequence.
- Any blockers that require owner/infrastructure access.

Then implement incrementally and update statuses after each verified area.

---



# 48. Legal Guide for App Builders — Additional Launch Requirements

Incorporated from **Legal Guide for App Builders — 2026 Edition**. Assess applicability per product, jurisdiction, channel, and business model. **Not legal advice.** Overlaps with earlier sections are consolidated here via cross-reference (see §46 Duplicate consolidation log).

## 48.1 Four Pre-Launch Legal / Store Workstreams



### 48.1.1 Terms of Service

**Covered in:** §2 #16, §30 (publish accessible ToS).

**Additional Legal Guide requirements (unique):**

- Product-specific coverage of acceptable use, liability limits, suspension/termination, update mechanism, UGC rules, and dispute/contact paths for Cullinos SaaS / POS / restaurant roles.
- **Rkyves action:** Counsel review of published Terms (`apps/web` `/terms`) against actual pricing, subscriptions, and customer responsibilities before claiming legal completeness.



### 48.1.2 Privacy Policy

**Covered in:** §2 #15, §29 (DPDP), §30 (website legal surface).

**Additional Legal Guide requirements (unique):**

- Policy must remain consistent with **actual** backend processing, analytics, payments, crash reporting, cloud/SDKs, and **store declarations**.
- Link from signup, app settings, and website where appropriate (guest already links `/privacy`).
- **Rkyves action:** Counsel review that `/privacy` matches live processing; do not mark VERIFIED from page presence alone.



### 48.1.3 Trademark and Intellectual Property Check

**Not covered elsewhere — keep in full.**

Before committing to a product/brand identity:

- Search relevant trademark database(s) for intended markets (India: IP India resources).
- Search web and app stores for confusingly similar names.
- Check domain and social-handle availability (availability ≠ trademark clearance).
- Confirm commercial licensing for icons, fonts, illustrations, images, templates, and other assets.
- Review third-party and AI-generated code for license obligations before redistribution or commercial use.
- Keep dated evidence of material license/trademark checks (`docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md`).



### 48.1.4 App Store / Google Play Data Declarations

**Mostly unique — keep.** Working checklist: `[docs/guest-app/PLAY_STORE_CHECKLIST.md](docs/guest-app/PLAY_STORE_CHECKLIST.md)`.

For mobile products, maintain an SDK/data inventory and ensure store declarations match behavior:

- Apple App Privacy / Google Play Data Safety.
- Analytics, crash-reporting, advertising/attribution SDKs.
- Location, camera, microphone, photo/file and other sensitive permissions.
- Privacy Policy consistency with store declarations.
- Consent mechanisms for tracking/cookies where required.

Do not submit declarations based only on first-party code; audit installed SDKs.

## 48.2 Additional Legal / Product Readiness Areas



### 48.2.1 User Data Security

**Covered in:** §7–§18 (core security), §14 auth hardening, §24 audit/monitoring, §25 backups, `docs/security-compliance/INCIDENT_RESPONSE.md`.

**Additional Legal Guide requirement (unique):**

- Determine **jurisdiction-specific breach notification obligations** (do not invent a single universal deadline). Document open questions for counsel.



### 48.2.2 Payment Compliance

**Covered in:** §40 (backend payment validation, no unnecessary card storage, webhooks).

**Additional Legal Guide requirements (unique):**

- Customer-facing refund/cancellation and renewal/subscription terms (partially in `/terms` — counsel review).
- For mobile apps: determine whether Apple/Google **in-app purchase** rules apply to the specific transaction type; do not assume one payment method is universal.
- Document payment-provider vs merchant responsibilities.
- **Cullinos note:** Guest/online ordering uses Razorpay/Cashfree web flows today → IAP marked `NOT APPLICABLE — JUSTIFIED` until IAP is introduced.



### 48.2.3 Children's Privacy

**Covered in:** §29 DPDP (“Children's data requirements where applicable”).

**Additional Legal Guide requirements (unique):**

- Documented applicability analysis (target market, age range, design) — do not assume general-audience = no obligations.
- Decide whether age assurance/gating is appropriate; apply parental-consent controls if required.
- Minimize children's personal-data collection where laws apply.



### 48.2.4 Email Marketing Compliance

**Covered in:** §6 (transactional vs marketing subdomain separation).

**Additional Legal Guide requirements (unique):**

- Appropriate consent; no prohibited pre-checked marketing consent.
- Functional unsubscribe (implemented: `/unsubscribe` + List-Unsubscribe headers).
- Preserve consent evidence (date, source, scope).
- Do not treat transactional mail (OTP, receipts, password reset) as marketing without reviewing applicable rules.



### 48.2.5 AI Content Transparency

**Security controls covered in:** §22 (prompt injection, least privilege, output validation).

**Additional Legal Guide requirements (unique — disclosure):**

- Identify where AI-generated output is presented to users.
- Assess transparency/disclosure obligations by jurisdiction/use case.
- Distinguish AI content where required; do not misrepresent AI as human-generated.
- Stronger review in high-impact domains (health/finance/legal).
- **Cullinos note:** No runtime LLM user surface today → `NOT APPLICABLE — JUSTIFIED` until AI features ship; reassess then.



### 48.2.6 Accessibility

**Partial overlap:** §2 #9 / §4 #48 (image alt text).

**Legal Guide engineering checklist (keep):**

- Meaningful alt text; adequate contrast (WCAG criteria appropriate to product).
- Keyboard navigation; screen-reader semantics and labels.
- Accessible form errors and focus management; touch targets.
- Automated testing (axe/Lighthouse) plus manual testing.
- Determine whether ADA, European Accessibility Act, or other obligations apply to the entity/product/market.



## 48.3 Legal Document / Evidence Register

Maintain a lightweight evidence register per product. Operational stub: [`docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md`](docs/security-compliance/LEGAL_EVIDENCE_REGISTER.md).

Slots include: ToS/Privacy versions, cookie consent config, data/SDK inventory, store declarations, trademark/IP notes, licenses, payment/refund terms, marketing consent/unsubscribe tests, children's applicability, AI disclosure assessment, a11y results, retention/rights evidence, incident docs, counsel review notes.

(Do not duplicate the full §44 compliance checkbox list here.)

## 48.4 Legal Status Rules

Use the **same status vocabulary** as §47 Phase 2 / §43 Definition of Done (`NOT STARTED` … `NOT APPLICABLE — JUSTIFIED`).

**Important:** A generated legal template, store declaration, or AI-generated policy is **not** by itself evidence of legal compliance. Policy pages alone must not be marked `VERIFIED`.

## 48.5 Legal Pre-Launch Gate

Before releasing a Rkyves product, confirm (legal-specific; technical DPDP/security gates remain in §44):

- [ ] Terms of Service reviewed and published where required.
- [ ] Privacy Policy matches actual data processing.
- [ ] Cookie/tracking assessed; consent implemented where applicable.
- [ ] Data inventory and third-party SDK/vendor flows reviewed.
- [ ] App Store / Play Store declarations completed where applicable.
- [ ] Trademark/IP and commercial asset/software licenses reviewed for relevant markets.
- [ ] Payment/refund/subscription and IAP applicability assessed where applicable.
- [ ] Children's privacy applicability assessed and documented.
- [ ] Marketing email consent/unsubscribe controls tested where applicable.
- [ ] AI transparency/applicability assessed where applicable.
- [ ] Accessibility assessment completed for relevant platforms/markets.
- [ ] DPDP applicability reviewed for India-facing processing (with §29 technical controls).
- [ ] Legal open questions documented; qualified legal review for high-stakes matters.

**Source note:** Substance of the user-supplied “Legal Guide for App Builders — 2026 Edition,” adapted into Rkyves's status/evidence framework. Informational only — not legal advice.