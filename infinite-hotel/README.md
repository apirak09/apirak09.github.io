# The Infinite Hotel

A standalone, playable mathematics lab inspired by [The Infinite Hotel Paradox — Jeff Dekofsky / TED-Ed](https://www.youtube.com/watch?v=Uj3_KqkI9Zo) and the [official lesson](https://ed.ted.com/lessons/the-infinite-hotel-paradox-jeff-dekofsky). The interface, interaction design, and code are original; no video, artwork, transcript, or audio is copied.

## Play

Choose an arrival scenario, choose a room rule, then run it or step through it. Tap any numbered room to inspect its occupants. Wrong rules give concrete counterexamples rather than an unexplained failure. Each shift starts with a fresh, fully occupied hotel.

1. **One guest:** shift every resident from n to n + 1; explore why a “last room” does not exist.
2. **A finite party:** vary the arrival count from 1 to 100 and reserve rooms by shifting residents.
3. **One infinite bus:** separate residents and new passengers into even and odd rooms.
4. **Several infinite buses:** vary the bus count from 1 to 8 and partition rooms by remainder.
5. **Infinitely many infinite buses:** compare the video's prime-power construction with diagonal enumeration. The diagonal alternative is an additional exploration, not presented as a method shown in the video.
6. **An uncountable set of guests:** an interactive Cantor diagonal construction finds a guest missing from any proposed room list. This is a detailed extension of the distinction between sizes of infinity.

The first four experiments include a safe custom affine rule `n → an + c`. Its checker reasons about positive destinations, injectivity, and intersection with the newcomer assignments. Sparse valid assignments are accepted: accommodating everyone does not require filling every room.

## Mathematical model

Rooms and seats are positive integers. Bus 0 denotes the residents. The model uses explicit functions and inverses instead of treating a finite array as an infinite hotel. The room window is cosmetic: a resident from outside the displayed prefix is still found correctly by inverse lookup.

| Scenario | Residents | Arrivals |
| --- | --- | --- |
| One guest | n + 1 | 1 |
| k guests | n + k | j, for 1 ≤ j ≤ k |
| One infinite bus | 2n | 2s − 1 |
| k infinite buses | (k + 1)n | (k + 1)(s − 1) + b |
| Infinite buses, primes | 2ⁿ | p_bˢ, where p_b is the b-th odd prime |
| Infinite buses, diagonal | Treat residents as bus 0 | d(d + 1)/2 + b + 1, with d = b + s − 1 |

Every destination is calculated with `BigInt`. The diagonal inverse uses an integer square root, avoiding floating point rounding. Prime occupancy is decoded from factorization and the prime's rank; empty composite rooms are represented honestly.

The uncountability demonstration uses infinite decimal strings over {1, 2}. Flipping the i-th digit of row i gives a decimal different from every row i. Digits 1 and 2 avoid the ambiguity of alternative decimal expansions ending in 9s.

### Display limits

- The room register shows 24 rooms at once and permits lookup through room 1,000,000. These are UI limits, not the end of the mathematical hotel.
- Guest lookup accepts positive integer indices up to 18 digits. The prime method bounds bus number to 500 and exponent to 1,000 to keep the interface responsive. Other mappings use exact integers.
- The animated diagrams and seven-row decimal table illustrate finite prefixes. They do not physically execute infinitely many moves or establish an infinite theorem by finite testing. The explanation panel supplies the general arguments.
- Assignments are simultaneous mathematical reassignments. Transient physical movement, time, distance, rent, and real hotel operations are outside this model.

## UX and implementation

No runtime dependencies, install step, build service, API keys, login, or backend. All required assets are local. Keyboard and touch controls, native accessible radio buttons and dialogs, optional synthesized audio, pause/resume, stage stepping, reduced-motion support, and mobile layouts are included. Progress lasts for the current visit; nothing is collected or sent to a server.

This folder contains the deployable static files. Serve it with any static HTTP server. ES modules require HTTP; opening `index.html` through `file://` is not supported in some browsers. In the GitHub repository, these files are published directly under `/infinite-hotel/`.

## Validation

Run `node --test infinite-hotel/tests/core.test.mjs` from the repository root. The tests cover mappings and inverse mappings, collision witnesses, distant integer precision, prime gaps, 20,000 diagonal inverse checks, custom affine rules, and the diagonal construction. Finite tests check implementation consistency; they are not substitutes for the mathematical proofs. Browser/device QA has not been performed in this build.

Source files: `core.mjs` (pure mathematical model), `app.mjs` (interaction), `styles.css`, `index.html`, `icon.svg`.
