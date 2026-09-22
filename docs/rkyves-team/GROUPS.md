# E2E Group Chats

Create these groups in **Grok Bot desktop** (New chat → select 2–6 Bots). Rename to the names below. Kickoff messages work from phone after groups exist.

Universal kickoff pattern:

```
Outcome: <what done looks like>
Owner this stage: @<Bot>
Playbook: docs/rkyves-team/PLAYBOOKS/<name>.md
Constraints: no prod deploy; PRs to develop only; no customer send without human approval
Done when: <acceptance>
Ticket: /workspace/rkyves/tickets/<id>.md
```

---

## 1. Feature Ship

**Members:** Rkyves CEO, Rkyves CTO, Dev Backend *(swap Dev Frontend / Dev Flutter as needed)*, QA, Documentation

**Create prompt (to CEO after bots exist):**

```
Create a group chat named "Feature Ship" with Rkyves CEO, Rkyves CTO, Dev Backend, QA, and Documentation.
Purpose: ship product features end-to-end with visible handoffs. Follow docs/rkyves-team/PLAYBOOKS/feature-e2e.md.
```

**Example kickoff (phone):**

```
@Feature Ship Outcome: Add FAQ stub on marketing web about GST on bills. Owner this stage: @Rkyves CTO. Playbook: feature-e2e. Constraints: plan only first—no merge. Done when: CTO posts plan + Dev Frontend assignment.
```

---

## 2. Bug Fix

**Members:** Customer Success, Dev Backend *(or Frontend/Flutter)*, QA

**Create prompt:**

```
Create a group chat named "Bug Fix" with Customer Success, Dev Backend, and QA.
Purpose: triage and fix bugs with repro → fix → verify. Follow docs/rkyves-team/PLAYBOOKS/bug-e2e.md.
```

**Example kickoff:**

```
@Bug Fix Outcome: Fix reported POS print failure on staging. Owner this stage: @Customer Success. Attach repro from ticket. Constraints: feature branch + PR to develop only.
```

---

## 3. Release

**Members:** Rkyves CTO, DevOps, QA, Documentation, Security

**Create prompt:**

```
Create a group chat named "Release" with Rkyves CTO, DevOps, QA, Documentation, and Security.
Purpose: develop→main readiness, rollback notes, release notes. Follow docs/rkyves-team/PLAYBOOKS/release-e2e.md.
```

**Example kickoff:**

```
@Release Outcome: Prepare staging→production checklist for current develop. Owner this stage: @Rkyves CTO. Constraints: human must approve any production deploy.
```

---

## 4. Growth Campaign

**Members:** Marketing, SEO, UI/UX, Dev Frontend

**Create prompt:**

```
Create a group chat named "Growth Campaign" with Marketing, SEO, UI/UX, and Dev Frontend.
Purpose: campaigns from brief → creative → web/landing changes. Follow docs/rkyves-team/PLAYBOOKS/campaign-e2e.md.
```

**Example kickoff:**

```
@Growth Campaign Outcome: Draft Diwali POS promo landing outline + SEO keywords. Owner this stage: @Marketing. Constraints: drafts only—no publish without human approval.
```

---

## 5. Incident

**Members:** DevOps, Security, Rkyves CTO, Customer Success

**Create prompt:**

```
Create a group chat named "Incident" with DevOps, Security, Rkyves CTO, and Customer Success.
Purpose: production/staging incidents—detect, contain, communicate, postmortem. Follow docs/rkyves-team/PLAYBOOKS/incident-e2e.md.
```

**Example kickoff:**

```
@Incident Outcome: Investigate API 5xx spike on staging. Owner this stage: @DevOps. Constraints: no production changes without human approval; CS drafts customer status only.
```

---

## Hiring groups in one message

After all bots exist, send to **Rkyves CEO**:

```
Using docs/rkyves-team/GROUPS.md, create these five group chats with the listed members: Feature Ship, Bug Fix, Release, Growth Campaign, Incident. Confirm each group name and members when done.
```
