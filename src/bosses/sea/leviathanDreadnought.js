import * as P from '../../patterns/index.js';
import { every, DOWN, W, H } from '../util.js';

// SEA — LEVIATHAN-CLASS DREADNOUGHT
// Battleship that can dive like a submarine. Signature: broadside cannon
// volleys from its gun ports, torpedo lanes that surface under the player,
// dive/surface cycles where it is only vulnerable while surfaced, and deck
// turrets. Harbor at night → storm swell → underwater trench → arctic ice
// floes → the maelstrom.

const S = {
  broadside: { shape: 'rice', color: 'yellow', n: 1, speed: 2.4, layers: 2, dSpeed: 0.5, fixed: true },
  deck: { shape: 'orb', color: 'orange', n: 5, spread: 0.6, speed: 2.5 },
  deckFan: { shape: 'rice', color: 'yellow', n: 9, spread: 1.4, speed: 2.4 },
  torpedo: { shape: 'kunai', color: 'cyan', n: 1, speed: 2.2, accel: 0.12, maxSpd: 6.5, fixed: true },
  depth: {
    shape: 'bigorb', color: 'blue', n: 1, speed: 1.8, accel: -0.03, minSpd: 0.2, splitAt: 70, fixed: true,
    split: { shape: 'orb', color: 'cyan', n: 12, speed: 2.1 },
  },
  shard: {
    shape: 'bigorb', color: 'blue', n: 1, speed: 2.6, accel: -0.03, minSpd: 0.5, splitAt: 55, fixed: true,
    split: { shape: 'kunai', color: 'cyan', n: 5, spread: 0.9, speed: 3.1, aimed: true },
  },
  vortex: { shape: 'rice', color: 'cyan', n: 6, speed: 1.6, turn: 0.16, angVel: 0.012 },
  vortexMk: { shape: 'rice', color: 'blue', n: 6, speed: 1.6, turn: -0.16, angVel: -0.012 },
};

// Gun ports along each side of the hull (y offsets from the boss centre).
const PORTS = [-40, -20, 0, 20, 40];
const DIVE = { cycle: 440, down: 260, up: 440 }; // submerged between steps 260..440 of each cycle

// Broadside shells leave the hull sideways and curve down toward the player.
const RIGHT = { ...S.broadside, angVel: 0.007 };
const LEFT = { ...S.broadside, angVel: -0.007 };

function broadside(c, w, rows) {
  const e = c.e;
  for (const y of rows) {
    P.stack(w, e.x + 46, e.y + y, 0.08, RIGHT);
    P.stack(w, e.x - 46, e.y + y, Math.PI - 0.08, LEFT);
  }
}

/** Torpedo lane: telegraph a strip under the player, then torpedoes surface from below. */
function torpedoLane(c, w, count = 3) {
  const x = Math.max(20, Math.min(W - 20, w.aimX));
  c.kit.hazard({
    type: 'lane', x, w: 34, warn: 55, fire: 1, lethal: false, color: [0.3, 0.9, 1],
    onFire: (h, w2) => {
      for (let k = 0; k < count; k++) P.shoot(w2, h.x + (k - (count - 1) / 2) * 10, H + 10 + k * 26, -DOWN, S.torpedo.speed, S.torpedo);
      w2.explosions.sparks(h.x, H - 6, 10, [0.6, 0.9, 1], 4, 20, 4);
    },
  });
}

const gun = (ox, oy, off) => ({
  label: 'DECK GUN', sprite: 'e_flak', sprite2: 'e_flak_gun', ox, oy, r: 14, hp: 95, aim: true,
  medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (every(c, t, 55, off)) P.aimed(w, pe.x, pe.y, S.deck);
  },
});

