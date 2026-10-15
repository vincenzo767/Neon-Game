# Bruno Hagen — Asset Notes (Step 1)

Pilot: **Bruno Hagen**, vehicle **IRONHOUND**. Built the same way as Kairo and
Mira (see `ART_PIPELINE.md`, `../Kairo Vance/ASSET_NOTES.md` and
`../Mira Solenne/ASSET_NOTES.md`). The source folder is read-only. Coordinates
are source pixels, origin top-left. Branch: `art/bruno-test` (based on
`art/pilot-textures`, which has the shared art modules and per-pilot textures).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top_down_main.jpg` | 1024×1536 JPEG | **No**: solid black background | **In-game sprite.** Same layout as Kairo and Mira: the mecha flies feet-first. From top to bottom: the two armoured legs (feet at the top), the waist with a purple grille and red V, the torso with gold trim, the head with a purple crest, and the backpack (two struts and an H-frame). Each arm holds a **double-barrelled cannon** pointing up: a long thin barrel and a big wide-bore barrel, both with glowing violet muzzle rings. Two big red-and-grey shoulder pods sit at the bottom with violet vents at their ends. Grey armour, red panels, **violet** glow. Mirror-symmetric about x ≈ 511. | Needs background removal (JPEG, black border 0–1, so the flood fill is easy). The red-glow rule should be **off**: the art has dark red panels it would eat. Bounding box: x 24, y 36, 976×1444. |
| `top_down_front.png` | 1024×1536 PNG RGB | **No**: solid black background | Front view, upright: head with purple crest, red shoulder armour, cannons held down. Select-card preview and cut-in. | Same background removal. Bounding box: x 27, y 59, 970×1438. |
| `pilot_portrait.jpg` | 736×1308 JPEG | No | Bruno, head and shoulders: green fur ushanka with a badge, white side-shaved hair, dark skin, a scar ring over the closed right eye, white vest, green fur collar. | Black background (fits the card well). 9:16 aspect, so it needs a 4:5 crop (736×920 from the top). The procedural portrait has a buzz cut, a beard and blue-grey eyes; the painting has a fur hat, white hair, no beard and a scarred eye. |
| `parts_sheet.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Front, side, back and top views; heads, cannons, nozzles, armour plates, fists. | Reference only. |
| `fx_reference.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Cannon fire with ejected brass casings, rockets with smoke trails, star-shaped muzzle flashes, violet airbursts with black smoke and white-orange cores, thruster plumes. **Everything is violet / magenta**, with white-hot and orange cores. | Reference only (rebuilt in code, as for Kairo and Mira). |

## Facing

`top_down_main.jpg` flies **up** feet-first, the same as Kairo and Mira. **The
feet (top) never fire.** No rotation needed.

## Anchor estimates (`top_down_main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest centre) | (511, 930) | — | Lands on `player.x/y`. |
| **Big cannon** (`cannonL/R`) | (80, 757) | (942, 757) | Centre of the wide-bore muzzle ring. Points up. |
| **Long barrel** (`barrelL/R`) | (110, 497) | (912, 497) | Centre of the thin barrel's muzzle ring. Points up. |
| **Shoulder pod vents** (`podL/R`) | (250, 1478) | (772, 1478) | Ends of the big shoulder pods: wide back plumes. |
| **Backpack struts** (`packL/R`) | (415, 1430) | (607, 1430) | Ends of the two backpack struts: smaller back flames. |
| Head | (511, 1080) | — | Reference. |
| Fists | (215, 690) | (807, 690) | Reference only (no weapon). |
| Feet (top) | (300, 40) | (720, 40) | **Never fire.** |

**Scale.** At the default size of 90 units tall, 1 source pixel is about 0.062 units.
- Big cannons: 27 units out from the centre, 11 units ahead of the hitbox.
- Long barrels: 25 units out, 27 units ahead.
- Unlike Kairo and Mira, Bruno has **no chest gun**: the centre of the mecha is the waist grille, the torso and the head. All his guns are on the arms.

