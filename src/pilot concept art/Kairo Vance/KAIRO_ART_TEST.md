# KAIRO ART TEST — Vertical Slice Integration

**Part A is for you (the human). Part B is for Claude Code.**

---

## Part A — Prepare the files (about 10 minutes)

### A1. Put the images in this folder with these exact names

Create `assets_source/pilots/kairo/` in the project root and save:

| Your image | Save as | Used for |
|------------|---------|----------|
| Top-down **back** view (head at top, red-glowing feet thrusters at bottom, dark background) | `sprite_back.png` | **The in-game sprite** (the player flies up, so the camera sees the back) |
| Top-down **front** view (face visible, already transparent) | `sprite_front.png` | Select-screen preview and ultimate cut-in |
| Pilot portrait | `portrait.jpg` | Select screen and cut-in |
| Parts sheet | `parts_sheet.png` | Reference only (see A3) |
| FX sheet | `fx_reference.png` | Reference only (see A3) |

**Do not add** the white concept image with the "HJ web" watermark. It is a published design from Hobby Japan, not your art.

### A2. Fix the one image that needs it

`sprite_back.png` has **no transparency**. The dark background and red glow are baked into the pixels. This is the most important image, so the cleaner its edges, the better the game looks.

- **Best:** remove the background yourself with remove.bg or Photopea (Magic Wand on the background → Delete → Export PNG). Keep the name `sprite_back.png`.
- **Fallback:** leave it as-is. Claude Code will try to remove it with a script and show you the result.

### A3. What can't be used directly (and how Claude Code handles it)

