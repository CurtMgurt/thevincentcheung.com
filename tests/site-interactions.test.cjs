'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '../gallery.js'), 'utf8');

function boot(hash = '', navigator = {}) {
  function element() {
    const classes = new Set();
    return {
      listeners: {}, attrs: {}, dataset: {}, hidden: false, disabled: false,
      textContent: '', scrollTop: 0, scrollLeft: 0,
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle(name) { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
      },
      addEventListener(type, handler, options) {
        (this.listeners[type] ||= []).push({ handler, options });
      },
      emit(type, values = {}) {
        const event = {
          type, target: this, defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; },
          ...values,
        };
        const results = (this.listeners[type] || []).map(listener => listener.handler(event));
        if (this['on' + type]) results.push(this['on' + type](event));
        event.finished = Promise.all(results);
        return event;
      },
      setAttribute(key, value) { this.attrs[key] = String(value); },
      getAttribute(key) { return this.attrs[key]; },
      removeAttribute(key) { delete this.attrs[key]; if (key === 'src') this._src = ''; },
      click() { return this.disabled ? { finished: Promise.resolve() } : this.emit('click'); },
      focus() { this.focused = true; },
      scrollIntoView() { this.scrolled = true; },
      remove() { this.removed = true; },
    };
  }
  const year = element(), secret = element(), pinball = element(), gameStatus = element();
  pinball.hidden = true;
  gameStatus.textContent = 'ready';
  const dialog = element(), image = element(), close = element(), title = element();
  const stage = element(), loading = element(), error = element(), retry = element();
  const previous = element(), next = element(), zoom = element(), original = element();
  const share = element(), shareStatus = element(), position = element();
  error.hidden = true;
  let sourceAssignments = 0;
  Object.defineProperty(image, 'src', {
    get() { return this._src; },
    set(value) { this._src = value; this.complete = false; this.naturalWidth = 0; sourceAssignments++; },
  });
  const selectors = {
    '.art-lightbox-image': image, '.art-close': close, '#art-lightbox-title': title,
    '.art-viewer-stage': stage, '.art-loading': loading, '.art-error': error,
    '.art-retry': retry, '.art-prev': previous, '.art-next': next, '.art-zoom': zoom,
    '.art-original': original, '.art-share': share, '.art-share-status': shareStatus,
    '.art-position': position,
  };
  dialog.querySelector = selector => selectors[selector];
  dialog.showModal = () => { dialog.open = true; };
  const closeEvents = [];
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    closeEvents.push(() => dialog.emit('close'));
  };
  const definitions = [
    ['for-daddy', 'For Daddy', 'jpg', 576, 800],
    ['pokemon-world', 'Pokémon world', 'jpg', 800, 576],
    ['pokemon-battle', 'Pokémon battle', 'jpg', 800, 575],
  ];
  const pieces = definitions.map(([slug, name, extension, width, height]) => {
    const piece = element(), preview = element();
    piece.id = 'art-' + slug;
    piece.dataset = { artSrc: 'assets/art/' + slug + '.' + extension, artName: name };
    preview.alt = 'Description of ' + name;
    preview.attrs.width = String(width);
    preview.attrs.height = String(height);
    piece.querySelector = () => preview;
    return piece;
  });
  const window = element();
  const location = { href: 'https://thevincentcheung.com/' + hash };
  Object.defineProperty(location, 'hash', {
    get() { return new URL(this.href).hash; },
    set(value) { const url = new URL(this.href); url.hash = value; this.href = url.href; },
  });
  const entries = [{ url: location.href, state: null }];
  let historyIndex = 0, pendingTravel = null;
  const calls = [];
  const history = {
    get state() { return entries[historyIndex].state; },
    pushState(state, unused, url) {
      calls.push('push'); entries.splice(historyIndex + 1);
      entries.push({ url, state }); historyIndex++;
      location.href = url;
    },
    replaceState(state, unused, url) {
      calls.push('replace'); entries[historyIndex] = { url, state }; location.href = url;
    },
    back() { calls.push('back'); if (historyIndex > 0) pendingTravel = historyIndex - 1; },
    forward() { if (historyIndex < entries.length - 1) pendingTravel = historyIndex + 1; },
  };
  const scripts = [];
  const document = {
    title: 'Vincent Cheung', body: { append(script) { scripts.push(script); } },
    createElement(tag) { assert.equal(tag, 'script'); return element(); },
    querySelector: selector => ({
      '#year': year, '.secret-play': secret, '#pinball': pinball,
      '#pinball-status': gameStatus, '.art-lightbox': dialog,
    })[selector],
    querySelectorAll: () => pieces,
  };
  vm.runInNewContext(code, { Date, URL, location, history, navigator, window, document });
  function flushClose() { while (closeEvents.length) closeEvents.shift()(); }
  function flushHistory(flushClosing = true) {
    if (pendingTravel !== null) {
      historyIndex = pendingTravel; pendingTravel = null;
      location.href = entries[historyIndex].url;
      window.emit('popstate');
      window.emit('hashchange');
    }
    if (flushClosing) flushClose();
  }
  function loaded(width = 1152, height = 1600) {
    image.complete = true; image.naturalWidth = width; image.naturalHeight = height;
    image.emit('load');
  }
  return {
    year, secret, pinball, gameStatus, dialog, image, close, title, stage, loading,
    error, retry, previous, next, zoom, original, share, shareStatus, position,
    pieces, window, location, history, entries, calls, scripts, document,
    flushHistory, flushClose, loaded, sourceAssignments: () => sourceAssignments,
  };
}

