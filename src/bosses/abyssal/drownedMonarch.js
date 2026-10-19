import * as P from '../../patterns/index.js';
import { every, clamp, dens, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, chitin, glowDot, tentacle, limb } from '../roster/art.js';

// ABYSSAL — DROWNED MONARCH (ancient submerged ruler)
// A king that drowned with his kingdom and did not stop ruling: a towering
// figure of verdigris bronze and coral-crusted stone, crowned, robed in
// kelp, holding a trident of black iron. He holds court in what is left of
// his palace. His attacks are decrees: tridents thrust down three lanes at
// once, royal sigils expand into rune-shaped volleys, tides roll in as
// walls with a single gap, drowned guards rise to defend him, and a
// whirlpool bends everything toward the throne.
// Arenas: the drowned capital → the sunken palace → the coral throne room →
// the tidal sanctum → the royal crypt.

const S = {
  sigil: { shape: 'orb', color: 'yellow', n: 1, speed: 1.6 },
  tide: { shape: 'orb', color: 'cyan', n: 15, speed: 1.6, gap: 1 },
  tine: { shape: 'kunai', color: 'yellow', n: 1, speed: 3.4, fixed: true },
  guard: { shape: 'rice', color: 'cyan', n: 3, spread: 0.3, speed: 2.4 },
  whirl: { shape: 'rice', color: 'blue', n: 6, speed: 2, turn: 0.14, angVel: 0.01 },
  crown: { shape: 'orb', color: 'yellow', n: 10, speed: 2 },
};

const TRIDENT = [44, 120];

function drownedGuard(c, w, x) {
  c.kit.spawnMinion({
    sprite: 'dm_guard', name: 'DROWNED GUARD', x, y: H + 20, r: 10, hp: 10, score: 450, glow: [0.4, 1, 0.9],
    drops: w.rng.chance(0.3) ? ['M'] : null, data: { x },
    ai(m, c2, w2) {
      // Rises from the floor of the hall, holds, fires, sinks again.
      if (m.t < 70) m.y -= 3;
      else if (m.t < 200) { m.x = m.data.x + Math.sin(m.t * 0.05) * 14; if (m.t % 50 === 0) P.aimed(w2, m.x, m.y, S.guard); }
      else m.y += 3;
    },
  });
}

// ------------------------------------------------------------------ art

const BRONZE = { plate: ['#14201c', '#3e6a5a', '#8ab8a0'], seam: 'rgba(4,10,8,0.8)', hi: 'rgba(220,255,240,0.3)', rivet: '#c8a858' };

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // Robe of kelp spreading behind like a train.
  for (let k = 0; k < 14; k++) { const a = Math.PI * 1.1 + (k / 13) * Math.PI * 0.8; tentacle(ctx, [[0, -10], [Math.cos(a) * 60, -10 + Math.sin(a) * 60], [Math.cos(a) * 110, -10 + Math.sin(a) * 120]], 10, 3, k % 2 ? '#2a3a1a' : '#3a4a22', 'rgba(0,0,0,0)'); }
  // Shoulders and chest: bronze plate with coral growth.
  ctx.beginPath(); ctx.ellipse(0, 20, 64, 46, 0, 0, TAU); armour(ctx, BRONZE, -64, 64, 2);
  both((s) => { ctx.beginPath(); ctx.ellipse(s * 56, 10, 28, 24, s * 0.4, 0, TAU); armour(ctx, BRONZE, s * 56 - 28, s * 56 + 28); });
  // Coral and barnacle encrustation.
  for (let k = 0; k < 18; k++) { const x = ((k * 41) % 120) - 60, y = ((k * 29) % 70) - 10, c = ['#d86a5a', '#e8a070', '#c8d0b8', '#8a5aa8'][k % 4]; for (let j = 0; j < 4; j++) { circ(ctx, x + Math.cos(j * 1.6) * 3, y + Math.sin(j * 1.6) * 3, 2.2); ctx.fillStyle = c; ctx.fill(); } }
  // Left arm raised in command; right arm holding the trident.
  limb(ctx, BRONZE, -56, 20, -78, 70, 16);
  glowDot(ctx, -80, 76, 4, 'rgba(255,230,140,1)');
  limb(ctx, BRONZE, 56, 20, TRIDENT[0], 60, 16);
  // Trident: black iron shaft, three tines.
  ctx.beginPath(); ctx.rect(TRIDENT[0] - 2.5, -40, 5, TRIDENT[1] + 20); armour(ctx, { plate: ['#08080a', '#2a2a30', '#6a6a74'] }, TRIDENT[0] - 2.5, TRIDENT[0] + 2.5);
  for (const dx of [-10, 0, 10]) { poly(ctx, [TRIDENT[0] + dx - 2, TRIDENT[1] - 22, TRIDENT[0] + dx + 2, TRIDENT[1] - 22, TRIDENT[0] + dx, TRIDENT[1] + 4]); ctx.fillStyle = '#4a4a54'; ctx.fill(); }
  ctx.beginPath(); ctx.rect(TRIDENT[0] - 12, TRIDENT[1] - 26, 24, 5); ctx.fillStyle = '#2a2a30'; ctx.fill();
  // Head: a stern bronze face under a crown of gold spikes.
  ctx.beginPath(); ctx.ellipse(0, 66, 18, 22, 0, 0, TAU); armour(ctx, BRONZE, -18, 18);
  both((s) => glowDot(ctx, s * 7, 72, 2.4, 'rgba(120,255,220,1)'));
  for (let k = 0; k < 7; k++) { const a = Math.PI * 1.15 + (k / 6) * Math.PI * 0.7; poly(ctx, [Math.cos(a) * 16, 62 + Math.sin(a) * 16, Math.cos(a) * 30, 62 + Math.sin(a) * 30, Math.cos(a + 0.12) * 16, 62 + Math.sin(a + 0.12) * 16]); ctx.fillStyle = '#d8b050'; ctx.fill(); ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 0.6; ctx.stroke(); }
  keyLight(ctx, -120, -130, 120, 150, 0.6);
  meta.lights.push({ x: -7, y: 72, c: '#7affd8', ph: 0 }, { x: 7, y: 72, c: '#7affd8', ph: 0 }, { x: -80, y: 76, c: '#ffe8a0', ph: 0.5 });
  return meta;
}

