import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { MAX_SAVE_BYTES, migrateLegacy, validateSave } from '../frontia/shared.mjs';

export class HttpError extends Error {
  constructor(status, message, code = 'request_error') { super(message); this.status = status; this.code = code; }
}

export class SaveStore {
  constructor(filename) { this.filename = filename; this.queue = Promise.resolve(); }
  async read() {
    let raw;
    try { raw = await fs.readFile(this.filename, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return { protocol: 2, revision: null, save: null }; throw error; }
    try {
      if (Buffer.byteLength(raw) > MAX_SAVE_BYTES + 1024) throw new Error('too_large');
      const data = JSON.parse(raw);
      if (data.protocol === 2 && typeof data.revision === 'string') return { protocol: 2, revision: data.revision, save: validateSave(data.save) };
      if (data.version !== 1) throw new Error('unknown_format');
      return { protocol: 2, revision: `legacy-${createHash('sha256').update(raw).digest('hex')}`, save: migrateLegacy(data) };
    } catch {
      // A corrupt file is not an empty save. Refuse writes until it is recovered.
      throw new HttpError(503, 'อ่านเซฟคลาวด์ไม่ได้ กรุณากู้คืนไฟล์สำรองบนเซิร์ฟเวอร์ก่อนซิงก์', 'save_corrupt');
    }
  }
  set(save, expectedRevision) {
    if (expectedRevision !== null && typeof expectedRevision !== 'string') throw new HttpError(428, 'ต้องระบุเวอร์ชันเซฟก่อนบันทึก กรุณาอัปเดตหน้าเว็บ', 'revision_required');
    let validated;
    try { validated = validateSave(save); } catch (error) { throw new HttpError(400, error.message, 'invalid_save'); }
    if (Buffer.byteLength(JSON.stringify(validated)) > MAX_SAVE_BYTES) throw new HttpError(413, 'เซฟมีขนาดเกิน 8 MB', 'save_too_large');
    const work = this.queue.catch(() => {}).then(async () => {
      const current = await this.read();
      if (expectedRevision !== current.revision) throw new HttpError(409, 'เซฟคลาวด์เปลี่ยนแล้ว กรุณาซิงก์ใหม่', 'save_conflict');
      const next = { protocol: 2, revision: randomUUID(), save: validated };
      await fs.mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
      const tmp = `${this.filename}.${randomUUID()}.tmp`;
      try {
        const file = await fs.open(tmp, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify(next)); await file.sync(); } finally { await file.close(); }
        if (current.save) {
          await fs.copyFile(this.filename, `${this.filename}.bak`);
          await fs.chmod(`${this.filename}.bak`, 0o600);
        }
        await fs.rename(tmp, this.filename);
      } finally { await fs.rm(tmp, { force: true }).catch(() => {}); }
      return { ok: true, protocol: 2, revision: next.revision };
    });
    this.queue = work; return work;
  }
}
