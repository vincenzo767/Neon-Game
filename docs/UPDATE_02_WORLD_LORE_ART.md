# UPDATE 02 — World, Lore, Factions & Art Direction

**Status:** M1–M3 done. M4a and M4b done. **M4c is in progress.**
Read this whole file before writing any code. It builds on `UPDATE_01_BEFORE_M4.md`; both stay in force. If they conflict, the newer update (this file) wins.

---

## 0. Ground Rules (protect M4c work in progress)

1. **Finish the boss you are currently building exactly as planned.** Do not restart it or rename it.
2. **Do not rename any existing boss, enemy, pattern, file, or ID.** The six example bosses from Update 01 keep their names; this update only assigns them to factions.
3. **Do not change boss HP, phase logic, bullet patterns, arena transitions, or damage flags** built in M4b/M4c.
4. For the **remaining M4c bosses**, follow the art direction in Section 4 while building them.
5. Bosses already finished in M4c get their visual retrofit in **M4d** (Section 6), not now.
6. Lore and faction content lives in **new data files** (`/data/lore/`, `/data/factions/`). Existing systems read from them through small additive hooks only.
7. Before touching any existing file, list it and the reason. After applying this update, run the game and confirm M3 stages and all finished M4c bosses still work.
8. Add an "Update 02 applied" entry to `PROGRESS.md`.

---

## 1. World Overview

### 1.1 The City: New Meridian

A vertical megacity built on a reclaimed ocean shelf in the year 2189. It stacks in layers:

| Layer | Description |
|-------|-------------|
| **The Spindle** | An orbital elevator rising from the city's center to a ring station in orbit |
| **The Crown** | Corporate skyscrapers above the cloud line, connected by sky-bridges |
| **The Grid** | Elevated highways, mag-rail lines, and neon commercial districts |
| **The Docks** | Acid-polluted harbor and floating shipyards on the city's edge |
| **The Furnace** | Underground foundries and reactor halls beneath the city |
| **The Undercity** | Old flooded districts sunk below sea level, sealed off and forgotten |

### 1.2 The Inciting Event: The Breach

Helix Dynamics, the city's most powerful corporation, ran a secret experiment called **Project HALCYON** to pull energy from other dimensions. It failed. The experiment tore two wounds in reality:

- **The Upper Breach** opened in orbit above the Spindle. Through it came an alien hive intelligence.
- **The Lower Breach** opened in the deep trench beneath the Undercity. Through it came ancient abyssal entities.

Helix covered it up. In the chaos, the city's criminal syndicates united under a secret council called **The Undercrown**, each one profiting from the Breach in its own way.

### 1.3 The Heroes: Overdrive Precinct

The city's last honest police division. An elite squad of 16 pilots flying experimental pursuit vehicles, each recruited for one reason: they are the only ones willing to go where the Undercrown rules.

### 1.4 The Legend: Vincenzo the Conqueror

No police record exists for him. Witnesses say he stepped out of the Upper Breach in the first hour, walked through the alien vanguard untouched, and offered his service to the Precinct without a word about where he came from. The squad calls him "the Conqueror." The syndicates call him "the Herald," because his true form, the four-winged divine owl, appears in the oldest abyssal carvings found in the Undercity, depicted as the one being the deep entities fear.

### 1.5 Endless Loop Lore

Each loop is a new night of the war. With every loop the Breach widens, which is why enemies grow stronger. Show a short story line on the loop card, for example:

- *LOOP 2 — "The Breach widens. The Undercrown grows bold."*
- *LOOP 5 — "The sky over New Meridian no longer shows stars."*
- *LOOP 10 — "The deep is waking."*

Write at least 12 loop lines; after the last one, cycle with the loop number shown.

---

## 2. The Undercrown: Six Syndicates

Each syndicate owns one boss archetype, its own biomes, enemy roster, visual identity, animation style, and firing language.

### 2.1 The Ironclad Brotherhood — Ground Tank faction

| Field | Detail |
|-------|--------|
| **Who** | Ex-military salvage gangs who rule the highways and foundries with armored war-rigs |
| **Territory** | Skyway Highway, Magma Foundry |
| **Leader** | "Warlord" Gideon Raske |
| **Boss** | Colossus Crawler (existing), Rail Leviathan |
| **Palette** | Rust red, oxidized brown, hazard yellow, burning orange |
| **Visual identity** | Riveted armor plates, welded scrap, hazard stripes, smokestacks, giant treads |
| **Enemies** | Ram trucks, flamethrower buggies, mortar crawlers, armored transports that unload infantry turrets, wrecker cranes |
| **Animation** | Treads that visibly roll, exhaust puffs, sparks on armor hits, turrets that rotate to track the player, armor plates that fall off when damaged |
| **Firing language** | Heavy orange slugs, flak bursts, mortar shells with ground target markers, short-range flame cones |

