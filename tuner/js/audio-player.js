function eventWithDetail(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

function abortedLoad() {
  return new DOMException(
    "A newer audio selection replaced this one.",
    "AbortError",
  );
}

/** A local-only HTML media player. Song audio is never sent to a server. */
export class AudioPlayer extends EventTarget {
  constructor(audioElement) {
    super();
    if (!audioElement) throw new TypeError("An audio element is required.");
    this.audio = audioElement;
    this.audio.preload = "metadata";
    this.audio.loop = false;
    this._ready = false;
    this._ownedUrl = null;
    this._loadToken = 0;
    this._pendingLoad = null;
    this._loop = { a: 0, b: 0, enabled: false };
    this._loopTimer = null;
    this._listeners = [];
    for (const property of [
      "preservesPitch",
      "mozPreservesPitch",
      "webkitPreservesPitch",
    ]) {
      if (property in this.audio) this.audio[property] = true;
    }
    this._listen("timeupdate", () => {
      this._checkLoop();
      this.dispatchEvent(
        eventWithDetail("timeupdate", { time: this.currentTime }),
      );
    });
    this._listen("play", () => {
      this._startLoopTimer();
      this.dispatchEvent(new Event("play"));
    });
    this._listen("pause", () => {
      this._stopLoopTimer();
      this.dispatchEvent(new Event("pause"));
    });
    this._listen("ended", () => {
      this._stopLoopTimer();
      if (this._loop.enabled) {
        this._wrapLoop();
        Promise.resolve(this.audio.play()).catch((error) => {
          this.dispatchEvent(eventWithDetail("error", { error }));
        });
      } else {
        this.dispatchEvent(new Event("ended"));
      }
    });
    this._listen("ratechange", () => {
      this.dispatchEvent(
        eventWithDetail("ratechange", { rate: this.audio.playbackRate }),
      );
    });
    this._listen("error", () => {
      if (this._pendingLoad) return; // The pending promise owns load errors.
      this._ready = false;
      this.dispatchEvent(
        eventWithDetail("error", { error: this._mediaError() }),
      );
    });
  }

  get currentTime() {
    return Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
  }
  get duration() {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }
  get paused() {
    return this.audio.paused;
  }
  get ready() {
    return this._ready;
  }
  get loop() {
    return { ...this._loop };
  }

  on(type, callback) {
    this.addEventListener(type, callback);
    return () => this.removeEventListener(type, callback);
  }

  async loadFile(file) {
    if (!(file instanceof Blob))
      throw new TypeError("Choose a valid audio file.");
    if (
      file.type &&
      !file.type.startsWith("audio/") &&
      file.type !== "video/mp4"
    ) {
      throw new TypeError("Choose an audio file supported by your browser.");
    }
    const url = URL.createObjectURL(file);
    return this._load(url, url, file.name || "Local audio");
  }

  async loadSource(url) {
    if (typeof url !== "string" || !url.trim())
      throw new TypeError("An audio URL is required.");
    return this._load(url, null, "Practice audio");
  }

  _load(url, ownedUrl, name) {
    const token = ++this._loadToken;
    this._pendingLoad?.cancel();
    this.pause();
    this.clearLoop();
    this._ready = false;
    const oldOwnedUrl = this._ownedUrl;
    this._ownedUrl = ownedUrl;

    return new Promise((resolve, reject) => {
      let done = false;
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        this.audio.removeEventListener("loadedmetadata", loaded);
        this.audio.removeEventListener("error", failed);
        if (this._pendingLoad?.token === token) this._pendingLoad = null;
      };
      const finish = (error, metadata) => {
        if (done) return;
        done = true;
        cleanup();
        if (error) {
          if (this._ownedUrl === ownedUrl && ownedUrl) {
            URL.revokeObjectURL(ownedUrl);
            this._ownedUrl = null;
          }
          reject(error);
        } else resolve(metadata);
      };
      const loaded = () => {
        if (token !== this._loadToken) return finish(abortedLoad());
        // Ignore a queued event for the previously selected file.
        if (this.audio.currentSrc && this.audio.currentSrc !== this.audio.src)
          return;
        if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
          return finish(
            new Error(
              "This file has no playable audio duration. Try another audio format.",
            ),
          );
        }
        this._ready = true;
        const metadata = { duration: this.duration, name };
        finish(null, metadata);
        this.dispatchEvent(eventWithDetail("loaded", metadata));
      };
      const failed = () => finish(this._mediaError());
      this._pendingLoad = { token, cancel: () => finish(abortedLoad()) };
      this.audio.addEventListener("loadedmetadata", loaded);
      this.audio.addEventListener("error", failed);
      timer = setTimeout(
        () =>
          finish(
            new Error("Audio loading timed out. Try another file or format."),
          ),
        45000,
      );
      try {
        this.audio.src = url;
        this.audio.load();
        if (oldOwnedUrl) URL.revokeObjectURL(oldOwnedUrl);
        if (this.audio.readyState >= 1) queueMicrotask(loaded);
      } catch (error) {
        if (oldOwnedUrl) URL.revokeObjectURL(oldOwnedUrl);
        finish(error);
      }
    });
  }

  _mediaError() {
    const code = this.audio.error?.code;
    const messages = {
      1: "Audio loading was interrupted. Select the file again.",
      2: "The audio could not be loaded. Check the file or connection.",
      3: "This audio could not be decoded. Try MP3, WAV, AAC, or another browser.",
      4: "This audio format is not supported. Try MP3, WAV, or AAC.",
    };
    return new Error(
      messages[code] ||
        "The audio could not be played. Try another file or format.",
    );
  }

  async play() {
    if (!this.ready) throw new Error("Choose your audio file to begin.");
    if (
      this._loop.enabled &&
      (this.currentTime < this._loop.a || this.currentTime >= this._loop.b)
    ) {
      this.seek(this._loop.a, "loop-start");
    }
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  seek(seconds, reason = "seek") {
    if (!this.ready) return 0;
    if (!Number.isFinite(seconds)) return this.currentTime;
    const from = this.currentTime;
    const to = Math.max(0, Math.min(this.duration, seconds));
    this.audio.currentTime = to;
    this.dispatchEvent(eventWithDetail("seek", { from, to, reason }));
    return to;
  }

  skip(delta) {
    return this.seek(this.currentTime + delta);
  }

  setSpeed(rate) {
    if (!Number.isFinite(rate) || rate < 0.25 || rate > 2)
      throw new RangeError("Playback speed must be between 0.25 and 2.");
    this.audio.playbackRate = rate;
  }

  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.audio.volume = Math.max(0, Math.min(1, value));
  }

  setLoop(a, b, enabled = true) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a) {
      throw new RangeError("Set loop B after loop A.");
    }
    const end = this.ready ? Math.min(b, this.duration) : b;
    if (end - a < 0.1)
      throw new RangeError("Choose a loop at least 0.1 seconds long.");
    this._loop = { a, b: end, enabled: Boolean(enabled) && this.ready };
    if (this._loop.enabled && (this.currentTime < a || this.currentTime >= end))
      this.seek(a, "loop-start");
    this.dispatchEvent(eventWithDetail("loopchange", this.loop));
    return this.loop;
  }

  clearLoop() {
    this._loop = { a: 0, b: 0, enabled: false };
    this.dispatchEvent(eventWithDetail("loopchange", this.loop));
  }

  _checkLoop() {
    if (!this.ready || !this._loop.enabled || this.audio.paused) return;
    if (this.currentTime >= this._loop.b) this._wrapLoop();
  }

  _wrapLoop() {
    const from = this.currentTime;
    const to = this._loop.a;
    this.audio.currentTime = to;
    this.dispatchEvent(
      eventWithDetail("loop", { from, to, a: to, b: this._loop.b }),
    );
    this.dispatchEvent(eventWithDetail("seek", { from, to, reason: "loop" }));
  }

  _startLoopTimer() {
    this._stopLoopTimer();
    // timeupdate alone can be too infrequent for short practice loops.
    this._loopTimer = setInterval(() => this._checkLoop(), 30);
  }

  _stopLoopTimer() {
    clearInterval(this._loopTimer);
    this._loopTimer = null;
  }

  _listen(type, callback) {
    this.audio.addEventListener(type, callback);
    this._listeners.push([type, callback]);
  }

  destroy() {
    ++this._loadToken;
    this._pendingLoad?.cancel();
    this.pause();
    this._stopLoopTimer();
    for (const [type, callback] of this._listeners)
      this.audio.removeEventListener(type, callback);
    this._listeners = [];
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this._ownedUrl) URL.revokeObjectURL(this._ownedUrl);
    this._ownedUrl = null;
    this._ready = false;
  }
}
