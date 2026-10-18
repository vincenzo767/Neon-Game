import { crowdFactor } from './art/mechaFx.js';
import { FADE_OUT, FADE_FLICKER } from '../fx/Particles.js';
import { W, H } from './common.js';
import { oduyaArt, oduyaMechaFx, RIG_FX } from './oduyaArt.js';
import { rigState, strikeLevel, charge, flareLevel } from './oduyaRig.js';
import { ODUYA } from './oduyaTuning.js';

// Oduya's lightning, after fx-reference.png: thick jagged bolts, blue outside,
// white inside, with forks and bright nodes where they strike. Render-time
// only (the jitter re-rolls every step, so the bolts flicker like real
// lightning); damage lives in oduya.js.
//
// v2 (ASSET_NOTES.md "Rebuild v2"): every attack is drawn as beginning →
// travel → detonation: leaders racing out of the punching fist, the
// Thundershock web, the Storm Cell cloud, and the God Thunder core (charge
// between the fists, launch, travel, critical charge, detonation, aftermath).
// Rig FX (RIG_FX.overlay): the fists crackle while drawn back and flash as they
// strike, an energy link bridges the wrist while the gauntlet is thrust out,
// and the wings' painted lightning flickers with every strike.

const LOOK = oduyaArt.LOOK;
export const BLUE_EDGE = [0.2, 0.45, 2.3];
export const BLUE = [0.55, 1.05, 2.5];
export const WHITE = [2.4, 2.55, 2.7];
const CLOUD = [0.16, 0.19, 0.3]; // storm-cloud billows (alpha-blended slate blue)

const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

/** One straight segment in three layers: blue glow, blue body, white core. */
function seg(b, F, ax, ay, bx, by, width, alpha, glowA) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay) + 2, a = Math.atan2(by - ay, bx - ax);
  b.draw(F.laser, mx, my, l, width * 3.6, a, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.42 * alpha * glowA, 1);
  b.draw(F.laser, mx, my, l, width * 1.7, a, BLUE[0], BLUE[1], BLUE[2], 0.85 * alpha, 1);
  b.draw(F.laser, mx, my, l, width * 0.6, a, WHITE[0], WHITE[1], WHITE[2], alpha, 1);
}

/**
 * A jagged bolt from (x0, y0) to (x1, y1). `seed` picks the shape; `forks`
 * adds short side branches like the FX sheet.
 */
export function bolt(b, F, x0, y0, x1, y1, width, alpha, seed, forks = true, glowA = 1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, segs = Math.max(3, Math.min(14, Math.round(len / 22)));
  const amp = Math.min(20, len * 0.12);
  let px = x0, py = y0;
  for (let k = 1; k <= segs; k++) {
    const t = k / segs, j = k === segs ? 0 : (hash(seed * 12.9 + k * 78.2) - 0.5) * 2 * amp;
    const qx = x0 + dx * t + nx * j, qy = y0 + dy * t + ny * j;
    seg(b, F, px, py, qx, qy, width, alpha, glowA);
    if (forks && k < segs && hash(seed * 3.1 + k * 17.7) > 0.62) {
      const side = hash(seed + k) > 0.5 ? 1 : -1, fl = len * (0.12 + 0.1 * hash(seed * 7 + k));
      const fa = Math.atan2(dy, dx) + side * (0.5 + 0.5 * hash(seed * 5 + k));
      bolt(b, F, qx, qy, qx + Math.cos(fa) * fl, qy + Math.sin(fa) * fl, width * 0.45, alpha * 0.85, seed * 1.7 + k, false, glowA);
    }
    px = qx; py = qy;
  }
}

/** Bright strike node: blue bloom, white core. */
export function node(b, F, x, y, size, alpha) {
  b.draw(F.glow, x, y, size * 2.4, size * 2.4, 0, BLUE[0], BLUE[1], BLUE[2], 0.5 * alpha, 1);
  b.draw(F.core, x, y, size * 0.8, size * 0.8, 0, WHITE[0], WHITE[1], WHITE[2], alpha, 1);
}

// ------------------------------------------------------------- events (particles)

