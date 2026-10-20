import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { hull, mpoly, poly, circ, both, keyLight, chitin, glowDot, tentacle } from '../roster/art.js';

// EXTRATERRESTRIAL — SHATTERBELT DEVOURER (asteroid-consuming entity)
// A void-adapted grazer the size of a frigate: a rock-armoured carapace
// grown from the minerals it eats, a radial maw ringed with grinding
// plates, feeding palps, and a glowing gut where ore is smelted. It feeds
// on asteroid belts — inhaling rubble, spitting it back as shrapnel, and
// shedding plates of its carapace when hurt.
// Arenas: the Shatterbelt → a gutted mining colony → a planetoid's cratered
// surface → the ring plane of a gas giant → inside its own gut.

const S = {
  spit: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.4, fixed: true, split: { shape: 'kunai', color: 'yellow', n: 9, speed: 2.3 }, splitAt: 55 },
  gravel: { shape: 'orb', color: 'orange', n: 3, spread: 0.3, speed: 2.6 },
  rock: { shape: 'bigorb', color: 'red', n: 1, speed: 1.3, fixed: true, scale: 1.2, radius: 8 },
  plate: { shape: 'kunai', color: 'violet', n: 8, speed: 2.2 },
  inhale: { shape: 'rice', color: 'yellow', n: 20, speed: 1.4 },
  bile: { shape: 'orb', color: 'green', n: 6, speed: 2, turn: 0.2 },
  bileB: { shape: 'orb', color: 'yellow', n: 6, speed: 2, turn: -0.15 },
};

const MAW = [0, 70];
const PALPS = [[-56, 66], [56, 66]];

const palp = (k, off) => ({
  label: 'FEEDING PALP', sprite: 'sd_palp', ox: PALPS[k][0], oy: PALPS[k][1] + 20, r: 13, hp: 85, medals: 3, score: 6500, bossDamage: 0.06, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 45, off)) P.aimed(w, pe.x, pe.y, S.gravel); },
});

// ------------------------------------------------------------------ art

const ROCK = ['#2a2420', '#5a4e44', '#9a8a78'];
const HIDE = ['#1a1420', '#4a3a52', '#8a7a96'];

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // Tail segments trailing behind (top of the sprite).
  for (let k = 0; k < 5; k++) { const y = -60 - k * 22, r = 34 - k * 5; chitin(ctx, Math.sin(k * 0.8) * 6, y, r, r * 0.6, 0, HIDE); chitin(ctx, Math.sin(k * 0.8) * 6, y - 3, r * 0.75, r * 0.4, 0, ROCK); }
  // Palps reaching forward around the maw.
  for (const [x, y] of PALPS) { const s = Math.sign(x); tentacle(ctx, [[s * 40, 30], [x, y - 10], [x + s * 10, y + 20], [x + s * 4, y + 40]], 12, 4, '#4a3a52', 'rgba(220,180,255,0.4)'); }
  // Main carapace: overlapping rock plates over a dark hide.
  chitin(ctx, 0, 0, 82, 70, 0, HIDE);
  const plates = [[-40, -30, 30, 22, -0.4], [40, -30, 30, 22, 0.4], [0, -44, 34, 20, 0], [-58, 10, 22, 28, -0.2], [58, 10, 22, 28, 0.2], [-30, 18, 26, 20, 0.3], [30, 18, 26, 20, -0.3], [0, 0, 28, 24, 0]];
  for (const [x, y, rx, ry, rot] of plates) {
    chitin(ctx, x, y, rx, ry, rot, ROCK);
    // Mineral veins and embedded ore that glows faintly.
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(20,14,10,0.6)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-rx * 0.6, (k - 1) * ry * 0.4); ctx.lineTo(rx * 0.5, (k - 1) * ry * 0.3 + 3); ctx.stroke(); }
    ctx.restore();
    glowDot(ctx, x + rx * 0.3, y - ry * 0.2, 1.8, 'rgba(255,170,80,1)');
  }
  // Gut glow seen through cracks in the dorsal plates.
  const g = ctx.createRadialGradient(0, -6, 2, 0, -6, 40); g.addColorStop(0, 'rgba(255,170,60,0.7)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(-40, -46, 80, 80); ctx.globalCompositeOperation = 'source-over';
  // Radial maw with grinding plates.
  circ(ctx, MAW[0], MAW[1], 32); ctx.fillStyle = '#100808'; ctx.fill();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; const x = MAW[0] + Math.cos(a) * 26, y = MAW[1] + Math.sin(a) * 26; ctx.save(); ctx.translate(x, y); ctx.rotate(a); poly(ctx, [-6, -5, 6, -5, 3, 6, -3, 6]); ctx.fillStyle = '#b8aa94'; ctx.fill(); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore(); }
  const mg = ctx.createRadialGradient(MAW[0], MAW[1], 2, MAW[0], MAW[1], 20); mg.addColorStop(0, 'rgba(255,190,90,1)'); mg.addColorStop(0.5, 'rgba(200,70,20,0.8)'); mg.addColorStop(1, 'rgba(40,8,4,0)');
  circ(ctx, MAW[0], MAW[1], 20); ctx.fillStyle = mg; ctx.fill();
  keyLight(ctx, -110, -170, 110, 120, 0.8);
  meta.lights.push({ x: MAW[0], y: MAW[1], c: '#ffb050', ph: 0 });
  return meta;
}

