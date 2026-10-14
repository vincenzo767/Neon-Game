import { createMechaFx, crowdFactor, SHARD_TAG } from './art/mechaFx.js';
import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { kairoArt, PAL, RIG_FX, LOOK, animatedAnchor } from './kairoArt.js';
import { RIG, beamLevel } from './kairoRig.js';

// KAIRO v2 FX (ASSET_NOTES.md "Rebuild v2"): every effect is attached to the
// component that emits it (via the rig's posed anchors) and changes over time.
// Additive for energy; the shared lance / beam / flare textures come from
// art/mechaFx.js. Render-time only, except the particle bursts spawned from
// update/fire (cosmetic RNG: w.fxRng).

/** Hit radius of a main lance per power tier (the bright core is 2r wide). */
export const LANCE_R = [5, 5, 5.5, 6];

const base = createMechaFx(kairoArt, {
  body: [0.25, 0.85, 1.45], // cyan-blue, below the bloom's white clip
  lanceLen: (t) => 34 + 8 * t,
});
export { SHARD_TAG, crowdFactor };

const C = PAL.cyan, B = PAL.blue, W = PAL.core;
const fxOf = () => kairoArt.frames().fx;
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
const tierFx = (key, p) => RIG.fx[key][Math.max(0, Math.min(3, p.tier - 1))];

/** A thin glowing line (two layers: soft blue glow, cyan core) from (x0, y0) to (x1, y1). */
function line(b, F, x0, y0, x1, y1, wd, a, col = C) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 0.5) return;
  const ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, L, wd * 3.2, ang, B[0], B[1], B[2], 0.45 * a, 1);
  b.draw(F.laser, mx, my, L, wd, ang, col[0], col[1], col[2], a, 1);
}

/** A jagged electrical arc between two points (re-rolled every 2 steps). */
function arc(b, F, x0, y0, x1, y1, seed, a, wd = 1.4) {
  const n = 6, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let px = x0, py = y0;
  for (let k = 1; k <= n; k++) {
    const f = k / n, j = k < n ? (hash(seed + k * 3.7) - 0.5) * Math.min(14, L * 0.3) : 0;
    const qx = x0 + dx * f + nx * j, qy = y0 + dy * f + ny * j;
    line(b, F, px, py, qx, qy, wd, a, W);
    px = qx; py = qy;
  }
}

// ------------------------------------------------------------ rig layer FX

/** Glow strength around a layer's silhouette (armour-edge illumination). */
function edgeGlow(p, name) {
  const kr = p.ps.kr, aura = tierFx('aura', p) * (0.75 + 0.25 * Math.sin(p.t * 0.12));
  if (name.startsWith('gun')) {
    const fl = (name.endsWith('L') ? kr.flashL : kr.flashR) / 6;
    return fl * 0.55 * tierFx('flash', p) + aura * 0.25;
  }
  if (name.startsWith('inner')) return (kr.lockInner / 18) * 0.9 + (kr.innerDir ? 0.3 : 0) + aura * 0.18 * kr.inner;
  if (name.startsWith('outer')) return (kr.lockOuter / 18) * 0.9 + (kr.outerDir ? 0.3 : 0) + aura * 0.22 * kr.outer;
  if (name === 'body') return beamLevel(kr) * 0.12; // the torso lights up only while the chest charges / fires
  return 0;
}

RIG_FX.before = (p, b, api, name) => {
  const g = edgeGlow(p, name);
  if (g <= 0.02) return;
  // The layer drawn four times, nudged out and additive cyan: a halo hugging its outline.
  const d = 1.8, a = Math.min(0.9, g) * 0.38;
  for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) api.drawLayer(name, { dx, dy, add: 1, tint: [C[0] * 0.5, C[1] * 0.7, C[2] * 0.8], alpha: a });
};

// Layer FX in one pass over the finished mecha (atlas textures: one batch).
RIG_FX.overlay = (p, b, api) => {
  for (const name of OVERLAY) layerFx(p, b, api, name);
  // Armour illumination after a shot: the hand, forearm and cannon flash cyan (pilot texture, last).
  const kr = p.ps.kr;
  if (!kr) return;
  for (const s of ['L', 'R']) {
    const fl = (s === 'L' ? kr.flashL : kr.flashR) / 6;
    if (fl > 0) api.drawLayer('gun' + s, { add: 1, tint: [C[0] * 0.6, C[1] * 0.8, C[2]], alpha: 0.4 * fl * tierFx('flash', p) });
  }
};
const OVERLAY = ['outerRootL', 'outerRootR', 'innerRootL', 'innerRootR', 'gunL', 'gunR', 'body'];

