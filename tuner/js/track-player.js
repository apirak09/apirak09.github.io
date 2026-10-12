import { AudioPlayer } from "./audio-player.js";

function detailEvent(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

function replaced() {
  return new DOMException(
    "A newer track selection replaced this one.",
    "AbortError",
  );
}

let apiPromise = null;

// Only requested after a user selects streaming. No media files are fetched.
function loadYouTubeAPI() {
  const host = globalThis.window || globalThis;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let timer;
    let done = false;
    const previous = host.onYouTubeIframeAPIReady;
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const script = existing || document.createElement("script");
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.removeEventListener("error", failed);
      if (host.onYouTubeIframeAPIReady === ready)
        host.onYouTubeIframeAPIReady = previous;
      if (error) {
        if (!existing) script.remove();
        reject(error);
      } else resolve(host.YT);
    };
    const failed = () =>
      finish(
        new Error(
          "YouTube could not connect. Check your connection or use a local audio file.",
        ),
      );
    const ready = () => {
      try {
        previous?.();
      } catch {
        /* Another embed's callback does not own this load. */
      }
      if (host.YT?.Player) finish();
      else failed();
    };
    host.onYouTubeIframeAPIReady = ready;
    script.addEventListener("error", failed);
    timer = setTimeout(failed, 20000);
    if (!existing) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.append(script);
    }
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

class MediaFacade extends EventTarget {
  constructor(owner) {
    super();
    this.owner = owner;
  }
  get playbackRate() {
    return this.owner.playbackRate;
  }
  get currentTime() {
    return this.owner.currentTime;
  }
  get duration() {
    return this.owner.duration;
  }
  get paused() {
    return this.owner.paused;
  }
}

/** A single transport for local audio and a visible, official YouTube player. */
export class TrackPlayer extends EventTarget {
  constructor(audioElement, videoMount) {
    super();
    if (!audioElement) throw new TypeError("An audio element is required.");
    this.audio = new MediaFacade(this);
    this._nativeAudio = audioElement;
    this._mount = videoMount;
    this._local = null;
    this._yt = null;
    this._iframe = null;
    this._token = 0;
    this._ready = false;
    this._playing = false;
    this._rate = audioElement.playbackRate || 1;
    this._volume = audioElement.volume ?? 1;
    this._sourceType = "local-file";
    this._sourceId = "";
    this._loop = { a: 0, b: 0, enabled: false };
    this._loadPending = null;
    this._playPending = null;
    this._metadataTimer = null;
    this._pollTimer = null;
    this._seekPending = null;
    this._contentStarted = false;
    this._lastPoll = null;
    this._lastDuration = 0;
    this._endedDelivered = false;
    this._recoverable = false;
    this._destroyed = false;
    this._localListeners = [];
    this._createLocal();
  }

