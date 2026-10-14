import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// A minimal DOM adapter executes the production app and real renderer in Node.
// It verifies state/input behavior, not browser layout or browser compatibility.
class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.id = attrs.id; this.children = []; this.parent = null; this.listeners = {};
    this.dataset = {}; for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5)] = value;
    this.hidden = 'hidden' in attrs; this.checked = 'checked' in attrs; this.disabled = false; this.inert = false; this.style = {}; this.value = attrs.value || ''; this.textContent = ''; this.tabIndex = Number(attrs.tabindex ?? 0);
    const classes = new Set((attrs.class || '').split(' ')); this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle: (x, force) => { const add = force ?? !classes.has(x); if (add) classes.add(x); else classes.delete(x); return add; } };
  }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim()));
    const match = selector.match(/^([a-z]+)?(?:\[([^=\]]+)(?:="?([^"\]]+)"?)?\])?$/i); if (!match) return false;
    return (!match[1] || this.tagName.toLowerCase() === match[1]) && (!match[2] || (match[2] === 'open' ? this.open : match[2] in this.attrs) && (!match[3] || this.attrs[match[2]] === match[3]));
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  contains(other) { return this === other || this.children.some(child => child.contains(other)); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  emit(type, data = {}) { const event = { target: this, preventDefault() { this.prevented = true; }, ...data }; for (const callback of this.listeners[type] || []) callback(event); return event; }
  focus() { globalThis.document.activeElement = this; }
  getBoundingClientRect() { return { width: view.w, height: view.h, top: 0, left: 0, bottom: view.h, right: view.w }; }
  showModal() { this.open = true; this.focus(); }
  close() { this.open = false; this.emit('close'); }
  getContext() { const gradient = () => ({ addColorStop() {} }); return new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient }, { get: (o, k) => k in o ? o[k] : () => {} }); }
  get offsetWidth() { return 100; }
}
let view, now, nextFrame, saved, globalListeners;
function setup(blocked = false, initial = null) {
  view = { w: 1440, h: 900 }; now = 0; nextFrame = null; saved = new Map(initial ? [['apirak-flappy2-v1', initial]] : []); globalListeners = {};
  const body = new Element('document'), stack = [body];
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<\/?[a-z][^>]*>/gi)) {
    const token = match[0], tag = token.match(/^<\/?([a-z0-9-]+)/i)[1].toLowerCase();
    if (token.startsWith('</')) { const i = stack.findLastIndex(e => e.tagName.toLowerCase() === tag); if (i > 0) stack.splice(i); continue; }
    const attrs = {}; const attrText = token.slice(token.indexOf(tag) + tag.length, token.length - 1);
    for (const a of attrText.matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? '';
    const e = new Element(tag, attrs); e.parent = stack.at(-1); e.parent.children.push(e);
    if (!token.endsWith('/>') && !['meta', 'link', 'input', 'br', 'hr', 'img', 'use'].includes(tag)) stack.push(e);
  }
  const all = body.querySelectorAll('html')[0];
  const doc = { documentElement: all, hidden: false, activeElement: body, fullscreenElement: null,
    getElementById(id) { const search = e => e.id === id ? e : e.children.map(search).find(Boolean); return search(body) || null; },
    querySelectorAll(s) { return body.querySelectorAll(s); }, querySelector(s) { return this.querySelectorAll(s)[0] || null; },
    addEventListener(type, fn) { (globalListeners[`doc:${type}`] ||= []).push(fn); } };
  const win = { devicePixelRatio: 1, addEventListener(type, fn) { (globalListeners[type] ||= []).push(fn); }, visualViewport: { addEventListener() {} } };
  Object.assign(globalThis, { document: doc, window: win, matchMedia: () => ({ matches: false }), localStorage: { getItem: key => { if (blocked) throw Error('blocked'); return saved.get(key) || null; }, setItem: (key, value) => { if (blocked) throw Error('blocked'); saved.set(key, value); } }, requestAnimationFrame: fn => { nextFrame = fn; }, location: { reload() {} } });
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
  return id => doc.getElementById(id);
}
function key(code, target, extra = {}) { const e = { code, key: code, target, preventDefault() { this.prevented = true; }, ...extra }; for (const fn of globalListeners['doc:keydown'] || []) fn(e); return e; }
function advance(seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) { now += 1000 / 60; const frame = nextFrame; nextFrame = null; frame?.(now); } }
function dispatch(type) { for (const fn of globalListeners[type] || []) fn({}); }
test('production app: world selection, touch flight, pause/countdown cancellation, retry, focus, and saves', async () => {
  const $ = setup(); await import(`../app.mjs?dom=${Date.now()}`);
  assert.equal($('fatal').hidden, true); assert.equal(document.documentElement.dataset.screen, 'menu'); assert.equal(document.documentElement.dataset.mode, 'moon');
  const choices = document.querySelectorAll('[data-choice]'); choices[2].emit('click'); assert.equal(document.documentElement.dataset.mode, 'hell'); assert.equal($('launchText').textContent, 'Descend into Hell');
  choices[2].emit('keydown', { key: 'ArrowRight' }); assert.equal(document.documentElement.dataset.mode, 'moon'); assert.equal(choices[0].getAttribute('aria-checked'), 'true');
  $('help').emit('click'); assert.equal($('helpDialog').open, true); $('helpDialog').close();
  $('settings').emit('click'); $('motionSetting').checked = true; $('motionSetting').emit('change'); assert.equal(document.documentElement.dataset.motion, 'reduce'); $('settingsDialog').close();
  $('launch').emit('click'); assert.equal(document.documentElement.dataset.screen, 'ready');
  $('world').emit('pointerdown', { pointerType: 'touch', button: 0 }); assert.equal(document.documentElement.dataset.screen, 'playing'); advance(.18);
  key('KeyP', $('world')); assert.equal(document.documentElement.dataset.screen, 'paused'); assert.equal($('topbar').inert, true);
  assert.equal(JSON.parse(saved.get('apirak-flappy2-v1')).records.moon.deaths, 0, 'pause is not a death');
  const time = $('runTime').textContent; advance(.2); assert.equal($('runTime').textContent, time);
  $('resume').emit('click'); assert.equal($('countdown').hidden, false); key('KeyP', $('world')); assert.equal($('countdown').hidden, true); assert.equal($('pausePanel').hidden, false, 'cancelled countdown restores pause controls');
  $('resume').emit('click'); advance(1.0); assert.equal(document.documentElement.dataset.screen, 'playing');
  dispatch('blur'); assert.equal(document.documentElement.dataset.screen, 'paused');
  view = { w: 844, h: 390 }; dispatch('resize'); assert.equal($('world').width, 844); assert.equal($('world').height, 390);
  $('resume').emit('click'); advance(.9); advance(5); assert.equal(document.documentElement.dataset.screen, 'dead'); assert.equal($('retry').disabled, false);
  assert.equal($('topbar').inert, true); $('resultMenu').focus(); const tab = key('Tab', $('resultMenu')); assert.equal(tab.prevented, true); assert.equal(document.activeElement, $('retry'));
  const record = JSON.parse(saved.get('apirak-flappy2-v1')); assert.equal(record.records.moon.runs, 1); assert.ok(record.records.moon.time > 0); assert.equal(record.records.hell.runs, 0); assert.equal(record.records.moon.deaths, 1); assert.equal(Number($('finalDeaths').textContent), 1);
  advance(1); assert.equal(JSON.parse(saved.get('apirak-flappy2-v1')).records.moon.deaths, 1, 'one death is counted only once');
  key('KeyR', $('retry')); assert.equal(document.documentElement.dataset.screen, 'ready'); assert.equal($('score').textContent, 0);
  $('home').emit('click'); assert.equal(document.documentElement.dataset.screen, 'menu'); assert.equal($('topbar').inert, false);
  assert.equal(Number($('menuDeaths').textContent), 1); assert.equal(Number($('totalDeaths').textContent), 1);
  $('launch').emit('click'); $('home').emit('click');
  $('launch').emit('click'); $('world').emit('pointerdown', { pointerType: 'touch' }); advance(.1); $('home').emit('click');
  assert.equal(JSON.parse(saved.get('apirak-flappy2-v1')).records.moon.deaths, 1, 'leaving ready or active flight is not a death');
  choices[2].emit('click'); assert.equal(Number($('menuDeaths').textContent), 0); assert.equal(Number($('totalDeaths').textContent), 1);
  $('launch').emit('click'); $('world').emit('pointerdown', { pointerType: 'touch' }); advance(4);
  assert.equal(document.documentElement.dataset.screen, 'dead'); assert.equal(Number($('finalDeaths').textContent), 1);
  $('resultMenu').emit('click'); assert.equal(Number($('menuDeaths').textContent), 1); assert.equal(Number($('totalDeaths').textContent), 2);
  const persisted = saved.get('apirak-flappy2-v1'), afterReload = setup(false, persisted);
  await import(`../app.mjs?reload=${Date.now()}`);
  assert.equal(document.documentElement.dataset.mode, 'hell'); assert.equal(Number(afterReload('menuDeaths').textContent), 1); assert.equal(Number(afterReload('totalDeaths').textContent), 2);
});
test('blocked storage and unavailable audio cannot prevent game startup or flight', async () => {
  const $ = setup(true); await import(`../app.mjs?blocked=${Date.now()}`); assert.equal($('fatal').hidden, true); assert.equal($('saveNotice').textContent, 'This visit only');
  $('sound').emit('click'); $('launch').emit('click'); $('world').emit('pointerdown', { pointerType: 'touch' }); advance(.2); assert.equal(document.documentElement.dataset.screen, 'playing'); advance(4); assert.equal(Number($('finalDeaths').textContent),1); $('resultMenu').emit('click'); assert.equal(Number($('totalDeaths').textContent),1);
});
