# MASTER DEVELOPMENT PROMPT
# Vertical Manic Shooter — Boss System, Arena World-Building, Realistic Environments, and Motion FX Overhaul

## 0. YOUR ROLE

Act as a senior game developer, rendering engineer, technical artist, gameplay systems architect, and performance engineer.

You are working on my existing vertical manic shooting game. Your task is to upgrade the existing boss and arena systems from placeholder-based environments into a polished, visually coherent, realistic 3D-style vertical shooter.

You must work directly with the existing codebase.

Do not merely provide recommendations, generate concept descriptions, or produce isolated code snippets. Inspect the actual project, implement the changes, run the game and tests where possible, inspect the rendered results, and fix problems discovered during validation.

The final objective is a game with:

- Six boss archetypes.
- Five unique bosses per archetype.
- Thirty distinct boss identities.
- Five authored phase-arena configurations per boss.
- Up to 150 phase-arena configurations.
- Realistic battlefield environments with recognizable geography, structures, and terrain.
- Continuous scrolling, parallax, environmental animation, and realistic combat effects.
- Functional boss encounters that preserve existing combat, scoring, difficulty, progression, and seeded rotation.
- Mobile-friendly performance and readable gameplay.

The goal is not simply to make the backgrounds prettier. The goal is to make each encounter feel like a battle taking place in a real, distinctive environment.

---

# PART I — PROJECT AUDIT AND EXISTING FUNCTIONALITY

## 1. Inspect the actual codebase before making changes

Start by examining the repository structure, package configuration, rendering technology, game loop, scene architecture, asset pipeline, and existing boss implementation.

The currently known modules include:

- `bosses/index.js`
- `bosses/arenas.js`
- `bosses/Arena.js`
- `bosses/BossController.js`
- `transitions.js`
- Existing boss definition files.
- Existing Gatekeeper mid-boss implementation.
- Existing stage, wave, enemy, projectile, scoring, medal, difficulty, and music systems.

These paths are based on the current project description. Verify the actual paths, filenames, imports, exports, and implementation before editing.

Determine:

1. Which rendering engine and graphics APIs are being used.
2. Whether the game renders with Canvas 2D, WebGL, WebGPU, Three.js, PixiJS, Phaser, a native game engine, or another technology.
3. How the existing arena background is drawn and updated.
4. How the player, enemies, boss, projectiles, and environmental effects are rendered.
5. How scrolling and camera movement work.
6. How assets are loaded, cached, and released.
7. How boss phases and phase transitions are managed.
8. How seeded randomness and boss selection work.
9. How the game handles resolution scaling and portrait orientation.
10. Whether the project already has particle systems, shaders, animation utilities, sprite atlases, or reusable rendering primitives.

Identify all placeholder components, including flat rectangles, generic geometric structures, repeated tile patterns, static environmental layers, and placeholder particle effects.

Before implementation, provide a concise audit containing:

- Current architecture.
- Existing functionality that must be preserved.
- Placeholder components that need replacement.
- Missing assets and rendering capabilities.
- Proposed files to create or modify.
- Technical risks and compatibility concerns.
- The exact first checkpoint you will implement.

Do not assume the project uses a particular engine without inspecting it.

Do not replace the entire rendering architecture merely because another framework offers different capabilities.

Reuse the existing architecture when technically appropriate. If a major architectural change is necessary, explain the reason and its migration cost before proceeding.

## 2. Preserve the current gameplay contract

The existing game has the following behavior.

### Stage structure

A stage contains:

1. Normal enemy waves.
2. A mid-boss.
3. Additional enemy waves.
4. The main boss encounter.

There is currently one main boss encounter per stage.

The existing Gatekeeper mid-boss does not use the full main-boss arena system. Preserve this behavior unless optional arena support is explicitly implemented without breaking its current logic.

### Existing flagship bosses

The current registry contains six bosses:

| Archetype | Existing boss |
|---|---|
| Ground | Colossus Crawler |
| Aerial | Skywarden Carrier |
| Naval | Leviathan Dreadnought |
| Mecha | Titan Enforcer |
| Extraterrestrial | Hive Sovereign |
| Abyssal | Maw of the Deep |

These bosses are the flagship entries of the expanded roster.

Preserve their existing identities, working combat behavior, IDs, references, and progression relationships wherever possible.

### Existing boss rotation

Bosses are selected using a seeded shuffled deck of the six archetypes.

Preserve these invariants:

- Every archetype appears once before an archetype repeats.
- The same archetype never fights twice consecutively, including across deck boundaries.
- The order is deterministic for the same run seed and equivalent initial state.
- Boss selection does not unexpectedly alter the player's run progression.
- Adding the new roster does not accidentally create duplicate archetypes within a deck.

The expanded system must distinguish archetype selection from boss-variant selection. Details are defined later in this prompt.

### Existing Mk. progression

The current system increases boss Mk. levels by six-stage deck progression:

- First six stages: Mk. I.
- Next six stages: Mk. II.
- Next six stages: Mk. III, the current cap.

Verify the actual implementation of Mk. progression before modifying it.

Preserve the existing 35% HP increase per Mk. tier, associated score and medal scaling, and additional attack patterns.

Do not assume that visual arena complexity should automatically increase boss damage or HP. Environmental presentation and combat difficulty must remain separate systems.

### Existing boss phases

Each main boss has five authored phases.

Each phase has:

- Its own arena theme.
- A phase-specific boss combat configuration.
- An independent health segment.
- A transition from the preceding phase.
- A display name.
- Applicable music-layer changes.

Damage dealt in one phase must not carry over into the next phase.

Preserve the existing phase-health behavior.

### Existing phase transition behavior

The current phase transition lasts approximately 2.4 seconds.

During the transition:

1. Enemy bullets are converted into gold score stars.
2. The boss becomes invulnerable.
3. The arena transitions to the next environment.
4. A transition effect plays.
5. A phase-introduction card appears.
6. Music layers change where configured.
7. The next phase becomes active.

Preserve these behaviors and ensure that the new rendering system does not interrupt them.

### Existing timeout behavior

A phase that exceeds 75 seconds ends according to the current timeout rules and loses its phase bonus.

