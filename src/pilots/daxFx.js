import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { daxArt, PAL, DARK } from './daxArt.js';
import { H } from './common.js';

// Dax's void-cosmic effects, drawn after fx-reference.png, void-beams.png,
// ultimate-fx.png and the owner's picks (tools/art-ref/dax/), all built live
// (no cut-out images): straight void beams (white-hot core, red body, black
// sheath), red star flares, black shard bursts with red rings, dark-red smoke
// ghosts, a crescent of starry black space with a red rim, and the cosmic Void
// Cannon. Black parts are alpha-blended (add = 0) under the additive red.
// Render-time only: damage lives in dax.js.

const LOOK = daxArt.LOOK;
const fxOf = () => daxArt.frames().fx;
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

function shardTex(ctx, w, h) {
  // Jagged black-glass shard.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55); ctx.lineTo(w * 0.35, 0); ctx.lineTo(w, h * 0.4); ctx.lineTo(w * 0.6, h); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
}

function rodTex(ctx, w, h) {
  // A void rod pointing right: long tapered shaft, diamond head, guard ring.
  const cy = h / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w * 0.7, cy - h * 0.18); ctx.lineTo(w * 0.72, cy - h * 0.45); ctx.lineTo(w, cy);
  ctx.lineTo(w * 0.72, cy + h * 0.45); ctx.lineTo(w * 0.7, cy + h * 0.18); ctx.closePath(); ctx.fill();
}

/** Atlas textures (part of dax.js `sprites`). */
export function daxFxSprites(atlas) {
  atlas.add('dx_shard', 12, 10, shardTex, { scale: 3 });
  atlas.add('dx_rod', 64, 12, rodTex, { scale: 3 });
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

/** Every live beam (strikes from the body, the ghost and its clones) and every interception beam. */
export function renderBeams(p, b) {
  const F = p.F, ps = p.ps, t = p.t, wm = LOOK.widthMul, glowA = LOOK.glowMul * crowdFactor(p.w);
  for (const s of ps.bolts) {
    const a = 1 - s.t / s.life, pulse = 0.9 + 0.1 * Math.sin(t * 1.3 + s.s);
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      beamSeg(p, b, ax, ay, bx, by, s.w * wm * pulse * (k === 1 ? 1 : 0.8), a, glowA);
      b.draw(F.glow, bx, by, s.w * 4, s.w * 4, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * a, 1);
      star(b, bx, by, s.w * 4, a, t * 0.1 + k);
    }
    if (s.pts.length) {
      const [x, y] = s.pts[0];
      b.draw(F.glow, x, y, s.w * 3, s.w * 3, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * a, 1);
      star(b, x, y, s.w * 3.6, a, t * 0.13);
    }
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
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard');
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
 * Void explosion (one-hit kills, rods, crescent, cannon): black smoke and
 * black shards, a red fireball with a white core, red rings, star flares and
 * tiny white cosmic dots. `s` scales it (1 ≈ a normal enemy).
 */
export function burst(w, x, y, s = 1) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard'), fx = fxOf();
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

/** Void exhaust: the art's red particles plus trailing black-red smoke (exhaust hook). */
export function voidExhaust(p, w) {
  if (!daxArt.exhaust(p, w)) return false;
  const Hp = w.fxHigh, R = w.fxRng, F = p.F;
  if (R.next() < 0.5) {
    const name = R.next() < 0.5 ? 'ventL' : 'ventR', [ax, ay] = daxArt.anchor(name);
    const i = Hp.spawn(F.glow, p.x + ax + R.range(-2, 2), p.y + ay + 14, R.range(-0.3, 0.3), R.range(1.6, 2.6), R.range(18, 28));
    if (i >= 0) { Hp.size(i, 8, 20); Hp.color(i, 0.12, 0.0, 0.02, 0.02, 0, 0); Hp.phys(i, 0.97); Hp.look(i, 0.45 * p.alpha, 0, FADE_INOUT); }
  }
  return true;
}

// ------------------------------------------------------------ ghosts

/**
 * Real smoke for a ghost at (x, y), emitted every step: dark-red puffs that
 * billow out of the body and trail behind, plus faint red wisps.
 */
export function ghostSmoke(w, x, y, n = 2) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < n; k++) {
    const i = Hp.spawn(F.glow, x + R.range(-20, 20), y + R.range(-26, 34), R.range(-0.5, 0.5), R.range(0.5, 1.6), R.range(24, 40));
    if (i < 0) return;
    Hp.size(i, R.range(10, 16), R.range(34, 52)); Hp.color(i, 0.6, 0.04, 0.08, 0.1, 0.0, 0.02);
    Hp.phys(i, 0.96); Hp.spin(i, 0, R.range(-0.05, 0.05)); Hp.look(i, 0.55, 0, FADE_INOUT);
  }
  for (let k = 0; k < n; k++) {
    const i = Hp.spawn(F.glow, x + R.range(-18, 18), y + R.range(-24, 30), R.range(-0.4, 0.4), R.range(0.3, 1.2), R.range(18, 30));
    if (i >= 0) { Hp.size(i, 8, 30); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.phys(i, 0.96); Hp.look(i, 0.4, 1, FADE_INOUT); }
  }
}