function guardArt(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.ellipse(cx, h * 0.55, w * 0.38, h * 0.4, 0, 0, TAU); armour(ctx, BRONZE, 0, w);
  ctx.beginPath(); ctx.ellipse(cx, h * 0.25, w * 0.22, h * 0.18, 0, 0, TAU); armour(ctx, BRONZE, 0, w);
  glowDot(ctx, cx, h * 0.25, 2, 'rgba(120,255,220,1)');
  ctx.beginPath(); ctx.rect(w - 4, 2, 2, h - 4); ctx.fillStyle = '#2a2a30'; ctx.fill();
}

export default {
  id: 'drowned_monarch',
  name: 'DROWNED MONARCH',
  title: 'ANCIENT SUBMERGED RULER',
  archetype: 'abyssal',
  sprite: 'b_monarch', scale: 1, r: 50, glow: [0.5, 1, 0.85], score: 150000,
  deathSequence: 'dissolve',
  art(add) {
    add('b_monarch', 248, 290, hull('b_monarch', hullArt));
    add('dm_guard', 20, 28, guardArt, 2.5);
  },
  look: {
    faction: 'drowned', anim: 'alien', organic: true, ichor: [0.3, 0.9, 0.7],
    weak: { x: 0, y: 66, r: 16, rgb: [0.5, 1, 0.85] },
    pulse: [0.5, 1.4, 1.1],
    rings: [{ r: 120, rgb: [1.2, 1, 0.5], spin: 0.003, a: 0.14 }],
    sites: [[-40, 20], [40, 20], [-56, 10], [56, 10], [0, 40], [44, 60]],
  },
  parts: {},
  desperation: { name: 'THE TIDE RETURNS' },

  phases: [
    {
      name: 'ROYAL DECREE', hp: 760, arena: 'dm_drowned_capital', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 80, y: 145, freq: 0.006 },
      patterns: ['decree', 'tides'], musicLayer: 'abyssal_p1',
    },
    {
      name: 'TRIDENT GUARD', hp: 810, arena: 'dm_sunken_palace', transitionFx: 'water_flood',
      move: { type: 'center', y: 150 },
      patterns: ['trident', 'guards'], musicLayer: 'abyssal_p2',
    },
    {
      name: 'WHIRLPOOL', hp: 850, arena: 'dm_coral_throne', transitionFx: 'membrane',
      move: { type: 'hover', amp: 70, y: 150, freq: 0.006 },
      patterns: ['decree', 'whirlpool', 'trident'], musicLayer: 'abyssal_p3',
    },
    {
      name: 'TIDAL CROWN', hp: 890, arena: 'dm_tidal_sanctum', transitionFx: 'water_flood',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 145, freq: 0.006 },
      patterns: ['tides', 'guards', 'crown'], musicLayer: 'abyssal_p4',
    },
    {
      name: 'THE ROYAL CRYPT', hp: 970, arena: 'dm_royal_crypt', transitionFx: 'darkness_swallow',
      move: { type: 'center', y: 150 }, intensity: 1.1,
      patterns: ['trident', 'decree', 'whirlpool', 'guards'], musicLayer: 'abyssal_p5',
    },
  ],

  attacks: {
    // Decree: a royal sigil (trident / eye glyph) expands as a bullet formation.
    decree(c, w, t) { if (every(c, t, 110, 20)) c.kit.glyph(c.e.x - 60, c.e.y + 60, (t / 110 | 0) % 2 ? 'trident' : 'eye', S.sigil, dens(w, 26), w.rng.range(-0.3, 0.3), c.mk >= 3); },
    // Trident: three parallel lanes thrust down the hall.
    trident(c, w, t) {
      if (!every(c, t, 150, 50)) return;
      const x0 = clamp(w.aimX, 90, W - 90);
      for (const dx of [-70, 0, 70]) c.kit.hazard({ type: 'lane', x: x0 + dx, w: 30, warn: 60, fire: 22, color: [1, 0.85, 0.4], y0: c.e.y + 80,
        onFire: (h, w2) => { for (let k = 0; k < 3; k++) P.shoot(w2, h.x, c.e.y + 100 + k * 30, DOWN, S.tine.speed, S.tine); } });
    },
    tides(c, w, t) { if (every(c, t, 130, 60)) P.curtain(w, S.tide); },
    guards(c, w, t) { if (every(c, t, 220, 10)) for (const x of [W * 0.2, W * 0.8]) drownedGuard(c, w, x); },
    whirlpool(c, w, t) {
      if (every(c, t, 8)) P.spiral(w, c.e, S.whirl, 'whirl');
      if (t % 300 === 0) c.kit.well({ x: c.e.x, y: c.e.y, r: 260, strength: 0.02, life: 260, follow: true });
    },
    crown(c, w, t) { if (every(c, t, 50)) P.ring(w, c.e.x, c.e.y + 62, S.crown, t * 0.04); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.006) * 0.025; },
};
