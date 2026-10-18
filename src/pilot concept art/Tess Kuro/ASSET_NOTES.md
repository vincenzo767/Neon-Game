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


---

# Rebuild v2 (Step 1)

Branch: `art/tess-v2`, on top of `art/bruno-v2`. It uses the shared component-mecha rig that Kairo, Mira and Bruno use. The source folder stays read-only.

## New images

| File | Size | Real transparency? | What it shows | Notes |
|------|------|--------------------|---------------|-------|
| `new-top-down-main.png` | 1362×1155 PNG RGB | **No**: painted checkerboard | **New in-game sprite.** Feet-first, mirror-symmetric about x ≈ 681. Two long glowing arm blades sweep up and out to the top corners (tips near (19, 30) and (1343, 30)). The two leg blades with red chevrons are in the centre (feet at about (585, 320) and (777, 320)). The waist has a red tip at about (681, 570), and the head is at about (681, 850) with its rear spike down to y ≈ 1000. Long shoulder spikes cross into an X at the bottom. | Needs `bg: 'checker'`, like Bruno. The magenta halo round the blades must survive (the pocket detection keeps it). `glowRule` stays off because of the thin red lines. Bounding box is about x 15–1347, y 20–1150. |
| `new-top-down-front.png` | 1024×1536 PNG RGB | **No**: solid black | Front view, upright: horned head, X shoulder spikes, arm blades held down, long leg blades. Used for the select card and the cut-in. | Needs `frontBg: 'flat'`. |
| `new-ultimate.png` | 1671×941 PNG RGB | **No**: painted checkerboard | Ultimate FX reference: a black-violet void cross with a white-hot core and rings, a vertical spear, and two crescent wings curving back, with ragged ink edges and white cutting edges. | Reference only; it is rebuilt in code, like Miguerre's crescent. |
| `pilot_portrait.jpg` | — | — | The old portrait of the wrong (male) pilot. **Deleted from the folder by the owner.** | The deletion is committed with the new art. The game uses `pilot-portrait-main.jpg`, which is unchanged. |

**Facing.** The mecha flies up, feet-first, like the others. **The two centre leg blades are her feet and never fire.** No rotation is needed.

## Components (source px, L side; R = 1362 − x)

| Part | Where | Role |
|------|-------|------|
| **Arm blade** (forearm + glowing blade) | From the wrist at about (375, 650) out to the tip at (19, 30) | **Throws every crescent.** It is animated, and swings on every throw. |
| **Upper arm** | Shoulder at about (530, 800) → elbow at about (420, 700) | Animated: carries the swing. |
| Leg blades (feet) | Centre, tips at (585, 320) / (777, 320) | Body. **Never fire.** |
| Waist, torso, head | Centre line, y 560–1000 | Body. |
| Shoulder spikes (bottom X) | From about (560, 900) down to the bottom corners | Body. The thrusters sit at their roots. |

**Proposed anchors** (exact values set when processing):
- `hitbox` (681, 740), the chest centre;
- `head` (681, 850);
- `blade` (130, 230), on the blade near the tip: where crescents leave;
- `bladeTip` (19, 30);
- `wrist` (375, 650), `elbow` (420, 700), `shoulder` (530, 800);
- `vent` (560, 960) and `pack` (640, 1010) for the thrusters (wide plumes at the shoulder-spike roots, small ones beside the head spike).

**Scale.** At 90 units tall, 1 source px ≈ 0.08 units.
- The sprite is about 106 units wide.
- The blade tips are about 53 units out and 57 ahead of the hitbox.
- The hitbox stays at 2.2.

## Rig plan (shared `createRig`, Tess-specific state)

- **Parts:** `arm` on each side, split at the elbow. The root is the upper arm (pivot at the shoulder); the tip is the forearm and blade (joint at the elbow). The body holds everything else.
- **Throw motion** (every throw is a visible swing):
  - **wind-up:** the blade rotates back and out;
  - **slash:** it snaps forward and inward across the body, and the crescent leaves the blade at the moment of the snap;
  - **recovery:** it settles back.
  - The elbow bends a little more than the shoulder, so the blade whips.
  - There is a small body twist toward the swinging side.
