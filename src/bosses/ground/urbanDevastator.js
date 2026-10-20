import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, body, camo, weather, limb, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe } from '../roster/art.js';

// GROUND — URBAN DEVASTATOR (armoured siege walker)
// A four-legged demolition platform built for street fighting: a boxy
// armoured cab slung between hydraulic legs, rocket pods on the shoulders,
// a breaching flame projector under the chin and a heavy siege mortar on
// its back. It does not glide like the tanks — it plants its feet, and every
// stomp sends a shock ring through the streets.
// Arenas: downtown siege → collapsed metro → rail yard → burning tower
// district → flooded financial core.

const S = {
  stomp: { shape: 'orb', color: 'red', n: 14, speed: 1.7 },
  stompB: { shape: 'rice', color: 'orange', n: 10, speed: 2.4 },
  rocket: { shape: 'kunai', color: 'red', n: 1, speed: 2.2, homing: 0.035, homingTime: 60, accel: 0.03, maxSpd: 4.5, fixed: true },
  flame: { shape: 'rice', color: 'orange', n: 1, speed: 3.4, accel: -0.05, minSpd: 0.6, fixed: true },
  flameHot: { shape: 'rice', color: 'yellow', n: 1, speed: 3.8, accel: -0.06, minSpd: 0.5, fixed: true },
  mortar: { shape: 'orb', color: 'red', n: 12, speed: 1.8 },
  rubble: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.6, fixed: true, split: { shape: 'orb', color: 'red', n: 6, speed: 2 }, splitAt: 90 },
  chain: { shape: 'orb', color: 'red', n: 5, spread: 0.6, speed: 2.6 },
};

const FEET = [[-92, -74], [92, -74], [-96, 78], [96, 78]];

