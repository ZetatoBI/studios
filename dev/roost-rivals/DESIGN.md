# Roost Rivals: design and handover

Bird turf-war strategy game in the style of State.io, by Zetato Studios. Ad-free, offline, installable.
Live folder: `games/roost-rivals/`. This file is the reference for anyone (or any Claude session) changing the game.

Current version: 0.2.0 beta.

## 1. What the game is

- You own rooftops ("roosts") that hatch birds. Send flocks to take neutral and rival roosts. Last flock standing wins,
  or the flock holding the most birds at nightfall (4:30).
- One screen, portrait, one thumb. Matches run 1 to 2 minutes.
- Solo ladder ("Pecking Order"): Hatchling, Fledgling, Songbird, Kestrel, Falcon, Eagle, Apex. 200 feathers per rank.
  A rank, once reached, is never lost. Hatchlings lose nothing for a loss.
- Five birds, each with one passive edge and one call (active ability, 32 s cooldown, first ready at 14 s).
- Ten named rivals with five personalities. The rival who last beat you is your nemesis: it joins your next match,
  slightly sharper, and beating it pays a bonus.

## 2. Rules that must not regress

1. No ads, no energy timers, no paywalls, no accounts, no tracking. Progress stays on the device.
2. Rivals never cheat. They hatch, fly, send (25/50/75/100%) and call by the player's rules. Difficulty changes only how
   fast they react, how far ahead they count, how many orders they juggle and how often they misjudge.
3. The core stays deterministic (section 4). Run `node dev/roost-rivals/verify-replay.mjs` after any change to it.
4. Bird balance stays inside the targets in section 6. Run the balance bot after any change to birds, calls, roosts,
   map generation or rival AI, and put the output in the PR.
5. Colour is never the only cue: your roosts carry a second inner ring; feeders have seed dots; bell towers are eight-sided.
6. Every in-match banner states its rule in plain words (cat, fries, nightfall), so the game teaches itself.
7. Zetato Studios intro: about 1.5 s, plays and passes without a tap.
8. Storage keys and the manifest id never change without a migration (section 7).

## 3. Files

| Repo path | What it is |
|---|---|
| `games/roost-rivals/index.html` | The whole game: styles, markup and three script blocks (core, UI, install/update) |
| `games/roost-rivals/sw.js` | Offline worker with silent updates (same pattern as Ice Crown) |
| `games/roost-rivals/manifest.webmanifest` | Install details. id is `/games/roost-rivals/app` |
| `games/roost-rivals/icons/`, `cover.png` | App icons and the Studios page thumbnail |
| `dev/roost-rivals/DESIGN.md` | This file |
| `dev/roost-rivals/balance/run-balance.mjs` | Balance bot (Node only, no browser) |
| `dev/roost-rivals/verify-replay.mjs` | Determinism and replay check (Node only) |

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
- Commands are the only way in: `RR.cmd(S, {k:'send', p, from, to, r}, delay)`, `{k:'call', p}`, `{k:'quit', p}`.
  `RR.cmdAt` takes a command already stamped with its tick (network, replay). The core validates every command
  (ownership, the four send sizes, call cooldown), so a tampered client cannot send illegal orders.
- Deterministic: one seeded random stream stored in the state (`S.rs`). The core must not use `Math.random`, `Date`,
  `Math.sin/cos/tan/atan2/hypot/pow/exp/log` (these can differ between phones); it uses only `+ - * /`, `Math.sqrt`,
  `Math.floor/round/min/max/abs/imul`. Sorts carry an explicit tie-break. Keep it that way.
- Plain data: `S` is JSON. `RR.snapshot(S)` / `RR.restore(str)` give mid-match resume today and reconnect later.
- Proof: `RR.hash(S)` is a fingerprint of the match state. `RR.replay(setup, log)` re-runs a whole match from its setup
  and command log. `S.setup` and `S.log` are kept in the state for that purpose.
- `soloEnd` option: in solo play the match ends the moment seat 0 is out. Duels leave it off.

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

**Roosts.** Size 1/2/3: cap 30/45/60, hatch 0.75/1/1.25 of base (0.8 birds/s). Feeder: hatch x1.5. Bell tower: defence x1.4,
hatch x0.85. A roost above its cap shrinks back slowly. Maps are symmetric (2 players: point symmetry; 3 to 4: four-fold).

