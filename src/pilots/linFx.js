import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { linArt, PAL, DARK } from './linArt.js';
import { pilotArt } from '../core/pilotArt.js';

// Lin's effects, after fx-reference.png and swarm-turrets.png: crystal spears
// and shards in glowing emerald with a black edge and a white core, ring
// halos, crystal debris, star sparkles. The black parts are alpha-blended
// (add = 0); everything else is additive and feeds the bloom. Render-time
// only: hit areas and damage live in lin.js.

const LOOK = linArt.LOOK;
const fxOf = () => linArt.frames().fx;
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

// Shot tags (shots.aux).
export const T_SHARD = 1, T_SPEAR = 2, T_SPLIT = 3, T_NEEDLE = 4;

// ------------------------------------------------------------ textures

function spearTex(ctx, w, h) {
  // Pointing right: faded shaft, barbed guard, long diamond head with a ridge.
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, cy - h * 0.09, w * 0.6, h * 0.18);
  ctx.beginPath(); // guard barbs
  ctx.moveTo(w * 0.5, cy - h * 0.12); ctx.lineTo(w * 0.56, cy - h * 0.46); ctx.lineTo(w * 0.6, cy - h * 0.1);
  ctx.lineTo(w * 0.6, cy + h * 0.1); ctx.lineTo(w * 0.56, cy + h * 0.46); ctx.lineTo(w * 0.5, cy + h * 0.12);
  ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  ctx.beginPath(); // head
  ctx.moveTo(w * 0.57, cy); ctx.lineTo(w * 0.7, cy - h * 0.4); ctx.lineTo(w, cy); ctx.lineTo(w * 0.7, cy + h * 0.4);
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  // Facet: one half of the head a little darker.
  ctx.beginPath(); ctx.moveTo(w * 0.57, cy); ctx.lineTo(w * 0.7, cy + h * 0.4); ctx.lineTo(w, cy); ctx.closePath();
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function crystalTex(ctx, w, h) {
  // Faceted shard: long hexagon, one facet darker.
  ctx.beginPath();
  ctx.moveTo(0, h / 2); ctx.lineTo(w * 0.3, 0); ctx.lineTo(w * 0.75, h * 0.1); ctx.lineTo(w, h / 2);
  ctx.lineTo(w * 0.75, h * 0.9); ctx.lineTo(w * 0.3, h); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.lineTo(w * 0.75, h * 0.9); ctx.lineTo(w * 0.3, h); ctx.closePath();
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function rootTex(ctx, w, h) {
  // A thorny vine, thick at the left, tapering to a point at the right.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const N = 16, top = [], bot = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, x = t * w, y = h / 2 + Math.sin(t * 9) * h * 0.12, r = h * 0.3 * (1 - t * 0.9);
    top.push([x, y - r]); bot.push([x, y + r]);
  }
  ctx.moveTo(top[0][0], top[0][1]);
  for (const [x, y] of top) ctx.lineTo(x, y);
  for (const [x, y] of bot.reverse()) ctx.lineTo(x, y);
  ctx.closePath(); ctx.fill();
  for (let k = 1; k < 6; k++) { // thorns
    const x = (k / 6) * w * 0.9, s = k % 2 ? -1 : 1, r = h * 0.3 * (1 - x / w);
    ctx.beginPath(); ctx.moveTo(x - 3, h / 2 + s * r * 0.6); ctx.lineTo(x + 4, h / 2 + s * (r + h * 0.2)); ctx.lineTo(x + 2, h / 2 + s * r * 0.4); ctx.fill();
  }
}

// The owner's FX picks (tools/art-ref/lin/ → lin_fx_*.png, all pointing up),
// packed into the main atlas next to the shot glows so drawing them never
// switches textures. [image key, logical w, h]. Without the art the code-drawn
// spear and crystal stand in.
// The two big picks (cosmic spear, star seal) live in the pilot's own texture (linArt extras).
const PICK = { arrow: ['fxArrow', 15, 42], spear: ['fxSpear', 19, 63] };
let PICKS = {};
/** A picked FX frame (arrow / spear / star / cosmic) or null. */
export const pick = (k) => PICKS[k] || linArt.extra(k);

