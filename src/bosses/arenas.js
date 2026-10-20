import { BG_CITY, BG_HARBOR, BG_FOUNDRY, BG_VOID, BG_ORBITAL, BG_STORM } from '../stages/biomes.js';
import { AM } from './ArenaBackground.js';
import { ARENAS } from './arenaConfigs/index.js';
import { lighting } from '../world/lighting.js';

// Arena themes: the procedural layer recipes a boss phase can take over the
// screen with. Built from the same pieces as stage biomes (background shader
// mode + palette, parallax structures, weather streaks) plus the arena-only
// shader scenes in ArenaBackground.js and ambient layers drawn by Arena.js:
//   tint      [r, g, b, a] full-screen wash under the action (underwater, heat)
//   darkness  0..1 black veil over the background (bullets stay lit)
//   light     vision radius: darkness also swallows enemies outside a pool
//             of light around the player (bullets stay visible)
//   ambient   see Arena.js AMBIENT (searchlights, aurora, snow, bubbles, ...)
//
// A boss phase's `arena` block (UPDATE_01 §1.4) picks a theme and may
// override it:
//   { theme, palette: [fog, base, accent, accent2?], weather, particles,
//     scrollSpeed, tint, darkness, light }
// `layers` is descriptive (which procedural layers the theme stands for).

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Weather names → parallax streak specs (kinds the Parallax layer draws). */
export const WEATHER = {
  none: { kind: 'rain', n: 0, color: [1, 1, 1], speed: 10, slant: 0, alpha: 0 },
  light_rain: { kind: 'rain', n: 90, color: [0.7, 0.85, 1], speed: 12, slant: 0.1, alpha: 0.09 },
  heavy_rain: { kind: 'rain', n: 240, color: [0.7, 0.75, 1], speed: 18, slant: 0.3, alpha: 0.14 },
  embers: { kind: 'embers', n: 90, color: [1, 0.45, 0.12], speed: 2.4, slant: 0.1, alpha: 0.7 },
  sparks: { kind: 'embers', n: 60, color: [1, 0.8, 0.4], speed: 3.5, slant: 0.2, alpha: 0.6 },
  data: { kind: 'data', n: 70, color: [0.3, 1, 0.8], speed: 9, slant: 0, alpha: 0.35 },
  red_data: { kind: 'data', n: 80, color: [1, 0.2, 0.15], speed: 12, slant: 0, alpha: 0.35 },
  debris: { kind: 'debris', n: 40, color: [0.7, 0.75, 0.9], speed: 3, slant: 0.02, alpha: 0.5 },
  dust: { kind: 'debris', n: 50, color: [0.6, 0.5, 0.4], speed: 2, slant: 0.05, alpha: 0.4 },
};

/** Theme helper: T(mode, base, fog, neonA, neonB, extra) */
function T(mode, base, fog, neonA, neonB, x = {}) {
  const { tilt = 0.5, bright = 0.65, detail = 0.5, ...rest } = x;
  return {
    bg: { mode, base, fog, neonA, neonB, tilt, bright, detail },
    structs: [], weather: 'none', shafts: [neonA],
    ...rest,
  };
}

