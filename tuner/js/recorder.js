function emit(target, type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  target.dispatchEvent(event);
}

/** Records microphone audio only; permission and stream ownership stay with the trainer. */
export class Recorder extends EventTarget {
  constructor() {
    super();
    this._session = null;
    this.lastError = null;
  }

  get supported() {
    return typeof globalThis.MediaRecorder === "function";
  }
  get recording() {
    return Boolean(
      this._session && !this._session.finished && !this._session.cancelled,
    );
  }

  on(type, callback) {
    this.addEventListener(type, callback);
    return () => this.removeEventListener(type, callback);
  }

  start(stream) {
    if (!this.supported)
      throw new Error(
        "Recording is unavailable in this browser. Live pitch practice still works.",
      );
    if (this.recording)
      throw new Error(
        "Stop the current recording before starting another take.",
      );
    const tracks =
      stream
        ?.getAudioTracks?.()
        .filter((track) => track.readyState !== "ended") || [];
    if (!tracks.length)
      throw new Error("A working microphone is required to record a take.");
    const RecorderType = globalThis.MediaRecorder;
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((type) => RecorderType.isTypeSupported?.(type));
    let recorder;
    try {
      recorder = mimeType
        ? new RecorderType(stream, { mimeType })
        : new RecorderType(stream);
    } catch {
      // Some browsers advertise a type but reject it for a particular stream.
      recorder = new RecorderType(stream);
    }
    const session = {
      recorder,
      tracks,
      chunks: [],
      finished: false,
      cancelled: false,
      interrupted: false,
      timer: null,
      error: null,
    };
    session.promise = new Promise((resolve) => {
      session.resolve = resolve;
    });
    this._session = session;
    this.lastError = null;
    recorder.addEventListener("dataavailable", (event) => {
      if (!session.cancelled && event.data?.size)
        session.chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => this._finish(session));
    recorder.addEventListener("error", (event) => {
      session.error =
        event.error ||
        new Error("The browser interrupted microphone recording.");
      this.lastError = session.error;
      emit(this, "error", { error: session.error });
      this._stopSession(session);
    });
    session.onEnded = () => {
      if (session.finished || session.cancelled) return;
      session.interrupted = true;
      emit(this, "interrupted", { reason: "microphone-ended" });
      this._stopSession(session);
    };
    tracks.forEach((track) => track.addEventListener("ended", session.onEnded));
    try {
      recorder.start(1000);
    } catch (error) {
      session.error = error;
      session.cancelled = true;
      this.lastError = error;
      this._finish(session);
      throw error;
    }
    emit(this, "started", { mimeType: recorder.mimeType || mimeType || "" });
    return true;
  }

  async stop() {
    const session = this._session;
    if (!session) return null;
    this._stopSession(session);
    return session.promise;
  }

  _stopSession(session) {
    if (session.finished || session.stopRequested) return;
    session.stopRequested = true;
    // A broken device/browser must not leave the stop button pending forever.
    session.timer = setTimeout(() => {
      if (!session.finished) {
        session.error ||= new Error(
          "Recording ended before the browser finished saving its audio.",
        );
        this.lastError = session.error;
        if (!session.cancelled) emit(this, "error", { error: session.error });
        this._finish(session);
      }
    }, 8000);
    try {
      if (session.recorder.state !== "inactive") session.recorder.stop();
      // Even after state becomes inactive, final dataavailable/stop events may
      // still be queued. Wait for stop so the last audio chunk is preserved.
    } catch (error) {
      session.error = error;
      this.lastError = error;
      if (!session.cancelled) emit(this, "error", { error });
      this._finish(session);
    }
  }

  _finish(session) {
    if (session.finished) return;
    session.finished = true;
    clearTimeout(session.timer);
    session.tracks.forEach((track) =>
      track.removeEventListener("ended", session.onEnded),
    );
    const type =
      session.chunks[0]?.type ||
      session.recorder.mimeType ||
      "application/octet-stream";
    const blob =
      !session.cancelled && session.chunks.length
        ? new Blob(session.chunks, { type })
        : null;
    session.chunks = [];
    if (this._session === session) this._session = null;
    session.resolve(blob);
    if (!session.cancelled)
      emit(this, "stopped", {
        blob,
        interrupted: session.interrupted,
        error: session.error,
      });
  }

  cancel() {
    const session = this._session;
    if (!session) return;
    session.cancelled = true;
    this._stopSession(session);
    // Cancellation frees the interface immediately, even if the browser never sends stop.
    this._finish(session);
  }
}
