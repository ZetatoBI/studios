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
- v1.7 and v1.8 were built in chat and published as finished files (no spec); its design is in section 3, "Economy, heroes and the late game".
- `dev/icecrown/v1.6-SPEC.md`: the build spec for v1.6 "The Ember Deep" (saga of campaigns, carry-over, boons,
  the Dwarves, the Ember Legion, hazards, Campaign 2).

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
Since v1.6 the game is a **saga** of campaigns (see "Saga and campaigns (v1.6)" below). The bullets here describe
Campaign 1, The Long Night.
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
- The game autosaves after every cleared wave (`icecrown.save`, format v4 since v1.6). Continue from title or battle list.

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

### Saga and campaigns (v1.6)
| # | Campaign | Army | Enemy | State |
|---|---|---|---|---|
| 1 | The Long Night | Kingdom of Aldmere or Grukash Horde (player's choice; Dwarves after Campaign 2, Elves after Campaign 3) | The Frost | Playable |
| 2 | The Ember Deep | Ironhold Dwarves (always) | The Ember Legion | Playable (v1.6) |
| 3 | The Withering Wood | Sylvan Elves (always) | The Blight | Playable (v1.9) |
| 4 | The Red Wastes | Grukash Horde (always) | The Sand-Dead | Playable (v1.9); ends the saga |

- **Data model:** `CAMPAIGNS` (id, number, name, race or null for player's choice, faction, `lockText`, `soon` for
  teasers) and `CAMP` by id. Each map in `MAPS` carries `campaign` (old maps default to `c1`), plus `faction`
  ('ember' switches the probe waves to Ember enemies) and optional `hazard`, `hazardShort`, `hazardText`.
  Helpers: `campMaps(c)` (map indices in order), `starsIn(c)`, `campUnlocked(c)`, `campDone(c)`, `raceFor(i)`
  (a campaign with a fixed race ignores the chosen race, so the race picked for Campaign 1 never affects Campaign 2).
- **Unlocks:** Campaign 2 opens when The Ice Crown is won or Campaign 1 has 8 stars. Inside a campaign the tier
  unlocks are as before (2, 5 and 8 stars **of that campaign**). Stars and Crowns are one shared pool.
- **Flow:** title, Play, saga screen (`#saga`: one card per campaign with stars, lock text or teaser), then the
  campaign's battle list (`showMaps` for `curCamp`, remembered in `icecrown.camp`). The race picker sits on the
  Campaign 1 battle list. Back and Done return to the screen you came from (`lastScreen`).
- **Carry-over:** `PROG.camp[c].heroes[cls] = {lvl, xp, tal}` is saved when a battle of that campaign is won
  (`saveCampHeroes` in `gameOver`), and `makeHero` restores it at the start of the next battle in the campaign.
  Heroes never carry between campaigns.
- **Spoils of War (boons):** after winning each of a campaign's first three battles the Victory modal offers three
  of the 12 `BOONS` (seeded per campaign and battle with `mulberry`, so a reload shows the same offer); one pick,
  tap-twice, kept in `PROG.camp[c].boons` for the rest of that campaign. An unpicked offer can be chosen later from
  the battle list. Owned boons show on the battle list and in the pause menu. "Restart campaign" (tap-twice) clears
  the campaign's heroes, boons and offers, not its stars.
  Boons: Quartermaster (+150 starting gold), Stonemasons (build 40% faster), Sharpened Steel (soldiers +10% damage),
  Thick Hides (soldiers +12% health), Eagle Towers (towers +20% range), Field Medics (1% max health per second),
  Veteran Recruits (new soldiers start at rank 1), Rich Seams (mines +25%, carry +10%), War Drums (army +15% speed),
  Hero's Oath (heroes +10% health and ability power), Iron Walls (Town Center +30% health, arrows +50% damage),
  Bounty Hunters (+30% kill gold).

### The Ironhold Dwarves (v1.6)
- `RACES.dwarf`: gold +10%, armor +2, buildings +25% health, towers +15% range, army 10% slower. Units: Miner,
  Shieldbearer, Thunderer (firearm), Ironclad, Runepriest, Bombard. Heroes: Thane Borin, Runesmith Hilda,
  Kara Ironshot.
- Look: `drawFigure` with `o.dwarf` (shorter and wider), beards and braids, horned or crested helms, guns with a
  muzzle flash and smoke (`shot` projectile, `crack` sound), stone halls with glowing runes (`runeLines`) and forge
  embers, a bronze cannon for siege.
- Always the army in Campaign 2. Selectable in Campaign 1 once Heart of the Mountain is won (`PROG.dwarvesC1`).

### The Ember Legion, hazards and Campaign 2 (v1.6)
- Enemies: Magma Hound (fast, leaves a short burning trail), Fire Imp (swarm), Imp Slinger (firebolts that splash),
  Ash Walker (armored), Flamecaller (rouses nearby enemies), Magma Golem (splits into two Ember Blobs), Obsidian
  Knight (heavy armor). Wave themes `emberPack`, `swarm`, `ash`, `magma`, `emberMixed`.
- Bosses: Pyrrhus the Imp King (calls six imps), Gorgath the Molten Colossus (slam leaves a lava pool), Ashgar the
  Cinder Drake (flies; fire breath leaves burning ground), Kragmor, the Mountain's Heart (final; slams, raises two
  golems, makes the mountain erupt).
