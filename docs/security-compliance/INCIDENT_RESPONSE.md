# Data breach / security incident response (operational stub)

**Status:** Process documented for operators — legal DPDP breach notification timelines require counsel review.

## Immediate steps

1. Contain: rotate compromised credentials (JWT_SECRET, INTERNAL_API_KEY, ENCRYPTION_KEY, payment webhooks, SMTP).
2. Preserve evidence: audit logs, auth failure logs, payment webhook failures.
3. Assess scope: which personal data, which tenants, which systems.
4. Notify: Rkyves security owner + privacy contact (`privacy@rkyves.com`).
5. Remediate and document timeline.

## Contacts

- Privacy / grievance: privacy@rkyves.com
- See also: `docs/BACKUP_ROLLBACK.md`, `docs/DEPLOYMENT.md`
