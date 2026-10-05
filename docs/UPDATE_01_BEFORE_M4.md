# UPDATE 01 — Design Changes Before M4

**Status:** M1, M2, and M3 are complete. This update changes the design for **M4 onward**.
Read this whole file before writing any code. `NEON_PRECINCT_OVERDRIVE_PROMPT.md` has been updated to match it (v2); if the two ever disagree, this file wins.

---

## 0. Ground Rules (protect existing work)

1. **Do not rewrite or refactor M1–M3 systems.** The engine core, player system, enemy AI, bullet-pattern library, and procedural stage generator stay as they are.
2. The only allowed touches to M1–M3 code are **small, additive hooks**:
   - Reading the new difficulty config (Section 3) where enemy speed, HP, density, and fire rate are already set.
   - Adding a "boss arena mode" switch to the stage/scroll system (Section 1.3) so the stage generator can hand control to a boss arena and take it back afterward.
   - Adding damage flags (`ignoresShields`, `instantKill`, `instantPhaseClear`) to the existing damage/collision path (Section 2.6).
3. Before changing any existing file, list the files you will touch and why. Keep each change minimal.
4. After applying this update, run the game and confirm **M3 still works exactly as before** on Standard difficulty (stages generate, waves spawn, mid-boss placeholder appears) before starting new M4 work.
5. Update `PROGRESS.md` with an "Update 01 applied" entry.

---

## 1. Boss System (replaces old M4 boss section)

### 1.1 Six archetypes

Every archetype has **multiple phases** (3–5 depending on difficulty, see Section 3).

| # | Archetype | Concept | Signature mechanics |
|---|-----------|---------|---------------------|
| 1 | **Ground Tank** | Multi-tread siege machines (e.g., *Colossus Crawler*, *Rail Leviathan*) | Destructible turrets, track-crushing charges, artillery that marks floor zones before impact |
| 2 | **Aerial** | Sky carriers and gunships (e.g., *Skywarden Carrier*, *Mantis Gunship*) | Drone swarms, sweeping beam curtains, mirrored flight formations |
| 3 | **Sea (Submarine / Battleship)** | Naval dreadnoughts and stealth subs (e.g., *Leviathan-Class Dreadnought*, *Abyss Stalker Sub*) | Broadside cannon volleys, torpedo lanes that surface under the player, dive/surface cycles where the boss is only vulnerable while surfaced, deck turrets |
| 4 | **Mecha** | Humanoid war machines (e.g., *Titan Enforcer*, *Seraph-Unit*) | Transforming phases, melee swipes, spiral danmaku, low-HP desperation phase |
| 5 | **Extraterrestrial** | Alien organic-tech invaders (e.g., *Hive Sovereign*, *Star-Eater Prism*) | Gravity wells that bend bullet paths, crystalline shards that split, teleporting cores, alien glyph bullet patterns |
| 6 | **Abyssal** | Eldritch horrors from beneath reality (e.g., *The Drowned Choir*, *Maw of the Deep Below*) | Darkness that limits visibility, tendrils that grab from screen edges, eyes that open as weak points, sanity-style screen distortion, bullets that fade in and out |

### 1.2 Each phase has its own map design and theme

This is the key new requirement. When a boss enters a new phase, **the whole arena changes**: background, palette, terrain, weather, particles, and music layer.

Example progressions (implement at least this level of variety):

- **Ground Tank — Colossus Crawler:** P1 burning highway overpass → P2 collapsed underground tunnel → P3 open desert scrapyard at sunset → P4 molten foundry floor.
- **Aerial — Skywarden Carrier:** P1 above the cloud layer at dawn → P2 inside a lightning storm → P3 upper stratosphere with aurora → P4 edge of orbit, stars appearing.
- **Sea — Leviathan Dreadnought:** P1 harbor at night with searchlights → P2 open ocean in a storm with huge waves → P3 underwater trench (sub dives, view goes submerged) → P4 frozen arctic sea with ice floes.
- **Mecha — Titan Enforcer:** P1 corporate plaza → P2 rooftop helipad in rain → P3 inside a data-core of glowing circuitry → P4 orbital elevator platform.
- **Extraterrestrial — Hive Sovereign:** P1 city under alien invasion → P2 inside the alien mothership → P3 alien crystal planet surface → P4 deep space nebula.
- **Abyssal — Maw of the Deep Below:** P1 flooded ruined city → P2 sunken cathedral → P3 pitch-black void lit only by bullets → P4 inside the creature itself.

### 1.3 Arena system (architecture)