/**
 * A dark-red smoke ghost of the mecha at (x, y): the full sprite tinted void
 * red, see-through and hazy at the edges, with a red core light. The smoke
 * itself is particles (ghostSmoke).
 */
export function renderGhost(p, b, x, y, alpha, seed = 0) {
  const K = daxArt.frames(), set = K.art && (K.art[LOOK.outline ? 'outline' : 'plain'] || K.art.outline);
  const F = p.F, t = p.t;
  b.draw(F.glow, x, y + 8, 80, 96, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.45 * alpha, 1);
  b.draw(F.glow, x, y + 10, 70, 90, 0, 0.1, 0, 0.02, 0.35 * alpha, 0);
  if (!set) return;
  const A = daxArt.anchorData(), hb = A.anchors.hitbox, k = daxArt.unitsPerPx();
  const cx = x + (A.image.w / 2 - hb[0]) * k, cy = y + Math.sin(t * 0.07 + seed) * 1.2 + (A.image.h / 2 - hb[1]) * k;
  const W0 = A.image.w * k, H0 = A.image.h * k, flick = 0.85 + 0.15 * Math.sin(t * 0.3 + seed * 3);
  // Hazy smoke edge: two drifting, slightly larger copies.
  for (let j = 0; j < 2; j++) {
    const ox = Math.sin(t * 0.09 + seed + j * 2) * 2.5, oy = Math.cos(t * 0.07 + seed * 2 + j) * 2.5, s = 1.05 + 0.03 * j;
    b.draw(set.full.frame, cx + ox, cy + oy, W0 * s, H0 * s, 0, PAL.mid[0] * 0.4, 0, 0.02, 0.22 * alpha, 1);
  }
  b.draw(set.full.frame, cx, cy, W0, H0, 0, 0.6, 0.05, 0.08, 0.5 * alpha * flick, 0);
  b.draw(set.full.frame, cx, cy, W0, H0, 0, PAL.mid[0] * 0.5, 0, 0.02, 0.3 * alpha, 1);
  star(b, x, y, 18, 0.8 * alpha * flick, t * 0.08 + seed);
}

// ------------------------------------------------------------ special, bomb, ultimate

/**
 * The Void Crescent's shape: points along its arc (convex side forward) with
 * the outer rim (ox, oy), the outward normal, the band thickness and the band
 * middle (mx, my). dax.js uses the same points for its hits.
 */
export function crescentPts(c, n = 32) {
  const R = c.w * 0.5, d = c.w * 0.34, cx = c.x, cy = c.y + R * 0.6, out = [];
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI + 0.24 + (Math.PI - 0.48) * (k / n), nx = Math.cos(a), ny = Math.sin(a);
    const th = Math.max(3, d * -ny), ox = cx + nx * R, oy = cy + ny * R;
    out.push({ ox, oy, nx, ny, th, mx: ox - nx * th / 2, my: oy - ny * th / 2 });
  }
  return out;
}

