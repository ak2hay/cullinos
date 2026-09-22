# Routines

Create each routine on **Grok Bot desktop** by messaging the owning bot (mobile can pause/resume later). Time zone: **Asia/Kolkata (IST)**.

Test the skill once as a one-off task before enabling the routine.

---

## 1. Daily brief

| Field | Value |
|-------|-------|
| Owner | Rkyves CEO |
| Schedule | Weekdays 08:00 IST |
| Skill | `/rkyves-ceo` (daily brief section) |
| Output | Post in CEO conversation (and pin summary for human) |

**Create message:**

```
Every weekday at 08:00 Asia/Kolkata, run the Rkyves CEO daily brief skill.
Pull: open P0/P1 tickets under /workspace/rkyves/tickets/, any notes in /workspace/rkyves/briefs/, and known staging/prod risks from recent handoffs.
Deliver: (1) yesterday outcomes, (2) today's top 3 priorities, (3) blockers needing human, (4) suggested group assignments.
If sources are missing, say what is missing—do not invent KPIs. Do not contact anyone externally.
```

---

## 2. Weekly security digest

| Field | Value |
|-------|-------|
| Owner | Security |
| Schedule | Monday 09:00 IST |
| Skill | `/rkyves-security` |
| Output | Security conversation + ticket if action needed |

**Create message:**

```
Every Monday at 09:00 Asia/Kolkata, run the Rkyves Security weekly digest.
Review .github/workflows/security.yml expectations, note dependency/compliance deltas against Rkyves_Security_Compliance_Master_Requirements.md, and flag secrets-handling risks.
Deliver a short report with severity-ordered findings and recommended owners (CTO/DevOps/Dev Backend). Do not change production or disable checks.
```

---

## 3. Daily QA regression pulse

| Field | Value |
|-------|-------|
| Owner | QA |
| Schedule | Daily 18:00 IST |
| Skill | `/rkyves-qa` |
| Output | QA conversation; open tickets for failures |

**Create message:**

```
Every day at 18:00 Asia/Kolkata, run a light regression pulse using docs/qa/README.md and docs/qa/QUICK_REFERENCE_CARD.md.
List smoke areas that should be verified on staging after today's merges; if /workspace/rkyves/tickets/ has ready-for-qa items, prioritize those.
Produce a checklist and file bugs in HANDOFF format for failures. Do not mark release-ready without evidence.
```

---

## 4. Release notes draft

| Field | Value |
|-------|-------|
| Owner | Documentation |
| Schedule | Ask manually before develop→main (or Fri 16:00 IST optional) |
| Skill | `/rkyves-docs` |

**Create message (scheduled optional):**

```
Every Friday at 16:00 Asia/Kolkata, draft release notes from merged feature/* work summarized in /workspace/rkyves/tickets/ and recent PR titles if available.
Format for humans: What changed, Who is affected (Admin/POS/KDS/Guest/Waiter/API), Migration/ops notes, Known issues.
Do not claim unshipped features. Post draft in Documentation conversation and notify @Release group if material.
```

---

## 5. Weekly tech risk digest

| Field | Value |
|-------|-------|
| Owner | Rkyves CTO |
| Schedule | Friday 17:00 IST |
| Skill | `/rkyves-cto` |

**Create message:**

```
Every Friday at 17:00 Asia/Kolkata, publish a weekly tech debt and risk digest for Cullinos.
Cover: multi-tenant/security risks, payment/GST hotspots, deploy/rollback concerns, and suggested next-week engineering priorities for CEO.
Cite docs/ARCHITECTURE.md and open tickets. No merges or deploys.
```

---

## Routine hygiene

- Pause routines before long travel if on-demand usage is a concern.
- After changing a skill in `.grok/skills/`, re-run the one-off task once, then leave the routine as-is (skills load from repo when the computer has the clone).
- Deleting a bot deletes its routines—hide instead if unsure.