- When the main boss spawns, the stage generator enters **boss arena mode**: normal chunk generation pauses and the boss's arena takes over the background layers.
- When the boss is defeated, the arena hands control back and the stage generator continues to the score tally and next stage exactly as it did in M3.
- **Phase transition sequence** (about 2–3 seconds):
  1. All enemy bullets are cleared and converted to score items.
  2. Boss becomes invulnerable and plays a transition animation (armor breaking, diving, transforming, etc.).
  3. Arena crossfades with a themed effect (screen tear, water flood, warp tunnel, darkness swallow, etc.).
  4. New phase name card appears (e.g., "PHASE 2 — STORM WALL").
  5. Music layer switches. Boss becomes vulnerable again.
- Arenas are built from the same procedural layer system as stages, so no image assets are needed.

### 1.4 Boss data format

Bosses are data-driven. Use this shape (adapt names to existing conventions in the codebase):

```js
// /bosses/sea/leviathanDreadnought.js
export default {
  id: 'leviathan_dreadnought',
  name: 'Leviathan-Class Dreadnought',
  archetype: 'sea', // ground | aerial | sea | mecha | extraterrestrial | abyssal
  phases: [
    {
      name: 'Harbor Siege',
      hp: 4000,
      arena: {
        theme: 'harbor_night',
        palette: ['#0a1428', '#1e3a5f', '#ffcc33'],
        layers: ['skyline_far', 'docks_mid', 'water_surface'],
        weather: 'light_rain',
        particles: ['searchlight_beams', 'sea_spray'],
        scrollSpeed: 0.4,
      },
      transitionFx: 'water_flood',
      patterns: ['broadside_volley', 'deck_turret_fan', 'torpedo_lanes'],
      musicLayer: 'sea_boss_p1',
    },
    // ...more phases
  ],
  breakableParts: [/* turrets, cannons, etc. */],
  deathSequence: 'sink_and_explode',
};
```

The phase count used at runtime is filtered by difficulty (Section 3). Author **5 phases per boss**; lower difficulties skip some.

### 1.5 Every boss still needs

Named intro card, segmented HP bar (one segment per phase), breakable parts that drop medals, an escalating soundtrack layer, a multi-stage death animation, and Mk. II / Mk. III versions in later loops.

### 1.6 Boss rotation in endless mode

Rotate archetypes so the same archetype never appears twice in a row. Each loop should feature all six archetypes before any repeats.

---

## 2. New Pilot: Vincenzo the Conqueror — LEGENDARY

This pilot is implemented in **M5** with the other pilots, but the M4 boss framework must already support the damage flags and boss-defeat routing below.

### 2.1 Overview

| Field | Value |
|-------|-------|
| Pilot | **Vincenzo the Conqueror** |
| Vehicle | **Dimensional Hypership** |
| Rarity | **LEGENDARY** (the only legendary pilot) |
| Roster slot | #17 |

### 2.2 Core mechanic — Holy Bullets

- Fires a dense, countless stream of golden-white **holy bullets**.
- **Absolute penetration:** bullets pass through every enemy they hit and continue to the top of the screen.
- **Ignores all shields and barriers** (`ignoresShields: true`).
- **60% instant-defeat chance on every hit:**
  - Regular enemies and mid-bosses: destroyed instantly.
  - Main bosses: the current phase is cleared instantly (`instantPhaseClear`). This keeps the per-phase arena transitions visible instead of skipping them.
- Visual: radiant bullets with soft halo glow; a brief golden flash and "smite" particle burst on instant-defeat procs.

### 2.3 Ability — Absolute Intangibility

- Vincenzo is **permanently invincible for the entire run**. Bullets, collisions, lasers, and hazards pass through him.
- No hitbox damage; lives are never lost.
- Visual: a faint shimmering dimensional aura; enemy bullets that touch him phase through with a ripple effect.
- Grazing still charges the ultimate meter.

### 2.4 Bomb — Dimensional Rifts → Void Mecha Form

1. **Rift opening:** five dimensional rifts tear open across the screen. Each fires a one-hit-kill blast beam.
2. **Transformation:** Vincenzo and the hypership transform into a **giant Void Mecha** (cinematic cut-in, about 1.5 seconds).
3. **Void Mecha form** (duration: 12 seconds, configurable as `VOID_FORM_DURATION`):
   - Attacks become **melee slashes with screen-wide reach**.
   - Each slash **tears dimensions open**. From each tear, **abyssal hands** reach out, grab enemies, and drag them into the rift, where they vanish (dissolve and implode effect).
   - Enemies and mid-bosses that are grabbed are removed. Main bosses that are grabbed are defeated (see Section 2.6).
   - Absolute immortality and invincibility during the form.