/** Atlas textures (part of lin.js `sprites`). */
export function linFxSprites(atlas) {
  atlas.add('l_spear', 64, 16, spearTex, { scale: 3 });
  atlas.add('l_crystal', 16, 8, crystalTex, { scale: 3 });
  atlas.add('l_root', 64, 16, rootTex, { scale: 2 });
  PICKS = {};
  const images = pilotArt('lin')?.images || {};
  for (const [k, [key, w, h]] of Object.entries(PICK)) {
    const img = images[key];
    if (img) PICKS[k] = atlas.add(`l_pick_${k}`, w, h, (c, cw, ch) => c.drawImage(img, 0, 0, cw, ch), { scale: 2 });
  }
}

/**
 * A picked sprite pointing along `ang`, tip at (x, y): a soft additive
 * emerald glow under the painted art (alpha-blended, so its black edges and
 * white core read as painted).
 */
function painted(b, F, fr, x, y, ang, len, wid, alpha, glowA, glow = 1) {
  const dx = Math.cos(ang), dy = Math.sin(ang), cx = x - dx * len / 2, cy = y - dy * len / 2;
  if (glow > 0) b.draw(F.glow, cx, cy, len * 1.3, wid * 2.4, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.35 * alpha * glowA * glow, 1);
  b.draw(fr, cx, cy, wid, len, ang + Math.PI / 2, 1, 1, 1, alpha, 0);
}

// ------------------------------------------------------------ pieces

/** A crystal spear: black edge, emerald glow and body, white core. (x, y) = tip. */
export function spear(b, F, Fr, x, y, ang, len, wid, alpha = 1, glowA = 1, dark = true) {
  const dx = Math.cos(ang), dy = Math.sin(ang), cx = x - dx * len / 2, cy = y - dy * len / 2;
  if (dark) b.draw(Fr.spear, cx - dx, cy - dy, len * 1.08, wid * 1.5, ang, DARK[0], DARK[1], DARK[2], 0.75 * alpha, 0);
  const fx = fxOf();
  if (fx) b.draw(fx.glow, x - dx * len * 0.35, y - dy * len * 0.35, len * 1.5, wid * 2.6, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * alpha * glowA, 1);
  b.draw(Fr.spear, cx, cy, len, wid, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.95 * alpha, 1);
  b.draw(Fr.spear, cx + dx * len * 0.08, cy + dy * len * 0.08, len * 0.85, wid * 0.4, ang, PAL.core[0], PAL.core[1], PAL.core[2], alpha, 1);
}

/** Field of four-point star sparkles. */
function star(b, x, y, s, alpha, rot = 0) {
  const fx = fxOf();
  if (!fx) return;
  b.draw(fx.flare, x, y, s, s, rot, PAL.core[0], PAL.core[1], PAL.core[2], alpha, 1);
}

const frames = (p) => p.ps.Fr;

// ------------------------------------------------------------ shots

