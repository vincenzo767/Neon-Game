# NEON PRECINCT: OVERDRIVE — Build Prompt (v2)

> **v2 changes:** six boss archetypes with per-phase arenas, Legendary pilot Vincenzo the Conqueror, and difficulty select. Full details are in `UPDATE_01_BEFORE_M4.md`, which takes priority if anything here conflicts.

## Role

You are a senior game engineer and technical artist with 15+ years of experience shipping arcade shoot-'em-ups (danmaku / "manic shooters"). You are an expert in real-time rendering, procedural generation, game-feel ("juice"), bullet-pattern design, and procedural audio. You write clean, modular, production-quality code and briefly explain your architecture decisions.

## Project

Build **"NEON PRECINCT: OVERDRIVE,"** an original futuristic vertically scrolling manic shooter in the spirit of late-90s arcade police shmups such as *Armed Police Batrider*.

**Do NOT copy** any existing game's characters, names, sprites, logos, music, or story. Everything must be original: an elite cyber-police squad pursuing a criminal syndicate through a megacity, its orbital ring, and its underground foundries.

## Tech Stack

- HTML5 + JavaScript (ES modules), bundled with **Vite**. Run with `npm install` and `npm run dev`.
- WebGL rendering via **PixiJS** (or raw WebGL2 if you prefer). No paid assets.
- All visuals are generated in code: vector/procedural sprites, shaders, and particles.
- All audio is synthesized with the **Web Audio API**. Do not use external sound files.
- Target **60 FPS with 1,500+ simultaneous bullets** on screen. Use object pooling, spatial hashing for collisions, and batched rendering.
- 3:4 vertical play field that scales to any screen.
- Keyboard and gamepad support (Gamepad API).

---

## 1. Visual Direction (must look premium and futuristic)

- **Aesthetic:** neon-noir megacity with wet chrome, holographic billboards, volumetric light shafts, rain, and heat haze.
- **Parallax:** multiple layers (deep skyline, mid-level traffic lanes, foreground structures). Mix 2.5D perspective tilt with flat sprite layers.
- **Post-processing pipeline:** bloom, chromatic aberration on hits, scanline/CRT toggle, screen shake, hit-stop freeze frames, and a shockwave distortion shader for explosions and bombs.
- **Bullet readability:** bright cores, dark outlines, color-coded by danger type. Player shots must never visually hide enemy bullets.
- **Explosions are layered:** flash, then fireball, then debris shards, then smoke, then embers. Large enemies break apart into pieces.

## 2. Endless Level System

- Procedurally generate infinite stages from biome "chunks":
  - Skyway Highway
  - Corporate Spire
  - Orbital Elevator
  - Acid Harbor
  - Magma Foundry
  - Data-Core Void
  - Storm Ring
- **Stage flow:** intro, then 3–5 enemy wave sets, then a mid-boss, then more waves, then the main boss, then a score tally. After that, the next stage is generated.
- **Loop scaling:** each loop increases bullet density and speed, introduces elite enemy variants, and gives bosses new attack phases. Show a "LOOP X" indicator.
- Use a **seeded RNG** so a run can be replayed or shared by its seed.
- **Enemy roster of at least 20 types:** drones, hover cars, gun turrets, armored trucks, carrier ships, suicide bikes, mine layers, shielded walkers, and others. Each type has its own movement script and bullet pattern.

## 3. Playable Roster: 17 Pilots (16 Standard + 1 Legendary)

Build a character-select screen with animated portraits, vehicle previews, stat bars (Speed / Power / Range / Bomb), and a short bio.

Every pilot has:

- A **unique vehicle** with a distinct silhouette and color identity
- A **main shot** (tap) and a **focused shot** (hold), which slows movement and changes the pattern
- A **unique special ability** (cooldown-based)
- A **4-tier power-up progression** that visibly transforms the vehicle and its weapons
- A **bomb** (limited stock) that clears bullets and deals heavy damage
- An **ULTIMATE**: a cinematic super attack charged by grazing bullets and chaining kills, with a cut-in animation

