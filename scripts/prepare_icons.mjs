// Requires Sharp for development asset generation; the live site has no dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const button = html.match(/<button\b[^>]*class="[^"]*\bsecret-play\b[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0];
const drawing = button?.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1].trim();
if (!drawing) throw new Error('The footer pinball icon could not be found.');

// Reuse the footer drawing unchanged, centered on a square paper background.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
  <title>Smiling pinball machine</title>
  <rect width="56" height="56" rx="12" fill="#fbf8ef"/>
  <g transform="translate(4 0)">
${drawing}
  </g>
</svg>
`;
await writeFile(path.join(root, 'assets/favicon.svg'), svg);
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  let icon = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);
  if (name === 'apple-touch-icon.png') icon = icon.flatten({ background: '#fbf8ef' });
  await icon.png().toFile(path.join(root, 'assets', name));
}
console.log('Reused the footer pinball drawing for SVG, 32px favicon, and 180px touch icon.');
