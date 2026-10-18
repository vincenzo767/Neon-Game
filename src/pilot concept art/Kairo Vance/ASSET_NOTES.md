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

## New in-game sprite: `top_down_main.png` (owner's request, after Step 7)

- **Image.** `top_down_main.png` (1024×1536, real alpha; max alpha 254 and hidden dark RGB, both cleaned by the script) replaces `Top-Down_Back.png` as the in-game sprite. It is the mecha flying feet-first: the twin forward barrels and the long rifles point up the screen. Trim box x 66, y 27, 891×1484.
- **Shots.** Shots now follow where the guns point.
  - Main lances (tiers 1–2) leave from the twin barrel tips (`gunL/R` ≈ (395, 38) / (627, 38)).
  - Tier-4 extras leave from the rifle tips (`rifleL/R` ≈ (92, 200) / (932, 200)).
  - The focus beam starts between the barrel tips (`beam` ≈ (511, 61)).
  - DPS is re-measured and unchanged.
- **Thrusters.** Wide blue back plumes come from under the skirt (`packL/R` ≈ (452, 1300) / (570, 1300)), with foot thrusters at the red-tipped feet (`footL/R` ≈ (390, 1290) / (632, 1290)) and small flames at the red binder vents (`calfL/R`).
- **Layers.** Each wing layer is a rifle, arm and binder (pivot at the shoulder, about (300, 960)). The body is the barrels, torso and head.
- **Anchor names.** The old `capL/R` and `wingL/R` anchors are gone. `Top-Down_Back.png` stays in the folder, unused.

**Correction (owner).** The twin structures at the top of `top_down_main.png` are the **feet**, and the feet never fire.
- Normal lances now leave from the **chest gun**: `gunL/R` ≈ (445, 540) / (577, 540), either side of the central spike. That is 8 units apart at size 90, the same spacing as the old twin lances, so wave-clear coverage is unchanged.
- The focus beam starts at its tip, `beam` ≈ (511, 518).
- The rifles still fire the tier-4 extras.

---

# Rebuild v2 (owner's brief, 2026-10-14): component mecha, tier wings, cannon and chest-beam VFX

Branch `art/kairo-v2`, made from `art/miguerre-test`, which holds every earlier art branch and the shared art code.

## Step 1: what the code does today and why it looks inconsistent

- **Sprite.** `top_down_main.png` (older art) is one image. `mechaArt.js` cuts it into a body plus one wing layer per side (rifle + arm + binder, pivot at the shoulder). The wing layers only flare or bank, and **every tier looks the same**: tiers only change the shots. The procedural `drawShip()` tiers are the only "tier art", and they're the fallback.
- **Weapons.**
  - Normal lances leave from a **chest gun** (`gunL/R`, 8 units apart). That anchor exists because the earlier art had no hand guns.
  - Tier-4 extras leave from the **rifle tips** (`rifleL/R`).
  - Tiers 3–4 add floating **option pods** (`k_pod`) that fire shard shots.
- **Focus.** `fire()` declares a continuous beam every step from the `beam` anchor (the chest gun tip). There's no charge or recovery: it simply appears and vanishes.
- **FX.** These come from the shared `mechaFx.js`: lance sprites, a muzzle flare, a beam and a charge orb, and hit sparks. There's no recoil, no barrel energy, no tier transition and no armour lighting.
- **Tier state** is `p.tier` (1–4, from the power value). It can go **down** as well as up: half a tier is lost on death, and the ultimate costs power. Transformations must therefore also run in reverse.
- **Renderer.** WebGL `SpriteBatch` (premultiplied; per-sprite alpha or additive), particle pools (`fxHigh`), a fixed-step update (60 Hz), post-processing bloom and shockwaves. Pilot art lives in its own texture (`mechaArt` layers and extras). Everything below uses this; no new renderer is involved.

## Step 1: the new art

| File | Size | Transparency | Use |
|---|---|---|---|
| `top-down-enhance.png` | 1362×1155 | **none**: painted checkerboard (RGB) → `bg: 'checker'` (as for Lin and Miguerre) | new in-game sprite |
| `Top-Down-front-new.png` | 1312×1199 | real alpha | new select-card front view and cut-in |

