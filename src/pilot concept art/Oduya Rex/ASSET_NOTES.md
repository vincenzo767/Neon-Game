# Oduya Rex — Asset Notes (Step 1)

Pilot: **Oduya Rex**, vehicle **THUNDERJAW**. Built the same way as Kairo,
Mira, Bruno and Tess (see `ART_PIPELINE.md` and their `ASSET_NOTES.md`). The
source folder is read-only. Coordinates are source pixels, origin top-left.
Branch: `art/oduya-test` (based on `art/tess-test`, which has the latest art
pipeline and FX).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down-main.jpg` | **1337×1176** JPEG (landscape) | **No**: solid black background | **In-game sprite.** Same layout as the others: the mecha flies feet-first. From top to bottom: the two gold **drill legs** (feet at the top, tips at y ≈ 20), the waist with a central gold spike, two **arm cannons** with gold fists pointing up-forward, the torso, the gold **lion head**, and a gold flame mane trailing at the back. Two huge black-and-blue **lightning wings** sweep out to both sides. Black armour, gold trim, blue lightning glow. Mirror-symmetric about x ≈ 668. | Needs background removal (black border, a few bright pixels where the wings touch the edge). It is wider than it is tall: at 100 units tall the mecha is about **114 units wide**, nearly a quarter of the screen. The red-glow rule should be off. |
| `top-down-front.png` | 1337×1176 PNG **RGBA** | Probably yes | Front view, upright: lion helmet with a gold flame crest, wings spread, fists, drill legs. Select-card preview and cut-in. | The script checks for real alpha and only removes the background if it is missing. |
| `pilot-portrait.jpg` | 736×1004 JPEG | No | An old bearded god with a laurel crown, glowing white eyes, a raised fist and a lightning bolt, and an eagle on his shoulder. Warm gold light. | Needs a head-and-shoulders crop (about 560×700 around the face) with the new `portraitCrop` setting. It matches the new "god of thunder" bio. |
| `parts-sheet.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Front, side and back views; lion heads, drills, wings, fists, armour pieces. | Reference only. |
| `fx-reference.png` | 1672×941 PNG RGB | **No**: painted checkerboard | Lightning strikes from above with ground bursts, **thunder spears** (trident tips, ring halos), **forked chain arcs**, slash crescents, a lightning tornado, thruster plumes. All **blue outside, white inside**. | Reference only (rebuilt in code). |

## Facing

`top-down-main.jpg` flies **up** feet-first, the same as the others. **The gold
drill legs at the top are his feet: they never fire.** No rotation needed.

## Anchor estimates (`top-down-main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest centre) | (668, 480) | — | Lands on `player.x/y`. |
| **Fists** (`fistL/R`) | (305, 430) | (1031, 430) | Gold knuckles of the arm cannons, pointing up. **Proposed lightning origin.** |
| **Crown** (`crown`) | (668, 170) | — | The central gold spike at the waist front. Alternative origin. |
| Head | (668, 640) | — | Gold lion head. Reference. |
| **Wing roots** (`ventL/R`) | (330, 760) | (1006, 760) | Rear of the wings: wide back plumes. |
| **Mane** (`maneL/R`) | (630, 1000) | (706, 1000) | Gold flame mane: two smaller plumes. |
| Wing tips | (20, 400) | (1316, 400) | Reference only. |
| Drill tips (feet) | (370, 20) | (966, 20) | **Never fire.** |

**Scale.** At 100 units tall, 1 source pixel is about 0.085 units. The fists sit 31 units out from the centre and 4 units ahead of the hitbox.

## The owner's new design (already decided)

