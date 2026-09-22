import { clone, migrateLegacy, newId, validateSave } from './shared.mjs';

const LOCAL_KEY = 'cinematic-play-v6';
const LEGACY_KEYS = ['cinematic-play-v5', 'cinematic-play-v4'];
function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
export class StorageConflict extends Error {
  constructor() { super('อีกแท็บบันทึกข้อมูลใหม่แล้ว กรุณาโหลดเซฟล่าสุดก่อนเล่นต่อ'); }
}
export function blankRecord() {
  return {
    format: 6, writeId: null, save: { version: 2, stories: {} },
    settings: { backendUrl: '', model: 'gpt-5.6-luna' },
    sync: { endpoint: '', revision: null, base: {}, lastSync: 0 },
    drafts: {}, currentEpisodeId: null,
  };
}
function validateRecord(value) {
  if (!value || value.format !== 6) throw new Error('รูปแบบข้อมูลในเครื่องไม่ถูกต้อง');
  return {
    ...blankRecord(), ...value, save: validateSave(value.save),
    settings: { ...blankRecord().settings, ...value.settings },
    sync: { ...blankRecord().sync, ...value.sync },
  };
}

export class AppStorage {
  constructor() { this.db = null; this.writeId = null; this.kind = 'IndexedDB'; }
  async open() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('cinematic-play', 1);
        let expired = false;
        const timer = setTimeout(() => { expired = true; reject(new Error('เปิดพื้นที่จัดเก็บไม่สำเร็จ')); }, 5000);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('app');
          request.result.createObjectStore('backups', { keyPath: 'id' });
        };
        request.onsuccess = () => { clearTimeout(timer); if (expired) request.result.close(); else resolve(request.result); };
        request.onerror = () => { clearTimeout(timer); reject(request.error); };
        request.onblocked = () => { clearTimeout(timer); expired = true; reject(new Error('มีแท็บเก่าเปิดอยู่')); };
      });
      this.db.onversionchange = () => this.db.close();
    } catch {
      if (readLocal('cinematic-storage-active') === 'IndexedDB') throw new Error('เปิดฐานข้อมูลเซฟเดิมไม่ได้ กรุณาปิดแท็บอื่นแล้วลองใหม่');
      this.kind = 'localStorage';
      // If even fallback storage is unavailable, stop instead of claiming a save.
      localStorage.setItem('cinematic-storage-test', '1');
      localStorage.removeItem('cinematic-storage-test');
    }
    let record = await this.load();
    if (!record) {
      record = blankRecord();
      // A previous fallback record takes priority over legacy data.
      const fallback = readLocal(LOCAL_KEY);
      if (fallback) record = validateRecord(JSON.parse(fallback));
      else for (const key of LEGACY_KEYS) {
        const raw = readLocal(key);
        if (!raw) continue;
        const old = JSON.parse(raw);
        record.save = migrateLegacy(old);
        record.settings.backendUrl = typeof old.backendUrl === 'string' ? old.backendUrl : '';
        record.settings.model = typeof old.model === 'string' ? old.model : 'gpt-5.6-luna';
        record.currentEpisodeId = old.episodeId || null;
        record.migrationNotice = 'ย้ายเซฟเดิมแล้ว: เวอร์ชันเก่าเก็บได้เพียงฉากของเรื่องล่าสุด ประวัติเก่าอาจมีเนื้อหาจากหลายเรื่อง ข้อมูลต้นฉบับยังอยู่ในเครื่อง';
        break;
      }
      record = await this.commit(record);
    }
    try { localStorage.setItem('cinematic-storage-active', this.kind); } catch { /* IndexedDB is still available. */ }
    return record;
  }
  async load() {
    let value;
    if (this.db) {
      value = await new Promise((resolve, reject) => {
        const request = this.db.transaction('app').objectStore('app').get('state');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const raw = localStorage.getItem(LOCAL_KEY);
      value = raw ? JSON.parse(raw) : null;
    }
    if (!value) { this.writeId = null; return null; }
    const record = validateRecord(value);
    this.writeId = record.writeId;
    return record;
  }
  async commit(value) {
    const record = validateRecord(clone(value));
    const expected = this.writeId;
    record.writeId = newId();
    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction('app', 'readwrite');
        const store = tx.objectStore('app');
        const read = store.get('state');
        let conflict = false;
        read.onsuccess = () => {
          if ((read.result?.writeId || null) !== expected) { conflict = true; tx.abort(); }
          else store.put(record, 'state');
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(conflict ? new StorageConflict() : tx.error || new Error('บันทึกไม่สำเร็จ'));
      });
    } else {
      const write = () => {
        const latest = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
        if ((latest?.writeId || null) !== expected) throw new StorageConflict();
        localStorage.setItem(LOCAL_KEY, JSON.stringify(record));
      };
      if (navigator.locks) await navigator.locks.request('cinematic-play-save', write);
      else write();
    }
    this.writeId = record.writeId;
    return record;
  }
  async backup(save, label) {
    const backup = { id: newId(), createdAt: Date.now(), label, save: validateSave(save) };
    if (this.db) await new Promise((resolve, reject) => {
      const tx = this.db.transaction('backups', 'readwrite');
      tx.objectStore('backups').add(backup);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    else localStorage.setItem(`cinematic-backup-${backup.id}`, JSON.stringify(backup));
    return backup;
  }
  async backups() {
    let items = [];
    if (this.db) items = await new Promise((resolve, reject) => {
      const request = this.db.transaction('backups').objectStore('backups').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    else for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('cinematic-backup-')) items.push(JSON.parse(localStorage.getItem(key)));
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }
}
