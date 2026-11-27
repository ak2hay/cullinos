# Cullinos UX audit — restaurant staff and owners

Walked from the current screens and navigation (admin, management, KDS, kiosk, waiter, guest, support/super-admin). Counts are taps or clicks on the happy path, starting from a signed-in home screen unless the job is signup. The POS billing screen was left unchanged.

People using this are Indian restaurant owners and floor staff, often on a phone or a cheap tablet. Jargon, long menus, and small targets cost more than decoration.

## Ranked friction

| Rank | Impact | Where | What goes wrong | Before | After |
|---|---|---|---|---|---|
| 1 | Blocks going live | Admin signup → setup wizard | Wizard is required. Several steps only say “do this later”. No skip. GST presets are a button labelled “Seed India presets”. | 11 clicks to the dashboard after the account exists (business form, continue through feature list, menu, tables, tax, staff, recipes, done) | 4 clicks: fill name and mobile, Skip for now. Checklist stays on the dashboard and can be hidden or brought back |
| 2 | Owner cannot see the day | Admin home | Sales, open orders, and top dishes were below a chart, with labels like “Revenue”, “Avg order value”, “organisation-wide rollup” | 1 click to open Dashboard, then scroll past the chart to see dishes and live orders | 1 click. “Today at a glance” shows sales, orders done, still open, average bill, then open orders and top dishes |
| 3 | Menu edits are one dish at a time | Admin → Menu → Dishes | No search. Tax can be bulk-edited. Price and “can guests order this?” cannot. Delete uses a browser confirm | Find one dish: scroll (often 15+ flicks). Change 10 prices: 10 × (Edit, price, Save) ≈ 30 clicks | Search is 1 tap plus typing. Select dishes, enter +10% or a rupee amount, Update prices: about 5 clicks, with Undo |
| 4 | Kitchen misses tickets | KDS | Tickets are small (up to 5 columns). Bump is one button but short. No sound | 1 tap to bump, easy to miss on a loud pass | Larger ticket, one large Start cooking / Ready / Served button, Sound on plays a tone for a new ticket |
| 5 | Navigation is a catalogue | Admin sidebar | Seven groups (Operations, Menu & catalog, CRM, Events, Cullinos App, Admin) before the owner reaches Staff or GST | Open menu: 1. Open staff: 1, after scanning ~20 labels. GST report: Reports, then the “Tax” tab (2) | Today, Service, Menu, Team, Money are the first groups. Everything else is under More (collapsed). GST tab is labelled GST. Reports?tab=gst opens it in 1 click from a bookmark |
| 6 | Wrong role, full menu | Admin | A chef who can open Admin saw Events, marketplace, and reports in the list. Page guards already blocked some URLs; the menu did not | Chef scans the full owner menu | Chef sees orders, menu, and kitchen screens. Accountant sees reports, orders, and purchasing. Owner still sees every item |
| 7 | Signup errors are one banner | Admin /register | A bad mobile number only appears as a banner, not on the field | 1 submit, then hunt the message | The field itself says what to fix (name, email, 10-digit mobile) |
| 8 | Kiosk has no search | Kiosk menu | Categories only. A long menu means swiping | Find a dish: swipe categories, then the grid | Type in Search dishes (1 tap + typing). Targets were already large |
| 9 | Waiter status is codes | Waiter table | Chips say OCCUPIED, BILLING. “Mark served” is English even when the app is in Hindi | 1 tap, but the word is not the one staff use | Chips use the existing translations (Occupied, Billing, …). Send and confirm buttons are at least 52px tall |
| 10 | Chain home sounds like software | Management | “Enterprise overview”, “Consolidated revenue”, “Enterprise console” | 1 click to understand it is today’s sales | “Today across outlets”, “Sales today”, “Still open”, “Average bill” |
| 11 | Support nav says “Tenants” | Super Admin (the support portal; there is no separate support app) | Support staff see Tenant labs, Audit & activity, System health, and a long marketing list beside daily work | Open a restaurant: 1 click, after reading unfamiliar words | Daily items first (Restaurants, Plans, Activity, People, Team). Database tools, settings, health, and marketing sit under More |

## Job click counts

Signed in, outlet already selected, unless noted.

| Job | Before | After |
|---|---|---|
| Sign up and reach a usable home | Register (4 fields + submit) then 8 wizard steps ≈ 14 clicks, and GST is still not created | Register with inline errors, then name + mobile + Skip ≈ 8 clicks. 5% GST groups are created on finish. Checklist resumes the rest |
| Add or edit a dish and its price | Menu → Dishes → Add or Edit → price → Save ≈ 4–5 per dish. No search | Same for one dish. Search is on the dish list. Ten dishes: select, choose % or ₹, Update prices, Undo if needed ≈ 5 |
| Add staff and a role | Staff → Add → name, email, password, role ≈ 6 | Same form (roles already say Waiter, Cashier, Kitchen, Manager). Search is on the list. Empty state tells you to add someone |
| See today’s sales | Dashboard, 4 KPI cards, chart first | Dashboard glance: sales, orders done, still open, average bill, then open orders and top dishes |
| Close the day | Still on the POS shift control (not changed in this pass). Reports daily summary is 2 clicks (Reports, dates already today) | Unchanged on POS. GST is the GST tab, or `/reports?tab=gst` |
| GST report | Reports → Tax tab (2). The preset button in Settings is “Seed India presets” | Reports → GST (2). New restaurants get the 5% restaurant group without that button. Settings tab is labelled GST |
| Tables and QR | Tables → add table → show QR. Already a short flow | Unchanged flow. It stays under Service, not buried with kitchen stations |
| Waiter takes an order | Floor → table → search menu (search already existed) → Send to kitchen | Same steps. Status words are plain. Send / confirm are larger |
| Kitchen marks ready | KDS → Ready on the ticket (1) | Same 1 tap, on a larger button. Sound is one extra tap the first time (“Turn sound on”) |
| Kiosk order | Tap to start → category → dish → place order | Same, plus search so a dish is not a long swipe |

## What changed, by app

- **Admin:** job navigation with More, role-based items, setup checklist (skip and resume), GST presets on setup, today-at-a-glance order, dish search, bulk price and guest availability with Undo, order and staff search, plainer empty states, register field errors, GST report label.
- **KDS:** larger tickets, one large bump button, optional new-ticket sound.
- **Kiosk:** dish search, plainer empty line, slightly larger “Start over”.
- **Management:** plainer today view and larger nav targets.
- **Waiter:** translated table statuses, taller primary buttons. Menu search was already there.
- **Guest:** plainer “nothing matches” line. Search was already there. No i18n catalog in this app, so the new sentence is English.
- **Support (Super Admin):** daily links first, advanced tools under More, “Restaurants” instead of “Tenants”.
- **Shared UI:** toasts can carry an Undo action. Admin already uses i18next; new admin copy is in `apps/admin/src/locales/en/common.json` and falls back for Hindi and Marathi.

## Left for later

- POS order and payment screens (another change is in progress). Day close still lives there.
- Full Hindi and Marathi copy for the new admin sentences (English fallback is in place).
- Bulk edit of modifier prices, not just the dish base price.
- A real “sold out at this outlet” switch separate from “show to guests” (`onlineAvailable`). Hiding from guests does not 86 a dish on the counter POS.
- Waiter “mark served” uses the existing “Done” translation so no new strings had to be generated for every language.
- Guest app still has no translation catalog.
- Authenticated screens were reviewed from the UI code. Public shells (register, kiosk welcome, KDS login) can be opened without the API; a full seeded click-through needs Postgres and the API.
