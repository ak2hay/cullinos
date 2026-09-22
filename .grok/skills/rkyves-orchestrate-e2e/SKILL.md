---
name: rkyves-orchestrate-e2e
description: Shared E2E orchestrator for Rkyves bot groups—Feature Ship, Bug Fix, Release, Growth Campaign, Incident. Use when coordinating multi-bot handoffs and ticket/board updates.
---

# Orchestrate E2E

## When to use

Any group kickoff or mid-flight handoff across bots. CEO, CTO, or current owner may invoke.

## Steps

1. Confirm **group** and **playbook** under `docs/rkyves-team/PLAYBOOKS/`.
2. Ensure ticket exists (`HANDOFF.md`); set `status`, `owner_bot`, `group`.
3. State stage exit criteria from the playbook.
4. `@` the next owner in the group with: outcome, ticket path, constraints, done-when.
5. Update `/workspace/rkyves/board.md` row.
6. On block: set `blocked`, list human approval needed, ping CEO if ≥ P1.

## Stage cheat sheet

| Group | First owner | Typical path |
|-------|-------------|--------------|
| Feature Ship | CEO → CTO → Dev → QA → Docs | feature-e2e |
| Bug Fix | CS → Dev → QA → CS draft | bug-e2e |
| Release | CTO → Security → QA → DevOps → Docs | release-e2e |
| Growth Campaign | Marketing → SEO → UI/UX → Dev Frontend | campaign-e2e |
| Incident | DevOps → CTO/Security → CS draft → recover | incident-e2e |

## Hard stops

- One owner at a time
- No skipping human gates for merge/deploy/customer send
- Prefer ticket + group visibility over silent DMs for E2E
