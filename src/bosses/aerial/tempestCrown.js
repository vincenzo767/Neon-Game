import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, turbine, weather, pipe } from '../roster/art.js';

// AERIAL — TEMPEST CROWN (storm-generating aircraft)
// A ring-wing weather-control platform: a circular crown of six discharge
// masts around a ducted central rotor, ionising the air until the sky
// itself becomes the weapon. It seeds clouds, calls lightning on the
// player's position, spins cyclones that bend bullet paths and drops hail.
// Arenas: gathering clouds over farmland → inside a supercell → the calm
// eye of the storm → a hail corridor → the lightning crown at night.

const S = {
  bolt: { shape: 'rice', color: 'violet', n: 10, speed: 2.2 },
  rain: { shape: 'rice', color: 'blue', n: 3, speed: 3.2 },
  hail: { shape: 'bigorb', color: 'white', n: 1, speed: 1.6, accel: 0.025, maxSpd: 3.4, fixed: true, split: { shape: 'orb', color: 'white', n: 6, speed: 1.8 }, splitAt: 95 },
  arm: { shape: 'orb', color: 'blue', n: 3, speed: 2.2, turn: 0.13 },
  armB: { shape: 'orb', color: 'violet', n: 3, speed: 2.2, turn: -0.13 },
  spark: { shape: 'kunai', color: 'violet', n: 5, spread: 0.5, speed: 3.2 },
  ring: { shape: 'orb', color: 'violet', n: 18, speed: 1.6 },
};

// Six discharge masts around the ring (sprite-local).
const MASTS = Array.from({ length: 6 }, (_, k) => { const a = -Math.PI / 2 + (k / 6) * TAU; return [Math.cos(a) * 92, Math.sin(a) * 92]; });

const coil = (k, off) => ({
  label: 'DISCHARGE MAST', sprite: 'tc_coil', ox: MASTS[k][0], oy: MASTS[k][1], r: 12, hp: 70, medals: 3, score: 6000, bossDamage: 0.05,
  attack(pe, c, w, t) { if (every(c, t, 90, off)) P.aimed(w, pe.x, pe.y, S.spark); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.storm, meta = { lights: [], treads: [], stacks: [], fans: [] };
  // Outer ring wing.
  ctx.beginPath(); ctx.arc(0, 0, 112, 0, TAU); ctx.arc(0, 0, 74, 0, TAU, true);
  armour(ctx, pal, -112, 112, 2);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 112, 0, TAU); ctx.arc(0, 0, 74, 0, TAU, true); ctx.clip('evenodd');
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 74, Math.sin(a) * 74); ctx.lineTo(Math.cos(a) * 112, Math.sin(a) * 112); ctx.stroke(); }
  weather(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, 112, 0, TAU); }, 0.3);
  ctx.restore();
  // Spokes holding the hub.
  for (let k = 0; k < 3; k++) { const a = Math.PI / 6 + (k / 3) * TAU; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.rect(30, -7, 46, 14); armour(ctx, pal, 30, 76); ctx.restore(); }
  // Ducted central rotor.
  circ(ctx, 0, 0, 40); armour(ctx, pal, -40, 40);
  turbine(ctx, pal, 0, 0, 32, 16);
  meta.fans.push([0, 0, 32]);
  circ(ctx, 0, 0, 11); armour(ctx, pal, -11, 11);
  // Discharge masts: insulator stacks with copper coils.
  for (const [x, y] of MASTS) {
    circ(ctx, x, y, 15); armour(ctx, pal, x - 15, x + 15);
    for (let r = 12; r > 3; r -= 3) { circ(ctx, x, y, r); ctx.strokeStyle = r % 2 ? '#c08a4a' : '#6a4a2a'; ctx.lineWidth = 1.6; ctx.stroke(); }
    glowDot(ctx, x, y, 4, 'rgba(190,170,255,1)');
    meta.lights.push({ x, y, c: '#c8b8ff', ph: (x + 200) * 0.003 });
  }
  // Cloud-seeding dispensers and conduits between masts.
  for (let k = 0; k < 6; k++) {
    const a0 = MASTS[k], a1 = MASTS[(k + 1) % 6];
    pipe(ctx, pal, a0[0] * 0.92, a0[1] * 0.92, a1[0] * 0.92, a1[1] * 0.92, 1.6);
  }
  both((s) => { vent(ctx, pal, s * 60 - 8, 70, 16, 10, 0.4, false); });
  // Cockpit pod at the front of the ring.
  ctx.beginPath(); ctx.ellipse(0, 108, 16, 12, 0, 0, TAU); armour(ctx, pal, -16, 16);
  ctx.beginPath(); ctx.ellipse(0, 112, 9, 6, 0, 0, TAU); ctx.fillStyle = 'rgba(150,180,255,0.75)'; ctx.fill();
  keyLight(ctx, -120, -120, 120, 120, 1);
  core(ctx, pal, 0, 0, 7, '#9ab8ff');
  return meta;
}

function coilArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  for (let r = w * 0.45; r > 2; r -= 2.5) { circ(ctx, cx, cy, r); ctx.fillStyle = r > w * 0.3 ? '#3c4654' : '#c08a4a'; ctx.fill(); ctx.strokeStyle = '#141820'; ctx.lineWidth = 0.6; ctx.stroke(); }
  glowDot(ctx, cx, cy, 3.5, 'rgba(200,180,255,1)');
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'tempest_crown',
  name: 'TEMPEST CROWN',
  title: 'STORM-GENERATING AIRCRAFT',
  archetype: 'aerial',
  sprite: 'b_tempest', scale: 1, r: 56, glow: [0.7, 0.6, 1], score: 150000,
  deathSequence: 'spin_out',
  art(add) {
    add('b_tempest', 248, 248, hull('b_tempest', hullArt));
    add('tc_coil', 26, 26, coilArt, 2.5);
  },
  look: {
    faction: 'stratos', anim: 'carrier',
    weak: { x: 0, y: 0, r: 20, rgb: [0.7, 0.6, 1] },
    shadow: { dx: 40, dy: 60, a: 0.3 },
    sites: [[-60, -70], [70, 40], [-90, 20], [20, 96], [80, -60], [-30, 80]],
  },
  parts: Object.fromEntries(MASTS.map((_, k) => [`mast${k}`, coil(k, k * 15)])),
  desperation: { name: 'SKYFALL' },

  phases: [
    {
      name: 'LIGHTNING MASTS', hp: 700, arena: 'tc_gathering_clouds', transitionFx: 'flash',
      move: { type: 'hover', amp: 90, y: 130, freq: 0.008 }, parts: ['mast1', 'mast2', 'mast4', 'mast5'],
      patterns: ['lightning', 'rainBands'], musicLayer: 'aerial_p1',
    },
    {
      name: 'CYCLONE', hp: 760, arena: 'tc_supercell', transitionFx: 'cloud_burst',
      move: { type: 'figure8', amp: 90, ampY: 25, y: 130, freq: 0.009 },
      patterns: ['cyclone', 'lightning'], musicLayer: 'aerial_p2',
    },
    {
      name: 'EYEWALL', hp: 810, arena: 'tc_eye_of_storm', transitionFx: 'cloud_burst',
      move: { type: 'center', y: 150 }, parts: ['mast0', 'mast3'],
      patterns: ['eyewall', 'cyclone'], musicLayer: 'aerial_p3',
    },
    {
      name: 'HAILSTORM', hp: 860, arena: 'tc_hail_corridor', transitionFx: 'cloud_burst',
      move: { type: 'sweep', amp: 110, y: 125, freq: 0.01 }, parts: ['mast1', 'mast2', 'mast4', 'mast5'],
      patterns: ['hail', 'rainBands', 'lightning'], musicLayer: 'aerial_p4',
    },
    {
      name: 'LIGHTNING CROWN', hp: 940, arena: 'tc_lightning_crown', transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 130, freq: 0.01 }, intensity: 1.1,
      patterns: ['lightning', 'cyclone', 'hail', 'eyewall'], musicLayer: 'aerial_p5',
    },
  ],

  attacks: {
    // Called lightning: a strike zone locks on, the bolt lands, the charge
    // scatters. The arena's clouds flash with it.
    lightning(c, w, t) {
      if (!every(c, t, 85)) return;
      const n = c.mk >= 3 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = k ? w.rng.range(40, W - 40) : w.aimX, y = k ? w.rng.range(H * 0.4, H - 50) : w.aimY;
        c.kit.hazard({
          type: 'circle', x: clamp(x, 30, W - 30), y: clamp(y, 80, H - 30), r: 34, warn: 60, fire: 6, color: [0.7, 0.6, 1], crater: false,
          onFire: (h, w2) => {
            P.ring(w2, h.x, h.y, S.bolt, w2.rng.angle());
            w2.g.renderer.post.flash(0.8, 0.75, 1, 0.18, 0.06);
            const view = w2.arena && w2.arena.view;
            if (view && view.cloudFlash) view.cloudFlash(1);
          },
        });
      }
    },
    // Rain bands: dense sheets of rain sweep across.
    rainBands(c, w, t) { if ((t % 200) < 110 && every(c, t, 7)) P.rain(w, S.rain); },
    // Cyclone: two spiral arms plus a vortex well that bends bullets.
    cyclone(c, w, t) {
      if (every(c, t, 6)) { P.spiral(w, c.e, S.arm, 'arm'); P.spiral(w, c.e, S.armB, 'armB'); }
      if (t % 300 === 0) c.kit.well({ x: c.e.x, y: c.e.y + 120, r: 200, strength: 0.018, life: 240, follow: true, fx: 0, fy: 120 });
    },
    // Eyewall: expanding rings from the calm centre, with a slow rotation.
    eyewall(c, w, t) { if (every(c, t, 55)) P.ring(w, c.e.x, c.e.y, S.ring, t * 0.013); },
    hail(c, w, t) { if (every(c, t, 22)) P.shoot(w, w.rng.range(20, W - 20), -10, DOWN + w.rng.range(-0.12, 0.12), S.hail.speed, S.hail); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.006) * 0.08; },
};
