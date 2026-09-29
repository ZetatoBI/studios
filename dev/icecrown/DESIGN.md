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
- `dev/icecrown/v1.4-SPEC.md`: the build spec for v1.4 "The Long Night" (story, talents, gear).
- `dev/icecrown/v1.5-SPEC.md`: the build spec for v1.5 "Hold the Line" (movement, formations, late-game scaling).

The main script is organised in banner-commented sections, in this order: DATA (all tuning, including `TALENTS`
next to `HEROES`), CAMPAIGN (maps, themes, upgrades, `GEAR`, quests, `STORY` and `BOSS_LINES`), STATE, COMBAT, ABILITIES, ECONOMY/BUILD/TRAIN, WAVES (wave designer), UPDATE (AI),
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
5. **Army:** drag the banner to choose where the army stands; it forms up facing the road (section 3, v1.5). Stance
   button: Hold the line / Defend (default) / Charge, each with a clearly different job (table in section 3). The
   first tap explains all three once (`icecrown.prog.stanceHelp`).
10. **My units never get stuck on each other.** Allies pass through allies, workers are ghosts, units steer around
   buildings, and an anti-stuck net catches the rest. Only the front line against enemies collides.
6. **Zetato logo intro:** about 1.5s, silent, plays on launch, no tap needed (a tap skips it). Sound starts on first tap.
7. **No press-to-start screens, no ads, no accidental purchases.**
8. **Story never blocks a fight.** Full-screen story cards only appear between fights (the game is paused while one
   is up) and can be skipped; everything said during a battle is a non-blocking strip under the boss bar.
9. **The talent picker never interrupts combat.** It is a small panel over the bottom of the map, the game keeps
   running, "Later" closes it, and learning a talent is tap-twice. Equipping gear is free and reversible (plain tap).

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
- The game autosaves after every cleared wave (`icecrown.save`, format v2). Continue from title or battle list.

### Story (v1.4)
- Narrator: Maera, the frost-seer. Card and dialogue text lives in `STORY` and `BOSS_LINES` and is final: don't
  rewrite it. Lines may use `{warrior}`, `{mage}`, `{ranger}` for the race's hero names.
- Intro cards: after March, before the battle, the first time a map is started (replay with "Story" on the
  briefing). Victory card before the Victory modal; the epilogue once, after the first Gold victory. The defeat
  line opens the defeat modal. Continuing a saved run never shows intro cards.
- Mid lines (Skarn on Hollow Pass, Grimhorn on Whitefang Wood, after wave 12 on The Ice Crown) and boss lines
  (arrival, enrage below 30%, death) show as a 3-second speech strip plus a floating line above the boss. A boss
  that already appeared on an earlier map uses its "return" arrival line.
- Cards are drawn from existing art: the map preview (tall version), drifting snow, Maera from `drawFigure`.
- The Chronicle (battle list) lists every story entry in order, including mid and defeat lines; locked ones
  show "???". The menu has "Story: on/off"; off skips intro, victory and epilogue cards, other lines still show.

### Talents (v1.4)
- At levels 3, 6 and 9 each hero picks one of two talents from `TALENTS` (numbers live there). Choices last for
  the battle, like levels, and are saved in the run save. A gold "!" on the portrait means a pick is waiting;
  tapping the portrait opens the picker. The Army tab lists each hero's talents and gear.
- Talents that change abilities also work on autocast (the ability code reads them, `cdOf` handles cooldowns).
- Pack Leader wolves are units of type `wolfpet`: 40% of a Footman, no food, follow stance and banner, respawn
  at each wave start, not saved (they are re-created on continue).
- Wildfire's burning ground is a flat 12 damage per second (it does not scale with ability power).

### Boss gear (v1.4)
- Each boss drops its item (`GEAR`) the first time it is defeated, on any map, win or lose, saved at once.
- One slot per hero class, equipped in the Armory (battle list and briefing). Moving an item to another hero
  takes it off the first. Gear works through `applyStats`, `pw`, `cdOf`, `hit` and `step`, so saves and continues
  pick it up. Frost Scale's "can't be slowed" also ignores the blizzard.

### Movement and collisions (v1.5)
- Friendly units (soldiers, heroes, pets) ignore each other while either is moving or fighting; when both stand
  still they get a gentle spread (`MASS.idleSpread`, 30%). Workers never collide with anyone (the mine and the
  drop-off hold any number).
- Friendly-versus-enemy shoves are split by mass: the lighter side moves more. `MASS`: enemy 1, troll or knight 2.5,
  boss 12; soldier 1.5, heavy 2.5, hero 2, pet 1, siege 3. Stance multipliers on my units: Hold the line x3 while
  braced in formation, Charge x2 while advancing, Defend x1.
- `step()` adds a sideways steering force around buildings and the mine on a unit's straight path (never around its
  destination). Formation slots that fall inside a building are nudged just outside it.
