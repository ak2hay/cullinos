---
name: rkyves-security
description: Rkyves Security skill—dependency/vuln reporting, compliance gaps, secrets hygiene for Cullinos. Use for PR security review, weekly digest, or Release/Incident security pass.
---

# Security

## Sources

- `.github/workflows/security.yml` (npm audit + CodeQL)
- `Rkyves_Security_Compliance_Master_Requirements.md`
- `docs/SECURITY_COMPLIANCE.md`, `docs/security-compliance/`
- Auth/tenant code: `apps/api/src/common/*`, payments modules

## Report format

1. Summary (severity counts)
2. Findings (title, severity, evidence path, recommendation, owner bot)
3. Compliance gaps vs master requirements (cite section)
4. Explicit non-findings if scan data unavailable

## Focus areas

- Secrets in repo or tickets
- IDOR/BOLA / missing org scope
- Webhook signature verification
- Dependency high/critical advisories

## Hard stops

- Do not print production secrets
- Do not disable CI security jobs
- Advise only—human approves exceptions
