# WHITEOUT BREAKER — colossal polar fortress revamp

Level 2-2 boss (Naval), rebuilt from a small 2D ship sprite into a real 3D polar fortress warship
≈ 3030 × 252 units that lies **stationary** in the Pack Ice Lead and is fought section by section,
bow to stern, as **ten phases**. Screenshots: `screenshots/whiteout_breaker/`.

## What changed

| Before | After |
|---|---|
| 300-unit 2D sprite hovering on sine paths, 5 phases on 5 different arenas | 3D warship ten times longer than the screen, hull modelled to the keel (the sea clips it at a real waterline); it never sails |
| 3 parts, bullets from sprite offsets | 77 weapon mounts, each a breakable part animated from its own pivot; every round, rocket, missile, flash and telegraph starts at its muzzle / tube / cell |
| Phases swap the arena | One world for all ten sections: when a section dies the camera travels along the real hull to the next one |
| Flat arctic floes | New periodic `polar` environment: dark lead with whitecaps, ice-block pressure ridges with blue walls, bergs, burning escorts, brash, frozen debris |

## Files

| File | Role |
|---|---|
| `src/bosses/sea/whiteoutBreaker.js` | Boss data: 10 section phases (`section: k`), 77 generated mount parts, phase sets / HP scale, summon rules, 2D fallback art |
| `src/bosses/sea/whiteoutBreakerRig.js` | Runtime rig: placement, camera (fly-in, section anchors, eased travel, pitch / roll), mount animation, section schedulers and all 43 abilities, frost beam, 3D shells / VLS pops / tracked rockets & missiles, ice spikes, lanes, FX, destruction, defeat, 3D draw + overlays |
| `src/world/tank/whiteoutBreakerModel.js` | Geometry: ten section meshes (hull segment, citadel, deck furniture), per-section lights / trapped ice, 14 mount types, wrecks, pieces; `WB` (sections, mounts, light points) and `TYPES` (pivots, muzzles, arcs) |
| `src/world/env/polarMap.js` | Shared map: lead edges, `iceAt`, floe band, escorts, bergs |
| `src/world/env/polar.js` | Pack Ice Lead environment (periodic: painted pack + 3D solids, translucent brash layer) |
| `src/world/tank/tankTextures.js` | +3 layers: WBPLATE (frosted gunmetal plate), WBDECK (deck plating, frozen puddles, red walkways), WBMARK (crimson ice-class stripes, hull number 22) |
| `src/bosses/arenaConfigs/naval.js` | The five `wb_*` configs (ids kept) now use `polar`; all ten phases use `wb_pack_ice` (+ its Hell `~desperation` variant) |
| `src/bosses/transitions.js` | `section_shift`: a light frost vignette that never covers the screen (the camera move stays visible) |
| `src/audio/sfx.js` | `frostCharge`, `frostBeam`, `iceShatter`, `cryoShot` |

Shared, generic hooks (no effect on other bosses unless they opt in):
`BossController.selectPhases` honours `def.phaseHpScale`; `StageDirector` honours `def.summonFilter` /
`def.summonHold`; `Player.hit(lethal)` skips absorbing abilities; the water shader's `u_shipC.w` sets the
hull's bow length; `tools/validate-arenas.mjs`, `tools/test-rotation.mjs` accept bosses with their own
`phaseSets`; `test-campaign` knows `polar` is open water.

**Bug fix (shared water shader):** the near-field Kelvin term divided by a negative width more than ~200
units ahead of a bow (`exp(+inf) × 0 = NaN`), painting a pale band on the sea. Coral Siege never framed
that water; the clamp leaves its look unchanged.

## The ship and its ten sections

Model space as the other 3D bosses (+y = bow, waterline z = 0); bow tip y = 0, transom y ≈ −3030.
Wedge icebreaker bow (stem bar, ribs, crimson ice belt, ice-class stripes, hull number), a long armoured
citadel with lit gun ports, gunwale armour belt, rails, bollards, hatches, vents, conduits, snow and rime;
red deck-edge and citadel lights with a bloom pass that flickers on a critical section and dies with it.

