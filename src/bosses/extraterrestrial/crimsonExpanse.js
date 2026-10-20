import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, glowDot, chitin, body } from '../roster/art.js';

// EXTRATERRESTRIAL — CRIMSON EXPANSE (hostile alien energy cruiser)
// A long, blade-shaped warship of dark red crystal grown over a lattice
// spine, with energy sails spread like fins and a prow that focuses a
// lance. It is all firepower: a spinal lance that cuts across the screen,
// plasma blooms that open into petals, sail volleys that rake from the
// sides, and fighter swarms launched from its keel.
// Arenas: the crimson nebula frontier → a red giant's corona → a burning
// colony world → a cruiser graveyard → the energy storm.

const S = {
  bloom: { shape: 'bigorb', color: 'red', n: 1, speed: 2, accel: -0.03, minSpd: 0.3, fixed: true, split: { shape: 'rice', color: 'pink', n: 12, speed: 2.2 }, splitAt: 50 },
  sail: { shape: 'kunai', color: 'red', n: 1, speed: 3.6, angVel: 0, fixed: true },
  petal: { shape: 'rice', color: 'pink', n: 7, spread: 1.2, speed: 2.6 },
  fighter: { shape: 'kunai', color: 'pink', n: 2, spread: 0.2, speed: 3.2 },
  storm: { shape: 'orb', color: 'red', n: 5, speed: 2.1, turn: 0.17 },
  stormB: { shape: 'orb', color: 'pink', n: 5, speed: 2.4, turn: -0.12 },
};

const PROW = [0, 150];
const SAILS = [[-74, -10], [74, -10], [-58, -70], [58, -70]];

function fighter(c, w, side) {
  const e = c.e;
  c.kit.spawnMinion({
    sprite: 'ce_fighter', name: 'CRIMSON LANCER', x: e.x + side * 20, y: e.y + 40, r: 8, hp: 7, score: 400, glow: [1, 0.3, 0.4],
    drops: w.rng.chance(0.3) ? ['M'] : null, data: { side, a: side > 0 ? 0.3 : Math.PI - 0.3 },
    ai(m, c2, w2) {
      const d = m.data;
      // Wide arcing pass that turns toward the player, then exits.
      const target = Math.atan2(w2.aimY - m.y, w2.aimX - m.x);
      if (m.t < 80) { let da = target - d.a; da = Math.atan2(Math.sin(da), Math.cos(da)); d.a += da * 0.04; }
      m.x += Math.cos(d.a) * 2.6; m.y += Math.sin(d.a) * 2.6;
      if (m.t === 50) P.aimed(w2, m.x, m.y, S.fighter);
      m.rot = d.a - Math.PI / 2;
    },
  });
}

const sailPart = (k, off) => ({
  label: 'ENERGY SAIL', sprite: 'ce_sail', ox: SAILS[k][0], oy: SAILS[k][1], r: 13, hp: 85, medals: 3, score: 6500, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (!every(c, t, 14, off) || (t + off) % 140 > 60) return;
    const s = Math.sign(SAILS[k][0]);
    P.shoot(w, pe.x, pe.y, DOWN + s * (0.9 - ((t + off) % 140) * 0.012), S.sail.speed, S.sail);
  },
});

// ------------------------------------------------------------------ art

