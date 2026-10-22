# SANDBREAKER — 3D boss revamp

Level 1-2 boss (Ground, Ironclad Syndicate) rebuilt to match the reference render: a
real 3D armoured siege train running on a railway through the Dune Sea battlefield.
Screenshots: `screenshots/sandbreaker/`.

## What changed

| Before | After |
|---|---|
| 2D desert-tank sprite sweeping side to side | 3D locomotive (beast-head ram, boiler, twin main battery, gatling sponsons, mortar battery, driving wheels with side rods) + artillery, rocket and command cars, drawn in the arena's WebGL pass |
| Easing movement toward sine targets | The train lives on ONE rail line shared with the arena; every vehicle is placed from its two rail pivots, so it follows the curve and its wheels stay on the rails |
| Field scrolls forward under a hovering boss | The convoy drives the scroll: the field runs **backward** under the train (it advances toward the player), the train holds its row by accelerating / braking relative to the camera |
| Attacks spawned at the sprite centre | Every bullet, shell, rocket and telegraph starts at its muzzle on the model |
| Generic `terrain` env for all five phases | New `dunesea` env (all five phase arenas, parameterised): ballast bed, 3D sleepers / rails / fishplates, cable trough, signals, telegraph poles, abandoned branch line with derailed cars, dunes (heightfield), depots, containers, water tower, fuel tanks, scaffolds, gun pits, wrecks, craters, oil fires |

## Files

| File | Role |
|---|---|
| `src/bosses/ground/sandbreaker.js` | Boss data: 5 phases, 9 breakable mounts, attack table, 2D fallback art |
| `src/bosses/ground/sandbreakerRig.js` | Runtime rig: track position, couplings, camera/speed control, suspension, weapon state machines, shells, rockets, storm, ram, contact, FX, sound pacing, death/wreck, 3D draw |
| `src/world/tank/sandbreakerModel.js` | Geometry of every part + pivots / muzzle anchors (`SB`) |
| `src/world/env/railLine.js` | The shared, periodic rail centreline and rail dimensions |
| `src/world/env/dunesea.js` | Dune Sea environment kit (periodic) |
| `src/world/tank/TankRenderer.js` | Now a small model registry (`ensure(prefix, build)`); per-model look (`SNOW_LOOK` / `SAND_LOOK`: cover colour, ground bounce, metal layers, shadow tint); trail layer parameter |
| `src/world/tank/tankTextures.js` | +6 layers: GOLD, BRONZE (metallic), SAND, SBMARK, RWHEEL, WAKE |
| `src/world/ArenaWorld.js` | Reverse scrolling, periodic layers, `keepBehind`, shown-arena build priority |

Also: sfx `chuff`, `railClack`, `coupleClank`, `trainHorn`, `brakeScreech`, `steamVent`,
`rocketLaunch`, `gatling`, `heavyCannon`, `sandBlast`, `engineFail`; `WorldFX` culls decals
left far behind a reversing camera; `tools/test-campaign.mjs` knows `dunesea` is land.

## Train

- **Vehicles:** locomotive (≈300 long, rail pivots at the driver group and trailing truck),
  artillery car (howitzer + two rotary guns), rocket car (two launchers, fuel tanks),
  command car (radar, antennas). Broad siege gauge: rails at ±55.
- **Placement:** one number, the locomotive's world y. Car k sits behind car k-1 at
  `end-to-end gap + slack`; each vehicle's pivots are put on `railX(y)` and its heading is
  the chord between them.
- **Couplings:** slack per coupling follows the locomotive's acceleration with a 5-step
  delay per car (stretch on pull, buffers bunch on braking); a hard bunching clanks and
  sparks at the drawbar.
- **Wheels:** angle = distance / radius from the real odometer (stop when the train stops);
  coupling rod, main rod and crosshead are driven from the same crank angle (sides
  quartered). Chuffs play every quarter driver turn; rail clack at every 128-unit joint.
- **Speed control:** the camera runs at the phase's convoy cruise (1.1–1.7 units/step); the
  train holds its screen row with a critically damped controller. Artillery steadies the
  convoy (cruise × 0.45). The ram switches to a raw surge (+4.6), then hard braking, then the
  controller brings it back.
- **Suspension:** bob from rail joints under each pivot, pitch from acceleration and recoil
  kicks, roll into the curve.

## Weapons and attacks