### 2.2 The Stratos Cartel — Aerial faction

| Field | Detail |
|-------|--------|
| **Who** | Smugglers who control every sky-lane above the Crown |
| **Territory** | Storm Ring, Corporate Spire (upper skies) |
| **Leader** | Madame Corvina Hale |
| **Boss** | Skywarden Carrier (existing), Mantis Gunship |
| **Palette** | Cobalt blue, white, steel gray, cyan engine glow |
| **Visual identity** | Sleek swept wings, large twin turbines, segmented tails, carrier decks |
| **Enemies** | VTOL gunships, kite drones, interceptor squadrons in V-formation, bomber blimps, cargo jets that drop mines |
| **Animation** | Banking turns, afterburner flare, wing flaps that open to reveal guns, formation fly-ins and fly-outs, vapor trails |
| **Firing language** | Long beam curtains, chained segmented shots, homing micro-missiles with smoke trails, fast aimed needle streams |

### 2.3 The Black Tide — Sea faction

| Field | Detail |
|-------|--------|
| **Who** | Pirate admirals who control the harbor, the shipyards, and every smuggling route by sea |
| **Territory** | Acid Harbor |
| **Leader** | Admiral Marrow Quell |
| **Boss** | Leviathan-Class Dreadnought (existing), Abyss Stalker Sub |
| **Palette** | Deep navy, verdigris green, acid teal, brass |
| **Visual identity** | Barnacled steel hulls, brass fittings, deck cannons, periscopes, sonar domes |
| **Enemies** | Hovercraft raiders, gunboats, mini-subs that surface to fire, mine buoys, deck-turret barges |
| **Animation** | Wake trails, hulls rising and sinking with waves, submerging and surfacing with splash and bubble effects, water spray on hits |
| **Firing language** | Torpedoes with bubble trails, broadside cannon volleys, depth charges that burst in rings, water-spout pillars |

### 2.4 Helix Dynamics — Mecha faction (the mastermind)

| Field | Detail |
|-------|--------|
| **Who** | The megacorp that caused the Breach and secretly funds the Undercrown to keep it hidden |
| **Territory** | Corporate Spire, Data-Core Void, Orbital Elevator |
| **Leader** | CEO Aurelia Voss-Kane |
| **Boss** | Titan Enforcer (existing), Seraph-Unit |
| **Palette** | Gunmetal, white ceramic, corporate magenta, data-blue |
| **Visual identity** | Clean armor panels over dense exposed machinery, pipes and cables, glowing cores, corporate logos (original only) |
| **Enemies** | Android troopers, security mech walkers, shield drones, laser turrets, transforming jet-mechs |
| **Animation** | Mechanical transformations (fold, rotate, lock), joint pistons, visor glows before firing, hydraulic steam vents |
| **Firing language** | Precise lasers, rotating spiral patterns, electric lightning beams, hexagonal shield projections |

### 2.5 The Choir of the Outer Star — Extraterrestrial faction

| Field | Detail |
|-------|--------|
| **Who** | A cult that worships the alien hive from the Upper Breach, plus the alien forces themselves |
| **Territory** | Orbital Elevator (upper levels), alien-infested city zones |
| **Leader** | The Hive Sovereign (alien) and its human prophet, Sister Ilune |
| **Boss** | Hive Sovereign (existing), Star-Eater Prism |
| **Palette** | Bioluminescent violet, crystal pink, iridescent green, starlight white |
| **Visual identity** | Organic shells fused with crystal, pulsing veins, floating geometric shapes, alien glyphs |
| **Enemies** | Crystal drones, spore pods, hive swarmers, cultist gunships with alien grafts, teleporting prism nodes |
| **Animation** | Pulsing and breathing, crystal growth, teleport shimmer, splitting into smaller enemies, glyphs lighting up before attacks |
| **Firing language** | Gravity wells that curve bullet paths, crystal shards that split, glyph-shaped bullet formations, pink petal-like bursts |

### 2.6 The Drowned Covenant — Abyssal faction

