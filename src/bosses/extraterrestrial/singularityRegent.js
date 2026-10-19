import * as P from '../../patterns/index.js';
import { every, clamp, dens, ghostRing, DOWN, TAU, W, H } from '../util.js';
import { hull, mpoly, poly, circ, both, keyLight, glowDot, armour, PALS, rivetRow } from '../roster/art.js';

// EXTRATERRESTRIAL — SINGULARITY REGENT (cosmic superweapon)
// A weapon the size of a moon's shadow: a containment crown of six
// articulated arms holding a captive singularity between them, a halo of
// lensing mirrors and a throne-like control spire. It bends space rather
// than shooting through it — gravity wells drag bullets into orbits,
// collapsing rings converge from the edge of the screen, lensed beams
// split and the accretion disc throws spiral arms.
// Arenas: the event horizon → a gravitational lens → a collapsing star →
// the accretion disc → the Regent's throne.

const S = {
  accrete: { shape: 'orb', color: 'violet', n: 4, speed: 2.2, turn: 0.11, angVel: 0.008 },
  accreteB: { shape: 'orb', color: 'blue', n: 4, speed: 2.2, turn: -0.11, angVel: -0.008 },
  collapse: { shape: 'rice', color: 'white', n: 1, speed: 1.4, fixed: true },
  lens: { shape: 'kunai', color: 'violet', n: 3, spread: 0.25, speed: 3.2 },
  nova: { shape: 'bigorb', color: 'white', n: 12, speed: 1.5 },
  ghost: { shape: 'orb', color: 'blue', n: 24, speed: 1.4 },
};

const ARMS = Array.from({ length: 6 }, (_, k) => (k / 6) * TAU + Math.PI / 6);

const mirror = (k, off) => {
  const a = ARMS[k * 2];
  return {
    label: 'LENS MIRROR', sprite: 'sr_mirror', ox: Math.cos(a) * 108, oy: Math.sin(a) * 108, r: 12, hp: 80, medals: 3, score: 6500, bossDamage: 0.06, aim: true,
    attack(pe, c, w, t) { if (every(c, t, 60, off)) P.aimed(w, pe.x, pe.y, S.lens); },
  };
};

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.regent, meta = { lights: [], treads: [], stacks: [] };
  // Containment arms reaching in toward the singularity.
  for (const a of ARMS) {
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(110, -16); ctx.lineTo(124, 0); ctx.lineTo(110, 16); ctx.lineTo(30, 8); ctx.closePath();
    armour(ctx, pal, 30, 124, 2);
    rivetRow(ctx, pal, 40, 0, 104, 0, 8);
    ctx.fillStyle = 'rgba(210,190,255,0.6)'; for (let x = 44; x < 104; x += 14) ctx.fillRect(x, -2, 6, 4);
    // Emitter claw at the inner end.
    poly(ctx, [30, -10, 18, -4, 18, 4, 30, 10]); ctx.fillStyle = '#d8c8ff'; ctx.fill();
    ctx.restore();
  }
  // Outer crown ring segments.
  ctx.lineWidth = 9; ctx.strokeStyle = '#2e2a40';
  for (let k = 0; k < 6; k++) { const a0 = ARMS[k] + 0.18, a1 = ARMS[(k + 1) % 6] - 0.18 + (k === 5 ? TAU : 0); ctx.beginPath(); ctx.arc(0, 0, 118, a0, a1); ctx.stroke(); }
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(220,200,255,0.5)';
  for (let k = 0; k < 6; k++) { const a0 = ARMS[k] + 0.18, a1 = ARMS[(k + 1) % 6] - 0.18 + (k === 5 ? TAU : 0); ctx.beginPath(); ctx.arc(0, 0, 122, a0, a1); ctx.stroke(); }
  // Control spire (throne) behind the singularity.
  ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(18, -60); ctx.lineTo(12, -30); ctx.lineTo(-12, -30); ctx.lineTo(-18, -60); ctx.closePath(); armour(ctx, pal, -18, 18, 2);
  glowDot(ctx, 0, -70, 4, 'rgba(230,210,255,1)');
  // The singularity: a black disc with a lensed photon ring.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pr = ctx.createRadialGradient(0, 0, 16, 0, 0, 34); pr.addColorStop(0, 'rgba(255,240,255,1)'); pr.addColorStop(0.3, 'rgba(200,160,255,0.8)'); pr.addColorStop(1, 'rgba(80,40,200,0)');
  circ(ctx, 0, 0, 34); ctx.fillStyle = pr; ctx.fill(); ctx.restore();
  circ(ctx, 0, 0, 17); ctx.fillStyle = '#000'; ctx.fill();
  keyLight(ctx, -130, -130, 130, 130, 0.6);
  for (const a of ARMS) meta.lights.push({ x: Math.cos(a) * 34, y: Math.sin(a) * 34, c: '#e0d0ff', ph: a * 0.2 });
  return meta;
}

function mirrorArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  circ(ctx, cx, cy, w * 0.44); ctx.fillStyle = '#1a1626'; ctx.fill();
  const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, w * 0.38); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b8a8e8'); g.addColorStop(1, '#3a3060');
  circ(ctx, cx, cy, w * 0.38); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(230,220,255,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
}

export default {
  id: 'singularity_regent',
  name: 'SINGULARITY REGENT',
  title: 'COSMIC SUPERWEAPON',
  archetype: 'extraterrestrial',
  sprite: 'b_regent', scale: 1, r: 58, glow: [0.8, 0.65, 1], score: 150000,
  deathSequence: 'implode',
  art(add) {
    add('b_regent', 264, 264, hull('b_regent', hullArt));
    add('sr_mirror', 24, 24, mirrorArt, 2.5);
  },
  look: {
    faction: 'outerstar', anim: 'alien',
    weak: { x: 0, y: 0, r: 18, rgb: [0.85, 0.7, 1] },
    pulse: [1.2, 0.9, 1.8],
    rings: [{ r: 160, rgb: [0.6, 0.5, 1.4], spin: 0.008, a: 0.22 }, { r: 90, rgb: [1.2, 1, 1.6], spin: -0.012, a: 0.2 }],
    shadow: { dx: 30, dy: 44, a: 0.25 },
    sites: [[-70, -30], [70, 30], [-30, 70], [30, -70], [-90, 40], [90, -40]],
  },
  parts: { mirror0: mirror(0, 0), mirror1: mirror(1, 20), mirror2: mirror(2, 40) },
  desperation: { name: 'BIG CRUNCH' },

  phases: [
    {
      name: 'ACCRETION', hp: 760, arena: 'sr_event_horizon', transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 70, y: 150, freq: 0.005 }, parts: ['mirror0', 'mirror1', 'mirror2'],
      patterns: ['accretion', 'gravity'], musicLayer: 'alien_p1',
    },
    {
      name: 'COLLAPSE', hp: 810, arena: 'sr_grav_lens', transitionFx: 'warp_tunnel',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 150, freq: 0.006 },
      patterns: ['collapse', 'ghosts'], musicLayer: 'alien_p2',
    },
    {
      name: 'NOVA', hp: 850, arena: 'sr_collapsing_star', transitionFx: 'flash',
      move: { type: 'hover', amp: 80, y: 150, freq: 0.006 }, parts: ['mirror0', 'mirror2'],
      patterns: ['nova', 'accretion'], musicLayer: 'alien_p3',
    },
    {
      name: 'DISC STORM', hp: 890, arena: 'sr_accretion_disc', transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 90, y: 150, freq: 0.007 }, parts: ['mirror1'],
      patterns: ['accretion', 'collapse', 'gravity'], musicLayer: 'alien_p4',
    },
    {
      name: "THE REGENT'S THRONE", hp: 980, arena: 'sr_regent_throne', transitionFx: 'darkness_swallow',
      move: { type: 'center', y: 150 }, intensity: 1.1,
      patterns: ['accretion', 'collapse', 'nova', 'ghosts'], musicLayer: 'alien_p5',
    },
  ],

  attacks: {
    // Accretion: spiral arms that curve as they leave the disc.
    accretion(c, w, t) {
      if (every(c, t, 7)) { P.spiral(w, c.e, S.accrete, 'acc'); P.spiral(w, c.e, S.accreteB, 'accB'); }
    },
    // Gravity: wells drag bullets into slingshot orbits.
    gravity(c, w, t) {
      if (t % 240 === 0) for (const s of [-1, 1]) c.kit.well({ x: W / 2 + s * 110, y: H * 0.45, r: 160, strength: 0.03, life: 220 });
    },
    // Collapse: a ring of bullets appears at the screen edge and falls inward.
    collapse(c, w, t) {
      if (!every(c, t, 110, 30)) return;
      const n = dens(w, 22), cx = clamp(w.aimX, 80, W - 80), cy = clamp(w.aimY, 200, H - 80), R = 260;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + w.rng.range(0, 0.1);
        // Points past the screen edge are pulled onto it (bullets beyond the cull margin would vanish).
        const px = clamp(cx + Math.cos(a) * R, -30, W + 30), py = clamp(cy + Math.sin(a) * R, -30, H + 30);
        P.shoot(w, px, py, Math.atan2(cy - py, cx - px), S.collapse.speed, S.collapse);
      }
    },
    // Nova: the captive star flares — heavy slow rings.
    nova(c, w, t) { if (every(c, t, 90)) { P.ring(w, c.e.x, c.e.y, S.nova, w.rng.angle()); w.g.renderer.post.flash(0.9, 0.85, 1, 0.12, 0.04); } },
    ghosts(c, w, t) { if (every(c, t, 65)) ghostRing(c, w, c.e.x, c.e.y, S.ghost, t * 0.02); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.005) * 0.05; },
};
