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
  crescentSprites(atlas);
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
    const a = 1 - s.t / s.life, pulse = 0.9 + 0.1 * Math.sin(t * 1.3 + s.s);
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      beamSeg(p, b, ax, ay, bx, by, s.w * wm * pulse, a, glowA);
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

// The crescent moon's shape, shared by the texture, the render and the hits
// (after the owner's crescent reference): an outer arc of radius R, convex
// side forward, sweeping a little past the horizontal on both sides; the band
// is thick at the crown (a touch heavier on the right, as in the reference)
// and runs out to needle-sharp tips.
const CR_E = 0.36;  // the tips sweep this far (rad) below the horizontal
const CR_D = 0.6;   // crown thickness / R
const CR_R = 150, CR_M = 18; // texture radius (logical px) and margin
const CR_TW = CR_R * 2 + CR_M * 2, CR_TH = Math.ceil(CR_R * (1 + Math.sin(CR_E)) + CR_M * 2);
const crA = (u) => -Math.PI - CR_E + (Math.PI + 2 * CR_E) * u;
const crTh = (u, R) => R * CR_D * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 1.6) * (0.8 + 0.4 * u);

/**
 * The Void Crescent's shape in the world: points along its arc with the outer
 * rim (ox, oy), the outward normal, the band thickness and the band middle
 * (mx, my), plus the circle centre (cx, cy) and radius R. dax.js uses the
 * same points for its hits.
 */
export function crescentPts(c, n = 32) {
  const R = c.w * 0.5, cx = c.x, cy = c.y + R * 0.6, out = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n, a = crA(u), nx = Math.cos(a), ny = Math.sin(a);
    const th = crTh(u, R), ox = cx + nx * R, oy = cy + ny * R;
    out.push({ u, ox, oy, nx, ny, th, mx: ox - nx * th / 2, my: oy - ny * th / 2, cx, cy, R });
  }
  return out;
}

/** Point in the band in texture space: u along the arc (0..1), v across it (0 = outer rim, 1 = inner edge). */
function crescentAt(u, v) {
  const a = crA(u), r = CR_R - crTh(u, CR_R) * v;
  return [CR_M + CR_R + Math.cos(a) * r, CR_M + CR_R + Math.sin(a) * r];
}