- **Bio and lore:** an immortal deity, the god of thunder.
- **Main shot (new):** no bullets. A **lightning strand** that locks on and chains between targets, like the old focus strand. Each tier adds chains, **up to 10**. Each hit also **arcs to enemies around it**. Very fast, like real lightning.
- **Focus (new):** the lightning becomes several **thunder spears** that fire as fast as lightning.
- **Special (new):** a lightning shock that **stuns and electrifies** enemies for 2 seconds, then **makes them explode**.
- **Bomb:** Storm Cell as now, but **5 bombs** in stock instead of 3.
- **Ultimate (new): God Thunder Barrage.** A huge area of lightning from above that strikes everything on the screen.
- **Colour:** blue outside, white inside, for every bolt, hit and muzzle flash.
- **Lightning:** thick, wide and fast.
- **Size: 100 units tall** (the others are 90). The hitbox stays 3.0.
- **No feet fire.**

## Oduya's weapons today (being replaced)

| Mode | Boss | Small | Line (6 targets) |
|---|---|---|---|
| Shot T1 → T4 | 30 → 96 | 29 → 85 | 49 → 213 |
| Focus T1 → T4 | 33 → 62 | 32 → 62 | 49 → 112 |

(`tools/dps.mjs oduya`.) The roster's median boss DPS at full power is about 95. Main: twin bolts plus arcing plasma mortars. Focus: twin bolts plus a 2–3 hop chain strand. Options: 2–4 tesla coils that fire bolts.

## Proposed mapping (needs your decision)

1. **Where the lightning leaves.**
   - **A (recommended): from both fists.** The strands and spears leave the two gold fists, alternating left and right.
   - **B:** from the crown spike at the front centre.
2. **Power level.** The new weapons hit many targets at once. That is a big jump against waves, so:
   - **A (recommended): a strong god, still fair.** Boss DPS at full power stays near today's (about 95–110 in both modes, around the median). The power shows against waves: the chains, the arcs to nearby enemies, and the screen-wide ultimate clear crowds much faster than anyone else.
   - **B: overwhelming, like Vincenzo (the Legendary pilot).** Much higher DPS everywhere. This would make him the strongest standard pilot by far.
3. **Chain count per tier.** Tiers go 1–4, so I propose **3 / 5 / 7 / 10** strands, with a short arc to every enemy within about 50 units of each hit.
4. **The option coils.** Today they fire bolts.
   - **Recommended:** they stay as tesla coils and fire short lightning arcs at the nearest enemy (blue and white like the rest), so nothing in his kit is a bullet.

Already settled, no answer needed:
- **Special.** Every enemy on screen is stunned and electrified for 2 seconds (crackling arcs), then explodes. Bosses can't be stunned, so they take the damage only. The cooldown stays at 600 steps.
- **Ultimate.** Bolts rain from the top of the screen across the whole width, wave after wave, for about 4 seconds. It hits everything on screen and clears enemy bullets.
- **Thrusters.** Blue and white: wide plumes from the wing roots, two smaller ones from the mane.

## Layer split plan

Same method as the others: feathered polygons plus the exact alpha complement for the body.

- **Left wing:** the lightning wing, arm cannon and fist on that side. Pivot at the shoulder, about (480, 600).
- **Right wing:** the mirror about x ≈ 668.
- **Body:** drill legs (top), waist, torso, lion head and mane.
- **Motion:** the same as the others. The fists recoil slightly with each bolt.

## Other notes

- **Data (step 5).** The role "Hover Tank" becomes "Thunder God Mecha". The bio and lore line are rewritten for an immortal god of thunder. The fallback portrait matches the painting (white beard and hair, laurel, glowing eyes). Bomb stock goes from 3 to 5.
- The old name "Oduya Rex" stays.

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Origin: A.** All lightning leaves the two gold fists, alternating.
2. **Power: A.** Strong but fair: boss DPS near the roster median, with the power showing against waves.
3. **Strands evolve, not power tiers.** Hits and time add strands, every 10 seconds, up to 10. Power-ups don't change his strength.
4. **Coils.** No bullets: they throw lightning arcs.
5. **Ultimate.** Extended to 7 seconds.

## Steps 2–6: results