  get sourceType() {
    return this._sourceType;
  }
  get sourceId() {
    return this._sourceId;
  }
  get contentStarted() {
    return this.sourceType === "youtube"
      ? this._contentStarted
      : this._local?.ready === true;
  }
  get seeking() {
    return this.sourceType === "youtube" && Boolean(this._seekPending);
  }
  get ready() {
    return (
      this._ready &&
      (this.sourceType === "youtube" || this._local?.ready === true)
    );
  }
  get paused() {
    return this.sourceType === "youtube"
      ? !this._playing
      : (this._local?.paused ?? true);
  }
  get duration() {
    if (this.sourceType !== "youtube") return this._local?.duration || 0;
    try {
      const value = this._yt?.getDuration();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }
  get currentTime() {
    if (this.sourceType !== "youtube") return this._local?.currentTime || 0;
    if (!this._contentStarted) return 0; // Pre-roll has no song timeline.
    // YouTube seekTo is asynchronous. Read actual media time until it settles.
    try {
      const value = this._yt?.getCurrentTime();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }
  get playbackRate() {
    if (this.sourceType !== "youtube") return this._nativeAudio.playbackRate;
    try {
      return this._yt?.getPlaybackRate() || this._rate;
    } catch {
      return this._rate;
    }
  }
  get availableSpeeds() {
    if (this.sourceType !== "youtube") return [0.5, 0.75, 1];
    try {
      const rates = this._yt?.getAvailablePlaybackRates();
      return Array.isArray(rates) && rates.length ? [...rates] : [1];
    } catch {
      return [1];
    }
  }
  get loop() {
    return this.sourceType === "youtube"
      ? { ...this._loop }
      : this._local?.loop || { ...this._loop };
  }
  on(type, callback) {
    this.addEventListener(type, callback);
    return () => this.removeEventListener(type, callback);
  }

  _mediaEvent(type, detail) {
    this.audio.dispatchEvent(
      detail === undefined ? new Event(type) : detailEvent(type, detail),
    );
  }
  _createLocal() {
    this._local = new AudioPlayer(this._nativeAudio);
    const local = this._local;
    const listen = (target, type, handler) => {
      target.addEventListener(type, handler);
      this._localListeners.push([target, type, handler]);
    };
    for (const type of [
      "play",
      "pause",
      "ended",
      "ratechange",
      "timeupdate",
      "seek",
      "loop",
      "loopchange",
      "loaded",
      "error",
    ]) {
      listen(local, type, (event) => {
        if (this._local !== local || this.sourceType === "youtube") return;
        if (type === "loaded") {
          this._ready = true;
          this._mediaEvent("loadedmetadata");
          this._mediaEvent("durationchange");
        }
        if (type === "error") this._ready = false;
        if (["play", "pause", "ended", "ratechange", "error"].includes(type))
          this._mediaEvent(type, event.detail);
        this.dispatchEvent(
          event.detail === undefined
            ? new Event(type)
            : detailEvent(type, event.detail),
        );
      });
    }
    listen(this._nativeAudio, "durationchange", () => {
      if (this.sourceType !== "youtube" && this._local === local && this.ready)
        this._mediaEvent("durationchange");
    });
    local.setVolume(this._volume);
  }
  _releaseLocal() {
    for (const [target, type, handler] of this._localListeners)
      target.removeEventListener(type, handler);
    this._localListeners = [];
    this._local?.destroy(); // Cancels pending native load and revokes its owned file URL.
    this._local = null;
  }

  _select(type, id) {
    if (this._destroyed) throw new Error("This player has been closed.");
    const token = ++this._token;
    this._ready = false;
    this._loadPending?.reject(replaced());
    this._loadPending = null;
    this._cancelPlay(replaced());
    clearInterval(this._metadataTimer);
    this._metadataTimer = null;
    this._stopPoll();
    this._releaseLocal();
    try {
      this._yt?.destroy();
    } catch {
      /* Removed or unavailable embed. */
    }
    this._yt = null;
    this._iframe?.remove();
    this._iframe = null;
    this._mount?.replaceChildren();
    if (this._mount) this._mount.hidden = type !== "youtube";
    this._sourceType = type;
    this._sourceId = id;
    this._playing = false;
    this._loop = { a: 0, b: 0, enabled: false };
    this._seekPending = null;
    this._contentStarted = false;
    this._lastPoll = null;
    this._lastDuration = 0;
    this._endedDelivered = false;
    this._recoverable = false;
    this._rate = 1;
    if (type !== "youtube") {
      this._createLocal();
      this._local.setSpeed(1);
    }
    this.dispatchEvent(detailEvent("loopchange", this.loop));
    this._mediaEvent("pause");
    return token;
  }

  async loadFile(file) {
    const token = this._select("local-file", file?.name || "Local audio");
    try {
      const metadata = await this._local.loadFile(file);
      if (token !== this._token) throw replaced();
      return metadata;
    } catch (error) {
      if (token === this._token && error.name !== "AbortError")
        this._fail(error);
      throw error;
    }
  }
  async loadSource(url) {
    const token = this._select("repository", url);
    try {
      const metadata = await this._local.loadSource(url);
      if (token !== this._token) throw replaced();
      return metadata;
    } catch (error) {
      if (token === this._token && error.name !== "AbortError")
        this._fail(error);
      throw error;
    }
  }

  loadYouTube(videoId) {
    if (typeof videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(videoId))
      return Promise.reject(new TypeError("Choose a valid YouTube video."));
    if (!this._mount)
      return Promise.reject(
        new Error(
          "The visible YouTube player is unavailable. Use a local audio file.",
        ),
      );
    const token = this._select("youtube", videoId);
    const promise = new Promise((resolve, reject) => {
      this._loadPending = { token, resolve, reject };
    });
    const timeout = setTimeout(() => {
      if (token === this._token && this._loadPending)
        this._fail(
          new Error(
            "YouTube loading timed out. Open the video on YouTube or use a local audio file.",
          ),
        );
    }, 30000);
    // Attach both handlers immediately so cancellation never becomes an unhandled rejection.
    promise.then(
      () => clearTimeout(timeout),
      () => clearTimeout(timeout),
    );
    loadYouTubeAPI()
      .then((YT) => {
        if (token !== this._token) return;
        const iframe = document.createElement("iframe");
        const params = new URLSearchParams({
          enablejsapi: "1",
          origin: globalThis.location?.origin || window.location.origin,
          playsinline: "1",
          controls: "1",
        });
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
        iframe.title = "YouTube song player";
        iframe.width = "640";
        iframe.height = "360";
        iframe.style.width = "100%";
        iframe.style.minWidth = "200px";
        iframe.style.minHeight = "200px";
        iframe.style.border = "0";
        iframe.setAttribute(
          "referrerpolicy",
          "strict-origin-when-cross-origin",
        );
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        );
        iframe.setAttribute("allowfullscreen", "");
        this._iframe = iframe;
        this._mount.replaceChildren(iframe);
        const active = () =>
          token === this._token && this.sourceType === "youtube";
        const player = new YT.Player(iframe, {
          events: {
            onReady: (event) => {
              if (!active()) {
                try {
                  event.target.destroy();
                } catch {}
                return;
              }
              this._yt = event.target;
              if (!this._loadPending) return; // A previous API error must not revive a failed selection.
              this._yt.setVolume(this._volume * 100);
              this._ready = true;
              const metadata = {
                duration: this.duration,
                name: "YouTube song",
                videoId: this.sourceId,
              };
              this._loadPending?.resolve(metadata);
              this._loadPending = null;
              this._probeMetadata();
              this.dispatchEvent(detailEvent("loaded", metadata));
              if (!this.duration)
                this._metadataTimer = setInterval(
                  () => this._probeMetadata(),
                  200,
                );
            },
            onStateChange: (event) => {
              if (active()) this._stateChanged(event.data);
            },
            onPlaybackRateChange: (event) => {
              if (!active()) return;
              this._rate = Number(event.data) || 1;
              this._mediaEvent("ratechange", { rate: this._rate });
              this.dispatchEvent(
                detailEvent("ratechange", { rate: this._rate }),
              );
            },
            onError: (event) => {
              if (active()) this._fail(this._youtubeError(event.data));
            },
            onAutoplayBlocked: () => {
              if (!active()) return;
              this._fail(
                new Error(
                  "Your browser blocked YouTube playback. Press Play in the visible YouTube player, or select the song again.",
                ),
                true,
              );
            },
          },
        });
        if (active()) this._yt = player;
        else {
          try {
            player.destroy();
          } catch {}
        }
      })
      .catch((error) => {
        if (token === this._token) this._fail(error);
      });
    return promise;
  }

  _probeMetadata() {
    if (
      this.sourceType !== "youtube" ||
      !this.ready ||
      this.duration <= 0 ||
      this.duration === this._lastDuration
    )
      return;
    clearInterval(this._metadataTimer);
    this._metadataTimer = null;
    const firstMetadata = !this._lastDuration;
    this._lastDuration = this.duration;
    if (firstMetadata) this._mediaEvent("loadedmetadata");
    this._mediaEvent("durationchange");
  }
  _youtubeError(code) {
    const messages = {
      2: "This YouTube video ID is invalid. Use a local audio file or another video.",
      5: "YouTube could not play this video in your browser. Open it on YouTube or use a local audio file.",
      100: "This YouTube video is unavailable or private. Open it on YouTube or use a local audio file.",
      101: "The owner does not allow this video to play here. Open it on YouTube or use a local audio file.",
      150: "The owner does not allow this video to play here. Open it on YouTube or use a local audio file.",
      153: "YouTube could not identify this website. Open the deployed HTTPS site, allow its referrer, or use a local audio file.",
    };
    return new Error(
      messages[code] ||
        "YouTube playback failed. Open the video on YouTube or use a local audio file.",
    );
  }
  _fail(error, recoverable = false) {
    this._ready = false;
    this._recoverable = recoverable;
    this._playing = false;
    this._stopPoll();
    clearInterval(this._metadataTimer);
    this._metadataTimer = null;
    this._loadPending?.reject(error);
    this._loadPending = null;
    this._cancelPlay(error);
    this._mediaEvent("error", { error });
    this.dispatchEvent(detailEvent("error", { error }));
  }

  play() {
    if (!this.ready)
      return Promise.reject(
        new Error("Load a song or choose an audio file to begin."),
      );
    if (this.sourceType !== "youtube") return this._local.play();
    if (this._playing && this._yt.getPlayerState() === 1)
      return Promise.resolve();
    if (this._playPending) return this._playPending.promise;
    if (
      this._loop.enabled &&
      !this._seekPending &&
      (this.currentTime < this._loop.a || this.currentTime >= this._loop.b)
    )
      this.seek(this._loop.a, "loop-start");
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // Ads and buffering may take time. Resolve only on real content playback;
    // cancellation and explicit API errors still reject immediately.
    this._playPending = { promise, resolve, reject };
    try {
      this._yt.playVideo();
    } catch (error) {
      this._fail(error);
    }
    return promise;
  }
  _cancelPlay(error) {
    if (!this._playPending) return;
    clearTimeout(this._playPending.timer);
    this._playPending.reject(error);
    this._playPending = null;
  }
  pause() {
    if (this.sourceType !== "youtube") {
      this._local?.pause();
      return;
    }
    this._cancelPlay(
      new DOMException("Playback was paused before it started.", "AbortError"),
    );
    const wasPlaying = this._playing;
    this._playing = false;
    this._stopPoll();
    try {
      this._yt?.pauseVideo?.();
    } catch {
      /* The iframe may have been removed by navigation. */
    }
    if (wasPlaying) {
      this._mediaEvent("pause");
      this.dispatchEvent(new Event("pause"));
    }
  }
  _stateChanged(state) {
    this._probeMetadata();
    if (state === 1) {
      this._contentStarted = true;
      if (this._recoverable && this.duration > 0) {
        this._ready = true;
        this._recoverable = false;
        this.dispatchEvent(
          detailEvent("loaded", {
            duration: this.duration,
            name: "YouTube song",
            videoId: this.sourceId,
          }),
        );
        this._mediaEvent("loadedmetadata");
      }
      if (!this.ready) return;
      const wasPlaying = this._playing;
      this._playing = true;
      this._endedDelivered = false;
      this._lastPoll = { time: this.currentTime, at: Date.now() };
      if (this._playPending) {
        clearTimeout(this._playPending.timer);
        this._playPending.resolve();
        this._playPending = null;
      }
      this._startPoll();
      if (!wasPlaying) {
        this._mediaEvent("play");
        this.dispatchEvent(new Event("play"));
      }
    } else if (state === 0) {
      this._playing = false;
      this._stopPoll();
      if (this.ready && this._loop.enabled) {
        this._wrapLoop();
        // play() already reports explicit API failures through the error event.
        this.play().catch(() => {});
      } else if (!this._endedDelivered) {
        this._endedDelivered = true;
        this._mediaEvent("ended");
        this.dispatchEvent(new Event("ended"));
      }
    } else if (state === 2 || state === -1 || state === 5 || state === 3) {
      const wasPlaying = this._playing;
      this._playing = false;
      this._stopPoll();
      if (wasPlaying) {
        this._mediaEvent("pause");
        this.dispatchEvent(new Event("pause"));
      }
    }
    // Unstarted ads and buffering have no usable content timeline. Wait for 1.
  }

  seek(seconds, reason = "seek") {
    if (this.sourceType !== "youtube")
      return this._local?.seek(seconds, reason) || 0;
    if (!this.ready || !this.contentStarted || !Number.isFinite(seconds))
      return this.currentTime;
    const from = this.currentTime;
    const to = Math.max(0, Math.min(this.duration, seconds));
    this._seekPending = { from, to, reason, time: Date.now() };
    this._endedDelivered = false;
    this._yt.seekTo(to, true);
    this.dispatchEvent(detailEvent("seek", { from, to, reason }));
    return to;
  }
  skip(delta) {
    return this.seek(this.currentTime + delta);
  }
  setSpeed(rate) {
    if (this.sourceType !== "youtube") {
      this._local?.setSpeed(rate);
      return;
    }
    if (!this.ready)
      throw new Error("Load the YouTube song before changing its speed.");
    if (!Number.isFinite(rate) || !this.availableSpeeds.includes(rate))
      throw new RangeError(
        "This YouTube video does not support that playback speed. Choose an available speed.",
      );
    this._yt.setPlaybackRate(rate);
  }
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this._volume = Math.max(0, Math.min(1, value));
    if (this.sourceType === "youtube")
      this._yt?.setVolume?.(this._volume * 100);
    else this._local?.setVolume(this._volume);
  }
  setLoop(a, b, enabled = true) {
    if (this.sourceType !== "youtube")
      return this._local.setLoop(a, b, enabled);
    if (!this.contentStarted)
      throw new Error(
        "Start the song in the YouTube player before setting a practice loop.",
      );
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a)
      throw new RangeError("Set loop B after loop A.");
    const end = this.ready ? Math.min(b, this.duration) : b;
    if (end - a < 0.1)
      throw new RangeError("Choose a loop at least 0.1 seconds long.");
    this._loop = { a, b: end, enabled: Boolean(enabled) && this.ready };
    if (this._loop.enabled && (this.currentTime < a || this.currentTime >= end))
      this.seek(a, "loop-start");
    this.dispatchEvent(detailEvent("loopchange", this.loop));
    return this.loop;
  }
  clearLoop() {
    if (this.sourceType !== "youtube") {
      this._local?.clearLoop();
      return;
    }
    this._loop = { a: 0, b: 0, enabled: false };
    this.dispatchEvent(detailEvent("loopchange", this.loop));
  }
  _wrapLoop() {
    if (this._seekPending) return;
    const from = this.currentTime;
    const to = this._loop.a;
    this.seek(to, "loop");
    this.dispatchEvent(
      detailEvent("loop", { from, to, a: to, b: this._loop.b }),
    );
  }
  _poll() {
    const time = this.currentTime;
    const at = Date.now();
    const ownSeek = Boolean(this._seekPending);
    if (
      this._seekPending &&
      (Math.abs(time - this._seekPending.to) < 0.25 ||
        Date.now() - this._seekPending.time > 2500)
    ) {
      const pending = this._seekPending;
      this._seekPending = null;
      this.dispatchEvent(
        detailEvent("seeked", {
          from: pending.from,
          to: time,
          reason: pending.reason,
        }),
      );
    }
    if (this._lastPoll && !ownSeek && this._playing && this.contentStarted) {
      const elapsed = Math.max(0, (at - this._lastPoll.at) / 1000);
      const maxAdvance = Math.max(0.5, elapsed * this.playbackRate + 0.35);
      if (Math.abs(time - this._lastPoll.time) > maxAdvance) {
        this.dispatchEvent(
          detailEvent("seek", {
            from: this._lastPoll.time,
            to: time,
            reason: "native-seek",
          }),
        );
      }
    }
    this._lastPoll = { time, at };
    if (
      this.ready &&
      this._playing &&
      this._loop.enabled &&
      time >= this._loop.b
    )
      this._wrapLoop();
    if (this.duration !== this._lastDuration) {
      this._lastDuration = this.duration;
      this._mediaEvent("durationchange");
    }
    this.dispatchEvent(detailEvent("timeupdate", { time: this.currentTime }));
  }
  _startPoll() {
    this._stopPoll();
    this._pollTimer = setInterval(() => this._poll(), 50);
  }
  _stopPoll() {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
  }
  destroy() {
    if (this._destroyed) return;
    this._select("local-file", "");
    this._releaseLocal();
    this._ready = false;
    this._destroyed = true;
  }
}
