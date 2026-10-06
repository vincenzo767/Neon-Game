import * as P from '../../patterns/index.js';

// SYNDICATE CORE PROTOTYPE — the M4b framework test boss.
// Five authored phases, each with its own arena and transition effect, so
// the whole boss pipeline (arena mode, phase filtering, transitions, cards,
// music layers, shields, defeat routing) runs before the six archetype
// bosses arrive in M4c. Until then it stands in for every archetype slot.
//
// attacks: name → fn(c, w, t)   c = BossController (c.e = entity,
// c.intensity, c.mk, c.data for pattern state), t = phase-local step.

const DOWN = Math.PI / 2;

const S = {
  spiralA: { shape: 'orb', color: 'violet', n: 6, speed: 2.2, turn: 0.15 },
  aimRing: { shape: 'bigorb', color: 'orange', n: 14, speed: 1.6 },
  curtain: { shape: 'rice', color: 'blue', n: 18, speed: 2.5, gap: 1 },
  twinA: { shape: 'rice', color: 'cyan', n: 4, speed: 2.8, turn: 0.11 },
  twinB: { shape: 'rice', color: 'pink', n: 4, speed: 2.8, turn: -0.11 },
  torpedo: { shape: 'kunai', color: 'cyan', n: 1, speed: 1.2, accel: 0.06, maxSpd: 5.2, fixed: true },
  bubble: { shape: 'bigorb', color: 'blue', n: 10, speed: 1.3 },
  dartFan: { shape: 'kunai', color: 'white', n: 5, spread: 0.8, speed: 3.4 },
  lattice: { shape: 'orb', color: 'green', n: 16, speed: 1.9 },
  stream: { shape: 'kunai', color: 'green', n: 3, spread: 0.3, speed: 4, layers: 3, dSpeed: 0.5 },
  horizonA: { shape: 'orb', color: 'pink', n: 8, speed: 2.0, turn: 0.13, accel: -0.015, minSpd: 1.2 },
  horizonRain: { shape: 'rice', color: 'violet', n: 2, speed: 2.6 },
  horizonRing: { shape: 'bigorb', color: 'red', n: 18, speed: 1.4 },
  lastLight: { shape: 'rice', color: 'yellow', n: 10, speed: 3.2, turn: 0.21 },
};

/** True every `n` steps, sped up by phase intensity (desperation) and Mk level. */
const every = (c, t, n) => t % Math.max(2, Math.round(n / (c.intensity * (1 + 0.15 * (c.mk - 1))))) === 0;