- **Processing.** `npm run art:oduya`.
  - Sprite exports: 421×372 @2x and 211×186 @1x, with outline variants. Front view: 681×600.
  - Portrait: a 480×600 crop at (150, 60): face, crown and beard.
  - The art texture needs 2048² (the automatic fallback from 1024²), because the sprite is so wide.
- **Anchors** (`oduya.anchors.json`, @2x): `fistL/R`, `crown`, `ventL/R`, `maneL/R`, `head`, `hitbox`.
- **Layers** (`oduya.layers.json`): each side is the lightning wing, arm cannon and fist. Pivot at the shoulder.
- **Code.**
  - `src/pilots/oduyaArt.js`: config at size 100.
  - `src/pilots/oduyaFx.js`: bolt renderer, nodes, crackle, sky strikes.
  - `src/pilots/oduya.js`: the new kit.
  - `tools/dps.mjs`: optional `dpsLevel(p, tier)` hook for pilots whose strength isn't the power tier.
- **Strand evolution.**
  - `EVO_STEP = 600` steps (10 s) per strand; `EVO_PER_HIT = 0.5`.
  - A toast "THUNDER · n STRANDS" and a ring pulse mark each new strand.
  - Death costs 2 strands (minimum 3).
- **DPS** (`tools/dps.mjs oduya`; "T1–T4" = 3 / 5 / 7 / 10 strands):

  | Mode | 3 | 5 | 7 | 10 strands |
  |---|---|---|---|---|
  | Strand, boss | 42 | 65 | 73 | 99 |
  | Strand, line of 6 | 133 | 230 | 277 | 346 |
  | Spears, boss | 28 | 56 | 71 | 99 |

  - Old kit at full power: shot boss 96 / line 213, focus boss 62.
- **Special.** The stun uses the shared `stun()`; bosses can't be stunned. The detonation is lethal to normal enemies (`max(30, hp × 4)`) and deals 30 to bosses.
- **Data.**
  - The role is "Thunder God Mecha", and the bio and lore line describe an immortal god of thunder.
  - The fallback portrait has white hair and beard and glowing eyes.
  - Bomb stock is 5, and the bomb stat bar is maxed.
- **Frame rate.** Storm: about 58 FPS with art versus 56 procedural. The ultimate holds 60 FPS after its cut-in.
- **Screenshots** are in `screenshots/oduya/`:
  - `14_o_strand3` / `14_o_strand10`: strands;
  - `14_o_spears10`: spears;
  - `14_o_special_*`: Thundershock;
  - `14_o_bomb`: Storm Cell;
  - `14_o_ult`: God Thunder Barrage.
- **Known gaps.**
  - The HUD's PWR bar still shows the power tier, which no longer matters for him. The strand count is shown by the toasts.
  - The coils are the old procedural sprites.

## Revision: thunderstorm sound (owner request)

All in `src/audio/pilotVoices.js` (the `oduya` voice plus the thunder helpers `crackle`, `rumble` and `thunderclap`). Every sound is synthesised, with no audio files.

- **Main strand.** An electric crackle with a low buzz on every strike. Each strike counts as a shot for the audio director (`w.shotsFired++`), because strands spawn no projectile. Now and then a distant roll plays, so sustained fire sounds like a storm.
- **Thunder spears (focus).** A whip crack with a falling zap.
- **Thundershock.** A close thunderclap, 2 s of crackling over the stunned enemies, then a big clap as they explode.
- **Storm Cell.** A big clap, then a strike every 0.2–0.4 s for the whole bomb over a continuous rolling rumble.
- **God Thunder Barrage.**
  - During the cut-in: charged air, crackles and a distant roll.
  - Then 7 s of storm: random claps, a heavier clap on every half-second strike, and rolling thunder underneath.
  - The music stays ducked for the whole 7 s.