/** The crescent outline in texture space: outer arc, then the inner edge back (torn under the crown). */
function crescentPath(ctx, torn = true) {
  const n = 140;
  ctx.beginPath();
  for (let k = 0; k <= n; k++) {
    const [x, y] = crescentAt(k / n, 0);
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  for (let k = n; k >= 0; k--) {
    const u = k / n, crown = Math.max(0, Math.sin(Math.PI * (u - 0.2) / 0.6));
    const tear = torn && u > 0.2 && u < 0.8 && k % 2 ? crown * (0.04 + 0.12 * hash(k * 7.3)) : 0;
    const [x, y] = crescentAt(u, 1 - tear);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Body: black cosmic void, stars, faint violet nebula, red torn glow along the inner crown, sharp red rim (alpha-blended). */
function crescentBodyTex(ctx) {
  const cx = CR_M + CR_R, cy = CR_M + CR_R;
  crescentPath(ctx);
  const g = ctx.createRadialGradient(cx, cy, CR_R * (1 - CR_D), cx, cy, CR_R);
  g.addColorStop(0, '#5a000e'); g.addColorStop(0.18, '#140004'); g.addColorStop(0.4, '#030001');
  g.addColorStop(0.9, '#050002'); g.addColorStop(1, '#3a0009');
  ctx.fillStyle = g; ctx.fill();
  ctx.save();
  crescentPath(ctx); ctx.clip();
  const blob = (x, y, r, c0) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c0); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // Faint violet deep-space haze toward the heavy right side.
  for (let k = 0; k < 10; k++) {
    const [x, y] = crescentAt(0.45 + 0.45 * hash(k * 2.7), 0.2 + 0.5 * hash(k * 6.1));
    blob(x, y, 14 + 18 * hash(k * 3.3), 'rgba(80,30,110,0.22)');
  }
  // Red torn glow and splatter along the inner edge of the crown.
  for (let k = 0; k < 40; k++) {
    const u = 0.15 + 0.7 * hash(k * 4.3), [x, y] = crescentAt(u, 0.7 + 0.3 * hash(k * 1.7));
    blob(x, y, 4 + 14 * hash(k * 9.1), k % 3 ? 'rgba(150,5,22,0.45)' : 'rgba(200,40,55,0.32)');
  }
  // Thin red veins flowing along the arc.
  ctx.shadowColor = 'rgba(255,20,40,1)'; ctx.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const u0 = hash(k * 6.1) * 0.8, span = 0.08 + 0.2 * hash(k * 2.3), v = 0.15 + 0.8 * hash(k * 9.7), steps = 10;
    ctx.beginPath();
    for (let j = 0; j <= steps; j++) {
      const [x, y] = crescentAt(Math.min(1, u0 + span * j / steps), Math.min(0.97, Math.max(0.03, v + (hash(k * 13 + j) - 0.5) * 0.1)));
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.shadowBlur = 5; ctx.lineWidth = 0.5 + 1.1 * hash(k * 3.3);
    ctx.strokeStyle = k % 4 ? 'rgba(210,10,30,0.8)' : 'rgba(255,110,120,0.85)'; ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // Stars.
  for (let k = 0; k < 140; k++) {
    const [x, y] = crescentAt(hash(k * 1.37), 0.05 + 0.75 * hash(k * 4.91)), r = 0.3 + 0.9 * hash(k * 2.2) ** 2;
    ctx.fillStyle = k % 7 ? `rgba(255,235,240,${0.4 + 0.6 * hash(k * 7)})` : 'rgba(200,170,255,0.9)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Sharp dark-red rim outside (the glow is smoke now), a dim red line along the inner edge.
  ctx.save();
  ctx.shadowColor = 'rgba(120,0,15,1)'; ctx.shadowBlur = 3;
  ctx.beginPath();
  for (let k = 0; k <= 140; k++) {
    const [x, y] = crescentAt(k / 140, 0);
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#6a000e'; ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 0.7; ctx.strokeStyle = '#c0182a'; ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 140; k++) {
    const [x, y] = crescentAt(k / 140, 1);
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.shadowBlur = 4; ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(170,10,28,0.8)'; ctx.stroke();
  ctx.restore();
}

/** Rim: the white outer edge and its glow for the additive pass (tinted when drawn). */
function crescentRimTex(ctx) {
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k <= 140; k++) {
    const [x, y] = crescentAt(k / 140, 0);
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}

/** Atlas textures for the crescent (part of daxFxSprites). */
function crescentSprites(atlas) {
  atlas.add('dx_cres_body', CR_TW, CR_TH, crescentBodyTex, { scale: 1.5 });
  atlas.add('dx_cres_rim', CR_TW, CR_TH, crescentRimTex, { scale: 1 });
}

/**
 * The chaotic smoke around a crescent (called each step): black and red ink
 * smoke boiling off the rim, the tips and the hollow, swirling as it goes;
 * red wisps, black ink shards and embers. It drifts along with the crescent.
 */
export function crescentSmoke(w, c) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard'), P = crescentPts(c, 20);
  const drift = -1.8; // follows the crescent part of the way (it moves 3.2 a step)
  // Ink smoke: black, smoky grey and blood red (black alone vanishes on a dark stage).
  const INK = [[0.03, 0, 0.01, 0, 0, 0, 0.8], [0.34, 0.3, 0.32, 0.08, 0.05, 0.06, 0.62], [0.55, 0.02, 0.06, 0.12, 0, 0.02, 0.5]];
  const puff = (x, y, nx, ny, kind) => {
    const sw = R.range(-1, 1) * 1.2, out = R.range(0.2, 1.1); // swirl along the arc, push outwards
    const i = Hp.spawn(F.glow, x, y, nx * out - ny * sw, ny * out + nx * sw + drift, R.range(30, 50));
    if (i < 0) return;
    Hp.size(i, R.range(16, 26), R.range(60, 110)); Hp.phys(i, 0.95); Hp.spin(i, R.range(0, 6), R.range(-0.08, 0.08));
    const c = INK[kind];
    Hp.color(i, c[0], c[1], c[2], c[3], c[4], c[5]); Hp.look(i, c[6], 0, FADE_INOUT);
  };
  for (let k = 0; k < 8; k++) { // over the outer rim
    const q = P[R.int(0, P.length - 1)], o = R.range(0, 30);
    puff(q.ox + q.nx * o, q.oy + q.ny * o, q.nx, q.ny, k === 7 ? 2 : k % 2);
  }
  for (let k = 0; k < 2; k++) { // off the needle tips
    const q = P[R.chance(0.5) ? 1 : P.length - 2];
    puff(q.ox + R.range(-8, 8), q.oy + R.range(-8, 8), q.nx, q.ny, R.int(0, 1));
  }
  for (let k = 0; k < 3; k++) { // boiling in the hollow under the crown
    const q = P[R.int(4, P.length - 5)], d = q.th + R.range(10, q.R * 0.5);
    puff(q.ox - q.nx * d, q.oy - q.ny * d, -q.nx * 0.3, -q.ny * 0.3 + 0.4, R.int(0, 1));
  }
  if (R.next() < 0.7) { // red wisp (additive)
    const q = P[R.int(0, P.length - 1)], o = R.range(-10, 30);
    const i = Hp.spawn(F.glow, q.ox + q.nx * o, q.oy + q.ny * o, -q.ny * R.range(-1, 1), q.nx * R.range(-1, 1) + drift, R.range(20, 32));
    if (i >= 0) { Hp.size(i, 10, 40); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.phys(i, 0.95); Hp.look(i, 0.35, 1, FADE_INOUT); }
  }
  if (R.next() < 0.8) { // black ink shards flung off
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(sh, q.ox, q.oy, q.nx * R.range(0.8, 2.4), q.ny * R.range(0.8, 2.4) + drift, R.range(18, 30));
    if (i >= 0) { Hp.size(i, R.range(3, 8)); Hp.spin(i, R.range(0, 6), R.range(-0.3, 0.3)); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT); }
  }
  if (R.next() < 0.7) { // red embers
    const q = P[R.int(0, P.length - 1)];
    const i = Hp.spawn(F.core, q.ox, q.oy, q.nx * 1.2, q.ny * 1.2 + drift, R.range(14, 24));
    if (i >= 0) { Hp.size(i, R.range(2, 3.5)); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
  }
}

/** Red chaos crackling inside a band (re-rolled every few steps): short jagged red arcs. */
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

/** A red star seal (the reference's three seals): dark core, spinning red rings, a rotating four-point star, a pulsing heart. */
function seal(p, b, x, y, s, a, spin, flat = 1) {
  const F = p.F, t = p.t, pulse = 1 + 0.12 * Math.sin(t * 0.18 + x);
  b.draw(F.glow, x, y, s * 2.2, s * 2.2 * flat, 0, DARK[0], DARK[1], DARK[2], 0.75 * a, 0);
  b.draw(F.glow, x, y, s * 1.6, s * 1.2 * flat, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.35 * a, 1);
  b.draw(F.ring, x, y, s * 1.3 * pulse, s * 1.3 * pulse * flat, spin, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * a, 1);
  b.draw(F.ring, x, y, s * 0.75, s * 0.75 * flat, -spin * 1.6, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.9 * a, 1);
  star(b, x, y, s * 2.6 * pulse, a, spin * 0.5, PAL.hot);
  star(b, x, y, s * 1.1, 0.7 * a, -spin * 0.3 + Math.PI / 4, PAL.core);
  b.draw(F.glow, x, y, s * 0.35, s * 0.35, 0, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
}

/**
 * Living black chaos smoke (render-time, so it rides with the crescent and is
 * always moving): puffs born at (x, y) that boil out, grow and stream back
 * behind the launch, each with a faint red ember glow under the black.
 * `n` puffs, `spread` how far they wander, `back` how far they stream behind.
 */
function chaosSmoke(p, b, pts, n, seed, a, size = 1, back = 46, redEvery = 3) {
  const F = p.F, t = p.t;
  for (let k = 0; k < n; k++) {
    const h = seed * 7.13 + k * 3.71, ph = (t * (0.022 + 0.014 * hash(h)) + hash(h + 0.5)) % 1;
    const [x0, y0, nx, ny] = pts(hash(h + 1.3), k);
    const wob = Math.sin(t * 0.09 + h) * 6, out = ph * (8 + 14 * hash(h + 2.1));
    const x = x0 + nx * out - ny * wob, y = y0 + ny * out + nx * wob + ph * back;
    const s = (16 + 26 * hash(h + 3.3)) * size * (0.45 + ph), al = Math.sin(Math.PI * Math.min(1, ph * 1.15)) * a;
    const rot = h + t * 0.03 * (hash(h + 4.4) - 0.5);
    b.draw(F.glow, x, y, s * 1.6, s * 1.4, rot, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.1 * al, 1);
    if (redEvery && k % redEvery === 0) b.draw(F.glow, x, y, s * 1.1, s * 0.9, rot, 0.5, 0.02, 0.05, 0.85 * al, 0);
    else b.draw(F.glow, x, y, s * 1.1, s * 0.9, rot, DARK[0], DARK[1], DARK[2], al, 0);
  }
}

/**
 * One Void Crescent: a dark cosmic-void crescent moon whose edge is a living
 * band of black chaos smoke (the tips buried in black-red chaos flame), a
 * faint red ember glow, red chaos inside, and three dim star seals.
 */
function renderOneCrescent(p, b, c) {
  const F = p.F, t = p.t + c.x * 0.37, P = crescentPts(c, 24), Rw = c.w * 0.5, k = Rw / CR_R, cy0 = P[0].cy;
  const a = Math.min(1, c.t / 10) * (c.t > c.life - 30 ? Math.max(0, (c.life - c.t) / 30) : 1);
  const body = p.ps.fCresBody, rim = p.ps.fCresRim, seed = c.x * 0.13;
  const tx = c.x, ty = cy0 + (CR_TH / 2 - (CR_M + CR_R)) * k, tw = CR_TW * k, th = CR_TH * k;
  const inBand = (u, v) => {
    const q = P[Math.min(P.length - 1, Math.floor(u * P.length))];
    return [q.ox - q.nx * q.th * v, q.oy - q.ny * q.th * v, q.th];
  };
  const onRim = (u) => {
    const q = P[Math.min(P.length - 1, Math.floor(u * P.length))];
    return [q.ox, q.oy, q.nx, q.ny];
  };
  // A faint dark-red ember haze (kept low: the crescent is dark, not glowing).
  for (let j = 0; j < P.length; j += 4) {
    const q = P[j], br = 0.08 + 0.03 * Math.sin(t * 0.07 + j);
    b.draw(F.glow, q.mx, q.my, q.th * 2 + 50, q.th * 2 + 50, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], br * a, 1);
  }
  // Black smoke behind the moon, streaming back as it launches.
  chaosSmoke(p, b, (u) => { const [x, y, nx, ny] = onRim(u); return [x - nx * 20, y - ny * 20, nx, ny]; }, 14, seed + 1, a, 1.7, 70);
  const rot = Math.sin(t * 0.03) * 0.025;
  b.draw(body, tx, ty, tw, th, rot, 1, 1, 1, a, 0);
  // Dim nebula and stars drifting along the arc.
  for (let s = 0; s < 5; s++) {
    const u = (hash(s * 2.1) + t * 0.0018 * (1 + (s % 3))) % 1, [x, y, qt] = inBand(u, 0.25 + 0.5 * hash(s * 5.5));
    if (qt < 10) continue;
    const col = s % 3 === 0 ? [0.3, 0.1, 0.45] : PAL.edge;
    b.draw(F.glow, x, y, qt * 1.2, qt, 0, col[0], col[1], col[2], 0.12 * a, 1);
  }
  for (let s = 0; s < 16; s++) {
    const u = (hash(s * 1.7 + 0.3) + t * 0.0012 * (1 + hash(s))) % 1, [x, y, qt] = inBand(u, 0.15 + 0.6 * hash(s * 4.9));
    if (qt < 8) continue;
    const tw2 = 0.5 + 0.5 * Math.sin(t * 0.25 + s * 1.3);
    if (s % 8 === 0) star(b, x, y, 6 + 6 * tw2, 0.6 * a * tw2, t * 0.03 + s);
    else b.draw(F.core, x, y, 1.8 + 1.6 * tw2, 1.8 + 1.6 * tw2, 0, PAL.core[0], PAL.core[1], PAL.core[2], a * (0.25 + 0.5 * tw2), 1);
  }
  // Red chaos inside the band (dim).
  chaosCracks(p, b, (u, v) => inBand(0.15 + u * 0.7, 0.25 + 0.65 * v), (p.t >> 2) + c.x, 2, 0.55 * a, 0.7);
  // The rim: only a thin, faint red line now; the edge itself is smoke.
  b.draw(rim, tx, ty, tw, th, rot, PAL.mid[0], PAL.mid[1], PAL.mid[2], a * (0.12 + 0.04 * Math.sin(t * 0.4)), 1);
  // Glowing black chaos smoke boiling along the whole edge.
  chaosSmoke(p, b, onRim, 40, seed + 2, a, 1.4, 40);
  // The two tips buried in a dense knot of black and red smoke, so the points never show.
  for (const side of [0, 1]) {
    const tip = side ? P[P.length - 1] : P[0], q = side ? P[P.length - 4] : P[3];
    for (let j = 0; j < 3; j++) { // a steady, breathing core over the tip
      const f = j / 2, x = tip.ox + (q.ox - tip.ox) * f, y = tip.oy + (q.oy - tip.oy) * f + 6;
      const s = (58 - j * 8) * (1 + 0.08 * Math.sin(t * 0.11 + j + side * 2));
      b.draw(F.glow, x, y, s * 1.5, s * 1.4, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.08 * a, 1);
      b.draw(F.glow, x, y, s, s * 0.9, t * 0.01 + j, j === 1 ? 0.45 : DARK[0], j === 1 ? 0.02 : DARK[1], j === 1 ? 0.05 : DARK[2], 0.95 * a, 0);
    }
    chaosSmoke(p, b, (u) => {
      const f = u, x = tip.ox + (q.ox - tip.ox) * f, y = tip.oy + (q.oy - tip.oy) * f;
      return [x, y, tip.nx, tip.ny];
    }, 16, seed + 5 + side * 9, a, 1.7, 60, 3);
  }
  // Red streaks lashing through the smoke (dim, re-rolled often).
  chaosCracks(p, b, (u, v) => {
    const q = P[Math.min(P.length - 1, Math.floor(u * P.length))], o = 10 + 40 * v;
    return [q.ox + q.nx * o, q.oy + q.ny * o];
  }, (p.t / 3 | 0) + c.x * 3, 2, 0.45 * a, 0.9);
  // The crown star with its needle and the three seals in the hollow, kept dim.
  const m = P[P.length >> 1], R = P[0].R, sp = t * 0.04;
  const nx0 = c.x, ny0 = m.oy - 20, ny1 = cy0 + R * 0.25;
  b.draw(F.laser, nx0, (ny0 + ny1) / 2, ny1 - ny0, 4, Math.PI / 2, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.6 * a, 1);
  star(b, m.mx, m.my, 28 + 5 * Math.sin(t * 0.2), 0.6 * a, 0, PAL.mid);
  seal(p, b, c.x, cy0 - R * 0.28, 20 * k, 0.55 * a, sp);
  seal(p, b, c.x - R * 0.52, cy0 - R * 0.06, 14 * k, 0.5 * a, -sp * 1.3, 0.6);
  seal(p, b, c.x + R * 0.52, cy0 - R * 0.06, 14 * k, 0.5 * a, sp * 1.3, 0.6);
}

/** Every live Void Crescent (one, or three when cast in focus). */
export function renderCrescent(p, b) {
  for (const c of p.ps.crescents) renderOneCrescent(p, b, c);
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

/** Smoke, sparks and black shards thrown off a Void Cannon (called each step per cannon). */
export function cannonSpray(w, x, y, wd) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('dx_shard');
  for (let k = 0; k < 2; k++) {
    const s = R.next() < 0.5 ? -1 : 1, py = R.range(0, y);
    let i = Hp.spawn(sh, x + s * wd * 0.55, py, s * R.range(1, 3), R.range(-3, -1), R.range(18, 30));
    if (i >= 0) { Hp.size(i, R.range(5, 10)); Hp.spin(i, R.range(0, 6), R.range(-0.25, 0.25)); Hp.phys(i, 0.94); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT); }
    i = Hp.spawn(F.spark, x + s * wd * 0.5, R.range(0, y), s * R.range(2, 5), R.range(-4, -1), R.range(10, 16));
    if (i >= 0) { Hp.size(i, 6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.phys(i, 0.9); Hp.look(i, 1, 1, FADE_OUT, 0.5); }
  }
  // Black void smoke billowing inside and over the walls, red smoke rolling off the sides.
  for (let k = 0; k < 3; k++) {
    const i = Hp.spawn(F.glow, x + R.range(-wd * 0.55, wd * 0.55), R.range(-20, y), R.range(-1.2, 1.2), R.range(-2.5, -0.5), R.range(26, 40));
    if (i < 0) return;
    Hp.size(i, R.range(24, 40), R.range(60, 100)); Hp.color(i, 0.04, 0.0, 0.01, 0.0, 0, 0); Hp.phys(i, 0.95); Hp.spin(i, 0, R.range(-0.04, 0.04)); Hp.look(i, 0.55, 0, FADE_INOUT);
  }
  {
    const s = R.next() < 0.5 ? -1 : 1;
    const i = Hp.spawn(F.glow, x + s * wd * R.range(0.45, 0.65), R.range(0, y), s * R.range(0.4, 1.4), R.range(-1.5, -0.3), R.range(26, 40));
    if (i >= 0) { Hp.size(i, 20, R.range(50, 80)); Hp.color(i, 0.6, 0.03, 0.07, 0.1, 0, 0.02); Hp.phys(i, 0.95); Hp.look(i, 0.5, 0, FADE_INOUT); }
  }
  const i = Hp.spawn(F.glow, x + R.range(-wd * 0.4, wd * 0.4), y - R.range(0, 30), R.range(-1.5, 1.5), R.range(0.5, 1.5), R.range(20, 30));
  if (i >= 0) { Hp.size(i, 20, 50); Hp.color(i, 0.3, 0.0, 0.04, 0.03, 0, 0); Hp.phys(i, 0.95); Hp.look(i, 0.5, 0, FADE_INOUT); }
}

/**
 * Void Cannon, after ultimate-fx.png: a wide column of deep black void with
 * red chaos crackling through it, black tendrils twisting up, red nebula,
 * stars and black shards streaming up, torn red walls, a white-hot core line,
 * halo rings and a star-crowned seal at the muzzle. Smoke is cannonSpray.
 */
export function renderCannon(p, b, x, y, wd, a, seed = 0) {
  const F = p.F, t = p.t, top = -30, len = y - top, my = (y + top) / 2, sh = p.ps.fShard;
  const up = -Math.PI / 2, flick = 0.92 + 0.08 * Math.sin(t * 0.9 + seed);
  b.draw(F.laser, x, my, len, wd * 1.7, up, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.35 * a, 1);
  // Deep black void body.
  for (let k = -4; k <= 4; k++) b.draw(F.laser, x + k * wd * 0.11, my, len, wd * 0.36, up, DARK[0], DARK[1], DARK[2], 0.95 * a, 0);
  for (let k = -2; k <= 2; k++) b.draw(F.laser, x + k * wd * 0.15, my, len, wd * 0.3, up, DARK[0], DARK[1], DARK[2], 0.8 * a, 0);
  // Dim red nebula streaming up.
  for (let k = 0; k < 14; k++) {
    const sy = y - ((hash(k * 2.9 + seed) * len + t * (5 + 3 * hash(k))) % len), sx = x + (hash(k * 1.3 + seed) - 0.5) * wd * 0.8;
    const s = wd * (0.25 + 0.3 * hash(k * 7.7));
    b.draw(F.glow, sx, sy, s, s * 1.5, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.13 * a, 1);
  }
  // Black tendrils twisting up the column (the reference's dark ribbons).
  for (let r = 0; r < 3; r++) {
    const ph = r * 2.1 + seed, amp = wd * (0.22 + 0.08 * r), sp = 6 + r * 2;
    for (let yy = y; yy > top; yy -= 12) {
      const q = (y - yy + t * sp) * 0.018 + ph, xx = x + Math.sin(q) * amp, s = 16 + 8 * Math.sin(q * 1.7);
      b.draw(F.glow, xx, yy, s, s * 1.3, 0, DARK[0], DARK[1], DARK[2], 0.75 * a, 0);
    }
  }
  // Red chaos crackling through the void (re-rolled every 3 steps).
  chaosCracks(p, b, (u, v) => [x + (u - 0.5) * wd * 0.9, top + v * len], (t / 3 | 0) + seed * 31, 3 + (len / 200 | 0), a, 1.1);
  // Black shards streaming up through it.
  if (sh) for (let k = 0; k < 26; k++) {
    const sy = y - ((hash(k * 3.1 + seed) * len + t * (8 + 8 * hash(k * 0.7))) % len), sx = x + (hash(k * 4.1 + seed) - 0.5) * wd;
    const s = 6 + 9 * hash(k * 2.2);
    b.draw(sh, sx, sy, s, s * 0.8, t * 0.05 * (hash(k) - 0.5) + k, DARK[0], DARK[1], DARK[2], 0.9 * a, 0);
  }
  // Stars.
  for (let k = 0; k < 30; k++) {
    const sy = y - ((hash(k * 3.7 + seed) * H + t * (3 + hash(k) * 4)) % len), sx = x + (hash(k * 1.9 + seed) - 0.5) * wd * 0.95;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.3 + k);
    if (k % 5 === 0) star(b, sx, sy, 10 + 12 * hash(k * 5.3), a * tw, k);
    else b.draw(F.core, sx, sy, 2.5 + 2 * hash(k), 2.5 + 2 * hash(k), 0, PAL.core[0], PAL.core[1], PAL.core[2], a * (0.3 + 0.7 * tw), 1);
  }
  // Torn red walls: segments that waver.
  for (const s of [-1, 1]) {
    for (let yy = y; yy > top; yy -= 40) {
      const y1 = Math.max(top, yy - 40), j0 = Math.sin(yy * 0.05 + t * 0.4 + s + seed) * 5, j1 = Math.sin(y1 * 0.05 + t * 0.4 + s + seed) * 5;
      const x0 = x + s * wd * 0.55 + j0, x1 = x + s * wd * 0.55 + j1, L = Math.hypot(x1 - x0, y1 - yy) + 2, ang = Math.atan2(y1 - yy, x1 - x0);
      const mx = (x0 + x1) / 2, mmy = (yy + y1) / 2;
      b.draw(F.laser, mx, mmy, L, 24, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * a, 1);
      b.draw(F.laser, mx, mmy, L, 7 * flick, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.9 * a, 1);
      b.draw(F.laser, mx, mmy, L, 2.2, ang, PAL.core[0], PAL.core[1], PAL.core[2], 0.55 * a, 1);
    }
  }
  // White-hot core line.
  b.draw(F.laser, x, my, len, wd * 0.2, up, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.75 * a, 1);
  b.draw(F.laser, x, my, len, wd * 0.07 * flick, up, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  // Halo rings running up.
  for (let k = 0; k < 5; k++) {
    const ry = y - ((k * 140 + t * 7 + seed * 50) % (len + 40));
    b.draw(F.ring, x, ry, wd * 1.2, 30, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.4 * a, 1);
  }
  // The seal at the muzzle and the star crown around it.
  b.draw(F.glow, x, y, wd * 1.2, wd * 0.7, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.3 * a, 1);
  b.draw(F.ring, x, y, wd * 1.1, 34, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * a, 1);
  b.draw(F.ring, x, y + 8, wd * (0.75 + 0.1 * Math.sin(t * 0.2)), 24, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.7 * a, 1);
  star(b, x, y, wd * 0.8, 0.8 * a, t * 0.04);
  for (let k = 0; k < 6; k++) {
    const ang = Math.PI + (k / 5) * Math.PI, r = wd * 0.7;
    star(b, x + Math.cos(ang) * r, y + 10 + Math.sin(ang) * r * 0.35, 20 + 8 * Math.sin(t * 0.2 + k), a, k);
  }
}
