# COLOSSUS CRAWLER — 3D final-boss revamp

Level 1-5 MAIN BOSS (Ground, Ironclad Brotherhood) rebuilt from a four-tread siege platform into
an eight-legged apocalypse engine: a walking, climbing, leaping 3D machine fought on a burning
urban highway. Screenshots: `screenshots/colossus_crawler/`.

## What changed

| Before | After |
|---|---|
| 2D four-tread sprite hovering on sine targets | 3D eight-legged crawler drawn in the arena's WebGL pass (sun-lit, oily gunmetal sheen, muzzle / core point light, planar shadow + a contact pad under every planted foot) |
| Bullets from fixed sprite offsets | Every bullet, beam, shell, telegraph and flash starts at its mechanism on the model |
| Five unrelated arenas (overpass, tunnel, scrapyard, foundry, siege field) | One new periodic `overpass` environment on a shared map model, in five moods |
| Charges down a lane, spirals | Eleven abilities: climbing, leaping, evasion, a rooftop repair, a lethal execution leap |

## Files

| File | Role |
|---|---|
| `src/bosses/ground/colossusCrawler.js` | Boss data: 5 phases, 17 breakable parts, attack table, 2D fallback art |
| `src/bosses/ground/colossusCrawlerRig.js` | Runtime rig: body controller, IK legs, gait, climbing, leaping, AI + threat evaluation, weapons, the eleven abilities, repair, execution, parts, footprints, FX, camera, death, 3D draw |
| `src/world/tank/colossusCrawlerModel.js` | Geometry of every part + joints / mounts / muzzles (`CC`); authored at 1, scaled ×0.74 at build |
| `src/world/env/overpassMap.js` | The shared map: straight 16-lane highway, climb sites (kind, roof height, entry, wall, pad), `footHold`, `surfaceZ` |
| `src/world/env/overpass.js` | Burning Overpass environment kit (periodic, 16 chunks) |
| `src/world/tank/tankTextures.js` | +3 layers: CCARMOR (heavy gunmetal plate), CCMARK (hazard / stencils), FOOT (footprint stamp) |
| `src/world/tank/TankRenderer.js` | `CRAWLER_LOOK`; per-draw uniform cache (all 3D bosses: unchanged values are no longer re-sent) |
| `src/bosses/arenaConfigs/ground.js` | The five `cc_*` arenas now use `overpass` (ids kept; names: Burning Overpass, Crimson Interchange, Collapsed Skyway, Tower Inferno, Apocalypse Boulevard), camera pitch 0.42 |
| `src/world/env/downtown.js` | `meshVehicle` / `WRECK` exported; wrecks can sit at a height (`z`: garage decks, the highway stub) |
| `src/audio/sfx.js` | `crawlerStep`, `crawlerLand`, `crawlerLeap`, `climbScrape`, `executionAlarm` |
| `src/bosses/looks.js` | Old `colossus_crawler` retrofit entry removed (the boss carries its own `look`) |

The mini-boss is unchanged: IRONSIDE EXPRESS (armoured train) already held level 5.

## The map and the structures

- Straight highway centred on x = 0: seven lanes per side of a painted median, shoulders,
  curbs, sidewalks; city blocks from |x| = 240. Burnt traffic is **painted** on the carriageways
  (the feet walk over it); 3D wrecks, lamps, barriers and poles stand on the shoulders.
- **Climb sites** — one per chunk (512), alternating sides, each an explicit traversal target:
  `garage` (four open decks on a column grid, concrete fins as the climbing wall, a roof deck),
  `deck` (a collapsed elevated-highway stub on piers, a solid abutment wall at the broken end;
  the fallen span lies across the road as rubble, the opposite stub hangs a slab to the
  sidewalk), `podium` (office podium, tower set back). Each defines an entry point on the road,
  its wall plane, a roof pad (hazard-striped edges, red beacons, kept clear) and its height.
  Leaps link any two surfaces within 1250 units. Nothing else is climbable.
- `footHold(x, y, z)`: on a site above its roof line → the roof (kept off the edges); inside a
  site below it → its wall; against any other block → pulled back onto the sidewalk (feet never
  enter a building); else the street.

## Locomotion