- **Shared change.** `sfx.bomb` and `sfx.ultimate` use a pilot voice's own `bomb` / `ultimate` sound when it has one (new `voiceFx`). Every other pilot keeps the generic sounds.
- **Levels.** Output peaks are about 0.82–0.87, the same range as the other pilots' bombs and ultimates, and the limiter is never pushed. During the ultimate about 235 sound nodes are live (most of them scheduled ahead).

---

# Rebuild v2 (Step 1)

Branch: `art/oduya-v2`, on top of `art/tess-v2`. The owner keeps the current sprite (`top-down-main.jpg`); no new art. The brief:
- every lightning attack must visibly come from his hands, with motion;
- the lightning's glowing look stays;
- every effect is redesigned as a coherent animated attack with a beginning, a traveling phase and a final detonation;
- the animation and motion standards match Kairo, Mira, Bruno and Tess v2.

The source folder stays read-only.

## Components (source px, L side; R = 1336 − x, axis 668)

| Part | Where | Role |
|------|-------|------|
| **Gauntlet + gold fist** | Knuckles at about (305, 425), gauntlet down to the wrist ring at (395, 620) | **Throws every bolt.** It is animated and punches along its own axis. |
| **Elbow joint + upper arm** | White joint at about (430, 670) → shoulder at about (480, 750) | Animated: carries the punch and the wind-up. |
| **Lightning wing** | Black-and-blue blade panels from the root at about (430, 830) out to the tip at (20, 400) and down to (40, 1130) | Animated: flares out while charging and during the ultimate, and folds back while firing. The painted lightning on it crackles. |
| Drill legs (feet) | Top, tips at (370, 20) / (966, 20) | Body. **Never fire.** |
| Waist spike, torso, lion head, gold mane | Centre line | Body. |

**Proposed anchors:**
- `hitbox` (668, 480);
- `fist` (305, 430), the knuckles, where every bolt leaves;
- `wrist` (395, 620), `elbow` (430, 675), `shoulder` (480, 750);
- `wingRoot` (430, 830), `wingTip` (20, 400);
- `vent` (380, 900) and `mane` (640, 1060) for the thrusters, as today.

**Scale and hitbox** stay as today: 100 units tall, hitbox 3.0.

## Rig plan (Tess-style own rig on the shared rig path)

**Parts:**
- `arm`, split at the elbow:
  - the root is the elbow joint and upper arm (pivot at the shoulder);
  - the tip is the gauntlet and fist.
- `wing` (excludes the arm).

**Punch** (every bolt):
1. **Wind-up:** the gauntlet draws back down its axis and the elbow cocks, while blue sparks crackle round the fist.
2. **Thrust:** the gauntlet shoots out along its axis toward the target side, and the shoulder turns a little toward the target. The bolt leaves the knuckles at full extension.
3. **Recoil:** a short kick back.
4. **Settle.**

The fists take turns, as they do now.

**Wings:**
- they flare while charging (special, bomb, ultimate) and in focus;
- they fold back with each punch;
- their painted lightning flickers in time with the strikes.

## Today's kit (baseline, `tools/dps.mjs oduya`)

Damage by strand level (3 / 5 / 7 / 10 strands):

| Mode | Boss | Wave (line) |
|---|---|---|
| Strand | 42 / 65 / 73 / 99 | 133 / 230 / 277 / 346 |
| Focus spears | 28 / 56 / 71 / 99 | — |

- **Strand:** a bolt from one fist every 4 steps (fists alternating), chaining through up to `strands` targets (3, growing to 10 as he fights) and arcing to enemies near each hit. The damage is instant.
- **Focus:** volleys of piercing thunder spears from one fist.
- **Coils:** tesla-coil options appear from 5 strands (4 from 8) and throw short arcs. **These don't come from his hands.**
- **Special:** Thundershock. It stuns every enemy for 2 s, then they explode.
- **Bomb:** Storm Cell. Sky bolts for 2 s, 5 in stock.
- **Ultimate:** God Thunder Barrage. Random sky bolts for 7 s, plus one bolt on every enemy every 0.5 s (14 × 7 = 98 per enemy).

