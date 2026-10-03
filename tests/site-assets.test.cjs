const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('every published image, font, and script reference resolves locally', () => {
  // Canonical URLs identify the site; they do not fetch a runtime dependency.
  const runtimeHtml = html.replace(/<link\b[^>]*\brel="canonical"[^>]*>/g, '');
  const refs = [...runtimeHtml.matchAll(/(?:src|href|data-art-src)="([^"]+)"/g)].map(match => match[1]);
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    refs.push(...match[1].split(',').map(candidate => candidate.trim().split(/\s+/)[0]));
  }
  refs.push(...[...css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(match => match[1]));
  for (const ref of refs.filter(ref => !ref.startsWith('#'))) {
    assert.ok(!/^https?:|^\/\//.test(ref), `External runtime dependency: ${ref}`);
    assert.ok(fs.existsSync(path.join(root, ref.split('?')[0])), `Missing asset: ${ref}`);
  }
  for (const match of html.matchAll(/data-planet="([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, `assets/planet-voices/${match[1].toLowerCase()}.mp3`)));
  }
  for (const match of html.matchAll(/(?:property="og:image"|name="twitter:image") content="([^"]+)"/g)) {
    const imageUrl = new URL(match[1]);
    assert.equal(imageUrl.origin, 'https://thevincentcheung.com');
    assert.ok(fs.existsSync(path.join(root, imageUrl.pathname)));
  }
});

test('the document policy blocks inline code, API connections, and external resources', () => {
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(policy.includes(directive), `Missing ${directive}`);
  }
  assert.doesNotMatch(html, /\son\w+\s*=|\sstyle\s*=|javascript:/i);
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /assets\/(?:masked-web-hero\.png|vincent-spiderman\.jpg)/);
});

test('preview serves intended assets and keeps original photos and development files private', async () => {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const address = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preview server startup timed out')), 5000);
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
      server.stdout.once('data', chunk => {
        clearTimeout(timeout);
        const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) resolve(url);
        else reject(new Error(`Missing preview URL: ${chunk}`));
      });
    });
    const home = await fetch(address);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('content-security-policy'), "frame-ancestors 'none'");
    for (const file of ['/.git/config', '/README.md', '/scripts/serve.mjs', '/assets/masked-web-hero.png', '/assets/vincent-spiderman.jpg', '/assets/planet-voices/sun.wav', '/assets/art/%2e%2e%2f%2e%2e%2fREADME.md']) {
      assert.equal((await fetch(address + file)).status, 404, file);
    }
    assert.equal((await fetch(address + '/assets/art/for-daddy.jpg', { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(address, { method: 'POST' })).status, 405);
  } finally {
    server.kill();
  }
});