/** Smoke and embers peeling off the crescent's inner edge (called each step). */
export function crescentSmoke(w, c) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard'), P = crescentPts(c, 16);
  for (let k = 0; k < 3; k++) {
    const q = P[R.int(1, P.length - 2)], ix = q.ox - q.nx * q.th, iy = q.oy - q.ny * q.th;
    const i = Hp.spawn(F.glow, ix + R.range(-8, 8), iy + R.range(-6, 6), -q.nx * 0.4 + R.range(-0.3, 0.3), 0.8 + R.range(0, 1), R.range(26, 40));
    if (i < 0) return;
    Hp.size(i, 12, R.range(34, 52)); Hp.color(i, 0.4, 0.02, 0.06, 0.04, 0, 0.01); Hp.phys(i, 0.96); Hp.look(i, 0.45, 0, FADE_INOUT);
  }
  if (R.next() < 0.7) {
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(sh, q.mx, q.my, q.nx * R.range(0.5, 1.5), 1 + R.range(0, 1), R.range(18, 30));
    if (i >= 0) { Hp.size(i, R.range(4, 9)); Hp.spin(i, R.range(0, 6), R.range(-0.2, 0.2)); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT); }
  }
  if (R.next() < 0.6) {
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(F.core, q.ox, q.oy, q.nx * 0.6, 0.6, R.range(14, 24));
    if (i >= 0) { Hp.size(i, R.range(2, 3.5)); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
  }
}

