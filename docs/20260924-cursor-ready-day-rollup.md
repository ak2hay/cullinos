# Cursor-ready report — Cullinos day rollup 2026-09-24

| Field | Value |
|-------|--------|
| Date (IST) | 2026-09-24 (sources from ~03:00 through 15:26 checkpoint + morning CEO brief) |
| Trigger | human ask: combine today’s reports since 3am into single Cursor pack |
| Mode | **Advisory only** — implement in **LOCAL Cursor**; human deploys |
| GitHub | Review-only `ak2hay/cullinos`; tip observed **main@695c87b** (no tip/deploy delta across day) |
| Produced by | Rkyves CEO / Cullinos Review Docs (executor rollup) |
| Bot code changes | **None** — no Cloud Agent, no deploy, no secrets |

**Authority for §1:** multi-bot analysis (`20260924-cursor-ready-multi-bot-analysis.md`) + latest checkpoint (`20260924-checkpoint-1526-github-portal.md`). Older packs (03:46 task pack, fix suggestions, admin smokes) folded into T1…T10 without contradiction.

**Reconfirmed P0s (deduplicated):** money mismatch, KDS vs Admin, guest Play 404, health `commit: unknown` — observed at **03:46**, **09:26**, and **15:26** IST. GitHub `main` stayed `695c87b` all day; no human-reported redeploy after ~03:07 IST.

---

## 0. Executive summary (10 lines max)

