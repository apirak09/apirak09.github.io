import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CodexBridge } from './codex-bridge.mjs';
import { HttpError, SaveStore } from './save-store.mjs';
import { EPISODE_IDS, MAX_INPUT, MAX_SAVE_BYTES, validateScene } from '../frontia/shared.mjs';
import { episodeContext } from '../frontia/stories.mjs';

const digest = value => createHash('sha256').update(value).digest();
function roleplayInput(data) {
  if (!data || typeof data !== 'object' || !EPISODE_IDS.includes(data.episode?.id)) throw new HttpError(400, 'ไม่พบเรื่องที่เลือก');
  if (typeof data.input !== 'string' || !data.input.trim() || data.input.length > MAX_INPUT) throw new HttpError(400, 'ข้อความต้องมีความยาว 1–4,000 ตัวอักษร');
  if (typeof data.model !== 'string' || !data.model || data.model.length > 120) throw new HttpError(400, 'โมเดลไม่ถูกต้อง');
  if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(data.requestId)) throw new HttpError(400, 'รหัสคำขอไม่ถูกต้อง กรุณาอัปเดตหน้าเว็บ');
  if (data.memory !== undefined && (typeof data.memory !== 'string' || data.memory.length > 8000)) throw new HttpError(400, 'ความทรงจำเรื่องยาวเกินกำหนด');
  if (!Array.isArray(data.recent) || data.recent.length > 12) throw new HttpError(400, 'ประวัติคำขอไม่ถูกต้อง');
  try {
    return {
      model: data.model, episode: episodeContext(data.episode.id), scene: validateScene(data.scene), input: data.input.trim(), memory: data.memory || '',
      recent: data.recent.map(entry => {
        if (!entry || typeof entry.player !== 'string' || entry.player.length > MAX_INPUT || typeof entry.scene !== 'string' || entry.scene.length > 16000) throw new Error('ประวัติคำขอไม่ถูกต้อง');
        return { player: entry.player, scene: entry.scene };
      }),
    };
  } catch (error) { throw new HttpError(400, error.message, 'invalid_input'); }
}

function readBody(req, limit) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'คำขอต้องเป็น application/json');
  if (Number(req.headers['content-length'] || 0) > limit) throw new HttpError(413, 'คำขอมีขนาดเกินกำหนด');
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted); };
    const error = err => { cleanup(); reject(err); };
    const aborted = () => error(new HttpError(499, 'ยกเลิกคำขอแล้ว'));
    const data = chunk => {
      size += chunk.length;
      if (size > limit) { error(new HttpError(413, 'คำขอมีขนาดเกินกำหนด')); req.resume(); return; }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch { reject(new HttpError(400, 'รูปแบบ JSON ไม่ถูกต้อง')); }
    };
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
  });
}

