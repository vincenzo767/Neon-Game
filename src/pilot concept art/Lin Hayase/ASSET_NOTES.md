# Lin Hayase — Asset Notes (Step 1)

Pilot: **Lin Hayase**, vehicle **PETAL ENGINE**. Built the same way as Kairo,
Mira, Bruno, Tess and Oduya (see `ART_PIPELINE.md` and their `ASSET_NOTES.md`).
The source folder is read-only. Coordinates are source pixels, origin top-left.
Branch: `art/lin-test` (based on `art/oduya-test`, which has the latest art
pipeline, FX and pilot sounds).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down-main.jpg` | 1319×1192 JPEG | **No**: a **painted checkerboard** (squares about 10 px, greys about 212 and 253) | **In-game sprite.** An emerald crystal knight with huge iridescent **butterfly wings**, flying feet-first like the others. From top to bottom: the two crystal **legs** (feet at the top, tips at y ≈ 100), a forward spike at the waist, the torso, the head, and a long rear crest spike. In his right hand (screen right) a long **emerald spear**, tip pointing forward (tip at y ≈ 20). In his left hand a segmented **crystal whip**, raised up and out to the left. Teal and emerald crystal, pale glowing trim, black line art. The body and wings are mirror-symmetric about x ≈ 660; the spear and whip are not. | The flood fill can't remove a checkerboard: its two greys and their sharp edges both stop it. It needs a new **checkerboard rule** (see Step 2). There are enclosed checker pockets between the whip segments, legs, wings and spear. The spear crosses the right wing and the whip crosses the left wing (see "Wings"). At 90 units tall the mecha is about 100 units wide. |
| `top-down-front.jpg` | 1319×1192 JPEG | **No**: the same painted checkerboard | Front view, upright: head and crest at the top, butterfly wings spread, spear (point down) in his right hand, whip trailing on the left. Select-card preview and cut-in. | Same checkerboard removal. |
| `pilot-portrait.jpg` | **240×338** JPEG | No | A young man with short auburn hair and amber eyes, lying back with his hands behind his head, in a yellow hooded top. White background. | **Very small.** It is upscaled about 2× for the 432×540 portrait, so it will look soft. A 4:5 head-and-shoulders crop of about 200×250 at (20, 0). Fits a male pilot. |
| `swarm-turrets.png` | 1672×941 PNG RGB | **No**: painted checkerboard | **Swarm turret concept.** Winged crystal drones (front, side and banked views), drones rising from a glowing ring, swarm formations, dash streaks, and splitting crystal spears (small spears breaking into fans, a radial burst). | Reference, plus **one cut-out**: the first drone (top left, wings spread, about 300×250) becomes the swarm turret sprite. It has a soft green glow baked over the checkerboard, so the cut-out drops the glow and the code redraws it. |
| `fx-reference.png` | 1672×941 PNG RGB | No: painted checkerboard | Emerald spears from small to large, some with ring halos; long horizontal **giant spears** with crescent rings and shard trails; a spear impact with a ground ring and crystal spikes; the big **cosmic spear** with stars and a ring; a star-burst ring; and a row showing the **butterfly wings flapping** (spread, folding, swept, motion arcs). | Reference only (rebuilt in code). Colours: **glowing emerald green, black, white.** |
| `parts-sheet.png` | 1672×941 PNG RGB | Painted black background | Front, side and back views; loose wings, spears, whip segments, hands, armour. | Reference only. |

## Facing

`top-down-main.jpg` flies **up** feet-first, the same as the others. **The two
crystal legs at the top are his feet: they never fire.** No rotation is needed.

## Anchor estimates (`top-down-main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest centre) | (660, 640) | — | Lands on `player.x/y`. |
| Head | (660, 760) | — | Reference. |
| **Core** (`core`) | (660, 400) | — | Tip of the forward waist spike, 18 units ahead. Main-shot origin. |
| **Spear tip** (`spear`) | — | (965, 30) | 47 units ahead and 24 to the right. Focus-spear origin (see Question 2). |
| Spear grip | — | (950, 480) | Reference (his right hand). |
| **Whip tip** (`whip`) | (125, 40) | — | Reference; the whip is drawn, not fired. |
| **Wing roots** (`wingL/R`) | (540, 700) | (780, 700) | Flap pivots. Wing glitter rises from here (no thrusters). |
| Leg tips (feet) | (465, 100) | (855, 100) | **Never fire.** |

**Scale.** The art is about 1160 px tall, so at 90 units 1 source pixel is
about 0.078 units.

## The owner's new design (already decided)

