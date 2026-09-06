/**
 * Generates QA Excel templates: TEST_RUN_SHEET, BUG_LOG, CREDENTIALS_LOG
 * Run: node scripts/generate-qa-excel.mjs
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs', 'qa', 'export', 'excel');

const RESULT_OPTIONS = ['Pass', 'Fail', 'Blocked', 'N/A'];
const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low', 'Known limitation'];
const STATUS_OPTIONS = ['Open', 'Retest', 'Closed', "Won't fix"];
const TYPE_OPTIONS = ['Bug', 'UX', 'Missing feature', 'Known limitation', 'Environment'];

/** @type {{ id: string; phase: string; case: string; expected: string }[]} */
const TEST_CASES = [
  // Phase 0
  { id: 'TC-0-01', phase: '0 Preflight', case: 'API health endpoint returns OK', expected: 'JSON healthy status' },
  { id: 'TC-0-02', phase: '0 Preflight', case: 'API DB health endpoint returns OK', expected: 'Database OK' },
  { id: 'TC-0-03', phase: '0 Preflight', case: 'Swagger docs page loads', expected: 'Swagger UI loads' },
  { id: 'TC-0-04', phase: '0 Preflight', case: 'Super Admin login succeeds', expected: 'Dashboard loads' },
  { id: 'TC-0-05', phase: '0 Preflight', case: 'Run folder and templates copied', expected: 'Run folder ready' },
  { id: 'TC-0-06', phase: '0 Preflight', case: 'Two browsers ready (main + incognito)', expected: 'Both browsers ready' },
  // Phase 1.1
  { id: 'TC-1.1-01', phase: '1.1 Onboarding', case: 'Onboard restaurant form opens', expected: 'Form visible' },
  { id: 'TC-1.1-02', phase: '1.1 Onboarding', case: 'Submit with enterprise plan succeeds', expected: 'Tenant created' },
  { id: 'TC-1.1-03', phase: '1.1 Onboarding', case: 'Success message shows owner email and Admin URL', expected: 'Success details shown' },
  { id: 'TC-1.1-04', phase: '1.1 Onboarding', case: 'New tenant appears in tenant list as active', expected: 'Status active' },
  { id: 'TC-1.1-05', phase: '1.1 Onboarding', case: 'Org slug recorded in Credentials Log', expected: 'Slug saved in Excel' },
  // Phase 1.2
  { id: 'TC-1.2-01', phase: '1.2 Owner wizard', case: 'Owner login at admin.cullinos.com succeeds', expected: 'Admin dashboard loads' },
  { id: 'TC-1.2-02', phase: '1.2 Owner wizard', case: 'Onboarding wizard accessible at /onboarding', expected: 'Wizard opens' },
  { id: 'TC-1.2-03', phase: '1.2 Owner wizard', case: 'Business type restaurant selected and saved', expected: 'Restaurant type saved' },
  { id: 'TC-1.2-04', phase: '1.2 Owner wizard', case: 'Business info step (name, GSTIN) saves', expected: 'Info saved without error' },
  { id: 'TC-1.2-05', phase: '1.2 Owner wizard', case: 'Wizard reaches Done step without error', expected: 'Done step reached' },
  // Phase 1.3
  { id: 'TC-1.3-01', phase: '1.3 Test data', case: 'Create category 1 in Menu', expected: 'Category created' },
  { id: 'TC-1.3-02', phase: '1.3 Test data', case: 'Create category 2 in Menu', expected: 'Second category created' },
  { id: 'TC-1.3-03', phase: '1.3 Test data', case: 'Create 4+ menu items with varied prices', expected: '4+ items exist' },
  { id: 'TC-1.3-04', phase: '1.3 Test data', case: 'Create staff account — role Waiter', expected: 'Waiter account created' },
  { id: 'TC-1.3-05', phase: '1.3 Test data', case: 'Assign waiter to main outlet', expected: 'Outlet assigned' },
  { id: 'TC-1.3-06', phase: '1.3 Test data', case: 'Settings page shows correct businessType', expected: 'businessType correct' },
  { id: 'TC-1.3-07', phase: '1.3 Test data', case: 'Create 2+ tables via Admin → Tables', expected: 'Tables exist for Waiter' },
  { id: 'TC-1.3-08', phase: '1.3 Test data', case: 'Create staff account — role Cashier (for POS)', expected: 'Cashier account created' },
  // Phase 1.4
  { id: 'TC-1.4-01', phase: '1.4 Auth', case: 'Admin forgot-password page loads and accepts email', expected: 'Form accepts email' },
  { id: 'TC-1.4-02', phase: '1.4 Auth', case: 'Super Admin forgot-password page loads and accepts email', expected: 'Form accepts email' },
  { id: 'TC-1.4-03', phase: '1.4 Auth', case: 'Change-password page reachable after owner login', expected: 'Page loads' },
  // Phase 2.1
  { id: 'TC-2.1-01', phase: '2.1 Waiter', case: 'Employee login at waiter.cullinos.com', expected: 'Login succeeds' },
  { id: 'TC-2.1-02', phase: '2.1 Waiter', case: 'Main outlet selectable', expected: 'Outlet loads' },
  { id: 'TC-2.1-03', phase: '2.1 Waiter', case: 'Table grid displays tables', expected: 'Tables visible' },
  { id: 'TC-2.1-04', phase: '2.1 Waiter', case: 'Open table — menu loads', expected: 'Menu items load' },
  { id: 'TC-2.1-05', phase: '2.1 Waiter', case: 'Add 2+ items to order', expected: 'Items in cart' },
  { id: 'TC-2.1-06', phase: '2.1 Waiter', case: 'Confirm order — success with order number', expected: 'Order confirmed' },
  { id: 'TC-2.1-07', phase: '2.1 Waiter', case: 'KDS at kds.cullinos.com shows KOT within ~5s', expected: 'KOT on KDS' },
  { id: 'TC-2.1-08', phase: '2.1 Waiter', case: 'Admin Orders lists dine-in order', expected: 'Order in Admin list' },
  { id: 'TC-2.1-09', phase: '2.1 Waiter', case: 'Order total matches items ordered', expected: 'Total correct' },
  { id: 'TC-2.1-10', phase: '2.1 Waiter', case: 'Show QR to customers — session link works', expected: 'Guest session opens' },
  { id: 'TC-2.1-11', phase: '2.1 Waiter', case: 'End session — guest link expires on refresh', expected: 'Session expired' },
  // Phase 2.2
  { id: 'TC-2.2-01', phase: '2.2 POS', case: 'POS loads at pos.cullinos.com', expected: 'POS loads' },
  { id: 'TC-2.2-02', phase: '2.2 POS', case: 'Cashier login succeeds', expected: 'POS session active' },
  { id: 'TC-2.2-03', phase: '2.2 POS', case: 'Add items — cart subtotal correct', expected: 'Subtotal correct' },
  { id: 'TC-2.2-04', phase: '2.2 POS', case: 'Set order type takeaway', expected: 'Takeaway selected' },
  { id: 'TC-2.2-05', phase: '2.2 POS', case: 'Hold order — appears in held panel', expected: 'Order held' },
  { id: 'TC-2.2-06', phase: '2.2 POS', case: 'Resume held order', expected: 'Cart restored' },
  { id: 'TC-2.2-07', phase: '2.2 POS', case: 'Checkout quick order confirms', expected: 'Order confirmed' },
  // Phase 2.3
  { id: 'TC-2.3-01', phase: '2.3 Customer', case: 'Storefront loads in incognito', expected: 'Storefront loads' },
  { id: 'TC-2.3-02', phase: '2.3 Customer', case: 'Menu shows Phase 1 categories and items', expected: 'Menu data correct' },
  { id: 'TC-2.3-03', phase: '2.3 Customer', case: 'Add item to cart — badge updates', expected: 'Cart badge updates' },
  { id: 'TC-2.3-04', phase: '2.3 Customer', case: 'Cart page shows correct items/totals', expected: 'Cart totals correct' },
  { id: 'TC-2.3-05', phase: '2.3 Customer', case: 'Checkout form accepts name and phone', expected: 'Form validates' },
  { id: 'TC-2.3-06', phase: '2.3 Customer', case: 'Pay later places order successfully', expected: 'Order placed' },
  { id: 'TC-2.3-07', phase: '2.3 Customer', case: 'Order confirmation page displayed', expected: 'Confirmation shown' },
  { id: 'TC-2.3-08', phase: '2.3 Customer', case: 'Admin Orders shows online/QR source order', expected: 'Online order listed' },
  { id: 'TC-2.3-09', phase: '2.3 Customer', case: 'QR table param ?table=T1 binds table', expected: 'Table bound if exists' },
  { id: 'TC-2.3-10', phase: '2.3 Customer', case: 'Pay now Razorpay flow', expected: 'Payment completes or N/A' },
  { id: 'TC-2.3-11', phase: '2.3 Customer', case: 'Customer login modal opens without blocking guest checkout', expected: 'Modal OK; guest checkout works' },
  // Phase 2.4
  { id: 'TC-2.4-01', phase: '2.4 CDS', case: 'Admin Order Display (/cds) page loads', expected: 'Page loads' },
  { id: 'TC-2.4-02', phase: '2.4 CDS', case: 'CDS / KDS pickup URL copyable and opens', expected: 'Display loads' },
  { id: 'TC-2.4-03', phase: '2.4 CDS', case: 'Order appears in Preparing column', expected: 'Order in Preparing' },
  { id: 'TC-2.4-04', phase: '2.4 CDS', case: 'Order moves to Ready when marked', expected: 'Order in Ready' },
  // Phase 2.5
  { id: 'TC-2.5-01', phase: '2.5 Portal POS', case: 'Owner opens Admin /pos with POS permission', expected: 'Portal POS loads' },
  { id: 'TC-2.5-02', phase: '2.5 Portal POS', case: 'Add items — cart subtotal correct', expected: 'Subtotal correct' },
  { id: 'TC-2.5-03', phase: '2.5 Portal POS', case: 'Hold and resume order in Portal POS', expected: 'Cart restored' },
  { id: 'TC-2.5-04', phase: '2.5 Portal POS', case: 'Checkout confirms order from Portal POS', expected: 'Order confirmed' },
  // Phase 2.6
  { id: 'TC-2.6-01', phase: '2.6 Kiosk', case: 'Admin Digital Ordering (/kiosk) page loads', expected: 'Page loads' },
  { id: 'TC-2.6-02', phase: '2.6 Kiosk', case: 'Launcher shows usable storefront / kiosk URL', expected: 'URL usable' },
  // Phase 3
  { id: 'TC-3-01', phase: '3 Admin', case: 'Dashboard loads with KPI cards', expected: 'KPI cards visible' },
  { id: 'TC-3-02', phase: '3 Admin', case: 'Dashboard revenue reflects test orders', expected: 'Revenue non-zero' },
  { id: 'TC-3-03', phase: '3 Admin', case: 'Menu — edit existing item price', expected: 'Price updated' },
  { id: 'TC-3-04', phase: '3 Admin', case: 'Menu — create new item', expected: 'Item created' },
  { id: 'TC-3-05', phase: '3 Admin', case: 'Menu — toggle item availability', expected: 'Availability toggled' },
  { id: 'TC-3-06', phase: '3 Admin', case: 'Orders — all Phase 2 orders visible', expected: 'All orders listed' },
  { id: 'TC-3-07', phase: '3 Admin', case: 'Orders — status and source correct', expected: 'Status/source correct' },
  { id: 'TC-3-08', phase: '3 Admin', case: 'Tables — create table via Admin UI', expected: 'Table created' },
  { id: 'TC-3-09', phase: '3 Admin', case: 'Inventory — list/view stock items', expected: 'Stock list loads' },
  { id: 'TC-3-10', phase: '3 Admin', case: 'Customers — loyalty tiers list loads', expected: 'Tiers listed' },
  { id: 'TC-3-11', phase: '3 Admin', case: 'Customers — coupons list loads', expected: 'Coupons listed' },
  { id: 'TC-3-12', phase: '3 Admin', case: 'Events — create new event', expected: 'Event created' },
  { id: 'TC-3-13', phase: '3 Admin', case: 'Events — event appears in list', expected: 'Event in list' },
  { id: 'TC-3-14', phase: '3 Admin', case: 'Production — schedule batch (if applicable)', expected: 'Batch scheduled or N/A' },
  { id: 'TC-3-15', phase: '3 Admin', case: 'Production — complete batch (if applicable)', expected: 'Batch completed or N/A' },
  { id: 'TC-3-16', phase: '3 Admin', case: 'Order Display launcher — URL includes correct outletId', expected: 'outletId in URL' },
  { id: 'TC-3-17', phase: '3 Admin', case: 'Staff — employee listed', expected: 'Waiter visible' },
  { id: 'TC-3-18', phase: '3 Admin', case: 'Reports — revenue section loads', expected: 'Revenue section loads' },
  { id: 'TC-3-19', phase: '3 Admin', case: 'Reports — top items non-empty after orders', expected: 'Top items listed' },
  { id: 'TC-3-20', phase: '3 Admin', case: 'Settings — save valid JSON config', expected: 'Config saved' },
  { id: 'TC-3-21', phase: '3 Admin', case: 'Settings — invalid JSON shows error', expected: 'Error shown' },
  { id: 'TC-3-22', phase: '3 Admin', case: 'Logout and re-login persists session', expected: 'Re-login works' },
  { id: 'TC-3-23', phase: '3 Admin', case: 'Recipes — create recipe', expected: 'Recipe created' },
  { id: 'TC-3-24', phase: '3 Admin', case: 'Recipes — recipe appears in list', expected: 'Recipe listed' },
  { id: 'TC-3-25', phase: '3 Admin', case: 'Loyalty page loads', expected: 'Page loads' },
  { id: 'TC-3-26', phase: '3 Admin', case: 'Delivery page loads (list/status)', expected: 'Page loads' },
  { id: 'TC-3-27', phase: '3 Admin', case: 'Promo Email page loads', expected: 'Page loads' },
  { id: 'TC-3-28', phase: '3 Admin', case: 'Promo Email — compose draft or send without crash', expected: 'No crash' },
  { id: 'TC-3-29', phase: '3 Admin', case: 'Billing page loads', expected: 'Page loads' },
  { id: 'TC-3-30', phase: '3 Admin', case: 'Kitchen Display launcher opens usable KDS URL', expected: 'KDS URL usable' },
  { id: 'TC-3-31', phase: '3 Admin', case: 'Inventory — add or adjust stock item', expected: 'Stock updated' },
  { id: 'TC-3-32', phase: '3 Admin', case: 'Staff without POS_ACCESS denied or redirected from /pos', expected: 'Access denied/redirect' },
  { id: 'TC-3-33', phase: '3 Admin', case: 'Banquets page (N/A on restaurant tenant)', expected: 'N/A or page loads' },
  { id: 'TC-3-34', phase: '3 Admin', case: 'Brands page (N/A on restaurant tenant)', expected: 'N/A or page loads' },
  { id: 'TC-3-35', phase: '3 Admin', case: 'Guests page (N/A on restaurant tenant)', expected: 'N/A or page loads' },
  { id: 'TC-3-36', phase: '3 Admin', case: 'Rooms page (N/A on restaurant tenant)', expected: 'N/A or page loads' },
  // Phase 4
  { id: 'TC-4-01', phase: '4 Management', case: 'Owner login at manage.cullinos.com', expected: 'Management loads' },
  { id: 'TC-4-02', phase: '4 Management', case: 'Overview dashboard loads KPIs', expected: 'KPIs visible' },
  { id: 'TC-4-03', phase: '4 Management', case: 'Overview payment mix displays', expected: 'Payment mix shown' },
  { id: 'TC-4-04', phase: '4 Management', case: 'Reports page loads', expected: 'Reports load' },
  { id: 'TC-4-05', phase: '4 Management', case: 'Outlet comparison loads (2+ outlets)', expected: 'Comparison loads or N/A' },
  { id: 'TC-4-06', phase: '4 Management', case: 'Stock transfer create (2+ outlets)', expected: 'Transfer created or N/A' },
  { id: 'TC-4-07', phase: '4 Management', case: 'Franchise page loads', expected: 'Page loads' },
  { id: 'TC-4-08', phase: '4 Management', case: 'Second outlet added via API if needed', expected: 'Second outlet exists' },
  // Phase 5
  { id: 'TC-5-01', phase: '5 Super Admin', case: 'QA tenant findable in tenant list', expected: 'Tenant found' },
  { id: 'TC-5-02', phase: '5 Super Admin', case: 'Subscriptions — change plan for QA tenant', expected: 'Plan changed' },
  { id: 'TC-5-03', phase: '5 Super Admin', case: 'Subscriptions — entitlements update', expected: 'Entitlements updated' },
  { id: 'TC-5-04', phase: '5 Super Admin', case: 'System Health metrics load', expected: 'Metrics load' },
  { id: 'TC-5-05', phase: '5 Super Admin', case: 'Marketing dashboard loads', expected: 'Dashboard loads' },
  { id: 'TC-5-06', phase: '5 Super Admin', case: 'Marketing Hero editor saves draft', expected: 'Draft saved' },
  { id: 'TC-5-07', phase: '5 Super Admin', case: 'Marketing Pages editor loads', expected: 'Editor loads' },
  { id: 'TC-5-08', phase: '5 Super Admin', case: 'Marketing Theme editor loads', expected: 'Editor loads' },
  { id: 'TC-5-09', phase: '5 Super Admin', case: 'Marketing Pricing editor loads', expected: 'Editor loads' },
  { id: 'TC-5-10', phase: '5 Super Admin', case: 'Marketing Navigation editor loads', expected: 'Editor loads' },
  { id: 'TC-5-11', phase: '5 Super Admin', case: 'Marketing Blog editor — create draft', expected: 'Draft created' },
  { id: 'TC-5-12', phase: '5 Super Admin', case: 'Marketing Media library loads', expected: 'Library loads' },
  { id: 'TC-5-13', phase: '5 Super Admin', case: 'Suspend QA tenant — owner login blocked', expected: 'Owner blocked' },
  { id: 'TC-5-14', phase: '5 Super Admin', case: 'Reactivate QA tenant — owner login works', expected: 'Owner can login' },
  { id: 'TC-5-15', phase: '5 Super Admin', case: 'Plans page loads', expected: 'Page loads' },
  { id: 'TC-5-16', phase: '5 Super Admin', case: 'Promo Email page loads', expected: 'Page loads' },
  { id: 'TC-5-17', phase: '5 Super Admin', case: 'Marketing Testimonials editor loads', expected: 'Editor loads' },
  { id: 'TC-5-18', phase: '5 Super Admin', case: 'Marketing Design Lab loads', expected: 'Page loads' },
  { id: 'TC-5-19', phase: '5 Super Admin', case: 'Platform Settings page loads', expected: 'Page loads' },
  { id: 'TC-5-20', phase: '5 Super Admin', case: 'Super Admin forgot-password page loads', expected: 'Page loads' },
  // Phase 6
  { id: 'TC-6-01', phase: '6 Marketing', case: 'Home page loads with hero and nav', expected: 'Home loads' },
  { id: 'TC-6-02', phase: '6 Marketing', case: 'Features page loads', expected: 'Features loads' },
  { id: 'TC-6-03', phase: '6 Marketing', case: 'Pricing page loads', expected: 'Pricing loads' },
  { id: 'TC-6-04', phase: '6 Marketing', case: 'Integrations page loads', expected: 'Integrations loads' },
  { id: 'TC-6-05', phase: '6 Marketing', case: 'About page loads', expected: 'About loads' },
  { id: 'TC-6-06', phase: '6 Marketing', case: 'Blog index loads', expected: 'Blog index loads' },
  { id: 'TC-6-07', phase: '6 Marketing', case: 'Blog article page readable', expected: 'Article readable' },
  { id: 'TC-6-08', phase: '6 Marketing', case: 'Contact form submits or graceful error', expected: 'Form OK or graceful error' },
  { id: 'TC-6-09', phase: '6 Marketing', case: 'Privacy page loads', expected: 'Privacy loads' },
  { id: 'TC-6-10', phase: '6 Marketing', case: 'Terms page loads', expected: 'Terms loads' },
  { id: 'TC-6-11', phase: '6 Marketing', case: 'Solutions — restaurants', expected: 'Page loads' },
  { id: 'TC-6-12', phase: '6 Marketing', case: 'Solutions — cafes', expected: 'Page loads' },
  { id: 'TC-6-13', phase: '6 Marketing', case: 'Solutions — food-trucks', expected: 'Page loads' },
  { id: 'TC-6-14', phase: '6 Marketing', case: 'Solutions — bakeries', expected: 'Page loads' },
  { id: 'TC-6-15', phase: '6 Marketing', case: 'Solutions — chains', expected: 'Page loads' },
  { id: 'TC-6-16', phase: '6 Marketing', case: 'Solutions — hospitality', expected: 'Page loads' },
  // Phase 7
  { id: 'TC-7-01', phase: '7 Swagger', case: 'Auth — obtain owner JWT', expected: 'JWT copied from DevTools' },
  { id: 'TC-7-02', phase: '7 Swagger', case: 'Billing — list invoices', expected: 'HTTP 200' },
  { id: 'TC-7-03', phase: '7 Swagger', case: 'KOT — list tickets for outlet', expected: 'HTTP 200' },
  { id: 'TC-7-04', phase: '7 Swagger', case: 'Tax — get config', expected: 'HTTP 200' },
  { id: 'TC-7-05', phase: '7 Swagger', case: 'Recipes — create and list', expected: 'HTTP 200/201' },
  { id: 'TC-7-06', phase: '7 Swagger', case: 'Purchasing — create PO draft', expected: 'HTTP 200/201' },
  { id: 'TC-7-07', phase: '7 Swagger', case: 'Wastage — log entry', expected: 'HTTP 200/201' },
  { id: 'TC-7-08', phase: '7 Swagger', case: 'Delivery — list orders', expected: 'HTTP 200' },
  { id: 'TC-7-09', phase: '7 Swagger', case: 'Hospitality — create guest', expected: 'HTTP 200/201' },
  { id: 'TC-7-10', phase: '7 Swagger', case: 'Hospitality — create room', expected: 'HTTP 200/201' },
  { id: 'TC-7-11', phase: '7 Swagger', case: 'Audit — recent entries', expected: 'HTTP 200' },
  { id: 'TC-7-12', phase: '7 Swagger', case: 'Notifications — list', expected: 'HTTP 200' },
  { id: 'TC-7-13', phase: '7 Swagger', case: 'Devices — list', expected: 'HTTP 200' },
  { id: 'TC-7-14', phase: '7 Swagger', case: 'Integrations — list', expected: 'HTTP 200' },
];