/** Void Crescent: a band of starry black space with a blazing red rim and star flares. */
export function renderCrescent(p, b) {
  const c = p.ps.crescent;
  if (!c) return;
  const F = p.F, t = p.t, P = crescentPts(c);
  const a = Math.min(1, c.t / 12) * (c.t > c.life - 30 ? (c.life - c.t) / 30 : 1);
  // Red haze around the band.
  for (let k = 0; k < P.length; k += 4) {
    const q = P[k];
    b.draw(F.glow, q.mx, q.my, q.th * 2.6 + 30, q.th * 2.6 + 30, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.3 * a, 1);
  }
  // Black void body.
  for (const q of P) b.draw(F.glow, q.mx, q.my, q.th * 2, q.th * 2, 0, DARK[0], DARK[1], DARK[2], 0.8 * a, 0);
  for (const q of P) b.draw(F.glow, q.mx, q.my, q.th * 1.4, q.th * 1.4, 0, DARK[0], DARK[1], DARK[2], 0.9 * a, 0);
  for (const q of P) b.draw(F.glow, q.mx, q.my, q.th, q.th, 0, DARK[0], DARK[1], DARK[2], 0.9 * a, 0);
  // Red nebula inside the void.
  for (let k = 0; k < 10; k++) {
    const q = P[Math.floor(hash(k * 2.3) * P.length)], d = q.th * (0.25 + 0.5 * hash(k * 5.1));
    const s = q.th * (0.6 + 0.6 * hash(k * 3.7));
    b.draw(F.glow, q.ox - q.nx * d, q.oy - q.ny * d, s, s, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.14 * a * (0.7 + 0.3 * Math.sin(t * 0.05 + k)), 1);
  }
  // Stars in the void.
  for (let k = 0; k < 46; k++) {
    const q = P[Math.floor(hash(k * 1.7 + 0.3) * P.length)], d = q.th * (0.12 + 0.76 * hash(k * 4.9));
    const sx = q.ox - q.nx * d, sy = q.oy - q.ny * d, tw = 0.5 + 0.5 * Math.sin(t * 0.25 + k * 1.3);
    if (k % 9 === 0) star(b, sx, sy, 12 + 6 * tw, a, t * 0.03 + k);
    else b.draw(F.core, sx, sy, 2.5 + 2 * hash(k), 2.5 + 2 * hash(k), 0, PAL.core[0], PAL.core[1], PAL.core[2], a * (0.4 + 0.6 * tw), 1);
  }
  // Blazing rim: red haze, red edge, white-hot line on the outside; a thin red inner edge.
  for (let k = 1; k < P.length; k++) {
    const q0 = P[k - 1], q1 = P[k], th = (q0.th + q1.th) / 2;
    const mx = (q0.ox + q1.ox) / 2, my = (q0.oy + q1.oy) / 2, len = Math.hypot(q1.ox - q0.ox, q1.oy - q0.oy) + 3, ang = Math.atan2(q1.oy - q0.oy, q1.ox - q0.ox);
    b.draw(F.laser, mx, my, len, 10 + th * 0.5, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * a, 1);
    b.draw(F.laser, mx, my, len, 4 + th * 0.16, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
    b.draw(F.laser, mx, my, len, 1.5 + th * 0.05, ang, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
    const ix0 = q0.ox - q0.nx * q0.th, iy0 = q0.oy - q0.ny * q0.th, ix1 = q1.ox - q1.nx * q1.th, iy1 = q1.oy - q1.ny * q1.th;
    b.draw(F.laser, (ix0 + ix1) / 2, (iy0 + iy1) / 2, Math.hypot(ix1 - ix0, iy1 - iy0) + 3, 3 + th * 0.06, Math.atan2(iy1 - iy0, ix1 - ix0), PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.55 * a, 1);
  }
  // The big star flares of the reference: one at the crown, two on the shoulders.
  const m = P[P.length >> 1];
  star(b, m.mx, m.my, 54 + 8 * Math.sin(t * 0.2), a, 0);
  star(b, m.ox, m.oy, 40, a, t * 0.02);
  for (const f of [0.25, 0.75]) {
    const q = P[Math.round(f * (P.length - 1))];
    star(b, q.mx, q.my, 34 + 8 * Math.sin(t * 0.17 + f * 9), a, 0);
  }
}

/** Void Rod Rain: falling glowing rods with long red trails. */
export function renderRods(p, b) {
  const F = p.F, rod = p.ps.fRod, glowA = crowdFactor(p.w);
  for (const r of p.ps.rods) {
    const L = r.big ? 96 : 70, wd = r.big ? 20 : 15, ang = Math.atan2(r.vy, r.vx), cx = r.x - Math.cos(ang) * L / 2, cy = r.y - Math.sin(ang) * L / 2;
    b.draw(F.laser, r.x - r.vx * 3, r.y - 70, 5, 130, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3 * glowA, 1);
    b.draw(rod, cx, cy, L * 1.08, wd * 1.6, ang, DARK[0], DARK[1], DARK[2], 0.85, 0);
    b.draw(rod, cx, cy, L, wd, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.95, 1);
    b.draw(rod, cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4, L * 0.85, wd * 0.35, ang, PAL.core[0], PAL.core[1], PAL.core[2], 1, 1);
    star(b, r.x, r.y, r.big ? 34 : 22, 1, r.x);
  }
}

/** Sparks and black shards thrown off the Void Cannon's walls (called each step). */
export function cannonSpray(w, x, y, wd) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard');
  for (let k = 0; k < 2; k++) {
    const s = R.next() < 0.5 ? -1 : 1, py = R.range(0, y);
    let i = Hp.spawn(sh, x + s * wd * 0.55, py, s * R.range(1, 3), R.range(-3, -1), R.range(18, 30));
    if (i >= 0) { Hp.size(i, R.range(5, 10)); Hp.spin(i, R.range(0, 6), R.range(-0.25, 0.25)); Hp.phys(i, 0.94); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT); }
    i = Hp.spawn(F.spark, x + s * wd * 0.5, R.range(0, y), s * R.range(2, 5), R.range(-4, -1), R.range(10, 16));
    if (i >= 0) { Hp.size(i, 6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.phys(i, 0.9); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
  }
  const i = Hp.spawn(F.glow, x + R.range(-wd * 0.4, wd * 0.4), y - R.range(0, 30), R.range(-1.5, 1.5), R.range(0.5, 1.5), R.range(20, 30));
  if (i >= 0) { Hp.size(i, 20, 50); Hp.color(i, 0.3, 0.0, 0.04, 0.03, 0, 0); Hp.phys(i, 0.95); Hp.look(i, 0.5, 0, FADE_INOUT); }
}

/**
 * Void Cannon, after ultimate-fx.png: a wide column of black cosmic void with
 * blazing red walls, red nebula and stars streaming up, black shards, a
 * white-hot core line, halo rings running up and a seal at the muzzle.
 */
export function renderCannon(p, b, x, y) {
  const u = p.ps.cannon;
  if (!u) return;
  const F = p.F, t = p.t, wd = u.w, a = u.fade, top = -30, len = y - top, my = (y + top) / 2, sh = p.ps.fShard;
  const up = -Math.PI / 2, flick = 0.92 + 0.08 * Math.sin(t * 0.9);
  b.draw(F.laser, x, my, len, wd * 2.6, up, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.55 * a, 1);
    for (let k = -4; k <= 4; k++) b.draw(F.laser, x + k * wd * 0.11, my, len, wd * 0.36, up, DARK[0], DARK[1], DARK[2], 0.85 * a, 0);
  // Red nebula clouds streaming up.
  for (let k = 0; k < 16; k++) {
    const sy = y - ((hash(k * 2.9) * len + t * (5 + 3 * hash(k))) % len), sx = x + (hash(k * 1.3) - 0.5) * wd * 0.7;
    const s = wd * (0.35 + 0.35 * hash(k * 7.7));
    b.draw(F.glow, sx, sy, s, s * 1.4, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.16 * a, 1);
  }
  // Black shards streaming up through it.
  if (sh) for (let k = 0; k < 26; k++) {
    const sy = y - ((hash(k * 3.1) * len + t * (8 + 8 * hash(k * 0.7))) % len), sx = x + (hash(k * 4.1) - 0.5) * wd;
    const s = 6 + 9 * hash(k * 2.2);
    b.draw(sh, sx, sy, s, s * 0.8, t * 0.05 * (hash(k) - 0.5) + k, DARK[0], DARK[1], DARK[2], 0.9 * a, 0);
  }
  // Stars.
  for (let k = 0; k < 30; k++) {
    const sy = y - ((hash(k * 3.7) * H + t * (3 + hash(k) * 4)) % len), sx = x + (hash(k * 1.9) - 0.5) * wd * 0.95;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.3 + k);
    if (k % 5 === 0) star(b, sx, sy, 10 + 12 * hash(k * 5.3), a * tw, k);
    else b.draw(F.core, sx, sy, 2.5 + 2 * hash(k), 2.5 + 2 * hash(k), 0, PAL.core[0], PAL.core[1], PAL.core[2], a * (0.3 + 0.7 * tw), 1);
  }
  // Blazing red walls.
  for (const s of [-1, 1]) {
    const ex = x + s * wd * 0.55;
    b.draw(F.laser, ex, my, len, 26, up, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.5 * a, 1);
    b.draw(F.laser, ex, my, len, 8 * flick, up, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.9 * a, 1);
    b.draw(F.laser, ex, my, len, 2.5, up, PAL.core[0], PAL.core[1], PAL.core[2], 0.6 * a, 1);
  }
  // White-hot core line.
  b.draw(F.laser, x, my, len, wd * 0.24, up, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * a, 1);
  b.draw(F.laser, x, my, len, wd * 0.08 * flick, up, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  // Halo rings running up.
  for (let k = 0; k < 5; k++) {
    const ry = y - ((k * 140 + t * 7) % (len + 40));
    b.draw(F.ring, x, ry, wd * 1.2, 30, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.4 * a, 1);
  }
  // The seal at the muzzle and the star crown around it.
  b.draw(F.glow, x, y, wd * 1.4, wd * 0.9, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * a, 1);
  b.draw(F.ring, x, y, wd * 1.1, 40, t * 0.05, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
  b.draw(F.ring, x, y + 8, wd * 0.8, 26, -t * 0.07, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * a, 1);
  star(b, x, y, wd * 1.1, a, t * 0.04);
  for (let k = 0; k < 6; k++) {
    const ang = Math.PI + (k / 5) * Math.PI, r = wd * 0.7;
    star(b, x + Math.cos(ang) * r, y + 10 + Math.sin(ang) * r * 0.35, 20 + 8 * Math.sin(t * 0.2 + k), a, k);
  }
}