function layerFx(p, b, api, name) {
  const kr = p.ps.kr, F = p.F, t = p.t, fx = fxOf();
  if (!kr || !fx) return;
  const s = name.endsWith('L') ? 'L' : 'R';
  if (name === `innerRoot${s}` || name === `outerRoot${s}`) {
    // Wing energy conduits: light flowing from the joint out to the tip, brighter as the blade locks.
    const blade = name.startsWith('inner') ? 'inner' : 'outer', d = kr[blade];
    if (d < 0.05) return;
    const [px, py] = api.at(`${blade}Pivot${s}`), [jx, jy] = api.at(`${blade}Joint${s}`), [tx, ty] = api.at(`${blade}Tip${s}`);
    const lock = (blade === 'inner' ? kr.lockInner : kr.lockOuter) / 18, a = d * (0.3 + 0.15 * tierFx('aura', p) + 0.6 * lock);
    line(b, F, px, py, jx, jy, 0.7, a * 0.5, B);
    line(b, F, jx, jy, tx, ty, 0.6, a * 0.55, B);
    for (let k = 0; k < 3; k++) { // pulses running out to the tip
      const f = ((t * 0.025 + k / 3) % 1), x = px + (tx - px) * f, y = py + (ty - py) * f;
      b.draw(F.glow, x, y, 9, 9, 0, C[0], C[1], C[2], a * 0.9 * Math.sin(Math.PI * f), 1);
    }
    b.draw(fx.flare, tx, ty, 14 + 4 * Math.sin(t * 0.2), 14, t * 0.02, C[0], C[1], C[2], a * 0.8, 1);
    if (lock > 0) { // mechanical locking flash at the joints
      for (const [x, y] of [[px, py], [jx, jy]]) {
        b.draw(fx.flare, x, y, 40 * lock, 40 * lock, 0.4, W[0], W[1], W[2], lock, 1);
        b.draw(F.ring, x, y, 30 * (1.4 - lock), 30 * (1.4 - lock), 0, C[0], C[1], C[2], lock, 1);
      }
    }
    return;
  }
  if (name === `gun${s}`) {
    // Cannon: the blue energy channel pulses, charge pulses climb the barrel between shots,
    // the muzzle core brightens before each discharge, the forearm lights up on recoil.
    const ch = tierFx('channel', p), [cx, cy] = api.at(`chan${s}`), [mx, my] = api.at(`muzzle${s}`);
    const firing = kr.fireT < 12, idle = 0.55 + 0.25 * Math.sin(t * 0.08 + (s === 'L' ? 0 : 1.3));
    const lv = ch * (firing ? 1 : idle);
    b.draw(F.glow, cx, cy, 9 * ch, 20 * ch, 0, B[0], B[1], B[2], 0.55 * lv, 1);
    b.draw(F.glow, cx, cy, 4, 12, 0, C[0], C[1], C[2], 0.8 * lv, 1);
    if (firing) {
      const f = Math.min(1, kr.fireT / 5); // 0 just fired → 1 ready again
      const y = cy + (my - cy) * f, x = cx + (mx - cx) * f;
      b.draw(F.glow, x, y, 7, 11, 0, W[0], W[1], W[2], 0.7 * ch, 1);
      b.draw(F.glow, mx, my, 10 * f * ch + 3, 10 * f * ch + 3, 0, C[0], C[1], C[2], 0.8 * f, 1);
    }
    return;
  }
  if (name === 'body') {
    // Chest core: idle pulse (focus charging is drawn by renderBeam, above everything).
    const [x, y] = api.at('chest'), pu = 0.8 + 0.2 * Math.sin(t * 0.09);
    b.draw(F.glow, x, y, 18 * pu, 14 * pu, 0, B[0], B[1], B[2], 0.5, 1);
    b.draw(F.glow, x, y, 7, 6, 0, C[0], C[1], C[2], 0.7 * pu, 1);
    // Full power: controlled arcs crawling between the wing joints and the shoulders.
    const aura = tierFx('aura', p) * kr.outer;
    if (aura > 0.05 && (t >> 1) % 3 !== 2) {
      const pts = ['innerPivotL', 'innerJointL', 'outerJointL', 'outerPivotL', 'innerPivotR', 'innerJointR', 'outerJointR', 'outerPivotR'].map(api.at);
      const sd = (t >> 1) * 7.3;
      for (let k = 0; k < 2; k++) {
        const i = Math.floor(hash(sd + k) * 3) + (k ? 4 : 0);
        arc(b, F, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], sd + k * 11, 0.7 * aura);
      }
    }
    // Tier-transition waves rolling out of the chest.
    for (const [T, n, big] of [[kr.wave3, 40, 0], [kr.wave4, 60, 1]]) {
      if (T <= 0) continue;
      const f = 1 - T / n;
      for (let r = 0; r <= big; r++) {
        const ff = Math.min(1, f * (1 + r * 0.6)), R = (40 + 140 * ff) * (1 + big * 0.4);
        b.draw(F.ring, x, y, R, R * 0.8, 0, C[0], C[1], C[2], (1 - ff) * 0.8, 1);
      }
    }
  }
};