### Original Roster (expand each one into full mechanics)

| # | Pilot | Vehicle | Core Mechanics |
|---|-------|---------|----------------|
| 1 | Kairo Vance | Stormlance (interceptor) | Piercing rail lasers. Ability: phase-dash through bullets. Ultimate: orbital rail strike grid. |
| 2 | Mira Solenne | Halo Sprite (drone ship) | Homing light-needles. Ability: deployable shield orbs. Ultimate: a prism lattice that reflects all enemy bullets. |
| 3 | Bruno Hagen | Ironhound (armored gunship) | Wide flak spread. Ability: brace mode that absorbs a hit. Ultimate: carpet-bomb run. |
| 4 | Tess Kuro | Wireghost (stealth fighter) | Short-range blades. Ability: cloak that freezes bullet tracking. Ultimate: shadow clones that mirror her attacks. |
| 5 | Oduya Rex | Thunderjaw (hover tank) | Arcing plasma mortars. Ability: ground-slam EMP. Ultimate: chain-lightning storm. |
| 6 | Lin Hayase | Petal Engine (bio-tech craft) | Seeding spores that bloom into turrets. Ultimate: a blooming forest of beam pillars. |
| 7 | Dax Morrow | Overclock (hot-rod jet) | Fire rate ramps up with heat. Ability: vent blast. Ultimate: meltdown nova. |
| 8 | Sera Voss | Glacier (cryo frigate) | Freeze rays that slow bullets. Ultimate: time-stop shatter. |
| 9 | NOVA-7 (android) | Cipher (hacker pod) | Hacks enemies into allies. Ultimate: city-wide system override. |
| 10 | Rufus Graine | Junkyard Saint (scrap ship) | Random scrap weapons. Ability: magnet pull. Ultimate: junk meteor. |
| 11 | Aiko Brandt | Tempest (twin-rotor gunship) | Rotating tornado shots. Ultimate: hurricane eye. |
| 12 | Major Eldon Pike | Bastion (flying fortress) | Drone escort wing. Ultimate: full air squadron strike. |
| 13 | Zuri Ankara | Solar Fang (sunskiff) | Charge beam that grows with hold time. Ultimate: miniature-sun collapse. |
| 14 | Cass Rivera | Pulse Rider (hoverbike) | Sonic rings. Ability: rhythm-timed bonus damage. Ultimate: bass-drop shockwave. |
| 15 | Holt & Holt (twins) | Gemini (split-ship) | Two ships that separate and recombine. Ultimate: binary star. |
| 16 | "Warden" (masked commissioner, unlockable) | Verdict (prototype) | Adaptive weapon that copies the last boss defeated. Ultimate: final judgment. |
| 17 | **Vincenzo the Conqueror — LEGENDARY** | Dimensional Hypership | Countless holy bullets with absolute penetration, ignore shields/barriers, 60% instant-defeat chance per hit (clears a boss phase instantly). Ability: Absolute Intangibility (permanently invincible). Bomb: five dimensional rifts fire one-hit blasts, then he transforms into a giant Void Mecha with screen-wide melee that tears dimensions open; abyssal hands drag enemies into the rifts. Ultimate: The God's Trumpet — the mecha shatters to reveal a four-winged divine owl-like form whose screen-wide AOE one-hit-kills everything, including bosses. Full spec in `UPDATE_01_BEFORE_M4.md` Section 2. |

## 4. Boss Design: Six Archetypes, Each with Multiple Phases

1. **Ground Tank** — multi-tread siege machines with destructible turrets, crushing charges, and marked artillery zones.
2. **Aerial** — sky carriers and gunships with drone swarms, beam curtains, and mirrored formations.
3. **Sea (Submarine / Battleship)** — dreadnoughts and stealth subs with broadside volleys, torpedo lanes, and dive/surface cycles.
4. **Mecha** — humanoid war machines with transforming phases, melee swipes, spiral danmaku, and a desperation phase.
5. **Extraterrestrial** — alien organic-tech invaders with gravity wells, splitting crystal shards, and teleporting cores.
6. **Abyssal** — eldritch horrors with limited visibility, edge tendrils, eye weak points, and fading bullets.