const spark = (w, x, y, a, sp, life, size = 6) => {
  const Hp = w.fxHigh, i = Hp.spawn(w.F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life);
  if (i < 0) return;
  Hp.size(i, size); Hp.color(i, WHITE[0], WHITE[1], WHITE[2], BLUE[0], BLUE[1], BLUE[2]); Hp.phys(i, 0.86); Hp.look(i, 1, 1, FADE_OUT, 0.6);
};
const ring = (w, x, y, r0, r1, life, a = 0.7) => {
  const Hp = w.fxHigh, i = Hp.spawn(w.F.ring, x, y, 0, 0, life);
  if (i < 0) return;
  Hp.size(i, r0, r1); Hp.color(i, WHITE[0], WHITE[1], WHITE[2], BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2]); Hp.look(i, a, 1, FADE_OUT);
};

/** A leader arrives at an enemy: a white flash, sparks thrown out and a small ring. */
export function nodeBurst(p, w, x, y, wd) {
  const Hp = w.fxHigh, R = w.fxRng, s = wd / 9;
  const i = Hp.spawn(w.F.glow, x, y, 0, 0, 6);
  if (i >= 0) { Hp.size(i, 34 * s, 14 * s); Hp.color(i, WHITE[0], WHITE[1], WHITE[2], BLUE[0], BLUE[1], BLUE[2]); Hp.look(i, 0.8, 1, FADE_OUT); }
  if ((p.t & 1) === 0) for (let k = 0; k < 3; k++) spark(w, x, y, R.range(0, Math.PI * 2), R.range(2, 5) * s, R.range(6, 10));
  if ((p.t & 3) === 0) ring(w, x, y, 6, 40 * s, 10, 0.5);
}

/** The punching fist flashes as the bolt leaves it. */
export function fistFlash(p, w, x, y, size) {
  oduyaMechaFx.muzzleFlash(p, w, x, y, size);
}

/** A thunder spear hits: a small crackling burst (cosmetic). */
export function spearBurst(p, w, x, y) {
  const R = w.fxRng;
  for (let k = 0; k < 4; k++) spark(w, x, y, -Math.PI / 2 + R.range(-1.3, 1.3), R.range(2, 6), R.range(6, 12), 5);
  ring(w, x, y, 4, 26, 8, 0.5);
}

/** Thundershock: the fists clap together, a shock ring bursts out. */
export function clapFx(p, w, x, y) {
  ring(w, x, y, 10, 260, 22, 0.8);
  ring(w, x, y, 10, 120, 14, 0.9);
  for (let k = 0; k < 16; k++) spark(w, x, y, (k / 16) * Math.PI * 2, 7, 14, 8);
  w.r.post.flash(0.5, 0.7, 1, 0.25, 0.06);
  w.r.post.shockwave(x, y, 0.04, 0.02, 0.6);
  w.g.camera.addTrauma(0.3);
}

/** God Thunder: both fists thrust and the core launches. */
export function launchGod(p, w, G) {
  ring(w, G.x, G.y, 20, 220, 20, 0.8);
  ring(w, G.x, G.y, 20, 140, 14, 0.9);
  for (let k = 0; k < 20; k++) spark(w, G.x, G.y, w.fxRng.range(0, Math.PI * 2), w.fxRng.range(5, 11), 16, 9);
  w.r.post.flash(0.6, 0.75, 1, 0.4, 0.06);
  w.r.post.shockwave(G.x, G.y, 0.05, 0.03, 0.5);
  w.g.camera.addTrauma(0.45);
}

/** God Thunder: the detonation. A flash that overpowers the screen, a shock front, a hard shake. */
export function detonateGod(p, w, G) {
  w.r.post.flash(0.85, 0.95, 1, 1, 0.025);
  w.r.post.shockwave(G.x, G.y, 0.09, 0.02, 1.2);
  w.r.post.aberrate(0.04);
  w.g.camera.addTrauma(1);
  for (let k = 0; k < 40; k++) spark(w, G.x, G.y, w.fxRng.range(0, Math.PI * 2), w.fxRng.range(6, 16), w.fxRng.range(16, 30), 10);
}