function palpArt(ctx, w, h) {
  const cx = w / 2;
  chitin(ctx, cx, h * 0.45, w * 0.42, h * 0.4, 0, HIDE);
  poly(ctx, [cx - 4, h * 0.7, cx + 4, h * 0.7, cx, h - 1]); ctx.fillStyle = '#b8aa94'; ctx.fill();
  glowDot(ctx, cx, h * 0.4, 2.5, 'rgba(220,170,255,1)');
}

export default {
  id: 'shatterbelt_devourer',
  name: 'SHATTERBELT DEVOURER',
  title: 'ASTEROID-CONSUMING ENTITY',
  archetype: 'extraterrestrial',
  sprite: 'b_devourer', scale: 1, r: 56, glow: [1, 0.6, 0.3], score: 150000,
  deathSequence: 'implode',
  art(add) {
    add('b_devourer', 200, 300, hull('b_devourer', hullArt));
    add('sd_palp', 24, 30, palpArt, 2.5);
  },
  look: {
    faction: 'outerstar', anim: 'alien', organic: true, ichor: [1, 0.6, 0.25],
    weak: { x: MAW[0], y: MAW[1], r: 20, rgb: [1, 0.6, 0.25] },
    pulse: [1.4, 0.6, 0.2],
    shadow: { dx: 22, dy: 34, a: 0.25 },
    sites: [[-40, -30], [40, -30], [-58, 10], [58, 10], [0, -44], [0, 0]],
  },
  parts: { palpL: palp(0, 0), palpR: palp(1, 22) },
  desperation: { name: 'FEEDING FRENZY' },

  phases: [
    {
      name: 'ASTEROID SPIT', hp: 720, arena: 'sd_shatterbelt', transitionFx: 'flash',
      move: { type: 'figure8', amp: 100, ampY: 25, y: 135, freq: 0.007 }, parts: ['palpL', 'palpR'],
      patterns: ['spit', 'asteroids'], musicLayer: 'alien_p1',
    },
    {
      name: 'INHALE', hp: 770, arena: 'sd_mining_colony', transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 100, y: 135, freq: 0.008 },
      patterns: ['inhale', 'plateShed'], musicLayer: 'alien_p2',
    },
    {
      name: 'BILE', hp: 820, arena: 'sd_planetoid', transitionFx: 'rockfall',
      move: { type: 'sweep', amp: 110, y: 135, freq: 0.008 }, parts: ['palpL', 'palpR'],
      patterns: ['spit', 'bile'], musicLayer: 'alien_p3',
    },
    {
      name: 'PLATE SHEDDING', hp: 860, arena: 'sd_ring_plane', transitionFx: 'warp_tunnel',
      move: { type: 'figure8', amp: 110, ampY: 30, y: 135, freq: 0.008 },
      patterns: ['asteroids', 'inhale', 'plateShed'], musicLayer: 'alien_p4',
    },
    {
      name: 'THE GUT', hp: 940, arena: 'sd_the_gut', transitionFx: 'membrane',
      move: { type: 'hover', amp: 90, y: 140, freq: 0.009 }, intensity: 1.1,
      patterns: ['bile', 'spit', 'inhale', 'plateShed'], musicLayer: 'alien_p5',
    },
  ],

  attacks: {
    // Spit: a mouthful of rubble that bursts into shrapnel.
    spit(c, w, t) { if (every(c, t, 55)) P.aimed(w, c.e.x + MAW[0], c.e.y + MAW[1], S.spit, w.rng.range(-0.15, 0.15)); },
    // Asteroids: rocks drift diagonally across the arena (cover and hazard).
    asteroids(c, w, t) {
      if (!every(c, t, 40)) return;
      const s = w.rng.sign();
      P.shoot(w, s > 0 ? -12 : W + 12, w.rng.range(-20, H * 0.5), (s > 0 ? 0.6 : Math.PI - 0.6) + w.rng.range(-0.15, 0.15), S.rock.speed + w.rng.range(0, 0.6), S.rock);
    },
    // Inhale: a gravity well pulls bullets toward the maw, then it exhales a ring.
    inhale(c, w, t) {
      const k = t % 260;
      if (k === 0) c.kit.well({ x: c.e.x + MAW[0], y: c.e.y + MAW[1], r: 260, strength: 0.03, life: 140, follow: true, fx: MAW[0], fy: MAW[1] });
      if (k === 150) { P.ring(w, c.e.x + MAW[0], c.e.y + MAW[1], S.inhale, w.rng.angle()); w.g.camera.addTrauma(0.1); }
    },
    // Plate shed: carapace plates crack off in radial bursts.
    plateShed(c, w, t) {
      if (!every(c, t, 90, 45)) return;
      const a = w.rng.angle(), x = c.e.x + Math.cos(a) * 50, y = c.e.y + Math.sin(a) * 40;
      P.ring(w, x, y, S.plate, a);
    },
    bile(c, w, t) {
      if (every(c, t, 9)) P.spiral(w, { x: c.e.x + MAW[0], y: c.e.y + MAW[1], data: c.e.data }, S.bile, 'bile');
      if (c.mk >= 2 && every(c, t, 12)) P.spiral(w, { x: c.e.x + MAW[0], y: c.e.y + MAW[1], data: c.e.data }, S.bileB, 'bileB');
    },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.003 + Math.sin(c.w.t * 0.02) * 0.02; },
};
