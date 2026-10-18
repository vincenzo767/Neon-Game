import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { seraArt, PAL, DARK, RIG_FX } from './seraArt.js';
import { rigState } from './seraRig.js';
import { W, H } from './common.js';

// Sera's ice FX (ASSET_NOTES.md, the owner's ice-mecha specification), all drawn
// live: faceted ice shards with white-cyan cores and frost wakes, crystal
// impacts, frost that builds up on enemies and ice casings when they freeze,
// the Zero Field (thin rotating rings, snowflake nodes, ice blades; bullets
// freeze and shatter at its edge), the Ice Storm Surge (a frost wave, wind
// spirals, erupting spikes, filaments), the Frost Arrow Rain, and Absolute Zero
// (fractures from a point, a screen-wide wave, crystal geometry, frost veins).
// Ice parts that should read as solid are alpha-blended; light is additive.
// Render-time only: damage and freezing live in sera.js.

const fxOf = () => seraArt.frames().fx;
export const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
const TAU = Math.PI * 2;
// Soft (non-HDR) ice tones for line work: HDR colours bloom thin lines into wide bands.
const SOFT = [0.55, 0.82, 1.0], PALE = [0.85, 0.95, 1.0];

// ------------------------------------------------------------ textures

/** A faceted ice shard pointing right, with a fading frost wake behind it. */
function shardTex(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.4, w * 0.6, h * 0.2);
  ctx.beginPath(); ctx.moveTo(w * 0.42, h / 2); ctx.lineTo(w * 0.6, 0.6); ctx.lineTo(w, h / 2); ctx.lineTo(w * 0.6, h - 0.6); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.5, h / 2); ctx.lineTo(w * 0.66, h * 0.3); ctx.lineTo(w, h / 2); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
}
/** A small hexagonal ice crystal with a bright facet. */
function crystalTex(ctx, w, h) {
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w * 0.85, h); ctx.lineTo(w * 0.15, h); ctx.lineTo(0, h * 0.3); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w / 2, h * 0.55); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.6; ctx.stroke();
}
/** A six-pointed snowflake. */
function flakeTex(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w * 0.46;
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU, ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
    ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    for (const f of [0.45, 0.72]) {
      const bx = cx + Math.cos(a) * R * f, by = cy + Math.sin(a) * R * f, L = R * 0.26 * (1.2 - f);
      ctx.lineWidth = 0.8;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + s * 0.8) * L, by + Math.sin(a + s * 0.8) * L); ctx.stroke(); }
    }
  }
}
/** A thin ice blade pointing up. */
function bladeTex(ctx, w, h) {
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w, h * 0.75); ctx.lineTo(w / 2, h); ctx.lineTo(0, h * 0.75); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
}
/** A translucent faceted ice casing (an enemy frozen solid). */
function casingTex(ctx, w, h) {
  const pts = [[0.5, 0], [0.95, 0.22], [1, 0.7], [0.62, 1], [0.2, 0.92], [0, 0.4]].map(([x, y]) => [x * w, y * h]);
  ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  const g = ctx.createRadialGradient(w * 0.45, h * 0.4, 1, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (const [a, b2] of [[0, 3], [1, 4], [5, 2]]) { ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(w * 0.48, h * 0.48); ctx.lineTo(...pts[b2]); ctx.stroke(); }
}
/** A big ice arrow pointing up (Frost Arrow Rain). */
function arrowTex(ctx, w, h) {
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g; ctx.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.7);
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w * 0.62, h * 0.26); ctx.lineTo(w * 0.62, h * 0.4); ctx.lineTo(w * 0.38, h * 0.4); ctx.lineTo(w * 0.38, h * 0.26); ctx.lineTo(0, h * 0.3); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w * 0.62, h * 0.26); ctx.lineTo(w / 2, h * 0.38); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
}
/** A tall ice spike pointing up. */
function spikeTex(ctx, w, h) {
  ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.62, h); ctx.lineTo(w * 0.42, h); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
}

