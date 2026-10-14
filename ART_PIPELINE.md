# Pilot Art Pipeline

How a pilot's procedural vehicle is replaced with hand-made art. Done so far:
**Kairo Vance** (Stormlance; brief `KAIRO_ART_TEST.md`) and **Mira Solenne**
(Halo Sprite). Each pilot's `src/pilot concept art/<Pilot Name>/ASSET_NOTES.md`
records its decisions. Follow these steps for each of the other 15 pilots.

**Ground rules**
- Source art is read-only. Processed files go to `public/assets/pilots/<id>/`.
- The procedural sprite stays as the fallback. A pilot whose art fails to load plays exactly as before.
- Gameplay (hitbox, speed, damage, fire rate, abilities) doesn't change unless the owner approves it. Measure with `tools/dps.mjs` before and after.
- **The feet never fire.** Shots leave from the chest gun and the guns the art actually shows (rifles, arm guns).
- Default size: **90 units tall**. The hitbox never changes with size.

---

## 1. Folder layout

```
src/pilot concept art/<Pilot Name>/        SOURCE (read-only; file names set in tools/art.config.mjs)
  top_down_main.png/.jpg in-game sprite: flies up the screen (Kairo and Mira fly feet-first)
  top-down_front.png     select-card preview + cut-in (face visible)
  pilot_portrait.jpg     select card + cut-in portrait
  parts sheet            reference only
  FX sheet               reference only (effects are rebuilt in code)
  ASSET_NOTES.md         written in step 2 below

tools/art.config.mjs                       per-pilot settings: source files, background options, anchor estimates
tools/process-art.mjs                      processing script: node tools/process-art.mjs <id>   (npm run art:<id>)

src/pilots/art/mechaArt.js                 shared: sprite layers, animation, thrusters, anchors (createMechaArt)
src/pilots/art/mechaFx.js                  shared: lances, shards, beam, charge orb, muzzle flares, hit sparks (createMechaFx)
src/pilots/<id>Art.js                      the pilot's config: palette, built-in anchors, flames, nozzles, exhaust

public/assets/pilots/<id>/                 PROCESSED (served by Vite; edit only via the script / F9 editor)
  <id>_back@2x.png           sprite, 360 px of art tall + 6 px padding
  <id>_back@1x.png           half size (2048-atlas fallback / reference)
  <id>_back_outline@2x.png   same with a dark outline (4 px; 2 px at 1x)
  <id>_back_outline@1x.png
  <id>_front@2x.png          600 px tall (@1x: 300)
  <id>_front@1x.png
  <id>_portrait.jpg          432×540 (4:5 crop from the top)
  <id>_portrait_sm.jpg       240×300
  <id>.anchors.json          anchor points (format below)
  <id>.layers.json           layer masks (format below)

screenshots/<id>/process/                  before/after + anchor/mask overlay previews
screenshots/<id>/                          test-range captures for review
```

---

## 2. Art requirements