- **Body**: world pose (x, y, z, heading, pitch, roll). A velocity controller drives it to the
  AI's goal (acceleration-limited, crawl speed per phase, −6 % per broken leg); heading turns
  toward the pilot at a limited rate. Row goals are unprojected at the hull's height so the
  hull itself sits on the requested screen row.
- **Legs**: 3 joints each (hip yaw, femur, knee), solved by IK every frame from the hull to the
  foot's **world** position (knee up, spider-like). Coxa housing with a coil-over, armoured
  femur and tibia, a hexagonal clawed foot laid flat on its surface normal (roof, street or
  wall), hydraulic actuators spanned between the joints every frame.
- **Gait**: alternating tetrapod (L1 R2 L3 R4 / R1 L2 R3 L4) with a ripple inside each group,
  swing 36 % of the cycle (≥ 2 feet planted per side). The clock advances with distance,
  turning and foot error; stride (44–98) and step rate grow with speed. A swinging foot aims
  ahead of its home by the body's travel for the rest of the swing plus half a stance, lifts on
  an arc and lands on a foothold. Feet stay planted in the world between swings.
- **Weight**: every plant kicks a damped compression spring (bigger at speed, much bigger for
  stomps and landings); nose rises under acceleration, the hull leans out of turns and sways
  with the gait.
- **Footfall FX** at the real contact: dust, sparks (more at speed), a footprint stamp (crushed
  hexagonal pad, three claw gouges, radial cracks; 200 kept, faded over 40 s), a thud (paced).
- **Climb**: walk to the site's entry and face the wall → rear up (pitch 0.72) → haul up the
  wall (front feet on the roof edge / wall, rear on the street, forced gait) → crest and level
  onto the pad (stance ×0.8) → turn to the pilot. Concrete shakes off the facade (some chunks
  fall as slow bullets). The camera holds the scroll and pans to the site.
- **Leap**: crouch → launch (every foot kicks dust, sparks, a print; shockwave) → ballistic arc
  with an apex, legs tucked, then reaching for the surface → landing (all eight feet planted,
  deep compression, shockwave, crater + scorch, thrown concrete chunks, a bullet ring) → recovery.
  A landing zone is marked from the crouch. The camera lifts its pitch a little in flight.

## Camera

The rig owns the scroll for the duel: a slow drift (0.55/step, the crawler walks backward to
hold its row) — held at 0 during climbs, repairs, leaps and the execution — and a catch-up
when the crawler is above its row (gentle acceleration, hard braking: no overshoot into the
pilot's space). Lateral framing follows the body (±70 on the road, up to ±350 toward a site).
During an evasion the camera does not follow the crawler off-screen until the ultimate ends.

## AI

Priorities each step: defeat → threats (evasion) → the execution leap → siege reclamation →
terrain (leave a roof it was left on) → requested tactics (vertical breach / hops, from the
pattern table) → wander. Wander picks a screen column every 2–4 s; **anti-camping**: when the
pilot's x spread over ~4 s is under 34 units, the crawler lines up on that lane (60 %).

**Adaptive Evasion Protocol** (phases 4–5): inputs are the pilot's ultimate starting (assumed
screen-wide), a bomb starting within 300 of the hull (local), a damaging beam crossing the hull
for 10+ steps. After a reaction delay (12–22 / 8–14 / 4–10 steps) and if its cooldown allows,
with an 80 / 60 / 70 % chance: ultimate → crouch and leap clear of the screen onto a site far up
the road (or the road beyond), the camera stays back until the ultimate ends; bomb / beam → a
fast lateral scuttle away from the pilot's column / out of the line. Never while repairing,
mid-execution or already in a leap; cooldowns 1100 / 420 / 300 steps. Hits before the escape
still land (an Orbital Rail Grid took ~3 % of the phase before it cleared). **Reserve**: when the
pilot's ultimate meter is ≥ 85 and the evasion is nearly ready, voluntary climbs / hops wait.
Escape and climb routes avoid the last two sites used.

## Weapons and abilities