/** A big dendrite snowflake: six arms with layered side branches, a hexagonal plate at its heart. */
function bigFlakeTex(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w * 0.48;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
  const arm = (a, len, wd, depth) => {
    const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
    ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    for (const f of [0.28, 0.46, 0.62, 0.78, 0.9]) {
      const bx = cx + Math.cos(a) * len * f, by = cy + Math.sin(a) * len * f, L = len * 0.36 * (1.05 - f) * (depth ? 1 : 0.6);
      for (const sd of [-1, 1]) {
        const ba = a + sd * 1.05, tx = bx + Math.cos(ba) * L, ty = by + Math.sin(ba) * L;
        ctx.lineWidth = wd * 0.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
        for (const g of [0.45, 0.75]) { // twigs on the branches
          const gx = bx + Math.cos(ba) * L * g, gy = by + Math.sin(ba) * L * g, l2 = L * 0.3;
          ctx.lineWidth = wd * 0.35; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(a) * l2, gy + Math.sin(a) * l2); ctx.stroke();
        }
      }
    }
    // A diamond tip.
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(a - 0.35) * len * 0.1, ey - Math.sin(a - 0.35) * len * 0.1);
    ctx.lineTo(ex - Math.cos(a) * len * 0.16, ey - Math.sin(a) * len * 0.16); ctx.lineTo(ex - Math.cos(a + 0.35) * len * 0.1, ey - Math.sin(a + 0.35) * len * 0.1); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
  };
  for (let k = 0; k < 6; k++) arm(k / 6 * TAU, R, w * 0.022, 1);
  for (let k = 0; k < 6; k++) arm((k + 0.5) / 6 * TAU, R * 0.42, w * 0.012, 0);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, x = cx + Math.cos(a) * R * 0.16, y = cy + Math.sin(a) * R * 0.16; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); ctx.lineWidth = w * 0.01; ctx.stroke();
}
/** A glacier crystal cluster: tall faceted prisms fanning up from a common root. */
function clusterTex(ctx, w, h) {
  const prisms = [[0, 1, 0.12], [-0.32, 0.72, 0.1], [0.3, 0.8, 0.1], [-0.6, 0.5, 0.08], [0.58, 0.55, 0.08], [-0.14, 0.6, 0.07], [0.15, 0.46, 0.07]];
  const bx = w / 2, by = h * 0.97;
  for (const [a, L, wd] of prisms) {
    const ux = Math.sin(a), uy = -Math.cos(a), len = h * 0.92 * L, half = w * wd;
    const tx = bx + ux * len, ty = by + uy * len, nx = -uy, ny = ux;
    ctx.beginPath();
    ctx.moveTo(bx + nx * half, by + ny * half); ctx.lineTo(bx + ux * len * 0.82 + nx * half, by + uy * len * 0.82 + ny * half);
    ctx.lineTo(tx, ty); ctx.lineTo(bx + ux * len * 0.82 - nx * half, by + uy * len * 0.82 - ny * half); ctx.lineTo(bx - nx * half, by - ny * half); ctx.closePath();
    const g = ctx.createLinearGradient(bx - nx * half, by - ny * half, bx + nx * half, by + ny * half);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0.45)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
}
/** Feathery frost (hoarfrost veins branching across a tile), for covering the screen. */
function frostTex(ctx, w, h) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  const vein = (x, y, a, len, wd, depth) => {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    ctx.globalAlpha = 0.35 + 0.4 * rnd(); ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    if (depth <= 0) return;
    for (let k = 1; k <= 3; k++) {
      const u = k / 4, px = x + (ex - x) * u, py = y + (ey - y) * u;
      vein(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + 0.4 * rnd()), len * 0.45, wd * 0.6, depth - 1);
    }
  };
  for (let k = 0; k < 9; k++) vein(rnd() * w, rnd() * h, rnd() * TAU, w * (0.25 + 0.25 * rnd()), 1.2, 2);
  ctx.globalAlpha = 1;
}

/** Atlas textures (part of sera.js `sprites`). */
export function seraFxSprites(atlas) {
  atlas.add('sv_shard', 30, 8, shardTex, { scale: 3 });
  atlas.add('sv_crystal', 10, 12, crystalTex, { scale: 3 });
  atlas.add('sv_flake', 18, 18, flakeTex, { scale: 3 });
  atlas.add('sv_blade', 6, 18, bladeTex, { scale: 3 });
  atlas.add('sv_casing', 26, 30, casingTex, { scale: 3 });
  atlas.add('sv_arrow', 14, 52, arrowTex, { scale: 3 });
  atlas.add('sv_spike', 10, 30, spikeTex, { scale: 3 });
  atlas.add('sv_bigflake', 96, 96, bigFlakeTex, { scale: 3 });
  atlas.add('sv_cluster', 64, 96, clusterTex, { scale: 3 });
  atlas.add('sv_frost', 96, 96, frostTex, { scale: 3 });
}

const fr = (p) => p.ps.fr;
const star = (b, x, y, s, a, rot = 0, c = PAL.core) => { const fx = fxOf(); if (fx) b.draw(fx.flare, x, y, s, s, rot, c[0], c[1], c[2], a, 1); };
const seg = (b, F, x0, y0, x1, y1, wd, c, a, add = 1) => {
  const L = Math.hypot(x1 - x0, y1 - y0) + 1;
  b.draw(F.laser, (x0 + x1) / 2, (y0 + y1) / 2, L, wd, Math.atan2(y1 - y0, x1 - x0), c[0], c[1], c[2], a, add);
};
/** A jagged crack / filament from (x0, y0) to (x1, y1), re-rolled by `seed`. */
function jag(b, F, x0, y0, x1, y1, n, amp, wd, c, a, seed, add = 1) {
  let px = x0, py = y0;
  const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
  for (let k = 1; k <= n; k++) {
    const u = k / n, j = k === n ? 0 : (hash(seed + k * 1.7) - 0.5) * amp;
    const x = x0 + (x1 - x0) * u + nx / L * j, y = y0 + (y1 - y0) * u + ny / L * j;
    seg(b, F, px, py, x, y, wd, c, a, add);
    px = x; py = y;
  }
}

// ------------------------------------------------------------ the bow and the shards

/**
 * Over the mecha (RIG_FX.overlay): the tensioned energy string from the limb
 * tips to the nock (brighter as it draws), the charge gathering at the nock,
 * the limbs' glow, the release flash, and cyan light flowing to the bow in focus.
 */
