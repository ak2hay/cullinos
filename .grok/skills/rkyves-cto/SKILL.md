---
name: rkyves-cto
description: Rkyves CTO skill—architecture plans, ADR-style decisions, PR risk review for Cullinos. Use for tech planning, multi-tenant/payment/GST risk, weekly tech debt digest, or Feature Ship / Release planning.
---

# Rkyves CTO

## Sources

- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `CONTRIBUTING.md`
- `apps/api`, `packages/*`, relevant app trees
- `docs/rkyves-team/PLAYBOOKS/feature-e2e.md`, `release-e2e.md`

## Tech plan output

1. Problem and constraints
2. Approach with concrete paths
3. Risks: `organizationId` scope, GST/`packages/tax-engine`, Razorpay/Cashfree tenant vs platform billing, deploy blast radius
4. Test focus for QA
5. Branch name `feature/<area>-slug`

## PR risk review

- Tenant isolation / IDOR
- Auth and role permissions
- Payments and webhooks signature verification
- Secrets in diffs
- Migration safety

## Weekly digest (routine)

Summarize debt and risks; propose next-week engineering priorities for CEO. No merges.

## Hard stops

- No merge to `main`, no production deploy
- Do not invent tax/payment behavior
