# Dax Morrow — Asset Notes (Step 1)

Pilot: **Dax Morrow**, vehicle **OVERCLOCK**. Built the same way as Kairo,
Mira, Bruno, Tess, Oduya and Lin (see `ART_PIPELINE.md` and their
`ASSET_NOTES.md`). The source folder is read-only. Coordinates are source
pixels, origin top-left. Branch: `art/dax-test` (based on `art/lin-test`,
which has the latest pipeline: checkerboard cut-out, FX picks, wing layers).

## Images

| File | Size | Real transparency? | What it shows | Problems |
|------|------|--------------------|---------------|----------|
| `top-down-main.jpg` | 1144×1375 JPEG | **No**: painted checkerboard (squares about 10 px, greys about 220 and 254) | **In-game sprite.** A black-and-red void knight flying feet-first. From top to bottom: the two red-tipped **legs** (feet at the top corners), a central forward spike at the waist (tip at y ≈ 155), the forearms with red-lens **shield pods** on both sides, the chest with a glowing red **core orb**, the head with a gold V crest, then four huge black **blade wings** sweeping back (the lower pair reaches the bottom corners), red fin spikes, and a long rear crest spike. Mirror-symmetric about x ≈ 572. | Same checkerboard removal as Lin (`bg: 'checker'`). The red glow is part of the paint, so the red-glow rule stays off. At 90 units tall he is about 73 wide. |
| `top-down-front.jpg` | 1144×1375 JPEG | No: painted checkerboard | Front view, upright: head with gold V, blade wings spread, red-lens shield pods, legs. Select card and cut-in. | Same checkerboard removal. |
| `pilot-portrait.jpg` | 736×736 JPEG | No | A man with spiky white hair, orange mirrored sunglasses and neck tattoos, in an open black track jacket, holding up a gloved, tattooed hand. Black background. | A 4:5 head-and-shoulders crop of about 520×650 at (110, 0). Matches his current fallback (white hair, tattoo). |
| `fx-reference.png` | 1672×941 PNG RGB | No: painted checkerboard | Red-and-black void FX: needle stars and sigils; zigzag void beams; a long cosmic **void beam** with ring and star flare; **ghost clones** made of dark red smoke; a ground **explosion** of black shards with red rings; a huge **cosmic crescent** (black space with red stars inside) and smaller crescents; red smoke. | Reference, plus cut-outs for the effects you picked. |
| `void-beams.png` | 1672×941 PNG RGB | No: painted checkerboard | **Main attack reference.** Zigzag void beams in many lengths and widths: white core, red body, black smoke shards, a star flare and ring at each end; short bent beams striking down into black shard bursts. | Cut-outs for the beam head, the zigzag body and the impact. |
| `ultimate-fx.png` | 725×2169 PNG **RGBA** | **Yes** | **Ultimate reference.** A tall void-cosmic beam: white core, red cosmic cloud with stars, black shards and tendrils, ring halos, a ring-seal base. | It already has real alpha; it can be used almost directly as the ultimate beam texture. |
| `parts-sheet.png` | 1672×941 PNG RGB | Painted checkerboard | Front, side and back views; heads, blades, shield pods, hands. | Reference only. |

The five pictures in your message match these sheets:
1. the ghost clone in smoke (`fx-reference.png`, middle left);
2. the cosmic crescent (`fx-reference.png`, lower right);
3. the ultimate beam (`ultimate-fx.png`);
4. a long zigzag void beam (`void-beams.png`, middle);
5. a bent bouncing beam (`void-beams.png`, lower right).

## Facing

`top-down-main.jpg` flies **up** feet-first, like the others. **The two legs
at the top are his feet: they never fire.** No rotation needed.

## Anchor estimates (`top-down-main.jpg` pixels)

| Anchor | Left | Right | Notes |
|--------|------|-------|-------|
| **Hitbox** (chest core) | (572, 805) | — | Lands on `player.x/y`. |
| Head | (572, 900) | — | Gold V crest. Reference. |
| **Core** (`core`) | (572, 805) | — | The red chest orb. |
| **Spike** (`spike`) | (572, 160) | — | The forward waist spike tip, 43 units ahead. |
| **Shield lenses** (`lensL/R`) | (175, 515) | (968, 515) | The red lenses on the forearm pods, 26 units out and 19 ahead. |
| **Thrusters** (`ventL/R`) | (430, 1180) | (715, 1180) | Roots of the red rear fins: wide void plumes. |
| **Thrusters** (`packL/R`) | (530, 1100) | (615, 1100) | Either side of the rear spine: smaller plumes. |
| Leg tips (feet) | (175, 25) | (975, 25) | **Never fire.** |

**Scale.** The art is about 1350 px tall, so at 90 units 1 source pixel is about 0.067 units.

## The owner's new design (already decided)