function rigOverlay(p, b, api) {
  const F = p.F, r = rigState(p), a = api.a, t = p.t;
  const [lx, ly] = api.at('stringL'), [rx, ry] = api.at('stringR'), [nx, ny] = api.at('nock');
  const k = 0.35 + 0.65 * r.draw + r.charge;
  for (const [x0, y0] of [[lx, ly], [rx, ry]]) {
    seg(b, F, x0, y0, nx, ny, 3.4, PAL.mid, 0.45 * k * a);
    seg(b, F, x0, y0, nx, ny, 1, PALE, 0.7 * k * a);
  }
  for (const n of ['limbL', 'limbR']) {
    const [x, y] = api.at(n);
    b.draw(F.glow, x, y, 26, 26, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], (0.15 + 0.35 * r.draw + 0.5 * r.charge) * a, 1);
  }
  // The arrow forming at the nock as the string draws.
  const g = 8 + 12 * r.draw + 20 * r.charge;
  b.draw(F.glow, nx, ny, g, g, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], (0.4 + 0.5 * r.draw) * a, 1);
  b.draw(F.core, nx, ny, 4 + 3 * r.draw, 4 + 3 * r.draw, 0, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
  if (r.kick > 0.05) { star(b, nx, ny - 4, 34 * r.kick, r.kick * a, t * 0.3); b.draw(F.glow, nx, ny - 6, 40 * r.kick, 40 * r.kick, 0, PAL.core[0], PAL.core[1], PAL.core[2], 0.6 * r.kick * a, 1); }
  // Focus / ultimate: cyan light runs along the riser to the bow.
  if (r.flare > 0.05) {
    const [gx, gy] = api.at('grip'), u = (t * 0.06) % 1;
    for (let j = 0; j < 3; j++) {
      const v = (u + j / 3) % 1, x = gx + (nx - gx) * v, y = gy + (ny - gy) * v;
      b.draw(F.glow, x, y, 12, 12, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * r.flare * a, 1);
    }
  }
}
RIG_FX.overlay = rigOverlay;

/**
 * The Frost Shards in flight (World renderShots hook): a frost wake, the pale
 * blue crystal body, an additive cyan glow and a white-hot core, vibrating a
 * little along their flight.
 */
export function renderShots(p, b, alpha, S) {
  const F = p.F, f = fr(p), t = p.t, glowA = crowdFactor(p.w);
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i] + Math.sin(t * 0.9 + i * 1.7) * 0.03, sc = S.scale[i], ux = Math.cos(ang), uy = Math.sin(ang);
    b.draw(F.laser, x - ux * 16 * sc, y - uy * 16 * sc, 30 * sc, 5 * sc, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * glowA, 1);
    b.draw(f.shard, x, y, 22 * sc, 7 * sc, ang, 0.55, 0.85, 1.0, 0.9, 0);
    b.draw(f.shard, x, y, 24 * sc, 9 * sc, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.5 * glowA, 1);
    b.draw(F.core, x + ux * 5 * sc, y + uy * 5 * sc, 5 * sc, 2.5 * sc, ang, PAL.core[0], PAL.core[1], PAL.core[2], 0.9, 1);
  }
}

/** A volley leaves the nock: a frost burst, a small ring, sparks and snow thrown forward. */
export function volleyFx(p, w, x, y) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  let i = Hp.spawn(F.glow, x, y - 4, 0, -0.5, 7);
  if (i >= 0) { Hp.size(i, 34, 14); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  i = Hp.spawn(F.ring, x, y - 4, 0, -0.6, 9);
  if (i >= 0) { Hp.size(i, 4, 26); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + R.range(-0.6, 0.6), sp = R.range(2, 5);
    i = Hp.spawn(F.spark, x, y - 4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 12));
    if (i < 0) return;
    Hp.size(i, 4); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.phys(i, 0.86); Hp.look(i, 1, 1, FADE_OUT, 0.5);
  }
}

/** Shard impact (World hitSpark hook): a crystal flash, radial ice splinters and a frost ring. */
export function hitSpark(w, x, y, angle) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, cr = w.r.frame('sv_crystal');
  let i = Hp.spawn(F.glow, x, y, 0, 0, 5);
  if (i >= 0) { Hp.size(i, 26, 10); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  i = Hp.spawn(F.ring, x, y, 0, 0, 10);
  if (i >= 0) { Hp.size(i, 4, 24); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  for (let k = 0; k < 3; k++) {
    const a = angle + R.range(-1.4, 1.4), sp = R.range(1.5, 4);
    i = Hp.spawn(cr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(10, 16));
    if (i < 0) return;
    Hp.size(i, R.range(3, 5)); Hp.spin(i, a, R.range(-0.3, 0.3)); Hp.phys(i, 0.9, 0.04);
    Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.9, 1, FADE_OUT);
  }
}

/** Ice shattering at (x, y) (bullets at the Zero Field's edge, frozen bullets, casings): a flash and crystal fragments. */
export function shatter(w, x, y, s = 1, flash = true) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, cr = w.r.frame('sv_crystal');
  let i;
  if (flash) {
    i = Hp.spawn(F.glow, x, y, 0, 0, 6);
    if (i >= 0) { Hp.size(i, 22 * s, 8 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  }
  for (let k = 0; k < 3 + 2 * s; k++) {
    const a = R.range(0, TAU), sp = R.range(1, 3.5) * Math.sqrt(s);
    i = Hp.spawn(cr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(10, 18));
    if (i < 0) return;
    Hp.size(i, R.range(2.5, 4.5) * Math.sqrt(s)); Hp.spin(i, a, R.range(-0.3, 0.3)); Hp.phys(i, 0.9, 0.05);
    Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.85, 1, FADE_OUT);
  }
}

/** Snow puffs (frost vapour) at (x, y). */
export function snow(w, x, y, n = 3, spread = 10, vy = 0.6) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < n; k++) {
    let i = Hp.spawn(F.core, x + R.range(-spread, spread), y + R.range(-spread, spread), R.range(-0.5, 0.5), R.range(-0.3, vy), R.range(20, 40));
    if (i < 0) return;
    Hp.size(i, R.range(1.5, 3)); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.phys(i, 0.98); Hp.look(i, 0.8, 1, FADE_INOUT);
    i = Hp.spawn(F.glow, x + R.range(-spread, spread), y + R.range(-spread, spread), R.range(-0.3, 0.3), R.range(-0.2, vy), R.range(20, 34));
    if (i < 0) return;
    Hp.size(i, 8, 22); Hp.color(i, 0.6, 0.8, 1.0, 0.3, 0.5, 0.8); Hp.phys(i, 0.97); Hp.look(i, 0.18, 1, FADE_INOUT);
  }
}