/** God Thunder particles for each phase. */
export function godParticles(p, w, G) {
  const R = w.fxRng, U = ODUYA.ult, t = G.t;
  if (G.ph === 'charge') {
    for (let k = 0; k < 2; k++) { // sparks drawn into the core
      const a = R.range(0, Math.PI * 2), d = R.range(50, 110);
      spark(w, G.x + Math.cos(a) * d, G.y + Math.sin(a) * d, a + Math.PI, d / 9, 9, 6);
    }
  } else if (G.ph === 'travel') {
    if (R.next() < 0.7) spark(w, G.x + R.range(-20, 20), G.y + R.range(-20, 20), Math.PI / 2 + R.range(-0.8, 0.8), R.range(1, 3), 18, 5);
    if (t % 12 === 0) w.r.post.shockwave(G.x, G.y, 0.012, 0.03, 0.2);
  } else if (G.ph === 'crit') {
    const k = (t - G.t0) / U.crit;
    for (let j = 0; j < 3; j++) {
      const a = R.range(0, Math.PI * 2), d = R.range(60, 150);
      spark(w, G.x + Math.cos(a) * d, G.y + Math.sin(a) * d, a + Math.PI + 0.4, d / 8, 9, 7);
    }
    if (t % 6 === 0) w.g.camera.addTrauma(0.1 + 0.15 * k);
  } else if (G.ph === 'boom') {
    const bt = t - G.t0;
    if (bt < 200 && R.next() < 0.5) { // residual sparks drifting over the field
      const i = w.fxHigh.spawn(w.F.core, R.range(0, W), R.range(0, H), R.range(-0.5, 0.5), R.range(-0.5, 0.5), R.range(20, 40));
      if (i >= 0) { w.fxHigh.size(i, R.range(2, 4)); w.fxHigh.color(i, WHITE[0], WHITE[1], WHITE[2], BLUE[0], BLUE[1], BLUE[2]); w.fxHigh.look(i, 1, 1, FADE_FLICKER); }
    }
    if (bt < 60 && bt % 6 === 0) w.g.camera.addTrauma(0.25 * (1 - bt / 60));
  }
}

// ------------------------------------------------------------- rig FX

RIG_FX.overlay = (p, b, api) => {
  const F = p.F, a = api.a, or = rigState(p), since = p.t - or.last;
  // Wings: their painted lightning flickers with every strike and while flaring.
  const fl = Math.max(since < 3 ? 1 - since / 3 : 0, flareLevel(p) * (0.5 + 0.5 * hash(p.t * 0.7)));
  if (fl > 0.02) for (const s of ['L', 'R']) api.drawLayer('wing' + s, { tint: [0.25, 0.55, 1.6], alpha: 0.32 * fl * a, add: 1 });
  for (const [s, side] of [['L', -1], ['R', 1]]) {
    const [fx, fy] = api.at('fist' + s), ch = charge(p, side), st = strikeLevel(p, side), arm = or[s];
    // Energy link across the wrist while the gauntlet is thrust out.
    if (arm.ext > 0.25) {
      const [ex, ey] = api.at('elbow' + s), [wx, wy] = api.at('wrist' + s);
      bolt(b, F, ex, ey, wx, wy, 2.4, Math.min(1, arm.ext) * a, p.t * 3.1 + side * 7, false);
    }
    // Drawn back: the fist charges (crackle round the knuckles).
    if (ch > 0.2) {
      b.draw(F.glow, fx, fy, 22 * ch, 22 * ch, 0, BLUE[0], BLUE[1], BLUE[2], 0.45 * ch * a, 1);
      for (let k = 0; k < 2; k++) {
        const ang = hash(p.t * 1.3 + k * 5 + side) * Math.PI * 2, r = 9;
        bolt(b, F, fx, fy, fx + Math.cos(ang) * r, fy + Math.sin(ang) * r, 1.4, ch * a, p.t + k * 9 + side, false);
      }
    }
    // Striking: the knuckles flare.
    if (st > 0.05) node(b, F, fx, fy, 9 * st, st * a);
  }
};

// ------------------------------------------------------------- render

