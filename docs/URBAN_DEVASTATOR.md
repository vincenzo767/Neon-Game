# URBAN DEVASTATOR — 3D boss revamp

Level 1-4 boss (Ground, Ironclad Syndicate) rebuilt from a four-legged siege walker into a
colossal armoured pursuit supercar that flees the pilot through a ruined downtown. The camera
chases it from behind: its rear (turbine, thrusters, rear guns, taillights, fat rear tyres)
faces the player. Screenshots: `screenshots/urban_devastator/`.

## What changed

| Before | After |
|---|---|
| 2D walker sprite hovering on sine targets | 3D supercar drawn in the arena's WebGL pass (depth-tested, sun-lit, glossy clear-coat paint, planar shadow + contact pads under the body and each tyre) |
| Field scrolls at level speed under a hovering boss | A chase: the rig runs the scroll at chase speed (4.4 units/step) and pans the camera sideways to frame the car through bends and forks |
| Bullets from fixed sprite offsets | Every bullet, beam, telegraph and flash starts at its mechanism on the model (rear cannon muzzles, rotary barrels, missile tubes, turbine) |
| Five unrelated arenas (city, metro tunnel, rail yard…) | One new periodic `downtown` environment on a shared road model, in five moods |
| Siege Howitzer mini-boss | PURSUIT INTERCEPTOR (autonomous combat car) |

## Files

| File | Role |
|---|---|
| `src/bosses/ground/urbanDevastator.js` | Boss data: 5 phases (+ Turbo Repair, Critical Pursuit), 7 breakable parts, attack table, 2D fallback art |
| `src/bosses/ground/urbanDevastatorRig.js` | Runtime rig: chase camera + speed, driving model, AI, suspension, weapons, the eight attacks, turbo repair, parts, tyre marks / smoke / sparks, debris, death, 3D draw |
| `src/world/tank/urbanDevastatorModel.js` | Geometry of every part + pivots / muzzle anchors (`UD`); smooth-shaded lofts for the paint |
| `src/world/tank/SkidTrail.js` | World-space tyre marks: one ribbon per tyre, per-sample intensity, configurable fade |
| `src/world/env/downtownRoad.js` | The shared road model: centreline with bends at intersections, two forks per period, lanes, envelope |
| `src/world/env/downtown.js` | Downtown Siege environment kit (periodic) |
| `src/world/tank/tankTextures.js` | +9 layers: CARPAINT, CARBON, SILVER (metallic), TIRE, RIM (metallic), GLASS, UDMARK, SKID, CONCRETE |
| `src/world/tank/TankRenderer.js` | `CAR_LOOK`; opt-in clear-coat fresnel (`gloss`) and one dynamic point light (muzzle / turbine flashes light the bodywork). Both default off: the other bosses render as before |
| `src/bosses/arenaConfigs/ground.js` | The five `ud_*` arenas now use `downtown` (ids kept; names: Downtown Siege, Financial District, Expressway Collapse, Burning Boulevard, Flooded Financial Core), camera pitch 0.62 |
| `src/bosses/minibosses/ground.js`, `src/stages/campaign.js` | PURSUIT INTERCEPTOR replaces the Siege Howitzer as level 4's mini-boss |

Shared hooks: `Camera3D` interpolates its lateral position (`px`); `ArenaWorld.camFollow`
(called right after the camera steps) and `groundShiftAt(sy)`; `Arena.groundShift` +
`movers.ground` so ground units keep riding the road while the camera pans; StageScene
`bossCallout` toast event; sfx `engineRoar`, `tireScreech`, `turboSpool`, `turboBlast`,
`rotaryCannon`, `autoCannon`, `barrierCrash`, `repairHum`, `turbineCharge`, `turbineDischarge`;
`tools/test-campaign.mjs` knows `downtown` is land.

Also fixed (all bosses): when a boss flies in, the scene now prefetches phase 2's arena (it used
to skip straight to phase 3's, so phase 2's world was built during its own transition).

## The road and the chase

- **Road model** (`downtownRoad.js`, period 8192 units = 16 chunks): a twelve-lane boulevard
  (two six-lane carriageways at ±72 from the centreline). `roadX(y)` runs straight between
  intersections (every 512) and **bends at them** (12–17° runs, corners rounded with parabolic
  blends). Twice per period the carriageways **fork** around a raised island (centres move out
  to ±196) and merge before the junction after next.
- **Camera:** the rig owns the scroll for the duel; a speed guard holds it near level speed if
  the periodic chunks ~2 screens ahead aren't built yet. `camFollow` pans `cam.x` toward the car
  (78 %) and the road ahead (22 %). After the defeat it keeps framing the road.
