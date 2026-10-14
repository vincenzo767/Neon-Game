# Mira Solenne — Asset Notes (Step 1)

Pilot: **Mira Solenne**, vehicle **HALO SPRITE**. Built the same way as Kairo
Vance (see `ART_PIPELINE.md` and `../Kairo Vance/ASSET_NOTES.md`). The
source folder is read-only. Coordinates are source pixels, origin top-left.
Branch: `art/mira-test` (based on `art/kairo-test`, which has the art pipeline).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top_down_main.jpg` | 1024×1536 JPEG | **No**: solid black background | **In-game sprite.** The same layout as Kairo's `top_down_main.png`: the mecha flies feet-first. From top to bottom: the twin segmented legs (feet at the top), the chest with a central spike, two gold arm blades each carrying a dark gun barrel that points up, the head and gold skirt plates, and two big ladder-vent fins at the bottom. White/grey armour with gold trim. Mirror-symmetric about x ≈ 507. | Needs background removal (JPEG, so the edges have compression noise; the black border pixels are 0–3, with a few up to 222 where the art touches the edge). **Tested:** the script's flood fill gives a clean silhouette, and the art's own dark linework stays on the edge. The red-glow rule must be **off** for Mira, because it would eat dark gold shadows. Trim box after removal: x 24, y 38, 977×1483. |
| `top-down_front.png` | 1024×1536 PNG RGB | **No**: solid black background | Front view, upright: face visible, gold arm blades held down. Select-card preview and cut-in. | Needs the same background removal. The Kairo script only removed backgrounds from the in-game sprite, so step 2 must also apply it to the front view. |
| `pilot_portrait.jpg` | 515×741 JPEG | No | Mira, head and shoulders: long ash-blonde hair with gold hair ornaments, red eyes, violet high-collar outfit with a large bow and white glove. | White background. 2:3 aspect, so it needs a 4:5 crop (515×644 from the top). The card's cool grade will tint the white toward gold. The procedural portrait has **amber eyes and a halo**; the art has red eyes and no halo. |
| `parts_sheet.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Front, back and side views, a top-down view, and loose parts (heads, rifles and blades, torso, limbs, vents, hands). | Reference only. The checkerboard is painted in. |
| `fx_reference.png` | 1672×941 PNG RGBA | Partial: a semi-transparent grey backdrop | Firing animation, rifle shots (diamond lances), charged shot (orb + rings), spread shards, thruster states, flame variations, movement trails, all **gold / amber**. | Reference only (rebuilt in code, as for Kairo). |

## Facing

`top_down_main.jpg` flies **up** feet-first, the same as Kairo's sprite. **The feet
(top) never fire.** No rotation needed.

## Anchor estimates (`top_down_main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest centre) | (507, 760) | — | Lands on `player.x/y`. |
| **Chest gun** (`gun`) | (507, 480) | — | Tip of the central chest spike. **Proposed needle origin.** |
| **Arm guns** (`armL/R`) | (215, 625) | (800, 625) | Tips of the dark barrels on the gold arm blades. They point up. |
| Arm-blade tips | (60, 410) | (955, 410) | Reference only (forward-most points). |
| **Back thrusters** (`ventL/R`) | (180, 1495) | (840, 1495) | Ends of the two ladder-vent fins: wide plumes. |
| **Centre exhaust** (`packL/R`) | (480, 1315) | (535, 1315) | Dark nozzle under the head: wide back plume. |
| **Foot thrusters** (`footL/R`) | (400, 1255) | (615, 1255) | Gold skirt plates beside the head. Same role as Kairo's foot flames. |
| Head | (507, 1120) | — | Reference. |
| Feet (top) | (310, 60) | (705, 60) | **Never fire.** |

**Scale.** At the default size of 90 units tall, 1 source pixel is about 0.061 units. The chest gun sits 17 units ahead of the hitbox, and the arm guns sit 18 units out and 8 units ahead.

## Mira's weapons today (gameplay stays as is unless you approve a change)

