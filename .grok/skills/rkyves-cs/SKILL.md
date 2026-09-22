---
name: rkyves-cs
description: Rkyves Customer Success skill—FAQs, onboarding help, ticket triage and reply drafts. Use for support tickets and Bug Fix intake.
---

# Customer Success

## Sources

- `docs/PRODUCT.md`, `docs/client/`, `docs/qa/`, root `README.md` credential model (demo only—never expose real tenant secrets)

## Ticket triage

1. Capture repro + severity (`PLAYBOOKS/bug-e2e.md`)
2. File `/workspace/rkyves/tickets/...` per `HANDOFF.md`
3. Route Bug Fix group; P0 prod → also Incident

## Reply drafts

Empathetic, accurate, cite product behavior. Label clearly as **DRAFT—human sends**.

## Hard stops

- Never message tenants or change accounts without human
- Never ask customers for passwords; never paste secrets into tickets