1. Cross-lane consensus: **money truth, kitchen truth, and release attestation** block trustworthy demos/go-live.
2. **Order ₹460 lines vs ₹543 total** (Order 0002; both #0001/#0002 list ₹543 by 15:26) with no tax breakdown — Finance: order path may hardcode ~5% and skip `packages/tax-engine`; cite tax-engine only, never invent GST %.
3. **KDS stays NEW** (K0001/K0002; ~12h overdue by 15:26) while Admin shows **#0002 COMPLETED**.
4. **API health `commit: unknown`** all day — cannot attest whether kitchen/sync org-scope (GitLab develop) is on the live tip.
5. **Guest/order Play handoff 404**; Waiter Android-only; `guest`/`marketing` DNS fail — demo killers.
6. **Payments:** mid-pay fail when Razorpay unset; platform SaaS keys must not equal tenant diner settlement; Cashfree not in code — do not promise.
7. **Security P0/P1 on GH tip:** kitchen/sync may lack org-scope vs GitLab; OTP sandbox skip fail-closed for Live; Labs SQL step-up; remember-me default off.
8. **Marketing/SEO:** soften GST claims; remove fake testimonials; no CTAs to dead hosts; feature landings human-gated.
9. **Docs:** ARCHITECTURE/DEPLOYMENT still claim k3s/auto-CD; live SoT is Compose + manual gate.
10. **Recommended Cursor order:** T1 → T2 → T3 → T7 (security if tip lacks org-scope) → T4 → T6 → T10 → T5 (if code path) → T8 → T9. Staging DNS/TLS = human-only (§3).

---

## 1. Cursor paste pack (prioritized tasks T1…T10)

*Paste one task at a time into LOCAL Cursor on the deploy-to-prod tree. Every task: `organizationId` tenant scope; never invent GST/tax/GSTIN/payment behavior — cite `packages/tax-engine` and payments only; no secrets.*

### TASK T1 — Order money truth + tax breakdown (P0)

```
Work in THIS local Cullinos repo (the one we deploy to production). Production-ready fix.

Problem:
Admin order detail shows line items totaling ~₹460 but grand total ~₹543 with no tax/fee breakdown.
Order 0002 (Masala Chai + Paneer Tikka): lines ₹140+₹320=₹460 vs header ₹543. By 15:26 IST both #0001 and #0002 list totals show ₹543.
Finance review: orders path may hardcode tax (e.g. rate = 5) and skip @cullinos/tax-engine / org TaxGroups;
mapOrderToClient may omit taxLines even if schema has OrderTaxLine. Breaks GST trust for demos and support.

Reproduce:
1. Admin → Orders → open completed cash takeaway with India tax presets (e.g. Order 0002).
2. Sum line amounts vs displayed total (~₹83 gap).
3. Confirm tax lines missing in UI and/or wrong vs tax-engine.

Required outcome:
- Server total reconciles: lines + tax (+ tip − discount) within ₹0.01 using tax-engine + org TaxGroups (caller-supplied rates only — NEVER invent GST %).
- API exposes taxLines (or equivalent) for Admin/POS.
- Admin order detail UI: subtotal → each tax/fee line → grand total (JetBrains Mono or existing money style).
- Tests for calculateOrderTax / mapping if patterns exist.

Constraints:
- organizationId tenant scope everywhere.
- Cite packages/tax-engine (or path in this repo) only — no invented GSTIN/rates.
- No secrets; no prod deploy from agent.

Done when:
- [ ] Smoke order: sum(lines)+taxLines == displayed total
- [ ] No hardcoded demo tax rate left on the live order path you touch
- [ ] Safe to deploy with my normal production process
```

**Evidence reconfirmed:** 03:46, 09:26, 15:26 IST checkpoints. Ticket: `20260924-order-total-breakdown`. Cites: `packages/tax-engine`, `apps/api/.../orders.service.ts` (`calculateOrderTax`), `order-items.util.ts` (`mapOrderToClient`), `apps/admin/.../OrdersPage.tsx`.

---

### TASK T2 — KDS status sync when Admin/POS completes (P0)

```
Work in THIS local Cullinos repo (deploy-to-prod tree). Production-ready fix.

Problem:
Admin shows order COMPLETED while KDS still shows matching KOTs as NEW. Kitchen and Admin disagree — unsafe for service and demos.
Evidence: Admin #0002 COMPLETED; KDS K0001/K0002 (later labeled #K0001/#K0002) stay NEW; by 15:26 red ~12h overdue timers while still NEW.

Reproduce:
1. Place POS order that creates a KDS ticket.
2. Complete/close order from Admin (or prod completion path).
3. Refresh KDS — ticket still NEW.

Required outcome:
- Single Order ↔ KOT/KDS status flow.
- Terminal order states (COMPLETED/CANCELLED — existing enums) must clear or advance KDS tickets off NEW.
- Prefer existing realtime/sync; do not invent a second status vocabulary.
- Keep organizationId / prior kitchen org-scope protections intact.

Done when:
- [ ] Completing an order leaves no NEW KDS ticket for that KOT
- [ ] Cancel does not leave orphan NEW tickets
- [ ] Safe for production deploy after my verify
```

**Evidence reconfirmed:** 03:46, 09:26, 15:26 IST. Ticket: `20260924-kds-admin-status-sync`.

---

### TASK T3 — Bake real git SHA into API health (P0 chore)

```
Work in THIS local Cullinos repo. Production-ready fix.

Problem:
Live GET https://api.cullinos.com/api/v1/health returns version 0.1.1 with commit: "unknown" at 03:46, 09:26, and 15:26 IST.
Tip health.controller.ts: commit = process.env.GIT_COMMIT ?? process.env.DEPLOY_COMMIT ?? "unknown" — neither env set on VM.
Cannot attest which build runs or whether kitchen IDOR fixes are present. package.json may say 0.1.0 while health hardcodes 0.1.1 (P2 version SoT drift — fix if touching).

Required outcome:
- Production build/deploy injects real git SHA (GIT_COMMIT / DEPLOY_COMMIT), preferably build-arg bake.
- Health returns that SHA after my deploy.
- Brief note in docs/DEPLOYMENT.md for Compose + manual deploy (do not claim k3s auto-CD).

Done when:
- [ ] After my normal prod deploy, health.commit is a real SHA
- [ ] Documented how SHA is baked in my deploy path
```

**Evidence reconfirmed:** 03:46, 09:26, 15:26 IST. Ticket: `20260924-health-commit-sha`.

---

### TASK T4 — Payments empty-state honesty + platform vs tenant Razorpay (P1)

```
Work in THIS local Cullinos repo. Production-ready fix (UX + architecture alignment).

Problem:
POS/guest mid-pay errors when Razorpay/Cashfree credentials unset. Finance: platform SaaS RazorpayClient keys must not be used for tenant diner settlement; Cashfree not implemented in code — do not promise it.
Portal: “Online payments are not configured. Add Razorpay or Cashfree…” while Cashfree has no adapter.

Required outcome:
- If tenant diner gateway unset: hide/disable online tenders; clear empty state (“configure Razorpay under Payments” or cash-only demo mode) — no mid-pay hard fail.
- Separate platform SaaS billing keys from tenant diner settlement keys; fail closed if tenant unset for diner online pay.
- Remove or soften Cashfree UI/copy where code has no adapter.
- Never commit secrets; human injects keys.

Done when:
- [ ] Unconfigured tenant cannot reach a cryptic mid-pay failure
- [ ] Code paths do not use platform SaaS keys for diner capture
- [ ] Copy matches implemented gateways only
```

**Cites (Finance):** `payments.service.ts`, `razorpay.client.ts`, `saas-billing.service.ts`, AGENTS.md platform vs diner policy. organizationId for tenant key resolution.

---

### TASK T5 — Admin outlet “No details” after Settings save (P1)

```
Work in THIS local Cullinos repo. Production-ready fix IF the code path still exists.

Problem:
At 03:46 IST: Settings showed restaurant/address saved, but Main Outlet / location card still showed “No details” after reload.
At 09:26 and 15:26: “No details” card NOT reproduced — address lived in Settings; second miss. Still fix if mapping/query/persistence path exists in code; do not invent a bug if UI was removed.

Required outcome:
- After save, card shows address/city/phone (or honest empty CTA “Add outlet details”), never false “No details” when data exists.
- Fix mapping, query, or persistence as needed; organizationId scoped.

Done when:
- [ ] Save Settings → reload → card shows details or actionable empty state (or confirm path gone + no dead code)
- [ ] Safe for production deploy
```

**Note:** De-prioritize vs T1–T4 if repro fails locally; ticket `20260924-admin-outlet-no-details` remains ready for code-path audit.

---

### TASK T6 — Guest / order / Waiter handoff honesty (P1)

```
Work in THIS local Cullinos repo + ops notes for human DNS.

Problem:
order.cullinos.com Play/handoff 404 (reconfirmed 03:46, 09:26, 15:26); guest.cullinos.com DNS fail; Waiter web Android-only dead-end — breaks demos, SEO/QR promotion, CS onboarding.

Required outcome (product):
- No dead Play URL; honest “app coming soon” or working store/web path.
- Waiter: web login for desktop QA OR explicit Android-only banner + waiter web URL for iOS.
- Do not market seamless QR→pay→kitchen as live until proven.

Ops (human — also §3): fix or decommission guest/marketing DNS; 301 marketing subdomain to apex if retired.

Done when:
- [ ] No 404 Play destination from order handoff
- [ ] Desktop users are not dumped into a silent dead-end
```

---

### TASK T7 — Security harden on deploy tip (P0/P1) — includes Security T-A…T-E

```
Work in THIS local Cullinos repo (the tree you deploy). Production-ready hardenings.
VERIFY YOUR tip first: GitHub main@695c87b may lack kitchen/sync org-scope that GitLab develop had; live SHA still unknown.

Problems (Security brief):
1) Kitchen/sync may still be unscoped on GitHub tip / some deploys (IDOR) while GitLab develop had org-scope — verify YOUR tip.
2) Sandbox OTP skip can apply under NODE_ENV=production for mis-labeled tenants.
3) Labs SQL: cross-tenant SELECT risk; need step-up + read-only DB role.
4) “Keep me signed in” default ON (Manage/Platform).

Required outcomes (split PRs if needed):
- T-A (P0): Kitchen/sync org-scope if missing — cross-org patch 404; sync ignores body organizationId; display not unauthenticated-by-outletId alone.
- T-C (P0): Live tenants never skip OTP; sandbox opt-in only (explicit true); refuse AUTH_SKIP in true prod.
- T-D (P1): Labs MFA/step-up + RO role verification.
- T-E (P1/P2): Remember-me default unchecked on Manage/Platform.

Constraints: no secrets in repo; organizationId everywhere; no Dependabot Nest12/Prisma7 majors in this work.

Done when: Security checklist items above pass on your deploy tip after you verify.
```

Optional follow-ons (not blocking T1–T3): T-F residual organizationId controller sweep; T-G token storage accept-risk or HttpOnly plan (human gate).

---

### TASK T8 — Marketing / SEO proof alignment (P1/P2)

```
Work in THIS local Cullinos web/marketing surfaces. Production-ready honesty fixes.

Problem:
Site may overclaim GST “built-in” while order path not fully on tax-engine; possible invented testimonials; feature landings missing; www vs apex dual 200; dead marketing subdomain links; /faq may still 404 on prod while develop has stub.

Required outcome:
- Soften GST copy to proven behavior only (line types when tax-engine live — no compliance theatre).
- Remove invented testimonials or CMS-gate real quotes only.
- CTAs → /contact?intent=trial (or real contact); never link marketing.cullinos.com until fixed.
- Canonical host policy (prefer apex) + 301 the other (DevOps/human DNS).
- Feature pages only after human unlock + real screenshots — do not publish empty shells.
- noindex broken order/Play until fixed (SEO).

Done when:
- [ ] Prod marketing cannot be caught inventing GST/testimonials
- [ ] No CTAs to dead hosts
```

---

### TASK T9 — UX polish pack (P2)

```
Local Cullinos — production-ready polish (batch after P0/P1):

1) Menu “No photo” → dashed upload CTA + “Items without photos” filter; NO stock food images.
2) Staff phone label → role-correct (not “Waiter OTP login” for all).
3) Address truncation → wrap/hover/expand full string.
4) Admin nav density → trim defaults by portal mode / restaurant size.
5) (Optional) POS long item name truncation polish.

Brand: packages/ui only (charcoal/amber). Done when: each item smoke-checked in Admin after deploy.
```

---

### TASK T10 — Docs Compose SoT (P1 chore)

```
Work in THIS local Cullinos repo. Production-ready docs (operators read these to deploy).

Problem:
ARCHITECTURE.md / DEPLOYMENT.md still describe k3s + GHCR auto staging/prod CD in places. Real ops: Docker Compose on a VM, human-gated production deploy from this local tree. Carry-over confirmed at 03:46, 09:26, 15:26.

Required outcome:
- Docs SoT: primary = Docker Compose + nginx + manual/human prod deploy.
- Mark k3s/GHCR auto-CD as aspirational/future (or remove if obsolete).
- Do not change live infra in this task — docs only, but accurate for how I actually ship.
- Align any health-SHA bake notes with T3.

Done when:
- [ ] New reader would not expect auto prod CD
- [ ] Compose + manual deploy is clearly primary
```

**Ticket:** `20260924-docs-compose-sot` (morning pack T5 → day-rollup **T10**).

---

## 2. Lane inputs (every bot that applies)

### CEO
Ship money truth (T1), KDS sync (T2), health SHA (T3) before any “GST-native / go-live” marketing. Keep all bots advisory; human local Cursor → prod. Day priorities from morning brief: (1) money+kitchen, (2) staging unlock for QA, (3) health SHA + Compose docs. Do not undo security merges on remotes that protect IDOR/secrets if local tip still needs them.

### CTO
N/A this day for a dedicated brief — pull in on implement if human wants architecture risk review on T1 (tax-engine wiring) / T7 (tip divergence kitchen/sync). Note: GH main/develop diverged (main 5 ahead / develop 6 behind of each other); GitLab develop `b70d81b` richer on security/staging — human sync policy before FF.

### Security
P0: attest tip SHA (T3); port kitchen/sync org-scope if missing on deploy tip (T7 T-A); OTP skip fail-closed for Live (T-C). P1: Labs step-up + RO (T-D); residual organizationId sweep. P2: remember-me default off (T-E); token storage accept-risk or HttpOnly plan. Tree split: GH `695c87b` may regress kitchen/sync vs GitLab develop. No blind FF remotes; no secret printing; Dependabot Nest12/Prisma7/Zod4 deferred. KDS `customerName` residual: ACCEPT (not reopened).

### QA
Repro pack: Order 0002 ₹460 vs ₹543; KDS NEW after Admin COMPLETED; health commit unknown; Play 404. Post-deploy verify §4. Staging smoke sheet (`RUN-20260923-post-sec-smoke`) still blocked on human staging URL. organizationId on all cases.

### UI/UX
P0: tax breakdown UI (T1); guest/Waiter dead-ends (T6). P1: outlet card if path exists (T5); menu photos CTA; staff OTP label; keep-signed-in default off (folds into T7 T-E / T9). P2: nav density; address truncation. Brand: `packages/ui` only; no fake photos/GST.

### Dev Frontend (advisory)
Admin order detail breakdown UI; outlet card mapping; menu empty photo CTA; staff OTP labels; Manage/Platform remember-me default; marketing testimonials/GST copy soft; Waiter/order landing honesty. No commits from bots.

### Dev Backend (advisory)
Wire `calculateOrderTax` → tax-engine + org TaxGroups; expose taxLines in `mapOrderToClient`; Order↔KOT status machine; kitchen/sync org-scope if missing on tip; diner Razorpay per-organizationId vs platform SaaS keys. No invented rates.

### Dev Flutter (advisory)
Guest/Waiter Android-only / Play 404 honesty; iOS/web fallback messaging. No commits.

### DevOps
Bake GIT_COMMIT/DEPLOY_COMMIT (T3); Compose deploy path docs (T10); DNS/TLS for guest/marketing/staging (human); Vite fail-close already on tip `695c87b` — confirm on next SPA redeploy. Do not merge Dependabot majors onto prod tip.

### Documentation
T10 Compose SoT; optional restore `docs/PRODUCT.md` as claim SoT (Finance/Marketing P2) — cite shipped vs planned only.

### SEO
P0 hosts: marketing + guest DNS; noindex broken order/Play until fixed. P1: www↔apex canonical; sitemap + India/POS/GST-led home meta (soft GST); feature landings after human unlock (POS → Billing → KDS → QR → Inventory). Do not invent ratings/Petpooja/e-invoice.

### Marketing
Keep OS positioning; soft GST until tax-engine on order path; kill fake testimonials; no seamless QR→pay claim; CTA on apex only; feature pages after human unlock. Campaigns draft-only — no external send.

### Sales
Demo killers = mid-pay fail, guest 404/DNS, total mismatch, Waiter desktop dead. Demo script: open shift first; cash-only until gateway sandbox; skip Play/guest until fixed. Pricing: cite published web only; book-demo CTA; never send outreach without human.

### Customer Success
Support load follows T1/T2/T4. Need Day-0 checklist SOP; Pay later vs Pay now macro; GSTIN optional education; Waiter iOS = web. Draft macros only — never message tenants. Track time-to-first-order and theme ticket volume.

### Finance
P0: reconcile totals + taxLines UI; wire tax-engine (stop hardcoded 5%); separate SaaS vs diner Razorpay. P1: honest online tender empty state; GSTIN only if set; health SHA; POS cart tax preview. Metrics (per organizationId, do not invent): reconciliation rate, taxLines coverage, GSTIN fill, tender mix. No invented MRR/GSTIN/Cashfree.

### Cullinos Review Docs
This day rollup + INDEX; checkpoints 0346/0926/1526; multi-bot analysis; Cursor task pack 0346; admin setup/tax smoke; screenshots under `artifacts/reviews/screenshots/` (`checkpoint-0346-*`, `20260924-0926-*`, `20260924-1526-*`).

---

## 3. Out of scope / human-only

| Item | Why |
|------|-----|
| Razorpay/Cashfree live keys / webhook secrets | Human secrets — never in Cursor chat/repo |
| Real GSTIN | Human only; blank on demo is correct |
| Live DNS / TLS / prod deploy | Human gate |
| Staging first-live (DNS/TLS/unique non-prod secrets + first staging deploy) | Human gate — prefer non-prod host, not prod VM; unlocks QA smoke. Docs-only checklist OK under T10; not a Cursor product-code task |
| Bot Cloud Agents on GitHub | Not default; advisory only |
| Tenant outreach / social posts / campaign publish | Human approval |
| Invented GST rates or tax advice | Forbidden |
| Blind GitHub↔GitLab force-sync | Human sync policy |
| Dependabot Nest12 / Prisma7 / Zod4 majors onto prod tip | Deferred until staging |
| Collect SaaS payment / refunds / plan changes | Finance hard stop |
| KDS `customerName` residual reopen | Security ACCEPT already recorded |
| SEO Wave 1 feature-page publish order | Human unlock (default POS→Billing→KDS→QR→Inventory) |

---

## 4. Verify after your deploy

1. Place cash order → Admin detail: lines + taxLines = total (within ₹0.01); no silent ₹83-class gap.
2. Complete order from Admin → KDS ticket leaves NEW (no orphan NEW; overdue timer not stuck on completed order).
3. `GET https://api.cullinos.com/api/v1/health` → real `commit` SHA matching what you deployed.
4. Online tender with gateway unset → clear empty state, not mid-pay crash; copy does not promise Cashfree unless implemented.
5. Settings save → outlet card shows details **or** confirmed honest Settings-only UX (T5).
6. order/guest/waiter paths → no Play 404; honest Waiter messaging for desktop/iOS.
7. Marketing home → no fake testimonials; no link to dead `marketing.cullinos.com`; GST copy soft until tax-engine proven.
8. If T7 applied: cross-org kitchen patch 404; Live org OTP not skipped; Manage/Platform remember-me default unchecked.
9. Docs: new reader sees Compose + manual deploy as primary (T10).
10. All checks scoped to the correct **organizationId** / demo org (Rkyves Demo Kitchen).

---

## 5. Sources (every source file used)

### Reviews
- `/workspace/rkyves/artifacts/reviews/20260924-checkpoint-0346-github-portal.md`
- `/workspace/rkyves/artifacts/reviews/20260924-checkpoint-0346-fix-suggestions.md`
- `/workspace/rkyves/artifacts/reviews/20260924-cursor-task-pack-checkpoint-0346.md`
- `/workspace/rkyves/artifacts/reviews/20260924-cursor-ready-multi-bot-analysis.md`
- `/workspace/rkyves/artifacts/reviews/20260924-checkpoint-0926-github-portal.md`
- `/workspace/rkyves/artifacts/reviews/20260924-checkpoint-1526-github-portal.md`
- `/workspace/rkyves/artifacts/reviews/20260924-admin-portal-setup-manual-ux.md`
- `/workspace/rkyves/artifacts/reviews/20260924-admin-tables-tax-apps-smoke.md`
- `/workspace/rkyves/artifacts/reviews/CURSOR-READY-REPORT-TEMPLATE.md`
- `/workspace/rkyves/artifacts/reviews/INDEX.md` (updated with this doc)

### Briefs
- `/workspace/rkyves/briefs/2026-09-24-ceo-daily-brief.md`
- `/workspace/rkyves/briefs/2026-09-24-ceo-marketing-lane-brief.md`
- `/workspace/rkyves/briefs/20260924-uiux-smoke-advisory.md`
- `/workspace/rkyves/briefs/lane-inbox/20260924-sales.md`
- `/workspace/rkyves/briefs/lane-inbox/20260924-customer-success.md`
- `/workspace/rkyves/briefs/lane-inbox/20260924-seo.md`
- `/workspace/rkyves/briefs/lane-inbox/20260924-received.txt`
- `/workspace/rkyves/briefs/lane-inbox/20260924-marketing.md` (symlink/copy of marketing brief)
- `/workspace/rkyves/briefs/lane-inbox/20260924-finance.md` (symlink/copy of finance brief)
- `/workspace/rkyves/briefs/lane-inbox/20260924-security.md` (symlink/copy of security brief)
- `/workspace/rkyves/briefs/lane-inbox/20260924-uiux.md` (symlink/copy of UI/UX brief)

### Other artifacts
- `/workspace/rkyves/artifacts/20260924-security-lane-multi-bot-brief.md`
- `/workspace/rkyves/artifacts/20260924-finance-cullinos-ceo-brief.md`
- `/workspace/rkyves/artifacts/20260924-daily-qa-regression-pulse.md` (listed on disk; not primary authority for §1)

### Tickets (reference only — no new implementation invented)
- `/workspace/rkyves/tickets/20260924-order-total-breakdown.md`
- `/workspace/rkyves/tickets/20260924-kds-admin-status-sync.md`
- `/workspace/rkyves/tickets/20260924-health-commit-sha.md`
- `/workspace/rkyves/tickets/20260924-admin-outlet-no-details.md`
- `/workspace/rkyves/tickets/20260924-docs-compose-sot.md`

### Live surfaces cited (observation only)
- `https://api.cullinos.com/api/v1/health` — ok / 0.1.1 / commit unknown (all three checkpoints)
- Admin / POS / KDS / Waiter / order / manage / platform / cullinos.com — portal smokes
- Screenshots: `/workspace/rkyves/artifacts/reviews/screenshots/` (`checkpoint-0346-*`, `20260924-0926-*`, `20260924-1526-*`)

---

*End of day rollup — advisory only; human implements in LOCAL Cursor and deploys. No bot code changes, no Cloud Agent, no secrets.*
