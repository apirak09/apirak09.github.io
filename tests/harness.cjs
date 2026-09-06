// Runs the real bundled Matter.js and game code. Only browser presentation APIs
// are stubbed; shots, collisions, damage, clocks and turn flow are production code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function createGame({ seed = 42, saved = null } = {}) {
  let now = 1000;
  let timerId = 0;
  const timers = new Map();
  const elements = new Map();
  const storage = new Map(saved ? [['mini-angry-birds-reforged-save-v1', JSON.stringify(saved)]] : []);
  const context = new Proxy({}, { get: (target, key) => key in target ? target[key] : () => context, set: (t, k, v) => (t[k] = v, true) });
  const makeElement = (id = '') => {
    const classes = new Set(/Overlay$/.test(id) && id !== 'introOverlay' ? ['hidden'] : []);
    const listeners = new Map();
    const element = {
      id, style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', disabled: false,
      tagName: id === 'game' ? 'CANVAS' : 'BUTTON',
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: n => classes.has(n),
        toggle: (n, force) => { const on = force ?? !classes.has(n); on ? classes.add(n) : classes.delete(n); return on; }
      },
      getContext: () => context,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
      appendChild: child => element.children.push(child),
      setAttribute: (k, v) => { element[k] = v; },
      removeAttribute: k => delete element[k],
      getAttribute: k => element[k],
      addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
      dispatch: (name, data = {}) => (listeners.get(name) || []).forEach(fn => fn({ target: element, preventDefault() {}, ...data })),
      setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true,
      focus() { document.activeElement = element; },
      querySelectorAll: () => [], contains: target => target === element,
      closest: () => null
    };
    return element;
  };
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
    createElement: makeElement,
    addEventListener() {}, hidden: false, activeElement: null,
    querySelectorAll: () => [], documentElement: { style: {} }
  };
  let raf;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const window = makeElement('window');
  Object.assign(window, { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 900, location: { search: '?debug=1' }, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  const sandbox = vm.createContext({
    window, document, Math: math, console, URLSearchParams,
    performance: { now: () => now },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    requestAnimationFrame: fn => { raf = fn; },
    setTimeout: (fn, delay = 0) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  for (const file of ['src/vendor/matter.min.js', 'src/levels.js', 'src/game.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  }
  const game = window.__GAME_DEBUG__;
  elements.get('introSkipBtn').dispatch('click');
  game.state.muted = true;
  const tickTimers = () => {
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  };
  function step(frames = 1) {
    for (let i = 0; i < frames; i++) {
      now += 1000 / 60;
      game.fixedUpdate();
      game.updateTurnFlow(game.state.simTime ?? now);
      tickTimers();
    }
  }
  function start(index) {
    game.state.save.unlocked = game.levels.length;
    game.startLevel(index);
  }
  function shot(angle, power = 1) {
    const canvas = elements.get('game');
    const radians = angle * Math.PI / 180;
    canvas.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 188, clientY: 526 });
    canvas.dispatch('pointermove', { pointerId: 1, clientX: 188 - Math.cos(radians) * 138 * power, clientY: 526 + Math.sin(radians) * 138 * power });
    canvas.dispatch('pointerup', { pointerId: 1 });
  }
  function playShot(angle, power = 1, abilityFrame = null, maxFrames = 1080) {
    shot(angle, power);
    let frames = 0;
    for (; frames < maxFrames; frames++) {
      if (frames === abilityFrame) game.useAbility();
      step();
      if (['ready', 'won', 'lost'].includes(game.state.mode)) break;
    }
    return { frames, mode: game.state.mode, pigs: game.pigs.length, blocks: game.blocks.length };
  }
  return { game, start, step, shot, playShot, elements, window, storage, sandbox,
    wallTime(ms) { now += ms; tickTimers(); },
    frame() { now += 1000 / 60; raf(now); tickTimers(); }
  };
}
module.exports = { createGame };
