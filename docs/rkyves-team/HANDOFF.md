# Handoff Protocol

Bots share one Grok Bot cloud computer. Pass work via **group chat**, **DM handoff**, and **ticket files**—not by pasting secrets.

## Paths on the cloud computer

```
/workspace/cullinos/              # git clone of this repo
/workspace/rkyves/
  tickets/                        # one markdown ticket per work item
  briefs/                         # CEO / marketing briefs
  artifacts/                      # screenshots, exports (no secrets)
  board.md                        # optional status board
```

## Ticket file format

Filename: `/workspace/rkyves/tickets/YYYYMMDD-short-slug.md`

```markdown
# <Title>

- **id:** YYYYMMDD-short-slug
- **status:** backlog | assigned | in_progress | review | ready_for_qa | blocked | done | cancelled
- **priority:** P0 | P1 | P2 | P3
- **type:** feature | bug | release | campaign | incident | chore
- **owner_bot:** <exact Grok Bot name>
- **requester:** human | <bot>
- **group:** Feature Ship | Bug Fix | Release | Growth Campaign | Incident | none
- **branch:** feature/<area>-slug | n/a
- **pr:** <url or none>
- **created:** ISO-8601
- **updated:** ISO-8601

## Outcome
What "done" means.

## Context
Links to docs, screenshots under /workspace/rkyves/artifacts/, related tickets.

## Constraints
- PRs to develop only
- No production deploy without human
- …

## Acceptance criteria
- [ ] …

## Timeline
| When | Bot | Action | Result |
|------|-----|--------|--------|
| … | … | … | … |

## Blockers
…

## Human approvals needed
- [ ] Merge
- [ ] Deploy
- [ ] Customer message
- [ ] Other: …
```

## Status board (`board.md`)

Optional rolling summary:

```markdown
# Rkyves board

| id | status | owner | priority | title |
|----|--------|-------|----------|-------|
| 20260322-gst-faq | in_progress | Dev Frontend | P2 | GST FAQ stub |
```

CEO and orchestrate skill keep this updated when running E2E.

## Handoff rules

1. **One owner at a time** — set `owner_bot` before DM/group ping.
2. **Update the ticket** before handing off (status + timeline row).
3. **Group for E2E** — Feature Ship / Bug Fix / etc.; DM for specialist deep work.
4. **Cite paths** — `apps/...`, `docs/...`, never paste `.env` contents.
5. **Blocked** — set status `blocked`, name the human decision needed, ping CEO if priority ≥ P1.

## Status meanings

| Status | Meaning |
|--------|---------|
| backlog | Not started |
| assigned | Owner accepted |
| in_progress | Actively working |
| review | Peer/CTO review |
| ready_for_qa | Build ready for QA |
| blocked | Needs human or another bot |
| done | Acceptance met |
| cancelled | Won't do |
