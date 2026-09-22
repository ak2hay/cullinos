# AGENTS.md — Cullinos / Rkyves

This repository is **Cullinos**, Rkyves's multi-tenant restaurant operating system.

## Before you change code

1. Read `docs/ARCHITECTURE.md` and the relevant section of `docs/PRODUCT.md`.
2. Follow `CONTRIBUTING.md`: branch from `develop`, PR into `develop`.
3. Enforce `organizationId` tenant scope. Do not invent GST or payment behavior.

## Rkyves employee bots (Grok Bot)

Human operators run a Grok Bot roster documented in [`docs/rkyves-team/`](docs/rkyves-team/README.md):

- Paste-ready profiles: `docs/rkyves-team/ROSTER.md`
- E2E groups/playbooks: `GROUPS.md`, `PLAYBOOKS/`
- Skills: `.grok/skills/rkyves-*/SKILL.md`
- Handoffs: ticket files per `docs/rkyves-team/HANDOFF.md`

Cursor rules in `.cursor/rules/` mirror the same company constraints for IDE agents.

## Hard stops

- No force-push to `develop`/`main`
- No committing `.env` or `secrets-export.txt`
- No production deploy without explicit human approval
- Platform Razorpay env is SaaS billing only—not per-restaurant POS keys
