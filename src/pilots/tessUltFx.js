import { FADE_OUT, FADE_INOUT, FADE_FLICKER } from '../fx/Particles.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';
import {
  hash, CR_R, CR_M, CR_TW, CR_TH, CR_CY, crA, crTh, crescentAt, brush, spatter, crescentPts,
} from './miguerreFx.js';
import { TESS } from './tessTuning.js';

// TESS v2 ultimate FX: VOID CROSS ANNIHILATION (new-ultimate.png and the
// owner's guide). Her lover Miguerre Zo'Rajah's Crescent of Chaos (its shape and
// motion: miguerreFx.js's crescent helpers) in Tess's black / violet / lavender /
// white, crossed with a void spear, with a white-hot ringed core.
//
// Phases (tess.js stepUlt; U.ph): compress (the core gathers at Tess) →
// travel (the cross sweeps up the screen, annihilating what it touches) →
// crit (the wings curl in, the core goes black, then white) → boom (flash,
// plasma sphere, shock fronts, mushroom cloud, void halo, aftermath).
// No orange anywhere. All cosmetic: hits live in tess.js.

const VOID = [0.03, 0.0, 0.06];
const VIO = [1.1, 0.3, 2.0];
const DEEP = [0.5, 0.08, 1.0];
const LAV = [1.6, 1.15, 2.2];
const WHT = [2.3, 2.1, 2.5];
const SMOKE = [[0.05, 0.02, 0.08], [0.16, 0.12, 0.2], [0.3, 0.12, 0.45]];
const CLOUD = [[0.13, 0.07, 0.2], [0.34, 0.27, 0.44]]; // cloud lobes: shadowed underside, lit top
export const SQ = 0.62; // the wings are Miguerre's arch squashed flat: they read as the cross's bar (tess.js hits use it too)

// ------------------------------------------------------------- textures

/** The void crescent body (alpha-blended): Miguerre's ink-brush arch repainted black / violet / lavender. */
function bodyTex(ctx) {
  ctx.fillStyle = '#030006';
  for (let k = 0; k < 70; k++) {
    const u0 = hash(k * 1.9) * 0.75, span = 0.15 + 0.35 * hash(k * 2.3), v = -0.05 + 1.1 * hash(k * 4.7);
    brush(ctx, u0, Math.min(1, u0 + span), v, 10 + 26 * hash(k * 3.1), k * 11);
  }
  brush(ctx, 0, 1, 0.5, CR_R * 0.46 * 0.95, 7);
  const pass = (n, seed, vMin, vMax, wMin, wMax, colors) => {
    for (let k = 0; k < n; k++) {
      const h = seed + k * 5.13, u0 = hash(h) * 0.85, span = 0.06 + 0.3 * hash(h + 1.7);
      ctx.fillStyle = colors[k % colors.length];
      brush(ctx, u0, Math.min(1, u0 + span), vMin + (vMax - vMin) * hash(h + 3.3), wMin + (wMax - wMin) * hash(h + 4.4), h);
    }
  };
  pass(22, 100, 0.1, 1.0, 1.2, 5, ['rgba(60,0,110,0.8)', 'rgba(30,0,60,0.9)']);                       // deep violet currents
  pass(24, 200, 0.0, 0.55, 0.6, 2.6, ['rgba(160,60,255,0.9)', 'rgba(190,100,255,0.85)', 'rgba(120,30,230,0.9)']); // violet plasma
  pass(14, 260, 0.75, 1.05, 1, 4, ['rgba(150,50,250,0.85)']);                                          // violet inner edge
  pass(18, 300, -0.04, 0.16, 0.5, 2, ['rgba(250,240,255,0.95)', 'rgba(215,190,255,0.9)']);           // white-hot leading edge
  pass(6, 400, 0.3, 0.8, 0.5, 1.2, ['rgba(230,215,255,0.75)']);                                        // lavender streaks
  spatter(ctx, 120, 0, 1, CR_M - 4, '#040008', 11);
  spatter(ctx, 60, 0, 1, CR_M - 6, 'rgba(170,80,255,0.9)', 23);
  spatter(ctx, 30, 0, 1, 10, 'rgba(245,235,255,0.95)', 37);
  spatter(ctx, 70, 1, -1, 22, '#040008', 41);
  spatter(ctx, 30, 1, -1, 16, 'rgba(150,60,240,0.85)', 53);
  for (let k = 0; k < 40; k++) {
    const [x, y] = crescentAt(0.05 + 0.9 * hash(k * 1.37), 0.25 + 0.6 * hash(k * 4.91));
    ctx.fillStyle = `rgba(240,230,255,${0.5 + 0.5 * hash(k * 7)})`;
    ctx.beginPath(); ctx.arc(x, y, 0.4 + 0.7 * hash(k * 2.2), 0, Math.PI * 2); ctx.fill();
  }
}

