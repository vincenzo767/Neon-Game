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

## Decisions at the Step 1 checkpoint (approved by the owner)

1. **Strength: A.** Legendary, exactly as written. He is marked **LEGENDARY** like Vincenzo.
2. **Beam origin: B.** Every void beam leaves the red chest core.
3. **Focus: A.** You steer the ghost; the body stays parked and untouchable; when you let go, the body flashes to the ghost.
4. **Bombs: A.** 3 in stock.
5. The vehicle name stays **OVERCLOCK**.

## Steps 2–6: results

- **Processing.** `npm run art:dax`.
  - `bg: 'checker'`; 4 enclosed checker pockets were found automatically.
  - Sprite exports: 303×372 @2x and 151×186 @1x, with outline variants. Front view: 484×600.
  - Portrait: a 520×650 crop at (110, 0).
- **Wings.** Generated `dax.layers.json`: the lower blade wings and their fins move, drawn under the body (no keep areas).
- **FX picks.** The owner's pictures aren't exact crops of the sheets, so they are stored in `tools/art-ref/dax/` and used directly (as with Lin). They are un-blended with a **red** glow tint (`tint: 'red'`); two have crop boxes.
  - `dax_fx_beam`: zigzag void beam, the main beam segments.
  - `dax_fx_bent`: bent beam, the arcs that erase attacks.
  - `dax_fx_ghost`: the smoke ghost.
  - `dax_fx_crescent`: the Void Crescent.
  - `dax_fx_ult`: straight from `ultimate-fx.png`, which has real alpha.
  - The beam and bent beam are in the shared atlas; the ghost, crescent and cannon are in Dax's own texture.
- **Code.**
  - `src/pilots/daxArt.js`: config, void-red palette with `dark`.
  - `src/pilots/daxFx.js`: beams, arcs, hits, bursts, smoke ghosts, crescent, rods, cannon.
  - `src/pilots/dax.js`: the new kit.
- **Shared, all optional; the other pilots are unchanged and were checked.**
  - `Player`: `intangible(p)` hook.
  - `mechaArt`: `pal.dark`, a black under-flame for thrusters.
  - `tools/dps.mjs`: `dpsBossTargets`.
  - `process-art`: FX `tint`, `box`, and real-alpha passthrough.
- **The kit.**
  - **Void Beam.** A strike every 4 steps from the chest core. It chains through every enemy, nearest first, with no range limit, drawn as zigzag void beams.
    - Normal enemies die in one hit through shields (`DMG_INSTANT_KILL | DMG_IGNORES_SHIELDS`).
    - Bosses, mid-bosses and boss parts take `2.5 + 1.8 × tier` per strike (70 % on later hops).
    - Bullets along the beam are erased. Each strike also arcs to the 4 nearest enemy bullets within 110 units and erases every bullet within that radius.
    - With no enemies on screen, the beam cracks straight ahead.
  - **Ghost Launch.** Focus launches a smoke ghost 110 units forward; the body stays parked, drawn at 85 %.
    - The ghost and 5 smoke clones fire void beams. The ghost does 55 % boss damage; the clones strike every 8 steps for 20 %.
    - While focused he is **intangible** (`def.intangible`): every attack passes through.
    - On release the body flashes to the ghost.
  - **Void Crescent.** 260 units wide. It drifts forward 1.8 units per step for 5 s, erases attacks along its arc, and deals 5 every 5 steps through shields. Cooldown 600.
  - **Void Rod Rain.** 5 s. Two rods a step (a big one every 12), half aimed at enemies. Bursts are 52 units / 5 damage, or 90 / 14 for big rods, through shields. Clears bullets.
  - **Void Cannon.** 7 s. A 150-unit beam from his chest to the top of the screen that follows him: 2.6 per step through shields, clearing bullets. He is invulnerable throughout.
- **DPS** (`tools/dps.mjs dax`, dummies flagged as bosses because normal enemies die in one hit):

  | Mode | T1 | T2 | T3 | T4 |
  |---|---|---|---|---|
  | Beam, boss | 58 | 82 | 107 | 131 |
  | Ghost focus, boss | 61 | 86 | 112 | 137 |

  - Old kit at T4: shot 122, focus 83.
- **Data.**
  - Role "Void Knight", `legendary: true`.
  - New bio and lore line (the street racer who came back from the void).
  - Colour void red, bombs 3, stats 5/5/5/4.
  - The fallback portrait has white spiky hair, shades and tattoos.
