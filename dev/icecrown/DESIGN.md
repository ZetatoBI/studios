# Ice Crown: design and developer handover

Fantasy strategy game (base building, heroes, waves, bosses) by Zetato Studios.
Live at https://studios.zetatobi.com/games/icecrown/ . This document explains *why* the game is the way it is.
Read it before changing gameplay, balance or controls.

## 1. Files
- `games/icecrown/index.html`: the whole game in one file (HTML, CSS, JS).
- `games/icecrown/sw.js`: offline worker with **silent updates** (see section 6).
- `games/icecrown/manifest.webmanifest`: install metadata. `id` is `/games/icecrown/app` and must never change.
- `games/icecrown/icons/`, `cover.png`, `fonts/`: assets. Fonts are self-hosted (no Google Fonts) for offline play.
- `dev/icecrown/balance/`: the balance bot and runner (section 5).

The main script is organised in banner-commented sections, in this order: DATA (all tuning), CAMPAIGN (maps,
themes, upgrades, quests), STATE, COMBAT, ABILITIES, ECONOMY/BUILD/TRAIN, WAVES (wave designer), UPDATE (AI),
RENDERING (ground painter, buildings, figures, lighting), AUDIO (sfx + procedural soundtrack), UI (sheets, ring
menu, tap-twice confirm, hero bar), INPUT, FLOW (intro, title, maps, save/continue, end screens).
Open with `?debug` to expose test hooks on `window.__IC` (normal players never get them).

## 2. Player-facing rules that must not regress
These came from real playtests on a phone. Keep them unless the owner asks otherwise.
1. **Tapping the map never spends anything.** Tapping a plot, building, mine or trees opens a ring of big buttons.
2. **Anything costly or irreversible uses tap-twice** (`data-hold` attribute): first tap arms it ("Tap again"),
   second tap within 3.5s confirms. Press-and-hold was removed: panels re-render several times a second and a
   held element got replaced mid-press, and finger drift cancelled it. Training a unit is a single tap; tapping a
   queued item cancels it with a full refund.
3. **Taps snap to the nearest thing** within a finger-sized radius (`mapTap`), with priority rules.
4. **Heroes:** all portraits always visible; drag a portrait (or the hero) onto the map to move it; hold an ability
   to toggle autocast (saved per class in `icecrown.auto`).
5. **Army:** drag the banner and the whole army marches together at the slowest soldier's pace. Stance button:
   Hold (formation, archers fire, melee waits) / Defend (default; fight as one around the banner) / Charge (hunt anywhere).
6. **Zetato logo intro:** about 1.5s, silent, plays on launch, no tap needed (a tap skips it). Sound starts on first tap.
7. **No press-to-start screens, no ads, no accidental purchases.**

## 3. Campaign structure
- 4 maps, one per tier: Iron (Frostmere Crossing, 12 waves), Bronze (Hollow Pass, 16), Silver (Whitefang Wood, 20),
  Gold (The Ice Crown, 24). Each has its own layout, road, story, twist and bosses.
- Twists: finite gold mine (Bronze), blizzards that slow everyone (Silver), night with light-based rendering and
  +10% raider speed (Gold).
- Stars (3 per map): hold all waves, Town Center above 50% at the end, no hero deaths.
  Unlocks: Bronze 2 stars, Silver 5, Gold 8. Each new star = 1 Crown for permanent War council upgrades.
  There are 32 Crowns of upgrades and only 12 stars: the player must choose.
- Bosses: Skarn the Troll King, Grimhorn the Frost Giant, Vyrnax the Frost Wyrm, Hrimgar the Pale King (final).
  Bosses telegraph big attacks (red ring for slam, blue cone for breath), summon or ice-storm at 55% HP, enrage
  below 30%.
- Enemies follow the map's road (waypoints) until something is in reach, so tower placement matters.
- The game autosaves after every cleared wave (`icecrown.save`, format v1). Continue from title or battle list.