- Anti-stuck net: a friendly that moved less than 4 in 1.2s while heading to a point more than 15 away ignores all
  collisions for 1.5s. Not applied while chasing an enemy (the front line is meant to block). Counted in
  `S.antiStuck` and reported by the balance runner; it should be 0 to a few per battle.

### Formations and stances (v1.5)
- The banner faces the nearest upstream point of the road. Slots are rows of up to 8 across that facing: melee,
  heavy and pets in front, ranged and healers behind, siege at the back. Following heroes stand at the ends of the
  front row; a hero moved by the player leaves the formation until dragged back onto the banner.
- While dragging the banner, faint slot markers (red melee, blue ranged, gold siege and heroes) show at the drop point.

| Stance | What the army does | Mass | Banner drag |
|---|---|---|---|
| **Hold the line** | Stay in formation. Each melee soldier guards a radius of 45 around its slot: it steps out to attack any enemy inside, then returns. Ranged fire at anything in range. Nobody chases further. | x3 when in formation | March to the new spot, ignoring enemies unless attacked |
| **Defend** (default) | Stay in formation until an enemy enters the defence zone (170 around the banner), then every unit fights freely inside it and returns when it's clear. | x1 | Same as Hold |
| **Charge** | Fight your way to the banner: advance in formation, attacking every enemy met on the way (attack-move), then hold there, fighting anything within 120. | x2 while advancing | Dragging the banner sets where the army pushes to |

In every stance, ranged units and ranged heroes fire at anything in range from where they stand, and on Defend a
unit strikes back at an attacker just outside the zone (this stops enemy archers from sniping from the edge).

### Late-game scaling (v1.5)
- Workers cost no food; food is only for the army and heroes.
- Castle: third Town Center tier after the Keep (650 gold, 450 lumber, 30s; +1000 health, +15 food, stronger
  arrows, a second tower and banners). Unlocks Forge levels 6 to 8, siege units and Masterwork (`CASTLE_UPGRADE`).
- Forge levels 6 to 8 for all four lines, same effect per level; cost grows x1.45 per level from level 5 (x1.6 below).
- Masterwork (`MASTERWORK`): repeatable once Weapons and Armor are both 8; +4% damage and health for soldiers and
  heroes per purchase; 600 gold and 400 lumber, +25% per purchase. The count shows on the Forge card.
- Veterancy (`VETERANCY`): soldiers earn ranks from final blows (6, 15, 30 kills): +12% health and damage and 50%
  faster healing between waves per rank; gold chevrons above ranked soldiers.
- Cleric (Kingdom) / Witch Doctor (Horde), `UNITS.healer`: needs the Keep; heals the most injured ally within 110 by
  18 (scales with Weapons) every 1.5s; ranged rows. Trebuchet / Catapult, `UNITS.siege`: needs the Castle; lobs a
  stone every 3.2s at the densest group between 60 and 240 (radius 55, 60 damage); back rows.

## 4. Balance: targets and history
### Targets (measured with the bot, section 5)
| Map | No upgrades | Some upgrades | Upgrades + gear (v1.4) |
|---|---|---|---|
| Iron | Wins, about 3 to 7 soldiers lost | Wins easily | Wins easily |
| Bronze | Wins, about 20 to 30 soldiers lost, sometimes a hero | Similar | Similar or easier |
| Silver | Wins but costly, about 40 to 55 lost | More comfortable | Comfortable |
| Gold | Falls around wave 21 of 24 | Barely wins (Town Center sometimes under 10%) | Winnable but tight: the bot wins at least one of two runs |

The bot spends perfectly but never micros, so a human who uses stances, focus fire and abilities should do
better. Intent: Iron teaches, Bronze tests, Silver punishes sloppy play, Gold requires mastery plus upgrades.

### Root causes already fixed (don't reintroduce)
1. **Food cap was the real limit on army size** (about 5 soldiers). Now: Town Center 15, Farm +8 (max 5), Keep +10,
   Castle +15 (v1.5), heroes cost 2 food, workers cost none (v1.5). Every map has 7 or 8 plots.
2. **Waves spawned one at a time**, so even huge waves arrived single file and died. Now each wave spawns in packs
   over about 7 seconds regardless of size (`spawnTotal`).
3. **Heroes did about 80% of all damage.** Ability damage was cut about 35%, soldiers buffed about 15%, XP curve
   slowed, Taunt shortened (3s, 14s cooldown). Healthy share: heroes well under 70% in a big late wave.
   Note (v1.4): the bot now reports `heroShare` (heroes' share of effective damage, overkill excluded, in the biggest
   non-boss wave of the last third). Measured that way, v1.3 without talents was already at about 75 to 93%, and
   v1.4 with talents and gear is at about 75 to 94%. Talents did not raise it materially, but the 70% line is not
   met by this measure; bringing it down would mean changing base hero or soldier numbers (owner's call).

### v1.4 retune
Talents made every map easier (Gold was won with the Town Center at 100% and no upgrades), so the late-game map
knobs were raised to bring the targets back: Iron `gm` 7 -> 7.5, `hm` 1.75 -> 2.1; Bronze `gm` 6 -> 7, `hm` 1.6 -> 2;
Silver `gm` 4.5 -> 5.3, `hm` 1.5 -> 1.95, `lateK` 1.2 -> 1.25; Gold `gm` 2.6 -> 2.9, `hm` 1.35 -> 1.75. Talent numbers
are the spec's starting values (Wildfire's burn does not scale with ability power). The root-cause fixes above
are untouched.

