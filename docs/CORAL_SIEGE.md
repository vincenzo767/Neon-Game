# CORAL SIEGE — 3D naval boss revamp

Level 2-1 boss (Naval, Ironclad Brotherhood), the first naval boss, rebuilt from a flat 2D ship
sprite into a real 3D dreadnought-class coastal-assault battleship that steams bow-first down a
winding lagoon channel at the pilot. Screenshots: `screenshots/coral_siege/`.

## What changed

| Before | After |
|---|---|
| 2D battleship sprite hovering on sine targets | 3D battleship drawn in the arena's WebGL pass; its hull is modelled down to the keel, so the depth-written sea clips it at a real waterline (it pitches, heels, lists and sinks *through* the water) |
| Bullets from fixed sprite offsets | Every round, missile, charge, flash and telegraph starts at its barrel, cell or tube on the model |
| No wake; flat water | Hull-water interaction in the water shader + a wake that follows the real path (curves through turns) + spray, splash columns, impact rings |
| Harbour / coast / generic arenas | New periodic `lagoon` environment on a shared map model, in five moods |
| 4 simple attacks | Ten abilities: salvo, broadside, AA saturation, missile salvo, depth charges, tidal wake, coastal bombardment, monsoon, overdrive, Scorched Reef |

## Files

| File | Role |
|---|---|
| `src/bosses/sea/coralSiege.js` | Boss data: 5 phases, 8 breakable parts, attack table, 2D fallback art |
| `src/bosses/sea/coralSiegeRig.js` | Runtime rig: helm (heading, rudder, speed), scroll / camera ownership, seakeeping, weapons, the ten abilities, parts, water + wake hookup, FX, death / sinking, 3D draw |
| `src/world/tank/coralSiegeModel.js` | Geometry of every part + mounts / muzzles / outline (`CS`) |
| `src/world/tank/ShipWake.js` | Wake history → Kelvin arms (bow + sponson shoulders) and propeller-race ribbons |
| `src/world/env/lagoonMap.js` | Shared map: winding channel, banks, shoals, piers, jetties, buoys, coastal **installations** |
| `src/world/env/lagoon.js` | Lagoon Anchorage environment (periodic: land + translucent shallows layer) |
| `src/world/WorldGL.js` | Water shader: optional ship interaction, 6 impact rings, HQ micro-ripples / depth variation (all zero by default: other water arenas render exactly as before) |
| `src/world/tank/TankRenderer.js` | `NAVAL_LOOK`; procedural animated **foam** program for wake ribbons |
| `src/world/tank/tankTextures.js` | +4 layers: NAVY (steel-blue plate, salt crust, rust weeps), NDECK (deck plating), NHULL (weathered hull), CSMARK (hazard stripes, hull number 21) |
| `src/world/ArenaWorld.js` | Periodic *blend* layers are drawn at their periodic images (the shallows) |
| `src/bosses/arenaConfigs/naval.js` | The five `cs_*` arenas (ids kept) now use `lagoon`, camera pitch 0.38, `keepBehind: 2` |
| `src/audio/sfx.js` | `navalGun`, `shipHorn`, `vlsLaunch`, `waterSplash`, `chargeSplash`, `depthCharge`, `ciws`, `thunder`, `shipEngine` |
| `tools/test-campaign.mjs` | knows `lagoon` is open water |

The mini-boss is unchanged: RED HERON (seized coast-guard cutter) already held level 2-1.

## The ship

≈ 300 × 480 units: lofted hull with flare, knuckle, boot-top and keel; armoured wing sponsons
(outrigger blisters to the waterline) with belt plates; forecastle breakwater, anchors, chains,
bollards, rails; forward deckhouse with the ASW launchers, fire-control director and CIWS tubs;
stacked superstructure (deckhouse, level 2, bridge with wings and window bands, fire-control top,
radar domes, lattice mast with rotating search radar and antennas), raked funnels; quarterdeck
depth-charge rails. Mounts: main turrets **A** (bow), **B** (port wing), **C** (starboard wing),
each with three separately elevating / recoiling barrels; two secondary twins; six CIWS gatlings
(yaw, pitch, spinning rotor); two 12-cell VLS batteries with hinged doors; two 12-tube ASW rocket
launchers. Emissive red / green navigation and combat lights, cyan sensors, searchlights.

## Helm, scroll and camera

- **Helm:** pure pursuit on a look-ahead point down the channel (`channelX(y)` + its lane); the
  rudder slews, turn rate ∝ rudder × speed (a big hull answers slowly); speed has acceleration
  limits. Lane changes, the channel's bends, the Tidal Wake S-turns and the overdrive are real
  heading changes; the fairway keeps the hull and sponsons clear of the piers and shoals.
- **Seakeeping:** swell heave / pitch / roll (×3.6 in the storm), heel outward in turns, squat under
  acceleration, recoil and impact kicks on a damped spring.