| # | Section | Mounts | Abilities |
|---|---|---|---|
| 1 | ICEBREAKER BOW BATTERY | triple gun, 2 twin heavies, 2 bow autocannons | Bowbreaker Salvo (heavy rounds that burst), Arctic Fan, Hammer Shot (lobbed 3D round onto a marked zone → two radial bursts), Crossfire Grid |
| 2 | TRIPLE ARTILLERY DECK | 3 triple turrets, 2 secondary twins, 2 flak | Triple Salvo (aim lines, staggered), Converging Fire (wing turrets hit where the pilot *was*, centre sweeps), Flak Curtain (rounds timed to burst), Turret Crossfire (shifting lanes) |
| 3 | ROCKET BATTERY | 4 deck pods, 2 side launchers, heavy array | Rocket Fan, Saturation Volley, Staggered Barrage (diagonal waves), Rocket Minefield (marked points, rockets burst on them) |
| 4 | VERTICAL MISSILE COMPLEX | 4 × 16-cell VLS (hinged doors), 4 trainable boxes | VLS Saturation (cold launch, capped seeker), Hunter Salvo (guided pairs, reticle), Split Trajectory (lane groups), Delayed Detonation (missiles drop timed charges) |
| 5 | MACHINE-GUN DEFENSE GRID | 8 CIWS, 4 autocannons, 2 rotating arrays | Iron Rain, Tracking Sweep (lagging aim), Cross-Lane Saturation, Rotating Flak, Gap Collapse (corridor narrows, resets) |
| 6 | FUSION DECK | 2 twin heavies, 2 missile boxes, 2 secondaries, funnels | Dual Salvo, Artillery Walk (marked impacts walk through the pilot), Missile Lattice, Explosive Ring, Deck Saturation |
| 7 | POLAR FLANK BATTERIES | 4 sponson twins, 2 pods, 2 flak | Portside / Starboard Broadside, Alternating Flanks, Crossfire Sweep, Polar Shard Burst |
| 8 | CRYOGENIC WEAPON ARRAY | 3 cryo projectors, 4 frost mortars, coolant tanks | Frost Slugs (shards + ice patches), Glacial Ring (ice erupts round the pilot, radial waves), Whiteout Gust (wind-bent fire, blown spray), Frozen Corridor (lanes erupt with ice spikes, lethal while erupting), Cryo Surge |
| 9 | WHITEOUT FROST BEAM | main emitter, 4 focusing emitters, 2 CIWS, command tower (bridge, radar, mast, searchlights) | WHITEOUT BEAM, focusing-array volleys |
| 10 | FINAL ARSENAL | rear triple, 2 VLS, 2 CIWS, 2 pods, damaged stern emitter | Total Saturation, Polar Siege, Whiteout Requiem, Last Battery, Final Whiteout (narrower beam, then dense fans) |

Each section: one heavy attack at a time from its rotation, light harassment between them. Turrets track
the pilot; idle sections ahead scan; aimed mounts train before firing (aim lines on the big guns).

## WHITEOUT BEAM (lethal)

Charge ≈ 2.3 s: the core forms, focusing emitters light in turn, vapour gathers, the camera lifts, and the
**exact** sector the beam will sweep (plus its half-width) is filled and pulsing with sweep chevrons and a
closing countdown ring. Fire ≈ 1.6 s: the sweep (left half / right half / centre lance / double:
left then right with a short second telegraph); contact is lethal (`Player.hit(true)`, i-frames from bombs /
dashes still save you); the hitbox is the white core. Cooldown: venting. Each focusing emitter destroyed
narrows the beam; destroying the emitter ends it. No reinforcements are summoned during a beam cycle.
Verified headless: a pilot parked in a centre sweep lost a life; a pilot on the right survived a left sweep.

## Camera and progression

Fly-in: the camera races up the lead and brakes onto the bow. Each section has an anchor (focus point on
a screen row; the beam section sits higher so the beam has room). Transition: attacks stop, the section's
mounts detonate in sequence, a central blast; the camera then eases ~84 steps along the hull to the next
anchor while the phase card names it. Bullets are cleared by the controller (score stars). Everything is
re-projected from world space each step, so mounts, muzzles, hitboxes and telegraphs never drift.
Destroyed sections stay as scorched, burning wreckage under the pilot. Hell's desperation phase moves to a
new world: the hull is re-laid under the camera, so the final arsenal is framed at once.

## Defeat

The final arsenal's weapons fail and spin out of control, lights flicker, cook-offs run along the deck,
the stern emitter overloads (gathering frost), then a magazine + cryo blast, water columns all round,
armour plates and ice thrown, fires; the camera releases and the wreck stays in the ice. Score and
progression go through the controller's single kill path.

## Balance

Section HP `[950 … 1980]` × `phaseHpScale` (Standard / Medium 0.62, Hard 0.72, Extreme / Hell 0.8). With a
pilot camping below and firing nonstop on Standard, sections last ~16–18 s early and ~9–12 s late
(power-ups) of simulation time — roughly 3–4 minutes for the fortress in real play. Breaking every mount of
a section removes ~35 % of its HP.

## Verification

- `npm run build` ✓, `node tools/validate-arenas.mjs` ✓, `node tools/test-campaign.mjs` ✓, `node tools/test-rotation.mjs` ✓.
- `tools/boss-shot.mjs` runs (practice, Standard / Extreme / Hell, firing and not): all ten sections,
  forced beams, the Hell desperation phase, defeat — no page errors.
- Campaign level 2-2 (`StageScene` stage 6): waves over the lead → boss fly-in inside the level arena →
  ten sections → defeat → STAGE CLEAR → level 2-3 waves.
- Performance (HD 5500 proxy): ~44 fps early sections, ~33–40 late sections with the pilot firing
  (Coral Siege measures 44–46 the same way); after optimisation the rig costs ~2 ms update + ~2 ms draw
  per frame. Coral Siege re-checked after the shared water-shader fix: unchanged, 58–60 fps.

## Known limitations / needs a human playtest

- Balance was tuned from captures with an invulnerable pilot; Extreme / Hell late sections are very dense.
- The pilot flies over the hull; the hull is not a solid obstacle (it covers most of the screen).
- Hitboxes for grouped weapons are per mount; the main body is the active section's forward deck.
- The trapped ice along the hull is static (it rides the hull's heave); the water is a shaded plane.
- Sound effects are synthesized placeholders; the 2D fallback sprite is a simple silhouette.
