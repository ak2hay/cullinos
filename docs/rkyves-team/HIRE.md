# Hire the Rkyves team (cheat sheet)

Full detail: [README.md](./README.md). Do **desktop** steps first; then use **phone**.

## Desktop (required once)

1. [COMPUTER_SETUP.md](./COMPUTER_SETUP.md) — clone to `/workspace/cullinos` on `develop`, create `/workspace/rkyves/*`, connect GitHub.
2. Create bot **`Rkyves CEO`** — paste profile from [ROSTER.md](./ROSTER.md).
3. Send to CEO:

```
Read docs/rkyves-team/ROSTER.md in /workspace/cullinos.
Hire the full Rkyves roster with exact names and profile text from ROSTER.md.
Create the five E2E groups from docs/rkyves-team/GROUPS.md.
Confirm bots + groups. Do not deploy or merge.
```

4. Fix any Edit Profile drift so names match ROSTER exactly.
5. Create routines from [ROUTINES.md](./ROUTINES.md) (paste each Create message to the owner bot).

## Phone

1. Same Cursor account → pin **Rkyves CEO**, **Feature Ship**, **Bug Fix**, **Incident**.
2. Smoke (plan only):

```
@Feature Ship Outcome: Add a stub FAQ entry on the marketing web about GST on restaurant bills.
Owner this stage: @Rkyves CTO
Playbook: docs/rkyves-team/PLAYBOOKS/feature-e2e.md
Constraints: plan only—no code merge, no production changes.
Done when: CTO posts a short plan citing apps/web paths and assigns Dev Frontend; ticket under /workspace/rkyves/tickets/.
```

3. Only after you approve the plan: allow implement on `feature/*` with PR to `develop`.

## You always approve

Merge · production deploy · customer/social send · billing changes
