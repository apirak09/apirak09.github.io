(function (root) {
  'use strict';
  // Cosmetics and progression deliberately have no dependency on Flight or its physics.
  const SAVE_KEY = 'flappy-bird-sky-club-profile-v1';
  const MAX = 999999999;
  const MODES = ['easy', 'normal', 'hard', 'nightmare'];
  const SKINS = Object.freeze([
    { id: 'classic', name: 'Sky Club Original', price: 0, category: 'classic', label: 'THE ORIGINAL', color: '#ffdc45', description: 'The little yellow bird that started it all. Always yours.', src: 'assets/bird.png' },
    { id: 'mint', name: 'Mint Breeze', price: 100, category: 'colors', label: 'FRESH FEATHERS', color: '#63d5aa', description: 'Soft mint feathers, an ivory belly, and forest-green wing tips.' },
    { id: 'rose', name: 'Rose Finch', price: 100, category: 'colors', label: 'FRESH FEATHERS', color: '#f795b2', description: 'Rose-pink plumage with a peach belly and raspberry feather tips.' },
    { id: 'ice', name: 'Bluebird', price: 100, category: 'colors', label: 'FRESH FEATHERS', color: '#78caff', description: 'Clear blue feathers, a frosty white belly, and cobalt accents.' },
    { id: 'prism', name: 'Rainbow Prism', price: 250, category: 'glow', label: 'AFTERGLOW', color: '#ba8cff', description: 'A full-spectrum coat, opal wing feathers, and tiny star-cut highlights.' },
    { id: 'aurora', name: 'Aurora', price: 250, category: 'glow', label: 'AFTERGLOW', color: '#62e8cd', description: 'An emerald-to-violet aurora with luminous feather lines and a crescent crest.' },
    { id: 'neon', name: 'Neon Pulse', price: 250, category: 'glow', label: 'AFTERGLOW', color: '#df73ff', description: 'Midnight plumage edged in electric cyan, hot pink, and violet light.' },
    { id: 'batman', name: 'Batman', price: 500, category: 'heroes', label: 'HERO COLLECTION', color: '#788aa5', description: 'Pointed cowl, scalloped cape, gold utility belt, and the iconic bat emblem.' },
    { id: 'spiderman', name: 'Spider-Man', price: 500, category: 'heroes', label: 'HERO COLLECTION', color: '#f46976', description: 'Red-and-blue suit, hand-drawn web panels, white mask lenses, and a spider crest.' },
    { id: 'superman', name: 'Superman', price: 750, category: 'heroes', label: 'HERO COLLECTION', color: '#5eabf0', description: 'Royal-blue suit, layered scarlet cape, gold belt, and a raised shield emblem.' },
    { id: 'captain', name: 'Captain America', price: 750, category: 'heroes', label: 'HERO COLLECTION', color: '#729de3', description: 'Winged A helmet, panelled blue suit, chest star, and a ringed vibranium-style shield.' },
    { id: 'ironman', name: 'Iron Man', price: 1000, category: 'heroes', label: 'HERO COLLECTION · DELUXE', color: '#edba60', description: 'Layered red-and-gold armor, etched faceplate, cyan eye slit, arc reactor, and repulsor wing.' },
    { id: 'thor', name: 'Thor', price: 1000, category: 'heroes', label: 'HERO COLLECTION · DELUXE', color: '#b4cced', description: 'Engraved winged helmet, silver armor discs, crimson cape, Mjölnir, and fine lightning filaments.' },
    { id: 'panther', name: 'Black Panther', price: 1000, category: 'heroes', label: 'HERO COLLECTION · DELUXE', color: '#b188ef', description: 'Sculpted black mask, silver fang collar, etched suit panels, and violet kinetic seams.' },
    { id: 'strange', name: 'Doctor Strange', price: 1000, category: 'heroes', label: 'HERO COLLECTION · DELUXE', color: '#e8a877', description: 'Embroidered levitation cloak, layered blue tunic, Eye of Agamotto, and a detailed spell-ring wing.' }
  ].map(skin => Object.freeze({ ...skin, src: skin.src || `assets/skins/${skin.id}.svg` })));
  const SKIN_BY_ID = Object.freeze(Object.fromEntries(SKINS.map(skin => [skin.id, skin])));
  const number = value => Number.isSafeInteger(value) ? Math.max(0, Math.min(MAX, value)) : 0;

  function safeProfile(raw, legacyRuns = {}) {
    let input = {};
    try { input = typeof raw === 'string' ? JSON.parse(raw) : raw || {}; } catch (_) {}
    if (!input || typeof input !== 'object') input = {};
    const owned = ['classic', ...new Set((Array.isArray(input.owned) ? input.owned : []).filter(id => id !== 'classic' && Object.prototype.hasOwnProperty.call(SKIN_BY_ID, id)))];
    const deaths = Object.fromEntries(MODES.map(mode => [mode, Math.max(number(input.deaths?.[mode]), number(legacyRuns?.[mode]))]));
    const coins = number(input.coins);
    return {
      version: 1, coins, earned: Math.max(coins, number(input.earned)), owned,
      equipped: owned.includes(input.equipped) ? input.equipped : 'classic', deaths,
      completed: [...new Set((Array.isArray(input.completed) ? input.completed : []).filter(id => typeof id === 'string' && id.length > 0 && id.length <= 96))].slice(-64)
    };
  }
  function completeRun(profile, run) {
    const next = safeProfile(profile);
    if (!run || typeof run.id !== 'string' || !run.id || run.id.length > 96 || !MODES.includes(run.mode) || !Number.isSafeInteger(run.score) || run.score < 0 || run.score > 999999) return { ok: false, reason: 'invalid', profile: next, earned: 0 };
    if (next.completed.includes(run.id)) return { ok: true, duplicate: true, profile: next, earned: 0 };
    next.coins = Math.min(MAX, next.coins + run.score);
    next.earned = Math.min(MAX, next.earned + run.score);
    next.deaths[run.mode] = Math.min(MAX, next.deaths[run.mode] + 1);
    next.completed = [...next.completed, run.id].slice(-64);
    return { ok: true, profile: next, earned: run.score };
  }
  function purchase(profile, id) {
    const next = safeProfile(profile), skin = Object.prototype.hasOwnProperty.call(SKIN_BY_ID, id) && SKIN_BY_ID[id];
    if (!skin) return { ok: false, reason: 'unknown', profile: next };
    if (!next.owned.includes(id)) {
      if (next.coins < skin.price) return { ok: false, reason: 'insufficient', profile: next };
      next.coins -= skin.price; next.owned.push(id);
    }
    next.equipped = id;
    return { ok: true, profile: next };
  }
  function equip(profile, id) {
    const next = safeProfile(profile);
    if (!next.owned.includes(id)) return { ok: false, reason: 'locked', profile: next };
    next.equipped = id; return { ok: true, profile: next };
  }
  class ProfileStore {
    constructor({ storage = null, locks = null, legacyRuns = {}, onStorageError = () => {} } = {}) {
      this.storage = storage; this.locks = locks; this.legacyRuns = { ...legacyRuns }; this.onStorageError = onStorageError;
      this.canSave = !!storage; this.memory = safeProfile(null, legacyRuns); this.queue = Promise.resolve();
    }
    read() {
      try {
        const raw = this.storage?.getItem(SAVE_KEY);
        if (raw !== null && raw !== undefined) this.memory = safeProfile(raw, this.legacyRuns);
      } catch (_) { this.canSave = false; this.storage = null; this.onStorageError(); }
      return safeProfile(this.memory, this.legacyRuns);
    }
    transact(operation) {
      const commit = () => {
        const result = operation(this.read());
        if (result.ok) {
          this.memory = result.profile;
          try {
            if (!this.storage) throw new Error('Storage unavailable');
            this.storage.setItem(SAVE_KEY, JSON.stringify(this.memory)); this.canSave = true;
          } catch (_) { this.canSave = false; this.storage = null; this.onStorageError(); }
        }
        return result;
      };
      // Web Locks serialize wallet changes across tabs. The local queue also covers
      // rapid double taps and browsers without Web Locks.
      const task = async () => {
        if (this.locks?.request) { try { return await this.locks.request(SAVE_KEY, commit); } catch (_) { /* Lock API may be blocked. */ } }
        return commit();
      };
      const result = this.queue.then(task, task); this.queue = result.catch(() => {}); return result;
    }
    complete(run) { return this.transact(profile => completeRun(profile, run)); }
    buy(id) { return this.transact(profile => purchase(profile, id)); }
    equip(id) { return this.transact(profile => equip(profile, id)); }
  }
  const api = { SKINS, SKIN_BY_ID, SAVE_KEY, MODES, safeProfile, completeRun, purchase, equip, ProfileStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlappyClub = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