export const ARENA_THEMES = {
  // ------------------------------------------------ framework prototype
  highway_burning: T(BG_CITY, [0.2, 0.12, 0.1], [0.22, 0.06, 0.02], [1, 0.55, 0.15], [1, 0.15, 0.1],
    { tilt: 0.55, bright: 0.55, detail: 0.4, structs: ['girder', 'roof'], weather: 'embers', ambient: ['searchlights'], tint: [0.4, 0.08, 0, 0.12] }),
  harbor_night: T(BG_HARBOR, [0.1, 0.13, 0.18], [0.02, 0.04, 0.1], [1, 0.8, 0.2], [0.2, 0.5, 1],
    { bright: 0.5, structs: ['girder', 'holo'], weather: 'light_rain', ambient: ['searchlights'] }),
  storm_front: T(BG_STORM, [0.16, 0.16, 0.3], [0.04, 0.04, 0.1], [0.6, 0.8, 1], [0.9, 0.3, 1],
    { tilt: 0.45, bright: 0.6, weather: 'heavy_rain' }),
  underwater_trench: T(BG_VOID, [0.03, 0.08, 0.12], [0.0, 0.05, 0.09], [0.1, 0.55, 0.85], [0.2, 0.9, 1],
    { tilt: 0.6, ambient: ['bubbles'], tint: [0, 0.18, 0.28, 0.35], scrollSpeed: 0.5 }),
  data_core: T(BG_VOID, [0.05, 0.1, 0.15], [0.0, 0.02, 0.05], [0.2, 1, 0.8], [0.9, 0.2, 1],
    { tilt: 0.55, bright: 0.75, structs: ['holo'], weather: 'data', ambient: ['glyphs'] }),
  molten_floor: T(BG_FOUNDRY, [0.2, 0.12, 0.1], [0.3, 0.07, 0.02], [1, 0.5, 0.1], [1, 0.15, 0.05],
    { structs: ['girder'], weather: 'embers', ambient: ['ash', 'heat'], tint: [0.5, 0.1, 0, 0.1] }),
  orbit_edge: T(BG_ORBITAL, [0.1, 0.25, 0.55], [0.02, 0.03, 0.08], [0.4, 0.8, 1], [1, 0.6, 0.3],
    { tilt: 0.3, bright: 0.8, structs: ['girder'], weather: 'debris', ambient: ['aurora'], scrollSpeed: 0.6 }),
  void_black: T(BG_ORBITAL, [0.25, 0.05, 0.3], [0.0, 0.0, 0.02], [0.8, 0.3, 1], [1, 0.2, 0.4],
    { tilt: 0.3, bright: 0.5, ambient: ['ash'], darkness: 0.72, scrollSpeed: 0.3 }),

  // ------------------------------------------------ ground: Colossus Crawler
  tunnel_collapse: T(AM.TUNNEL, [0.2, 0.17, 0.15], [0.03, 0.025, 0.02], [1, 0.75, 0.4], [1, 0.9, 0.7],
    { bright: 0.85, weather: 'dust', ambient: ['dust'], scrollSpeed: 1.2 }),
  scrapyard_sunset: T(AM.DESERT, [0.72, 0.42, 0.24], [0.75, 0.32, 0.16], [1, 0.6, 0.25], [1, 0.35, 0.2],
    { tilt: 0.55, bright: 0.55, ambient: ['sandstorm'], scrollSpeed: 0.8 }),
  siege_ashfield: T(BG_CITY, [0.12, 0.06, 0.05], [0.2, 0.03, 0.02], [1, 0.3, 0.1], [1, 0.1, 0.05],
    { tilt: 0.55, bright: 0.45, structs: ['girder'], weather: 'embers', ambient: ['ash', 'searchlights'], darkness: 0.25 }),

  // ------------------------------------------------ aerial: Skywarden Carrier
  clouds_dawn: T(AM.CLOUDS, [0.85, 0.66, 0.62], [0.32, 0.28, 0.45], [1, 0.7, 0.4], [1, 0.5, 0.6],
    { tilt: 0.4, bright: 0.6, detail: 0.3, scrollSpeed: 1.6 }),
  stratosphere_aurora: T(AM.CLOUDS, [0.22, 0.28, 0.42], [0.02, 0.03, 0.08], [0.4, 1, 0.7], [0.6, 0.4, 1],
    { tilt: 0.4, bright: 0.5, detail: 0.9, ambient: ['aurora'], scrollSpeed: 1.2 }),
  reentry_fire: T(AM.CLOUDS, [0.9, 0.42, 0.2], [0.5, 0.1, 0.05], [1, 0.5, 0.1], [1, 0.2, 0.1],
    { tilt: 0.4, bright: 0.5, detail: 0.3, weather: 'embers', ambient: ['heat'], tint: [0.6, 0.15, 0, 0.12], scrollSpeed: 2.4 }),

  // ------------------------------------------------ sea: Leviathan Dreadnought
  ocean_storm: T(AM.OCEAN, [0.1, 0.2, 0.28], [0.02, 0.05, 0.08], [0.6, 0.9, 1], [0.4, 0.6, 0.9],
    { bright: 0.7, detail: 0.3, weather: 'heavy_rain', ambient: ['lightning'] }),
  trench_dive: T(AM.UNDERWATER, [0.03, 0.12, 0.18], [0.0, 0.03, 0.06], [0.3, 0.9, 1], [0.4, 0.8, 1],
    { tilt: 0.55, bright: 0.85, ambient: ['bubbles', 'marine_snow'], tint: [0, 0.1, 0.18, 0.22], scrollSpeed: 0.5 }),
  arctic_sea: T(AM.ICE, [0.72, 0.82, 0.9], [0.25, 0.32, 0.42], [0.6, 0.9, 1], [0.3, 0.5, 0.8],
    { bright: 0.45, ambient: ['snow'], scrollSpeed: 0.7 }),
  maelstrom: T(AM.OCEAN, [0.08, 0.16, 0.22], [0.01, 0.03, 0.06], [0.4, 0.9, 1], [0.3, 0.5, 0.9],
    { bright: 0.75, detail: 0.95, weather: 'heavy_rain', ambient: ['lightning'], scrollSpeed: 0.6 }),

  // ------------------------------------------------ mecha: Titan Enforcer
  corporate_plaza: T(BG_CITY, [0.24, 0.22, 0.3], [0.12, 0.06, 0.2], [1, 0.8, 0.3], [0.5, 0.4, 1],
    { tilt: 0.6, bright: 0.62, detail: 0.85, structs: ['holo', 'roof'], weather: 'light_rain', ambient: ['searchlights'] }),
  helipad_rain: T(AM.ROOFTOP, [0.3, 0.31, 0.36], [0.06, 0.06, 0.12], [1, 0.3, 0.3], [0.3, 0.8, 1],
    { bright: 0.65, weather: 'heavy_rain', ambient: ['lightning'] }),
  circuit_core: T(AM.CIRCUIT, [0.12, 0.14, 0.1], [0.0, 0.02, 0.03], [1, 0.7, 0.2], [0.3, 1, 0.6],
    { bright: 0.55, weather: 'data', scrollSpeed: 1.4 }),
  elevator_platform: T(BG_ORBITAL, [0.3, 0.2, 0.5], [0.02, 0.02, 0.06], [1, 0.7, 0.3], [0.4, 0.8, 1],
    { tilt: 0.3, bright: 0.8, structs: ['girder'], weather: 'debris', scrollSpeed: 1.8 }),
  red_alert: T(BG_VOID, [0.15, 0.03, 0.03], [0.05, 0.0, 0.0], [1, 0.15, 0.1], [1, 0.6, 0.1],
    { bright: 0.55, weather: 'red_data', ambient: ['alarm'] }),

  // ------------------------------------------------ alien: Hive Sovereign
  city_invasion: T(BG_CITY, [0.14, 0.16, 0.2], [0.05, 0.12, 0.06], [0.4, 1, 0.3], [0.8, 0.3, 1],
    { tilt: 0.55, bright: 0.55, structs: ['roof', 'girder'], weather: 'debris', ambient: ['tractor_beams'] }),
  mothership_hold: T(AM.HIVE, [0.28, 0.12, 0.35], [0.06, 0.02, 0.1], [0.4, 1, 0.4], [0.8, 0.4, 1],
    { bright: 0.55, ambient: ['spores'], scrollSpeed: 0.7 }),
  crystal_world: T(AM.CRYSTAL, [0.35, 0.25, 0.6], [0.15, 0.05, 0.3], [0.7, 0.4, 1], [0.4, 1, 0.8],
    { bright: 0.5, ambient: ['glyphs'] }),
  nebula_throne: T(AM.NEBULA, [0.3, 0.1, 0.4], [0.04, 0.0, 0.1], [0.9, 0.3, 0.8], [0.2, 0.6, 1],
    { bright: 0.85, detail: 0.3, scrollSpeed: 0.5 }),
  singularity: T(AM.NEBULA, [0.2, 0.05, 0.25], [0.02, 0.0, 0.05], [1, 0.5, 0.2], [0.5, 0.2, 1],
    { bright: 0.85, detail: 0.95, ambient: ['glyphs'], darkness: 0.15, scrollSpeed: 0.3 }),

  // ------------------------------------------------ abyssal: Maw of the Deep Below
  drowned_city: T(AM.FLOODED, [0.12, 0.18, 0.2], [0.01, 0.05, 0.06], [0.2, 0.9, 0.8], [1, 0.3, 0.6],
    { bright: 0.65, ambient: ['bubbles'], tint: [0, 0.08, 0.1, 0.2], scrollSpeed: 0.6 }),
  sunken_cathedral: T(AM.CATHEDRAL, [0.2, 0.22, 0.24], [0.0, 0.04, 0.06], [0.3, 0.6, 1], [1, 0.3, 0.4],
    { bright: 0.75, ambient: ['bubbles', 'marine_snow'], tint: [0, 0.08, 0.12, 0.25], darkness: 0.15, scrollSpeed: 0.5 }),
  lightless: T(BG_ORBITAL, [0.1, 0.02, 0.12], [0.0, 0.0, 0.0], [0.6, 0.2, 0.8], [0.4, 0.1, 0.5],
    { tilt: 0.3, bright: 0.3, darkness: 0.96, light: 120, ambient: ['sanity'], scrollSpeed: 0.2 }),
  gullet: T(AM.FLESH, [0.45, 0.08, 0.12], [0.15, 0.0, 0.03], [1, 0.2, 0.3], [1, 0.5, 0.3],
    { bright: 0.7, ambient: ['sanity'], scrollSpeed: 0.8 }),
  heart_deep: T(AM.FLESH, [0.3, 0.02, 0.06], [0.05, 0.0, 0.01], [1, 0.1, 0.15], [0.6, 0.1, 0.8],
    { bright: 0.65, darkness: 0.3, light: 170, ambient: ['sanity'], scrollSpeed: 0.4 }),
};