/** Exhaust hook (no thrusters): frost vapour and drifting crystals off the ice-blade wing tips. */
export function bladeVapour(p, w) {
  if (!seraArt.exhaust(p, w)) return false;
  const R = w.fxRng;
  if (R.next() < 0.4) {
    const [x, y] = seraArt.animatedAnchor(p, ['bladeL', 'bladeR', 'lowL', 'lowR'][Math.floor(R.next() * 4)]);
    snow(w, x, y, 1, 4, 1.4);
  }
  return true;
}

// ------------------------------------------------------------ frost on enemies

/**
 * Frost on enemies (render): a cold glow and ice crystals that grow with their
 * frost; frozen solid, a translucent ice casing with a snowflake and an inner
 * blue glow, cracking in its last steps.
 */
export function renderFrost(p, b) {
  const F = p.F, f = fr(p), t = p.t;
  for (const e of p.ps.frosty) {
    if (!e.alive) continue;
    const r = e.r || 12, fz = e.frozenT || 0, k = e.frost || 0, s = (e.uid || 0) * 1.37;
    if (k > 0.02 && !fz) {
      b.draw(F.glow, e.x, e.y, r * 2.8, r * 2.8, 0, 0.5, 0.75, 1.0, 0.35 * k, 1);
      const n = Math.ceil(k * 7);
      for (let j = 0; j < n; j++) {
        const a = hash(s + j) * TAU, d = r * (0.55 + 0.4 * hash(s + j * 3)), sz = (3 + 5 * k) * (0.7 + 0.5 * hash(s + j * 5));
        b.draw(f.crystal, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, sz, sz * 1.2, a + Math.PI / 2, 0.75, 0.9, 1.0, 0.75, 0);
        b.draw(f.crystal, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, sz * 0.7, sz * 0.84, a + Math.PI / 2, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.35, 1);
      }
    }
    if (fz > 0) {
      const grow = Math.min(1, (e.iceAge || 0) / 8 + 0.2), pulse = 0.8 + 0.2 * Math.sin(t * 0.08 + s);
      const cw = r * 2.7 * grow, ch = r * 3.0 * grow;
      b.draw(F.glow, e.x, e.y, cw * 1.2, ch * 1.2, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.5 * pulse, 1);
      b.draw(f.casing, e.x, e.y, cw, ch, hash(s) * 0.6 - 0.3, 0.7, 0.88, 1.0, 0.6, 0);
      b.draw(f.casing, e.x, e.y, cw, ch, hash(s) * 0.6 - 0.3, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.35, 1);
      b.draw(f.flake, e.x + r * 0.2, e.y - r * 0.2, r * 1.1, r * 1.1, t * 0.01 + s, PAL.core[0], PAL.core[1], PAL.core[2], 0.5 * pulse, 1);
      if (fz < 24 && !e.held) { // cracks before the casing breaks
        const c = 1 - fz / 24;
        for (let j = 0; j < 3; j++) {
          const a = hash(s + j * 7) * TAU;
          jag(b, F, e.x, e.y, e.x + Math.cos(a) * cw * 0.5, e.y + Math.sin(a) * ch * 0.5, 3, 5, 1, PALE, 0.8 * c, s + j);
        }
      }
    }
  }
}

// ------------------------------------------------------------ the Zero Field

/**
 * The Zero Field round her (renderAbove): thin cyan rings rotating at
 * different speeds, ice blades and snowflake nodes round the edge, a clear
 * centre; each interception flashes at its contact point and a ripple runs
 * round the ring from there.
 */
