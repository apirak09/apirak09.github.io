# Original verification exercise

`vocal-exercise.wav` is a deterministic 14-second generated tone exercise. Its
eight pitched intervals, rests, and text cues are original material created for
this app. No commercial audio or lyrics are used. The exercise material and its
generator may be used, modified, and redistributed without restriction.

The reference is A4 = 440 Hz, with notes C4, D4, E4, G4, E4, A4, G4, and C4.
The last C4 is held for 2.5 seconds. Silence at the beginning and between notes
gives the singer time to enter. The sound uses a fundamental and two quieter
harmonics, with short fades to prevent clicks.

Run `python tuner/demo/generate.py` from the repository root to regenerate the
WAV from `songs/demo-vocal-exercise/song.json`. No third-party libraries are
required. If you change note durations, also update `duration` in the generator.

Use headphones while practicing so the microphone captures your singing rather
than the audible guide. The reference tones are a practice aid; an acoustically
perfect recorded voice and device-independent timing are not implied.