/** Every player shot (World renderShots hook). */
export function renderShots(p, b, alpha, S) {
  const F = p.F, Fr = frames(p), fx = fxOf(), wm = LOOK.widthMul;
  const glowA = LOOK.glowMul * crowdFactor(p.w);
  const arrow = pick('arrow'), spr = pick('spear');
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], tag = S.aux[i], dx = Math.cos(ang), dy = Math.sin(ang);
    const fade = Math.min(1, (S.age[i] + alpha) / 2);
    // Painted picks first (the hit point sits just behind the tip).
    if (spr && (tag === T_SPEAR || tag === T_SPLIT)) {
      const big = tag === T_SPEAR;
      painted(b, F, spr, x + dx * (big ? 8 : 5), y + dy * (big ? 8 : 5), ang, (big ? 50 : 30) * wm, (big ? 15 : 9) * wm, fade, glowA);
      continue;
    }
    if (arrow && (tag === T_SHARD || tag === T_NEEDLE)) {
      const big = tag === T_SHARD;
      painted(b, F, arrow, x + dx * 5, y + dy * 5, ang, (big ? 32 : 20) * wm, (big ? 11.5 : 7) * wm, fade, glowA, big ? 1 : 0.6);
      continue;
    }
    if (tag === T_SPEAR) {
      spear(b, F, Fr, x + dx * 6, y + dy * 6, ang, 34 * wm, 11 * wm, fade, glowA);
      // Ring halo running down the shaft (FX sheet).
      const o = 10 + ((S.age[i] * 3) % 14);
      b.draw(F.ring, x - dx * o, y - dy * o, 5, 17 * wm, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.55 * fade, 1);
    } else if (tag === T_SPLIT) {
      spear(b, F, Fr, x + dx * 4, y + dy * 4, ang, 20 * wm, 7 * wm, fade, glowA);
    } else if (tag === T_NEEDLE) {
      spear(b, F, Fr, x + dx * 3, y + dy * 3, ang, 15 * wm, 5 * wm, fade, glowA * 0.7, false);
    } else if (tag === T_SHARD) {
      b.draw(Fr.crystal, x, y, 15 * wm, 8 * wm, ang, DARK[0], DARK[1], DARK[2], 0.7 * fade, 0);
      if (fx) b.draw(fx.glow, x - dx * 6, y - dy * 6, 28 * wm, 12 * wm, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.38 * glowA * fade, 1);
      b.draw(Fr.crystal, x, y, 12 * wm, 6 * wm, ang, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.95 * fade, 1);
      b.draw(Fr.crystal, x + dx, y + dy, 7 * wm, 2.4 * wm, ang, PAL.core[0], PAL.core[1], PAL.core[2], fade, 1);
    } else {
      const fr = p.w.r.frames[S.frame[i]], sc = S.scale[i];
      b.draw(fr, x, y, fr.w * sc, fr.h * sc, ang, 1, 1, 1, 0.5, 1);
    }
  }
}

// ------------------------------------------------------------ impacts

/** Small impact (World hitSpark hook): white flash, emerald ring, black crystal chips. */
export function hitSpark(w, x, y, angle) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, cr = w.r.frame('l_crystal');
  let i = Hp.spawn(F.glow, x, y, 0, 0, 4);
  if (i >= 0) { Hp.size(i, 30, 16); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 0.9, 1, FADE_OUT); }
  i = Hp.spawn(F.ring, x, y, 0, 0, 9);
  if (i >= 0) { Hp.size(i, 6, 28); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.7, 1, FADE_OUT); }
  for (let k = 0; k < 3; k++) {
    const a = angle + R.range(-1.1, 1.1), sp = R.range(2, 4.5);
    i = Hp.spawn(cr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(10, 16));
    if (i < 0) return;
    Hp.size(i, R.range(4, 6)); Hp.spin(i, a, R.range(-0.3, 0.3)); Hp.phys(i, 0.9, 0.05);
    Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.9, 0, FADE_OUT);
  }
  for (let k = 0; k < 4; k++) {
    const a = angle + R.range(-0.9, 0.9), sp = R.range(3, 7);
    i = Hp.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 13));
    if (i < 0) return;
    Hp.size(i, 5); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]);
    Hp.phys(i, 0.86); Hp.look(i, 1, 1, FADE_OUT, 0.5);
  }
}

/**
 * Crystal burst (root crush, spear rain landing, ultimate): black smoke and
 * crystal debris, an emerald fireball with a white core, a ring and crystal
 * spikes, star sparkles. `s` scales it (1 ≈ a normal enemy).
 */