/** God Thunder's core: glow layers, spinning rings, crackle over its surface (R: radius, spin: ring speed). */
function core(b, F, x, y, R, t, a, spin, glowA, white = 0) {
  b.draw(F.glow, x, y, R * 7, R * 7, 0, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.35 * a * glowA, 1);
  b.draw(F.glow, x, y, R * 3.6, R * 3.6, 0, BLUE[0], BLUE[1], BLUE[2], 0.7 * a, 1);
  b.draw(F.glow, x, y, R * 1.8, R * 1.8, 0, WHITE[0], WHITE[1], WHITE[2], (0.8 + 0.2 * white) * a, 1);
  for (let r = 0; r < 3; r++) {
    const ph = ((t * 0.04) + r / 3) % 1, s = R * (1.6 + 2.6 * ph);
    b.draw(F.ring, x, y, s * 2, s * 2, 0, BLUE[0], BLUE[1], BLUE[2], 0.6 * (1 - ph) * a, 1);
  }
  b.draw(F.ring, x, y, R * 2.8, R * 1.2, t * spin, WHITE[0], WHITE[1], WHITE[2], 0.6 * a, 1);
  b.draw(F.ring, x, y, R * 1.2, R * 2.8, -t * spin * 1.3, WHITE[0], WHITE[1], WHITE[2], 0.5 * a, 1);
  const sd = (t / 2) | 0;
  for (let k = 0; k < 5; k++) {
    const ang = hash(sd * 3.1 + k) * Math.PI * 2, L = R * (1.2 + 1.4 * hash(sd + k * 2.3));
    bolt(b, F, x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, 2.2, a, sd * 7 + k, true, glowA);
  }
  if (white > 0) b.draw(F.glow, x, y, R * 5 * white, R * 5 * white, 0, WHITE[0], WHITE[1], WHITE[2], white * a, 1);
}

