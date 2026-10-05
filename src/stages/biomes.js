// Biome definitions. Each biome drives:
//   bg       — background shader mode + palette (see fx/Background.js)
//   parallax — foreground structure set, streak particles (rain/embers/data)
//   ground   — whether ground units (turrets, trucks, tanks...) can appear
//   bias     — enemy weighting for wave selection (multiplies template weight
//              when the template's tags include the key)

export const BG_CITY = 0;
export const BG_HARBOR = 1;
export const BG_FOUNDRY = 2;
export const BG_VOID = 3;
export const BG_ORBITAL = 4;
export const BG_STORM = 5;

export const BIOMES = [
  {
    id: 'skyway', name: 'SKYWAY HIGHWAY', ground: true,
    bg: { mode: BG_CITY, base: [0.16, 0.18, 0.26], fog: [0.10, 0.04, 0.16], neonA: [0.1, 0.9, 1.0], neonB: [1.0, 0.2, 0.7], tilt: 0.55, bright: 0.55, detail: 0.3 },
    parallax: { structs: ['girder', 'roof', 'holo'], streak: { kind: 'rain', n: 120, color: [0.7, 0.85, 1], speed: 13, slant: 0.12, alpha: 0.1 }, shafts: [[0.3, 0.9, 1], [1, 0.3, 0.8]] },
    bias: { road: 2.5, air: 1, ground: 1.5 },
  },
  {
    id: 'spire', name: 'CORPORATE SPIRE', ground: true,
    bg: { mode: BG_CITY, base: [0.22, 0.2, 0.3], fog: [0.14, 0.05, 0.2], neonA: [1.0, 0.75, 0.2], neonB: [0.6, 0.3, 1.0], tilt: 0.6, bright: 0.6, detail: 0.85 },
    parallax: { structs: ['holo', 'roof', 'holo', 'girder'], streak: { kind: 'rain', n: 70, color: [0.9, 0.8, 1], speed: 12, slant: 0.05, alpha: 0.08 }, shafts: [[1, 0.8, 0.3], [0.6, 0.4, 1]] },
    bias: { air: 1.5, laser: 2, sniper: 2 },
  },
  {
    id: 'elevator', name: 'ORBITAL ELEVATOR', ground: false,
    bg: { mode: BG_ORBITAL, base: [0.1, 0.25, 0.55], fog: [0.02, 0.03, 0.08], neonA: [0.4, 0.8, 1.0], neonB: [1.0, 0.6, 0.3], tilt: 0.3, bright: 0.8, detail: 0.5 },
    parallax: { structs: ['girder'], streak: { kind: 'debris', n: 40, color: [0.7, 0.75, 0.9], speed: 3, slant: 0.02, alpha: 0.5 }, shafts: [[0.5, 0.8, 1]] },
    bias: { air: 2, heavy: 1.8, swarm: 1.5 },
  },
  {
    id: 'harbor', name: 'ACID HARBOR', ground: true,
    bg: { mode: BG_HARBOR, base: [0.12, 0.16, 0.14], fog: [0.02, 0.10, 0.06], neonA: [0.4, 1.0, 0.3], neonB: [0.1, 0.6, 1.0], tilt: 0.5, bright: 0.55, detail: 0.5 },
    parallax: { structs: ['girder', 'holo'], streak: { kind: 'rain', n: 180, color: [0.6, 1, 0.6], speed: 14, slant: 0.2, alpha: 0.12 }, shafts: [[0.4, 1, 0.4]] },
    bias: { ground: 1.5, mine: 2.5, swarm: 1.5 },
  },
  {
    id: 'foundry', name: 'MAGMA FOUNDRY', ground: true,
    bg: { mode: BG_FOUNDRY, base: [0.2, 0.13, 0.11], fog: [0.25, 0.06, 0.02], neonA: [1.0, 0.5, 0.1], neonB: [1.0, 0.15, 0.05], tilt: 0.5, bright: 0.6, detail: 0.5 },
    parallax: { structs: ['girder', 'girder'], streak: { kind: 'embers', n: 90, color: [1, 0.5, 0.15], speed: 2.2, slant: 0.1, alpha: 0.7 }, shafts: [[1, 0.5, 0.1]] },
    bias: { ground: 3, heavy: 1.5 },
  },
  {
    id: 'datacore', name: 'DATA-CORE VOID', ground: true,
    bg: { mode: BG_VOID, base: [0.05, 0.1, 0.15], fog: [0.0, 0.02, 0.05], neonA: [0.2, 1.0, 0.8], neonB: [0.9, 0.2, 1.0], tilt: 0.55, bright: 0.7, detail: 0.5 },
    parallax: { structs: ['holo'], streak: { kind: 'data', n: 70, color: [0.3, 1, 0.8], speed: 9, slant: 0, alpha: 0.35 }, shafts: [[0.3, 1, 0.8], [0.9, 0.3, 1]] },
    bias: { laser: 2.5, spinner: 2, orbit: 2 },
  },
  {
    id: 'storm', name: 'STORM RING', ground: false,
    bg: { mode: BG_STORM, base: [0.2, 0.18, 0.35], fog: [0.06, 0.04, 0.12], neonA: [0.6, 0.7, 1.0], neonB: [1.0, 0.3, 0.6], tilt: 0.45, bright: 0.65, detail: 0.5 },
    parallax: { structs: ['girder'], streak: { kind: 'rain', n: 220, color: [0.7, 0.75, 1], speed: 17, slant: 0.28, alpha: 0.13 }, shafts: [[0.6, 0.7, 1]] },
    bias: { air: 2, bomber: 3, heavy: 1.3 },
  },
];

export const biomeById = (id) => BIOMES.find((b) => b.id === id) || BIOMES[0];