const pod = (ox, off) => ({
  label: 'ROCKET POD', sprite: 'ud_pod', ox, oy: -18, r: 14, hp: 90, medals: 3, score: 7000, bossDamage: 0.07,
  attack(pe, c, w, t) {
    if (!every(c, t, 130, off)) return;
    for (let k = 0; k < (c.mk >= 2 ? 3 : 2); k++) P.shoot(w, pe.x, pe.y, DOWN + Math.sign(ox) * (0.5 + k * 0.35), S.rocket.speed, S.rocket);
  },
});
const mortar = {
  label: 'SIEGE MORTAR', sprite: 'ud_mortar', ox: 0, oy: -60, r: 15, hp: 120, medals: 4, score: 9000, bossDamage: 0.08,
  attack(pe, c, w, t) {
    if (every(c, t, 120, 30)) artillery(c, w.aimX, w.aimY, 46, 70, S.mortar);
  },
};

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.urban, meta = { lights: [], treads: [], stacks: [] };
  // Legs: hip → knee → foot, splayed like a crab, with hydraulic rams.
  for (const [fx, fy] of FEET) {
    const sx = Math.sign(fx), sy = Math.sign(fy);
    const hx = sx * 46, hy = sy * 40, kx = sx * 84, ky = sy * 30;
    limb(ctx, pal, hx, hy, kx, ky, 18);
    limb(ctx, pal, kx, ky, fx, fy, 14);
    pipe(ctx, pal, hx, hy + sy * 8, fx - sx * 6, fy - sy * 10, 2.2);
    circ(ctx, kx, ky, 10); armour(ctx, pal, kx - 10, kx + 10);
    // Foot pad with spikes.
    ctx.beginPath(); ctx.ellipse(fx, fy, 16, 13, 0, 0, TAU); armour(ctx, { plate: ['#141214', '#3a3236', '#6a6064'] }, fx - 16, fx + 16);
    ctx.fillStyle = '#0c0a0b';
    for (let a = 0; a < 6; a++) { const r = 16; poly(ctx, [fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.8, fx + Math.cos(a + 0.2) * (r + 5), fy + Math.sin(a + 0.2) * (r + 5) * 0.8, fx + Math.cos(a + 0.4) * r, fy + Math.sin(a + 0.4) * r * 0.8]); ctx.fill(); }
    circ(ctx, hx, hy, 13); armour(ctx, pal, hx - 13, hx + 13);
  }
  // Armoured cab: boxy, chamfered corners, sloped front.
  const outline = [0, -84, 40, -84, 54, -70, 56, 50, 44, 76, 0, 82];
  const path = () => mpoly(ctx, outline);
  meta.lights.push(...body(ctx, pal, outline, [-56, -84, 112, 166], 'urbandevastator', { vents: 3, hazards: 2, pipes: 2 }));
  camo(ctx, path, ['#4a4448', '#7a7276', '#2a2628', '#9a9294'], 21, 22, 14);
  weather(ctx, path, 0.45);
  // Hazard-striped dozer brow and the breaching flame projector.
  ctx.beginPath(); ctx.moveTo(-44, 72); ctx.lineTo(44, 72); ctx.lineTo(36, 86); ctx.lineTo(-36, 86); ctx.closePath();
  ctx.fillStyle = '#1a1214'; ctx.fill();
  hazard(ctx, pal, -40, 74, 80, 8, 4);
  ctx.beginPath(); ctx.rect(-8, 80, 16, 30); armour(ctx, pal, -8, 8);
  ctx.beginPath(); ctx.rect(-11, 104, 22, 8); armour(ctx, pal, -11, 11);
  circ(ctx, 0, 110, 4); ctx.fillStyle = '#050304'; ctx.fill();
  pipe(ctx, pal, -20, 40, -8, 92, 2);
  pipe(ctx, pal, 20, 40, 8, 92, 2);
  // Vision slits and a periscope block.
  for (let k = -2; k <= 2; k++) { ctx.fillStyle = '#0a0406'; ctx.fillRect(k * 12 - 4, 54, 8, 3); }
  ctx.beginPath(); ctx.rect(-14, 30, 28, 14); armour(ctx, pal, -14, 14);
  // Shoulder rails for the rocket pods.
  both((s) => { ctx.beginPath(); ctx.rect(s * 44 - 14, -32, 28, 30); armour(ctx, pal, s * 44 - 14, s * 44 + 14); hazard(ctx, pal, s * 44 - 14, -6, 28, 4); });
  // Rear power pack: radiator louvres, twin exhaust stacks.
  vent(ctx, pal, -34, -80, 68, 12, 0.35, false);
  both((s) => { circ(ctx, s * 30, -64, 6); ctx.fillStyle = '#100a0c'; ctx.fill(); meta.stacks.push([s * 30, -64]); });
  rivetRow(ctx, pal, -50, -52, 50, -52, 7);
  keyLight(ctx, -120, -110, 120, 110, 1);
  core(ctx, pal, 0, 6, 8, '#ff4a3a');
  both((s) => { lamp(ctx, s * 30, 78, '#ffe0a0', 1.6); meta.lights.push({ x: s * 30, y: 78, c: '#ffe0a0', ph: s > 0 ? 0 : 0.5 }); });
  for (const [fx, fy] of FEET) meta.lights.push({ x: fx, y: fy, c: pal.light, ph: fx > 0 ? 0.25 : 0.75 });
  return meta;
}

function podArt(ctx, w, h) {
  const pal = PALS.urban, cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 3); armour(ctx, pal, 0, w);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { circ(ctx, cx - 7 + i * 7, cy - 7 + j * 7, 2.6); ctx.fillStyle = '#0a0406'; ctx.fill(); }
  hazard(ctx, pal, 3, h - 6, w - 6, 3);
  keyLight(ctx, 0, 0, w, h);
}

function mortarArt(ctx, w, h) {
  const pal = PALS.urban, cx = w / 2, cy = h / 2;
  circ(ctx, cx, cy, w * 0.44); armour(ctx, pal, 0, w);
  circ(ctx, cx, cy + 2, w * 0.24); armour(ctx, pal, cx - w * 0.24, cx + w * 0.24);
  circ(ctx, cx, cy + 2, w * 0.14); ctx.fillStyle = '#050304'; ctx.fill();
  keyLight(ctx, 0, 0, w, h);
  glowDot(ctx, cx, cy + 2, 3, 'rgba(255,90,60,1)');
}

