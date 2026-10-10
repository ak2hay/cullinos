/**
 * Generates stylish client-facing Cullinos PDFs:
 * Brochure, Product Overview, User Manual, Plans Brochure, Agency Brief, per-plan sheets.
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

.plan-kicker {
  font-size: 8pt; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--gold-dim);
}
.tag {
  display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px;
  background: var(--gold); color: var(--ink);
  font-family: 'DM Sans', sans-serif; font-size: 7pt; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; vertical-align: middle;
}

.plan-hero {
  background:
    radial-gradient(ellipse 70% 80% at 100% 0%, rgba(212,160,23,0.25), transparent 60%),
    linear-gradient(160deg, #0F0F1A 0%, #1a1a28 60%, #12121c 100%);
  color: #f5f2ea; border-radius: 16px; padding: 20px 24px;
  page-break-inside: avoid;
}
.plan-hero-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.mark.mark-sm { width: 34px; height: 34px; border-radius: 9px; font-size: 17pt; }
.plan-hero-body { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
.plan-hero h1 { color: #f5f2ea; font-size: 26pt; margin: 0 0 6px; }
.plan-hero .tagline { font-size: 10.5pt; max-width: 400px; }
.price-block { text-align: right; flex-shrink: 0; }
.price-main { font-family: 'Fraunces', Georgia, serif; font-size: 26pt; color: var(--gold-bright); line-height: 1.1; }
.price-main span { font-family: 'DM Sans', sans-serif; font-size: 10pt; color: rgba(245,242,234,0.7); }
.price-alt { font-size: 9.5pt; color: #f5f2ea; margin-top: 4px; }
.price-note { font-size: 8pt; color: rgba(245,242,234,0.55); margin-top: 2px; }

.limits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
.limits > div {
  border: 1px solid var(--line); border-radius: 12px; background: var(--card);
  padding: 10px 14px; display: flex; align-items: baseline; gap: 8px;
}
.limits strong { font-family: 'Fraunces', Georgia, serif; font-size: 18pt; font-weight: 600; color: var(--ink); }
.limits span { font-size: 9pt; color: var(--muted); }

.feature-grid { margin-top: 10px; }
.feature-card { padding: 12px 14px; }
ul.check { list-style: none; padding: 0; margin: 0; font-size: 9pt; color: var(--ink-soft); }
ul.check li { position: relative; padding-left: 16px; margin-bottom: 3px; line-height: 1.35; }
ul.check li::before { content: '✓'; position: absolute; left: 0; color: var(--gold-dim); font-weight: 700; }
.upgrade {
  border-left: 3px solid var(--gold); background: var(--card);
  padding: 8px 12px; border-radius: 0 8px 8px 0; color: var(--ink-soft);
}

table.matrix {
  width: 100%; border-collapse: collapse; margin: 10px 0 12px;
  font-size: 8.5pt; page-break-inside: avoid;
}
table.matrix th {
  background: var(--ink); color: var(--gold); padding: 7px 6px;
  font-weight: 600; text-align: center; font-size: 8.5pt;
}
table.matrix th:first-child, table.matrix td:first-child { text-align: left; padding-left: 10px; }
table.matrix th.featured { background: var(--gold); color: var(--ink); }
table.matrix td { padding: 3px 6px; border-bottom: 1px solid var(--line); text-align: center; }
table.matrix td.featured { background: #fffaeb; }
table.matrix tr.group td {
  background: var(--cream); font-weight: 700; font-size: 7.5pt;
  letter-spacing: .1em; text-transform: uppercase; color: var(--gold-dim);
}
table.matrix .yes { color: var(--gold-dim); font-weight: 700; }
table.matrix .no { color: #c4c0b6; }
table.matrix tr.key td { font-weight: 600; }

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

function shell(title, body, extraCss = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${SHARED_CSS}${extraCss}</style>
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

const PRICE_NOTE = 'Prices in INR. Taxes as applicable.';

/** @param {number} n */
function formatInr(n) {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Client-facing labels for FeatureKeys in packages/shared/src/features.ts (plus the Waiter app). */
const FEATURE_GROUPS = [
  {
    title: 'Sell',
    features: [
      ['pos', 'Point of Sale (POS)'],
      ['billing', 'GST-ready bills &amp; receipts'],
      ['counter_mode', 'Counter / quick-service mode'],
      ['tables', 'Table management'],
      ['waiter', 'Waiter app (Android)'],
    ],
  },
  {
    title: 'Kitchen',
    features: [
      ['kot', 'Kitchen order tickets (KOT)'],
      ['kds', 'Kitchen Display System'],
      ['pickup_queue', 'Pickup queue &amp; Order Display'],
    ],
  },
  {
    title: 'Guests &amp; channels',
    features: [
      ['qr_ordering', 'QR dine-in ordering'],
      ['online_ordering', 'Online ordering storefront'],
      ['delivery', 'Delivery management'],
    ],
  },
  {
    title: 'Back office',
    features: [
      ['basic_reports', 'Sales &amp; item reports'],
      ['inventory', 'Inventory &amp; stock'],
      ['recipes', 'Recipes &amp; costing'],
      ['purchasing', 'Purchasing &amp; suppliers'],
      ['production', 'Production batches'],
      ['events', 'Events &amp; pop-ups'],
    ],
  },
  {
    title: 'Growth',
    features: [
      ['loyalty', 'Loyalty programs'],
      ['crm', 'Customer CRM'],
    ],
  },
  {
    title: 'Scale',
    features: [
      ['multi_outlet', 'Multi-outlet management'],
      ['multi_brand', 'Multi-brand menus'],
      ['franchise', 'Franchise tools'],
      ['advanced_analytics', 'Advanced analytics'],
      ['api_access', 'API access'],
    ],
  },
  {
    title: 'Hospitality',
    features: [
      ['room_service', 'Room service'],
      ['room_posting', 'Post bills to guest room'],
      ['banquet', 'Banquets'],
      ['hospitality_integrations', 'PMS-ready integrations'],
    ],
  },
];

const STARTER_FEATURES = ['pos', 'billing', 'kot', 'basic_reports', 'tables', 'kds', 'qr_ordering', 'online_ordering'];
const PRO_FEATURES = [
  ...STARTER_FEATURES,
  'inventory', 'recipes', 'purchasing', 'crm', 'loyalty', 'delivery', 'pickup_queue', 'production', 'events',
  'waiter',
];
const ENTERPRISE_FEATURES = [
  ...PRO_FEATURES,
  'multi_outlet', 'multi_brand', 'franchise', 'advanced_analytics', 'api_access',
];

/** Must stay aligned with PUBLIC_PLAN_CATALOG / PLAN_FEATURES / PLANS_WITH_WAITER in packages/shared/src/features.ts. */
const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    priceMonthly: 1499,
    priceYearly: 14999,
    maxOutlets: 1,
    maxTerminals: 2,
    maxUsers: 5,
    bestFor: 'Single outlet launch',
    audience: ['Dine-in restaurants', 'New outlets', 'Family restaurants'],
    tagline: 'Everything a single outlet needs on day one — billing, kitchen, tables, and QR &amp; online orders.',
    summary: 'POS, KDS, tables, QR &amp; online ordering, reports',
    delta: 'POS, KDS, tables, QR + online ordering, reports',
    upgradeHint: 'Need loyalty, stock or a pickup counter? See <strong>QSR</strong>. Need CRM, delivery or the Waiter app? See <strong>Professional</strong>.',
    features: STARTER_FEATURES,
  },
  {
    slug: 'qsr',
    name: 'QSR / Food SMB',
    fileName: 'QSR',
    priceMonthly: 2499,
    priceYearly: 24999,
    maxOutlets: 1,
    maxTerminals: 3,
    maxUsers: 8,
    bestFor: 'Cafes, trucks, counters',
    audience: ['Cafes', 'QSR', 'Food trucks', 'Bakeries', 'Kiosks'],
    tagline: 'Built for fast counter service — quick billing, a pickup queue, loyalty, and stock control.',
    summary: 'Counter mode, pickup queue, loyalty, inventory, production',
    delta: '+ counter mode, pickup queue, loyalty, inventory, production',
    upgradeHint: 'Need CRM, delivery, purchasing, the Waiter app or up to 3 outlets? See <strong>Professional</strong>.',
    features: [
      ...STARTER_FEATURES,
      'counter_mode', 'pickup_queue', 'loyalty', 'inventory', 'recipes', 'events', 'production',
    ],
  },
  {
    slug: 'professional',
    name: 'Professional',
    featured: true,
    priceMonthly: 4999,
    priceYearly: 49999,
    maxOutlets: 3,
    maxTerminals: 10,
    maxUsers: 20,
    bestFor: 'Growing restaurants',
    audience: ['Full-service restaurants', 'Growing brands', 'Up to 3 outlets'],
    tagline: 'Full restaurant operations — waiters, back office, CRM, and delivery across up to 3 outlets.',
    summary: 'Full ops — inventory, CRM, delivery, Waiter app, up to 3 outlets',
    delta: '+ inventory, purchasing, CRM, delivery, Waiter app, up to 3 outlets',
    upgradeHint: 'Running a chain, franchise or multiple brands? See <strong>Enterprise</strong>.',
    features: PRO_FEATURES,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    contactSales: true,
    pricingBasis: 'Custom pricing based on outlets, POS terminals, users, integrations and requirements.',
    maxOutlets: 50,
    maxTerminals: 100,
    maxUsers: 200,
    bestFor: 'Chains &amp; franchise',
    audience: ['Restaurant chains', 'Franchise networks', 'Cloud kitchens', 'Multi-brand groups'],
    tagline: 'One platform for your whole network — multi-outlet, multi-brand, franchise, analytics, and API.',
    summary: 'Multi-outlet, multi-brand, franchise, analytics, API',
    delta: '+ multi-outlet, multi-brand, franchise, analytics, API',
    upgradeHint: 'Running hotels, resorts or banquet venues? See <strong>Hospitality</strong>.',
    features: ENTERPRISE_FEATURES,
  },
  {
    slug: 'hospitality',
    name: 'Hospitality',
    contactSales: true,
    pricingBasis: 'Custom pricing based on rooms, outlets, terminals and integrations.',
    maxOutlets: 100,
    maxTerminals: 200,
    maxUsers: 500,
    bestFor: 'Hotels &amp; resorts',
    audience: ['Hotels', 'Resorts', 'Banquet venues', 'Hotel F&amp;B groups'],
    tagline: 'Restaurants, room service, and banquets for hotels and resorts — on the same platform.',
    summary: 'Room service, room posting, banquets, PMS-ready',
    delta: '+ room service, room posting, banquet, PMS-ready',
    upgradeHint: null,
    features: [
      ...ENTERPRISE_FEATURES.filter((f) => !['pickup_queue', 'production', 'events'].includes(f)),
      'room_service', 'room_posting', 'banquet', 'hospitality_integrations',
    ],
  },
];

