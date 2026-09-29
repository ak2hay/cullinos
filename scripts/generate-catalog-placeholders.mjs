/**
 * Generates one WebP placeholder per universal menu catalog section into
 * apps/api/assets/catalog-placeholders (served at /catalog-placeholders/*).
 *
 * Usage: npm run build -w @cullinos/shared && node scripts/generate-catalog-placeholders.mjs
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = require("sharp");
const { CATALOG_SECTIONS } = require(resolve(root, "packages/shared/dist/index.js"));

const outDir = resolve(root, "apps/api/assets/catalog-placeholders");
mkdirSync(outDir, { recursive: true });

const PALETTES = {
  food: ["#f97316", "#b45309"],
  beverage: ["#0ea5e9", "#0f766e"],
  alcohol: ["#7c3aed", "#4c1d95"],
};

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(label, max = 16) {
  const words = label.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function svgFor(section) {
  const [from, to] = PALETTES[section.group] ?? PALETTES.food;
  const lines = wrap(section.label);
  const lineHeight = 46;
  const startY = 180 - ((lines.length - 1) * lineHeight) / 2;
  const text = lines
    .map(
      (l, i) =>
        `<text x="240" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle">${escapeXml(l)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)"/>
  <circle cx="400" cy="70" r="120" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="60" cy="320" r="90" fill="#ffffff" fill-opacity="0.06"/>
  <g font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">${text}</g>
</svg>`;
}

for (const section of CATALOG_SECTIONS) {
  const file = resolve(outDir, `${section.id}.webp`);
  await sharp(Buffer.from(svgFor(section))).webp({ quality: 80 }).toFile(file);
}
console.log(`Wrote ${CATALOG_SECTIONS.length} placeholders to ${outDir}`);
