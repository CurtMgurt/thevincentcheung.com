'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '../gallery.js'), 'utf8');

function boot(hash = '') {
  const element = () => ({
    listeners: {}, attrs: {}, dataset: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(key, value) { this.attrs[key] = value; },
    getAttribute(key) { return this.attrs[key]; },
    removeAttribute(key) { delete this.attrs[key]; },
    click() { this.listeners.click({ target: this }); },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
  });
  const year = element(), secret = element(), pinball = element();
  pinball.hidden = true;
  const dialog = element(), image = element(), close = element(), title = element();
  dialog.querySelector = sel => ({ img: image, '.art-close': close, '#art-lightbox-title': title })[sel];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.listeners.close(); };
  const piece = element(), preview = element();
  preview.alt = 'A drawing'; preview.width = 1152; preview.height = 1600;
  preview.attrs.width = '1152'; preview.attrs.height = '1600';
  piece.dataset = { artSrc: 'assets/art/for-daddy.jpg', artTitle: 'For Daddy' };
  piece.querySelector = () => preview;
  const window = element();
  vm.runInNewContext(code, {
    Date, location: { hash }, window,
    document: {
      querySelector: sel => ({ '#year': year, '.secret-play': secret, '#pinball': pinball, '.art-lightbox': dialog })[sel],
      querySelectorAll: () => [piece],
    },
  });
  return { year, secret, pinball, dialog, image, close, title, piece };
}

test('home leads with Vincent and artwork, with pinball initially hidden', () => {
  assert.match(html, /<title>Vincent Cheung<\/title>/);
  assert.doesNotMatch(html, /art lab|mini-planet|fact-card|art-caption|data-art-title|script src="cards\.js/i);
  assert.match(html, /class="photo-card planet"/);
  assert.match(html, /script src="script\.js/);
  assert.equal([...html.matchAll(/class="art-piece"/g)].length, 30);
  assert.ok(html.indexOf('class="art-grid"') < html.indexOf('class="pinball-zone"'));
  assert.match(html, /id="pinball" hidden/);
});

test('footer toggles the hidden game and direct links reveal it', () => {
  const site = boot();
  assert.equal(site.pinball.hidden, true);
  site.secret.click();
  assert.equal(site.pinball.hidden, false);
  assert.equal(site.secret.attrs['aria-expanded'], 'true');
  assert.equal(site.pinball.scrolled, true);
  site.secret.click();
  assert.equal(site.pinball.hidden, true);
  assert.equal(site.secret.attrs['aria-expanded'], 'false');
  assert.equal(boot('#pinball').pinball.hidden, false);
});

test('artwork opens at full size and closing restores focus', () => {
  const site = boot();
  site.piece.click();
  assert.equal(site.dialog.open, true);
  assert.equal(site.image.src, 'assets/art/for-daddy.jpg');
  assert.equal(site.image.alt, 'A drawing');
  assert.equal(site.title.textContent, 'Artwork close-up');
  assert.equal(site.image.height, 1600);
  site.close.click();
  assert.equal(site.dialog.open, false);
  assert.equal(site.piece.focused, true);
  assert.equal(site.year.textContent, new Date().getFullYear());
});