- **Facing (checked).** The top of the image is the front. The mecha flies **feet-first**, as with the old art: the twin red-tipped **feet** are at the top centre and must never fire. Both **hand cannons** point up, with their bores at the top. The **blue chest plate** sits mid-body, with the **head** below it (red V-fin, cyan eye at about (655, 720)). The backpack spikes trail at the bottom.
- **Symmetry.** The axis is x ≈ 655 (left bore 400, right bore 910). The feet are slightly offset (the left foot is longer); everything else mirrors.
- **Scale.** The art spans y 55–1135 (≈1080 px). At the standard 90 units tall that is **0.083 units/px**. With both wing arrays deployed, the full silhouette is ≈112 units wide; with the wings retracted it is ≈60. The **hitbox stays 2.4 at the chest**, independent of the wings.
- **Plan overlay:** `screenshots/kairo/v2/step1_plan_overlay.png`.

### Proposed component split (source px; the right side mirrors at x = 655)

| Component | Covers | Pivot / attachment | Motion |
|---|---|---|---|
| **body** | legs and feet, torso, chest plate, head, shoulder armour, gold/navy binder panels, lower fins, backpack spikes | — | hover bob, pitch, bank, stabilisation |
| **gunL/R** | cannon + fist + forearm (blue energy channel on the gun) | elbow ≈ (420, 615); grip ≈ (462, 410) | recoil along the barrel, recovery, sway; the channel and muzzle glow are live |
| **innerL/R** | the blade behind each cannon (tip ≈ (190, 168)) | root ≈ (370, 600) | **T3**: unfolds from behind the shoulder in 2 sections (root swings out, tip slides out), locks, flashes |
| **outerL/R** | the long outermost blade (tip ≈ (8, 300)) | root ≈ (300, 860) | **T4**: unfolds in 2 sections (rotate out, extend, lock) |

**Retracted** blades (tiers 1–2, and the outer blades at tier 3) fold down and back under the shoulder armour. They're telescoped short, so only their ends show behind the body: a compact, physical "base wing" look, not hidden pieces.

### Attachment points (all local to the sprite and moving with their component)

| Point | Where (source px) | Used for |
|---|---|---|
| `muzzleL/R` | (400, 338) / (910, 338) | cannon shots, muzzle flash, charge pulses (they follow recoil) |
| `gripL/R`, `elbowL/R` | (462, 410), (420, 615) / mirrored | hand grip and forearm pivot |
| `innerPivotL/R`, `outerPivotL/R` | (370, 600), (300, 860) / mirrored | wing pivots |
| `innerTipL/R`, `outerTipL/R` | (190, 168), (8, 300) / mirrored | wing-edge energy, locking flashes (and option shots: question 3) |
| `chest` | (655, 600), the blue chest core | **focus beam origin** and charge effects; also the hitbox |
| `thrL/R` | ≈ (612, 1000) / (698, 1000), at the backpack's base | thruster plumes and exhaust (refined with F9 in Step 3) |
| `footL/R` | (632, 64) / (687, 106) | reference only: **never fire** |

### State machine (centralised in `kairoRig.js`, all time-based at 60 Hz steps)

- **Tier configuration:** `T1 base` → `T2 enhanced` → `T3 inner deploying → inner locked` → `T4 outer deploying → full power`. The same steps run in reverse on a tier loss.
- **Cannons:** idle → charge pulse → fire (flash + recoil) → recovery. The left and right cannons are staggered.
- **Focus:** charging → beam active → recovery (collapse to the chest).
- **Data:** attachment coordinates, per-tier visibility and wing angles, timings and VFX intensity all go in one config table.

### Pipeline work this needs

- `process-art.mjs`: generalise the `wings` option to named, mirrored **parts** (gun, innerWing, outerWing, each with an optional 2-section split) so one config yields every layer mask.
- `mechaArt.js`: draw an ordered **component list** with per-component transforms supplied by the pilot's rig.
  - The other pilots keep using today's body + wing path, unchanged.
  - **Draw order:** outer wings → inner wings → body → cannons (hands over the guns, as painted).

## Step 1: questions for the owner (gameplay effects)