**The in-game sprite** is the most important file.
- The mecha must fly **up** the screen and be mirror-symmetric where possible.
- Transparency:
  - Best: real transparency (remove the background by hand: remove.bg, or Photopea: Magic Wand → Delete).
  - A **pure black** background also works. The script cuts it out cleanly (Mira's JPEG).
  - A dark *coloured* background leaves speckle on dark armour.
- No baked glow. The game adds its own glow. If the art has dark warm shading (gold, orange), set `glowRule: false` in `tools/art.config.mjs`.

**The front view**
- Real transparency or a pure black background; both get the same automatic removal.
- The script zeroes the colour hidden under transparent pixels and snaps near-opaque alpha to 255.

**Portrait**
- Any size. Taller than 4:5 is cropped from the top.

**FX sheets**
- Never slice them; rebuild the effects in code.
- Black-background `fx_*.png` files could be used with additive blending, but none exist yet.

---

## 3. Steps

1. **Branch.** Work on `art/<id>-test`.
2. **Inspect the art.** Write `ASSET_NOTES.md` with the following, then stop for owner review:
   - each image's size, transparency and problems;
   - the facing direction;
   - anchor estimates in source pixels;
   - the layer split plan.
3. **Process.**
   - Add the pilot to `tools/art.config.mjs`: folder, file names, `glowRule`, and anchor estimates in source pixels.
   - If the portrait isn't a head-and-shoulders shot, set `portraitCrop: { left, top, width, height }` (a 4:5 box in portrait pixels).
   - If an enclosed gap in the art stays opaque (the edge fill can't reach it), add a seed pixel to `holes` (back view) or `frontHoles` (front view), as for Bruno's backpack frame.
   - If the "transparency" is a **painted checkerboard** (a JPEG or RGB PNG showing grey squares), set `bg: 'checker'`, as for Lin. Light neutral greys are filled from the edges, enclosed pockets holding both checker greys are found automatically, and the grey fringe next to the line art is removed.
   - If held weapons cross wings that should move, generate the layers with `wings` instead of writing them by hand (see section 6).
   - FX entries also take `tint` (`emerald` default, or `red`) and an optional crop `box`; an image with real alpha (Dax's `ultimate-fx.png`) is used as is.
   - Effect art the owner picks (glow painted over a checkerboard) goes in `tools/art-ref/<id>/` and `fx: { name: { file, height } }` → `<id>_fx_<name>.png`. It is un-blended: the checkerboard becomes transparent, glow becomes translucent and tinted, black and white stay solid. Small, frequent sprites go in the shared atlas; big ones go in `extras` (the pilot texture).
   - A turret or drone on a concept sheet can be cut out with `turret: { file, box, rotate, height }` → `<id>_turret.png`. It removes the checkerboard and a baked pale glow, and keeps only the largest piece.
   - Add an npm script (`"art:<id>": "node tools/process-art.mjs <id>"`) and run it.
   - Check `screenshots/<id>/process/*_before_after.png`. `--demo-bgremoval` exercises the fallback.
4. **Layer masks.**
   - Write `<id>.layers.json`; the format is below.
   - Re-run the script and check `screenshots/<id>/process/overlay.png`.
   - The masks should cover only the parts that move (wings, binders, arms holding weapons).
5. **Register the art** in `ART_MANIFEST` in `src/core/pilotArt.js`. Without this the game silently keeps the procedural ship.
6. **Hook up the pilot.**
   - Write `src/pilots/<id>Art.js` (see `miraArt.js`): `createMechaArt({ id, pal, defaults, flames, nozzles, exhaust, wingAnchors })` and `createMechaFx(art, { body, lanceLen })`.
   - In the pilot definition, set `art: <id>Art`, call `buildSprites` from `sprites()` and `animate` from `update()`, and wire the hooks (section 7).
   - Tag every shot's `shots.aux`: the tier for lances, `SHARD_TAG` for option shots.
   - Flak pilots (`SHOT_FLAK`) use `aux` as the burst radius, so they can't tag it. Draw them by frame instead and style the bursts with the `flakBurst(w, x, y, r)` hook (see `brunoFx.js`).
   - A pilot with no chest gun fires from its arm guns. Aim each shot so it crosses the old shot's path at about 170 units ahead (see `aimFrom` in `bruno.js`), then check DPS with `tools/dps.mjs <id>`.
7. **Test range.**
   - `?test=<id>` works for any pilot whose definition has `art` (`PilotArtTestScene`).
   - Use F9 to drag the anchors onto the art, then **COPY JSON** → paste into `<id>.anchors.json`.
   - Check every tier, focus, the special, banking, the ultimate cut-in, `&noart`, `&atlas=2048`, and the 1,500-bullet storm (`B`).
   - Capture screenshots to `screenshots/<id>/`, then stop for owner review.
8. **Wrap up.** Update `PROGRESS.md`. Merge only when the owner says so.

---

## 4. Processing script: `tools/process-art.mjs <id>`

The script uses `sharp`, a dev dependency.

| Flag | Effect |
|---|---|
| *(none)* | Process everything. Keeps an existing `<id>.anchors.json`. |
| `--reset-anchors` | Regenerate `<id>.anchors.json` from `SOURCE_ANCHORS`. This **overwrites** F9 corrections. |
| `--demo-bgremoval` | Bake the sprite onto a dark/red background, remove it, and save a before/after. |

What the script does to the back view, in order:
1. If it has no real alpha, flood-fill the background from the edges (and from any `holes` seeds). The fill stops at line-art contrast and, if `glowRule` is on, also removes dark red glow. The cut is then feathered by about 1.5 px.
2. Zero the colour under transparent pixels and snap alpha ≥ 250 to 255.
3. Trim to the alpha bounding box.
4. Resize to 360 / 180 px tall and add a 6 / 3 px border.
5. Make the outline variant: dilate the alpha and composite the art over #080a12.

The front view gets the same background removal when it has no alpha, then it is cleaned, trimmed and resized. The portrait gets a 4:5 crop from the top.

---

## 5. Anchor JSON: `<id>.anchors.json`

```json
{
  "version": 1,
  "pilot": "kairo",
  "space": "kairo_back@2x.png pixels, origin top-left (1x = half)",
  "image": { "w": 228, "h": 372, "artH": 360, "pad": 6 },
  "anchors": {
    "hitbox": [114, 193.5],
    "gunL": [98, 130.4],
    "gunR": [130, 130.4]
  }
}
```

The `anchors` block above is cut down; Kairo's real file has more entries (see the table below).

**Coordinate space.** Points are `[x, y]` in @2x image pixels, with the padding included.

**Fields**
- `image.w` and `image.h` are the size of the @2x file.
- `image.artH` is the art height without padding. In-game scale is `units per px = LOOK.size / artH`.
- `hitbox` is required. It is drawn exactly on `player.x/y`; the art is offset to put it there.
- Each other anchor becomes a world offset of `(anchor − hitbox) × units per px`.

**Kairo's anchors**

| Name | Use | Gameplay? |
|---|---|---|
| `hitbox` | chest centre, placed on `player.x/y` | visual placement only |
| `gunL/R` | chest gun muzzles either side of the central spike: main lance origins | **yes**: shot spawn points |
| `rifleL/R` | long rifle tips: tier-4 extra lance origins (move with the wing layers) | **yes** |
| `beam` | chest gun tip: focus-beam origin + charge orb | **yes** (beam start) |
| `packL/R` | wide back-thruster plumes + nozzle glow | no |
| `footL/R`, `calfL/R` | foot thruster flames + binder vents, exhaust | no |
| `head` | reference | no |

**Fallback copy.** Keep a built-in copy (`defaults` in `<id>Art.js`) in sync with the JSON. Gameplay anchors must not depend on whether the file loaded.

---

## 6. Layer-mask JSON: `<id>.layers.json`

```json
{
  "version": 1,
  "pilot": "kairo",
  "space": "kairo_back@2x.png pixels, origin top-left (same as kairo.anchors.json)",
  "feather": 3,
  "seam": 10,
  "layers": {
    "wingL": { "pivot": [74, 122.9], "poly": [[25.8, 2.9], [38.2, 23.9]] },
    "wingR": { "pivot": [165.6, 122.9], "poly": [[221.3, 23.9], [225, 54.9]] }
  }
}
```

The `poly` arrays above are cut down; real polygons have many more points. (Kairo now uses the rigged format below; the example shows the plain wing format the other pilots use.)

**Fields**
- `poly` is the outline of a moving layer, in @2x pixels. Draw it generously on the open side (transparent area costs nothing), and accurately where it meets the body.
- `pivot` is the point the layer rotates about (a shoulder or joint).
- `feather` is the mask blur in pixels.
- `seam` is how many pixels of fully opaque art the body keeps under each layer's edge. It must be at least the layer's largest outward slide. Kairo slides up to 8 px, so his seam is 10.

**The body layer** is everything not covered by a moving layer.
- It is computed per pixel as the exact alpha complement of the layers (`a(1−m)/(1−a·m)`), so body plus layers at rest equal the original. Kairo measures within 1.7/255.
- Fully opaque pixels in the seam band stay in the body, hidden at rest, so a layer can slide without opening a hole.

**Motion limits.** Keep slides ≤ the seam and rotations within ±0.05 rad. Anything bigger shows double edges.

**Generated layers for wings behind held weapons (`wings` in `art.config.mjs`, Lin).** In source pixels:
- `axis` is the mirror line.
- `wingL` is the left wing polygon; the right wing is its mirror. Take the polygon past the image edges wherever the wing touches them, or the seam band leaves static wing tips in the body.
- `pivotL` is the left wing root.
- `keep` lists polygons of held weapons.

The script then writes `<id>.layers.json` with:
- `under: true`: the wings are drawn under the body;
- `keep`: the body keeps those pixels whole.

It also writes `<id>_wings@2x.png` and `<id>_wings_outline@2x.png`: the sprite with the wing pixels hidden under a weapon taken from the mirrored wing, or filled from their neighbours where both sides are covered. `mechaArt` cuts the wing layers from these images when the art has `wings2x` / `wingsOutline2x` in `ART_MANIFEST`. Pilots without these keys are unchanged.

**Wing beat (`flap: true` in `createMechaArt`).** For mechas with real wings and no thrusters (Lin):
- The wing layers squash toward their pivot, like a butterfly seen from above, with a small rotation.
- The beat is slow and shallow at idle, faster and deeper when moving, and strongest flying up; the dash folds the wings.
- Large squashes are fine here, because the wings are under the body and their pivot sits at the root.
- `beatOf(p)` gives the current beat (0–1) for wing FX.

**Per-pilot textures.** A pilot's art never goes into the shared atlas, so any number of pilots can have art.
- The split (`splitLayers` in `art/mechaArt.js`) runs the first time the pilot is drawn (`ensureArt`).
- It produces the pilot's own small texture: 1024² (2048² if the art doesn't fit), plain and outline variants.
- Frames from that texture carry `frame.tex`. `SpriteBatch` switches textures automatically, adding about 2 extra draw calls per frame.
- The frames are appended to the renderer's frame list, so particles can use them (afterimages).
- The texture is re-uploaded after a WebGL context restore.
- With Kairo and Mira, the shared 4096 atlas stays at 81 %, the same as before any pilot art.
- On the 4096 atlas, Kairo takes about 7 % of the space.
- `main` already falls back to 0.85 texel scale on the 2048 atlas.

**Component mecha (`parts` in `art.config.mjs` → `rig: true`; Kairo v2, Mira v2).** For art whose parts move far: wings that fold away, cannons that recoil, articulated sections.
- **Config.** In source pixels, a mirror `axis` and a `list` of parts `{ name, poly, pivot, split?, exclude?, overlap? }` (left side). Optional `hole` and `grow` (@2x px).
  - `split: [a, b]` cuts a part in two along a line: `<name>Root<L|R>` holds the pivot; `<name>Tip<L|R>` gets an `overlap` tab (8 px) under the root.
  - `exclude` names parts drawn over this one; their pixels never go into it.
- **Split.** Each layer is its polygon grown by `hole + grow` px, soft-edged, minus `exclude`. The body loses each polygon grown by `hole` (+ the outline width in the outline variant). At rest the layers cover their holes exactly; moved anywhere, they leave no slivers. Draw polygons on the part's own outline; `hole` (3 for Kairo and Mira) absorbs small misses. A flat white background needs no `bg` setting: the default edge flood fill stops at the art's black outline (Mira).
- **Runtime.** `createMechaArt({ ..., rig })` with:
  - `order`: layer names back to front, including `'body'`;
  - `pose(p, name)` → `{ rot, tx, ty, s, ox, oy, alpha, hide }` (slide in the layer's frame, then rotate/scale about its pivot, then offset; @2x px);
  - `attach`: `{ anchor: layer }`. Attached anchors ride their layer: `animatedAnchor` and the hooks' `api.at()` give the posed world point.
  - `before(p, b, api, name)`: drawn just under a layer, using that layer's texture only (e.g. `api.drawLayer` halos);
  - `overlay(p, b, api)`: one pass of atlas FX over the finished mecha.
  - Keep atlas FX out of the per-layer hooks: every texture switch flushes the sprite batch. Interleaving dropped Kairo's tier-4 storm from 60 to about 22 FPS.
- The wing animation (`wingPose`, `flap`) doesn't apply to rigged pilots; the pilot's rig drives every pose.
- **Shared rig (`src/pilots/art/mechaRig.js`).** `createRig({ inner, outer, recoil, recover, breathe?, gunLift? })` gives:
  - the tier wing state machines (inner deploys at tier 3, outer at tier 4; deploy inner then outer, retract outer then inner; lock flashes and transition-wave timers);
  - cannon recoil and armour-flash timers;
  - the layer poses: blades swing about their pivot with an overshoot lock, and the tip telescopes; cannons recoil, sway and lag when banking.
- **Pilot-specific logic stays in the pilot's own `<pilot>Rig.js`** around `rig.step()`:
  - Kairo (`kairoRig.js`): the chest beam's charge, active and recovery states, which gate its damage.
  - Mira (`miraRig.js`): a visual focus cycle around her unchanged needle stream.
  - Each pilot keeps its rig state in its own `p.ps` key (`kr`, `mr`).

---

## 7. Runtime hooks (pilot definition)

All hooks are optional. A pilot without them runs the original code paths.

| Hook | Called from | Return |
|---|---|---|
| `renderShip(p, b, x, y, a)` | `Player.render` | `true` = drew the vehicle and engines; `false` = draw the procedural sprite |
| `exhaust(p, w)` | `Player._exhaust` | `true` = placed its own exhaust particles |
| `renderShots(p, b, alpha, shots)` | `World.renderMid` | replaces the generic player-shot renderer |
| `hitSpark(w, x, y, angle)` | `World._collide` | impact FX for this pilot's shots and its own beams |
| beam `.skin` | `World.beam()` result | set it and the generic beam renderer skips that beam; draw it yourself (e.g. in `renderBelow`) |
| `shotHit(w, i, enemy)` | `World._collide` | called when a non-piercing shot lands, before it is removed. Queue any new shots (the pool is being compacted), e.g. Lin's splitting spears |
| `renderOptions(p, b, alpha)` | `Player.render` | `true` = drew the options itself (e.g. Lin's drones from the art texture) |
| `renderUnder(p, b, alpha)` | `World.renderMid` | draws under the air enemies (e.g. Lin's starry void path) |
| `intangible(p)` | `Player.invulnerable` | `true` = every attack passes through (e.g. Dax's ghost focus) |
| `stageClear(p, w)` | `StageDirector` (tally) | the stage is cleared (e.g. Dax's Chaos Clones dissolve) |
| `dpsBossTargets` | `tools/dps.mjs` | the dummies count as bosses (for pilots that one-hit-kill normal enemies) |

**Extra images.**
- `createMechaArt({ extras: { name: imageKey } })` packs more images from the pilot's art into its own texture; `art.extra(name)` returns the frame, or `null` without art.
- Draw everything that uses the pilot's own texture together, not interleaved with atlas sprites. Every switch between the pilot texture and the atlas flushes the batch. Lin's turrets drawn glow / drone / glow per turret halved the storm frame rate; three passes fixed it.

**Art loading**
- Art loads before the atlas is built: `loadPilotArt()` runs in `src/main.js`, and `pilotArt(id)` returns the loaded art or `null`.
- `?noart` skips loading, to test the fallback.

**Elsewhere**
- `drawPortrait` uses the painted portrait automatically, wherever portraits are drawn.
- The select card shows the front view.
- The ultimate cut-in switches to the art layout: speed lines, front view behind, sliding portrait.

---

## 8. Effects

Effects are code-built and additive, and they feed the bloom.

**Palette.** Sample it from the pilot's FX sheet (`pal: { core, hot, mid, edge }` in `<id>Art.js`):
- Kairo: white-hot core → cyan → electric blue → violet edge.
- Mira: white-hot → yellow → amber-gold → orange edge. Keep body colours below the bloom's white clip so the hue survives.
- Lin: white → emerald → black. Additive light can't make black, so black parts (edges of spears, debris, smoke, roots, the rift) are drawn alpha-blended (`add = 0`) under the additive glow (`DARK` in `linArt.js`).

**Hit area = bright core.** Draw each shot's bright core exactly as wide as its hit radius (`2r`). The outer glow is extra and semi-transparent.

**Readability**
- Player shots are drawn under enemy bullets.
- Glow dims automatically as enemy bullets fill the screen (`crowdFactor`).
- New shots fade in over 2–3 steps so they don't white out the vehicle.

**Balance.** If shot origins move, aim each new shot at the point its old shot reached about 240 units ahead. Then confirm with:

```
node tools/dps.mjs <id>            # this checkout
node tools/dps.mjs <id> <path>     # another checkout, e.g. a `main` worktree
```

Boss, single-target and line DPS should stay within a few percent per tier.
