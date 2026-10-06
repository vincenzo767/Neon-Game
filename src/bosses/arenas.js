import { BG_CITY, BG_HARBOR, BG_FOUNDRY, BG_VOID, BG_ORBITAL, BG_STORM } from '../stages/biomes.js';

// Arena themes: the procedural layer recipes a boss phase can take over the
// screen with. Built from the same pieces as stage biomes (background shader
// mode + palette, parallax structures, weather streaks), plus arena-only
// ambient layers drawn by bosses/Arena.js:
//   tint      [r, g, b, a] full-screen wash under the action (underwater, heat)
//   darkness  0..1 black veil over the background (bullets stay lit)
//   ambient   searchlights | aurora | snow | bubbles | ash | glyphs
//
// A boss phase's `arena` block (UPDATE_01 §1.4) picks a theme and may
// override it:
//   { theme, palette: [fog, base, accent, accent2?], weather, particles,
//     scrollSpeed, tint, darkness }
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
  data: { kind: 'data', n: 70, color: [0.3, 1, 0.8], speed: 9, slant: 0, alpha: 0.35 },
  debris: { kind: 'debris', n: 40, color: [0.7, 0.75, 0.9], speed: 3, slant: 0.02, alpha: 0.5 },
};

export const ARENA_THEMES = {
  highway_burning: {
    bg: { mode: BG_CITY, base: [0.2, 0.12, 0.1], fog: [0.22, 0.06, 0.02], neonA: [1, 0.55, 0.15], neonB: [1, 0.15, 0.1], tilt: 0.55, bright: 0.55, detail: 0.4 },
    structs: ['girder', 'roof'], weather: 'embers', shafts: [[1, 0.5, 0.15]],
    ambient: ['searchlights'], tint: [0.4, 0.08, 0, 0.12],
  },
  harbor_night: {
    bg: { mode: BG_HARBOR, base: [0.1, 0.13, 0.18], fog: [0.02, 0.04, 0.1], neonA: [1, 0.8, 0.2], neonB: [0.2, 0.5, 1], tilt: 0.5, bright: 0.5, detail: 0.5 },
    structs: ['girder', 'holo'], weather: 'light_rain', shafts: [[1, 0.85, 0.4]],
    ambient: ['searchlights'],
  },
  storm_front: {
    bg: { mode: BG_STORM, base: [0.16, 0.16, 0.3], fog: [0.04, 0.04, 0.1], neonA: [0.6, 0.8, 1], neonB: [0.9, 0.3, 1], tilt: 0.45, bright: 0.6, detail: 0.5 },
    structs: [], weather: 'heavy_rain', shafts: [[0.6, 0.7, 1]],
  },
  underwater_trench: {
    // Sonar-grid seabed: the data-core shader in deep blues, washed teal.
    bg: { mode: BG_VOID, base: [0.03, 0.08, 0.12], fog: [0.0, 0.05, 0.09], neonA: [0.1, 0.55, 0.85], neonB: [0.2, 0.9, 1], tilt: 0.6, bright: 0.5, detail: 0.5 },
    structs: [], weather: 'none', shafts: [[0.3, 0.8, 1], [0.2, 0.5, 1]],
    ambient: ['bubbles'], tint: [0, 0.18, 0.28, 0.35], scrollSpeed: 0.5,
  },
  data_core: {
    bg: { mode: BG_VOID, base: [0.05, 0.1, 0.15], fog: [0.0, 0.02, 0.05], neonA: [0.2, 1, 0.8], neonB: [0.9, 0.2, 1], tilt: 0.55, bright: 0.75, detail: 0.5 },
    structs: ['holo'], weather: 'data', shafts: [[0.3, 1, 0.8], [0.9, 0.3, 1]],
    ambient: ['glyphs'],
  },
  molten_floor: {
    bg: { mode: BG_FOUNDRY, base: [0.2, 0.12, 0.1], fog: [0.3, 0.07, 0.02], neonA: [1, 0.5, 0.1], neonB: [1, 0.15, 0.05], tilt: 0.5, bright: 0.65, detail: 0.5 },
    structs: ['girder'], weather: 'embers', shafts: [[1, 0.5, 0.1]],
    ambient: ['ash'], tint: [0.5, 0.1, 0, 0.1],
  },
  orbit_edge: {
    bg: { mode: BG_ORBITAL, base: [0.1, 0.25, 0.55], fog: [0.02, 0.03, 0.08], neonA: [0.4, 0.8, 1], neonB: [1, 0.6, 0.3], tilt: 0.3, bright: 0.8, detail: 0.5 },
    structs: ['girder'], weather: 'debris', shafts: [[0.5, 0.8, 1]],
    ambient: ['aurora'], scrollSpeed: 0.6,
  },
  arctic_sea: {
    bg: { mode: BG_HARBOR, base: [0.3, 0.38, 0.45], fog: [0.35, 0.42, 0.5], neonA: [0.7, 0.95, 1], neonB: [0.4, 0.7, 1], tilt: 0.5, bright: 0.6, detail: 0.5 },
    structs: [], weather: 'none', shafts: [[0.8, 0.9, 1]],
    ambient: ['snow'],
  },
  void_black: {
    bg: { mode: BG_ORBITAL, base: [0.25, 0.05, 0.3], fog: [0.0, 0.0, 0.02], neonA: [0.8, 0.3, 1], neonB: [1, 0.2, 0.4], tilt: 0.3, bright: 0.5, detail: 0.5 },
    structs: [], weather: 'none', shafts: [[0.6, 0.2, 1]],
    ambient: ['ash'], darkness: 0.72, scrollSpeed: 0.3,
  },
};

/** Resolve a phase's `arena` block into a concrete, self-contained layer recipe. */
export function resolveArena(a = {}) {
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
    ambient: [],
    traffic: biome.bg.mode === BG_CITY,
  };
}