1. **Where normal shots come from.** The brief puts them on the hand cannons, which are **42 units apart**. Today's lances leave the chest gun 8 units apart.
   - **A (recommended).** Each cannon's shot angles slightly inward so it crosses its old lane about 170 units ahead (as Bruno's arm guns do). Coverage and DPS stay the same.
   - **B.** Straight parallel shots from each muzzle. That leaves a gap in the middle: point-blank enemies dead ahead can be missed.
   - **C.** Straight shots, plus wider lances to cover the gap (a DPS change).
2. **The focus beam's charge.** The brief asks for charge → beam → recovery.
   - **A (recommended).** A short 0.2 s charge from the chest before the beam deals damage, then a 0.15 s collapse on release (visual only). Tapping focus loses a sliver of DPS.
   - **B.** The beam deals damage immediately; the charge effect plays over its first 0.2 s. No gameplay change, but the beam shows during the charge.
   - **C.** Holding longer charges a stronger beam (a new mechanic).
3. **Tier 3–4 option pods** (the floating `k_pod`s that fire shard shots).
   - **A (recommended).** Replace them with emitters at the **inner wing tips (T3)** and **outer wing tips (T4)**: same shot count and damage, now attached to the wings. The lanes are wider than the pods' were.
   - **B.** Keep the floating pods as they are, alongside the new wings.