/** The blazing leading edge (additive white, tinted when drawn): the same brush rim as Miguerre's. */
function rimTex(ctx) {
  ctx.save();
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  brush(ctx, 0, 1, 0.02, 5, 3);
  for (let k = 0; k < 16; k++) {
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

/**
 * The void spear (alpha-blended), pointing up: a long, sharp ragged blade of
 * black void with violet plasma streaks and a white cutting core; a shorter
 * tail below the core.
 */
function spearTex(ctx, w, h) {
  const cx = w / 2, core = h * 0.72;
  const half = (y) => (y < core ? (y / core) ** 1.25 : ((h - y) / (h - core)) ** 0.9) * (w * 0.32);
  const edge = (y, s, j) => cx + s * (half(y) + (hash(y * 0.37 + j) - 0.5) * 7 * (half(y) / (w * 0.32)));
  ctx.fillStyle = '#030006';
  ctx.beginPath();
  for (let y = 0; y <= h; y += 3) ctx.lineTo(edge(y, -1, 1), y);
  for (let y = h; y >= 0; y -= 3) ctx.lineTo(edge(y, 1, 9), y);
  ctx.closePath(); ctx.fill();
  // Ragged black flames off the sides.
  for (let k = 0; k < 26; k++) {
    const y = h * (0.12 + 0.8 * hash(k * 2.7)), s = k % 2 ? 1 : -1, x0 = cx + s * half(y) * 0.8, L = 6 + 14 * hash(k * 4.1);
    ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.lineTo(x0 + s * L, y + L * 0.9); ctx.lineTo(x0, y + 5); ctx.closePath(); ctx.fill();
  }
  const streak = (n, seed, col, wMax) => {
    ctx.strokeStyle = col;
    for (let k = 0; k < n; k++) {
      const y0 = h * hash(seed + k), L = 20 + 60 * hash(seed + k * 3.3), o = (hash(seed + k * 5.1) - 0.5) * 1.3;
      ctx.lineWidth = 0.6 + wMax * hash(seed + k * 7.7);
      ctx.beginPath();
      for (let j = 0; j <= 6; j++) { const y = Math.min(h, y0 + L * j / 6); ctx.lineTo(cx + o * half(y), y); }
      ctx.stroke();
    }
  };
  streak(26, 10, 'rgba(150,60,255,0.85)', 2.4);
  streak(14, 40, 'rgba(70,0,140,0.9)', 3);
  streak(10, 70, 'rgba(230,210,255,0.8)', 1.2);
  ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, h - 2); ctx.stroke(); ctx.restore();
}

/** A lumpy cauliflower smoke puff (alpha-blended greyscale, lit from above; tinted when drawn). */
function cloudTex(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w * 0.3;
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4, d = R * (0.35 + 0.55 * hash(k * 1.7)), r = R * (0.45 + 0.35 * hash(k * 3.1));
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.55, 'rgba(150,150,150,0.85)'); g.addColorStop(1, 'rgba(60,60,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy, R * 1.1);
  g.addColorStop(0, 'rgba(220,220,220,0.9)'); g.addColorStop(1, 'rgba(90,90,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.fill();
}

/** A small black void fragment (alpha-blended). */
function shardTex(ctx, w, h) {
  ctx.fillStyle = '#05000a';
  ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w, h * 0.7); ctx.lineTo(w * 0.35, h); ctx.lineTo(0, h * 0.45); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(170,90,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
}

/** Atlas textures for the ultimate (part of Tess's `sprites`). */
export function buildUltSprites(atlas) {
  atlas.add('tu_body', CR_TW, CR_TH, bodyTex, { scale: 1.5 });
  atlas.add('tu_rim', CR_TW, CR_TH, rimTex, { scale: 1 });
  atlas.add('tu_spear', 64, 260, spearTex, { scale: 1.5 });
  atlas.add('tu_cloud', 64, 64, cloudTex, { scale: 2 });
  atlas.add('tu_shard', 12, 12, shardTex, { scale: 2 });
}

const frames = (r) => ({ body: r.frame('tu_body'), rim: r.frame('tu_rim'), spear: r.frame('tu_spear'), cloud: r.frame('tu_cloud'), shard: r.frame('tu_shard') });

// ------------------------------------------------------------- helpers

const star = (b, F, x, y, s, a, rot = 0, c = WHT) => {
  b.draw(F.laser, x, y, s, s * 0.06, rot, c[0], c[1], c[2], a, 1);
  b.draw(F.laser, x, y, s, s * 0.06, rot + Math.PI / 2, c[0], c[1], c[2], a, 1);
  b.draw(F.glow, x, y, s * 0.3, s * 0.3, 0, c[0], c[1], c[2], a * 0.8, 1);
};

/** A glowing polyline (violet body, white core), additive. */
function streak(b, F, pts, wd, a, core = 0.35, c = VIO) {
  for (let j = 1; j < pts.length; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], L = Math.hypot(x1 - x0, y1 - y0) + 1.5, ang = Math.atan2(y1 - y0, x1 - x0);
    b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd * 2.6, ang, c[0], c[1], c[2], 0.6 * a, 1);
    b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd, ang, LAV[0], LAV[1], LAV[2], a, 1);
    if (core) b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd * core, ang, WHT[0], WHT[1], WHT[2], a, 1);
  }
}

/** Jagged lightning from (x, y) in direction ang (re-rolled by seed). */
function bolt(b, F, x, y, ang, len, seed, a, wd = 1.4) {
  const pts = [[x, y]];
  for (let j = 1; j <= 5; j++) {
    const aa = ang + (hash(seed + j * 1.7) - 0.5) * 1.4, L = len / 5;
    x += Math.cos(aa) * L; y += Math.sin(aa) * L;
    pts.push([x, y]);
  }
  streak(b, F, pts, wd, a, 0.4);
}

