# WHITE FANG — 3D boss revamp

Level 1-1 boss (Ground, Ironclad Syndicate) rebuilt to match the reference render: a
real 3D arctic siege tank grinding over a snowbound frontline. Screenshots: `screenshots/white_fang/`.

## What changed

| Before | After |
|---|---|
| Flat Canvas2D sprite drawn over the arena, tread lines faked on the sprite | 3D model drawn **inside** the arena's WebGL2 world pass, depth-tested with terrain, lit by the arena sun |
| Boss eased toward sine-wave targets like an aircraft | Vehicle physics: heading, signed speed, accel/brake limits, no strafing; tracks roll at v ± ω·gauge |
| Parts were sprites at fixed screen offsets; attacks fired from the hull centre | Railguns, side cannons and mortar pods are animated 3D parts; every bullet, laser and telegraph starts at its muzzle, projected from the model each step |
| Breakable parts respawned with full HP each phase | Mounts keep their damage between phases; a broken mount stays broken and its attacks stop |
| Generic `battlefield` env with a dark road | New `frontline` env (bright snow, tread ruts, snow-capped dry-stone walls, fences, poles + wires, 3D wrecks, fires) |

## Files

| File | Role |
|---|---|
| `src/bosses/ground/whiteFang.js` | Boss data: phases, parts, attack table, 2D fallback art |
| `src/bosses/ground/whiteFangRig.js` | Runtime rig: movement controller, suspension, weapon state machines, projectiles, avalanche, contact collision, FX, death/wreck, 3D draw |
| `src/world/tank/whiteFangModel.js` | Geometry of every part + pivots / muzzle anchors (`WF`) |
| `src/world/tank/TankMesh.js` | Mesh builder with normals (loft, bevelled box, tube, lathe) + mat4 helpers |
| `src/world/tank/tankTextures.js` | Painted texture array (armour, gunmetal, track links, grille, snow, barrel, markings, lens, wheel, scorch, tread print) |
| `src/world/tank/TankRenderer.js` | GL programs: lit parts, soft planar shadow + contact pad, multiplicative tread ribbons |
| `src/world/tank/TrackTrail.js` | World-space tread ribbons following each track's real contact path |
| `src/world/env/frontline.js` | Frozen Frontline environment kit |
| `tools/boss-shot.mjs` | Headless Chrome (CDP) fight runner: screenshots, phase skips, FPS, page errors |

Small additive hooks: `ArenaWorld.extras` (3D actors in the world pass) and `speedTarget`
(eased scroll hold); `BossKit` part `skip` / `onSpawn` / `onClear` / `quietClear`;
`BossController` calls `def.renderUnder` / `def.renderOver`; `BossLook` honours `noDecals` /
`noWeak`; sfx `railCharge`, `railFire`, `mortarLaunch`, `shellImpact`, `cannonFire`, `ramRev`,
`ramImpact`, `avalanche`; `window.__npoDev.practice()` for headless checks.

## Rig architecture

- **Pose:** world-space `x, y, heading` (heading 0 = nose down the screen), integrated in
  fixed steps; prev/current values are interpolated for rendering. The entity's screen
  position is the projection of the hull centre, so HP, phases, the HUD bar and the death
  timeline stay in `BossController`.
- **Movement modes** (`DRIVE`): `patrol` (drive to a firing position, stop, fire),
  `enter`, `ram`, `back`. A weapon can set `hold` to stabilise (brake to a stop).
- **Weapons:**
  - *Railguns*: acquire (turret slews, tank stops) → charge (coil glow, sparks, beam
    telegraph glued to the barrel) → fire (World laser along the barrel, recoil, flash,
    shake) → cool (coolant vapour). `both` or alternating `alt`.
  - *Side cannons*: independent yaw toward the player; fans along the actual barrel angle,
    alternating; recoil, flash, smoke.
  - *Frost mortars*: pod elevates, shell launched from the tube mouth on a 3D ballistic
    arc, with a ground shadow and an impact marker (kit circle hazard) that detonates on
    arrival: shard ring, crater, snow burst.
  - *Icicle spiral*: rotating rings from the sensor launcher and each working pod.
  - *Ram charge*: align on the player's lane → wind-up (lane telegraph, exhaust, shudder) →
    charge (real acceleration down the lane, debris shards, crushes ground units) → brake
    (impact) → reverse home. Collision is the tank's projected footprint.
  - *Avalanche*: warning chevrons and gap markers, then a wall with one safe gap rolls down.
- **Phases:** RAIL LANCE · ICICLE STORM · RAM CHARGE · AVALANCHE · FROZEN FURY
  (Standard plays 1, 3, 5; Extreme plays all five; Hell adds WHITEOUT). All four mounts
  are breakable in every phase.
- **Death:** attacks stop, mounts cook off, the turret is blown off its race, fires and a
  scorch decal stay on the wreck, and the field starts scrolling again. Score and
  progression go through the existing single `killEnemy` path.
- **Fallback:** with no arena world (no 3D pass) the same rig runs on a flat camera and the
  boss keeps its 2D sprites.

## Verification

- `npm run build` ✓; `node tools/test-campaign.mjs` ✓ (the test now knows `frontline` is
  a land env); `node tools/test-rotation.mjs` ✓; `node tools/validate-arenas.mjs` ✓.
- `node tools/boss-shot.mjs --url <server> --diff extreme --fire false`: all five phases,
  death and wreck run with no page errors. On the HD 5500 proxy (720×960, high quality)
  it holds ~58–60 FPS in phases 1 and 5 on Extreme and in production builds.
- Production build (`vite preview`): 3 of 3 runs loaded the arena and the 3D tank.

## Known limitations / needs a human playtest

- Balance (HP, fire rates, ram lane width, avalanche gap) was checked for readability in
  screenshots, not by playing to the end with a vulnerable pilot.
- On the dev server, the first run after editing a source file sometimes left the arena's
  build worker stuck (grey ground). It never happened against the production build or on
  later dev runs; it looks like a Vite transform race.
- Battlefield props are baked into terrain chunks, so the ram doesn't break walls or
  fences; it crushes ground units and throws snow and debris.
- Sound effects are synthesized placeholders in the existing style; there is no looping
  engine rumble.
