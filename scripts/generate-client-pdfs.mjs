/**
 * Generates stylish client-facing Cullinos PDFs:
 * Brochure, Product Overview, User Manual.
 * Run: node scripts/generate-client-pdfs.mjs
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PDF = join(ROOT, 'docs', 'client', 'export', 'pdf');
const OUT_HTML = join(ROOT, 'docs', 'client', 'export', 'html');

const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');

:root {
  --ink: #0F0F1A;
  --ink-soft: #2a2a38;
  --gold: #D4A017;
  --gold-bright: #F5A623;
  --gold-dim: #a67c12;
  --cream: #f7f4ee;
  --paper: #ffffff;
  --muted: #5c5c6b;
  --line: #e6e2d8;
  --card: #faf8f4;
}

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font-family: 'DM Sans', Segoe UI, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: var(--ink);
  background: var(--paper);
}
h1, h2, h3, .display {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
  page-break-after: avoid;
}
h1 { font-size: 28pt; margin: 0 0 12px; }
h2 { font-size: 16pt; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--gold); }
h3 { font-size: 12pt; margin: 18px 0 8px; color: var(--ink-soft); border: none; }
p { margin: 0 0 10px; }
a { color: var(--gold-dim); text-decoration: none; }
ul, ol { margin: 0 0 12px; padding-left: 18px; }
li { margin-bottom: 4px; }
strong { font-weight: 600; }

.page { padding: 36px 40px; max-width: 820px; margin: 0 auto; }
.cover {
  min-height: 100vh;
  padding: 48px 48px 40px;
  background:
    radial-gradient(ellipse 80% 60% at 100% 0%, rgba(212,160,23,0.22), transparent 55%),
    radial-gradient(ellipse 50% 40% at 0% 100%, rgba(245,166,35,0.12), transparent 50%),
    linear-gradient(165deg, #0F0F1A 0%, #1a1a28 55%, #12121c 100%);
  color: #f5f2ea;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  page-break-after: always;
}
.cover h1, .cover h2, .cover .display { color: #f5f2ea; border: none; }
.mark {
  width: 56px; height: 56px; border-radius: 14px;
  background: linear-gradient(135deg, var(--gold), var(--gold-bright));
  color: var(--ink); font-family: 'Fraunces', Georgia, serif;
  font-size: 28pt; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  letter-spacing: -1px;
}
.eyebrow {
  display: inline-block;
  font-family: 'DM Sans', sans-serif;
  font-size: 9pt; font-weight: 600; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--gold);
  margin-bottom: 14px;
}
.cover .eyebrow { color: var(--gold-bright); }
.tagline { font-size: 13pt; color: rgba(245,242,234,0.78); max-width: 420px; margin: 0; }
.cover-meta { font-size: 9pt; color: rgba(245,242,234,0.55); letter-spacing: 0.04em; }
.gold { color: var(--gold); }
.lead { font-size: 12pt; color: var(--muted); max-width: 560px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 18px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 14px 0 18px; }
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  page-break-inside: avoid;
}
.card h3 { margin: 0 0 6px; font-size: 11pt; }
.card p { margin: 0; font-size: 9.5pt; color: var(--muted); }
.card .kicker {
  font-size: 8pt; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--gold-dim); margin-bottom: 6px;
}

.step {
  display: grid; grid-template-columns: 36px 1fr; gap: 12px;
  margin: 0 0 14px; page-break-inside: avoid;
}
.step-num {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--ink); color: var(--gold);
  font-weight: 700; font-size: 11pt;
  display: flex; align-items: center; justify-content: center;
}
.step h3 { margin: 2px 0 4px; }
.step p { margin: 0; color: var(--muted); font-size: 9.5pt; }

table.pretty {
  width: 100%; border-collapse: collapse; margin: 12px 0 18px;
  font-size: 9.5pt; page-break-inside: avoid;
}
table.pretty th {
  background: var(--ink); color: var(--gold);
  text-align: left; padding: 9px 10px; font-weight: 600;
}
table.pretty td {
  padding: 8px 10px; border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.pretty tr:nth-child(even) td { background: var(--card); }

.pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 16px; }
.pill {
  background: var(--ink); color: #f5f2ea;
  border-radius: 999px; padding: 6px 12px;
  font-size: 8.5pt; font-weight: 600; letter-spacing: 0.02em;
}
.pill.gold { background: var(--gold); color: var(--ink); }

.banner {
  background: linear-gradient(120deg, var(--ink), #252536);
  color: #f5f2ea; border-radius: 14px; padding: 20px 22px;
  margin: 18px 0; page-break-inside: avoid;
}
.banner h3 { color: #f5f2ea; margin: 0 0 6px; }
.banner p { margin: 0; color: rgba(245,242,234,0.75); font-size: 10pt; }
.banner .cta { margin-top: 12px; color: var(--gold-bright); font-weight: 700; font-size: 11pt; }

.plan {
  border: 1px solid var(--line); border-radius: 14px; padding: 16px;
  page-break-inside: avoid; background: var(--paper);
}
.plan.featured {
  border-color: var(--gold);
  box-shadow: inset 0 0 0 1px var(--gold);
  background: linear-gradient(180deg, #fffdf6, #fff);
}
.plan .price { font-family: 'Fraunces', Georgia, serif; font-size: 18pt; margin: 4px 0; }
.plan .price span { font-size: 9pt; color: var(--muted); font-family: 'DM Sans', sans-serif; }
.plan ul { margin: 8px 0 0; padding-left: 16px; font-size: 9pt; color: var(--muted); }

.footer-bar {
  margin-top: 28px; padding-top: 14px; border-top: 1px solid var(--line);
  font-size: 8.5pt; color: var(--muted);
  display: flex; justify-content: space-between; gap: 12px;
}
.section-break { page-break-before: always; }
.muted { color: var(--muted); }
.small { font-size: 9pt; }
.hr-gold { border: none; height: 2px; background: linear-gradient(90deg, var(--gold), transparent); margin: 18px 0; }

@media print {
  .cover { min-height: 100vh; }
  .page { padding: 28px 32px; }
  a { color: inherit; }
}
`;

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function cover({ eyebrow, title, subtitle, meta }) {
  return `
<section class="cover">
  <div>
    <div class="mark">C</div>
    <p class="eyebrow" style="margin-top:28px">${eyebrow}</p>
    <h1 class="display" style="font-size:42pt;max-width:520px">${title}</h1>
    <p class="tagline">${subtitle}</p>
  </div>
  <div class="cover-meta">
    <div style="font-size:14pt;font-family:'Fraunces',Georgia,serif;margin-bottom:6px">Cullinos</div>
    Restaurant Operating System · by Rkyves<br/>
    ${meta}
  </div>
</section>`;
}

function footer(left = 'cullinos.com') {
  return `<div class="footer-bar"><span>${left}</span><span>Powered by Rkyves · hello@rkyves.com</span></div>`;
}

function brochureHtml() {
  const body = `
${cover({
  eyebrow: 'Client brochure',
  title: 'One system.<br/>Every service moment.',
  subtitle: 'Cullinos is the restaurant operating system for POS, kitchen, floor, online orders, and back office — built for India.',
  meta: 'cullinos.com · Mumbai, India',
})}

<section class="page">
  <p class="eyebrow">Why Cullinos</p>
  <h2 style="border:none;margin-top:0">Your food business, running as one</h2>
  <p class="lead">Stop juggling separate tools for billing, kitchen tickets, QR ordering, and reports. Cullinos connects cashier, kitchen, waiter, guests, and owners on one platform — with GST billing and offline-ready POS &amp; KDS.</p>

  <div class="grid-3">
    <div class="card"><div class="kicker">GST-ready</div><h3>India billing built in</h3><p>CGST, SGST, and IGST on every invoice — not bolted on later.</p></div>
    <div class="card"><div class="kicker">Always on</div><h3>Offline POS &amp; KDS</h3><p>Local Gateway keeps service moving when the internet drops.</p></div>
    <div class="card"><div class="kicker">Grow ready</div><h3>One outlet to chains</h3><p>Same platform from a single cafe to multi-brand franchise.</p></div>
  </div>

  <h2>What you get</h2>
  <div class="grid-2">
    <div class="card"><h3>Point of Sale</h3><p>Touch cashier, holds, takeaway, GST receipts, Razorpay-ready payments.</p></div>
    <div class="card"><h3>Kitchen Display</h3><p>Live KOTs, station routing, and customer Order Display boards.</p></div>
    <div class="card"><h3>Waiter &amp; Tables</h3><p>Floor ordering, QR table sessions, and live table maps.</p></div>
    <div class="card"><h3>Online &amp; QR</h3><p>Branded storefront and scan-to-order — menu synced from Admin.</p></div>
    <div class="card"><h3>Back office</h3><p>Menu, inventory, recipes, staff, loyalty, delivery, reports, billing.</p></div>
    <div class="card"><h3>Enterprise</h3><p>Multi-outlet KPIs, stock transfers, franchise, hospitality add-ons.</p></div>
  </div>

  <h2>Built for your vertical</h2>
  <div class="pill-row">
    <span class="pill gold">Restaurants</span>
    <span class="pill">Cafes</span>
    <span class="pill">QSR</span>
    <span class="pill">Food trucks</span>
    <span class="pill">Bakeries</span>
    <span class="pill">Cloud kitchens</span>
    <span class="pill">Catering</span>
    <span class="pill">Hotels &amp; resorts</span>
  </div>

  <h2>Plans at a glance</h2>
  <div class="grid-2">
    <div class="plan"><div class="kicker" style="font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-dim)">Starter</div><div class="price">₹999 <span>/ month</span></div><p class="small muted">POS, KDS, tables, QR &amp; online ordering</p></div>
    <div class="plan"><div class="kicker" style="font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-dim)">QSR / Food SMB</div><div class="price">₹1,499 <span>/ month</span></div><p class="small muted">Counter mode, pickup queue, loyalty, production</p></div>
    <div class="plan featured"><div class="kicker" style="font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-dim)">Professional</div><div class="price">₹2,999 <span>/ month</span></div><p class="small muted">Full ops — inventory, CRM, delivery, up to 3 outlets</p></div>
    <div class="plan"><div class="kicker" style="font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-dim)">Enterprise / Hospitality</div><div class="price">From ₹9,999 <span>/ month</span></div><p class="small muted">Chains, franchise, analytics, room service &amp; banquets</p></div>
  </div>

  <div class="banner">
    <h3>Ready to see Cullinos in your outlet?</h3>
    <p>Book a walkthrough or start a conversation with the Rkyves team.</p>
    <div class="cta">cullinos.com/contact · hello@rkyves.com</div>
  </div>
  ${footer('Cullinos Brochure')}
</section>`;
  return shell('Cullinos Brochure', body);
}

function productHtml() {
  const body = `
${cover({
  eyebrow: 'Product overview',
  title: 'What Cullinos is — and everything we offer',
  subtitle: 'A complete guide to the Cullinos Restaurant Operating System: apps, features, verticals, and plans.',
  meta: 'For decision makers · cullinos.com',
})}

<section class="page">
  <p class="eyebrow">The product</p>
  <h2 style="border:none;margin-top:0">Cullinos is your food business OS</h2>
  <p class="lead">Cullinos is a multi-app platform from <strong>Rkyves</strong>. One backend powers POS, kitchen displays, waiter floor service, guest QR/online ordering, owner Admin, and multi-outlet Management — so every role works from the same live data.</p>

  <div class="banner">
    <h3>“One login for cashier, kitchen, online orders, production, and reports.”</h3>
    <p>GST + offline capability built in. Scales from a single counter to hotel and franchise networks.</p>
  </div>

  <h2>The Cullinos apps</h2>
  <table class="pretty">
    <thead><tr><th>App</th><th>Who uses it</th><th>What it does</th></tr></thead>
    <tbody>
      <tr><td><strong>Admin</strong><br/><span class="small muted">admin.cullinos.com</span></td><td>Owner / manager</td><td>Menu, staff, inventory, recipes, loyalty, delivery, reports, billing, launchers, Portal POS</td></tr>
      <tr><td><strong>POS</strong><br/><span class="small muted">pos.cullinos.com</span></td><td>Cashier</td><td>Counter &amp; takeaway billing, holds, GST receipts, payments</td></tr>
      <tr><td><strong>KDS</strong><br/><span class="small muted">kds.cullinos.com</span></td><td>Kitchen</td><td>Live kitchen tickets; Order Display (preparing / ready) mode</td></tr>
      <tr><td><strong>Waiter</strong><br/><span class="small muted">waiter.cullinos.com</span></td><td>Floor staff</td><td>Table map, table-side orders, QR guest sessions</td></tr>
      <tr><td><strong>Customer</strong><br/><span class="small muted">order.cullinos.com</span></td><td>Guests</td><td>QR dine-in &amp; online storefront (guest checkout; optional login)</td></tr>
      <tr><td><strong>Management</strong><br/><span class="small muted">manage.cullinos.com</span></td><td>Multi-outlet ops</td><td>Network KPIs, outlet comparison, stock transfer, franchise</td></tr>
    </tbody>
  </table>

  <h2 class="section-break">Feature catalogue</h2>

  <h3>Front of house</h3>
  <div class="grid-2">
    <div class="card"><h3>Point of Sale</h3><p>Fast checkout, modifiers, holds, takeaway, GST-compliant receipts.</p></div>
    <div class="card"><h3>Portal POS</h3><p>Full cashier experience inside Admin for QSR / counter teams.</p></div>
    <div class="card"><h3>Waiter app</h3><p>Mobile table-side ordering and live table status.</p></div>
    <div class="card"><h3>Table management</h3><p>Create tables, capacities, and floor visibility in Admin.</p></div>
    <div class="card"><h3>Kitchen Display (KDS)</h3><p>Route KOTs, track prep, mark items ready.</p></div>
    <div class="card"><h3>Order Display (CDS)</h3><p>Customer-facing preparing / ready board for pickup counters.</p></div>
  </div>

  <h3>Customer channels</h3>
  <div class="grid-2">
    <div class="card"><h3>QR dine-in ordering</h3><p>Guests scan a table session QR and order into the same ticket.</p></div>
    <div class="card"><h3>Online storefront</h3><p>Branded ordering link for pickup and delivery.</p></div>
    <div class="card"><h3>Digital Ordering / kiosk</h3><p>Admin launcher for kiosk and storefront URLs.</p></div>
    <div class="card"><h3>Customer login</h3><p>Optional account login without blocking guest checkout.</p></div>
  </div>

  <h3>Back office</h3>
  <div class="grid-2">
    <div class="card"><h3>Menu management</h3><p>Categories, items, pricing, availability, modifiers.</p></div>
    <div class="card"><h3>Inventory</h3><p>Stock levels, adjustments, and outlet stock visibility.</p></div>
    <div class="card"><h3>Recipes &amp; costing</h3><p>Link ingredients to dishes for production and cost control.</p></div>
    <div class="card"><h3>Production &amp; batches</h3><p>Schedule and complete production batches.</p></div>
    <div class="card"><h3>Staff &amp; permissions</h3><p>Roles (owner, waiter, cashier, …) with route-level access.</p></div>
    <div class="card"><h3>Reports &amp; analytics</h3><p>Revenue, top items, and outlet performance.</p></div>
    <div class="card"><h3>Billing &amp; GST</h3><p>Tax-ready bills and subscription billing page.</p></div>
    <div class="card"><h3>Settings &amp; onboarding</h3><p>Business type wizard, GSTIN, order types, org config.</p></div>
  </div>

  <h3>Growth &amp; engagement</h3>
  <div class="grid-2">
    <div class="card"><h3>CRM / Customers</h3><p>Customer profiles, tiers, and coupon visibility.</p></div>
    <div class="card"><h3>Loyalty</h3><p>Stamp cards, points, and rewards programs.</p></div>
    <div class="card"><h3>Promo Email</h3><p>Compose and send promotional campaigns to guests.</p></div>
    <div class="card"><h3>Delivery</h3><p>Track and manage delivery orders from Admin.</p></div>
    <div class="card"><h3>Events</h3><p>Schedule pop-ups and event-driven pre-orders.</p></div>
    <div class="card"><h3>Coupons</h3><p>Discount codes applied at customer checkout.</p></div>
  </div>

  <h3>Enterprise &amp; hospitality</h3>
  <div class="grid-2">
    <div class="card"><h3>Multi-outlet management</h3><p>Consolidated KPIs and outlet comparison.</p></div>
    <div class="card"><h3>Stock transfer</h3><p>Move inventory between outlets.</p></div>
    <div class="card"><h3>Multi-brand</h3><p>Cloud kitchen / brand catalogue support.</p></div>
    <div class="card"><h3>Franchise tools</h3><p>Franchisee visibility for chain operators.</p></div>
    <div class="card"><h3>Banquets</h3><p>Banquet and large-event workflows.</p></div>
    <div class="card"><h3>Guests &amp; Rooms</h3><p>Hospitality guest profiles and room service posting.</p></div>
  </div>

  <h2 class="section-break">Who we serve</h2>
  <table class="pretty">
    <thead><tr><th>Vertical</th><th>How Cullinos fits</th></tr></thead>
    <tbody>
      <tr><td>Restaurants</td><td>Tables, waiter, QR dine-in, KDS, full back office</td></tr>
      <tr><td>Cafes &amp; QSR</td><td>Counter POS, pickup queue / Order Display, loyalty</td></tr>
      <tr><td>Food trucks &amp; pop-ups</td><td>Mobile-friendly POS, events, quick service</td></tr>
      <tr><td>Bakeries</td><td>Production batches, recipes, pre-orders</td></tr>
      <tr><td>Cloud kitchens</td><td>Multi-brand menus, delivery-centric ops</td></tr>
      <tr><td>Catering</td><td>Events, pre-orders, production planning</td></tr>
      <tr><td>Hotels &amp; resorts</td><td>Room service, rooms, banquets (Hospitality / Enterprise)</td></tr>
    </tbody>
  </table>

  <h2>Plans &amp; offerings</h2>
  <p class="muted small">List prices for India (INR). Custom enterprise quotes available.</p>
  <table class="pretty">
    <thead><tr><th>Plan</th><th>From</th><th>Best for</th><th>Highlights</th></tr></thead>
    <tbody>
      <tr><td><strong>Starter</strong></td><td>₹999/mo</td><td>Single outlet launch</td><td>POS, KDS, tables, QR + online ordering, reports</td></tr>
      <tr><td><strong>QSR / Food SMB</strong></td><td>₹1,499/mo</td><td>Cafes, trucks, counters</td><td>+ counter mode, pickup queue, loyalty, production</td></tr>
      <tr><td><strong>Professional</strong></td><td>₹2,999/mo</td><td>Growing restaurants</td><td>+ inventory, CRM, delivery, up to 3 outlets</td></tr>
      <tr><td><strong>Enterprise</strong></td><td>₹9,999/mo</td><td>Chains &amp; franchise</td><td>+ multi-outlet, multi-brand, franchise, analytics, API</td></tr>
      <tr><td><strong>Hospitality</strong></td><td>₹14,999/mo</td><td>Hotels &amp; resorts</td><td>+ room service, room posting, banquet, PMS-ready</td></tr>
    </tbody>
  </table>

  <div class="banner">
    <h3>Next step</h3>
    <p>See the live product at cullinos.com · Request a demo via contact · Or ask for the User Manual after onboarding.</p>
    <div class="cta">hello@rkyves.com · Mumbai, India</div>
  </div>
  ${footer('Cullinos Product Overview')}
</section>`;
  return shell('Cullinos Product Overview', body);
}

function manualHtml() {
  const body = `
${cover({
  eyebrow: 'User manual',
  title: 'How to use Cullinos',
  subtitle: 'A practical guide for restaurant owners and staff — from first login to daily service.',
  meta: 'Owners · Managers · Cashiers · Waiters · Kitchen',
})}

<section class="page">
  <p class="eyebrow">Start here</p>
  <h2 style="border:none;margin-top:0">Your daily portals</h2>
  <table class="pretty">
    <thead><tr><th>Role</th><th>Open this URL</th><th>Login with</th></tr></thead>
    <tbody>
      <tr><td>Owner / manager</td><td>https://admin.cullinos.com</td><td>Owner email from onboarding</td></tr>
      <tr><td>Cashier</td><td>https://pos.cullinos.com<br/>or Admin → Portal POS</td><td>Cashier staff account</td></tr>
      <tr><td>Waiter</td><td>https://waiter.cullinos.com</td><td>Waiter staff account</td></tr>
      <tr><td>Kitchen</td><td>https://kds.cullinos.com</td><td>Kitchen / staff login</td></tr>
      <tr><td>Guests</td><td>https://order.cullinos.com/<em>org</em>/<em>outlet</em></td><td>No login required</td></tr>
      <tr><td>Multi-outlet</td><td>https://manage.cullinos.com</td><td>Owner (Enterprise)</td></tr>
    </tbody>
  </table>
  <p class="small muted">Forgot password: use <strong>/forgot-password</strong> on Admin or ask your owner to reset staff in Admin → Staff.</p>

  <h2>1. First-time owner setup</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Log in to Admin</h3><p>Open admin.cullinos.com with the owner email and password from onboarding.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Complete Setup wizard</h3><p>Choose business type (e.g. Restaurant), enter GSTIN if you have one, and finish the guided steps.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Build your menu</h3><p>Admin → <strong>Menu</strong>: create categories, then items with prices. Toggle availability when an item sells out.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Add tables</h3><p>Admin → <strong>Tables</strong>: create floor tables (e.g. T1, T2) so Waiter can take dine-in orders.</p></div></div>
  <div class="step"><div class="step-num">5</div><div><h3>Invite staff</h3><p>Admin → <strong>Staff</strong>: add a Waiter and a Cashier, assign your outlet, share passwords securely.</p></div></div>

  <h2 class="section-break">2. Taking orders — Waiter (dine-in)</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Open Waiter</h3><p>waiter.cullinos.com → log in → select outlet → see the table grid.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Open a table</h3><p>Tap a table → add menu items → confirm. Note the order number.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Optional: guest QR</h3><p>Use <strong>Show QR to customers</strong> so guests order on their phones into the same table ticket. End the session when the table clears.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Kitchen sees it</h3><p>KOTs appear on KDS (kds.cullinos.com) within seconds.</p></div></div>

  <h2>3. Taking orders — POS (counter / takeaway)</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Open POS</h3><p>pos.cullinos.com as Cashier — or Admin → <strong>Portal POS</strong> (/pos) if you have POS access.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Build the cart</h3><p>Tap items, set order type (e.g. takeaway), check subtotal.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Hold if needed</h3><p>Hold an order to free the screen; resume later from the held panel.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Checkout</h3><p>Confirm the quick order. It shows in Admin → Orders and on KDS.</p></div></div>

  <h2>4. Online &amp; QR guest ordering</h2>
  <ol>
    <li>Share <code>https://order.cullinos.com/your-org/your-outlet</code> or the waiter QR link.</li>
    <li>Guest browses menu → cart → checkout with name &amp; phone.</li>
    <li>Prefer <strong>Pay later</strong> unless Razorpay is configured for Pay now.</li>
    <li>Verify the order in Admin → <strong>Orders</strong>.</li>
  </ol>
  <p class="small muted">Customer login is optional — guests can always checkout without an account.</p>

  <h2>5. Kitchen &amp; Order Display</h2>
  <div class="grid-2">
    <div class="card"><h3>Kitchen Display</h3><p>Open kds.cullinos.com (or Admin → Kitchen Display launcher). Tickets update live as orders arrive. Mark items as you cook.</p></div>
    <div class="card"><h3>Order Display</h3><p>Admin → <strong>Order Display</strong> (/cds). Copy the public board URL to a tablet/TV so guests see Preparing → Ready.</p></div>
  </div>

  <h2 class="section-break">6. Back office essentials</h2>
  <table class="pretty">
    <thead><tr><th>Need to…</th><th>Go to</th></tr></thead>
    <tbody>
      <tr><td>Change prices / 86 an item</td><td>Admin → Menu</td></tr>
      <tr><td>See today’s orders</td><td>Admin → Orders</td></tr>
      <tr><td>Check stock</td><td>Admin → Inventory</td></tr>
      <tr><td>Add a recipe</td><td>Admin → Recipes</td></tr>
      <tr><td>Schedule production</td><td>Admin → Production</td></tr>
      <tr><td>Loyalty / CRM</td><td>Admin → Loyalty / Customers</td></tr>
      <tr><td>Send a promo</td><td>Admin → Promo Email</td></tr>
      <tr><td>Delivery list</td><td>Admin → Delivery</td></tr>
      <tr><td>Sales reports</td><td>Admin → Reports</td></tr>
      <tr><td>Subscription / invoices</td><td>Admin → Billing</td></tr>
      <tr><td>Kiosk / storefront link</td><td>Admin → Digital Ordering</td></tr>
    </tbody>
  </table>
  <p class="small muted">Some pages (Banquets, Brands, Guests, Rooms) appear only for matching business types / plans.</p>

  <h2>7. Multi-outlet (Enterprise)</h2>
  <ol>
    <li>Open manage.cullinos.com with the owner login.</li>
    <li>Review network KPIs on Overview.</li>
    <li>Compare outlets or create stock transfers when you have 2+ outlets.</li>
  </ol>

  <h2>8. Tips &amp; good habits</h2>
  <ul>
    <li>Create staff accounts per person — don’t share the owner login on the floor.</li>
    <li>Keep menu availability updated so guests never order sold-out items.</li>
    <li>End QR table sessions when guests leave so old links stop working.</li>
    <li>Use Incognito when testing the customer storefront as a guest.</li>
    <li>Never put real passwords in shared spreadsheets or chat.</li>
  </ul>

  <div class="banner">
    <h3>Need help?</h3>
    <p>Contact your Cullinos / Rkyves account manager, or write to hello@rkyves.com. Product site: cullinos.com</p>
    <div class="cta">User Manual · Cullinos Restaurant Operating System</div>
  </div>
  ${footer('Cullinos User Manual')}
</section>`;
  return shell('Cullinos User Manual — How to Use', body);
}

/** @returns {string | undefined} */
function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return undefined;
}

