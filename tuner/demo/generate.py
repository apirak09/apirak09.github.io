"""Regenerate the original 14-second exercise, using only Python's standard library.

Run this file from any directory. The note timings come from the same song.json
used by the trainer, so the asset and the target map cannot silently drift.
"""

import json
import math
from pathlib import Path
import struct
import wave

directory = Path(__file__).resolve().parent
song = json.loads((directory.parent / "songs/demo-vocal-exercise/song.json").read_text(encoding="utf-8"))
sample_rate = 16000
duration = 14
samples = [0.0] * (sample_rate * duration)

for note in song["notes"]:
    if note["midi"] is None:
        continue
    frequency = song["referencePitch"] * 2 ** ((note["midi"] - 69) / 12)
    first = round(note["start"] * sample_rate)
    last = round(note["end"] * sample_rate)
    for index in range(first, last):
        elapsed = (index - first) / sample_rate
        remaining = (last - index) / sample_rate
        envelope = min(1.0, elapsed / 0.025, remaining / 0.05)
        phase = 2 * math.pi * frequency * elapsed
        tone = 0.21 * math.sin(phase) + 0.025 * math.sin(2 * phase) + 0.015 * math.sin(3 * phase)
        samples[index] += tone * envelope

with wave.open(str(directory / "vocal-exercise.wav"), "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(sample_rate)
    output.writeframes(b"".join(struct.pack("<h", round(max(-1.0, min(1.0, sample)) * 32767)) for sample in samples))

print(f"Generated {duration}s original exercise: {directory / 'vocal-exercise.wav'}")