/** World point in the cross's crescent band (u along the arc, v across it, o outward), Miguerre's layout. */
function bandAt(U, w, u, v, o = 0) {
  const Rw = w * 0.5, cx = U.x, cy = U.y + Rw * CR_CY, ang = crA(u), r = Rw - crTh(u, Rw) * v + o;
  return [cx + Math.cos(ang) * r, U.y + (cy + Math.sin(ang) * r - U.y) * SQ];
}

// ------------------------------------------------------------- phases

/** The ringed white-hot core (s: scale, spin: ring speed, dark: 0..1 blacks it out). */
function drawCore(b, F, x, y, s, t, a, spin = 0.04, dark = 0) {
  const lit = 1 - dark;
  b.draw(F.glow, x, y, 150 * s, 150 * s, 0, DEEP[0], DEEP[1], DEEP[2], 0.35 * a * lit, 1);
  b.draw(F.glow, x, y, 80 * s, 80 * s, 0, LAV[0], LAV[1], LAV[2], 0.5 * a * lit, 1);
  for (let r = 0; r < 3; r++) {
    const ph = ((t * 0.03) + r / 3) % 1, sz = (24 + 60 * ph) * s;
    b.draw(F.ring, x, y, sz, sz, 0, VIO[0], VIO[1], VIO[2], 0.6 * (1 - ph) * a, 1);
  }
  b.draw(F.ring, x, y, 40 * s, 40 * s, t * spin, LAV[0], LAV[1], LAV[2], 0.8 * a, 1);
  b.draw(F.ring, x, y, 26 * s, 26 * s, -t * spin * 1.5, WHT[0], WHT[1], WHT[2], 0.7 * a, 1);
  star(b, F, x, y, (70 + 10 * Math.sin(t * 0.3)) * s, a * lit, 0, LAV);
  star(b, F, x, y, 40 * s, a * lit, Math.PI / 4 + t * spin);
  if (dark > 0) b.draw(F.glow, x, y, 34 * s, 34 * s, 0, VOID[0], VOID[1], VOID[2], dark * a, 0);
  b.draw(F.glow, x, y, 18 * s, 18 * s, 0, WHT[0], WHT[1], WHT[2], a * lit, 1);
  // Black-purple filaments crackling off it.
  const sd = (t / 3) | 0;
  for (let k = 0; k < 4; k++) bolt(b, F, x, y, hash(sd * 3.1 + k) * Math.PI * 2, (24 + 20 * hash(sd + k * 2.3)) * s, sd * 7 + k, 0.7 * a, 1.1 * s);
}

/** Compression at Tess: rings contract and spin faster, light streaks race inward. */
function renderCompress(b, F, U, t) {
  const k = Math.min(1, t / TESS.ult.compress), a = Math.min(1, t / 6);
  for (let r = 0; r < 3; r++) {
    const ph = ((t * (0.03 + 0.05 * k)) + r / 3) % 1, sz = (160 - 140 * ph) * (1 - 0.3 * k);
    b.draw(F.ring, U.x, U.y, sz, sz, 0, VIO[0], VIO[1], VIO[2], 0.55 * ph * a, 1);
  }
  for (let s = 0; s < 12; s++) {
    const ang = s / 12 * Math.PI * 2 + t * 0.05, ph = ((t * 0.06) + hash(s)) % 1, d = 110 * (1 - ph);
    const x = U.x + Math.cos(ang) * d, y = U.y + Math.sin(ang) * d;
    b.draw(F.laser, x, y, 26, 2, ang, LAV[0], LAV[1], LAV[2], 0.6 * ph * a, 1);
  }
  drawCore(b, F, U.x, U.y, 0.5 + 0.6 * k, t, a, 0.04 + 0.2 * k);
}

/**
 * The traveling cross: the void crescent wings (Miguerre's arch), the spear ahead
 * and its tail, the ringed core; a wake and wing ribbons trailing back to where
 * it launched, speed streaks, plasma currents racing along the wings toward the
 * spear, crescent shock fronts sweeping out ahead, lightning off the edges.
 * `curl` (crit) folds the wings in and shortens the spear.
 */