// ------------------------------------------------------------ shots

/** Every player shot: the original glowing lances (shared mechaFx look). */
export const renderShots = base.renderShots;

/** Cannon discharge at a muzzle: core flash, angular energy shapes, a ring, forward sparks. */
export function muzzleFx(p, w, x, y, ang) {
  const H = w.fxHigh, R = w.fxRng, F = p.F, fx = fxOf(), k = tierFx('flash', p);
  if (!fx) return;
  let i = H.spawn(F.glow, x, y, 0, -0.6, 4);
  if (i >= 0) { H.size(i, 22 * k, 10 * k); H.color(i, W[0], W[1], W[2], C[0], C[1], C[2]); H.look(i, 0.85, 1, FADE_OUT); }
  i = H.spawn(fx.flare, x, y - 2, 0, -0.6, 4);
  if (i >= 0) { H.size(i, 30 * k, 18 * k); H.spin(i, 0, 0); H.color(i, C[0], C[1], C[2], B[0], B[1], B[2]); H.look(i, 0.8, 1, FADE_OUT); }
  i = H.spawn(F.ring, x, y, 0, -1, 7);
  if (i >= 0) { H.size(i, 4, 18 * k); H.color(i, C[0], C[1], C[2], B[0], B[1], B[2]); H.look(i, 0.6, 1, FADE_OUT); }
  // Angular energy blades fanning forward from the bore.
  for (let n = 0; n < 2 + (p.tier >= 3 ? 1 : 0); n++) {
    const a = ang + R.range(-0.45, 0.45), sp = R.range(4, 8);
    i = H.spawn(fx.shard, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(4, 7));
    if (i < 0) return;
    H.size(i, 10 * k, 4); H.spin(i, a, 0); H.phys(i, 0.8);
    H.color(i, W[0], W[1], W[2], C[0], C[1], C[2]); H.look(i, 0.9, 1, FADE_OUT);
  }
}

/** Impact: hot flash, cyan ring, sparks, and at tier 3+ an angular flare. */
export function hitSpark(w, x, y, angle) {
  base.hitSpark(w, x, y, angle);
  const H = w.fxHigh, R = w.fxRng, fx = fxOf();
  if (!fx || R.next() < 0.5) return;
  const i = H.spawn(fx.flare, x, y, 0, 0, 6);
  if (i >= 0) { H.size(i, 26, 6); H.spin(i, R.range(0, 3), 0); H.color(i, W[0], W[1], W[2], C[0], C[1], C[2]); H.look(i, 0.8, 1, FADE_OUT); }
}

// ------------------------------------------------------------ transformation bursts