export function burst(w, x, y, s = 1) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F, cr = w.r.frame('l_crystal'), fx = fxOf();
  // 1. Black smoke and crystal debris (alpha-blended, under the light).
  for (let k = 0; k < 5 * s; k++) {
    const a = R.range(0, Math.PI * 2), sp = R.range(0.5, 1.6) * s;
    const i = Hp.spawn(F.glow, x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, Math.cos(a) * sp, Math.sin(a) * sp - 0.2, R.range(20, 30));
    if (i < 0) break;
    Hp.size(i, 16 * s, 34 * s); Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.phys(i, 0.94); Hp.look(i, 0.55, 0, FADE_INOUT);
  }
  for (let k = 0; k < 7 * s; k++) {
    const a = R.range(0, Math.PI * 2), sp = R.range(2.5, 6) * s;
    const i = Hp.spawn(cr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(16, 26));
    if (i < 0) break;
    Hp.size(i, R.range(5, 9) * Math.sqrt(s)); Hp.spin(i, a, R.range(-0.25, 0.25)); Hp.phys(i, 0.9, 0.08);
    Hp.color(i, DARK[0], DARK[1], DARK[2]); Hp.look(i, 0.95, 0, FADE_OUT);
  }
  // 2. Emerald fireball, white core, ring.
  let i = Hp.spawn(F.glow, x, y, 0, 0, 14);
  if (i >= 0) { Hp.size(i, 40 * s, 70 * s); Hp.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); Hp.look(i, 0.8, 1, FADE_OUT); }
  i = Hp.spawn(F.glow, x, y, 0, 0, 7);
  if (i >= 0) { Hp.size(i, 26 * s, 14 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 1, 1, FADE_OUT); }
  i = Hp.spawn(F.ring, x, y, 0, 0, 14);
  if (i >= 0) { Hp.size(i, 10 * s, 70 * s); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.8, 1, FADE_OUT); }
  // 3. Glowing crystal spikes flying out, and stars.
  for (let k = 0; k < 6 * s; k++) {
    const a = R.range(0, Math.PI * 2), sp = R.range(3, 7) * s;
    const j = Hp.spawn(cr, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(10, 16));
    if (j < 0) break;
    Hp.size(j, R.range(6, 10) * Math.sqrt(s)); Hp.spin(j, a, 0); Hp.phys(j, 0.88);
    Hp.color(j, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(j, 1, 1, FADE_OUT);
  }
  if (fx) for (let k = 0; k < 3 * s; k++) {
    const j = Hp.spawn(fx.flare, x + R.range(-20, 20) * s, y + R.range(-20, 20) * s, 0, -0.3, R.range(12, 22));
    if (j < 0) break;
    Hp.size(j, R.range(8, 14), 2); Hp.color(j, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(j, 0.9, 1, FADE_OUT);
  }
}

/** Glitter falling from the wings (exhaust hook: no thrusters). */
export function wingGlitter(p, w) {
  if (!linArt.ensureArt(w.r)) return false;
  const fx = fxOf(), Hp = w.fxHigh, R = w.fxRng, ps = p.ps;
  const moving = Math.abs(p.moveX) + Math.abs(p.moveY) > 0.2;
  // A pinch of glitter on each downbeat, a little more while moving.
  const beat = linArt.beatOf(p);
  if (R.next() > (moving ? 0.55 : 0.3) + beat * 0.2) return true;
  const s = R.next() < 0.5 ? -1 : 1, [ax, ay] = linArt.anchor(s < 0 ? 'wingL' : 'wingR');
  const x = p.x + ax + s * R.range(4, 38) * (1 - beat * 0.4), y = p.y + ay + R.range(-6, 30);
  const i = Hp.spawn(fx.flare, x, y, R.range(-0.3, 0.3) + s * 0.2, R.range(1.2, 2.4), R.range(16, 26));
  if (i < 0) return true;
  Hp.size(i, R.range(4, 7), 1);
  Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]);
  Hp.spin(i, R.range(0, 1), R.range(-0.1, 0.1));
  Hp.look(i, 0.75 * p.alpha, 1, FADE_OUT);
  ps.glitter = (ps.glitter || 0) + 1;
  return true;
}

// ------------------------------------------------------------ turrets

