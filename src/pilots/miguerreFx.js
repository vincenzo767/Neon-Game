import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { miguerreArt, PAL, DARK, RIG_FX } from './miguerreArt.js';
import { rigState, SWING } from './miguerreRig.js';
import { H } from './common.js';

// Miguerre's void-cosmic effects, drawn after fx-reference.png, void-beams.png,
// ultimate-fx.png and the owner's picks (tools/art-ref/miguerre/), all built live
// (no cut-out images): straight void beams (white-hot core, red body, black
// sheath), red star flares, black shard bursts with red rings, dark-red smoke
// ghosts, a crescent of starry black space with a red rim, and the cosmic Void
// Cannon. Black parts are alpha-blended (add = 0) under the additive red.
// Render-time only: damage lives in miguerre.js.
//
// v2 (ASSET_NOTES.md "Rebuild v2"): the beams leave both horns and grow from
// thin to full as they reach the target; the horns charge and flare, the blade
// charges and leaves a black-red arc trail through the swing (RIG_FX.overlay);
// the ghosts and clones are the rigged mecha in smoke (their wings beat out of
// step); wing gusts and void feathers replace the thrusters; feared enemies
// tremble in a dread aura; Chaos Clones rise out of a smoke vortex.

const LOOK = miguerreArt.LOOK;
const fxOf = () => miguerreArt.frames().fx;
export const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

function shardTex(ctx, w, h) {
  // Jagged black-glass shard.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55); ctx.lineTo(w * 0.35, 0); ctx.lineTo(w, h * 0.4); ctx.lineTo(w * 0.6, h); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
}

/** Atlas textures (part of miguerre.js `sprites`). */
export function miguerreFxSprites(atlas) {
  atlas.add('mz_shard', 12, 10, shardTex, { scale: 3 });
  crescentSprites(atlas);
  cannonSprites(atlas);
}

const star = (b, x, y, s, a, rot = 0, c = PAL.core) => {
  const fx = fxOf();
  if (fx) b.draw(fx.flare, x, y, s, s, rot, c[0], c[1], c[2], a, 1);
};

// ------------------------------------------------------------ the void beam

/**
 * One straight void beam (x0, y0) → (x1, y1), like an eye beam: a wide red
 * haze, a black void sheath, the red body and a white-hot core.
 */
export function beamSeg(p, b, x0, y0, x1, y1, wd, a, glowA = 1) {
  const F = p.F;
  const len = Math.hypot(x1 - x0, y1 - y0) + 4, ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, len, wd * 4.2, ang, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.5 * a * glowA, 1);
  b.draw(F.laser, mx, my, len, wd * 2.2, ang, DARK[0], DARK[1], DARK[2], 0.6 * a, 0);
  b.draw(F.laser, mx, my, len, wd * 1.3, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
  b.draw(F.laser, mx, my, len, wd * 0.5, ang, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
}

export const CHAIN_FADE = 9; // steps a finished chain hop stays lit

/**
 * Every live beam: the instant shots from the body, the ghost and its clones;
 * the chains racing from enemy to enemy (a blazing head with a speed streak,
 * the hops behind it fading); the interception beams.
 */
export function renderBeams(p, b) {
  const F = p.F, ps = p.ps, t = p.t, wm = LOOK.widthMul, glowA = LOOK.glowMul * crowdFactor(p.w);
  for (const s of ps.bolts) {
    const a = 1 - s.t / s.life, pulse = 0.9 + 0.1 * Math.sin(t * 1.3 + s.s), grow = Math.min(1, (s.t + 1) / 2);
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx0, by0] = s.pts[k];
      const bx = ax + (bx0 - ax) * grow, by = ay + (by0 - ay) * grow; // v2: thin to full as it reaches the target
      beamSeg(p, b, ax, ay, bx, by, s.w * wm * pulse * (0.45 + 0.55 * grow), a, glowA);
      b.draw(F.glow, bx, by, s.w * 4, s.w * 4, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * a, 1);
      star(b, bx, by, s.w * 4, a, t * 0.1 + k);
    }
    if (s.pts.length) {
      const [x, y] = s.pts[0];
      b.draw(F.glow, x, y, s.w * 3, s.w * 3, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * a, 1);
      star(b, x, y, s.w * 3.6, a, t * 0.13);
    }
  }
  for (const c of ps.chains) {
    const W0 = c.w * wm * 0.8;
    for (const g of c.segs) {
      const a = 1 - (t - g.t) / CHAIN_FADE;
      if (a > 0) beamSeg(p, b, g.x0, g.y0, g.x1, g.y1, W0 * (0.5 + 0.5 * a), a, glowA);
    }
    if (!c.e) continue;
    // The racing head: live hop, a white speed streak behind it, a blazing star.
    beamSeg(p, b, c.lx, c.ly, c.x, c.y, W0, 1, glowA);
    const dx = c.x - c.lx, dy = c.y - c.ly, L = Math.hypot(dx, dy);
    if (L > 1) {
      const sl = Math.min(L, 70), ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
      b.draw(F.laser, c.x - ux * sl / 2, c.y - uy * sl / 2, sl, W0 * 3, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8, 1);
      b.draw(F.laser, c.x - ux * sl / 2, c.y - uy * sl / 2, sl, W0 * 1.2, ang, PAL.core[0], PAL.core[1], PAL.core[2], 1, 1);
    }
    b.draw(F.glow, c.x, c.y, 36, 36, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8, 1);
    star(b, c.x, c.y, 30, 1, t * 0.3 + c.s);
  }
  // Interception beams: thin straight beams that snap to enemy attacks and erase them.
  for (const c of ps.arcs) {
    const a = 1 - c.t / c.life;
    beamSeg(p, b, c.x0, c.y0, c.x1, c.y1, 3.5 * wm, a, glowA);
    star(b, c.x1, c.y1, 14, a, c.t);
  }
}

// ------------------------------------------------------------ impacts

/** Small impact (World hitSpark hook): red flash, white core, black shards, ring, a star. */
export function hitSpark(w, x, y, angle) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard');
  let i = Hp.spawn(F.glow, x, y, 0, 0, 5);
  if (i >= 0) { Hp.size(i, 32, 16); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  i = Hp.spawn(F.ring, x, y, 0, 0, 9);
  if (i >= 0) { Hp.size(i, 6, 30); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.75, 1, FADE_OUT); }
  for (let k = 0; k < 3; k++) {
    const a = angle + R.range(-1.2, 1.2), sp = R.range(2, 5);
    i = Hp.spawn(sh, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(10, 16));
    if (i < 0) return;
    Hp.size(i, R.range(4, 7)); Hp.spin(i, a, R.range(-0.3, 0.3)); Hp.phys(i, 0.9, 0.05);
    Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.95, 0, FADE_OUT);
  }
  for (let k = 0; k < 3; k++) {
    const a = angle + R.range(-0.9, 0.9), sp = R.range(3, 7);
    i = Hp.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 12));
    if (i < 0) return;
    Hp.size(i, 5); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]);
    Hp.phys(i, 0.86); Hp.look(i, 1, 1, FADE_OUT, 0.5);
  }
}

/**
 * Void explosion (one-hit kills, Chaos Clone arrivals, crescent, cannon): black smoke and
 * black shards, a red fireball with a white core, red rings, star flares and
 * tiny white cosmic dots. `s` scales it (1 ≈ a normal enemy).
 */
