# NEON PRECINCT: OVERDRIVE — Progress

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Engine core: loop, input, rendering, pooling, collision, camera, post-FX | ✅ Done |
| **M2** | Player system + 4 pilots fully playable | ✅ Done |
| **M3** | Enemy AI, bullet-pattern library, procedural stage generator | ✅ Done |
| **M4a** | Difficulty config + difficulty select screen, hooked into M3 | ✅ Done |
| **M4b** | Boss framework: arena mode, per-phase arena transitions, damage flags, safe defeat routing | ✅ Done |
| **M4c** | One complete boss for each of the 6 archetypes (5 authored phases + unique arenas each) | ✅ Done |
| **M4d** | World & faction pass: lore/faction data, greeble generator, faction enemy variants, 2 new biomes, intro cards + loop lines, boss visual retrofit | ✅ Done |
| **M5** | Remaining 12 standard pilots + **Vincenzo (Legendary)** with the §4.6 firing concepts, ultimates, cut-ins | ✅ Done |
| **M6** | Audio engine and adaptive music (per-phase layers, archetype themes, a musical identity per faction) | ✅ Done |
| **M7** | UI, scoring, polish, performance tuning: **M7a** scoring ✅ · **M7b** flow & UI ✅ · **M7c** polish, robustness, performance, balance ✅ | ✅ Done |
| **Art test** | Hand-made art for Kairo Vance (Stormlance), the vertical slice for the 16 other pilots (branch `art/kairo-test`; first version merged in PR #1, later fixes pending) | ✅ Approved |
| **Art: Mira** | Hand-made art for Mira Solenne (Halo Sprite) on the shared art modules (branch `art/mira-test`, not merged) | ✅ Approved |
| **Art textures** | Per-pilot art textures, so pilot art no longer fills the shared atlas (branch `art/pilot-textures`, on top of `art/mira-test`) | ✅ Done |
| **Art: Bruno** | Hand-made art for Bruno Hagen (Ironhound) on the shared art modules (branch `art/bruno-test`, on top of `art/pilot-textures`, not merged) | 🔍 In review |
| **Art: Tess** | Hand-made art for Tess Kuro (Wireghost) on the shared art modules (branch `art/tess-test`, on top of `art/bruno-test`, not merged) | 🔍 In review |
| **Art: Oduya** | Hand-made art and a redesigned kit for Oduya Rex (Thunderjaw), the god of thunder (branch `art/oduya-test`, on top of `art/tess-test`, not merged) | 🔍 In review |
| **Art: Lin** | Hand-made art and a redesigned kit for Lin Hayase (Petal Engine), an emerald crystal knight on butterfly wings (branch `art/lin-test`, on top of `art/oduya-test`, not merged) | 🔍 In review |
| **Art: Miguerre** | Hand-made art and a Legendary void kit for Miguerre Zo'Rajah (Overclock), a black-and-red void knight (branch `art/dax-test`, on top of `art/lin-test`, not merged) | 🔍 In review |
| **Art: Kairo v2** | Component mecha rebuild for Kairo Vance: new top-down art, tier-deployed inner and outer wings, hand cannons, chest focus beam (branch `art/kairo-v2`, on top of `art/dax-test`, not merged) | 🔍 In review |
| **Art: Mira v2** | Component mecha rebuild for Mira Solenne: new gold-and-white top-down art, chest fire at T1, hand cannons from T2, tier-deployed inner and outer blades, chest focus attack (branch `art/mira-v2`, on top of `art/kairo-v2`, not merged) | 🔍 In review |
| **Art: Bruno v2** | Heavy-artillery component mecha for Bruno Hagen: new purple-and-red top-down art, tier-expanding shoulder cannons and side cannons, unlimited-range explosive shells, shoulder-cannon focus barrage, reactive shield, wide bomb, carpet-bomb ultimate with a final nuke (branch `art/bruno-v2`, on top of `art/mira-v2`, not merged) | 🔍 In review |
| **Art: Tess v2** | Blade component mecha for Tess Kuro: new violet top-down art with swinging arm blades, unlimited-range crescents that erase bullets, glitch-clone focus, Shadow Form special, triple-crescent bomb with clones, void-cross ultimate with a nuclear-scale detonation; Miguerre Zo'Rajah's love interest (branch `art/tess-v2`, on top of `art/bruno-v2`, not merged) | 🔍 In review |
| **Art: Oduya v2** | Thunder-god component mecha for Oduya Rex (current sprite): punching arms (every bolt leaves a fist), flaring lightning wings, every attack rebuilt as beginning → travel → detonation, new God Thunder ultimate (branch `art/oduya-v2`, on top of `art/tess-v2`, not merged) | 🔍 In review |
| **Art: Lin v2** | Emerald crystal knight as a component mecha (current sprite): whip in front that throws the shards, thrusting spear, beating wings; wider Root Field, enhanced Spear Rain, redrawn Cosmic Spear (stronger charge, visible void with cracked-space edges) (branch `art/lin-v2`, on top of `art/oduya-v2`, not merged) | 🔍 In review |
| **Art: Miguerre v2** | The void knight renamed **Miguerre Zo'Rajah** (id `miguerre`), with a new horned, winged sword knight as a component mecha: void beams from the horns, a real wing beat (no thrusters), the sword swing that launches the Crescent of Chaos with a fear-inducing vibration, and the Chaos Clone targeting fix; 100 units tall (branch `art/miguerre-v2`, on top of `art/lin-v2`, not merged) | 🛑 Step 1 checkpoint |

> **Specs:** [docs/NEON_PRECINCT_OVERDRIVE_PROMPT.md](docs/NEON_PRECINCT_OVERDRIVE_PROMPT.md) (v3), [docs/UPDATE_01_BEFORE_M4.md](docs/UPDATE_01_BEFORE_M4.md) and [docs/UPDATE_02_WORLD_LORE_ART.md](docs/UPDATE_02_WORLD_LORE_ART.md). Priority if they conflict: UPDATE_02 > UPDATE_01 > prompt.

## Update 02 applied (after M4c)

- **Specs saved:** `docs/UPDATE_02_WORLD_LORE_ART.md`; the build prompt in `docs/` is now v3.
- **Adds:** the world of New Meridian and the Breach, six Undercrown factions, the art direction bible (§4), animation standards (§5) and the new **M4d** milestone.
- **M4c steps skipped.** All six bosses were finished before this update, so the "finish the current boss" steps in §0/§6 don't apply. Following §0.5, their visual retrofit happens in M4d.
- **Ground rules carried into M4d:**
  - No renames of bosses, enemies, patterns, files or IDs.
  - No changes to boss HP, phase logic, patterns, transitions or damage flags.
  - Lore and faction content lives in new data files that existing systems read through small additive hooks.
- **Verified right after applying the update**, before any M4d code (headless Chrome, software GL, no console errors):
  - The M3 regression suite passes unchanged:
    - difficulty select → pilot → stage;
    - Medium reproduces the M3 numbers;
    - the same seed gives the same waves on every difficulty;
    - waves → mid-boss → boss → tally → stage 2.
  - All six M4c bosses run every phase on Extreme (5 phases) through the death sequence to the tally.

## Update 01 applied (before M4)

- **Specs saved** to `docs/`. The milestone plan is revised as follows:
  - M4 split into 4a/4b/4c
  - 6 boss archetypes, each phase with its own arena
  - Vincenzo the Conqueror (Legendary) added for M5
  - difficulty select added
- **Ground rules followed.** No M1–M3 system was rewritten. The only changes to existing files are small additive hooks:

  | File | Hook |
  |---|---|
  | `stages/StageGen.js` | `difficulty()` / `generateStage()` take a difficulty id and multiply the base values and the per-loop growth rate. Defaults to `medium` (= M3 numbers). |
  | `entities/enemies/index.js` | Revenge bullets follow the table (off / on / dense) instead of "loop ≥ 2". |
  | `entities/Player.js` | Optional `bombStock` start option (death refills to it). Continues restore the starting reserve. |
  | `entities/World.js` | `scoreMul` applied to every positive score gain via a getter/setter, with no call-site changes. Adds `setScoreRaw()` for continues. |
  | `ui/Hud.js` | Optional difficulty badge. Hi-score kept per difficulty. |
  | `scenes/PlayScene.js`, `StageScene.js`, `TestRangeScene.js`, `PilotSelectScene.js`, `main.js` | Read `game.difficultyId`; boot into difficulty select. |
- **M3 verified after the update** (headless, Standard difficulty):
  - stages generate
  - waves spawn
  - the mid-boss placeholder appears
  - boss → tally → stage 2 completes with no errors
  - Medium reproduces the M3 numbers exactly (e.g. stage 8: density 1.44, speed 1.18, HP 1.35)
  - the same seed gives the same waves on every difficulty (only the numbers scale)

## M4a — Difficulty

- **[core/difficulty.js](src/core/difficulty.js)** is the single source of truth for the table in UPDATE_01 §3.2:
  - bullet speed, density, enemy HP
  - boss phases (+ desperation)
  - lives, bombs, loop scaling rate, revenge, score multiplier

  Interpretation notes:
  - **Lives** = total ships. The Player stores spare ships, so it starts with lives − 1 in reserve.
  - **Bombs** are applied Medium-relative, so pilots keep their bomb identity: `pilotBombStock + (bombs − 3)`, minimum 1.
  - **Loop scaling** multiplies the per-loop growth terms; the within-loop stage ramp is unchanged.
  - `bossPhases` / `desperation` are already exposed on `world.diff` for the M4b boss framework.
- **Flow:** Difficulty Select → Pilot Select → Stage. The title screen and attract demo come in M7. Esc on pilot select returns to difficulty select. The last choice is remembered in settings.
- **[DifficultySelectScene](src/scenes/DifficultySelectScene.js)** shows five cards with colour identities: Standard cyan, Medium green, Hard amber, Extreme red, Hell black/crimson.
  - Each card has a description, key numbers, a density meter and the score multiplier.
  - A **live bullet preview** fires through the real pattern library at the highlighted difficulty's density and speed.
  - **Hell** has animated CSS flames and card shake. Highlighting it plays a distorted synth warning ([audio/sting.js](src/audio/sting.js), a minimal Web Audio module that M6 will fold into the full engine) with a red flash and screen shake.
- **The difficulty is shown** as a HUD badge, on pilot select, in the tally and in the pause seed line. High scores are saved per difficulty (the full table with pilot + seed + difficulty comes in M7).
- The test range uses the chosen difficulty's lives, bombs and score rate but never saves a hi-score.

## M4b — Boss framework

**Existing files touched (all additive hooks, as UPDATE_01 §0 allows):**

| File | Change | Why |
|---|---|---|
| [entities/World.js](src/entities/World.js) | `damage(e, dmg, flags)`, plus an optional `flags` on `damageCircle`, `damageLine` and `beam`. Shot, beam and flak collisions pass their flags. The `e.onDamage` intercept hook is added, and the pool now resets `onDamage`/`ctrl`. | §2.6 damage flags |
| [entities/BulletSystem.js](src/entities/BulletSystem.js) | `dflags` per shot (set to 0 on spawn, swapped on remove) | lets player shots carry flags (Vincenzo, M5) |
| [stages/StageGen.js](src/stages/StageGen.js) | boss section gets `arena: bossForStage(seed, index)` | rotation; no extra RNG draws, so waves are unchanged |
| [stages/StageDirector.js](src/stages/StageDirector.js) | spawns the arena boss, emits `arenaEnter` / `arenaExit` | §1.3 arena-mode switch |
| [scenes/PlayScene.js](src/scenes/PlayScene.js) | optional `renderUnderlay` / `renderOverlay` render hooks | arena layers go under entities |
| [scenes/StageScene.js](src/scenes/StageScene.js) | owns the Arena; handles boss events, the phase card, the intro subtitle and dev keys | presentation |
| [main.js](src/main.js) | `boss.css` import, dev exports | — |

**New modules in [src/bosses/](src/bosses/):**
- **[BossController](src/bosses/BossController.js)** is the runtime for a data-driven boss (shape from UPDATE_01 §1.4). States: `enter → fight ⇄ transition → dying`.
  - The boss is one World enemy whose HP is the sum of its phases. Phase boundaries are HP floors, and damage never crosses one: the overflow is dropped and the phase ends. The HUD bar shows one segment per phase.
  - **Phase filtering by difficulty:** 3 phases keep authored phases 1, 3, 5; 4 keep 1, 2, 4, 5; 5 keep all. A boss can override this with `phaseSets`. Hell appends a **desperation** phase (`def.desperation`, or one derived from the last phase).
  - **Transition (~2.4 s):** bullets become score stars, the boss turns invulnerable and plays its transform shudder, the arena crossfades (step 18), the `PHASE N — NAME` card appears (step 88), the music layer switches (step 104), and the boss is vulnerable again (step 144).
  - Phase-break bonus is 5,000 × phase × Mk. A phase that lasts 75 s ends without its bonus, so there are no softlocks.
  - **Multi-stage death:** a chain of hull blasts, then a core breach, then `World.killEnemy`, which awards score and medals and lets the director advance as in M3. `deathSequence` can be `chain_explode` (default), `sink_and_explode` or `spin_out`.
  - **Movement** styles: hover, sweep, figure8, center.
  - **Patterns:** `phase.patterns` names call into the boss's own `attacks` table with `(ctrl, world, phaseStep)`.
- **[Damage flags](src/core/damage.js):** a bitmask, built with `dmgFlags({...})`.
  - `ignoresShields`: hits through armour < 1 and boss shields (e.g. a submerged dive). It does not hit during a phase transition, because no phase is active then.
  - `instantKill`: destroys any enemy. A main boss is defeated through the normal defeat path, even during its fly-in or a transition; the scene is told to snap the arena (`bossTransitionCancel`) first.
  - `instantPhaseClear`: ends a main boss's current phase, so the transition still plays. Any other enemy, mid-bosses included, is destroyed.
- **[Arena](src/bosses/Arena.js)** runs arena mode and owns the background layers while a main boss is up.
  - Colours and scroll speed blend smoothly. The shader mode and parallax set swap at the transition midpoint, when the screen is fully covered.
  - Arena-only layers: a tint wash, a darkness veil (bullets stay lit), and ambient searchlights, aurora, snow, bubbles, ash and glyphs.
  - On defeat it fades back to the stage biome, and the stage continues to the tally as in M3.
- **[Arena themes](src/bosses/arenas.js)** are built from the same procedural pieces as biomes. A phase's `arena: { theme, palette, weather, particles, scrollSpeed, tint, darkness }` overrides its theme. 9 themes so far: `highway_burning`, `harbor_night`, `storm_front`, `underwater_trench`, `data_core`, `molten_floor`, `orbit_edge`, `arctic_sea`, `void_black`.
- **[Transitions](src/bosses/transitions.js):** `flash`, `fade`, `screen_tear`, `water_flood`, `warp_tunnel`, `darkness_swallow`, `armor_break`.
- **[ScoreStars](src/bosses/ScoreStars.js)** converts every bullet into up to 320 gold stars that home onto the player and pay 20 points per bullet.
- **[Rotation](src/bosses/index.js)** deals bosses from seeded **decks of all 6 archetypes**, one deck per 6 stages.
  - Every archetype appears once per deck before any repeat.
  - A deck never opens with the archetype that closed the previous one.
  - Deck *k* fields **Mk. (k+1)**, capped at III. Mk raises HP (+35% per Mk), score, medals, pattern rate, and adds a 1UP drop from Mk. II.
  - Interpretation: loops are 5 stages and there are 6 archetypes, so "all six per loop" is implemented as all six per 6-stage deck.
- **Framework test boss:** [SYNDICATE CORE PROTOTYPE](src/bosses/test/prototype.js), 5 authored phases:

  | Phase | Arena | Transition | Notes |
  |---|---|---|---|
  | Core Ignition | burning highway | flash | |
  | Storm Wall | storm front | screen tear | |
  | Deep Current | sonar trench | water flood | shielded dive cycle |
  | Data Lattice | data core | warp tunnel | |
  | Event Horizon | black void | darkness swallow | |

  Hell adds the **Last Light** desperation phase. Until M4c, the prototype fills every archetype slot. The intro card shows which slot ("… · EXTRATERRESTRIAL SLOT · 3 PHASES").
- Music layers are recorded by an [audio/music.js](src/audio/music.js) stub (`setLayer`) that M6 replaces.

**Verified** (headless Chrome, software GL, no console errors):
- Standard runs 3 phases (1 → 3 → 5) with correct cards; Hell runs 6 (5 + desperation).
- Bullets are converted to stars at each phase break (e.g. 174 bullets → 177 stars, including bullets from late split shots).
- The arena hands back after defeat: mode, palette and scroll speed are restored. The tally and stage 2 follow.
- Instant kill during the fly-in, instant kill mid-transition (transition cancelled, card removed) and a chain of phase clears all end in the death sequence and the tally.
- A shield blocks plain damage (0) but not `ignoresShields` (full).
- `instantPhaseClear`/`instantKill` destroy regular enemies, including through a flagged player shot. `ignoresShields` bypasses armour.
- Rotation: no back-to-back repeats over 8 seeds × 60 stages, and every deck holds all 6.
- M3 regression on Standard is identical: same numbers and waves, and waves → mid-boss → boss → tally → stage 2.
- Each transition effect was captured frame-frozen at its peak.

## M4c — Six archetype bosses

**Existing files touched:**

| File | Change | Why |
|---|---|---|
| [core/Game.js](src/core/Game.js) | One line: registers `buildBossSprites` with the renderer | Boss art has to live in the single sprite atlas. |
| [scenes/StageScene.js](src/scenes/StageScene.js) | Draws the boss controller's wells and telegraph layers; adds a "part destroyed" toast | M4b presentation code, extended |

The M1 Background is untouched. Arena-only scenes render through a delegate that [ArenaBackground](src/bosses/ArenaBackground.js) installs on the Background instance.

**The bosses** (each in `src/bosses/<archetype>/`, 5 authored phases, every phase with its own arena + themed transition):

| Archetype | Boss | Phases → arenas | Signature mechanics | Death |
|---|---|---|---|---|
| Ground | [Colossus Crawler](src/bosses/ground/colossusCrawler.js) | Overpass Siege (burning highway) → Tunnel Collapse (underground tunnel) → Scrapyard Sunset (desert scrapyard) → Molten Floor (foundry) → Siege Core (ash field) | Turrets and mortar pods are breakable parts. Track-crushing charges run down a telegraphed lane. Artillery marks floor zones that then detonate. | `tank_cookoff` |
| Aerial | [Skywarden Carrier](src/bosses/aerial/skywardenCarrier.js) | Dawn Patrol (cloud sea at dawn) → Storm Cell (lightning storm) → Aurora Ceiling (stratosphere) → Edge of Orbit → Re-Entry (plasma fire) | Drone swarms launch from the hangar bays. Beam curtains sweep across. Escorts fly mirrored formations. Wing pods are breakable. | `spin_out` |
| Sea | [Leviathan Dreadnought](src/bosses/sea/leviathanDreadnought.js) | Harbor Siege (harbor at night) → Storm Surge (open ocean storm) → Trench Dive (underwater) → Ice Breaker (arctic floes) → Maelstrom (whirlpool) | Broadsides fire from the gun ports and curve down. Torpedo lanes surface under the player. During the dive cycle the boss is shielded and drawn as a submerged silhouette. Deck guns are breakable. | `sink_and_explode` |
| Mecha | [Titan Enforcer](src/bosses/mecha/titanEnforcer.js) | Plaza Enforcement (corporate plaza) → Helipad Downpour (rooftop in rain) → Data-Core Override (circuitry) → Orbital Ascent (elevator) → Desperation Protocol (red alert) | Three forms: armoured, wings deployed, burning core. Melee swipes lunge and sweep a telegraphed arc. Spiral danmaku. A low-HP desperation phase. Shoulder cannons are breakable. | `meltdown` |
| Extraterrestrial | [Hive Sovereign](src/bosses/extraterrestrial/hiveSovereign.js) | Invasion Day (city under invasion) → Mothership Hold → Crystal World → Nebula Throne → Singularity | Gravity wells bend bullet paths. Crystalline shards split. The boss and its weak-point cores teleport. Glyph patterns fly out as expanding sigils. | `implode` |
| Abyssal | [Maw of the Deep Below](src/bosses/abyssal/mawOfTheDeep.js) | Drowned City → Sunken Cathedral → Lightless (only the player's light pool) → The Gullet (inside the creature) → Heart of the Deep | Darkness limits visibility; bullets stay lit. Tendrils grab from the screen edges. Eyes open as weak points that pass ×2 damage through the veil. Sanity distortion. Ghost bullets fade in and out. | `dissolve` |

On Hell each boss appends a themed desperation phase: Scorched Earth, Freefall, All Hands Lost, Overload, Event Horizon, The Endless Dark.

**Framework additions:**
- **[kit.js](src/bosses/kit.js):**
  - **Breakable parts** have their own HP and drop medals. Breaking one costs the boss a chunk of phase HP. Some parts are `free` (they teleport), and `eye` parts open and close and pass damage on to the boss.
  - **Minions.**
  - **Telegraphed hazards:** `circle` artillery, `lane`, `arc` swipe and `tendril`.
  - **Gravity wells.**
  - **Ghost bullets:** a per-step frame swap, so bombs and cancels still clear them normally.
  - **Glyph volleys.**
  - Everything is cleared on phase end and on defeat. Remaining parts detonate without medals.
- **Controller:**
  - Per-phase `sprite` forms swap at the arena midpoint with a burst.
  - `onStart` hooks, a `snap` teleport, and `ease` for charges and lunges.
  - Six archetype death styles share one timeline, so every death still ends in `killEnemy`.
- **[ArenaBackground](src/bosses/ArenaBackground.js)** adds 14 new procedural scenes (modes 10–23): tunnel, desert, clouds, ocean (plus maelstrom), underwater, ice, rooftop, circuit, hive, crystal, nebula (plus singularity), flooded city, cathedral, flesh.
  - **31 arena themes** in [arenas.js](src/bosses/arenas.js): 30 boss phases plus the prototype's.
  - **New ambient layers:** dust, sandstorm, heat haze, lightning, marine snow, alarm strobe, tractor beams, spores, sanity distortion, and a **vision veil** (`light` radius).
  - **New transitions:** `rockfall`, `sandstorm`, `lava_flood`, `ice_crack`, `membrane`, `cloud_burst`.
- **Mk. II / III:** each boss gates extra pattern layers on `ctrl.mk`, on top of the M4b HP, rate and drop scaling. The name gets a "MK. II" or "MK. III" suffix.
- The prototype boss stays registered for testing but is no longer in the rotation.

**Verified** (headless Chrome, software GL, no console errors):
- Every boss runs its full flow **on Extreme (5 phases)**: each phase's arena, parts, hazards, minions and wells are present, its form is correct, and it reaches the transition, the death and the tally.
- Every boss runs its full flow **on Hell at Mk. III (6 phases, desperation included)**, the heaviest configuration.
- M3 regression on Standard is unchanged.
- The M4b framework suite still passes on the real bosses:
  - instant kill during entry
  - instant kill mid-transition, with the transition cancelled cleanly
  - shield rule and phase-clear chain
  - rotation, and arena hand-back

## M4d — World & faction pass (UPDATE_02)

**Existing files touched** (small additive hooks only; listed before the work began):

| File | Change | Why |
|---|---|---|
| [core/gl/Renderer.js](src/core/gl/Renderer.js) | Atlas is 4096² when `MAX_TEXTURE_SIZE` allows it, else 2048 | Boss hulls at 50–80% field width plus faction variants don't fit in 2048² |
| [core/Game.js](src/core/Game.js) | Adds `buildFactionSkins` to the sprite-builder list | Faction-tinted enemy variants |
| [entities/enemies/index.js](src/entities/enemies/index.js) | One `skinEnemy()` call after spawn | Swaps frames only; behaviour and patterns unchanged |
| [entities/World.js](src/entities/World.js) | Hit-flash strength is now `e.flashA` (default 0.8, reset in the pool) | Big bosses use 0.15 so constant fire doesn't bloom them white |
| [stages/StageGen.js](src/stages/StageGen.js) | `biomeOrder` deals one new biome into each loop from its own RNG stream | §2.7; the M3 shuffle draws are unchanged |
| [scenes/StageScene.js](src/scenes/StageScene.js) | Faction state per stage, intro card, faction WARNING and intro text, air-unit drop shadows, boss surface layer drawn before the vision veil | §2.8, §1.5, §4.3 |
| [scenes/PilotSelectScene.js](src/scenes/PilotSelectScene.js) | Personnel-file line under the bio | Pilot lore data |
| [bosses/BossController.js](src/bosses/BossController.js), [kit.js](src/bosses/kit.js), [art.js](src/bosses/art.js), [ArenaBackground.js](src/bosses/ArenaBackground.js) | Visual-only boss retrofit: look layer, faction-tinted parts, new hull art, crater shader mode | §4.4 / §5 retrofit; **no HP, phase, pattern, transition or damage-flag changes** |

**New data** (UPDATE_02 §3, under `src/data/`):
- [lore/world.js](src/data/lore/world.js):
  - New Meridian's six layers, the Breach and Project HALCYON, the Precinct, Vincenzo;
  - 12 loop story lines plus a night-one line. They cycle after loop 13, and the card always shows the real loop number.
- [lore/pilots.js](src/data/lore/pilots.js): origin, rival faction and a personnel-file line for all 17 pilots, keyed by pilot id. It adds to the pilot data and doesn't replace it.
- [factions/*.js](src/data/factions/): the six syndicates, in the shape from §3. Each file also carries:
  - a greeble palette;
  - faction display names for tinted M3 enemies;
  - hit effect, emblem, WARNING line and dispatch lines.

  [factions/index.js](src/data/factions/index.js) holds:
  - archetype → faction;
  - biome ownership (§2.7);
  - each M3 enemy's home `faction`, applied to the roster defs;
  - `stageFactions(plan)`, which picks the owner and a seeded dispatch line and resolves split territories:
    - Corporate Spire: Helix on the ground, Stratos in the air;
    - Orbital Elevator: Helix before the mid-boss, the Choir after it.

**New systems:**
- **[Greeble generator](src/fx/greeble.js)** (§4.2/4.3):
  - BSP panel seams with lit edges and rivet rows; hazard stripes, vents with hot glow, pipe runs with clamps, cable bundles, turbine discs, energy cores, lamp sockets;
  - mirrored layout, seeded per machine, palettes taken from the faction data;
  - a top-left `keyLight` and an embossed `bevel` for every plate;
  - returns its idle lights so the runtime can blink them.
- **[Faction skins](src/fx/factionSkins.js):** every M3 enemy sprite (and turret overlay) gets one recoloured copy per faction, `<sprite>@<faction>`:
  - paint and emissive colours take the faction hue, and metal keeps its shading tinted toward the faction plate;
  - big hulls also get a masked greeble pass.

  In stages enemies wear the territory owner's colours; in the test range they wear their home faction's. Boss parts that reuse enemy art take their boss's faction. Start-up reads the atlas back once for the whole roster band, which took the build from 28 s to 0.35 s under software GL.
- **New biomes** ([stages/biomesExtra.js](src/stages/biomesExtra.js), registry entries only):

  | Biome | Owner | Background |
  |---|---|---|
  | Sunken Undercity | Drowned Covenant | flooded-city arena shader, sickly green and crimson |
  | Fallen Star Crater | Choir of the Outer Star | new arena mode 24 `CRATER`: impact bowls, glowing fissures, crystal clusters |

  Exactly one of the two appears in each loop, never as the opener.
- **[Faction intro card](src/ui/factionCard.js):** code-generated [emblem](src/ui/emblems.js), faction name, leader, stage and territory, a typed-out dispatch line, and a second-faction line on split territories. At a loop start it also carries `LOOP N` and that loop's story line.
- **Faction text:** WARNING lines are now per faction (e.g. "BLACK TIDE FLAGSHIP ON THE MOVE"), and the boss intro shows the faction tag.
- **Drop shadows** (§4.3): every airborne enemy, and the airborne bosses, casts a shadow offset down-right onto the ground layer.

**Boss visual retrofit** ([hulls.js](src/bosses/hulls.js), [look.js](src/bosses/look.js), [looks.js](src/bosses/looks.js)). Visuals only:
- same sprite names;
- each hull designed around the existing anchor points (part offsets, gun ports, muzzles, wing guns), so bullets still leave visible weapons;
- collision radii unchanged.

| Boss | Width | Construction | Idle animation | Weak point |
|---|---|---|---|---|
| Colossus Crawler | 300 (62%) | four treads on outrigger sponsons, engine deck + smokestacks, welded scrap patches, dozer ram | treads roll with movement, exhaust puffs | reactor (engine deck) |
| Skywarden Carrier | 344 (72%) | swept flying wing, flight deck with runway markings, lift fans, segmented tail, open hangar bays | spinning lift fans, afterburner flicker, drop shadow | lift core |
| Leviathan Dreadnought | 236 (49%) | trimaran: main hull + barnacled outriggers on brass gantries, verdigris deck, brass gun ports, sonar dome | wake foam, funnel smoke, bubbles while submerged | reactor hatch |
| Titan Enforcer | 304 (63%) | M4c mech ×1.25, ceramic armour over machinery, Helix mark, folded binders (form A) → open energy wings (B) → blown-off armour (C) | thruster plumes, drop shadow | chest core |
| Hive Sovereign | 300 (63%) | layered iridescent carapace, crystal crown, crystal-tipped tendril fins, fused crystal clusters | pulsing veins, two counter-rotating glyph rings | eye-core |
| Maw of the Deep | 344 (72%) | flesh ring with bone ribs, coral-crusted cathedral arches, suckered tentacles, eye sockets for the eye parts | swaying tentacles, blinking bioluminescence | gullet |

Every boss also gets:
- **Weak-point glow:** brightens and pulses faster as the phase's HP drops.
- **Damage states at 66% and 33% of each phase:**
  - machines: dents, then exposed machinery, smoke plumes, sparks, and plates breaking off;
  - organic bosses: glowing wounds and ichor drips.
- **Faction hit effects:** sparks, flak, water splash, electric arcs, crystal chips, ink.
- **Blinking idle lights** from the greeble pass.
- **Death extras (§4.7):** chain blasts across the hull's damage sites, debris rain, then lingering ground fire, crystal shards or ink pools by faction.

**Verified** (headless Chrome, software GL, no console errors):
- Update 02 verification before any code (see above).
- All six bosses with the retrofit:
  - fly-in, phase 1, damage stage 1 at 50% and stage 2 at 20% phase HP, the death sequence, and the tally;
  - screenshots reviewed. The Titan's ceramic and the Hive's shell highlights were darkened, and the boss hit flash reduced, after bloom washed them out.
- **Factions in stages:**
  - stage 1 is Ironclad, with the intro card, a seeded dispatch line and tinted waves (`e_flak@ironclad`, `e_turret@ironclad`, `e_bike@ironclad`);
  - the Undercity and the Crater both render with their owners' colours;
  - first 10 stages on `TESTSEED`: skyway, datacore, **undercity**, elevator, spire, storm, elevator, datacore, skyway, **undercity**.
- **Regression on the final build:** the M3 suite, the M4b framework suite and all six bosses on Extreme (see the M4d changelog).

## M5 — The full roster (16 standard pilots + Vincenzo, Legendary)

**Existing files touched** (listed before the work began; all additive):

| File | Change | Why |
|---|---|---|
| [pilots/index.js](src/pilots/index.js) | Registers all 17 pilots; `getRoster()` shows Warden as a sealed slot until unlocked | Roster |
| [scenes/PilotSelectScene.js](src/scenes/PilotSelectScene.js) + [ui/ui.css](src/ui/ui.css) | 9-column grid: 8×2 standard tiles plus a tall Legendary tile; grid navigation; panels moved below the grid (the old second row was hidden under the info panel); unlock hint; Legendary theme and choir sting; dev `U` unlock | §3 select screen, UPDATE_01 §2.7 |
| [ui/portraits.js](src/ui/portraits.js) | New hair styles, eyes and accents, twin portraits, Legendary backdrop. The original four portraits draw exactly as before. | 13 new faces |
| [ui/CutIn.js](src/ui/CutIn.js), [scenes/PlayScene.js](src/scenes/PlayScene.js) | Cut-in takes a custom title/sub/length; `ultimate.cutin` lengthens the freeze; new `cutin` and `toast` pilot events | Vincenzo's 1.5 s / 2 s cinematics, pilot feedback |
| [ui/Hud.js](src/ui/Hud.js), PlayScene | Legendary runs save under a separate hi-score key (`<difficulty>.legendary`); HUD tag | UPDATE_01 §2.7 |
| [scenes/StageScene.js](src/scenes/StageScene.js) | On `bossDefeated`: record the archetype (Warden's weapon) and unlock Warden | Warden is unlockable |
| [audio/sting.js](src/audio/sting.js) | `playChoir()` | Legendary select sting |

`Player.js` is untouched. Vincenzo's intangibility uses the existing `onHit` hook, which every hit path (bullets, lasers, hazards, body contact) already goes through.

**Shared pilot helpers** ([pilots/common.js](src/pilots/common.js)):
- **§4.6 firing concepts:** muzzle flashes, impact bursts, ring pulses, jagged lightning strands (`zap`), lock-on target picking, chain targets;
- **`stun()`**, which pauses a regular enemy's AI without touching bosses;
- **`shipScale()`**, which lowers resolution on 2048 atlases.

**The new pilots.** Every pilot has:
- 4 tier sprites that visibly change;
- option pods by tier;
- a main shot and a focus shot;
- a special, a bomb, and an ultimate with a cut-in;
- muzzle flashes;
- shots in cool or translucent colours (§4.5).

| # | Pilot / vehicle | Shot · Focus | Special | Bomb · Ultimate |
|---|---|---|---|---|
| 5 | Oduya Rex · Thunderjaw | arcing plasma mortars that curve onto targets and burst · chain-lightning strand that locks on and jumps | Ground-Slam EMP (clear + stun) | Storm Cell · Chain-Lightning Storm |
| 6 | Lin Hayase · Petal Engine | petals + seeds that take root as turrets (turrets eat bullets) · converged petals, every turret fires on your target | Bloom (instant garden) | Petal Storm · Forest of Light (beam pillars) |
| 7 | Miguerre Zo'Rajah · Overclock | fire rate climbs with heat (9 → 2 steps), heat gauge · Heat Lance widens with heat | Vent Blast (cone ∝ heat) | Nitro Wall · Meltdown Nova |
| 8 | Sera Voss · Glacier | piercing frost shards that chill bullets · Cryo Beam slows every bullet in its path | Cryo Shell (frost field) | Absolute Zero · Time-Stop Shatter (bullets hang, regular enemies freeze, then shatter) |
| 9 | NOVA-7 · Cipher | homing data bolts · Breach Beam: hold the lock to **hack** an enemy into an ally that hunts its squad, then self-destructs | Firewall | System Crash · City-Wide Override (all regulars hacked, all bullets rewritten) |
| 10 | Rufus Graine · Junkyard Saint | the hopper deals a random scrap gun every 2 s (nails, rails, springs, saws, bolt flak) · Magnet Choke | Magnet Pull (vacuums items, swallows bullets into a ball you fling) | Scrap Storm · Junk Meteor |
| 11 | Aiko Brandt · Tempest | corkscrew rotor streams + tornado cells that grind and sweep bullets · drill-wind cells held ahead | Downdraft (blows bullets away) | Cyclone Walls · Hurricane Eye |
| 12 | Maj. Eldon Pike · Bastion | heavy twin cannons + escort drones (2/3/4/6) in V formation · drones lock into a firing line on your target | Scramble (drones become homing interceptors) | Siege Grid · Full Air Squadron Strike (3 V-formations) |
| 13 | Zuri Ankara · Solar Fang | translucent solar darts · Fang Beam grows with hold time (3 s); release at full charge → Solar Lance | Solar Flare | Corona · Miniature-Sun Collapse |
| 14 | Cass Rivera · Pulse Rider | sonic rings on a 128 BPM beat clock, bass ring on the downbeat · tight groove | **Drop the Beat:** on-beat presses stack ×1.25 damage (to ×2), off-beat resets; beat ring shows the window | Subwoofer · Bass-Drop Shockwave |
| 15 | Holt & Holt · Gemini | the twin mirrors your flight across the centre line; both fire · twins dock → Binary Lance | Tether (damaging laser link) | Twin Cross · Binary Star |
| 16 | "Warden" · Verdict *(unlockable)* | **adaptive:** the gun copies the last main boss defeated, e.g. Crawler → siege slugs, Carrier → curtain lances, Leviathan → torpedoes, Titan → spiral docket, Hive → crystal shards, Maw → void writs · Verdict Beam | Objection (cross seal) | Sentence (gavel) · Final Judgment |

- **Warden unlock:** defeating any Undercrown main boss unseals Warden. The unlock and the last archetype persist in `localStorage` (`npo.unlocks.v1`), and a boss beaten mid-run re-teaches the weapon at once.

**Vincenzo the Conqueror · Dimensional Hypership · LEGENDARY** ([pilots/vincenzo.js](src/pilots/vincenzo.js), UPDATE_01 §2). Gold, white and void black only (§4.6).
- **Holy Bullets:** a dense golden-white stream, 9–13 rounds every 2 steps.
  - pierce, and `ignoresShields`;
  - each bullet has a **60%** chance (gameplay RNG, so replays match) to carry `instantPhaseClear`: regular enemies and mid-bosses die, and a main boss loses its current phase, so every arena transition still plays;
  - golden smite bursts mark the procs.
- **Absolute Intangibility:** `onHit` absorbs everything with a ripple. Grazing still charges the ultimate, and lives are never lost.
- **Bomb, Dimensional Rifts:** five rifts fire one-hit beams (`instantKill`), then a 1.5 s Void Mecha cut-in.
  - The **Void Mecha** form lasts `VOID_FORM_DURATION` (12 s). Its screen-wide slashes leave rifts; abyssal hands grab anything near a rift and drag it in. A grabbed main boss is defeated.
- **Ultimate, The God's Trumpet:** the mecha (or ship) shatters, a 2 s cut-in plays, and the four-winged divine owl takes over for `DIVINE_FORM_DURATION` (20 s).
  - Every attack is the Trumpet: a screen-wide wave that one-hit-kills everything, bosses included.
- **Presentation:**
  - an animated gold/void select tile with shimmer, LEGENDARY badge and a gold theme;
  - a synthesized choir sting;
  - the gold cut-in band and a HUD tag;
  - a separate Legendary hi-score key.

**Verified** (headless Chrome, software GL, no console errors):
- **Select screen:** 17 slots, the Legendary tile and gold theme. Warden shows "UNLOCK: DEFEAT ANY UNDERCROWN MAIN BOSS" until unlocked.
- **Test range:** each of the 13 new pilots at tier 4 for shot, focus, special, bomb and ultimate, with screenshots reviewed. Every ultimate fires.
- **Vincenzo against real bosses on Hell:**
  - Holy procs clear all 6 Titan phases (desperation included) one transition at a time, then death → tally → stage 2.
  - A Void Mecha hand grab defeats the Hive Sovereign → tally.
  - The Trumpet during the Maw's fly-in → defeat → tally → stage 4.
  - 0 deaths.
- **Regression:** the M3, M4b and six-boss suites on the final build (see the M5 changelog).

## M6 — Audio engine and adaptive music

Everything is synthesized with the Web Audio API at runtime; there are no sound files. Audio unlocks on the first key, pointer or pad press (browser autoplay rules). Until then every call is a no-op, so the game never waits on audio.

**New files** ([src/audio/](src/audio/)):

| File | What |
|---|---|
| [engine.js](src/audio/engine.js) | AudioContext + master mixer: music bus (low-pass for the bomb "underwater" sweep and pause muffle → duck → volume), sfx bus (duck → volume), hall reverb per bus, a 5 s cathedral reverb (Trumpet, choir), tempo-synced echo, soft clip → limiter. `duck()`, `muffle()`, volume sliders (squared curve), peak meter |
| [synth.js](src/audio/synth.js) | Voice primitives: `tone` (unison, glide, vibrato, filter env, drive, pan, sends), `noise` (white/pink/brown), `fm` bells, `kick`, `snare`, `clap`, `hat`, `metal` (six-square cymbal/anvil), `pad` (detuned chords or choir formants), `pluck` |
| [themes.js](src/audio/themes.js) | **Musical identity per faction** (data only) + the boss-layer parser |
| [music.js](src/audio/music.js) | Look-ahead step sequencer + adaptive layers; replaces the M4b stub, `setLayer()` / `layer` unchanged |
| [sfx.js](src/audio/sfx.js) | Effect library with per-id throttling (minimum gap + max per 100 ms) |
| [pilotVoices.js](src/audio/pilotVoices.js) | Shot and special voices for all 17 pilots (data keyed by pilot id; pilot files untouched) |
| [director.js](src/audio/director.js) | Maps world events → sfx and computes the music intensity each step |

**Faction themes** (each has its own tempo, mode, drum kit, bass, pad, arp, lead timbre and a 2-bar leitmotif; the boss theme reuses the leitmotif harder and faster):

| Style | Feel | Stage / boss BPM | Mode | Signature |
|---|---|---|---|---|
| Precinct 9 (menus, prototype, test range) | Synthwave pursuit | 112 / 128 | A aeolian | Gated snare, octave bass, pulse arp |
| Ironclad Brotherhood | Foundry industrial | 136 / 144 | E phrygian | Distorted chug bass, anvil clanks, power chords |
| Stratos Cartel | Sky-lane drum & bass | 174 / 176 | F lydian | Two-step breaks, reese bass, fast airy arps |
| Black Tide | Salt-synth shanty | 124 / 132 | D dorian, swung | Reed "accordion" lead, oom-pah, foghorn + bubbles |
| Helix Dynamics | Corporate electro | 150 / 156 | A harmonic minor | 16th sequencer bass, gated organ, data blips |
| Outer Star | Crystal hymn | 104 / 112 | Whole-tone | FM glass bells, gliding theremin lead, 5-against-4 glyph chimes |
| Drowned Covenant | Sunken requiem | 78 / 84 | B locrian | Heartbeat kick, choir pads, bell tolls, brown-noise undertow |

**Adaptive music:**
- **Layers:** pad → bass → drums → arp → lead → perc. The stage track opens them by **intensity 0–4**, computed from bullet count (70 %) and enemy count (30 %). It rises fast and falls slowly, and changes land on bar lines.
- **Stage:** the owning faction's theme (`stageFactions().main`).
  - The mid-boss raises the floor to level 3.
  - A boss WARNING strips the track back to pad and perc for two bars under the siren.
- **Boss:** the `musicLayer` ids the bosses already emit (`sea_p3` …) pick the faction's boss theme. Each phase changes the arrangement:
  - **p1:** lead in;
  - **p2:** perc and an alternate chord on odd bars;
  - **p3:** key +2 and an octave-jumping bass;
  - **p4:** key +3, double-time hats, lead an octave up;
  - **p5:** key +5 and a harmonised lead;
  - **`_desperation`:** tempo +8 %, a half-step up, distortion, everything on.
  - Changes wait for the next bar, with a riser on the last beat and a crash on the downbeat.
- **Stingers:** stage clear (fanfare over the pad) and game over (falling line, music fades).
- **Scheduler:** a 25 ms timer schedules notes 0.12–0.35 s ahead on the audio clock. The look-ahead grows if timer ticks arrive late (busy main thread), and the scheduler skips forward after a hidden tab instead of bursting.

**SFX highlights:**
- **Explosions:** three layers (sub thump + noise burst + metallic tail) in four sizes from enemy HP. Boss parts and boss deaths get a chained 2.5 s sequence.
- **Feedback:** graze tick (pitch climbs with the streak), boss hit tick, item chimes (P / B / S / medal pitch by value / 1UP fanfare), tier-up arpeggio, ULT READY shimmer, "not ready" buzz.
- **Bomb:** heavy impact, with the music ducked and swept underwater for the bomb's length.
- **Ultimate:** a riser through the cut-in, then the impact when play resumes. Music is ducked.
- **Warnings and transitions:**
  - two-tone boss siren over sub hits, plus a mid-boss alert;
  - boss intro "braam" in the boss faction's key;
  - phase break: glass shatter into a chime cascade;
  - arena crossfade whoosh;
  - laser-telegraph charge whine;
  - soft enemy-volley ticks.
- **Pilots:** a distinct shot voice per pilot. Examples: Miguerre's pitch climbs with engine heat, Holt fires left/right twins, and Cass drops a bass hit on her beat. Beams get a sustained hum, and every pilot has its own special sound.
- **Vincenzo:** the Trumpet is a B♭ brass stack with a semitone scoop into the 5 s cathedral reverb. The Void Mecha slash and the hand grab have their own sounds; the choir select sting now runs through the mixer.
- **Menus:** the Precinct theme plays under difficulty and pilot select; UI ticks, confirm and back sounds.

**Mixer:**
- Pause muffles the music (600 Hz low-pass) and mutes sfx.
- The pause menu has **MUSIC** and **SFX** volume rows (◀ ▶ in 10 % steps), saved in Settings.
- Music sits about 4 dB under the sfx; a soft clip and limiter guard the output.
- The stats overlay (`` ` `` / F3) shows an `audio` line: style, BPM, open layers, intensity, live voices and throttled sfx.

**Existing files touched** (listed before the work began; all additive):

| File | Change |
|---|---|
| [audio/music.js](src/audio/music.js) | Stub replaced by the engine; `setLayer()` / `layer` kept |
| [audio/sting.js](src/audio/sting.js) | Same exports (+ `playBack`), now routed through the mixer |
| [main.js](src/main.js) | `attachAudio(game.settings)` |
| [entities/World.js](src/entities/World.js) | `shotsFired` counter in `shot()` (one sound per volley) |
| [scenes/PlayScene.js](src/scenes/PlayScene.js) | Creates the AudioDirector; forwards events and steps; pause muffle; volume rows; `audio` stats line |
| [scenes/StageScene.js](src/scenes/StageScene.js) | `music.setStage(faction)` per stage (replaces `setLayer(null)` there) |
| [scenes/DifficultySelectScene.js](src/scenes/DifficultySelectScene.js), [scenes/PilotSelectScene.js](src/scenes/PilotSelectScene.js) | `music.menu()`; tick / confirm / back sounds on pilot select |
| [pilots/vincenzo.js](src/pilots/vincenzo.js) | `sfx` events for the Trumpet, slash and grab (no logic change) |
| [ui/ui.css](src/ui/ui.css) | Style for the volume rows |

No boss, enemy, pattern, HP, phase or damage-flag changes. No renames.

**Verified** (headless Chrome, software GL, `--autoplay-policy=no-user-gesture-required`):
- **Audio unlock:** the context runs after the first key press; the menu theme is audible.
- **Stage start:** plays the faction track (Skyway → Ironclad); layers open as bullets build up (`pad,bass` → `+drums,arp`).
- **Bomb:** music duck drops to 0.35 with the low-pass at 280 Hz, and both recover after the bomb.
- **Ultimate:** music duck drops to 0.25.
- **Pause:** the low-pass drops to 600 Hz and comes back on resume. The volume rows change the setting and the bus gain.
- **All six bosses (Extreme, instant phase clears):** each plays stage track → boss p1 → p2 → p3 → p4 → p5 → desperation → next stage's faction track, then the tally.
- **Output health:** peak ≤ 0.90, no NaN, live voices ≤ 125 at the busiest, and back to idle afterwards (no leaks).
- **All 17 pilots in the test range** play their shot voice, special, bomb and ultimate. Cass's downbeat bass drop and Vincenzo's Trumpet (8 blasts in one Divine Form) fired. No console errors.
- **Regression:** the M4a, M4b and six-boss suites on the final build (see the M6 changelog).
- **Not verified:** the mix by ear. It was tuned from meters only; see Known issues.

## M7a — Scoring and high-score tables

M7 is split into three committed steps: **M7a** scoring, **M7b** flow and UI, **M7c** polish and performance.

**Rules** (all numbers in [core/scoring.js](src/core/scoring.js)):

| System | Rule |
|---|---|
| Kill combo | Kills within 2 s (120 steps) of each other build a chain. Every 8 kills add ×0.25 to the kill-score multiplier, up to ×4.0. Replaces the old `1 + chain × 0.05` bonus. HUD: chain count, multiplier (gold from ×2) and a draining timer bar |
| Medal chain | Each medal is worth 100 more than the last (cap 10,000). A medal that falls off-screen resets the value to 100: MEDAL CHAIN BROKEN toast + sound. HUD shows the current value |
| NO-BOMB boss | A boss defeated without a bomb during the fight pays 300,000 (mid-boss 80,000) × loop. It appears as a NO-BOMB BOSS tally row and a toast at the kill. Counter-bombs count as bombs |
| Extends | 1UP at 2M, 6M, 12M, then every 12M, each × the difficulty score multiplier. Lives cap at 8. Thresholds already claimed stay claimed after a continue (no farming). HUD shows the next threshold |
| Tally | Count-up tick sounds |

All gains still pass through the difficulty score multiplier (UPDATE_01 §3).

**High-score tables** ([core/hiscores.js](src/core/hiscores.js), [ui/ranking.js](src/ui/ranking.js)):
- **Boards:**
  - one board per difficulty, plus `<difficulty>.legendary` for Vincenzo;
  - top 10 each;
  - entries record initials, score, pilot, seed, difficulty, stage reached (loop-stage), continues used and date.
- **Saving:**
  - On game over, a placing score opens **initials entry**. Controls: ▲▼ letter, ◀▶ move, Z next, X back. The continue timer waits.
  - After entry, the game-over screen shows the top 5 with your entry highlighted.
- **Continues and quitting:**
  - Each credit is recorded separately (a continue resets the score to the continue count, arcade style).
  - Quitting mid-run from the pause menu records the credit silently under your last initials.
  - The test range is unranked.
- **Migration:** the pre-M7 single hi-score per board is imported once as a `---` entry.
- **HUD HI:** reads the board's best, and keeps the run's best across continues.

**Existing files touched:**

| File | Change |
|---|---|
| [entities/World.js](src/entities/World.js) | Kill score uses `comboMult`; medal constants; `medalBreak` event |
| [stages/StageDirector.js](src/stages/StageDirector.js) | Bombs-used snapshot at boss spawn; `bossNoBomb` event; NO-BOMB BOSS tally row |
| [ui/Hud.js](src/ui/Hud.js) + [ui/ui.css](src/ui/ui.css) | HI from the ranking table (old `saveHiScore` removed); multiplier, chain timer, medal value, next extend |
| [scenes/PlayScene.js](src/scenes/PlayScene.js) | ExtendTracker, extend checks, initials entry, ranking on game over, per-credit records, new toasts |
| [scenes/StageScene.js](src/scenes/StageScene.js) | `stageLabel()`; tally tick sounds |
| [audio/director.js](src/audio/director.js), [audio/sfx.js](src/audio/sfx.js) | `medalBreak` and `bonus` sounds |

**Verified** (headless Chrome, Standard):
- **Combo:** 17 kills of a 300-point drone pay 300 at chain 1–7, 375 from chain 8 and 450 from chain 16. The HUD reads `17 · ×1.5`.
- **Medal chain:** a dropped 700 medal resets the value to 100, with toast and sound.
- **Extend:** crossing 2,000,000 adds a life, the next threshold shows 6,000,000, and the sound plays.
- **NO-BOMB boss:** the tally shows `NO-BOMB BOSS · BOSS · 300,000`; 19 tally ticks played.
- **Game over and ranking:**
  - game over at 2.64M → initials entry → "MQO" saved as 1st;
  - the table shows it highlighted above the migrated 12,345 record.
- **Continue and quit:** a continue starts a new credit, and quitting recorded it as a second entry (`cont: 1`). The HUD HI stays at the run best.
- **Regression:** the M4b and six-boss suites (see the M7a changelog).

## M7b — Flow and UI

**Flow** (prompt §8): **Title** → (idle 20 s) **attract demo** → **ranking** pages → title. START → difficulty → pilot select → stage … → game over → **results** → pilot select.

**New screens** ([src/scenes/](src/scenes/)):

| Scene | What |
|---|---|
| [MenuScene.js](src/scenes/MenuScene.js) | Shared base: city backdrop, menu theme, a row-list helper (↑↓ choose, ◀▶ change, Z select, X/Esc back) |
| [TitleScene.js](src/scenes/TitleScene.js) | Neon logo, lore tagline; START / PRACTICE (greyed until a boss is reached) / RANKING / OPTIONS. Starts the attract cycle after 20 s idle |
| [AttractScene.js](src/scenes/AttractScene.js) | Demo play: a random standard pilot on a random seed and stage (Medium). An autopilot steers under the nearest enemy, dodges predicted bullet positions with inverse-square repulsion, keeps off the walls, focuses in thick fire, bombs when cornered, and fires one showcase ultimate. ~36 s, then the ranking pages; any key returns to the title. Unranked; it never unlocks anything; the player's seed is restored |
| [RankingScene.js](src/scenes/RankingScene.js) | The M7a boards: ◀▶ per difficulty plus Legendary boards that have entries. In attract mode it pages itself |
| [OptionsScene.js](src/scenes/OptionsScene.js) | Graphics quality, CRT, screen shake, master / music / SFX volume, **CONTROLS** (key remap) |
| [PracticeSelectScene.js](src/scenes/PracticeSelectScene.js) + [PracticeScene.js](src/scenes/PracticeScene.js) | **Practice** for any boss reached in a run, at any Mk. reached, at a chosen difficulty |
| [ResultsScene.js](src/scenes/ResultsScene.js) | Run summary after game over: final score, ranking place, pilot, difficulty, stage reached, time, kills, max chain, graze, bombs, ships lost, continues. Rows count in; Z skips |

**Key remap:**
- Pick an action, then press a key. The key becomes that action's primary binding and is removed from every other gameplay action, so one key never drives two.
- Menu keys (confirm / back) keep their own bindings. Esc cancels a capture.
- RESET TO DEFAULTS restores everything. Gamepads use the standard layout (not remappable in the UI).

**Practice:**
- **Unlocking:** a boss unlocks when it appears in a ranked run (`unlocks.seen[id] = highest Mk.`).
- **Arena:** the fight runs on the boss faction's home biome as a two-section plan (boss → tally) on the normal arena boss path.
- **Scoring:** practice is unranked.
- **Exits:** the tally leads to results and then back to the boss list. Pause → quit returns to the list.
- **Warden:** a practice kill still counts as a boss defeat for unlocking Warden. Reaching a boss already required a real run.

**Existing files touched:**

| File | Change |
|---|---|
| [main.js](src/main.js) | Boots into the title screen |
| [scenes/DifficultySelectScene.js](src/scenes/DifficultySelectScene.js) | X/Esc back to the title |
| [scenes/PilotSelectScene.js](src/scenes/PilotSelectScene.js) | Practice launch (+ badge); back returns to the practice list |
| [scenes/PlayScene.js](src/scenes/PlayScene.js) | `difficultyId` / `playerOpts` overrides; run stats; game over → `endRun()` → results → `afterResults()`; `summary()` |
| [scenes/StageScene.js](src/scenes/StageScene.js) | `makePlan()` / `nextStage()` hooks; records bosses reached; no unlocks from the attract demo |
| [entities/Player.js](src/entities/Player.js) | `autopilot` hook for demo ships |
| [pilots/unlocks.js](src/pilots/unlocks.js) | `bossesSeen()` / `recordBossSeen()` |
| [core/Settings.js](src/core/Settings.js), [audio/engine.js](src/audio/engine.js) | `masterVolume` |
| [audio/music.js](src/audio/music.js) | A WARNING breakdown that is still running carries over a track swap (it was lost when a stage started from the menu theme) |

**Verified** (headless Chrome, dev server):
- **Title:** boots to the title with PRACTICE greyed out.
- **Ranking:** ◀▶ switches boards; back returns to the title.
- **Options:** quality, CRT and master volume change both the settings and the master bus (80 % → 0.576).
- **Key remap:**
  - SHOT → Q gives `[Q, Z, J, Space]`;
  - binding BOMB → Q removes Q from SHOT;
  - RESET restores the defaults.
- **Practice:**
  - unlocking Colossus (Mk. II) and Maw shows both, with four locked rows;
  - the Mk. cycles; pilot select shows the badge;
  - the plan is `boss:colossus_crawler:mk2,tally` on Skyway;
  - the kill leads to results (PRACTICE RESULTS · COLOSSUS CRAWLER MK.II), then back to the list.
- **Difficulty select:** Esc returns to the title.
- **Attract demo:**
  - the autopilot moves, dodges and kills (14 kills in ~15 s, no deaths, no unlocks);
  - it hands over to the ranking pages; a key returns to the title; the seed is restored.
- **End of run:** game over at 123,456 → initials → RESULTS (1ST PLACE · STANDARD) → pilot select.
- **Regression:** the M4b and six-boss suites (see the M7b changelog).

## M7c — Polish, robustness, performance, balance

### Robustness
- **WebGL context loss** (driver reset, GPU switch, tab eviction):
  - The game freezes behind a "GRAPHICS DEVICE RESET · RESTORING…" notice; no blind play.
  - On `webglcontextrestored`, every GL object is rebuilt in place: atlas texture, sprite batch, post passes and targets, stage and arena background shaders, and the shared fullscreen VAO.
  - All game state is kept.
  - The atlas lives on a CPU canvas, so re-uploading it is cheap.
- **2048-texture fallback** (GPUs without 4096 textures):
  - This used to fail at start-up ("Atlas full while adding b_maw").
  - Now an overflowing atlas is rebuilt at a lower texel density (×0.85 per retry) instead. Sprites keep their world size and only get softer.
  - Faction enemy skins and faction bullet shapes are skipped on 2048, as before.
  - `?atlas=2048` forces the fallback for testing.

### Performance
- **Start-up, software GL: 18–21 s → ~3 s.** The atlas canvas is now CPU-backed (`willReadFrequently`).
  - On a GPU-backed canvas the sprite draws are deferred. The faction-skin pass's single `getImageData` then paid for rasterising the entire atlas (16 s measured).
  - Skia's CPU raster draws the same atlas in well under a second.
  - The faction variants are also written back with one `putImageData`, on a fresh atlas row.
- **Frame cost** (software GL; CPU side is meaningful, GPU side is emulated):

  | Enemy bullets | Sim per step | Render submission per frame |
  |---|---|---|
  | ~700 | 1.5 ms | 0.3 ms |
  | ~3,000 | 1.2–1.7 ms (p95 1.8) | 2.0 ms (p95 5.5) |
  | ~5,000 | 4.4 ms (p95 spikes ~30, emulated-GPU stalls) | 3.4 ms |

  The CPU budget for 1,500+ bullets at 60 FPS (16.7 ms) has plenty of headroom. Real-GPU FPS is still unmeasured here.
- The stats overlay's renderer exposes `buildMs` (per-builder start-up times).

### Audio
- **Click fix:** every voice's envelope gain started at its default of 1 until the first automation event, so a few full-scale samples leaked at each sound's start. Found because quiet shot voices measured −1 dBFS peaks. Envelopes now start at 0.
- **Loudness pass** (by meter: RMS on the output analyser, each sound in isolation):
  - **Pilot shot voices** each get a `gain` trim in [audio/pilotVoices.js](src/audio/pilotVoices.js). The spread shrank from 21 dB (−26.7 … −48.2 dBFS) to 3 dB around −36 dBFS. Specials are untrimmed.
  - **Faction music themes** each get a `gain` in [audio/themes.js](src/audio/themes.js). The spread shrank from 6 dB to 1.7 dB around −21.5 dBFS at full arrangement.
- **Enemy volleys** now speak the owning faction's weapon language:
  - Ironclad: slug thunks; Stratos: needle zips; Black Tide: torpedo pops;
  - Helix: zaps; Outer Star: glass pings; Drowned Covenant: void thuds.

### Visual polish
- **Faction bullet language (UPDATE_02 §4.5)** — [fx/factionBullets.js](src/fx/factionBullets.js):

  | Faction | Shape |
  |---|---|
  | Ironclad | slug |
  | Stratos | needle |
  | Black Tide | torpedo with bubble trail |
  | Helix | jagged bolt |
  | Outer Star | faceted shard |
  | Drowned Covenant | void orb (dark core, coloured rim) |

  - Only the shape changes. Each bullet keeps the pattern's danger colour, a dark outline, a white-hot core and its authored hitbox.
  - Small shapes (orb, rice, kunai) from regular enemies are skinned. Big orbs and all boss fire are untouched.
- **Faction motion traits on regular enemies (UPDATE_02 §5):**
  - Stratos air units bank into turns;
  - Black Tide craft leave wake rings;
  - Ironclad machines puff exhaust.
- **Stage-to-stage transition:** the background now fades between stages. When both stages share a background mode, the palette and lighting blend over 1.5 s; otherwise the brightness dips, the mode swaps, and the brightness rises back.
- **Flak bursts** take the firing pilot's colour (or a `flakTint`). Bruno stays orange; Oduya, Rufus and Warden are cool.

### Balance
- **Piercing re-hit cooldown** (`World.PIERCE_REHIT = 6`): a piercing shot used to damage a large target on every step it overlapped it.
  - Kairo, Tess, Sera and Cass measured ~430 boss DPS, against ~50–150 for everyone else.
  - Now a piercing shot hits the same enemy at most once per 6 steps.
  - Small enemies are unaffected.
- **Pilot damage multipliers** ([data/balance.js](src/data/balance.js), applied in `World.damage`; instant flags unaffected). Method: tier-4 DPS over 8 s of fire against a large target 180 units ahead (normal and focus) and a line of six small targets (wave). Outliers were pulled about halfway to the median:
  - NOVA-7 ×1.35, Holt ×1.2, Pike ×1.15, Aiko ×1.1;
  - Miguerre ×0.9, Bruno ×0.85;
  - Rufus measured 51–148 across runs (random guns), so he stays untrimmed;
  - Vincenzo is excluded.
- **Final boss-DPS spread** across the 16 standard pilots: ~70–124 (was 52–455).

  | Pilot | single | focus | wave |
  |---|---|---|---|
  | kairo | 102 | 60 | 38 |
  | mira | 68 | 93 | 67 |
  | bruno | 125 | 119 | 85 |
  | tess | 117 | 20 | 0 (short range by design) |
  | oduya | 97 | 62 | 68 |
  | lin | 79 | 80 | 47 |
  | miguerre | 122 | 84 | 52 |
  | sera | 108 | 75 | 43 |
  | nova | 70 | 6 (focus = hack) | 69 |
  | rufus | 51–137 (random) | 54–148 | 20–25 |
  | aiko | 79 | 50 | 42 |
  | pike | 58 | 82 | 12 |
  | zuri | 73 | 58 | 44 |
  | cass | 97 | 86 | 31 |
  | holt | 75 | 41 | 40 |
  | warden | 53 | 94 | 40 |

### Not done (decisions or real hardware needed)
- **Boss hitbox widening.** The retrofit hulls are 50–72 % of the field width, but the collision circles are still the M4c radii (44–58). Widening them changes boss balance (UPDATE_02 kept bosses logic-only), so it's left for an explicit decision.
- **A by-ear listening pass, a real-GPU FPS measurement and a human playtest** are all impossible in this environment.

**Existing files touched:**

| File | Change |
|---|---|
| [core/gl/Renderer.js](src/core/gl/Renderer.js), [Atlas.js](src/core/gl/Atlas.js), [SpriteBatch.js](src/core/gl/SpriteBatch.js), [glUtil.js](src/core/gl/glUtil.js), [fx/PostFX.js](src/fx/PostFX.js), [fx/Background.js](src/fx/Background.js), [bosses/ArenaBackground.js](src/bosses/ArenaBackground.js) | `initGL()` re-runnable GL setup; context-loss handling; CPU atlas; texel-scale retry; `newRow()`; build timings; background `fadeTo()` |
| [core/Game.js](src/core/Game.js) | Frozen while the context is lost; faction bullet builder |
| [entities/World.js](src/entities/World.js), [entities/BulletSystem.js](src/entities/BulletSystem.js) | Pierce re-hit cooldown; damage multiplier; `firing` shooter mark; faction motion; pilot-coloured flak |
| [patterns/index.js](src/patterns/index.js) | `shoot()` picks the faction shape (frame only) |
| [fx/factionSkins.js](src/fx/factionSkins.js) | Single write-back |
| [scenes/StageScene.js](src/scenes/StageScene.js) | Stage fade |
| [audio/synth.js](src/audio/synth.js), [sfx.js](src/audio/sfx.js), [music.js](src/audio/music.js), [pilotVoices.js](src/audio/pilotVoices.js), [themes.js](src/audio/themes.js), [director.js](src/audio/director.js) | Click fix, loudness trims, faction enemy volleys, test handle |
| [style.css](src/style.css) | Context-lost notice |

No boss data (HP, phases, patterns, damage flags, hitboxes) changed. No renames.

**Verified** (headless Chrome, software GL):
- **Context loss mid-boss** (`WEBGL_lose_context`): frozen with the notice → restored, and the Hive fight continues correctly rendered (screenshot).
- **Start-up:** default boots in ~3 s (4096, 80.5 % full, 411 sprites). `?atlas=2048` boots at texel ×0.85 (78 % full, 249 sprites), where it previously failed; a stage and the Hive fight then play and render correctly on it.
- **Faction bullets:** for each of the six factions, 100 % of regular-enemy bullets wore the faction shape (69–88 bullets each). Screenshots checked for readability. Stratos units banked; wake and exhaust particles spawned.
- **Stage fade:** the background dips 0.43 → 0.10, swaps mode 0 → 3 at the bottom, then rises to 0.70.
- **Loudness:** shot voices −35.0 … −37.9 dBFS RMS; music −20.2 … −21.9 dBFS.
- **Regression:** the M4b suite passes, and all six bosses run every phase to the tally on Extreme (final build).

## Art test — Kairo Vance (branch `art/kairo-test`)

Brief: [KAIRO_ART_TEST.md](src/pilot%20concept%20art/Kairo%20Vance/KAIRO_ART_TEST.md). Decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Kairo%20Vance/ASSET_NOTES.md). How to repeat it for the other pilots: [ART_PIPELINE.md](ART_PIPELINE.md).

The branch stays unmerged until the owner says so.

**What changed for Kairo**
- **In-game vehicle.** The hand-made Stormlance mecha (`top_down_main.png`: flying feet-first with the chest gun and rifles pointing up the screen) replaces the procedural ship.
  - It is split into three layers: the body (legs, torso, head) plus two wing assemblies (rifle, arm and binder). At rest the layers rebuild the original within 1.7/255.
  - Motion is all code-driven: banking tilt and squash, idle bob and wing breathing, a wing flare in focus, and a fold plus afterimages and a ribbon trail in phase-dash.
  - The default size is **90 units tall** (the owner's choice). The hitbox is unchanged (2.4).
- **Thrusters.** Wide blue back plumes and nozzle glow at the rear, plus foot flames and small binder-vent flames. The painted red vents are kept. Flame size follows state: idle, moving, moving up, dash.
- **Weapons (approved gameplay change).**
  - Lances fire from the chest gun, and the tier-4 extras from the rifle tips. The feet never fire. Each is aimed where the old shot reached 240 units ahead.
  - The focus beam starts at the chest gun.
  - `tools/dps.mjs` shows boss, single-target and wave DPS within ±1 of `main` at every tier; focus is identical.
- **FX**, rebuilt in code from the FX sheet:
  - diamond-tipped lances whose bright core is exactly the hit area (r = 5 / 5 / 5.5 / 6 by tier), inside a semi-transparent glow;
  - tier-4 ring pulses;
  - the focus beam with a solid core, travelling rings and a charge orb;
  - 2× muzzle flares and bigger hit sparks.
  - The glow dims automatically as enemy bullets fill the screen.
- **UI.**
  - The painted portrait is used everywhere portraits appear.
  - The select card shows the front-view mecha preview.
  - The ultimate cut-in uses the art layout: speed lines, the mecha behind, and the portrait sliding in.
  - Kairo is now described as an *Interceptor Mecha*, with a white, gunmetal and red palette and blue energy.
- **Fallback.** If the art fails to load (or with `?noart`), the procedural ship is used. Gameplay is identical either way: the shot origins come from built-in anchors.

**Engine hooks (opt-in; pilots without them are unchanged)**
- `renderShip`, `exhaust`, `renderShots`, `hitSpark`, and beam `.skin`. See [ART_PIPELINE.md](ART_PIPELINE.md) §7.
- [core/pilotArt.js](src/core/pilotArt.js) preloads the art before the atlas is built, so `main.js` boot is now async.

**Tools**
- `npm run art:kairo` runs [tools/process-art.mjs](tools/process-art.mjs) with the Kairo settings in [tools/art.config.mjs](tools/art.config.mjs).
- [tools/dps.mjs](tools/dps.mjs) is a headless DPS harness for any pilot.
- `?test=kairo` opens the Kairo test range.
  - Keys: 1–4 tier · E dummies · B 1,500-bullet storm · Y invincible · R size · O outline · Q clear · F9 anchor editor with COPY JSON.
  - Sliders adjust shot width and glow.

**Verified** (headless Chrome on an Intel HD 5500, D3D11):
- the screenshots in [screenshots/kairo/](screenshots/kairo/);
- the `?noart` fallback and the `?atlas=2048` mode;
- `vite build`.

**Frame rate.** With 1,500 bullets while firing, the branch averages about 49 FPS on this GPU and `main` about 48 (same within noise). Neither holds a solid 60 here; without firing, both do.

**Known gaps**
- The tier-3+ option pods are still procedural.
- On the 2048 atlas, `main` already drops to 0.85 texel scale.

## Art: Mira Solenne (branch `art/mira-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Mira%20Solenne/ASSET_NOTES.md).

**Shared art code.** Kairo's art code became shared modules, so every later pilot is a config:
- [art/mechaArt.js](src/pilots/art/mechaArt.js) handles sprite layers, animation, thrusters and anchors.
- [art/mechaFx.js](src/pilots/art/mechaFx.js) handles lances, shards, beam, orb, flares and sparks.
- [tools/process-art.mjs](tools/process-art.mjs) `<id>` processes the art, with settings in [tools/art.config.mjs](tools/art.config.mjs).
- `?test=<id>` opens the test range for any pilot with art.
- Kairo is unchanged by the move: his processed files are byte-identical, his DPS is identical, and the screenshots match.

**Mira**
- **Art.** The black-background JPEG sprite and front view are cut out automatically. The in-game mecha is 90 units tall and flies feet-first.
- **Layers.** Each side is an arm blade with its gun, plus the shoulder and vent fin.
- **Firing (approved).** The homing needle fan leaves from the chest gun. From tier 3 the two arm guns fire the outermost pair. **The feet never fire.**
- **DPS** is identical to before at every tier, normal fire and focus (the needles home).
- **FX.** Gold/amber, from `fx_reference.png`:
  - needle lances whose bright core equals the hit area (r = 5), with tier-4 ring pulses;
  - gold shards for drone shots, muzzle flares and hit sparks;
  - wide gold back plumes from the vent fins and centre exhaust, plus foot flames.
- **UI.** Painted portrait, front-view select preview, art cut-in. The role is "Drone Mecha". The fallback portrait now matches the painting.
- **Ultimate.** Prism Lattice reflections keep their original look.
- **Frame rate.** In the 1,500-bullet storm, normal fire averages about 49–50 FPS versus about 52 before (Intel HD 5500).

**Atlas budget.** This was fixed on `art/pilot-textures` (next section). With two art pilots the shared atlas had reached 93 %.

## Per-pilot art textures (branch `art/pilot-textures`)

Pilot art no longer lives in the shared 4096 atlas.
- **How it works.** Each pilot with art gets its own small texture (1024²), built the first time the pilot is drawn ([art/mechaArt.js](src/pilots/art/mechaArt.js) `ensureArt`). [SpriteBatch](src/core/gl/SpriteBatch.js) switches textures when a frame carries `frame.tex`; main-atlas sprites batch as before.
- **Shared atlas.** Back to **81 %** full (it was 93 % with Kairo and Mira), the same as before any pilot art. There is room for every pilot.
- **Verified** (Chrome, Intel HD 5500):
  - Pilot select builds Kairo's and Mira's textures on demand and reuses them when you scroll back.
  - Pilots without art are unaffected.
  - Both pilots redraw correctly after a forced WebGL context loss and restore.
  - `?atlas=2048` works.
  - About 3 draw calls per frame instead of 1.
  - DPS is unchanged and `vite build` passes.

## Art: Bruno Hagen (branch `art/bruno-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Bruno%20Hagen/ASSET_NOTES.md).

- **Art.** The black-background JPEG sprite and front view are cut out automatically. A new `holes` setting clears the enclosed gap inside the backpack frame. The in-game mecha is 90 units tall and flies feet-first.
- **Layers.** Each side is the double cannon, fist and forearm, plus the shoulder pod.
- **Firing (approved).** Bruno has no chest gun. The flak fan leaves the two big arm cannons and the siege shells the two long barrels. **The feet never fire.**
  - Each shell crosses the old shell's path 170 units ahead at the same moment, with the same damage and fuse.
  - Boss DPS is identical at every tier, normal fire and focus.
  - Close to the mecha the centre gets a little less (the cannons are 54 units apart). Total coverage is within a few percent, except tier-1 normal fire (−16 %).
- **Option pods (approved)** moved out beside the cannons (±40/±52, focus ±36/±48). In focus their shells no longer hit a small target straight ahead (small-target focus DPS 70 → 45 at tiers 2–3).
- **FX.** Violet outside, orange inside, from `fx_reference.png`:
  - flak shells with an orange core inside a violet ring and tracer; siege shells with an orange body and a violet trail with rings;
  - violet star airbursts with an orange core and dark smoke (new opt-in `flakBurst` hook in World, cosmetic only);
  - star muzzle flashes with brass casings; violet plumes from the shoulder pods and backpack struts;
  - bomb, ultimate, Brace and death blasts recoloured. During Brace the arms pull in.
- **UI.** Painted portrait, front-view select preview, art cut-in. The role is "Heavy Mecha" and the UI colour is violet. The fallback portrait now matches the painting (no fur hat: there's no hat style).
- **Frame rate.** In the 1,500-bullet storm, about 46 FPS with art versus about 49 with the procedural ship (Intel HD 5500).

## Art: Tess Kuro (branch `art/tess-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Tess%20Kuro/ASSET_NOTES.md).

- **Art.** The black-background JPEG sprite and front view are cut out automatically. The in-game mecha is 90 units tall and flies feet-first.
- **Layers.** Each side is the forearm blade and clawed hand, plus the shoulder armour and spikes.
- **Firing (approved).** Tess has no guns: the wire-blade crescents are thrown from the two forearm blades. **The leg blades (feet) never fire.**
  - The origins sit 16 units ahead, like the old one. Each crescent crosses its old path 130 units ahead.
  - Boss, small and line DPS are identical at every tier, normal fire and focus.
  - At 120 units, sweep coverage is within about 10–20 % (the sweep grid is coarse for short-range piercing crescents).
- **Ghost Slash (approved).** Same hit area and damage. It is drawn as a big crescent swept by one arm blade, alternating sides. That arm kicks out, and the small crescent leaves that blade.
- **Shadow Clones and the Cloak decoy (approved).** Full copies of the mecha: the same art, pose, wing animation and thrusters, and the clones throw crescents from their own blades. The clones' damage is unchanged (0.6×).
- **FX.** Violet outside, a scarlet band, orange inside, white-hot edge:
  - crescent shots and the slash use a new thin crescent texture;
  - Thousand Cuts lines;
  - muzzle flares, hit sparks, and plumes from the shoulder armour and beside the head spike, all with the scarlet band (opt-in `pal.rim` in the shared art/FX modules; other pilots are unchanged).
- **Data.** Tess is female. The owner supplied a new portrait (`pilot-portrait-main.jpg`), cropped to head and shoulders with a new `portraitCrop` setting. The fallback portrait matches it (long scarlet hair, red eyes, dark bodysuit). The role is "Stealth Mecha".
- **Frame rate.** In the 1,500-bullet storm, about 53 FPS with art versus about 50 with the procedural ship (within noise; Intel HD 5500).

## Art: Oduya Rex (branch `art/oduya-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Oduya%20Rex/ASSET_NOTES.md).

- **Art.** The landscape sprite (1337×1176) and the RGBA front view are cut out automatically. The biggest mecha: **100 units tall**, about 114 wide. It flies feet-first; the drill legs (feet) never fire.
- **Redesigned kit (owner's design).** An immortal god of thunder. All lightning leaves the two gold fists.
  - **Strands evolve, independent of power tiers.** He starts with 3 and gains one every 10 seconds alive, up to 10. Each lightning hit adds half a step of progress. Death costs 2 strands.
  - **Main: Thunder Strand.** Every 4 steps a thick bolt chains through up to `strands` targets (reach 190). Later hops deal 70 %. Each hit arcs to every enemy within 55 units (50 %). With no target, the bolt cracks straight ahead.
  - **Focus: Thunder Spears.** Every 7 steps, a volley of 2–5 piercing spears (speed 30).
  - **Coils.** 2 from 5 strands, 4 from 8. They throw short arcs; nothing in his kit is a bullet except the spears.
  - **Special: Thundershock.** Stuns and electrifies every enemy on screen for 2 s, then they explode (lethal; bosses take 30).
  - **Bomb: Storm Cell**, 5 in stock.
  - **Ultimate: God Thunder Barrage.** 7 s of full-height bolts across the screen, plus a bolt on every enemy twice a second. It clears enemy bullets.
- **Balance (approved: strong but fair).** At 10 strands, boss DPS is 99 in both modes (roster median about 95). Against six targets in a line it is 346, the best wave clear in the roster. `tools/dps.mjs` "tiers" are strand levels 3 / 5 / 7 / 10 (new `dpsLevel` hook).
- **FX.** Blue outside, white inside: jagged forked bolts that re-roll every step, bright strike nodes, spears with ring pulses, crackling stun arcs, blue-white plumes from the wing roots and mane.
- **Frame rate.** In the 1,500-bullet storm, about 58 FPS with art versus 56 procedural. During the ultimate it holds 60 FPS once the cut-in has finished (Intel HD 5500).

## Art: Lin Hayase (branch `art/lin-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Lin%20Hayase/ASSET_NOTES.md).

- **Art.**
  - The sprite and front view are JPEGs with a painted checkerboard; the new `bg: 'checker'` rule cuts them out.
  - 90 units tall, about 100 wide. He flies feet-first; the crystal legs (feet) never fire.
  - The swarm turret is cut from `swarm-turrets.png`.
  - Lin is now a man: bio, lore line and fallback portrait.
- **Wings instead of thrusters.**
  - No flames. The butterfly wings beat: slow at idle, faster moving, strongest flying up; folded in a dash. Emerald glitter falls from them.
  - The wings are drawn under the body. The spear and whip stay on top; the wing pixels under them come from the mirrored wing.
- **Kit (owner's design).**
  - **Main: Crystal Seed.** A fan of emerald shards from the waist spike. Seeds grow into **swarm turrets** (the winged drone) that fire needles and eat bullets that touch them. The orbiting options are small drones.
  - **Focus: Emerald Spears.** Spears from his spear's blade, aimed to cross his centre line 150 units ahead. A spear that hits **splits into 3 half-damage shards** at the 3 nearest other enemies; the shards don't split again. Turrets and option drones throw splitting spears too.
  - **Special: Root Field.** Roots wrap every enemy within 200 units (more are caught as they enter), hold them 1.5 s, then crush them. Lethal to normal enemies; bosses take 40. The field eats bullets.
  - **Bomb: Spear Rain.** 3 s of falling spears (two a step, half aimed at enemies), wide bursts that go **through boss shields**. It clears bullets.
  - **Ultimate: Cosmic Spear.** A short charge (black space opens at his spear, stars fall in), then a giant spear 110 units wide flies up the screen. It hits everything in its path once for 120 (through shields). It leaves a black, starry rift for about 3 s that keeps burning and clears bullets.
- **Balance (approved: strong but fair).** Boss DPS at T4: shot 97, focus 104 (was 79 / 80). Splitting spears clear a line of six at 261 (was 79).
- **FX.** Emerald, black and white. The black parts are alpha-blended under the additive glow: spear edges, crystal debris, smoke, roots, the rift.
- **FX from the owner's picks** (`tools/art-ref/lin/`, un-blended by `process-art.mjs` `fx`): main-shot arrows, focus / split / rain spears, the star seal on every Spear Rain hit, and the Cosmic Spear. Its path is a black void of stars, drawn under the enemies (new World hook `renderUnder`).
- **Frame rate.** In the 1,500-bullet storm, about 53 FPS with art versus 49 procedural (Intel HD 5500).

## Art: Miguerre Zo'Rajah (branch `art/dax-test`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Miguerre%20Zo%27Rajah/ASSET_NOTES.md).

- **Art.** Checkerboard cut-out, 90 units tall, feet-first (the legs never fire). The lower blade wings move. Void plumes: black, red and white-hot.
- **Legendary, as the owner wrote it** (marked LEGENDARY like Vincenzo).
  - **Void Beam.** Instant straight beams from the chest core chain through every enemy at any range. Normal enemies die in one hit through shields; bosses take normal damage. They erase bullets along the path and every bullet within 110 units.
  - **Ghost Launch.** Focus sends a smoke ghost forward with 5 smoke clones, all firing; he is intangible while focused. The body stays parked and flashes to the ghost on release.
  - **Crescent of Chaos** (sweeps forward, erases attacks, kills regular enemies outright). **Chaos Clone** bomb (six thick-smoke clones far from him that fire until the stage is cleared; each bomb adds six, up to 30). **Breathe of the Chaos** (7 s, 150 wide, invulnerable, harder-hitting). In focus the two outermost clones cast the crescent and fire the ultimate too.
  - Focus beams build up to ×3 boss damage over 4 s of holding focus.
  - The first beam is instant; the chain then visibly races from enemy to enemy.
- **Balance.** Boss DPS at T4: beam 131, ghost focus 137. Normal enemies don't matter: they die in one hit.
- **FX.** Drawn live after the owner's references, with no cut-out images (polish round): straight eye-beam style void beams, real-smoke ghosts and clones spread wide, a starry black crescent at medium speed, and a cosmic void column for the cannon.
- **Frame rate.** Storm: about 57 FPS with art versus 53 procedural.

## Art: Miguerre v2 (branch `art/miguerre-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Miguerre%20Zo%27Rajah/ASSET_NOTES.md), "Rebuild v2".

- **Step 1 (done):** the new art read; components and rig plan; baseline (boss T4: beam 131, focus 343); the Chaos Clone bug diagnosed (chains from far clones kill the enemies beside the other clones: 77 of 149 in a probe); proposed redesign; four decisions for the owner.

## Art: Lin v2 (branch `art/lin-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Lin%20Hayase/ASSET_NOTES.md), "Rebuild v2".

- **Art.** The same `top-down-main.jpg`, now a **component mecha**:
  - the whip is swung in front of him and lashes (handle and tip halves);
  - the spear thrusts;
  - the butterfly wings beat.
  - The body and wings draw from a weapon-free `under` image, so moving weapons leave no hole.
- **Kit (approved 1 A, 2 yes, 3 A, 4 A, 5 A).**
  - **Main:** the shards leave the glowing whip crystals, with damage unchanged.
  - **Focus:** spears from the thrusting spear.
  - **Root Field:** radius 300, with a crystal rim.
  - **Spear Rain:** spears fall out of a cracked emerald portal.
  - **Cosmic Spear:** a 1.2 s charge (black sphere, crystal crown, cracks), then a 40% wider void with cracked-space edges. Damage is unchanged.
- **Checks.**
  - All 5 headless gameplay checks pass.
  - Boss DPS is unchanged.
  - Storm: 52 FPS with art versus 55 procedural.
  - Oduya, Tess, Bruno, Mira, Kairo and Miguerre are unchanged (identical DPS).

## Art: Oduya v2 (branch `art/oduya-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Oduya%20Rex/ASSET_NOTES.md), "Rebuild v2".

- **Art.** The same `top-down-main.jpg`, now a **component mecha**:
  - the arms are split at the elbow, and every bolt is a punch from a gold fist, the fists taking turns;
  - the lightning wings flare and fold.
  - The drill legs (feet) never fire.
- **Kit (approved 1 A, 2 A, 3 yes, 4 A, 5 yes).** Every attack runs beginning → travel → detonation. All numbers are in `src/pilots/oduyaTuning.js`.
  - **Strand:** leaders race along the chain, and damage lands on arrival.
  - **Fist arcs:** they replace the coils.
  - **Thundershock:** a clap, then a web through every enemy, then they explode.
  - **Storm Cell:** a cloud fed by bolts from the fists.
  - **God Thunder:** charge between the fists, launch, travel with lashes, critical charge, then a 60-damage detonation once per enemy.
- **Checks.**
  - All 9 headless gameplay checks pass.
  - Strand and focus DPS are unchanged.
  - Storm: 51 FPS with art versus 48 procedural.
  - Tess, Bruno, Mira, Kairo and Miguerre are unchanged (identical DPS).

## Art: Tess v2 (branch `art/tess-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Tess%20Kuro/ASSET_NOTES.md), "Rebuild v2".

- **Art.** `new-top-down-main.png` (checkerboard, with `bgPale` for the blade halo) as a **blade component mecha**: each arm is split at the elbow. Every volley is one arm's slash, the arms taking turns, and the crescents leave the blade along its length. Feet-first; the leg blades (feet) never fire.
- **Kit (approved 1 A homing, 2 A alternating, 3 B, 4 A, 5 yes, 6 yes, 8 yes).** All numbers are in `src/pilots/tessTuning.js`.
  - **Crescent Blades:** 2 / 3 / 4 / 6 crescents per volley, growing and faster per tier. They chase random enemies in sight at any range, hit each enemy once, and erase bullets on their path.
  - **Focus:** two glitch clones throw her exact volley at 60% damage.
  - **Shadow Form:** 10 s intangible, 30 s cooldown.
  - **Bomb:** Thousand Cuts, plus nine wide crescents from her and both clones.
  - **Ultimate:** Void Cross Annihilation. Miguerre's crescent motion in violet, crossed with a spear. It kills regular enemies and mid-bosses on contact, burns main bosses, then detonates: 80 damage once per enemy, with a mushroom cloud.
- **Lore.** Miguerre Zo'Rajah's love: he went cosmic rogue, and she searches for him.
- **Checks.**
  - All 13 headless gameplay checks pass.
  - Boss DPS shot 45 / 81 / 121 / 164 (was 29–116 at short range only); focus about 1.9×.
  - Storm: 57.5 FPS with art versus 49.3 procedural.
  - Miguerre, Kairo, Mira and Bruno are unchanged (identical DPS).

## Art: Bruno v2 (branch `art/bruno-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Bruno%20Hagen/ASSET_NOTES.md), "Rebuild v2".

- **Art.** `top-down-enhance.png` (checkerboard removed) as a **heavy-artillery component mecha**: hand guns, shoulder cannons (housing + telescoping long barrel), side cannons (base + sliding barrel), body. Feet-first; the feet never fire.
- **Tiers.**
  - T1–T2: compact shoulder cannons and retracted side cannons.
  - T3: shoulders raised and locked, long barrels 60 % out, side cannons half out.
  - T4: full arsenal.
  - A tier loss reverses it.
- **Kit (approved 1 A, 2 yes, 3 A, 4 yes, 5 yes, 6 A, 7 yes, 8 yes).** All numbers are in `src/pilots/brunoTuning.js`.
  - **Normal fire:** explosive flak with no fuse, from the hand guns. Tier multipliers 1.0 / 1.2 / 1.45 / 1.75. The side cannons add two shells at T3–T4.
  - **Focus:** a 0.25 s charge, then the shoulder barrage at 1.4× normal fire.
  - **Reactive Shield:** 6 s of real immunity; each absorbed attack adds +2 % up to ×2, kept 5 s after.
  - **Bomb:** an opening 200-unit blast (25 damage, once per enemy) before the Flak Barrage.
  - **Ultimate:** a 6 s carpet-bomb run, then one screen-wide nuke (60 damage, once per enemy, bosses included).
  - The option pods are removed.
- **Checks.**
  - Shield: 0 hits in a 1,500-bullet storm versus 45 without it.
  - Bomb and nuke: one hit per enemy, checked on dummies, including corners and a boss.
  - Damage rises at every tier.
  - Storm: 55.5 FPS with art versus 57 procedural.
  - Kairo and Mira are unchanged (rig fingerprints identical, DPS identical).

## Art: Mira v2 (branch `art/mira-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Mira%20Solenne/ASSET_NOTES.md), "Rebuild v2".

- **Art.** `top-down-enhance.png` (white background removed) as a **component mecha**: hand cannons, the gold inner blade pair and the white outer blades (two sections each), and the body. Feet-first; the feet never fire.
- **Tiers.**
  - T1 chest fire, with both arrays folded down beside the ladder fins.
  - T2 both hand cannons.
  - T3 the inner blades deploy.
  - T4 the outer blades deploy, with the full-power halo.
  - On a tier loss the blades retract outer first, then inner.
- **Weapons (approved 1 A, 2 B, 3 A, 4 A).**
  - The needle fan leaves the chest at T1 and the two cannon muzzles from T2; the T3 centre needle alternates cannons.
  - Focus is still the homing needle stream, now from the chest, with a visual charge and recovery. There is no beam.
  - The drones are unchanged.
- **Balance.** Shot DPS is unchanged (28 / 41 / 55 / 68). Focus is 39 / 56 / 74 / 91 versus 39 / 57 / 75 / 92; the only cost is the 10-step charge on focus engage.
- **Shared rig.** `art/mechaRig.js` is the shared part; Kairo's beam logic stays in `kairoRig.js`. Kairo's rig output is byte-identical after the refactor.

## Art: Kairo v2 (branch `art/kairo-v2`)

Notes and decisions: [ASSET_NOTES.md](src/pilot%20concept%20art/Kairo%20Vance/ASSET_NOTES.md), "Rebuild v2".

- **Art.** `top-down-enhance.png` (checkerboard removed) as a **component mecha**: hand cannons (cannon + fist + forearm), inner and outer wing blades in two articulated sections each, and the body. Feet-first; the feet never fire. New front view `Top-Down-front-new.png`.
- **Tiers.**
  - T1 base, with both wing arrays folded under the body.
  - T2 enhanced cannons.
  - T3 inner blades deploy: swing out, extend and lock.
  - T4 outer blades deploy too: full silhouette, transformation waves and arcs.
  - On a tier loss the blades retract outer first, then inner.
- **Weapons (approved 1 A, 2 A, 3 A, 4 A).**
  - Lances leave the cannon muzzles, aimed at their old lanes 340 ahead.
  - The option pods became wing-tip emitters.
  - The tier-4 extras fire from the cannons.
  - The focus beam leaves the blue chest plate: 0.2 s charge, live beam, collapse.
- **FX.** Recoil, armour flash, channel and charge pulses, muzzle discharge, animated trails, wing conduits and lock flashes, a layered chest beam.
- **Balance.** Boss DPS unchanged (shot 29 / 50 / 67 / 103); focus within 1 (the charge).
- **Frame rate.** Storm T4: 59.5 FPS with the art versus 60 procedural.
- **Shared.** `process-art` `parts` and the `mechaArt` `rig` path are opt-in; the other pilots are unchanged and were checked.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

Flow right now:
- **Title** → START → difficulty → **Pilot Select → (Z) endless procedural stages**: intro → waves → mid-boss → waves → boss → tally → next stage...
- **(C) on pilot select → Test Range**: placeholder waves with a selectable bullet density.
- **`?test=<id>`** (`kairo`, `mira`, `bruno`, `tess`, `oduya`, `lin`, `miguerre`): a pilot's art test range (see the *Art* sections above). The art is also live in the normal flow: pick the pilot on pilot select.
- **`?noart`**: skip hand-made pilot art (procedural fallback).
- **Title → PRACTICE**: a single fight against any boss reached so far. **RANKING** and **OPTIONS** are also on the title.
- Idle on the title for 20 s: attract demo → ranking pages.
- From a run: Pause (Resume / Restart / Pilot Select / volumes), or Game Over → initials → Continue, or Pilot Select via the results screen.

**Atlas fallback test:** `?atlas=2048` forces the small-GPU texture path (M7c).

**Seeds:** a run is fully determined by its seed plus your inputs. The seed is shown on pilot select, in the pause menu and on the tally. Replay a run with `?seed=ABCD1234` in the URL.

**Dev hooks (console):**
- `__npo.turbo = n` runs n extra simulation steps per frame (fast-forward)
- `__npoDev.spawnEnemy(world, id, x, y, params, elite)` spawns an enemy
- `__npoDev.generateStage(seed, i)` returns a stage plan
- `__npoDev.bossForStage(seed, i)` / `archetypeDeck(seed, k)` show the boss rotation; `__npoDev.dmgFlags({...})` builds a flags mask
- In-game, dev server only: **B** skips to the main boss, **N** lands a phase-clear hit, **M** lands an instant-kill hit

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | Left stick / D-pad |
| Shot (hold) | Z / J / Space | A / RT |
| Focus (hold: slow, alt fire, shows hitbox) | Shift / K | RB / LB / LT |
| Bomb | X / L | B |
| Special | C / I | X |
| Ultimate | V / U | Y |
| Pause | Esc / P | Start |
| Stats overlay | ` / F3 | — |

Dev keys (test range): `1–4` bullet density · `T` CRT · `G` quality · `H` shake. Dev server only: `B` / `N` / `M` boss skip / phase-clear / kill in stages; `U` on pilot select unseals "Warden".

## Architecture

### Engine (M1)

- **Raw WebGL2 rather than PixiJS.** This gives full control of the sprite batch and the post chain.
- **Fixed 60 Hz simulation + render interpolation** ([Game.js](src/core/Game.js)). It's deterministic per step, for seeds and replays. Hit-stop freezes simulation while the camera and post-FX keep animating. Input is *not* polled during hit-stop, so a press made during a freeze lands on the next live step.
- **One atlas, one blend mode, ~1 draw call.** The procedural Canvas2D atlas is uploaded premultiplied. The instanced [SpriteBatch](src/core/gl/SpriteBatch.js) makes a sprite additive by zeroing its alpha, so additive and alpha sprites share a batch.
- **SoA systems** ([BulletSystem](src/entities/BulletSystem.js), [Particles](src/fx/Particles.js)) store data in dense typed arrays with swap-remove, and allocate nothing per frame. They sit alongside a [Pool](src/core/Pool.js) for objects and a [SpatialGrid](src/core/SpatialGrid.js) for collisions.
- **HDR post chain** ([PostFX](src/fx/PostFX.js)): bloom, shockwaves, chromatic aberration, heat haze, flash, vignette, CRT, ACES.
- **City background shader** ([Background.js](src/fx/Background.js)) plus sprite [Parallax](src/fx/Parallax.js) layers; layered [Explosions](src/fx/Explosions.js).

### Gameplay (M2)

- **[World](src/entities/World.js)** owns every live gameplay object: enemy bullets, player shots, beams, enemies, items, particles, score/graze/chain. Pilots and enemies use its API:
  - spawning: `shot()`, `beam()`, `spawnEnemy()`, `spawnItem()`
  - damage: `damage()`, `damageCircle()`, `damageLine()`
  - bullet cancelling: `cancelAll()`, `cancelCircle()`, `cancelLine()`
  - aiming: `aimAngle()`, which respects cloak decoys

  Scenes receive gameplay events through `world.onEvent` (tier up, bomb, ultimate, death, game over...) and own only presentation.
- **Player shot behaviours** are fields on BulletSystem: `damage`, `maxAge` (range), `pierce`, `homing` (turn rate), and `kind` (`SHOT_FLAK` bursts on hit or expiry). **Beams** are declared once per step and collide as segments.
- **[Player](src/entities/Player.js)** is generic and data-driven. It handles:
  - movement, focus and speed tune (S items)
  - power 0–400 → **4 tiers**, which swap the ship sprite and options
  - lives and bombs, plus a **15-step death-bomb window** (*counter bomb*)
  - special cooldown and the ultimate meter (charged by graze and kills; full at 100)
  - invulnerability, respawn, and continues

  State machine: `alive → dying → dead → respawning`, or `gameover`.
- **Pilots are data files** ([src/pilots/](src/pilots/)). Each exports stats, speeds, hitbox, bomb stock, engines, and portrait params, plus hooks:
  - `sprites(atlas)` draws the 4 tier variants of its vehicle
  - `fire`, `optionLayout`, `update`
  - `special` / `bomb` / `ultimate` objects with `activate` / `update` / `end`
  - `onHit` (lets a pilot absorb a hit)
  - `render*` for pilot FX

  To add a pilot, add a file and list it in [pilots/index.js](src/pilots/index.js).
- **Items:** P (+25 power), B (+bomb), S (speed tune), 1UP, and medals (chained value that resets if one falls off-screen). Items are magnet-collected near the player (wider radius while focused) and auto-collected above the line at y=170 and after bombs.
- **UI:**
  - [PilotSelectScene](src/scenes/PilotSelectScene.js): 16-slot roster, procedural animated [portraits](src/ui/portraits.js), stat pips, bio, ability list, and a live vehicle preview that cycles tiers 1–4 and shot/focus against practice targets
  - [Hud](src/ui/Hud.js): DOM HUD, diffed so it only updates on change
  - [CutIn](src/ui/CutIn.js): ultimate cut-in with a 48-step hit-stop freeze
  - pause menu and game-over/continue overlay in [TestRangeScene](src/scenes/TestRangeScene.js)

### The four pilots

| Pilot / Vehicle | Shot · Focus | Special | Bomb | Ultimate | Tier visuals |
|---|---|---|---|---|---|
| **Kairo Vance** — Stormlance | Piercing rail lances · continuous rail beam | Phase Dash (i-frames + afterimages) | Arc Cascade (6 sweeping rail beams) | Orbital Rail Grid: targeting grid, sequential column/row strikes, then a full-grid finale | wing blades → rail barrels + 2 pods → tail fins, glowing spine, 4 pods |
| **Mira Solenne** — Halo Sprite | Homing needle spread · tight hard-homing needles | Shield Orbs (3 orbiting bullet erasers) | Halo Bloom (expanding cancel ring) | Prism Lattice: hex lattice that reflects every enemy bullet back as homing shots | 1–4 halo drones, more feather petals, extra halo ring |
| **Bruno Hagen** — Ironhound | Wide flak airbursts (area dmg) · heavy siege shells | Brace (absorbs one lethal hit) | Flak Barrage (targeted airbursts) | Carpet-Bomb Run: 5-bomber V formation drops delayed bomb lines | chin turret → wing gun pods → armour skirts + missile racks; 2–4 pods |
| **Tess Kuro** — Wireghost | Short-range piercing blades · melee slash that cuts bullets | Cloak (enemy aim locks to a decoy, double graze charge) | Thousand Cuts (screen-wide slash lines) | Shadow Clones: 4 clones mirror her attacks and erase bullets they touch | wingtip blades → canards → long blades + tail spikes |

### Enemies, patterns, stages (M3)

- **[Pattern library](src/patterns/index.js).** Emitters: `shoot`, `ring`, `fan`, `aimed`, `stack` (speed-layered streams), `spiral`, `curtain` (wall with a gap), `rain`, `burst`, and `laser`.
  - Specs are static data, so firing allocates nothing.
  - Specs support acceleration/curving, **homing** (`homing`, `homingTime`) and **split bullets**: a child spec bursts when the bullet reaches `splitAt`, which is how mines and mortars work.
  - Counts scale with `world.diff.density`, speeds with `world.diff.speed`.
- **Danger colour code:**

  | Colour | Meaning |
  |---|---|
  | red | aimed |
  | pink / violet | spiral, homing |
  | orange | heavy |
  | yellow | splitting / rain |
  | cyan / blue | curtains, drops |
  | green | slow fields |
  | white | sniper / revenge |

- **Enemy lasers** (`world.enemyLaser`): a thin flickering warning line, then a lethal beam. They can track the player during the warning and sweep while firing. Sniper pods use the warning only, followed by a fast needle line.
- **[Enemy roster](src/entities/enemies/index.js): 21 types.** Each has its own procedural art ([art.js](src/entities/enemies/art.js)), a movement script ([movers.js](src/entities/enemies/movers.js)) and a pattern.
  - drone, dart interceptor, hover car, suicide bike (homing kamikaze)
  - gun turret\*, flak battery\*, armored truck\* (splitting mortars), hover tank\*, shield walker\* (half damage)
  - carrier (launches darts, curtains, spirals), mine layer (split mines), heli gunship (sweeping streams), sniper pod (telegraphed line shot), laser drone (sweeping beam), spinner mine, swarm bug, bomber (bomb rain), shield orbiter, splitter pod, seeker launcher (homing missiles), sentinel frigate

  \* Ground units scroll with the terrain and render under foreground structures. Turret barrels track the player.

  Big units break apart and cancel nearby bullets.
- **Elites** have ×1.8 HP, fire faster, gain an extra pattern layer, show a red pulsing aura, and drop bonus items.
- **Mid-boss / boss slots** use placeholders until M4: the **Gatekeeper Platform** (2 phases, twin sweeping lasers) and the **Syndicate Core Prototype** (3 phases). They use the segmented boss HP bar, WARNING sequence and name card.
- **[7 biomes](src/stages/biomes.js)** — Skyway Highway, Corporate Spire, Orbital Elevator, Acid Harbor, Magma Foundry, Data-Core Void, Storm Ring.
  - Each drives a [background shader mode](src/fx/Background.js): city / harbor water + container piers / magma rivers / data grid / planet limb + elevator cable / cloud deck + lightning + ring arc.
  - Each also sets the [parallax style](src/fx/Parallax.js) (structures, rain/embers/data/debris), whether ground units can appear, and enemy weighting.
- **[Stage generator](src/stages/StageGen.js)** is seeded by `(seed, stageIndex)`:
  - flow: intro → 3–5 wave sets → mid-boss → 2–3 wave sets → boss → tally
  - wave sets combine 22 [wave templates](src/stages/waves.js) under a difficulty budget, weighted by biome
- **Loops** are 5 stages each, with a seeded biome order per loop; loop 1 opens on the Skyway.
  - Each loop raises density, speed, HP and boss HP, increases elite chance, and enables **revenge bullets** (small kills spit aimed shots).
  - A **LOOP X** banner appears at each loop start, and the HUD shows `LOOP · STAGE · BIOME`.
- **[StageDirector](src/stages/StageDirector.js)** runs the plan step by step. A wave set ends when it's cleared or times out, and a mid-boss retreats after 50 s. The tally scores destroy rate, graze, max chain, no-miss (100k × loop) and no-bomb (50k × loop).
- Scenes were refactored onto a shared [PlayScene](src/scenes/PlayScene.js) (pause, continue, banners, render order); [StageScene](src/scenes/StageScene.js) and [TestRangeScene](src/scenes/TestRangeScene.js) build on it.

## Known issues / notes

**Needs real hardware or a human** (impossible in this headless, software-GL environment):
- **Real-GPU frame rate and start-up.** CPU cost is measured (see M7c), but GPU fill-rate with 1,500+ bullets, bloom and the arena shaders is not.
- **A by-ear audio pass.** All levels are set by meter (M7c loudness pass). Check:
  - the music/sfx balance (music ~4 dB under);
  - the bomb's underwater sweep;
  - per-faction enemy volley ticks;
  - Vincenzo's cathedral tail.
- **A human playtest for difficulty and pacing:** boss phase HP, Hell / Mk. III density (peak ~1,040 bullets in the Maw's Hell Mk. III desperation phase), item drop rates, ultimate charge rates.
- **Bright effects to eyeball on a real GPU:** bloom on the Titan's ceramic armour, and Lin's Forest of Light pillars. All bullets are cleared during the pillars, so readability isn't at stake.

**Design decisions left open:**
- **Boss hitboxes** are the M4c radii (44–58) while the retrofit hulls are 50–72 % of the field width, so shots pass over outer wings, treads and tentacles. Widening them is a boss-balance change.
- **Pilot balance is measured, not played.** See the M7c table and [data/balance.js](src/data/balance.js). Mechanics the DPS harness can't capture:
  - NOVA-7's hacked allies, Zuri's charged Solar Lance, Lin's turrets, Aiko's bullet grinding;
  - Cass's ±5-step beat window;
  - Rufus's random guns (his numbers swing run to run).
  - Vincenzo is meant to dominate.
- **Scoring constants** (combo step, extend thresholds, NO-BOMB bonus) in [core/scoring.js](src/core/scoring.js) are first-pass.

**Known gaps:**
- The mid-boss is still the M3 Gatekeeper (UPDATE_01 only redesigns main bosses).
- Faction bullet shapes and faction skins are skipped on the 2048-atlas fallback, so enemies there keep their base look.
- Faction motion traits cover Stratos banking, Black Tide wakes and Ironclad exhaust. Helix visor glows, Outer Star shimmer and Drowned fade-ins aren't done.
- Gamepad buttons aren't remappable in the UI (keyboard is).
- **Sounds not exercised by the automated runs:** the Void Mecha slash and grab, the smallest explosion size, and the game-over stinger on a real defeat. They're wired through tested paths.
- Software GL runs at ~5 FPS, so headless tests drop key taps and need retries. The test scripts in the scratchpad handle this; it isn't a game issue.

## Next steps (after M7)

All milestones M1–M7 are complete. In priority order:
1. Real-GPU playtest: frame rate at 1,500+ bullets, start-up time, a listening pass, and difficulty pacing per difficulty.
2. Decide on boss hitbox widening (see Known issues), then re-tune boss phase HP if needed.
3. Tune pilot balance from play (data in [data/balance.js](src/data/balance.js)) and the scoring constants.
4. Content: a redesigned mid-boss per faction; the planned second boss per faction (Rail Leviathan, Mantis Gunship, Abyss Stalker Sub, Seraph-Unit, Star-Eater Prism, The Drowned Choir).
5. Gamepad remapping UI; remaining faction motion traits.
6. Pilot art: review and merge `art/lin-v2` (it contains `art/oduya-v2`, `art/tess-v2`, `art/bruno-v2`, `art/mira-v2`, `art/kairo-v2`, `art/dax-test`, `art/lin-test`, `art/oduya-test`, `art/tess-test`, `art/bruno-test`, `art/pilot-textures` and `art/mira-test`). Then follow [ART_PIPELINE.md](ART_PIPELINE.md) for the other 10 pilots.
