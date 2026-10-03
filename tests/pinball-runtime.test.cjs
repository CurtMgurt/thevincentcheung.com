'use strict';

// Run with node --test tests/pinball-runtime.test.cjs. The harness exercises the
// shipped script through DOM events and animation frames, without a browser or
// exposing private game state in production.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'pinball.js'), 'utf8');

function boot({ stored = null, storageThrows = false, debug = true, visible = true } = {}) {
  let time = 1000;
  let nextFrame = 1;
  let clearCount = 0;
  let viewportObserver;
  let dialogObserver;
  const frames = new Map();
  const storageWrites = [];

  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }
    dispatchEvent(event) {
      event.target ||= this;
      event.preventDefault ||= function () { this.defaultPrevented = true; };
      for (const handler of this.listeners.get(event.type) || []) handler(event);
      return !event.defaultPrevented;
    }
  }

  const document = new Target();
  document.hidden = false;
  const context = new Proxy({}, {
    get(object, key) {
      if (key === 'clearRect') return () => { clearCount += 1; };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return object[key] || (() => {});
    },
    set(object, key, value) { object[key] = value; return true; }
  });

  class Element extends Target {
    constructor() {
      super();
      this.dataset = {};
      this.style = {};
      this.attributes = new Map();
      this.classes = new Set();
      this.classList = {
        add: (name) => this.classes.add(name),
        remove: (name) => this.classes.delete(name),
        contains: (name) => this.classes.has(name),
        toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)
      };
      this.tabIndex = 0;
      this.open = false;
      this.textContent = '';
    }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    getContext() { return context; }
    getBoundingClientRect() {
      return { top: visible ? 100 : 1200, bottom: visible ? 740 : 1840, left: 0, right: 480 };
    }
    focus() {
      const previous = document.activeElement;
      if (previous === this) return;
      if (previous) {
        previous.dispatchEvent({ type: 'blur', relatedTarget: this });
        document.dispatchEvent({ type: 'focusout', target: previous, relatedTarget: this });
      }
      document.activeElement = this;
      document.dispatchEvent({ type: 'focusin', target: this });
    }
    setPointerCapture() {}
  }

  const elements = Object.fromEntries([
    'pinball-canvas', 'pinball-score', 'pinball-best', 'pinball-balls', 'pinball-goalie',
    'pinball-status', 'scoreboard', 'launch', 'reset', 'left', 'right', 'dialog', 'other'
  ].map((name) => [name, new Element()]));
  elements['pinball-canvas'].dataset.pinballDebug = String(debug);
  document.querySelector = (selector) => selector.startsWith('#')
    ? elements[selector.slice(1)] || null : selector === '.pinball-scoreboard' ? elements.scoreboard : null;
  document.querySelectorAll = (selector) => ({
    '.pinball-launch': [elements.launch], '.pinball-reset': [elements.reset],
    '.pinball-left': [elements.left], '.pinball-right': [elements.right], dialog: [elements.dialog]
  }[selector] || []);
  document.createElement = () => new Element();

  const window = new Target();
  window.innerHeight = 900;
  window.innerWidth = 1200;
  window.PointerEvent = function () {};
  window.matchMedia = () => ({ matches: false });
  window.localStorage = {
    getItem() { if (storageThrows) throw new Error('denied'); return stored; },
    setItem(key, value) {
      if (storageThrows) throw new Error('denied');
      stored = value;
      storageWrites.push({ key, value });
    }
  };
  window.requestAnimationFrame = (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.IntersectionObserver = class {
    constructor(callback) { viewportObserver = callback; }
    observe() {}
  };
  window.MutationObserver = class {
    constructor(callback) { dialogObserver = callback; }
    observe() {}
  };
  vm.runInNewContext(source, {
    document, window, performance: { now: () => time },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    IntersectionObserver: window.IntersectionObserver,
    MutationObserver: window.MutationObserver,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  }, { filename: 'pinball.js' });

  const canvas = elements['pinball-canvas'];
  return {
    elements, canvas, storageWrites,
    get pendingFrames() { return frames.size; },
    get draws() { return clearCount; },
    key(target, key, type = 'keydown', extras = {}) {
      const event = { type, target, key, code: key === ' ' ? 'Space' : key, defaultPrevented: false, ...extras };
      target.dispatchEvent(event);
      window.dispatchEvent(event);
      return event;
    },
    click(target) { target.dispatchEvent({ type: 'click' }); },
    step(ms = 1000 / 60) {
      time += ms;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
    runUntil(condition, max = 3600) {
      for (let index = 0; index < max && !condition(); index += 1) this.step();
      assert.ok(condition(), 'expected game condition within simulated time');
    },
    viewport(on) { viewportObserver([{ isIntersecting: on }]); },
    hidden(on) { document.hidden = on; document.dispatchEvent({ type: 'visibilitychange' }); },
    dialog(on) { elements.dialog.open = on; dialogObserver([]); },
    blur() { window.dispatchEvent({ type: 'blur' }); }
  };
}

test('page controls keep native keys and game buttons keep native activation', () => {
  const page = boot();
  for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'r']) {
    assert.equal(page.key(page.elements.other, key).defaultPrevented, false);
    assert.equal(page.canvas.dataset.gameState, 'ready');
  }
  for (const control of [page.elements.launch, page.elements.reset]) {
    for (const key of ['Enter', ' ']) assert.equal(page.key(control, key).defaultPrevented, false);
  }
  page.click(page.elements.reset);
  assert.equal(page.elements['pinball-goalie'].textContent, 'Donald');
  assert.equal(page.canvas.dataset.gameState, 'ready');
  page.click(page.elements.launch);
  assert.equal(page.canvas.dataset.gameState, 'launching');
});

