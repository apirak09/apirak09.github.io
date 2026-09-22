import { clone, mergeSaves, revisions, sameSave, validateSave } from './shared.mjs';

export class SaveSync {
  constructor({ getState, updateState, request, onStatus, onConflict, blocked = () => false }) {
    Object.assign(this, { getState, updateState, request, onStatus, onConflict, blocked });
    this.active = true;
    this.running = null;
    this.again = false;
  }
  stop() { this.active = false; }
  run() {
    if (!this.active || this.blocked()) return Promise.resolve();
    if (this.running) { this.again = true; return this.running; }
    this.running = this.perform().finally(() => { this.running = null; });
    return this.running;
  }
  async perform() {
    try {
      this.onStatus('syncing');
      for (let attempt = 0; attempt < 5 && this.active; attempt++) {
        this.again = false;
        const remote = await this.request('/api/save/get', {});
        if (!this.active || this.blocked()) return this.onStatus('pending');
        if (remote.protocol !== 2 || !Object.hasOwn(remote, 'revision')) {
          throw new Error('กรุณาอัปเดต Backend ให้รองรับเซฟรุ่นใหม่ก่อนซิงก์');
        }
        const remoteSave = validateSave(remote.save || { version: 2, stories: {} });
        let conflict;
        // Read current state inside the update queue: play may have continued
        // while the network request was in flight.
        await this.updateState(record => {
          if (!this.active || this.blocked()) return false;
          const merged = mergeSaves(record.save, remoteSave, record.sync.base);
          if (merged.conflicts.length) { conflict = { ...remote, save: remoteSave, ids: merged.conflicts }; return false; }
          record.save = merged.save;
          record.sync.revision = remote.revision;
          record.sync.base = revisions(remoteSave);
        });
        if (!this.active || this.blocked()) return this.onStatus('pending');
        if (conflict) { this.onStatus('conflict'); this.onConflict(conflict); return; }
        const snapshot = clone(this.getState().save);
        if (!sameSave(snapshot, remoteSave)) {
          let result;
          try {
            result = await this.request('/api/save/set', { save: snapshot, expectedRevision: remote.revision });
          } catch (error) {
            if (error.status === 409) continue;
            throw error;
          }
          if (!this.active) return;
          if (!result.ok || result.protocol !== 2 || typeof result.revision !== 'string') throw new Error('Backend ไม่ได้ยืนยันการบันทึก');
          await this.updateState(record => {
            if (!this.active) return false;
            record.sync.revision = result.revision;
            record.sync.base = revisions(snapshot);
            record.sync.lastSync = Date.now();
          });
        } else {
          await this.updateState(record => { if (!this.active) return false; record.sync.lastSync = Date.now(); });
        }
        if (!sameSave(this.getState().save, snapshot) || this.again) continue;
        this.onStatus('synced');
        return;
      }
      if (this.active) this.onStatus('pending');
    } catch (error) {
      if (this.active) this.onStatus('error', error.message);
      throw error;
    }
  }
}
