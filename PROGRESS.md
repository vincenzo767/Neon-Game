# NEON PRECINCT: OVERDRIVE — Progress

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Engine core: loop, input, rendering, pooling, collision, camera, post-FX | ✅ Done |
| M2 | Player system + 4 pilots fully playable | ⏳ Next |
| M3 | Enemy AI, bullet-pattern library, procedural stage generator | — |
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

## Architecture (M1)

- **Raw WebGL2 rather than PixiJS.** This gives full control of the sprite batch and the post chain. The renderer is about 600 lines, with no framework API churn.
- **Fixed 60 Hz simulation + render interpolation** ([src/core/Game.js](src/core/Game.js)). Gameplay is deterministic per step, which seeded and replayable runs need. Rendering lerps `prev → current` by `alpha`, so 120/144 Hz screens stay smooth. Hit-stop freezes simulation steps while the camera and post-FX keep animating.
- **One atlas, one blend mode, one draw call.** All art is drawn procedurally with Canvas2D into a 2048² atlas ([src/fx/sprites.js](src/fx/sprites.js)) and uploaded premultiplied. The instanced [SpriteBatch](src/core/gl/SpriteBatch.js) uses `ONE, ONE_MINUS_SRC_ALPHA`. A sprite becomes additive by zeroing its output alpha, so mixed additive and alpha sprites never split the batch. In testing, ~4,750 sprites rendered in 1 draw call.
- **Struct-of-arrays systems** for high-volume objects ([BulletSystem](src/entities/BulletSystem.js) and [Particles](src/fx/Particles.js)). They use dense typed arrays with swap-remove and allocate nothing per frame. Heavier entities use the generic [Pool](src/core/Pool.js).
- **Spatial hash** ([SpatialGrid](src/core/SpatialGrid.js)): a uniform grid of typed-array linked lists, rebuilt every step. Point and AABB inserts are supported, and queries de-duplicate with a stamp. It's used for enemy bullets vs the player (hit + graze) and player shots vs enemies.
- **HDR post chain** ([PostFX](src/fx/PostFX.js)): an RGBA16F scene (falls back to RGBA8), a bright pass, then a half-res and a quarter-res gaussian bloom. The composite applies CRT barrel warp, up to 8 refraction shockwaves, heat haze, chromatic aberration, ACES tonemap, flash, vignette, scanlines + aperture mask, and grain.
- **Background** ([Background.js](src/fx/Background.js)): a fullscreen shader draws a 2.5D tilted procedural megacity. It has rooftops, neon trims, holo panels, road traffic, light shafts and fog, and all palettes are uniforms so M3 biomes can drive it. Sprite parallax layers sit on top: hover traffic (mid), girders/rooftops/holo billboards (fore), light shafts and rain.
- **Explosions** ([Explosions.js](src/fx/Explosions.js)): layered flash → fireball → debris shards → smoke → embers, plus a shock ring, refraction wave, aberration, shake and hit-stop. `breakApart()` chains staggered blasts into a final detonation, ready for large enemies and bosses.
- **Input** ([Input.js](src/core/Input.js)): keyboard (`KeyboardEvent.code`, so it's layout independent) + Gamepad API standard mapping. It has a radial stick deadzone, latched taps, rumble, and remappable bindings persisted in [Settings](src/core/Settings.js).
- **Seeded RNG** ([RNG.js](src/core/RNG.js)): `game.rng` is for gameplay only. `game.fxRng` is cosmetic, so particles never perturb a seed's sequence.

## M1 sandbox controls

`Arrows/WASD` move · `Z` shot · `Shift` focus (shows hitbox + graze ring) · `X` bomb · `C` random blast · `V` break-apart sequence · `1–4` bullet density (MANIC ≈ 2,000+ bullets) · `T` CRT · `G` quality · `H` shake intensity · `R` reset · `` ` ``/`F3` stats overlay. Gamepad: stick/d-pad, A shot, RB focus, B bomb.

## Known issues / notes

- WebGL context loss isn't handled yet (it would need atlas + target re-creation). Planned for M7.
- The sandbox player is a placeholder (no lives or power). It is replaced by the pilot system in M2.
- The Google Fonts import (Orbitron / JetBrains Mono) falls back to system fonts when offline.
- Verified in headless Chrome (software GL): no runtime or shader errors. JS CPU time is ~3 ms per frame at 2,000 bullets + ~400 particles. Real-GPU FPS hasn't been measured in this environment yet.

## Next steps (M2)

1. `src/pilots/*.js` data files: stats, shot patterns (tap/focus), 4 power tiers, bomb, special, ultimate hooks.
2. A Player entity driven by pilot data: lives, power level, bomb stock, death-bomb window, respawn.
3. Four fully playable pilots: Kairo Vance, Mira Solenne, Bruno Hagen, Tess Kuro.
4. P/B/S item drops + magnet pickup, a basic HUD (lives, bombs, power, graze).