- **Frame rate.** Storm: about 57 FPS with art versus 53 procedural; 60 FPS during the special and ultimate.
- **Atlas.** The shared atlas is 84.8 % full (was 86.5 %; his old gun and plasma sprites are gone).
- **Screenshots** in `screenshots/dax/`:
  - `14_d_main_kills`: chained one-hit kills;
  - `14_d_main_storm`: erasing bullets;
  - `14_d_focus_ghosts`;
  - `14_d_special_crescent`;
  - `14_d_bomb_rods`;
  - `14_d_ult_cannon`;
  - `14_d_idle`;
  - plus select, cut-in and fallback.
- **Known gaps.**
  - His sounds are still the old Overclock cannon and vent blast.
  - Enemy lasers aren't erased by the beam; they pass through him while he is focused.

## Polish round (owner's feedback)

The owner said the picked FX images looked cut out. Every effect is now drawn live in the reference style, with no image picks. The `dax_fx_*.png` files, their `art.config` entries and their manifest entries are gone; `tools/art-ref/dax/` stays as the reference.

- **Void Beam.** Straight beams, like eye beams: no zigzag. Each beam has a red haze, a black sheath, a red body and a white-hot core, with star flares where it leaves the core and where it hits. The interception beams are straight too.
- **Ghost and clones.** Real smoke: dark-red particle puffs and red wisps billow off every ghost and trail behind it. The ghost body is the mecha sprite, tinted void red, with hazy drifting edges.
  - The clones are spread wider at (±150, 50), (±82, −28) and (0, 105), kept on screen.
- **Void Crescent.** A band of black void with stars and red nebula, a blazing red-and-white rim, and the reference's big star flares. Smoke, black shards and embers peel off its inner edge.
  - Width 300; it moves at a medium 3.2 units per step (was 1.8).
  - Its hits follow the drawn band.
- **Void Cannon.** A column of black void with blazing red walls, red nebula, stars and black shards streaming up. It has a white-hot core line, halo rings and a star-crowned seal at the muzzle, and throws sparks and shards off its walls.
- **Screenshots:** `screenshots/dax/15_*_polish.png`.

## Polish round 2 (owner's feedback)

- **Chain speed.** The first beam is still instant, from the chest core to the nearest enemy. From there a chain races on from enemy to enemy at 18 units per step (about 0.45 s across the screen), so you can see it travel and bounce.
  - The chain has a blazing head with a white speed streak, and the hops behind it fade.
  - It chases moving targets and turns to the next enemy if its target dies first. It hits each enemy once per chain, up to 64 hops, and erases bullets along its path.
- **Void Crescent.** A canvas-drawn texture (`dx_cres_body`, `dx_cres_rim` in the shared atlas) with a sharp outer edge, a torn, sharp-toothed inner edge and pointed tips.
  - Inside is mostly black void with red chaos clouds, black voids, torn red veins and stars. Flickering red cracks and twinkles are drawn over it.
  - Black and dark-red smoke, black shards and embers peel off it.
- **Focus + special.** The two outermost clones cast a crescent too: three crescents.
- **Focus + ultimate.** The two outermost clones fire a Void Cannon too: three cannons, each with full damage. The ghost and the other clones keep firing beams. The side cannons fade out if focus is released.
- **Void Cannon.** A deeper black void column:
  - black tendrils twisting up, dim red nebula and flickering red chaos cracks;
  - torn, wavering red walls;
  - black void smoke and dark-red smoke rolling off it.
  - The muzzle seal is calmer: flat rings, no spinning ones.
- **Checks.** DPS is unchanged (boss T4: beam 131, focus 137). With 1,500 bullets the frame rate is 52–60 FPS. Screenshots: `screenshots/dax/16_*`.

## Polish round 3: the crescent moon (owner's reference picture)

The owner supplied a new crescent reference: a black cosmic crescent moon with a red edge, star seals and chaotic black and red ink smoke. It is followed live, not cut out.

- **Shape.** A real crescent moon: thick at the crown (60 % of the radius, slightly heavier on the right, as in the reference), tapering to needle-sharp tips that sweep past the horizontal. The inner edge is torn under the crown. Hits follow the same shape.
- **Body texture** (`dx_cres_body`): black cosmic void with a faint violet haze, stars, red torn glow and splatter along the inner crown, thin red veins, a sharp red rim and a red inner line.
- **Everything moves:**
  - the moon sways a little;
  - nebula and stars drift along the arc and twinkle;
  - red chaos cracks flicker inside it and red streaks lash around it;
  - the rim pulses, and two glints run from tip to tip;
  - the crown star has a long vertical needle;
  - the three red star seals in the hollow spin and pulse;
  - the red haze breathes.
- **Smoke.** Black, smoky-grey and blood-red ink smoke boils off the rim, the tips and the hollow, swirling as it drifts with the moon. Red wisps, black ink shards and embers come off it too.
- It now spawns 110 units ahead of him (was 70).

## Polish round 4: Getsuga-style slash (owner's `void-crescent.png`)