| Field | Detail |
|-------|--------|
| **Who** | An ancient cult in the sealed Undercity that serves the abyssal entities from the Lower Breach |
| **Territory** | Flooded Undercity, the deep trench |
| **Leader** | The Hollow Bishop |
| **Boss** | Maw of the Deep Below (existing), The Drowned Choir |
| **Palette** | Abyss black, bone white, sickly sea-green, deep crimson |
| **Visual identity** | Tentacles, eyes, coral-crusted ruins, rotting cathedral stonework merged with flesh |
| **Enemies** | Eyed floaters, tendril mines, drowned cultist skiffs, bone-shell crawlers, shadow wraiths |
| **Animation** | Slow, unsettling motion, eyes opening and blinking, tendrils whipping in from screen edges, darkness spreading, ripple distortion |
| **Firing language** | Bullets that fade in and out, ink-cloud bursts, slow massive orbs, whip-like tendril lasers |

### 2.7 Biome ownership

| Biome (existing in M3) | Owner faction |
|------------------------|---------------|
| Skyway Highway | Ironclad Brotherhood |
| Magma Foundry | Ironclad Brotherhood |
| Storm Ring | Stratos Cartel |
| Acid Harbor | Black Tide |
| Corporate Spire | Helix Dynamics (ground) / Stratos Cartel (skies) |
| Data-Core Void | Helix Dynamics |
| Orbital Elevator | Helix Dynamics (lower) / Choir of the Outer Star (upper) |
| **Sunken Undercity** *(new, additive)* | Drowned Covenant |
| **Fallen Star Crater** *(new, additive)* | Choir of the Outer Star |

Add the two new biomes as **new registry entries only**. Do not change existing biome code.

### 2.8 Stage presentation

Each stage begins with a faction intro card: faction emblem (original, code-generated), faction name, territory name, and a one-line threat briefing from Precinct dispatch. Example:
*"DISPATCH: Black Tide gunboats spotted in Acid Harbor. Admiral Quell's flagship is on the move."*

---

## 3. Data Files

```
/data/lore/world.js          // city layers, Breach, loop story lines
/data/lore/pilots.js         // pilot bios (adds lore to existing pilot data, does not replace it)
/data/factions/ironclad.js
/data/factions/stratos.js
/data/factions/blacktide.js
/data/factions/helix.js
/data/factions/outerstar.js
/data/factions/drowned.js
```

Faction file shape (adapt to existing conventions):

```js
export default {
  id: 'ironclad',
  name: 'The Ironclad Brotherhood',
  archetype: 'ground',
  leader: 'Warlord Gideon Raske',
  palette: { primary: '#8b2a1a', secondary: '#5a3a24', accent: '#ffcc00', glow: '#ff7a1a' },
  biomes: ['skyway_highway', 'magma_foundry'],
  bosses: ['colossus_crawler', 'rail_leviathan'],   // existing IDs, unchanged
  enemyVariants: ['ram_truck', 'flame_buggy', 'mortar_crawler'],
  bulletStyle: 'heavy_slug',
  animationTraits: ['tread_roll', 'exhaust_puff', 'armor_shed'],
  introLine: 'DISPATCH: Ironclad war-rigs are blocking the Skyway.',
};
```

Existing M3 enemies get a `faction` field and a faction-tinted variant. Their behavior and patterns stay the same.

---

## 4. Art Direction Bible

The target style is late-90s high-end arcade shmup art: **dense, highly detailed mechanical designs seen from directly above**, huge bosses that dominate the screen, and extremely readable glowing bullets. All of it must be original designs, generated in code.

### 4.1 Camera and perspective

- Strict top-down view with a very slight forward tilt so the tops of vehicles and buildings are visible.
- Ground layers (roads, decks, foundry floors) scroll beneath the action. Lane markings, crosswalks, grates, and panel seams sell the speed of scrolling.
- City edges show building rooftops and walls along the left and right sides of the play field.

### 4.2 Detail density ("greeble" rule)

Large machines must look built, not drawn. Write a **procedural greeble generator** that decorates any vehicle or boss shape with:

- Panel lines and plate seams
- Rivet rows along plate edges
- Hazard stripes on moving parts and weapon housings
- Vents, exhaust ports, pipes, and cable bundles
- Small lights that blink on idle
- Glowing energy cores and turbine discs

Apply faction palettes to the generator so each syndicate's machines feel distinct.

### 4.3 Lighting and shading

- Fake top-left key light: lighter top-left edges, darker bottom-right edges on every part.
- Metallic gradient bands on curved surfaces.
- Emissive parts (cores, engines, eyes, glyphs) glow and feed the bloom pass.
- Drop shadows from aerial units onto the ground layer, offset down-right.

