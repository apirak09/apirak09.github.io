const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];

export function frequencyToMidi(frequency, reference = 440) {
  return Number.isFinite(frequency) &&
    Number.isFinite(reference) &&
    frequency > 0 &&
    reference > 0
    ? 69 + 12 * Math.log2(frequency / reference)
    : null;
}

export function midiToFrequency(midi, reference = 440) {
  return Number.isFinite(midi) && Number.isFinite(reference) && reference > 0
    ? reference * 2 ** ((midi - 69) / 12)
    : null;
}

export function midiToNote(midi) {
  if (!Number.isFinite(midi)) return "—";
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

export function centsBetween(frequency, targetFrequency) {
  return Number.isFinite(frequency) &&
    Number.isFinite(targetFrequency) &&
    frequency > 0 &&
    targetFrequency > 0
    ? 1200 * Math.log2(frequency / targetFrequency)
    : null;
}

export function formatTime(seconds) {
  const safe = Math.floor(Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
