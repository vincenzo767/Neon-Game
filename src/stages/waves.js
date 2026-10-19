import { WORLD_W } from '../core/constants.js';

// Wave templates: small hand-designed formations that the stage generator
// combines into wave sets. build(R, ctx) returns spawn events
//   { t, id, x, y, p, elite }   (t in steps from the template's start)
// R is the stage's seeded RNG, so a given seed always yields the same waves.
//
//   tags     — used for biome weighting (biome.bias) and the level terrain
//              filter (StageGen TERRAIN_BLOCK): 'ground'/'road' need land,
//              'naval' needs open water, 'wing'/'rotor'/'bomber' need air
//   cost     — difficulty budget the template consumes
//   minStage — earliest level index (0..29 in the campaign) it may appear in
//   ground   — needs a biome with a ground plane (land or sea surface)
//   reinforce — small enough for a boss to call in mid-fight

const W = WORLD_W;
const PI = Math.PI;

export const TEMPLATES = [
  {
    id: 'vee', tags: ['air'], cost: 2, minStage: 0, reinforce: true,
    build(R, c) {
      const cx = R.range(130, W - 130), out = [];
      for (let k = -2; k <= 2; k++) {
        out.push(c.ev(Math.abs(k) * 8, 'drone', cx + k * 34, -30 - Math.abs(k) * 22, { stopY: 130 - Math.abs(k) * 18, hold: 150 }));
      }
      return out;
    },
  },
  {
    id: 'dartSwoop', tags: ['air', 'wing'], cost: 2, minStage: 0, reinforce: true,
    build(R, c) {
      const dir = R.sign(), out = [];
      for (let k = 0; k < 6; k++) {
        out.push(c.ev(k * 14, 'dart', dir > 0 ? -20 : W + 20, 50 + R.range(-10, 10), { dir, ang: dir > 0 ? 0.25 : PI - 0.25, turn: 0.012 }));
      }
      return out;
    },
  },
  {
    id: 'carLanes', tags: ['road', 'air'], cost: 2, minStage: 0,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 5; k++) out.push(c.ev(k * 26, 'car', 60 + R.int(0, 4) * 90, -30, { vy: R.range(2.1, 2.8) }));
      return out;
    },
  },
  {
    id: 'turretField', tags: ['ground'], cost: 3, minStage: 0, ground: true, reinforce: true,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 4; k++) out.push(c.ev(k * 40, 'turret', R.range(40, W - 40), -20));
      return out;
    },
  },
  {
    id: 'flakNest', tags: ['ground'], cost: 3, minStage: 0, ground: true,
    build(R, c) {
      const x = R.range(110, W - 110);
      return [c.ev(0, 'flak', x - 60, -20), c.ev(0, 'flak', x + 60, -20), c.ev(30, 'turret', x, -20)];
    },
  },
  {
    id: 'convoy', tags: ['ground', 'road', 'heavy'], cost: 5, minStage: 1, ground: true,
    build(R, c) {
      const x = R.range(120, W - 120);
      return [c.ev(0, 'truck', x, -50), c.ev(30, 'tank', x - 70, -30), c.ev(30, 'tank', x + 70, -30)];
    },
  },
  {
    id: 'tankLine', tags: ['ground'], cost: 4, minStage: 1, ground: true,
    build(R, c) {
      return [0, 1, 2].map((k) => c.ev(k * 30, 'tank', 100 + k * 140, -30, { amp: R.range(20, 40) }));
    },
  },
  {
    id: 'walkers', tags: ['ground', 'heavy'], cost: 4, minStage: 1, ground: true,
    build(R, c) {
      return [c.ev(0, 'walker', R.range(60, 200), -30), c.ev(60, 'walker', R.range(280, W - 60), -30)];
    },
  },
  {
    id: 'carrierEscort', tags: ['heavy', 'air', 'wing'], cost: 7, minStage: 1,
    build(R, c) {
      const out = [c.ev(0, 'carrier', W / 2, -80)];
      for (let k = 0; k < 4; k++) out.push(c.ev(40 + k * 12, 'bug', 60 + k * 120, -20));
      return out;
    },
  },
  {
    id: 'gunshipPair', tags: ['air', 'heavy', 'rotor'], cost: 5, minStage: 1,
    build(R, c) {
      return [c.ev(0, 'gunship', 120, -50, { stopY: 130 }), c.ev(40, 'gunship', W - 120, -50, { stopY: 165 })];
    },
  },
  {
    id: 'snipers', tags: ['sniper', 'air'], cost: 3, minStage: 0,
    build(R, c) {
      return [80, W / 2, W - 80].map((x, k) => c.ev(k * 30, 'sniper', x, -30, { stopY: 60 + k * 12 }));
    },
  },
  {
    id: 'laserPods', tags: ['laser'], cost: 4, minStage: 1,
    build(R, c) {
      return [c.ev(0, 'laserpod', 100, -30), c.ev(25, 'laserpod', W - 100, -30)];
    },
  },
  {
    id: 'minefield', tags: ['mine', 'swarm'], cost: 3, minStage: 0,
    build(R, c) {
      const dir = R.sign();
      const out = [c.ev(0, 'minelayer', dir > 0 ? -30 : W + 30, 80, { dir })];
      for (let k = 0; k < 6; k++) out.push(c.ev(60 + k * 10, 'bug', R.range(40, W - 40), -20));
      return out;
    },
  },
  {
    id: 'bomberRun', tags: ['bomber', 'air', 'wing'], cost: 4, minStage: 1,
    build(R, c) {
      const d = R.sign();
      return [c.ev(0, 'bomber', d > 0 ? -50 : W + 50, 70, { dir: d }), c.ev(70, 'bomber', d > 0 ? W + 50 : -50, 140, { dir: -d })];
    },
  },
  {
    id: 'spinners', tags: ['spinner'], cost: 3, minStage: 0, reinforce: true,
    build(R, c) {
      return [0, 1, 2, 3].map((k) => c.ev(k * 22, 'spinner', 80 + k * 106, -20, { phase: k * 1.3 }));
    },
  },
  {
    id: 'orbiters', tags: ['orbit'], cost: 3, minStage: 0, reinforce: true,
    build(R, c) {
      const cx = R.range(140, W - 140);
      return [0, 1, 2, 3, 4].map((k) => c.ev(0, 'orbiter', cx, -40, { cx, cy: -40, a0: (k / 5) * PI * 2, dir: 1 }));
    },
  },
  {
    id: 'splitters', tags: ['air'], cost: 3, minStage: 1,
    build(R, c) {
      return [0, 1, 2].map((k) => c.ev(k * 30, 'splitter', 100 + k * 140, -30, { stopY: 120 + (k % 2) * 40 }));
    },
  },
  {
    id: 'seekers', tags: ['air', 'swarm'], cost: 4, minStage: 2,
    build(R, c) {
      const out = [c.ev(0, 'seeker', 130, -30), c.ev(20, 'seeker', W - 130, -30)];
      for (let k = 0; k < 4; k++) out.push(c.ev(50 + k * 12, 'bug', R.range(60, W - 60), -20));
      return out;
    },
  },
  {
    id: 'bikeRush', tags: ['road', 'swarm'], cost: 3, minStage: 0, reinforce: true,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 6; k++) out.push(c.ev(k * 18, 'bike', k % 2 ? 30 : W - 30, -20));
      return out;
    },
  },
  {
    id: 'swarm', tags: ['swarm'], cost: 2, minStage: 0, reinforce: true,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 10; k++) out.push(c.ev(k * 9, 'bug', k % 2 ? 140 : W - 140, -20, { phase: k * 0.7 }));
      return out;
    },
  },
  {
    id: 'frigate', tags: ['heavy', 'wing'], cost: 7, minStage: 2,
    build(R, c) {
      const out = [c.ev(0, 'frigate', R.range(160, W - 160), -70)];
      for (let k = 0; k < 4; k++) out.push(c.ev(120 + k * 16, 'dart', k % 2 ? -20 : W + 20, 60, { dir: k % 2 ? 1 : -1, ang: k % 2 ? 0.25 : PI - 0.25 }));
      return out;
    },
  },
  {
    id: 'ambush', tags: ['air', 'wing'], cost: 4, minStage: 1,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 3; k++) out.push(c.ev(k * 12, 'drone', 90 + k * 150, -30, { stopY: 100, hold: 200 }));
      const dir = R.sign();
      for (let k = 0; k < 4; k++) out.push(c.ev(60 + k * 14, 'dart', dir > 0 ? -20 : W + 20, 90, { dir, ang: dir > 0 ? 0.2 : PI - 0.2 }));
      return out;
    },
  },

  // ---------------------------------------------------- sea levels (surface)
  {
    id: 'boatPatrol', tags: ['naval'], cost: 3, minStage: 0, ground: true, reinforce: true,
    build(R, c) {
      const x = R.range(90, W - 90), out = [];
      for (let k = 0; k < 3; k++) out.push(c.ev(k * 34, 'gunboat', x + (k - 1) * 22, -40, { amp: R.range(12, 26) * R.sign() }));
      return out;
    },
  },
  {
    id: 'fastCraft', tags: ['naval', 'swarm'], cost: 3, minStage: 0, ground: true, reinforce: true,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 6; k++) out.push(c.ev(k * 16, 'rhib', k % 2 ? R.range(60, 180) : R.range(W - 180, W - 60), -30, { amp: (k % 2 ? 1 : -1) * R.range(30, 60) }));
      return out;
    },
  },
  {
    id: 'missileBoats', tags: ['naval', 'heavy'], cost: 4, minStage: 1, ground: true,
    build(R, c) {
      return [c.ev(0, 'missileboat', R.range(70, 170), -50), c.ev(40, 'missileboat', R.range(W - 170, W - 70), -50)];
    },
  },
  {
    id: 'seaMines', tags: ['naval', 'mine'], cost: 2, minStage: 0, ground: true,
    build(R, c) {
      const out = [];
      for (let k = 0; k < 6; k++) out.push(c.ev(k * 20, 'seamine', R.range(40, W - 40), -20, { amp: R.range(6, 14) }));
      return out;
    },
  },
  {
    id: 'corvetteGroup', tags: ['naval', 'heavy'], cost: 7, minStage: 2, ground: true,
    build(R, c) {
      const x = R.range(150, W - 150);
      return [c.ev(0, 'corvette', x, -80), c.ev(60, 'gunboat', x - 90, -40), c.ev(60, 'gunboat', x + 90, -40)];
    },
  },
];
