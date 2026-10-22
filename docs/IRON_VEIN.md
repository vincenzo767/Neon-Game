# IRON VEIN — 3D boss revamp

Level 1-3 boss (Ground, Ironclad Syndicate) rebuilt to match the reference render: a
colossal open-pit mining war fortress that crawls through a terraced quarry, grinds into
the floor with a rotary cutter head and fires every weapon from its real mechanism.
Screenshots: `screenshots/iron_vein/`.

## What changed

| Before | After |
|---|---|
| 2D tunnel-borer sprite hovering on sine targets | 3D machine drawn in the arena's WebGL pass (depth-tested, sun-lit, planar shadows + contact pad) |
| A spinning disc painted on the sprite | Tilted cutter head (armoured cone, 8 ribs, 46 carbide picks, red drive hub) on a hinged carrier: it lowers into the cut, lifts to travel, slides on thrust rams; four hydraulic cylinders are spanned between hull and carrier every frame |
| Attacks spawned at the sprite centre | Cutter rim, conveyor heads, cannon barrels, aux pods and the drive hub are the origins of every bullet, telegraph and flash |
| Five unrelated arenas (open pit, mine shaft, foundry, tunnel, reactor) | One new `openpit` environment, parameterised per phase |

## Files

| File | Role |
|---|---|
| `src/bosses/ground/ironVein.js` | Boss data: 5 phases (+ Critical Overdrive), 5 breakable parts, attack table, 2D fallback art |
| `src/bosses/ground/ironVeinRig.js` | Runtime rig: drive + movement states, cutter / carrier hydraulics, contact, weapons, the eight attacks, parts, ground marks, FX, sound pacing, death/wreck, 3D draw |
| `src/world/tank/ironVeinModel.js` | Geometry of every part + pivots / muzzle anchors (`IV`) |
| `src/world/tank/GroundScars.js` | World-space cracks / molten fissures that grow, widen, glow and cool |
| `src/world/env/openpit.js` | Open-Pit Mine environment kit |
| `src/world/tank/tankTextures.js` | +9 layers: IVPAINT, RUSTY, CARBIDE (metallic), ROCK, BELT, IVTRACK, IVMARK, EXCAV (trench), CRACK |
| `src/world/tank/TankRenderer.js` | `MINE_LOOK`; two metal layer ranges per look; additive (glow) mode for ground ribbons |
| `src/bosses/arenaConfigs/ground.js` | The five `iv_*` arenas now use `openpit` (ids kept; names: Open-Pit Mine, Spoil Terraces, Haul Road Junction, Fractured Benches, Deep-Core Pit) |

Also: sfx `drillGrind`, `trackClank`, `rockChip`, `auxPop`, `conveyor`, `cannonLoad`,
`oreCannon`, `hydraulic`, `seismicCrack`, `seismicErupt`, `coreCharge`, `coreBlast`,
`rockfall`, `boulderImpact`, `boreRev`; `tools/test-campaign.mjs` knows `openpit` is land.

## Machine, movement, excavation

- **Pose:** world-space `x, y, heading`, signed speed, turn rate; low acceleration and
  braking (it is ~270 × 440 units). It only moves along its heading (skid steer).
- **Movement states** (`rig.ms`): `enter`, `advance` (crawl forward with the cutter in the
  ground), `reposition` (cutter raised, back up / slew onto a new lane), `excavate`
  (stopped, cutter grinding), `hold` (stabilised for a barrage), `prep` / `charge` /
  `brake` / `recover` (Bore Charge), `critical` (overdrive), `defeat`.
- **Tracks:** six units in three pairs; belts, road wheels, sprockets and idlers roll at
  v ± ω·half-gauge; during the bore wind-up the tracks spin against the brakes (slip).
- **Cutter:** rpm has inertia and reverses through zero; the carrier lift/thrust are rate
  limited (hydraulics). *Engaged* = lowered + spinning: gravel is thrown the way the bottom
  of the disc moves, dust rolls off both sides, sparks off hard rock.
- **Ground marks (world space):** tread ribbons from the front track pair; the trench is laid
  at the cutter's real contact point only while it cuts forward; cracks and fissures are
  GroundScars (multiplicative crack + additive molten glow, depth-tested so the hull hides
  what runs under it). Everything stays where it was made and fades slowly.
- The quarry holds still for the duel (like White Fang); after the death the advance
  resumes past the wreck.

## Attacks