## Proposed redesign (each attack: beginning → travel → detonation)

### Main: Thunder Strand

- **Beginning:** the punch, with a crackle charging round the fist.
- **Travel:** a bright leader bolt races out of the knuckles along the chain, enemy to enemy, at 60 units per step (about 0.1 s across the screen). The flickering bolt stays lit behind it.
- **Detonation:** at each enemy, a node burst: a white flash, forks and a small ring. The arcs to nearby enemies branch off from there.
- The strand rules (3 → 10 strands, death costs 2, arcs) and damage stay the same. **See decision 2** for when the damage lands.

### Focus: Thunder Spears

- **Beginning:** a charge flare at the punching fist.
- **Travel:** the spears fly as now (piercing), with a crackling trail and ring halos (from `fx-reference.png`).
- **Detonation:** a small thunder burst where a spear hits (cosmetic). Damage is unchanged.

### Special: Thundershock

- **Beginning:** he claps his fists together in front of his chest, and a shock ring bursts out.
- **Travel:** a lightning web leaves his hands and races enemy to enemy across the screen. Each enemy it reaches is stunned and wrapped in crackling arcs.
- **Detonation:** after 2 s, a sky bolt lands on each one and they explode. The rules and damage are unchanged.

### Bomb: Storm Cell

- **Beginning:** both fists punch upward, and two bolts climb from the knuckles into a storm cloud gathering over the screen.
- **Travel:** bolts rain down from the cloud on enemies and random spots for 2 s (the same damage as today).
- **Detonation:** a closing thunderclap: a flash, a ring and a shake.

### Ultimate: God Thunder

- **Beginning** (about 1 s): he raises both fists and the wings flare wide. Lightning streams from both fists into a growing ball of thunder held between his hands, with rings spinning faster and sparks drawn in.
- **Launch:** both fists thrust forward and the thunder core launches with a flash, pressure rings and a shake.
- **Travel** (about 3 s up the screen):
  - The core lashes chain lightning at every enemy within 220 units.
  - It erases bullets in a wide radius.
  - It leaves a crackling plasma wake.
- **Critical charge** (0.6 s) near the top: it swells, cracks with white light and pulls lightning in from the sky.
- **Detonation:**
  - a flash that overpowers the screen;
  - a shock front;
  - a dome of lightning;
  - dozens of sky bolts slamming down across the whole width;
  - a ground shock ring.
  - It deals one heavy hit to every enemy on the field and clears every bullet.
- **Aftermath:** residual arcs crackle over the field and fade.
- The palette stays blue outside, white inside.

## Decisions needed

1. **Coils** (they don't come from his hands).
   - **A (recommended):** remove them. Their damage moves into the punches: each strike throws extra short arcs from the fist (2 arcs from 5 strands, 4 from 8), at the same damage the coils deal now.
   - **B:** keep them as they are.
2. **When strand damage lands.**
   - **A (recommended):** when the leader bolt reaches each enemy. That is at most about 0.1 s later than now; the total damage is the same.
   - **B:** instant, as now. The travel is then only visual.
3. **Ultimate numbers.**
   - **Recommended:** a 7 s total.
     - **Travel lashes:** 3 damage every 6 steps to each enemy within 220 units of the core. It erases bullets within 120 units.
     - **Detonation:** 60 damage once to every enemy on the field, bosses included.
   - An enemy near the core's path takes about 90–100 in total, the same as the 98 the old barrage dealt.
   - Yes / adjust?
4. **Focus spear burst.**
   - **A (recommended):** cosmetic only, so the damage is unchanged.
   - **B:** a small splash (2 damage within 30 units).
5. **Special and bomb.** Keep their rules and damage, and only restructure the animation as above (hands, web, cloud). Yes / adjust?

## Unchanged

Strand growth, the stats, the speed, the bomb stock (5), the hitbox (3.0), the size (100 units), the bio, and the procedural fallback.