function renderCross(b, F, T, U, t, a, curl = 0) {
  const w = U.w * (1 - 0.65 * curl), Rw = w * 0.5, k = Rw / CR_R, cx = U.x, cy = U.y + Rw * CR_CY;
  const tx = cx, ty = U.y + (cy + (CR_TH / 2 - (CR_M + CR_R)) * k - U.y) * SQ, tw = CR_TW * k, th = CR_TH * k * SQ;
  const jitter = Math.sin(t * 0.9) * 0.8;
  // Envelope: violet light spill and a dark void halo.
  b.draw(F.glow, cx, U.y, w * 1.5, w * 1.1, 0, VOID[0], VOID[1], VOID[2], 0.45 * a, 0);
  for (let j = 0; j <= 8; j++) {
    const u = j / 8, [x, y] = bandAt(U, w, u, 0.3), s = crTh(u, Rw) * 1.6 + 60;
    b.draw(F.glow, x, y, s, s, 0, DEEP[0], DEEP[1], DEEP[2], (0.16 + 0.05 * Math.sin(t * 0.08 + j)) * a, 1);
  }
  if (!curl) {
    // Wake: a dark smear back to the launch point and violet ribbons off the wing tips.
    const back = Math.max(0, U.y0 - U.y);
    if (back > 4) {
      b.draw(F.glow, cx, U.y + back / 2 + 20, w * 0.5, back + 80, 0, VOID[0], VOID[1], VOID[2], 0.4 * a, 0);
      b.draw(F.laser, cx, U.y + back / 2, back, 10, Math.PI / 2, VIO[0], VIO[1], VIO[2], 0.35 * a, 1);
      b.draw(F.laser, cx, U.y + back / 2, back, 3, Math.PI / 2, WHT[0], WHT[1], WHT[2], 0.5 * a, 1);
      for (const u of [0.02, 0.98]) {
        const [x, y] = bandAt(U, w, u, 0.2);
        b.draw(F.laser, x, y + back * 0.35, back * 0.7, 6, Math.PI / 2, DEEP[0], DEEP[1], DEEP[2], 0.45 * a, 1);
      }
    }
    // Motion-blur copies trailing behind.
    b.draw(T.body, tx, ty + 20 * k, tw * 0.99, th, 0, 1, 1, 1, 0.3 * a, 0);
    for (const [dy, al] of [[46, 0.12], [22, 0.22]]) b.draw(T.rim, tx, ty + dy * k, tw, th, 0, VIO[0], VIO[1], VIO[2], al * a, 1);
    // Speed streaks.
    const sd = (t / 3) | 0;
    for (let s = 0; s < 16; s++) {
      const h = sd * 7.7 + s * 3.1, [x, y] = bandAt(U, w, 0.06 + 0.88 * hash(h), 0.05 + 0.3 * hash(h + 1)), L = (40 + 90 * hash(h + 2)) * k;
      b.draw(F.laser, x, y + L / 2, L, 2.2, Math.PI / 2, LAV[0], LAV[1], LAV[2], 0.45 * a * hash(h + 3), 1);
    }
    // Crescent shock fronts sweeping out ahead (one every 18 steps).
    for (let s = 0; s < 2; s++) {
      const ph = ((t / 18) + s / 2) % 1, sc = 1 + 0.35 * ph;
      b.draw(T.rim, tx, ty - 30 * ph * k, tw * sc, th * sc, 0, LAV[0], LAV[1], LAV[2], 0.35 * (1 - ph) * a, 1);
    }
  }
  // The spear ahead and its tail (behind the wings), with its white cutting core.
  const spL = (TESS.ult.spear + 90) * (1 - 0.8 * curl), spW = 72 * (1 - 0.4 * curl);
  b.draw(T.spear, cx + jitter, U.y - spL * 0.72 + spL / 2, spW, spL, 0, 1, 1, 1, a, 0);
  b.draw(F.laser, cx, U.y - spL * 0.36, spL * 0.9, 16, Math.PI / 2, VIO[0], VIO[1], VIO[2], 0.4 * a, 1);
  b.draw(F.laser, cx, U.y - spL * 0.36, spL * 0.88, 3, Math.PI / 2, WHT[0], WHT[1], WHT[2], 0.9 * a, 1);
  star(b, F, cx, U.y - spL * 0.72, 46 * (1 - curl), a, 0, WHT);
  // The wings.
  b.draw(T.body, tx + jitter, ty, tw, th, 0, 1, 1, 1, a, 0);
  // Plasma currents racing along the wings toward the spear.
  for (let s = 0; s < 20; s++) {
    const per = 26 + 22 * hash(s * 1.3), cyc = (t + hash(s * 3.1) * per) / per, ph = cyc % 1, n0 = cyc | 0;
    const dir = s % 2 ? 1 : -1, v = 0.04 + 0.8 * hash(s * 7.3 + n0 * 1.9), span = 0.05 + 0.08 * hash(s * 5.9 + n0);
    const uh = 0.5 + dir * (0.53 - 0.5 * ph), pts = [];
    for (let j = 0; j <= 4; j++) { const u = uh + dir * span * (j / 4); if (u > 0.01 && u < 0.99) pts.push(bandAt(U, w, u, v)); }
    if (pts.length > 1) streak(b, F, pts, (v < 0.3 ? 3.2 : 2.2) * k, Math.sin(Math.PI * ph) * a, v < 0.3 ? 0.45 : 0.25);
  }
  // Lightning off the edges.
  const ld = (t / 2) | 0;
  for (let s = 0; s < 6; s++) {
    const h = ld * 3.3 + s * 9.1, u = 0.06 + 0.88 * hash(h), [x, y] = bandAt(U, w, u, 0);
    bolt(b, F, x, y, crA(u) + (hash(h + 1) - 0.5), (16 + 24 * hash(h + 2)) * k + 6, h, 0.75 * a, 1.3);
  }
  // The blazing leading edge and the wing-tip flares.
  b.draw(T.rim, tx + jitter, ty, tw, th, 0, LAV[0], LAV[1], LAV[2], a * (0.5 + 0.12 * Math.sin(t * 0.5)), 1);
  // The crossbar: a white-hot line through the core from wing to wing.
  const bar = w * 1.04;
  b.draw(F.laser, cx, U.y, bar, 14, 0, VIO[0], VIO[1], VIO[2], 0.45 * a, 1);
  b.draw(F.laser, cx, U.y, bar * 0.98, 3.2, 0, WHT[0], WHT[1], WHT[2], 0.85 * a, 1);
  for (const sx of [-1, 1]) star(b, F, cx + sx * bar * 0.48, U.y, (40 + 8 * Math.sin(t * 0.3 + sx)) * (1 - curl * 0.7), a, 0, LAV);
  for (const u of [0.015, 0.985]) {
    const [x, y] = bandAt(U, w, u, 0.1);
    star(b, F, x, y, (48 + 10 * Math.sin(t * 0.2 + u * 9)) * k + 10, a, 0, LAV);
  }
}

