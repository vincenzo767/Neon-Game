import { AM } from '../bosses/ArenaBackground.js';

// Update 02 §2.7: two new biomes, added as registry entries only. The M3
// table in biomes.js is untouched; StageGen deals one of these into each
// loop's biome order from its own seeded stream (see biomeOrder).
//
// Both use arena background modes (routed by the ArenaBackground delegate the
// stage Arena installs), with the same fields as an M3 biome.

export const EXTRA_BIOMES = [
  {
    id: 'undercity', name: 'SUNKEN UNDERCITY', ground: true,
    // Drowned streets: sickly sea-green water, bone-white ruins, crimson shrines.
    bg: { mode: AM.FLOODED, base: [0.1, 0.16, 0.14], fog: [0.01, 0.04, 0.035], neonA: [0.35, 0.95, 0.7], neonB: [0.9, 0.08, 0.18], tilt: 0.5, bright: 0.6, detail: 0.6 },
    parallax: { structs: ['roof', 'roof', 'girder'], streak: { kind: 'embers', n: 60, color: [0.5, 1, 0.8], speed: 1.2, slant: 0.05, alpha: 0.45 }, shafts: [[0.4, 1, 0.75]] },
    bias: { mine: 2.2, swarm: 2, spinner: 2, orbit: 1.6 },
  },
  {
    id: 'crater', name: 'FALLEN STAR CRATER', ground: true,
    // Impact field of a crashed alien pod: scorched rock, violet fissures, pink crystal.
    bg: { mode: AM.CRATER, base: [0.2, 0.14, 0.2], fog: [0.08, 0.02, 0.12], neonA: [0.7, 0.35, 1], neonB: [1, 0.45, 0.85], tilt: 0.55, bright: 0.62, detail: 0.5 },
    parallax: { structs: ['girder'], streak: { kind: 'embers', n: 70, color: [1, 0.6, 1], speed: 1.6, slant: 0.08, alpha: 0.55 }, shafts: [[0.8, 0.4, 1], [0.4, 1, 0.7]] },
    bias: { swarm: 2.2, orbit: 2, spinner: 1.8, air: 1.3 },
  },
];

export const extraBiomeById = (id) => EXTRA_BIOMES.find((b) => b.id === id) || null;