| Attack | Mechanism | Behaviour |
|---|---|---|
| ROTARY CUTTER FAN | cutter rim | spin-up (reverses direction each cycle), then chips + slow fragments flung off the bottom of the rim, sweeping to the side it turns toward; clamped to the lower field |
| SPOIL CYCLONE | conveyor heads | belts run up, booms slew, twin rotating streams per conveyor (opposite spin), big rocks on curving arcs, fine grit on MK II+; in shifts |
| ORE CANNON CROSSFIRE | ore cannons | aim (cross: left covers the right lane), telegraph line along each barrel's exact path, alternating twin-barrel shells that burst near the lane end; next volley shifts lanes |
| SEISMIC FAULT LINES | cutter + hydraulics | stabilise, cutter bites, cracks run down the marked lanes (they are the hazard), dust, then rock spikes erupt with fragments |
| DEEP-CORE BREACH | drive hub | lock + compress, fissures fan out across the floor and glow, eruption points marked along them, discharge (flash, ring from the hub), cooling + steam |
| QUARRY COLLAPSE | quarry benches | boulders break off the benches (dust) onto marked spots, shatter into fragments, some hop once more, rubble stays |
| BORE CHARGE | the whole machine | align, prep (cutter slows then winds up, tracks slip, thrust extends, lane + chevrons), real charge cutting a trench, debris + aux bursts, brake, recover, back up |
| OVERDRIVE BARRAGE | everything | Critical Overdrive (last phase < 45 %, or Hell's desperation phase): rolling windows led by one system each (cannons → conveyors + seismic → cutter + cannons → seismic + aux) |

**Phases** (Standard plays 1, 3, 5, which together contain all eight attacks):
CUTTER ENGAGEMENT · SPOIL PROCESSING · ORE CANNON CROSSFIRE · SEISMIC EXCAVATION ·
DEEP-CORE BREACH → CRITICAL OVERDRIVE (announced with a phase card). The framework requires
five authored phases, so the sixth stage lives inside the fifth.

**Breakable parts:** ore cannon ×2, spoil conveyor ×2, cutter drive. A broken part keeps its
damage across phases, stays broken (wreck mesh, fire, smoke) and its attacks stop. Without
the cutter drive: no fan (aux pods take over), no bore charge, a weaker deep-core vent from
the deck reactor, no trench, the cutter idles.

**Contact:** the hull footprint is solid; the cutter disc only hurts while it spins hard.

**Death:** attacks stop, the carrier slumps (hydraulic failure), parts cook off, the reactor
flickers, then the core and hub blow together; fires, scorch and rubble stay on the wreck.
Score / progression go through the controller's single kill path.

## Environment (`openpit`)

Flat pit floor (the combat corridor) with old trench strips, twin ruts, tyre tracks, blast
craters, stones and ore; three terraced benches each side (heightfield: blasted faces with
strata and iron staining, haul roads, safety berms, slumped collapses with rubble fans,
falling stones and dust); haul trucks (parked, wrecked and driving the bench roads with
beacons), excavators, crusher station + conveyor bridge, a conveyor run on trestles, light
towers, substations (sparks), fuel tanks, huts, containers, a toppled crane, fires and
smoke; spoil heaps, fractured floor, ore veins and (deep pit) molten fissures with glow.
Params: `benches, trucks, machines, conveyors, fires, craters, spoil, cracks, veins, core`.

## Verification

- `npm run build` ✓; `node tools/validate-arenas.mjs` ✓; `node tools/test-rotation.mjs` ✓;
  `node tools/test-campaign.mjs` ✓.
- `node tools/boss-shot.mjs --boss iron_vein --diff extreme --fire false`: all five phases,
  critical overdrive and the death run with no page errors at 57–60 FPS on the HD 5500 proxy
  (Standard also checked, ~58 FPS).
- Forced checks: crossfire telegraphs, collapse, seismic lanes, deep core; destroying all
  parts sets them dead, the bore charge is refused and the cutter idles once the drive is gone.
- Campaign level 3 starts on `openpit` (waves, ground units), no errors.
- White Fang and Sandbreaker re-run after the shared renderer changes: unchanged, ~60 FPS.

## Known limitations / needs a human playtest

- Balance (HP, densities, timings) was tuned from screenshots, not by playing to the end
  with a vulnerable pilot; Extreme's deep-core discharge is very dense.
- The cutter's planar shadow reads as a hard wedge on the floor in some light directions.
- Repeated passes over the same lane stack trench ribbons into a broad excavated strip.
- Sound effects are synthesized placeholders; the drill is paced bursts, not a loop.
- The headless harness captures a frame every ~3 s, so fast moments were forced via eval.