4. When the timer ends, the mecha folds back into the hypership.

### 2.5 Ultimate — The God's Trumpet

1. The Void Mecha armor shatters (if not already in mecha form, the ship shatters instead), revealing Vincenzo's final form: a **giant divine owl-like creature with four wings**.
2. Cinematic cut-in with radiant light rays and feathers (about 2 seconds).
3. **Divine form** (duration: 20 seconds, configurable as `DIVINE_FORM_DURATION`):
   - Absolute immortality and intangibility.
   - Every attack is **"The Trumpet"**: a very wide AOE sound-and-light wave that **one-hit-kills everything on screen**, including entire enemy waves and the largest bosses.
   - Visual: concentric golden shockwaves, screen-wide bloom, feathers drifting. Audio: a deep brass-like synthesized blast with a long reverb tail.
4. The one-hit property applies everywhere in the game (all stages, all bosses, all loops, all difficulties).

### 2.6 Engineering requirements for one-hit effects (needed in M4)

- Add damage flags to the existing damage path: `ignoresShields`, `instantKill`, `instantPhaseClear`.
- **Every instant defeat must go through the boss's normal defeat path.** That means the death animation plays, score and medals are awarded, the arena hands control back, and the stage generator advances. No softlocks, no frozen screens, no skipped stage tally.
- If a boss is defeated while mid-transition, the transition completes or is safely cancelled first.

### 2.7 Legendary presentation

- On the pilot select screen, Vincenzo's card has an animated gold-and-void border, particle shimmer, and a "LEGENDARY" badge.
- Unique select voice/sound sting (synthesized choir chord).
- His high scores appear in the table with a **Legendary** tag so they display separately from the other 16 pilots.

---

## 3. Difficulty Select

### 3.1 Flow change

**Title → Difficulty Select → Pilot Select → Stage.**
The chosen difficulty is shown in the HUD and saved with each high-score entry.

### 3.2 Difficulty table

Store this in a single config file (e.g., `/core/difficulty.js`). All systems read from it; do not hard-code values elsewhere.

| Setting | Standard | Medium | Hard | Extreme | Hell |
|---------|----------|--------|------|---------|------|
| Enemy bullet speed | ×0.8 | ×1.0 | ×1.2 | ×1.4 | ×1.7 |
| Bullet density | ×0.7 | ×1.0 | ×1.3 | ×1.6 | ×2.0 |
| Enemy HP | ×0.8 | ×1.0 | ×1.25 | ×1.5 | ×2.0 |
| Boss phases | 3 | 3 | 4 | 5 | 5 + desperation |
| Starting lives | 5 | 4 | 3 | 2 | 1 |
| Starting bombs | 4 | 3 | 3 | 2 | 1 |
| Loop scaling rate | ×0.75 | ×1.0 | ×1.25 | ×1.5 | ×2.0 |
| Revenge bullets (on enemy death) | No | No | No | Yes | Yes (dense) |
| Score multiplier | ×1.0 | ×1.5 | ×2.0 | ×3.0 | ×5.0 |

### 3.3 Difficulty select screen

Five large selectable cards, each with a color identity (Standard = cyan, Medium = green, Hard = amber, Extreme = red, Hell = black/crimson with flickering flames), a one-line description, and a short preview of bullet density. Hell plays a distorted warning sound when highlighted.

---

## 4. Revised Milestones

| Milestone | Status | Scope |
|-----------|--------|-------|
| M1 | ✅ Done | Engine core |
| M2 | ✅ Done | Player system + 4 pilots |
| M3 | ✅ Done | Enemy AI, bullet patterns, stage generator |
| **M4** | Next | **4a:** difficulty config + difficulty select screen, hooked into M3 systems. **4b:** boss framework with arena mode, per-phase arena transitions, damage flags, and safe defeat routing. **4c:** one complete boss for each of the **6 archetypes**, each with 5 authored phases and unique arenas. |
| M5 | — | Remaining 12 standard pilots + **Vincenzo (Legendary)** with Void Mecha and Divine Owl forms, ultimates, cut-ins |
| M6 | — | Audio engine and adaptive music (including per-phase music layers and archetype themes) |
| M7 | — | UI, scoring, polish, performance tuning |

Complete M4 in the order 4a → 4b → 4c. Stop after each sub-step, confirm the game runs, commit, and wait for my go-ahead.

**Apply this update, verify M3 still works, then begin M4a.**