Preserve the existing timeout and reward semantics.

### Existing difficulty rules

Preserve the existing difficulty-to-phase selection:

| Difficulty | Active phases |
|---|---|
| Standard / Medium | 1, 3, 5 |
| Hard | 1, 2, 4, 5 |
| Extreme | 1, 2, 3, 4, 5 |
| Hell | All five phases plus Desperation |

Every difficulty must retain phase 1 and phase 5.

Hell adds the existing half-HP Desperation phase using the final-phase arena, with any boss-specific Desperation arena override preserved.

Do not change these rules without an explicit technical necessity.

---

# PART II — THE SIX BOSS ARCHETYPES AND 30 UNIQUE BOSSES

## 3. Establish six independent archetypes

The game has exactly six overall boss archetypes:

1. Ground.
2. Aerial.
3. Naval.
4. Mecha.
5. Extraterrestrial (Space).
6. Abyssal.

Each archetype must have five distinct boss identities.

The archetype determines the boss's physical form, movement, weapons, combat behavior, and visual identity.

The arena determines where the encounter takes place.

These concepts must remain separate.

For example, a Mecha boss may fight in a frozen weapons facility, a ruined city, an underground reactor, or an orbital shipyard without changing its archetype.

A Ground boss can fight in a snowy battlefield, desert, ruined city, underground facility, or industrial complex.

Do not restrict an archetype to one environment type.

## 4. Expand the roster to 30 unique boss identities

Use the following proposed roster as the initial content specification. Retain the existing flagship bosses and map their stable IDs to the current implementation.

New names may be adjusted to fit existing lore, but the six-archetype, five-boss structure must remain intact.

### Ground — five bosses

1. Colossus Crawler — existing flagship boss.
2. White Fang — heavy siege tank.
3. Sandbreaker — desert assault tank.
4. Urban Devastator — armored siege walker.
5. Iron Vein — underground drilling fortress.

### Aerial — five bosses

1. Skywarden Carrier — existing flagship boss.
2. Frostline Interceptor — high-speed aerial fighter.
3. Scorchwind Bomber — heavy bombardment aircraft.
4. Ironwing Fortress — airborne military fortress.
5. Tempest Crown — storm-generating aircraft.

### Naval — five bosses

1. Leviathan Dreadnought — existing flagship boss.
2. Whiteout Breaker — arctic warship.
3. Coral Siege — coastal missile battleship.
4. Black Tide Rig — armored offshore platform.
5. Abyssal Hunter — submarine warfare platform.

### Mecha — five bosses

1. Titan Enforcer — existing flagship boss.
2. Frostframe Colossus — heavy cold-weather combat machine.
3. Sandstorm Juggernaut — desert assault mecha.
4. Helios Executioner — advanced humanoid war machine.
5. Omega Foundry — autonomous mechanical weapons platform.

### Extraterrestrial — five bosses

1. Hive Sovereign — existing flagship boss.
2. Shatterbelt Devourer — asteroid-consuming alien entity.
3. Null Citadel — ancient alien megastructure.
4. Crimson Expanse — hostile alien energy cruiser.
5. Singularity Regent — cosmic superweapon.

### Abyssal — five bosses

1. Maw of the Deep — existing flagship boss.
2. Hadal Warden — deep-trench guardian.
3. Drowned Monarch — ancient submerged ruler.
4. Black Furnace — hydrothermal war machine.
5. Nameless Leviathan — colossal abyssal entity.

Do not generate all 30 as superficial copies.

Every boss needs its own visual identity, silhouette, attack patterns, movement style, arena associations, phase progression, and asset manifest.

Where several bosses share a broad body type, differentiate them through silhouette, armor construction, weapons, movement, attack behavior, and environmental interaction.

## 5. Create a structured boss definition

Each boss definition must support the following information, adapted to the existing coding conventions:

- Stable unique boss ID.
- Display name.
- Archetype ID.
- Model or sprite references.
- Boss scale and rendering configuration.
- Movement and positioning behavior.
- Attack pattern definitions.
- Phase-specific combat settings.
- Five phase-arena references.
- Mk. progression overrides where needed.
- Desperation configuration.
- Score and medal reward configuration.
- Entry, transformation, and defeat presentation.
- Required assets and optional asset dependencies.

Separate the boss's combat definition from its arena's rendering definition.

Do not place all environmental geometry, particle logic, and scrolling code inside individual boss definition files.

## 6. Implement two-level seeded boss selection

The expanded roster requires two separate selection layers.

### Layer A: Archetype selection

Continue using the existing seeded deck of six archetypes.

Requirements:

- All six archetypes appear once per deck.
- No archetype repeats until the deck is exhausted.
- No identical archetype occurs consecutively across a deck boundary.
- The same run seed and equivalent state produce the same sequence.
- The selection logic must not depend on nondeterministic rendering updates or unrelated random calls.

Preserve the existing seed mechanism and serialized run state where possible.

### Layer B: Boss-variant selection

Within each archetype, maintain a seeded shuffled deck of its five boss variants.

Requirements:

- Avoid repeating a boss variant until all five variants of that archetype have been used.
- Keep variant selection independent from archetype selection.
- Preserve deterministic behavior.
- Handle missing or disabled boss definitions safely.
- Do not let missing assets cause the selector to choose invalid boss entries.
- Do not introduce accidental duplicate bosses within a completed variant deck.

Define deterministic recovery behavior when a boss is unavailable.

Document whether roster changes affect old seeded runs. Avoid silently changing existing saved progression semantics.

The archetype deck and the variant decks must not accidentally share mutable shuffle state.

## 7. Keep Mk. progression independent from roster size

The Mk. level should continue to follow the existing six-stage progression.

Do not reinterpret Mk. progression as advancing after every five unique bosses of an archetype.

Do not change the 35% HP scaling, score and medal rewards, or attack-pattern upgrades unless the existing implementation demonstrates that a correction is necessary.

Verify how the Mk. cap is enforced and preserve it.

---

# PART III — THE ARENA WORLD-BUILDING SYSTEM

## 8. Redefine what an arena represents

In this game, an arena is the complete environment that takes over the screen during a boss phase.

It is not simply a color palette or background texture.

