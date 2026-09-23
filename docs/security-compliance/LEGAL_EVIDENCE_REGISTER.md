# Legal Evidence Register (Cullinos / Rkyves)

**Purpose:** Lightweight evidence slots for §48 Legal Guide requirements.  
**Rule:** Do not mark Legal items `VERIFIED` in `Rkyves_Security_Compliance_Master_Requirements.md` until the matching slot has dated evidence and (where required) counsel review.

| Slot | Status | Evidence / link | Date | Owner notes |
|---|---|---|---|---|
| Terms of Service version | Page published | https://cullinos.com/terms (`apps/web/src/app/terms`) | — | Counsel review pending |
| Privacy Policy version | Page published | https://cullinos.com/privacy (`apps/web/src/app/privacy`) | — | Must match live processing |
| Cookie / tracking consent | Implemented | `apps/web` CookieBanner + Cloudflare Analytics gate | — | — |
| Personal data inventory | Draft | Requirements MD §1 inventory table | — | Counsel |
| Third-party / SDK inventory | Incomplete | Guest Firebase, MSG91, Razorpay/Cashfree, Cloudflare | — | Expand per store SDK audit |
| Google Play Data Safety | In progress | [`PLAY_STORE_CHECKLIST.md`](../guest-app/PLAY_STORE_CHECKLIST.md) | — | Console submission pending |
| Apple App Privacy | Not started | — | — | If iOS guest ships |
| Trademark / IP search (IN + markets) | Blocked | — | — | Owner: IP India + store name search |
| Asset / software licenses | Incomplete | Package lockfiles + font licenses | — | Document commercial fonts/images |
| Payment / refund / subscription terms | Partial | `/terms` + privacy sub-processors | — | Counsel |
| IAP applicability | N/A (justified) | Guest uses Razorpay/Cashfree web, not Apple/Google IAP | — | Reassess if IAP added |
| Marketing consent + unsubscribe test | Implemented (not verified) | `/unsubscribe`, List-Unsubscribe headers, `SMTP_MARKETING_FROM_*` | — | Evidence of consent records |
| Children's privacy applicability | Blocked | Policy under-18 text only; no age gate | — | Product decision |
| AI disclosure applicability | N/A (justified) | No runtime user-facing LLM | — | Reassess when AI ships |
| Accessibility assessment | Partial | Ad-hoc aria/alt; no axe CI | — | WCAG scope TBD |
| Retention / deletion / rights workflow | Implemented (not verified) | `apps/api` privacy module | — | — |
| Incident / breach process | Stub | [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) | — | Jurisdiction deadlines TBD |
| Legal review record | Blocked | — | — | Counsel |

Open questions for counsel:
1. DPDP notice adequacy for multi-tenant restaurant SaaS vs guest diner app.
2. Breach notification timelines applicable to Rkyves entities.
3. Children's / age-gate obligations for guest ordering app.
4. Trademark clearance for “Cullinos” / “Rkyves” in India and export markets.

## Related guides

- Step-by-step external completion: [`EXTERNAL_COMPLIANCE_RUNBOOK.md`](EXTERNAL_COMPLIANCE_RUNBOOK.md) (§8 counsel, §9 trademark, §10 stores, §11 children).
- Full open-items list (code vs external): [`SECURITY_COMPLIANCE_OPEN_ITEMS.md`](SECURITY_COMPLIANCE_OPEN_ITEMS.md).
