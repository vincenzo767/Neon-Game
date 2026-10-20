import * as P from '../../patterns/index.js';
import { every, clamp, dens, ghostRing, DOWN, TAU, W, H } from '../util.js';
import { hull, mpoly, poly, circ, both, keyLight, glowDot } from '../roster/art.js';

// EXTRATERRESTRIAL — NULL CITADEL (ancient alien megastructure)
// Not a ship: a fortress older than the stars around it. An octagonal
// keep of black basalt-like material cut with seams of pale light, four
// obelisks at the corners and a ring of floating stones that turn around
// it. It does not chase — it rearranges space: columns of null light
// close off the screen, rune seals expand outward, fading wards surface
// and vanish, and a null field pushes bullets away from its heart.
// Arenas: the megastructure approach → a trench across its hull → the
// monolith plain of a dead moon → a Dyson lattice → the null core.

const S = {
  rune: { shape: 'orb', color: 'white', n: 1, speed: 1.5 },
  ward: { shape: 'orb', color: 'violet', n: 22, speed: 1.3 },
  wardB: { shape: 'rice', color: 'white', n: 16, speed: 1.8 },
  shard: { shape: 'kunai', color: 'violet', n: 4, spread: 0.3, speed: 3 },
  square: { shape: 'orb', color: 'white', n: 4, speed: 2.2, turn: 0.12 },
  pillar: { shape: 'rice', color: 'violet', n: 1, speed: 2.8, fixed: true },
};

const OBELISKS = [[-92, -92], [92, -92], [-92, 92], [92, 92]];

const obelisk = (k, off) => ({
  label: 'OBELISK', sprite: 'nc_obelisk', ox: OBELISKS[k][0], oy: OBELISKS[k][1], r: 13, hp: 90, medals: 3, score: 7000, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (t % 200 !== (off % 200)) return;
    P.laser(w, pe, w.aimAngle(pe.x, pe.y), { warn: 50, fire: 26, width: 6, ox: 0, oy: 0, rgb: [0.75, 0.6, 1] });
  },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // Floating stones on an orbit around the keep.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU, r = 118, x = Math.cos(a) * r, y = Math.sin(a) * r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    poly(ctx, [-7, -4, 6, -5, 8, 3, -5, 5]); const g = ctx.createLinearGradient(-7, -5, 8, 5); g.addColorStop(0, '#2a2834'); g.addColorStop(1, '#0a0a10'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,255,0.35)'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore();
  }
  // Octagonal keep: stepped tiers of dark stone with light seams.
  for (let tier = 0; tier < 4; tier++) {
    const R = 96 - tier * 20;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    ctx.closePath();
    const g = ctx.createLinearGradient(-R, -R, R, R);
    g.addColorStop(0, ['#3a3646', '#302c3c', '#28243a', '#221e32'][tier]); g.addColorStop(1, '#08070c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(210,200,255,${0.25 + tier * 0.12})`; ctx.lineWidth = 1.2; ctx.stroke();
    // Carved channels along each face.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8, a2 = a + TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6)); ctx.lineTo(Math.cos(a2) * (R - 6), Math.sin(a2) * (R - 6)); ctx.stroke(); }
  }
  // Seams of pale light radiating from the heart.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.strokeStyle = 'rgba(170,150,255,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); ctx.stroke(); }
  ctx.restore();
  // Glyph inlays on the outer tier.
  ctx.fillStyle = 'rgba(200,190,255,0.5)';
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, r = 84; ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a); ctx.fillRect(-2, -0.6, 4, 1.2); ctx.fillRect(-0.6, -2, 1.2, 4); ctx.restore(); }
  // Obelisk bases at the corners.
  for (const [x, y] of OBELISKS) { ctx.beginPath(); ctx.rect(x - 14, y - 14, 28, 28); ctx.fillStyle = '#16141e'; ctx.fill(); ctx.strokeStyle = 'rgba(200,190,255,0.4)'; ctx.stroke(); }
  // The heart: a void with a pale corona.
  circ(ctx, 0, 0, 16); ctx.fillStyle = '#000000'; ctx.fill();
  const hg = ctx.createRadialGradient(0, 0, 14, 0, 0, 26); hg.addColorStop(0, 'rgba(200,180,255,0.9)'); hg.addColorStop(1, 'rgba(120,90,255,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; circ(ctx, 0, 0, 26); ctx.fillStyle = hg; ctx.fill(); ctx.restore();
  keyLight(ctx, -130, -130, 130, 130, 0.6);
  for (const [x, y] of OBELISKS) meta.lights.push({ x, y, c: '#c8b8ff', ph: (x + y) * 0.004 });
  return meta;
}

function obeliskArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  poly(ctx, [cx, 1, w - 3, cy, cx, h - 1, 3, cy]);
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#4a4458'); g.addColorStop(1, '#0a0810');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(210,200,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 3, 'rgba(200,180,255,1)');
}