export default {
  id: 'syndicate_prototype',
  name: 'SYNDICATE CORE PROTOTYPE',
  title: 'FRAMEWORK TEST UNIT',
  archetype: 'prototype',
  sprite: 'emitter', scale: 1.4, r: 34, glow: [1, 0.2, 0.7], score: 100000,
  deathSequence: 'chain_explode',
  transitionSpin: true,

  phases: [
    {
      name: 'CORE IGNITION',
      hp: 700,
      arena: { theme: 'highway_burning', weather: 'embers', particles: ['searchlight_beams'], scrollSpeed: 0.7 },
      transitionFx: 'flash',
      move: { type: 'hover', amp: 100 },
      patterns: ['spiralA', 'aimRing'],
      musicLayer: 'prototype_p1',
    },
    {
      name: 'STORM WALL',
      hp: 750,
      arena: { theme: 'storm_front', weather: 'heavy_rain', scrollSpeed: 1.4 },
      transitionFx: 'screen_tear',
      move: { type: 'sweep', amp: 150 },
      patterns: ['curtain', 'twinSpiral'],
      musicLayer: 'prototype_p2',
    },
    {
      name: 'DEEP CURRENT',
      hp: 800,
      arena: { theme: 'underwater_trench', particles: ['bubbles'], scrollSpeed: 0.5 },
      transitionFx: 'water_flood',
      move: { type: 'figure8', amp: 110, ampY: 30 },
      patterns: ['dive', 'torpedoes', 'bubbleRing'],
      musicLayer: 'prototype_p3',
    },
    {
      name: 'DATA LATTICE',
      hp: 850,
      arena: { theme: 'data_core', weather: 'data', particles: ['glyphs'] },
      transitionFx: 'warp_tunnel',
      move: { type: 'center' },
      patterns: ['lattice', 'laserCross', 'stream'],
      musicLayer: 'prototype_p4',
    },
    {
      name: 'EVENT HORIZON',
      hp: 950,
      arena: { theme: 'void_black', darkness: 0.75, scrollSpeed: 0.3 },
      transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 70, freq: 0.008 },
      patterns: ['horizonSpiral', 'horizonRain', 'horizonRing'],
      musicLayer: 'prototype_p5',
    },
  ],

  // Hell: appended after the last phase.
  desperation: {
    name: 'LAST LIGHT',
    hp: 500,
    patterns: ['horizonSpiral', 'lastLight', 'horizonRing'],
    arena: { theme: 'void_black', darkness: 0.85, tint: [0.5, 0, 0.05, 0.25], scrollSpeed: 0.2 },
  },

  attacks: {
    spiralA(c, w, t) { if (every(c, t, 5)) P.spiral(w, c.e, S.spiralA, 'a'); },
    aimRing(c, w, t) { if (every(c, t, 60)) P.ring(w, c.e.x, c.e.y, S.aimRing, w.aimAngle(c.e.x, c.e.y)); },
    curtain(c, w, t) { if (every(c, t, 55)) P.curtain(w, S.curtain); },
    twinSpiral(c, w, t) {
      if (every(c, t, 7)) { P.spiral(w, c.e, S.twinA, 'ta'); P.spiral(w, c.e, S.twinB, 'tb'); }
    },
    // Dive cycle: submerged (shielded) for 2 s of every 6 — only
    // IGNORES_SHIELDS damage lands while it is under.
    dive(c, w, t) {
      const k = t % 360;
      if (k >= 200 && k < 320) c.shield = 2;
      c.data.submerged = c.shield > 0;
    },
    torpedoes(c, w, t) {
      if (!c.data.submerged || !every(c, t, 22)) return;
      const x = w.rng.range(30, 450);
      P.shoot(w, x, -10, DOWN, S.torpedo.speed, S.torpedo);
    },
    bubbleRing(c, w, t) { if (!c.data.submerged && every(c, t, 40)) P.ring(w, c.e.x, c.e.y, S.bubble, t * 0.05); },
    lattice(c, w, t) {
      if (every(c, t, 30)) P.ring(w, c.e.x, c.e.y, S.lattice, (t / 30) % 2 ? Math.PI / 16 : 0);
    },
    laserCross(c, w, t) {
      if (t % 210 === 60) for (const s of [-1, 1]) P.laser(w, c.e, DOWN + s * 0.5, { warn: 55, fire: 80, width: 18, angVel: -s * 0.006 });
    },
    stream(c, w, t) { if (every(c, t, 50)) P.aimed(w, c.e.x, c.e.y, S.stream); },
    horizonSpiral(c, w, t) { if (every(c, t, 6)) P.spiral(w, c.e, S.horizonA, 'h'); },
    horizonRain(c, w, t) { if (every(c, t, 9)) P.rain(w, S.horizonRain); },
    horizonRing(c, w, t) { if (every(c, t, 75)) P.ring(w, c.e.x, c.e.y, S.horizonRing, w.aimAngle(c.e.x, c.e.y)); },
    lastLight(c, w, t) { if (every(c, t, 4)) P.spiral(w, c.e, S.lastLight, 'll'); },
  },

  /** Per-step visuals: core spin; sinks (shrinks + dims) while submerged. */
  update(c) {
    const e = c.e;
    if (c.state === 'fight') e.rot += 0.01 * c.intensity;
    const target = c.data.submerged ? 0.9 : 1.4;
    e.scale += (target - e.scale) * 0.1;
    e.glow = c.data.submerged ? [0.1, 0.4, 0.8] : c.phase && c.phase.desperation ? [1.4, 0.1, 0.1] : [1, 0.2, 0.7];
    if (c.state !== 'fight') c.data.submerged = false;
  },
};