const CRYS = ['#200408', '#7a1420', '#ff6a6a'];

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // Energy sails: translucent membranes on crystal ribs.
  for (const [x, y] of SAILS) {
    const s = Math.sign(x);
    ctx.beginPath(); ctx.moveTo(s * 20, y - 24); ctx.lineTo(x + s * 44, y - 40); ctx.lineTo(x + s * 50, y + 16); ctx.lineTo(s * 22, y + 28); ctx.closePath();
    const g = ctx.createLinearGradient(s * 20, 0, x + s * 50, 0); g.addColorStop(0, 'rgba(255,60,80,0.55)'); g.addColorStop(1, 'rgba(120,10,30,0.15)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,140,140,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(s * 20, y - 20 + k * 12); ctx.lineTo(x + s * (44 + k * 2), y - 40 + k * 18); ctx.strokeStyle = 'rgba(255,120,120,0.45)'; ctx.stroke(); }
  }
  // Blade hull: crystal facets over a dark lattice spine.
  const hullPts = [0, 160, 12, 120, 26, 40, 30, -60, 22, -120, 10, -150, 0, -156];
  const path = () => mpoly(ctx, hullPts);
  path(); const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#1a0408'); g.addColorStop(0.5, '#5a0c18'); g.addColorStop(1, '#14030a'); ctx.fillStyle = g; ctx.fill();
  ctx.save(); path(); ctx.clip();
  for (let k = 0; k < 26; k++) {
    const y = -150 + k * 12, s = k % 2 ? 1 : -1;
    poly(ctx, [0, y, s * 30, y + 10, s * 24, y + 22, 0, y + 14]);
    const fg = ctx.createLinearGradient(0, y, s * 30, y + 20); fg.addColorStop(0, CRYS[1]); fg.addColorStop(0.5, CRYS[2]); fg.addColorStop(1, CRYS[0]);
    ctx.globalAlpha = 0.55 + (k % 3) * 0.12; ctx.fillStyle = fg; ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,150,150,0.7)'; ctx.lineWidth = 1; path(); ctx.stroke();
  // Energy conduits along the spine.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,80,90,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, 150); ctx.stroke();
  for (const y of [-100, -40, 20, 80]) { const cg = ctx.createRadialGradient(0, y, 0, 0, y, 12); cg.addColorStop(0, 'rgba(255,200,200,0.9)'); cg.addColorStop(1, 'rgba(255,40,60,0)'); ctx.fillStyle = cg; ctx.fillRect(-12, y - 12, 24, 24); }
  ctx.restore();
  // Crystal spines along the back.
  both((s) => { for (let k = 0; k < 4; k++) { const y = -130 + k * 22; poly(ctx, [s * 14, y, s * 40, y - 18, s * 18, y + 8]); ctx.fillStyle = '#9a1a28'; ctx.fill(); ctx.strokeStyle = 'rgba(255,160,160,0.6)'; ctx.stroke(); } });
  // Prow lens.
  circ(ctx, PROW[0], PROW[1] - 18, 9); ctx.fillStyle = '#ffd0d0'; ctx.fill();
  glowDot(ctx, PROW[0], PROW[1] - 18, 10, 'rgba(255,90,100,1)');
  keyLight(ctx, -140, -160, 140, 160, 0.7);
  meta.lights.push({ x: 0, y: PROW[1] - 18, c: '#ff8090', ph: 0 }, { x: 0, y: -40, c: '#ff6070', ph: 0.5 });
  return meta;
}

function sailArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  poly(ctx, [cx, 2, w - 3, cy, cx, h - 2, 3, cy]);
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff8a8a'); g.addColorStop(0.5, '#9a1a28'); g.addColorStop(1, '#2a0408');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,180,180,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 3, 'rgba(255,100,110,1)');
}

function fighterArt(ctx, w, h) {
  const cx = w / 2;
  poly(ctx, [cx, h - 1, cx + w * 0.45, 3, cx, h * 0.3, cx - w * 0.45, 3]);
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff7a7a'); g.addColorStop(1, '#3a0610');
  ctx.fillStyle = g; ctx.fill();
  glowDot(ctx, cx, h * 0.4, 2, 'rgba(255,120,130,1)');
}

