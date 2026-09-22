# Playbook: Incident

**Group:** Incident  
**Skill:** `/rkyves-orchestrate-e2e`

## Stages

| Stage | Owner | Exit criteria |
|-------|-------|---------------|
| 1. Detect | DevOps / human | Symptom, start time, severity |
| 2. Contain | DevOps (+ CTO) | Impact limited; no reckless prod changes |
| 3. Diagnose | CTO + relevant Dev (via DM) | Root cause hypothesis with evidence |
| 4. Secure | Security | If breach/PII/abuse—follow security-compliance docs |
| 5. Communicate | Customer Success | Status draft for human to send |
| 6. Recover | DevOps | Service healthy; monitoring OK |
| 7. Postmortem | CTO | Timeline, root cause, actions; ticket follow-ups |
| 8. Human gate | Human | Approve any prod change / public statement |

## Severity

| SEV | Example |
|-----|---------|
| SEV1 | Full API/POS outage, payment outage |
| SEV2 | Major feature down for many tenants |
| SEV3 | Partial degradation |
| SEV4 | Minor / single tenant with workaround |

## Rules

- Prefer rollback over hot-fix on production when safe ([docs/BACKUP_ROLLBACK.md](../../BACKUP_ROLLBACK.md))
- Log actions in the incident ticket timeline
- Never paste production secrets into chat
- CS drafts only—human sends customer communications
