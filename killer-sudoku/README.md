# Killer Sudoku

A compact, responsive Killer Sudoku game with unlimited procedural puzzles. No account, puzzle subscription, database, or third-party runtime is required.

**Play:** https://apirak09.github.io/killer-sudoku/

## Playing

Fill every row, column, and 3 × 3 box with the digits 1–9 without repetition. A dotted cage's small number is its sum. Digits cannot repeat inside a cage, even across different rows or boxes. A one-cell cage tells you its value.

- **New puzzle:** choose Easy, Medium, Hard, or Expert. Confirming replaces the current game; canceling preserves it.
- **Notes:** pencil multiple possibilities into a cell. Entering a number removes that candidate from notes in its row, column, box, and cage. Undo restores those notes too.
- **Hint:** explains a cage remainder, naked single, or hidden single where available. A fallback solution reveal is explicitly labeled and needs a second click. Wrong entries are pointed out before deductions are offered.
- **Check my puzzle:** highlights incorrect entries without ending the game. There is no mistake limit.
- **Pause:** hides the grid and stops the timer. Switching away automatically pauses play. Dialogs also stop the timer.
- **Saved progress:** the current puzzle, entries, notes, elapsed time, and undo history are kept on the current browser/device. Theme preference is separate. A blocked or full storage area is reported in the interface.
- **Cage combinations:** optionally show sum combinations compatible with entered digits; these are arithmetic options, not a guarantee that each fits the whole grid.

Keyboard: `1`–`9` enter numbers; arrows move; `N` toggles notes; `Backspace`, `Delete`, or `0` erase; `Ctrl/⌘ Z` undoes; `Ctrl/⌘ Shift Z` or `Ctrl Y` redoes; `H` offers a hint; `Space` pauses from the grid. All essential actions also have touch controls.

## Generation and difficulty

1. A cryptographically selected 32-bit seed drives deterministic randomized backtracking to create a fresh complete Sudoku grid. A fixed solved grid or puzzle bank is not used.
2. The generator begins with 81 single-cell cages and considers random adjacent cage merges. Connected cages contain distinct solution digits.
3. Each proposed merge is accepted only after counting solutions under all row, column, box, cage-sum, and cage-uniqueness constraints. Exactly one solution must remain. A search-budget exit is treated as a rejection, never as proof of uniqueness.
4. A final independent invocation of the production counter verifies the resulting puzzle. Generation runs in a module Web Worker, keeping the interface responsive. Worker errors and timeout produce a retry path and preserve the previous game.
5. The last 100 seeds are avoided on that browser. There is no play limit; the random space is large but finite. The displayed puzzle number identifies its seed.

| Level | Cage-count target | Maximum cage size | Solver branch ceiling |
| --- | ---: | ---: | ---: |
| Easy | 40 | 3 | 0 |
| Medium | 33 | 4 | 12 |
| Hard | 28 | 5 | 160 |
| Expert | 24 | 6 | 900 |

Easy must solve using cage-combination filtering plus naked and hidden singles, without branching. The other levels allow progressively larger cages, lower clue density, and more solver search. These are procedural difficulty bands, not standardized human ratings: individual puzzles vary. If a further merge would lose uniqueness or exceed the level's search limit, generation keeps more cages than the target. Correctness takes precedence over a fixed cage count.

## Files and development

The GitHub Pages folder contains `index.html`, `styles.css`, `app.mjs`, `core.mjs`, `state.mjs`, `generator.worker.mjs`, and `icon.svg`. In the standalone Sites checkout those public files are under `dist/`.

Use an HTTP server; module scripts and workers do not reliably run from `file://`:

```sh
python -m http.server 8000
```

Then open `/killer-sudoku/` when serving the full GitHub repository, or `/dist/` when serving the standalone checkout. No install or build step is needed.

Run the engine and state verification with Node.js:

```sh
node --test tests/core.test.mjs
```

From the full GitHub repository, use `node --test killer-sudoku/tests/core.test.mjs` instead.

The tests check 24 puzzles across four levels and six seeds with an independently implemented solution counter, cage connectivity and sums, Sudoku rules, uniqueness, difficulty limits, ambiguity rejection, deterministic regeneration, notes, undo/redo, hints, completion, and saved-game validation. Static checks cover module syntax, element IDs, and local asset resolution. Browser visual/interaction testing was not performed in this environment. Optional WebMCP registration is feature-detected; it exposes visible state and validated number entry, never the solution. A supported WebMCP context was unavailable for runtime verification.

Everything runs locally in the browser. Saved progress does not synchronize between devices or between the GitHub Pages and private Sites origins.