- The clones use the same rig, so their arms swing with hers.

## Today's kit (baseline, `tools/dps.mjs tess`)

| Mode | Boss DPS | Small | Range |
|---|---|---|---|
| Wire Blades T1–T4 | 29 / 58 / 87 / 116 | 0 | About 150 units, so 0 at 240+ |
| Ghost Slash (focus) T1–T4 | 20 | 10 | Melee |

- **Special:** Cloak (decoy), 4 s, 12 s cooldown.
- **Bomb:** Thousand Cuts (1.8 s).
- **Ultimate:** Shadow Clones (6 s).
- **For comparison:** Bruno v2 shot 50 / 84 / 131 / 193; Miguerre shot 58 / 82 / 107 / 131 (plus one-hit kills).

## The new kit as I read the brief

### Main attack: Crescent Blades (no range limit)

- Crescents fly until they leave the screen.
- They pierce every enemy on their path (each crescent hits each enemy once).
- They erase enemy bullets along their path.
- The fire rate stays the same (one volley every 6 steps).
- They grow per tier toward the large crescent of the old focus look, and fly much faster.

### Focus: Glitch Clones

- Two clones appear ahead of her, one on each side, and follow her.
- They look glitchy: horizontal slice offsets, RGB split, flicker and scanlines.
- They throw exactly her volley (same count, size, speed and damage), and only when she throws.
- Their arms swing with hers.

### Special: Shadow Form

- For 10 s she becomes a living shadow: black-violet, smoky and flickering.
- Every attack phases through her: bullets, lasers, contact and boss attacks (`intangible`).
- She keeps attacking. The decoy is removed.

### Bomb: Thousand Cuts + Triple Crescent

- Thousand Cuts is kept as it is.
- She also summons her two clones for the bomb.
- She and each clone throw a fan of **three wide AOE crescents**, so nine sweep up the screen and erase bullets.
- The clones also throw with her for the length of the bomb.

### Ultimate: Void Cross Annihilation

- **Shape and motion:** Miguerre's Crescent of Chaos motion and shape (the same ragged-ink crescent arch), in Tess's black / violet / lavender / white, with the vertical spear and the white-hot ringed core of `new-ultimate.png`. It is very wide.
- **Phases:**
  1. **Compression:** the core gathers at Tess, the rings spin faster, and particles are drawn in.
  2. **Launch:** a flash, pressure rings and radial streaks.
  3. **Travel:** it sweeps up the screen at a medium pace.
     - Every bullet it touches is erased.
     - Regular enemies and mid-bosses on contact die at once, each with a white-violet flash and disintegration (mid-bosses get a larger implosion).
     - Bosses take heavy damage instead.
  4. **Critical compression:** at the top, the wings curl in, the core goes almost black with a thin white rim, then white.
  5. **Detonation:**
     - a flash and spherical shock front;
     - an expanding plasma sphere;
     - a towering, volumetric violet-black mushroom cloud;
     - a ground shockwave ring racing outward;
     - a fragmenting void halo whose pieces spin off as crescents;
     - screen distortion.
  6. **Aftermath:** the cloud lingers with lightning inside, and embers fall.
- No orange anywhere in the ultimate, as the guide asks.

### Lore: Miguerre Zo'Rajah's love interest

**Proposed bio:**

> Ex-syndicate infiltrator turned precinct ghost, and the one person Miguerre Zo'Rajah slows down for. Tess flies the Wireghost, a violet blade mecha that throws crescent cuts across the whole sky. She learned his void tricks the way she learns everything: by watching once, then doing it better.

**Proposed lore file line** (it keeps her Black Tide rivalry):

> Grew up on Black Tide smuggling skiffs. Miguerre Zo'Rajah is the only one who ever caught her picking his lock; she has been riding his slipstream ever since.

## Decisions needed

