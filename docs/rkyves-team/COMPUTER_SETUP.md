# Grok Bot Cloud Computer Setup

Do this once on **Grok Bot desktop**. Mobile shares the same computer afterward.

## 1. Workspace layout

On the Agent Computer, create:

```text
/workspace/cullinos          # repository clone
/workspace/rkyves/tickets
/workspace/rkyves/briefs
/workspace/rkyves/artifacts
/workspace/rkyves/board.md
```

Clone Cullinos (use your GitHub remote):

```bash
cd /workspace
git clone https://github.com/ak2hay/cullinos.git cullinos
cd cullinos
git fetch origin
git checkout develop
git pull
```

Default read branch: **`develop`**. Feature work: `feature/<area>-short-desc` from `develop`. PRs target **`develop`** only ([CONTRIBUTING.md](../CONTRIBUTING.md)).

## 2. Connect GitHub

1. Open **Settings → Plugins** in Grok Bot.
2. Add/connect **GitHub** for the account that can push to `ak2hay/cullinos` (or your fork/org).
3. Prefer opening PRs over pushing to `develop`/`main`.

## 3. What to sign into (takeover flow)

Use computer takeover for logins—**do not paste passwords into chat**.

| OK to connect | Avoid on shared computer |
|---------------|---------------------------|
| GitHub | Production `.env` / `secrets-export.txt` |
| Staging Admin / docs sites | Production DB credentials |
| Public marketing analytics (read-only) | Live payment dashboard write access |
| | Customer WhatsApp/SMS senders |

Remember: **all bots share** browser sessions and files.

## 4. Enable repo skills

After the clone exists, skills under `.grok/skills/` are discoverable when working in the repo. In chat, type `/` and enable:

- `/rkyves-ceo`, `/rkyves-cto`, `/rkyves-dev-frontend`, `/rkyves-dev-backend`, `/rkyves-dev-flutter`
- `/rkyves-devops`, `/rkyves-security`, `/rkyves-qa`, `/rkyves-uiux`
- `/rkyves-seo`, `/rkyves-marketing`, `/rkyves-sales`, `/rkyves-cs`, `/rkyves-finance`, `/rkyves-docs`
- `/rkyves-orchestrate-e2e`

If a skill does not appear, `cd /workspace/cullinos && git pull` on `develop` (after these files are merged).

## 5. Cursor IDE (optional parallel)

This repo also has `.cursor/rules/` and `AGENTS.md` for coding in Cursor desktop. Same company rules; Grok Bot remains the org chart and phone command center.

## 6. Sanity check

Ask **Dev Backend**:

```
Confirm /workspace/cullinos is on develop, list apps/api/src/modules (top-level names only), and create an empty ticket /workspace/rkyves/tickets/setup-smoke.md using HANDOFF.md format with status done.
```

Then from phone, open that bot conversation and confirm the reply.