- **FX sheet:** the gray checkerboard is painted into the image (it's not real transparency), and it has text labels baked in. Cutting bullets out of it would leave dirty edges. Claude Code will **recreate these effects in code**, matching your sheet's colors and shapes. That also makes them sharper, animated, and scalable.
  *Optional upgrade:* regenerate the FX on a **pure black background with no text**. Black-background effects can be used directly, because additive blending makes black invisible. Save them as `fx_*.png`.
- **Parts sheet:** the parts are drawn from the **front**, but the game shows the **back from above**, so they won't fit the in-game sprite. Claude Code will instead slice the in-game sprite itself into movable layers (wings, body).

### A4. Hand it over

Put this file in the project root and tell Claude Code:

> **Read KAIRO_ART_TEST.md and follow Part B. Stop at each checkpoint.**

---

## Part B — Instructions for Claude Code

### Context

The game is at **M7c** with all gameplay complete. This is a **vertical-slice art test**: replace the procedural visuals of **one pilot, Kairo Vance (Stormlance)**, with the hand-made art in `assets_source/pilots/kairo/`. The goal is to prove the art pipeline before the other 16 pilots get art.

### Hard rules

1. Work on a new git branch: `art/kairo-test`. Do not touch `main`.
2. **No gameplay changes.** Kairo's hitbox, speed, damage, fire rate, ability, bomb, and ultimate logic stay exactly the same. Only how they *look* changes.
3. **Do not touch any other pilot**, enemy, boss, or stage.
4. **Never modify files in `assets_source/`.** Write processed output to the project's served asset folder (for Vite: `public/assets/pilots/kairo/`).
5. Keep Kairo's current procedural drawing as a **fallback** that is used automatically if an image fails to load.
6. Commit after each step. Update `PROGRESS.md` at the end.

### Step 0 — Inspect the code

Find where Kairo (and players in general) are drawn, where his shots, thrusters, and effects are drawn, and whether an image/texture loader already exists. Write a short summary of what you'll change, file by file.

### Step 1 — Inspect the art · ✋ CHECKPOINT

Open and view **every image** in `assets_source/pilots/kairo/`. Write `assets_source/pilots/kairo/ASSET_NOTES.md` with:

- For each image: what it shows, pixel size, whether it has real transparency, and any problems.
- Which way the mecha faces in `sprite_back.png` (expected: head at top = flying up).
- Your estimate of these **anchor points** in `sprite_back.png` pixel coordinates:
  - **Muzzles:** the forward tips of the two long black rifles (or the forward-most weapon points if the rifles don't face forward)
  - **Thrusters:** the two red-glowing foot nozzles at the bottom, plus any backpack nozzles
  - **Hitbox center:** the center of the torso
- How you'll split it into layers (Step 3).

**Stop and show me the notes before continuing.**

### Step 2 — Process the sprite

Write a repeatable script, `tools/process-kairo.mjs` (use `sharp`) or a Python equivalent:

1. If `sprite_back.png` has no transparency, remove the dark background: flood-fill from the image edges with a color tolerance, then feather the edge by 1–2px. Also remove the baked red background glow; the game adds its own glow. Show me a before/after preview.
2. Trim empty space.
3. Export at **2×** (about 360px tall) and **1×** (about 180px tall), keeping the aspect ratio.
4. Add an optional 2px dark outline variant so the white armor stays readable over bright backgrounds.
5. Process `sprite_front.png` and `portrait.jpg` to the sizes the select screen and cut-in need.
6. Save the anchor points from Step 1 to `public/assets/pilots/kairo/kairo.anchors.json`, scaled to the exported size.

### Step 3 — In-game sprite and animation

Replace Kairo's drawing with the sprite. All motion is code-driven:

- **Layer split:** cut the sprite into 3 layers with feathered masks: **body** (head, torso, legs), **left wing-binder with rifle**, **right wing-binder with rifle**. Mask shapes go in a JSON file so they can be adjusted. At rest, the assembled layers must look identical to the original. If seams show, fall back to the single sprite and tell me.
- **Banking:** when moving left/right, tilt up to about 8° and squash horizontally slightly; the far wing shifts inward and the near wing outward.
- **Idle:** a gentle bob of 1–2px and a subtle wing breathing motion.
- **Focus mode:** wings flare outward a few pixels; show the hitbox as a small glowing dot at the hitbox anchor.
- **Phase-dash:** wings fold in, and 3–4 fading blue afterimages trail behind.
- **Damage flash:** keep the existing hit/respawn blink behavior.
- **Readability check:** view the sprite at actual game size. If the detail turns to mush, suggest a size between 180–220px tall. **The hitbox stays the same size regardless.**

### Step 4 — Effects (recreated in code from `fx_reference.png`)

**Do not slice `fx_reference.png`.** It has a painted checkerboard and text labels. Use it as a **visual reference** and rebuild each effect with sprites generated at runtime, shaders, and particles. If `fx_*.png` files on pure black exist, use those with additive blending instead.

**Palette** (sample exact values from the sheet): white-hot core → cyan → electric blue → faint violet edge. All player FX use additive blending and feed the existing bloom.

| Game element | Match this row of the FX sheet | Details |
|--------------|-------------------------------|---------|
| **Main shot**, power tiers 1–4 | "Rifle shot effects" | Diamond-tipped energy lances with glowing tails, fired from the muzzle anchors. Tier 1: 2 lances. Tier 2: 4. Tier 3: 4 plus side spread shards. Tier 4: thicker lances with small ring pulses. Keep the existing damage and fire rate. |
| **Focused shot** (rail laser) | "Burst / Charged shot" | Continuous piercing beam with ring pulses traveling up it, and a charge orb with crosshair rings at the muzzle. |
| **Spread shards** (tier 3+) | "Area / Spread shot" | Small diamond shards in a fan. |
| **Thrusters** | "Thruster effect variations" | Teardrop flame (white core → cyan → blue) with flicker at the thruster anchors. Size by state: idle = small, moving = medium, moving up = large, dash = long boost. |
| **Phase-dash trail** | "Movement trails" (Dash) | Curved ribbon trail plus afterimages. |
| **Muzzle flash** | — | Small 2–3 frame blue flare at each muzzle on every shot. |
| **Hit sparks** | — | Blue-white sparks where Kairo's shots hit enemies. |

**Readability rule (from the main prompt):** player shots must never hide enemy bullets. Keep them semi-transparent cool colors, and lower their opacity when the screen is crowded.

### Step 5 — Select screen and cut-in

- **Select card:** `portrait.jpg` as the portrait, `sprite_front.png` as the vehicle preview (slow bob, thruster glow).
- **Ultimate cut-in:** portrait slides in from the side, `sprite_front.png` behind it, blue speed lines, then cut back to gameplay.
- **Update Kairo's data:** palette is white, gunmetal black, and red armor with blue energy effects. Describe the Stormlance as a **mecha** instead of a ship.

### Step 6 — Test range · ✋ CHECKPOINT

Add a test mode that opens with `?test=kairo` (or a debug menu option):

- Starts a stage with Kairo, with an invincibility toggle.
- Keys **1–4** set the power tier; one key spawns dummy enemies; one key fires a test bullet storm.
- **F9** toggles a debug overlay showing anchor points, the hitbox, and layer outlines. In debug mode, anchors can be **dragged**, with a **Copy JSON** button so I can paste corrected values into `kairo.anchors.json`.
- FPS counter. Confirm 60 FPS holds with 1,500 enemy bullets on screen.

If Playwright is available, capture screenshots to `screenshots/kairo/`: select screen, idle, banking left, banking right, each power tier, focus beam, dash, ultimate cut-in, and the debug overlay. Then **stop and show me** with a short list of anything that didn't match the art.

### Step 7 — Wrap up

When I approve the result:

1. Document the asset pipeline in `ART_PIPELINE.md` (folder layout, file names, processing script, anchor JSON format, layer-mask JSON format) so the other 16 pilots can follow the same steps.
2. Update `PROGRESS.md`.
3. Leave the branch unmerged until I say so.
