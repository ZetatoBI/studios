# Roost Rivals: design and handover

Bird turf-war strategy game in the style of State.io, by Zetato Studios. Ad-free, offline, installable.
Live folder: `games/roost-rivals/`. This file is the reference for anyone (or any Claude session) changing the game.

Current version: 0.4.0 beta (core version 4).

## 1. What the game is

- You own buildings ("roosts") that hatch birds. Send flocks to take neutral and rival buildings. Last flock standing wins,
  or the flock holding the most birds at nightfall (4:30). One screen, portrait, one thumb. Matches run 1 to 2 minutes.
- Buildings have levels 1 to 5 (stars under each). Tap one of yours once to upgrade it for birds.
- **Story** (main mode): 5 districts x 6 stages, a boss at the end of each district, 3 stars per stage
  (win; win under a time limit; win without losing a building). Fixed map per stage. Beating a boss opens the next district
  and unlocks a bird. Stars pay 12 feathers each, once.
- **Quick match**: random district, rivals from your difficulty band, feeds the Pecking Order ladder
  (Hatchling, Fledgling, Songbird, Kestrel, Falcon, Eagle, Apex; 200 feathers per rank; a rank once reached is kept).
- **Daily Flight**: one seeded match per day with a twist; first win pays +20 feathers; losing costs nothing.
- Five birds, each with one passive edge and one call (active ability, 32 s cooldown, first ready at 14 s).
- Ten named rivals with five personalities. In quick matches the rival who last beat you returns as your nemesis.
- Difficulty: Easy / Medium / Hard (Settings or the home link). Rival toughness is shown as sharpness 1 to 5 (dots).

## 2. Rules that must not regress

1. No ads, no energy timers, no paywalls, no accounts, no tracking. Progress stays on the device.
2. Rivals never cheat. They hatch, fly, send (25/50/75/100%), call and upgrade by the player's rules. They play like people:
   they estimate roost sizes with error, give one or two orders per look, round sends up, sometimes gamble and sometimes miss
   an attack. Sharpness changes only how often they look, how big their error is and how often they notice threats.
3. The core stays deterministic (section 4). Run `node dev/roost-rivals/verify-replay.mjs` after any change to it.
4. Bird balance stays inside the targets in section 6. Run the balance bot after any change to birds, calls, buildings,
   map generation or rival AI, and put the output in the PR.
5. Colour is never the only cue: your buildings fly a gold flag; bakeries have a striped awning; bell towers carry a spire;
   levels show as stars; the top bar shows each flock's bird and power icon.
6. Every in-match banner states its rule in plain words, so the game teaches itself.
7. Taps are forgiving: the nearest building within a wide radius is chosen for taps and drag targets.
8. Zetato Studios intro: about 1.5 s, plays and passes without a tap.
9. Storage keys and the manifest id never change without a migration (section 7).

## 3. Files

| Repo path | What it is |
|---|---|
| `games/roost-rivals/index.html` | The whole game: styles, markup and three script blocks (core, UI, install/update) |
| `games/roost-rivals/sw.js` | Offline worker with silent updates (same pattern as Ice Crown) |
| `games/roost-rivals/manifest.webmanifest` | Install details. id is `/games/roost-rivals/app` |
| `games/roost-rivals/icons/`, `cover.png` | App icons (crowned gold bird on a level-5 roof) and the Studios page image |
| `dev/roost-rivals/DESIGN.md` | This file |
| `dev/roost-rivals/balance/run-balance.mjs` | Balance bot (Node only, no browser) |
| `dev/roost-rivals/verify-replay.mjs` | Determinism and replay check (Node only), covers every district and head starts |

Both dev tools read the core straight out of `games/roost-rivals/index.html`, so they always test what players get.

## 4. Architecture (built so online duels can be added)

Three layers inside `index.html`, in three `<script>` blocks:

```
 touch / buttons ──► Session.send(cmd) ──► CORE (RR): cmd queue ─► step() every 1/30 s ─► state S (plain data)
                          ▲                      ▲                                             │
        (future) other phone's orders      rival AI issues the same orders                     ▼
                                                                                  UI reads S and draws it
```

**Core (`RR`, first script block).** Pure rules and rival AI. No DOM, no clock, runs in Node unchanged.
- Fixed ticks: `RR.step(S)` advances exactly 1/30 s. The screen glides birds between ticks; the rules never see frame rate.
- Commands are the only way in: `RR.cmd(S, {k:'send', p, from, to, r}, delay)`, `{k:'call', p}`, `{k:'up', p, from}` (upgrade), `{k:'quit', p}`.
  `RR.cmdAt` takes a command already stamped with its tick (network, replay). The core validates every command
  (ownership, the four send sizes, call cooldown), so a tampered client cannot send illegal orders.