function renderGod(p, b, G, glowA) {
  const F = p.F, U = ODUYA.ult, t = G.t, wm = LOOK.widthMul;
  if (G.ph === 'charge') {
    const k = Math.min(1, t / U.charge);
    // Streams from both fists into the core.
    for (const s of ['fistL', 'fistR']) {
      const [fx, fy] = oduyaArt.animatedAnchor(p, s);
      bolt(b, F, fx, fy, G.x, G.y, (3 + 3 * k) * wm, 0.9, p.t * 1.7 + (s === 'fistL' ? 0 : 50), true, glowA);
      node(b, F, fx, fy, 10 + 6 * k, 0.9);
    }
    core(b, F, G.x, G.y, 6 + 16 * k, t, Math.min(1, t / 8), 0.05 + 0.2 * k, glowA);
    return;
  }
  if (G.ph === 'travel') {
    // Wake: a glowing channel back down the path, crackling.
    const back = G.y0 - G.y;
    if (back > 4) {
      b.draw(F.laser, G.x, G.y + back / 2, back, 34, Math.PI / 2, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.35 * glowA, 1);
      b.draw(F.laser, G.x, G.y + back / 2, back, 6, Math.PI / 2, WHITE[0], WHITE[1], WHITE[2], 0.5, 1);
      bolt(b, F, G.x, G.y, G.x, Math.min(H + 10, G.y + back), 3 * wm, 0.6, p.t * 2.3, true, glowA);
    }
    core(b, F, G.x, G.y, 22, t, 1, 0.1, glowA);
    return;
  }
  if (G.ph === 'crit') {
    const k = (t - G.t0) / U.crit, jx = (hash(p.t) - 0.5) * 4 * k, jy = (hash(p.t + 9) - 0.5) * 4 * k;
    // Lightning pulled in from the sky.
    const sd = (p.t / 2) | 0;
    for (let j = 0; j < 4; j++) {
      const x0 = G.x + (hash(sd * 1.3 + j) - 0.5) * W * 0.9;
      bolt(b, F, x0, -10, G.x, G.y, 3.5 * wm, 0.6 + 0.4 * k, sd * 11 + j, true, glowA);
    }
    // Cracks of white light round the swelling core.
    for (let j = 0; j < 8; j++) {
      const ang = j / 8 * Math.PI * 2 + hash(sd + j) * 0.4, L = 30 + 60 * k;
      bolt(b, F, G.x, G.y, G.x + Math.cos(ang) * L, G.y + Math.sin(ang) * L, 2.5, k, sd * 5 + j, false, glowA);
    }
    core(b, F, G.x + jx, G.y + jy, 22 + 20 * k, t, 1, 0.1 + 0.3 * k, glowA, k > 0.8 ? (k - 0.8) / 0.2 : 0);
    return;
  }
  // Detonation and aftermath.
  const bt = t - G.t0, fade = Math.max(0, Math.min(1, (U.dur - t) / 60));
  if (bt < 24) {
    const f = 1 - bt / 24;
    b.draw(F.glow, G.x, G.y, 300 + bt * 40, 300 + bt * 40, 0, WHITE[0], WHITE[1], WHITE[2], f, 1);
  }
  const r1 = 30 + bt * 15;
  if (r1 < 1100) b.draw(F.ring, G.x, G.y, r1 * 2 / 0.86, r1 * 2 / 0.86, 0, WHITE[0], WHITE[1], WHITE[2], Math.max(0, 0.7 - bt / 70), 1);
  const r2 = 20 + bt * 6;
  if (r2 < 900) b.draw(F.ring, G.x, G.y + 8, r2 * 2 / 0.86, r2 * 1.5 / 0.86, 0, BLUE[0], BLUE[1], BLUE[2], Math.max(0, 0.9 - bt / 140) * fade, 1);
  // The lightning dome: radial bolts reaching out, then breaking up.
  if (bt < 80) {
    const sd = (p.t / 2) | 0, L = Math.min(300, 40 + bt * 12), da = Math.max(0, 1 - bt / 80);
    b.draw(F.glow, G.x, G.y, L * 1.6, L * 1.6, 0, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.5 * da * glowA, 1);
    for (let j = 0; j < 12; j++) {
      const ang = j / 12 * Math.PI * 2 + hash(sd + j * 1.7) * 0.3;
      bolt(b, F, G.x, G.y, G.x + Math.cos(ang) * L, G.y + Math.sin(ang) * L * 0.85, 4 * wm, da, sd * 13 + j, true, glowA);
    }
    core(b, F, G.x, G.y, 26 * da + 4, t, da, 0.2, glowA);
  }
  // Aftermath: residual arcs crackle over the field.
  if (bt > 30 && fade > 0) {
    const sd = (p.t / 3) | 0;
    for (let j = 0; j < 4; j++) {
      if (hash(sd * 2.7 + j) < 0.45) continue;
      const x = hash(sd + j * 3.3) * W, y = hash(sd * 1.9 + j) * H * 0.8, ang = hash(sd + j) * Math.PI * 2, L = 30 + 40 * hash(sd * 5 + j);
      bolt(b, F, x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, 2, 0.7 * fade * Math.max(0, 1 - bt / 140), sd * 17 + j, true, glowA);
    }
  }
}

/** The Storm Cell's cloud at the top of the screen: dark billows lit from inside by flashes. */
function renderCloud(p, b, a, glowA) {
  const F = p.F, y = ODUYA.storm.cloudY, sd = (p.t / 3) | 0;
  // A dim blue underglow so the cloud reads against a dark stage, dark billows over it, a lit rim below.
  b.draw(F.glow, W / 2, y + 10, W * 1.3, 170, 0, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.22 * a * glowA, 1);
  for (let k = 0; k < 11; k++) {
    const x = (k + 0.5) / 11 * W + Math.sin(p.t * 0.02 + k) * 10, s = 100 + 40 * hash(k * 3.1), yy = y + (hash(k) - 0.5) * 26;
    b.draw(F.glow, x, yy, s * 1.4, s, 0, CLOUD[0], CLOUD[1], CLOUD[2], 0.85 * a, 0);
    b.draw(F.glow, x, yy + s * 0.3, s * 1.1, s * 0.35, 0, BLUE[0], BLUE[1], BLUE[2], 0.14 * a * glowA, 1);
  }
  for (let k = 0; k < 4; k++) { // flashes inside the cloud
    if (hash(sd * 1.9 + k) < 0.45) continue;
    const x = hash(sd + k * 2.3) * W;
    b.draw(F.glow, x, y, 140, 80, 0, BLUE[0], BLUE[1], BLUE[2], 0.5 * a * glowA, 1);
    b.draw(F.glow, x, y, 50, 30, 0, WHITE[0], WHITE[1], WHITE[2], 0.4 * a, 1);
  }
}