/** Swarm turrets: winged crystal drones hovering with beating wings. */
export function renderTurrets(p, b, list, alpha, size = 24) {
  if (!list.length) return;
  const F = p.F, fr = linArt.extra('turret'), t = p.t;
  const pose = list.map((tu) => ({
    tu,
    k: Math.min(1, tu.t / 12),
    fade: tu.life - tu.t < 40 && (tu.t >> 2) & 1 ? 0.45 : 1,
    x: tu.x, y: tu.y + Math.sin((t + tu.seed * 40) * 0.08) * 1.5,
  }));
  // Three passes, so the drones (the pilot's own texture) don't switch
  // textures with the glows (main atlas) once per turret.
  for (const { tu, k, fade, x, y } of pose) {
    if (tu.t < 16) b.draw(F.ring, x, y + 6, 44 * (1 - k * 0.4), 14, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.7 * (1 - k), 1); // rising from a ring
    b.draw(F.glow, x, y + 3, size * 1.6 * k, size * 1.3 * k, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.32 * fade, 1);
  }
  for (const { tu, k, fade, x, y } of pose) {
    if (fr) {
      const flap = 0.78 + 0.22 * Math.abs(Math.cos((t + tu.seed * 60) * 0.22));
      const h = size * k, wd = h * (fr.w / fr.h) * flap;
      b.draw(fr, x, y, wd, h, tu.rot || 0, 1, 1, 1, fade, 0);
    } else {
      b.draw(p.ps.fBud, x, y, 16 * k, 16 * k, tu.t * 0.03, 1, 1, 1, fade, 0);
    }
  }
  for (const { tu, fade, x, y } of pose) { // lit cores
    b.draw(F.glow, x, y + 1, 8, 8, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.5 * fade * (0.8 + 0.2 * Math.sin(t * 0.3 + tu.seed)), 1);
  }
}

// ------------------------------------------------------------ special, bomb, ultimate

/** Root field ground (drawn under the enemies). */
export function renderFieldGround(p, b) {
  const fd = p.ps.field;
  if (!fd) return;
  const F = p.F, Fr = frames(p), R = fd.R, grow = Math.min(1, fd.t / 18);
  const out = fd.t > fd.crush ? Math.max(0, 1 - (fd.t - fd.crush) / 22) : 1;
  b.draw(F.glow, fd.x, fd.y, R * 2.4 * grow, R * 2.4 * grow, 0, DARK[0], DARK[1], DARK[2], 0.6 * out, 0);
  b.draw(F.glow, fd.x, fd.y, R * 2 * grow, R * 2 * grow, 0, PAL.edge[0], PAL.edge[1], PAL.edge[2], 0.12 * out, 1);
  b.draw(F.ring, fd.x, fd.y, R * 2 * grow, R * 2 * grow, fd.t * 0.004, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.1 * out, 1);
  // Roots creeping out from the centre: crooked, thorny, forking.
  for (let k = 0; k < 14; k++) {
    let a = k / 14 * Math.PI * 2 + hash(k * 7.3) * 0.4, x = fd.x, y = fd.y;
    const L = R * (0.75 + 0.3 * hash(k * 3.1)) * grow / 4;
    for (let s = 0; s < 4; s++) {
      a += (hash(k * 5.7 + s * 2.3) - 0.5) * 0.9;
      const nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L, wd = 22 - s * 4.5;
      root(b, Fr, (x + nx) / 2, (y + ny) / 2, L * 1.25, wd, a, out);
      if (s === 1 && hash(k * 9.1) > 0.4) { // fork
        const fa = a + (hash(k) > 0.5 ? 0.8 : -0.8);
        root(b, Fr, nx + Math.cos(fa) * L * 0.4, ny + Math.sin(fa) * L * 0.4, L * 0.9, wd * 0.6, fa, out);
      }
      x = nx; y = ny;
    }
  }
}

/** One root segment: black vine with a glowing emerald vein and a white heart. */
function root(b, Fr, x, y, len, wd, a, alpha) {
  b.draw(Fr.root, x, y, len * 1.05, wd * 1.5, a, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3 * alpha, 1); // emerald rim
  b.draw(Fr.root, x, y, len, wd, a, DARK[0], DARK[1], DARK[2], 0.97 * alpha, 0);
  b.draw(Fr.root, x, y, len * 0.95, wd * 0.3, a, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.45 * alpha, 1);
  b.draw(Fr.root, x, y, len * 0.85, wd * 0.1, a, PAL.core[0], PAL.core[1], PAL.core[2], 0.25 * alpha, 1);
}

