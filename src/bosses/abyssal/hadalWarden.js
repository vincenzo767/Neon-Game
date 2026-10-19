import * as P from '../../patterns/index.js';
import { every, clamp, ghostRing, DOWN, TAU, W, H } from '../util.js';
import { hull, mpoly, poly, circ, both, keyLight, chitin, glowDot, tentacle, eyeball } from '../roster/art.js';

// ABYSSAL — HADAL WARDEN (deep-trench guardian)
// A colossal armoured crustacean that has guarded the trench floor for
// longer than anything has been alive above it: overlapping pale shell
// segments, two crushing claws, a fan of antennae and a bioluminescent
// lure hanging before a mouth that is mostly darkness. It holds ground.
// Claws close on telegraphed arcs, the lure lays out ghost-light that fades
// in and out, pressure pulses ring outward and the shell vents silt.
// Arenas: the hadal trench → the trench wall → a pressure gate of ancient
// stone → the lure fields → the Warden's abyss.

const S = {
  pulse: { shape: 'orb', color: 'cyan', n: 18, speed: 1.4 },
  pulseB: { shape: 'rice', color: 'blue', n: 14, speed: 1.9 },
  lure: { shape: 'orb', color: 'green', n: 16, speed: 1.2 },
  spine: { shape: 'kunai', color: 'cyan', n: 5, spread: 0.4, speed: 3 },
  silt: { shape: 'orb', color: 'blue', n: 14, speed: 1.2, gap: 1 },
  crush: { shape: 'rice', color: 'cyan', n: 9, spread: 1.2, speed: 2.4 },
};

const CLAWS = [[-78, 70], [78, 70]];
const LURE = [0, 118];

const claw = (k, off) => ({
  label: 'CRUSHING CLAW', sprite: 'hw_claw', ox: CLAWS[k][0], oy: CLAWS[k][1], r: 16, hp: 110, medals: 4, score: 8000, bossDamage: 0.08,
  attack(pe, c, w, t) { if (every(c, t, 60, off)) P.aimed(w, pe.x, pe.y, S.spine); },
});

// ------------------------------------------------------------------ art

const SHELL = ['#1a1e22', '#6a7478', '#c8d0cc'];
const SOFT = ['#200e14', '#5a2a34', '#a86a70'];

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // Walking legs splayed under the shell.
  both((s) => { for (let k = 0; k < 4; k++) { const y = -60 + k * 30; tentacle(ctx, [[s * 50, y], [s * 90, y - 10], [s * 112, y + 6]], 8, 3, '#3a3036', 'rgba(0,0,0,0)'); } });
  // Antennae sweeping forward.
  both((s) => tentacle(ctx, [[s * 14, 80], [s * 40, 120], [s * 80, 140], [s * 116, 136]], 3, 1, '#8a8478', 'rgba(0,0,0,0)'));
  // Tail fan at the back.
  for (let k = -2; k <= 2; k++) chitin(ctx, k * 16, -112, 12, 22, k * 0.25, SHELL);
  // Overlapping shell segments, front to back.
  for (let k = 6; k >= 0; k--) { const y = -86 + k * 26, rx = 58 + Math.sin(k / 6 * Math.PI) * 18; chitin(ctx, 0, y, rx, 20, 0, SHELL); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, y + 6, rx * 0.95, 14, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
  // Barnacles and scars.
  for (let k = 0; k < 24; k++) { const x = ((k * 37) % 110) - 55, y = ((k * 53) % 170) - 90; circ(ctx, x, y, 1.6 + (k % 3)); ctx.fillStyle = '#d8d4c4'; ctx.fill(); ctx.strokeStyle = '#3a3830'; ctx.lineWidth = 0.6; ctx.stroke(); }
  // Head plate and eyes.
  chitin(ctx, 0, 84, 40, 22, 0, SHELL);
  both((s) => eyeball(ctx, s * 22, 90, 5, '#5affd8'));
  // Mouth: a dark slit with soft tissue.
  chitin(ctx, 0, 100, 18, 8, 0, SOFT);
  ctx.beginPath(); ctx.ellipse(0, 102, 12, 3, 0, 0, TAU); ctx.fillStyle = '#050204'; ctx.fill();
  // The lure on its stalk.
  tentacle(ctx, [[0, 96], [6, 108], [0, LURE[1]]], 3, 2, '#5a2a34', 'rgba(0,0,0,0)');
  glowDot(ctx, LURE[0], LURE[1], 7, 'rgba(120,255,200,1)');
  // Bioluminescent spots along the shell seams.
  for (let k = 0; k < 7; k++) both((s) => { glowDot(ctx, s * (50 + Math.sin(k) * 10), -80 + k * 26, 1.8, 'rgba(90,255,220,1)'); meta.lights.push({ x: s * (50 + Math.sin(k) * 10), y: -80 + k * 26, c: '#5affd8', ph: k * 0.15 }); });
  keyLight(ctx, -120, -130, 120, 150, 0.5);
  meta.lights.push({ x: LURE[0], y: LURE[1], c: '#7affd0', ph: 0 });
  return meta;
}