/** Particles for the rig's events (kairoRig.step). Bounded: under ~60 particles per event. */
export function rigEvents(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F;
  const at = (n) => animatedAnchor(p, n);
  const sparks = (x, y, n, sp, col = C) => {
    for (let k = 0; k < n; k++) {
      const a = R.range(0, Math.PI * 2), v = R.range(sp * 0.4, sp);
      const i = H.spawn(F.spark, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(10, 20));
      if (i < 0) return;
      H.size(i, 4); H.spin(i, a, 0); H.phys(i, 0.9); H.color(i, W[0], W[1], W[2], col[0], col[1], col[2]); H.look(i, 1, 1, FADE_OUT, 0.5);
    }
  };
  const motes = (n0, n1, count) => { // energy motes strung along a blade
    const [x0, y0] = at(n0), [x1, y1] = at(n1);
    for (let k = 0; k < count; k++) {
      const f = R.next(), i = H.spawn(F.glow, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, R.range(-0.6, 0.6), R.range(-0.6, 0.6), R.range(14, 26));
      if (i < 0) return;
      H.size(i, R.range(3, 6), 1); H.color(i, C[0], C[1], C[2], B[0], B[1], B[2]); H.look(i, 0.8, 1, FADE_INOUT);
    }
  };
  if (ev.deploy3) {
    w.r.post.shockwave(p.x, p.y, 0.025, 0.02, 0.5);
    for (const s of ['L', 'R']) sparks(...at(`innerPivot${s}`), 10, 4);
  }
  if (ev.lock3) {
    for (const s of ['L', 'R']) { sparks(...at(`innerJoint${s}`), 8, 3); motes(`innerPivot${s}`, `innerTip${s}`, 8); }
  }
  if (ev.deploy4) {
    w.r.post.flash(0.3, 0.8, 1, 0.35, 0.04);
    w.r.post.shockwave(p.x, p.y, 0.05, 0.025, 0.9);
    w.g.camera.addTrauma(0.25);
    for (const s of ['L', 'R']) sparks(...at(`outerPivot${s}`), 14, 5);
  }
  if (ev.lock4) {
    w.r.post.shockwave(p.x, p.y, 0.03, 0.02, 0.6);
    for (const s of ['L', 'R']) { sparks(...at(`outerJoint${s}`), 10, 4); motes(`outerPivot${s}`, `outerTip${s}`, 12); }
  }
  for (const [e, n] of [['retract3', 'inner'], ['retract4', 'outer']]) {
    if (ev[e]) for (const s of ['L', 'R']) sparks(...at(`${n}Pivot${s}`), 6, 2, B);
  }
}

/** Focus particles: converging streams while charging, sparks while active, a burst on release. */
export function beamParticles(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, kr = p.ps.kr, [x, y] = animatedAnchor(p, 'chest');
  if (kr.fs === 'charge') {
    for (let k = 0; k < 3; k++) {
      const a = R.range(0, Math.PI * 2), d = R.range(40, 70), life = 9;
      const i = H.spawn(F.glow, x + Math.cos(a) * d, y + Math.sin(a) * d, -Math.cos(a) * d / life, -Math.sin(a) * d / life, life);
      if (i < 0) break;
      H.size(i, 5, 2); H.color(i, C[0], C[1], C[2], W[0], W[1], W[2]); H.look(i, 0.9, 1, FADE_INOUT);
    }
  } else if (kr.fs === 'active' && (p.t & 1)) {
    const a = -Math.PI / 2 + R.range(-1.4, 1.4) + (R.next() < 0.5 ? Math.PI : 0), sp = R.range(2, 5);
    const i = H.spawn(F.spark, x, y - 4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 14));
    if (i >= 0) { H.size(i, 4); H.spin(i, a, 0); H.phys(i, 0.88); H.color(i, W[0], W[1], W[2], C[0], C[1], C[2]); H.look(i, 1, 1, FADE_OUT, 0.5); }
  }
  if (ev.release) {
    for (let k = 0; k < 14; k++) {
      const a = R.range(0, Math.PI * 2), sp = R.range(1.5, 4.5);
      const i = H.spawn(F.glow, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(12, 22));
      if (i < 0) break;
      H.size(i, R.range(3, 6), 1); H.phys(i, 0.9); H.color(i, C[0], C[1], C[2], B[0], B[1], B[2]); H.look(i, 0.85, 1, FADE_OUT);
    }
  }
}

// ------------------------------------------------------------ the chest beam

/**
 * The focus attack, drawn over the mecha so it visibly leaves the blue chest
 * plate (the legs and feet are above the chest: drawn under them, the beam
 * would seem to start at the feet). Charge: the core brightens, rings close in,
 * arcs crackle. Active: a layered beam (envelope, solid core exactly the hit
 * width, white centre, two twisting filaments, distortion rings, origin
 * flare). Recovery: the beam collapses down into the chest.
 */
