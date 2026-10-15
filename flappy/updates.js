(function (root) {
  'use strict';
  const VERSION = '3.0.0';
  class GameUpdates {
    constructor({ serviceWorker, fetcher, baseURL, canReload, beforeReload, reload, onChange, now = Date.now, timers = root } = {}) {
      this.serviceWorker = serviceWorker; this.fetcher = fetcher; this.baseURL = baseURL;
      this.canReload = canReload || (() => true); this.beforeReload = beforeReload || (() => {});
      this.reload = reload; this.onChange = onChange || (() => {}); this.now = now; this.timers = timers;
      this.registration = null; this.latest = VERSION; this.available = false; this.busy = false;
      this.applying = false; this.reloaded = false; this.error = ''; this.ready = null; this.checkedAt = 0;
      this.serviceWorker?.addEventListener('controllerchange', () => {
        if (this.applying) this.reloadOnce();
        else this.emit(); // Another tab may update; never reload an active flight.
      });
    }
    emit() { this.onChange(this); }
    start() {
      if (this.ready) return this.ready;
      this.ready = (async () => {
        if (!this.serviceWorker) return null;
        try {
          this.registration = await this.serviceWorker.register(new URL('sw.js', this.baseURL).href, { scope: new URL('./', this.baseURL).href, updateViaCache: 'none' });
          const watch = worker => {
            if (!worker) return;
            const changed = () => {
              if (worker.state === 'installed' && this.serviceWorker.controller) { this.available = true; this.emit(); }
              if (worker.state === 'redundant' && this.applying) { this.applying = false; this.error = 'Update could not install. Try again when online.'; this.emit(); }
            };
            worker.addEventListener('statechange', changed); changed();
          };
          this.registration.addEventListener('updatefound', () => watch(this.registration.installing));
          watch(this.registration.installing);
          if (this.registration.waiting) this.available = true;
          this.emit(); return this.registration;
        } catch (_) { return null; } // Online updates still work without an offline worker.
      })();
      return this.ready;
    }
    async check(manual = false) {
      if (this.busy || this.applying) return;
      if (!manual && this.checkedAt && this.now() - this.checkedAt < 60000) return;
      this.checkedAt = this.now(); this.busy = true; this.error = ''; this.emit();
      let timeout;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      try {
        const url = new URL('version.json', this.baseURL); url.searchParams.set('check', String(this.now()));
        const response = await Promise.race([
          this.fetcher(url.href, { cache: 'no-store', ...(controller ? { signal: controller.signal } : {}) }),
          new Promise((_, reject) => { timeout = this.timers.setTimeout(() => { controller?.abort(); reject(new Error('timeout')); }, 8000); })
        ]);
        if (!response.ok) throw new Error('offline');
        const release = await response.json();
        if (typeof release.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('invalid release');
        this.latest = release.version;
        this.available = this.latest !== VERSION || !!this.registration?.waiting;
        if (manual && !this.available) this.message = 'You are up to date.';
        // A slow worker registration must not leave the check button stuck.
        // updatefound/statechange surface installation independently of the marker check.
        this.start().then(registration => registration?.update().catch(() => {}));
      } catch (_) { this.error = 'Cannot check while offline. Your game and saves are still available.'; }
      finally { this.timers.clearTimeout(timeout); this.busy = false; this.emit(); }
    }
    async apply() {
      if (this.applying || !this.available) return;
      if (!this.canReload()) { this.error = 'Finish this flight before updating.'; this.emit(); return; }
      this.applying = true; this.error = ''; this.emit();
      try {
        await this.beforeReload();
        let registrationTimeout;
        let registration;
        try {
          registration = await Promise.race([this.start(), new Promise(resolve => { registrationTimeout = this.timers.setTimeout(() => resolve(null), 8000); })]);
        } finally { this.timers.clearTimeout(registrationTimeout); }
        // Only a fully installed cache may take over. Do not skip an installing worker.
        let worker = registration?.waiting;
        if (!worker && registration?.installing) {
          worker = await new Promise((resolve, reject) => {
            const installing = registration.installing;
            const timeout = this.timers.setTimeout(() => { installing.removeEventListener('statechange', changed); reject(new Error('installation timeout')); }, 8000);
            const changed = () => {
              if (installing.state === 'installed' || installing.state === 'activated') { this.timers.clearTimeout(timeout); installing.removeEventListener('statechange', changed); resolve(installing); }
              else if (installing.state === 'redundant') { this.timers.clearTimeout(timeout); installing.removeEventListener('statechange', changed); reject(new Error('installation failed')); }
            };
            installing.addEventListener('statechange', changed); changed();
          });
        }
        if (worker?.state === 'installed') {
          worker.postMessage({ type: 'SKIP_WAITING' });
          this.timers.setTimeout(() => {
            if (!this.reloaded) { this.applying = false; this.error = 'Update is taking longer than expected. Please try again.'; this.emit(); }
          }, 8000);
        } else {
          // A newly published manifest can arrive before its worker finishes installing.
          // Verify fresh HTML is reachable before a cache-busting navigation.
          const url = new URL('./', this.baseURL); url.searchParams.set('update', String(this.now()));
          let timeout;
          try {
            await Promise.race([
              (async () => {
                const response = await this.fetcher(url.href, { cache: 'no-store' });
                if (!response.ok) throw new Error('offline');
                const html = await response.text();
                if (!html.includes(`name="game-version" content="${this.latest}"`)) throw new Error('release still publishing');
              })(),
              new Promise((_, reject) => { timeout = this.timers.setTimeout(() => reject(new Error('download timeout')), 8000); })
            ]);
          } finally { this.timers.clearTimeout(timeout); }
          this.reloadOnce();
        }
      } catch (_) { this.applying = false; this.error = 'Could not download the update. Reconnect and try again.'; this.emit(); }
    }
    reloadOnce() {
      if (this.reloaded || !this.canReload()) return;
      this.reloaded = true;
      const url = new URL('./', this.baseURL); url.searchParams.set('v', this.latest); url.searchParams.set('update', String(this.now()));
      this.reload(url.href);
    }
  }
  const api = { VERSION, GameUpdates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlappyUpdates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
