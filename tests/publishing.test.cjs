const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('production package includes the gallery and lazy game while excluding development and original source files', () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: root });
  const output = path.join(root, '_site');
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.equal(fs.readFileSync(path.join(output, 'CNAME'), 'utf8').trim(), 'thevincentcheung.com');
  const refs = [...html.matchAll(/(?:src|href|data-art-src)="([^"#]+)"/g)].map(match => match[1]);
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    refs.push(...match[1].split(',').map(candidate => candidate.trim().split(/\s+/)[0]));
  }
  const css = fs.readFileSync(path.join(output, 'styles.css'), 'utf8');
  refs.push(...[...css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(match => match[1]));
  for (const ref of refs.filter(ref => !/^https?:/.test(ref))) {
    assert.ok(fs.existsSync(path.join(output, ref.split('?')[0])), `Missing public dependency: ${ref}`);
  }
  for (const file of ['pinball.js', 'assets/favicon.svg', 'assets/favicon-32.png', 'assets/apple-touch-icon.png', 'assets/share-card.jpg']) {
    assert.ok(fs.existsSync(path.join(output, file)), `Missing dynamic or sharing asset: ${file}`);
  }
  for (const file of ['.git', '.github', 'tests', 'scripts', 'mockups', 'README.md', 'assets/theme', 'assets/masked-web-hero.png', 'assets/vincent-spiderman.jpg', 'assets/planet-voices/sun.wav', 'assets/art/balloon-painting.jpg']) {
    assert.equal(fs.existsSync(path.join(output, file)), false, `Private or unused file was packaged: ${file}`);
  }
});