- Burning ground is team-aware (`team:'e'` hurts only the player's side). The Drakescale Mantle ignores it, lava
  pools and vents.
- Hazards (`HAZ`): **lava vents** (Deep Forges): every 45 s while a wave is live, two vents glow with a red circle
  for 3 s, then burst (80 damage in radius 50). **Ash storms** (Ashen Halls): every 60 s for 12 s, every ranged
  attack (both sides, and towers) reaches 25% less far. **Eruptions** (Heart of the Mountain): every fifth wave
  and on Kragmor's signal, 10 marked spots (1.5 s warning, 60 damage, half to buildings). Warnings appear on the
  map preview and briefing. The bot does not dodge; hazards were tuned to be survivable without micro.
- Maps (`campaign:'c2'`, volcanic themes, warm night lighting, rising embers instead of snow):
  Iron **Emberfall Gate** (12 waves, Pyrrhus), Bronze **The Deep Forges** (16, vents, Pyrrhus and Gorgath),
  Silver **The Ashen Halls** (20, ash storms, finite mine 7000, Gorgath and Ashgar), Gold **Heart of the Mountain**
  (24, eruptions, Pyrrhus, Gorgath, Ashgar and Kragmor).
- Story: Campaign 2 has a prologue (shown the first time the campaign is opened) and intro, victory and defeat
  text per map in `STORY.c2`, `STORY.emberfall`, and so on; boss lines in `BOSS_LINES`. Final text: don't rewrite.
  The Chronicle is grouped by campaign.
- Gear: Imp King's Ember (basic attacks burn), Colossus Plate (+25% health, -20% boss damage), Drakescale Mantle
  (fire and lava immunity, +10% speed), Heart of Kragmor (+15% damage and ability power).
- Rewards: first win on Heart of the Mountain shows the celebration card and makes the Dwarves selectable in
  Campaign 1. War council upgrades unlocked once Campaign 2 is opened (`req:'c2'`): Runic Wards, Deep Veins,
  Battle Hymns.
- Music: Campaign 2 has its own calm, battle and boss tracks (lower, with an anvil beat).

### Economy, heroes and the late game (v1.7 "Lords of War")
Built in chat and tested there (bot runs and headless checks), then published as finished files.
- **Food is a stockpile** (`S.res.food`), shown in the top bar with **population** (helmet, `foodUsed()/foodCap()`).
  Internally a unit's `food` field still means its population cost; `cost.food` is the food price.
  `RK=['gold','lumber','food']` drives `pay`, `canAfford`, refunds and cost chips.
- **Farms** (max 6) grow food: 0.7 per second each, plus 0.6 per farmer, with up to 2 farmers (`RESOURCES.food`),
  scaled by Tools upgrades. Workers take the `food` job (`pickFarm`, `w.farm`), stand in the field and never carry.
  Waves pay `20 + 6 x wave` food. Workers cost 50 food and no population.
- **Population comes from the Town Center tier** (`POP`): 25, +20 with the Keep, +25 with the Castle, +4 per
  Granary level. Farms no longer add population.
- **Costs** (gold, lumber, food): Footman 50/0/40, Archer 40/30/30, Knight 110/40/70, Cleric 80/40/50,
  Siege 150/180/40, heroes +100 food, Farm 30 gold and 70 lumber, Castle +300 food.
- **Heroes unlock by tier** (`heroSlots`): one at the start, a second with the Keep, a third with the Castle.
- **War Barracks** (`BARRACKS_UPGRADE`, needs the Castle; 400/400/200): trains 50% faster and two at a time
  (`b.war`, two queue lanes) and is required for healers and siege (`req:'war'`). Saved in the run save.
- **More land:** `extraPlots()` finds four free spots around the base on every map (away from the road, trees,
  mine, fires, vents and other plots); two open with the Keep and two with the Castle (`plotOpen`).
- **Sellswords** (`MERCS`, Town Center ring and Army tab, needs the Keep): 5 veterans (`UNITS.merc`, no
  population) for 900 gold and 150 food, +15% per hire in a battle, at most 2 bands, serving 2 waves (`contract`),
  then they walk off the map (`leaving`, never counted as losses).
- **Dragon Roost and Dragonfire** (`BUILDINGS.roost`, needs the Castle; `DRAGON`): a strike costs 1,800 gold,
  1,500 lumber and 1,200 food with a 75 s cooldown. The dragon (race colours, `drawWyrmCol`) flies from the roost up
  the road to the rift and back; each pass hits every enemy within 72 for 45% of max health + 250 (bosses 10%),
  and leaves burning ground. Stage button "Fire" (tap twice) or the roost's ring.
- **Battle report** (`stAdd`, `S.st.battle` and `S.st.wave`): damage dealt and taken, healing (healers, War Cry,
  Bloodied Blade; passive regeneration is not counted), kills and losses per hero, unit type, towers, Town Center
  and dragon. "Stats" side button opens a non-pausing panel (tabs react on pointerdown, refresh twice a second);
  a summary toast after each wave; a short report on the Victory and defeat screens.
- **Audio:** combat sounds rebuilt (`metal`, `voice`, `meleeSound`: sword clash, blunt hits, bites, bowstring,
  grunts, war horn, war cry on Charge). One music engine (`musicStep`) with three styles (`musicStyle`, menu:
  Off, Calm, Epic, Intense, saved as `icecrown.musicStyle`) and a palette per map (`PALETTES`: key, mode, tempo,
  colour instrument). **Sound suspends and the battle pauses when the app goes to the background**
  (`visibilitychange`, `pagehide`).
- **Preview mode** (`PREVIEW`): on any host other than zetatobi.com or localhost (Claude artifact links), every
  campaign and battle is unlocked for testing. The live site is unaffected.

### Ramparts (v1.8)
Built in chat and tested there (bot runs and headless checks), then published as finished files.
- **Workers:** assigning a worker only ever uses an idle one. If none is idle the game says so (train more, or tap
  Remove at a mine, wood or farm). Nothing is pulled off another job at random. Tools upgrades are described as
  boosting gold, lumber and food (farms always used them).
- **Hero progression:** level cap 20 (`HERO_MAX`), `XP_TABLE` to 65,000. Measured with the campaign profile: about
  level 8, 13, 17 and 19 after each of a campaign's battles. Growth (`hpGrow`, `dmgGrow`, `apGrow`): +12% health,
  +8% damage, +10% ability power per level to 10, then +7% / +5% / +6%; armor +1 per 3 levels to 9, then per 4.
  Titles every 5 levels (`TITLES`: Veteran, Champion, Hero, Legend), each +6% health, damage and ability power
  (`TITLE_BONUS`), a coloured aura under the hero and a banner and fanfare. Level-ups show the health and damage
  gained. Portraits have an XP line and a level badge in the title colour. Talents stay at 3, 6 and 9.
- **Walls** (`WALLS`, `BUILDINGS.wall`, type `wall`): three sites per map across the road at 40%, 55% and 70% of
  its length from the rift (`wallSlots`, `S.wslots`). Palisade: 150 lumber, 1,400 health, armor 3. Stone (needs the
  Keep): +150 gold and 150 lumber, 3,800 health, armor 8. A wall is a 68-wide segment (`segDist`); `edgeDist` uses
  it. Enemies on the road are held on the rift side (`separate`, remembering which side each enemy came from in
  `wside`) and attack the wall once it blocks them (`blockingWall`). They never target a wall from afar
  (`nearestFriendly` skips walls). Fliers ignore walls, and friendly units pass through and never steer around them.
  Saved in the run save (`wslot`, `tier`).
- **Mop-up rule** (`mopUp`): once a wave has finished spawning and 3 or fewer enemies remain, soldiers and heroes
  behave as on Charge. Found by the bot: a lone archer plinking a stone wall from out of reach stalled a wave for
  over 20 minutes.
- **Camera** (`CAM`, `applyCam`, `zoomAt`, `resetCam`): zoom 1 to 2.5 by pinch or mouse wheel; one-finger drag
  pans when zoomed in; a corner button resets. `SC`, `OX` and `OY` always hold the current camera transform, so
  drawing, taps, rings and lighting follow it. The ground is painted once per map and screen size into a
  zoom-ready cache (`GV`, up to 4,096 px) and drawn in world coordinates. The map resets the view on start.

### The Withering Wood, the Sylvan Elves and bigger maps (v1.9)
- **Campaign 3** (`c3`, faction `blight`, race `elf`): Iron **Silverleaf Glade** (12 waves, Gnarlroot), Bronze
  **The Thornwall** (16, blooms, Gnarlroot and Vorthak), Silver **Hollowmere** (20, spore clouds, finite mine 7000,
  Vorthak and Hollowwing), Gold **The Withered Heart** (24, spore rain, mine 14000, all four bosses ending with the
  Rot Mother). Opens with a win on Heart of the Mountain or 8 stars in Campaign 2. Winning The Withered Heart sets
  `PROG.elvesC1` (the Elves become a third choice in Campaign 1).
- **Bigger maps:** the world size is per map: `world:{w,h,z0}` in `MAPS` (default 420 x 560). `setWorld(M)` sets
  `WW`/`WH` in `newGame` and around `mapPreview`. Campaign 3 maps are 520 x 700 and open at zoom `z0` 1.3 centred
  above the Town Center, so the player pans (drag) and pinches to see the rift. Never hard-code 420 or 560: use
  `WW`/`WH`. Campaigns 1 and 2 keep the original size.
- **Sylvan Elves** (`RACES.elf`): lumber x1.2, speed x1.12, ranged range and ranged damage x1.15, military health
  x0.9 (`perks.rangedMul`, `rangedDmg`, `hpMul`, applied in `applyStats`). Units: Gatherer, Bladedancer, Longbow,
  Glade Guard, Druid, Glaive Thrower. Heroes: Blademaster Thalion, Sylwen the Grovewarden, Aerin Swiftbow. Drawn
  slimmer and taller with long hair and pointed ears (`elfLook`, `drawFigure` flags `elf`, `hair`, `elfEar`).
- **The Blight** (`ENEMIES`): rotwolf, rotling, sporeArcher (`slowHit` .3: its hits slow), husk, sporePriest
  (heals), **bloat** (`burst`: on death it damages friendly units and heroes in a radius, so shoot it early),
  thornKnight. Bosses: Gnarlroot (regenerates, summons rotlings), Vorthak (rot pools), Hollowwing (flies, spore
  breath), the Rot Mother (summons bloats and husks, spore rain). The opening probe per faction is in `OPENERS`.
- **Hazards** (`HAZ`): `blooms` (warned circle, burst, then a rot pool that hurts **both** sides: pool team
  `'all'`), `spores` (cloud: ranged range x0.8 for 12s), and `erupt` reused as spore rain on blight maps.
- **Look:** `THEMES[id].blight` switches the ground painter to `paintBlight` (moss, rot spreading from the rift by
  `rot` 0 to 1, roots, optional stream and bridge), elder trees (`drawElder`), `drawRiftBlight`, spores and falling
  leaves instead of snow sparkles.
- **Crown upgrades** (need Campaign 3 open, generic `PROG[req+'open']`): Wisdom (heroes +15% XP), Grove (walls
  +25% health). **Gear:** Heartwood (+20% health, regen), Antler (+15% damage, +2 armor), Mothwing (+15% speed,
  15% less damage taken), Verdant (+20% ability power, cooldowns x0.9).
- Storage: `icecrown.prog` gains `c3open` and `elvesC1`. No save version change.

### The Red Wastes, the Sand-Dead and the saga finale (v1.9)
- **Campaign 4** (`c4`, faction `sand`, race `horde`): Iron **Dustwater Oasis** (12 waves, Sandjaw), Bronze
  **The Bone Canyons** (16, quicksand, Sandjaw and Sephet), Silver **The Sunken Necropolis** (20, sandstorms, finite
  mine 7000, Sephet and Zarakesh), Gold **Tomb of the Sun King** (24, tomb collapse via `erupt`, mine 14000, Sandjaw,
  Sephet, Zarakesh, then **Vael** herself at wave 24). Same 520 x 700 world as Campaign 3. Opens with a win on The
  Withered Heart or 8 stars in Campaign 3. Winning the Tomb sets `PROG.sagaDone` (finale card; the title screen says
  the saga is complete).
- **The Sand-Dead** (`ENEMIES`): jackal, ghoul, duneArcher, mummy, tombPriest (`ward`: every 6s nearby raiders get
  +5 armor for 4s, gold ring; read in `hit()` through `buffs.ward`), scarab (`burrow`: ignores walls, both in
  `blockingWall` and in the wall collision in `separate`), colossus (splits into 3 scarabs), tombGuard. Bosses:
  Sandjaw (scorpion, `drawScorpion`; venom pool, scarabs), Sephet (wards, mummies), Zarakesh (flying sand wyrm; sand
  breath slows, `stormProj:'sandbolt'`), Vael (frost slam, `storm` of crown shards, tomb guards, `erupt`).
- **Hazards** (`HAZ`): `quicksand` (every 45s two telegraphed circles open under random soldiers or heroes; they
  burst, then leave a pool that hurts and slows both sides: burn fx with `slow`), `sandstorm` (every 60s for 10s:
  ranged range x0.8 and everyone slowed via `S.blizT`/`S.blizK` = 0.75), `erupt` reused as falling tomb stones.
- **Fix:** storm range now reads the current map's hazard (`hzRange()`); before, spore clouds always used the ash
  value (x0.75) instead of their own.
- **Look:** `THEMES[id].desert` switches to `paintDesert` (dunes, ripples, sandstone road, bones, red mesas or a
  full canyon with `canyon`, `ruins` columns, `pyramids`, an `oasis`), `drawPalm` for lumber, `drawRiftSand`, drifting
  sand and sandstorm overlays, stars instead of the aurora on desert nights. Music colour `oud` (plucked lute).
- **Crown upgrades** (need Campaign 4 open): Oasis Wells (farms +20% food), Sun-hardened (soldiers +1 armor).
  **Gear:** Sandjaw's Stinger (basic attacks poison), The Embalmer's Wraps (+25% health, can't be slowed),
  Zarakesh's Fang (+20% damage, 15% faster attacks), The Shattered Crown (+15% health, damage and ability power,
  cooldowns x0.9). Campaign 3 and 4 gear now have their own Armory icons.
- Storage: `icecrown.prog` gains `c4open` and `sagaDone`. No save version change.

### How to add a campaign
1. Add an entry to `CAMPAIGNS` (drop `soon`; set `race` if the army is fixed, and `lockText`), and make
   `campUnlocked` open it.
2. Add its race to `RACES` if new (perks, palette, unit and hero names) plus any look switches in `drawFigure`,
   building and siege drawing.
3. Add enemies and bosses to `ENEMIES` (with `ENEMY_TRAITS` text and `ECOST`), wave themes to `WTHEMES`, and a
   `faction` value so `genWave` uses them for the probe waves.
4. Add four `MAPS` entries with `campaign:'cN'`, tiers Iron to Gold, layout, road, `bosses`, `unlock`, optional
   `hazard` fields, and knobs copied from the matching tier of the newest campaign as a starting point.
5. Add `THEMES` for the ground painter (palette, scenery, `volcanic`-style flags), a `realmArt` case for the saga
   card, and music tracks if wanted.
6. Add `STORY` entries (prologue `cN` plus each map), `BOSS_LINES`, `CHR_AT` order, boss `GEAR`, and the reward.
7. Run the bot (fresh-start and `--campaign cN`) and add the targets to section 4.

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

### Campaign profile and Campaign 2 targets (v1.6)
The bot's **campaign profile** (`run-balance.mjs --campaign c1,c2`) plays a campaign's four battles in order,
carrying heroes and taking the first boon offered after each win; a lost battle is not replayed (the next one
starts with the heroes from the last win). Measured with "some upgrades":

| Battle | Target |
|---|---|
| Emberfall Gate | Wins, 5 to 15 soldiers lost |
| The Deep Forges | Wins, 20 to 35 lost |
| The Ashen Halls | Wins but costly (35 to 55 lost), or loses in its last 3 waves |
| Heart of the Mountain | Wins in at most 1 of 2 runs; without upgrades falls before wave 22 |

Campaign 1 keeps the fresh-start targets above; with the campaign profile, The Ice Crown must end with the Town
Center below 80%.

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

### v1.6 retune
Campaign 2 knobs started from the Campaign 1 tier values. Three seeded rounds gave: Emberfall `gm` 7.5 -> 10,
`hm` 2.1 -> 2.3; Deep Forges `gm` 9 -> 7, `hm` 2.7 -> 2.3; Heart `gm` 3.2 -> 4.8, `hm` 1.98 -> 2.5 (Ashen Halls
unchanged). Hero carry-over (heroes start Gold at level 10 with three talents) let the campaign profile win The Ice
Crown with the Town Center at 100%; zeroing every boon did not change that, so Gold `lateK` was raised 1.3 -> 1.5,
which keeps the fresh-start Gold targets. Hazards caused under 6% of damage taken, so they were not reduced.

### v1.7 retune
The new economy first made the game much harder for the bot (Frostmere lost 31 soldiers, Emberfall fell on wave 10).
A trace showed the cause was the bot, not the game: on lumber-poor maps it sat on thousands of gold with no lumber.
The bot now splits workers by scarcity, keeps 16 workers, hires sellswords and uses Dragonfire when rich. Food
was then too plentiful, so farms were cut to 0.7 + 0.6 per farmer and wave food to 20 + 6 x wave. Hollow Pass lost
on its final boss in every profile (the mine ran dry), so its mine is now 10,000 (was 9,000); its knobs are unchanged.
Results (1 seeded run each; no upgrades / some upgrades): Frostmere won 7 / 1 lost; Hollow Pass won 15 / 10;
Whitefang lost at 18 / won (82 lost); The Ice Crown fell at 21 / won; Emberfall won 19 / 21; Deep Forges won
82 / 79; Ashen Halls fell at 17 / 18; Heart of the Mountain fell at 21 / 21. Watch: The Ice Crown with upgrades and
the Deep Forges' high losses.

### v1.8 retune
Walls and longer hero growth made most maps a little easier. The Ice Crown's late knobs were raised (`gm` 2.9 to
3.6, `hm` 1.75 to 2.1): without upgrades it falls at wave 21 (2 of 2 runs); with upgrades it is won in 1 of 2.
Fresh-start results otherwise (no upgrades / some upgrades): Frostmere won 10 / 8 lost; Hollow Pass won 15 / 11;
Whitefang won 37 / 23; Emberfall won 26 / 33; Deep Forges won 65 / 58; Ashen Halls fell at 18 / 18; Heart of
the Mountain fell at 22 / 24. Watch: Hollow Pass and Emberfall now lean easy, the Deep Forges costly, and the
campaign profile (carried heroes) was not re-measured on Gold.