/**
 * Critical compression: the wings curl in, the rings collapse in sequence,
 * the shell cracks with white-violet light; then the glow drops and the core
 * goes almost black inside a thin white rim; then it goes white.
 */
function renderCrit(b, F, T, U, t, k) {
  renderCross(b, F, T, U, t, 1 - 0.7 * k, Math.min(1, k * 1.2));
  b.draw(F.glow, U.x, U.y, 220 * (1 - 0.5 * k), 220 * (1 - 0.5 * k), 0, VOID[0], VOID[1], VOID[2], 0.6 * k, 0);
  for (let r = 0; r < 4; r++) {
    const kk = Math.max(0, Math.min(1, k * 1.6 - r * 0.15)), sz = (180 - 160 * kk);
    b.draw(F.ring, U.x, U.y, sz, sz, t * 0.2 * (r % 2 ? 1 : -1), LAV[0], LAV[1], LAV[2], 0.6 * (1 - kk * 0.7), 1);
  }
  const sd = (t / 2) | 0;
  for (let s = 0; s < 8; s++) bolt(b, F, U.x, U.y, s / 8 * Math.PI * 2 + hash(sd + s) * 0.4, 30 + 70 * k, sd * 5 + s, 0.8 * k, 1.5);
  const dark = k < 0.6 ? 0 : k < 0.88 ? Math.min(1, (k - 0.6) / 0.12) : 0;
  drawCore(b, F, U.x, U.y, 1.2 - 0.5 * k, t, 1, 0.05 + 0.3 * k, dark);
  if (dark > 0) b.draw(F.ring, U.x, U.y, 40, 40, 0, WHT[0], WHT[1], WHT[2], dark, 1);
  if (k > 0.88) {
    const f = (k - 0.88) / 0.12;
    b.draw(F.glow, U.x, U.y, 60 + 200 * f, 60 + 200 * f, 0, WHT[0], WHT[1], WHT[2], f, 1);
  }
}

/** The mushroom cloud's lobes: a deterministic lumpy layout around the cap and down the stem. */
const LOBES = Array.from({ length: 26 }, (_, k) => {
  const cap = k < 18, a = cap ? (k / 18) * Math.PI * 2 : 0;
  return cap
    ? { cap, dx: Math.cos(a) * (0.55 + 0.4 * hash(k * 1.3)), dy: Math.sin(a) * (0.35 + 0.25 * hash(k * 2.1)) - 0.1, s: 0.55 + 0.35 * hash(k * 3.7), spin: hash(k) * 6 }
    : { cap, dx: (hash(k * 5.1) - 0.5) * 0.3, dy: (k - 18) / 8, s: 0.35 + 0.15 * hash(k * 2.9), spin: hash(k * 7) * 6 };
});

/**
 * The detonation, bt steps in: the flash, the spherical shock front, the
 * expanding plasma sphere with void currents and fractures, the ground
 * shockwave, the towering mushroom cloud lit from inside, the fragmenting void
 * halo, lightning inside the cloud; it all fades over the ultimate's last steps.
 */
