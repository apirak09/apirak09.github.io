# Level Design Notes — v33

All ten layouts use exact support surfaces. The `room` helper places a roof on two posts; pig positions are derived from their floor and radius. The layout is frozen while aiming, and independent gravity tests verify that it also remains stable without that freeze.

| Level | Core lesson | Par | Verified shots to clear |
| --- | --- | ---: | ---: |
| Woodland Welcome | Remove a wooden support | 2 | 1 |
| Crystal Feet | Split across glass supports | 2 | 1 |
| Three Little Rooms | Sweep separate glass rooms | 3 | 2 |
| High Perch | Reach an elevated target, then boost | 2 | 2 |
| Fuse Lesson | Start a TNT chain | 1 | 1 |
| Counterweight | Rotate a beam around its support | 2 | 1 |
| Stone Shell | Detonate near a stone bunker | 2 | 1 |
| Twin Collapse | Collapse connected towers | 2 | 1 |
| Needle Thread | Mix low tunnel and high shots | 2 | 2 |
| The Last Fortress | Combine glass, stone and TNT | 4 | 1 |

The recorded solutions are examples, not claims of minimum shot counts. Clever chain reactions can clear a level below par. Pars leave room for exploration; the campaign is intended to be approachable.

## Scoring

Three stars at or below par, two at par + 1, one for any other clear. Unused birds earn 10,000 points each. Destruction within 0.9 simulation seconds builds a combo, with a maximum 1.8× multiplier. Par and active simulation time also contribute to the result bonus; menu and aiming time are excluded.

## Reproducible validation

Run `npm test`. Every starting layout moves less than two world pixels under ten seconds of gravity. Every level has a legal winning-shot fixture replayed at three visual random seeds. Miss-only runs must reach loss and retry; a separate stress case keeps debris rotating to verify the bounded turn transition.

`tests/winning-shots.json` stores `[angleDegrees, powerFraction, abilityFrame]`, with frames measured at 60 Hz. `null` means no manual ability (Bomb may auto-detonate). These fixtures remain outside production gameplay.

Browser checks cover an opening-level clear, drag/precision controls, result navigation, and 390 × 780 / 844 × 390 responsive fixtures. Phone fixtures test layout and controls, not physical-device performance or touch hardware.
