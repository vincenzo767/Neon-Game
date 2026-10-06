import * as P from '../../patterns/index.js';
import { every, dens, DOWN, W, H } from '../util.js';

// EXTRATERRESTRIAL — HIVE SOVEREIGN
// Organic-crystal invader. Signature: gravity wells that bend bullet paths,
// crystalline shards that split, teleporting cores, and alien glyph bullet
// patterns. City under invasion → inside the mothership → crystal planet →
// nebula throne → the singularity.

const GLYPHS = ['eye', 'trident', 'star', 'rune'];

const S = {
  glyph: { shape: 'orb', color: 'white', speed: 1.7, fixed: true },
  glyphV: { shape: 'rice', color: 'yellow', speed: 1.9, fixed: true },
  spore: { shape: 'bigorb', color: 'green', n: 3, spread: 1.2, speed: 1.3, homing: 0.02, homingTime: 120 },
  ringStorm: { shape: 'orb', color: 'violet', n: 18, speed: 1.9 },
  ringStormB: { shape: 'rice', color: 'green', n: 18, speed: 2.3 },
  shard: {
    shape: 'bigorb', color: 'violet', n: 1, speed: 2.4, accel: -0.035, minSpd: 0.3, splitAt: 50, fixed: true,
    split: { shape: 'rice', color: 'pink', n: 8, speed: 2.4, random: true },
  },
  crystal: {
    shape: 'kunai', color: 'violet', n: 1, speed: 3.2, accel: -0.05, minSpd: 0.6, splitAt: 40, fixed: true,
    split: { shape: 'kunai', color: 'green', n: 3, spread: 0.5, speed: 3, aimed: true },
  },
  core: { shape: 'orb', color: 'green', n: 10, speed: 2.1 },
  orbit: { shape: 'orb', color: 'pink', n: 5, speed: 1.8, turn: 0.21 },
};

/** Glyph volley: an alien sigil that expands outward as it flies. */
function glyph(c, w, k, ghost = false, spec = S.glyph) {
  c.kit.glyph(c.e.x, c.e.y + 10, GLYPHS[k % GLYPHS.length], spec, dens(w, 26), w.rng.range(-0.3, 0.3), ghost);
}

/** Teleport: flicker in place, vanish, re-materialise elsewhere with a glyph. */
function teleport(c, w, t, period) {
  const k = t % period;
  if (k === period - 36) { c.data.tpX = w.rng.range(90, W - 90); c.data.tpY = w.rng.range(100, 210); }
  if (k > period - 36) {
    c.e.flash = k % 4 < 2 ? 2 : 0;
    if (k % 6 === 0) w.explosions.sparks(c.e.x, c.e.y, 4, [0.5, 1, 0.4], 4, 14, 3);
  }
  if (k === 0 && t > 0) {
    c.snap(c.data.tpX, c.data.tpY);
    c.data.tpHold = 90; // stay put for a moment after arriving
    w.g.renderer.post.shockwave(c.e.x, c.e.y, 0.03, 0.02, 0.5);
    glyph(c, w, (t / period) | 0);
  }
}

const crystal = (ox, oy, off) => ({
  label: 'CRYSTAL NODE', sprite: 'bp_crystal', ox, oy, r: 12, hp: 80, medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) { if (every(c, t, 70, off)) P.shoot(w, pe.x, pe.y, w.aimAngle(pe.x, pe.y), S.crystal.speed, S.crystal); },
});

/** Free-roaming core: teleports around the field, firing a ring each jump. */
const core = (off) => ({
  label: 'TELEPORTING CORE', sprite: 'bp_alien_core', free: true, ox: off ? 60 : -60, oy: 40, r: 13, hp: 70,
  medals: 4, score: 8000, bossDamage: 0.1, glow: [0.5, 1, 0.4],
  attack(pe, c, w, t) {
    if ((t + off) % 170 !== 0) return;
    pe.x = pe.px = w.rng.range(50, W - 50);
    pe.y = pe.py = w.rng.range(80, H * 0.55);
    w.explosions.sparks(pe.x, pe.y, 10, [0.5, 1, 0.4], 5, 18, 4);
    P.ring(w, pe.x, pe.y, S.core, w.rng.angle());
  },
});

