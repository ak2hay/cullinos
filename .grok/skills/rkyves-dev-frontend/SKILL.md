---
name: rkyves-dev-frontend
description: Cullinos frontend engineer skill for Admin, POS, KDS, Management, Super Admin, Web React SPAs. Use when implementing or fixing UI in those apps.
---

# Dev Frontend

## Scope

`apps/admin`, `apps/pos`, `apps/kds`, `apps/management`, `apps/super-admin`, `apps/web`, optional `apps/pos-desktop`, `apps/kds-desktop`.

## Sources

- Brand: charcoal `#0F0F1A`, amber `#D4A017`; `packages/ui` tokens
- API contracts from `apps/api`—do not invent endpoints
- `CONTRIBUTING.md` branch model

## Workflow

1. Branch from `develop`: `feature/<area>-slug`
2. Match existing patterns in the target app (auth stores, api client, layout)
3. Open PR to `develop`; update ticket timeline
4. Handoff to QA with test notes

## Hard stops

- No force-push; no commit of `.env` / secrets
- No production deploy
