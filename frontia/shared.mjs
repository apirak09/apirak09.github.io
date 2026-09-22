// The browser and backend share the save contract. No credentials belong here.
export const EPISODE_IDS = ['ep-midnight', 'ep-summer', 'ep-orbit', 'ep-house'];
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const MAX_INPUT = 4000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error('ข้อมูลข้อความไม่ถูกต้องหรือยาวเกินกำหนด');
  }
  return value;
};
export const newId = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);

export function validateScene(value) {
  if (!object(value) || !Array.isArray(value.choices) || value.choices.length > 4) {
    throw new Error('รูปแบบฉากไม่ถูกต้อง');
  }
  const choices = value.choices.map((choice, i) => {
    if (!object(choice)) throw new Error('รูปแบบตัวเลือกไม่ถูกต้อง');
    return { id: `c${i + 1}`, label: text(choice.label, 500, true) };
  });
  return {
    id: text(value.id || 'scene', 160, true),
    chapter: text(value.chapter || 'ฉากถัดไป', 200),
    location: text(value.location || '', 300),
    speaker: value.speaker == null ? null : text(value.speaker, 200),
    body: text(value.body, 16000, true), choices,
  };
}

export function validateSave(value) {
  if (!object(value) || value.version !== 2 || !object(value.stories)) {
    throw new Error('ไม่รองรับรูปแบบไฟล์บันทึกนี้');
  }
  const stories = {};
  for (const [id, story] of Object.entries(value.stories)) {
    if (!EPISODE_IDS.includes(id) || !object(story)) throw new Error('ไม่พบเรื่องที่ระบุในไฟล์บันทึก');
    const revision = text(story.revision, 160, true);
    if (!Number.isFinite(story.updatedAt) || story.updatedAt < 0) throw new Error('เวลาบันทึกไม่ถูกต้อง');
    if (story.deleted === true) {
      stories[id] = { revision, updatedAt: story.updatedAt, deleted: true };
      continue;
    }
    if (!Array.isArray(story.history) || story.history.length > 1500) throw new Error('ประวัติเรื่องไม่ถูกต้องหรือเกิน 1,500 ฉาก');
    stories[id] = {
      revision, updatedAt: story.updatedAt, scene: validateScene(story.scene),
      memory: text(story.memory || '', 8000),
      history: story.history.map(entry => {
        if (!object(entry)) throw new Error('ประวัติฉากไม่ถูกต้อง');
        return {
          id: text(entry.id, 160, true), player: text(entry.player || '', MAX_INPUT),
          scene: validateScene(entry.scene), source: entry.source === 'ai' ? 'ai' : 'demo',
          createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : story.updatedAt,
        };
      }),
    };
  }
  return { version: 2, stories };
}

export const revisions = save => Object.fromEntries(Object.entries(save.stories).map(([id, s]) => [id, s.revision]));
export function sameSave(a, b) {
  return EPISODE_IDS.every(id => a.stories[id]?.revision === b.stories[id]?.revision);
}

// Three-way merge uses revisions, never device clocks. A tombstone is an edit.
export function mergeSaves(local, remote, base = {}) {
  const stories = {};
  const conflicts = [];
  for (const id of EPISODE_IDS) {
    const l = local.stories[id], r = remote.stories[id], ancestor = base[id];
    if (l?.revision === r?.revision) { if (l) stories[id] = clone(l); }
    else if (l?.revision === ancestor) { if (r) stories[id] = clone(r); }
    else if (r?.revision === ancestor) { if (l) stories[id] = clone(l); }
    else if (!l) { stories[id] = clone(r); }
    else if (!r) { stories[id] = clone(l); }
    else { conflicts.push(id); stories[id] = clone(l); }
  }
  return { save: { version: 2, stories }, conflicts };
}

// v4/v5 stored just one scene, even when multiple stories had progress.
// Preserve that recoverable scene; never assign it to all the other stories.
export function migrateLegacy(value) {
  if (!object(value)) throw new Error('ข้อมูลบันทึกเดิมไม่ถูกต้อง');
  if (value.version === 2) return validateSave(value);
  const id = value.episodeId;
  const stories = {};
  if (EPISODE_IDS.includes(id) && value.scene) {
    const scene = validateScene(value.scene);
    const updatedAt = Number(value.updatedAt || value.progressUpdatedAt || 0);
    if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error('เวลาบันทึกเดิมไม่ถูกต้อง');
    const history = (Array.isArray(value.recent) ? value.recent : []).map((entry, index) => ({
      id: `legacy-${index}`, player: text(entry.player || '', MAX_INPUT),
      scene: validateScene({ ...scene, id: `legacy-${index}`, body: entry.scene, choices: [] }),
      createdAt: updatedAt, source: 'ai',
    }));
    if (!history.length || history.at(-1).scene.body !== scene.body) {
      history.push({ id: 'legacy-current', player: '', scene, createdAt: updatedAt, source: 'ai' });
    } else history.at(-1).scene = scene;
    // Stable across browser/server migration, but different for different content
    // even when old devices wrote identical timestamps (or had no timestamp).
    let fingerprint = 14695981039346656037n;
    for (const char of JSON.stringify({ scene, history })) fingerprint = BigInt.asUintN(64, (fingerprint ^ BigInt(char.codePointAt(0))) * 1099511628211n);
    stories[id] = { revision: `legacy-${id}-${updatedAt}-${fingerprint.toString(16)}`, updatedAt, scene, history, memory: '' };
  }
  return validateSave({ version: 2, stories });
}

export function normalizeBackendUrl(input, pageProtocol = 'https:') {
  if (!input.trim()) return '';
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('กรุณาใส่ Backend URL ให้ครบ เช่น https://example.com'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && pageProtocol === 'http:'))) {
    throw new Error('Backend ต้องใช้ HTTPS และไม่มีรหัสผ่านหรือ query ใน URL');
  }
  return url.href.replace(/\/+$/, '');
}