### v1.9 retune (Campaign 3)
The four Blight maps started from Campaign 2's knobs and were eased in two seeded rounds, because the Elves are
lighter and Bloats punish a packed line: Silverleaf `gm` 10 to 8.5, Thornwall 7 to 5.5, Hollowmere 6.8 to 5,
The Withered Heart 4.8 to 4.5; Bloat burst 55 damage / radius 58 to 45 / 54; spore cloud range x0.75 to x0.8.
Campaign profile, 2 runs (no upgrades / some upgrades): Silverleaf won, 16 to 18 / 13 to 19 lost; Thornwall won,
27 to 33 / 24 to 43; Hollowmere fell at wave 18 / fell to Hollowwing at wave 20; The Withered Heart fell at 21 /
won 1 of 2. Targets for Campaign 3 are the Campaign 2 table above. Watch: Hollowmere is the hardest Silver map
(the bot never wins it); a human who shoots Bloats first should. Campaigns 1 and 2 were re-run and are unchanged.

### v1.9 retune (Campaign 4)
The Horde with carried heroes crushed the first draft (Campaign 3 knobs: won all four battles in 3 of 4 runs).
Two seeded rounds: Dustwater `gm` 8.5 to 11; Bone Canyons `gm` 5.5 to 9, `hm` 2.3 to 2.9; Necropolis `gm` 5 to 6.8,
`hm` 2.7 to 3; Tomb of the Sun King `gm` 4.5 to 5.8, `hm` 2.5 to 3.1, `lateK` 1.3 to 1.5. Campaign profile, 2 runs
(no upgrades / some upgrades): Dustwater won, 4 to 15 / 0 lost; Bone Canyons won, 14 to 15 / 13 to 15 (quicksand is
about 20% of damage taken); Necropolis won once with 75 lost and fell at wave 20 once / won, 32 to 36; Tomb fell at
waves 21 and 23 / won 1 of 2 (the other fell to Vael). Watch: Bone Canyons leans easy against the 20 to 35 target,
and the gap between "no upgrades" and "some upgrades" is wider than in other campaigns. Campaigns 1 to 3 were re-run
after these changes and still sit inside their targets.

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
Since v1.6:
- `run-balance.mjs --campaign c1,c2 2` runs the campaign profile (section 4), 2 runs per campaign and profile.
  Rows add `endTC`, `hazards` (share of damage taken by the player's side that came from hazards) and hero levels.
- Map numbers are page indices (Campaign 2 is 4 to 7). `__IC.finish(true)` ends a won battle properly (saves
  heroes, offers boons); `opts.keepProg` keeps campaign state between battles.

## 6. Releases and updates
- **Silent updates:** the worker serves the game page network-first, so installed players get the new version on
  their next open, with no prompt and no mid-game interruption.
- **Every release:** bump `VERSION` in `sw.js` **and** the `VERSION` in the PWA script at the end of `index.html`
  (shown on the title screen as "Ice Crown vX beta"). Keep the cache prefix `icecrown-`.
- Never change `manifest.webmanifest`'s `id`, or the storage keys below, without a migration:
  `icecrown.prog` (stars, upgrades, and since v1.4 `story`: ids of cards seen, `gear`: {owned, equipped by class},
  `storyOn`; since v1.5 `stanceHelp`; since v1.6 `camp`: per campaign {heroes, boons, offered}, `c2open` (v1.9: also `c3open`, `elvesC1`, `c4open`, `sagaDone`),
  `dwarvesC1`; older saves load with safe defaults), `icecrown.save` (run save, `v: 2` adds
  each hero's talents; `v: 3` adds the Castle tier, Masterwork count and per-unit kills for veterancy, next to the
  stance and banner position already saved; `v: 4` adds the campaign id; `v: 1` to `v: 3` saves still load),
  `icecrown.auto`, `icecrown.sfx`, `icecrown.music`, `icecrown.race`, `icecrown.map`, `icecrown.camp` (v1.6: last
  campaign opened), `icecrown.installHint`.
- Rollback is the plan instead of staging: if a release misbehaves, revert the PR.

## 7. Known limitations
- Units move in straight lines toward targets with local steering around buildings (enemies also follow road
  waypoints); there is still no real pathfinding.
- All art is drawn in code on a canvas; music is procedural (Web Audio), not composed tracks.
- One large file (about 310 KB since v1.6, about 430 KB since v1.9). Splitting it into modules is fine, but keep it build-free and add every new file
  to the worker's cache list.
- Name risk: "Icecrown" is a known Warcraft location. Fine for the web beta; revisit before app store submission.

## 8. Roadmap (proposed direction, in rough order; confirm with the owner before starting)
1. ~~**Story and heroes:** story cards before and after each map, boss intro lines, hero talents, boss gear drops.~~
   **Done in v1.4.**
   **v1.5 "Hold the Line"** (movement, formations and stances, late-game scaling, seeded balance runs): **done.**
   **v1.6 "The Ember Deep"** (saga of campaigns, carry-over, boons, the Dwarves, Campaign 2): **done.**
   **v1.9 "The Withering Wood"** (Campaign 3, the Sylvan Elves, the Blight, bigger maps): **done.**
   Campaign 4 "The Red Wastes" (Grukash Horde vs. the Sand-Dead, Vael as the saga's last boss): **done in v1.9.**
   Next (v2.0): the endless "Eternal Siege" mode that opens after the four campaigns.
2. **More maps:** fill each tier to 3 maps, with new twists.
3. **Art pass:** sprite-based units with animations, camera zoom and pan.
4. **Two fronts:** larger maps with two rifts, squad banners plus hero-led squads, pathfinding, mini-map alerts.
5. **App stores:** Capacitor build (1024 icon already in `icons/`).