test('gallery has stable named artwork, responsive previews, and an initially hidden lazy game', () => {
  assert.match(html, /<title>Vincent Cheung<\/title>/);
  assert.doesNotMatch(html, /art lab|mini-planet|fact-card|art-caption|data-art-title|script src="cards\.js/i);
  const pieces = [...html.matchAll(/<button class="art-piece"[^>]*>/g)].map(match => match[0]);
  assert.equal(pieces.length, 33);
  const ids = pieces.map(piece => piece.match(/\bid="([^"]+)"/)[1]);
  assert.equal(new Set(ids).size, 33);
  for (const piece of pieces) {
    const name = piece.match(/data-art-name="([^"]+)"/)[1];
    assert.ok(piece.includes('aria-label="Open ' + name + '"'));
  }
  assert.match(html, /class="photo-card planet"/);
  assert.match(html, /script src="script\.js/);
  assert.doesNotMatch(html, /<script[^>]*src="pinball\.js/);
  assert.match(html, /id="pinball" hidden/);
  for (const slug of ['for-daddy', 'pokemon-world', 'pokemon-battle']) {
    assert.match(html, new RegExp('src="assets/art/' + slug + '-preview\\.webp" srcset='));
  }
});

test('the game loads once on reveal, even while pending, and preserves hide/reveal', () => {
  const site = boot();
  assert.equal(site.scripts.length, 0);
  site.secret.click();
  assert.equal(site.pinball.hidden, false);
  assert.equal(site.secret.attrs['aria-expanded'], 'true');
  assert.equal(site.secret.attrs['aria-busy'], 'true');
  assert.equal(site.pinball.scrolled, true);
  assert.match(site.scripts[0].src, /^pinball\.js\?v=/);
  site.secret.click();
  assert.equal(site.pinball.hidden, true);
  site.secret.click();
  assert.equal(site.scripts.length, 1);
  site.scripts[0].emit('load');
  assert.equal(site.secret.attrs['aria-busy'], 'false');
  assert.equal(site.gameStatus.textContent, 'ready');
  site.secret.click(); site.secret.click();
  assert.equal(site.scripts.length, 1);
});

test('game loading failure can retry, and a direct game hash loads immediately once', async () => {
  const site = boot('#pinball');
  assert.equal(site.pinball.hidden, false);
  assert.equal(site.scripts.length, 1);
  site.window.emit('hashchange');
  assert.equal(site.scripts.length, 1);
  site.scripts[0].emit('error');
  await Promise.resolve();
  assert.equal(site.scripts[0].removed, true);
  assert.match(site.gameStatus.textContent, /reopen to retry/);
  assert.equal(site.secret.attrs['aria-busy'], 'false');
  site.secret.click(); site.secret.click();
  assert.equal(site.scripts.length, 2);
});

test('viewer loads the full artwork with meaningful names, position, and pending feedback', () => {
  const site = boot();
  site.pieces[0].click();
  assert.equal(site.dialog.open, true);
  assert.equal(site.title.textContent, 'For Daddy');
  assert.equal(site.document.title, 'For Daddy · Vincent Cheung');
  assert.equal(site.position.textContent, '1 / 3');
  assert.equal(site.image.src, 'assets/art/for-daddy.jpg');
  assert.equal(site.original.href, site.image.src);
  assert.equal(site.image.alt, 'Description of For Daddy');
  assert.equal(site.loading.hidden, false);
  assert.equal(site.image.hidden, true);
  assert.equal(site.zoom.disabled, true);
  assert.equal(site.location.hash, '#art-for-daddy');
  assert.equal(site.year.textContent, new Date().getFullYear());
  site.loaded();
  assert.equal(site.loading.hidden, true);
  assert.equal(site.image.hidden, false);
  assert.equal(site.zoom.disabled, false);
  assert.equal(site.image.width, 1152);
  assert.equal(site.image.height, 1600);
});

test('bounded navigation replaces one entry; close uses Back and restores current artwork focus', () => {
  const site = boot('#gallery');
  site.pieces[0].click();
  assert.equal(site.previous.disabled, true);
  site.previous.click();
  assert.equal(site.calls.filter(call => call === 'replace').length, 0);
  site.next.click(); site.next.click();
  assert.equal(site.next.disabled, true);
  site.next.click();
  assert.equal(site.entries.length, 2);
  assert.equal(site.location.hash, '#art-pokemon-battle');
  assert.equal(site.calls.filter(call => call === 'push').length, 1);
  assert.equal(site.calls.filter(call => call === 'replace').length, 2);
  site.close.click();
  assert.equal(site.calls.at(-1), 'back');
  site.flushHistory();
  assert.equal(site.dialog.open, false);
  assert.equal(site.location.hash, '#gallery');
  assert.equal(site.calls.filter(call => call === 'replace').length, 2);
  assert.equal(site.pieces[2].focused, true);
  assert.equal(site.document.title, 'Vincent Cheung');
  assert.equal(site.image.src, '');
});

test('Back and Forward synchronize the modal without rewriting browser history', () => {
  const site = boot();
  site.pieces[1].click();
  site.history.back(); site.flushHistory();
  assert.equal(site.dialog.open, false);
  assert.equal(site.pieces[1].focused, true);
  assert.equal(site.calls.filter(call => call === 'replace').length, 0);
  site.history.forward(); site.flushHistory();
  assert.equal(site.dialog.open, true);
  assert.equal(site.location.hash, '#art-pokemon-world');
  assert.equal(site.sourceAssignments(), 2);
  const event = site.dialog.emit('cancel');
  assert.equal(event.defaultPrevented, true);
  site.flushHistory();
  assert.equal(site.dialog.open, false);
  assert.equal(site.location.hash, '');
});

test('direct links open once, navigate in place, and close by clearing only their fragment', () => {
  const site = boot('#art-pokemon-world');
  assert.equal(site.dialog.open, true);
  assert.equal(site.calls.length, 0);
  site.window.emit('popstate'); site.window.emit('hashchange');
  assert.equal(site.sourceAssignments(), 1);
  site.next.click();
  assert.equal(site.entries.length, 1);
  site.close.click(); site.flushClose();
  assert.equal(site.dialog.open, false);
  assert.equal(site.location.hash, '');
  assert.deepEqual(site.calls, ['replace', 'replace']);
  assert.equal(site.pieces[2].focused, true);
  for (const hash of ['#art-unknown', '#art-%E0%A4%A', '#unrelated']) {
    assert.equal(boot(hash).dialog.open, undefined);
  }
});

test('a queued native close event cannot clear a newly reopened artwork', () => {
  const site = boot();
  site.pieces[0].click();
  site.close.click();
  site.flushHistory(false);
  site.pieces[1].click();
  site.flushClose();
  assert.equal(site.dialog.open, true);
  assert.equal(site.title.textContent, 'Pokémon world');
  assert.equal(site.image.src, 'assets/art/pokemon-world.jpg');
  assert.equal(site.location.hash, '#art-pokemon-world');
});

test('image errors expose retry; zoom uses natural size and navigation resets scrolling and stale loads', () => {
  const site = boot();
  site.pieces[0].click();
  const staleLoad = site.image.onload;
  site.image.emit('error');
  assert.equal(site.error.hidden, false);
  assert.equal(site.loading.hidden, true);
  site.zoom.click();
  assert.equal(site.dialog.classList.contains('is-zoomed'), false);
  site.retry.click();
  assert.equal(site.loading.hidden, false);
  assert.equal(site.error.hidden, true);
  assert.equal(site.sourceAssignments(), 2);
  site.loaded();
  site.zoom.click();
  assert.equal(site.zoom.textContent, 'Fit');
  assert.equal(site.zoom.attrs['aria-pressed'], 'true');
  const keyWhileZoomed = site.dialog.emit('keydown', { key: 'ArrowRight' });
  assert.equal(keyWhileZoomed.defaultPrevented, false);
  assert.equal(site.location.hash, '#art-for-daddy');
  site.stage.scrollTop = 100; site.stage.scrollLeft = 100;
  site.next.click();
  assert.equal(site.dialog.classList.contains('is-zoomed'), false);
  assert.equal(site.stage.scrollTop, 0);
  assert.equal(site.stage.scrollLeft, 0);
  staleLoad();
  assert.equal(site.image.hidden, true);
  assert.equal(site.loading.hidden, false);
  site.loaded(1600, 1152);
  site.image.click();
  assert.equal(site.dialog.classList.contains('is-zoomed'), true);
  site.image.click();
  const key = site.dialog.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(key.defaultPrevented, true);
  assert.equal(site.location.hash, '#art-for-daddy');
  site.dialog.emit('keydown', { key: 'ArrowRight', target: { tagName: 'INPUT' } });
  assert.equal(site.location.hash, '#art-for-daddy');
});

test('swipes navigate without preventing scroll, while short, vertical, multitouch, canceled and zoom gestures do not', () => {
  const site = boot();
  site.pieces[0].click();
  const touch = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier });
  function swipe(dx, dy, cancel) {
    const start = site.stage.emit('touchstart', { touches: [touch(200, 200)] });
    if (cancel) site.stage.emit(cancel, { touches: [] });
    const end = site.stage.emit('touchend', { touches: [], changedTouches: [touch(200 + dx, 200 + dy)] });
    assert.equal(start.defaultPrevented, false);
    assert.equal(end.defaultPrevented, false);
  }
  swipe(-63, 0); swipe(-70, 100);
  swipe(-100, 0, 'pointercancel'); swipe(-100, 0, 'touchcancel');
  assert.equal(site.location.hash, '#art-for-daddy');
  site.stage.emit('touchstart', { touches: [touch(200, 200)] });
  site.stage.emit('touchmove', { touches: [touch(190, 200), touch(220, 200, 2)] });
  site.stage.emit('touchend', { touches: [], changedTouches: [touch(50, 200)] });
  assert.equal(site.location.hash, '#art-for-daddy');
  swipe(-100, 10);
  assert.equal(site.location.hash, '#art-pokemon-world');
  site.loaded(1600, 1152); site.zoom.click();
  swipe(-100, 0);
  assert.equal(site.location.hash, '#art-pokemon-world');
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.equal(site.stage.listeners[type][0].options.passive, true);
  }
});