export function renderField(p, b, x, y, a) {
  const zf = p.ps.zf;
  if (!zf || zf.r < 4) return;
  const F = p.F, f = fr(p), t = p.t, R = zf.r, glow = crowdFactor(p.w), up = zf.up;
  // Thin layered rings drawn as line segments (dashed inside), each turning at its own speed.
  const ring = (rad, wd, al, rot, c = PAL.hot, dash = 1) => {
    const n = 48;
    for (let k = 0; k < n; k += dash) {
      const a0 = k / n * TAU + rot, a1 = (k + 1) / n * TAU + rot, ripple = 1 + 0.012 * Math.sin(t * 0.15 + k * 0.9);
      seg(b, F, x + Math.cos(a0) * rad * ripple, y + Math.sin(a0) * rad * ripple, x + Math.cos(a1) * rad * ripple, y + Math.sin(a1) * rad * ripple, wd, c, al * a);
    }
  };
  ring(R, 2.2, 0.32 + 0.2 * up, t * 0.004);
  ring(R, 0.9, 0.6 + 0.2 * up, t * 0.004, PAL.core);
  ring(R * 0.93, 1.2, 0.25 + 0.15 * up, -t * 0.007, PAL.mid, 2);
  ring(R * 0.62, 1, 0.1 + 0.08 * up, t * 0.011, PAL.mid, 3);
  // Ice blades pointing out round the edge (12, rotating slowly), alternating sizes.
  for (let k = 0; k < 12; k++) {
    const an = k / 12 * TAU + t * 0.006, bx = x + Math.cos(an) * R, by = y + Math.sin(an) * R, L = (k & 1 ? 9 : 14) * (1 + 0.3 * up);
    b.draw(f.blade, bx, by, 4, L, an + Math.PI / 2, 0.75, 0.9, 1.0, 0.55 * a, 0);
    b.draw(f.blade, bx, by, 3, L * 0.85, an + Math.PI / 2, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.5 * a * glow, 1);
  }
  // Six crystal nodes with snowflakes, counter-rotating.
  for (let k = 0; k < 6; k++) {
    const an = k / 6 * TAU - t * 0.009, nx = x + Math.cos(an) * R * 0.93, ny = y + Math.sin(an) * R * 0.93;
    b.draw(F.glow, nx, ny, 14, 14, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * a * glow, 1);
    b.draw(f.flake, nx, ny, 11 + 3 * up, 11 + 3 * up, t * 0.03 + k, PAL.core[0], PAL.core[1], PAL.core[2], 0.7 * a, 1);
  }
  // Interceptions: a flash at the contact point and a ripple running round the ring.
  for (const h of zf.hits) {
    const age = t - h.t, k = 1 - age / 22;
    if (k <= 0) continue;
    if (age < 8) {
      b.draw(F.glow, h.x, h.y, 22, 22, 0, PAL.core[0], PAL.core[1], PAL.core[2], (1 - age / 8) * a, 1);
      b.draw(f.crystal, h.x, h.y, 7, 8, h.a + Math.PI / 2, PAL.core[0], PAL.core[1], PAL.core[2], (1 - age / 8) * a, 1);
    }
    const spread = age * 0.045;
    for (const s of [-1, 1]) {
      const an = h.a + s * spread;
      b.draw(F.glow, x + Math.cos(an) * R, y + Math.sin(an) * R, 12, 12, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6 * k * a, 1);
    }
  }
  // Focus: the expansion ripple racing out to the new edge.
  if (zf.pulse > 0) ring(zf.pulseR, 2.4, 0.8 * zf.pulse, 0, PAL.core);
}

/** A few snowflakes drifting off the field's edge (each step). */
export function fieldSnow(p, w) {
  const zf = p.ps.zf, R = w.fxRng;
  if (!zf || R.next() > 0.25) return;
  const an = R.range(0, TAU);
  snow(w, p.x + Math.cos(an) * zf.r, p.y + Math.sin(an) * zf.r, 1, 3, 0.4);
}

// ------------------------------------------------------------ Ice Storm Surge

/**
 * The storm (render): a ground frost disc and a blazing frost ring at the
 * wave front, spiralling bands of icy wind, ice spikes erupting where the wave
 * passes, and frost filaments flickering between them.
 */
export function renderStorm(p, b) {
  const st = p.ps.storm;
  if (!st) return;
  const F = p.F, f = fr(p), t = p.t, r = st.r, fade = st.t > st.life - 30 ? Math.max(0, (st.life - st.t) / 30) : 1;
  b.draw(F.glow, st.x, st.y, r * 2.2, r * 2.2, 0, 0.3, 0.55, 0.9, 0.09 * fade, 1);
  if (st.t < 40) {
    // The frost wave front: a thin bright ring of segments with frost crystals riding it.
    const k = 1 - st.t / 40;
    for (let j = 0; j < 64; j++) {
      const a0 = j / 64 * TAU, a1 = (j + 1) / 64 * TAU, rr = r * (1 + 0.02 * Math.sin(j * 1.9 + st.t));
      seg(b, F, st.x + Math.cos(a0) * rr, st.y + Math.sin(a0) * rr, st.x + Math.cos(a1) * rr, st.y + Math.sin(a1) * rr, 3, PALE, 0.7 * k, 1);
      if (j % 4 === 0) b.draw(f.crystal, st.x + Math.cos(a0) * rr, st.y + Math.sin(a0) * rr, 7, 8, a0 + Math.PI / 2, PALE[0], PALE[1], PALE[2], 0.8 * k, 1);
    }
  }
  // Icy wind spirals round her.
  for (let j = 0; j < 4; j++) {
    const base = st.t * (0.06 + 0.015 * j) * (j & 1 ? -1 : 1) + j * 1.6;
    let px = 0, py = 0;
    for (let k = 0; k <= 16; k++) {
      const u = k / 16, rad = r * (0.18 + 0.75 * u) * (0.6 + 0.12 * j), an = base + u * 2.6 * (j & 1 ? -1 : 1);
      const x = st.x + Math.cos(an) * rad, y = st.y + Math.sin(an) * rad;
      if (k) seg(b, F, px, py, x, y, 3 + 4 * u, SOFT, 0.1 * fade * Math.sin(u * Math.PI), 1);
      px = x; py = y;
    }
  }
  // Erupting ice spikes and filaments between them.
  let prev = null;
  for (const s of st.spikes) {
    if (s.t0 < 0) continue;
    const g = Math.min(1, (st.t - s.t0) / 6), h = s.h * g;
    b.draw(f.spike, s.x, s.y - h / 2, s.w, h, s.rot, 0.7, 0.88, 1.0, 0.75 * fade, 0);
    b.draw(f.spike, s.x, s.y - h / 2, s.w * 0.7, h * 0.95, s.rot, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.5 * fade, 1);
    b.draw(F.glow, s.x, s.y, s.w * 3, s.w * 1.5, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * fade, 1);
    // Frost filaments flicker between neighbouring spikes (not across the whole storm).
    if (prev && Math.hypot(prev.x - s.x, prev.y - s.y) < 140 && (t + s.n) % 4 < 2) jag(b, F, prev.x, prev.y - prev.h * 0.5, s.x, s.y - h * 0.5, 5, 8, 1, PALE, 0.3 * fade, Math.floor(t / 3) + s.n);
    prev = s;
  }
}

