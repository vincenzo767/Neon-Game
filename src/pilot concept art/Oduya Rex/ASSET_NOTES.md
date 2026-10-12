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