- **Male pilot.** Bio, lore and fallback portrait change to a man; the portrait is the new painting.
- **Focus (new):** glowing emerald **spears that split on every enemy** they hit. During focus, the **swarm turrets fire the same splitting spears**.
- **Special (new):** a **field of roots** that covers enemies and stuns them, then **crushes** them.
- **Bomb (new):** a rain of countless cosmic emerald spears over a wide area, **ignoring shields**, for **3 seconds**.
- **Ultimate (new):** a **gigantic cosmic emerald spear** launched forward that clears everything in its path and deals massive damage, leaving a glowing cosmic path with stars (as in the FX reference).
- **No thrusters.** The butterfly wings **flap**, animated by his movement.
- **Colours:** glowing emerald green, black and white for every shot, hit and explosion.
- **Size: 90 units tall.**
- **No feet fire.**

## Lin's weapons today

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot, boss | 38 | 52 | 66 | 79 |
| Shot, line of 6 | 30 | 51 | 57 | 78 |
| Focus, boss | 38 | 52 | 66 | 80 |

(`tools/dps.mjs lin`.) The roster's median boss DPS at full power is about 95, so
Lin is currently one of the weaker pilots.
- **Main:** a fan of petals, plus a seed every few volleys that roots as a stationary turret (homing needles; turrets also eat bullets that touch them).
- **Focus:** petals narrow into a stream, and every turret fires at the locked target.
- **Options:** 1–3 orbiting buds that fire needles.
- **Special:** Bloom (5 turrets in a ring). **Bomb:** Petal Storm. **Ultimate:** Forest of Light.

## Proposed mapping (needs your decision)

1. **Main shot** (not in your list).
   - **A (recommended):** keep his gardener idea in the new look. A fan of small emerald crystal shards from the waist spike. Every few volleys a seed flies out and grows into a **swarm turret**, the winged drone from `swarm-turrets.png`, hovering with flapping wings. The turrets still fire at nearby enemies and eat bullets that touch them. The orbiting buds become small drones too.
   - **B:** the main shot is also a stream of (non-splitting) emerald spears, with no planted turrets; the turrets only fly with him as options.
2. **Where the focus spears leave.**
   - **A (recommended): from his spear.** The spears launch from the held spear's blade (about 30 units ahead, not the far tip, so his range isn't longer than everyone else's). They are aimed to cross his centre line, the same trick as Bruno and Tess, so he hits what is in front of him.
   - **B:** from the waist spike at the centre (simpler, but the spear in his hand does nothing).
3. **How the spears split.**
   - **A (recommended):** when a spear hits an enemy it **splits into 3 shards** that fly at the 3 nearest *other* enemies (within about 160 units) for half damage each. The shards don't split again.
   - **B:** the shards split again once more (two generations). This is much stronger against waves and busier on screen.
4. **Root field size** (the special).
   - **A (recommended): a large field around him** (radius about 200 units, nearly half the screen width). Roots burst from the ground and wrap every enemy in it, holding them for 1.5 s, then crush them. Lethal to normal enemies; bosses can't be stunned and take heavy damage. The roots also eat bullets in the field. This keeps it different from Oduya's screen-wide Thundershock.
   - **B:** the whole screen.
5. **Power level.**
   - **A (recommended): strong but fair.** Raise him from 79 to about 95–100 boss DPS at full power (the median), with the splitting spears giving him strong wave clear.
   - **B:** keep today's numbers.

Already settled, no answer needed:
- **Bomb: Spear Rain.** 3 s (180 steps) of emerald spears falling across the whole screen. Each one lands with a small burst (green ring, crystal spikes, white flash) and damages a wide area through boss shields (`DMG_IGNORES_SHIELDS`). It clears enemy bullets. The bomb stock stays at 3.
- **Ultimate: Cosmic Spear.** A short charge (the spear glows, stars gather), then a giant emerald spear about 110 units wide launches up the screen from his position. It clears bullets and deals massive damage to everything in its path. A cosmic rift (black and deep green with stars, white sparkles and crescent rings) stays behind for about 2.5 s and keeps hurting anything inside. The duration is about 4 s in total.
- **Wings instead of thrusters.** No flames at all. The wings flap: a slow, gentle beat when idle; faster and deeper when moving; strongest when flying up; folded back during a dash. A flap squashes each wing toward his body about its root, like a butterfly seen from above, and adds a slight rotation. A faint trail of emerald glitter falls from the wings.
- **Colours.** Every shot, hit and explosion is black and deep green outside, glowing emerald in the middle and white at the core.

## Wings (layer split plan)

Same method as the others: feathered polygons plus the exact alpha complement for the body, with two changes for Lin.