/** Roots wrapping each held enemy (drawn over the enemies). */
export function renderFieldRoots(p, b) {
  const fd = p.ps.field;
  if (!fd) return;
  const F = p.F, Fr = frames(p);
  for (const h of fd.held) {
    const e = h.e;
    if (!e.alive) continue;
    const g = Math.min(1, (fd.t - h.born) / 14), tight = fd.t > fd.crush - 12 ? (fd.crush - fd.t) / 12 : 1;
    const r = (e.r + 8) * (0.75 + 0.25 * Math.max(0, tight));
    for (let k = 0; k < 4; k++) {
      // A vine coming in from below and curling around the enemy.
      const a0 = h.seed + k * 1.57, a1 = a0 + 2.2 * g;
      for (let s = 0; s < 3; s++) {
        const aa = a0 + (a1 - a0) * (s + 0.5) / 3, x = e.x + Math.cos(aa) * r, y = e.y + Math.sin(aa) * r;
        root(b, Fr, x, y, r * 1.3 * g, 14, aa + Math.PI / 2, 1);
      }
    }
    b.draw(F.glow, e.x, e.y, e.r * 3, e.r * 3, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.18 + 0.08 * ((p.t >> 2) & 1), 1);
  }
}

/** Spear Rain: falling spears with long light trails. */
export function renderRain(p, b) {
  const F = p.F, Fr = frames(p), glowA = crowdFactor(p.w), spr = pick('spear'), st = pick('star');
  for (const s of p.ps.rain) {
    const L = s.big ? 64 : 42, wd = s.big ? 19 : 13, ang = Math.atan2(s.vy, s.vx);
    b.draw(F.laser, s.x - s.vx * 3, s.y - 60, 4, 110, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3 * glowA, 1);
    if (spr) painted(b, F, spr, s.x, s.y, ang, L, wd, 1, glowA);
    else spear(b, F, Fr, s.x, s.y, ang, L * 0.75, wd * 0.7, 1, glowA);
  }
  // Every hit: the star seal from the FX picks, opening, turning and fading.
  // In passes: the seals use the pilot texture, so they don't interleave with atlas glows.
  const seals = p.ps.stars.map((h) => {
    const k = h.t / h.life;
    return { h, k, s: h.size * (0.55 + 0.45 * Math.min(1, k * 3)), a: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4 };
  });
  for (const { h, s, a } of seals) b.draw(F.glow, h.x, h.y, s * 1.1, s * 1.1, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.22 * a * glowA, 1);
  for (const { h, k, s, a } of seals) {
    if (st) b.draw(st, h.x, h.y, s, s, h.rot + k * 0.6, 0.75, 1, 0.82, 0.9 * a, 0);
    else b.draw(F.ring, h.x, h.y, s, s, 0, PAL.hot[0], PAL.hot[1], PAL.hot[2], a, 1);
  }
  for (const { h, k, s } of seals) if (k < 0.3) star(b, h.x, h.y, s * 0.7 * (1 - k / 0.3), 1, h.rot);
}

