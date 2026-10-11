# Kairo Vance — Asset Notes (Step 1)

Source folder: `src/pilot concept art/Kairo Vance/` (treated as read-only, like
`assets_source/` in the brief). Measured with `sharp`; coordinates are source
pixels, origin top-left.

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `Top-Down_Back.png` | 408×612 PNG RGBA | **Yes** (background already removed) | Mecha from behind/above, head at top. Two wing-binders with long black blades, a backpack with two red-capped booster pods, the head's V-fin, and two legs with red-glowing calf and foot vents. | Edge pixels are dark (average RGB 41,32,41). That reads as the art's own black linework, so it's fine. No red background glow is left. The trimmed bounding box is 369×582 (x 20–388, y 11–592). The art is mirror-symmetric about x ≈ 204. |
| `Top-Down_Front.png` | 1024×1536 PNG RGBA | **Yes**, with two catches | Same mecha from the front. Face visible, rifles held pointing down. | (1) The fully transparent pixels still hold the old dark/red background in RGB (average 29,24,28). It looks fine on magenta, but filtering or mipmapping will bleed dark halos unless those pixels are zeroed. (2) Max alpha is 254, never 255, so the "opaque" body is 0.4 % see-through; clamp ≥ 250 → 255. There's also a small translucent capsule left of the head (≈ 438, 324), which may be stray. |
| `pilot_portrait.jpg` | 433×650 JPEG | No | Kairo head and shoulders: dark navy-teal spiky hair, brown eyes, blue high-collar jacket with a teal inner suit. | Low resolution and 2:3 aspect. The select/cut-in canvases are 240×300 (4:5), so it needs a crop to 433×541 (keep the top). The flat mint background (203,221,209) clashes with the neon UI. I'd mask or tint it toward the pilot's blue. The procedural portrait gives Kairo a **visor + earpiece**; the art has neither. |
| `Parts Sheet.png` | 1672×941 PNG RGBA | Yes | Front, back, two side views, a top-down view, plus loose parts (rifles, wing blades, head, torso, limbs, hands). | Reference only, per the brief. Red/magenta colour fringing around many parts. |
| `FX Sprite Sheet.png` | 1672×941 PNG RGB | **No**. The checkerboard is painted in and there are baked text labels | Rows: firing animation, rifle shot effects (top-down), burst/charged shot, area/spread shot, thruster states, thruster variations, movement trails. | Reference only. Note: the mecha drawn on this sheet is a **jet-like top-down variant with blue thrusters**, not the red-vented back view. |
| `mecha.png` ⚠ | 447×558 PNG RGBA | Yes | 3/4 standing pose, line-art style, same white/black/red scheme. | **Not in the brief's file list.** Its style matches the published Hobby Japan concept that A1 says not to add, possibly with the watermark/background removed. **I will not use it.** Please confirm and remove it yourself if it is the HJ image. |

## Facing

`Top-Down_Back.png` faces **up** (head and V-fin at the top, feet at the bottom),
which matches flying up the screen. No rotation needed.

## Anchor estimates (`Top-Down_Back.png` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Rifle tips (actual)** | (27, 510) | (385, 512) | ⚠ The rifles point **down and out (rearward)**, not forward. |
| **Wing-binder blade tips** (forward-most points) | (56, 13) | (352, 13) | Forward-most weapon-like points, but 296 px apart (80 % of the width). |
| **Backpack booster caps** (proposed muzzles) | (155, 92) | (250, 92) | Red-capped pods at the top of the backpack, ±48 px from centre. **Recommended muzzles**, see below. |
| **Foot thrusters** (red nozzles) | (155, 533) | (253, 533) | Flame emits downward from here (foot tips at y ≈ 590). |
| **Calf vents** (secondary) | (152, 425) | (252, 425) | Small red vents, can take a small flame. |
| **Backpack nozzles** (lower pod ends) | (155, 255) | (250, 255) | Optional small flames. |
| **Hitbox centre** (torso) | (204, 220) | — | Between the shoulders, below the head. |
| **Head** | (204, 110) | — | For reference (cut-in, focus FX). |

**Muzzle decision.** Rule 2 forbids gameplay changes, and shot **spawn offsets
are gameplay**: shots collide from where they spawn. Today the lances spawn
at (±4, −20) world units, and from (±10, −10) and (±16, −4) for tiers 2 and 4.
So:

- Real shots keep their current offsets.
- Muzzle anchors are **visual only**: flash position and the start of each lance's glow.
- Visual muzzles therefore have to sit close to the real spawn points, or the lance will visibly start somewhere it isn't. The backpack caps fit best.
- The wing tips are too wide for tier 1, but work for tier-4 flourishes.
- The real rifle tips point backward and can't be used.

## Scale: needs your decision ⚠

The brief asks for exports of **~180 px tall at 1×** and **~360 px tall at 2×**. I read
those as **texture resolutions**, not on-screen size. The in-game size is a
separate choice, made in world units (the field is 480×640):

- The current Stormlance is **44×52 world units**. Its hitbox radius is 2.4 and does not change.
- 180 world units tall would fill 28 % of the field height, far too big for a bullet-hell game.
- **Proposal:** draw the mecha **~68 units tall × 43 wide**. That's about the current footprint, a bit taller, and about 115 px tall on a 1080p screen.
- Sample the 2× texture (360 px) on the 4096 atlas and the 1× texture on the 2048 fallback.
- The Step 3 readability check will confirm or adjust this.