/** The storm's particles each step: snow and shards swirling over the area, rising and falling. */
export function stormParticles(p, w) {
  const st = p.ps.storm, Hp = w.fxHigh, R = w.fxRng, cr = w.r.frame('sv_crystal');
  if (!st || st.t > st.life - 20) return;
  for (let k = 0; k < 3; k++) {
    const an = R.range(0, TAU), d = R.range(0.2, 1) * st.r, x = st.x + Math.cos(an) * d, y = st.y + Math.sin(an) * d, tg = an + Math.PI / 2;
    const i = Hp.spawn(cr, x, y, Math.cos(tg) * 2.2, Math.sin(tg) * 2.2 + R.range(-1, 1), R.range(16, 28));
    if (i < 0) return;
    Hp.size(i, R.range(2.5, 5)); Hp.spin(i, an, R.range(-0.2, 0.2)); Hp.phys(i, 0.97);
    Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.8, 1, FADE_INOUT);
    snow(w, x, y, 1, 6, 0.4);
  }
}

/** The wave reaches an enemy: a burst of snow and crystals where it touches. */
export function freezeBurst(w, e) {
  shatter(w, e.x, e.y, 1.4);
  snow(w, e.x, e.y, 4, e.r || 12, 0.2);
}

// ------------------------------------------------------------ Frost Arrow Rain

/** The falling arrows (render): a frost streak back up the sky, the ice arrow, a cold glow; an icy cloud bank above. */
export function renderRain(p, b) {
  const ps = p.ps;
  if (!ps.rain) return;
  const F = p.F, f = fr(p), glowA = crowdFactor(p.w);
  if (ps.sky > 0) {
    for (let k = 0; k < 6; k++) {
      const x = (k + 0.5) / 6 * W + Math.sin(p.t * 0.02 + k) * 14;
      b.draw(F.glow, x, 10, 160, 80, 0, 0.35, 0.6, 1.0, 0.12 * ps.sky, 1);
      b.draw(F.glow, x, 0, 140, 60, 0, DARK[0], DARK[1], DARK[2], 0.35 * ps.sky, 0);
    }
  }
  for (const s of ps.rain) {
    const L = s.big ? 46 : 30, wd = s.big ? 13 : 9, ang = Math.atan2(s.vy, s.vx), tl = Math.min(140, s.y + 40);
    if (tl > 0) {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      b.draw(F.laser, s.x - ux * tl / 2, s.y - uy * tl / 2, tl, s.big ? 9 : 6, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.35 * glowA, 1);
      b.draw(F.laser, s.x - ux * tl / 2, s.y - uy * tl / 2, tl, 1.4, ang, PALE[0], PALE[1], PALE[2], 0.45, 1);
    }
    b.draw(f.arrow, s.x, s.y, wd, L, ang + Math.PI / 2, 0.75, 0.9, 1.0, 0.85, 0);
    b.draw(f.arrow, s.x, s.y, wd * 0.8, L * 0.95, ang + Math.PI / 2, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.6, 1);
    b.draw(F.glow, s.x, s.y + L * 0.3, wd * 3, wd * 3, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * glowA, 1);
  }
}

/** An arrow strikes: a crystal burst, a frost ring, and ice spikes bursting out of the ground. */
export function arrowImpact(w, x, y, big) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, sp = w.r.frame('sv_spike'), s = big ? 1.6 : 1;
  shatter(w, x, y, s);
  let i = Hp.spawn(F.ring, x, y, 0, 0, 12);
  if (i >= 0) { Hp.size(i, 6, 60 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  for (let k = 0; k < (big ? 5 : 3); k++) {
    const a = -Math.PI / 2 + R.range(-1.2, 1.2);
    i = Hp.spawn(sp, x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * 0.4, Math.sin(a) * 0.4, R.range(14, 22));
    if (i < 0) return;
    Hp.size(i, R.range(5, 9) * s, R.range(10, 16) * s); Hp.spin(i, a + Math.PI / 2, 0);
    Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.8, 1, FADE_OUT);
  }
}

// ------------------------------------------------------------ frozen bullets, Absolute Zero

/** Frozen enemy bullets (bomb, ultimate): each held in a small ice shell (up to 250 drawn). */
export function renderFrozenBullets(p, b, crack = 0) {
  const B = p.w.bullets, F = p.F, f = fr(p);
  let n = 0;
  for (let i = 0; i < B.count && n < 250; i++) {
    if (B.spd[i] !== 0) continue;
    n++;
    const x = B.x[i], y = B.y[i], s = 9 + B.radius[i] * 1.6;
    b.draw(f.crystal, x, y, s, s * 1.15, (i * 0.7) % TAU, 0.45, 0.8, 1.0, 0.7, 1);
    if (crack > 0 && (i & 1)) jag(b, F, x - s * 0.4, y - s * 0.4, x + s * 0.4, y + s * 0.4, 3, 3, 1, PALE, crack, i);
  }
}