/** Every live lightning effect (strands, fist arcs, web, storm, ultimate). */
export function renderLightning(p, b) {
  const F = p.F, ps = p.ps, t = p.t, wm = LOOK.widthMul;
  const glowA = LOOK.glowMul * crowdFactor(p.w);
  // Leaders: the lit bolt from the fist through every node reached so far, the racing head.
  for (const L of ps.leaders) {
    const a = L.done ? 1 - L.t / L.life : 1, Wd = L.w * wm;
    const pts = L.pts.slice(0, L.k);
    if (!L.done) pts.push([L.hx, L.hy]);
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
      bolt(b, F, ax, ay, bx, by, Wd * (k === 1 ? 1 : 0.85), a, L.s + k * 3.7 + t, Wd > 5, glowA);
      if (k < L.k) node(b, F, bx, by, Wd * 3.2, a);
    }
    for (const [ax, ay, bx, by] of L.arcs) bolt(b, F, ax, ay, bx, by, Wd * 0.5, a * 0.95, L.s * 2.3 + ax + t, false, glowA);
    if (!L.done) node(b, F, L.hx, L.hy, Wd * 2.6, 1);
  }
  // Short bolts (the ultimate's lashes, the storm's feeders).
  for (const s of ps.bolts) {
    const a = 1 - s.t / s.life, Wd = s.w * wm;
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      bolt(b, F, ax, ay, bx, by, Wd, a, s.s + k * 3.7 + t, true, glowA);
      node(b, F, bx, by, Wd * 3, a);
    }
  }
  // Thundershock: the web from the clap through every enemy reached, and the crackle over each.
  if (ps.shock) {
    const sh = ps.shock, pts = [[sh.x0, sh.y0], ...sh.reached.map((e) => [e.x, e.y])];
    if (sh.k < sh.list.length) pts.push([sh.hx, sh.hy]);
    for (let k = 1; k < pts.length; k++) bolt(b, F, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 3.2 * wm, 0.75, t * 1.3 + k * 5.1, true, glowA);
    if (sh.k < sh.list.length) node(b, F, sh.hx, sh.hy, 12, 1);
    for (const e of sh.reached) {
      if (!e.alive) continue;
      for (let k = 0; k < 3; k++) {
        const a0 = hash(t * 0.37 + k * 9.1 + e.uid) * Math.PI * 2, r = e.r + 14;
        bolt(b, F, e.x + Math.cos(a0) * r, e.y + Math.sin(a0) * r, e.x - Math.cos(a0 + 0.8) * r, e.y - Math.sin(a0 + 0.8) * r, 4 * wm, 1, t + k * 11 + e.uid, true, glowA);
      }
      b.draw(F.glow, e.x, e.y, e.r * 3.2, e.r * 3.2, 0, BLUE[0], BLUE[1], BLUE[2], 0.3 + 0.2 * ((t >> 1) & 1), 1);
    }
  }
  // Storm Cell: the cloud forms, rains, and clears after the closing clap.
  if (ps.storm) { ps.cloudT = t; ps.cloudA = Math.min(1, ps.storm.t / 12) * (ps.storm.t > ODUYA.storm.clap ? 0.6 : 1); }
  const cf = ps.cloudT !== undefined ? Math.max(0, 1 - (t - ps.cloudT) / 30) : 0;
  if (cf > 0) renderCloud(p, b, (ps.cloudA ?? 1) * cf, glowA);
  // Strikes: the storm's bolts and the ultimate's detonation bolts.
  for (const s of ps.strikes) {
    const a = 1 - s.t / s.life;
    bolt(b, F, s.x0, s.y0, s.x1, s.y1, s.w * wm, a, s.s + t, true, glowA);
    node(b, F, s.x1, s.y1, s.w * 4, a);
  }
  if (ps.god) renderGod(p, b, ps.god, glowA);
}
