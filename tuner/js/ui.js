import { BASE_URL } from "./song-loader.js";
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const url = (path) => new URL(path, BASE_URL).href;
export function header(active = "") {
  return `<header class="shell"><div class="topbar"><a href="${url("")}" class="brand" aria-label="Vocal Studio home"><span class="brand-mark" aria-hidden="true">${[10, 20, 30, 16, 24].map((h) => `<i style="--h:${h}px"></i>`).join("")}</span>Vocal Studio</a><nav aria-label="Main navigation"><a href="${url("")}" ${active === "songs" ? 'aria-current="page"' : ""}>Songs</a><a href="${url("generic/")}" ${active === "generic" ? 'aria-current="page"' : ""}>Free tuner</a><a href="${url("tools/song-editor/")}">Map editor</a></nav><span class="local-badge"><i class="dot"></i>Private by design</span></div></header>`;
}
export function footer() {
  return `<footer class="footer"><span>Your audio. Your voice. All on this device.</span><a href="${url("README.md")}">Guide &amp; song data status ↗</a></footer>`;
}
export function dateLabel(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Unknown date"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
export function storageDescription(status) {
  return status === "persistent"
    ? "Takes and voice recordings are saved in this browser. Clearing site data removes them."
    : status === "session-only"
      ? "Storage is unavailable. Takes last only while this page stays open; download any voice recording you want to keep."
      : "Checking local storage…";
}