function renderBoom(b, F, T, U, bt, fade) {
  const x = U.x, y = U.y, t = U.t;
  // Initial flash.
  if (bt < 26) {
    const f = 1 - bt / 26;
    b.draw(F.glow, x, y, 300 + bt * 40, 300 + bt * 40, 0, WHT[0], WHT[1], WHT[2], f * fade, 1);
    for (let s = 0; s < 12; s++) b.draw(F.laser, x, y, 200 + bt * 30, 6 * f + 1, s / 12 * Math.PI + hash(s) * 0.2, LAV[0], LAV[1], LAV[2], 0.8 * f * fade, 1);
  }
  // Spherical shock front (fast) and ground-hugging shockwave (slower, thicker).
  const r1 = 30 + bt * 16;
  if (r1 < 1200) b.draw(F.ring, x, y, r1 * 2 / 0.86, r1 * 2 / 0.86, 0, WHT[0], WHT[1], WHT[2], Math.max(0, 0.7 - bt / 70) * fade, 1);
  const r2 = 20 + bt * 6.5;
  if (r2 < 1000) {
    const al = Math.max(0, 1 - bt / 150) * fade;
    b.draw(F.ring, x, y + 10, r2 * 2 / 0.86, r2 * 1.5 / 0.86, 0, VIO[0], VIO[1], VIO[2], 0.8 * al, 1);
    b.draw(F.ring, x, y + 10, r2 * 1.94 / 0.86, r2 * 1.44 / 0.86, 0, LAV[0], LAV[1], LAV[2], 0.5 * al, 1);
  }
  // Plasma sphere: grows, then cools into the cloud.
  const ps = Math.min(150, 20 + bt * 5), pa = (bt < 90 ? 1 : Math.max(0, 1 - (bt - 90) / 80)) * fade;
  if (pa > 0) {
    b.draw(F.glow, x, y, ps * 3.2, ps * 3.2, 0, DEEP[0], DEEP[1], DEEP[2], 0.6 * pa, 1);
    b.draw(F.glow, x, y, ps * 2.2, ps * 2.2, 0, VIO[0], VIO[1], VIO[2], 0.7 * pa, 1);
    b.draw(F.glow, x, y, ps * 1.3, ps * 1.3, 0, LAV[0], LAV[1], LAV[2], 0.8 * pa, 1);
    b.draw(F.glow, x, y, ps * 0.6, ps * 0.6, 0, WHT[0], WHT[1], WHT[2], pa, 1);
    // Void currents swirling over the sphere, and fractures.
    for (let s = 0; s < 6; s++) {
      const ang = s / 6 * Math.PI * 2 + bt * 0.03 * (s % 2 ? 1 : -1);
      b.draw(F.glow, x + Math.cos(ang) * ps * 0.55, y + Math.sin(ang) * ps * 0.55, ps * 0.7, ps * 0.22, ang + Math.PI / 2, VOID[0], VOID[1], VOID[2], 0.45 * pa, 0);
    }
    const sd = (bt / 3) | 0;
    for (let s = 0; s < 7; s++) bolt(b, F, x, y, hash(sd * 1.9 + s) * Math.PI * 2, ps * (0.6 + 0.5 * hash(sd + s)), sd * 9 + s, 0.8 * pa, 1.6);
  }
  // Mushroom cloud: the stem rises into a billowing cap.
  const grow = Math.min(1, bt / 110), rise = 30 + 60 * grow, capR = 36 + 64 * grow;
  const capX = x, capY = y - rise, ca = Math.min(1, bt / 20) * fade;
  if (ca > 0) {
    // Inner light under the cap and up the stem.
    b.draw(F.glow, capX, capY + capR * 0.2, capR * 2.6, capR * 1.6, 0, DEEP[0], DEEP[1], DEEP[2], 0.55 * ca, 1);
    b.draw(F.laser, x, (y + capY) / 2, rise + 20, 26 + 14 * grow, Math.PI / 2, VIO[0], VIO[1], VIO[2], 0.6 * ca, 1);
    b.draw(F.laser, x, (y + capY) / 2, rise, 7, Math.PI / 2, LAV[0], LAV[1], LAV[2], 0.7 * ca * (1 - 0.5 * grow), 1);
    for (const L of LOBES) {
      const lx = L.cap ? capX + L.dx * capR : x + L.dx * 40 * grow, ly = L.cap ? capY + L.dy * capR : y - L.dy * rise;
      const sz = (L.cap ? capR * 1.25 : 46 + 30 * grow) * L.s * (1 + 0.08 * Math.sin(t * 0.04 + L.spin));
      const c = L.cap && L.dy < 0 ? CLOUD[1] : CLOUD[0];
      b.draw(T.cloud, lx, ly, sz, sz, L.spin + t * 0.004, c[0], c[1], c[2], 0.92 * ca, 0);
    }
    // Lit edges and lightning inside the cloud.
    for (const L of LOBES) {
      if (!L.cap || L.dy < 0) continue;
      const lx = capX + L.dx * capR, ly = capY + L.dy * capR + capR * 0.15;
      b.draw(F.glow, lx, ly, capR * 0.8 * L.s, capR * 0.55 * L.s, 0, VIO[0], VIO[1], VIO[2], 0.45 * ca, 1);
    }
    const sd = (t / 3) | 0;
    for (let s = 0; s < 3; s++) {
      if (hash(sd * 4.1 + s) < 0.4) continue;
      bolt(b, F, capX + (hash(sd + s * 2.3) - 0.5) * capR * 1.4, capY + (hash(sd * 1.7 + s) - 0.5) * capR * 0.6, hash(sd + s * 5.1) * Math.PI * 2, capR * 0.5, sd * 13 + s, 0.7 * ca, 1.2);
    }
  }
  // Outer void halo: an irregular black-violet ring breaking into crescent blades that spiral out.
  const hr = 70 + bt * 3.2, ha = Math.max(0, 1 - bt / 220) * fade;
  if (ha > 0) for (let s = 0; s < 16; s++) {
    const ang = s / 16 * Math.PI * 2 + bt * 0.012 + hash(s) * 0.3, d = hr * (0.9 + 0.25 * hash(s * 3.3)) + (s % 3 === 0 ? bt * 1.5 : 0);
    const fx = x + Math.cos(ang) * d, fy = y + Math.sin(ang) * d * 0.85, sz = 36 + 30 * hash(s * 1.9);
    b.draw(T.rim, fx, fy, sz * 1.4, sz, ang + Math.PI / 2, VIO[0], VIO[1], VIO[2], 0.5 * ha, 1);
    b.draw(T.shard, fx, fy, sz * 0.4, sz * 0.4, ang + bt * 0.05, 1, 1, 1, 0.8 * ha, 0);
  }
}

/** Draw the ultimate (tess.js renderFx). */
export function renderUlt(p, b, U) {
  const F = p.F, T = frames(p.w.r), t = U.t;
  if (U.ph === 'compress') return renderCompress(b, F, U, t);
  if (U.ph === 'travel') {
    const k = (t - U.t0);
    renderCross(b, F, T, U, t, Math.min(1, 0.5 + k / 8));
    drawCore(b, F, U.x, U.y, 1.1, t, 1, 0.06);
    return;
  }
  if (U.ph === 'crit') return renderCrit(b, F, T, U, t, Math.min(1, (t - U.t0) / TESS.ult.crit));
  const fade = Math.min(1, (TESS.ult.dur - t) / 70);
  renderBoom(b, F, T, U, t - U.t0, Math.max(0, fade));
}