- **Scroll:** the rig owns the camera. The field runs **backward** (the ship advances on the
  pilot, as in the reference). The camera holds the ship's row and lags behind its accelerations,
  so in the overdrive it surges toward the pilot before the camera catches up. Lateral framing
  follows the channel and the ship; the camera lifts its pitch in the overdrive and rolls a touch
  into hard turns; heavy guns kick it.
- **Hit body:** the boss's single hit circle rides the hull under the pilot's guns (the bow, or the
  wing on that side), so shots meet the hull where they visually hit it. The projected waterline
  outline is solid (contact).

## Water

- **Hull interaction (shader):** the ship's pose, speed and sponson outline go into the water
  surface each step: the bow cushion piles up and foams, a foam band hugs the waterline (wider with
  speed), pressure ripples run off the sides, near-field Kelvin crests open behind the stem, and the
  hull shades the water beside it.
- **Wake (ShipWake):** a history of the bow, stern and sponson-shoulder positions with their
  headings and speeds. Each frame: two Kelvin arms from the bow, two from the shoulders, and a
  centre-heavy propeller race — each sample pushed out perpendicular to *its own* heading, so the
  wake curves with the turns the ship really made and stays where it was. Intensity follows the
  speed at each sample; drawn with a procedural foam shader (three drifting noise octaves,
  breaking into lace as it ages, darker churned water under it).
- **Impacts:** up to six disturbance rings (shell / charge impacts, muzzle blast flattening the sea
  under the guns, the final explosion) bend the water normals and foam; plus splash columns,
  droplets, mist, foam decals. Scale follows the event (CIWS fire makes none; a magazine makes a
  540-unit ring).
- **Spray:** bow spray and shoulder spray with speed, spray on the outside of a turn, propeller
  churn, wind-driven spray in the squall; buoys rock on the swell and slap rings into it.

## Abilities