export default {
  id: 'urban_devastator',
  name: 'URBAN DEVASTATOR',
  title: 'ARMOURED SIEGE WALKER',
  archetype: 'ground',
  sprite: 'b_devastator', scale: 1, r: 56, glow: [1, 0.35, 0.3], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_devastator', 236, 232, hull('b_devastator', hullArt));
    add('ud_pod', 28, 30, podArt, 2.5);
    add('ud_mortar', 34, 34, mortarArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'crawler',
    weak: { x: 0, y: 6, r: 18, rgb: [1, 0.35, 0.25] },
    sites: [[-30, -50], [36, 20], [-20, 60], [84, 30], [-84, -30], [40, -70]],
  },
  parts: { podL: pod(-44, 0), podR: pod(44, 65), mortar },
  desperation: { name: 'URBAN COLLAPSE' },

  phases: [
    {
      name: 'STOMP AND STRAFE', hp: 720, arena: 'ud_downtown_siege', transitionFx: 'flash',
      move: { type: 'hover', amp: 90, y: 130, freq: 0.009 }, parts: ['podL', 'podR'],
      patterns: ['stomp', 'chainGun'], musicLayer: 'ground_p1',
    },
    {
      name: 'FLAMETHROWERS', hp: 770, arena: 'ud_collapsed_metro', transitionFx: 'rockfall',
      move: { type: 'hover', amp: 70, y: 125, freq: 0.011 }, parts: ['mortar'],
      patterns: ['flamethrower', 'rubbleFall'], musicLayer: 'ground_p2',
    },
    {
      name: 'FALLING MASONRY', hp: 820, arena: 'ud_rail_yard', transitionFx: 'flash',
      move: { type: 'sweep', amp: 110, y: 125, freq: 0.01 }, parts: ['podL', 'podR', 'mortar'],
      patterns: ['stomp', 'chainGun', 'rubbleFall'], musicLayer: 'ground_p3',
    },
    {
      name: 'WRECKING SWEEP', hp: 860, arena: 'ud_tower_inferno', transitionFx: 'screen_tear',
      move: { type: 'figure8', amp: 90, ampY: 25, y: 130 },
      patterns: ['flamethrower', 'stomp', 'wreckingSweep'], musicLayer: 'ground_p4',
    },
    {
      name: 'TOTAL DEMOLITION', hp: 940, arena: 'ud_flooded_core', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 110, y: 130, freq: 0.012 }, intensity: 1.1,
      patterns: ['stomp', 'flamethrower', 'wreckingSweep', 'chainGun'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    // Stomp: the walker plants a foot every beat; each footfall rings out.
    stomp(c, w, t) {
      if (!every(c, t, 70)) return;
      const k = (c.data.foot = ((c.data.foot || 0) + 1) % 4);
      const [fx, fy] = FEET[k];
      const x = c.e.x + fx, y = c.e.y + fy;
      P.ring(w, x, y, S.stomp, w.rng.angle());
      if (c.mk >= 2) P.ring(w, x, y, S.stompB, w.rng.angle());
      w.g.camera.addTrauma(0.1);
      w.explosions.sparks(x, y, 6, [0.7, 0.6, 0.5], 3, 18, 3);
      const fx2 = w.arena && w.arena.fx;
      if (fx2 && fx2.impact) fx2.impact(x, y, 22, { dust: true });
    },
    chainGun(c, w, t) {
      if ((t % 100) < 40 && every(c, t, 8)) P.aimed(w, c.e.x, c.e.y + 60, S.chain, Math.sin(t * 0.08) * 0.25);
    },
    // Flamethrower: a sweeping cone of fire from the chin projector.
    flamethrower(c, w, t) {
      const k = t % 200;
      if (k < 110 && every(c, t, 2)) {
        const ang = DOWN + Math.sin(k * 0.045) * 0.9;
        P.shoot(w, c.e.x, c.e.y + 110, ang + w.rng.range(-0.1, 0.1), S.flame.speed + w.rng.range(-0.4, 0.4), k % 4 ? S.flame : S.flameHot);
      }
    },
    // Rubble fall: blocks shaken loose overhead come down and burst.
    rubbleFall(c, w, t) {
      if (every(c, t, 45)) P.shoot(w, w.rng.range(30, W - 30), -10, DOWN + w.rng.range(-0.15, 0.15), S.rubble.speed, S.rubble);
    },
    // Wrecking sweep: a leg swings out in a telegraphed arc across the street.
    wreckingSweep(c, w, t) {
      if (!every(c, t, 220, 100)) return;
      const side = w.aimX < c.e.x ? -1 : 1;
      c.kit.hazard({
        type: 'arc', follow: true, r: 210, warn: 55, fire: 30,
        a0: side < 0 ? Math.PI * 0.95 : Math.PI * 0.05, a1: Math.PI / 2,
        color: [1, 0.35, 0.25],
      });
    },
  },

  // Gait: a slight sway synced to the footfalls.
  update(c) { if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.09) * 0.012; },
};