/** @param {(typeof PLANS)[number]} plan */
function planFileName(plan) {
  return plan.fileName ?? plan.name;
}

/** @param {(typeof PLANS)[number]} plan */
function yearlySaving(plan) {
  if (plan.contactSales) return 0;
  return plan.priceMonthly * 12 - plan.priceYearly;
}

const CONTACT_PRICE = 'Contact us';

/** @param {(typeof PLANS)[number]} plan */
function monthlyPriceHtml(plan) {
  return plan.contactSales ? CONTACT_PRICE : `${formatInr(plan.priceMonthly)} <span>/ month</span>`;
}

function planCardsHtml(gridClass = 'grid-3') {
  const cards = PLANS.map(
    (p) => `<div class="plan${p.featured ? ' featured' : ''}"><div class="plan-kicker">${p.name}${p.featured ? ' <span class="tag">Most popular</span>' : ''}</div><div class="price">${monthlyPriceHtml(p)}</div><p class="small muted">${p.contactSales ? p.pricingBasis : p.summary}</p></div>`,
  ).join('\n    ');
  return `<div class="${gridClass}">
    ${cards}
  </div>
  <p class="small muted">${PRICE_NOTE} Yearly billing available. Custom quotes for special requirements.</p>`;
}

/** @param {(typeof PLANS)[number]} plan */
function planDetailHtml(plan) {
  const included = new Set(plan.features);
  const groups = FEATURE_GROUPS.map((g) => {
    const items = g.features.filter(([key]) => included.has(key));
    if (items.length === 0) return '';
    return `<div class="card feature-card"><div class="kicker">${g.title}</div><ul class="check">${items
      .map(([, label]) => `<li>${label}</li>`)
      .join('')}</ul></div>`;
  }).join('\n    ');
  const saving = yearlySaving(plan);

  return `
<div class="plan-hero">
  <div class="plan-hero-top">
    <div class="mark mark-sm">C</div>
    <span class="eyebrow" style="margin:0">Cullinos plan</span>
    ${plan.featured ? '<span class="tag">Most popular</span>' : ''}
  </div>
  <div class="plan-hero-body">
    <div>
      <h1 class="display">${plan.name}</h1>
      <p class="tagline">${plan.tagline}</p>
    </div>
    <div class="price-block">
      <div class="price-main">${monthlyPriceHtml(plan)}</div>
      ${
        plan.contactSales
          ? `<div class="price-alt">Contact us for pricing</div>
      <div class="price-note">${plan.pricingBasis}</div>`
          : `<div class="price-alt">or ${formatInr(plan.priceYearly)} / year${saving > 0 ? ` · save ${formatInr(saving)}` : ''}</div>
      <div class="price-note">${PRICE_NOTE}</div>`
      }
    </div>
  </div>
</div>

<div class="limits">
  <div><strong>${plan.maxOutlets}</strong><span>${plan.maxOutlets === 1 ? 'Outlet' : 'Outlets'}</span></div>
  <div><strong>${plan.maxTerminals}</strong><span>POS terminals</span></div>
  <div><strong>${plan.maxUsers}</strong><span>Staff users</span></div>
</div>

<p class="eyebrow" style="margin:0 0 6px">Best for</p>
<div class="pill-row">${plan.audience.map((a, i) => `<span class="pill${i === 0 ? ' gold' : ''}">${a}</span>`).join('')}</div>

<h2>What’s included</h2>
<div class="grid-3 feature-grid">
    ${groups}
</div>
<p class="small muted">Always included: Admin console, menu management, tax &amp; outlet settings.</p>
${plan.upgradeHint ? `<p class="small upgrade">${plan.upgradeHint}</p>` : ''}`;
}

const PLAN_CTA = `
<div class="banner">
  <h3>Ready to get started?</h3>
  <p>Book a walkthrough and we’ll help you pick the right plan for your outlets.</p>
  <div class="cta">cullinos.com/contact · hello@rkyves.com</div>
</div>`;

const PLAN_DOC_CSS = `
@page { size: A4; margin: 10mm; }
h2 { margin-top: 18px; }
.limits { margin: 10px 0 12px; }
.pill-row { margin: 6px 0 10px; }
.banner { margin: 12px 0; padding: 14px 18px; }
.footer-bar { margin-top: 14px; padding-top: 10px; }
table.matrix { line-height: 1.3; }
table.matrix td { padding: 2px 6px; }
@media print {
  .page { padding: 4px 2px; }
}
`;