- **Main:** a homing light-needle fan of 2 + tier needles every 6 steps. The needles leave 16 units ahead of the centre, spaced 4 units apart.
- **Focus:** a tighter, hard-homing fan every 5 steps.
- **Options:** 1–4 drones that orbit (or line up in focus) and fire homing needles.
- **Special:** shield orbs. **Bomb:** Halo Bloom. **Ultimate:** Prism Lattice.
- There is **no focus beam**, so there is no beam origin to place.

## Proposed mapping (needs your decision)

1. **Needle fan from the chest gun.** Same angles and the same 4-unit spacing. The chest gun is 17 units ahead versus 16 today, so this is effectively no gameplay change.
2. **Arm guns.** Two options:
   - **A (recommended):** the two outermost needles at tier 3+ (the 5th and 6th) leave from the arm guns. They still home and keep their damage. DPS is checked with `tools/dps.mjs`, as for Kairo.
   - **B:** the arm guns don't fire (all needles from the chest gun).
3. **Thrusters.** **Gold/amber** flames, matching the FX sheet (Kairo's are blue):
   - wide back plumes from the two ladder vents and the centre exhaust;
   - foot flames at the gold skirt plates.
4. **Size.** **90 units tall**, the same default as Kairo. The hitbox stays 2.6.
5. **FX palette.** White-hot core → yellow → amber-gold → orange edge:
   - needles as diamond-tipped gold lances (hit area = bright core);
   - shards for the drones' shots;
   - gold muzzle flares and hit sparks;
   - shield orbs and the Halo Bloom kept, recoloured to match.

## Layer split plan

Same method as Kairo: feathered polygons plus the exact alpha complement for the body.

- **Left wing:** the gold arm blade with its gun, plus the grey shoulder armour and the ladder-vent fin on that side. Pivot at the shoulder, about (300, 900).
- **Right wing:** the mirror of the left about x ≈ 507.
- **Body:** legs (top), torso, chest spike, head and skirt.
- **Motion:** the same as Kairo: banking, breathing, a flare in focus, and a fold on the special.

## Other notes

- **Drones.** Mira's option drones are still the procedural gold orbs; nothing in the art covers them.
- **Data update (step 5).** The role "Drone Ship" becomes "Drone Mecha". The bio describes the Halo Sprite as a white and gold mecha. The fallback portrait is matched to the painting (red eyes, ash-blonde hair, violet outfit, no halo).

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Needle fan from the chest gun.** No feet ever fire.
2. **Arm guns: option A.** From tier 3 the outermost pair of needles leaves from the arm guns, aimed where the old outer needles were 240 units ahead. The needles still home.
3. **Thrusters.** Gold/amber: wide back plumes from the vent fins and centre exhaust, plus foot flames at the gold skirt plates.
4. **Size.** 90 units tall. The hitbox is unchanged (2.6).

## Steps 2–6: results

- **Processing.** `npm run art:mira`, which is `node tools/process-art.mjs mira` with the settings in `tools/art.config.mjs` (`glowRule: false`).
  - The black-background JPEG sprite and front view are cut out automatically (see `screenshots/mira/process/`).
  - Sprite exports: 249×372 @2x and 125×186 @1x, with outline variants.
  - Front view: 391×600. Portrait: 432×540 / 240×300.
- **Anchors** (`mira.anchors.json`, @2x): `gun` (chest gun), `armL/R` (arm guns), `ventL/R` and `packL/R` (back thrusters), `footL/R`, `head`, `hitbox`.
- **Layers** (`mira.layers.json`): each side is an arm blade with its gun, plus the shoulder and vent fin. Pivot at the shoulder.
- **Code.** `src/pilots/miraArt.js` (config on the shared `art/mechaArt.js` + `art/mechaFx.js`). In `mira.js`:
  - firing from `gun` and `armL/R`;
  - every shot tagged in `shots.aux`;
  - drone shots drawn as shards;
  - the Prism Lattice reflections keep their generic look.
- **Data.** The role is "Drone Mecha". The bio mentions the white and gold mecha. The palette is added. The fallback portrait has red eyes, ash-blonde hair and a violet suit (no halo).
- **DPS** (`tools/dps.mjs mira`): identical to the original code at every tier, normal fire and focus.
- **Frame rate.** In the 1,500-bullet storm, normal fire averages about 49–50 FPS versus about 52 before (Intel HD 5500, headless). That is about 2–3 FPS for the art and FX.
- **Test range.** `?test=mira`. Screenshots are in `screenshots/mira/`: `07_dash` shows the shield orbs (her special), and `06_focus_beam` shows the focus needle stream (she has no beam).
- **Known gaps.**
  - The option drones are still the procedural gold orbs.
  - The portrait's white background turns pinkish under the card's colour grade.

## Wrap-up

Approved by the owner after the Step 6 checkpoint. The branch `art/mira-test` stays unmerged until the owner says so.

---

# Rebuild v2: component mecha (branch `art/mira-v2`)

Owner's brief (2026-10-15): rebuild the Halo Sprite from the new
`top-down-enhance.png` as a component mecha with tier-deployed wings, the
chest firing at tier 1, both hand cannons from tier 2, and a chest focus
attack. Keep the gold needle glow and the gold thrusters. Built on the
component-mecha path from Kairo v2 (`ART_PIPELINE.md`, "Component mecha").
Branch `art/mira-v2` sits on top of `art/kairo-v2`.

## Step 1: inspection

### New image

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down-enhance.png` | 1362×1155 PNG RGB | **No**: flat white background (254) | The Halo Sprite redrawn: white/silver armour, gold plating, navy joints, a heavy black outline. Mirror-symmetric about **x ≈ 681**. Wider and more detailed than `top_down_main.jpg`. | The background is white and so is the armour. A new `bg: 'white'` mode floods from the edges and stops at the black outline; enclosed white pockets get `holes` seeds. |

`top-down_front.png` (select card, cut-in) and the portrait stay as they are.
No new front view was supplied.

### Facing (checked on the art)

Forward is **up**, as before. The two dark cannon barrels have their bore caps
at the top (y ≈ 318). The ladder-vent exhaust fins and the dark backpack spike
are at the bottom. The twin segmented legs are at the top: she flies
feet-first, as in the old sprite. **The feet never fire.**

### Components (left side, source px; the right side mirrors at x 681)

| Part | Where | Role |
|------|-------|------|
| **Hand cannon** | Dark segmented barrel in a gold housing, bore (378, 318) down to the forearm and fist at about (400, 600) | Tier 2–4 normal fire. Pivot at the elbow, about (400, 610). |
| **Inner blade array** | The two gold blades beside the cannon: the long one (tip 215, 140) and the short one (tip 190, 285), roots at about (340, 600) | Folded at T1–T2, deployed at T3–T4. |
| **Outer blade array** | The white blade with its gold edge (tip 22, 467) and its lavender underside, root at about (300, 630) | Folded at T1–T3, deployed at T4. |
| **Body** | Legs (top), hips with the gold V, the chest, the gold head crest, shoulder armour, skirt plates, ladder fins and backpack spike | Hover, bank and breathing. |
| **Chest emitter** | Small gold spike and dark slot at the centre of the chest plate, about (681, 565) | Tier 1 fire and the focus attack. |

### Anchor estimates (source px)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| `hitbox` | (681, 600) | — | Chest centre: lands on `player.x/y`. |
| `chest` | (681, 565) | — | Tier 1 needle origin and focus origin. Never the feet. |
| `muzzleL/R` | (378, 318) | (984, 318) | Cannon bores, about 20 units ahead of the hitbox and 25 units out. |
| `gripL/R` | (420, 520) | (942, 520) | Fist on the cannon. |
| `innerPivot/Tip` | (340, 600) / (215, 140) | mirrored | |
| `outerPivot/Tip` | (300, 630) / (22, 467) | mirrored | |
| `ventL/R` | (432, 1138) | (930, 1138) | Ladder-fin ends: the existing wide gold plumes. |
| `packL/R` | (668, 1040) | (694, 1040) | Backpack spike tip: the existing centre plume. |
| `footL/R` | (580, 870) | (782, 870) | Gold skirt plates: the existing small flames. |
| feet | (650, 40) | (712, 40) | **Never fire.** |

### What Mira has today (baseline, `tools/dps.mjs mira`, boss DPS)

| Mode | T1 | T2 | T3 | T4 |
|------|----|----|----|----|
| Shot (needle fan, 2 + tier needles, homing) | 28 | 41 | 55 | 68 |
| Focus (tight hard-homing needle fan) | 39 | 57 | 75 | 92 |

- **Options:** 1–4 gold drones that fire homing needles.
- **Special:** Shield Orbs. **Bomb:** Halo Bloom. **Ultimate:** Prism Lattice.
- **Effects kept:** the gold diamond needles with their trail, the muzzle flares, the hit sparks, and the gold plumes (vents, centre exhaust, skirt).
- **Mira has no focus beam today.** Her focus is a needle stream, so a chest
  beam is a gameplay change and needs your call (decision 2).

## Proposed decisions (Step 1 checkpoint)

1. **Normal-fire origins.**
   - **T1:** the whole fan from the chest emitter. This is what she does today.
   - **T2–T4:** the fan splits across the two cannon muzzles, half from each. At T3 (5 needles) the centre needle alternates cannons per volley.
   - Needle look, count, speed, homing, cadence and damage are all unchanged. Lanes are re-aimed so that coverage stays the same.
2. **Focus attack from the chest.**
   - **A (recommended):** a chest beam with a 0.2 s charge, a live beam, and a collapse back into the chest. Its boss DPS is tuned to today's focus (39 / 57 / 75 / 92, minus the charge). The drones keep firing homing needles, so focus still covers moving targets.
   - **B:** keep the homing needle stream, now from the chest. Add the charge, active and recovery VFX around it, with no beam.
3. **Drones (options).**
   - **A (recommended):** keep them. She is a drone mecha, and the brief doesn't mention them.
   - **B:** replace them with wing-tip emitters, as Kairo's were.
4. **Size and hitbox.** 90 units tall, the same as Kairo v2. The hitbox stays 2.6.
   - Folded (T1–T2), she is about 56 units wide. Fully deployed (T4), about 106.
   - The wings are visual only and never touch collision.

## Implementation plan (Steps 2–6)

- **Step 2. Process the art.** `bg: 'white'` removal, then `parts`:
  - the cannon;
  - the inner array, split into root and tip;
  - the outer array, split into root and tip;
  - the body.
  New anchors. The front view and portrait are unchanged.
- **Step 3. Rig.** Kairo's state machine (fold/deploy, recoil, focus states) moves to a shared `art/mechaRig.js` that both pilots configure. Kairo's behaviour must stay identical.
  - Folded: both blade arrays swing down behind the shoulders.
  - T3: the inner blades rotate, extend and lock.
  - T4: the outer blades do the same.
  - On a tier loss, they retract outer first, then inner.
- **Step 4. Weapons.**
  - Chest and cannon origins wired through rig-attached anchors.
  - Recoil, barrel channel pulses and muzzle flashes, all in the existing gold needle style.
  - A chest pulse at T1.
- **Step 5. FX.**
  - The focus cycle.
  - Wing conduits, lock flashes and the T4 transformation.
  - The gold plumes, kept at their propulsion points.
  - Armour-edge light.
- **Step 6. Test in the running game.**
  - All four tiers and their deployment and retraction.
  - Firing origins and the focus cycle.
  - Special, bomb and ultimate.
  - DPS against the baseline and the 1,500-bullet storm FPS.
  - The other pilots and Kairo, checked for regressions.