The black-flame rounds (commits `3c859ce` to `53a757f`) were rolled back to the crescent moon (`d567227`), and the crescent was rebuilt after the owner's new reference, `void-crescent.png` in this folder. It is drawn live, not cut out.

- **Shape.** A thick inverted-U arch (crown 46 % of the radius), with blade tips sweeping well below the horizontal and tapering to points. Hits follow the same shape.
- **Body texture** (`dx_cres_body`): ink-brush strokes, black-dominant with a ragged silhouette, dark-red and blood-red currents, white-hot highlights near the leading edge, and ink and red spatter.
- **Rim texture** (`dx_cres_rim`): a blazing, brushy leading edge with white spray.
- **New `dx_orb`:** small black void orbs with a red rim light.
- **Motion:**
  - Plasma currents race along the arc from the crown out to the tips.
  - Lightning filaments follow the curve.
  - A dark smear and red motion-blur copies trail behind, with speed streaks stretching back.
  - Energy nodes flare along the arc and throw sparks.
  - An overcharged core in the hollow has pulsing rings, long horizontal and vertical spikes, and red lightning.
  - The crown star and two side flares twinkle.
  - Black orbs drift and bob around the slash.
- **Smoke.** Ink-black, charcoal and some crimson smoke tears off the edge, peels off the tips and boils in the hollow. It lags behind as the slash moves. White-hot vapour and black ink shards come off it too.
- **Frame rate.** Headless test: 59 FPS idle, 53 with the crescent, 57 with three in focus.
- **Screenshot:** `screenshots/dax/23_crescent_getsuga.png`.

## Polish round 5: Void Cannon, Gran Rey Cero × Getsuga Tenshō (owner's reference)

The owner supplied an in-game mock-up of the ultimate and a written brief. The cannon was rebuilt live, with no images. Damage, width (150) and duration are unchanged.

- **Column.**
  - A crimson aura with an overexposed white-hot core and black void currents wavering up inside it.
  - Light streaks race up the column, and its edges are jagged and flicker with lightning.
  - The core breaks where the compression nodes sit, so the dark spheres show through.
- **Rotating rings.** Five tilted ellipses rise up the column. Each has its back half behind the beam and its front half in front. Thick black-red plasma sections rotate around each ring, with thin threads between them.
- **Getsuga blades.** Crescent blades sweep outward and upward from the column, alternating sides: a solid black-red body, a razor crimson-white leading edge and a trailing plasma ribbon. A new one launches every 16 steps.
- **Compression nodes (Gran Rey Cero).** Four dark spheres sit on the axis, the middle one big. Each squeezes in with its rings pulled inward, then erupts: rings blast out and the cross spikes and star flare. Lightning crawls over them.
- **Around it:**
  - dark void orbs drift off both sides;
  - red light rays radiate out;
  - black rock debris streams up;
  - a big tilted ring and flare surround the muzzle.
- **Particles** (`cannonSpray`): black plumes hug the column, crimson vapour and grey-white wisps billow outward, and black rocks and sparks are flung away.
- **Focus.** The two side cannons from the clones use lighter detail at 60 % brightness, so three cannons don't wash out the screen.
- **Frame rate (headless).** 60 idle, 53 during the ultimate, 49 with three cannons.
- **Screenshots:** `screenshots/dax/24_*`.

## Polish round 6: solid crimson-and-black cannon (owner's `enhance-ultimate.png`)

The owner asked for no transparency and full light, following `enhance-ultimate.png` (added to this folder).

- **New atlas textures.**
  - `dx_column`: an opaque crimson body with blazing red edges, black void bands down its length, red and pink-white streaks and a white-hot centre line. It tiles vertically and scrolls up the column.
  - `dx_bar`: a solid bar used for opaque strokes.
- **The column is drawn opaque** (alpha-blended at full alpha): the grid no longer shows through. Additive layers on top: black void currents, energy streaks, a thin white core line, jagged lightning edges and red chaos.
- **Dense energy burst around it.** Solid crimson, pink-white and black puffs boil outward along both sides.
- **Rings.** Thick solid black bands with a crimson rim and a red edge line, rotating and rising; they pass behind and in front of the beam.
- **Getsuga blades.** Solid black brush strokes with black ribbons and a crimson-white leading edge.
- **Spheres.** Black compression spheres on the axis (big one in the middle) and black orbs at the sides, each with a crimson rim and crawling red cracks. The rim is drawn under the sphere so the sphere stays black.
- **Rocks.** Black rocks with a crimson edge stream up.
- **Unchanged:** damage, width and duration.
- **Frame rate (headless).** 60 idle, 51 during the ultimate, 44 with three cannons in focus.
- **Screenshots:** `screenshots/dax/25_*`.