- **Left wing:** the left butterfly wing. **Right wing:** the right butterfly wing. Each pivots at its wing root.
- **Body:** legs, torso, head, crest, **spear and whip**.
- **The wings are drawn under the body**, because they sit behind him and the spear and whip must stay on top while the wings flap.
- **The weapons cross the wings.** Where the spear (right) and whip (left) cover a wing, the wing layer has no pixels of its own. Step 2 fills those spots with the matching pixels of the mirrored wing (the wings are mirror images), so the moving wing has no hole and no "ghost" copy of the weapon. A small corner covered on both sides is filled from its neighbours.
- **Motion:** a new optional `flap` pose in `mechaArt.js` (per side: squash toward the root plus a small rotation). Other pilots are unchanged.

## Other notes

- **Data (step 5).** A male pilot: the bio and lore line are rewritten (he/him), the fallback portrait gets short auburn hair and amber eyes, and the role stays "Bio-tech Craft". The vehicle name "PETAL ENGINE" stays unless you want a new one.
- **Swarm turret sprite.** Cut from `swarm-turrets.png` into `lin_turret.png`. Its baked glow is removed and redrawn in code.
- **Background removal.** `tools/process-art.mjs` gets an optional `bg: 'checker'` setting. A pixel counts as background when it is light and neutral grey; the black line art stops the fill. Enclosed pockets are found automatically: any large light, neutral area containing both checker greys. The other pilots' settings are unchanged.

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Main shot: A.** Emerald shards plus seeds that grow into swarm turrets; the options become small drones.
2. **Spear origin: A.** From the spear's blade (about 30 units ahead), aimed to cross his centre line.
3. **Splitting: A.** 3 half-damage shards at the 3 nearest other enemies; no second split.
4. **Root field: A.** A large field around him (radius 200).
5. **Power: A.** Strong but fair.
6. The vehicle name stays **PETAL ENGINE**.

## Steps 2–6: results

- **Processing.** `npm run art:lin`.
  - New `bg: 'checker'` rule; 12 enclosed checker pockets were found automatically.
  - Sprite exports: 409×372 @2x and 205×186 @1x, with outline variants. Front view: 661×600.
  - Portrait: a 200×250 crop at (20, 0) of the 240×338 painting (upscaled, so a little soft).
  - Turret: `lin_turret.png` (163×120), cut from the first drone on `swarm-turrets.png`, turned to face up.
- **Wings.** Generated from the `wings` config:
  - `lin.layers.json` has `under: true` and `keep` polygons for the spear and whip.
  - `lin_wings@2x.png` / `lin_wings_outline@2x.png` fill the wing pixels under the weapons from the mirrored wing.
  - The wing polygon runs past the image edges, so no static wing tips are left behind when the wings beat.
- **Anchors** (`lin.anchors.json`, @2x):
  - `core`: the waist spike; shard origin.
  - `blade`: the spear blade; spear origin.
  - `spear`, `whip`, `head`: reference.
  - `wingL/R`: glitter.
  - `hitbox`.
- **Code.**
  - `src/pilots/linArt.js`: config (size 90, `flap`, turret extra, emerald palette, `DARK`).
  - `src/pilots/linFx.js`: spear, shard, root and crystal textures; shots, hits, bursts, turrets, glitter, root field, rain, cosmic spear.
  - `src/pilots/lin.js`: the new kit.
- **Shared, all optional; other pilots unchanged and checked.**
  - `mechaArt.js`: `keep` areas, separate wing images, `under`, `flap`, `extras`.
  - `World`: `shotHit` hook.
  - `Player`: `renderOptions` hook.
  - `process-art.mjs`: checkerboard, wings, turret.
- **DPS** (`tools/dps.mjs lin`):

  | Mode | T1 | T2 | T3 | T4 |
  |---|---|---|---|---|
  | Shot, boss | 40 | 58 | 77 | 97 |
  | Shot, line of 6 | 31 | 57 | 66 | 96 |
  | Focus, boss | 36 | 70 | 87 | 104 |
  | Focus, line of 6 | 89 | 175 | 217 | 261 |

  - Old kit at T4: shot boss 79, focus boss 80, line 78–79.
- **Special.** Uses the shared `stun()`; bosses can't be held. The crush is lethal to normal enemies (`max(30, hp × 4)`) and deals 40 to bosses.
- **Data.**
  - The bio and lore line are now male ("his").
  - The fallback portrait has short auburn hair, amber eyes and a yellow top.
  - Stats: power 4, bomb 4.