function clawArt(ctx, w, h) {
  const cx = w / 2;
  chitin(ctx, cx, h * 0.4, w * 0.42, h * 0.36, 0, SHELL);
  // Two pincer fingers.
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 3, h * 0.6); ctx.quadraticCurveTo(cx + s * w * 0.42, h * 0.8, cx + s * 2, h - 1); ctx.lineTo(cx + s * 0.5, h * 0.7); ctx.closePath(); ctx.fillStyle = '#a8b0ac'; ctx.fill(); ctx.strokeStyle = '#1a1e22'; ctx.lineWidth = 0.8; ctx.stroke(); }
}

export default {
  id: 'hadal_warden',
  name: 'HADAL WARDEN',
  title: 'DEEP-TRENCH GUARDIAN',
  archetype: 'abyssal',
  sprite: 'b_warden', scale: 1, r: 54, glow: [0.4, 1, 0.85], score: 150000,
  deathSequence: 'dissolve',
  art(add) {
    add('b_warden', 244, 292, hull('b_warden', hullArt));
    add('hw_claw', 36, 44, clawArt, 2.5);
  },
  look: {
    faction: 'drowned', anim: 'alien', organic: true, ichor: [0.3, 1, 0.8],
    weak: { x: LURE[0], y: LURE[1], r: 16, rgb: [0.4, 1, 0.8] },
    pulse: [0.4, 1.6, 1.2],
    sites: [[-40, -40], [40, 0], [-30, 40], [30, -70], [-60, 20], [60, -40]],
  },
  parts: { clawL: claw(0, 0), clawR: claw(1, 30) },
  desperation: { name: 'CRUSH DEPTH' },

  phases: [
    {
      name: 'CRUSHING DEPTH', hp: 760, arena: 'hw_hadal_trench', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 60, y: 145, freq: 0.005 }, parts: ['clawL', 'clawR'],
      patterns: ['pressure', 'lure'], musicLayer: 'abyssal_p1',
    },
    {
      name: 'TRENCH CLAWS', hp: 810, arena: 'hw_trench_wall', transitionFx: 'darkness_swallow',
      move: { type: 'sweep', amp: 80, y: 145, freq: 0.006 },
      patterns: ['claws', 'silt'], musicLayer: 'abyssal_p2',
    },
    {
      name: 'PRESSURE GATE', hp: 850, arena: 'hw_pressure_gate', transitionFx: 'water_flood',
      move: { type: 'center', y: 150 }, parts: ['clawL', 'clawR'],
      patterns: ['pressure', 'claws'], musicLayer: 'abyssal_p3',
    },
    {
      name: 'LURE FIELDS', hp: 890, arena: 'hw_lure_fields', transitionFx: 'darkness_swallow',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 145, freq: 0.006 },
      patterns: ['lure', 'silt', 'pressure'], musicLayer: 'abyssal_p4',
    },
    {
      name: "THE WARDEN'S ABYSS", hp: 970, arena: 'hw_wardens_abyss', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 80, y: 145, freq: 0.007 }, intensity: 1.1,
      patterns: ['claws', 'lure', 'pressure', 'silt'], musicLayer: 'abyssal_p5',
    },
  ],

  attacks: {
    // Pressure pulse: rings of displaced water from the shell.
    pressure(c, w, t) {
      if (every(c, t, 70)) P.ring(w, c.e.x, c.e.y, S.pulse, t * 0.017);
      if (c.mk >= 2 && every(c, t, 70, 35)) P.ring(w, c.e.x, c.e.y, S.pulseB, -t * 0.02);
    },
    // Lure: ghost-light that fades in and out — hard to read in the dark.
    lure(c, w, t) { if (every(c, t, 60, 20)) ghostRing(c, w, c.e.x + LURE[0], c.e.y + LURE[1], S.lure, w.rng.angle()); },
    // Claws: both claws close on arcs in front of the Warden.
    claws(c, w, t) {
      if (!every(c, t, 160, 40)) return;
      for (const [k, s] of [[0, -1], [1, 1]]) {
        const a0 = s < 0 ? Math.PI * 0.95 : Math.PI * 0.05, a1 = Math.PI / 2 + s * 0.15;
        c.kit.hazard({ type: 'arc', follow: true, fx: CLAWS[k][0], fy: CLAWS[k][1], r: 190, a0, a1, warn: 55 + k * 18, fire: 16, color: [0.4, 1, 0.85],
          onFire: (h, w2) => { P.fan(w2, h.cx, h.cy, DOWN, S.crush); w2.g.camera.addTrauma(0.2); } });
      }
    },
    // Silt: the shell vents silt in slow walls with one gap.
    silt(c, w, t) { if (every(c, t, 150, 70)) P.curtain(w, S.silt); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.01) * 0.02; },
};