export function renderBeam(p, b, x, y) {
  const kr = p.ps.kr;
  if (!kr || kr.fs === 'off') return;
  const fx = fxOf(), F = p.F, t = p.t;
  if (!fx) return;
  const [cx, cy] = animatedAnchor(p, 'chest', x, y), lv = beamLevel(kr);
  const wv = 5 + p.tier * 2, wm = LOOK.widthMul, glowA = LOOK.glowMul * crowdFactor(p.w);
  // Chest core (all phases).
  const core = kr.fs === 'charge' ? 0.4 + 0.6 * lv : kr.fs === 'active' ? 1 : lv;
  b.draw(F.glow, cx, cy, 34 * core + 8, 30 * core + 8, 0, B[0], B[1], B[2], 0.6 * core, 1);
  b.draw(F.core, cx, cy, 10 * core + 4, 10 * core + 4, 0, W[0], W[1], W[2], 0.9 * core, 1);
  if (kr.fs === 'charge') {
    // Rings closing in on the emitter, turning; arcs crawling over the chest plate.
    for (let r = 0; r < 2; r++) {
      const R = (40 - 26 * lv) * (1 + r * 0.45);
      b.draw(F.ring, cx, cy, R, R, t * 0.08 * (r ? -1 : 1), C[0], C[1], C[2], 0.35 + 0.45 * lv, 1);
    }
    for (let k = 0; k < 4; k++) { // converging streams
      const a = k * Math.PI / 2 + t * 0.05, d0 = 46 - 30 * lv;
      line(b, F, cx + Math.cos(a) * d0, cy + Math.sin(a) * d0, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1.2, 0.6 * lv);
    }
    if ((t >> 1) & 1) {
      const a = hash(t) * Math.PI * 2;
      arc(b, F, cx + Math.cos(a) * 18, cy + Math.sin(a) * 14, cx, cy, t * 1.3, 0.8 * lv, 1.1);
    }
    b.draw(fx.flare, cx, cy, 30 * lv, 30 * lv, t * 0.04, C[0], C[1], C[2], 0.8 * lv, 1);
    return;
  }
  // Beam (active) or collapsing beam (recovery): its far end comes down into the chest.
  const top = -20, far = kr.fs === 'active' ? top : cy - (cy - top) * lv * lv;
  const len = cy - far, wcol = wv * wm * (kr.fs === 'active' ? 1 : 0.4 + 0.6 * lv);
  if (len < 2) return;
  const my = (cy + far) / 2, up = -Math.PI / 2, pulse = 0.92 + 0.08 * Math.sin(t * 0.9), hot = 0.85 + 0.15 * Math.sin(t * 0.55);
  b.draw(F.laser, cx, my, len, wcol * 3.4 * pulse, up, B[0], B[1], B[2], 0.38 * glowA, 1);           // outer envelope
  b.draw(F.laser, cx, my, len, wcol * 2.4, up, PAL.violet[0], PAL.violet[1], PAL.violet[2], 0.3 * glowA, 1);
  b.draw(fx.beam, cx, my, len, wcol / 0.62, up, 0.25, 0.85, 1.45, 0.85, 1);                          // solid core = hit width
  b.draw(fx.beam, cx, my, len, wcol * 0.36 * hot, up, W[0] * 0.75, W[1] * 0.75, W[2] * 0.75, 0.95, 1); // white-hot centre
  // Two energy filaments twisting around the core.
  for (const ph of [0, Math.PI]) {
    let px = cx + Math.sin(ph + t * 0.35) * wcol * 0.7, py = cy;
    for (let yy = cy - 14; yy > far; yy -= 14) {
      const qx = cx + Math.sin(ph + t * 0.35 + (cy - yy) * 0.045) * wcol * 0.7;
      line(b, F, px, py, qx, yy, 0.9, 0.55 * glowA);
      px = qx; py = yy;
    }
  }
  // Distortion waves running up the beam.
  for (let k = 0; k < 6; k++) {
    const d = (t * 9 + k * (len / 6)) % len, f = d / len;
    b.draw(F.ring, cx, cy - d, wcol * 0.8, wcol * 3, up, C[0], C[1], C[2], 0.55 * (1 - f * 0.7), 1);
  }
  // The emitter: tapered flare where the beam leaves the chest plate.
  b.draw(fx.flare, cx, cy - 2, 26 * pulse, 18, 0, C[0], C[1], C[2], 0.65, 1);
  b.draw(F.ring, cx, cy, 18 + 3 * Math.sin(t * 0.5), 14, 0, C[0], C[1], C[2], 0.7, 1);
  b.draw(F.glow, cx, cy - 4, wcol * 1.3, 12, 0, W[0], W[1], W[2], 0.4, 1);
}
