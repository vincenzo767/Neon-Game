# Pilot Art Pipeline

How a pilot's procedural vehicle is replaced with hand-made art. Kairo Vance
(Stormlance) is the reference: `KAIRO_ART_TEST.md` was the brief, and
`src/pilot concept art/Kairo Vance/ASSET_NOTES.md` records his decisions.
Follow these steps for each of the other 16 pilots.

**Ground rules**
- Source art is read-only. Processed files go to `public/assets/pilots/<id>/`.
- The procedural sprite stays as the fallback. A pilot whose art fails to load plays exactly as before.
- Gameplay (hitbox, speed, damage, fire rate, abilities) doesn't change unless the owner approves it. Measure with `tools/dps.mjs` before and after.

---

## 1. Folder layout

```
src/pilot concept art/<Pilot Name>/        SOURCE (read-only)
  Top-Down_Back.png      in-game sprite: seen from behind/above, head at the top
  Top-Down_Front.png     select-card preview + cut-in (face visible)
  pilot_portrait.jpg     select card + cut-in portrait
  Parts Sheet.png        reference only
  FX Sprite Sheet.png    reference only (effects are rebuilt in code)
  ASSET_NOTES.md         written in step 3 below

tools/process-<id>.mjs                     processing script (copy of process-kairo.mjs)

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

**`Top-Down_Back.png`** is the most important file.
- The mecha must face **up** the screen (head at the top) and be mirror-symmetric where possible.
- It needs real transparency. Remove the background by hand (remove.bg, or Photopea: Magic Wand → Delete). The script's automatic fallback leaves speckle on dark armour.
- No baked glow. The game adds its own glow.

**`Top-Down_Front.png`**
- Real transparency.
- The script zeroes the colour hidden under transparent pixels and snaps near-opaque alpha to 255, so this file is fine with them.

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
   - Copy `tools/process-kairo.mjs` to `tools/process-<id>.mjs`.
   - Change `SRC`, `OUT`, `PREVIEW`, the output names, and `SOURCE_ANCHORS` (source-pixel estimates).
   - Add an npm script (`"art:<id>"`) and run it.
   - Check `screenshots/<id>/process/*_before_after.png`. `--demo-bgremoval` exercises the fallback.
4. **Layer masks.**
   - Write `<id>.layers.json`; the format is below.
   - Re-run the script and check `screenshots/<id>/process/overlay.png`.
   - The masks should cover only the parts that move (wings, binders, arms holding weapons).
5. **Register the art** in `ART_MANIFEST` in `src/core/pilotArt.js`.
6. **Hook up the pilot.** Copy `src/pilots/kairoArt.js` (sprite, layers, animation, thrusters) and `kairoFx.js` (weapon FX). Then wire the hooks (section 7) into the pilot definition.
7. **Test range.**
   - Copy `KairoTestScene` and add a `?test=<id>` route in `src/main.js`.
   - Use F9 to drag the anchors onto the art, then **COPY JSON** → paste into `<id>.anchors.json`.
   - Check every tier, focus, the special, banking, the ultimate cut-in, `&noart`, `&atlas=2048`, and the 1,500-bullet storm (`B`).
   - Capture screenshots to `screenshots/<id>/`, then stop for owner review.
8. **Wrap up.** Update `PROGRESS.md`. Merge only when the owner says so.

---

## 4. Processing script: `tools/process-<id>.mjs`

The script uses `sharp`, a dev dependency.

| Flag | Effect |
|---|---|
| *(none)* | Process everything. Keeps an existing `<id>.anchors.json`. |
| `--reset-anchors` | Regenerate `<id>.anchors.json` from `SOURCE_ANCHORS`. This **overwrites** F9 corrections. |
| `--demo-bgremoval` | Bake the sprite onto a dark/red background, remove it, and save a before/after. |

What the script does to the back view, in order:
1. If it has no real alpha, flood-fill the background from the edges. The fill stops at line-art contrast and also removes dark red glow. The cut is then feathered by about 1.5 px.
2. Zero the colour under transparent pixels and snap alpha ≥ 250 to 255.
3. Trim to the alpha bounding box.
4. Resize to 360 / 180 px tall and add a 6 / 3 px border.
5. Make the outline variant: dilate the alpha and composite the art over #080a12.

The front view is cleaned, trimmed and resized. The portrait gets a 4:5 crop from the top.

---

## 5. Anchor JSON: `<id>.anchors.json`

```json
{
  "version": 1,
  "pilot": "kairo",
  "space": "kairo_back@2x.png pixels, origin top-left (1x = half)",
  "image": { "w": 240, "h": 372, "artH": 360, "pad": 6 },
  "anchors": {
    "hitbox": [119.8, 135.3],
    "rifleL": [32, 150.7],
    "rifleR": [207.6, 150.7]
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
| `hitbox` | torso centre, placed on `player.x/y` | visual placement only |
| `rifleL/R` | lance origins | **yes**: shot spawn points |
| `wingL/R` | tier-4 extra lance origins | **yes** |
| `capL/R` | focus-beam origin (midpoint) + charge-orb feeders | **yes** (beam start) |
| `packL/R` | wide back-thruster plumes + nozzle glow | no |
| `footL/R`, `calfL/R` | leg thruster flames, exhaust | no |
| `head` | reference | no |

**Fallback copy.** Keep a built-in copy (`DEFAULT_ANCHORS` in `kairoArt.js`) in sync with the JSON. Gameplay anchors must not depend on whether the file loaded.

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

The `poly` arrays above are cut down; real polygons have many more points.

**Fields**
- `poly` is the outline of a moving layer, in @2x pixels. Draw it generously on the open side (transparent area costs nothing), and accurately where it meets the body.
- `pivot` is the point the layer rotates about (a shoulder or joint).
- `feather` is the mask blur in pixels.
- `seam` is how many pixels of fully opaque art the body keeps under each layer's edge. It must be at least the layer's largest outward slide. Kairo slides up to 8 px, so his seam is 10.

**The body layer** is everything not covered by a moving layer.
- It is computed per pixel as the exact alpha complement of the layers (`a(1−m)/(1−a·m)`), so body plus layers at rest equal the original. Kairo measures within 1.7/255.
- Fully opaque pixels in the seam band stay in the body, hidden at rest, so a layer can slide without opening a hole.

**Motion limits.** Keep slides ≤ the seam and rotations within ±0.05 rad. Anything bigger shows double edges.

**Atlas cost.** The split runs at atlas-build time (`splitLayers` in `kairoArt.js`). Each pilot adds one full frame plus a body and one per layer, for both plain and outline variants.
- On the 4096 atlas, Kairo takes about 7 % of the space.
- `main` already falls back to 0.85 texel scale on the 2048 atlas.

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

**Palette.** Sample it from the pilot's FX sheet. Kairo's is white-hot core → cyan → electric blue → violet edge (`PAL` in `kairoArt.js`). Keep body colours below the bloom's white clip so the hue survives.

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