/** Absolute Zero (render): the activation (dim, fractures from the centre point), the wave, the frozen battlefield's crystal geometry and frost veins, the release cracks. */
export function renderAbsolute(p, b) {
  const az = p.ps.az;
  if (!az) return;
  const F = p.F, t = az.t, cx = W / 2, cy = H / 2, A = az.ACT;
  if (t < A) {
    // Phase A: the world dims; light converges to a point; fractures race out of it.
    const k = t / A;
    b.draw(F.white, W / 2, H / 2, W, H, 0, DARK[0], DARK[1], DARK[2], 0.45 * k, 0);
    b.draw(F.glow, cx, cy, 20 + 30 * k, 20 + 30 * k, 0, PAL.core[0], PAL.core[1], PAL.core[2], 0.9, 1);
    for (let j = 0; j < 10; j++) {
      const an = j / 10 * TAU + hash(j) * 0.4, L = 40 + 380 * k * k;
      jag(b, F, cx, cy, cx + Math.cos(an) * L, cy + Math.sin(an) * L, 7, 18, 1.4, PALE, 0.7, j * 3.1);
    }
    return;
  }
  const tc = t - A, rel = az.life - t;
  // Phase B: the screen-wide freezing wave.
  if (tc < 24) {
    const R = tc * 32, k = 1 - tc / 24;
    for (let j = 0; j < 72; j++) {
      const a0 = j / 72 * TAU, a1 = (j + 1) / 72 * TAU;
      seg(b, F, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 4, PALE, 0.8 * k, 1);
    }
    b.draw(F.white, W / 2, H / 2, W, H, 0, 0.6, 0.8, 1.0, 0.1 * k, 1);
  }
  // Phase C: the battlefield glazes over: hoarfrost across the whole screen, glacier crystal
  // clusters thrusting in from every edge, giant snowflakes, scattered ice shards and glints,
  // all growing in as the wave passes them (a clear pocket stays round her), plus faint crystal
  // geometry and frost veins over the grid.
  const g = Math.min(1, tc / 30) * (rel < az.REL ? Math.max(0, rel / az.REL) : 1), pulse = 0.85 + 0.15 * Math.sin(t * 0.04);
  const R = tc * 32, ice = az.ice, f = fr(p);
  const grow = (d) => { const u = Math.max(0, Math.min(1, (R - d) / 70)); return u * u * (3 - 2 * u); };
  const clear = (x, y) => { const d = Math.hypot(x - p.x, y - p.y), u = Math.max(0, Math.min(1, (d - 55) / 85)); return u * u * (3 - 2 * u); };
  b.draw(F.white, W / 2, H / 2, W, H, 0, 0.05, 0.16, 0.42, 0.28 * g, 0);   // deep glacial blue
  b.draw(F.white, W / 2, H / 2, W, H, 0, 0.1, 0.3, 0.75, 0.08 * g, 1);
  for (const q of ice.frost) {
    const k = grow(q.d) * g * clear(q.x, q.y) * q.v;
    if (k <= 0.01) continue;
    b.draw(f.frost, q.x, q.y, q.s, q.s, q.rot, 0.3, 0.68, 1.0, 0.55 * k, 1);
  }
  for (const c of ice.clusters) {
    const u = grow(c.d), k = u * g * clear(c.x, c.y);
    if (k <= 0.01) continue;
    const sc = 0.35 + 0.65 * u, hh = c.s * sc, ww = hh * 0.67, ux = Math.sin(c.ang), uy = -Math.cos(c.ang);
    const mx = c.x + ux * hh * 0.47, my = c.y + uy * hh * 0.47;
    b.draw(F.glow, c.x, c.y, ww * 1.6, ww * 1.6, 0, 0.1, 0.45, 1.0, 0.45 * k, 1);
    b.draw(f.cluster, mx, my, ww, hh, c.ang, 0.38, 0.62, 0.95, 0.85 * k, 0);
    b.draw(f.cluster, mx, my, ww, hh, c.ang, 0.3, 0.7, 1.0, 0.8 * k * pulse, 1);
  }
  for (const q of ice.flakes) {
    const u = grow(q.d), k = u * g * clear(q.x, q.y);
    if (k <= 0.01) continue;
    const sz = q.s * (0.4 + 0.6 * u), rot = q.rot + t * q.spin;
    b.draw(F.glow, q.x, q.y, sz * 0.9, sz * 0.9, 0, 0.05, 0.35, 1.0, 0.35 * k, 1);
    b.draw(f.bigflake, q.x, q.y, sz, sz, rot, 0.55, 0.8, 1.0, 0.55 * k, 0);
    b.draw(f.bigflake, q.x, q.y, sz, sz, rot, 0.25, 0.7, 1.0, 0.75 * k * pulse, 1);
    b.draw(F.glow, q.x, q.y, sz * 0.15, sz * 0.15, 0, 0.6, 0.85, 1.0, 0.5 * k, 1);
  }
  for (const q of ice.shards) {
    const k = grow(q.d) * g * clear(q.x, q.y);
    if (k <= 0.01) continue;
    b.draw(q.spike ? f.spike : f.crystal, q.x, q.y, q.s * 0.5, q.s, q.ang, 0.45, 0.7, 1.0, 0.75 * k, 0);
    b.draw(q.spike ? f.spike : f.crystal, q.x, q.y, q.s * 0.45, q.s * 0.92, q.ang, 0.2, 0.65, 1.0, 0.6 * k, 1);
  }
  for (const q of ice.glints) {
    const tw = Math.max(0, Math.sin(t * q.w + q.ph)), k = grow(q.d) * g * clear(q.x, q.y) * tw * tw;
    if (k > 0.05) star(b, q.x, q.y, q.s, k, q.ph, PALE);
  }
  for (let j = 0; j < 6; j++) {
    const an = j / 6 * Math.PI + 0.26;
    seg(b, F, cx - Math.cos(an) * 520, cy - Math.sin(an) * 520, cx + Math.cos(an) * 520, cy + Math.sin(an) * 520, 1, SOFT, 0.1 * g * pulse);
  }
  for (const v of az.veins) jag(b, F, v[0], v[1], v[2], v[3], 6, 22, 1, PALE, 0.15 * g, v[4]);
  // Phase D: cracks spread through everything frozen before it breaks.
  if (rel < 24) {
    const k = 1 - rel / 24;
    for (let j = 0; j < 8; j++) {
      const an = j / 8 * TAU + 0.2;
      jag(b, F, cx, cy, cx + Math.cos(an) * 500 * k, cy + Math.sin(an) * 500 * k, 8, 26, 1.4, PALE, 0.6 * k, j * 5.3 + 99);
    }
  }
}

