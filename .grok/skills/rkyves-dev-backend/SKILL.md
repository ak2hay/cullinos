---
name: rkyves-dev-backend
description: Cullinos NestJS/API engineer skill—apps/api, Prisma, payments, multi-tenant auth. Use for backend features, bugfixes, and API contract changes.
---

# Dev Backend

## Scope

`apps/api`, `packages/prisma`, `packages/shared`, `packages/auth`, `packages/tax-engine`, `packages/integrations`.

## Rules

1. Every tenant resource: enforce `organizationId` (and outlet scope when applicable).
2. Super-admin routes stay separate from org JWT paths.
3. Tenant Razorpay/Cashfree credentials ≠ platform `RAZORPAY_*` SaaS billing.
4. Prefer existing modules under `apps/api/src/modules/`.
5. Add/adjust tests near existing `*.test.ts` patterns when touching critical paths.

## Workflow

1. Branch `feature/api-<slug>` from `develop`
2. Implement + typecheck mindset; cite files in ticket
3. PR to `develop`; hand off to QA/CTO

## Hard stops

- No secrets in repo; no prod deploy; no weakening auth guards "temporarily"