// ------------------------------------------------ arena rework (world/)
// Authored phase-arena configurations (bosses/arenaConfigs/*) rendered by
// the arena world system. A boss phase references one by id:
//   arena: 'cc_burning_overpass'      or   arena: { id: 'cc_burning_overpass', ...overrides }
// Legacy `{ theme }` blocks still resolve to the shader themes above.

export { ARENAS };
export const ARENA_IDS = Object.keys(ARENAS);

/** Arena config by id (with an optional desperation variant: `<id>~desperation`). */
export function arenaConfig(id) {
  if (ARENAS[id]) return ARENAS[id];
  const m = /^(.*)~desperation$/.exec(id || '');
  if (m && ARENAS[m[1]]) return desperationConfig(ARENAS[m[1]]);
  return null;
}

/** Hell's desperation phase: the final arena, pushed further (config `desperation` overrides). */
export function desperationConfig(cfg) {
  const d = cfg.desperation || {};
  return {
    ...cfg, ...d, id: `${cfg.id}~desperation`, name: d.name || cfg.name,
    params: { ...(cfg.params || {}), ...(d.params || {}) },
    light: { ...(cfg.light || {}), ...(d.light || {}) },
    tint: d.tint || [0.4, 0.02, 0.02, 0.1],
  };
}

const WORLD_BG = (cfg) => {
  // A stage-biome-shaped palette so the Arena's palette blending still has
  // sensible endpoints; the world pass replaces the shader output.
  const L = lighting(cfg);
  const f = L.fogCol;
  return { mode: 0, base: [...f], fog: [...f], neonA: [...L.sunCol.map((v) => Math.min(1, v))], neonB: [...f], tilt: 0.5, bright: 0.5, detail: 0.3 };
};

