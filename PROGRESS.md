# NEON PRECINCT: OVERDRIVE — Progress

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Engine core: loop, input, rendering, pooling, collision, camera, post-FX | ✅ Done |
| **M2** | Player system + 4 pilots fully playable | ✅ Done |
| **M3** | Enemy AI, bullet-pattern library, procedural stage generator | ✅ Done |
| M4 | Boss framework + one boss of each archetype | ⏳ Next |
| M5 | Remaining 12 pilots, ultimates, cut-ins | — |
| M6 | Audio engine and adaptive music | — |
| M7 | UI, scoring, polish, performance tuning | — |

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

- Bosses are placeholders until M4 (real Ground Tank / Aerial / Mecha bosses with breakable parts, multi-stage deaths and Mk. II/III variants).
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

## Next steps (M4)

1. A boss framework in `src/bosses/`. Bosses are multi-part entities with:
   - parts with their own HP that drop medals when destroyed
   - a phase timeline (3–5 phases with distinct patterns)
   - an intro card, segmented HP bar, desperation phase and multi-stage death
2. One boss of each archetype, replacing the `syndicateCore` placeholder in the boss slot:
   - Ground Tank (e.g. *Colossus Crawler*: destructible turrets, track charges, artillery that marks floor zones before impact)
   - Aerial (e.g. *Skywarden Carrier*: drone swarms, sweeping beam curtains, mirrored formations)
   - Mecha (e.g. *Titan Enforcer*: transforming phases, melee swipes, spiral danmaku)
3. Mk. II / Mk. III variants for later loops, with new attack phases. Boss selection per stage comes from the seed.
4. A no-bomb boss bonus, plus a practice entry point per boss (full practice menu in M7).
