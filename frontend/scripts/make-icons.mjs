/**
 * Renders the brand mark from src/app/components/Logo.tsx to PNG icons.
 *
 * The mark lives in the app as inline SVG, so exporting from that same geometry keeps the
 * installed icon identical to the logo people see in the header. Hand-drawing a PNG instead
 * is how the two quietly drift apart.
 *
 *   node scripts/make-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

const GRADIENT = `
  <defs>
    <linearGradient id="sw-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E8262C" />
      <stop offset="1" stop-color="#A81D20" />
    </linearGradient>
  </defs>`;

// The car and bubbles, exactly as drawn in Logo.tsx.
const MARK = `
  <path d="M14 38c0-1 .6-2 1.6-2.4l4-1.6 3.4-6.2c.7-1.2 2-2 3.4-2h11.2c1.4 0 2.7.8 3.4 2l3.4 6.2 4 1.6c1 .4 1.6 1.4 1.6 2.4v5a2 2 0 0 1-2 2h-2.2a4 4 0 0 1-7.6 0H25.8a4 4 0 0 1-7.6 0H16a2 2 0 0 1-2-2v-5z"
        fill="white" fill-opacity="0.95" />
  <circle cx="47" cy="20" r="3" fill="white" fill-opacity="0.9" />
  <circle cx="53" cy="26" r="2" fill="white" fill-opacity="0.7" />
  <circle cx="42" cy="15" r="1.6" fill="white" fill-opacity="0.6" />`;

/** The app's rounded-square tile: what the icon looks like everywhere except Android. */
const anyPurpose = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  ${GRADIENT}
  <rect width="64" height="64" rx="16" fill="url(#sw-grad)" />
  ${MARK}
</svg>`;

/**
 * Android crops a maskable icon to whatever shape the launcher uses, and only the middle 80%
 * is guaranteed to survive. So the tile bleeds to every edge and the mark is scaled down to
 * sit inside that safe circle, instead of having its corners shaved off.
 */
const maskable = () => {
  const safe = 0.8;
  const offset = (64 * (1 - safe)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  ${GRADIENT}
  <rect width="64" height="64" fill="url(#sw-grad)" />
  <g transform="translate(${offset} ${offset}) scale(${safe})">${MARK}</g>
</svg>`;
};

const render = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const outputs = [
  ['logo.png', anyPurpose(), 512],
  ['icon-192.png', anyPurpose(), 192],
  ['icon-512.png', anyPurpose(), 512],
  ['icon-maskable-512.png', maskable(), 512],
  ['apple-touch-icon.png', anyPurpose(), 180],
  ['favicon-32.png', anyPurpose(), 32],
];

for (const [name, svg, size] of outputs) {
  const png = render(svg, size);
  writeFileSync(join(publicDir, name), png);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
