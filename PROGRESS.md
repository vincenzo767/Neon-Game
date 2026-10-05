# NEON PRECINCT: OVERDRIVE — Progress

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Engine core: loop, input, rendering, pooling, collision, camera, post-FX | ✅ Done |
| **M2** | Player system + 4 pilots fully playable | ✅ Done |
| M3 | Enemy AI, bullet-pattern library, procedural stage generator | ⏳ Next |
| M4 | Boss framework + one boss of each archetype | — |
| M5 | Remaining 12 pilots, ultimates, cut-ins | — |
| M6 | Audio engine and adaptive music | — |
| M7 | UI, scoring, polish, performance tuning | — |

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

Flow right now: **Pilot Select → Test Range** (placeholder waves until M3) → Pause / Game Over → Continue or Pilot Select.

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

## Known issues / notes

- The test range uses placeholder enemies ([testEnemies.js](src/scenes/testEnemies.js)). Real enemies, patterns and stages come in M3.
- Balance is first-pass only: DPS per pilot, ultimate charge rates, and item drop rates. Tune in M7.
- Score is basic: kills × chain bonus, graze, cancels and medals. The full multiplier system, the no-bomb boss bonus, extends at score thresholds, and the high-score table (with pilot + seed) arrive in M7. Right now a single local hi-score is saved.
- Key remap UI and the options menu are M7. Bindings are already remappable in [Settings](src/core/Settings.js).
- No audio yet (M6).
- WebGL context loss isn't handled yet (M7).
- Verified in headless Chrome (software GL), with no runtime errors:
  - each pilot: select, shot, focus, special, ultimate + cut-in, bomb, pause → pilot select
  - game-over → continue flow

  Real-GPU FPS hasn't been measured in this environment.

## Next steps (M3)

1. `src/patterns/`: a bullet-pattern library (rings, spirals, aimed fans, curtains, rain, lasers, homing) as composable emitters.
2. `src/entities/enemies/` data files: 20+ enemy types, each with a movement script, pattern, HP, drops and elite variant.
3. A procedural stage generator: seeded biome chunks (Skyway, Spire, Orbital Elevator, Acid Harbor, Magma Foundry, Data-Core Void, Storm Ring); intro → 3–5 wave sets → mid-boss slot → waves → boss slot → tally. Loop scaling and the LOOP X indicator.
4. Drive the background shader palette per biome, and add a StageScene to replace the test range.