// ------------------------------------------------------------- events and particles

/** Launch: the flash, pressure rings and radial streaks, a distortion wave. */
export function launchFx(p, w, U) {
  U.y0 = U.y;
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  w.r.post.flash(0.8, 0.5, 1, 0.45, 0.06);
  w.r.post.shockwave(U.x, U.y, 0.05, 0.03, 0.5);
  w.r.post.aberrate(0.03);
  w.g.camera.addTrauma(0.45);
  for (let r = 0; r < 3; r++) {
    const i = Hp.spawn(F.ring, U.x, U.y, 0, 0, 20 + r * 6);
    if (i >= 0) { Hp.size(i, 20, 180 + r * 70); Hp.color(i, LAV[0], LAV[1], LAV[2], VIO[0] * 0.4, VIO[1] * 0.4, VIO[2] * 0.4); Hp.look(i, 0.8, 1, FADE_OUT); }
  }
  for (let k = 0; k < 18; k++) {
    const a = R.range(0, Math.PI * 2), s = R.range(6, 12);
    const i = Hp.spawn(F.spark, U.x, U.y, Math.cos(a) * s, Math.sin(a) * s, R.range(10, 18));
    if (i < 0) break;
    Hp.size(i, 10); Hp.color(i, WHT[0], WHT[1], WHT[2], VIO[0], VIO[1], VIO[2]); Hp.phys(i, 0.9); Hp.look(i, 1, 1, FADE_OUT, 1);
  }
}