- **Theme:** void-cosmic red. Every shot, hit, explosion and thruster is glowing red, black and cosmic (stars in black space), as in the FX sheets.
- **Main: Void Beam.** No bullets: red-black void beams that chase enemies at any distance, bounce from enemy to enemy forever, and zigzag between them when there are many. Faster than lightning. **One hit kills** any normal enemy through shields; mid-bosses and main bosses take normal damage. The beam also **chases and nullifies enemy attacks** coming at him.
- **Focus: Ghost Launch.** He launches forward as a **ghost clone** of dark red smoke that fires the same beams; the real body stays where he was. **Five more ghost clones** appear and fire too. While focused he is **completely intangible**: every attack passes through him, and the body left behind can't be targeted.
- **Special: Void Crescent.** A gigantic void crescent that travels slowly forward, erasing every enemy attack it touches and dealing continuous damage.
- **Bomb: Void Rod Rain.** 5 seconds of countless glowing cosmic void rods raining down, stabbing everything and exploding massively.
- **Ultimate: Void Cannon.** A very wide red-black cosmic beam straight ahead for **7 seconds**; he is immune to everything and can't die while it fires.
- **Thrusters:** void black and red.
- **Size: 90 units tall.**
- **No feet fire.**

## Dax's weapons today (being replaced)

| Mode | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Shot, boss | 35 | 70 | 87 | 122 |
| Shot, line of 6 | 34 | 52 | 86 | 104 |
| Focus, boss | 40 | 60 | 63 | 83 |

(`tools/dps.mjs dax`.) The current kit uses heat-ramped cannons, a Heat Lance focus beam, Vent Blast, Nitro Wall (2 bombs) and Meltdown Nova.

## Proposed mapping (needs your decision)

1. **How strong he is.** As written, he kills every normal enemy on screen nonstop, erases bullets aimed at him, and can't be hit at all while focused, so normal stages stop being a challenge.
   - **A (recommended): Legendary, exactly as written.** Everything above works as you described; only bosses push back. Boss DPS at full power is about 130 (above the median of 95, below Vincenzo). Like Vincenzo, he would be marked **LEGENDARY** on the select screen.
   - **B: the same powers with limits.** The beam jumps through at most 8 enemies per strike. It only erases bullets within about 70 units of him. Intangibility runs on a 4-second gauge that refills when you let go of focus.
2. **Where the beams leave.**
   - **A (recommended): from the red lenses on both forearm shield pods,** alternating like Oduya's fists.
   - **B:** from the red chest core.
   - **C:** from the forward waist spike (43 units ahead; the longest reach).
3. **How focus moves.**
   - **A (recommended):** you steer the ghost. The body stays parked, untouchable, where focus began. When you let go, the body flashes to where the ghost is (a short smoke dash).
   - **B:** when you let go, the ghost flies back to the body.
4. **Bombs in stock.** Today he has 2.
   - **A (recommended): 3**, like most pilots.
   - **B:** keep 2.

Already settled, no answer needed:
- **The beam ("faster than lightning").** It has no travel time. Every few steps a strike leaves a lens and hops from enemy to enemy in jagged zigzags, with no range limit, for as long as there are targets. While enemies remain it never stops. Each hop that reaches a normal enemy destroys it (`DMG_INSTANT_KILL | DMG_IGNORES_SHIELDS`; mid-bosses and bosses take normal damage instead). With no enemies on screen, the beam cracks straight ahead.
- **Nullifying attacks.** Each strike also sends short beam arcs at enemy bullets heading for him and erases them, plus every bullet the beam path touches.
- **Ghost clones.** Five dark-red smoke copies of the mecha (like Tess's clones, with the smoke ghost from the FX sheet) in an arc around the ghost. Each fires its own void beams.
- **Void Crescent.** A crescent of black space with red stars (the FX sheet's cosmic crescent), about 260 units wide. It moves up the screen at about 2 units per step, erases bullets it touches, and damages everything it overlaps every few steps. The cooldown is about 10 s.
- **Void Rod Rain.** 300 steps (5 s). Several glowing rods a step stab down across the screen (half aimed at enemies). Each one explodes in a black-shard, red-ring burst (the FX sheet's ground explosion) that damages a wide area through shields. The bomb clears bullets.
- **Void Cannon.** 420 steps (7 s). A beam about 150 units wide straight up from him, built from `ultimate-fx.png` (scrolling cosmic cloud, white core, ring halos, stars). It moves with him, damages everything in it heavily and clears bullets. He is invulnerable the whole time.
- **Thrusters.** Void plumes from the rear fins and spine: a black smoky outside, a red middle and a white-hot core, trailing black-red smoke.
- **Hit FX.** A red flash with a white core, a black-shard spray, a ring, and a small star flare.

## Layer split plan

Same method as the others: feathered polygons plus the exact alpha complement for the body.

- **Left wing:** the two left blade wings (upper and lower). Pivot at the shoulder, about (470, 860).
- **Right wing:** the mirror about x ≈ 572.
- **Body:** legs, waist spike, forearm shield pods, chest, head, rear spike.
- **Motion:** the usual flare, fold and banking. The shield pods stay with the body, so the beam origins never move with the wings.

## Other notes

- **Data (step 5).** The role "Hot-rod Jet" becomes something like "Void Knight". The bio and lore line are rewritten for the void theme (he keeps his street-racer past). The colour moves from violet to void red.
- **FX cut-outs (step 2).** The beam head, zigzag body and impact come from `void-beams.png`. The ghost-clone smoke, the cosmic crescent and the ground explosion come from `fx-reference.png`. The ultimate beam is `ultimate-fx.png`. They are un-blended the same way as Lin's FX picks; the glow tint becomes red instead of emerald.
