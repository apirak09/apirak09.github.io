import { ACTIVE_EPISODE, applyEffects, clone, EPISODE_IDS, MAX_INPUT, MAX_SAVE_BYTES, mergeSaves, migrateLegacy, newId, normalizeBackendUrl, revisions, sameSave, validateSave, validateScene } from './shared.mjs';
import { CAST, CLUE_NAMES, demoScene, EPISODES, episodeContext, PLACE_NAMES, startStory } from './stories.mjs';
import { AppStorage, StorageConflict } from './storage.mjs';
import { SaveSync } from './sync.mjs';
import { dateText, esc, renderView, sheet } from './ui.mjs';

const APP = document.getElementById('app');
const DIALOG = document.getElementById('dialog');
const storage = new AppStorage();
const PASSWORD_KEY = 'cinematic-backend-password';
let record, pendingRecord, password = '', remember = false;
let auth = null, models = [], message = '', busy = null, conflict = null;
let sync, syncTimer, retryDelay = 3000, cloud = 'บันทึกในเครื่องแล้ว';
let storageProblem = false, mutationQueue = Promise.resolve(), writes = 0;
let draftTimer, draftDirty = false, draftCache = {};
let loginSession = null, loginTimer, connecting = false, dialogReturnFocus, installPrompt, registration, updateReady = false;
let renderedStoryRevision = '';
let reviewBeatIndex = null;
let uiHidden = false, autoPlay = false, autoTimer;
const channel = (() => {
  try { return typeof BroadcastChannel === 'function' ? new BroadcastChannel('cinematic-play') : null; }
  catch { return null; }
})();

const storyId = () => route().split('/')[1];
function route() {
  const value = location.hash.slice(1) || 'home';
  const [view, id] = value.split('/');
  return ['home', 'chat', 'play', 'settings'].includes(value) || (['episode', 'player'].includes(view) && EPISODE_IDS.includes(id)) ? value : 'home';
}
function render() {
  if (!record) return;
  const active = document.activeElement;
  const editing = active?.id === 'freeText';
  const selection = editing ? [active.selectionStart, active.selectionEnd] : null;
  APP.innerHTML = renderView({ record: { ...record, drafts: { ...record.drafts, ...draftCache } }, route: route(), reviewBeatIndex, uiHidden, autoPlay, busy: !!busy, auth, models: [...models], cloud, message, remember, conflict, updateReady, offline: !navigator.onLine });
  const pw = document.getElementById('appPassword');
  if (pw) pw.value = password;
  if (editing && document.getElementById('freeText')) {
    const field = document.getElementById('freeText');
    field.focus({ preventScroll: true }); field.setSelectionRange(...selection);
  }
  renderedStoryRevision = record.save.stories[storyId()]?.revision || '';
  document.title = EPISODES[storyId()] ? `${EPISODES[storyId()].title} · Cinematic Play` : 'Cinematic Play';
  scheduleAutoPlay();
}
function scheduleAutoPlay() {
  clearTimeout(autoTimer);
  if (!autoPlay || uiHidden || busy || storageProblem || DIALOG.open || document.hidden || !route().startsWith('player/') || reviewBeatIndex !== null) return;
  const story = record.save.stories[storyId()];
  if (!story || story.deleted || storyId() !== ACTIVE_EPISODE) return;
  const index = story.beatIndex ?? 0, beats = story.scene.beats;
  if (!beats || index >= beats.length - 1) return; // Wait for the reader to choose; never select a response automatically.
  const delay = Math.min(9000, Math.max(2700, (beats[index].text?.length || 0) * 45));
  autoTimer = setTimeout(() => { void action('next-beat').catch(error => notify(error.message)); }, delay);
}
function notify(text) { message = text; render(); }
function paintStatus() { document.querySelectorAll('[data-save-status]').forEach(el => { el.textContent = cloud; }); }
function go(next) {
  if (busy) busy.controller.abort();
  reviewBeatIndex = null; uiHidden = false; autoPlay = false; clearTimeout(autoTimer);
  void flushDraft().catch(() => {}); closeDialog();
  if (location.hash === `#${next}`) { render(); return; }
  location.hash = next;
}
window.addEventListener('hashchange', () => {
  if (busy) busy.controller.abort();
  reviewBeatIndex = null; uiHidden = false; autoPlay = false; clearTimeout(autoTimer);
  closeDialog(); render(); window.scrollTo({ top: 0 });
  document.getElementById('main')?.focus({ preventScroll: true });
});