| Ability | Mechanism | Behaviour |
|---|---|---|
| 1 SIEGE CORE BARRAGE | twin heavy cannons (yaw, recoil) | 28-step wind-up (muzzle glow, aim lines), seven shells at accelerating intervals alternating guns; even shots at the pilot's last-seen spot, odd shots lead the movement; every third shell bursts into a ring |
| 2 CRIMSON FLAK STORM | shoulder rotaries + front battery + front-leg guns | rotaries rise and spin up (aim lines), sweep from the flanks inward and back; the battery throws magenta fans with walking gaps; leg guns fire yellow kunai within a forward arc |
| 3 ARTILLERY COLLAPSE | two mortars (yaw, elevation) | real 3D shells on arcs to marked road zones (pilot, predicted, brackets); impact blast, crater, dust; lethal inside the zone; every other one bursts into a ring |
| 4 EIGHTFOLD SUPPRESSION | all systems, in windows | cannons → rotary streams from the flanks (middle open) → missiles from the pods down four telegraphed lanes (two adjacent lanes always free) → the core's ring burst |
| 5 CATACLYSMIC FOOTFALL | the legs | stomp gait (high lift); a zone marks where each front-pair foot will land; each stamp: shockwave, crater, ring of rice; it bears down the road toward the pilot, rotaries trickling, then backs off |
| 6 VERTICAL BREACH | the legs | climb a site ahead; fight from the roof (heavy attacks continue); leave |
| 7 AERIAL SIEGE LEAP | the legs | from a roof: across to a site on the other side (once) or down to the road; marked landing, shockwave, ring |
| 8 ADAPTIVE EVASION PROTOCOL | the AI | see above |
| 9 SIEGE RECLAMATION | dorsal hatches, repair arms, repair reactor | see below |
| 10 APOCALYPSE EXECUTION LEAP | the whole machine | see below |
| 11 FINAL CATACLYSM | all systems | after the repair: rolling windows (barrage + missiles, flak, artillery, a hop, suppression, the core), fire rates ×1.3 for 600 steps |
| (core) SIEGE CORE EMITTER | the front lens | charge (energy drawn in, the eye floods), tracking warning beam from the lens, discharge (beam + ring of big orbs + rice), recoil, steam |
| (pods) missiles | 2 × 8 tubes | covers open, staggered pairs, smoke trails, limited homing, late burst |

Heavy attacks are serialised (one at a time, the next queued); climbs, leaps, the repair and the
execution keep new ones waiting (holding a roof does not).

## Siege Reclamation