function comparisonMatrixHtml() {
  const head = PLANS.map((p) => `<th${p.featured ? ' class="featured"' : ''}>${p.name}</th>`).join('');
  const cell = (p, html) => `<td${p.featured ? ' class="featured"' : ''}>${html}</td>`;
  const row = (label, render, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td>${label}</td>${PLANS.map((p) => cell(p, render(p))).join('')}</tr>`;
  const groupRow = (title) => `<tr class="group"><td colspan="${PLANS.length + 1}">${title}</td></tr>`;

  const rows = [
    groupRow('Pricing &amp; limits'),
    row('Monthly', (p) => (p.contactSales ? CONTACT_PRICE : formatInr(p.priceMonthly)), 'key'),
    row('Yearly', (p) => (p.contactSales ? CONTACT_PRICE : formatInr(p.priceYearly))),
    row('Outlets', (p) => String(p.maxOutlets)),
    row('POS terminals', (p) => String(p.maxTerminals)),
    row('Staff users', (p) => String(p.maxUsers)),
  ];
  for (const g of FEATURE_GROUPS) {
    rows.push(groupRow(g.title));
    for (const [key, label] of g.features) {
      rows.push(
        row(label, (p) => (p.features.includes(key) ? '<span class="yes">✓</span>' : '<span class="no">—</span>')),
      );
    }
  }

  return `<table class="matrix">
    <thead><tr><th>Feature</th>${head}</tr></thead>
    <tbody>
      ${rows.join('\n      ')}
    </tbody>
  </table>`;
}

function plansBrochureHtml() {
  const planPages = PLANS.map(
    (p) => `
<section class="page section-break">
  ${planDetailHtml(p)}
  ${footer(`Cullinos Plans · ${p.name}`)}
</section>`,
  ).join('\n');

  const body = `
${cover({
  eyebrow: 'Plans &amp; pricing',
  title: 'Plans built for<br/>every kitchen.',
  subtitle: 'From a single cafe counter to hotel and franchise networks — pick the Cullinos plan that fits your business today, and upgrade as you grow.',
  meta: 'cullinos.com · Mumbai, India · 2026',
})}

<section class="page">
  <p class="eyebrow">Choose your plan</p>
  <h2 style="border:none;margin-top:0">Which plan fits you?</h2>
  <p class="lead">Every plan runs on the same Cullinos platform — GST-ready billing, cloud Admin, and live kitchen tickets. Plans differ in the tools and scale you need.</p>

  <table class="pretty">
    <thead><tr><th>Your business</th><th>Recommended plan</th><th>Why</th></tr></thead>
    <tbody>
      <tr><td>Single dine-in restaurant, just starting out</td><td><strong>Starter</strong></td><td>POS, kitchen display, tables, and QR &amp; online ordering on day one</td></tr>
      <tr><td>Cafe, bakery, food truck, or kiosk</td><td><strong>QSR / Food SMB</strong></td><td>Counter mode, pickup queue, loyalty, and stock control for fast service</td></tr>
      <tr><td>Growing restaurant with waiters and delivery (up to 3 outlets)</td><td><strong>Professional</strong></td><td>Full back office, CRM, delivery, purchasing, and the Waiter app</td></tr>
      <tr><td>Chain, franchise, or multi-brand cloud kitchen</td><td><strong>Enterprise</strong></td><td>Multi-outlet control, multi-brand menus, franchise tools, analytics, API</td></tr>
      <tr><td>Hotel, resort, or banquet venue</td><td><strong>Hospitality</strong></td><td>Room service, post bills to guest rooms, banquets, PMS-ready</td></tr>
    </tbody>
  </table>

  <h2>Plans at a glance</h2>
  ${planCardsHtml()}
  ${footer('Cullinos Plans &amp; Pricing')}
</section>
${planPages}

<section class="page section-break">
  <p class="eyebrow">Side by side</p>
  <h2 style="border:none;margin-top:0">Compare plans</h2>
  ${comparisonMatrixHtml()}
  <p class="small muted">${PRICE_NOTE} Admin console, menu management, and tax &amp; outlet settings are included in every plan.</p>
</section>

<section class="page section-break">
  <p class="eyebrow">Custom plans</p>
  <h2 style="border:none;margin-top:0">Need something different?</h2>
  <p class="lead">Larger networks, unusual outlet counts, or a specific mix of modules? We build private plans for your business — with the modules, limits, and pricing you need. Custom plans are assigned directly to your account.</p>

  <h2>How to get started</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Book a walkthrough</h3><p>See Cullinos running for a business like yours.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Pick your plan</h3><p>Monthly or yearly billing — or ask for a custom quote.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Set up your outlet</h3><p>Guided setup for your business type, GSTIN, menu, and staff.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Go live</h3><p>Start billing, sending tickets to the kitchen, and taking QR &amp; online orders.</p></div></div>

  ${PLAN_CTA}
  ${footer('Cullinos Plans &amp; Pricing')}
</section>`;
  return shell('Cullinos Plans &amp; Pricing', body, PLAN_DOC_CSS);
}

/** @param {(typeof PLANS)[number]} plan */
function planSheetHtml(plan) {
  const body = `
<section class="page">
  ${planDetailHtml(plan)}
  ${PLAN_CTA}
  ${footer(`Cullinos · ${plan.name} plan`)}
</section>`;
  return shell(`Cullinos ${plan.name} Plan`, body, PLAN_DOC_CSS);
}

function brochureHtml() {
  const body = `
${cover({
  eyebrow: 'Client brochure',
  title: 'One system.<br/>Every service moment.',
  subtitle: 'Cullinos is the restaurant operating system for POS, kitchen, floor, QR &amp; online orders, Guest marketplace, aggregators, and back office — built for India.',
  meta: 'cullinos.com · Mumbai, India · 2026',
})}

<section class="page">
  <p class="eyebrow">Why Cullinos</p>
  <h2 style="border:none;margin-top:0">Your food business, running as one</h2>
  <p class="lead">Stop juggling separate tools for billing, kitchen tickets, QR ordering, delivery apps, and marketing. Cullinos connects cashier, kitchen, waiter, guests, aggregators, and owners on one platform — with GST billing, Razorpay, and the Cullinos Guest app.</p>

  <div class="grid-3">
    <div class="card"><div class="kicker">GST-ready</div><h3>India billing built in</h3><p>CGST, SGST, and IGST on every invoice — not bolted on later.</p></div>
    <div class="card"><div class="kicker">Every channel</div><h3>Floor to marketplace</h3><p>POS, Waiter, QR storefront, kiosk, Guest app, Swiggy &amp; Zomato.</p></div>
    <div class="card"><div class="kicker">Grow ready</div><h3>One outlet to chains</h3><p>Same platform from a single cafe to multi-brand hospitality.</p></div>
  </div>

  <h2>What you get</h2>
  <div class="grid-2">
    <div class="card"><h3>Point of Sale</h3><p>Touch cashier, holds, shifts, takeaway, GST receipts, Razorpay payments — plus Portal POS inside Admin.</p></div>
    <div class="card"><h3>Kitchen &amp; displays</h3><p>Live KDS tickets, Order Display (CDS), promo playlists, and receipt print profiles.</p></div>
    <div class="card"><h3>Waiter, tables &amp; reservations</h3><p>Floor ordering, QR table sessions, service requests, and book-link reservations.</p></div>
    <div class="card"><h3>Online, QR &amp; kiosk</h3><p>Branded storefront, scan-to-order, and Digital Ordering / kiosk — menu synced from Admin.</p></div>
    <div class="card"><h3>Cullinos Guest app</h3><p>Android marketplace: nearby outlets, banners, push, loyalty wallets, reorder.</p></div>
    <div class="card"><h3>Back office &amp; supply</h3><p>Menu, inventory, recipes, purchasing, suppliers, production, central kitchen, ERP export.</p></div>
    <div class="card"><h3>CRM &amp; marketing</h3><p>Customers, loyalty, coupons, promo email, SMS campaigns, feedback surveys.</p></div>
    <div class="card"><h3>Enterprise &amp; hospitality</h3><p>Multi-outlet KPIs, stock transfers, franchise, room service, banquets, aggregators.</p></div>
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
  ${planCardsHtml()}

  <div class="banner">
    <h3>Ready to see Cullinos in your outlet?</h3>
    <p>Book a walkthrough or start a conversation with the Rkyves team. Ask for the Product Overview for the full feature catalogue.</p>
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
  subtitle: 'A complete guide to the Cullinos Restaurant Operating System: apps, features, Guest marketplace, aggregators, verticals, and plans.',
  meta: 'For decision makers · cullinos.com · 2026',
})}

