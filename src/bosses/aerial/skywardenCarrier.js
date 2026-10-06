import * as P from '../../patterns/index.js';
import { every, DOWN, W, H } from '../util.js';

// AERIAL — SKYWARDEN CARRIER
// Flying-wing carrier. Signature: drone swarms launched from its hangar
// bays, sweeping beam curtains, and mirrored flight formations of escort
// interceptors. Above the clouds at dawn → inside a lightning storm →
// aurora-lit stratosphere → edge of orbit → burning re-entry.

const S = {
  nose: { shape: 'rice', color: 'cyan', n: 7, spread: 0.9, speed: 2.8 },
  noseMk: { shape: 'kunai', color: 'white', n: 3, spread: 0.2, speed: 4.2 },
  drone: { shape: 'kunai', color: 'cyan', n: 1, speed: 3.6, layers: 2, dSpeed: 0.6, fixed: true },
  pod: { shape: 'orb', color: 'blue', n: 5, spread: 0.7, speed: 2.4 },
  curtain: { shape: 'rice', color: 'blue', n: 16, speed: 2.3, gap: 1 },
  formation: { shape: 'rice', color: 'cyan', n: 3, spread: 0.4, speed: 2.8 },
  wingSpiral: { shape: 'orb', color: 'violet', n: 5, speed: 2.1, turn: 0.14 },
  wingSpiralB: { shape: 'orb', color: 'cyan', n: 5, speed: 2.1, turn: -0.14 },
  star: { shape: 'bigorb', color: 'white', n: 12, speed: 1.6 },
  fire: { shape: 'orb', color: 'orange', n: 1, speed: 2.6, fixed: true },
};

const BAYS = [-46, 46];

/** Interceptor: drops out of a hangar bay, banks toward the player, fires, leaves. */
function launchDrone(c, w, side) {
  const e = c.e;
  c.kit.spawnMinion({
    sprite: 'b_interceptor', name: 'INTERCEPTOR', x: e.x + BAYS[side], y: e.y + 10, r: 9, hp: 7, score: 400,
    drops: w.rng.chance(0.3) ? ['M'] : null, glow: [0.3, 0.8, 1],
    data: { side: side ? 1 : -1, vx: 0 },
    ai(m, c2, w2) {
      const d = m.data;
      if (m.t < 50) { m.y += 2.4; m.x += d.side * 1.2; }
      else if (m.t < 110) {
        d.vx += Math.sign(w2.aimX - m.x) * 0.12;
        d.vx = Math.max(-3, Math.min(3, d.vx));
        m.x += d.vx; m.y += 1.2;
        if (m.t === 70) P.aimed(w2, m.x, m.y, S.drone);
      } else { m.y += 4; m.x += d.vx; }
      m.rot = Math.atan2(1, d.vx * 0.3) - Math.PI / 2;
    },
  });
}

/** Mirrored formation: pairs fly identical paths reflected across the centre line. */
function formation(c, w, pairs) {
  for (let k = 0; k < pairs; k++) {
    for (const s of [-1, 1]) {
      const base = W / 2 + s * (50 + k * 42);
      c.kit.spawnMinion({
        sprite: 'b_interceptor', name: 'WINGMAN', x: base, y: -20 - k * 30, r: 9, hp: 8, score: 400, glow: [0.3, 0.8, 1],
        data: { s, base, k },
        ai(m, c2, w2) {
          const d = m.data;
          m.y += 1.6;
          m.x = d.base + d.s * Math.sin(m.t * 0.035 + d.k) * 55;
          if (m.t % 50 === 25 && m.y > 20 && m.y < H * 0.7) P.fan(w2, m.x, m.y, DOWN + d.s * 0.25, S.formation);
        },
      });
    }
  }
}

/** Beam curtain: a row of telegraphed lasers along the wing that sweep sideways. */
function beamCurtain(c, w, count, sweep) {
  for (let k = 0; k < count; k++) {
    const ox = (k / (count - 1) - 0.5) * 170;
    const dir = sweep === 'fan' ? Math.sign(ox) || 1 : sweep;
    P.laser(w, c.e, DOWN, { warn: 60, fire: 110, width: 14, ox, oy: 30, angVel: dir * 0.004, rgb: [0.3, 0.8, 1] });
  }
}

const pod = (ox, off) => ({
  label: 'WING POD', sprite: 'bp_wingpod', ox, oy: 38, r: 12, hp: 80, medals: 3, score: 6000, bossDamage: 0.05,
  attack(pe, c, w, t) {
    if (every(c, t, 70, off)) P.aimed(w, pe.x, pe.y + 14, S.pod);
  },
});