export function createApp({ appPassword, allowedOrigins = ['https://apirak09.github.io'], allowLocalOrigin = false, store, codex }) {
  if (!appPassword || appPassword.length < 16) throw new Error('APP_PASSWORD must contain at least 16 characters.');
  const passwordHash = digest(appPassword), failures = new Map(), completed = new Map();
  let active = null;
  const allowed = origin => !origin || allowedOrigins.includes(origin) || (allowLocalOrigin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin' };
    if (origin && allowed(origin)) headers['access-control-allow-origin'] = origin;
    const send = (status, value) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, headers); res.end(JSON.stringify(value)); } };
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnected);
    try {
      if (!allowed(origin)) throw new HttpError(403, 'ไม่อนุญาต origin นี้', 'origin_denied');
      if (req.method === 'OPTIONS') {
        headers['access-control-allow-methods'] = 'POST,GET,OPTIONS';
        headers['access-control-allow-headers'] = 'content-type,x-app-password';
        headers['access-control-max-age'] = '600';
        res.writeHead(204, headers); res.end(); return;
      }
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, protocol: 2, version: '0.6.0' });
      const supplied = req.headers['x-app-password'];
      if (typeof supplied !== 'string' || !timingSafeEqual(passwordHash, digest(supplied))) {
        const ip = req.socket.remoteAddress || 'unknown', now = Date.now();
        let entry = failures.get(ip);
        if (!entry || now - entry.time > 60000) entry = { count: 0, time: now };
        entry.count++; failures.set(ip, entry);
        if (failures.size > 1000) failures.delete(failures.keys().next().value);
        if (entry.count > 20) { headers['retry-after'] = '60'; throw new HttpError(429, 'ลองรหัสผ่านหลายครั้งเกินไป กรุณารอสักครู่'); }
        throw new HttpError(401, 'รหัสผ่าน Backend ไม่ถูกต้องหรือไม่ได้ระบุ', 'unauthorized');
      }
      if (req.method !== 'POST') { headers.allow = 'POST'; throw new HttpError(405, 'ไม่รองรับวิธีเรียกนี้'); }
      const input = await readBody(req, url.pathname === '/api/save/set' ? MAX_SAVE_BYTES + 1024 : 300000);
      if (url.pathname === '/api/auth/status') return send(200, await codex.account(typeof input.loginId === 'string' ? input.loginId.slice(0, 160) : undefined));
      if (url.pathname === '/api/models') return send(200, { models: await codex.models() });
      if (url.pathname === '/api/auth/chatgpt/start') {
        if (active) throw new HttpError(409, 'กรุณารอให้สร้างฉากเสร็จก่อนเชื่อมบัญชีใหม่');
        return send(200, await codex.loginDevice());
      }
      if (url.pathname === '/api/auth/chatgpt/cancel') {
        if (typeof input.loginId !== 'string' || input.loginId.length > 160) throw new HttpError(400, 'รหัสเข้าสู่ระบบไม่ถูกต้อง');
        await codex.cancelLogin(input.loginId); return send(200, { ok: true });
      }
      if (url.pathname === '/api/save/get') return send(200, await store.read());
      if (url.pathname === '/api/save/set') return send(200, await store.set(input.save, input.expectedRevision));
      if (url.pathname === '/api/roleplay') {
        const payload = roleplayInput(input), fingerprint = digest(JSON.stringify(payload)).toString('hex');
        for (const [key, entry] of completed) if (Date.now() - entry.time > 10 * 60000) completed.delete(key);
        const previous = completed.get(input.requestId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'รหัสคำขอซ้ำแต่เนื้อหาไม่ตรงกัน');
          return send(200, previous.result);
        }
        if (active) { headers['retry-after'] = '3'; throw new HttpError(429, 'กำลังสร้างฉากอยู่ กรุณารอหรือยกเลิกรอบก่อน'); }
        active = input.requestId;
        try {
          const result = await codex.roleplay(payload, controller.signal);
          completed.set(input.requestId, { fingerprint, result, time: Date.now() });
          if (completed.size > 100) completed.delete(completed.keys().next().value);
          return send(200, result);
        } finally { active = null; }
      }
      throw new HttpError(404, 'ไม่พบ API นี้', 'not_found');
    } catch (error) {
      // Do not log request bodies, passwords, model text or OAuth information.
      const status = error.status || 500;
      if (status >= 500) console.error(`Backend error: ${error.code || 'internal_error'}`);
      send(status, { error: error.code || 'request_error', message: error instanceof HttpError ? error.message : 'Backend เกิดข้อผิดพลาด กรุณาลองใหม่' });
      req.resume();
    } finally { res.off('close', disconnected); }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const workspace = path.resolve(process.env.FRONTIA_WORKSPACE || path.join(root, 'data', 'workspace'));
  const codexDir = path.resolve(process.env.CODEX_HOME || path.join(root, 'data', 'codex'));
  const saveFile = process.env.FRONTIA_SAVE_FILE || path.join(workspace, 'cinematic-save.json');
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 }); fs.mkdirSync(codexDir, { recursive: true, mode: 0o700 });
  const codex = new CodexBridge({ workspace, codexDir, command: process.env.CODEX_BIN || 'codex' });
  const server = createApp({ appPassword: process.env.APP_PASSWORD, allowedOrigins: (process.env.ALLOWED_ORIGIN || 'https://apirak09.github.io').split(',').map(s => s.trim()), allowLocalOrigin: process.env.ALLOW_LOCAL_ORIGIN === 'true', store: new SaveStore(saveFile), codex });
  const port = Number(process.env.PORT || 8000);
  server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Cinematic Play backend listening on :${port}`));
  const stop = () => {
    codex.close(); server.close(() => process.exit(0)); server.closeIdleConnections();
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