function styleHeader(row) {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4A017' } };
}

function addListValidation(sheet, col, fromRow, toRow, options) {
  for (let r = fromRow; r <= toRow; r++) {
    sheet.getCell(`${col}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: `Choose one of: ${options.join(', ')}`,
    };
  }
}

async function buildTestRunSheet() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cullinos QA Export';
  wb.created = new Date();

  // Run Info
  const runInfo = wb.addWorksheet('Run Info');
  runInfo.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  styleHeader(runInfo.getRow(1));
  [
    ['Run ID', 'RUN-YYYYMMDD'],
    ['Tester', ''],
    ['Employee (Waiter)', ''],
    ['Tenant slug', ''],
    ['Outlet slug', ''],
    ['Outlet ID', ''],
    ['Date started', ''],
    ['Date completed', ''],
    ['Environment', 'Production'],
  ].forEach(([field, value]) => runInfo.addRow({ field, value }));

  // Test Cases
  const tests = wb.addWorksheet('Test Cases');
  tests.columns = [
    { header: 'Test ID', key: 'id', width: 14 },
    { header: 'Phase', key: 'phase', width: 18 },
    { header: 'Test case', key: 'case', width: 48 },
    { header: 'Expected', key: 'expected', width: 28 },
    { header: 'Result', key: 'result', width: 12 },
    { header: 'Notes', key: 'notes', width: 32 },
    { header: 'Bug ID', key: 'bugId', width: 12 },
  ];
  styleHeader(tests.getRow(1));
  TEST_CASES.forEach((tc) => tests.addRow(tc));

  const lastRow = TEST_CASES.length + 1;
  addListValidation(tests, 'E', 2, lastRow, RESULT_OPTIONS);
  tests.views = [{ state: 'frozen', ySplit: 1 }];

  // Summary
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Result', key: 'result', width: 16 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  styleHeader(summary.getRow(1));
  summary.addRow({ result: 'Pass', count: { formula: `COUNTIF('Test Cases'!E2:E${lastRow},"Pass")` } });
  summary.addRow({ result: 'Fail', count: { formula: `COUNTIF('Test Cases'!E2:E${lastRow},"Fail")` } });
  summary.addRow({ result: 'Blocked', count: { formula: `COUNTIF('Test Cases'!E2:E${lastRow},"Blocked")` } });
  summary.addRow({ result: 'N/A', count: { formula: `COUNTIF('Test Cases'!E2:E${lastRow},"N/A")` } });
  summary.addRow({ result: 'Total test cases', count: TEST_CASES.length });
  summary.addRow({ result: 'Marked (any result)', count: { formula: `COUNTA('Test Cases'!E2:E${lastRow})` } });

  // Sign-off
  const signOff = wb.addWorksheet('Sign-off');
  signOff.columns = [
    { header: 'Checklist item', key: 'item', width: 50 },
    { header: 'Y / N', key: 'yn', width: 10 },
  ];
  styleHeader(signOff.getRow(1));
  [
    'All Critical/High failures logged in BUG_LOG',
    'Credentials Log completed (no passwords in files)',
    'Known limitations separated from open bugs',
    `All ${TEST_CASES.length} test cases marked Pass/Fail/Blocked/N/A`,
  ].forEach((item) => signOff.addRow({ item, yn: '' }));
  signOff.addRow({});
  signOff.addRow({ item: 'Tester signature', yn: '' });
  signOff.addRow({ item: 'Reviewer signature', yn: '' });
  signOff.addRow({ item: 'Sign-off date', yn: '' });
  signOff.addRow({});
  signOff.addRow({ item: 'Comments', yn: '' });

  // Instructions
  const instructions = wb.addWorksheet('Instructions');
  instructions.getColumn(1).width = 80;
  [
    'Cullinos QA Test Run Sheet',
    '',
    '1. Fill Run Info sheet first.',
    '2. For each test in Test Cases sheet, choose Result: Pass, Fail, Blocked, or N/A.',
    '3. If Fail, add a row in BUG_LOG.xlsx and put Bug ID here.',
    '4. Summary sheet auto-counts results.',
    '5. Complete Sign-off sheet on last day.',
    '',
    `Total test cases: ${TEST_CASES.length}`,
  ].forEach((line, i) => {
    const row = instructions.getRow(i + 1);
    row.getCell(1).value = line;
    if (i === 0) row.font = { bold: true, size: 14 };
  });

  return wb;
}

async function buildBugLog() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cullinos QA Export';

  const bugs = wb.addWorksheet('Bug Log');
  bugs.columns = [
    { header: 'Bug ID', key: 'id', width: 10 },
    { header: 'Date found', key: 'date', width: 14 },
    { header: 'Reporter', key: 'reporter', width: 16 },
    { header: 'Test ID', key: 'testId', width: 14 },
    { header: 'Phase / Module', key: 'module', width: 20 },
    { header: 'App / URL', key: 'url', width: 28 },
    { header: 'Title', key: 'title', width: 36 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Steps to reproduce', key: 'steps', width: 40 },
    { header: 'Expected', key: 'expected', width: 28 },
    { header: 'Actual', key: 'actual', width: 28 },
    { header: 'Screenshot path', key: 'screenshot', width: 28 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Retest date', key: 'retestDate', width: 14 },
    { header: 'Retest result', key: 'retestResult', width: 14 },
  ];
  styleHeader(bugs.getRow(1));

  // Example empty rows
  for (let i = 1; i <= 20; i++) {
    bugs.addRow({ id: `BUG-${String(i).padStart(3, '0')}` });
  }

  addListValidation(bugs, 'H', 2, 21, SEVERITY_OPTIONS);
  addListValidation(bugs, 'I', 2, 21, TYPE_OPTIONS);
  addListValidation(bugs, 'N', 2, 21, STATUS_OPTIONS);
  bugs.views = [{ state: 'frozen', ySplit: 1 }];

  const defs = wb.addWorksheet('Severity guide');
  defs.columns = [
    { header: 'Severity', key: 'severity', width: 18 },
    { header: 'Definition', key: 'definition', width: 50 },
    { header: 'Example', key: 'example', width: 40 },
  ];
  styleHeader(defs.getRow(1));
  [
    ['Critical', 'Blocks core flow; no workaround', 'Cannot login, orders fail to create'],
    ['High', 'Major feature broken; workaround difficult', 'KOT never appears; checkout fails'],
    ['Medium', 'Feature partially broken', 'Wrong totals, UI glitch with workaround'],
    ['Low', 'Cosmetic or minor inconvenience', 'Typo, alignment issue'],
    ['Known limitation', 'Documented gap, not a defect', 'Razorpay pay-now without keys'],
  ].forEach((row) => defs.addRow({ severity: row[0], definition: row[1], example: row[2] }));

  const known = wb.addWorksheet('Known limitations');
  known.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Module', key: 'module', width: 20 },
    { header: 'Description', key: 'desc', width: 50 },
  ];
  styleHeader(known.getRow(1));
  [
    ['KL-003', 'POS/KDS DNS', 'If pos/kds URLs down, use local fallback or Blocked'],
    ['KL-004', 'Razorpay', 'Pay-now requires keys — use Pay later'],
    ['KL-005', 'Order Display', 'Prefer Admin /cds launcher'],
    ['KL-006', 'Production stock', 'Stock deducts only with recipe-linked batches'],
    ['KL-007', 'Business-type nav', 'Banquets/Brands/Guests/Rooms N/A on restaurant'],
  ].forEach(([id, module, desc]) => known.addRow({ id, module, desc }));

  return wb;
}

async function buildCredentialsLog() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cullinos QA Export';

  const sheet = wb.addWorksheet('Credentials');
  sheet.columns = [
    { header: 'Section', key: 'section', width: 22 },
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 44 },
  ];
  styleHeader(sheet.getRow(1));

  const rows = [
    ['Run metadata', 'Run ID', 'RUN-YYYYMMDD'],
    ['Run metadata', 'Tester name', ''],
    ['Run metadata', 'Date started', ''],
    ['Run metadata', 'Date ended', ''],
    ['Run metadata', 'Environment', 'Production'],
    ['Run metadata', 'Plan', 'enterprise'],
    ['', '', ''],
    ['Super Admin', 'Email', ''],
    ['Super Admin', 'Password ref (PM #)', ''],
    ['Super Admin', 'Login URL', 'https://platform.cullinos.com/login'],
    ['Super Admin', 'Login verified', 'Y / N'],
    ['', '', ''],
    ['QA Tenant', 'Org name', ''],
    ['QA Tenant', 'Org slug', ''],
    ['QA Tenant', 'Org ID', ''],
    ['QA Tenant', 'Outlet name', ''],
    ['QA Tenant', 'Outlet slug', ''],
    ['QA Tenant', 'Outlet ID', ''],
    ['QA Tenant', 'Owner name', ''],
    ['QA Tenant', 'Owner email', ''],
    ['QA Tenant', 'Owner password ref (PM #)', ''],
    ['QA Tenant', 'Admin URL', 'https://admin.cullinos.com'],
    ['QA Tenant', 'Storefront URL', 'https://order.cullinos.com/{orgSlug}/{outletSlug}'],
    ['', '', ''],
    ['Waiter staff', 'Name', ''],
    ['Waiter staff', 'Email', ''],
    ['Waiter staff', 'Password ref (PM #)', ''],
    ['Waiter staff', 'Waiter URL', 'https://waiter.cullinos.com'],
    ['Waiter staff', 'Login verified', 'Y / N'],
    ['', '', ''],
    ['Optional Cashier', 'Email', ''],
    ['Optional Cashier', 'Password ref (PM #)', ''],
    ['', '', ''],
    ['Second outlet', 'Outlet name', ''],
    ['Second outlet', 'Outlet slug', ''],
    ['Second outlet', 'Outlet ID', ''],
    ['', '', ''],
    ['Menu data', 'Category 1', ''],
    ['Menu data', 'Category 2', ''],
    ['Menu data', 'Item 1', ''],
    ['Menu data', 'Item 2', ''],
    ['Menu data', 'Item 3', ''],
    ['Menu data', 'Item 4', ''],
    ['', '', ''],
    ['Tables (Admin)', 'Table T1 ID', ''],
    ['Tables (Admin)', 'Table T2 ID', ''],
    ['', '', ''],
    ['Orders placed', 'Dine-in order ID', ''],
    ['Orders placed', 'Online order ID', ''],
    ['Orders placed', 'POS order ID', ''],
  ];

  rows.forEach(([section, field, value]) => sheet.addRow({ section, field, value }));

  const note = wb.addWorksheet('Security note');
  note.getColumn(1).width = 80;
  [
    'SECURITY: Do NOT enter real passwords in this file.',
    'Use "Password ref (PM #)" to reference your password manager entry number only.',
    'Share filled file with team lead via secure channel.',
  ].forEach((line, i) => note.getRow(i + 1).getCell(1).value = line);

  return wb;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  if (TEST_CASES.length !== 160) {
    console.warn(`Warning: expected 160 test cases, found ${TEST_CASES.length}`);
  }

  const testWb = await buildTestRunSheet();
  await testWb.xlsx.writeFile(join(OUT_DIR, 'TEST_RUN_SHEET.xlsx'));
  console.log('Wrote TEST_RUN_SHEET.xlsx');

  const bugWb = await buildBugLog();
  await bugWb.xlsx.writeFile(join(OUT_DIR, 'BUG_LOG.xlsx'));
  console.log('Wrote BUG_LOG.xlsx');

  const credWb = await buildCredentialsLog();
  await credWb.xlsx.writeFile(join(OUT_DIR, 'CREDENTIALS_LOG.xlsx'));
  console.log('Wrote CREDENTIALS_LOG.xlsx');

  console.log(`Done — ${TEST_CASES.length} test cases exported to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
