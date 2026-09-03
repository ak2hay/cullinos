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

const PDF_SOURCES = [
  { src: 'TESTER_HANDBOOK.md', dest: 'QA_Tester_Handbook.pdf', html: 'QA_Tester_Handbook.html' },
  { src: 'QUICK_REFERENCE_CARD.md', dest: 'Quick_Reference_Card.pdf', html: 'Quick_Reference_Card.html' },
  { src: 'EMPLOYEE_BRIEF.md', dest: 'Employee_Brief.pdf', html: 'Employee_Brief.html' },
];

const PDF_CSS = `
  body { font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 24px; }
  h1 { color: #0F0F1A; border-bottom: 2px solid #D4A017; padding-bottom: 6px; font-size: 20pt; page-break-after: avoid; }
  h2 { color: #0F0F1A; margin-top: 1.2em; font-size: 14pt; page-break-after: avoid; }
  h3 { color: #333; font-size: 12pt; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #D4A017; color: #0F0F1A; font-weight: 600; }
  tr:nth-child(even) { background: #f9f9f9; }
  code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
  pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 9pt; white-space: pre-wrap; }
  blockquote { border-left: 3px solid #D4A017; margin: 0; padding-left: 12px; color: #555; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
  a { color: #0F0F1A; }
  @media print { body { padding: 0; } }
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
      `--print-to-pdf=${pdfPath}`,
      fileUrl,
    ],
    { encoding: 'utf8', timeout: 120000 },
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

  for (const { src, dest, html } of PDF_SOURCES) {
    const title = src.replace('.md', '');
    const htmlPath = join(HTML_DIR, html);
    const pdfPath = join(OUT_DIR, dest);

    console.log(`Processing ${src}...`);
    writeFileSync(htmlPath, markdownToHtml(src, title), 'utf8');
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