- **Frame rate.** Storm: about 53 FPS with art versus 49 procedural.
  - The first version ran at 26 FPS. Every turret switched between the pilot texture and the atlas; drawing the turrets in three passes fixed it.
  - Special, bomb and ultimate hold 60 FPS.
- **Screenshots** are in `screenshots/lin/`:
  - `14_l_flap_spread` / `14_l_flap_raised`: wing beat;
  - `14_l_main_t4`: shards and turrets;
  - `14_l_focus_t4`: spears;
  - `14_l_special_*`: Root Field;
  - `14_l_bomb`: Spear Rain;
  - `14_l_ult_*`: Cosmic Spear;
  - plus select, cut-in, storm and fallback.
- **Known gaps.**
  - Lin's sounds are still the old seed-pod pluck and bloom chime (no new sound was requested).
  - The 2048-atlas warning (`retrying smaller`) is the same on the Oduya branch; it isn't new.

## Revision: FX from the owner's picks

The owner picked four images as the exact look (saved in `tools/art-ref/lin/`; the concept folder is untouched):

1. **Cosmic Spear** (`cosmic-spear.png`). The giant spear of the ultimate. Its path is now a **void of empty space with stars**: black, a hair-thin emerald rim, many faint pin-point stars, fewer bright four-point stars and a few emerald ones, drifting and twinkling. No nebula and no rings.
2. **Main-shot arrows** (`shot-arrow.png`). The basic attack: crystal spears with black edges, emerald body and a white core. The turret and option needles use smaller copies.
3. **Focus spears** (`focus-spear.png`). The focus attack, the split shards (smaller), and the spears falling in Spear Rain.
4. **Bomb hit** (`bomb-star.png`). Every Spear Rain hit opens this star seal: it grows, turns slightly and fades. Big spears get a bigger seal and a burst. Half the small hits use a plain spark, so the seals don't stack into a cloud.

How they are made:
- `process-art.mjs` reads the new `fx` config and writes `lin_fx_<name>.png`.
- The images have a painted checkerboard and baked glow, so they are **un-blended**:
  - the checkerboard becomes transparent;
  - each other pixel gets the least opacity that explains its difference from the grey background;
  - pale glow becomes translucent emerald (smoothed and tinted);
  - black crystal and white cores stay solid.
- In game the picked art is drawn alpha-blended (so the black reads) over a soft additive emerald glow.

Where they live:
- The arrow and spear are in the shared atlas: they are drawn many times a frame, so they never switch textures.
- The cosmic spear and star seal are in Lin's own texture (`extras`); the seals are drawn in passes.
- Atlas fill is 87.0 % on 4096 (was 86.5 %) and 84.8 % on the 2048 fallback.

**The path is drawn under the enemies** (new optional World hook `renderUnder`), so a boss inside it stays visible.

Damage is unchanged. In the storm Lin runs at about 50 FPS with art versus 45 procedural.


---

# Rebuild v2 (Step 1)

Branch: `art/lin-v2`, on top of `art/oduya-v2`. No new art: the current `top-down-main.jpg` stays. The source folder stays read-only.

**The owner's brief:**
- the emerald shards come out of the **whip**;
- the whip is placed **in front of the mecha**, and its crystals glow with every attack;
- the **ultimate** is redrawn: the void much more noticeable, cracked space along its edges, and a stronger charge before the spear is thrown;
- a **wider special**;
- an **enhanced bomb**;
- overall FX motion and animation like Kairo, Mira, Bruno, Tess and Oduya v2.

## Components (source px; sprite 1319×1192, mirror axis x 660)

| Part | Where | Role |
|------|-------|------|
| **Whip** (left hand) | A chain of about 12 crystal blades from the handle at about (470, 580), curving up and left to the tip at (140, 12) | **Throws every shard.** It is animated: it swings out in front and lashes with each volley, and its crystals glow as the shards leave them. Split in two (handle half / tip half) so the tip whips behind the handle. |
| **Spear** (right hand) | Shaft from the tip at (955, 15) through the guard and hand at about (955, 560) to the broad lower blade ending at (950, 900) | Focus spears and the ultimate. It is animated: a thrust along its axis on each throw; it is raised and drawn back during the ultimate's charge. |
| **Butterfly wings** | Left and right, under everything | Animated: they keep beating as they do now, flaring in the charge and the special. |
| Crystal legs (feet), waist spike, torso, head | Centre | Body. **The feet never fire.** |

**Hidden wing art.** The whip and spear are painted over the wings. When they move, the wing art under them must be filled in:
- from the mirrored other wing;
- where both sides are hidden (a small strip near the whip handle), from neighbouring wing pixels.