**Every phase has its own map design and theme.** On each phase change, bullets clear, the boss plays a transition, the arena crossfades to a new environment (background, palette, terrain, weather, particles), a phase name card appears, and the music layer switches.

Every boss also has a named intro card, a segmented HP bar, breakable parts that drop medals, a multi-stage death animation, and Mk. II / Mk. III versions in later loops. Bosses are data-driven with 5 authored phases each; difficulty decides how many are used. Endless mode rotates through all six archetypes before repeating.

Full spec, example arenas, and data format: `UPDATE_01_BEFORE_M4.md` Section 1.

## 5. Scoring and Systems

- Graze meter (feeds the ultimate), medal chaining, kill-combo multiplier, and a no-bomb boss bonus.
- Power-up drops: **P** (power), **B** (bomb), **S** (speed tune), **1UP**, and medals.
- Lives, continues, and an extend at score thresholds.
- Local high-score table that records pilot and seed.
- Small hitbox shown during focus mode. Generous bomb-on-death window.

## 6. Audio (synthesized, high-impact)

- Distinct per-pilot shot sounds.
- Punchy layered explosions: sub-bass thump, noise burst, metallic tail.
- Crisp graze tick, power-up chimes, and boss warning sirens.
- Heavy bomb impact with a low-pass "underwater" sweep.
- Adaptive procedural synthwave / drum-and-bass soundtrack. Intensity layers add in as bullet density rises, with a boss theme per archetype.
- Master mixer with ducking during bombs/ultimates, plus volume sliders.

## 7. Difficulty

Five difficulties chosen before pilot select: **Standard, Medium, Hard, Extreme, Hell.** They scale bullet speed, bullet density, enemy HP, boss phase count, lives, bombs, loop scaling, revenge bullets, and score multiplier from one config file. Values are in `UPDATE_01_BEFORE_M4.md` Section 3.

## 8. UI / Flow

- **Flow:** title screen, then attract demo, then difficulty select, then pilot select, then stage, then boss, then results, then next stage.
- Pause menu.
- Options: graphics quality, CRT filter, screen shake intensity, key remap.
- Practice mode for any unlocked boss.

---

## Delivery Process

Work in milestones. After each milestone, make sure the game runs without errors, commit to git with a clear message, and give me a short changelog.

| Milestone | Scope |
|-----------|-------|
| **M1** ✅ | Engine core: loop, input, rendering, pooling, collision, camera, post-FX |
| **M2** ✅ | Player system + 4 pilots fully playable |
| **M3** ✅ | Enemy AI, bullet-pattern library, procedural stage generator |
| **M4** | 4a: difficulty system + select screen. 4b: boss framework with per-phase arenas, damage flags, safe defeat routing. 4c: one boss per each of the 6 archetypes |
| **M5** | Remaining 12 standard pilots + Vincenzo (Legendary), ultimates, cut-ins |
| **M6** | Audio engine and adaptive music |
| **M7** | UI, scoring, polish, performance tuning |

### Code Guidelines

- Folder structure: `/core`, `/entities`, `/patterns`, `/bosses`, `/pilots`, `/audio`, `/fx`, `/ui`.
- Define pilots, enemies, and bosses as **data files** so new content is easy to add.
- Comment non-obvious code.
- Keep a `PROGRESS.md` file updated with completed milestones, known issues, and next steps, so work can resume cleanly in a new session.
- Stop at a clean checkpoint after each milestone and wait for my confirmation before continuing.

**M1–M3 are complete. Apply `UPDATE_01_BEFORE_M4.md`, verify M3 still works, then start M4a.**