A complete arena should define:

- Environment identity.
- Biome or location.
- Distant scenery.
- Midground landmarks.
- Main battlefield terrain or structure.
- Near-field environmental details.
- Materials and surface appearance.
- Lighting and atmospheric depth.
- Scrolling and parallax.
- Weather and ambient effects.
- Environmental animation.
- Optional destruction or interaction.
- Optional gameplay-affecting visibility rules.
- Transition compatibility.
- Audio or music-layer cues where supported.
- Required assets and performance settings.

An arena must be recognizable by its geometry, landmarks, terrain, and environmental composition even when color grading is disabled.

Do not create distinct arenas merely by changing the tint of the same background.

## 9. Create 150 authored phase-arena configurations

Each of the 30 bosses must have five phase-arena configurations.

The total is 150 phase-arena configurations.

These configurations do not need to be 150 completely separate rendering implementations.

Instead, use:

- Shared rendering systems.
- Reusable environmental modules.
- Shared materials and textures.
- Reusable weather and particle systems.
- Environment-specific geometry or sprite layers.
- Dedicated arena compositions.
- Per-phase configuration data.

The difference between environments must be visible in the actual rendered result.

Reuse an asset when appropriate, but do not reuse the same overall composition so heavily that separate encounters become indistinguishable.

Every arena configuration must have a stable unique ID.

Every boss phase must reference a valid arena configuration.

The system must validate references and identify missing assets before the encounter begins.

## 10. Proposed environment compositions

Use these as content guidelines rather than rigid restrictions.

### Ground environments

Potential environments:

- Snow-covered military front.
- Desert wasteland.
- Destroyed urban battlefield.
- Underground military complex.
- Industrial foundry.

Visual details should include appropriate terrain, roads, tracks, craters, bunkers, wrecked vehicles, dust, snow, rubble, and industrial structures.

### Aerial environments

Potential environments:

- Snowy mountain airspace.
- Desert canyon.
- Modern megacity skyline.
- Military airbase.
- Thunderstorm.

Visual details should include layered clouds, atmospheric perspective, mountain ridges, rooftop silhouettes, runways, hangars, rain, wind, contrails, and distant aircraft formations.

### Naval environments

Potential environments:

- Open ocean.
- Arctic waters.
- Tropical harbor.
- Offshore oil field.
- Stormy sea near a trench entrance.

Visual details should include animated ocean surfaces, ship wakes, foam, reflections, coastlines, piers, offshore platforms, waves, splashes, spray, smoke, and water impacts.

### Mecha environments

Potential environments:

- Frozen weapons facility.
- Desert weapons-testing range.
- Ruined metropolitan district.
- Underground reactor complex.
- Orbital manufacturing station.

Visual details should include large industrial structures, mechanical facilities, damaged architecture, exposed machinery, reactor chambers, gantries, and manufacturing equipment.

### Extraterrestrial environments

Potential environments:

- Planetary orbit.
- Asteroid field.
- Alien megastructure.
- Nebula frontier.
- Hostile planetary installation.

Visual details should include planetary horizons, orbital debris, asteroid formations, alien architecture, spacecraft wreckage, stars, nebula layers, and celestial lighting.

### Abyssal environments

Potential environments:

- Hadal ocean trench.
- Submerged military base.
- Ancient underwater ruins.
- Hydrothermal volcanic field.
- Abyssal sanctuary.

Visual details should include deep-sea terrain, pressure-resistant structures, sediment, bubbles, underwater currents, mineral chimneys, ruins, suspended particles, and controlled light shafts.

### Environment allocation

The final arena selection must fit each boss's identity, lore, attacks, and phase progression.

These examples are not a requirement to force every boss into the same five biome templates.

Where appropriate, reuse an environmental asset pack but construct a different layout, structure arrangement, camera composition, and motion profile.

---

# PART IV — RENDERING ARCHITECTURE

## 11. Improve the existing arena renderer

Keep `bosses/Arena.js` as the primary arena-rendering or orchestration layer, adapting to the actual code architecture.

Keep `bosses/arenas.js` as the source of reusable arena definitions or theme recipes.

Avoid mixing unrelated responsibilities.

The arena renderer should not decide which boss is selected, calculate rewards, or own the entire boss combat state machine.

Use the existing architecture where appropriate and introduce separate modules only when they materially improve maintainability.

Possible responsibilities include:

- Arena configuration and validation.
- Background and parallax rendering.
- Terrain and structure rendering.
- Weather and ambient effects.
- Particle systems.
- Arena transitions.
- Lighting or shader effects.
- Asset loading and caching.
- Gameplay visibility effects.

These are architectural suggestions, not mandatory filenames. Inspect the existing project before creating additional modules.

## 12. Use a layered environment model

Where supported by the rendering engine, compose arenas using the following logical layers.

### Layer 1: Distant background

Examples:

- Sky.
- Clouds.
- Distant mountains.
- City skyline.
- Planetary horizon.
- Star field.
- Deep-sea darkness.

This layer establishes the location and depth.

### Layer 2: Midground

Examples:

- Mountain ridges.
- Tall buildings.
- Islands.
- Carrier groups.
- Industrial facilities.
- Orbital stations.
- Large underwater structures.

Use appropriate parallax speeds and relative movement.

### Layer 3: Main battlefield

Examples:

- Roads and asphalt.
- Snowfields.
- Desert terrain.
- Ocean surface.
- Factory floors.
- Space structures.
- Underwater trench terrain.

This is the principal surface or structure beneath the gameplay.

It must not look like a repeating grid of placeholder squares.

### Layer 4: Near-field environmental details

Examples:

- Snowflakes.
- Rain streaks.
- Dust.
- Ash.
- Ocean foam.
- Bubbles.
- Floating debris.
- Small surface details.

Keep these details subtle enough that they do not interfere with projectile readability.

### Layer 5: Gameplay entities

The player, boss, enemies, projectiles, pickups, and gameplay indicators must remain clearly visible above the environment where appropriate.

### Layer 6: Combat effects

Examples:

- Explosions.
- Projectile trails.
- Impact flashes.
- Debris.
- Smoke.
- Water splashes.
- Weapon effects.
- Boss destruction effects.