/**
 * Absolute Zero's ice field (laid out once when it starts; R: an RNG with
 * range / next): hoarfrost tiles over the whole screen (denser toward the
 * edges), glacier clusters thrusting in from every edge and a few mid-screen,
 * giant and small snowflakes, ice shards and glints. Each element knows its
 * distance from the centre, so it grows in as the freezing wave passes it.
 */
export function makeIceField(R) {
  const cx = W / 2, cy = H / 2, d = (x, y) => Math.hypot(x - cx, y - cy);
  const frost = [], clusters = [], flakes = [], shards = [], glints = [];
  for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 6; gx++) {
    const x = (gx + 0.5) * W / 6 + R.range(-12, 12), y = (gy + 0.5) * H / 8 + R.range(-12, 12);
    const edge = Math.max(Math.abs(x - cx) / cx, Math.abs(y - cy) / cy);
    frost.push({ x, y, s: R.range(105, 135), rot: R.range(0, TAU), d: d(x, y), v: 0.45 + 0.55 * edge });
  }
  const edgeCluster = (x, y, ang) => clusters.push({ x, y, ang: ang + R.range(-0.45, 0.45), s: R.range(70, 140), d: d(x, y) });
  for (let k = 0; k < 7; k++) { edgeCluster(-6, (k + R.range(0.2, 0.8)) * H / 7, Math.PI / 2); edgeCluster(W + 6, (k + R.range(0.2, 0.8)) * H / 7, -Math.PI / 2); }
  for (let k = 0; k < 6; k++) edgeCluster((k + R.range(0.2, 0.8)) * W / 6, -6, Math.PI);
  for (let k = 0; k < 5; k++) edgeCluster((k + R.range(0.2, 0.8)) * W / 5, H + 6, 0);
  for (let k = 0; k < 9; k++) { const x = R.range(40, W - 40), y = R.range(40, H - 120); clusters.push({ x, y, ang: R.range(-0.9, 0.9), s: R.range(45, 85), d: d(x, y) }); }
  flakes.push({ x: cx, y: H * 0.36, s: 330, rot: R.range(0, 1), spin: 0.0015, d: 0 });
  for (let k = 0; k < 6; k++) { const x = R.range(50, W - 50), y = R.range(50, H - 140); flakes.push({ x, y, s: R.range(110, 190), rot: R.range(0, 1), spin: R.range(-0.003, 0.003), d: d(x, y) }); }
  for (let k = 0; k < 16; k++) { const x = R.range(10, W - 10), y = R.range(10, H - 10); flakes.push({ x, y, s: R.range(28, 70), rot: R.range(0, 1), spin: R.range(-0.006, 0.006), d: d(x, y) }); }
  for (let k = 0; k < 60; k++) { const x = R.range(0, W), y = R.range(0, H); shards.push({ x, y, s: R.range(8, 22), ang: R.range(0, TAU), spike: R.next() < 0.4, d: d(x, y) }); }
  for (let k = 0; k < 40; k++) { const x = R.range(0, W), y = R.range(0, H); glints.push({ x, y, s: R.range(14, 34), w: R.range(0.03, 0.08), ph: R.range(0, TAU), d: d(x, y) }); }
  return { frost, clusters, flakes, shards, glints };
}

/** The ice field breaks at the release: crystal fragments burst from its clusters and snowflakes. */
export function iceFieldShatter(w, ice) {
  for (const c of ice.clusters) shatter(w, c.x, c.y, 1.4, false);
  for (const q of ice.flakes) if (q.s > 100) shatter(w, q.x, q.y, 2, true);
}

/** Absolute Zero's particles each step: light converging to the centre in the activation, then slow drifting snow. */
export function absoluteParticles(p, w) {
  const az = p.ps.az, Hp = w.fxHigh, R = w.fxRng, F = w.F;
  if (!az) return;
  if (az.t < az.ACT) {
    for (let k = 0; k < 4; k++) {
      const an = R.range(0, TAU), d = R.range(150, 320), x = W / 2 + Math.cos(an) * d, y = H / 2 + Math.sin(an) * d;
      const i = Hp.spawn(F.spark, x, y, -Math.cos(an) * d / 14, -Math.sin(an) * d / 14, 14);
      if (i < 0) return;
      Hp.size(i, 4); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT, 0.5);
    }
  } else if (az.t < az.life - 12) for (let k = 0; k < 2; k++) snow(w, R.range(0, W), R.range(-10, H * 0.9), 1, 2, 0.6);
}

/** The frost-tinted sprite frames, looked up once (sera.js init). */
export function frames(w) {
  return {
    crystal: w.r.frame('sv_crystal'), flake: w.r.frame('sv_flake'), blade: w.r.frame('sv_blade'),
    casing: w.r.frame('sv_casing'), arrow: w.r.frame('sv_arrow'), spike: w.r.frame('sv_spike'), shard: w.r.frame('sv_shard'),
    bigflake: w.r.frame('sv_bigflake'), cluster: w.r.frame('sv_cluster'), frost: w.r.frame('sv_frost'),
  };
}
