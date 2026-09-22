# Rkyves Grok Bot Employee Team

AI teammates for Cullinos that behave like Rkyves employees. You assign work from the **Grok Bot phone app** (same Cursor account); bots collaborate in group chats, hand off via tickets, and ask you to approve merges, deploys, and customer-facing sends.

## Quick links

| Doc | Purpose |
|-----|---------|
| [HIRE.md](./HIRE.md) | **Start here** — desktop hire + phone smoke |
| [ROSTER.md](./ROSTER.md) | Paste-ready bot profiles (14 roles) |
| [GROUPS.md](./GROUPS.md) | Five E2E group chats + kickoffs |
| [ROUTINES.md](./ROUTINES.md) | Schedules (daily brief, security, QA, …) |
| [HANDOFF.md](./HANDOFF.md) | Ticket format + board paths |
| [COMPUTER_SETUP.md](./COMPUTER_SETUP.md) | Clone repo, GitHub, skills on cloud computer |
| [PLAYBOOKS/](./PLAYBOOKS/) | Feature, bug, release, campaign, incident |

Skills live in [`.grok/skills/`](../../.grok/skills/). Cursor IDE rules: [`.cursor/rules/`](../../.cursor/rules/). Company pointer: [`AGENTS.md`](../../AGENTS.md).

---

## Hire checklist (do once)

### A. Desktop — computer

1. Open Grok Bot **desktop** (phone alone cannot finish computer setup).
2. Follow [COMPUTER_SETUP.md](./COMPUTER_SETUP.md): clone Cullinos to `/workspace/cullinos` on `develop`, create `/workspace/rkyves/{tickets,briefs,artifacts}`, connect GitHub plugin.
3. Confirm `.grok/skills/` are present (`git pull` after this branch is on `develop`).

### B. Desktop — hire CEO

1. **New → Create new Bot** → name **`Rkyves CEO`**.
2. Edit Profile → paste **Job** + **Profile description** from [ROSTER.md](./ROSTER.md) (include universal guardrails).
3. Message CEO:

```
Read docs/rkyves-team/ROSTER.md in /workspace/cullinos.
Hire the full Rkyves roster: create or guide me to create every bot with the exact names and profile text from ROSTER.md.
Then create the five E2E groups from docs/rkyves-team/GROUPS.md.
Confirm the list of bots and groups when done. Do not deploy or merge anything.
```

4. For each suggested bot, open **Edit Profile** and ensure text matches ROSTER (fix if the bot shortened it).

### C. Desktop — routines

1. For each row in [ROUTINES.md](./ROUTINES.md), open the owning bot and paste the **Create message**.
2. Confirm next run times (IST).

### D. Phone — pin and smoke

1. Open Grok Bot on your phone (same Cursor account).
2. Pin **Rkyves CEO**, **Feature Ship**, **Bug Fix**, **Incident**.
3. Smoke E2E (plan only):

```
@Feature Ship Outcome: Add a stub FAQ entry on the marketing web about GST on restaurant bills.
Owner this stage: @Rkyves CTO
Playbook: docs/rkyves-team/PLAYBOOKS/feature-e2e.md
Constraints: plan only—no code merge, no production changes.
Done when: CTO posts a short plan citing apps/web paths and assigns Dev Frontend; ticket written under /workspace/rkyves/tickets/.
```

4. Approve or reject the plan; only then allow implement on a `feature/*` branch with PR to `develop`.

---

## Day-to-day (phone)

- **Prioritize:** message `Rkyves CEO` with outcomes and deadlines.
- **Ship a feature:** `@Feature Ship` + kickoff pattern from GROUPS.md.
- **Bug:** `@Bug Fix` or ask Customer Success to open a ticket first.
- **Outage:** `@Incident` immediately.
- **Approve:** when a bot asks for merge/deploy/send—review computer/PR, then approve in Grok Bot.

## Authority

| Allowed without asking | Needs your approval |
|------------------------|---------------------|
| Read repo/docs, draft plans, open feature branches, draft PRs to develop, draft replies | Merge to develop/main, production deploy, customer/social send, billing changes, force-push (never), secrets |

## Account limits

Grok Bot allows a limited number of bots + group chats combined (see product docs). This roster (14 bots + 5 groups) fits typical limits; hide idle bots instead of deleting if you need headroom.
