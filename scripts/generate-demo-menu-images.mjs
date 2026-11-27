/**
 * License-free demo menu photos (flat illustration, not stock photography).
 * Usage: node scripts/generate-demo-menu-images.mjs
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "apps/api/assets/demo-menu");
mkdirSync(outDir, { recursive: true });

const SLUGS = [
  "paneer-tikka",
  "chicken-wings",
  "veg-spring-roll",
  "butter-chicken",
  "dal-makhani",
  "margherita-pizza",
  "veg-biryani",
  "butter-naan",
  "garlic-naan",
  "masala-chai",
  "fresh-lime-soda",
  "cold-coffee",
  "gulab-jamun",
  "brownie",
  "matka-chai",
  "cutting-chai",
  "filter-coffee",
  "samosa",
  "vada-pav",
  "maska-bun",
  "chai-samosa-combo",
  "coffee-bun-combo",
  "espresso",
  "cappuccino",
  "latte",
  "green-tea",
  "chai-latte",
  "croissant",
];

const PALETTES = [
  ["#c2410c", "#fdba74"],
  ["#9a3412", "#fecaca"],
  ["#b45309", "#fde68a"],
  ["#0f766e", "#99f6e4"],
  ["#1d4ed8", "#bfdbfe"],
  ["#6d28d9", "#ddd6fe"],
  ["#be123c", "#fecdd3"],
  ["#3f6212", "#d9f99d"],
];

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function labelFor(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function svgFor(slug, index) {
  const [from, to] = PALETTES[index % PALETTES.length];
  const label = escapeXml(labelFor(slug));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <circle cx="320" cy="210" r="120" fill="#fffaf3"/>
  <circle cx="320" cy="210" r="78" fill="${from}" fill-opacity="0.9"/>
  <circle cx="292" cy="188" r="16" fill="#fff" fill-opacity="0.35"/>
  <text x="320" y="400" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="36" font-weight="700" fill="#fffaf3">${label}</text>
</svg>`;
}

let index = 0;
for (const slug of SLUGS) {
  const file = resolve(outDir, `${slug}.webp`);
  await sharp(Buffer.from(svgFor(slug, index))).webp({ quality: 80 }).toFile(file);
  index += 1;
}
console.log(`Wrote ${SLUGS.length} demo photos to ${outDir}`);
