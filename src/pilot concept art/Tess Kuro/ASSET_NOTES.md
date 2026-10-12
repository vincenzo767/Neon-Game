# Tess Kuro — Asset Notes (Step 1)

Pilot: **Tess Kuro**, vehicle **WIREGHOST**. Built the same way as Kairo, Mira
and Bruno (see `ART_PIPELINE.md` and their `ASSET_NOTES.md`). The source
folder is read-only. Coordinates are source pixels, origin top-left. Branch:
`art/tess-test` (based on `art/bruno-test`, which has the latest art pipeline
and Bruno's explosion FX).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down_main.jpg` | 1024×1536 JPEG | **No**: solid black background | **In-game sprite.** Same layout as the other three: the mecha flies feet-first. From top to bottom: the two long **leg blades** (feet at the top, tips at y ≈ 100), the two **forearm blades** on the outside (tips at y ≈ 310), the clawed hands, the waist piece with a red tip, the hip joints, the torso with red chevrons, the head, and the shoulder armour with long spikes sweeping back. Violet / lilac armour with red light lines. Mirror-symmetric about x ≈ 512. | Needs background removal (black border 0–2, easy flood fill). The red-glow rule should be **off**: the art has thin red light lines it would eat. Bounding box: x 11, y 96, 1002×1420. |
| `top-down_front.jpg` | 1024×1536 JPEG | **No**: solid black background | Front view, upright: horned head, arm blades held down, leg blades. Select-card preview and cut-in. | Same background removal. Bounding box: x 14, y 22, 996×1416. |
| `pilot_portrait.jpg` | 720×960 JPEG | No | Head and shoulders: a man with a black bandana, green hair at the side, three gold earrings, a scar over the closed left eye, open black coat. | White background. Already 3:4, so the 4:5 crop is 720×900 from the top. **See question 4** (the portrait and the bio don't match). |
| `parts_sheet.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Front, side, back and three-quarter views; a fighter mode with pink thrusters; heads, blades, hands, armour plates. | Reference only. |
| `fx_reference.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Energy darts with rings, rockets with smoke, **crescent slash arcs and spirals**, slash streaks with smoke, spike bursts, thruster plumes. Violet / magenta with red and white cores. | Reference only (rebuilt in code, as for the others). |

## Facing

`top-down_main.jpg` flies **up** feet-first, the same as the others. **The leg
blades at the top are her feet: they never fire.** No rotation needed.

## Anchor estimates (`top-down_main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest centre) | (512, 960) | — | Lands on `player.x/y`. |
| **Arm blade** (`bladeL/R`) | (105, 600) | (919, 600) | Middle of each forearm blade. **Proposed crescent origin.** |
| Arm-blade tips | (15, 310) | (1009, 310) | Reference only (forward-most points). |
| Hands | (200, 900) | (824, 900) | Reference. |
| **Shoulder vents** (`ventL/R`) | (285, 1230) | (739, 1230) | Rear of the shoulder armour: wide back plumes. |
| **Centre exhaust** (`packL/R`) | (480, 1215) | (544, 1215) | Either side of the head's rear spike: smaller plumes. |
| Head | (512, 1080) | — | Reference. |
| Leg-blade tips (feet) | (130, 100) | (894, 100) | **Never fire.** |

**Scale.** At 90 units tall, 1 source pixel is about 0.063 units.
- Arm-blade middles: 26 units out from the centre, 23 units ahead of the hitbox.
- Arm-blade tips: 32 units out, 41 ahead.
- Like Bruno, Tess has **no chest gun**, and she has **no guns at all**: her weapons are blades.

## Tess's weapons today (gameplay stays as is unless you approve a change)

- **Main: Wire Blades.** Every 6 steps, a fan of tier + 1 piercing crescents (2, 3, 4, 5), 0.45 rad wide, from 16 units ahead of the centre. They slow down and vanish after 22 steps: short range (about 150 units).
- **Focus: Ghost Slash.** Every 8 steps, a melee arc 34 units ahead (radius 36–54 by tier) that damages enemies and cuts enemy bullets, plus one short crescent.
- **No option drones.**
- **Special:** Cloak (she turns see-through, enemies aim at a decoy). **Bomb:** Thousand Cuts (screen-wide slash lines). **Ultimate:** Shadow Clones (four copies that fire with her).

## Already decided by the owner

- **Colour:** violet outside, orange inside for every shot, slash, muzzle flash, hit and explosion, following the FX sheet. Her UI colour is already violet.
- **Size:** 90 units tall. The hitbox stays 2.2.
- **No feet fire.**

## Proposed mapping (needs your decision)

1. **Wire Blades origin.**
   - **A (recommended): thrown from the two arm blades.** The left half of the fan leaves the left blade and the right half the right blade; the middle crescent of an odd count alternates sides. Each crescent crosses its old path 90 units ahead (within her short range) at the same moment, so damage and reach stay about the same. Checked with `tools/dps.mjs`, as for the others.
   - **B:** all crescents from one point between the arms, as today (the art shows no weapon there).
2. **Ghost Slash look.** Same hit area and damage. The arc is drawn as an FX-sheet crescent swept by one arm blade, alternating left and right each slash (it already alternates direction). The small crescent leaves the swinging blade.
3. **Shadow Clones and the Cloak decoy.** Today they are drawn with the old procedural ship. **Recommended:** draw them with the mecha art as violet afterimages.
4. **Portrait vs bio.** The painted portrait shows a man; the bio and the in-game text call Tess "she", and the fallback portrait is a woman with a bob and a mask.
   - **A:** keep the bio as it is and use the painting as given.
   - **B:** rewrite the bio for a male pilot, and match the fallback portrait to the painting (bandana, green hair, earrings, scar).
   - Note: the painting looks like a well-known manga character (a swordsman with a black bandana and three gold earrings). If the game will be published, original art avoids copyright trouble.
5. **Thrusters.** Violet outside, orange inside: wide plumes from the two shoulder vents and smaller ones either side of the head's rear spike. There are no foot flames, because her feet are at the front.

## Layer split plan

Same method as the others: feathered polygons plus the exact alpha complement for the body.

- **Left wing:** the forearm blade and clawed hand, plus the shoulder armour and its spikes on that side. Pivot at the shoulder, about (330, 1000).
- **Right wing:** the mirror about x ≈ 512.
- **Body:** leg blades (top), waist, hips, torso and head.
- **Motion:** the same as the others: banking, breathing, a flare in focus. On each Ghost Slash the swinging arm kicks out briefly.

## Other notes

- **Data update (step 5).** The role "Stealth Fighter" becomes "Stealth Mecha". The bio mentions the violet blade mecha.

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Wire Blades: A.** Thrown from the two forearm blades.
2. **Ghost Slash.** Swept as a crescent by one arm blade, alternating sides.
3. **Clones and decoy.** Full copies of the mecha, with all its properties.
4. **Portrait: B** (later reversed, see *Revision* below).
5. **Thrusters.** Left to me: wide plumes from the rear of the shoulder armour, smaller ones beside the head's rear spike.

## Steps 2–6: results

- **Processing.** `npm run art:tess` (`glowRule: false`).
  - Sprite exports: 266×372 @2x and 133×186 @1x, with outline variants.
  - Front view: 424×600. Portrait: 432×540 / 240×300 (from a 720×900 crop).
- **Anchors** (`tess.anchors.json`, @2x): `bladeL/R`, `ventL/R`, `packL/R`, `head`, `hitbox`.
  - The blade anchors moved from mid-blade to (140, 707) / (884, 707) source px.
  - That is 16 units ahead, like the old origin. From mid-blade (23 ahead), the crescents reached 7 units further and hit targets at 180 that they never reached before.
- **Layers** (`tess.layers.json`): each side is the forearm blade and hand, plus the shoulder armour and spikes. Pivot at the shoulder.
- **Code.**
  - `src/pilots/tessArt.js`: config.
  - `src/pilots/tessFx.js`: crescent texture, shots, slash, cuts, and the full-mecha copies.
  - `mechaArt`: optional per-side wing kick (`ps.kickL / kickR`), used for the slash swing.
- **Aiming.** The crescents cross their old paths 130 units ahead (near the end of their range).
- **DPS** (`tools/dps.mjs tess`, before → after):

  | Mode | Boss | Small | Line |
  |---|---|---|---|
  | Shot T1–T4 | 29 / 58 / 87 / 116 → same | 0 → 0 | 0 → 0 |
  | Focus T1–T4 | 20 → 20 | 10 → 10 | 0 → 0 |

  - The 120-unit sweep differs by about 10–20 % at T1, T2 and T4 (T3 is identical). The coarse sweep grid is sensitive for short-range piercing shots.
- **Frame rate.** In the 1,500-bullet storm, about 53 FPS with art versus about 50 procedural (Intel HD 5500, headless).
- **Test range.** `?test=tess`. Screenshots are in `screenshots/tess/`:
  - `06_focus_*` show the Ghost Slash;
  - `07_dash` and `15_cloak` show the Cloak;
  - `14_clones*` show the Shadow Clones;
  - `16_bomb` shows Thousand Cuts.
- **Bug found and fixed on the way.** Tess's art first wasn't drawn at all, because I hadn't added her to `ART_MANIFEST`. ART_PIPELINE.md now warns about this.
- **Known gaps.**
  - With five crescents overlapping at tier 4, the orange core reads pinker than on a single crescent.
  - The fallback portrait has no earrings or green hair (no such styles).

## Revision: portrait, bio and scarlet (owner feedback)

- **Tess is female.** The first portrait (`pilot_portrait.jpg`, a man) was a mistake.
  - The bio and the lore line say "she" again.
  - The new portrait is `pilot-portrait-main.jpg` (640×1136: red-haired woman in a dark bodysuit). It is cropped to head and shoulders with the new `portraitCrop` setting: a 400×500 box at (125, 70). The watermark at the bottom stays out of the crop.
  - The fallback portrait matches it: long scarlet hair, red eyes, dark bodysuit.
- **Scarlet in the FX.** Every effect now has a scarlet band between the violet outside and the orange inside:
  - crescents (a scarlet layer and wake);
  - the Ghost Slash and the Thousand Cuts lines;
  - thrusters, muzzle flares and hit sparks.
  - Thrusters, muzzle flares and hit sparks use a new optional `pal.rim` colour in the shared modules. Pilots without it look exactly as before.
- Screenshots refreshed in `screenshots/tess/`.