Maintain appropriate render ordering and depth relationships.

Do not assume every engine uses the same layer implementation. Adapt this logical model to the existing renderer.

## 13. Scrolling and parallax requirements

The game uses portrait-oriented vertical scrolling.

The environment must move in the correct direction relative to the player's forward progression.

Implement appropriate behavior for:

- Continuous scrolling.
- Seamless repeating sections where needed.
- Non-repeating large landmarks.
- Multiple parallax speeds.
- Background transitions.
- Environment-specific movement.
- Camera and viewport scaling.
- Different screen aspect ratios.

Avoid abrupt scenery resets, visible gaps, texture seams, sudden snapping, and inconsistent scrolling speed.

Large structures must enter and leave the screen naturally.

Use the correct rendering technique for the environment:

- Tiled textures or repeating geometry for suitable surfaces.
- Layered sprites for appropriate 2D elements.
- Procedural geometry for suitable structures.
- Static large landmarks with independent movement when appropriate.
- Real 3D geometry and camera movement if the existing engine supports it and the project benefits from it.

Do not force every environment to use the same background technique.

---

# PART V — REALISTIC VISUAL QUALITY

## 14. Establish the visual art direction

The game should resemble a polished modern vertical shooter with realistic 3D-style environments.

Visual priorities:

- Recognizable locations.
- Believable materials.
- Consistent lighting.
- Appropriate shadows and reflections.
- Environmental depth.
- Natural motion.
- Strong boss silhouettes.
- Clearly readable projectiles.
- Distinct arena composition.
- Restrained color grading.
- Moderate detail suitable for portrait mobile gameplay.

Avoid:

- Pixelated textures or pixel art.
- Flat colored rectangles used as finished scenery.
- Random geometric platforms.
- Excessive neon outlines.
- Unnecessary LED-like lighting.
- Rainbow color grading.
- Unrelated decorative objects.
- Excessive particles.
- Overly bright backgrounds that obscure bullets.
- Static images presented as if they were fully animated environments.
- Heavy visual effects that reduce gameplay readability.

The game must look detailed without being excessively complex.

## 15. Choose the rendering approach based on the existing engine

Do not automatically convert the game to a full 3D engine.

Use the most suitable approach for the current project.

### Hybrid 2.5D

Preferred when the existing renderer supports it efficiently.

Use detailed backgrounds, 3D-style structures, appropriate materials, layered environmental effects, and efficient sprite-based combat where appropriate.

### Full 3D

Use if the project already supports efficient 3D rendering and would benefit from real geometry, dynamic lighting, perspective, and integrated environmental effects.

### Detailed 2D

Use if the project is fundamentally sprite-based and a full 3D conversion would introduce unnecessary cost or instability.

Detailed textures, layered environments, parallax, carefully designed sprites, shaders, and animated effects can still provide a convincing result.

Document the selected approach and explain why it suits the actual project.

---

# PART VI — ENVIRONMENTAL ANIMATION AND MOTION FX

## 16. Implement effects as functional animation systems

Do not use static screenshots or pasted images as substitutes for animated environmental effects.

Use the rendering engine's supported particle systems, animation timelines, shaders, sprite animation, procedural geometry, or native effects.

### General environmental effects

Implement appropriate combinations of:

- Animated smoke.
- Expanding explosions.
- Fading debris.
- Fire and sparks.
- Dust clouds.
- Falling rubble.
- Dynamic impact flashes.
- Environmental particles.
- Screen shake.
- Lighting flashes.
- Atmospheric motion.
- Optional structural destruction.

Every effect must have an appropriate start, active period, fade-out, and cleanup lifecycle.

### Ground effects

Examples:

- Tire and tank-track marks.
- Dust trails.
- Snow displacement or snow plumes.
- Falling concrete debris.
- Rubble.
- Sparks from metal impacts.
- Molten channels.
- Heat distortion.
- Craters or localized destruction where supported.

### Aerial effects

Examples:

- Moving clouds.
- Wind-driven particles.
- Rain.
- Lightning.
- Aircraft contrails.
- Distant explosions.
- Re-entry fire.
- Atmospheric haze.

### Naval effects

Examples:

- Animated waves.
- Ship wakes.
- Water splashes.
- Foam.
- Ocean reflections.
- Spray.
- Smoke from damaged ships.
- Oil-slick effects.
- Underwater bubbles where appropriate.

### Mecha effects

Examples:

- Mechanical impact sparks.
- Armor damage.
- Weapon charging.
- Exhaust.
- Hydraulic or mechanical movement.
- Reactor glow.
- Metal debris.
- Controlled energy discharge.

### Extraterrestrial effects

Examples:

- Drifting space debris.
- Engine trails.
- Controlled weapon glows.
- Planetary lighting.
- Asteroid dust.
- Energy pulses.
- Nebula motion.
- Localized gravitational or distortion effects.

### Abyssal effects

Examples:

- Suspended particles.
- Bubbles.
- Sediment clouds.
- Underwater currents.
- Volumetric light shafts where supported.
- Bioluminescent pulses.
- Pressure-related structural effects.
- Deep-sea creature movement.

Effects must fit the location. Do not apply the same generic particles to all six archetypes.

## 17. Motion FX must follow the actual world

The effects must respond to the game state rather than being decorative animations disconnected from gameplay.

Examples:

- Projectile trails follow the projectile's actual position and direction.
- Impact effects spawn at actual collision points.
- Ship wakes correspond to ship movement.
- Explosions originate at the actual detonation position.
- Smoke dissipates over time.
- Falling debris follows plausible motion.
- Environmental effects respond to the active arena configuration.
- Boss death effects correspond to the boss's actual location and destruction sequence.

Do not create unlimited objects per frame.

Use pooling for frequently created projectiles and particles where supported.

Avoid expensive allocations in the main update loop.

Ensure that effects are disposed of correctly when the arena changes or the encounter ends.

---

# PART VII — ARENA TRANSITIONS AND PHASE PRESENTATION

## 18. Preserve and improve the transition system

Keep the existing `transitions.js` system and expand it as necessary.

Use transition effects appropriate to the environment change.

Examples:

- Water flood or surge for flooded environments.
- Darkness swallow for Abyssal environments.
- Ice crack for frozen environments.
- Rockfall for collapsing underground facilities.
- Warp tunnel for extraterrestrial environments.
- Screen tear or controlled energy distortion for technological environments.
- Flash or heat distortion for molten environments.

These are visual transition concepts, not a requirement to implement every effect using the same technique.

Each transition must have:

- A defined lifecycle.
- A configurable duration.
- Correct outgoing and incoming arena references.
- Proper synchronization with the phase-transition state.
- Cleanup of temporary effects.
- A safe fallback if a configured effect is unavailable.
- No visible blank frames.
- No accidental exposure of unloaded assets.
- No unintended modification of collision behavior.
- No interruption of gameplay state outside existing rules.

## 19. Preserve phase-transition timing and combat semantics

Keep the existing approximately 2.4-second transition unless testing identifies a specific reason to adjust it.

The phase-transition sequence must preserve the following order of operations according to the existing controller's conventions:

1. Begin the phase-transition state.
2. Convert eligible enemy bullets into gold score stars.
3. Apply boss invulnerability.
4. Load or activate the incoming arena safely.
5. Play the appropriate transition effect.
6. Crossfade or otherwise transition between environments.
7. Display the phase-introduction card.
8. Change music layers where configured.
9. Activate the next phase.
10. Restore the appropriate vulnerability and combat state.

Prevent race conditions, duplicate phase activation, stale timers, or repeated reward grants.

Use the existing controller state machine where possible.

Do not implement an independent transition timer inside every environmental component.

## 20. Boss entry and death presentation

Preserve the current boss-entry behavior.

During entry, the boss flies or moves into the encounter and cannot be damaged until the existing vulnerability conditions are satisfied.

Each arena may define suitable presentation details:

- Distant silhouette.
- Environmental reveal.
- Boss entrance movement.
- Lighting or atmosphere changes.
- Appropriate entrance effects.
- Boss-specific music cues where supported.

The boss's entry must not block controls unexpectedly or cause premature collisions.

Preserve the existing multistage death sequence.

At the end of the encounter:

- Award the appropriate score and medals.
- Complete the boss encounter.
- Dispose of temporary effects.
- Release arena-specific resources when safe.
- Transition back to the stage background.
- Resume the correct stage progression.

Do not award rewards twice if the death animation, transition, or cleanup is interrupted.

---

# PART VIII — LIGHT POOL AND GAMEPLAY VISIBILITY

## 21. Preserve Maw of the Deep's Light Pool mechanic

Maw of the Deep has a special Light Pool arena in which most of the screen becomes dark.

Enemies outside a circle of light around the player become invisible, while bullets remain visible.

This is a gameplay-affecting mechanic, not merely a cosmetic darkness effect.

Keep it separate from ordinary color washes, post-processing, and environmental darkness.

Requirements:

- A dedicated Light Pool configuration.
- Correct player-centered light positioning.
- Correct visibility radius and falloff.
- Enemy visibility that follows the intended gameplay rules.
- Projectile visibility that remains reliable.
- Correct collision and damage behavior.
- Correct handling of different screen resolutions and aspect ratios.
- No unintended effect on unrelated arenas.
- Proper interaction with boss transitions and player movement.

The visual darkness and actual entity visibility must remain consistent with the existing game design.

Do not implement the Light Pool as a simple translucent black overlay if that would fail to hide the correct entities.

---

# PART IX — MID-BOSS COMPATIBILITY

## 22. Support the Gatekeeper without forcing a full main-boss system

The existing Gatekeeper mid-boss currently has no arena.

Extend the architecture so that it can optionally reference an arena profile.

If an arena is configured:

- Load it using the shared arena system.
- Preserve normal stage progression.
- Restore the appropriate stage background afterward.
- Clean up effects and resources correctly.

If no arena is configured:

- Retain the current behavior.
- Do not force an unnecessary arena transition.
- Do not require five phases.
- Do not introduce main-boss rewards or mechanics into the mid-boss implementation.

This must remain backward-compatible.

---

# PART X — ASSET PIPELINE

## 23. Create an explicit asset manifest

For every boss and arena, define the required assets and their intended use.

The manifest should identify, where applicable:

- Boss models or sprites.
- Terrain and background textures.
- Structures and landmarks.
- Environmental layers.
- Particle textures or geometry.
- Materials and shaders.
- Animation resources.
- Transition assets.
- Audio or music-layer references.
- Asset dependencies.
- Expected dimensions or scale.
- Transparency and blending requirements.
- Loading and unloading behavior.

Use actual project assets, generated geometry, procedural materials, newly created assets, or externally sourced assets where appropriate.

Do not silently substitute a flat rectangle, empty sprite, missing texture, or generic placeholder for a required asset.

If a necessary asset does not exist, report it explicitly and provide the manifest entry required to supply it.

If asset generation is available, create appropriate assets or production-ready specifications.

Do not claim that generating a concept image automatically provides a working animated 3D environment.

## 24. Loading and resource management

The game must load the correct environment before it is needed.

Avoid:

- Visible loading gaps.
- Missing textures during phase changes.
- Unbounded memory growth.
- Repeated loading of the same asset.
- Resource leaks after a boss dies.
- Destroying shared resources still used by other arenas.
- Excessive texture duplication.
- Creating new expensive materials every frame.

Reuse cached resources where appropriate.

Load, retain, and release resources according to the engine's lifecycle.

Provide safe fallbacks for optional effects, but do not treat a missing required environment asset as a successful implementation.

---

# PART XI — MOBILE PERFORMANCE AND READABILITY

## 25. Maintain the existing mobile gameplay experience

Preserve:

- Portrait orientation.
- Existing controls.
- Player movement.
- Firing.
- Enemy spawning.
- Collision detection.
- Boss attacks.
- Boss health segments.
- Score and medals.
- Difficulty rules.
- Stage progression.

Optimize the new environment system for the project's actual target devices and rendering capabilities.

Use appropriate techniques, including:

- Texture atlases or batching where supported.
- Object pooling.
- Reusable materials.
- Efficient geometry.
- Appropriate texture resolutions.
- Limited overdraw.
- Efficient particle systems.
- Controlled shader complexity.
- Reduced effect counts at lower quality settings.
- Asset caching.
- Correct cleanup.