export default {
  id: 'skywarden_carrier',
  name: 'SKYWARDEN CARRIER',
  archetype: 'aerial',
  sprite: 'b_carrier', scale: 1, r: 52, glow: [0.3, 0.8, 1], score: 150000,
  deathSequence: 'spin_out',

  parts: { podL: pod(-74, 0), podR: pod(74, 35) },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'FREEFALL' },

  phases: [
    {
      name: 'DAWN PATROL',
      hp: 700,
      arena: { theme: 'clouds_dawn', layers: ['cloud_sea', 'sunrise_glow'], scrollSpeed: 1.6 },
      transitionFx: 'flash',
      move: { type: 'sweep', amp: 110, y: 120 },
      parts: ['podL', 'podR'],
      patterns: ['droneLaunch', 'noseFan'],
      musicLayer: 'aerial_p1',
    },
    {
      name: 'STORM CELL',
      hp: 760,
      arena: { theme: 'storm_front', layers: ['storm_clouds', 'lightning'], weather: 'heavy_rain' },
      transitionFx: 'cloud_burst',
      move: { type: 'hover', amp: 80, y: 115 },
      parts: ['podL', 'podR'],
      patterns: ['beamCurtain', 'rainCurtain'],
      musicLayer: 'aerial_p2',
    },
    {
      name: 'AURORA CEILING',
      hp: 800,
      arena: { theme: 'stratosphere_aurora', layers: ['high_cloud', 'aurora', 'first_stars'], scrollSpeed: 1.2 },
      transitionFx: 'cloud_burst',
      move: { type: 'figure8', amp: 100, ampY: 25, y: 120 },
      patterns: ['mirrorFormation', 'wingSpirals'],
      musicLayer: 'aerial_p3',
    },
    {
      name: 'EDGE OF ORBIT',
      hp: 860,
      arena: { theme: 'orbit_edge', layers: ['planet_limb', 'starfield', 'orbital_debris'] },
      transitionFx: 'warp_tunnel',
      move: { type: 'sweep', amp: 130, y: 115, freq: 0.01 },
      parts: ['podL', 'podR'],
      patterns: ['crossBeams', 'droneLaunch', 'starRing'],
      musicLayer: 'aerial_p4',
    },
    {
      name: 'RE-ENTRY',
      hp: 940,
      arena: { theme: 'reentry_fire', layers: ['plasma_sheath', 'burning_clouds'], weather: 'embers', scrollSpeed: 2.4 },
      transitionFx: 'flash',
      move: { type: 'hover', amp: 120, y: 120, freq: 0.013 },
      patterns: ['beamCurtain', 'mirrorFormation', 'fireRain', 'noseFan'],
      intensity: 1.1,
      musicLayer: 'aerial_p5',
    },
  ],

  attacks: {
    droneLaunch(c, w, t) {
      if (every(c, t, 95)) { launchDrone(c, w, 0); launchDrone(c, w, 1); }
      if (c.mk >= 2 && every(c, t, 95, 47)) launchDrone(c, w, w.rng.int(0, 1));
    },
    noseFan(c, w, t) {
      if (every(c, t, 65, 20)) P.fan(w, c.e.x, c.e.y + 50, w.aimAngle(c.e.x, c.e.y + 50), S.nose);
      if (c.mk >= 2 && every(c, t, 65, 52)) P.aimed(w, c.e.x, c.e.y + 50, S.noseMk);
    },
    beamCurtain(c, w, t) {
      if (t % 260 === 10) beamCurtain(c, w, c.mk >= 3 ? 6 : 5, (t / 260) % 2 ? 1 : -1);
    },
    crossBeams(c, w, t) {
      if (t % 240 === 30) beamCurtain(c, w, 4, 'fan');
    },
    rainCurtain(c, w, t) { if (every(c, t, 75)) P.curtain(w, S.curtain); },
    mirrorFormation(c, w, t) {
      if (every(c, t, 170)) formation(c, w, c.mk >= 2 ? 4 : 3);
    },
    wingSpirals(c, w, t) {
      if (!every(c, t, 9)) return;
      for (const [s, spec, key] of [[-1, S.wingSpiral, 'wl'], [1, S.wingSpiralB, 'wr']]) {
        const a = (c.data[key] = (c.data[key] || 0) + spec.turn);
        P.ring(w, c.e.x + s * 80, c.e.y + 30, spec, a);
      }
    },
    starRing(c, w, t) { if (every(c, t, 80)) P.ring(w, c.e.x, c.e.y, S.star, w.aimAngle(c.e.x, c.e.y)); },
    // Re-entry: burning debris peels off the hull.
    fireRain(c, w, t) {
      if (!every(c, t, 5)) return;
      const x = c.e.x + w.rng.range(-90, 90);
      P.shoot(w, x, c.e.y + 20, DOWN + w.rng.range(-0.3, 0.3), S.fire.speed * w.rng.range(0.8, 1.2), S.fire);
    },
  },

  update(c) {
    // Bank into its sweeps.
    if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.004;
  },
};