## Bruno's weapons today (gameplay stays as is unless you approve a change)

- **Main: Flak Spread.** Every 8 steps, a fan of 3 + 2×tier flak shells (5, 7, 9, 11) from one point 18 units ahead of the centre, 0.58–0.82 rad wide. Each shell bursts on contact or after about 22–32 steps (≈ 200–290 units) for 1.6 area damage, radius 20.
- **Focus: Siege Cannon.** Every 10 steps, 1 / 2 / 2 / 3 heavy shells (by tier) side by side 8 units apart, 22 units ahead. Each bursts for 4.5 damage, radius 34. Camera kick.
- **Options:** 2 pods at tier 2–3, 4 at tier 4. They sit at **±26 and ±38 units** out (±16 and ±26 in focus) and fire flak or shells straight up.
- **Special:** Brace (absorbs one lethal hit). **Bomb:** Flak Barrage. **Ultimate:** Carpet-Bomb Run (procedural bombers).
- There is **no focus beam**.

## Proposed mapping (needs your decision)

1. **Colour.** The art and FX sheet are violet; Bruno's game colour is orange.
   - **A (recommended): violet everywhere.** Shots, bursts, thrusters, muzzle flashes, Brace ring, bomb and ultimate explosions and the UI colour (select card, HUD) all become violet / magenta, with white-hot and orange cores like the FX sheet.
   - **B:** violet for the mecha's own FX only (shots, thrusters, flashes); the UI colour and bomb/ultimate stay orange.
   - **C:** keep everything orange.
2. **Firing (no feet, no chest gun).**
   - **Flak fan from the two big cannons (recommended).** The left half of the fan leaves the left big cannon and the right half the right one; the middle shell (odd counts) alternates sides. Each shell is aimed at where the old shell was 240 units ahead, so coverage and burst positions stay the same. Same damage and fuse.
   - **Siege shells from the two long barrels.** With 1 shell (tier 1) the barrels alternate each volley. With 2, one per barrel. With 3 (tier 4), one per barrel plus the third alternating. Aimed to converge on the old positions at 240 units, same damage and burst radius.
   - DPS and burst coverage are checked with `tools/dps.mjs`, as for Kairo and Mira.
3. **Option pods vs the cannons.** At 90 units tall the cannons sit about 26 units out, exactly where the option pods fly (±26).
   - **A (recommended):** move the unfocused pods out to ±40 / ±52 (focus: ±32 / ±44), so they fly beside the cannons instead of over them. This is a small gameplay change (their shots land wider).
   - **B:** keep the pod positions; the pods draw over the cannons.
4. **Thrusters.** Violet (or orange, per question 1):
   - wide back plumes from the two shoulder-pod vents;
   - smaller flames from the two backpack struts;
   - no foot flames (his feet are at the front).
