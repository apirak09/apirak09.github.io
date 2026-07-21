# Level Design Notes

| Level | Core lesson | Bird focus | Par |
|---|---|---|---:|
| 1. Woodland Welcome | Remove load-bearing wood | Red | 2 |
| 2. Crystal Feet | Brittle glass foundations | Blue split | 2 |
| 3. Three Little Rooms | Time a split across multiple supports | Blue split | 2 |
| 4. High Perch | Long-range arc and mid-flight acceleration | Yellow boost | 2 |
| 5. Fuse Lesson | Trigger a TNT chain efficiently | Red / Bomb | 1 |
| 6. Counterweight | Use torque and a long beam | Red / Yellow | 2 |
| 7. Stone Shell | Detonate inside a heavy bunker | Bomb | 2 |
| 8. Twin Collapse | Make one tower fall into another | Yellow / Blue / Bomb | 2 |
| 9. Needle Thread | Control power through a narrow corridor | Yellow boost | 2 |
| 10. The Last Fortress | Combine glass, TNT, stone, and bird abilities | Mixed roster | 4 |

## Balance rules

- Three stars: clear at or below par.
- Two stars: clear at par + 1.
- One star: any clear above par + 1.
- Unused birds grant 10,000 points each.
- Destruction combos increase block and pig point values when events occur within 0.9 seconds.

## QA performed

- JavaScript syntax validation for all source files.
- Runtime initialization through a mocked DOM/canvas environment.
- Repeated launch simulation and next-bird flow tests.
- Ability tests for blue split, yellow boost, and bomb detonation.
- Static-settle tests across all ten stages: no stage loses pigs or blocks before the first shot.
- Multi-shot stress tests across all levels with checks for non-finite positions/velocities.
- Automated shot-search passes confirming executable win paths, including the precision stage and finale.