**Flocks.** Birds stream out at 14 per second, fly at 128 units/s (map is 1000 x 1400), wind adds or removes up to 28%
(50% on Gale days). Rival birds that meet in the air cancel one for one.

**Events.** Cat: every 24 to 36 s, warns for 5 s on the fullest roost (24+ birds), then scatters 40%.
Fries: every 30 to 44 s on a non-start roost; whoever holds it after 9 s gains 14 birds.

**Birds (v0.2.0).**

| Bird | Unlock | Passive | Call |
|---|---|---|---|
| Pigeon | start | hatch +8% | Brood: hatch +30% for 6 s |
| Gull | Fledgling | flight +40% | Tailwind: flocks in the air x2.5 speed for 6 s |
| Owl | Songbird | defence +12% | Hunker: defence +30% for 6 s |
| Crow | Kestrel | attack +10% | Mob: attack +50% for 6 s |
| Starling | Falcon | +1 bird on each capture | Murmuration: +2 birds at every roost held |

**Rival AI.** One `skill` number from 0 to 1. Reaction time 3.3 s down to 0.6 s; 1 to 3 orders per thought; sources per
attack 1 to 5; commitment margin 1.0 to 1.42; misjudgement noise shrinks to zero; above 0.25 it sees incoming attacks and
rescues roosts; above 0.55 it moves idle back-line birds forward; above 0.6 it dodges the cat. Below about 0.45 it sometimes
dithers. Opening manners: rivals do not attack anyone's roost in the first 12 s (rushers: 7 s).
Personalities (rusher, turtle, opportunist, schemer, expander) weight expansion, aggression, caution, grudges and tempo.

**Matchmaking (solo).** Rivals: 1 until Fledgling, 2 until Kestrel, then 3. Skill = 0.05 + feathers/1450, plus 0.025 per win
in the current streak (max 5), minus 0.05 per loss in a row (max 4). Nemesis: +0.08 skill and a mild focus on you.
The first ever match is against a near-idle rival and shows coach text.

**Feathers.** Win: 26 + 6 per rival, +6 under 90 s, +10 for beating your nemesis, +20 for the first Daily Flight win of the
day. Loss: up to -16 by placing (nothing as a Hatchling, nothing in the Daily Flight).

## 6. Balance targets and current results

Run: `node dev/roost-rivals/balance/run-balance.mjs 200` (about 4 minutes).

| Check | Target | v0.2.0 result |
|---|---|---|
| Bird win rate, 1v1, equal skill | each 45 to 55% | 47.1 to 51.8% |
| Bird win share, four-way | each 21 to 29% | 22.3 to 28.7% (owl highest, gull lowest) |
| Skill ladder | stronger rival wins more at every step | holds (55 to 96%) |
| Start corner fairness, four-way | about 25% each | 22.9 to 28.8% |
| Match length, 1v1 rivals | median 60 to 90 s | 65 s |
| Replay check | 100% identical | 60 of 60 matches |

Known lean: the owl does best in crowded four-way matches and the gull worst, because rivals do not exploit speed the way
a person can. Watch real play before changing either.

## 7. Release rules

- Bump the version in three places that must match: `VERSION` in `games/roost-rivals/sw.js`, `VERSION` in the UI script
  and `VERSION` in the install/update script at the end of `games/roost-rivals/index.html`.
- Never rename storage keys: `roostrivals.v1` (progress), `roostrivals.match` (match in progress),
  `roostrivals.installHint`. New save fields get a default in `DEF`; old saves pick it up automatically.
- A saved match from an older core is dropped on load when `CORE_VERSION` changes. Bump `CORE_VERSION` whenever the
  rules change in a way that would make an old snapshot or replay play out differently.
- Never change the manifest id (`/games/roost-rivals/app`), `start_url` or `scope`.
- Before any PR: load the game headless and confirm no page errors; run both dev tools.

## 8. Known limitations

- Not yet played by many people; difficulty curve above Kestrel is tuned by simulation only.
- No music or ambient sound; effects only.
- Replays are kept for the last match only and are not saved across launches.
- Online play is prepared for but not built (section 4).
- The name was checked by web search only; check both app stores before a store submission.

## 9. Roadmap (proposed; confirm with the owner before starting)

1. Tuning pass from real playtests (difficulty per rank, call strengths, match length).
2. Friend duels (phase 1 above).
3. More reasons to return: weekly rival "boss" with a unique map, cosmetic flock trails earned by badges.
4. Optional ambient sound with an off switch.
5. Ranked duels (phase 2 above).
