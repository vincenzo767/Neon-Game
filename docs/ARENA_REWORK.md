# Boss & Arena Rework — Audit, Design and Progress

Spec: [src/vertical_manic_shooter_boss_arena_master_prompt_full_detailed.md](../src/vertical_manic_shooter_boss_arena_master_prompt_full_detailed.md)
Visual references (direction only, never shipped as game art): `src/boards/`, `src/assets/`, `src/bosses/ground/*.png`.

---

## Checkpoint 1 — Audit

### Architecture as found

| Concern | Where | Notes |
|---|---|---|
| Engine | raw WebGL2, [core/gl/Renderer.js](../src/core/gl/Renderer.js) | No framework. HDR scene FBO (RGBA16F) → bloom → composite ([fx/PostFX.js](../src/fx/PostFX.js)). No depth buffer. |
| Sprites | [core/gl/SpriteBatch.js](../src/core/gl/SpriteBatch.js) | Instanced quads, premultiplied, one blend mode; frames may carry their own texture (`frame.tex`). |
| Sprite art | [core/gl/Atlas.js](../src/core/gl/Atlas.js) | Everything is drawn procedurally with Canvas2D at start-up into one atlas. **The 4096² atlas already overflows on this branch** (texel scale drops to 0.85), so new boss art must live in its own textures (the pilot-art pattern in `pilots/art/mechaArt.js`). |
| Loop | [core/Game.js](../src/core/Game.js) | Fixed 60 Hz deterministic simulation, render interpolation, hit-stop. Gameplay RNG `game.rng`; cosmetic RNG `game.fxRng`. |
| Stage background | [fx/Background.js](../src/fx/Background.js) + [fx/Parallax.js](../src/fx/Parallax.js) | One fullscreen fragment shader (6 neon biome modes) + sprite parallax (girders, rooftops, holo boards, rain). |
| Boss arena | [bosses/Arena.js](../src/bosses/Arena.js), [bosses/ArenaBackground.js](../src/bosses/ArenaBackground.js), [bosses/arenas.js](../src/bosses/arenas.js), [bosses/transitions.js](../src/bosses/transitions.js) | 31 "themes" = shader mode (15 arena modes) + palette + weather streaks + screen-space ambient sprites. Swap at the transition midpoint. |
| Boss runtime | [bosses/BossController.js](../src/bosses/BossController.js), [kit.js](../src/bosses/kit.js), [look.js](../src/bosses/look.js) | `enter → fight ⇄ transition → dying`. Arena is driven only through world events (`bossArena`, `bossPhaseCard`, `bossMusic`, `bossTransitionCancel`). |
| Rotation | [bosses/index.js](../src/bosses/index.js) | `archetypeDeck(seed, k)` seeded shuffle; deck k = Mk (k+1) capped at III; `bossForStage` then picks an id with `RNG(seed:boss:index)` from that archetype (one id each today). |
| Stage flow | [stages/StageGen.js](../src/stages/StageGen.js), [StageDirector.js](../src/stages/StageDirector.js) | intro → waves → mid-boss (Gatekeeper, plain enemy, no arena) → waves → boss (`arenaEnter`/`arenaExit`) → tally. |
| Scene | [scenes/StageScene.js](../src/scenes/StageScene.js), [PlayScene.js](../src/scenes/PlayScene.js) | Owns the Arena; render order: background → parallax back → ground enemies → parallax fore → **arena under** → mid (enemies, player, particles) → **arena over (vision veil, stars)** → streaks → bullets. |
| Particles | [fx/Particles.js](../src/fx/Particles.js), [fx/Explosions.js](../src/fx/Explosions.js) | SoA pools (5k low, 16k high), layered blasts. Screen space. |
| Tests | none in repo | Previous milestones used throw-away headless-Chrome scripts. Headless Chrome here gets the real GPU (Intel HD 5500, D3D11) at 60 FPS — a good low-end / mobile-class proxy. |

### Verified gameplay contract (must not change)