Do not remove environmental detail by defaulting back to flat placeholder shapes.

Optimize the implementation rather than abandoning the visual target.

## 26. Keep gameplay visually readable

The player, boss, enemy bullets, friendly projectiles, hazards, pickups, and UI must remain immediately distinguishable.

Do not allow:

- Bright environmental details to resemble hostile bullets.
- Excessive particles to obscure projectiles.
- Screen-wide flashes to persist too long.
- Dark environments to hide required gameplay information.
- Boss effects to cover critical attack telegraphs.
- Dense textures to make enemy movement difficult to track.

Use controlled contrast, selective lighting, appropriate color separation, and effect prioritization.

If the existing game has visual accessibility or quality settings, integrate with them rather than creating conflicting systems.

---

# PART XII — REQUIRED CHECKPOINT IMPLEMENTATION PLAN

Implement the system in the following order.

Do not skip checkpoints.

Do not generate the entire roster or all 150 arena configurations in one unverified change.

At the end of each checkpoint, summarize what was implemented, run the available tests, inspect the rendered result where possible, and fix discovered problems before proceeding.

## CHECKPOINT 1 — PROJECT AUDIT AND TECHNICAL DESIGN

### Tasks

1. Inspect the current codebase.
2. Identify the rendering engine and all relevant modules.
3. Map the current boss-selection and phase-transition flow.
4. Identify the arena rendering pipeline.
5. Identify placeholder geometry and static effects.
6. Verify seeded selection and Mk. progression.
7. Verify difficulty-specific phase selection.
8. Verify Light Pool behavior.
9. Identify the asset pipeline and resource lifecycle.
10. Document compatibility requirements.

### Deliverables

- Architecture audit.
- List of files to modify.
- Proposed data schema.
- Proposed rendering strategy.
- Asset requirements.
- Testing plan.
- Known risks.

### Acceptance criteria

The existing functionality is understood and documented.

No destructive changes are made before the audit.

The first implementation target is selected based on the actual codebase.

## CHECKPOINT 2 — ARENA CONFIGURATION AND RENDERER

### Tasks

1. Rework the arena configuration format.
2. Establish stable arena IDs.
3. Separate environment data from boss combat logic.
4. Implement or improve the layered environment renderer.
5. Implement scrolling and parallax.
6. Implement environment-specific scenery.
7. Add support for environmental animation and motion FX.
8. Implement resource loading and cleanup.
9. Add configuration validation.
10. Add safe fallback behavior for optional effects.

### Benchmark arena

Use Colossus Crawler's Phase 1: Burning Overpass.

Implement the actual environment rather than merely adding configuration entries.

The arena should include:

- A recognizable damaged highway.
- Road surface and structural details.
- Concrete barriers and supports.
- Distant urban scenery.
- Appropriate smoke and fire.
- Moving environmental elements.
- Correct portrait scrolling.
- Distinct foreground, midground, and background behavior.

Use actual assets or properly rendered procedural geometry appropriate to the project.

### Acceptance criteria

The environment looks like a coherent place, not a collection of colored shapes.

The world scrolls correctly.

The player and projectiles remain readable.

Resources are cleaned up correctly.

The implementation is compatible with the existing boss controller.

## CHECKPOINT 3 — COMPLETE COLOSSUS CRAWLER ENCOUNTER

### Tasks

Implement all five Colossus Crawler phase arenas:

1. Burning Overpass.
2. Tunnel Collapse.
3. Scrapyard Sunset.
4. Molten Floor.
5. Ash Siege Field.

Give every phase a distinct environmental composition.

Implement appropriate transitions between the five environments.

Preserve the existing boss attacks, phase health segments, scoring, timeout behavior, difficulty rules, and Mk. progression.

### Acceptance criteria

The boss can complete a full encounter.

Every phase loads the correct arena.

The arena transitions do not show missing assets or blank frames.

The phase health behavior is unchanged.

The existing difficulty phase selection still works.

The visual environments are distinguishable even without color grading.

Do not proceed until this encounter meets the agreed visual and technical quality target.

## CHECKPOINT 4 — SIX-ARCHETYPE BENCHMARK

### Tasks

Create one complete benchmark boss for each archetype.

Retain the six existing flagship bosses.

Implement or improve at least one validated arena for each:

- Ground: Burning Overpass.
- Aerial: Storm Cell.
- Naval: Open Ocean.
- Mecha: Industrial Reactor.
- Extraterrestrial: Planetary Orbit.
- Abyssal: Hadal Trench.

Use appropriate environment geometry, materials, animation, and effects for each location.

### Acceptance criteria

All six archetypes can load and render their benchmark arenas.

The environments do not all use the same visual composition.

Environmental effects fit the location.

Bosses and projectiles remain readable.

The rendering framework is reusable across all six archetypes.

## CHECKPOINT 5 — EXPAND TO 30 BOSS IDENTITIES

### Tasks

Expand the registry to five distinct bosses per archetype.

Create the additional 24 boss definitions.

Give each boss:

- A stable ID.
- A distinct visual identity.
- A combat configuration.
- An attack and movement profile.
- Five phase-arena references.
- Mk. progression compatibility.
- Required asset definitions.

Implement the two-level seeded selection system.

Preserve the existing six-stage Mk. progression.

### Acceptance criteria

The registry contains 30 valid unique boss definitions.

All six archetypes have five bosses each.

The same archetype does not repeat before the archetype deck is exhausted.

The same boss variant does not repeat within its archetype's variant deck before all five have been used, unless a documented recovery rule applies.

The same run seed produces the same sequence for the same initial state.

No invalid boss references are produced.

## CHECKPOINT 6 — EXPAND TO 150 PHASE-ARENA CONFIGURATIONS

### Tasks

Create five authored arena configurations for each of the 30 bosses.

Use reusable environment modules and assets without reducing the arenas to recolored copies.

Give each phase a clear environmental identity and appropriate transition.

Where a boss's story requires the same physical location to evolve, use meaningful changes in geometry, damage, lighting, environmental activity, or structures rather than relying on color alone.