function change(mutator) {
  writes++;
  const task = mutationQueue.catch(() => {}).then(async () => {
    if (storageProblem) throw new Error('ยังบันทึกลงเครื่องไม่ได้ กรุณาสำรองหรือโหลดเซฟล่าสุด');
    const candidate = clone(record);
    if (mutator(candidate) === false) return;
    const storyChanged = !sameSave(candidate.save, record.save);
    try { record = await storage.commit(candidate); }
    catch (error) { pendingRecord = candidate; handleStorageError(error); throw error; }
    channel?.postMessage({ writeId: record.writeId });
    if (storyChanged && sync?.active && !conflict) { cloud = 'บันทึกในเครื่องแล้ว · รอซิงก์'; paintStatus(); }
  }).finally(() => { writes--; });
  mutationQueue = task; return task;
}
function handleStorageError(error) {
  storageProblem = true; sync?.stop(); cloud = 'ยังบันทึกในเครื่องไม่สำเร็จ';
  message = error instanceof StorageConflict ? error.message : 'บันทึกลงเครื่องไม่สำเร็จ อาจเป็นเพราะพื้นที่เต็มหรือเบราว์เซอร์ไม่อนุญาต ข้อมูลที่ยังไม่บันทึกยังอยู่ในแท็บนี้';
  render();
  openDialog('ข้อมูลยังไม่ถูกบันทึก', `<p class="sub">${esc(message)}</p><div class="btnrow"><button class="btn primary" data-action="export">สำรองข้อมูลแท็บนี้</button><button class="btn" data-action="reload-storage">โหลดเซฟล่าสุด</button></div>`);
}
async function flushDraft() {
  clearTimeout(draftTimer);
  if (!draftDirty || !record) return;
  const drafts = { ...draftCache }; draftDirty = false;
  try { await change(r => { Object.assign(r.drafts, drafts); }); }
  catch (error) { draftDirty = true; throw error; }
}

