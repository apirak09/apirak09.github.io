# 12 Islander – The Broken Seesaw

**[Play the game](https://apirak09.github.io/islander/)**

A complete static browser puzzle with twelve rendered character dolls, touch/mouse dragging, keyboard controls, live candidate hints, a weighing journal, original synthesized audio, and a seesaw that breaks after three uses. There is **no preassigned impostor**.

## Full game loop

1. Start with twelve people on the ground and all 24 truths possible. Each truth identifies one person and whether they are heavier or lighter. The other eleven always have identical weight.
2. Drag people to either wooden platform, or select a doll and use the Left / Right / Ground buttons. Equal, nonzero headcounts are required. No one can occupy two positions.
3. Press **Weigh**. Placement is locked while rope tension and wood cracking play. Exactly one of the three remaining uses is spent.
4. Simulate left-heavy, right-heavy and balanced results for every surviving truth. Retain the outcome with the largest group. Resolve equal-size ties randomly; the tie never establishes a hidden impostor.
5. Animate the tilt, save the complete arrangement and result to the journal, and recolor the candidates. Surviving truths must agree with every previous result.
6. Rearrange and repeat. First use: cracks. Second: stronger shaking and damage. Third: the last violent strain, followed by a broken seesaw and permanently disabled weighing.
7. If multiple truths remain after the third use, the investigation fails. Display all remaining explanations rather than inventing an impostor. If exactly one remains, ask the player to name both the person and weight difference. Both correct = victory; either wrong = failure. Restart restores all 24 truths.

## People and positions

| ID | Name | Rendered appearance |
|---|---|---|
| A | Noon | Pale Chinese-Thai woman, straight black hair, glasses, elegant cream outfit |
| B | Nene | Black bardot evening gown with thigh slit, black heels, thin glasses |
| C | Nam | Wavy brown hair, rectangular sunglasses, lavender cardigan, cream skirt, black tights, white sneakers |
| D | Pang | Green-wave/red-sun graphic T-shirt, wide-leg jeans, necklace |
| E | Ploi | Dark textured academic layers, white inner layer, round glasses, pendant |
| F | May | White ribbed V-notch top, round glasses, heart choker, red bracelet, jeans |
| G | Koun | Fit build, formal white shirt, navy emblem tie |
| H | Sor | Muslim man, Chemical Engineering jersey, black shorts, green wristband, knee bandage |
| I | Pok | Navy FINNICK fox sweatshirt, reindeer antler headband |
| J | Audi | Rose-print open shirt, graphic tee, watch and bracelet |
| K | Nine | Blue Pepsi shirt, khaki shorts, gray crossbody bag |
| L | Non G | Dark blazer, white graphic tee, round glasses |

Appearance is flavor only: no visual feature changes the weight simulation or candidate status. Every character is rendered in the same style and scale. The source atlas is a 6-column × 2-row transparent image with one 256 × 512 cell per person.

```js
const person = { id: 'A', name: 'Noon', description: '…' };
const positions = { A: 'L', B: '-', C: 'R', /* D through L … */ };
// L = left platform; R = right platform; - = ground.

const truths = PEOPLE.flatMap(({ id }) => [
  { id, kind: 'heavy' },
  { id, kind: 'light' },
]); // 24 unique states; no separate `impostor` field.

const game = {
  positions,
  truths,
  history: [{ round: 1, positions: { /* immutable snapshot */ },
    result: 'L', before: 24, after: 8,
    counts: { L: 8, '-': 8, R: 8 }, truths: [ /* survivors */ ] }],
  phase: 'arranging', // then accusing, won, or lost
};
```

## Worst-case algorithm

The implementation is in `core.mjs`. With equal headcounts, all normal weight cancels. A heavier person on the left makes the left heavier; a lighter person on the left makes the right heavier. A suspect left on the ground gives a balanced result. Right-side placement mirrors left-side placement.

```js
function worstCase(truths, positions, tieIndex) {
  const groups = { L: [], '-': [], R: [] };
  for (const truth of truths) {
    groups[simulate(truth, positions)].push(truth);
  }
  const largest = Math.max(...Object.values(groups).map(g => g.length));
  const tied = ['L', '-', 'R'].filter(result => groups[result].length === largest);
  const result = tied[tieIndex % tied.length];
  return { result, truths: groups[result] };
}
```

Runtime is O(S), with S ≤ 24. The UI uses cryptographic random tie selection when available and a local pseudorandom fallback otherwise. No server, backend account, hidden character assignment, or runtime AI is involved. All rules are local and inspectable.

This is the specified **greedy largest-surviving-group adversary**; it does not claim to run a separate minimax search over future layouts. Ties are equally adverse in immediate candidate count.

## Interface and feedback

- The first screen is the live board. There is no landing-page barrier or tutorial gate.
- Drag full-body dolls with a pointer, mouse, or finger. A dragged copy follows the pointer; legal drop targets light up. A cancelled or off-board drop leaves the original position intact.
- Tap/click a doll, then a platform or a move button. Empty shore slots recall a placed doll. This avoids requiring precision dragging on a small screen.
- Keyboard: Tab / Enter selects; ← / → / ↓ moves; W weighs; Escape cancels. Platform buttons and dialogs are keyboard accessible, and native dialogs manage focus and Escape.
- Visual hints default on. **Red ↑** means could be heavier; **blue ↓** means could be lighter; a split red/blue state means both remain possible; **white ○** means proved normal. Candidate labels are also announced as text. Normal people remain usable as counterweights.
- Hint and audio preferences stay on the local device when storage is available. The puzzle still works if storage is blocked. Progress is not stored between reloads.
- Sound starts only after user interaction and is optional. Wind, rope creaks, wood cracks, movement, result tones, breakage, and ending stings are generated with Web Audio. Hidden tabs suspend audio.
- The journal shows all three arrangements, each observed result, candidate counts, and the three branch sizes. Branch sizes are revealed after spending a weighing.
- Motion respects `prefers-reduced-motion`. Responsive layouts support phones, tablets, and desktops; the board has no frame-rate-dependent game logic or time limit.
- Restart cancels pending presentation timers so an old weighing cannot change a new investigation. Inputs are locked during a weighing and after the seesaw breaks.

## Fairness, uncertainty, and endings

Equal headcounts are required because the virus changes weight only slightly. Unequal headcounts would measure the number of normal people instead. Empty or unequal arrangements are rejected without spending a use.

Each legal weighing has at most three possible outputs. With `r` uses remaining, at most `3 ** r` distinct result sequences remain. If the surviving count exceeds this limit, the interface warns that certainty is impossible, but still lets the player use the remaining weighings. Being under the bound is necessary, **not sufficient**, for solvability.

The game never rejects a move just because it differs from the reference matrix. Other valid strategies can succeed. A poor decision is punished through lost information, never by secretly changing a result to contradict earlier evidence. Repeating A versus B keeps 20 truths alive under balanced results, consumes all three uses, and fails. Guessing does not produce a lucky win.

| Ending | Condition |
|---|---|
| Victory | Exactly one truth after 3 uses; the player correctly identifies both person and weight direction |
| Uncertainty failure | More than one truth survives after the third use |
| Deduction failure | One truth survives, but the player submits the wrong person or direction |

## Verified reference strategy

| Round | A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | L | L | L | L | R | R | R | R | – | – | – | – |
| 2 | L | L | R | R | R | – | – | – | L | R | L | – |
| 3 | L | R | R | – | – | L | R | – | L | L | – | R |

The 12 column signatures and their reversals are all distinct, yielding 24 unique truth signatures. Exact column match means heavier; reverse L/R, leaving – unchanged, means lighter. This decoder applies only when all three reference arrangements were used in order. The general evidence engine works with every legal arrangement.

Under the specified adversary the reference reduces **24 → 8 → 3 → 1** for every permitted tie branch. The Field Guide includes this strategy behind an explicit reveal, so it does not spoil the opening puzzle.

## Run and validate

No package install or build step is needed. Serve the repository with any static HTTP server, then open `/islander/`. ES modules require HTTP; do not open the HTML through `file://`. GitHub Pages serves the folder directly. Local artwork is included; optional Google Fonts fall back to Georgia/system fonts when unavailable. Use a current browser with Pointer Events, native `dialog`, and ES modules. Sound additionally uses Web Audio when available.

```sh
python3 -m http.server 8000
node --test islander/tests/core.test.mjs
```

The test suite checks all 24 reference truths, all 18 worst-case reference tie leaves, independent physical mass simulations for 180 legal arrangements, 200 adversarial three-round histories, immutability, invalid placements, wrong accusations, non-reference solutions, and the three-use hard limit. These are automated logic checks, not a claim of physical-device or browser testing.

## Source map

| File | Responsibility |
|---|---|
| `index.html` | Board, journal, movement controls, accessible guide and ending dialogs |
| `styles.css` | Island art direction, doll atlas rendering, responsive controls, motion and damage states |
| `core.mjs` | Pure rules, 24 truths, simulation, partitioning, adversary, reference decoder, endings |
| `game.mjs` | Touch/mouse/keyboard input, DOM updates, round presentation, evidence, cancellation |
| `audio.mjs` | Original synthesized ambience and effects, audio lifecycle |
| `assets/*.webp` | Original AI-generated island, character atlas, and seesaw, compressed for delivery |
| `tests/core.test.mjs` | Puzzle invariants and exhaustive reference validation |

Character and environment artwork was created for this game using the built-in image-generation tool. Garment brand markings follow the requested character descriptions and do not imply endorsement.
