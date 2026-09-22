# Playbook: Feature Ship

**Group:** Feature Ship  
**Skill:** `/rkyves-orchestrate-e2e`

## Stages

| Stage | Owner | Exit criteria |
|-------|-------|---------------|
| 1. Intake | CEO | Ticket filed; priority set; group kicked off |
| 2. Plan | CTO | Tech plan with apps/packages touched, risks, test notes |
| 3. Implement | Dev Frontend / Backend / Flutter | Feature branch + PR to `develop` (or draft PR) |
| 4. Review | CTO (+ Security if auth/payments/PII) | Review comments addressed or waived with reason |
| 5. Verify | QA | Checklist from docs/qa; bugs filed or pass |
| 6. Document | Documentation | User-facing notes / changelog draft |
| 7. Human gate | Human | Approve merge; staging validation; later develop→main |

## CEO intake checklist

- [ ] Outcome and Done when are clear
- [ ] Right Dev lane chosen (FE / BE / Flutter / multi)
- [ ] Constraints include: PR to develop only, no prod deploy

## CTO plan template

- Problem / user story
- Files/areas (cite paths)
- Multi-tenant / GST / payments impact
- Rollout / feature flag needs
- QA focus areas
- Suggested branch name: `feature/<area>-slug`

## Stop conditions

- Blocked on product decision → CEO + human
- Security P0 → add Security, pause implement
- Scope creep → CEO re-prioritize; update ticket