export default {
  id: 'null_citadel',
  name: 'NULL CITADEL',
  title: 'ANCIENT ALIEN MEGASTRUCTURE',
  archetype: 'extraterrestrial',
  sprite: 'b_nullcitadel', scale: 1, r: 60, glow: [0.75, 0.6, 1], score: 150000,
  deathSequence: 'implode',
  art(add) {
    add('b_nullcitadel', 264, 264, hull('b_nullcitadel', hullArt));
    add('nc_obelisk', 24, 34, obeliskArt, 2.5);
  },
  look: {
    faction: 'outerstar', anim: 'alien',
    weak: { x: 0, y: 0, r: 18, rgb: [0.75, 0.6, 1] },
    pulse: [0.9, 0.7, 1.6],
    rings: [{ r: 150, rgb: [0.7, 0.55, 1.4], spin: 0.003, a: 0.2 }, { r: 110, rgb: [1, 0.9, 1.4], spin: -0.005, a: 0.16 }],
    shadow: { dx: 26, dy: 40, a: 0.3 },
    sites: [[-60, -30], [60, 30], [-30, 60], [30, -60], [-80, 20], [80, -20]],
  },
  parts: Object.fromEntries(OBELISKS.map((_, k) => [`obelisk${k}`, obelisk(k, k * 50)])),
  desperation: { name: 'NULL SINGULARITY' },

  phases: [
    {
      name: 'WARD GLYPHS', hp: 760, arena: 'nc_approach', transitionFx: 'flash',
      move: { type: 'hover', amp: 50, y: 150, freq: 0.004 }, parts: ['obelisk0', 'obelisk1'],
      patterns: ['wards', 'runes'], musicLayer: 'alien_p1',
    },
    {
      name: 'NULL PILLARS', hp: 810, arena: 'nc_hull_trench', transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 60, y: 150, freq: 0.005 },
      patterns: ['nullPillars', 'squares'], musicLayer: 'alien_p2',
    },
    {
      name: 'NULL FIELD', hp: 850, arena: 'nc_monolith_plain', transitionFx: 'flash',
      move: { type: 'center', y: 150 }, parts: ['obelisk0', 'obelisk1', 'obelisk2', 'obelisk3'],
      patterns: ['wards', 'nullField'], musicLayer: 'alien_p3',
    },
    {
      name: 'RUNE LATTICE', hp: 890, arena: 'nc_dyson_lattice', transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 70, y: 150, freq: 0.005 },
      patterns: ['runes', 'nullPillars', 'squares'], musicLayer: 'alien_p4',
    },
    {
      name: 'THE NULL CORE', hp: 970, arena: 'nc_null_core', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 80, y: 150, freq: 0.006 }, intensity: 1.1,
      patterns: ['wards', 'nullPillars', 'runes', 'nullField'], musicLayer: 'alien_p5',
    },
  ],

  attacks: {
    // Wards: fading rings surface around the keep and vanish again.
    wards(c, w, t) {
      if (every(c, t, 70)) ghostRing(c, w, c.e.x, c.e.y, S.ward, t * 0.03);
      if (c.mk >= 2 && every(c, t, 70, 35)) P.ring(w, c.e.x, c.e.y, S.wardB, -t * 0.03);
    },
    // Runes: bullets laid out as a carved rune that expands outward.
    runes(c, w, t) {
      if (every(c, t, 120, 40)) c.kit.glyph(c.e.x, c.e.y + 20, (t / 120 | 0) % 2 ? 'rune' : 'trident', S.rune, dens(w, 28), w.rng.range(-0.4, 0.4), c.mk >= 3);
    },
    // Null pillars: columns of null light close off the screen, leaving gaps.
    nullPillars(c, w, t) {
      if (!every(c, t, 200, 20)) return;
      const cols = 6, gap = w.rng.int(0, cols - 1), gap2 = c.mk >= 3 ? -1 : (gap + 3) % cols;
      for (let k = 0; k < cols; k++) {
        if (k === gap || k === gap2) continue;
        const x = (k + 0.5) * (W / cols);
        c.kit.hazard({ type: 'lane', x, w: W / cols - 16, warn: 70, fire: 30, color: [0.7, 0.55, 1], y0: c.e.y + 60 });
      }
    },
    // Squares: four-arm rotating streams (geometric, not organic).
    squares(c, w, t) { if (every(c, t, 6)) P.spiral(w, c.e, S.square, 'sq'); },
    // Null field: a repulsor pushes bullets away from the heart, spreading
    // them into sweeping arcs, while the obelisks throw shards.
    nullField(c, w, t) {
      if (t % 300 === 0) c.kit.well({ x: c.e.x, y: c.e.y + 100, r: 220, strength: -0.025, life: 200, follow: true, fx: 0, fy: 100 });
      if (every(c, t, 30)) for (const [ox, oy] of OBELISKS) P.fan(w, c.e.x + ox, c.e.y + oy, w.aimAngle(c.e.x + ox, c.e.y + oy), S.shard);
    },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.004) * 0.06; },
};