Examples include:

- A facility that collapses progressively.
- An ocean battlefield that becomes increasingly stormy.
- An orbital structure that reveals deeper mechanical sections.
- An abyssal environment that progressively loses visibility.
- A city that transitions from an intact combat zone to a devastated battlefield.

### Acceptance criteria

All 150 phase-arena references resolve.

Every boss can access all five authored phase configurations.

No arena relies solely on color changes to establish its identity.

Missing required assets are reported.

Reusable assets do not create excessive resource duplication.

## CHECKPOINT 7 — TRANSITIONS, DEATH EFFECTS, AND SPECIAL MECHANICS

### Tasks

Validate and improve:

- Boss entry.
- Phase transitions.
- Transition FX.
- Phase-introduction cards.
- Music-layer changes.
- Enemy-bullet conversion.
- Boss invulnerability.
- Timeout handling.
- Boss death sequences.
- Score and medal awards.
- Return to the stage background.
- Light Pool visibility.
- Optional Gatekeeper arena support.

### Acceptance criteria

No duplicate phase transitions occur.

No rewards are awarded twice.

The Light Pool affects only the intended gameplay entities.

Boss death and arena cleanup complete safely.

The Gatekeeper remains functional with and without an optional arena.

## CHECKPOINT 8 — PERFORMANCE AND VISUAL POLISH

### Tasks

1. Test representative arenas from all six archetypes.
2. Test dense projectile patterns.
3. Test high-particle-count effects.
4. Test repeated arena transitions.
5. Check memory use and resource cleanup.
6. Check texture loading.
7. Check scrolling seams.
8. Check camera and aspect-ratio behavior.
9. Tune effect intensity and visual contrast.
10. Optimize according to actual measurements.

### Acceptance criteria

The game remains responsive on the intended target devices.

There are no unbounded particle or resource leaks.

Arena transitions do not expose unloaded assets.

Projectile readability is preserved during intense combat.

Quality reductions affect expensive visual features gracefully rather than replacing the world with placeholders.

## CHECKPOINT 9 — FINAL INTEGRATION AND REGRESSION TESTING

Test the following:

- Stage progression.
- Mid-boss and main-boss sequence.
- All six archetypes.
- All 30 boss identities.
- All five phases per boss.
- All difficulty modes.
- Hell Desperation phase.
- Seeded archetype rotation.
- Seeded variant rotation.
- Mk. progression.
- Score and medal rewards.
- Phase timeout.
- Bullet conversion.
- Light Pool.
- Boss entry and death.
- Arena loading and cleanup.
- Missing optional effects.
- Missing required assets.
- Repeated boss encounters.
- Mobile portrait orientation.

Run automated tests, static checks, and a production build if supported by the project.

Play-test the actual game whenever the environment permits.

Do not claim success solely because the code compiles.

---

# PART XIII — TESTING AND ENGINEERING RULES

## 27. Protect existing functionality

Before editing important modules, understand their current contracts.

Use focused changes instead of rewriting unrelated code.

Avoid:

- Changing public APIs without updating their callers.
- Renaming stable boss IDs without a migration plan.
- Duplicating timers and state machines.
- Mixing rendering and combat responsibilities.
- Adding dependencies without justification.
- Introducing a second independent random-number system that breaks reproducibility.
- Changing score, reward, or damage behavior accidentally.
- Hiding errors with generic fallbacks.
- Claiming assets exist when they do not.
- Treating static concept art as a completed environment.

If an existing behavior appears incorrect, document it and explain the proposed correction before changing it.

## 28. Validation requirements

For each completed checkpoint, report:

1. Files created.
2. Files modified.
3. Architecture changes.
4. Assets created or imported.
5. Assets still missing.
6. Tests executed.
7. Tests passed.
8. Tests failed.
9. Actual rendered behavior observed.
10. Performance findings.
11. Remaining issues.
12. Next checkpoint.

If the development environment cannot run the game or capture screenshots, state that limitation explicitly and provide the tests that could still be completed.

Never fabricate a test result or claim visual verification without actually inspecting the rendered output.

---

# PART XIV — FINAL ACCEPTANCE CRITERIA

The project is complete only when all of the following are true.

### Content

- Six archetypes are supported.
- Thirty unique bosses are registered.
- Every archetype has five boss identities.
- Every boss has five authored phase-arena configurations.
- Up to 150 arena configurations are supported.
- All boss and arena references validate.

### Rendering

- Environments are recognizable and visually distinct.
- Terrain, landmarks, and structures fit the location.
- Scrolling and parallax work correctly.
- Weather and environmental motion work.
- Combat effects are animated and correctly positioned.
- Arena transitions are coherent.
- Placeholder geometry is not being passed off as finished artwork.

### Gameplay

- Existing boss mechanics are preserved.
- Seeded archetype rotation works.
- Seeded boss-variant rotation works.
- Mk. progression remains correct.
- Difficulty-specific phases work.
- Desperation remains correct.
- Light Pool remains functional.
- Gatekeeper remains compatible.
- Rewards and phase transitions do not duplicate.

### Performance

- Resource cleanup works.
- Particle systems have appropriate limits.
- Asset reuse is implemented where appropriate.
- The game remains readable during combat.
- Mobile performance has been measured or its validation limitations documented.

### Verification

- Automated tests pass where applicable.
- The production build succeeds where supported.
- Representative gameplay has been inspected.
- Actual rendered environments have been validated.
- Remaining limitations are explicitly documented.

# FINAL INSTRUCTION

Begin with Checkpoint 1: inspect the actual project and report the architecture, current implementation, and proposed changes.

Then implement Checkpoint 2 and establish the arena renderer.

Do not skip directly to generating all 30 bosses or 150 arena configurations.

The most important priority is to prove that one arena can become a genuinely detailed, animated, realistic battlefield before scaling the system.

Once the renderer and the Colossus Crawler benchmark meet the acceptance criteria, expand the same validated architecture to the other archetypes and the full roster.

Preserve functional gameplay, improve the actual rendered world, and verify every major milestone.
---

# PART XV — VISUAL REFERENCES, ASSET WORKFLOW, AND ART-DIRECTION VALIDATION

