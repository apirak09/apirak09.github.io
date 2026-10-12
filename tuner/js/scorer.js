import { frequencyToMidi } from "./pitch-utils.js";

const CADENCE = 0.05;
const clamp = (value) => Math.max(0, Math.min(100, value));
const round = (value) => (value === null ? null : Math.round(clamp(value)));
const isVoicedNote = (note) =>
  Number.isFinite(note.midi) &&
  note.type !== "rest" &&
  note.type !== "unvoiced";
const empty = (reason) => ({
  pitchAccuracy: null,
  timingAccuracy: null,
  stability: null,
  overall: null,
  coverage: null,
  hotspots: [],
  reason,
});

function sampleMidi(sample, referencePitch) {
  if (
    !sample ||
    (sample.confidence !== undefined &&
      (!Number.isFinite(sample.confidence) || sample.confidence < 0.8))
  )
    return null;
  if (sample.midi === null || sample.frequency === null) return null;
  return Number.isFinite(sample.midi)
    ? sample.midi
    : frequencyToMidi(sample.frequency, referencePitch);
}

function pitchCredit(cents) {
  const deviation = Math.abs(cents);
  if (deviation <= 15) return 100;
  if (deviation <= 30) return 100 - (deviation - 15);
  if (deviation <= 50) return 85 - (deviation - 30);
  return Math.max(0, 65 * (1 - (deviation - 50) / 100));
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

/** Score only observed, verified melody intervals; every silent bin earns zero. */
export function scoreTake(
  samples,
  notes,
  { melodyStatus, referencePitch = 440 } = {},
) {
  if (!["verified", "original"].includes(melodyStatus))
    return empty(
      "A verified target melody is needed for scores. This take is saved as free pitch practice.",
    );
  const melody = (Array.isArray(notes) ? notes : [])
    .filter(
      (note) =>
        Number.isFinite(note.start) &&
        Number.isFinite(note.end) &&
        note.end > note.start,
    )
    .sort((a, b) => a.start - b.start);
  if (!melody.some(isVoicedNote))
    return empty("The melody map has no voiced target notes.");
  if (!Array.isArray(samples) || samples.length < 2)
    return empty(
      "Record more practice while the audio is playing to calculate a score.",
    );

  // A seek or loop produces a new pass. Keep acquisition order, and split even
  // when the caller forgot to mark a backwards seek, so two takes never fuse.
  const passes = [];
  let current = null;
  for (const sample of samples) {
    if (!Number.isFinite(sample?.time) || sample.time < 0) continue;
    if (
      !current ||
      current.id !== sample.pass ||
      sample.time < current.samples.at(-1).time - 0.001
    ) {
      current = { id: sample.pass, samples: [] };
      passes.push(current);
    }
    // Duplicate timestamps are paused measurements, not extra song coverage.
    if (current.samples.length && sample.time === current.samples.at(-1).time)
      current.samples[current.samples.length - 1] = sample;
    else current.samples.push(sample);
  }
  let targetDuration = 0,
    voicedDuration = 0,
    pitchSum = 0;
  let timingSum = 0,
    timingCount = 0,
    stabilitySum = 0,
    stabilityDuration = 0;
  const hotspots = [];

  for (const pass of passes) {
    if (pass.samples.length < 2) continue;
    const start = pass.samples[0].time;
    const end = pass.samples.at(-1).time + CADENCE;
    let pointer = 0;
    const nearest = (time) => {
      while (
        pointer + 1 < pass.samples.length &&
        Math.abs(pass.samples[pointer + 1].time - time) <=
          Math.abs(pass.samples[pointer].time - time)
      )
        pointer++;
      const sample = pass.samples[pointer];
      return Math.abs(sample.time - time) <= 0.1
        ? sampleMidi(sample, referencePitch)
        : null;
    };
    const bins = [];
    let noteIndex = 0;
    for (let time = start; time < end - 0.001; time += CADENCE) {
      while (noteIndex < melody.length && melody[noteIndex].end <= time)
        noteIndex++;
      const note = melody[noteIndex];
      const midi = nearest(time);
      const duration = Math.min(CADENCE, end - time);
      const target =
        note && note.start <= time && isVoicedNote(note) ? note : null;
      const cents = target && midi !== null ? (midi - target.midi) * 100 : null;
      bins.push({ time, midi, note: target, cents, duration });
      if (!target) continue;
      targetDuration += duration;
      if (midi !== null) {
        voicedDuration += duration;
        pitchSum += pitchCredit(cents) * duration;
      }
    }

    for (let i = 0; i < melody.length; i++) {
      const note = melody[i];
      if (!isVoicedNote(note) || note.end <= start || note.start >= end)
        continue;
      const noteBins = bins.filter((bin) => bin.note === note);
      if (noteBins.length < 3) continue;
      const voice = noteBins.filter((bin) => bin.midi !== null);
      const observedDuration = noteBins.reduce(
        (sum, bin) => sum + bin.duration,
        0,
      );
      const previous = melody[i - 1];
      const continuing =
        previous &&
        isVoicedNote(previous) &&
        previous.midi === note.midi &&
        Math.abs(previous.end - note.start) < 0.025;
      if (!continuing && note.start >= start - 0.1 && note.start < end - 0.1) {
        // Require two consecutive in-pitch observations: one accidental crossing
        // is not evidence that the singer entered the note.
        const onsetBins = bins.filter(
          (bin) =>
            bin.time >= note.start - 0.15 &&
            bin.time < Math.min(note.end, note.start + 0.65),
        );
        let reached = null;
        for (let j = 0; j + 1 < onsetBins.length; j++) {
          const a = onsetBins[j],
            b = onsetBins[j + 1];
          if (
            a.midi !== null &&
            b.midi !== null &&
            Math.abs(a.midi - note.midi) <= 0.5 &&
            Math.abs(b.midi - note.midi) <= 0.5
          ) {
            reached = a.time;
            break;
          }
        }
        const delay = reached === null ? null : reached - note.start;
        timingSum +=
          delay === null
            ? 0
            : clamp(100 - (Math.max(0, Math.abs(delay) - 0.05) / 0.5) * 100);
        timingCount++;
        if (delay !== null && delay > 0.15)
          hotspots.push({
            start: note.start,
            end: Math.min(note.end, reached + 0.1),
            type: "late",
            label: "Entered note late",
            detail: `Reached the target about ${Math.round(delay * 1000)} ms after its onset.`,
          });
      }
      if (
        observedDuration >= 0.4 &&
        voice.length >= 6 &&
        voice.length / noteBins.length >= 0.5
      ) {
        const values = voice.map((bin) => bin.midi * 100);
        const center = median(values);
        const deviation = Math.sqrt(
          values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
            values.length,
        );
        const stability = clamp(100 - Math.max(0, deviation - 10) * 1.3);
        stabilitySum += stability * observedDuration;
        stabilityDuration += observedDuration;
      }
      if (observedDuration < 0.2) continue;
      if (voice.length / noteBins.length < 0.4) {
        hotspots.push({
          start: Math.max(start, note.start),
          end: Math.min(end, note.end),
          type: "missing",
          label: "Little voiced pitch detected",
          detail:
            "Most of this target note had silence or an unreliable pitch reading.",
        });
      } else {
        const offsets = voice.map((bin) => bin.cents);
        const average =
          offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
        const outOfTune =
          offsets.filter((value) => Math.abs(value) > 50).length /
          offsets.length;
        if (outOfTune > 0.5 && Math.abs(average) > 30)
          hotspots.push({
            start: Math.max(start, note.start),
            end: Math.min(end, note.end),
            type: average < 0 ? "flat" : "sharp",
            label: average < 0 ? "Mostly flat" : "Mostly sharp",
            detail: `Voiced pitch averaged ${Math.round(Math.abs(average))} cents ${average < 0 ? "below" : "above"} the target.`,
          });
        else if (
          observedDuration >= 0.7 &&
          voice.length / noteBins.length > 0.8 &&
          offsets.every((value) => Math.abs(value) <= 30)
        )
          hotspots.push({
            start: Math.max(start, note.start),
            end: Math.min(end, note.end),
            type: "good",
            label: "Good sustained pitch",
            detail:
              "Detected voice stayed within 30 cents of the target throughout the observed note.",
          });
      }
    }
  }
  if (targetDuration < 0.5)
    return empty(
      "At least half a second of target notes must be practiced to calculate scores.",
    );
  if (voicedDuration < 0.35)
    return {
      ...empty(
        "Not enough reliable singing pitch was detected to calculate scores. Try a steady note, a closer microphone, and headphones.",
      ),
      coverage: round((voicedDuration / targetDuration) * 100),
      hotspots: hotspots.slice(0, 8),
    };
  const pitchAccuracy = pitchSum / targetDuration;
  const timingAccuracy = timingCount ? timingSum / timingCount : null;
  const stability = stabilityDuration ? stabilitySum / stabilityDuration : null;
  const metrics = [
    [pitchAccuracy, 0.65],
    [timingAccuracy, 0.2],
    [stability, 0.15],
  ].filter(([value]) => value !== null);
  const overall =
    metrics.reduce((sum, [value, weight]) => sum + value * weight, 0) /
    metrics.reduce((sum, [, weight]) => sum + weight, 0);
  // Repeated loops can produce the same observation. Keep the strongest issues
  // first and deduplicate identical positions instead of filling the review.
  const unique = new Map();
  for (const hotspot of hotspots)
    unique.set(
      `${hotspot.type}:${hotspot.start.toFixed(2)}:${hotspot.end.toFixed(2)}`,
      hotspot,
    );
  return {
    pitchAccuracy: round(pitchAccuracy),
    timingAccuracy: round(timingAccuracy),
    stability: round(stability),
    overall: round(overall),
    coverage: round((voicedDuration / targetDuration) * 100),
    hotspots: [...unique.values()]
      .sort(
        (a, b) =>
          Number(a.type === "good") - Number(b.type === "good") ||
          a.start - b.start,
      )
      .slice(0, 8),
    reason: null,
  };
}
