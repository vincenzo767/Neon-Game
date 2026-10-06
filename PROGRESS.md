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
| M5 | Remaining 12 standard pilots + **Vincenzo (Legendary)**, ultimates, cut-ins | ⏳ Next |
| M6 | Audio engine and adaptive music (per-phase layers, archetype themes) | — |
| M7 | UI, scoring, polish, performance tuning | — |

> **Specs:** [docs/NEON_PRECINCT_OVERDRIVE_PROMPT.md](docs/NEON_PRECINCT_OVERDRIVE_PROMPT.md) (v2) and [docs/UPDATE_01_BEFORE_M4.md](docs/UPDATE_01_BEFORE_M4.md). Where they disagree, UPDATE_01 wins.

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

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

Flow right now:
- **Pilot Select → (Z) endless procedural stages**: intro → waves → mid-boss → waves → boss → tally → next stage...
- **(C) Test Range**: placeholder waves with a selectable bullet density.
- From either: Pause, or Game Over → Continue / Pilot Select.

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

Dev keys (test range): `1–4` bullet density · `T` CRT · `G` quality · `H` shake.

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

- The mid-boss is still the M3 Gatekeeper (UPDATE_01 only redesigns main bosses).
- Boss balance is first-pass: phase HP, pattern rates and Hell/Mk. III density were tuned only in headless runs (peaks: ~1,040 bullets in the Maw's Hell Mk. III desperation phase). Needs a real-GPU playtest.
- The boss-intro WARNING text still reads "SYNDICATE COMMAND UNIT APPROACHING" for every archetype (M7 UI pass).
- Stage-to-stage biome change is an instant swap behind the tally overlay (no crossfade yet).
- Readability check per biome done visually (harbor water and foundry lava were toned down). It still needs a real-GPU playtest for pacing and difficulty.
- Balance is first-pass only: DPS per pilot, ultimate charge rates, and item drop rates. Tune in M7.
- Score is basic: kills × chain bonus, graze, cancels and medals. The full multiplier system, the no-bomb boss bonus, extends at score thresholds, and the high-score table (with pilot + seed) arrive in M7. Right now a single local hi-score is saved.
- Key remap UI and the options menu are M7. Bindings are already remappable in [Settings](src/core/Settings.js).
- No audio yet (M6).
- WebGL context loss isn't handled yet (M7).
- Verified in headless Chrome (software GL), with no runtime errors:
  - each pilot: select, shot, focus, special, ultimate + cut-in, bomb, pause → pilot select
  - game-over → continue flow
  - M3: all 7 biomes and all 21 enemy types render
  - a full stage, intro → waves → mid-boss → boss → tally → stage 2, completes (auto-kill fast-forward)
  - the same seed produces identical stages, and a different seed differs

  Real-GPU FPS hasn't been measured in this environment.



## Next steps (M5 — pilots)

Per the prompt and UPDATE_01 §2:

1. **The 12 remaining standard pilots** (roster slots already reserved in `src/pilots/index.js`), each with:
   - a unique vehicle, shot and focus shot
   - a special, a bomb and an ultimate with a cut-in
   - tier visuals
2. **Vincenzo the Conqueror (Legendary, slot #17):**
   - **Holy Bullets:** piercing, `ignoresShields`, and a 60% `instantPhaseClear`/destroy proc. Uses the M4b flags via `BulletSystem.dflags`.
   - **Permanent intangibility.**
   - **Bomb:** Dimensional Rifts → Void Mecha form (`VOID_FORM_DURATION`). Grabbed bosses are defeated through the normal defeat path.
   - **Ultimate:** The God's Trumpet → Divine Owl form (`DIVINE_FORM_DURATION`), with one-hit `instantKill` waves.
   - **Legendary presentation** on pilot select.
