import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { daxArt, PAL, DARK } from './daxArt.js';
import { pilotArt } from '../core/pilotArt.js';
import { H } from './common.js';

// Dax's void-cosmic effects, after fx-reference.png, void-beams.png and
// ultimate-fx.png and the owner's picks (tools/art-ref/dax/): zigzag void
// beams (white core, red body, black smoke shards), red star flares, black
// shard bursts with red rings, dark-red smoke ghosts, a crescent of starry
// black space, the cosmic Void Cannon. Black parts are alpha-blended (add = 0)
// under the additive red. Render-time only: damage lives in dax.js.

const LOOK = daxArt.LOOK;
const fxOf = () => daxArt.frames().fx;
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

// The two beam picks are drawn many times per frame: they go in the shared
// atlas (no texture switches). The big picks are daxArt extras.
const PICK = { beam: ['fxBeam', 154, 21], bent: ['fxBent', 106, 32] };
let PICKS = {};
export const pick = (k) => PICKS[k] || daxArt.extra(k);

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
  PICKS = {};
  const images = pilotArt('dax')?.images || {};
  for (const [k, [key, w, h]] of Object.entries(PICK)) {
    const img = images[key];
    if (img) PICKS[k] = atlas.add(`dx_pick_${k}`, w, h, (c, cw, ch) => c.drawImage(img, 0, 0, cw, ch), { scale: 3 });
  }
}

const star = (b, x, y, s, a, rot = 0, c = PAL.core) => {
  const fx = fxOf();
  if (fx) b.draw(fx.flare, x, y, s, s, rot, c[0], c[1], c[2], a, 1);
};

// ------------------------------------------------------------ the void beam

/**
 * One void beam segment (x0, y0) → (x1, y1): a red additive glow under the
 * owner's zigzag beam art (alpha-blended so its black smoke reads).
 */
export function beamSeg(p, b, x0, y0, x1, y1, wd, a, glowA = 1) {
  const F = p.F, fr = pick('beam');
  const len = Math.hypot(x1 - x0, y1 - y0) + 4, ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, len, wd * 2.8, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.32 * a * glowA, 1);
  if (fr) b.draw(fr, mx, my, len, wd * 2.6, ang, 1, 1, 1, a, 0);
  else {
    b.draw(F.laser, mx, my, len, wd * 1.4, ang, DARK[0], DARK[1], DARK[2], 0.7 * a, 0);
    b.draw(F.laser, mx, my, len, wd * 0.8, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
  }
  b.draw(F.laser, mx, my, len, wd * 0.22, ang, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
}

/** Every live beam (strikes from the body, the ghost and its clones) and every interception arc. */
export function renderBeams(p, b) {
  const F = p.F, ps = p.ps, t = p.t, wm = LOOK.widthMul, glowA = LOOK.glowMul * crowdFactor(p.w), bent = pick('bent');
  for (const s of ps.bolts) {
    const a = 1 - s.t / s.life;
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      // Zigzag: a hop is split into two or three legs with a sideways kink (the FX sheet's lightning-like path).
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const kinks = L > 140 ? 2 : 1, pts = [[ax, ay]];
      for (let j = 1; j <= kinks; j++) {
        const f = j / (kinks + 1), o = (hash(s.s + k * 7.1 + j * 3.3 + (t >> 1)) - 0.5) * Math.min(60, L * 0.3);
        pts.push([ax + dx * f + nx * o, ay + dy * f + ny * o]);
      }
      pts.push([bx, by]);
      for (let j = 1; j < pts.length; j++) beamSeg(p, b, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], s.w * wm * (k === 1 ? 1 : 0.85), a, glowA);
      star(b, bx, by, s.w * 4.5, a, t * 0.1 + k);
      b.draw(F.glow, bx, by, s.w * 4, s.w * 4, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * a, 1);
    }
    if (s.pts.length) {
      const [x, y] = s.pts[0];
      b.draw(F.ring, x, y, s.w * 3.4, s.w * 3.4, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * a, 1);
      star(b, x, y, s.w * 3.6, a, t * 0.13);
    }
  }
  // Interception arcs: short bent beams that snap to enemy attacks and erase them.
  for (const c of ps.arcs) {
    const a = 1 - c.t / c.life, len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0) + 6, ang = Math.atan2(c.y1 - c.y0, c.x1 - c.x0);
    const mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2;
    if (bent) b.draw(bent, mx, my, len, 14 * wm, ang, 1, 1, 1, a, 0);
    else beamSeg(p, b, c.x0, c.y0, c.x1, c.y1, 5 * wm, a, glowA);
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
 * A dark-red smoke ghost of the mecha at (x, y): the full sprite tinted
 * void red and see-through, a red sheen, and the owner's smoke-ghost art
 * trailing behind it.
 */