| Ability | Mechanism | Behaviour |
|---|---|---|
| TRIPLE-GUN SALVO | A, B, C in turn | train (aim lines), three barrels fire in sequence (recoil, flash, smoke, blast ring on the water, camera kick). Alternates air-burst rounds (big orbs that burst into rings) with plunging 3D shells onto three marked zones (the pilot, its predicted spot, a bracket): water column, ring wave, orb ring, lethal inside the zone at impact |
| CRIMSON BROADSIDE | B, C + the secondary twins | trained abeam, staggered port / starboard volleys; each barrel lays its own orb fan; the fans walk from abeam toward the pilot; the ship heels with each volley and keeps steaming |
| ANTI-AIR SATURATION | six CIWS | the deckhouse pair fires aimed bursts of seven, the forward sponson mounts sweep, the aft ones walk lanes along the bottom edge: crossing streams with corridors |
| HARBORBREAKER MISSILE SALVO | VLS batteries | doors open in ripple; cold launch (popped up, booster lights, pitches over outboard); alternately guided (limited seeker, reticle on the pilot) and unguided curving; smoke trails; a blast + water column where each bursts |
| DEPTH CHARGE RING | ASW launchers | marks a ring round the pilot (heavy variant: 7 + centre); 3D rounds splash in, sink (bubbles, countdown ring), detonate: water dome, ring wave, foam, rice ring (+ second orb ring when heavy), lethal inside the mark |
| TIDAL WAKE BARRAGE | the whole ship | horn, flank speed, an S-turn across the fairway; wake boosted; twins, wing turrets and sponson gatlings fire abeam as the hull swings, so the fans sweep |
| COASTAL BOMBARDMENT | main turrets | designators on up to three shore installations in view; high-angle 3D shells; impacts: blast, scorch, crater, thrown 3D debris, debris orbs thrown toward the corridor; the installation **burns from then on** (a fuel tank also explodes); then a walking barrage of water impacts from the shore into the corridor |
| MONSOON SCREEN | the squall | rain sheets, darker sky, higher sea and foam, harder pitching, wind spray, lightning + thunder; wind-bent gatling streams and drifting orb fans |
| DREADNOUGHT OVERDRIVE | engines + all systems | final phase below 62 % of its HP: phase card, horn and klaxon; ~2× speed in surges, harder turns, boosted wake, black funnel smoke, camera pitch lift; faster rolling sequence (salvo → broadside → missiles → tidal wake) |
| SCORCHED REEF | all surviving systems | below 30 % (Hell's desperation phase starts here): phase card, the deck catches fire; rolling windows of every surviving system (salvo, missiles, broadside, heavy depth ring, tidal wake, coastal / plunging salvo) |

Heavy attacks are serialised (one at a time, the next queued). Light harassment (deckhouse CIWS
bursts, secondary twins) pauses during the big ones.

## Parts and damage

A / B / C turrets, port / starboard secondary groups (twin + that side's three CIWS), port /
starboard VLS, the command bridge. Hitboxes ride the projected mounts. Part HP persists across
phases; a broken weapon stops at once (no invisible shots), shows a scorched wreck (barrel stubs),
burns and sparks; armour plates fly off as 3D pieces and splash into the sea. Losing the
**bridge** collapses the upper levels and mast and loses fire control: aimed fire stops leading
the pilot, the radar stops, the searchlights go out. Hull: scorch grows with HP lost, smoke below
60 %, fires and sparks below 35 %, red lights flicker below 20 %.

## Defeat

Attacks stop; every surviving system fails in turn (the bridge among the first), deck fires
spread, cook-offs along the hull; the ship slows, lists to its damaged side and settles by the
bow; the magazines go (huge blast, sea domes all round the hull, 22 armour plates, a 540-unit
foam disc and two ring waves); it sinks through the waterline while burning (after the kill it
keeps settling on the arena's clock until it is gone). Score and progression go through the
controller's single kill path.

## Phases

| # | Name | Content | Speed |
|---|---|---|---|
| 1 | OPENING SALVO | salvo, light AA + secondaries, light broadside | 0.62 |
| 2 | CRIMSON BROADSIDE | broadside, tidal wake, salvo | 0.72 |
| 3 | HARBORBREAKER | missiles, AA saturation, depth charges, tidal wake | 0.70 |
| 4 | DEPTH CHARGE ASSAULT | depth charges (heavy every other), coastal bombardment, broadside, missiles | 0.66 |
| 5 | MONSOON SCREEN → DREADNOUGHT OVERDRIVE (62 %) → SCORCHED REEF (30 %) | storm, salvo, coastal, tidal; then the escalations | 0.78 |

The prompt's seven stages map onto the framework's five authored phases: Monsoon, Overdrive and
Scorched Reef are staged inside the last phase on its own HP (each with a phase card), so every
difficulty reaches them. Standard plays phases 1, 3, 5: together they contain all ten abilities.

## Arena: Lagoon Anchorage

A deep-water channel winds up a tropical lagoon (period 4096, 8 chunks, built once).
Starboard bank: concrete quay wall with tyre fenders and bollards, piers with patrol boats,
warships moored alongside (some burning and settling), fuel tanks in bund walls, bunkers, radar
towers, warehouses, cranes, container stacks, quay lamps. Port bank: palm beach and jungle,
fishing village, wooden jetties with trawlers, a lighthouse on a rocky point with its sweeping
beam, gun pits in sandbag rings. Water: animated sea with HQ micro-ripples and depth variation; a
smooth translucent shallows layer (turquoise shelf, sand ripples, coral heads, seaweed, shoals
with breaking water, surf bands, a wash line at the quay wall); half-sunk wrecks with smoke;
channel buoys and floating crates / drums rocking on the swell. Moods: noon (Lagoon Anchorage —
Noon), afternoon (Coral Narrows), smoke (Burning Quays), afternoon (Lagoon Anchorage, the campaign
level arena), storm (Monsoon Squall).

## Verification

- `npm run build` ✓; `node tools/validate-arenas.mjs` ✓; `node tools/test-campaign.mjs` ✓;
  `node tools/test-rotation.mjs` ✓.
- `node tools/boss-shot.mjs --boss coral_siege --diff extreme --fire false` with plans that force
  each ability through the rig, skip to phase 5, push it through Overdrive and Scorched Reef, and
  defeat it: no page errors.
- Campaign level 2-1 (`StageScene` stage 5): the lagoon builds in ~6 s (all 16 chunks by ~12 s,
  never rebuilt), waves fly over it, RED HERON appears, the boss arrives inside the level arena,
  three phases → defeat → burning wreck behind the STAGE CLEAR tally → level 2-2.
- Performance on the HD 5500 proxy: Standard phase 1 ~55 FPS (the ship's draw costs ~1 ms);
  Extreme 48–60 FPS through the final phase. `low` quality skips the ship's shadow pass and
  flotsam.
- Regression after the shared changes: Urban Devastator, Sandbreaker and Leviathan Dreadnought
  (ocean water, unchanged look) run at 58–60 FPS with no errors.

## Known limitations / needs a human playtest

- Balance (HP, densities, timings) was tuned from captures with an invulnerable pilot, not by
  playing to the end. Extreme Scorched Reef is very dense.
- The water is a shaded plane, not a displaced mesh: waves, the bow cushion and the wake move the
  surface normals and foam, not its geometry, so the waterline on the hull is a straight cut.
- The wake is history-based ribbons + shader near field; it is not a fluid simulation (as agreed
  in the brief).
- In Practice each phase is a separate arena world: the wake restarts at each phase change.
  Practice ends at the kill, so the post-kill sinking is only seen in the campaign.
- The lagoon repeats every 4096 units (~90 s of travel); shelled installations stay burning for
  the lap they were hit.
- Sound effects are synthesized placeholders. The 2D fallback sprite is a simple silhouette.
