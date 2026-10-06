import * as P from '../../patterns/index.js';
import { every, ghostRing, tendril, dens, DOWN, TAU, W } from '../util.js';

// ABYSSAL — MAW OF THE DEEP BELOW
// Eldritch maw from beneath reality. Signature: darkness that limits
// visibility, tendrils that grab from the screen edges, eyes that open as
// weak points, sanity-style screen distortion, and bullets that fade in and
// out. Flooded ruined city → sunken cathedral → a lightless void lit only by
// bullets → inside the creature → the heart of the deep.

const S = {
  ghostSpiral: { shape: 'orb', color: 'violet', n: 6, speed: 1.9 },
  ghostRing: { shape: 'bigorb', color: 'violet', n: 12, speed: 1.4 },
  ghostRain: { shape: 'orb', color: 'violet', n: 1, speed: 2.2, fixed: true },
  whisper: { shape: 'orb', color: 'violet', n: 5, spread: 0.7, speed: 1.6 },
  gullet: { shape: 'bigorb', color: 'red', n: 16, speed: 1.7 },
  gulletB: { shape: 'rice', color: 'pink', n: 20, speed: 2.4 },
  tooth: { shape: 'kunai', color: 'white', n: 3, spread: 0.35, speed: 3.4 },
};

/** Eye weak point: opens and closes; damage to an open eye also hits the maw ×2. */
const eye = (ox, oy, offset) => ({
  label: 'EYE', sprite: 'bp_eye', ox, oy, r: 13, hp: 110, medals: 3, score: 7000, bossDamage: 0.05,
  eye: { open: 160, shut: 120, offset, forward: 2, shutSprite: 'bp_eye_shut' },
  attack(pe, c, w, t) { if (every(c, t, 60, offset)) P.aimed(w, pe.x, pe.y, S.tooth); },
});

function ghostSpiral(c, w, t, key = 'gs') {
  const a = (c.data[key] = (c.data[key] || 0) + 0.17);
  ghostRing(c, w, c.e.x, c.e.y, S.ghostSpiral, a);
}

export default {
  id: 'maw_of_the_deep',
  name: 'MAW OF THE DEEP BELOW',
  archetype: 'abyssal',
  sprite: 'b_maw', scale: 1, r: 50, glow: [0.7, 0.2, 0.9], score: 150000,
  deathSequence: 'dissolve',

  parts: {
    eyeL: eye(-70, -38, 0),
    eyeR: eye(70, -38, 90),
    eyeT: eye(0, -62, 45),
    eyeL2: eye(-92, 14, 130),
    eyeR2: eye(92, 14, 20),
  },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'THE ENDLESS DARK' },

  phases: [
    {
      name: 'DROWNED CITY',
      hp: 720,
      arena: { theme: 'drowned_city', layers: ['sunken_blocks', 'dead_neon', 'caustics'], particles: ['bubbles'] },
      transitionFx: 'water_flood',
      move: { type: 'hover', amp: 80, y: 140, freq: 0.007 },
      patterns: ['ghostSpiral', 'tendrils'],
      musicLayer: 'abyssal_p1',
    },
    {
      name: 'SUNKEN CATHEDRAL',
      hp: 780,
      arena: { theme: 'sunken_cathedral', layers: ['nave', 'columns', 'stained_glass_light'] },
      transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 60, y: 140 },
      parts: ['eyeL', 'eyeR', 'eyeT'],
      patterns: ['veil', 'ghostRings', 'tendrils'],
      musicLayer: 'abyssal_p2',
    },
    {
      name: 'LIGHTLESS',
      hp: 800,
      arena: { theme: 'lightless', layers: ['nothing'] },
      transitionFx: 'darkness_swallow',
      move: { type: 'figure8', amp: 110, ampY: 30, y: 140, freq: 0.008 },
      patterns: ['ghostRain', 'whisper', 'tendrils'],
      musicLayer: 'abyssal_p3',
    },
    {
      name: 'THE GULLET',
      hp: 860,
      sprite: 'b_maw_open',
      arena: { theme: 'gullet', layers: ['flesh_folds', 'veins'] },
      transitionFx: 'membrane',
      move: { type: 'hover', amp: 70, y: 140 },
      parts: ['eyeL', 'eyeR', 'eyeL2', 'eyeR2'],
      patterns: ['veil', 'gulletBurst', 'tendrils'],
      musicLayer: 'abyssal_p4',
    },
    {
      name: 'HEART OF THE DEEP',
      hp: 920,
      sprite: 'b_maw_open',
      arena: { theme: 'heart_deep', layers: ['heart_chamber', 'arteries'] },
      transitionFx: 'membrane',
      move: { type: 'hover', amp: 90, y: 140, freq: 0.011 },
      patterns: ['ghostSpiral', 'tendrilStorm', 'gulletBurst'],
      intensity: 1.1,
      musicLayer: 'abyssal_p5',
    },
  ],

  attacks: {
    // The maw hides behind its eyes: only eye hits (or ignoresShields) land
    // while any eye is still alive.
    veil(c) { if (c.kit.partsAlive > 0) c.shield = 2; },
    ghostSpiral(c, w, t) {
      if (every(c, t, 8)) ghostSpiral(c, w, t);
      if (c.mk >= 2 && every(c, t, 11)) ghostSpiral(c, w, t, 'gs2');
    },
    ghostRings(c, w, t) { if (every(c, t, 55)) ghostRing(c, w, c.e.x, c.e.y, S.ghostRing, t * 0.05); },
    ghostRain(c, w, t) {
      if (!every(c, t, 6)) return;
      const n = dens(w, 1);
      for (let k = 0; k < n; k++) c.kit.ghost(P.shoot(w, w.rng.range(10, W - 10), -8, DOWN + w.rng.range(-0.2, 0.2), S.ghostRain.speed * w.rng.range(0.8, 1.2), S.ghostRain));
    },
    whisper(c, w, t) { if (every(c, t, 70, 35)) P.aimed(w, c.e.x, c.e.y, S.whisper); },
    tendrils(c, w, t) {
      if (every(c, t, 130, 60)) tendril(c, w);
      if (c.mk >= 2 && every(c, t, 130, 125)) tendril(c, w);
    },
    tendrilStorm(c, w, t) { if (every(c, t, 70, 30)) { tendril(c, w); if (c.mk >= 3) tendril(c, w, 60); } },
    gulletBurst(c, w, t) {
      if (every(c, t, 75)) P.ring(w, c.e.x, c.e.y, S.gullet, w.rng.angle());
      if (every(c, t, 75, 38)) {
        const a = w.aimAngle(c.e.x, c.e.y);
        for (let k = 0; k < 3; k++) P.ring(w, c.e.x, c.e.y, S.gulletB, a + k * (TAU / 60));
      }
    },
  },

  update(c) {
    // Slow breathing pulse.
    if (c.state === 'fight' || c.state === 'enter') c.e.scale = 1 + Math.sin(c.w.t * 0.04) * 0.025;
  },
};