- Trigger: last phase (`final`), below `repairAt` = 45 % of the phase's HP, once per phase
  (Hell's desperation phase gets its own), 600-step cooldown. Phase card + callout.
- Sequence: attacks stop → reach a site ahead (climb when near and ≥ 5 legs work, else leap) →
  anchor: hatches open, repair arms unfold → **repair**: 300 steps, welding arcs and sparks from
  the torches, cyan conduits and repair reactor glow, progress bar → hatches close → leap down to
  the road → FINAL CATACLYSM. Defensive fire: slow rotary fans, a light battery fan.
- Healing is real HP: up to `repairHeal` = 30 % of the phase HP (halved without the core
  emitter), never above the phase's top; the boss bar shows it at once. Verified 612 → 1071 of
  a 1530 phase (459 = 30 %).
- **Interruptions** (clearly defined): the core emitter destroyed → stops; damage taken during
  the repair ≥ 22 % of the phase HP → REPAIR OVERLOADED (a second bar under the repair bar fills
  toward it). No site in reach → it repairs where it stands.

## Apocalypse Execution Leap

- Unlocks when the boss's **total** HP is ≤ 50 % (the boss bar): phase card + flash; first use
  ~2 s later, then a 1500-step cooldown (1200 in Hell). Never from a roof.
- Wind-up (64 steps): attacks end, alarm, deep crouch, the eye floods red, the zone appears on
  the road under the pilot and follows with lag.
- Flight (86 steps, apex 290 — the machine looms toward the camera): the landing point tracks
  the pilot at ≤ 2.1 units/step until 62 % of the flight, then commits. Zone: pulsing red disc,
  crosshair, a ring closing on the impact, inward chevrons, blinking faster near the end.
- **Impact frame only**: if the pilot is inside the zone (projected radius + hitbox) and not
  invulnerable, `p.hit()` with the death-bomb window skipped — a crushed pilot loses a life
  (bombs / ultimates / respawn invulnerability still save it; lives and game-over as usual).
  Otherwise: shockwave, crater, rings, a 70-step recovery, then it walks back up.

## Parts and damage

Heavy cannon ×2, rotary ×2, missile pod ×2, mortar ×2, the core emitter, **leg ×8** (knee
hitboxes). Part HP persists across phases; a broken weapon stops at once (no invisible shots),
shows a scorched stub, smokes and sparks. A broken leg limps (slower, lower, longer swings),
leaks hydraulic mist and sparks at the knee; ≥ 4 broken → no climbing (it leaps), ≥ 5 → no
stomps / evasion. Global damage: scorch grows with HP lost, smoke below 50 %, sparks below
35 %, red lights flicker when critical.

## Defeat

Attacks, the repair and the execution are cancelled; the eight legs buckle one by one (blast and
sparks at each knee, the foot slides out, the body sinks and tilts), mounts cook off, the core
overloads (eye flicker → white, sparks), then the hull blows (big blast, shockwave, armour chunks,
fires and scorch on the wreck). Score and progression go through the controller's single kill path.

## Phases

| # | Name | Content | Crawl |
|---|---|---|---|
| 1 | AWAKENING OF THE COLOSSUS | Siege Core Barrage, light Flak Storm | 1.5 |
| 2 | CRIMSON SIEGE | Flak Storm, Artillery Collapse, barrage, missiles | 1.7 |
| 3 | EIGHTFOLD ADVANCE | Footfall, Suppression, artillery, flak, barrage, occasional climbs | 2.4 |
| 4 | VERTICAL BREACH | climbs + leaps, hops, core emitter, missiles, flak, barrage; evasion on | 2.4 |
| 5 | APOCALYPSE ENGINE | core, Suppression, Footfall, artillery, flak, climbs, evasion; Siege Reclamation → Final Cataclysm | 2.6 |

Standard plays phases 1, 3, 5: together they contain all eleven abilities (the execution leap is
gated by HP, so it appears in whichever phase crosses 50 %).

## Verification

- `npm run build` ✓; `node tools/validate-arenas.mjs` ✓; `node tools/test-campaign.mjs` ✓;
  `node tools/test-rotation.mjs` ✓.
- `node tools/boss-shot.mjs --boss colossus_crawler --diff extreme --fire false` with plans that
  force each ability through the rig (session plans): climb → rooftop hold → cross-road leap to a
  highway deck → leap down; footfall; artillery; flak; suppression; core; evasion on Kairo's
  Orbital Rail Grid (escaped off-screen onto a garage, took ~3 %); repair (numbers above);
  execution leap; Final Cataclysm; defeat → stage clear. No page errors.
- Performance on the HD 5500 proxy (Extreme): phase 1 54–56 FPS, phase 5 (densest arena mood)
  ~52 FPS (60 with the crawler hidden; the crawler costs ~3.3 ms of draw submission). White Fang,
  Sandbreaker, Iron Vein and Urban Devastator re-run after the shared changes: 60 FPS, no errors,
  Urban Devastator visually unchanged.
- Campaign level 5 (`StageScene` stage 4): waves on the Burning Overpass at 60 FPS, no errors.
- Bug found and fixed while testing: the World culls entities that sit outside its field box past
  60 s of life; knee hitboxes near the screen edge were disappearing. The boss and its parts are
  now clamped inside the box (above y = −10 shots still skip them, so leaping off-screen works).

## Known limitations / needs a human playtest

- Balance (HP, densities, timings, repair amount, execution cooldown, evasion chances) was tuned
  from captures, not by playing to the end with a vulnerable pilot. Extreme phase 5 with escorts
  gets very dense.
- Phase 5 runs ~52 FPS on the low-end proxy GPU (the other ground bosses hold 60). The `low`
  quality preset drops a shadow pass and the barrels of the actuators; further savings would need
  instanced legs.
- The road is straight; the crawler never turns into a cross street. The city repeats every
  8192 units.
- Climbing is a scripted body path with procedural footholds (wall / roof / street), not a
  physics solve: during the steepest moment the rear legs can stretch to their reach limit.
- The 75-second phase timeout (framework, all bosses) can end a long final phase; the repair adds
  time to it.
- In Practice the five phases are separate worlds; at each phase change the crawler is put back
  on the road at the same screen position under the transition cover.
- Only the crawler's own debris is 3D-physical; buildings are not destructible (impacts leave
  craters, scorch and dust).
- Sound effects are synthesized placeholders. The 2D fallback sprite is a simple silhouette.
