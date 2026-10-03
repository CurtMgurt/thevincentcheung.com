'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

function boot({ reducedMotion = false, savedSound = null, width = 900, height = 520, heroTop = 0, viewportHeight = height } = {}) {
  let now = 10000;
  let random = () => .8;
  let timerId = 0;
  let chirps = 0;
  const timers = new Map();
  const storage = new Map(savedSound ? [['vincent:sound', savedSound]] : []);
  function element() {
    const classes = new Set();
    return {
      textContent: '', listeners: {}, attrs: {}, children: [], dataset: {},
      offsetWidth: 120, offsetHeight: 64,
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
      },
      style: { setProperty(key, value) { this[key] = value; } },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; },
      append(...children) { children.forEach(child => { child.parent = this; }); this.children.push(...children); },
      remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
      click() { this.listeners.click({ target: this }); },
    };
  }
  const planet = element(), toast = element(), hero = element(), soundToggle = element();
  const webButton = element(), year = element();
  hero.clientWidth = width;
  hero.clientHeight = height;
  hero.getBoundingClientRect = () => ({ left: 0, top: heroTop, width, height });
  planet.getBoundingClientRect = () => ({ left: 60, top: 80, width: 160, height: 160 });
  class ClockDate extends Date { static now() { return now; } }
  class AudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: gain => ({ connect() {} }),
        start() { chirps += 1; },
        stop() {},
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
    }
  }
  const window = {
    AudioContext,
    innerHeight: viewportHeight,
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, due: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(code, {
    Date: ClockDate,
    Math: Object.assign(Object.create(Math), { random: () => random() }),
    window,
    document: {
      querySelector: selector => ({ '.planet': planet, '.toast': toast, '.hero': hero, '.sound-toggle': soundToggle, '.web-button': webButton, '#year': year })[selector] ?? null,
      querySelectorAll: () => [],
      createElement: element,
    },
  });
  return {
    planet, toast, hero, soundToggle, storage,
    get chirps() { return chirps; },
    random(value) { random = typeof value === 'function' ? value : () => value; },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of timers) {
        if (timer.due <= now) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

test('photo laughs only sometimes, with a pause between laughs and a brief visible phrase', () => {
  const site = boot({ reducedMotion: true });
  site.random(.35);
  site.planet.click();
  assert.equal(site.toast.textContent, '');
  site.random(.34);
  site.planet.click();
  assert.equal(site.toast.textContent, 'hehehe');
  assert.equal(site.toast.classList.contains('show'), true);
  site.advance(1250);
  assert.equal(site.toast.textContent, '');
  assert.equal(site.toast.classList.contains('show'), false);
  site.advance(949);
  site.random(0);
  site.planet.click();
  assert.equal(site.toast.textContent, '');
  site.advance(1);
  site.planet.click();
  assert.equal(site.toast.textContent, 'hehehe');
});

test('laugh locations vary while remaining inside the hero on wide and narrow screens', () => {
  for (const dimensions of [
    { width: 900, heroTop: 0, viewportHeight: 520 },
    { width: 280, heroTop: 0, viewportHeight: 300 },
    { width: 280, heroTop: -120, viewportHeight: 220 },
  ]) {
    const { width, heroTop, viewportHeight } = dimensions;
    const site = boot({ reducedMotion: true, height: 300, ...dimensions });
    const positions = [];
    for (const edge of [0, 1]) {
      const values = [0, edge, edge];
      site.random(() => values.shift() ?? edge);
      site.planet.click();
      assert.equal(site.toast.textContent, 'hehehe');
      const x = parseFloat(site.toast.style.left);
      const y = parseFloat(site.toast.style.top);
      assert.ok(x - site.toast.offsetWidth / 2 >= 20, `left edge at ${x} in ${width}px hero`);
      assert.ok(x + site.toast.offsetWidth / 2 <= width - 20, `right edge at ${x} in ${width}px hero`);
      assert.ok(y - site.toast.offsetHeight / 2 >= Math.max(20, -heroTop + 20));
      assert.ok(y + site.toast.offsetHeight / 2 <= Math.min(site.hero.clientHeight, viewportHeight - heroTop) - 20);
      positions.push([x, y]);
      site.advance(2200);
    }
    assert.notDeepEqual(positions[0], positions[1]);
  }
});

test('photo taps still pop and chirp even when no phrase appears', () => {
  const site = boot();
  site.random(.9);
  site.planet.click();
  assert.equal(site.toast.textContent, '');
  assert.equal(site.planet.classList.contains('boop'), true);
  assert.ok(site.hero.children.some(child => child.className === 'photo-pop'));
  assert.equal(site.chirps, 1);
  site.planet.click();
  assert.equal(site.chirps, 2);
});

test('saved sound setting and relocated toggle continue to mute and persist sound', () => {
  const site = boot({ reducedMotion: true, savedSound: 'off' });
  assert.equal(site.soundToggle.attrs.title, 'Sound off');
  assert.equal(site.soundToggle.attrs['aria-pressed'], 'false');
  site.random(0);
  site.planet.click();
  assert.equal(site.toast.textContent, 'hehehe');
  assert.equal(site.chirps, 0);
  site.soundToggle.click();
  assert.equal(site.storage.get('vincent:sound'), 'on');
  assert.equal(site.soundToggle.attrs['aria-pressed'], 'true');
  site.planet.click();
  assert.equal(site.chirps, 2);
  site.soundToggle.click();
  site.planet.click();
  assert.equal(site.storage.get('vincent:sound'), 'off');
  assert.equal(site.chirps, 2);
});
