import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, '_site');
const pages = new Set(['index.html', 'styles.css', 'script.js', 'gallery.js', 'pinball.js', 'CNAME']);
const publicAsset = /^(?:assets\/(?:vincent-spiderman-sanitized\.png|favicon\.svg|favicon-32\.png|apple-touch-icon\.png|share-card\.jpg)|assets\/hero\/vincent-\d+\.webp|assets\/art\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)|assets\/fonts\/[a-zA-Z0-9_-]+\.(?:woff2|txt)|assets\/planet-voices\/[a-zA-Z0-9_-]+\.mp3)$/;
const selected = new Set(pages);
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'styles.css'), 'utf8');
const hostname = (await readFile(path.join(root, 'CNAME'), 'utf8')).trim();
const origin = new URL(`https://${hostname}/`);

function addReference(reference) {
  if (!reference || reference.startsWith('#') || reference.startsWith('data:')) return;
  const url = new URL(reference.replaceAll('&amp;', '&'), origin);
  if (url.origin !== origin.origin) return;
  const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!relative) return;
  if (!pages.has(relative) && !publicAsset.test(relative)) {
    throw new Error(`Public reference is outside the deployment allowlist: ${relative}`);
  }
  selected.add(relative);
}

for (const match of html.matchAll(/\b(?:src|href|data-art-src)\s*=\s*["']([^"']+)["']/g)) addReference(match[1]);
for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/g)) {
  for (const candidate of match[1].split(',')) addReference(candidate.trim().split(/\s+/)[0]);
}
for (const match of html.matchAll(/<meta\b[^>]*\b(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*\bcontent=["']([^"']+)["']/g)) addReference(match[1]);
for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) addReference(match[1]);
// script.js constructs these audio URLs from the visible planet names. The
// current gallery has no planet section, so its unused voice files stay out.
for (const match of html.matchAll(/\bdata-planet=["']([a-zA-Z0-9_-]+)["']/g)) {
  addReference(`assets/planet-voices/${match[1].toLowerCase()}.mp3`);
}
for (const license of ['DM-Mono-OFL.txt', 'Fredoka-OFL.txt', 'SOURCES.txt']) addReference(`assets/fonts/${license}`);

// Check every source before clearing the build folder. No directory is copied
// wholesale, and symlinked files/directories cannot add material from elsewhere.
for (const relative of selected) {
  const source = path.join(root, relative);
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlinked public source: ${relative}`);
  }
  if (!(await lstat(source)).isFile()) throw new Error(`Missing public file: ${relative}`);
  const resolved = await realpath(source);
  if (!resolved.startsWith(root + path.sep)) throw new Error(`Public file escapes the workspace: ${relative}`);
}
// The destination is a fixed child of the resolved repository root.
if (path.dirname(output) !== root || path.basename(output) !== '_site') throw new Error('Unsafe build destination');
try {
  if ((await lstat(output)).isSymbolicLink()) throw new Error('Build destination is a symlink');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const relative of [...selected].sort()) {
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, relative), destination);
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Built ${selected.size + 1} public files in _site. Originals, mockups, tests, scripts, and unused assets are excluded.`);
