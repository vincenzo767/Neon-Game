# Sera Voss — Asset Notes (Step 1)

Pilot: **Sera Voss**, vehicle **GLACIER**. Her first hand-made art, built the same
way as the other component mechas (Tess, Oduya, Lin, Miguerre; see
`ART_PIPELINE.md` and their `ASSET_NOTES.md`). This folder is read-only.
Coordinates are source pixels, origin top-left. Branch: `art/sera` (on top of
`art/miguerre-v2`).

## The owner's brief

- **Lore:** wife of **Vincenzo the Conqueror**.
- **Status:** **Legendary.**
- **Revamped kit:** a new basic shot, a new passive, and a new focus, special, bomb and ultimate (the owner's ice-mecha FX specification):
  - **Frost Shards (basic):** ice shards from the bow, 4 / 8 / 12 / 16 per volley by tier. Hits build up frost on enemies, which slows them more and more until they can't shoot.
  - **Zero Field (passive):** a wide circular field round her that freezes and shatters enemy bullets at its edge.
  - **Glacial Focus (focus):** faster volleys and a bigger Zero Field.
  - **Ice Storm Surge (special):** a winter storm expands from her and freezes every enemy it reaches for **7 s**.
  - **Bomb:** countless ice arrows fall from the sky, freezing anything they touch, including bullets.
  - **Absolute Zero (ultimate):** the whole screen freezes for **12 s**; only she can move and attack.
- **FX:** every effect animated, with a beginning, motion and a consequence. The palette is ice blue, cyan, pale blue-white, white and deep glacial blue.
- **Not ever:** feet firing (house rule).

## Images

| File | Size | Transparency | What it shows |
|---|---|---|---|
| `top-down-sprite.png` | 1312×1199 PNG RGB | **No**: painted checkerboard (`bg: 'checker'`) | **In-game sprite**, flying up feet-first. A white-and-blue crystal knight with gold trim:<br>• **legs:** crystal spikes at the top (≈ 600–730, 40–350);<br>• **head:** ≈ (657, 640);<br>• **ice-blade wings:** a fan below and to the sides, down to the bottom corners;<br>• **bow:** held across her body. The left fist (≈ 471, 514) grips the glowing horizontal riser (≈ 430–870, 543), the two big white-and-gold armoured arcs on the left (≈ 86–430, 357–1043) and right (≈ 886–1229, 271–1000) are the limbs, and the right fist (≈ 857, 629) draws at the nock (≈ 821, 614).<br>**Six glowing ice arrows are painted into it,** fanning up from the nock across the body to big arrowheads at the top (decision 1). |
| `mecha.png` | 1122×1402 PNG RGB | No: painted checkerboard | Front view, upright: ice-blade wings, horned crystal helm, the long white-and-gold **bow held vertically** in the right hand, with an ice arrow. **Select card and cut-in.** |
| `pilot-portrait.png` | 1055×1491 PNG RGB | No (full painting) | Silver-haired elven queen with a crystal crown, fur stole and white gloves, in snow. A 4:5 head-and-shoulders crop of about 760×950 at (150, 40). |

**The bow's orientation.** The specification asks for a vertical bow. That matches the front view, where she stands with the bow upright. In the top-down sprite, seen from above, the bow spans across her body and is drawn back toward her right fist, aimed up the screen. It can't be turned without repainting, so the plan keeps it **as painted**:
- every shard leaves the nock and flies forward, up the screen;
- the "string" is drawn as a tensioned cyan energy line between the limb tips and the nock, as the specification allows when no string is visible.

## Components and rig plan (estimates; checked in Step 2)

| Part | Where | Motion |
|---|---|---|
| **Body** | Legs, torso, head, the left fist on the riser | Fixed. |
| **Hitbox** | Chest, ≈ (656, 600) | Lands on `player.x/y`. |
| **Drawing arm** (right fist, one-sided) | Right forearm and fist round (857, 629) | **Draws and releases.** It pulls back (down the screen) as the volley charges, then snaps forward on release with a small recoil. The energy string follows it. |
| **Bow limbs** (left and right arcs) | The two armoured arcs | They **flex** inward as the string draws, then spring back with a quiver on release. They turn slightly about their roots on the riser. |
| **Ice-blade wings** | The lower blade fan, mirrored | A slow hover breath. They flare on focus, the special and the ultimate, and fold a little when dashing. |
| **Firing point** (`nock`) | ≈ (821, 614), on the drawing arm | **Every shard leaves here** (the specification: never from the chest, wings or shoulders). The volley's fan is aimed to cross the lanes centred on her, as with Lin's whip. |
| **Feet** | The leg spikes at the top | **Never fire.** |

There are **no thrusters**: she hovers on the ice-blade wings, which trail frost vapour and drifting crystals instead of flames.

**Size: 100 units tall** (about 109 wide), the same as Oduya.

## Today's kit (being replaced)

`tools/dps.mjs sera`:

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot, boss | 17 | 54 | 81 | 108 |
| Focus, boss | 28 | 50 | 63 | 75 |

- **Frost Shards:** 2–5 piercing shards that slow bullets they pass.
- **Cryo Beam (focus).**
- **Cryo Shell (special):** slows bullets near her.
- **Absolute Zero (bomb):** freezes bullets, then 18 damage to everything.
- **Time-Stop Shatter (ultimate):** 5 s.

## The new kit (proposed)

### Frost Shards (basic)

- Every 7 steps a volley of **4 / 8 / 12 / 16 shards** (T1–T4) leaves the nock.
  - It flies in a fan with staggered lanes, aimed up the screen, at speed 14.
  - Shards **pierce** (re-hits disabled, like Tess's crescents).
  - Each volley: a cyan charge on the string, the draw, then a sharp white-blue release flash.
- **Frost buildup** (regular enemies). Each hit adds frost.
  - **Slowing:** frost slows them, up to 60 % slower, because their AI runs only part of the time, so they move and fire slower.
  - **Frozen solid:** at full frost they are frozen solid (stunned: no moving, no firing) for **1.5 s**, then thaw back to half.
  - **Fading:** frost fades if they stop being hit.
  - **Look:** ice crystals and a frost crust build up on them as it grows.
  - Bosses can't be slowed or stunned (their controllers own their phases), so they just show the frost.
- **Damage (decision 3):** per-shard damage is set so the boss DPS hits the target.
- **Options:** the current option pods go. All her firepower comes from the bow, as the specification says.

### Zero Field (passive)

- An always-on ring of thin cyan rings, rotating snowflake glyphs, crystal nodes and ice blades.
  - Radius **60 units** (focus **95**).
  - Its centre is clear, so she stays visible.
- **Interception:** an enemy bullet that reaches the edge freezes in a small ice crystal at that exact point and shatters, with a flash there and a ripple running round the ring.
- Enemy lasers and beams aren't bullets; they pass through it.
- **Limit: decision 2.**

### Glacial Focus (focus)

- **Faster volleys:** every 4 steps instead of 7, with the same shards per volley, so the streams stack up.
- **Bigger field:** the Zero Field expands from 60 to 95 with a bright ripple, and its blades and crystals grow brighter.
- The armour's cyan light flows to the bow.
- **Movement:** the usual focus speed.

### Ice Storm Surge (special)

- **The burst:** a cyan-white burst at her, then a frost ring races outward, followed by the storm:
  - spiralling bands of icy wind round her;
  - rising and falling shards;
  - snow and frost vapour;
  - ice spikes erupting;
  - frost filaments between crystals.
- **Freezing:** each enemy freezes **as the wave reaches it**, frozen solid for **7 s** with an ice casing. The casing cracks and breaks away at the end, and the enemy resumes if it survived.
  - Bosses take a heavy chill hit instead (they can't be frozen).
  - Enemy bullets the wave passes freeze and shatter.
- **Area: decision 4.**
- **Damage:** 10 when the wave reaches an enemy.
- **Cooldown:** 900 (15 s; the old special had 660).

### Bomb — Frost Arrow Rain (the owner's idea)

- **Duration:** 3 s.
- **The arrows:** countless ice arrows fall from the sky across the screen, more than half of them aimed at enemies.
  - Each one strikes with a crystal burst.
  - It hits everything within 36 units for 6 damage (big arrows: 60 units, 16 damage).
  - **Regular enemies it touches are frozen solid for 3 s.**
  - **Enemy bullets it touches freeze and shatter.**
- **Clearing:** the usual bomb clear and cover apply too.
- **Stock:** 3 bombs.

### Absolute Zero (ultimate)

- **Activation:** her armour and bow flare, light gathers to a point at the centre, crystal fractures race out, then a white-blue flash and a screen-wide freezing wave.
- **12 s frozen battlefield:**
  - every enemy bullet stops dead inside an ice shell, including ones fired during the freeze;
  - every regular enemy freezes solid;
  - faint crystal geometry and frost veins spread over the grid, with restrained drifting snow and pulses.
  - She moves and fires normally, and is invulnerable throughout (as for every ultimate).
- **Bosses:** they can't be frozen (their controllers own their phases), but **every shot they fire freezes the moment it leaves them**, so their attacks are suspended too.
- **Release:** cracks run over every frozen enemy and bullet, then a short synchronised shatter. **Frozen bullets break away (cleared)**, and enemies resume.
- **Damage:** none from the ultimate itself, as the specification asks ("not an ordinary damaging explosion"). Her shots keep working.

## Settled (no answer needed)

- **Legendary:** `legendary: true`, gold select theme like Miguerre and Vincenzo.
- **Bio and lore (draft, easy to change):**
  - *"Queen of a frozen court beyond the Upper Breach and wife of Vincenzo the Conqueror. When the Herald stepped through to serve the Precinct, Sera followed him. Where he walks, the storm stops; where she draws her bow, it freezes in the air."*
  - Vincenzo's lore line gains: *"His wife, Sera Voss, followed him through."*
- **Role:** "Frost Archer" (was "Cryo Frigate"). The vehicle name **GLACIER** stays. The colour stays ice blue.
- **Stats:** 4 / 5 / 5 / 4 (speed / power / range / bomb). Speeds: 4.6 normal, 2.0 focus (was 3.9 / 1.8).
- **Portrait:** the new `pilot-portrait.png`. The procedural fallback becomes silver hair with a crown.
- **Feet never fire.** Every shard leaves the nock. The procedural fallback stays.
- **Sounds:** unchanged for now.

## Decisions needed

1. **The six ice arrows painted into the sprite.** The specification says shards must not appear already embedded, and the real shards will fly from the nock.
   - **A (recommended):** I remove them in processing. The arrowheads at the top are over the background and simply erased; the thin shafts across her body are filled in from neighbouring pixels (at game scale they are about 4 px wide).
   - **B:** keep them as part of her look (a glowing "nocked volley" that pulses with each shot).
   - **C:** you supply a clean sprite without them.
2. **Zero Field limit.**
   - **A (recommended):** a frost charge. It shatters up to 24 bullets, then needs to recover (6 a second, and full after about 4 s without interceptions). While it's empty the rings dim and bullets get through.
   - **B:** unlimited, so no bullet ever reaches her (only lasers can hurt her).
3. **Power (boss DPS at full power).** Legendary Miguerre deals 131.
   - **A (recommended):** about 130 normal and 150 focus.
   - **B:** keep today's 108 / 75.
4. **Ice Storm Surge area.**
   - **A (recommended):** a 260-unit radius round her (about half the screen), so it stays clearly weaker than Absolute Zero.
   - **B:** the whole screen.

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **A:** the ice arrows painted into the sprite are removed in processing.
2. **B:** the Zero Field is unlimited.
3. **A:** boss DPS at full power is about 130 normal and 150 focus.
4. **A:** the Ice Storm Surge reaches 260 units round her.

## Steps 2–6: results

### Art

- **Processing.** `npm run art:sera`:
  - painted checkerboard removed (18 enclosed pockets);
  - sprite exports 408×372 @2x and 204×186 @1x;
  - front view `mecha.png` at 469×600;
  - portrait a 640×800 crop at (260, 0), head and shoulders.
- **The painted arrows, removed** (owner's 1A; opt-in `erase` in process-art). There were **five**, not six; the sixth "arrowhead" was one of the bow limb's crystal spikes, which stays.
  - **Shaft lines.** Each shaft was fitted from its glow (origin and angle): −150°, −135.5°, −112°, −77.5° and −39.25°. Two of them start a little off the nock.
  - **Arrowheads** (over the background) are cleared.
  - **Shafts.** Where a shaft crosses open background on both sides it is cleared; where it crosses her body it is filled from neighbouring pixels and softened.
  - **Crystal spikes.** Two limb spikes beside the arrows are protected.
  - **Fragments.** Leftover outline fragments are dropped (the largest connected piece is kept).
  - See `screenshots/sera/art/sprite_arrows_removed.png`. At game scale the filled centre reads as a soft frost haze.
- **Rig** (`src/pilots/seraRig.js`): one part, the **drawing arm** (right fist and gauntlet).
  - It draws back along her aim between volleys (faster in focus) and snaps forward with a recoil on each release.
  - The `under` image fills its footprint from neighbouring pixels, not the mirror (`fillMirror: false`), because her other arm is in the mirror.
- **The bow** stays as painted, across her body. Its "string" is a tensioned cyan energy line from both limb tips to the nock: it brightens as it draws, and the arrow forms at the nock. The limbs glow, and the release flashes.
- **No thrusters.** Frost vapour and drifting crystals come off the ice-blade wing tips, and she has a slow hover breath.
- **Size:** 100 units.
- **Select card:** the front view is drawn 1.25× (`previewScale`).
- **Shared opt-in additions** (no other pilot uses them; their DPS is identical):
  - process-art: `erase` (`clear`, `strokes`, `keep`, `smooth`, `bgAlpha`, `largest`) and `wings.fillMirror`;
  - World: a `pierceHit(world, i, enemy)` hook for piercing shots.

### Kit (`src/pilots/sera.js`, FX in `src/pilots/seraFx.js`)

- **Status:** Legendary, with the gold select theme. Role "Frost Archer". Stats 4 / 5 / 5 / 4. Speed 4.6 normal, 2.0 focus. Her option pods are gone.
- **Frost Shards (basic).**
  - **Volleys:** every 7 steps, **4 / 8 / 12 / 16** piercing shards (T1–T4) leave the nock. They fly in a fan whose staggered lanes are laid out 220 ahead, centred on her.
  - **Hits:** each shard hits each enemy once.
  - **Look:** the shards are drawn by the pilot (`renderShots`): a frost wake, a pale-blue crystal body, a cyan glow and a white core, vibrating slightly. Each volley has a release flash and a frost burst.
  - **Damage per shard:** 0.84 + 0.112 × tier (focus 0.42 + 0.053 × tier).
- **Frost.** Each hit adds 0.08 frost to a regular enemy.
  - **Slowing:** its AI (moving and firing) runs up to 60 % slower, and its clock is held back on the skipped steps, so paths and fire schedules slow down together.
  - **Frozen solid:** at full frost it is frozen solid for 1.5 s in an ice casing, then thaws to half.
  - **Fading:** frost fades after 0.5 s without hits.
  - **Look:** frost crystals and a cold glow grow on enemies as frost builds.
  - Bosses only show frost (their controllers own their phases).
- **Zero Field (passive, unlimited per 2B).**
  - **Size:** radius 60 (focus 95).
  - **Look:** thin layered rings (dashed inside) turning at different speeds, 12 ice blades and 6 snowflake nodes, and a clear centre.
  - **Interception:** every enemy bullet that reaches the edge shatters at that point, with a flash, a crystal and a ripple running round the ring. Lasers pass through.
- **Glacial Focus.** Volleys every 4 steps instead of 7, with the same shards per volley. The field expands with a ripple, and cyan light runs along the riser to the bow.
- **Ice Storm Surge (special).**
  - **The wave:** a frost wave front (a thin ring with crystals) races out to 260 at 9 units a step. Each enemy is hit as the wave reaches it.
  - **Freezing:** regular enemies take 10 damage and freeze for **7 s** in a casing that cracks and breaks away at the end. Bosses take 30.
  - **Bullets** the wave passes shatter.
  - **Look:** wind spirals, 14 erupting ice spikes with frost filaments between neighbours, swirling shards and snow.
  - **Cooldown:** 900.
- **Frost Arrow Rain (bomb).** 3 s of ice arrows from an icy sky: 2 a step plus a big one every 12, 60 % aimed at enemies.
  - Each strike deals 6 within 36 (big arrows: 16 within 60), with a crystal burst, a frost ring and ice spikes.
  - **Regular enemies it touches freeze for 3 s.**
  - **Enemy bullets it touches freeze** in frost shells, then shatter when the rain ends.
- **Absolute Zero (ultimate, 12 s).**
  - **Activation (0.33 s):** the screen dims, light converges to the centre, and fractures race out. Then a flash and a screen-wide freezing wave.
  - **The freeze:**
    - every enemy bullet, including new ones, holds still in an ice shell;
    - every regular enemy freezes solid;
    - bosses' shots freeze the moment they leave them;
    - faint crystal geometry, frost veins and drifting snow over the grid.
    - She moves and fires freely, and is invulnerable throughout.
  - **Release:** cracks run through everything, then a synchronised shatter. Frozen bullets are cleared and enemies resume.
  - **Damage:** none from the ultimate itself.
- **Lore.** She is Vincenzo the Conqueror's wife (bio and lore file), and Vincenzo's file gains "His wife, Sera Voss, followed him through."

### Tests

**Headless gameplay checks** (the real World and Player; the script is kept in the session scratchpad). All passed:

| Check | Result |
|---|---|
| Size, status | 100.0 units, Legendary. |
| Volleys | T1 4, T2 8, T3 12, T4 16 shards, every one from the nock (none from the feet). |
| Frost | Frozen solid after 45 steps of T4 fire. It thawed to 0.50, and at half frost its AI ran 21 of 30 steps. A boss is never stunned; its frost caps at 0.60. |
| Zero Field | 24 bullets from all sides all shattered. The closest any got was 56 (radius 60), or 92 in focus (radius 95). |
| Ice Storm Surge | The enemy 200 away froze at step 23, as the wave front reached it, with 420 steps (7 s) of casing. The enemy 300 away was untouched. |
| Frost Arrow Rain | The struck enemy froze; a bullet near a strike froze; no bullets were left after the rain. |
| Absolute Zero | 10 bullets fired after the activation held perfectly still, and the enemy froze, while she fired 1,600 shards. The release left 0 bullets. Duration 720. |

**DPS** (`tools/dps.mjs sera`):

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot, boss | 32 | 72 | 110 | **131** (was 108) |
| Focus, boss | 28 | 62 | 102 | **149** (was 75) |

**Frame rate** (headless, 1,500-bullet storm):

| Situation | With art | Procedural |
|---|---|---|
| Firing | 56.9 FPS | 57.4 |
| Focus | 50.7 | 52.5 |
| Ultimate | 49–60 | 50–60 |

**Regressions:**
- Miguerre, Oduya, Tess, Lin, Bruno, Mira, Kairo, Nova and Vincenzo DPS are identical to before.
- All eight art pilots load and play every tier, focus, special, bomb and ultimate with no errors.

**Screenshots** in `screenshots/sera/art/`:
- `sheet_poses`: rest, drawn, release, charge;
- `sheet_fire`: volleys, the field, the focus field;
- `sheet_special_bomb`: the storm wave, the storm, frozen enemies, the arrow rain;
- `sheet_ult`: activation, the wave, the frozen battlefield while she fires, the release;
- `sheet_bullets`: the field against the bullet storm, frozen bullets in the rain;
- `sprite_arrows_removed`;
- `select_card`.

### Known limitations

- Where the painted arrow shafts crossed her body, the fill is soft (a frost haze at game scale).
- The bow limbs and ice-blade wings don't move; the drawing arm, the energy string, the glow and the recoil do.
- The bow stays across her body as painted, not vertical (see Step 1).
- Enemy lasers and beams aren't stopped by the Zero Field.
- Her sounds are the old cryo set.