export default {
  id: 'hive_sovereign',
  name: 'HIVE SOVEREIGN',
  archetype: 'extraterrestrial',
  sprite: 'b_hive', scale: 1, r: 46, glow: [0.5, 1, 0.4], score: 150000,
  deathSequence: 'implode',

  parts: {
    crystalL: crystal(-58, 36, 0),
    crystalR: crystal(58, 36, 35),
    crystalT: crystal(0, -52, 17),
    coreA: core(0),
    coreB: core(85),
  },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'EVENT HORIZON' },

  phases: [
    {
      name: 'INVASION DAY',
      hp: 720,
      arena: { theme: 'city_invasion', layers: ['burning_city', 'tractor_beams', 'falling_debris'] },
      transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 135 },
      parts: ['crystalL', 'crystalR'],
      patterns: ['glyphs', 'spores'],
      musicLayer: 'alien_p1',
    },
    {
      name: 'MOTHERSHIP HOLD',
      hp: 770,
      arena: { theme: 'mothership_hold', layers: ['membranes', 'ribs', 'veins'], particles: ['spores'] },
      transitionFx: 'membrane',
      move: { type: 'figure8', amp: 90, ampY: 25, y: 130 },
      patterns: ['gravityWells', 'ringStorm'],
      musicLayer: 'alien_p2',
    },
    {
      name: 'CRYSTAL WORLD',
      hp: 820,
      arena: { theme: 'crystal_world', layers: ['crystal_facets', 'glowing_seams'] },
      transitionFx: 'warp_tunnel',
      move: { type: 'sweep', amp: 110, y: 130 },
      parts: ['crystalL', 'crystalR', 'crystalT'],
      patterns: ['shardRain', 'glyphs'],
      musicLayer: 'alien_p3',
    },
    {
      name: 'NEBULA THRONE',
      hp: 870,
      arena: { theme: 'nebula_throne', layers: ['nebula_clouds', 'starfield'] },
      transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 60, y: 140 },
      parts: ['coreA', 'coreB'],
      patterns: ['teleport', 'glyphs', 'gravityWells'],
      musicLayer: 'alien_p4',
    },
    {
      name: 'SINGULARITY',
      hp: 940,
      arena: { theme: 'singularity', layers: ['accretion_disk', 'event_horizon', 'nebula'] },
      transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 90, y: 150 },
      patterns: ['teleport', 'orbitSpiral', 'glyphs'],
      intensity: 1.1,
      // A permanent well over the event horizon drags every bullet into orbit.
      onStart: (c) => c.kit.well({ x: W / 2, y: H * 0.3, r: 230, strength: 0.012, life: 60 * 80 }),
      musicLayer: 'alien_p5',
    },
  ],

  attacks: {
    glyphs(c, w, t) {
      if (every(c, t, 110)) glyph(c, w, (t / 110) | 0);
      if (c.mk >= 2 && every(c, t, 110, 55)) glyph(c, w, ((t / 110) | 0) + 1, false, S.glyphV);
    },
    spores(c, w, t) { if (every(c, t, 70, 35)) P.aimed(w, c.e.x, c.e.y + 30, S.spore); },
    gravityWells(c, w, t) {
      if (t % 330 === 0) c.kit.well({ x: w.rng.range(110, W - 110), y: w.rng.range(260, 420), r: 150, strength: 0.035, life: 300 });
    },
    ringStorm(c, w, t) {
      if (every(c, t, 40)) P.ring(w, c.e.x, c.e.y, S.ringStorm, t * 0.03);
      if (c.mk >= 2 && every(c, t, 40, 20)) P.ring(w, c.e.x, c.e.y, S.ringStormB, -t * 0.03);
    },
    shardRain(c, w, t) {
      if (every(c, t, 24)) P.shoot(w, w.rng.range(30, W - 30), -10, DOWN + w.rng.range(-0.2, 0.2), S.shard.speed, S.shard);
    },
    teleport(c, w, t) {
      if (c.data.tpHold > 0) { c.data.tpHold--; c.mx = c.e.x; c.my = c.e.y; }
      teleport(c, w, t, 240);
    },
    orbitSpiral(c, w, t) { if (every(c, t, 10)) P.spiral(w, c.e, S.orbit, 'orb'); },
  },

  update(c) {
    if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.03) * 0.06;
  },
};