- **Row holding:** the car's speed is a critically damped controller on its screen row, so it
  stays ahead of the pilot; attacks move the target row (drop back to brake for a roadblock,
  surge forward on the turbo).

## Driving model

- **State:** world position, travel direction θ, speed v, slip angle β; heading h = θ + β.
- **Steering:** pure pursuit toward a look-ahead point on the road at the target lateral
  offset (lane, or the chosen fork carriageway), limited by the bicycle model
  (dθ ≤ v·tan(δmax)/wheelbase). The car follows the real bends, changes lanes by steering
  and never leaves the asphalt (also clamped to the carriageway envelope).
- **Forks:** ~760 units before a fork the AI picks a branch (the side it is on, else random)
  and moves over before the island starts.
- **Drift:** β rises on top of the same path (rear slides out, front wheels countersteer),
  held through the slide with a little oscillation, then caught with a small overshoot.
  Corner drifts through the sharper bends in later phases; a big drift is an attack.
- **Animation:** wheel spin from the odometer (rear wheels slip under turbo / launch /
  slide), front-wheel steer from the path (countersteer when sliding), body pitch from
  acceleration / braking, roll from lateral acceleration and slip, bob from road bumps and
  impacts, per-wheel compression, suspension links and coil-overs spanned to each hub every
  frame. Turbine fan with spool inertia; brake lights follow deceleration.
- **Marks and effects:** `SkidTrail` ribbon per tyre at its real contact point (scuff while
  cruising → black arcs under drift / braking / turbo launch, 25 s fade); tyre smoke at the
  contact patches by state (dust, white clouds sliding, darker with a dead turbine); sparks
  thrown backward off the tyres in hard slides, launches, impacts, from a damaged corner;
  thruster flames and the turbine plume scale with throttle; speed lines under turbo.

## Attacks

| Attack | Mechanism | Behaviour |
|---|---|---|
| REAR PURSUIT BARRAGE | rear quarter cannons (twin barrels each) | guns slew to lines either side of the pilot, alternating aimed fans; the sweep pushes the gap across; an expanding wide fan every third cycle |
| SIDEWINDER CROSSFIRE | side rotary cannons | deploy (rise from the waist, aim lines), rotors spin up, each gun sweeps outward ↔ back so the two streams cross; a lane change by steering starts every volley |
| MISSILE PURSUIT | missile pods (6 tubes) | covers swing open, staggered pairs from the tubes, smoke trails, limited homing (0.021 rad/step for 72 steps), late burst into a small ring; reticle on the pilot's spot at launch |
| APEX DRIFT BARRAGE | the whole car | chevrons sweep across the road the way it will go, then a drift across the road; the outside gun fires along the swinging body (curved fans), the rear guns spray the arc |
| ROADBLOCK BREAKER | the whole car | a barrier line + hulks appear ahead; the car brakes and drops back so it scrolls into view, debris lanes are telegraphed, then it charges and smashes through: 3D barriers and chunks fly, tumble, bounce and settle; debris bullets rain back down the road; landing pieces throw small rings |
| TURBINE DISCHARGE | rear turbine emitter | spool (fan + glow, energy drawn in), tracking warning beam glued to the turbine, discharge (beam, ring of big orbs, flash, shockwave, recoil kick), cool-down with steam. Without the emitter: a weak thruster vent ring |
| FULL-LANE SUPPRESSION | rear + side guns | six screen lanes, each wave covers all but a two-lane gap that walks across (telegraphed); rear guns take the inner lanes, side guns the outer; density rises per wave; the car changes lane mid-volley |
| TURBO REPAIR OVERDRIVE | turbine + repair system | see below |

Heavy attacks are serialised (one at a time, the next queued); the barrage pauses during the
discharge and the repair.

**Phases** (Standard plays 1, 3, 5 — together they contain all eight attacks):
PURSUIT BARRAGE · LANE ASSAULT · APEX DRIFT · URBAN SUPPRESSION · TURBINE OVERDRIVE →
TURBO REPAIR → CRITICAL PURSUIT (announced with phase cards; the framework requires five
authored phases, so the last two stages live inside the fifth).

## Turbo repair