test('canvas shortcuts and both flipper hold buttons release on focus, blur, and dialogs', () => {
  const page = boot();
  page.canvas.focus();
  assert.equal(page.key(page.canvas, 'ArrowLeft').defaultPrevented, true);
  assert.equal(page.elements.left.getAttribute('aria-pressed'), 'true');
  page.elements.other.focus();
  assert.equal(page.elements.left.getAttribute('aria-pressed'), 'false');

  for (const side of ['left', 'right']) {
    const button = page.elements[side];
    button.focus();
    page.key(button, ' ');
    page.key(button, 'Enter');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(page.canvas.dataset.gameState, 'ready');
    page.key(button, 'Enter', 'keyup');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    page.key(button, ' ', 'keyup');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    page.key(button, ' ');
    page.blur();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    page.key(button, ' ');
    page.dialog(true);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(page.pendingFrames, 0);
    page.dialog(false);
  }
});

test('idle rendering stops and viewport/tab suspension preserves launch time', () => {
  const page = boot();
  page.step();
  assert.equal(page.pendingFrames, 0);
  assert.equal(page.canvas.dataset.renderState, 'idle');
  assert.equal(page.key(page.canvas, 'Enter').defaultPrevented, true);
  page.step(40);
  const phase = page.canvas.dataset.launchPhase;
  page.viewport(false);
  assert.equal(page.canvas.dataset.renderState, 'paused');
  assert.equal(page.pendingFrames, 0);
  page.step(60000);
  assert.equal(page.canvas.dataset.launchPhase, phase);
  page.viewport(true);
  page.step();
  assert.equal(page.canvas.dataset.gameState, 'launching');
  page.hidden(true);
  assert.equal(page.pendingFrames, 0);
  page.step(60000);
  page.hidden(false);
  page.step();
  assert.equal(page.canvas.dataset.gameState, 'launching');
  page.runUntil(() => page.canvas.dataset.gameState === 'playing', 20);
});

test('lives, scoring, best score, and respawn survive a suspended game', () => {
  const page = boot({ stored: '10' });
  assert.equal(page.elements['pinball-best'].textContent, '10');
  assert.equal(page.elements['pinball-balls'].textContent, '3');
  page.click(page.elements.launch);
  page.runUntil(() => page.canvas.dataset.gameState === 'between');
  assert.equal(page.elements['pinball-balls'].textContent, '2');
  page.viewport(false);
  page.step(60000);
  page.viewport(true);
  page.step();
  assert.equal(page.canvas.dataset.gameState, 'between');
  page.runUntil(() => page.canvas.dataset.gameState === 'ready', 100);
  const earned = Number(page.elements['pinball-score'].textContent.replaceAll(',', ''));
  assert.ok(earned > 10, 'normal launched ball earns points');
  assert.equal(page.elements['pinball-best'].textContent, page.elements['pinball-score'].textContent);
  assert.equal(page.storageWrites.at(-1).value, String(earned));
  const writesBeforeReset = page.storageWrites.length;
  page.click(page.elements.reset);
  assert.equal(page.elements['pinball-score'].textContent, '0');
  assert.equal(page.elements['pinball-best'].textContent, earned.toLocaleString());
  assert.equal(page.storageWrites.length, writesBeforeReset);
  assert.equal(boot({ stored: String(earned) }).elements['pinball-best'].textContent, earned.toLocaleString());
});

test('blocked or malformed storage cannot break gameplay', () => {
  for (const stored of ['NaN', 'Infinity', '-1', '12.5', '9007199254740992', 'oops']) {
    assert.equal(boot({ stored }).elements['pinball-best'].textContent, '0');
  }
  const page = boot({ storageThrows: true });
  page.click(page.elements.launch);
  page.runUntil(() => Number(page.elements['pinball-score'].textContent.replaceAll(',', '')) > 0);
  assert.equal(page.elements['pinball-best'].textContent, page.elements['pinball-score'].textContent);
});

test('three lost balls reach game over, rendering settles, and play again resets lives', () => {
  const page = boot();
  for (let remaining = 2; remaining >= 0; remaining -= 1) {
    page.click(page.elements.launch);
    const expectedState = remaining ? 'between' : 'gameover';
    page.runUntil(() => page.canvas.dataset.gameState === expectedState);
    assert.equal(page.elements['pinball-balls'].textContent, String(remaining));
    if (remaining) page.runUntil(() => page.canvas.dataset.gameState === 'ready', 100);
  }
  page.runUntil(() => page.canvas.dataset.renderState === 'idle', 150);
  assert.equal(page.pendingFrames, 0);
  assert.equal(page.elements.launch.textContent, 'play again');
  page.click(page.elements.launch);
  assert.equal(page.elements['pinball-balls'].textContent, '3');
  assert.equal(page.canvas.dataset.gameState, 'launching');
});

test('production omits per-frame debug telemetry and offscreen pages do not loop', () => {
  const page = boot({ debug: false, visible: false });
  assert.equal(page.canvas.dataset.gameState, 'ready');
  assert.equal(page.canvas.dataset.renderState, 'paused');
  assert.equal(page.canvas.dataset.ballX, undefined);
  assert.equal(page.pendingFrames, 0);
  const draws = page.draws;
  page.step(60000);
  assert.equal(page.draws, draws);
});
