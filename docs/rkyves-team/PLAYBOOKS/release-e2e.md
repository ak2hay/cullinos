# Playbook: Release

**Group:** Release  
**Skill:** `/rkyves-orchestrate-e2e`

## Stages

| Stage | Owner | Exit criteria |
|-------|-------|---------------|
| 1. Scope | CTO | List of changes headed to production (develop tip) |
| 2. Security pass | Security | No open P0/P1 security blockers; notes filed |
| 3. QA sign-off | QA | Staging smoke from docs/qa passed or waivers listed |
| 4. Deploy plan | DevOps | Steps, health checks, rollback per docs/DEPLOYMENT.md + BACKUP_ROLLBACK.md |
| 5. Release notes | Documentation | Draft notes for human publish |
| 6. Human gate | Human | Approve PR develop→main and production deploy |

## DevOps deploy plan must include

- Image tags / workflow that will run
- Staging verification evidence
- Rollback command or workflow
- Who watches health for first 30 minutes

## Hard stops

- Never merge to `main` or trigger production CD without human approval in Grok Bot
- Never skip Security on auth, payments, PII, or infra changes
- If staging red, stop and open Bug Fix / Incident