async function request(endpoint, data = {}, { signal, timeout = 20000, connection } = {}) {
  const target = connection || { url: record.settings.backendUrl, password };
  if (!target.url || !target.password) throw new Error('กรุณาบันทึก Backend URL และรหัสผ่านก่อน');
  const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(target.url + endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-app-password': target.password },
      body: JSON.stringify(data), signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    let result;
    try { result = await response.json(); } catch { throw new Error(`Backend ส่งข้อมูลที่อ่านไม่ได้ (HTTP ${response.status})`); }
    if (!response.ok) { const error = new Error(result.message || `Backend ตอบกลับ HTTP ${response.status}`); error.status = response.status; throw error; }
    return result;
  } catch (error) {
    if (timedOut) throw new Error('Backend ใช้เวลานานเกินไป ข้อมูลเดิมยังอยู่ ลองอีกครั้งเมื่อเซิร์ฟเวอร์พร้อม');
    if (error.name === 'TypeError') throw new Error('ติดต่อ Backend ไม่ได้ ตรวจอินเทอร์เน็ต URL, HTTPS และการตั้งค่าเซิร์ฟเวอร์');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function setupSync() {
  sync?.stop(); clearTimeout(syncTimer); conflict = null;
  if (!record.settings.backendUrl || !password) { cloud = 'บันทึกในเครื่องแล้ว'; paintStatus(); return; }
  const connection = { url: record.settings.backendUrl, password };
  sync = new SaveSync({
    getState: () => record, updateState: change, request: (endpoint, data) => request(endpoint, data, { connection }),
    blocked: () => !!busy || !!conflict || storageProblem,
    onConflict: value => { conflict = value; render(); },
    onStatus: (status, detail) => {
      cloud = ({ syncing: 'กำลังซิงก์…', synced: 'บันทึกในเครื่องและคลาวด์แล้ว', pending: 'บันทึกในเครื่องแล้ว · รอซิงก์', conflict: 'มีเซฟต่างกัน · กรุณาเลือกในตั้งค่า', error: `บันทึกในเครื่องแล้ว · ${detail}` })[status];
      paintStatus();
      if (status === 'synced') retryDelay = 3000;
      if (['pending', 'error'].includes(status)) { scheduleSync(retryDelay); retryDelay = Math.min(60000, retryDelay * 2); }
      if (route().startsWith('player/') && renderedStoryRevision !== record.save.stories[storyId()]?.revision && !busy) { reviewBeatIndex = null; render(); }
    },
  });
  scheduleSync(200);
}
function scheduleSync(delay = 700) {
  clearTimeout(syncTimer);
  if (!sync?.active || conflict || storageProblem) return;
  syncTimer = setTimeout(() => { if (navigator.onLine) void sync.run().catch(() => {}); }, delay);
}

async function start(id = storyId(), talk = false) {
  if (!EPISODE_IDS.includes(id) || id !== ACTIVE_EPISODE && (!record.save.stories[id] || record.save.stories[id].deleted)) return;
  await change(r => { if (!r.save.stories[id] || r.save.stories[id].deleted) r.save.stories[id] = startStory(id); r.currentEpisodeId = id; });
  go(`player/${id}`); scheduleSync();
  if (talk) requestAnimationFrame(() => document.getElementById('freeText')?.focus());
}
async function advance(input) {
  if (busy || storageProblem) return;
  const id = storyId();
  if (id !== ACTIVE_EPISODE || !input?.trim()) return;
  input = input.trim();
  if (input.length > MAX_INPUT) throw new Error('ข้อความยาวเกิน 4,000 ตัวอักษร');
  await flushDraft();
  if (busy) return;
  const original = clone(record.save.stories[id]);
  if (!original || original.deleted) return;
  if ((original.beatIndex ?? 0) < (original.scene.beats?.length || 1) - 1) throw new Error('อ่านช่วงนี้ให้จบก่อนเลือกการกระทำ');
  if (original.history.length >= 1500) throw new Error('เรื่องนี้ครบขีดจำกัด 1,500 ฉากแล้ว กรุณาสำรองเซฟก่อนเริ่มเรื่องใหม่');
  const controller = new AbortController(), job = { controller, id };
  busy = job; message = ''; render();
  try {
    let scene, memory = original.memory, source = 'demo';
    if (record.settings.backendUrl) {
      const compatibility = await request('/api/save/get', {}, { signal: controller.signal });
      if (compatibility.features?.storyboard !== 1) throw new Error('กรุณาอัปเดต Backend เป็นรุ่น 0.7 ก่อนสร้างฉากภาพ');
      const status = await request('/api/auth/status', {}, { signal: controller.signal }); auth = status;
      if (!status.connected) throw new Error('ยังไม่ได้เชื่อม ChatGPT หรือการเชื่อมต่อหมดอายุ กรุณาเชื่อมใหม่ในตั้งค่า');
      const result = await request('/api/roleplay', {
        requestId: newId(), model: record.settings.model, episode: episodeContext(id), scene: original.scene,
        input, status: original.status, memory: original.memory, recent: original.history.slice(-12).map(entry => ({ player: entry.player, scene: entry.scene.body })),
      }, { signal: controller.signal, timeout: 150000 });
      scene = validateScene(result.scene);
      if (!scene.beats || scene.beats.length < 4 || !scene.effects) throw new Error('Backend ไม่ได้ส่งเรื่องแบบหลายช็อต กรุณาตรวจเวอร์ชัน Backend');
      memory = typeof result.memory === 'string' ? result.memory.slice(0, 8000) : memory; source = 'ai';
    } else {
      if (original.history.length >= 3) throw new Error('จบบทตัวอย่างแล้ว กรุณาตั้งค่า Backend เพื่อเล่นต่อกับ AI');
      scene = demoScene(id, original.history.length, input);
    }
    if (controller.signal.aborted) return;
    const now = Date.now();
    await change(r => {
      if (r.save.stories[id]?.revision !== original.revision) throw new Error('ฉากถูกเปลี่ยนระหว่างสร้างคำตอบ กรุณาลองใหม่');
      r.save.stories[id] = { ...original, scene, beatIndex: 0, status: original.status, memory, revision: newId(), updatedAt: now, history: [...original.history, { id: newId(), player: input, scene, source, createdAt: now }] };
      r.drafts[id] = '';
    });
    reviewBeatIndex = null;
    draftCache[id] = '';
  } catch (error) { if (!controller.signal.aborted) message = error.message; }
  finally {
    if (busy === job) busy = null;
    render(); scheduleSync();
    if (route() === `player/${id}`) window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function openDialog(title, content) {
  clearTimeout(autoTimer);
  dialogReturnFocus = document.activeElement;
  DIALOG.classList.toggle('journal-sheet', title === 'บทสนทนาที่อ่านแล้ว');
  DIALOG.classList.toggle('status-sheet', title === 'สถานะเรื่อง' || title === 'สถานที่ในเรื่อง');
  DIALOG.innerHTML = sheet(title, content);
  if (!DIALOG.open) DIALOG.showModal();
  DIALOG.querySelector('button')?.focus();
}
function closeDialog() {
  if (loginSession) {
    const session = loginSession; loginSession = null; clearTimeout(loginTimer);
    void request('/api/auth/chatgpt/cancel', { loginId: session.id }, { connection: session.connection }).catch(() => {});
  }
  if (DIALOG.open) DIALOG.close();
  if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({ preventScroll: true });
  scheduleAutoPlay();
}
DIALOG.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
DIALOG.addEventListener('click', event => { if (event.target === DIALOG) closeDialog(); });

async function saveSettings() {
  const field = document.getElementById('backendUrl'); if (!field) return;
  const url = normalizeBackendUrl(field.value, location.protocol);
  const newPassword = document.getElementById('appPassword').value, newRemember = document.getElementById('rememberPassword').checked;
  const model = document.getElementById('model').value;
  const connectionChanged = url !== record.settings.backendUrl || newPassword !== password;
  if (connectionChanged) { closeDialog(); sync?.stop(); clearTimeout(syncTimer); }
  if (newRemember) localStorage.setItem(PASSWORD_KEY, newPassword); else localStorage.removeItem(PASSWORD_KEY);
  sessionStorage.setItem(PASSWORD_KEY, newPassword);
  await change(r => {
    if (connectionChanged) r.sync = { endpoint: url, revision: null, base: {}, lastSync: 0 };
    r.settings = { backendUrl: url, model };
  });
  password = newPassword; remember = newRemember;
  if (connectionChanged) { auth = null; models = []; setupSync(); }
}
async function updateModels(catalog) {
  models = Array.isArray(catalog.models) ? catalog.models.filter(x => typeof x.model === 'string') : [];
  if (models.length && !models.some(x => x.model === record.settings.model)) {
    const available = models.find(x => x.isDefault) || models[0];
    await change(r => { r.settings.model = available.model; });
  }
}
async function testBackend() {
  await saveSettings();
  const compatibility = await request('/api/save/get');
  if (compatibility.features?.storyboard !== 1) throw new Error('Backend ต้องเป็นรุ่น 0.7 เพื่อเก็บฉากภาพและสถานะ');
  auth = await request('/api/auth/status');
  const catalog = await request('/api/models');
  await updateModels(catalog);
  message = auth.connected ? 'Backend และ ChatGPT พร้อมใช้งาน' : 'Backend พร้อมแล้ว กดเชื่อม ChatGPT เพื่อเริ่มเล่นกับ AI';
  render(); scheduleSync(0);
}
async function connect() {
  if (loginSession || connecting) return;
  connecting = true;
  try {
  await saveSettings();
  const connection = { url: record.settings.backendUrl, password };
  const result = await request('/api/auth/chatgpt/start', {}, { connection });
  if (route() !== 'settings' || connection.url !== record.settings.backendUrl || connection.password !== password) {
    if (result.loginId) await request('/api/auth/chatgpt/cancel', { loginId: result.loginId }, { connection }).catch(() => {});
    return;
  }
  let url;
  try { url = new URL(result.verificationUrl); } catch { throw new Error('Backend ไม่ได้ส่งลิงก์เข้าสู่ระบบที่ถูกต้อง'); }
  if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname) || url.username || url.password || typeof result.userCode !== 'string' || !result.loginId) throw new Error('ลิงก์เข้าสู่ระบบไม่ถูกต้อง');
  loginSession = { id: result.loginId, connection, expires: Date.now() + 10 * 60 * 1000 };
  openDialog('เชื่อมต่อ ChatGPT', `<p class="sub">เปิดหน้า OpenAI แล้วใส่รหัสครั้งเดียวนี้ รหัสบัญชีจะเก็บอยู่บน Backend ของคุณ</p><div class="code">${esc(result.userCode)}</div><a class="btn primary linkbtn" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">เปิดหน้าเข้าสู่ระบบ OpenAI</a><p class="hint" id="loginHint" role="status">กำลังรอการอนุญาต… ปิดหน้าต่างนี้เพื่อยกเลิก</p>`);
  const session = loginSession;
  const poll = async () => {
    if (loginSession !== session) return;
    if (Date.now() > session.expires) { closeDialog(); notify('หมดเวลารอเข้าสู่ระบบ กรุณาลองเชื่อมใหม่'); return; }
    try {
      const status = await request('/api/auth/status', { loginId: session.id }, { connection });
      if (loginSession !== session) return;
      if (status.login?.success === false) { closeDialog(); notify(status.login.error || 'เข้าสู่ระบบไม่สำเร็จ'); return; }
      if (status.connected && status.login?.success === true) {
        auth = status; loginSession = null; closeDialog();
        const catalog = await request('/api/models', {}, { connection }); await updateModels(catalog);
        notify('เชื่อม ChatGPT แล้ว'); scheduleSync(0); return;
      }
    } catch (error) { const hint = document.getElementById('loginHint'); if (hint) hint.textContent = error.message; }
    if (loginSession === session) loginTimer = setTimeout(poll, 2500);
  };
  loginTimer = setTimeout(poll, 1500);
  } finally { connecting = false; }
}

function exportSave() {
  const blob = new Blob([JSON.stringify({ app: 'Cinematic Play', exportedAt: new Date().toISOString(), save: pendingRecord?.save || record.save }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `cinematic-play-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function restore(save, label) {
  await flushDraft();
  save = validateSave(save); await storage.backup(record.save, label);
  await change(r => {
    for (const id of EPISODE_IDS) r.save.stories[id] = save.stories[id] ? { ...clone(save.stories[id]), revision: newId(), updatedAt: Date.now() } : { deleted: true, revision: newId(), updatedAt: Date.now() };
    r.drafts = {};
  });
  draftCache = {}; draftDirty = false; conflict = null; closeDialog(); render(); scheduleSync(0);
}
async function reset(id) {
  if (busy) return;
  if (!confirm(id ? `เริ่มเรื่อง “${EPISODES[id].title}” ใหม่? ระบบจะเก็บเซฟเดิมไว้ให้กู้คืน` : 'เริ่มทุกเรื่องใหม่? ระบบจะเก็บเซฟเดิมไว้ให้กู้คืน')) return;
  await flushDraft();
  await storage.backup(record.save, id ? `ก่อนเริ่ม ${EPISODES[id].title} ใหม่` : 'ก่อนเริ่มทุกเรื่องใหม่');
  await change(r => { for (const key of id ? [id] : EPISODE_IDS) { r.save.stories[key] = { deleted: true, revision: newId(), updatedAt: Date.now() }; delete r.drafts[key]; delete draftCache[key]; } });
  go(id ? `episode/${id}` : 'home'); scheduleSync(0);
}
function showConflicts() {
  if (!conflict) { notify('ยังไม่พบข้อมูลที่ชนกัน'); return; }
  openDialog('เลือกเซฟที่จะเล่นต่อ', `<p class="sub">เรื่องเดียวกันถูกแก้จากหลายอุปกรณ์ เลือกเวอร์ชันที่ต้องการ ระบบจะสำรองทั้งสองเวอร์ชันไว้ในเครื่องก่อนซิงก์</p><form id="conflictForm">${conflict.ids.map(id => {
    const summary = s => s?.deleted ? 'เริ่มใหม่แล้ว' : `${s?.history.length || 0} ฉาก · ${(s?.scene.body || '').slice(0, 100)}…`;
    return `<fieldset><legend>${esc(EPISODES[id].title)}</legend><label class="conflict-option"><input type="radio" name="${id}" value="local" checked><span>ในเครื่อง<br><small>${esc(summary(record.save.stories[id]))}</small></span></label><label class="conflict-option"><input type="radio" name="${id}" value="remote"><span>คลาวด์<br><small>${esc(summary(conflict.save.stories[id]))}</small></span></label></fieldset>`;
  }).join('')}<button class="btn primary wide" type="submit">เก็บเวอร์ชันที่เลือกและซิงก์</button></form>`);
}

async function action(name) {
  const id = storyId(), story = record.save.stories[id];
  if (name === 'start') return start();
  if (name === 'hide-ui') { uiHidden = true; render(); document.querySelector('[data-action="show-ui"]')?.focus({ preventScroll: true }); return; }
  if (name === 'show-ui') { uiHidden = false; render(); document.querySelector('[data-action="hide-ui"]')?.focus({ preventScroll: true }); return; }
  if (name === 'auto-play') { autoPlay = !autoPlay; render(); return; }
  if (name === 'previous-beat') {
    if (busy || id !== ACTIVE_EPISODE || !story || story.deleted) return;
    const visible = reviewBeatIndex ?? story.beatIndex ?? 0;
    if (visible > 0) { autoPlay = false; reviewBeatIndex = visible - 1; render(); document.querySelector('[data-action="next-beat"]')?.focus({ preventScroll: true }); }
    return;
  }
  if (name === 'next-beat') {
    if (busy || storageProblem || id !== ACTIVE_EPISODE || !story || story.deleted) return;
    if (reviewBeatIndex !== null && reviewBeatIndex < story.beatIndex) {
      reviewBeatIndex++;
      if (reviewBeatIndex === story.beatIndex) reviewBeatIndex = null;
      render(); document.querySelector('[data-action="next-beat"], .visual-dialogue')?.focus({ preventScroll: true });
      return;
    }
    if ((story.beatIndex ?? 0) >= (story.scene.beats?.length || 1) - 1) return;
    const revision = story.revision;
    await change(r => {
      const item = r.save.stories[id];
      if (item.revision !== revision) return false;
      item.beatIndex = (item.beatIndex ?? 0) + 1;
      if (item.beatIndex === item.scene.beats.length - 1) item.status = applyEffects(item.status, item.scene.effects);
      item.revision = newId(); item.updatedAt = Date.now();
    });
    render(); scheduleSync(); window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('[data-action="next-beat"], .visual-dialogue')?.focus({ preventScroll: true });
    return;
  }
  if (name === 'send') return advance(document.getElementById('freeText')?.value);
  if (name === 'cancel') { busy?.controller.abort(); return; }
  if (name === 'close-dialog') return closeDialog();
  if (name === 'dismiss-message') { message = ''; return render(); }
  if (name === 'dismiss-migration') { await change(r => { delete r.migrationNotice; }); return render(); }
  if (name === 'test-backend') return testBackend();
  if (name === 'connect') return connect();
  if (name === 'sync') { await saveSettings(); if (!record.settings.backendUrl || !password) throw new Error('กรุณาตั้งค่า Backend และรหัสผ่านก่อนซิงก์'); await sync.run(); render(); return; }
  if (name === 'forget-password') { password = ''; remember = false; localStorage.removeItem(PASSWORD_KEY); sessionStorage.removeItem(PASSWORD_KEY); auth = null; setupSync(); render(); return; }
  if (name === 'export') return exportSave();
  if (name === 'import') return document.getElementById('importFile').click();
  if (name === 'reset-all') return reset();
  if (name === 'reset-story') return reset(id);
  if (name === 'conflicts') return showConflicts();
  if (name === 'reload-storage') {
    await storage.backup(pendingRecord?.save || record.save, 'ข้อมูลจากแท็บก่อนโหลดเซฟล่าสุด');
    record = await storage.load(); storageProblem = false; pendingRecord = null; draftCache = {}; draftDirty = false; message = ''; closeDialog(); setupSync(); render(); return;
  }
  if (name === 'backups') {
    const backups = await storage.backups();
    openDialog('กู้คืนเซฟก่อนหน้า', backups.length ? backups.map(b => `<button class="library" data-backup="${esc(b.id)}"><span class="grow"><span class="rowtitle">${esc(b.label)}</span><span class="rowsub">${esc(dateText(b.createdAt))}</span></span><span>กู้คืน</span></button>`).join('') : '<p class="sub">ยังไม่มีสำเนาก่อนหน้า ระบบจะเก็บให้ก่อนเริ่มใหม่ นำเข้า หรือแก้ข้อมูลที่ชนกัน</p>'); return;
  }
  if (name === 'persistent') { const granted = await navigator.storage?.persist?.(); notify(granted ? 'เบราว์เซอร์อนุญาตให้เก็บข้อมูลถาวรแล้ว' : 'เบราว์เซอร์ยังไม่อนุญาตเก็บข้อมูลถาวร ใช้คลาวด์หรือสำรองเป็นไฟล์เพิ่มเติมได้'); return; }
  if (name === 'install') {
    if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; }
    else openDialog('เพิ่มลงหน้าจอหลัก', '<p class="sub">บน iPhone/iPad: เปิดด้วย Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม<br><br>บน Android/คอมพิวเตอร์: เปิดเมนูเบราว์เซอร์ → ติดตั้งแอป หรือเพิ่มลงหน้าจอหลัก หากไม่พบเมนู อาจติดตั้งแล้วหรือเบราว์เซอร์ยังไม่รองรับ</p>'); return;
  }
  if (name === 'update') { await flushDraft(); await mutationQueue; if (!busy && !storageProblem) registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }); return; }
  if (!story || story.deleted) return;
  if (name === 'journal') return openDialog('บทสนทนาที่อ่านแล้ว', story.history.map((entry, i) => {
    const visible = i === story.history.length - 1 && entry.scene.beats ? entry.scene.beats.slice(0, (story.beatIndex ?? 0) + 1) : entry.scene.beats;
    return `<article class="journal-entry"><div class="journal-heading"><span>ช่วงที่ ${i + 1} · ${esc(entry.scene.chapter)}</span><small>${esc(dateText(entry.createdAt))}</small></div>${entry.player ? `<p class="player-action"><strong>คุณเลือก</strong> ${esc(entry.player)}</p>` : ''}${visible ? visible.map((beat, index) => `<div class="journal-beat"><span class="journal-index">${String(index + 1).padStart(2, '0')}</span><div><div class="journal-speaker">${esc(beat.actor ? CAST[beat.actor].name : 'เรื่องราว')}<small>${esc(PLACE_NAMES[beat.background])}</small></div><p>${esc(beat.text)}</p></div></div>`).join('') : `<p class="narrative">${esc(entry.scene.body)}</p>`}</article>`;
  }).join(''));
  if (name === 'locations') {
    const visited = [...new Set(story.history.flatMap((entry, i) => (i === story.history.length - 1 ? entry.scene.beats?.slice(0, (story.beatIndex ?? 0) + 1) : entry.scene.beats)?.map(beat => PLACE_NAMES[beat.background]) || [entry.scene.location]).filter(Boolean))];
    const current = PLACE_NAMES[story.scene.beats?.[story.beatIndex]?.background] || story.scene.location;
    return openDialog('สถานที่ในเรื่อง', `<p class="sub">สถานที่ที่คุณพบแล้วในเรื่อง · ${visited.length} แห่ง</p><div class="visited-places">${visited.map(location => {
      const image = Object.entries(PLACE_NAMES).find(([, label]) => label === location)?.[0];
      return `<div class="visited-place">${image ? `<img src="./assets/midnight/${image}.webp" alt="" loading="lazy">` : '<span class="place-placeholder" aria-hidden="true">◇</span>'}<span class="grow">${esc(location)}</span>${location === current ? '<span class="current-place">อยู่ที่นี่</span>' : ''}</div>`;
    }).join('')}</div>`);
  }
  if (name === 'story-status') {
    const state = story.status;
    const reading = (story.beatIndex ?? 0) < (story.scene.beats?.length || 1) - 1;
    const clock = `${String(Math.floor(state.minute / 60)).padStart(2, '0')}:${String(state.minute % 60).padStart(2, '0')}`;
    return openDialog('สถานะเรื่อง', `<p class="sub">${esc(EPISODES[id].title)} · ช่วงที่ ${story.history.length} · บันทึกล่าสุด ${esc(dateText(story.updatedAt))}</p>${id === ACTIVE_EPISODE ? `<div class="status-overview"><div><small>เวลาในเรื่อง</small><strong>◷ ${clock}</strong></div><div><small>เบาะแสที่พบ</small><strong>◇ ${state.clues.length}</strong></div></div><h3 class="status-heading">เบาะแส</h3>${state.clues.length ? `<div class="clue-list">${state.clues.map(clue => `<span>◇ ${esc(CLUE_NAMES[clue])}</span>`).join('')}</div>` : '<p class="hint">ยังไม่มีเบาะแสที่บันทึกไว้</p>'}<h3 class="status-heading">ตัวละครและความสัมพันธ์</h3><div class="status-cast-list">${Object.entries(CAST).map(([actor, person]) => `<div class="status-cast"><img src="./assets/midnight/${actor}-neutral.webp" alt="" loading="lazy"><div class="grow"><strong>${esc(person.name)}</strong><small>${esc(person.role)}</small></div><span class="relation-score ${state.relationships[actor] < 0 ? 'negative' : ''}">♡ ${state.relationships[actor] > 0 ? '+' : ''}${state.relationships[actor]}</span></div>`).join('')}</div>` : ''}<h3 class="status-heading">ความทรงจำของเรื่อง</h3><p class="status-memory">${esc(reading ? 'อ่านช่วงนี้ให้จบก่อนดูความทรงจำล่าสุด' : story.memory || 'ยังไม่มีสรุปจาก AI ประวัติฉากทั้งหมดเก็บอยู่ในบทสนทนา')}</p><p class="status-save" data-save-status role="status">${esc(cloud)}</p>`);
  }
  if (name === 'story-menu') return openDialog(EPISODES[id].title, `<div class="btnrow"><button class="btn" data-nav="settings">ตั้งค่า AI</button><button class="btn" data-action="export">สำรองเซฟ</button></div><div class="btnrow"><button class="btn danger" data-action="reset-story" ${busy ? 'disabled' : ''}>เริ่มเรื่องนี้ใหม่</button></div>`);
}

document.addEventListener('click', event => {
  const target = event.target.closest('button'); if (!target || target.disabled) return;
  const task = async () => {
    if (target.dataset.nav) return go(target.dataset.nav);
    if (target.dataset.talk) return start(target.dataset.talk, true);
    if (target.dataset.choice !== undefined) return advance(record.save.stories[storyId()]?.scene.choices[Number(target.dataset.choice)]?.label);
    if (target.dataset.backup) { const backup = (await storage.backups()).find(b => b.id === target.dataset.backup); if (backup && confirm('กู้คืนเซฟนี้? เซฟปัจจุบันจะถูกสำรองไว้ก่อน')) await restore(backup.save, 'ก่อนกู้คืนเซฟ'); return; }
    if (target.dataset.action) return action(target.dataset.action);
  };
  void task().catch(error => { if (!storageProblem) notify(error.message); });
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  const task = async () => {
    if (form.id === 'settingsForm') { await saveSettings(); notify('บันทึกการตั้งค่าแล้ว'); }
    if (form.id === 'conflictForm' && conflict) {
      const current = conflict, choices = new FormData(form);
      await storage.backup(record.save, 'เซฟในเครื่องก่อนแก้ข้อมูลที่ชนกัน'); await storage.backup(current.save, 'เซฟคลาวด์ก่อนแก้ข้อมูลที่ชนกัน');
      await change(r => { const merged = mergeSaves(r.save, current.save, r.sync.base).save; for (const id of current.ids) merged.stories[id] = clone(choices.get(id) === 'remote' ? current.save.stories[id] : r.save.stories[id]); r.save = merged; r.sync.base = revisions(current.save); r.sync.revision = current.revision; });
      conflict = null; closeDialog(); render(); scheduleSync(0);
    }
  };
  void task().catch(error => { if (!storageProblem) notify(error.message); });
});
document.addEventListener('input', event => {
  if (event.target.id !== 'freeText') return;
  draftCache[storyId()] = event.target.value; draftDirty = true; clearTimeout(draftTimer); draftTimer = setTimeout(() => void flushDraft().catch(() => {}), 300);
});
document.addEventListener('keydown', event => {
  if (uiHidden && event.key === 'Escape') { event.preventDefault(); uiHidden = false; render(); document.querySelector('[data-action="hide-ui"]')?.focus({ preventScroll: true }); return; }
  if (event.target.id === 'freeText' && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); void advance(event.target.value).catch(error => notify(error.message)); }
});
document.addEventListener('change', event => {
  if (event.target.id !== 'importFile' || !event.target.files[0]) return;
  const file = event.target.files[0]; event.target.value = '';
  void (async () => {
    if (file.size > MAX_SAVE_BYTES) throw new Error('ไฟล์บันทึกต้องมีขนาดไม่เกิน 8 MB');
    const data = JSON.parse(await file.text()), value = data.save || data;
    if (value.version !== 2 && !value.scene && !value.progress) throw new Error('ไฟล์นี้ไม่ใช่เซฟ Cinematic Play');
    const save = value.version === 2 ? validateSave(value) : migrateLegacy(value);
    if (confirm('นำเข้าเซฟนี้แทนความคืบหน้าปัจจุบัน? ระบบจะสำรองเซฟเดิมก่อน')) await restore(save, 'ก่อนนำเข้าเซฟ');
  })().catch(error => notify(`นำเข้าไม่สำเร็จ: ${error.message}`));
});
channel?.addEventListener('message', event => { if (event.data.writeId !== record?.writeId && !storageProblem) { if (busy) busy.controller.abort(); handleStorageError(new StorageConflict()); } });
window.addEventListener('storage', event => { if (event.key === 'cinematic-play-v6' && storage.kind === 'localStorage') handleStorageError(new StorageConflict()); });
window.addEventListener('online', () => { render(); scheduleSync(0); });
window.addEventListener('offline', () => { cloud = 'บันทึกในเครื่องแล้ว · ออฟไลน์'; render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(autoTimer); void flushDraft().catch(() => {}); } else { scheduleSync(0); scheduleAutoPlay(); } });
window.addEventListener('beforeunload', event => { if (busy || writes || draftDirty || pendingRecord) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });

async function boot() {
  record = await storage.open();
  password = sessionStorage.getItem(PASSWORD_KEY) || localStorage.getItem(PASSWORD_KEY) || ''; remember = !!localStorage.getItem(PASSWORD_KEY);
  render(); setupSync();
  if ('serviceWorker' in navigator) {
    registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    const watch = () => { if (registration.waiting) { updateReady = true; render(); } };
    watch(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', watch));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateReady && !reloaded && !busy && !writes && !draftDirty && !storageProblem) { reloaded = true; location.reload(); } });
  }
}
boot().catch(error => {
  if (record) { notify(`เปิดแอปได้ แต่เตรียมใช้งานออฟไลน์ไม่สำเร็จ: ${error.message}`); return; }
  document.getElementById('fatal').classList.remove('hidden');
  document.getElementById('fatal').textContent = `เปิดข้อมูลบันทึกไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกลบ กรุณาปิดแท็บอื่นแล้วโหลดใหม่ หรืออนุญาตพื้นที่จัดเก็บเว็บไซต์\n\n${error.message}`;
});