### v1.5 retune
Free workers, bigger armies, healers, siege, veterancy and formations made the middle maps much easier (before
the retune, Bronze with no upgrades lost about 5 soldiers and Silver about 10). Three seeded tuning rounds on the
late-game knobs gave: Bronze `gm` 7 -> 9, `hm` 2 -> 2.7, `lateK` 1.1 -> 1.2; Silver `gm` 5.3 -> 6.8, `hm` 1.95 -> 2.7,
`lateK` 1.25 -> 1.4; Gold `gm` 2.9 -> 3.2, `hm` 1.75 -> 1.98. Iron is unchanged. The results sit on a cliff: a
small knob change flips "wins with few losses" into "falls to the boss", so the soldiers-lost targets on
Bronze and Silver are hard to hit exactly (see the v1.5 PR for the final table). With the new army the hero
damage share dropped to about 22 to 54%, under the 70% line for the first time.

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
smoke test. Since v1.4 the bot always takes the first talent option and wears no gear, and the runner has a third
profile, "upgrades + gear" (all four items owned; Stoneheart on the Warrior, the Shard on the Mage, the Frost Scale
on the Ranger, since there are only three slots). Each row also prints `heroShare` (see section 4).
Since v1.5:
- `?debug&seed=N` seeds `Math.random`, and `run-balance.mjs --seed N` reseeds run i with N+i (default N = 1), so
  runs are repeatable. Results still depend a little on which runs came before in the same page (stored settings).
- The bot rebalances workers every think (60% gold while the mine lasts), builds farms only when food runs short
  and caps workers at 8 until the first hero is recruited. This removed the early Silver loss.
- It uses Defend, raises the Castle after the Keep, trains a healer per 6 soldiers and a siege engine per 10,
  buys Forge levels up to 8, then Masterwork with spare gold.
- Each row also prints `antiStuck`, `minWorkers` (lowest worker count after reaching 8) and the Masterwork count.
  Late-game check: on Gold with "some upgrades" a winning run keeps at least 8 workers and buys Masterwork.

## 6. Releases and updates
- **Silent updates:** the worker serves the game page network-first, so installed players get the new version on
  their next open, with no prompt and no mid-game interruption.
- **Every release:** bump `VERSION` in `sw.js` **and** the `VERSION` in the PWA script at the end of `index.html`
  (shown on the title screen as "Ice Crown vX beta"). Keep the cache prefix `icecrown-`.
- Never change `manifest.webmanifest`'s `id`, or the storage keys below, without a migration:
  `icecrown.prog` (stars, upgrades, and since v1.4 `story`: ids of cards seen, `gear`: {owned, equipped by class},
  `storyOn`; since v1.5 `stanceHelp`; older saves load with safe defaults), `icecrown.save` (run save, `v: 2` adds
  each hero's talents; `v: 3` adds the Castle tier, Masterwork count and per-unit kills for veterancy, next to the
  stance and banner position already saved; `v: 1` and `v: 2` saves still load), `icecrown.auto`, `icecrown.sfx`, `icecrown.music`,
  `icecrown.race`, `icecrown.map`, `icecrown.installHint`.
- Rollback is the plan instead of staging: if a release misbehaves, revert the PR.

## 7. Known limitations
- Units move in straight lines toward targets with local steering around buildings (enemies also follow road
  waypoints); there is still no real pathfinding.
- All art is drawn in code on a canvas; music is procedural (Web Audio), not composed tracks.
- One large file (about 200 KB). Splitting it into modules is fine, but keep it build-free and add every new file
  to the worker's cache list.
- Name risk: "Icecrown" is a known Warcraft location. Fine for the web beta; revisit before app store submission.

## 8. Roadmap (proposed direction, in rough order; confirm with the owner before starting)
1. ~~**Story and heroes:** story cards before and after each map, boss intro lines, hero talents, boss gear drops.~~
   **Done in v1.4.**
   **v1.5 "Hold the Line"** (movement, formations and stances, late-game scaling, seeded balance runs): **done.**
2. **More maps:** fill each tier to 3 maps, with new twists.
3. **Art pass:** sprite-based units with animations, camera zoom and pan.
4. **Two fronts:** larger maps with two rifts, squad banners plus hero-led squads, pathfinding, mini-map alerts.
5. **App stores:** Capacitor build (1024 icon already in `icons/`).