## 4. Balance: targets and history
### Targets (measured with the bot, section 5)
| Map | No upgrades | Some upgrades |
|---|---|---|
| Iron | Wins, about 3 to 7 soldiers lost | Wins easily |
| Bronze | Wins, about 20 to 30 soldiers lost, sometimes a hero | Similar |
| Silver | Wins but costly, about 40 to 55 lost | More comfortable |
| Gold | Falls around wave 21 of 24 | Barely wins (Town Center sometimes under 10%) |

The bot spends perfectly but never micros, so a human who uses stances, focus fire and abilities should do
better. Intent: Iron teaches, Bronze tests, Silver punishes sloppy play, Gold requires mastery plus upgrades.

### Root causes already fixed (don't reintroduce)
1. **Food cap was the real limit on army size** (about 5 soldiers). Now: Town Center 15, Farm +8 (max 5), Keep +10,
   heroes cost 2 food. Every map has 7 or 8 plots.
2. **Waves spawned one at a time**, so even huge waves arrived single file and died. Now each wave spawns in packs
   over about 7 seconds regardless of size (`spawnTotal`).
3. **Heroes did about 80% of all damage.** Ability damage was cut about 35%, soldiers buffed about 15%, XP curve
   slowed, Taunt shortened (3s, 14s cooldown). Healthy share: heroes well under 70% in a big late wave.

### Knobs
- Per map in `MAPS`: `b0` (opening budget), `bg` (growth per wave), `gm` (extra late-game growth, ramps in over the
  map), `hm` (extra late-game enemy HP), `lateK` (last-third pressure), `hp`/`dmg` (flat multipliers), `themes`,
  `unlock` (first wave each enemy may appear), `bosses` (wave to boss).
- Global: `waveHpMul`, `waveDmgMul`, `ECOST` (enemy budget costs), `WTHEMES` (composition weights).
- Waves 1 and 2 of every map are always a light mixed probe (no early wipes before the player has an army).

## 5. Balance bot
Run after **every** change that touches combat, economy, waves, heroes or units:
```
npm i --no-save playwright && npx playwright install chromium   # first time
node dev/icecrown/balance/run-balance.mjs            # all maps, 2 runs each (about 5 minutes)
node dev/icecrown/balance/run-balance.mjs 0,1 1      # quick check
```
Compare with the targets above and report the numbers in the PR. It also reports page errors, so it doubles as a
smoke test. Note: the bot occasionally loses early on Silver by starving itself of gold; that's a bot flaw, not a
game problem.

## 6. Releases and updates
- **Silent updates:** the worker serves the game page network-first, so installed players get the new version on
  their next open, with no prompt and no mid-game interruption.
- **Every release:** bump `VERSION` in `sw.js` **and** the `VERSION` in the PWA script at the end of `index.html`
  (shown on the title screen as "Ice Crown vX beta"). Keep the cache prefix `icecrown-`.
- Never change `manifest.webmanifest`'s `id`, or the storage keys below, without a migration:
  `icecrown.prog` (stars, upgrades), `icecrown.save` (run save), `icecrown.auto`, `icecrown.sfx`, `icecrown.music`,
  `icecrown.race`, `icecrown.map`, `icecrown.installHint`.
- Rollback is the plan instead of staging: if a release misbehaves, revert the PR.

## 7. Known limitations
- Units move in straight lines toward targets (enemies also follow road waypoints); no pathfinding around buildings.
- All art is drawn in code on a canvas; music is procedural (Web Audio), not composed tracks.
- One large file (about 200 KB). Splitting it into modules is fine, but keep it build-free and add every new file
  to the worker's cache list.
- Name risk: "Icecrown" is a known Warcraft location. Fine for the web beta; revisit before app store submission.

## 8. Roadmap (proposed direction, in rough order; confirm with the owner before starting)
1. **Story and heroes:** story cards before and after each map, boss intro lines, hero talents, boss gear drops.
2. **More maps:** fill each tier to 3 maps, with new twists.
3. **Art pass:** sprite-based units with animations, camera zoom and pan.
4. **Two fronts:** larger maps with two rifts, squad banners plus hero-led squads, pathfinding, mini-map alerts.
5. **App stores:** Capacitor build (1024 icon already in `icons/`).
