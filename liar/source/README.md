# Liar Table

Private multiplayer bluffing cards for 2–4 friends. Create a room, share its code or invite link, ready up, and play on independent phones, tablets, or computers.

## Game

- Classic deck: 6 Aces, 6 Kings, 6 Queens, 2 Jokers. Five cards per living player each round.
- A randomly chosen Ace, King or Queen defines the table. Play 1–3 cards face down, claiming that rank. Jokers always match.
- Only the next eligible player may challenge the immediately preceding play. Any off-rank card punishes the accused; an entirely valid claim punishes the caller.
- Empty hands are skipped, and the sole player with cards must challenge. Emptying a hand does not win the match.
- Each player has one server-secret lethal chamber among six. Pulls advance without a reset across rounds. Survivors receive fresh hands; one survivor wins.
- Seat order and the initial starter are randomized. Play proceeds counterclockwise. The penalized survivor opens the next round; after elimination the next surviving seat opens it.

The original game is [Liar’s Bar by Curve Animation](https://store.steampowered.com/app/3097560/Liars_Bar/). The classic rules were checked against [this detailed gameplay reference](https://www.debigare.com/how-to-play-liars-deck-from-liars-bar-full-rules-and-variants/) (revision 2026-08-31). This is an original browser interface, not the official game or its assets. Devil, Chaos, Dice and Deck 2 modes are excluded.

### Browser session policy

These operational choices are explicit, rather than claimed as verified behavior of every Liar’s Bar release: a 30-second inactive turn automatically plays one random card, or calls the mandatory challenge. An unattended roulette pull resolves after 14 seconds, and an intermission lasts 6 seconds. Deliberately leaving forfeits the seat and starts a fresh round for survivors. An offline host transfers after 90 seconds. Rooms expire six hours after their last game-state update. There is no voice chat or public matchmaking.

## Multiplayer architecture

The Cloudflare Worker owns all game state in D1. Polls synchronize approximately once a second in foreground tabs. Clients receive an explicit per-player view; other hands, uncalled card identities and lethal chambers never reach the client, including the host.

Room codes grant lobby access. Each player also has a random 256-bit bearer session stored on their own device; only its SHA-256 hash is stored in the room. Refresh restores a seat on that browser. There are no accounts. Do not share the browser’s stored session token.

Game updates use compare-and-swap revisions and deduplicated action IDs. Separate presence records prevent heartbeat traffic from invalidating moves. Late moves, full rooms, duplicate names, foreign cards, repeated cards, out-of-turn actions and non-host lobby mutations are rejected on the server. Rate limits bound room creation, joins and actions. Requests use same-origin checks and no-store responses. Expired data is cleaned on room creation.

## Development

Node 24 or newer is recommended (the tests use built-in TypeScript stripping and SQLite).

```sh
npm ci
npm run dev
npm run build
node --test tests/game.test.mjs tests/service.test.mjs
```

Keep the package lock. The app uses React, Vinext, the supplied accessible dialog primitives, and a D1 binding named `DB`. `db/schema.ts` defines the schema; `drizzle/` contains generated migrations. Apply migrations before serving the multiplayer API. No API keys are required for gameplay.

Source map: `app/table.tsx` and `app/globals.css` contain the UI, `lib/game.ts` is the rules engine, `lib/service.ts` handles authenticated room operations, and `app/api/game/route.ts` exposes the API. `worker/index.ts` is the Worker entry point. `lib/audio.ts` synthesizes optional sound effects without external assets.

GitHub Pages can host the launch page but cannot run the stateful API. The full application runs on the linked Worker hosting; the GitHub launch page preserves room invitations when opening it.

## Checks

Rules tests cover deck composition, deal uniqueness, truthful/Joker/mixed-card challenges, forced calls, skipped hands, illegal actions, all six roulette pulls, continued risk, rematches, timeout progression and 80 complete simulated matches. API tests use the generated SQL in SQLite to exercise four independent sessions, reconnects, idempotent retries, simultaneous joins, stale revisions, host transfer, private projections and origin checks.

The layout includes touch controls, narrow-screen layouts, visible focus, reduced-motion support, sound mute and a private-hand toggle. Keyboard: 1–5 select cards, Enter plays, L calls, H hides the hand, M mutes. Physical-device and browser UI testing were not performed in this build.