- Six archetypes; seeded deck, every archetype once per deck, no repeat across deck boundaries (`archetypeDeck`).
- Mk = deck index + 1, capped at III; +35 % HP per Mk (`hpScale`), score × Mk, medals `6 + 2·Mk`, 1UP from Mk II, +15 % pattern rate per Mk (`every`).
- Five authored phases; difficulty → phase sets {3: 1,3,5 · 4: 1,2,4,5 · 5: all}; Hell appends Desperation (½ HP of the last phase, last arena + red tint, boss overrides via `def.desperation`).
- Phase HP floors: damage never crosses a floor. Phase bonus 5,000 × phase × Mk; > 75 s → ends with no bonus.
- Transition 144 steps (2.4 s): bullets → gold stars, invulnerable, arena crossfade at step 18 (96 steps, swap at the midpoint), card at 88, music at 104, vulnerable at 144.
- Light Pool: Maw phase 3 (`darkness 0.96, light 120`) and phase 5 (`0.3, 170`): a veil drawn after enemies and before bullets, so enemies outside the pool vanish and bullets stay lit.
- Gatekeeper mid-boss: a plain enemy, no arena.

### Placeholder / non-realistic components to replace

- Every arena background: neon procedural shader planes (grids, glowing rings, data streams, voronoi "scrap"), palette swaps of the same city shader (`highway_burning`, `siege_ashfield`, `city_invasion`, `corporate_plaza` all use the city mode).
- Parallax: generic girder/roof/holo sprites reused in every arena.
- Ambient layers in screen space only (snow, ash, dust) — nothing anchored to the world; no fire, smoke columns, wrecks, landmarks.
- Transitions: neon-edged effects (screen tear, warp) on every archetype.

### Missing capabilities

- Real geometry / depth (structures, elevated decks, tunnels, cliffs), perspective parallax.
- Painted, material-based terrain textures; baked shadows; lighting per arena (sun, fog, night).
- World-anchored FX (fires, smoke columns, steam, beacons), world decals (craters, tread marks, wakes).
- Water / lava surfaces with real motion.
- Asset loading lifecycle for arena resources; arena reference validation; asset manifest.
- 24 boss identities, variant decks.

### Risks

| Risk | Mitigation |
|---|---|
| Canvas2D painting of large terrain textures stalls the main thread. | Paint in a module Worker (`OffscreenCanvas`), main-thread fallback time-sliced; pre-build the next phase's arena while the current phase is fought; the swap waits (screen stays covered) if a build is late. |
| GPU memory on phones. | Chunk textures sized by quality tier; chunks behind the camera released; shared material atlas; only current + next arena resident. |
| Atlas already full. | New boss art and arena materials use their own textures. |
| Determinism. | Arena content is seeded from the arena id + chunk index (never the gameplay RNG); variant decks use their own seeded streams. |
| Readability. | Restrained palettes, fog/contrast control, FX budget per quality tier, bullets keep drawing last. |

---

## Design

### Rendering approach: hybrid 2.5D with a real perspective world pass

The game stays a 2D sprite game in screen space (480×640 units). The **arena environment** becomes a small 3D world drawn first, into the same HDR scene target, with its own WebGL2 programs and a depth buffer:

- **Camera**: perspective, looking down with a slight forward pitch (top of the screen is farther away, like the reference boards). It flies forward along +Y at the arena's scroll speed. All parallax is physical: decks, rooftops and cloud puffs closer to the camera move faster; ground far below (aerial arenas) moves slowly.
- **Layers** (prompt §12): each environment declares horizontal *plane layers* at a height (far ground, sea floor, ground, decks, cloud tops) that stream in **chunks** along the flight path, and *solids* (extruded boxes, prisms, lathes for towers/silos/tanks, beams, quads) built per chunk.
- **Textures**: terrain chunks are painted procedurally with Canvas2D (material noise, roads, markings, cracks, snow, sand ripples, rubble, baked soft shadows from the chunk's solids), in a Worker. Solids use a shared procedural **material atlas** (facades, roofs, concrete, rust, rock, containers, vehicle tops, foliage, ice, coral…), tiled with `textureGrad`.
- **Surfaces**: animated water (waves, fresnel, sun glint, foam), lava (flowing crust, emissive) and sky/space backdrops are shaders on world planes.
- **FX in the world**: fires, smoke columns, steam, sparks, beacons, searchlights and lamps are *anchors* in chunk data; a world-space particle pool projects them every frame, so smoke rises from the wreck it belongs to and scrolls away with it. Ground decals (craters from artillery, tread marks, wakes, scorch) are placed by gameplay events at the real impact point.
- **Weather / near field**: rain, snow, ash, dust, embers, bubbles, marine snow as restrained screen-space layers.
- **Lighting**: per-arena sun direction/colour, ambient, fog, exposure; baked per-vertex lighting and AO on solids; emissive windows/lamps at night.

### Data model

```
arena config (bosses/arenaConfigs/<archetype>.js) — one per boss phase, stable id
  { id, name, env, params, time, weather, ambient, fx, scroll, camera,
    transition, visibility: { mode: 'lightPool', radius, darkness }, music }
env module (world/env/<id>.js) — reusable environment kit
  setup(cfg) → { atmosphere, surfaces, layers: [{ id, z, width, length, ppu, build(k, R, cfg) }] }
  build → { paint(ctx), solids[], anchors[], movers[] }
```

Boss definitions keep combat data only; each phase references an arena config id (`arena: 'cc_burning_overpass'`). Legacy theme blocks (`{ theme: ... }`) still resolve to the old shader path (prototype test boss).

### Selection

Layer A (archetype deck) is unchanged. Layer B: for archetype `a`, its n-th appearance in a run (n = deck index, since each deck holds every archetype once) takes `variantDeck(seed, a, ⌊n/5⌋)[n mod 5]`, a seeded shuffle of that archetype's enabled bosses with its own RNG stream; a new variant deck never opens with the variant that closed the previous one.

---

## Progress

| Checkpoint | Status | Evidence |
|---|---|---|
| CP1 Audit | done | this document |
| CP2 World renderer (camera, chunks, worker build, materials, surfaces) | done | `npm run build` OK; all arenas screenshot-reviewed |
| CP3 Environment kits (city, highway, terrain, tunnel, industrial, sky, ocean, coast, seabed, orbit, planet, flesh, …) | done | `node tools/validate-arenas.mjs` → OK (30 bosses, 150 configs, 20 envs, 99 materials) |
| CP4 World FX + decals (fires, smoke, impacts, tread marks, wakes) | done | fights reviewed in headless Chrome |
| CP5 30 bosses (6 archetypes × 5), 5 phases each | done | every boss fought through all phases (practice, extreme), no runtime errors |
| CP6 150 phase arenas + transitions | done | each config referenced by exactly one boss phase (rotation test) |
| CP7 Rotation (archetype deck unchanged + seeded variant decks) | done | `node tools/test-rotation.mjs` → OK, 300 seeds × 60 stages |
| CP8 Optional mid-boss arena (`gk_checkpoint`) | done | verified with and without the arena; pool released after the kill |
| CP9 Asset manifest, performance | done | `node tools/build-manifest.mjs`; numbers below |

### Performance (headless Chrome, Intel HD 5500 iGPU, 720×960, extreme, invulnerable autofire)

Average FPS per phase on **high** quality, 4 s windows:

| Boss | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|
| Tempest Crown | 60 | 60 | 58 | 60 | 60 |
| Black Tide Rig | 60 | 60 | 60 | 60 | 60 |
| Crimson Expanse | 59 | 53 | 59 | 60 | 60 |
| Coral Siege | 60 | 59 | 58 | 58 | 60 |
| Sandbreaker | 60 | 60 | 60 | 60 | 60 |
| Nameless Leviathan | 60 | 60 | 60 | 60 | 60 |
| Urban Devastator (before fill budget) | 50 | 54 | 51 | 32 | 43 |
| Urban Devastator (after fill budget) | 59 | 60 | 60 | 54 | 52 |

Urban Devastator's burning skylines put rooftop smoke near the camera: Tower Inferno measured ~78 screens of smoke overdraw per frame (Black Tide Rig: ~13). `WorldFX` now caps puff size and thins the largest puffs past a per-quality fill budget (8 / 14 / 22 screens), with a stable per-particle order and smoothing so nothing pops. Tower Inferno and Flooded Core hold 60 FPS on **medium** and **low** (worst one-second sample 51–59); on high they average 52–54 on this iGPU.

### Known limitations

- Boss art is procedural Canvas2D, environment textures are procedural, and there are no per-boss audio stems (see `ASSET_MANIFEST.md`, "Known gaps").
- High quality on a weak iGPU dips to the low 50s in the two densest burning-city phases; medium is the recommended preset for that class of hardware.

---

## Level rework (campaign structure)

Requested after the arena rework: a fixed campaign, one arena per boss for the whole level, mini-bosses per level, and real-world placement.

| Topic | Implementation |
|---|---|
| Campaign | [stages/campaign.js](../src/stages/campaign.js): Ground → Naval → Aerial → Mecha → Extraterrestrial → Abyssal, 5 levels each. Level 5 is the archetype's **main boss** (the original flagship). After 30 levels the campaign loops at Mk. II, then Mk. III. The old seeded archetype / variant decks remain exported but are no longer used for stages. |
| Level flow | [StageGen](../src/stages/StageGen.js): intro → 5 waves → the level's mini-boss → 5 waves → boss → tally. Every wave lasts exactly one minute (10 minutes of waves per level), announced with a "WAVE N" banner and a HUD wave clock ("WAVE 3/10 · 0:42"). Formations arrive throughout the minute (never more than 10 s apart, the last 6 s quiet); each wave has a larger budget (+10 % per wave) and more elites (+2 % per wave). Difficulty ramps over the 30 levels (`levelDifficulty`), never dropping between levels. Inside an archetype, bosses gain +5 % HP and +4 % pattern rate per level (`rank`). |
| One arena per level | `Arena.showLevel()` puts the level's arena on screen from the first wave, under a cover until its chunks are built. Boss phases only change the arena **mood** (`Arena.mood()`: vision veil / Light Pool, tint, eased); the world never changes. The next level's arena is prefetched during the tally. The other 120 authored arenas stay available in practice tooling / the arena preview. |
| Phase names | Boss phases were renamed after what they do (they were arena names). |
| Mini-bosses | 30 in [bosses/minibosses/](../src/bosses/minibosses/), one per level, built on BossController: own art (lazy atlas), look, 3 phases (Easy / Normal play 1 and 3), no desperation phase, no music layer, smaller drops. |
| Real-world placement | Naval bosses / mini-bosses / new surface units (gunboat, missile boat, fast attack craft, corvette, sea mine — [entities/enemies/naval.js](../src/entities/enemies/naval.js)) sit on the water with wakes. Ground units ride the arena's real ground scroll (`ArenaWorld.groundSpeedAt`). Wave templates are filtered by level terrain (land / sea / sky / space / deep): no tanks at sea, no rotors in space, nothing winged underwater. Walker mini-bosses use a tight contact shadow. |
| Reinforcements | Main bosses call in a small formation from the level's own wave pool every 14 → 7 s (faster in later phases / levels), held back while 5+ escorts are alive (`StageDirector._updateSummon`). |
| Menus | Title / difficulty / pilot select fly over a real arena ([fx/menuBackdrop.js](../src/fx/menuBackdrop.js)) instead of the neon city shader. |

Verification: `node tools/test-campaign.mjs` → OK (structure, ownership, placement, terrain filters, determinism, escalation, mini-boss phases). `node tools/test-rotation.mjs` → OK. `node tools/validate-arenas.mjs` → OK. `npm run build` → OK. Headless play of levels 1-1, 2-1, 3-1, 3-5, 4-1, 5-1, 6-1 and 6-5 through waves → mini-boss (2 phases) → boss (2 phases) with reinforcements: no runtime errors, one arena per level throughout. Wave FPS on the HD 5500 proxy (720×960, extreme): Downtown Siege 60 FPS high and low (one ~100 ms hitch), Oil Field 60.

Fix (mini-boss freeze): at heavy damage the boss look drew six damage decals, but mini-bosses define four damage sites; the render threw every frame, so the screen froze while the simulation kept running. The decal count is now clamped to the sites a hull defines, and each level's boss / mini-boss / unit art is drawn while the level arena loads instead of at spawn.

Known gaps: the regular wave enemies (drones, hover cars, swarm bugs…) keep their original art; only the naval surface units are new.