function resolveWorld(cfg, over = {}) {
  const weather = WEATHER[over.weather || cfg.weather] || WEATHER.none;
  const vis = over.visibility || cfg.visibility || {};
  return {
    theme: cfg.id,
    world: cfg,
    bg: WORLD_BG(cfg),
    parallax: { structs: [], streak: weather, shafts: null, traffic: false },
    noStructs: true,
    scrollSpeed: cfg.scroll ?? 1,
    tint: over.tint || cfg.tint || null,
    darkness: vis.darkness ?? 0,
    light: vis.radius ?? 0,
    ambient: [...(cfg.ambient || []), ...(over.particles || [])],
  };
}

/** Resolve a phase's `arena` block into a concrete, self-contained layer recipe. */
export function resolveArena(a = {}) {
  if (typeof a === 'string') a = { id: a };
  if (a.id) {
    const cfg = arenaConfig(a.desperation ? `${a.id}~desperation` : a.id);
    if (cfg) return resolveWorld(cfg, a);
    console.warn(`[arena] unknown arena config "${a.id}"; using a legacy theme`);
  }
  const th = ARENA_THEMES[a.theme] || ARENA_THEMES.highway_burning;
  const bg = { ...th.bg, base: [...th.bg.base], fog: [...th.bg.fog], neonA: [...th.bg.neonA], neonB: [...th.bg.neonB] };
  if (a.palette && a.palette.length >= 3) {
    const p = a.palette.map(rgb);
    bg.fog = p[0]; bg.base = p[1]; bg.neonA = p[2]; bg.neonB = p[3] || p[2];
  }
  if (a.bright != null) bg.bright = a.bright;
  const weather = WEATHER[a.weather] || WEATHER[th.weather] || WEATHER.none;
  const structs = a.structs || th.structs;
  return {
    theme: a.theme,
    bg,
    // Biome-shaped block for Parallax.setStyle (empty structs handled by Arena).
    parallax: { structs: structs.length ? structs : ['girder'], streak: weather, shafts: th.shafts },
    noStructs: !structs.length,
    scrollSpeed: a.scrollSpeed ?? th.scrollSpeed ?? 1,
    tint: a.tint || th.tint || null,
    darkness: a.darkness ?? th.darkness ?? 0,
    light: a.light ?? th.light ?? 0,
    ambient: [...(th.ambient || []), ...(a.particles || [])],
  };
}

/** A stage biome in arena-recipe form (used when the arena hands control back). */
export function biomeArena(biome) {
  return {
    theme: biome.id,
    bg: { ...biome.bg },
    parallax: biome.parallax,
    noStructs: false,
    scrollSpeed: 1,
    tint: null,
    darkness: 0,
    light: 0,
    ambient: [],
    traffic: biome.bg.mode === BG_CITY,
  };
}