- Deterministic: one seeded random stream stored in the state (`S.rs`). The core must not use `Math.random`, `Date`,
  `Math.sin/cos/tan/atan2/hypot/pow/exp/log` (these can differ between phones); it uses only `+ - * /`, `Math.sqrt`,
  `Math.floor/round/min/max/abs/imul`. Sorts carry an explicit tie-break. Keep it that way.
- Plain data: `S` is JSON. `RR.snapshot(S)` / `RR.restore(str)` give mid-match resume today and reconnect later.
- Proof: `RR.hash(S)` is a fingerprint of the match state. `RR.replay(setup, log)` re-runs a whole match from its setup
  and command log. `S.setup` and `S.log` are kept in the state for that purpose.
- `soloEnd` option: in solo play the match ends the moment seat 0 is out. Duels leave it off.
- `theme` option picks the district (changes only the building mix). `start` gives a seat a head start (story bosses).

**UI (second script block).** Rendering, touch, sound, menus, progression. It reads `S` and never writes to it.
Every order goes through `Session.send`. The local player's seat is the variable `SEAT` (always 0 today) and colours are
seat-relative (`colOf`), so "you are gold" holds for either seat.

**Install/update (third script block).** Service worker registration and the install hint. Only active on zetatobi.com.

### What is already in place for multiplayer
- Lockstep-ready core: fixed ticks, command queue with input delay, validation, hash, snapshot, replay.
- A pure two-human match already works in the core (`verify-replay.mjs` plays AI-free duels).
- `Session` has `delay`, a `transport` slot and `receive()`.
- Replays: the result screen's "Watch replay" runs entirely on setup + log, which is the same data a server would check.
- An anonymous player id (`pid` in the save), created on first launch and kept on the device.

### What a friend duel still needs (phase 1)
1. A transport: `{ send(cmd) }` on our side, and call `Session.receive(cmd)` for the other player's orders.
   A small relay is enough (for example a WebSocket room on Cloudflare Workers, or WebRTC with a signalling endpoint).
2. A tick gate in the frame loop: do not run tick T until the other phone has confirmed its orders up to T
   (each phone sends a tiny "done up to tick N" message a few times a second). Set `Session.delay` to about 3 ticks (100 ms).
3. Hash exchange every second or so (`RR.hash`); on mismatch, the host sends `RR.snapshot` and the guest restores.
4. Seat flip for seat 1: draw the map rotated 180 degrees so both players play from the bottom (view code only).
5. A lobby: room code or share link, bird pick for both, a server-chosen seed, a rematch button.
6. Disconnect rule: after a timeout the relay issues `{k:'quit'}` for the missing player.

### What ranked duels add (phase 2)
1. Accounts, so a rating follows a person (upgrade `pid` to a signed-in id).
2. Matchmaking by duel rating. Keep duel rating separate from the solo Pecking Order.
3. A referee: both phones upload `{setup, log, final hash}`; the server runs `RR.replay` (the same core file, in Node or a
   Worker) and awards rating only when its result agrees. `verify-replay.mjs` is the starting point for that referee.
4. Seasons, leaderboard, and reports for stalling or abuse.

There is no hidden information in the game (both players see the whole map), so there is nothing to "map-hack".
The main cheating risks are illegal commands (blocked by core validation) and lying about results (blocked by the referee).

## 5. Systems reference

**Buildings.** Level 1-5: cap 20/30/45/60/80, hatch 0.55/0.75/1/1.3/1.65 of base (0.8 birds/s), defence +6% per level above 3
(-6% per level below). Upgrade cost from level 1-4: 10/16/22/30 birds. Bakery (feeder): hatch x1.5. Bell tower: defence x1.4,
hatch x0.85. A building above its cap shrinks back slowly. Maps are symmetric (2 players: point symmetry; 3 to 4: four-fold)
and start buildings at levels 2-4 (home: level 3, 20 birds).

**Districts.** Look and building mix only; the rules are the same. Quick matches add the district's twist.

| District | Building mix | Twist (quick match and story) |
|---|---|---|
| Featherby Rooftops (city) | standard | none |
| The Harbour | standard | strong sea wind |
| Market Square | many bakeries | chips drop twice as often |
| Old Town | many bell towers | alley cats twice as often |
| The Skyline | buildings start one level higher | none |

**Flocks.** Birds stream out at 14 per second, fly at 128 units/s (map is 1000 x 1400), wind adds or removes up to 28%
(50% in a gale). Rival birds that meet in the air cancel one for one.

**Events.** Cat: every 24 to 36 s, warns for 5 s on the fullest building (24+ birds), then scatters 40%.
Fries: every 30 to 44 s on a non-start building; whoever holds it after 9 s gains 14 birds.

**Birds (v0.4.0).**