- Trigger: last phase (`overdrive`), below `repairAt` = 40 % of the phase's HP, at most
  `repairs` = 1 time per phase (Hell's desperation phase gets its own single repair),
  600-step cooldown.
- Sequence: warn (attacks stop, TURBO REPAIR card, toast, turbine spools, cyan glow) →
  boost (it surges ahead, heavy marks, smoke, sparks, plume, a swerve) → repair (150 steps,
  repair arcs over the bodywork, cyan pulse, progress bar; it does not attack — the
  vulnerable window) → return → **Critical Pursuit** with a 600-step empowered state
  (fire rates × 1.35).
- Healing is real HP: `c.e.hp` climbs toward the phase's top by `repairHeal` = 30 % of the
  phase HP (halved without the turbine emitter), never above the phase's top, and the boss
  bar shows it at once. Destroying the turbine emitter mid-repair interrupts it.
- Verified: triggered at 531 / 1476, 756 halfway (224 of 443), ended at exactly 974.

**Breakable parts:** rear cannon ×2, side cannon ×2, missile launcher ×2, turbine emitter.
A broken part keeps its damage across phases, stays broken (scorched stub, fire, smoke) and its
attacks stop; a damaged rear corner throws sparks.

**Contact:** the car's projected footprint is solid while fighting.

**Death:** attacks stop, it loses control and spins out while the camera brakes with it;
mounts cook off, the turbine shreds, then the hull blows; fires and scorch stay on the wreck,
and the scroll resumes past it. Score / progression go through the controller's single kill path.

## Environment (`downtown`)

Worn asphalt (wheel-path polish, oil drips, patches, cracks, potholes, oil stains with sheen,
manholes, glass around wrecks, scorch, old skid marks, puddles when wet); markings (dashed
lanes, solid edges, double yellow line, gore hatching, crosswalks, stop lines, turn arrows,
cross-street lines); 3D curbs along the real edges and the islands; sidewalks; street lamps
with arms over the road (lit pools); traffic-signal masts (dead, red or flashing amber;
knocked-down ones spark); bus stops, hydrants (one bursting), utility poles with snapped
cables, jersey barriers, construction zones (barrels, fences, scaffolding, skeleton frames,
tower cranes with beacons), checkpoints; office towers and brick blocks set back from the
curb (burning, gutted, collapsed into rubble), billboards; wrecked cars, buses, trucks, police
cruisers and ambulances (flashing beacons), APCs, a burnt tank on a fork island; the islands'
monument, dead trees and lamps; a collapsed elevated expressway across one junction; fires,
smoke, sparks, embers. Params: `fires, damage, collapse, traffic, military, lamps, wet,
construction, night, smoke`. Everything y-dependent divides the 8192 period, so the 16 chunks
are built once (120–190 ms each on the HD 5500 proxy, on par with the Dune Sea).

## Verification

- `npm run build` ✓; `node tools/validate-arenas.mjs` ✓; `node tools/test-campaign.mjs` ✓;
  `node tools/test-rotation.mjs` ✓.
- `node tools/boss-shot.mjs --boss urban_devastator --diff extreme --fire false` (plans in the
  session): all five phases, every attack forced and frozen mid-action for capture, the turbo
  repair (HP numbers above), Critical Pursuit and the defeat, no page errors, 60 FPS steady
  on the HD 5500 proxy with 100–190 bullets (start-up dips while the first lap of chunks
  uploads).
- Campaign level 4 (`StageScene` stage 3): waves on `ud_downtown_siege`, PURSUIT INTERCEPTOR,
  the boss in locked level mode (Standard: phases 1/3/5), ~60 FPS, no errors.
- White Fang, Sandbreaker and Iron Vein re-run after the shared changes: ~60 FPS, no errors,
  Iron Vein visually unchanged.

## Known limitations / needs a human playtest

- The route is one fixed boulevard: "left / right turns" are its bends at junctions and the
  fork branches the car chooses. It never turns into a cross street (the arena camera only
  travels forward).
- The city repeats every 8192 units (~31 s at chase speed).
- Balance (HP, densities, timings, repair amount) was tuned from screenshots, not by playing
  to the end with a vulnerable pilot.
- In Practice the five phases are separate worlds; at each phase change the car is put back
  at the same screen position on the next one under the transition cover. On a slow machine
  the scroll can be held back for a few seconds until the next world's chunks are built.
- Only the scripted roadblock is destructible; lamps, barriers and wrecks baked into the
  terrain are not.
- Tyre marks are subtle on the very dark asphalt; smoke and sparks carry the drift read.
- Sound effects are synthesized placeholders; the engine is paced bursts, not a loop.
- The mini-boss is a 2D sprite, like the other mini-bosses.
- The headless harness captures a frame every few seconds; fast moments were frozen with
  `hitStop` for capture.