This is a new opt-in `fill` step in `process-art`. The art test already filled the wings this way for the flap (`keep` + `wings2x`).

**Wing beat.** The rig path can only scale layers evenly. A new opt-in `sx` (horizontal scale) on rig poses keeps the butterfly beat. Other pilots don't set it.

## Today's kit (baseline, `tools/dps.mjs lin`)

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot, boss | 40 | 58 | 77 | 97 |
| Focus, boss | 36 | 70 | 87 | 104 |

- **Main: Crystal Seed.** A fan of 2 + tier shards from the waist spike every 6 steps. Seeds grow into swarm turrets, and option turrets orbit him.
- **Focus: Emerald Spears.** Spears leave the spear blade, split on hit, and the turrets throw them too.
- **Special: Root Field.** It holds every enemy within **200** units for 1.5 s, then crushes them.
- **Bomb: Spear Rain.** 3 s of crystal spears falling, damaging through shields.
- **Ultimate: Cosmic Spear.** A 0.8 s charge at the spear blade, then a giant spear flies up. It hits everything it passes once for 120 and leaves a starry black rift (a damaging beam) for about 3 s.

## Proposed redesign (beginning → travel → impact, like the others)

### Main: Whip Shards

- **Beginning:**
  - The whip swings out in front of him, lashing alternately left and right across the front with each volley.
  - The handle leads and the tip half whips after it.
  - The crystals light up in a wave from the handle to the tip.
- **Travel:** the 2 + tier shards leave the glowing crystals along the whip and fly in the same fan as today. They are aimed through the old fan's lanes, so damage and reach stay the same.
- **Impact:** an emerald crystal spark burst, as today.
- Seeds and turrets are unchanged.

### Focus: Emerald Spears

- **Beginning:** the spear thrusts forward along its axis and flashes at the blade.
- **Travel:** the spears fly as now.
- **Impact:** they split, as now.
- Damage is unchanged.

### Special: Root Field (wider)

- **Beginning:** he plants the spear, the whip coils, and a shockwave of roots bursts out.
- **Travel:** the field spreads to the new radius, with roots racing out along the ground and crystal spikes rising.
- **Impact:** the crush, with crystal shatter bursts at each held enemy.

### Bomb: Spear Rain (enhanced)

- **Beginning:** he raises the spear, and an emerald portal of cracked sky opens across the top of the screen.
- **Travel:** the same 3 s of spears falls out of it, with longer streaks, crystal trails, star seals and crystal blooms at the impacts.
- **Impact:** a closing burst as the portal shatters.
- Damage is unchanged.

### Ultimate: Cosmic Spear (redrawn)

1. **Charge** (longer and stronger):
   - the spear is raised and drawn back, and the wings flare;
   - a sphere of black space opens round the blade with stars streaming into it;
   - emerald rings spin faster, crystal shards grow into a crown round the spear head, and space starts to crack round the sphere;
   - the light dims, then flashes.
2. **Throw:** the spear thrusts and launches the giant spear (flash, shockwave, shake).
3. **Rift:**
   - The void is a deep black band, wider than today and clearly visible: nebula colour, drifting stars, a slow swirl inside.
   - Its edges are **cracked space**: jagged white-emerald fracture lines along both edges, with branches spreading out, shards of space flaking off and sparkling, and the cracks pulsing.
4. **Close:** the cracks seal and the void fades.
- Damage is unchanged (one 120 hit as the spear passes, then the rift's beam damage).

## Decisions needed

1. **Where the whip goes.**
   - **A (recommended):** swung out in front of the mecha. It turns about his left hand to point forward, ahead of his left side, and lashes across the front with every volley. The wing art it uncovers is filled in (see above).
   - **B:** it stays at his side as painted, and lashes in place.
2. **Shard origin.** The shards leave the whip's crystals (along its length), aimed through today's fan lanes so damage stays the same. Yes / adjust?
3. **Special radius.**
   - **A (recommended):** 200 → **300**.
   - **B:** 260.
   - The hold, crush and cooldown are unchanged.
4. **Ultimate charge length.**
   - **A (recommended):** 0.8 → **1.2 s**, to give the charge time to read. The total stays 4 s, so the rift is a little shorter.
   - **B:** keep 0.8 s.
5. **Ultimate rift width.**
   - **A (recommended):** drawn about 40% wider (the void and its cracks); the damaging width is unchanged.
   - **B:** the damaging width grows with it.

## Unchanged

The stats, the tiers, the size (90 units), the hitbox (2.4), the seeds, swarm turrets and option turrets, the bomb's damage, the bio and the procedural fallback.