export default {
  id: 'crimson_expanse',
  name: 'CRIMSON EXPANSE',
  title: 'HOSTILE ALIEN ENERGY CRUISER',
  archetype: 'extraterrestrial',
  sprite: 'b_crimson', scale: 1, r: 46, glow: [1, 0.3, 0.35], score: 150000,
  deathSequence: 'implode',
  art(add) {
    add('b_crimson', 260, 330, hull('b_crimson', hullArt));
    add('ce_sail', 24, 30, sailArt, 2.5);
    add('ce_fighter', 18, 22, fighterArt, 2.5);
  },
  look: {
    faction: 'outerstar', anim: 'alien',
    weak: { x: 0, y: -40, r: 16, rgb: [1, 0.35, 0.4] },
    pulse: [1.6, 0.35, 0.4],
    rings: [{ r: 130, rgb: [1.4, 0.3, 0.35], spin: 0.006, a: 0.15 }],
    shadow: { dx: 30, dy: 48, a: 0.28 },
    sites: [[-14, 80], [14, -100], [-20, 20], [20, -40], [-60, -10], [60, -70]],
  },
  parts: Object.fromEntries(SAILS.map((_, k) => [`sail${k}`, sailPart(k, k * 35)])),
  desperation: { name: 'CRIMSON TIDE' },

  phases: [
    {
      name: 'LANCE BLOOMS', hp: 740, arena: 'ce_nebula_frontier', transitionFx: 'warp_tunnel',
      move: { type: 'sweep', amp: 110, y: 120, freq: 0.008 }, parts: ['sail0', 'sail1'],
      patterns: ['lance', 'blooms'], musicLayer: 'alien_p1',
    },
    {
      name: 'FIGHTER WINGS', hp: 790, arena: 'ce_red_giant', transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 120, freq: 0.008 },
      patterns: ['fighters', 'petals'], musicLayer: 'alien_p2',
    },
    {
      name: 'PETAL STORM', hp: 830, arena: 'ce_burning_colony', transitionFx: 'flash',
      move: { type: 'figure8', amp: 100, ampY: 25, y: 125, freq: 0.008 }, parts: ['sail2', 'sail3'],
      patterns: ['lance', 'petals', 'blooms'], musicLayer: 'alien_p3',
    },
    {
      name: 'SAIL ARRAY', hp: 870, arena: 'ce_cruiser_graveyard', transitionFx: 'warp_tunnel',
      move: { type: 'sweep', amp: 120, y: 120, freq: 0.009 }, parts: ['sail0', 'sail1', 'sail2', 'sail3'],
      patterns: ['fighters', 'blooms'], musicLayer: 'alien_p4',
    },
    {
      name: 'ENERGY STORM', hp: 950, arena: 'ce_energy_storm', transitionFx: 'flash',
      move: { type: 'hover', amp: 110, y: 125, freq: 0.01 }, intensity: 1.1,
      patterns: ['lance', 'fighters', 'energyStorm', 'petals'], musicLayer: 'alien_p5',
    },
  ],

  attacks: {
    // Spinal lance: the prow charges, then a wide beam sweeps across.
    lance(c, w, t) {
      if (t % 280 !== 30) return;
      const dir = w.aimX < c.e.x ? 1 : -1;
      P.laser(w, c.e, DOWN + dir * 0.55, { warn: 70, fire: 120, width: 18, ox: PROW[0], oy: PROW[1] - 18, angVel: -dir * 0.009, rgb: [1, 0.3, 0.38] });
      w.g.renderer.post.aberrate(0.004);
    },
    blooms(c, w, t) { if (every(c, t, 60, 20)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 26, c.e.y + 60, DOWN + s * 0.45, S.bloom.speed, S.bloom); },
    petals(c, w, t) { if (every(c, t, 36)) P.fan(w, c.e.x, c.e.y + PROW[1] - 18, DOWN + Math.sin(t * 0.04) * 0.5, S.petal); },
    fighters(c, w, t) { if (every(c, t, 110)) { fighter(c, w, -1); fighter(c, w, 1); } },
    energyStorm(c, w, t) {
      if (every(c, t, 7)) P.spiral(w, c.e, S.storm, 'storm');
      if (c.mk >= 2 && every(c, t, 10)) P.spiral(w, c.e, S.stormB, 'stormB');
    },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.0025; },
};