## 29. Treat the supplied visual reference boards as direction, not finished assets

The project owner may provide concept boards showing the six archetypes (Ground, Aerial, Naval, Mecha, Extraterrestrial, and Abyssal) and examples of the Colossus Crawler's five phase environments. Use these boards to understand the intended visual quality, environment variety, composition, materials, and atmosphere.

The reference boards are **not** production-ready game assets. Do not use a complete reference-board image as a stretched background, crop arbitrary panels and call them animated environments, or claim that a static concept image provides functioning geometry, animation, collision, or environmental interaction.

When references are available:

1. Inspect the full board and identify the relevant environment examples.
2. Translate each reference into a concise environment brief: location, major landmarks, terrain, material palette, lighting, atmosphere, motion, and combat-readability requirements.
3. Separate features that should be reproduced from details that are merely illustrative.
4. Do not assume the generated image's tiny labels, text, or visual details are technically accurate.
5. Use the references to guide original assets and rendering implementation; do not copy unrelated interface elements into gameplay.
6. If the reference image is not available to the coding agent, state that limitation and continue using this prompt's written requirements rather than pretending it was inspected.

## 30. Use a staged visual asset workflow

Do not require the owner to create all 150 phase environments before implementation can begin. The coding agent should build the reusable environment system and clearly report which assets are available, procedural, missing, or still need production.

For every asset or environment component, label its status:

- **Existing:** already in the project and verified usable.
- **Procedural:** generated by runtime code or existing engine primitives.
- **Created:** newly authored and integrated into the project.
- **To source:** requires a suitable licensed external asset.
- **To generate:** requires a new image, texture, sprite sheet, model, animation, or other authored asset.
- **Temporary:** a clearly documented development substitute, not final-quality content.

Do not mislabel temporary content as finished. A placeholder may be used to validate system integration, but it must be visible in the report and must not satisfy a visual acceptance criterion.

Create or update an asset manifest with asset ID, intended use, file path or resource key, status, dimensions/scale where relevant, transparency/blending needs, license/source where relevant, dependencies, and target quality tier. Validate paths and references automatically where feasible.

## 31. Build and approve the first benchmark before scaling

Start with the Colossus Crawler's five environments:

1. **Burning Overpass:** damaged elevated highway, road markings, broken barriers, concrete supports, distant city structures, fire, smoke, debris, and believable forward scrolling.
2. **Tunnel Collapse:** enclosed roadway, concrete or metal supports, tunnel lighting, damaged sections, dust, sparks, falling debris, and controlled visibility.
3. **Scrapyard Sunset:** salvage-yard terrain, wrecked vehicles and machinery, cranes or industrial silhouettes, dusty warm atmosphere, and long-distance depth.
4. **Molten Floor:** industrial foundry or heat-damaged facility, metal walkways, molten channels or heated ground, industrial structures, sparks, smoke, and restrained heat distortion.
5. **Ash Siege Field:** devastated battlefield, damaged military structures, cratered terrain, wreckage, drifting ash, smoke columns, and a distant war-torn skyline.

Each environment must be recognizable from its geometry, landmarks, and composition, not merely its color tint. The environments should remain distinct with color grading disabled.

Implement the first environment in the actual game renderer, validate it in portrait gameplay, and then finish the five-phase sequence. Capture or inspect genuine gameplay screenshots if the environment supports it. Do not report visual approval based only on source code or a static concept image.

## 32. Define the asset strategy from the existing engine's capabilities

After the project audit, choose a practical combination of existing assets, procedural rendering, authored 2D artwork, sprite sheets, textures, shaders, or 3D assets. Do not assume a particular technology or install a new rendering engine without a clear technical justification.

Prefer a coherent hybrid strategy over forcing every feature into one technique. For example:

- Use textured terrain or suitable repeating geometry for roads, ocean surfaces, tunnel floors, and other continuous surfaces.
- Use detailed layered artwork, sprites, or geometry for recognizable landmarks and large structures.
- Use animated particles, shader effects, sprite sheets, or native engine systems for smoke, fire, water, dust, sparks, rain, lightning, and impacts.
- Use real animated models only where the current engine and asset pipeline can support them efficiently.
- Use procedural geometry for appropriate structures, but add materials, silhouettes, lighting, and detail so it does not look like random primitive blocks.
- Keep the boss, player, bullets, hazards, and UI visually distinct from scenery.

If a required asset cannot be created by the available tools, produce a precise asset specification and mark it as missing. Never claim that an external asset was downloaded, an image was generated, or a model was integrated unless that action actually succeeded.

## 33. Produce visual validation evidence at each milestone

At minimum, validate:

- The first arena while scrolling in portrait gameplay.
- All five Colossus Crawler arenas.
- One representative arena from each of the six archetypes.
- Transition behavior between distinct environments.
- A dense combat scene where bullets and hazards must remain readable.
- The Light Pool arena with the actual enemy-visibility and projectile-visibility rules.
- A low-quality or performance-constrained setting if the project supports quality tiers.

For each validation, record whether the evidence is a real running-game screenshot, an in-engine capture, a render generated by a test harness, or only a static concept reference. Do not confuse these evidence types.

If screenshots or live execution are unavailable, state precisely what could not be verified, run the tests that are possible, and list the remaining manual validation steps. A successful build is not proof of visual quality.

## 34. Final art-direction checklist

Before marking an arena complete, confirm:

- Its location is recognizable at portrait-screen scale.
- It has a coherent composition and distinct landmarks.
- Surface materials do not appear as flat placeholder colors.
- Scrolling and parallax have no visible gaps or abrupt resets.
- Environmental animation has an appropriate lifecycle and responds to the active arena.
- Motion FX are positioned in relation to actual world or combat events.
- Effects are restrained enough to preserve projectile and hazard readability.
- The scene does not depend on excessive neon, LED-like outlines, or arbitrary color washes.
- Required assets are present and correctly referenced.
- Temporary placeholders are clearly identified and excluded from visual-completion claims.
- Performance and resource cleanup have been checked.

Do not scale to the full 30-boss roster and 150 phase-arena configurations until the renderer and benchmark encounters satisfy the technical and visual acceptance criteria above.