5. **Size.** **90 units tall**, the same default as Kairo and Mira. The hitbox stays 3.0.
6. **FX look** (from `fx_reference.png`; I'll show it at the Step 6 checkpoint):
   - flak shells as glowing slugs with a short tracer; airbursts as violet star bursts with a white-orange core and a few dark smoke puffs;
   - siege shells as bigger shells with a violet trail and ring bursts;
   - star-shaped muzzle flashes at each barrel, plus a few cosmetic brass casings;
   - the hit area stays the bright core.

## Layer split plan

Same method as Kairo and Mira: feathered polygons plus the exact alpha complement for the body.

- **Left wing:** the double cannon, fist and forearm, plus the shoulder pod on that side. Pivot at the shoulder, about (330, 1080).
- **Right wing:** the mirror about x ≈ 511.
- **Body:** legs (top), waist, torso, head and backpack.
- **Motion:** the same as the other two: banking, breathing, a flare in focus, and a fold on the special (Brace).

## Other notes

- **Option pods and bombers** stay procedural (recoloured if you pick 1A); nothing in the art covers them.
- **Data update (step 5).** The role "Armored Gunship" becomes "Heavy Mecha". The bio mentions the grey and red Ironhound mecha. The fallback portrait is matched to the painting (fur hat, white hair, no beard, scarred eye).

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Colour.** Follow the FX sheet: violet on the outside, orange on the inside, for every shot, muzzle flash, burst and explosion. The UI colour became violet too, to match the mecha.
2. **Firing.** Recommended option (no answer needed): the flak fan from the two big cannons, the siege shells from the two long barrels. No feet ever fire.
3. **Option pods: A.** Moved out beside the cannons. The mecha stays 90 units tall.
4. **Thrusters.** Recommended option: wide plumes from the shoulder pods, smaller flames from the backpack struts.

## Steps 2–6: results

- **Processing.** `npm run art:bruno` (`tools/art.config.mjs`, `glowRule: false`).
  - The black-background sprite and front view are cut out automatically (`screenshots/bruno/process/`).
  - The gap inside the backpack's H-frame is enclosed, so the edge fill couldn't reach it. A new `holes` setting seeds it.
  - Sprite exports: 255×372 @2x and 128×186 @1x, with outline variants. Front view: 406×600. Portrait: 432×540 / 240×300 (from a 736×920 crop).
- **Anchors** (`bruno.anchors.json`, @2x): `cannonL/R`, `barrelL/R`, `podL/R`, `packL/R`, `head`, `hitbox`.
- **Layers** (`bruno.layers.json`): each side is the double cannon, fist and forearm, plus the shoulder pod. Pivot at the shoulder.
- **Code.**
  - `src/pilots/brunoArt.js`: config on the shared `art/mechaArt.js`.
  - `src/pilots/brunoFx.js`: Bruno's own shell, airburst and muzzle-flash FX. Flak shots use `shots.aux` as their burst radius, so shells are told apart by frame.
  - World has a new opt-in `flakBurst` hook (cosmetic; the burst damage is unchanged).
- **Aiming.** Each shell crosses the old shell's path 170 units ahead, at the same moment. Aiming at the old burst points (about 220 ahead) lost a fifth of the boss DPS, because the cannons are 54 units apart.
- **DPS** (`tools/dps.mjs bruno`, before → after):

  | Mode | Boss | Small | Line |
  |---|---|---|---|
  | Shot T1 | 50 → 50 | 10 → 10 | 60 → 77 |
  | Shot T2 | 88 → 87 | 30 → 14 | 116 → 96 |
  | Shot T3 | 88 → 88 | 30 → 30 | 122 → 137 |
  | Shot T4 | 125 → 125 | 30 → 30 | 181 → 161 |
  | Focus T1 | 23 → 23 | 22 → 22 | 0 → 45 |
  | Focus T2–T3 | 71 → 71 | 70 → 45 | 140 → 140 |
  | Focus T4 | 119 → 119 | 93 → 68 | 190 → 234 |

  - Boss DPS is identical.
  - The small-target focus drop comes from the moved pods: with the old pod positions it is identical (70, 93).
  - Shot T2 small is a near miss: the second shell passes 18.8 units from the target centre against a 19-unit hit range.
  - Total sweep coverage is within a few percent, except shot T1 (−16 %). Close to the mecha the centre gets less, because the shells start from the arms.
- **Frame rate.** In the 1,500-bullet storm, about 46 FPS with art versus about 49 with the procedural ship (Intel HD 5500, headless).
- **Test range.** `?test=bruno`. Screenshots are in `screenshots/bruno/`:
  - `06_focus_beam` shows the siege shells (he has no beam);
  - `07_dash` shows Brace (his special).
- **Known gaps.**
  - The option pods and the bombers are still procedural.
  - The fallback portrait has no fur hat.
  - Without art (`?noart`), shots still leave the arm-cannon positions, so gameplay is the same either way.

## Revision: explosions (owner feedback)

The airbursts looked like flat pink discs. They are rebuilt after the explosion row of `fx_reference.png`:

- **Layers.** Each burst has:
  - a billowing **dark purple smoke cloud** (new cloud texture), drawn under the fire;
  - an **orange fire core** that cools to magenta and lasts about 20 steps;
  - a white-yellow flash with a violet bloom;
  - violet spikes, dark debris chips and orange embers.
- **Bomb, ultimate and Brace** use the same explosion at a larger size, with the blast's shockwave and camera shake.
- **Flak shells** lost the ring disc: each is an orange slug with a white-hot centre and a short violet flame tail.
- **Checks.**
  - The textures fit in the shared atlas, which stays at 81 %.
  - Storm frame rate is unchanged (about 49 FPS), and DPS is unchanged because the change is cosmetic.
  - Screenshots: `screenshots/bruno/14_burst_*.png`.

---

# Rebuild v2: heavy-artillery component mecha (branch `art/bruno-v2`)

Owner's brief (2026-10-15): rebuild the Ironhound from the new
`top-down-enhance.png` as a component mecha whose **artillery** expands with
the tiers (not wings). Normal shells get unlimited range and explode on
contact; damage scales by tier. Focus becomes a shoulder-cannon barrage.
Special becomes a 6 s reactive shield. Bomb becomes a wide-area blast.
Ultimate becomes a 6 s carpet-bomb run ending in a screen-wide nuke. Keep the
glowing shells and violet thrusters. Built on the shared component-mecha
path (`art/mechaRig.js`). Branch `art/bruno-v2` sits on top of `art/mira-v2`.

## Step 1: inspection

### New image

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down-enhance.png` | 1362×1155 PNG RGB | **No**: painted checkerboard (greys 230–254) | The Ironhound redrawn: silver / blue-grey armour, crimson plates, violet-magenta energy, charcoal joints, heavy black outline. Mirror-symmetric about **x ≈ 681**. | Needs `bg: 'checker'` (as Kairo and Lin). |

`top_down_front.png` (select card, cut-in) and the portrait stay as they are.

### Facing (checked on the art)

Forward is **up**, as before. All six barrels have their bores at the top
(y ≈ 45–60), and the wide-bore and side-cannon mouths face up. He flies
feet-first: the twin pointed legs are at the top centre, and the red V waist,
torso, purple head crest and H-frame backpack are below. **The feet never
fire.**

### Components (left side, source px; the right side mirrors at x 681)

| Part | Where | Proposed role |
|------|-------|---------------|
| **Hand gun** | The inner long barrel (bore 287, 60) on the forearm: violet rings, grey breech, purple crystal and red plate at the fist (≈ 320, 560) | Normal fire at every tier. Recoils with the forearm. Pivot at the elbow (≈ 320, 690). |
| **Shoulder cannon** | The heavy outer block: black housing (60–240, 470–790) anchored at shoulder level, the **wide-bore magenta cannon** (mouth 148, 410) and the **outer long barrel** (bore 135, 60) | Focus barrage. Compact at T1–T2; expands at T3–T4. |
| **Side cannon** (integrated artillery) | The short magenta-mouthed cannon beside the torso (mouth ≈ 470, 825), between the shoulder pod and the body | Retracted at T1–T2, partly out at T3, fully out at T4. |
| **Body** | Legs (top), red-V waist, torso, head crest, the big oval shoulder pods with red plates, backpack H-frame | Hover, bank and breathing. |

The compact pose is built from these parts, not from a scaled image.
- **Shoulder cannon, compact:** the outer long barrel telescopes down into the housing, and the block sits lower and tucked in.
- **Shoulder cannon, deploying:** the block slides up, rotates out and locks; then the long barrel extends.
- **Side cannon:** sinks back into the shoulder until T3.

### What Bruno has today (baseline, `tools/dps.mjs bruno`, boss DPS)

| Mode | T1 | T2 | T3 | T4 |
|------|----|----|----|----|
| Shot (flak fan 5 / 7 / 9 / 11 shells, 1.6 area dmg, burst r 20) | 50 | 87 | 88 | 125 |
| Focus (siege shells 1 / 2 / 2 / 3, 4.5 area dmg, r 34) | 23 | 71 | 71 | 119 |

- **Range.** Flak shells burst on contact **or after a 20–32 step fuse** (about 180–290 units). That fuse is the "short range".
- **Focus is weaker than normal fire today.** The brief asks for the opposite.
- **Options:** 2 pods at T2–T3, 4 at T4, firing flak or shells.
- **Special:** Brace (absorbs one lethal hit; cooldown 900, 5 s).
- **Bomb:** Flak Barrage (100 steps, a burst every 3 steps at enemies, 7 dmg r 55, clears bullets).
- **Ultimate:** Carpet-Bomb Run (250 steps, 5 bombers, drops 9 dmg r 60, clears bullets).
- **Immunity hook.** `Player.invulnerable` already honours a pilot `intangible()` hook, which covers bullets, lasers and contact. A real shield can use it.

## Proposed decisions (Step 1 checkpoint)

1. **Which parts are which.**
   - **A (recommended):** as in the table. Hand gun = inner long barrel on the forearm. Shoulder cannon = the outer block (wide-bore cannon + outer long barrel). Side cannon = the small torso-side cannon.
   - **B:** hand gun = the wide-bore magenta cannon; shoulder cannons = both long barrels.
2. **Normal fire.** The same flak fan from the two hand-gun muzzles (left half / right half; the middle shell alternates).
   - **Range:** no fuse. Shells fly until they hit something or leave the playfield.
   - **On contact:** they burst, damaging every enemy in the burst radius once.
   - **Damage:** a central tier table `TIER_DMG = [1.0, 1.2, 1.45, 1.75]` multiplies shell damage, so damage rises at every tier. Cadence (8 steps) and shell counts are unchanged.
   - **Side cannons:** from T3 they add a pair of shells, taking over the pods' share (see 3).
3. **Option pods.**
   - **A (recommended):** remove them. Their firepower moves into the side cannons, so the arsenal grows on the mecha itself, with nothing like Mira's drones.
   - **B:** keep them.
4. **Focus: shoulder-cannon barrage.**
   - **Cycle:** 0.25 s charge, then barrage, then recoil and recovery. The hand guns keep firing during the charge.
   - **Shells:** every 10 steps. Wide-bore cannons only at T1–T2 (2 shells); wide-bore + long barrels at T3–T4 (4 shells).
   - **Tuning:** heavy shells (bigger burst) tuned so focus boss DPS is about **1.4× normal fire** at the same tier.
5. **Special: Reactive Shield** (replaces Brace).
   - **Duration and cooldown:** 6 s; cooldown unchanged (900 steps).
   - **Sphere:** radius 64 units, covering the fully deployed mecha. Total immunity to bullets, lasers and contact through `intangible()`.
   - **Absorption:** every enemy bullet that enters the sphere is absorbed (destroyed, so it is counted once). Each adds **+0.02** to a damage multiplier, capped at **×2.0** (50 bullets).
   - **Lasers and contact:** they add +0.02 per 10 steps of contact.
   - **Bonus window:** the bonus applies to shots and focus. It lasts **5 s** after the shield ends, then fades over 1 s.
6. **Bomb.**
   - **A (recommended):** keep the Flak Barrage and its damage. Add an opening **wide detonation** centred on Bruno: radius 200, 25 damage, hitting each enemy once. Its drawn radius equals the damage radius.
   - **B:** visuals only, no new damage.
7. **Ultimate.**
   - **Run:** 6 s of bombers in waves, dropping a bomb every 6 steps at varied points (9 dmg r 60 each, as today). Bullets are cleared during the run.
   - **Nuke:** a warning, a 0.6 s drop, then a **screen-wide nuke** that deals **60 damage once to every enemy in the playfield**, bosses included.
   - **Total length:** about 7.5 s. The nuke can only trigger once per ultimate.
8. **Size and hitbox.** 90 units tall; the hitbox stays 3.0. The expanded artillery is visual only and never changes collision.