4. **Tier-4 extra lances** (from the rifles, which the new art doesn't have).
   - **A (recommended).** They fire from the two cannons, angled outward as before.
   - **B.** They fire from the outer wing tips.

Also planned:
- `Top-Down-front-new.png` replaces the select-card front view and cut-in. The portrait stays.
- The default size stays **90 units**.
- The special, bomb and ultimate are unchanged.
- Transformation sequences are visual only: about 0.6 s at tier 3 and 0.9 s at tier 4, with no invulnerability and no input lock.

## Decisions at the Step 1 checkpoint (approved by the owner): 1 A, 2 A, 3 A, 4 A

1. **Normal shots** leave the two hand-cannon muzzles, each aimed to cross its old lane, so coverage and damage are kept.
2. **Focus beam:** a 0.2 s chest charge before it deals damage, a sustained beam while held, and a collapse back into the chest on release.
3. **Option pods** are replaced by wing-tip emitters (inner tips at tier 3, inner and outer at tier 4), with the same shot count and damage.
4. **Tier-4 extras** fire from the cannons at their old outward angles.

## Steps 2–6: results

### Step 2: processing (`npm run art:kairo`)

- `top-down-enhance.png` is processed with `bg: 'checker'`: 19 enclosed checker pockets were removed. Trim box x 5, y 50, 1314×1093.
  - Exports: `kairo_back@2x.png` 445×372 (and @1x 222×186), with outline variants.
- `Top-Down-front-new.png` (real alpha) → `kairo_front@2x.png` 667×600: the new select card and cut-in. The portrait is unchanged.
- **New pipeline option `parts`** (`tools/process-art.mjs`): named, mirrored components with a pivot, an optional `split` line (two sections, the tip with an 8 px overlap tab under the root) and `exclude` (parts drawn over this one). It writes `kairo.layers.json` with `rig: true`.
  - The 10 layers: `gunL/R`, `innerRootL/R`, `innerTipL/R`, `outerRootL/R`, `outerTipL/R`.
- **Anchors** (`kairo.anchors.json`, regenerated with `--reset-anchors`):
  - `chest` = `hitbox` (the blue chest plate);
  - `muzzle`, `chan`, `grip` and `elbow` on each side;
  - `innerPivot`, `innerJoint` and `innerTip`; `outerPivot`, `outerJoint` and `outerTip`;
  - `thr`, `fin` and `foot` (reference only; the feet never fire).
  - The old `gun`, `rifle`, `beam`, `pack` and `calf` anchors are gone.

### Steps 3–5: the component mecha

- **Shared, opt-in (`art/mechaArt.js`).** A `rig` config switches a pilot to the component path; other pilots keep the old body + wing path.
  - **Split.** Each layer is its polygon grown by `hole` + `grow` px, soft-edged, minus `exclude`. The body loses each polygon grown by `hole` (+ the outline width in the outline variant). At rest the parts cover their holes exactly; moved or folded away, they leave no slivers behind.
  - **Render.** Layers draw in `rig.order`, each with a pose from `rig.pose(p, name)`: slide, rotation and scale about the pivot, plus an offset.
  - **Attachments.** `rig.attach` makes anchors ride a layer, so muzzles recoil and wing tips fold. `animatedAnchor` and `api.at()` return the posed world point.
  - **FX hooks.** `rig.before` (same texture as the layer: edge halos) and one `rig.overlay` pass (atlas FX). The overlay is one pass so the sprite batch isn't flushed between layers: this took the tier-4 storm from about 22 to 60 FPS headless.
- **`src/pilots/kairoRig.js`**: one config table (`RIG`) and the state machines, advanced once per 60 Hz step.
  - **Tier configuration.** Inner blades deploy at tier 3, outer blades at tier 4. They deploy inner then outer and retract outer then inner (tier loss).
    - Deploy takes 36 / 54 steps; retract takes 22 / 26.
    - Each blade's **root** swings about its pivot from the folded pose: −2.27 rad inner, −2.39 rad outer, out past the side and down, under the body. It eases out with a small overshoot that reads as the lock.
    - The **tip** section telescopes out of the root along the blade's axis (90 % of its length).
    - Deployed blades breathe slowly, flare outward in focus and lean when banking.
  - **Cannons.** Recoil of 6 / 7.5 / 8.5 / 10 @2x px back along the barrel (by tier), a small outward kick, smooth recovery, a slow stabilising sway, a lag when banking, and they part slightly while the chest fires.
  - **Focus beam:** off → **charge** (12 steps, no damage) → **active** (the World beam is re-declared each step: same width 5 + 2 × tier and damage 0.2 + 0.06 × tier as before) → **recover** (9 steps, collapse) → off.
  - **Hierarchy:** T1 base (both arrays folded), T2 enhanced cannons (folded), T3 inner deployed, T4 inner + outer deployed. The VFX intensity table scales the muzzle flash, channel glow, trails and aura per tier.
- **`src/pilots/kairoFx.js`**: every effect is attached to its component through the rig's posed anchors.
  - **Cannons.** The blue energy channel pulses (brighter per tier). A charge pulse climbs from the channel to the muzzle between shots and the muzzle core brightens. The discharge has a core flash, a flare, a ring and 2–3 angular energy blades fanning forward from each bore, and the hand, forearm and cannon flash cyan with the recoil.
  - **Projectiles.** The shared lances plus an animated tapered wake: blue → cyan, with flickering white sparkles. Impacts are the shared burst plus an angular flare.
  - **Wings.**
    - Energy conduits pulse from the root through the joint to the tip, with a flare at the tip.
    - A lock flash and ring at the pivot and joint mark each lock.
    - The edges glow while a blade is moving or locking.
    - **Deploying** brings sparks, motes along the blade and a shockwave.
    - **Tier 4** adds a screen flash, shake and expanding waves from the chest.
    - **At full power,** controlled arcs crawl between the wing joints.
  - **Chest beam** (drawn over the mecha so it visibly leaves the chest plate; the legs and feet sit above the chest in this flying pose):
    - **Charge:** the core brightens, two counter-rotating rings close in, four energy streams converge, arcs crackle, particles stream inward, and the torso lights up.
    - **Active:** an outer blue envelope, a violet band, a solid core exactly the hit width, a white-hot centre, two twisting filaments, distortion rings running up, and a flare and ring at the emitter. Sparks fly from the emitter.
    - **Recovery:** the beam's far end comes down into the chest as it thins, with a residual particle burst.
  - **Thrusters.** Blue plumes at `thrL/R` (capped), small fin-vent flames, and nozzle glow and exhaust.
- **Kit (`src/pilots/kairo.js`).**
  - **Lances** from `muzzleL/R`, aimed at their old lanes `REF` = 340 units ahead. At 170 the twin streams crossed and diverged, and dead-centre targets far ahead were missed.
  - **Wing-tip emitters** aimed at the old pods' lanes `POD_REF` = 170 ahead (the pods' close-range coverage is kept). `optionLayout` returns none and the `k_pod` sprite is gone.
  - **Focus beam** from `chest`. One muzzle discharge per cannon per volley.
  - Bio and weapon text updated. The special, bomb, ultimate, speed, hitbox (2.4) and size (90) are unchanged.