### 4.4 Boss scale and construction

- Main bosses cover **50–80% of the play field width**. Mid-bosses cover 25–40%.
- Build bosses from **separate parts** (body, turrets, arms, wings, cores) so parts can rotate, animate, break off, and explode independently.
- Every boss needs a clear, glowing **weak point** that brightens as it takes damage.
- Damage states: at 66% and 33% HP per phase, parts visibly dent, spark, smoke, and expose inner machinery.

### 4.5 Enemy bullet language (readability first)

| Bullet type | Look | Used by |
|-------------|------|---------|
| Standard orb | Orange-red glowing ball with a white-hot core and dark outline | All factions (base type) |
| Slug | Elongated orange capsule pointing along its path | Ironclad |
| Needle | Thin cyan streak | Stratos |
| Torpedo | Capsule with bubble trail | Black Tide |
| Laser / lightning | Jagged green-white or magenta beam with glow, warning line first | Helix |
| Crystal shard | Pink-violet faceted shard that splits | Outer Star |
| Void orb | Black orb with crimson rim that fades in and out | Drowned Covenant |

Rules: enemy bullets are always warm or high-contrast colors with dark outlines; player shots are always cool or translucent so they never hide enemy bullets. Large lasers always show a thin warning line before firing.

### 4.6 Player firing concepts

- **Main shots:** layered spreads of glowing projectiles, mostly blue, white, green, and violet, with small muzzle flashes at the ship.
- **Focused shots:** concentrated beams, lightning strands, or charged lances that visually lock onto the target.
- **Power-up tiers:** each tier visibly adds more streams, wider spread, larger projectiles, and new option pods around the ship.
- **Charge and impact:** every hit shows small impact sparks; heavy shots produce flare bursts on contact.
- **Bombs:** screen-scale events with shockwave distortion, bullet-clearing flashes, and a distinct look per pilot.
- **Vincenzo:** holy bullets are golden-white with soft halos; his effects use gold, white, and void black only, so he looks different from every other pilot.

### 4.7 Explosions

Small enemies: flash, fireball, sparks. Large enemies: chained explosions across the hull, then parts flying off, then a large fireball with smoke. Bosses: a multi-stage chain reaction across every part, a white-out flash, debris rain, and lingering fire on the ground layer.

### 4.8 HUD (classic arcade layout)

- Top bar: player score, high score, difficulty, stage or loop number, boss name when active.
- Bottom-left: bomb stock icons. Top-left under the score: lives.
- Pop-up text in the play field: "SHOT LEVEL UP!", "1UP", "BOMB +1", medal chain counter.
- Pixel-style bitmap font (code-generated) with outlines for readability.

---

## 5. Animation Standards (all factions)

Every enemy and boss needs these states:

| State | Requirement |
|-------|-------------|
| **Spawn / entry** | Flies, drives, surfaces, teleports, or emerges in, depending on faction |
| **Idle** | Never fully static: blinking lights, rotating turrets, engine flicker, breathing, bobbing |
| **Telegraph** | A visible wind-up before every major attack (glow charge, warning line, part opening) |
| **Attack** | Recoil, muzzle flash, part movement synchronized with bullets |
| **Hit** | White flash for 1–2 frames plus faction-specific hit effect (sparks, splash, crystal chips, ink) |
| **Damaged** | Progressive damage visuals as described in Section 4.4 |
| **Death** | Faction-specific death (explode, sink, shatter, dissolve into darkness) |

---

## 6. Revised Milestones

| Milestone | Status | Scope |
|-----------|--------|-------|
| M1–M3 | ✅ Done | Engine, player, enemies, stage generator |
| M4a, M4b | ✅ Done | Difficulty system, boss framework |
| **M4c** | In progress | Finish the six archetype bosses. Apply Section 4 art direction to bosses not yet started. |
| **M4d** | New | **World & faction pass:** create lore and faction data files; add the greeble generator; tag M3 enemies with factions and faction-tinted variants; add the two new biomes; add stage intro cards and loop story lines; visually retrofit bosses finished before this update (visuals only, no logic changes) |
| M5 | — | Remaining 12 standard pilots + Vincenzo (Legendary), with Section 4.6 firing concepts |
| M6 | — | Audio, including a musical identity per faction |
| M7 | — | UI, scoring, polish, performance tuning |

**Apply this update, finish the current M4c boss, complete M4c, then begin M4d.** Stop after each step, confirm the game runs, commit, and wait for my go-ahead.