<section class="page">
  <p class="eyebrow">The product</p>
  <h2 style="border:none;margin-top:0">Cullinos is your food business OS</h2>
  <p class="lead">Cullinos is a multi-app platform from <strong>Rkyves</strong>. One backend powers POS, kitchen displays, waiter floor service, guest QR/online ordering, the Cullinos Guest marketplace app, owner Admin, multi-outlet Management, and aggregators — so every role works from the same live data.</p>

  <div class="banner">
    <h3>“One login for cashier, kitchen, online orders, Guest app marketing, production, and reports.”</h3>
    <p>GST + Razorpay + MSG91 built in. Scales from a single counter to hotel and franchise networks.</p>
  </div>

  <h2>The Cullinos apps</h2>
  <table class="pretty">
    <thead><tr><th>App</th><th>Who uses it</th><th>What it does</th></tr></thead>
    <tbody>
      <tr><td><strong>Admin</strong><br/><span class="small muted">admin.cullinos.com</span></td><td>Owner / manager</td><td>Menu, staff, inventory, purchasing, central kitchen, loyalty, delivery, aggregators, reservations, Guest app marketing, reports, billing, Portal POS</td></tr>
      <tr><td><strong>POS</strong><br/><span class="small muted">pos.cullinos.com</span></td><td>Cashier</td><td>Counter &amp; takeaway billing, holds, shifts, GST receipts, payments (browser + Windows desktop)</td></tr>
      <tr><td><strong>KDS</strong><br/><span class="small muted">kds.cullinos.com</span></td><td>Kitchen</td><td>Live kitchen tickets; Order Display (CDS), promo playlist, receipt modes (browser + desktop)</td></tr>
      <tr><td><strong>Waiter</strong><br/><span class="small muted">Cullinos Waiter (Android)</span></td><td>Floor staff</td><td>Table map, table-side orders, QR guest sessions</td></tr>
      <tr><td><strong>Customer</strong><br/><span class="small muted">order.cullinos.com</span></td><td>Guests (web)</td><td>QR dine-in, online storefront, kiosk (guest checkout; optional OTP login)</td></tr>
      <tr><td><strong>Guest app</strong><br/><span class="small muted">Android · guest.cullinos.com</span></td><td>Consumers</td><td>Marketplace discover, outlet order, reorder, push, loyalty wallets</td></tr>
      <tr><td><strong>Management</strong><br/><span class="small muted">manage.cullinos.com</span></td><td>Multi-outlet ops</td><td>Network KPIs, outlet comparison, stock transfer, franchise</td></tr>
      <tr><td><strong>Super Admin</strong><br/><span class="small muted">platform.cullinos.com</span></td><td>Rkyves</td><td>Tenants, plans, marketing CMS, Guest banners/push, platform config</td></tr>
    </tbody>
  </table>

  <h2 class="section-break">Feature catalogue</h2>

  <h3>Front of house</h3>
  <div class="grid-2">
    <div class="card"><h3>Point of Sale</h3><p>Fast checkout, modifiers, holds, takeaway, shifts, GST-compliant receipts.</p></div>
    <div class="card"><h3>Portal POS</h3><p>Full cashier experience inside Admin for QSR / counter teams.</p></div>
    <div class="card"><h3>Waiter app</h3><p>Mobile table-side ordering and live table status.</p></div>
    <div class="card"><h3>Table management</h3><p>Tables, capacities, merge/transfer, service requests.</p></div>
    <div class="card"><h3>Reservations</h3><p>Admin booking calendar plus public book-link for guests.</p></div>
    <div class="card"><h3>Kitchen Display (KDS)</h3><p>Route KOTs, track prep, mark items ready.</p></div>
    <div class="card"><h3>Order Display (CDS)</h3><p>Customer-facing preparing / ready board for pickup counters.</p></div>
    <div class="card"><h3>Promo display</h3><p>In-venue promo playlists on TV or tablet.</p></div>
  </div>

  <h3>Customer channels</h3>
  <div class="grid-2">
    <div class="card"><h3>QR dine-in ordering</h3><p>Guests scan a table session QR and order into the same ticket.</p></div>
    <div class="card"><h3>Online storefront</h3><p>Branded ordering link for pickup and delivery.</p></div>
    <div class="card"><h3>Digital Ordering / kiosk</h3><p>Admin launcher for kiosk and storefront URLs.</p></div>
    <div class="card"><h3>Customer login</h3><p>Optional phone OTP login without blocking guest checkout.</p></div>
    <div class="card"><h3>Cullinos Guest app</h3><p>Android marketplace with nearby outlets, deep links, FCM push.</p></div>
    <div class="card"><h3>Loyalty portal</h3><p>Public loyalty view on the customer storefront.</p></div>
  </div>

  <h3>Cullinos App (marketplace marketing)</h3>
  <div class="grid-2">
    <div class="card"><h3>App listing</h3><p>Control how your outlet appears in the Guest marketplace.</p></div>
    <div class="card"><h3>Guest banners</h3><p>Home / discover creatives managed from Admin.</p></div>
    <div class="card"><h3>Push campaigns</h3><p>Order status and marketing push via Firebase FCM.</p></div>
    <div class="card"><h3>Coupons &amp; offers</h3><p>Discount codes validated at Guest and Customer checkout.</p></div>
  </div>

  <h3>Back office &amp; supply chain</h3>
  <div class="grid-2">
    <div class="card"><h3>Menu management</h3><p>Categories, items, pricing, availability, modifiers.</p></div>
    <div class="card"><h3>Inventory</h3><p>Stock levels, adjustments, and outlet stock visibility.</p></div>
    <div class="card"><h3>Recipes &amp; costing</h3><p>Link ingredients to dishes for production and cost control.</p></div>
    <div class="card"><h3>Purchasing &amp; suppliers</h3><p>POs, GRN, and supplier directory.</p></div>
    <div class="card"><h3>Production &amp; batches</h3><p>Schedule and complete production batches.</p></div>
    <div class="card"><h3>Central kitchen</h3><p>Indents and fulfillment across linked outlets.</p></div>
    <div class="card"><h3>Wastage</h3><p>Log waste against inventory.</p></div>
    <div class="card"><h3>ERP day-book export</h3><p>Accounting-friendly daily export.</p></div>
    <div class="card"><h3>Staff &amp; permissions</h3><p>Roles with route-level access control.</p></div>
    <div class="card"><h3>Reports &amp; analytics</h3><p>Revenue, top items, outlet performance.</p></div>
    <div class="card"><h3>Billing &amp; GST</h3><p>Tax-ready bills and SaaS subscription billing.</p></div>
    <div class="card"><h3>Settings &amp; onboarding</h3><p>Business type wizard, GSTIN, order types, org config.</p></div>
  </div>

  <h3>Growth &amp; engagement</h3>
  <div class="grid-2">
    <div class="card"><h3>CRM / Customers</h3><p>Customer profiles, tiers, and order history.</p></div>
    <div class="card"><h3>Loyalty</h3><p>Stamp cards, points, and rewards programs.</p></div>
    <div class="card"><h3>Promo Email</h3><p>Compose and send promotional campaigns.</p></div>
    <div class="card"><h3>SMS campaigns</h3><p>MSG91 marketing SMS to your guest list.</p></div>
    <div class="card"><h3>Delivery</h3><p>Track and manage delivery orders from Admin.</p></div>
    <div class="card"><h3>Aggregators</h3><p>Swiggy / Zomato connect, webhooks, settlements.</p></div>
    <div class="card"><h3>Events</h3><p>Schedule pop-ups and event-driven pre-orders.</p></div>
    <div class="card"><h3>Feedback</h3><p>Post-order survey links and public submit.</p></div>
    <div class="card"><h3>Privacy &amp; consent</h3><p>Consent, export/erase, and retention controls.</p></div>
  </div>

  <h3>Enterprise &amp; hospitality</h3>
  <div class="grid-2">
    <div class="card"><h3>Multi-outlet management</h3><p>Consolidated KPIs and outlet comparison.</p></div>
    <div class="card"><h3>Stock transfer</h3><p>Move inventory between outlets.</p></div>
    <div class="card"><h3>Multi-brand</h3><p>Cloud kitchen / brand catalogue support.</p></div>
    <div class="card"><h3>Franchise tools</h3><p>Franchisee visibility for chain operators.</p></div>
    <div class="card"><h3>Banquets</h3><p>Banquet and large-event workflows.</p></div>
    <div class="card"><h3>Guests &amp; Rooms</h3><p>Hospitality guest profiles and room posting.</p></div>
  </div>

  <h3>Integrations</h3>
  <div class="grid-2">
    <div class="card"><h3>Razorpay</h3><p>Online payments for storefront, Guest app, and subscriptions.</p></div>
    <div class="card"><h3>MSG91</h3><p>Phone OTP and marketing SMS.</p></div>
    <div class="card"><h3>Firebase</h3><p>Guest auth and FCM push notifications.</p></div>
    <div class="card"><h3>Hardware / print</h3><p>Receipt &amp; KOT printers, cash drawer, scanners via Local Gateway.</p></div>
  </div>

  <h2 class="section-break">Who we serve</h2>
  <table class="pretty">
    <thead><tr><th>Vertical</th><th>How Cullinos fits</th></tr></thead>
    <tbody>
      <tr><td>Restaurants</td><td>Tables, waiter, reservations, QR dine-in, KDS, full back office</td></tr>
      <tr><td>Cafes &amp; QSR</td><td>Counter POS, pickup queue / Order Display, loyalty, kiosk</td></tr>
      <tr><td>Food trucks &amp; pop-ups</td><td>Mobile-friendly POS, events, quick service</td></tr>
      <tr><td>Bakeries</td><td>Production batches, recipes, pre-orders</td></tr>
      <tr><td>Cloud kitchens</td><td>Multi-brand menus, delivery, aggregators, central kitchen</td></tr>
      <tr><td>Catering</td><td>Events, pre-orders, production planning</td></tr>
      <tr><td>Hotels &amp; resorts</td><td>Room service, rooms, banquets (Hospitality / Enterprise)</td></tr>
    </tbody>
  </table>

  <h2>Plans &amp; offerings</h2>
  <p class="muted small">List prices for India (INR). Taxes as applicable. Custom enterprise quotes available.</p>
  <table class="pretty">
    <thead><tr><th>Plan</th><th>From</th><th>Best for</th><th>Highlights</th></tr></thead>
    <tbody>
      ${PLANS.map(
        (p) =>
          `<tr><td><strong>${p.name}</strong></td><td>${p.contactSales ? CONTACT_PRICE : `${formatInr(p.priceMonthly)}/mo`}</td><td>${p.bestFor}</td><td>${p.delta}</td></tr>`,
      ).join('\n      ')}
    </tbody>
  </table>

  <div class="banner">
    <h3>Next step</h3>
    <p>See the live product at cullinos.com · Request a demo via contact · Or ask for the User Manual after onboarding. Full internal reference: docs/PRODUCT.md</p>
    <div class="cta">hello@rkyves.com · Mumbai, India</div>
  </div>
  ${footer('Cullinos Product Overview')}