### Step 6: verified in the running game (test range, headless Chromium)

- **All four tiers at rest** (`t1_rest` … `t4_rest`, `sheet_tiers`). T1 and T2 have both arrays folded; T2 brighter cannons; T3 inner blades out; T4 the full silhouette.
- **Deployment frames.**
  - `deploy3_15`/`35`/`55`/`75`: the inner blade swings out sideways, rises, the tip extends, it locks.
  - `deploy4_20`/`45`/`70` and `lock4`: the same for the outer blades.
- **Live transitions.** T2 → T4 runs inner (36 steps) then outer (54 steps). T4 → T1 retracts outer then inner. Checked step by step.
- **Firing** (`fire_t2`, `fire_t4_0`): lances leave both cannon muzzles, and at tier 4 the wing tips fire too. Recoil: `rec0` versus `rec1`.
- **Focus cycle:** `charge3`, `charge9`, `active`, `recover3`, `recover7` (`sheet_focus`). The beam stays on the chest while moving.
- **DPS** (`tools/dps.mjs kairo`, before → after):

  | Mode | T1 | T2 | T3 | T4 |
  |---|---|---|---|---|
  | Shot (boss) | 29 → 29 | 50 → 50 | 67 → 67 | 103 → 103 |
  | Focus (boss) | 16 → 15 | 19 → 19 | 39 → 39 | 60 → 59 |

  Focus loses up to 1 DPS to the 0.2 s charge. The single-target sweep differs in places: the cannons sit 42 units apart instead of 8, so lanes widen slightly at close range.
- **Frame rate** (1,500-bullet storm, T4 firing): **59.5 FPS** with the art versus 60 procedural; 52 versus 52 with the focus beam; `&atlas=2048` 58.5.
- **Regressions.** Mira, Bruno, Tess, Oduya, Lin and Miguerre load their art with no console errors. `&noart` plays with the procedural Stormlance.

### Known limitations

- The head and shoulder armour are part of the body layer: they move with the torso (bob, bank), not independently.
- Folded blades sit under the body. Where the body doesn't cover them, their ends show at the lower sides (the intended "base wing" look).
- Recoil moves the cannons up to 2.5 units back along the barrel. The art under the barrel tops is background, so nothing is uncovered.
- The sounds are unchanged.

## Owner change after the Step 6 review: original shot pattern

- **Lances.** Back to the original pattern: straight shots at the original spacing (±4, ±10, ±16) and outward angles (0, 0.07, 0.16 rad), with no inward aim. They leave from chest level, never the feet. The discharge flash plays at each lance's origin; the cannons still recoil and glow.
- **Look.** The original glowing lance look (shared `mechaFx`); the extra trail layer is gone.
- **Wing tips (tiers 3–4).** They now fire glowing lances angled outward: inner tips 0.10 rad (0.04 in focus), outer tips 0.22 rad (0.10 in focus). Same shot count and damage as the old pods.
- **DPS, boss.**
  - Shot: T1 28, T2 50, T3 66, T4 85 (was 103: the outer-tip shots now spread outward instead of converging on the target).
  - Focus: T3 39, T4 42 (was 59).
  - Line DPS is unchanged.
- **Screenshot:** `screenshots/kairo/v2/fire_original_pattern.png`.

## Owner change: tier 1 from the chest, tier 2 from the held cannons

- **Tier 1.** The front lance pair (±4, straight) leaves the **chest emitter**, where the focus beam starts. A chest flash plays and the core pulses on each volley. The cannons stay still: no recoil, and their channel glow is low.
- **Tier 2.** The added pair (0.07 rad outward, straight) fires **from each hand cannon's bore**. The muzzle rides the recoiling cannon. Each shot brings recoil, a stronger discharge (flash ×1.5 at T2), the barrel lit along its length, a muzzle glow and the forearm flash.
- **Unchanged.** The chest pair continues at tier 2+. The tier-4 extras and the wing-tip shots are as before.
- **DPS, boss.** Unchanged: shot 28 / 50 / 66 / 85; focus 15 / 19 / 39 / 42.
- **Screenshots:** `screenshots/kairo/v2/fire_t1_t2_t4.png` and `fire_t1_chest_vs_t2_cannons.png`.