/** An enemy caught by the cross: a white-violet flash, then it disintegrates (mid-bosses implode, then burst). */
export function annihilate(p, w, x, y, big, r = 14) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sh = w.r.frame('tu_shard'), s = big ? 2.4 : 1;
  let i = Hp.spawn(F.glow, x, y, 0, 0, big ? 18 : 10);
  if (i >= 0) { Hp.size(i, r * 3 * s, r * 5 * s); Hp.color(i, WHT[0], WHT[1], WHT[2], VIO[0], VIO[1], VIO[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  if (big) {
    i = Hp.spawn(F.ring, x, y, 0, 0, 16);
    if (i >= 0) { Hp.size(i, 220, 10); Hp.color(i, LAV[0], LAV[1], LAV[2], WHT[0], WHT[1], WHT[2]); Hp.look(i, 0.9, 1, FADE_OUT); } // implosion
    i = Hp.spawn(F.ring, x, y, 0, 0, 30);
    if (i >= 0) { Hp.size(i, 10, 260); Hp.color(i, VIO[0], VIO[1], VIO[2], 0.2, 0.02, 0.4); Hp.look(i, 0.8, 1, FADE_OUT); } // outward burst
    w.r.post.shockwave(x, y, 0.04, 0.03, 0.4);
    w.g.camera.addTrauma(0.3);
  }
  for (let k = 0; k < (big ? 26 : 9); k++) {
    const a = R.range(-Math.PI, 0) + R.range(-0.4, 0.4), sp = R.range(1, 4) * s; // carried forward, the way the cross travels
    i = Hp.spawn(k % 3 ? sh : F.core, x + R.range(-r, r), y + R.range(-r, r), Math.cos(a) * sp, Math.sin(a) * sp - 1, R.range(16, 30));
    if (i < 0) break;
    Hp.size(i, k % 3 ? R.range(3, 7) : R.range(2, 4));
    if (k % 3) { Hp.color(i, 1, 1, 1); Hp.spin(i, R.range(0, 6), R.range(-0.3, 0.3)); Hp.look(i, 0.9, 0, FADE_OUT); }
    else { Hp.color(i, LAV[0], LAV[1], LAV[2], VIO[0], VIO[1], VIO[2]); Hp.look(i, 1, 1, FADE_FLICKER); }
    Hp.phys(i, 0.95);
  }
  i = Hp.spawn(F.glow, x, y, 0, -0.6, 30);
  if (i >= 0) { Hp.size(i, r * 2 * s, r * 4 * s); Hp.color(i, SMOKE[0][0], SMOKE[0][1], SMOKE[0][2]); Hp.look(i, 0.5, 0, FADE_INOUT); }
}

/** Detonation: the flash that overpowers the screen, the shock waves, a hard shake. */
export function detonateFx(p, w, U) {
  U.boomX = U.x; U.boomY = U.y;
  w.r.post.flash(1, 0.9, 1, 1, 0.025);
  w.r.post.shockwave(U.x, U.y, 0.09, 0.02, 1.2);
  w.r.post.aberrate(0.05);
  w.r.post.heat(1);
  w.g.camera.addTrauma(1);
}

/** Smoke, debris and secondary FX for every phase (each step). */
export function ultParticles(p, w, U) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, t = U.t;
  const puff = (x, y, vx, vy, s0, s1, life, c, al = 0.6, rise = 0) => {
    const i = Hp.spawn(F.glow, x, y, vx, vy, life);
    if (i < 0) return;
    Hp.size(i, s0, s1); Hp.color(i, c[0], c[1], c[2]); Hp.phys(i, 0.96, rise); Hp.look(i, al, 0, FADE_INOUT);
  };
  if (U.ph === 'compress') {
    // Smoke and sparks pulled into the core.
    for (let k = 0; k < 3; k++) {
      const a = R.range(0, Math.PI * 2), d = R.range(70, 130), x = U.x + Math.cos(a) * d, y = U.y + Math.sin(a) * d;
      const i = Hp.spawn(k ? F.spark : F.glow, x, y, -Math.cos(a) * d / 14, -Math.sin(a) * d / 14, 14);
      if (i < 0) break;
      if (k) { Hp.size(i, 6); Hp.color(i, LAV[0], LAV[1], LAV[2], WHT[0], WHT[1], WHT[2]); Hp.look(i, 1, 1, FADE_OUT, 1); }
      else { Hp.size(i, 26, 6); Hp.color(i, SMOKE[0][0], SMOKE[0][1], SMOKE[0][2]); Hp.look(i, 0.5, 0, FADE_INOUT); }
    }
  } else if (U.ph === 'travel') {
    // Black vapour spiralling off the wings and stretching back; embers; a ripple now and then.
    const P = crescentPts({ x: U.x, y: U.y, w: U.w }, 16);
    for (const q of P) q.oy = U.y + (q.oy - U.y) * SQ;
    for (let k = 0; k < 5; k++) {
      const q = P[R.int(0, P.length - 1)], sw = R.range(-1, 1) * 1.3;
      puff(q.ox, q.oy, q.nx * 0.5 - q.ny * sw, q.ny * 0.5 + q.nx * sw + 1.6, R.range(14, 24), R.range(50, 90), R.range(30, 50), SMOKE[R.int(0, 2)], 0.55);
    }
    for (let k = 0; k < 3; k++) {
      const q = P[R.int(0, P.length - 1)];
      const i = Hp.spawn(F.core, q.ox, q.oy, q.nx * 1.5, q.ny * 1.5 + 1, R.range(14, 24));
      if (i < 0) break;
      Hp.size(i, R.range(2, 3.5)); Hp.color(i, LAV[0], LAV[1], LAV[2], VIO[0], VIO[1], VIO[2]); Hp.look(i, 1, 1, FADE_FLICKER);
    }
    if (t % 10 === 0) w.r.post.shockwave(U.x, U.y - 40, 0.015, 0.03, 0.25);
    if (t % 6 === 0) w.g.camera.addTrauma(0.08);
  } else if (U.ph === 'crit') {
    // Energy spiralling in; the shell's smoke boiling.
    for (let k = 0; k < 3; k++) {
      const a = R.range(0, Math.PI * 2), d = R.range(60, 140);
      const i = Hp.spawn(F.spark, U.x + Math.cos(a) * d, U.y + Math.sin(a) * d, -Math.cos(a + 0.5) * d / 10, -Math.sin(a + 0.5) * d / 10, 10);
      if (i < 0) break;
      Hp.size(i, 7); Hp.color(i, WHT[0], WHT[1], WHT[2], VIO[0], VIO[1], VIO[2]); Hp.look(i, 1, 1, FADE_OUT, 1);
    }
    puff(U.x + R.range(-50, 50), U.y + R.range(-40, 40), 0, 0, 30, 60, 24, SMOKE[0], 0.5);
    if (t % 8 === 0) w.g.camera.addTrauma(0.12);
  } else if (U.ph === 'boom') {
    const bt = t - U.t0, grow = Math.min(1, bt / 110), rise = 30 + 60 * grow, capR = 36 + 64 * grow;
    if (bt < 140) {
      // Turbulent cap: billows rolling out of the cap and curling.
      for (let k = 0; k < 3; k++) {
        const a = R.range(0, Math.PI * 2), d = capR * R.range(0.4, 1);
        const x = U.x + Math.cos(a) * d, y = U.y - rise + Math.sin(a) * d * 0.55;
        puff(x, y, Math.cos(a) * 0.8 - Math.sin(a) * 0.4, Math.sin(a) * 0.4 - 0.5, R.range(30, 50), R.range(80, 140), R.range(80, 140), SMOKE[R.int(0, 2)], 0.6);
      }
      // The stem.
      puff(U.x + R.range(-14, 14), U.y - R.range(0, rise), R.range(-0.3, 0.3), -0.8, 26, 60, R.range(60, 90), SMOKE[0], 0.6);
      // Debris lifted along the ground shockwave.
      const r2 = 20 + bt * 6.5;
      for (let k = 0; k < 4; k++) {
        const a = R.range(0, Math.PI * 2), x = U.x + Math.cos(a) * r2, y = U.y + 10 + Math.sin(a) * r2 * 0.75;
        if (x < -40 || x > WORLD_W + 40 || y < -40 || y > WORLD_H + 40) continue;
        puff(x, y, Math.cos(a) * 1.5, Math.sin(a) * 1.2 - 0.4, 18, 50, R.range(30, 50), SMOKE[1], 0.45);
      }
    }
    // Glowing fragments falling away; embers drifting (aftermath).
    if (bt < 300 && R.next() < 0.6) {
      const i = Hp.spawn(F.core, U.x + R.range(-capR, capR), U.y - rise + R.range(-capR * 0.5, capR * 0.5), R.range(-0.6, 0.6), R.range(0.2, 1), R.range(40, 80));
      if (i >= 0) { Hp.size(i, R.range(2, 4)); Hp.color(i, LAV[0], LAV[1], LAV[2], VIO[0], VIO[1], VIO[2]); Hp.phys(i, 0.99, 0.02); Hp.look(i, 1, 1, FADE_FLICKER); }
    }
    if (bt < 60 && bt % 6 === 0) w.g.camera.addTrauma(0.25 * (1 - bt / 60));
  }
}