1. **Main attack numbers.** No range limit, pierce and bullet erasing make her much stronger than her current 29–116 DPS at 150 units.
   - **A (recommended):**
     - Crescents per volley: 2 / 3 / 4 / 6 (split across the two blades).
     - Size: ×1.0 / 1.25 / 1.5 / 1.8 (T4 is the old focus crescent's size).
     - Speed: 12 / 14 / 16 / 18 units per step, up from 9.5.
     - Damage tuned for boss DPS of about **45 / 80 / 120 / 165**: mid-pack, below Bruno, because bullet erasing is itself strong.
   - **B:** the same count, size and speed, with damage tuned to Bruno's level (50 / 84 / 131 / 193).
2. **Which arm throws.** A swing every 6 steps (10 per second) on both arms at once looks like trembling.
   - **A (recommended):** the arms alternate. Left volley, right volley; each arm gets a 12-step swing, and the fire rate is unchanged. The swinging arm throws that volley's crescents.
   - **B:** both arms slash together on every volley (a fast 6-step snap). The crescents split across the two blades, as today.
3. **Focus clone power.** You asked for "same power", which makes focus **3×** normal fire (T4 about 500 boss DPS with option 1 A).
   - **A:** full power, as written.
   - **B (recommended):** the clones throw at full size and speed but deal 60% damage (focus about 2.2×).
   - Placement: 70 units out to each side and 90 ahead of her, following her smoothly (not too close, not too far). They can't be hit (they are projections).
4. **Shadow Form cooldown.** The cooldown starts at activation. Today it is 12 s, which with 10 s of immunity would make her almost always immune.
   - **A (recommended):** a 30 s cooldown (10 s immune, 20 s down).
   - **B:** 25 s.
   - **C:** keep 12 s.
5. **Bomb numbers.**
   - **Recommended:**
     - The bomb lasts 2.5 s (up from 1.8 s) so the clones have time to appear, throw and fade.
     - Each wide crescent is 110 units across, hits each enemy once for 14 damage, and erases bullets in its band.
     - Thousand Cuts is unchanged.
   - Yes / adjust?
6. **Ultimate numbers.**
   - **Recommended:**
     - **Crescent:** 360 units wide (75% of the screen; Miguerre's is 300). It travels at 4 units per step, so it crosses in about 2.8 s.
     - **Damage on the way:** regular enemies and mid-bosses die on contact; bosses take 10 damage every 5 steps while in contact.
     - **Detonation** at the top: screen-wide, 80 damage once per enemy including bosses, and it clears every bullet.
     - **Timing:** about 8.5 s in total (0.6 s compression, 2.8 s travel, 0.7 s critical compression, 4.4 s detonation and aftermath).
   - Yes / adjust?
7. **Bio and lore text** as written above.
   - Yes / adjust?
8. **Size:** 90 units tall, hitbox unchanged at 2.2. The clones are copies drawn at the same size.
   - Yes / adjust?

## Removed

- **Removed:** Ghost Slash, the Cloak and its decoy, and the old Shadow Clones ultimate.
- **Kept:** the procedural sprite as the fallback.
- **Unchanged:** the sounds, apart from reusing the existing ones.

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **A, with a change:** the crescents don't fly straight. Each one launches at a random angle and chases an enemy in sight, at any range.
2. **A, with a correction:** the arms take turns swinging, and the crescents come out of the blade itself, along its length.
3. **B:** the clones deal 60% damage.
4. **A:** Shadow Form has a 30 s cooldown.
5. **Yes** (bomb).
6. **Yes** (ultimate).
7. **Lore:** Miguerre is a cosmic rogue; Tess travels in search of him and waits for him to come back.
8. **Yes** (size).

## Steps 2–6: results

### Art and rig

- **Processing.** `npm run art:tess`:
  - `bg: 'checker'` plus a new opt-in `bgPale`. The blades' pink halo tints the checker squares, which the normal checker rule leaves behind as white specks.
  - `bgPale` also removes the white core of each blade's glow line, so `tessFx.js` redraws it as an animated energy line.
  - Outputs: sprite 436×372 @2x; front view 432×600; the portrait is unchanged.
- **Parts.** One arm on each side, split at the elbow:
  - `armRoot` is the upper arm and elbow armour, with its pivot at the shoulder;
  - `armTip` is the forearm, clawed hand and blade.
  - The shoulder armour, leg blades (feet), torso, head and back spikes stay in the body.
- **Rig** (`src/pilots/tessRig.js`, her own; the shared `createRig` is for deploying weapon arrays). Every volley is one arm's slash, and the arms take turns:
  - the next arm winds back and out while the other one throws;
  - on release it snaps forward and inward across the body, follows through, and settles;
  - the elbow bends more than the shoulder, so the blade whips;
  - the blade flares and smears back along its arc while it swings.
- **Draw order:** upper arms, then the body, then the blades.
- **Clones:** they share the pose, so their arms swing with hers.

### Kit (all numbers in `src/pilots/tessTuning.js`)

- **Crescent Blades:**
  - Crescents per volley: 2 / 3 / 4 / 6.
  - Size: ×1.0 / 1.25 / 1.5 / 1.8.
  - Speed: 12 / 14 / 16 / 18 units per step.
  - Damage each: 2.3 / 2.75 / 3.05 / 2.75.
  - Behaviour:
    - The crescents leave the swinging blade between its base and its tip.
    - Each one launches at a random angle (up ± 0.75 rad) and chases a random enemy in sight until it hits it, then flies straight on.
    - They hit each enemy at most once (the engine's piercing re-hit is turned off for them).
    - They erase enemy bullets along their path, and fly until they leave the screen.
- **Glitch Clones (focus):**
  - Two clones, 70 units out to each side and 90 ahead of her.
  - They throw her exact volley from their own blades, only when she throws, at 60% damage.
  - Look: RGB split, scanlines, torn slices, flicker and sideways jumps. They spring out of her and collapse back.
- **Shadow Form (special):**
  - 10 s in which every attack phases through her (`intangible`).
  - 30 s cooldown from activation.
  - She keeps fighting. She is drawn as a black silhouette with a flickering violet edge, with smoke and embers.
- **Bomb:**
  - Lasts 2.5 s.
  - Her two clones come out for the whole bomb.
  - She and each clone throw a fan of three wide crescents (110 units across): nine in all. Each wave hits each enemy once for 14 and erases bullets.
  - Thousand Cuts is unchanged.
- **Void Cross Annihilation (ultimate):** 9 s.
  1. **Compression** (0.6 s): the core gathers at Tess, the rings contract and spin faster, light streaks and smoke are drawn in.
  2. **Launch:** a flash, pressure rings, radial sparks, a distortion wave and a shake.
  3. **Travel** (4 units per step):
     - **Shape:** Miguerre's crescent shape and motion (his shape helpers, now exported from `miguerreFx.js`), repainted black / violet / lavender / white and squashed flat into the cross's wings. A white crossbar, a void spear ahead with a tail behind, and a ringed white-hot core.
     - **Effects:**
       - plasma currents racing toward the spear;
       - lightning off the edges;
       - crescent shock fronts sweeping out ahead;
       - a wake and wing ribbons back to the launch point;
       - speed streaks, smoke spiralling off, and distortion.
     - **Hits:**
       - It erases every bullet it touches.
       - Regular enemies and mid-bosses die on contact: a white-violet flash, then they break into fragments carried forward. Mid-bosses also implode, then burst.
       - Main bosses take 10 damage every 5 steps.
  4. **Critical compression** (0.7 s) at y = 190: the wings curl in, the rings collapse one after another, and the shell cracks. Then the core goes black inside a thin white rim, and finally white.
  5. **Detonation:**
     - **Damage:** 80 to every enemy on the field (bosses included), exactly once; every bullet cleared.
     - **Effects:**
       - a flash that overpowers the screen;
       - a spherical shock front and a ground shockwave ring lifting debris;
       - a plasma sphere with void currents and fractures;
       - a mushroom cloud: a lit violet stem and a lumpy grey-violet cap lit from inside;
       - an outer void halo breaking into crescent blades that spiral out;
       - lightning inside the cloud.
  6. **Aftermath:** embers fall and everything fades over the last 70 steps.
  - There is no orange anywhere in the ultimate.
- **Removed:** Ghost Slash, the Cloak and its decoy, the old Shadow Clones ultimate, and the art-test `kickL` / `kickR` wing kick.
- **Kept:** the procedural sprite as the fallback (`&noart` works).
- **Data:**
  - **Role:** "Blade Mecha".
  - **Stats:** range 1 → 5, bomb 2 → 3.
  - **New bio:** Miguerre Zo'Rajah, her love, went rogue among the stars, and she searches sector to sector for the night he comes back.
  - **New lore file line** (`src/data/lore/pilots.js`).

### Tests

**Headless gameplay checks** (the real World and Player; the script is kept in the session scratchpad). All passed:

| Check | Result |
|---|---|
| Any range | Five far targets (both top corners, the left and right edges, top centre) were all hit at T4: 37 / 30 / 21 / 32 / 30 DPS. |
| Bullet cutting | 1,735 of 1,845 stationary bullets erased in 2 s of T4 fire, with no enemies. |
| One hit per crescent | 119 hits on an r = 50 boss from 120 crescents. |
| Volleys | T1–T4: 2 / 3 / 4 / 6 crescents. The arms alternate left → right. Focus throws 3× as many, the clones' share at exactly 60% damage. |
| Shadow Form | 0 hits in 590 steps of a dense aimed stream; 82 hits in the 1.5 s after. Cooldown confirmed. |
| Bomb | 9 wide crescents. Each enemy was hit by 3–5 waves, never twice by the same wave. |
| Ultimate | The regular enemy and the mid-boss died on contact. The main boss survived the sweep and took 130 from it. The nuke hit the boss and three far-corner enemies exactly once each. Phases ran compress → travel → crit → boom → end, leaving 0 bullets. |

**DPS** (`tools/dps.mjs tess`, boss target), before → after:

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot | 29 → 45 | 58 → 81 | 87 → 121 | 116 → 164 |
| Focus | 20 → 85 | 20 → 156 | 20 → 227 | 20 → 306 |

- Shot matches the approved targets (45 / 80 / 120 / 165).
- Focus is about 1.9× shot. It is below the 2.2× from 1 + 2 × 0.6 because the clones, 70 units out to each side, start further from targets.
- The old kit dealt 0 damage at 240+ units; now damage is the same at 120, 240 and 360 ahead.

**Frame rate** (1,500-bullet storm, headless Intel HD 5500; this machine's readings vary run to run):

| Situation | With art | Procedural |
|---|---|---|
| T4 firing | 57.5 FPS | 49.3 |
| Focus | 50.3 | 52.5 |
| Ultimate, first 3 s | 40.7 | 34.9 |
| Ultimate, next 3 s | 48.6 | 41.4 |

**Regressions:**
- Miguerre, Kairo, Mira and Bruno DPS are identical to the baseline. Miguerre's file only gained `export` keywords.
- All seven art pilots load, play every tier, focus, special, bomb and ultimate with no errors.

**Screenshots** in `screenshots/tess/v2/`:
- `sheet_poses` (rest, wound, follow-through, mixed);
- `sheet_fire`;
- `sheet_focus`;
- `sheet_shadow_bomb`;
- `sheet_ult` (every phase);
- `sprite_on_dark`.

### Known limitations

- The body is not articulated; only the arms move.
- The white core of the blades' glow is redrawn in code (`bgPale` removes it from the sprite).
- With many crescents on screen the field gets busy and pink. The crescents are toned down, but T4 focus (18 per volley) is still dense.
- When the cross detonates high on the screen, the top of the mushroom cloud can reach the screen edge.
- The sounds are unchanged (the special still uses the old cloak sound).