/** Cosmic Spear: charge, the giant spear and the starry rift it leaves. */
export function renderUlt(p, b) {
  const u = p.ps.ult;
  if (!u) return;
  const F = p.F, Fr = frames(p), fx = fxOf(), t = p.t;
  if (u.phase === 'charge') {
    const k = Math.min(1, 0.3 + u.t / 40);
    const [bx, by] = linArt.anchor('blade');
    const x = p.x + bx, y = p.y + by;
    // A pocket of black space opening at the spear, stars falling into it.
    b.draw(F.glow, x, y, 70 + 90 * k, 70 + 90 * k, 0, DARK[0], DARK[1], DARK[2], 0.75 * k, 0);
    b.draw(F.glow, x, y, 40 + 70 * k, 40 + 70 * k, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.6 * k, 1);
    for (const [r, sp] of [[1, 0.05], [0.6, -0.08]]) {
      const R = (110 * (1 - (u.t % 25) / 25) + 24) * r;
      b.draw(F.ring, x, y, R, R, t * sp, PAL.hot[0], PAL.hot[1], PAL.hot[2], 0.8 * k, 1);
    }
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + t * 0.07, d = 70 * (1 - ((t * 0.04 + hash(i)) % 1));
      star(b, x + Math.cos(a) * d, y + Math.sin(a) * d, 6 + 6 * hash(i * 3), k, a);
    }
    const cs = pick('cosmic');
    if (cs) painted(b, F, cs, x, y - 30 * k, -Math.PI / 2, 60 + 50 * k, (60 + 50 * k) * (cs.w / cs.h), k, 1, 0.6);
    else spear(b, F, Fr, x, y - 20 * k, -Math.PI / 2, 40 + 30 * k, 12 + 8 * k, k);
    star(b, x, y - 20 * k, 40 + 40 * k, k, t * 0.04);
    return;
  }
  if (u.headY > -340) {
    // The giant spear itself (the owner's pick), pointing up.
    const cs = pick('cosmic'), x = u.x;
    if (cs) {
      const L = 330, Wd = L * (cs.w / cs.h);
      painted(b, F, cs, x, u.headY, -Math.PI / 2, L, Wd, 1, 1, 0.8);
    } else {
      spear(b, F, Fr, x, u.headY, -Math.PI / 2, 240, 84, 1, 0.6);
    }
    star(b, x, u.headY + 40, 80, 0.8, t * 0.05);
  }
}

/** The Cosmic Spear's path, drawn under the enemies (World renderUnder hook). */
export function renderVoid(p, b) {
  const u = p.ps.ult;
  if (!u || u.phase !== 'fly') return;
  const F = p.F, fx = fxOf(), t = p.t;
  const a = u.fade, x = u.x, wd = u.w, top = Math.max(-40, u.headY), y0 = u.y0, len = y0 - top, my = (y0 + top) / 2;
  if (len > 0 && fx) {
    // The path: a void of empty space with stars. A soft black edge, the
    // black void, a hair-thin emerald rim; nothing else lit but the stars.
    b.draw(fx.beam, x, my, len, wd * 1.7, -Math.PI / 2, DARK[0], DARK[1], DARK[2], 0.45 * a, 0);
    b.draw(fx.beam, x, my, len, wd * 1.25, -Math.PI / 2, 0, 0, 0, 0.97 * a, 0);
    b.draw(fx.beam, x, my, len, wd * 1.05, -Math.PI / 2, 0, 0, 0, 0.8 * a, 0);
    for (const s of [-1, 1]) b.draw(F.laser, x + s * wd * 0.6, my, len, 3, -Math.PI / 2, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.4 * a, 1);
    // Stars: many faint pin-points, fewer bright four-point stars, a few
    // emerald ones; they drift slowly and twinkle.
    for (let k = 0; k < 120; k++) {
      const sy = y0 - ((hash(k * 1.7) * 760 + t * (0.15 + hash(k) * 0.35)) % 760);
      if (sy < top + 4 || sy > y0) continue;
      const sx = x + (hash(k * 4.1) - 0.5) * wd * 1.05, tw = 0.5 + 0.5 * Math.sin(t * (0.08 + hash(k * 6.1) * 0.2) + k * 2.3);
      const sz = hash(k * 9.2), em = hash(k * 2.9) > 0.8 ? 1 : 0;
      const c = em ? PAL.hot : PAL.core;
      if (sz < 0.75) b.draw(F.core, sx, sy, 1.5 + 2.5 * sz, 1.5 + 2.5 * sz, 0, c[0], c[1], c[2], a * (0.35 + 0.65 * tw), 1);
      else star(b, sx, sy, (6 + 14 * (sz - 0.75) * 4) * (0.6 + 0.5 * tw), a * (0.5 + 0.5 * tw), k);
    }
  }
}