test('share uses the native sheet, then clipboard, then a selectable URL; canceled share does not copy', async () => {
  const shared = [], copied = [];
  const native = boot('', {
    share: async data => { shared.push(data); },
    clipboard: { writeText: async url => { copied.push(url); } },
  });
  native.pieces[1].click();
  await native.share.click().finished;
  assert.equal(shared[0].url, 'https://thevincentcheung.com/#art-pokemon-world');
  assert.equal(copied.length, 0);
  assert.equal(native.shareStatus.textContent, 'Shared.');
  const clipboard = boot('', { clipboard: { writeText: async url => { copied.push(url); } } });
  clipboard.pieces[0].click();
  await clipboard.share.click().finished;
  assert.equal(clipboard.shareStatus.textContent, 'Link copied.');
  assert.equal(copied[0], 'https://thevincentcheung.com/#art-for-daddy');
  const fallback = boot('', {
    share: async () => { throw new Error('Unavailable'); },
    clipboard: { writeText: async () => { throw new Error('Denied'); } },
  });
  fallback.pieces[2].click();
  await fallback.share.click().finished;
  assert.match(fallback.shareStatus.textContent, /Copy this link: https:\/\/thevincentcheung.com\/#art-pokemon-battle/);
  const canceled = boot('', {
    share: async () => { const failure = new Error('Canceled'); failure.name = 'AbortError'; throw failure; },
    clipboard: { writeText: async () => { throw new Error('Should not run'); } },
  });
  canceled.pieces[0].click();
  await canceled.share.click().finished;
  assert.equal(canceled.shareStatus.textContent, '');
});