export function renderGhost(p, b, x, y, alpha, seed = 0) {
  const K = daxArt.frames(), set = K.art && (K.art[LOOK.outline ? 'outline' : 'plain'] || K.art.outline);
  const F = p.F, t = p.t, smoke = pick('ghost');
  if (smoke) { // smoke trailing down behind the ghost (the sheet's smoke runs to the right: turn it a quarter)
    const sw = 62, sh = sw * (smoke.h / smoke.w), wob = Math.sin(t * 0.05 + seed) * 0.08;
    b.draw(smoke, x + 6, y + 22, sh, sw, Math.PI / 2 + wob, 1, 1, 1, 0.35 * alpha, 0);
  }
  b.draw(F.glow, x, y, 70, 80, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.28 * alpha, 1);
  if (!set) return;
  const A = daxArt.anchorData(), hb = A.anchors.hitbox, k = daxArt.unitsPerPx();
  const cx = x + (A.image.w / 2 - hb[0]) * k, cy = y + Math.sin(t * 0.07 + seed) * 1.2 + (A.image.h / 2 - hb[1]) * k;
  const flick = 0.85 + 0.15 * Math.sin(t * 0.3 + seed * 3);
  b.draw(set.full.frame, cx, cy, A.image.w * k, A.image.h * k, 0, 0.75, 0.08, 0.1, 0.55 * alpha * flick, 0);
  b.draw(set.full.frame, cx, cy, A.image.w * k, A.image.h * k, 0, PAL.mid[0] * 0.5, 0, 0.02, 0.35 * alpha, 1);
}

// ------------------------------------------------------------ special, bomb, ultimate

/** Void Crescent: the owner's cosmic crescent pick, convex side forward. */
export function renderCrescent(p, b) {
  const c = p.ps.crescent;
  if (!c) return;
  const F = p.F, fr = pick('crescent'), t = p.t;
  const a = Math.min(1, c.t / 12) * (c.t > c.life - 30 ? (c.life - c.t) / 30 : 1);
  b.draw(F.glow, c.x, c.y + 10, c.w * 1.3, c.w * 0.9, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.25 * a, 1);
  if (fr) b.draw(fr, c.x, c.y, c.w, c.w * (fr.h / fr.w), Math.sin(t * 0.04) * 0.03, 1, 1, 1, a, 0);
  else b.draw(F.ring, c.x, c.y, c.w, c.w * 0.7, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
  for (let k = 0; k < 6; k++) {
    const ang = -Math.PI / 2 + (k / 5 - 0.5) * 2.2, r = c.w * 0.42;
    star(b, c.x + Math.cos(ang) * r, c.y + 30 + Math.sin(ang) * r * 0.75, 10 + 8 * Math.sin(t * 0.2 + k), a, t * 0.05 + k);
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

/** Void Cannon: the owner's ultimate-fx.png scrolling up a wide beam. */
export function renderCannon(p, b, x, y) {
  const u = p.ps.cannon;
  if (!u) return;
  const F = p.F, fr = pick('ult'), t = p.t, wd = u.w, a = u.fade, top = -30, len = y - top, my = (y + top) / 2;
  b.draw(F.laser, x, my, len, wd * 2.2, -Math.PI / 2, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.35 * a, 1);
  b.draw(F.laser, x, my, len, wd * 1.2, -Math.PI / 2, DARK[0], DARK[1], DARK[2], 0.7 * a, 0);
  if (fr) {
    // Tiles of the picked art, scrolling up, slightly wider than the hit area.
    const tw = wd * 1.25, th = tw * (fr.h / fr.w), off = (t * 9) % th;
    for (let yy = y + th / 2 - off; yy - th / 2 > top - th; yy -= th) {
      b.draw(fr, x, yy, tw, th, 0, 1, 1, 1, a, 0);
      b.draw(fr, x, yy, tw, th, 0, 0.5, 0.1, 0.1, 0.35 * a, 1);
    }
  }
  b.draw(F.laser, x, my, len, wd * 0.16 * (0.8 + 0.2 * Math.sin(t * 0.7)), -Math.PI / 2, PAL.core[0], PAL.core[1], PAL.core[2], 0.85 * a, 1);
  // Ring halos running up, and the seal at the muzzle.
  for (let k = 0; k < 5; k++) {
    const ry = y - ((k * 140 + t * 7) % (len + 40));
    b.draw(F.ring, x, ry, wd * 1.2, 30, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.55 * a, 1);
  }
  b.draw(F.ring, x, y, wd * 1.1, 40, t * 0.05, PAL.core[0], PAL.core[1], PAL.core[2], 0.8 * a, 1);
  star(b, x, y, wd * 1.1, a, t * 0.04);
  for (let k = 0; k < 14; k++) { // cosmic sparkles drifting up the beam
    const sy = y - ((hash(k * 3.7) * H + t * (3 + hash(k) * 4)) % len), sx = x + (hash(k * 1.9) - 0.5) * wd;
    star(b, sx, sy, 8 + 10 * hash(k * 5.3), a * (0.5 + 0.5 * Math.sin(t * 0.3 + k)), k);
  }
}
