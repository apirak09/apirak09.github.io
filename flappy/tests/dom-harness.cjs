'use strict';
// A small event/DOM fixture for exercising the real game handlers in Node.
// It deliberately does not emulate layout, a browser, network, or canvas pixels.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../core.js');
const club = require('../club.js');
const updates = require('../updates.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(values = new Map(), blocked = false) {
  let now = 0, nextFrame, serial = 0, flight;
  const drawing = [], listeners = new Map(), timers = new Map(); let timerId = 0;
  const document = { hidden: false, activeElement: null };
  const listen = (object, type, fn) => { if (!object.events) object.events = new Map(); if (!object.events.has(type)) object.events.set(type, []); object.events.get(type).push(fn); };
  const emit = (object, type, detail = {}) => { const event = { type, target: object, preventDefault() {}, ...detail }; for (const fn of object.events?.get(type) || []) fn(event); };
  class Element {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.dataset = {}; this.events = new Map(); this.inert = false;
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      }
      this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs; this.checked = 'checked' in attrs; this.value = attrs.value || ''; this._text = '';
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
      const classes = new Set((attrs.class || '').split(/\s+/));
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, force) => { const enabled = force ?? !classes.has(name); enabled ? classes.add(name) : classes.delete(name); return enabled; } };
    }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(type, fn) { listen(this, type, fn); }
    matches(selector) {
      const attributes = [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
      const base = selector.replace(/\[[^\]]+\]/g, '');
      if (base.startsWith('.') && !this.classList.contains(base.slice(1))) return false;
      if (base && !base.startsWith('.') && this.tagName !== base.toUpperCase()) return false;
      return attributes.every(([, key, value]) => key in this.attrs && (value === undefined || this.attrs[key] === value));
    }
    querySelectorAll(selector) {
      const matches = [], selectors = selector.split(',').map(s => s.trim());
      const visit = node => { for (const child of node.children) { if (selectors.some(s => child.matches(s))) matches.push(child); visit(child); } };
      visit(this); return matches;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { let node = this; while (node) { if (selector.split(',').some(s => node.matches(s.trim()))) return node; node = node.parentElement; } return null; }
    focus() { document.activeElement = this; }
    click() { if (!this.disabled) emit(this, 'click'); }
    showModal() { this.attrs.open = ''; }
    close() { delete this.attrs.open; }
    getBoundingClientRect() { return { width: 960, height: 680, left: 0, top: 0, right: 960, bottom: 680 }; }
    set innerHTML(source) { this.children = []; parse(source, this); }
    set textContent(value) { this._text = String(value); }
    get textContent() { return this._text; }
    getContext() { return new Proxy({}, { get: (ctx, key) => key in ctx ? ctx[key] : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : key === 'drawImage' ? (...args) => drawing.push(args) : () => {}, set: (ctx, key, value) => { ctx[key] = value; return true; } }); }
  }
  function parse(source, root) {
    const stack = [root], voids = new Set(['meta', 'link', 'img', 'input', 'br', 'hr']);
    for (const [, close, tag, attrsText, selfClose] of source.matchAll(/<(\/)?([a-z][a-z0-9-]*)([^>]*?)(\/?)>/gi)) {
      if (close) { if (stack.at(-1).tagName === tag.toUpperCase()) stack.pop(); continue; }
      const attrs = {};
      for (const [, key, value] of attrsText.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[key] = value ?? '';
      const element = new Element(tag, attrs); element.parentElement = stack.at(-1); stack.at(-1).children.push(element);
      if (!selfClose && !voids.has(tag)) stack.push(element);
    }
  }
  const root = new Element('root'); parse(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), root);
  document.documentElement = root.querySelector('html');
  document.getElementById = id => root.querySelectorAll('[id]').find(element => element.attrs.id === id) || null;
  document.querySelector = selector => root.querySelector(selector); document.querySelectorAll = selector => root.querySelectorAll(selector);
  document.addEventListener = (type, fn) => listen(document, type, fn);
  const storage = { getItem: key => { if (blocked) throw new Error('blocked'); return values.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw new Error('blocked'); values.set(key, value); } };
  const fakeTimers = { setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) };
  const release = { version: updates.VERSION };
  const context = {
    document, navigator: {}, location: { href: 'https://example.com/flappy/', protocol: 'https:', replace: url => context.navigated.push(url) }, navigated: [],
    localStorage: storage, performance: { now: () => now }, devicePixelRatio: 1, crypto: { randomUUID: () => `test-flight-${++serial}` },
    ...fakeTimers, requestAnimationFrame: fn => { nextFrame = fn; },
    Image: class { constructor() { this.complete = true; this.naturalWidth = 256; } },
    URL, AbortController, fetch: async () => ({ ok: true, json: async () => release, text: async () => `<meta name="game-version" content="${release.version}">` }),
    matchMedia: () => ({ matches: false }), PointerEvent: class {},
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    FlappyCore: { ...core, Flight: class extends core.Flight { constructor(...args) { super(...args); flight = this; } } }, FlappyClub: club,
    FlappyUpdates: { ...updates, GameUpdates: class extends updates.GameUpdates { constructor(options) { super({ ...options, timers: fakeTimers }); } } },
    FlightAudio: class { unlock() { return Promise.resolve(false); } update() {} effect() {} suspend() {} setActive() {} }
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), context);
  const step = (frames = 1) => { for (let i = 0; i < frames; i++) { now += 1000 / 60; nextFrame(now); } };
  return { context, document, values, drawing, flight, step, release, $: document.getElementById, emit, flush, profile: () => club.safeProfile(values.get(club.SAVE_KEY)) };
}
module.exports = { harness, flush };
