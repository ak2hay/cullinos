/**
 * Generates stylish client-facing Cullinos PDFs:
 * Brochure, Product Overview, User Manual, Plans Brochure, per-plan sheets.
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