function printHtmlToPdf(browserPath, htmlPath, pdfPath) {
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const result = spawnSync(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfPath}`,
      fileUrl,
    ],
    { encoding: 'utf8', timeout: 180000 },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Browser exited with code ${result.status}`);
  }
  if (!existsSync(pdfPath)) {
    throw new Error('PDF file was not created');
  }
}

const DOCS = [
  { id: 'brochure', dest: 'Cullinos_Brochure.pdf', html: 'Cullinos_Brochure.html', build: brochureHtml },
  { id: 'product', dest: 'Cullinos_Product_Overview.pdf', html: 'Cullinos_Product_Overview.html', build: productHtml },
  { id: 'manual', dest: 'Cullinos_User_Manual.pdf', html: 'Cullinos_User_Manual.html', build: manualHtml },
];

async function main() {
  mkdirSync(OUT_PDF, { recursive: true });
  mkdirSync(OUT_HTML, { recursive: true });

  const browserPath = findBrowserExecutable();
  if (browserPath) console.log(`Using browser: ${browserPath}`);
  else console.warn('No Chrome/Edge found — writing HTML only.');

  let pdfCount = 0;
  for (const doc of DOCS) {
    const htmlPath = join(OUT_HTML, doc.html);
    const pdfPath = join(OUT_PDF, doc.dest);
    console.log(`Building ${doc.id}...`);
    writeFileSync(htmlPath, doc.build(), 'utf8');
    console.log(`  Wrote ${htmlPath}`);
    if (browserPath) {
      try {
        printHtmlToPdf(browserPath, htmlPath, pdfPath);
        console.log(`  Wrote ${pdfPath}`);
        pdfCount++;
      } catch (err) {
        console.warn(`  PDF failed: ${err.message}`);
      }
    }
  }

  console.log(`Done — ${pdfCount}/${DOCS.length} PDFs in ${OUT_PDF}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