| Bird | Unlock | Passive | Call |
|---|---|---|---|
| Pigeon | start | hatch +6% | Brood: hatch +30% for 6 s |
| Gull | Fledgling, or beat story district 1 | flight +45% | Tailwind: flocks in the air x2.5 speed for 6 s |
| Owl | Songbird, or district 2 | defence +12% | Hunker: defence +30% for 6 s |
| Crow | Kestrel, or district 3 | attack +10% | Mob: attack +50% for 6 s |
| Starling | Falcon, or district 4 | +1 bird on each capture | Murmuration: +2 birds at every building held |

**Rival AI.** One `skill` number from 0 to 1, shown to players as sharpness 1-5 (thresholds 0.22 / 0.36 / 0.50 / 0.64).
Looks every 3.2 - 2.0 x skill seconds (randomised); estimate error 30% - 18% x skill; notices incoming attacks with chance
25% + 75% x skill; 1 order per look (2 from skill 0.65); attack sources 1 to 3; occasional gambles at every level; above 0.5
moves idle birds forward and counts production during travel; above 0.55 may dodge the cat. Upgrades a safe, full building now
and then (personality-dependent). Opening manners: no attacks on anyone's building in the first 12 s (rushers: 7 s).

**Difficulty bands (quick match).** Skill = lo + (hi - lo) x min(1, feathers / 1200), +0.02 per win in a streak (max 3),
-0.03 per loss in a row (max 3). Easy 0.12-0.32 (wins pay 60%), Medium 0.32-0.56, Hard 0.56-0.82 (wins pay 150%).
Rivals: 1 until Fledgling, 2 until Kestrel, then 3. The first ever match is against a near-idle rival with coach text.

**Story.** Stage skill is fixed per stage (0.05 at 1-1 rising to 0.76 at 5-6), shifted by difficulty (Easy -0.12, Hard +0.1).
Bosses start with a level-4 home building and 22 birds (districts 1-2) or 26 (3-5). Time goals: 1:40 with one rival,
2:10 with two, 2:40 with three. Stage data lives in `STORY` in the UI script.

**Feathers.** Quick win: 26 + 6 per rival, +6 under 90 s, +10 for beating your nemesis, +20 first Daily Flight win of the day,
then x difficulty multiplier. Quick loss: up to -16 by placing (nothing as a Hatchling or in the Daily Flight).
Story: 12 per new star.

## 6. Balance targets and current results

Run: `node dev/roost-rivals/balance/run-balance.mjs 200` (about 4 minutes).

| Check | Target | v0.4.0 result |
|---|---|---|
| Bird win rate, 1v1, equal skill | each 45 to 55% | 46.6 to 52.1% |
| Bird win share, four-way | each 21 to 29% | 22.6 to 29.0% (owl highest, gull lowest) |
| Skill ladder | stronger rival wins more at every step up to 0.9 | holds (58 to 89%); flat at the very top by design |
| Start corner fairness, four-way | about 25% each | 24.0 to 25.5% |
| Match length, 1v1 rivals | median 60 to 90 s | 59 s |
| Bird balance per district (skill 0.5, 600 matches each) | each 45 to 56% | 45 to 56% |
| Replay check | 100% identical | 60 of 60 matches, all districts and head starts |

Known leans: the owl does best in crowded four-way matches and the gull worst. Turtle and expander rivals lose more often
than rushers; they read as the gentler rivals. Boss head starts are tuned by simulation only.

## 7. Release rules

- Bump the version in three places that must match: `VERSION` in `games/roost-rivals/sw.js`, `VERSION` in the UI script
  and `VERSION` in the install/update script at the end of `games/roost-rivals/index.html`.
- Never rename storage keys: `roostrivals.v1` (progress, including `story` stars), `roostrivals.match` (match in progress),
  `roostrivals.installHint`. New save fields get a default in `DEF`; old saves pick it up automatically.
- A saved match from an older core is dropped on load when `CORE_VERSION` changes. Bump `CORE_VERSION` whenever the
  rules change in a way that would make an old snapshot or replay play out differently. (v0.4.0 is core 4.)
- Never change the manifest id (`/games/roost-rivals/app`), `start_url` or `scope`.
- Before any PR: load the game headless and confirm no page errors; run both dev tools.

## 8. Known limitations

- Played by the owner only; story bosses and the upper difficulty bands are tuned by simulation.
- No music or ambient sound; effects only. Story text appears on cards and briefings, without illustrations.
- Replays are kept for the last match only and are not saved across launches.
- Online play is prepared for but not built (section 4).
- The name was checked by web search only; check both app stores before a store submission.

## 9. Roadmap (proposed; confirm with the owner before starting)

1. Tuning pass from real playtests (boss strength, time goals, difficulty per rank).
2. Friend duels (phase 1 above).
3. More story: a sixth district, boss-specific map shapes, simple illustrated story cards.
4. Optional ambient sound with an off switch.
5. Ranked duels (phase 2 above).