export function burst(w, x, y, s = 1) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard'), fx = fxOf();
  for (let k = 0; k < 4 * s; k++) {
    const a = R.range(0, Math.PI * 2), sp = R.range(0.4, 1.4) * s;
    const i = Hp.spawn(F.glow, x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, Math.cos(a) * sp, Math.sin(a) * sp - 0.15, R.range(20, 32));
    if (i < 0) break;
    Hp.size(i, 18 * s, 38 * s); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.phys(i, 0.94); Hp.look(i, 0.6, 0, FADE_INOUT);
  }
  for (let k = 0; k < 7 * s; k++) {
    const a = R.range(0, Math.PI * 2), sp = R.range(2.5, 6.5) * s;
    const i = Hp.spawn(sh, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(16, 26));
    if (i < 0) break;
    Hp.size(i, R.range(5, 10) * Math.sqrt(s)); Hp.spin(i, a, R.range(-0.25, 0.25)); Hp.phys(i, 0.9, 0.08);
    Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.95, 0, FADE_OUT);
  }
  let i = Hp.spawn(F.glow, x, y, 0, 0, 14);
  if (i >= 0) { Hp.size(i, 40 * s, 74 * s); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.85, 1, FADE_OUT); }
  i = Hp.spawn(F.glow, x, y, 0, 0, 7);
  if (i >= 0) { Hp.size(i, 26 * s, 12 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
  for (const [r1, life] of [[70, 14], [110, 20]]) {
    i = Hp.spawn(F.ring, x, y, 0, 0, life);
    if (i >= 0) { Hp.size(i, 10 * s, r1 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.75, 1, FADE_OUT); }
  }
  if (fx) {
    i = Hp.spawn(fx.flare, x, y, 0, 0, 12);
    if (i >= 0) { Hp.size(i, 50 * s, 10); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
    for (let k = 0; k < 5 * s; k++) { // cosmic dust
      const a = R.range(0, Math.PI * 2), d = R.range(10, 40) * s;
      const j = Hp.spawn(F.core, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * 0.6, Math.sin(a) * 0.6, R.range(14, 26));
      if (j < 0) break;
      Hp.size(j, R.range(2, 3.5)); Hp.color(j, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(j, 1, 1, FADE_OUT);
    }
  }
}

// ------------------------------------------------------------ ghosts

/**
 * Real smoke for a ghost at (x, y), emitted every step: dark-red puffs that
 * billow out of the body and trail behind, plus faint red wisps.
 */
export function ghostSmoke(w, x, y, n = 2, thick = false) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, m = thick ? 1.5 : 1;
  for (let k = 0; k < n; k++) {
    const i = Hp.spawn(F.glow, x + R.range(-20, 20) * m, y + R.range(-26, 34) * m, R.range(-0.5, 0.5), R.range(0.5, 1.6), R.range(24, 40) * (thick ? 1.15 : 1));
    if (i < 0) return;
    Hp.size(i, R.range(10, 16) * m, R.range(34, 52) * m);
    // Chaos Clones: thicker, darker smoke (every other puff near black).
    if (thick && k % 2) Hp.color(i, 0.12, 0.0, 0.02, 0.02, 0.0, 0.0);
    else Hp.color(i, 0.6, 0.04, 0.08, 0.1, 0.0, 0.02);
    Hp.phys(i, 0.96); Hp.spin(i, 0, R.range(-0.05, 0.05)); Hp.look(i, thick ? 0.72 : 0.55, 0, FADE_INOUT);
  }
  for (let k = 0; k < n; k++) {
    const i = Hp.spawn(F.glow, x + R.range(-18, 18), y + R.range(-24, 30), R.range(-0.4, 0.4), R.range(0.3, 1.2), R.range(18, 30));
    if (i >= 0) { Hp.size(i, 8, 30); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.phys(i, 0.96); Hp.look(i, 0.4, 1, FADE_INOUT); }
  }
}

/**
 * A ghost's own view of the rig: its wings beat out of step with his (by
 * seed); `still` ghosts (the Chaos Clones) don't swing, charge or bank.
 */
function ghostOf(p, seed, still) {
  const q = Object.create(p), r = rigState(p);
  q.ps = Object.create(p.ps);
  q.ps.mr = { ...r, ph: (r.ph + seed * 0.37) % 1, ...(still ? { swingT: -1, charge: 0, clench: 0, claw: 0, spread: 0 } : null) };
  if (still || seed) q.bank = 0;
  return q;
}

/**
 * A dark-red smoke ghost of the mecha at (x, y): the rigged mecha (wings
 * beating, sword swinging) tinted void red, see-through and hazy at the edges,
 * with a red core light. The smoke itself is particles (ghostSmoke).
 */
export function renderGhost(p, b, x, y, alpha, seed = 0, still = false) {
  const F = p.F, t = p.t;
  b.draw(F.glow, x, y + 8, 80, 96, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.45 * alpha, 1);
  b.draw(F.glow, x, y + 10, 70, 90, 0, 0.1, 0, 0.02, 0.35 * alpha, 0);
  const q = ghostOf(p, seed, still), flick = 0.85 + 0.15 * Math.sin(t * 0.3 + seed * 3);
  // Hazy smoke edge: drifting copies (one for the many Chaos Clones).
  for (let j = 0; j < (still ? 1 : 2); j++) {
    const ox = Math.sin(t * 0.09 + seed + j * 2) * 2.5, oy = Math.cos(t * 0.07 + seed * 2 + j) * 2.5;
    if (!miguerreArt.renderMecha(q, b, x + ox, y + oy, 0.22 * alpha, { tint: [PAL.mid[0] * 0.4, 0, 0.02], add: 1 })) return;
  }
  miguerreArt.renderMecha(q, b, x, y, 0.5 * alpha * flick, { tint: [0.6, 0.05, 0.08], add: 0 });
  miguerreArt.renderMecha(q, b, x, y, 0.3 * alpha, { tint: [PAL.mid[0] * 0.5, 0, 0.02], add: 1 });
  star(b, x, y, 18, 0.8 * alpha * flick, t * 0.08 + seed);
}

// ------------------------------------------------------------ special, bomb, ultimate

// The Void Crescent's shape, shared by the textures, the render and the hits
// (also reused by Tess's Void Cross ultimate, tessUltFx.js: her lover's crescent motion)
// (after the owner's void-crescent.png, a Getsuga-style slash): a thick
// inverted-U arch of radius R, convex side forward, whose blade tips sweep
// well down past the horizontal; the band is thick at the crown and tapers to
// sharp points.
export const CR_E = 0.55;  // the tips sweep this far (rad) below the horizontal
export const CR_D = 0.46;  // crown thickness / R
export const CR_R = 150, CR_M = 26; // texture radius (logical px) and margin (room for the ragged edge)
export const CR_TW = CR_R * 2 + CR_M * 2, CR_TH = Math.ceil(CR_R * (1 + Math.sin(CR_E)) + CR_M * 2);
export const crA = (u) => -Math.PI - CR_E + (Math.PI + 2 * CR_E) * u;
export const crTh = (u, R) => R * CR_D * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.85);
export const CR_CY = 0.35; // the arch's circle centre sits this far (× R) behind the crescent's position

/**
 * The Void Crescent's shape in the world: points along its arc with the outer
 * rim (ox, oy), the outward normal, the band thickness and the band middle
 * (mx, my), plus the circle centre (cx, cy) and radius R. miguerre.js uses the
 * same points for its hits.
 */
export function crescentPts(c, n = 32) {
  const R = c.w * 0.5, cx = c.x, cy = c.y + R * CR_CY, out = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n, a = crA(u), nx = Math.cos(a), ny = Math.sin(a);
    const th = crTh(u, R), ox = cx + nx * R, oy = cy + ny * R;
    out.push({ u, ox, oy, nx, ny, th, mx: ox - nx * th / 2, my: oy - ny * th / 2, cx, cy, R });
  }
  return out;
}

/** Point in the band in texture space: u along the arc (0..1), v across it (0 = outer rim, 1 = inner edge; may go past). */
export function crescentAt(u, v) {
  const a = crA(u), r = CR_R - crTh(u, CR_R) * v;
  return [CR_M + CR_R + Math.cos(a) * r, CR_M + CR_R + Math.sin(a) * r];
}

/**
 * One tapered brush stroke along the arch, from u0 to u1 at depth v (texture
 * space): thickest in the middle, pointed at both ends, wavering a little.
 */
export function brush(ctx, u0, u1, v, wd, seed) {
  const n = 18, side = [];
  ctx.beginPath();
  for (let j = 0; j <= n; j++) {
    const f = j / n, u = u0 + (u1 - u0) * f, a = crA(u), hw = wd * Math.sin(Math.PI * f) / 2;
    const vv = v + (hash(seed + j * 0.7) - 0.5) * 0.06, r = CR_R - crTh(u, CR_R) * vv;
    const x = CR_M + CR_R + Math.cos(a) * r, y = CR_M + CR_R + Math.sin(a) * r;
    ctx.lineTo(x + Math.cos(a) * hw, y + Math.sin(a) * hw);
    side.push([x - Math.cos(a) * hw, y - Math.sin(a) * hw]);
  }
  for (let j = side.length - 1; j >= 0; j--) ctx.lineTo(side[j][0], side[j][1]);
  ctx.closePath(); ctx.fill();
}