</section>`;
  return shell('Cullinos Product Overview', body);
}

const AGENCY_CSS = `
.flow { display: flex; align-items: center; gap: 10px; margin: 14px 0 18px; page-break-inside: avoid; }
.flow-sources { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.flow-sources span { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; font-size: 9pt; }
.flow-arrow { font-size: 18pt; color: var(--gold); }
.flow-node { background: var(--ink); color: var(--gold-bright); border-radius: 12px; padding: 14px 16px; font-weight: 700; text-align: center; flex: 0 0 150px; }
table.pretty.compact { font-size: 9pt; }
table.pretty.compact td { padding: 6px 9px; }
.dont td:first-child { color: #9b2c2c; font-weight: 600; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; margin-right: 4px; border: 1px solid var(--line); }
`;

/** @param {string[]} headers @param {string[][]} rows @param {string} [cls] */
function tableHtml(headers, rows, cls = 'pretty compact') {
  return `<table class="${cls}">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n      ')}
    </tbody>
  </table>`;
}

function agencyBriefHtml() {
  const body = `
${cover({
  eyebrow: 'Agency &amp; creator brief',
  title: 'Everything you need to tell the Cullinos story',
  subtitle: 'What Cullinos is, every feature in plain language, who it is for, how to talk about it, content ideas, and the claims to avoid.',
  meta: 'For marketing agencies &amp; content creators · cullinos.com · 2026',
})}

<section class="page">
  <p class="eyebrow">1 · Cullinos in one page</p>
  <h2 style="border:none;margin-top:0">Your food business operating system</h2>
  <p class="lead">One login runs the cashier, kitchen, QR &amp; online orders, the Cullinos Guest marketplace app, production, and reports — for restaurants, cafes, food trucks, bakeries, cloud kitchens, bars, and hotels. GST billing built in. Made in Mumbai by <strong>Rkyves</strong>.</p>

  <div class="grid-3">
    <div class="card"><div class="kicker">GST-ready</div><h3>India billing built in</h3><p>CGST, SGST, and IGST on every bill — not bolted on later.</p></div>
    <div class="card"><div class="kicker">Every channel</div><h3>One kitchen</h3><p>POS, waiter, QR, storefront, kiosk, Guest app, Swiggy &amp; Zomato — all on one kitchen screen.</p></div>
    <div class="card"><div class="kicker">Scales</div><h3>Truck to hotel chain</h3><p>The same platform from a single counter to a multi-outlet hotel group.</p></div>
  </div>

  <div class="banner">
    <h3>The one-line pitch</h3>
    <p>Stop juggling five apps to run one restaurant. Cullinos runs billing, kitchen, orders, stock, and marketing as one live system.</p>
  </div>

  <h2>2 · The problem we solve</h2>
  <p>A typical Indian restaurant runs on a patchwork: a basic billing machine, paper kitchen tickets that get lost, separate Swiggy and Zomato tablets, Excel for stock, WhatsApp groups for staff, and nothing (or another tool) for loyalty and customer data. Every tool has its own menu, prices, and login — and nothing talks to anything else.</p>
  <p><strong>Cullinos replaces the patchwork with one live system.</strong> Change a price once and it updates on the POS, QR menu, kiosk, and Guest app. An order from any channel appears on the kitchen screen instantly. Sales, stock, and customers live in one dashboard.</p>

  <h2>3 · How it works</h2>
  ${HOW_IT_WORKS.map((s, i) => `<div class="step"><div class="step-num">${i + 1}</div><div><h3>${s[0]}</h3><p>${s[1]}</p></div></div>`).join('\n  ')}
  <div class="flow">
    <div class="flow-sources">
      <span>Cashier POS</span><span>Waiter app</span><span>Table QR</span><span>Online storefront &amp; kiosk</span><span>Cullinos Guest app</span><span>Swiggy &amp; Zomato</span>
    </div>
    <div class="flow-arrow">→</div>
    <div class="flow-node">Kitchen Display</div>
    <div class="flow-arrow">→</div>
    <div class="flow-node">One GST-ready ledger &amp; reports</div>
  </div>

  <h2 class="section-break">4 · The apps, explained like a person would use them</h2>
  <p class="muted small">Each role gets its own focused app. They all share the same live data.</p>
  ${tableHtml(['App', 'Who uses it', 'What it does', 'A moment you can film'], AGENCY_APPS)}

  <h2 class="section-break">5 · Full feature tour</h2>
  <p class="muted small">Everything below is live today. Each line gives what it is and why a restaurant cares.</p>
  ${AGENCY_FEATURE_GROUPS.map(
    (g) => `<h3>${g.title}</h3>
  ${tableHtml(g.withWhy ? ['Feature', 'What it is', 'Why it matters'] : ['Feature', 'What it is'], g.rows.map((r) => [`<strong>${r[0]}</strong>`, ...r.slice(1)]))}`,
  ).join('\n  ')}
  <p class="small muted">Restaurants control their Guest app listing and banners from Admin. Featured placement, Discover curation, and app-wide push campaigns are run by the Rkyves team.</p>
  <h3>Bars &amp; pubs</h3>
  <p>An automatic Bar station on the kitchen display, happy-hour pricing, pour-size recipes tracked against bottle stock, a liquor stock register with CSV export, and a State Excise tax group.</p>

  <h2 class="section-break">6 · Who it's for</h2>
  ${tableHtml(['Vertical', 'The story to tell'], AGENCY_VERTICALS)}
  <h3>Personas</h3>
  ${tableHtml(['Persona', 'What they worry about', 'What to show them'], AGENCY_PERSONAS)}

  <h2>7 · Plans &amp; pricing</h2>
  ${planCardsHtml()}

  <h2>8 · Integrations</h2>
  ${tableHtml(['Integration', 'What it does'], AGENCY_INTEGRATIONS)}

  <h2 class="section-break">9 · Brand messaging kit</h2>
  <h3>Positioning statement</h3>
  <p>For Indian food businesses tired of juggling separate billing, kitchen, delivery, and marketing tools, <strong>Cullinos</strong> is the restaurant operating system that runs every role and every order channel on one live platform, with GST billing built in. Unlike a basic POS, Cullinos connects cashier, kitchen, floor, guests, and owner — from one outlet to a hotel chain.</p>
  <h3>Key messages</h3>
  <ol>
    <li><strong>One system, every service moment.</strong> Billing, kitchen, floor, online, and back office, connected.</li>
    <li><strong>Every order reaches one kitchen.</strong> POS, waiter, QR, app, and aggregator orders on the same screen.</li>
    <li><strong>Built for India.</strong> GST invoices, UPI payments, SMS and WhatsApp, phone OTP.</li>
    <li><strong>Each role gets its own app.</strong> Cashier, chef, and waiter each see only what they need.</li>
    <li><strong>Grows with you.</strong> From a food truck to a franchise network, on the same platform.</li>
  </ol>
  <h3>Tagline options</h3>
  <div class="pill-row">
    <span class="pill gold">Your food business operating system.</span>
    <span class="pill">One system. Every service moment.</span>
    <span class="pill">Every order channel. One kitchen.</span>
    <span class="pill">From one outlet to hotel chains — same platform.</span>
  </div>
  <h3>Tone of voice</h3>
  <ul>
    <li><strong>Confident, practical, warm</strong> — like an experienced restaurant manager, not a software salesperson.</li>
    <li><strong>Show the moment, not the module</strong> — "the grill sees the order the second it's placed", not "KDS with station routing".</li>
    <li><strong>India-first</strong> — rupee prices, UPI, GST, lunch-rush and chai-break examples.</li>
    <li><strong>Plain language</strong> — explain jargon (see the glossary) or avoid it.</li>
  </ul>
  <h3>Names to use exactly</h3>
  ${tableHtml(['Use', 'Avoid'], AGENCY_NAMES)}

  <h2 class="section-break">10 · Content ideas</h2>
  <h3>Reel &amp; short-video hooks</h3>
  ${tableHtml(['Feature', 'Hook idea'], AGENCY_HOOKS)}
  <h3>Series ideas</h3>
  <ul>
    <li><strong>A day in the life</strong> — follow one order from QR scan to kitchen, Ready board, bill, and the owner's report.</li>
    <li><strong>Before / after Cullinos</strong> — paper tickets and five tablets compared with one system.</li>
    <li><strong>Owner confessions</strong> — real pain points (cash leakage, wrong orders, stock-outs), each answered by one feature.</li>
    <li><strong>One feature, 30 seconds</strong> — a quick explainer per feature in section 5.</li>
    <li><strong>Vertical spotlights</strong> — cafes, bakeries, cloud kitchens, bars, hotels.</li>
  </ul>
  <h3>60-second demo script</h3>
  ${tableHtml(['Time', 'Visual', 'Voiceover'], AGENCY_SCRIPT)}
  <h3>Carousel / post ideas</h3>
  <ul>
    <li>"5 signs your restaurant has outgrown its billing software"</li>
    <li>"What happens to an order in Cullinos" (step-by-step)</li>
    <li>"GST billing without the headache"</li>
    <li>"Which Cullinos plan fits you?"</li>
    <li>"The real cost of a dish" (recipe costing explainer)</li>
    <li>Customer story template (only with written permission from the restaurant)</li>
  </ul>
  <h3>Campaign themes by vertical</h3>
  ${tableHtml(['Vertical', 'Campaign theme'], AGENCY_CAMPAIGNS)}

  <h2 class="section-break">11 · Assets &amp; links</h2>
  <h3>Product visuals</h3>
  <p class="small">Mockup illustrations in <code>apps/web/public/images/</code>: <code>mockup-pos.svg</code>, <code>mockup-kds.svg</code>, <code>mockup-waiter.svg</code>, <code>mockup-ordering.svg</code>, <code>mockup-admin.svg</code>, <code>mockup-enterprise.svg</code>, <code>flow-cloud.svg</code>. Ask Rkyves for screen recordings or a demo account. Never publish a real restaurant's customer data or sales figures without written permission.</p>
  <h3>Brand basics</h3>
  <p class="small"><span class="swatch" style="background:#0F0F1A"></span>Ink #0F0F1A &nbsp; <span class="swatch" style="background:#D4A017"></span>Gold #D4A017 &nbsp; <span class="swatch" style="background:#F5A623"></span>Bright gold #F5A623 &nbsp; <span class="swatch" style="background:#F7F4EE"></span>Cream #F7F4EE · Headlines in <strong>Fraunces</strong>, body in <strong>DM Sans</strong>.</p>
  <h3>Links</h3>
  ${tableHtml(['What', 'URL'], AGENCY_LINKS)}
  <p class="small muted">Also available on request: Brochure, Product Overview, Plans Brochure, User Manual.</p>

  <h2>12 · Do's and don'ts</h2>
  <h3>Do</h3>
  <ul>
    <li>Show real service moments (rush hour, table QR, kitchen screen) rather than abstract dashboards.</li>
    <li>Say "GST-ready billing with CGST, SGST, and IGST".</li>
    <li>Say Swiggy and Zomato orders <strong>come into</strong> Cullinos alongside your own orders.</li>
    <li>Mention that the Guest app is on <strong>Android</strong>.</li>
    <li>Send any new claim, statistic, or customer quote to Rkyves for approval before publishing.</li>
  </ul>
  <h3>Don't</h3>
  ${tableHtml(["Don't say", 'Why', 'Say instead'], AGENCY_DONTS, 'pretty compact dont')}

  <h2 class="section-break">13 · Glossary</h2>
  ${tableHtml(['Term', 'Meaning'], AGENCY_GLOSSARY.map(([t, m]) => [`<strong>${t}</strong>`, m]))}

  <div class="banner">
    <h3>Questions, approvals, demo access</h3>
    <p>Send drafts and claims to the Rkyves team before publishing.</p>
    <div class="cta">hello@rkyves.com · cullinos.com · Mumbai, India</div>
  </div>
  ${footer('Cullinos Agency &amp; Creator Brief')}
</section>`;
  return shell('Cullinos Agency & Creator Brief', body, AGENCY_CSS);
}

const HOW_IT_WORKS = [
  ['Set up your outlet', 'Add your menu, tables, staff, and GST settings in the Admin dashboard.'],
  ['Take orders anywhere', 'POS, waiter app, table QR, online storefront, kiosk, or the Guest app — all connected.'],
  ['The kitchen stays in sync', 'Orders appear on the Kitchen Display instantly — from floor, web, app, or aggregators.'],
  ['Track and grow', 'See sales, inventory, customers, and reports. Add outlets when you are ready.'],
];

const AGENCY_APPS = [
  ['<strong>POS</strong><br/><span class="small muted">browser + Windows</span>', 'Cashier', 'Touch billing, modifiers, hold / resume, takeaway, cash &amp; online payments, GST receipts', 'Cashier clears a lunch rush in seconds; receipt prints instantly'],
  ['<strong>Portal POS</strong>', 'Counter teams', 'Full cashier screen inside Admin — no separate device needed', 'Owner billing from the same laptop they manage the menu on'],
  ['<strong>Kitchen Display</strong>', 'Kitchen', 'Live tickets routed to stations; tap to mark ready', 'New order pops onto the kitchen screen the moment a guest orders'],
  ['<strong>Order Display</strong>', 'Guests at the counter', 'Preparing → Ready board', 'Order number flips to Ready on a TV'],
  ['<strong>Promo display</strong>', 'Guests in venue', 'Promo playlists on TV or tablet', "In-store TV cycling today's specials"],
  ['<strong>Waiter app</strong><br/><span class="small muted">Android</span>', 'Floor staff', 'Table map, table-side orders, QR sessions', 'Kitchen updates before the waiter walks away'],
  ['<strong>Admin</strong>', 'Owner / manager', 'Menu, staff, stock, purchasing, CRM, loyalty, reports, Guest app listing &amp; banners', 'Change a price once; it updates everywhere'],
  ['<strong>Management</strong>', 'Chains', 'Network KPIs, outlet comparison, stock transfer, franchise', "Three outlets' sales side by side"],
  ['<strong>Cullinos Guest app</strong><br/><span class="small muted">Android</span>', 'Diners', 'Discover nearby outlets, order, reorder, loyalty, push updates', 'Diner finds a cafe, orders, gets "Your order is ready"'],
  ['<strong>Storefront &amp; table QR</strong><br/><span class="small muted">guest.cullinos.com</span>', 'Diners', 'Branded web menu; scan table QR to order into the bill', 'Guest scans, orders, food arrives — no waving for a waiter'],
];

const AGENCY_FEATURE_GROUPS = [
  {
    title: 'Front of house',
    withWhy: true,
    rows: [
      ['Point of Sale', 'Touch checkout, modifiers, holds, takeaway, discounts, split bills, GST receipts', 'Faster billing, compliant invoices'],
      ['Cashier shifts', 'Open / close shifts with cash-drawer accountability', 'Know who handled the cash'],
      ['Waiter app', 'Mobile table-side ordering, live status', 'Fewer trips, fewer wrong orders'],
      ['Table management', 'Table map, merge / transfer, service requests', 'Smooth turnover on busy nights'],
      ['Table sessions &amp; QR', 'Guests scan and add to the same table bill', 'Guests order more, staff run less'],
      ['Reservations', 'Admin bookings plus a public booking link', 'Share the link on Instagram or Google'],
      ['Kitchen Display &amp; KOT', 'Live tickets on screen or printed, station routing', 'No lost paper tickets'],
      ['Order Display', 'Preparing → Ready board', 'Less crowding at the counter'],
      ['Promo display', 'Promo playlists on in-venue screens', 'Idle screens become upsell screens'],
      ['Pickup queue', 'Ready-queue workflow for counters', 'Fast-food style flow'],
    ],
  },
  {
    title: 'Customer ordering channels',
    withWhy: true,
    rows: [
      ['QR dine-in ordering', 'Scan the table QR and order into the table session', 'Self-service, no app download'],
      ['Online storefront', 'Branded menu and ordering link per outlet', 'Direct orders the restaurant owns'],
      ['Digital ordering / kiosk', 'Self-serve kiosk mode', 'Shorter queues'],
      ['Guest checkout &amp; OTP login', 'Order with name + phone; optional phone-OTP login', 'No friction for first-timers'],
      ['Loyalty portal', 'Loyalty status on the storefront', 'Brings guests back'],
      ['Deep links', 'Links that open a specific outlet in the app or web', 'Perfect for bios, posts, and ads'],
    ],
  },
  {
    title: 'Cullinos Guest app (for diners)',
    rows: [
      ['Nearby marketplace', 'Discover restaurants near you'],
      ['Browse &amp; order', 'Menus, cart, dine-in / takeaway / delivery'],
      ['Easy login', 'Phone OTP, optional PIN'],
      ['Orders &amp; reorder', 'History and one-tap reorder'],
      ['Favourites, reviews, addresses', 'Save outlets, leave reviews, faster delivery checkout'],
      ['Loyalty wallets', 'Points and stamps in the app'],
      ['Push notifications', 'Order status plus offers and campaigns'],
      ['Coupons, Discover &amp; banners', 'Offer codes, curated home rows, outlet banners'],
    ],
  },
  {
    title: 'Back office',
    withWhy: true,
    rows: [
      ['Menu management', 'Categories, items, modifiers, pricing, availability', 'One menu, updated everywhere'],
      ['Happy hours', 'Time-based pricing', 'Price changes run automatically'],
      ['Inventory', 'Stock levels and adjustments per outlet', 'Know what is running low'],
      ['Recipes &amp; costing', 'Ingredients linked to dishes', 'True cost and margin per plate'],
      ['Purchasing, POs &amp; suppliers', 'Purchase orders, goods receipt, vendor list', 'Track ordered vs. received'],
      ['Wastage', 'Log waste against stock', 'See where money is lost'],
      ['Production &amp; central kitchen', 'Batches, plus outlet requests fulfilled by a central kitchen', 'Bakeries and hub-and-spoke kitchens'],
      ['Brands', 'Multiple brands from one kitchen', 'Built for cloud kitchens'],
      ['Staff &amp; roles', 'Owner, manager, cashier, waiter, kitchen, and more', 'Staff see only what they need'],
      ['Devices &amp; printing', 'Receipt and KOT print setup', 'Thermal printers, cash drawers'],
      ['Reports &amp; day-book export', 'Sales, top items, outlet performance, accounting export', 'Real numbers, easy accountant hand-off'],
    ],
  },
  {
    title: 'Orders &amp; payments',
    rows: [
      ['Unified orders', 'Every channel in one list: create, hold, resume, cancel'],
      ['Discounts &amp; split bills', 'Item or bill discounts; split between guests'],
      ['Payments', "Cash plus online payments via the restaurant's own Razorpay or Cashfree account"],
      ['Refunds', 'Cancelled paid orders refund through the gateway where possible; otherwise staff confirm on the gateway dashboard'],
      ['GST tax engine', 'Automatic CGST / SGST / IGST calculation'],
      ['Delivery &amp; aggregators', 'Track delivery; Swiggy and Zomato orders flow in with settlement tracking'],
      ['Feedback surveys', 'Post-order survey links'],
    ],
  },
  {
    title: 'CRM &amp; growth',
    withWhy: true,
    rows: [
      ['Customer CRM', 'Profiles, history, tiers', 'Know your regulars'],
      ['Loyalty', 'Stamps, points, rewards', 'Turn first-timers into regulars'],
      ['Coupons', 'Discount codes across channels', 'Run offers anywhere'],
      ['SMS campaigns', 'MSG91 marketing SMS from a prepaid wallet', 'Reach customers directly'],
      ['WhatsApp e-bills', 'Bills on WhatsApp, pay-per-message', 'Paperless receipts, direct touchpoint'],
      ['Events &amp; pop-ups', 'Pre-orders for events', 'Pop-ups, catering, festivals'],
      ['Privacy &amp; consent', 'Consent, data export and erase', "Built with India's DPDP law in mind"],
    ],
  },
  {
    title: 'Enterprise &amp; hospitality',
    rows: [
      ['Multi-outlet console', 'Network KPIs and outlet comparison'],
      ['Stock transfer', 'Move inventory between outlets'],
      ['Franchise &amp; multi-brand', 'Franchisee visibility; multiple brands from shared kitchens'],
      ['Advanced analytics &amp; API', 'Network dashboards, exports, and integrations'],
      ['Room service &amp; room posting', "In-room dining charged to the guest's room bill"],
      ['Banquets', 'Menus, packages, and billing for large events'],
    ],
  },
];

const AGENCY_VERTICALS = [
  ['Restaurants', 'Tables, waiter app, QR dine-in, kitchen display, full back office'],
  ['Cafes &amp; QSR', 'Lightning-fast counter billing, Ready board, loyalty, kiosk'],
  ['Food trucks &amp; pop-ups', 'POS on a tablet, events and pre-orders, quick service'],
  ['Bakeries', 'Production batches, recipes, pre-orders'],
  ['Cloud kitchens', 'Multiple brands, delivery, Swiggy / Zomato on one kitchen screen'],
  ['Catering', 'Events, pre-orders, production planning'],
  ['Bars &amp; pubs', 'Happy hours, bar station, pour-size stock, liquor register'],
  ['Hotels &amp; resorts', 'Room service, charge-to-room, banquets'],
];

const AGENCY_PERSONAS = [
  ['Owner (single outlet)', 'Cash leakage, wrong orders, too many apps', 'One dashboard, shift cash control, kitchen screen, GST bills'],
  ['Manager', 'Rush hours, staff mistakes, stock-outs', 'Waiter app, KDS, inventory, reports'],
  ['Chain / franchise operator', 'Consistency and visibility across outlets', 'Management console, comparison, stock transfer, central kitchen'],
  ['Hotel F&amp;B head', 'Room service and banquet billing mess', 'Room posting, banquets, one platform'],
  ['Diner', 'Waiting, waving for the waiter, repeat orders', 'QR ordering, Guest app, reorder, loyalty'],
];

const AGENCY_INTEGRATIONS = [
  ['<strong>Razorpay / Cashfree</strong>', "Online payments (UPI, cards, wallets) into the restaurant's own account"],
  ['<strong>MSG91</strong>', 'Phone OTP, marketing SMS, WhatsApp messages'],
  ['<strong>Firebase</strong>', 'Guest app login and push notifications'],
  ['<strong>Swiggy / Zomato</strong>', 'Incoming aggregator orders and settlements'],
  ['<strong>Printers &amp; hardware</strong>', 'Receipt and kitchen printers, cash drawers, scanners, display boards via the Local Gateway'],
  ['<strong>Accounting</strong>', 'Daily day-book export'],
];

const AGENCY_NAMES = [
  ['<strong>Cullinos</strong>', 'Culinos, CullinOS, "Cullinos POS" (it is more than a POS)'],
  ['<strong>Cullinos Guest app</strong> (or "the Cullinos app" for diners)', '"Customer app", "Cullinos delivery app"'],
  ['<strong>Cullinos Waiter app</strong>', '"Captain app"'],
  ['<strong>Rkyves</strong> (the company)', 'Rkyves POS, Rkives'],
  ['<strong>Kitchen Display</strong> (KDS)', '"Kitchen TV"'],
];

const AGENCY_HOOKS = [
  ['QR ordering + KDS', '"QR to kitchen in 10 seconds" — split screen: guest scans, kitchen screen lights up'],
  ['POS', '"Lunch rush, zero panic"'],
  ['Waiter app', '"Your waiter just stopped walking to the counter"'],
  ['Kitchen Display', '"RIP paper KOTs"'],
  ['Order Display', '"No more \'is my order ready?\'"'],
  ['Menu sync', '"Change the price once. Watch it update everywhere."'],
  ['Recipes &amp; costing', '"Do you actually know what your paneer tikka costs you?"'],
  ['Shifts &amp; cash', '"Who closed the drawer ₹500 short?"'],
  ['Loyalty', '"Turn first-timers into regulars"'],
  ['WhatsApp e-bills', '"Your bill, on WhatsApp, before you leave the table"'],
  ['Aggregators', '"Swiggy, Zomato, dine-in — one kitchen screen"'],
  ['Guest app', '"Found it, ordered it, picked it up"'],
  ['Multi-outlet', '"Three outlets. One screen. Morning chai."'],
  ['Bars', '"Happy hour starts itself"'],
  ['Hotels', '"Room 304 ordered biryani — and it\'s already on their bill"'],
];

const AGENCY_SCRIPT = [
  ['0–5s', 'Messy counter: paper KOTs, three delivery tablets, a calculator', '"Running a restaurant shouldn\'t need five apps."'],
  ['5–15s', 'Guest scans the table QR and orders', '"Your guests order straight from the table…"'],
  ['15–25s', 'Order pops up on the kitchen screen; chef taps Ready', '"…and the kitchen sees it instantly. No paper, no shouting."'],
  ['25–35s', 'Waiter adds dessert; cashier bills; GST receipt prints', '"Waiters, cashiers, and the kitchen all work from the same live order."'],
  ['35–45s', 'Owner on Admin: sales, stock, top dishes', '"You see sales, stock, and best sellers in one dashboard."'],
  ['45–55s', 'Cuts: Guest app, loyalty, WhatsApp bill, multi-outlet view', '"Loyalty, WhatsApp bills, your own ordering app, every outlet in one view."'],
  ['55–60s', 'Cullinos logo + cullinos.com', '"Cullinos. Your food business operating system."'],
];

const AGENCY_CAMPAIGNS = [
  ['Cafes &amp; QSR', '"Faster queues, happier regulars"'],
  ['Restaurants', '"Run the floor, not the paperwork"'],
  ['Cloud kitchens', '"Many brands, one kitchen screen"'],
  ['Bakeries', '"Bake to plan, not to guess"'],
  ['Bars &amp; pubs', '"Happy hours that run themselves"'],
  ['Hotels', '"Every outlet, every room, one system"'],
  ['Chains', '"Every outlet, one morning check"'],
];

const AGENCY_LINKS = [
  ['Website', 'https://cullinos.com'],
  ['Start a trial / contact', 'https://cullinos.com/contact?intent=trial'],
  ['Restaurant Admin', 'https://admin.cullinos.com'],
  ['Online ordering', 'https://guest.cullinos.com'],
  ['Waiter app landing', 'https://waiter.cullinos.com'],
  ['Multi-outlet console', 'https://manage.cullinos.com'],
  ['Contact', 'hello@rkyves.com'],
];

const AGENCY_DONTS = [
  ['"Sync your menu to Swiggy / Zomato automatically"', 'Outbound menu sync is not available', '"Swiggy and Zomato orders flow into the same kitchen screen"'],
  ['"Fully integrated with your hotel PMS"', 'Deeper PMS sync is on the roadmap', '"Charge F&amp;B to the guest\'s room bill"'],
  ['"AI-powered"', 'AI features are not live yet', 'Leave AI out'],
  ['"Available on iPhone"', 'Guest and Waiter apps are Android', '"Available on Android"'],
  ['"Full ERP / Tally integration"', 'Day-book export only, not a full ERP connector', '"Daily accounting export"'],
  ['"100% GST compliant" / "government approved"', 'Unverified compliance claims', '"GST-ready billing", "e-invoice readiness"'],
  ['"Zero commission forever" or savings figures', 'Not an approved claim', '"Take direct orders on your own storefront"'],
  ['"Free"', 'All plans are paid', '"Plans from ₹1,499 a month" (check current pricing)'],
  ['Negative competitor comparisons', 'Legal and brand risk', 'Focus on the problem Cullinos solves'],
  ['Fake reviews, invented customers or numbers', 'Misleading', 'Real testimonials with written permission only'],
];

const AGENCY_GLOSSARY = [
  ['POS', 'Point of Sale — the billing screen at the counter'],
  ['KOT', 'Kitchen Order Ticket — the order slip sent to the kitchen'],
  ['KDS', 'Kitchen Display System — a kitchen screen that replaces paper KOTs'],
  ['CDS', 'Customer / Order Display — the "Preparing / Ready" board'],
  ['QSR', 'Quick Service Restaurant — counter service, cafes, fast food'],
  ['Cloud kitchen', 'A delivery-only kitchen, often running several brands'],
  ['Central kitchen', 'One kitchen preparing food or stock for several outlets'],
  ['Aggregator', 'Third-party delivery apps like Swiggy and Zomato'],
  ['GST · CGST / SGST / IGST', "India's Goods and Services Tax and its central, state, and integrated parts"],
  ['GSTIN', "A business's GST registration number"],
  ['HSN / SAC', 'Tax classification codes printed on invoices'],
  ['Modifier', 'An add-on or change to an item ("extra cheese")'],
  ['Table session', 'An open table bill that waiter and guests can both add to'],
  ['Folio · Room posting', "A hotel guest's room bill · charging F&amp;B to it"],
  ['Banquet', 'A large event with set menus and billing'],
  ['Indent', 'A stock request from an outlet to a central kitchen'],
  ['PO / GRN', 'Purchase Order / Goods Receipt Note'],
  ['Shift', "A cashier's session, with cash counted at open and close"],
  ['Deep link', 'A link that opens a specific restaurant in the app or web'],
  ['OTP · UPI · DPDP', "One-time password · India's instant payment system · India's data protection law"],
];

function manualHtml() {
  const body = `
${cover({
  eyebrow: 'User manual',
  title: 'How to use Cullinos',
  subtitle: 'A practical guide for restaurant owners and staff — from first login to daily service, Guest app marketing, and supply chain.',
  meta: 'Owners · Managers · Cashiers · Waiters · Kitchen · 2026',
})}

<section class="page">
  <p class="eyebrow">Start here</p>
  <h2 style="border:none;margin-top:0">Your daily portals</h2>
  <table class="pretty">
    <thead><tr><th>Role</th><th>Open this URL</th><th>Login with</th></tr></thead>
    <tbody>
      <tr><td>Owner / manager</td><td>https://admin.cullinos.com</td><td>Owner email from onboarding</td></tr>
      <tr><td>Cashier</td><td>https://pos.cullinos.com<br/>or Admin → Portal POS</td><td>Cashier staff account</td></tr>
      <tr><td>Waiter</td><td>https://Cullinos Waiter (Android)</td><td>Waiter staff account</td></tr>
      <tr><td>Kitchen</td><td>https://kds.cullinos.com</td><td>Kitchen / staff login</td></tr>
      <tr><td>Guests (web)</td><td>https://order.cullinos.com/<em>org</em>/<em>outlet</em></td><td>No login required</td></tr>
      <tr><td>Guests (app)</td><td>Cullinos Guest (Android)</td><td>Phone OTP / PIN</td></tr>
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
  <div class="step"><div class="step-num">6</div><div><h3>Optional: reservations &amp; Guest app</h3><p>Enable <strong>Reservations</strong> for book-links. Under <strong>Cullinos App</strong>, set App listing, banners, and coupons if you use the marketplace.</p></div></div>

  <h2 class="section-break">2. Taking orders — Waiter (dine-in)</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Open Waiter</h3><p>Cullinos Waiter (Android) → log in → select outlet → see the table grid.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Open a table</h3><p>Tap a table → add menu items → confirm. Note the order number.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Optional: guest QR</h3><p>Use <strong>Show QR to customers</strong> so guests order on their phones into the same table ticket. End the session when the table clears.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Kitchen sees it</h3><p>KOTs appear on KDS (kds.cullinos.com) within seconds.</p></div></div>

  <h2>3. Taking orders — POS (counter / takeaway)</h2>
  <div class="step"><div class="step-num">1</div><div><h3>Open POS</h3><p>pos.cullinos.com as Cashier — or Admin → <strong>Portal POS</strong> (/pos) if you have POS access.</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h3>Build the cart</h3><p>Tap items, set order type (e.g. takeaway), check subtotal.</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h3>Hold if needed</h3><p>Hold an order to free the screen; resume later from the held panel.</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h3>Checkout</h3><p>Confirm the quick order. It shows in Admin → Orders and on KDS. Open/close shifts when your plan supports cash-drawer accountability.</p></div></div>

  <h2>4. Online, QR &amp; Guest app ordering</h2>
  <ol>
    <li>Share <code>https://order.cullinos.com/your-org/your-outlet</code>, the waiter QR link, or a Guest app deep link.</li>
    <li>Guest browses menu → cart → checkout with name &amp; phone (web) or OTP/PIN (Guest app).</li>
    <li>Prefer <strong>Pay later</strong> unless Razorpay is configured for Pay now.</li>
    <li>Apply coupons where enabled; verify the order in Admin → <strong>Orders</strong>.</li>
  </ol>
  <p class="small muted">Customer login is optional on the web storefront — guests can always checkout without an account.</p>

  <h2>5. Kitchen, Order Display &amp; Promo display</h2>
  <div class="grid-2">
    <div class="card"><h3>Kitchen Display</h3><p>Open kds.cullinos.com (or Admin → Kitchen Display launcher). Tickets update live as orders arrive. Mark items as you cook.</p></div>
    <div class="card"><h3>Order Display</h3><p>Admin → <strong>Order Display</strong> (/cds). Copy the public board URL to a tablet/TV so guests see Preparing → Ready.</p></div>
    <div class="card"><h3>Promo display</h3><p>Admin → <strong>Promo display</strong>: build playlists for in-venue screens.</p></div>
    <div class="card"><h3>Reservations</h3><p>Admin → <strong>Reservations</strong>: manage bookings; share the public book-link when enabled.</p></div>
  </div>

  <h2 class="section-break">6. Back office essentials</h2>
  <table class="pretty">
    <thead><tr><th>Need to…</th><th>Go to</th></tr></thead>
    <tbody>
      <tr><td>Change prices / 86 an item</td><td>Admin → Menu</td></tr>
      <tr><td>See today’s orders</td><td>Admin → Orders</td></tr>
      <tr><td>Check stock</td><td>Admin → Inventory</td></tr>
      <tr><td>Add a recipe</td><td>Admin → Recipes</td></tr>
      <tr><td>Create a purchase order</td><td>Admin → Purchasing / Suppliers</td></tr>
      <tr><td>Central kitchen indents</td><td>Admin → Central kitchen</td></tr>
      <tr><td>Schedule production</td><td>Admin → Production</td></tr>
      <tr><td>Loyalty / CRM</td><td>Admin → Loyalty / Customers</td></tr>
      <tr><td>Send a promo email</td><td>Admin → Promo Email</td></tr>
      <tr><td>Send SMS campaign</td><td>Admin → SMS campaigns</td></tr>
      <tr><td>Guest banners / push</td><td>Admin → Cullinos App</td></tr>
      <tr><td>Aggregator orders</td><td>Admin → Aggregators</td></tr>
      <tr><td>Delivery list</td><td>Admin → Delivery</td></tr>
      <tr><td>Sales reports</td><td>Admin → Reports</td></tr>
      <tr><td>Subscription / invoices</td><td>Admin → Billing</td></tr>
      <tr><td>Kiosk / storefront link</td><td>Admin → Digital Ordering</td></tr>
    </tbody>
  </table>
  <p class="small muted">Some pages (Banquets, Brands, Guests, Rooms, Central kitchen) appear only for matching business types / plans.</p>

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
    <li>Review Guest app listing and banners before a marketing push.</li>
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
  { id: 'plans', dest: 'Cullinos_Plans_Brochure.pdf', html: 'Cullinos_Plans_Brochure.html', build: plansBrochureHtml },
  { id: 'agency', dest: 'Cullinos_Agency_Brief.pdf', html: 'Cullinos_Agency_Brief.html', build: agencyBriefHtml },
  ...PLANS.map((plan) => ({
    id: `plan-${plan.slug}`,
    dest: join('plans', `Cullinos_Plan_${planFileName(plan)}.pdf`),
    html: join('plans', `Cullinos_Plan_${planFileName(plan)}.html`),
    build: () => planSheetHtml(plan),
  })),
];

async function main() {
  mkdirSync(join(OUT_PDF, 'plans'), { recursive: true });
  mkdirSync(join(OUT_HTML, 'plans'), { recursive: true });

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