Because the hitbox anchor (torso) sits above the image centre, the sprite will be
drawn **offset** so the torso lands on `player.x/y`. That is a visual offset only.

## Layer split plan (Step 3)

The masks will be three feathered polygons stored in
`public/assets/pilots/kairo/kairo.layers.json`, in source-pixel coordinates.
Feathering is a 3 px Gaussian on the mask edge.

1. **Left wing-binder + rifle.** Polygon around the outer assembly:
   - blade tip (56,13) → outer edge down to the rifle tip (20,515);
   - back up along the rifle's inner edge (≈ 80,500 → 105,330);
   - then the binder's inner edge at the shoulder joint (≈ 120,250 → 135,110) → back to the tip.
   - The pivot for the flare/fold motion is the shoulder joint, about (130, 200).
2. **Right wing-binder + rifle.** Mirror of the left about x = 204.
3. **Body.** Head, backpack, torso, legs: everything else.
   - The body layer **keeps the original pixels under the wing seam**, about 6 px past the mask edge. When a wing shifts outward, the body shows its own art there instead of a hole.
   - At rest the wings sit on top, so the assembled sprite matches the original exactly.

**Limits.** There's no inpainting, so wing offsets must stay small: about 4 px
outward, 3 px inward, ±2.5° rotation, measured in source pixels. Larger offsets
would show double edges at the shoulder. If seams are visible at rest or in
motion, I'll fall back to the single sprite and tell you (as the brief asks).
The rifles are joined to the binders here, so they move with the wings, which
matches the brief's "wing-binder with rifle".

## Other notes

- **Thruster colour.** The back view's vents glow **red**, but the brief and FX sheet want **blue** flames. Plan: keep the red vents as painted, and add the blue teardrop flames below the feet.
- **Location.** The art lives in `src/pilot concept art/Kairo Vance/`, not `assets_source/pilots/kairo/` (A1). Vite doesn't serve `src/` files by URL, so processed output goes to `public/assets/pilots/kairo/`. The source folder will be read-only.
- **Load order.** The game builds its single texture atlas once at start-up, synchronously, in `Renderer`. So the Kairo images must be **preloaded before `Game` is created** (async boot in `main.js`), then drawn into the atlas like any other sprite. If loading fails, the procedural `ship_kairo_1..4` frames are used as they are today.

## Decisions after the Step 1 checkpoint (approved by the owner)

1. **Muzzles (approved gameplay change).** Real shots now start at the rifles. The muzzle is the rifle's **forward end**, about (62, 245) / (346, 245); the painted tips point backward.
   - Lances angle slightly inward so they cover about the same area in front of Kairo as before.
   - Total DPS stays the same; it's measured before and after.
   - The focus rail beam starts at the red backpack caps.
   - The wing tips are used only for the tier-4 extra shots.
2. **Size.** Start at **68 units tall**. A test-range key cycles 68 / 80 / 90. The hitbox stays the same at every size. Anchor-based shot origins scale with the sprite.
3. **Thrusters.** Keep the painted red vents and add blue flames below them.
4. **Shots.** Thick and glowing, matching the "Rifle shot effects" and "Burst / Charged shot" rows.
   - Lances: about 3× the current width, a white-hot core in a cyan/blue glow, a diamond tip and a long tail. Each tier is bigger and brighter. Tier 4 is near-beam with ring pulses.
   - Focus beam: wide, with a pulsing core, rings and a big charge orb.
   - Muzzle flash: 2× the current size.
   - Hit sparks: bigger, with an impact flash.
   - The hit area matches the bright core, not the glow.
   - The outer glow is semi-transparent and dims automatically when the screen is crowded.
   - Test-range sliders for shot width and glow strength.

## Step 2 output

`npm run art:kairo` (= `node tools/process-kairo.mjs`) writes to `public/assets/pilots/kairo/`. Previews go to `screenshots/kairo/process/`.

- **Back sprite.** `Top-Down_Back.png` already had alpha, so background removal was skipped. The script still zeroes hidden RGB and snaps near-opaque alpha. The trim box is x 20, y 11, 368×582.
  - Exports: `kairo_back@2x.png` (240×372: 360 px of art plus 6 px padding) and `@1x` (120×186).
  - `_outline` variants have a 4 px / 2 px dark outline.
- **Background-removal fallback.** For future pilots whose art has no alpha, the script flood-fills from the image edges. The fill stops at line-art contrast, and it also removes dark red glow.
  - Tested on a synthetic dark/red-glow copy: see `bgremoval_demo.png`. It works, with some speckle on the darkest gunmetal edges.
  - **Removing the background by hand is still the better result.**
- **Front view.** Hidden RGB zeroed, then trimmed. `kairo_front@2x.png` is 360×600; `@1x` is 180×300.
- **Portrait.** A 4:5 crop from the top: `kairo_portrait.jpg` (432×540) and `kairo_portrait_sm.jpg` (240×300).
- **Anchors.** `kairo.anchors.json` uses @2x pixels. The script only rewrites it with `--reset-anchors`, so corrections pasted from the F9 editor survive re-processing.

## Decisions at the Step 6 checkpoint (approved by the owner)

- **Back thrusters.** Wide blue plumes and nozzle glow come from the backpack nozzles (`packL/R`), in addition to the foot and calf flames.
- **Size.** The default is **90 units tall** (`LOOK.size`). The test range still cycles 90 / 68 / 80. Anchor-based shot origins scale with size; DPS was re-measured at 90 and is unchanged.