export default {
  id: 'leviathan_dreadnought',
  name: 'LEVIATHAN-CLASS DREADNOUGHT',
  archetype: 'sea',
  sprite: 'b_leviathan', scale: 1, r: 46, glow: [1, 0.8, 0.4], score: 150000,
  deathSequence: 'sink_and_explode',

  parts: {
    gunBow: gun(0, 52, 0),
    gunStern: gun(0, -54, 27),
    gunL: gun(-30, -6, 13),
    gunR: gun(30, -6, 40),
  },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'ALL HANDS LOST' },

  phases: [
    {
      name: 'BROADSIDE',
      hp: 720,
      arena: 'ld_harbor_siege',
      transitionFx: 'flash',
      move: { type: 'hover', amp: 60, y: 135, freq: 0.008 },
      parts: ['gunBow', 'gunStern'],
      patterns: ['broadside', 'deckFan'],
      musicLayer: 'sea_p1',
    },
    {
      name: 'TORPEDO LANES',
      hp: 760,
      arena: 'ld_storm_surge',
      transitionFx: 'water_flood',
      move: { type: 'hover', amp: 90, y: 130, freq: 0.01 },
      parts: ['gunL', 'gunR'],
      patterns: ['broadside', 'torpedoLanes'],
      musicLayer: 'sea_p2',
    },
    {
      name: 'CRASH DIVE',
      hp: 800,
      arena: 'ld_trench_dive',
      transitionFx: 'water_flood',
      move: { type: 'figure8', amp: 110, ampY: 30, y: 140 },
      patterns: ['dive', 'torpedoLanes', 'depthCharges'],
      musicLayer: 'sea_p3',
    },
    {
      name: 'ICE SHARDS',
      hp: 860,
      arena: 'ld_ice_breaker',
      transitionFx: 'ice_crack',
      move: { type: 'sweep', amp: 110, y: 130, freq: 0.01 },
      parts: ['gunBow', 'gunL', 'gunR'],
      patterns: ['broadside', 'iceShards'],
      musicLayer: 'sea_p4',
    },
    {
      name: 'MAELSTROM',
      hp: 940,
      arena: 'ld_maelstrom',
      transitionFx: 'water_flood',
      move: { type: 'hover', amp: 100, y: 130 },
      patterns: ['dive', 'broadsideFull', 'vortex', 'torpedoLanes'],
      intensity: 1.1,
      musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    broadside(c, w, t) {
      if (c.data.submerged) return;
      if (every(c, t, 70)) broadside(c, w, c.mk >= 2 ? PORTS : [PORTS[0], PORTS[2], PORTS[4]]);
    },
    broadsideFull(c, w, t) { if (!c.data.submerged && every(c, t, 60)) broadside(c, w, PORTS); },
    deckFan(c, w, t) { if (every(c, t, 80, 40)) P.fan(w, c.e.x, c.e.y + 100, DOWN, S.deckFan); },
    torpedoLanes(c, w, t) {
      const n = c.data.submerged ? 70 : 140;
      if (every(c, t, n, 30)) torpedoLane(c, w, c.mk >= 2 ? 4 : 3);
    },
    // Dive / surface: submerged = shielded (only ignoresShields lands).
    dive(c, w, t) {
      const k = t % DIVE.cycle, sub = k >= DIVE.down;
      if (sub !== !!c.data.submerged) {
        c.data.submerged = sub;
        c._setForm(sub ? 'b_leviathan_sub' : null);
        w.explosions.sparks(c.e.x, c.e.y, 24, [0.7, 0.9, 1], 5, 28, 5);
        w.g.renderer.post.shockwave(c.e.x, c.e.y, 0.02, 0.015, 0.5);
      }
      if (sub) c.shield = 2;
    },
    depthCharges(c, w, t) {
      if (c.data.submerged || !every(c, t, 45)) return;
      P.shoot(w, c.e.x + w.rng.range(-40, 40), c.e.y + 40, DOWN + w.rng.range(-0.5, 0.5), S.depth.speed, S.depth);
    },
    iceShards(c, w, t) {
      if (!every(c, t, 36)) return;
      P.shoot(w, w.rng.range(40, W - 40), -10, DOWN, S.shard.speed, S.shard);
      if (c.mk >= 2) P.shoot(w, w.rng.range(40, W - 40), -10, DOWN, S.shard.speed, S.shard);
    },
    vortex(c, w, t) {
      if (!every(c, t, 11)) return;
      const host = { x: W / 2, y: H * 0.36, data: c.data };
      P.spiral(w, host, S.vortex, 'vx');
      if (c.mk >= 2) P.spiral(w, host, S.vortexMk, 'vxb');
    },
  },

  update(c) {
    // Rolling swell.
    if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.02) * 0.03;
    if (c.state !== 'fight' && c.data.submerged) { c.data.submerged = false; c._setForm(null); }
  },
};
