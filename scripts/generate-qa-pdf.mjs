/**
 * Generates QA PDF documents from markdown sources.
 * Converts markdown → HTML → PDF via system Chrome/Edge headless print.
 * Falls back to HTML if no browser is available.
 * Run: node scripts/generate-qa-pdf.mjs
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QA_DIR = join(ROOT, 'docs', 'qa');
const OUT_DIR = join(QA_DIR, 'export', 'pdf');
const HTML_DIR = join(QA_DIR, 'export', 'html');

/** Sources are relative to docs/qa/ */
const PDF_SOURCES = [
  { src: 'guides/WHATS_NEW.md', dest: 'Whats_New.pdf', html: 'Whats_New.html', title: 'Cullinos QA — What\'s New' },
  { src: 'guides/COMPLETE_FEATURE_TEST_GUIDE.md', dest: 'Complete_Feature_Test_Guide.pdf', html: 'Complete_Feature_Test_Guide.html', title: 'Cullinos — Complete Feature Testing Guide' },
  { src: 'guides/TESTER_HANDBOOK.md', dest: 'QA_Tester_Handbook.pdf', html: 'QA_Tester_Handbook.html', title: 'Cullinos QA Tester Handbook' },
  { src: 'guides/MANUAL_TEST_PLAN.md', dest: 'Manual_Test_Plan.pdf', html: 'Manual_Test_Plan.html', title: 'Cullinos Manual Test Plan' },
  { src: 'guides/QA_QUICK_START.md', dest: 'QA_Quick_Start.pdf', html: 'QA_Quick_Start.html', title: 'Cullinos QA Quick Start' },
  { src: 'guides/QUICK_REFERENCE_CARD.md', dest: 'Quick_Reference_Card.pdf', html: 'Quick_Reference_Card.html', title: 'Cullinos QA Quick Reference' },
  { src: 'guides/EMPLOYEE_BRIEF.md', dest: 'Employee_Brief.pdf', html: 'Employee_Brief.html', title: 'Cullinos QA Employee Brief' },
];

const PDF_CSS = `
  body { font-family: Segoe UI, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; max-width: 920px; margin: 0 auto; padding: 20px 28px; }
  h1 { color: #0F0F1A; border-bottom: 3px solid #D4A017; padding-bottom: 8px; font-size: 20pt; page-break-after: avoid; }
  h2 { color: #0F0F1A; margin-top: 1.35em; font-size: 13.5pt; border-left: 4px solid #D4A017; padding-left: 10px; page-break-after: avoid; }
  h3 { color: #222; font-size: 11.5pt; margin-top: 1.1em; page-break-after: avoid; }
  h4 { color: #333; font-size: 10.5pt; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 9pt; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #D4A017; color: #0F0F1A; font-weight: 600; }
  tr:nth-child(even) { background: #faf8f2; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 8.5pt; font-family: Consolas, monospace; }
  pre { background: #1a1a1a; color: #f5f5f5; padding: 12px 14px; border-radius: 6px; overflow-x: auto; font-size: 8.5pt; white-space: pre-wrap; border-left: 4px solid #D4A017; }
  pre code { background: transparent; color: inherit; padding: 0; }
  blockquote { border-left: 3px solid #D4A017; margin: 0 0 12px; padding: 6px 12px; color: #444; background: #faf8f2; }
  hr { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
  a { color: #0a5a8a; text-decoration: none; }
  ul, ol { margin: 6px 0 12px; padding-left: 1.4em; }
  li { margin: 3px 0; }
  input[type="checkbox"] { margin-right: 6px; }
  @media print {
    body { padding: 0; }
    h2, h3 { page-break-after: avoid; }
    pre, table { page-break-inside: avoid; }
  }
`;

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

function markdownToHtml(src, title) {
  const inputPath = join(QA_DIR, src);
  const markdown = readFileSync(inputPath, 'utf8');
  const body = marked.parse(markdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${PDF_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

function printHtmlToPdf(browserPath, htmlPath, pdfPath) {
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const result = spawnSync(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--print-to-pdf-no-header',
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(HTML_DIR, { recursive: true });

  const browserPath = findBrowserExecutable();
  if (browserPath) {
    console.log(`Using browser: ${browserPath}`);
  } else {
    console.warn('No Chrome/Edge found — generating HTML only.');
    console.warn('Open HTML in browser → Print → Save as PDF.');
  }

  let pdfCount = 0;

  for (const { src, dest, html, title } of PDF_SOURCES) {
    const htmlPath = join(HTML_DIR, html);
    const pdfPath = join(OUT_DIR, dest);

    console.log(`Processing ${src}...`);
    if (!existsSync(join(QA_DIR, src))) {
      console.warn(`  Skip — missing ${src}`);
      continue;
    }
    writeFileSync(htmlPath, markdownToHtml(src, title || src), 'utf8');
    console.log(`  Wrote ${htmlPath}`);

    if (browserPath) {
      try {
        printHtmlToPdf(browserPath, htmlPath, pdfPath);
        console.log(`  Wrote ${pdfPath}`);
        pdfCount++;
      } catch (err) {
        console.warn(`  PDF failed for ${src}: ${err.message}`);
      }
    }
  }

  if (pdfCount === PDF_SOURCES.length) {
    console.log(`Done — ${pdfCount} PDFs exported to ${OUT_DIR}`);
  } else {
    console.log(`Done — ${pdfCount} PDFs, HTML fallbacks in ${HTML_DIR}`);
    if (pdfCount < PDF_SOURCES.length) {
      console.log('To get PDFs manually: open HTML files in Chrome → Ctrl+P → Save as PDF');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