| Attack | Weapons | Behaviour |
|---|---|---|
| GOLDEN BARRAGE | side cannons (loco) | Each cannon slews to a lane either side of the player, fires alternating narrow / wide fans from alternating barrels |
| main salvo | twin main battery | acquire → load (breech glow + aim lines) → alternating heavy shells that burst into rice → cool |
| SIEGE ARTILLERY | mortar battery + howitzer | 3D ballistic shells to marked circles (player's spot first, then lanes beside it); sand blast, fragments, crater |
| CROSSFIRE CONVOY | side cannons + rotary guns | Front covers the outer lanes while the rear covers the centre, then they swap (with a breather) |
| ROTARY GUN SWEEP | rotary guns | spin-up, opposite sweeps through ±1.15 rad firing dashed arcs, spin-down |
| ROCKET SALVO | rocket launchers | staggered launches to marked spots, smoke trails, no steering after launch, boost through the off-screen part of the path |
| SANDSTORM BOMBARDMENT | all artillery | warning band, light browns out (drawn under bullets), dust sheets, walked impacts (one on the player) |
| LOCOMOTIVE RAM | the ram | horn + steam + lane chevrons, surge down the line, plough debris, brake sparks + screech, recover |

Heavy attacks (siege, sweep, salvo, storm, ram) are serialised: one at a time, the next
queued. Light ones (barrage, crossfire, main salvo) pause during the ram and the storm strike.

**Phases** (Standard plays 1, 3, 5 — together they contain all seven attacks):
CONVOY ARRIVAL · HEAVY ARTILLERY · CROSSFIRE CONVOY · ARMORED ADVANCE · ENRAGED CONVOY.

**Mounts:** side cannon ×2, main battery, mortar battery, heavy howitzer, rotary gun ×2,
rocket battery ×2. Hitboxes ride the projected mounts and are never culled off-screen. A
broken mount stays broken (scorched stub, fire) and its attacks stop. Losing both rotaries and
the howitzer disables the artillery car; losing both launchers disables the rocket car.
Disabled cars burn and are towed along.

**Death:** attacks stop, brakes lock (sparks off every wheel set while the camera rides the
slide), mounts cook off, the loco slews off line; at the breach the main battery is blown off
its barbette and the rocket car goes up; fires and scorch stay on the wreck, then the advance
resumes past it. Score / progression go through the controller's single `killEnemy` path.

## Arena world changes (ArenaWorld)

- **Reverse scrolling:** streaming leads in the direction of travel; ground speed may be
  negative.
- **Periodic layers** (`layer.period` chunks): chunk k is built as k mod period and drawn at
  offsets; all of its chunks stay resident; anchors are shifted onto every visible image. The
  Dune Sea repeats every 4096 units (8 chunks, ~49 s of travel), so **no terrain is built during
  the duel**. On the HD 5500 proxy a chunk takes 3–7 s to build while the game renders, which
  could not keep up with a train running the field backward.
  Everything in `dunesea` that depends on y divides the period.
- **`keepBehind`** (arena config): chunks kept behind the camera.
- **Build priority:** the shown arena's on-screen chunks outrank prefetched arenas.

## Verification

- `npm run build` ✓; `node tools/test-campaign.mjs` ✓; `node tools/test-rotation.mjs` ✓;
  `node tools/validate-arenas.mjs` ✓.
- `node tools/boss-shot.mjs --url <server> --boss sandbreaker --diff extreme --fire false`:
  all five phases, the ram, rockets, storm, death and wreck run with no page errors; 50–60
  FPS on the HD 5500 proxy (Extreme and Standard).
- Streaming probe over a full five-phase run: 0 of 431 samples had a visible chunk missing; 0
  chunks built during the fight.
- Mount test: destroyed cannons fire 0 shots; car disable / attack refusal / no respawn in the
  next phase all as specified.
- Campaign level 2 starts on the new arena (forward waves, ground units) with no errors.
- White Fang re-run after the shared renderer / ArenaWorld changes: unchanged, ~60 FPS.

## Known limitations / needs a human playtest

- Balance (HP, fire rates, ram timing, storm density) was checked in screenshots, not by
  playing to the end with a vulnerable pilot.
- The Dune Sea world repeats every 4096 units; a careful eye can spot the same wreck coming
  round again in a long fight or level.
- Rockets and the rocket car spend much of the fight above the top edge (the train is long);
  their launches are mostly heard, the impact markers carry the read.
- Sound effects are synthesized placeholders in the existing style; the engine is paced by
  chuffs and clacks rather than a continuous loop.
- The headless harness captures a frame every ~3 s on this machine; fast moments (ram, rockets)
  were captured by freezing the game with `hitStop`.