/** A spray of specks off the edge at depth v, flung outward (dir +1) or inward (−1). */
export function spatter(ctx, n, v, dir, reach, color, seed) {
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const u = 0.03 + 0.94 * hash(seed + k * 1.31), a = crA(u), d = reach * hash(seed + k * 2.77) ** 1.6;
    const [x, y] = crescentAt(u, v);
    const r = 0.4 + 2.2 * hash(seed + k * 3.9) ** 2 * (1 - d / (reach + 1) * 0.6);
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d * dir, y + Math.sin(a) * d * dir, r, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Body (alpha-blended): aggressive ink-brush strokes. A black void base, black
 * strokes ragging the silhouette, dark-red and blood-red plasma currents
 * flowing along the arc, white-hot highlights near the leading edge, ink and
 * red spatter, a few stars in the black.
 */
function crescentBodyTex(ctx) {
  ctx.fillStyle = '#040001';
  for (let k = 0; k < 70; k++) { // black base and ragged silhouette
    const u0 = hash(k * 1.9) * 0.75, span = 0.15 + 0.35 * hash(k * 2.3), v = -0.05 + 1.1 * hash(k * 4.7);
    brush(ctx, u0, Math.min(1, u0 + span), v, 10 + 26 * hash(k * 3.1), k * 11);
  }
  brush(ctx, 0, 1, 0.5, CR_R * CR_D * 0.95, 7); // solid core of the band
  const pass = (n, seed, vMin, vMax, wMin, wMax, colors) => {
    for (let k = 0; k < n; k++) {
      const h = seed + k * 5.13, u0 = hash(h) * 0.85, span = 0.06 + 0.3 * hash(h + 1.7);
      ctx.fillStyle = colors[k % colors.length];
      brush(ctx, u0, Math.min(1, u0 + span), vMin + (vMax - vMin) * hash(h + 3.3), wMin + (wMax - wMin) * hash(h + 4.4), h);
    }
  };
  pass(22, 100, 0.1, 1.0, 1.2, 5, ['rgba(90,0,14,0.8)', 'rgba(50,0,8,0.9)']);           // dark-red currents
  pass(24, 200, 0.0, 0.55, 0.6, 2.6, ['rgba(235,12,36,0.9)', 'rgba(255,40,60,0.85)', 'rgba(190,0,24,0.9)']); // blood-red plasma
  pass(14, 260, 0.75, 1.05, 1, 4, ['rgba(220,10,30,0.85)']);                                  // red along the inner edge
  pass(18, 300, -0.04, 0.16, 0.5, 2, ['rgba(255,225,230,0.95)', 'rgba(255,160,170,0.9)']); // white-hot near the leading edge
  pass(6, 400, 0.3, 0.8, 0.5, 1.2, ['rgba(255,200,210,0.75)']);                              // white streaks inside
  // Ink and red spatter off both edges.
  spatter(ctx, 120, 0, 1, CR_M - 4, '#050002', 11);
  spatter(ctx, 60, 0, 1, CR_M - 6, 'rgba(230,20,40,0.9)', 23);
  spatter(ctx, 30, 0, 1, 10, 'rgba(255,215,220,0.95)', 37);
  spatter(ctx, 70, 1, -1, 22, '#050002', 41);
  spatter(ctx, 30, 1, -1, 16, 'rgba(220,15,35,0.85)', 53);
  // A few stars in the black.
  for (let k = 0; k < 40; k++) {
    const [x, y] = crescentAt(0.05 + 0.9 * hash(k * 1.37), 0.25 + 0.6 * hash(k * 4.91));
    ctx.fillStyle = `rgba(255,230,235,${0.5 + 0.5 * hash(k * 7)})`;
    ctx.beginPath(); ctx.arc(x, y, 0.4 + 0.7 * hash(k * 2.2), 0, Math.PI * 2); ctx.fill();
  }
}

/** Rim (additive, white; tinted when drawn): the blazing leading edge, its brushy fringe and spray. */
function crescentRimTex(ctx) {
  ctx.save();
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  brush(ctx, 0, 1, 0.02, 5, 3);
  for (let k = 0; k < 16; k++) { // brushy fringe strokes along the edge
    const u0 = hash(k * 3.7) * 0.85, span = 0.05 + 0.18 * hash(k * 1.3);
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * hash(k * 2.9)})`;
    brush(ctx, u0, Math.min(1, u0 + span), -0.06 + 0.2 * hash(k * 6.1), 1 + 3 * hash(k * 8.3), k * 9);
  }
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#fff';
  brush(ctx, 0.01, 0.99, 0.0, 2.2, 5);
  spatter(ctx, 50, 0, 1, CR_M - 6, 'rgba(255,255,255,0.8)', 71);
  ctx.restore();
}

/** A small black void orb with a red rim light (alpha-blended). */
function orbTex(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 1;
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
  g.addColorStop(0, '#1a0206'); g.addColorStop(0.6, '#030001'); g.addColorStop(0.86, '#4a0010'); g.addColorStop(0.95, '#ff2a40'); g.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

/** Atlas textures for the crescent (part of miguerreFxSprites). */
function crescentSprites(atlas) {
  atlas.add('mz_cres_body', CR_TW, CR_TH, crescentBodyTex, { scale: 1.5 });
  atlas.add('mz_cres_rim', CR_TW, CR_TH, crescentRimTex, { scale: 1 });
  atlas.add('mz_orb', 16, 16, orbTex, { scale: 3 });
}

/**
 * The smoke and debris around a crescent (called each step): ink-black and
 * charcoal smoke (some crimson) torn off the leading edge, peeling off the
 * blade tips and boiling in the hollow, swirling and stretching back along
 * the path (it lags behind the crescent); white-hot vapour, sparks flung
 * outward, black ink shards and embers.
 */
export function crescentSmoke(w, c) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard'), P = crescentPts(c, 20);
  const drift = -1.4; // the crescent moves 3.2 a step: the smoke stretches back behind it
  // Ink black, charcoal grey and crimson (black alone vanishes on a dark stage).
  const INK = [[0.03, 0, 0.01, 0, 0, 0, 0.82], [0.3, 0.27, 0.29, 0.06, 0.04, 0.05, 0.6], [0.8, 0.04, 0.09, 0.2, 0, 0.03, 0.62]];
  const kind = () => { const r = R.next(); return r < 0.5 ? 0 : r < 0.85 ? 1 : 2; };
  const puff = (x, y, nx, ny, kd, big = 1) => {
    const sw = R.range(-1, 1) * 1.4, out = R.range(0.2, 1.0); // swirl along the arc, push outwards
    const i = Hp.spawn(F.glow, x, y, nx * out - ny * sw, ny * out + nx * sw + drift, R.range(30, 52));
    if (i < 0) return;
    Hp.size(i, R.range(14, 24) * big, R.range(56, 104) * big); Hp.phys(i, 0.95); Hp.spin(i, R.range(0, 6), R.range(-0.1, 0.1));
    const col = INK[kd];
    Hp.color(i, col[0], col[1], col[2], col[3], col[4], col[5]); Hp.look(i, col[6], 0, FADE_INOUT);
  };
  for (let k = 0; k < 7; k++) { // torn off the leading edge
    const q = P[R.int(1, P.length - 2)], o = R.range(-4, 26);
    puff(q.ox + q.nx * o, q.oy + q.ny * o, q.nx, q.ny, kind());
  }
  for (let k = 0; k < 3; k++) { // peeling off the blade tips
    const q = P[R.chance(0.5) ? R.int(0, 2) : P.length - 1 - R.int(0, 2)];
    puff(q.ox + R.range(-8, 8), q.oy + R.range(-8, 8), q.nx * 0.6, q.ny * 0.6 + 0.6, kind(), 1.15);
  }
  for (let k = 0; k < 2; k++) { // boiling in the hollow behind the crown
    const q = P[R.int(5, P.length - 6)], d = q.th + R.range(10, q.R * 0.45);
    puff(q.ox - q.nx * d, q.oy - q.ny * d, -q.nx * 0.3, 0.5, kind());
  }
  if (R.next() < 0.6) { // white-hot vapour off the edge (additive)
    const q = P[R.int(2, P.length - 3)];
    const i = Hp.spawn(F.glow, q.ox, q.oy, q.nx * 0.8, q.ny * 0.8 + drift, R.range(14, 22));
    if (i >= 0) { Hp.size(i, 8, 30); Hp.color(i, 1.6, 0.9, 0.95, PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.phys(i, 0.94); Hp.look(i, 0.3, 1, FADE_INOUT); }
  }
  if (R.next() < 0.5) { // an energy node flares on the arc and throws sparks
    const q = P[R.int(2, P.length - 3)];
    for (let k = 0; k < 4; k++) {
      const a = Math.atan2(q.ny, q.nx) + R.range(-1, 1), sp = R.range(3, 7);
      const i = Hp.spawn(F.spark, q.ox, q.oy, Math.cos(a) * sp, Math.sin(a) * sp + drift, R.range(8, 14));
      if (i < 0) break;
      Hp.size(i, 6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.phys(i, 0.88); Hp.look(i, 1, 1, FADE_OUT, 0.5);
    }
  }
  if (R.next() < 0.8) { // black ink shards flung off
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(sh, q.ox, q.oy, q.nx * R.range(0.8, 2.6), q.ny * R.range(0.8, 2.6) + drift, R.range(18, 30));
    if (i >= 0) { Hp.size(i, R.range(3, 8)); Hp.spin(i, R.range(0, 6), R.range(-0.3, 0.3)); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT); }
  }
  if (R.next() < 0.7) { // red embers
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(F.core, q.ox, q.oy, q.nx * 1.2, q.ny * 1.2 + drift, R.range(14, 24));
    if (i >= 0) { Hp.size(i, R.range(2, 3.5)); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
  }
}

/** Red chaos crackling (re-rolled every few steps): short jagged red arcs starting at pts(u, v). */
function chaosCracks(p, b, pts, seed, n, a, wdMul = 1) {
  const F = p.F;
  for (let k = 0; k < n; k++) {
    const h0 = seed * 13.7 + k * 5.3;
    let [x, y] = pts(hash(h0), hash(h0 + 1.1));
    const ang0 = hash(h0 + 2.2) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const ang = ang0 + (hash(h0 + j * 3.1) - 0.5) * 1.8, L = 8 + 12 * hash(h0 + j * 4.7);
      const x1 = x + Math.cos(ang) * L, y1 = y + Math.sin(ang) * L;
      b.draw(F.laser, (x + x1) / 2, (y + y1) / 2, L + 1, 4 * wdMul, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.75 * a, 1);
      b.draw(F.laser, (x + x1) / 2, (y + y1) / 2, L + 1, 1.3 * wdMul, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.55 * a, 1);
      x = x1; y = y1;
    }
  }
}

/** A glowing polyline (red body, white core), additive. */
function streak(p, b, pts, wd, a, core = 0.35) {
  const F = p.F;
  for (let j = 1; j < pts.length; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], L = Math.hypot(x1 - x0, y1 - y0) + 1.5, ang = Math.atan2(y1 - y0, x1 - x0);
    b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd * 2.6, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * a, 1);
    b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
    if (core) b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd * core, ang, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  }
}

/**
 * One Void Crescent, a Getsuga-style slash after the owner's reference: the
 * brush-stroke black-red-white arch with a blazing leading edge; plasma
 * currents racing along the arc out to the blade tips; lightning filaments
 * following its curve; a smeared motion-blur wake, speed streaks and a dark
 * wake behind it; energy nodes flaring on the arc; an overcharged core with
 * rings, spikes and red lightning; black void orbs drifting around it.
 * The smoke and sparks are particles (crescentSmoke).
 */
function renderOneCrescent(p, b, c) {
  const F = p.F, t = p.t + c.x * 0.37, Rw = c.w * 0.5, k = Rw / CR_R;
  const a = Math.min(1, c.t / 10) * (c.t > c.life - 30 ? Math.max(0, (c.life - c.t) / 30) : 1);
  const body = p.ps.fCresBody, rim = p.ps.fCresRim, orb = p.ps.fOrb;
  const cx = c.x, cy = c.y + Rw * CR_CY;
  const tx = cx, ty = cy + (CR_TH / 2 - (CR_M + CR_R)) * k, tw = CR_TW * k, th = CR_TH * k;
  /** World point in the band: u along the arc, v across it (0 = leading edge), o = extra outward offset. */
  const at = (u, v, o = 0) => {
    const ang = crA(u), r = Rw - crTh(u, Rw) * v + o;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };
  const jitter = Math.sin(t * 0.9) * 0.6; // a faint shudder at speed
  // Red light spilling around it.
  for (let j = 0; j <= 8; j++) {
    const u = j / 8, [x, y] = at(u, 0.3), s = crTh(u, Rw) * 1.6 + 50;
    b.draw(F.glow, x, y, s, s, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], (0.14 + 0.04 * Math.sin(t * 0.08 + j)) * a, 1);
  }
  // Wake: a dark smear and red motion-blur copies trailing behind (down the path).
  b.draw(body, tx, ty + 22 * k, tw * 0.99, th, 0, 1, 1, 1, 0.3 * a, 0);
  for (const [dy, al] of [[40, 0.1], [18, 0.2]]) b.draw(rim, tx, ty + dy * k, tw, th, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], al * a, 1);
  // Speed streaks stretching back from the leading edge (re-rolled every 3 steps).
  const sd = (t / 3 | 0);
  for (let s = 0; s < 14; s++) {
    const h = sd * 7.7 + s * 3.1, u = 0.06 + 0.88 * hash(h), [x, y] = at(u, 0.05 + 0.3 * hash(h + 1)), L = (30 + 80 * hash(h + 2)) * k;
    b.draw(F.laser, x, y + L / 2, L, 2.2, Math.PI / 2, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.45 * a * hash(h + 3), 1);
  }
  // The arch itself.
  b.draw(body, tx + jitter, ty, tw, th, 0, 1, 1, 1, a, 0);
  // Plasma currents racing along the arc from the crown out to the blade tips.
  for (let s = 0; s < 22; s++) {
    const per = 26 + 22 * hash(s * 1.3), cyc = (t + hash(s * 3.1) * per) / per, ph = cyc % 1, n0 = cyc | 0;
    const dir = s % 2 ? 1 : -1, v = 0.04 + 0.8 * hash(s * 7.3 + n0 * 1.9), span = 0.05 + 0.08 * hash(s * 5.9 + n0);
    const uh = 0.5 + dir * (0.03 + 0.5 * ph), pts = [];
    for (let j = 0; j <= 4; j++) {
      const u = uh - dir * span * (j / 4);
      if (u > 0.01 && u < 0.99) pts.push(at(u, v));
    }
    const fa = Math.sin(Math.PI * ph) * a, wd = (v < 0.3 ? 3.2 : 2.2) * k;
    if (pts.length > 1) streak(p, b, pts, wd, fa, v < 0.3 ? 0.45 : 0.25);
  }
  // Lightning filaments following the curve, just outside the edge and inside the hollow.
  const ld = (t / 2 | 0);
  for (let s = 0; s < 4; s++) {
    const h = ld * 3.3 + s * 9.1, u0 = 0.08 + 0.6 * hash(h), span = 0.12 + 0.2 * hash(h + 1), out = s % 2 ? (6 + 16 * hash(h + 2)) * k : -1;
    const pts = [];
    for (let j = 0; j <= 9; j++) {
      const u = u0 + span * j / 9, jit = (hash(h + j * 1.7) - 0.5) * 10 * k;
      pts.push(out > 0 ? at(u, 0, out + jit) : at(u, 1.15, jit));
    }
    streak(p, b, pts, 1.6 * k, 0.8 * a * (0.6 + 0.4 * hash(h + 5)), 0.4);
  }
  // The blazing leading edge (pulsing) and energy nodes flaring along it.
  b.draw(rim, tx + jitter, ty, tw, th, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], a * (0.6 + 0.12 * Math.sin(t * 0.5)), 1);
  for (let s = 0; s < 6; s++) {
    const per = 40 + 20 * hash(s * 2.9), cyc = (t + hash(s) * per) / per, ph = cyc % 1;
    if (ph > 0.3) continue;
    const f = Math.sin(Math.PI * ph / 0.3), [x, y] = at(0.08 + 0.84 * hash(s * 4.1 + (cyc | 0)), 0.1 + 0.4 * hash(s * 6.7 + (cyc | 0)));
    b.draw(F.glow, x, y, 30 * k, 30 * k, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * f * a, 1);
    star(b, x, y, 34 * f * k, f * a, t * 0.05 + s);
  }
  // The overcharged core in the hollow: concentric rings pulsing out, a starburst with long spikes, red lightning.
  const ccx = cx, ccy = cy - Rw * 0.18, sp = t * 0.04;
  b.draw(F.glow, ccx, ccy, 60 * k, 60 * k, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.35 * a, 1);
  for (let r = 0; r < 3; r++) {
    const ph = ((t * 0.025) + r / 3) % 1, s = (20 + 50 * ph) * k;
    b.draw(F.ring, ccx, ccy, s, s, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * (1 - ph) * a, 1);
  }
  b.draw(F.ring, ccx, ccy, 30 * k, 30 * k, sp, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
  b.draw(F.laser, ccx, ccy, Rw * 1.5, 3.2 * k, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * a, 1);
  const top = cy - Rw - 40 * k, bot = cy + Rw * 0.45;
  b.draw(F.laser, ccx, (top + bot) / 2, bot - top, 4 * k, Math.PI / 2, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * a, 1);
  b.draw(F.laser, ccx, (top + bot) / 2, bot - top, 1.2 * k, Math.PI / 2, PAL.core[0], PAL.core[1], PAL.core[2], 0.5 * a, 1);
  star(b, ccx, ccy, (54 + 8 * Math.sin(t * 0.3)) * k, a, 0, PAL.hot);
  star(b, ccx, ccy, 34 * k, a, Math.PI / 4 + sp);
  b.draw(F.glow, ccx, ccy, 16 * k, 16 * k, 0, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  chaosCracks(p, b, (u, v) => [ccx + (u - 0.5) * 30 * k, ccy + (v - 0.5) * 30 * k], (p.t / 3 | 0) + c.x, 3, 0.8 * a, 0.9);
  // The crown star and the two side flares (twinkling).
  const [crx, cry] = at(0.5, 0.45);
  star(b, crx, cry, (52 + 8 * Math.sin(t * 0.2)) * k, a, 0, PAL.hot);
  star(b, crx, cry, 22 * k, a, sp);
  for (const sx of [-1, 1]) {
    const tw2 = 0.75 + 0.25 * Math.sin(t * 0.17 + sx * 2);
    star(b, cx + sx * Rw * 0.48, cy + Rw * 0.12, 40 * tw2 * k, a * tw2, 0, PAL.hot);
    star(b, cx + sx * Rw * 0.48, cy + Rw * 0.12, 16 * k, a, -sp);
  }
  // Black void orbs drifting around it.
  if (orb) for (let s = 0; s < 9; s++) {
    const u = (hash(s * 2.3) * 1.1 - 0.05 + t * 0.0015 * (s % 2 ? 1 : -1) + 1) % 1, o = (14 + 40 * hash(s * 3.7)) * k;
    const [x, y] = at(u, 0, o), bob = Math.sin(t * 0.06 + s) * 4 * k, sz = (5 + 9 * hash(s * 5.1)) * k;
    b.draw(F.glow, x, y + bob, sz * 2.6, sz * 2.6, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3 * a, 1);
    b.draw(orb, x, y + bob, sz, sz, 0, 1, 1, 1, a, 0);
  }
}

/** Every live Void Crescent (one, or three when cast in focus). */
export function renderCrescent(p, b) {
  for (const c of p.ps.crescents) {
    // v2: it tears off the blade small and grows to full size (the hits use the full shape).
    const g = Math.min(1, c.t / 10);
    renderOneCrescent(p, b, g < 1 ? { ...c, w: c.w * (0.35 + 0.65 * g * (2 - g)) } : c);
  }
}

/**
 * The Void Cannon's column texture (tiles vertically, scrolled up): an opaque
 * crimson body with blazing red edges, black void bands running its length,
 * bright red and pink-white energy streaks and a white-hot centre line.
 */
function columnTex(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(200,20,35,0)'); g.addColorStop(0.03, '#d01428'); g.addColorStop(0.09, '#7a0010');
  g.addColorStop(0.3, '#3c0006'); g.addColorStop(0.5, '#6a000e'); g.addColorStop(0.7, '#3c0006');
  g.addColorStop(0.91, '#7a0010'); g.addColorStop(0.97, '#d01428'); g.addColorStop(1, 'rgba(200,20,35,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // Black void bands down the length.
  for (const [cx, bw, al] of [[0.16, 0.08, 0.95], [0.27, 0.07, 1], [0.37, 0.05, 0.9], [0.62, 0.06, 0.95], [0.72, 0.08, 1], [0.84, 0.07, 0.95]]) {
    const b = ctx.createLinearGradient((cx - bw) * w, 0, (cx + bw) * w, 0);
    b.addColorStop(0, 'rgba(6,0,2,0)'); b.addColorStop(0.5, `rgba(6,0,2,${al})`); b.addColorStop(1, 'rgba(6,0,2,0)');
    ctx.fillStyle = b; ctx.fillRect((cx - bw) * w, 0, bw * 2 * w, h);
  }
  // Energy streaks (wrapped so the texture tiles).
  for (let k = 0; k < 34; k++) {
    const x = (0.08 + 0.84 * hash(k * 1.3)) * w, y = hash(k * 2.9) * h, L = (0.08 + 0.4 * hash(k * 3.7)) * h, lw = 0.4 + 1.6 * hash(k * 5.1);
    ctx.fillStyle = k % 6 ? `rgba(${170 + 60 * hash(k)},${10 + 25 * hash(k)},${25 + 20 * hash(k)},0.85)` : 'rgba(255,120,135,0.8)';
    for (const yy of [y, y - h]) ctx.fillRect(x - lw / 2, yy, lw, L);
  }
  // White-hot centre line with a red glow.
  const c = ctx.createLinearGradient(w * 0.42, 0, w * 0.58, 0);
  c.addColorStop(0, 'rgba(255,40,60,0)'); c.addColorStop(0.35, 'rgba(200,20,40,0.7)'); c.addColorStop(0.5, '#ff8a98');
  c.addColorStop(0.65, 'rgba(200,20,40,0.7)'); c.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = c; ctx.fillRect(w * 0.42, 0, w * 0.16, h);
}

/** A solid bar with soft ends of 1 px (opaque strokes: rings, blades). */
function barTex(ctx, w, h) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 1, w, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, h - 1, w, 1);
}

/** Atlas textures for the Void Cannon (part of miguerreFxSprites). */
function cannonSprites(atlas) {
  atlas.add('mz_column', 64, 128, columnTex, { scale: 2 });
  atlas.add('mz_bar', 16, 8, barTex, { scale: 2 });
}

/**
 * Smoke, debris and sparks thrown off a Void Cannon (called each step per
 * cannon): dense black plumes by the column, crimson vapour and grey-white
 * wisps billowing outward, black rock debris and sparks flung away.
 */
export function cannonSpray(w, x, y, wd, lite = false) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard');
  const n = lite ? 1 : 2;
  for (let k = 0; k < n; k++) { // black rock debris flung outward
    const s = R.chance(0.5) ? -1 : 1, py = R.range(0, y);
    let i = Hp.spawn(sh, x + s * wd * R.range(0.4, 0.7), py, s * R.range(1.5, 5), R.range(-4, 0.5), R.range(26, 44));
    if (i >= 0) { Hp.size(i, R.range(8, 20)); Hp.spin(i, R.range(0, 6), R.range(-0.2, 0.2)); Hp.phys(i, 0.96); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 1, 0, FADE_OUT); }
    i = Hp.spawn(F.spark, x + s * wd * 0.5, R.range(0, y), s * R.range(3, 7), R.range(-5, 1), R.range(10, 18));
    if (i >= 0) { Hp.size(i, 8); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.phys(i, 0.92); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
  }
  for (let k = 0; k < n; k++) { // dense black plumes hugging the column
    const s = R.chance(0.5) ? -1 : 1;
    const i = Hp.spawn(F.glow, x + s * wd * R.range(0.5, 0.9), R.range(-20, y), s * R.range(0.4, 1.5), R.range(-2.5, -0.5), R.range(30, 46));
    if (i < 0) return;
    Hp.size(i, R.range(24, 40), R.range(70, 120)); Hp.color(i, 0.04, 0.0, 0.01, 0.0, 0, 0); Hp.phys(i, 0.95); Hp.spin(i, R.range(0, 6), R.range(-0.05, 0.05)); Hp.look(i, 0.7, 0, FADE_INOUT);
  }
  { // crimson vapour on the outer edges
    const s = R.chance(0.5) ? -1 : 1;
    const i = Hp.spawn(F.glow, x + s * wd * R.range(0.7, 1.1), R.range(0, y), s * R.range(0.6, 1.8), R.range(-1.5, -0.3), R.range(28, 42));
    if (i >= 0) { Hp.size(i, 24, R.range(60, 100)); Hp.color(i, 0.8, 0.05, 0.1, 0.2, 0, 0.03); Hp.phys(i, 0.95); Hp.look(i, 0.6, 0, FADE_INOUT); }
  }
  if (!lite || R.chance(0.5)) { // grey-white wisps farther out
    const s = R.chance(0.5) ? -1 : 1;
    const i = Hp.spawn(F.glow, x + s * wd * R.range(1.0, 1.5), R.range(0, y), s * R.range(0.8, 2), R.range(-1, 0.4), R.range(30, 48));
    if (i >= 0) { Hp.size(i, 20, R.range(70, 120)); Hp.color(i, 0.5, 0.42, 0.45, 0.14, 0.1, 0.12); Hp.phys(i, 0.96); Hp.spin(i, R.range(0, 6), R.range(-0.04, 0.04)); Hp.look(i, 0.5, 0, FADE_INOUT); }
  }
}

/** One stroke of a solid bar (alpha-blended) from (x0, y0) to (x1, y1). */
function bar(b, fr, x0, y0, x1, y1, wdt, c, al) {
  const L = Math.hypot(x1 - x0, y1 - y0) + 1.5;
  b.draw(fr, (x0 + x1) / 2, (y0 + y1) / 2, L, wdt, Math.atan2(y1 - y0, x1 - x0), c[0], c[1], c[2], al, 0);
}

/** A thick, solid, tilted energy ring around the column: black body, crimson rim, white-hot edge; back or front half. */
function cannonRing(p, b, x, y, rx, ry, tilt, spin, a, front, thick = 1) {
  const F = p.F, fr = p.ps.fBar, n = 40, ct = Math.cos(tilt), st = Math.sin(tilt);
  const pt = (th, k = 1) => {
    const ex = Math.cos(th) * rx * k, ey = Math.sin(th) * ry * k;
    return [x + ex * ct - ey * st, y + ex * st + ey * ct];
  };
  for (let k = 0; k < n; k++) {
    const t0 = (k / n) * Math.PI * 2, t1 = ((k + 1) / n) * Math.PI * 2, mid = (t0 + t1) / 2;
    if ((Math.sin(mid) > 0) !== front) continue;
    // Thick sections rotate around the ring; it never thins below a solid band.
    const w = (4 + Math.max(0, Math.sin(mid * 2 + spin)) ** 1.5 * 10) * thick;
    const [x0, y0] = pt(t0), [x1, y1] = pt(t1), ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0) + 2;
    b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, w * 2.4, ang, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.35 * a, 1);
    if (fr) {
      bar(b, fr, x0, y0, x1, y1, w + 4, [0.7, 0.03, 0.09], a);
      bar(b, fr, x0, y0, x1, y1, w, [0.04, 0, 0.01], a);
    }
    const [ox0, oy0] = pt(t0, 1 + w / (2 * rx)), [ox1, oy1] = pt(t1, 1 + w / (2 * rx));
    b.draw(F.laser, (ox0 + ox1) / 2, (oy0 + oy1) / 2, L, 1.6, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * a, 1);
  }
}

/**
 * A Getsuga crescent blade sweeping out of the column: a solid black brush
 * stroke with a crimson-white leading edge and trailing ribbons. f = 0..1.
 */
function cannonBlade(p, b, x, y, wd, f, dir, seed, a) {
  const F = p.F, fr = p.ps.fBar, Rb = wd * (0.5 + 0.8 * f), cy = y - f * 150, n = 14, fade = Math.min(1, Math.sin(Math.PI * f) * 1.6) * a;
  const a0 = -Math.PI / 2 - dir * 0.3, span = 1.5 + 0.5 * hash(seed), tilt = (hash(seed * 1.7) - 0.5) * 0.5;
  const maxW = (26 + 16 * hash(seed * 2.3)) * (1 - 0.35 * f), ct = Math.cos(tilt), st = Math.sin(tilt);
  const pt = (s, r) => {
    const ang = a0 + dir * span * s, ex = Math.cos(ang) * r, ey = Math.sin(ang) * r * 0.55;
    return [x + ex * ct - ey * st, cy + ex * st + ey * ct];
  };
  for (let j = 0; j < n; j++) {
    const s0 = j / n, s1 = (j + 1) / n, wth = maxW * Math.sin(Math.PI * Math.min(1, (s0 + s1) / 2 * 1.1)) ** 0.7;
    if (wth < 1) continue;
    const [ax, ay] = pt(s0, Rb - wth * 0.5), [bx, by] = pt(s1, Rb - wth * 0.5);
    if (fr) bar(b, fr, ax, ay, bx, by, wth, [0.04, 0, 0.01], fade);
    for (const off of [1.1, 1.5]) { // brushy black ribbons trailing inside
      const [cx0, cy0] = pt(s0, Rb - wth * off), [cx1, cy1] = pt(s1, Rb - wth * off);
      if (fr) bar(b, fr, cx0, cy0, cx1, cy1, wth * 0.22, [0.05, 0, 0.01], 0.8 * fade);
    }
    const [ex0, ey0] = pt(s0, Rb), [ex1, ey1] = pt(s1, Rb), L = Math.hypot(ex1 - ex0, ey1 - ey0) + 2, ang = Math.atan2(ey1 - ey0, ex1 - ex0);
    b.draw(F.laser, (ex0 + ex1) / 2, (ey0 + ey1) / 2, L, Math.max(4, wth * 0.5), ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], fade, 1);
    b.draw(F.laser, (ex0 + ex1) / 2, (ey0 + ey1) / 2, L, Math.max(1.2, wth * 0.12), ang, PAL.core[0], PAL.core[1], PAL.core[2], fade, 1);
  }
}

/** A Gran Rey Cero compression node: a solid black sphere with crimson cracks that squeezes in, then erupts. */
function cannonNode(p, b, x, y, s, a, seed) {
  const F = p.F, t = p.t, orb = p.ps.fOrb, per = 48, ph = ((t + seed * 17) % per) / per;
  const squeeze = ph < 0.75 ? 1 - 0.18 * (ph / 0.75) : 0.82 + 0.4 * ((ph - 0.75) / 0.25);
  const erupt = ph < 0.75 ? 0 : Math.sin(Math.PI * (ph - 0.75) / 0.25), sz = s * squeeze;
  b.draw(F.glow, x, y, sz * 2, sz * 2, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], (0.2 + 0.4 * erupt) * a, 1);
  for (let r = 0; r < 2; r++) {
    const q = ph < 0.75 ? 1 - ((ph / 0.75 + r * 0.5) % 1) : (ph - 0.75) / 0.25, rs = sz * (1.2 + 1.8 * q);
    b.draw(F.ring, x, y, rs, rs * 0.85, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * a * (ph < 0.75 ? q : 1 - q), 1);
  }
  b.draw(F.ring, x, y, sz * 1.14, sz * 1.14, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], a, 1);
  if (orb) { b.draw(orb, x, y, sz * 1.08, sz * 1.08, 0, 1, 1, 1, a, 0); b.draw(orb, x, y, sz, sz, t * 0.01, 1, 1, 1, a, 0); }
  // Crimson cracks crawling over the sphere.
  chaosCracks(p, b, (u, v) => {
    const ang = u * Math.PI * 2, r = sz * 0.4 * v;
    return [x + Math.cos(ang) * r, y + Math.sin(ang) * r];
  }, (t >> 1) + seed * 7, 3, a, 0.6);
  // Cross spikes and a white-red heart.
  const sp = sz * (2.2 + 2.2 * erupt);
  b.draw(F.laser, x, y, sp, 3, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], a, 1);
  b.draw(F.laser, x, y, sp * 1.4, 3, Math.PI / 2, PAL.mid[0], PAL.mid[1], PAL.mid[2], a, 1);
  b.draw(F.laser, x, y, sp * 0.8, 1, 0, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  b.draw(F.laser, x, y, sp * 1.1, 1, Math.PI / 2, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  star(b, x, y, sz * (0.18 + 0.9 * erupt), a, 0);
}

/**
 * Void Cannon, after the owner's enhance-ultimate.png (Gran Rey Cero ×
 * Getsuga Tenshō): a solid crimson-and-black energy column (opaque, scrolling
 * up) wrapped in a dense red and pink energy burst; thick black rings
 * rotating as they rise; solid black Getsuga blades sweeping outward;
 * black compression spheres on the axis that squeeze and erupt; black void
 * orbs and rocks around it; red light rays and lightning. Smoke and debris
 * particles are cannonSpray. Side cannons (focus clones) use `lite` detail.
 */
export function renderCannon(p, b, x, y, wd, a, seed = 0) {
  const F = p.F, t = p.t + seed * 37, top = -30, len = y - top, sh = p.ps.fShard, orb = p.ps.fOrb, col = p.ps.fColumn;
  const up = -Math.PI / 2, lite = seed > 0, flick = 0.9 + 0.1 * Math.sin(t * 0.9);
  // Red light rays radiating from the column (re-rolled every 4 steps).
  const rd = (t / 4 | 0);
  for (let k = 0; k < (lite ? 5 : 12); k++) {
    const h = rd * 3.7 + k * 5.1, ry = y - len * (0.05 + 0.9 * hash(h)), s = hash(h + 1) < 0.5 ? -1 : 1;
    const ang = (s > 0 ? 0 : Math.PI) + s * (-0.6 + 0.9 * hash(h + 2)), L = 220 + 220 * hash(h + 3);
    b.draw(F.laser, x + Math.cos(ang) * L / 2, ry + Math.sin(ang) * L / 2, L, 3, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * a * (0.4 + 0.6 * hash(h + 4)), 1);
  }
  // A dense energy burst around the column: crimson, pink-white and black puffs boiling outward (solid, not glow).
  const nb = lite ? 18 : 40;
  for (let k = 0; k < nb; k++) {
    const per = 34 + 20 * hash(k * 1.3), cyc = (t + hash(k * 2.1) * per) / per, ph = cyc % 1, n0 = cyc | 0, s = k % 2 ? 1 : -1;
    const by = y - len * hash(k * 3.3 + n0 * 1.7), bx = x + s * wd * (0.35 + (0.4 + 0.6 * hash(k * 5.9 + n0)) * ph);
    const sz = wd * (0.35 + 0.5 * ph) * (0.6 + 0.6 * hash(k * 7.1)), kind = k % 5;
    const c = kind < 2 ? [0.04, 0, 0.01] : kind === 2 && k % 3 === 0 ? [0.8, 0.35, 0.4] : [0.45, 0.02, 0.06];
    b.draw(F.glow, bx, by - ph * 30, sz, sz * 1.2, 0, c[0], c[1], c[2], 0.9 * (1 - ph * ph) * a, 0);
  }
  b.draw(F.laser, x, (y + top) / 2, len, wd * 2.2, up, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.25 * a, 1);
  // Back halves of the rings.
  const nr = lite ? 3 : 5, rings = [];
  for (let r = 0; r < nr; r++) {
    const ry = y - ((r * (len + 60) / nr + t * 3.2) % (len + 60)), g = 1 - (y - ry) / (len + 60);
    rings.push([ry, wd * (0.95 + 0.3 * hash(r * 3.3 + seed)), (hash(r * 1.9 + seed) - 0.5) * 0.35, t * 0.12 * (r % 2 ? 1 : -1) + r, Math.min(1, g * 4)]);
  }
  for (const [ry, rx, tl, spn, ga] of rings) cannonRing(p, b, x, ry, rx, rx * 0.2, tl, spn, a * ga, false);
  // The solid crimson-and-black column, scrolling up.
  const cw = wd * 1.0;
  if (col) {
    const th = cw * 2, off = (t * 16) % th;
    for (let yy = y + th / 2 + off - th; yy - th / 2 > top - th; yy -= th) {
      const y0 = Math.min(y, yy + th / 2), y1 = Math.max(top, yy - th / 2);
      if (y0 > y1) b.draw(col, x, (y0 + y1) / 2, cw, y0 - y1, 0, 1, 1, 1, a, 0);
    }
  }
  // Black void currents wavering over it, energy streaks racing up, a white-hot core line.
  for (let s = 0; s < 5; s++) {
    const off = (hash(s * 2.7 + seed) - 0.5) * cw * 0.75, wv = 6 + 8 * hash(s * 4.1);
    for (let yy = y; yy > top; yy -= 30) {
      const y1 = yy - 30, xo = off + Math.sin(yy * 0.02 + t * 0.15 + s) * 7, xo1 = off + Math.sin(y1 * 0.02 + t * 0.15 + s) * 7;
      b.draw(F.laser, x + (xo + xo1) / 2, (yy + y1) / 2, 32, wv, Math.atan2(-30, xo1 - xo), DARK[0], DARK[1], DARK[2], 0.95 * a, 0);
    }
  }
  for (let k = 0; k < (lite ? 8 : 18); k++) {
    const sy = y - ((hash(k * 3.1 + seed) * len + t * (20 + 14 * hash(k))) % len), sx = x + (hash(k * 1.7 + seed) - 0.5) * cw * 0.85;
    b.draw(F.laser, sx, sy, 50 + 70 * hash(k * 2.3), 2, up, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.55 * a, 1);
  }
  b.draw(F.laser, x, (y + top) / 2, len, cw * 0.08 * flick, up, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * a, 1);
  b.draw(F.laser, x, (y + top) / 2, len, cw * 0.025, up, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * a, 1);
  // Blazing, jagged edges with lightning.
  for (const s of [-1, 1]) {
    for (let yy = y; yy > top; yy -= 36) {
      const y1 = Math.max(top, yy - 36), j0 = (hash(yy * 0.1 + (t >> 1) + s) - 0.5) * 12, j1 = (hash(y1 * 0.1 + (t >> 1) + s) - 0.5) * 12;
      const x0 = x + s * cw * 0.5 + j0, x1 = x + s * cw * 0.5 + j1, L = Math.hypot(x1 - x0, y1 - yy) + 2, ang = Math.atan2(y1 - yy, x1 - x0);
      b.draw(F.laser, (x0 + x1) / 2, (yy + y1) / 2, L, 5 * flick, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.8 * a, 1);
      b.draw(F.laser, (x0 + x1) / 2, (yy + y1) / 2, L, 1.5, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * a, 1);
    }
  }
  chaosCracks(p, b, (u, v) => [x + (u - 0.5) * cw * 1.6, top + v * len], (t / 3 | 0) + seed * 31, lite ? 4 : 9, a, 1.3);
  // Compression spheres on the axis (one big one in the middle).
  const nodes = lite ? [[0.45, 0.9]] : [[0.12, 0.35], [0.3, 0.42], [0.5, 1.2], [0.72, 0.4], [0.88, 0.5]];
  nodes.forEach(([fy, s], k) => cannonNode(p, b, x, y - len * fy, wd * 0.42 * s, a, k + seed * 5));
  // Front halves of the rings.
  for (const [ry, rx, tl, spn, ga] of rings) cannonRing(p, b, x, ry, rx, rx * 0.2, tl, spn, a * ga, true);
  // Getsuga blades sweeping outward and upward.
  const P = 16, nbl = lite ? 2 : 4;
  for (let j = 0; j < nbl; j++) {
    const nn = Math.floor(t / P) - j, f = (t - nn * P) / (P * nbl);
    if (f >= 1) continue;
    cannonBlade(p, b, x, y - 40 - (len - 120) * hash(nn * 1.37 + seed), wd, f, nn % 2 ? 1 : -1, nn + seed, a);
  }
  // Black void orbs drifting off the sides.
  if (orb && !lite) for (let k = 0; k < 6; k++) {
    const per = 120, ph = ((t + k * 40) % per) / per, s = k % 2 ? 1 : -1;
    const ox = x + s * wd * (0.8 + 0.5 * ph), oy = y - len * (0.15 + 0.7 * hash(k * 2.1 + Math.floor((t + k * 40) / per))) - ph * 40;
    const sz = wd * (0.2 + 0.25 * hash(k * 3.9)), fa = Math.min(1, Math.sin(Math.PI * ph) * 2) * a;
    b.draw(F.glow, ox, oy, sz * 1.8, sz * 1.8, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.5 * fa, 1);
    b.draw(F.ring, ox, oy, sz * 1.14, sz * 1.14, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], fa, 1);
    b.draw(orb, ox, oy, sz * 1.05, sz * 1.05, 0, 1, 1, 1, fa, 0);
    b.draw(orb, ox, oy, sz, sz, 0, 1, 1, 1, fa, 0);
  }
  // Black rocks streaming up beside the column.
  if (sh) for (let k = 0; k < (lite ? 8 : 20); k++) {
    const sy = y - ((hash(k * 3.1 + seed) * len + t * (6 + 6 * hash(k * 0.7))) % len), side = hash(k * 4.1 + seed) < 0.5 ? -1 : 1;
    const sx = x + side * wd * (0.55 + 0.5 * hash(k * 6.3)), s = 10 + 14 * hash(k * 2.2);
    b.draw(sh, sx, sy, s * 1.12, s * 0.92, 0, 0.6, 0.02, 0.06, 0.8 * a, 0);
    b.draw(sh, sx, sy, s, s * 0.8, t * 0.04 * (hash(k) - 0.5) + k, DARK[0], DARK[1], DARK[2], a, 0);
  }
  // The muzzle: a big thick ring around the ship and a blazing flare.
  cannonRing(p, b, x, y + 4, wd * 1.15, wd * 0.28, 0, t * 0.15, a, false, 1.3);
  b.draw(F.glow, x, y, wd * 1.1, wd * 0.7, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.5 * a, 1);
  star(b, x, y, wd * 0.55, 0.8 * a, 0, PAL.hot);
  cannonRing(p, b, x, y + 4, wd * 1.15, wd * 0.28, 0, t * 0.15, a, true, 1.3);
}

// ------------------------------------------------------------ v2: the rig's FX

/** The world points of a line from anchor a to anchor b on the posed mecha (api.at), n + 1 of them. */
const line = (api, a, b2, n) => {
  const [x0, y0] = api.at(a), [x1, y1] = api.at(b2), out = [];
  for (let k = 0; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  return out;
};

/**
 * Over the mecha (RIG_FX.overlay): the horns' glow (a red charge running from
 * root to edge between strikes, a flare as the beams leave), the blade charging
 * through the swing's wind-up and the black-red arc trail behind it, and the
 * ultimate's horn blaze with black lightning between the horns.
 */
function rigOverlay(p, b, api) {
  const F = p.F, r = rigState(p), t = p.t, a = api.a, ps = p.ps;
  // Horns.
  for (const s of ['L', 'R']) {
    const fl = s === 'L' ? r.hornL : r.hornR, base = 0.25 + 0.75 * r.charge;
    const pts = line(api, 'hornRoot' + s, 'hornTip' + s, 4);
    for (let k = 0; k < pts.length; k++) {
      const [x, y] = pts[k], g = (base + fl * (1 - k / 6)) * (0.85 + 0.15 * Math.sin(t * 0.4 + k));
      b.draw(F.glow, x, y, 9 + 6 * r.charge, 9 + 6 * r.charge, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.5 * g * a, 1);
    }
    // The charge bead running root → edge before the next strike.
    const u = Math.min(1, (r.hornT ?? 99) / 4);
    if (u < 1) {
      const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1], x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      b.draw(F.glow, x, y, 7, 7, 0, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
    }
    if (fl > 0.05) {
      const [x, y] = api.at('horn' + s);
      b.draw(F.glow, x, y, 26 * fl, 26 * fl, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * fl * a, 1);
      star(b, x, y, 22 * fl, fl * a, t * 0.2);
    }
  }
  // Ultimate: the horns blaze and black lightning gathers between them.
  if (r.charge > 0.05) {
    const [cx, cy] = api.at('core'), c = r.charge;
    b.draw(F.glow, cx, cy, 70 * c, 70 * c, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.7 * c * a, 1);
    b.draw(F.glow, cx, cy, 34 * c, 34 * c, 0, DARK[0], DARK[1], DARK[2], 0.8 * c * a, 0);
    b.draw(F.glow, cx, cy, 16 * c, 16 * c, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.9 * c * a, 1);
    const [lx, ly] = api.at('hornL'), [rx, ry] = api.at('hornR');
    for (let j = 0; j < 3; j++) {
      // A jagged bolt horn → core → horn, re-rolled every 2 steps.
      const sd = Math.floor(t / 2) * 7.3 + j * 3.1;
      let px = lx, py = ly;
      for (let k = 1; k <= 6; k++) {
        const u = k / 6, bx = lx + (rx - lx) * u, by = ly + (ry - ly) * u - Math.sin(u * Math.PI) * 6 * c;
        const x = k === 6 ? rx : bx + (hash(sd + k) - 0.5) * 10 * c, y = k === 6 ? ry : by + (hash(sd + k * 2.7) - 0.5) * 10 * c;
        const len = Math.hypot(x - px, y - py), ang = Math.atan2(y - py, x - px);
        b.draw(F.laser, (px + x) / 2, (py + y) / 2, len + 2, 4, ang, DARK[0], DARK[1], DARK[2], 0.8 * c * a, 0);
        b.draw(F.laser, (px + x) / 2, (py + y) / 2, len + 2, 1.6, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.9 * c * a, 1);
        px = x; py = y;
      }
    }
  }
  // The swing: the blade charges through the wind-up; the arc trail follows the slash.
  const st = r.swingT;
  if (st >= 0 && st < SWING.slash + 4) {
    const k = st < SWING.wind ? st / SWING.wind : 1;
    const pts = line(api, 'guard', 'swordTip', 8);
    pts.forEach(([x, y], j) => {
      const g = k * (0.6 + 0.4 * Math.sin(t * 0.7 + j * 1.3));
      b.draw(F.glow, x, y, 16 + 10 * k, 16 + 10 * k, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * g * a, 1);
      b.draw(F.glow, x, y, 7, 7, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * g * a, 1);
    });
  }
  const tr = ps.trail;
  if (tr && tr.length > 1) {
    for (let j = 1; j < tr.length; j++) {
      const A0 = tr[j - 1], A1 = tr[j], al = (j / tr.length) * a * A1.a;
      // Fill between the guard and the tip of two consecutive blade positions, as strokes.
      for (let m = 0; m <= 4; m++) {
        const u = 0.25 + 0.75 * m / 4;
        const x0 = p.x + A0.gx + (A0.tx - A0.gx) * u, y0 = p.y + A0.gy + (A0.ty - A0.gy) * u;
        const x1 = p.x + A1.gx + (A1.tx - A1.gx) * u, y1 = p.y + A1.gy + (A1.ty - A1.gy) * u;
        const len = Math.hypot(x1 - x0, y1 - y0) + 3, ang = Math.atan2(y1 - y0, x1 - x0);
        b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, len, 10 * u, ang, DARK[0], DARK[1], DARK[2], 0.55 * al, 0);
        b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, len, 6 * u, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * al * u, 1);
        if (m === 4) b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, len, 3, ang, PAL.core[0], PAL.core[1], PAL.core[2], 0.9 * al, 1);
      }
    }
  }
}
RIG_FX.overlay = rigOverlay;

/** Black flame and red sparks licking off the blade through the wind-up (each step). */
export function swordCharge(p, w, k) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  const [gx, gy] = miguerreArt.animatedAnchor(p, 'guard'), [tx, ty] = miguerreArt.animatedAnchor(p, 'swordTip');
  for (let j = 0; j < 2; j++) {
    const u = R.next(), x = gx + (tx - gx) * u, y = gy + (ty - gy) * u;
    let i = Hp.spawn(F.glow, x + R.range(-3, 3), y, R.range(-0.4, 0.4), R.range(-1.4, -0.4), R.range(14, 22));
    if (i >= 0) { Hp.size(i, 6, 18 * (0.5 + k)); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.phys(i, 0.95); Hp.look(i, 0.7, 0, FADE_INOUT); }
    i = Hp.spawn(F.spark, x, y, R.range(-1.5, 1.5), R.range(-2, 0.5), R.range(8, 14));
    if (i >= 0) { Hp.size(i, 4); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.phys(i, 0.9); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
  }
}

/** The crescent tears off the blade: a flash and black shards and red sparks flung forward along it. */
export function swordRelease(p, w) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard');
  const [gx, gy] = miguerreArt.animatedAnchor(p, 'guard'), [tx, ty] = miguerreArt.animatedAnchor(p, 'swordTip');
  for (let j = 0; j < 14; j++) {
    const u = j / 13, x = gx + (tx - gx) * u, y = gy + (ty - gy) * u, a = -Math.PI / 2 + R.range(-0.7, 0.7), sp = R.range(3, 8);
    let i = Hp.spawn(j & 1 ? sh : F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(12, 22));
    if (i < 0) break;
    if (j & 1) { Hp.size(i, R.range(5, 9)); Hp.spin(i, a, R.range(-0.3, 0.3)); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.phys(i, 0.9); Hp.look(i, 0.95, 0, FADE_OUT); }
    else { Hp.size(i, 6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.phys(i, 0.88); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
    i = Hp.spawn(F.glow, x, y, 0, -1, 10);
    if (i >= 0) { Hp.size(i, 30, 50); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  }
}

/** Each downstroke: a dark gust ripple off both wings and void feathers shed from the trailing edges. */
export function wingGust(p, w) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('mz_shard');
  for (const s of ['L', 'R']) {
    const [tx, ty] = miguerreArt.animatedAnchor(p, 'wingLow' + s), [mx, my] = miguerreArt.animatedAnchor(p, 'wingMid' + s);
    const dir = s === 'L' ? -1 : 1;
    let i = Hp.spawn(F.ring, (tx + mx) / 2, (ty + my) / 2 + 6, dir * 0.6, 1.4, 16);
    if (i >= 0) { Hp.size(i, 10, 46); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.3, 1, FADE_OUT); }
    for (let j = 0; j < 2; j++) {
      const u = R.next(), x = mx + (tx - mx) * u, y = my + (ty - my) * u;
      i = Hp.spawn(sh, x, y, dir * R.range(0.4, 1.4), R.range(1.2, 2.4), R.range(22, 34));
      if (i >= 0) { Hp.size(i, R.range(4, 7)); Hp.spin(i, R.range(0, 6.3), R.range(-0.15, 0.15)); Hp.phys(i, 0.97); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.85, 0, FADE_OUT); }
      i = Hp.spawn(F.glow, x, y, dir * R.range(0.2, 0.8), R.range(1, 2), R.range(20, 30));
      if (i >= 0) { Hp.size(i, 10, 26); Hp.color(i, 0.12, 0.0, 0.02, 0.02, 0, 0); Hp.phys(i, 0.96); Hp.look(i, 0.45 * p.alpha, 0, FADE_INOUT); }
    }
  }
}

/** Exhaust hook (no thrusters): a faint trail of void smoke and red embers off the wing tips. */
export function wingTrail(p, w) {
  if (!miguerreArt.exhaust(p, w)) return false;
  const Hp = w.fxHigh, R = w.fxRng, F = p.F;
  if (R.next() < 0.35) {
    const [x, y] = miguerreArt.animatedAnchor(p, R.next() < 0.5 ? 'wingLowL' : 'wingLowR');
    let i = Hp.spawn(F.glow, x + R.range(-3, 3), y, R.range(-0.2, 0.2), R.range(1.2, 2), R.range(16, 24));
    if (i >= 0) { Hp.size(i, 6, 16); Hp.color(i, 0.12, 0.0, 0.02, 0.02, 0, 0); Hp.phys(i, 0.97); Hp.look(i, 0.4 * p.alpha, 0, FADE_INOUT); }
    i = Hp.spawn(F.spark, x, y, R.range(-0.3, 0.3), R.range(0.8, 1.6), R.range(10, 16));
    if (i >= 0) { Hp.size(i, 3); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.7 * p.alpha, 1, FADE_OUT); }
  }
  return true;
}

/** The terrifying vibration's peak: a dark-red flash, a heavy shock ring and dread rings over every enemy. */
export function terrorBurst(p, w, list) {
  const Hp = w.fxHigh, F = w.F;
  w.r.post.flash(0.35, 0.0, 0.03, 0.3, 0.04);
  w.r.post.shockwave(p.x, p.y, 0.06, 0.03, 0.9);
  w.r.post.aberrate(0.04);
  w.g.camera.addTrauma(0.45);
  for (const f of list) {
    const i = Hp.spawn(F.ring, f.e.x, f.e.y, 0, 0, 14);
    if (i >= 0) { Hp.size(i, 50, 8); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.8, 1, FADE_OUT); }
  }
}

/** Dark wisps of dread rising off a feared enemy (call every few steps). */
export function fearWisp(w, e) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  const i = Hp.spawn(F.glow, e.x + R.range(-e.r, e.r), e.y + R.range(-e.r, e.r) * 0.5, R.range(-0.3, 0.3), R.range(-1.4, -0.6), R.range(18, 28));
  if (i >= 0) { Hp.size(i, 8, 22); Hp.color(i, 0.4, 0.0, 0.05, 0.05, 0, 0); Hp.phys(i, 0.96); Hp.look(i, 0.6, 0, FADE_INOUT); }
}

/**
 * Feared enemies (render): a trembling dark-red dread aura, a distortion halo
 * of shaking copies of the ring, and twitching red marks. Bosses tremble here
 * too (visual only).
 */
export function renderFear(p, b) {
  const F = p.F, t = p.t;
  for (const f of p.ps.fear) {
    const e = f.e;
    if (!e.alive) continue;
    const k = 1 - f.t / f.life, a = Math.min(1, f.t / 4) * k, R0 = (e.r || 14) * (f.boss ? 1.4 : 2.2);
    const jx = Math.sin(t * 2.7 + f.s) * 2.2 * k, jy = Math.cos(t * 3.1 + f.s) * 1.6 * k;
    b.draw(F.glow, e.x + jx, e.y + jy, R0 * 2.4, R0 * 2.4, 0, 0.05, 0, 0.01, 0.55 * a, 0);
    b.draw(F.glow, e.x + jx, e.y + jy, R0 * 2, R0 * 2, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.6 * a, 1);
    for (let j = 0; j < 3; j++) {
      const s = R0 * (1.3 + 0.35 * j + 0.1 * Math.sin(t * 0.9 + j * 2 + f.s));
      b.draw(F.ring, e.x - jx * (j + 1) * 0.6, e.y - jy * (j + 1) * 0.6, s, s * (0.9 + 0.1 * Math.sin(t * 1.3 + j)), t * 0.1 * (j & 1 ? 1 : -1), PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.35 * a / (j + 1), 1);
    }
    if ((t + f.s) % 7 < 3) {
      const ang = hash(Math.floor(t / 3) + f.s) * Math.PI * 2;
      b.draw(F.laser, e.x + Math.cos(ang) * R0 * 0.8, e.y + Math.sin(ang) * R0 * 0.8, R0 * 0.9, 2, ang + 1.3, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * a, 1);
    }
  }
}

/** A Chaos Clone rises: a swirling vortex of black and dark-red smoke drawn into its spot. */
export function chaosVortex(w, x, y) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, d = R.range(40, 70), tg = a + Math.PI / 2;
    const i = Hp.spawn(F.glow, x + Math.cos(a) * d, y + Math.sin(a) * d, -Math.cos(a) * 1.6 + Math.cos(tg) * 2.2, -Math.sin(a) * 1.6 + Math.sin(tg) * 2.2, R.range(20, 30));
    if (i < 0) return;
    Hp.size(i, 18, 8);
    if (k & 1) Hp.color(i, 0.12, 0.0, 0.02, 0.02, 0, 0); else Hp.color(i, 0.6, 0.04, 0.08, 0.1, 0, 0.02);
    Hp.phys(i, 0.95); Hp.look(i, 0.7, 0, FADE_INOUT);
  }
}

/** The ultimate's charge (each step, k 0..1): red motes and black smoke drawn into the horns, then a flash. */
export function ultCharge(p, w, k) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, [cx, cy] = miguerreArt.animatedAnchor(p, 'core');
  for (let j = 0; j < 3; j++) {
    const a = R.range(0, Math.PI * 2), d = R.range(50, 90);
    let i = Hp.spawn(F.spark, cx + Math.cos(a) * d, cy + Math.sin(a) * d, -Math.cos(a) * d / 12, -Math.sin(a) * d / 12, 12);
    if (i >= 0) { Hp.size(i, 4); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
    i = Hp.spawn(F.glow, cx + Math.cos(a) * d, cy + Math.sin(a) * d, -Math.cos(a) * d / 16, -Math.sin(a) * d / 16, 16);
    if (i >= 0) { Hp.size(i, 18, 6); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.6 * k, 0, FADE_INOUT); }
  }
}
