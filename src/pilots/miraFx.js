import { createMechaFx, crowdFactor, SHARD_TAG } from './art/mechaFx.js';
import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { miraArt, PAL, RIG_FX } from './miraArt.js';
import { RIG, focusLevel } from './miraRig.js';

// MIRA v2 FX (ASSET_NOTES.md "Rebuild v2"): every effect is attached to the
// component that emits it (via the rig's posed anchors) and changes over time.
// The original gold needles, muzzle flare and hit burst are kept (shared
// mechaFx look); around them, Mira's own motif: halo rings with light nodes,
// drifting gold light-feathers, warm armour glow. Additive for energy.
// Render-time only, except the particle bursts spawned from update/fire
// (cosmetic RNG: w.fxRng).

/** The original needle look (renderShots), muzzle flare and hit burst. */
export const base = createMechaFx(miraArt, {
  body: [1.45, 0.95, 0.22], // amber-gold, below the bloom's white clip
  lanceLen: (t) => 20 + 4 * t, // needles: shorter and slower than Kairo's lances
});
export { SHARD_TAG, crowdFactor };

const W = PAL.core, G = PAL.hot, M = PAL.mid;
const fxOf = () => miraArt.frames().fx;
const tierFx = (key, p) => RIG.fx[key][Math.max(0, Math.min(3, p.tier - 1))];
const TAU = Math.PI * 2;

/** A thin glowing line (soft amber glow, gold core) from (x0, y0) to (x1, y1). */
function line(b, F, x0, y0, x1, y1, wd, a, col = G) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 0.5) return;
  const ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, L, wd * 3, ang, M[0], M[1], M[2], 0.4 * a, 1);
  b.draw(F.laser, mx, my, L, wd, ang, col[0], col[1], col[2], a, 1);
}

/** Mira's halo: a ring with `n` light nodes turning at `spin` (her procedural ship's motif). */
function halo(b, F, x, y, R, n, spin, a, sq = 1) {
  if (a <= 0.01 || R < 1) return;
  b.draw(F.ring, x, y, R * 2, R * 2 * sq, 0, G[0], G[1], G[2], 0.55 * a, 1);
  for (let k = 0; k < n; k++) {
    const ang = spin + (k / n) * TAU, nx = x + Math.cos(ang) * R, ny = y + Math.sin(ang) * R * sq;
    b.draw(F.glow, nx, ny, 6, 6, 0, M[0], M[1], M[2], 0.5 * a, 1);
    b.draw(F.core, nx, ny, 2.5, 2.5, 0, W[0], W[1], W[2], 0.8 * a, 1);
  }
}

// ------------------------------------------------------------ rig layer FX

/** Glow strength around a layer's silhouette (armour-edge illumination). */
function edgeGlow(p, name) {
  const mr = p.ps.mr, aura = tierFx('aura', p) * (0.75 + 0.25 * Math.sin(p.t * 0.1));
  if (name.startsWith('gun')) {
    const fl = (name.endsWith('L') ? mr.flashL : mr.flashR) / 6;
    return fl * 0.5 * tierFx('flash', p) + aura * 0.2;
  }
  if (name.startsWith('inner')) return (mr.lockInner / 18) * 0.9 + (mr.innerDir ? 0.35 : 0) + aura * 0.2 * mr.inner;
  if (name.startsWith('outer')) return (mr.lockOuter / 18) * 0.9 + (mr.outerDir ? 0.35 : 0) + aura * 0.24 * mr.outer;
  if (name === 'body') return focusLevel(mr) * 0.06;
  return 0;
}

RIG_FX.before = (p, b, api, name) => {
  const g = edgeGlow(p, name);
  if (g <= 0.02) return;
  // The layer drawn four times, nudged out and additive gold: a halo hugging its outline.
  const d = 1.6, a = Math.min(0.8, g) * 0.3;
  for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) api.drawLayer(name, { dx, dy, add: 1, tint: [G[0] * 0.55, G[1] * 0.5, G[2] * 0.4], alpha: a });
};

// Layer FX in one pass over the finished mecha (atlas textures: one batch).
RIG_FX.overlay = (p, b, api) => {
  const mr = p.ps.mr;
  if (!mr || !fxOf()) return;
  for (const s of ['L', 'R']) { bladeFx(p, b, api, 'outer', s); bladeFx(p, b, api, 'inner', s); }
  for (const s of ['L', 'R']) cannonFx(p, b, api, s);
  chestFx(p, b, api);
  // Armour illumination after a shot: the cannon and fist flash gold (pilot texture, last).
  for (const s of ['L', 'R']) {
    const fl = (s === 'L' ? mr.flashL : mr.flashR) / 6;
    if (fl > 0) api.drawLayer('gun' + s, { add: 1, tint: [G[0] * 0.45, G[1] * 0.4, G[2] * 0.3], alpha: 0.45 * fl * tierFx('flash', p) });
  }
};

/** Blade conduits: light flowing root → joint → tip, a turning halo at the tip, lock flashes. */
function bladeFx(p, b, api, blade, s) {
  const mr = p.ps.mr, F = p.F, t = p.t, fx = fxOf(), d = mr[blade];
  if (d < 0.05) return;
  const [px, py] = api.at(`${blade}Pivot${s}`), [jx, jy] = api.at(`${blade}Joint${s}`), [tx, ty] = api.at(`${blade}Tip${s}`);
  const lock = (blade === 'inner' ? mr.lockInner : mr.lockOuter) / 18, a = d * (0.28 + 0.15 * tierFx('aura', p) + 0.6 * lock);
  line(b, F, px, py, jx, jy, 0.7, a * 0.45);
  line(b, F, jx, jy, tx, ty, 0.6, a * 0.5);
  for (let k = 0; k < 3; k++) { // light pulses running out to the tip
    const f = (t * 0.022 + k / 3 + (blade === 'outer' ? 0.5 : 0)) % 1, x = px + (tx - px) * f, y = py + (ty - py) * f;
    b.draw(F.glow, x, y, 8, 8, 0, G[0], G[1], G[2], a * 0.9 * Math.sin(Math.PI * f), 1);
  }
  // Tip: a small turning halo once the blade is out.
  const sp = (s === 'L' ? 1 : -1) * t * 0.06;
  b.draw(fx.flare, tx, ty, 12 + 3 * Math.sin(t * 0.17), 12, sp, G[0], G[1], G[2], a * 0.75, 1);
  if (d > 0.9) halo(b, F, tx, ty, 5, 3, sp, a * 0.4);
  if (lock > 0) { // the lock: a bright flash and a widening ring at the pivot and joint
    for (const [x, y] of [[px, py], [jx, jy]]) {
      b.draw(fx.flare, x, y, 20 * lock, 20 * lock, 0.4, W[0], W[1], W[2], 0.75 * lock, 1);
      b.draw(F.ring, x, y, 22 * (1.4 - lock), 22 * (1.4 - lock), 0, G[0], G[1], G[2], 0.8 * lock, 1);
    }
  }
}

/** Cannon: barrel channel glow, charge pulses climbing to the muzzle, the bore lit after a shot. */
function cannonFx(p, b, api, s) {
  const mr = p.ps.mr, F = p.F, t = p.t, ch = tierFx('channel', p);
  const [cx, cy] = api.at(`chan${s}`), [mx, my] = api.at(`muzzle${s}`);
  const firing = mr.fireT < 12 && p.tier >= 2, idle = 0.5 + 0.25 * Math.sin(t * 0.08 + (s === 'L' ? 0 : 1.3));
  const lv = ch * (firing ? 1 : idle);
  b.draw(F.glow, cx, cy, 9 * ch, 18 * ch, 0, M[0], M[1], M[2], 0.5 * lv, 1);
  b.draw(F.glow, cx, cy, 4, 10, 0, G[0], G[1], G[2], 0.75 * lv, 1);
  if (!firing) return;
  if (mr.fireT < 4) {
    const g = 1 - mr.fireT / 4; // barrel lit along its length right after the shot
    line(b, F, cx, cy, mx, my, 1.5, 0.85 * g * ch, W);
    b.draw(F.glow, mx, my, 24 * g, 24 * g, 0, G[0], G[1], G[2], 0.75 * g, 1);
  }
  const f = Math.min(1, mr.fireT / 5); // 0 just fired → 1 ready again: a pulse climbs the barrel
  b.draw(F.glow, cx + (mx - cx) * f, cy + (my - cy) * f, 6, 10, 0, W[0], W[1], W[2], 0.65 * ch, 1);
  b.draw(F.glow, mx, my, 9 * f * ch + 3, 9 * f * ch + 3, 0, G[0], G[1], G[2], 0.75 * f, 1);
}

/** Chest emitter: idle pulse, volley flashes; the full-power halo; tier-transition waves. */
function chestFx(p, b, api) {
  const mr = p.ps.mr, F = p.F, t = p.t, [x, y] = api.at('chest');
  const pu = 0.8 + 0.2 * Math.sin(t * 0.09) + (mr.chestT / 6) * 0.9;
  b.draw(F.glow, x, y, 16 * pu, 12 * pu, 0, M[0], M[1], M[2], 0.5, 1);
  b.draw(F.glow, x, y, 6, 5, 0, W[0], W[1], W[2], 0.7 * pu, 1);
  // Full power: a wide, faint halo turning around the torso, its nodes linked to the blade joints by arcs of light.
  const aura = tierFx('aura', p) * mr.outer;
  if (aura > 0.05) {
    const [hx, hy] = api.at('hitbox');
    halo(b, F, hx, hy + 2, 34 + Math.sin(t * 0.05), 8, t * 0.012, 0.22 * aura, 0.55);
  }
  for (const [T, n, big] of [[mr.wave3, 40, 0], [mr.wave4, 60, 1]]) {
    if (T <= 0) continue;
    const f = 1 - T / n;
    for (let r = 0; r <= big; r++) {
      const ff = Math.min(1, f * (1 + r * 0.6)), R = (60 + 120 * ff) * (1 + big * 0.4); // starts outside the silhouette
      b.draw(F.ring, x, y, R, R * 0.8, 0, G[0], G[1], G[2], (1 - ff) * 0.5, 1);
    }
  }
}

// ------------------------------------------------------------ firing

/** Cannon discharge at a muzzle: the original gold flare, plus a ring and light shards fanning forward. */
export function muzzleFx(p, w, x, y, ang) {
  base.muzzleFlash(p, w, x, y, 18 * tierFx('flash', p));
  const H = w.fxHigh, R = w.fxRng, F = p.F, fx = fxOf(), k = tierFx('flash', p);
  if (!fx) return;
  let i = H.spawn(F.ring, x, y, 0, -0.8, 7);
  if (i >= 0) { H.size(i, 4, 16 * k); H.color(i, G[0], G[1], G[2], M[0], M[1], M[2]); H.look(i, 0.55, 1, FADE_OUT); }
  for (let n = 0; n < 2; n++) {
    const a = ang + R.range(-0.4, 0.4), sp = R.range(3.5, 6.5);
    i = H.spawn(fx.shard, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(4, 7));
    if (i < 0) return;
    H.size(i, 8 * k, 3); H.spin(i, a, 0); H.phys(i, 0.8);
    H.color(i, W[0], W[1], W[2], G[0], G[1], G[2]); H.look(i, 0.85, 1, FADE_OUT);
  }
}

/** Chest discharge (tier-1 fan, focus volleys): the original gold flare and a small halo flash. */
export function chestShotFx(p, w, x, y, size = 22) {
  base.muzzleFlash(p, w, x, y, size);
  const H = w.fxHigh, F = p.F;
  if (!fxOf()) return;
  const i = H.spawn(F.ring, x, y, 0, 0, 6);
  if (i >= 0) { H.size(i, 6, 20); H.color(i, W[0], W[1], W[2], G[0], G[1], G[2]); H.look(i, 0.5, 1, FADE_OUT); }
}

export const hitSpark = base.hitSpark;
export const renderShots = base.renderShots;

// ------------------------------------------------------------ transformation bursts

/** Particles for the rig's events (miraRig.step). Bounded: under ~50 particles per event. */
export function rigEvents(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, fx = fxOf();
  const at = (n) => miraArt.animatedAnchor(p, n);
  const sparks = (x, y, n, sp, col = G) => {
    for (let k = 0; k < n; k++) {
      const a = R.range(0, TAU), v = R.range(sp * 0.4, sp);
      const i = H.spawn(F.spark, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(10, 18));
      if (i < 0) return;
      H.size(i, 4); H.spin(i, a, 0); H.phys(i, 0.9); H.color(i, W[0], W[1], W[2], col[0], col[1], col[2]); H.look(i, 1, 1, FADE_OUT, 0.5);
    }
  };
  // Light-feathers shed along a blade: slow shards drifting outward and down, fading in and out.
  const feathers = (n0, n1, count, s) => {
    const [x0, y0] = at(n0), [x1, y1] = at(n1);
    for (let k = 0; k < count; k++) {
      const f = R.next(), a = Math.PI / 2 + s * R.range(0.3, 1.1);
      const i = H.spawn(fx.shard, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.cos(a) * R.range(0.4, 1.2), Math.sin(a) * R.range(0.3, 1), R.range(18, 30));
      if (i < 0) return;
      H.size(i, R.range(6, 10), 3); H.spin(i, a, R.range(-0.05, 0.05));
      H.color(i, W[0], W[1], W[2], G[0], G[1], G[2]); H.look(i, 0.8, 1, FADE_INOUT);
    }
  };
  if (ev.deploy3) {
    w.r.post.shockwave(p.x, p.y, 0.02, 0.02, 0.45);
    for (const s of ['L', 'R']) sparks(...at(`innerPivot${s}`), 8, 3.5);
  }
  if (ev.lock3) {
    for (const s of ['L', 'R']) { sparks(...at(`innerJoint${s}`), 6, 3); feathers(`innerPivot${s}`, `innerTip${s}`, 6, s === 'L' ? 1 : -1); }
  }
  if (ev.deploy4) {
    w.r.post.flash(1, 0.8, 0.35, 0.16, 0.05);
    w.r.post.shockwave(p.x, p.y, 0.045, 0.025, 0.85);
    w.g.camera.addTrauma(0.2);
    for (const s of ['L', 'R']) sparks(...at(`outerPivot${s}`), 12, 4.5);
  }
  if (ev.lock4) {
    w.r.post.shockwave(p.x, p.y, 0.03, 0.02, 0.6);
    for (const s of ['L', 'R']) { sparks(...at(`outerJoint${s}`), 8, 3.5); feathers(`outerPivot${s}`, `outerTip${s}`, 9, s === 'L' ? 1 : -1); }
  }
  for (const [e, n] of [['retract3', 'inner'], ['retract4', 'outer']]) {
    if (ev[e]) for (const s of ['L', 'R']) sparks(...at(`${n}Pivot${s}`), 5, 2, M);
  }
}

/** Focus-cycle particles: motes drawn into the chest while charging, a soft burst on release. */
export function focusParticles(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, mr = p.ps.mr, [x, y] = miraArt.animatedAnchor(p, 'chest');
  if (mr.fs === 'charge') {
    for (let k = 0; k < 2; k++) {
      const a = R.range(0, TAU), d = R.range(34, 56), life = 9;
      const i = H.spawn(F.glow, x + Math.cos(a) * d, y + Math.sin(a) * d, -Math.cos(a) * d / life, -Math.sin(a) * d / life, life);
      if (i < 0) break;
      H.size(i, 5, 2); H.color(i, G[0], G[1], G[2], W[0], W[1], W[2]); H.look(i, 0.9, 1, FADE_INOUT);
    }
  }
  if (ev.release) {
    for (let k = 0; k < 10; k++) {
      const a = R.range(0, TAU), sp = R.range(1.2, 3.5);
      const i = H.spawn(F.glow, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(12, 20));
      if (i < 0) break;
      H.size(i, R.range(3, 5), 1); H.phys(i, 0.9); H.color(i, G[0], G[1], G[2], M[0], M[1], M[2]); H.look(i, 0.8, 1, FADE_OUT);
    }
  }
}

/**
 * The focus cycle at the chest, drawn over the mecha (the legs sit above the
 * chest in this feet-first pose). Charge: a halo closes in on the emitter and
 * locks, the core brightens. Active: the locked halo turns fast, flashing with
 * each needle volley; short sight lines point the way. Recovery: the halo opens
 * out and fades. The needle stream itself is the attack (unchanged).
 */
export function renderFocus(p, b, x, y) {
  const mr = p.ps.mr;
  if (!mr || mr.fs === 'off') return;
  const fx = fxOf(), F = p.F, t = p.t;
  if (!fx) return;
  const [cx, cy] = miraArt.animatedAnchor(p, 'chest', x, y), lv = focusLevel(mr);
  const core = mr.fs === 'charge' ? 0.35 + 0.65 * lv : mr.fs === 'active' ? 1 : lv;
  const vol = mr.vol / 4;
  b.draw(F.glow, cx, cy, 16 * core + 6 + 6 * vol, 13 * core + 5 + 5 * vol, 0, M[0], M[1], M[2], 0.4 * core, 1);
  b.draw(F.core, cx, cy, 5 * core + 2 + 3 * vol, 5 * core + 2 + 3 * vol, 0, W[0], W[1], W[2], 0.8 * core, 1);
  if (mr.fs === 'charge') {
    // The halo closes in from wide and slow to tight and fast; light threads run into the core.
    const R = 40 - 26 * lv;
    halo(b, F, cx, cy, R, 6, t * (0.05 + 0.12 * lv), 0.4 + 0.6 * lv);
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 - t * 0.07, d0 = R + 8;
      line(b, F, cx + Math.cos(a) * d0, cy + Math.sin(a) * d0, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 1, 0.55 * lv, W);
    }
    b.draw(fx.flare, cx, cy, 26 * lv, 26 * lv, t * 0.04, G[0], G[1], G[2], 0.75 * lv, 1);
    return;
  }
  if (mr.fs === 'active') {
    halo(b, F, cx, cy, 13 + 2 * vol, 6, t * 0.17, 0.55);
    b.draw(F.ring, cx, cy, 44 + 6 * Math.sin(t * 0.3), 44 + 6 * Math.sin(t * 0.3), 0, M[0], M[1], M[2], 0.18 + 0.2 * vol, 1);
    b.draw(fx.flare, cx, cy - 2, 16 + 8 * vol, 11, 0, G[0], G[1], G[2], 0.35 + 0.25 * vol, 1);
    // Sight lines: three short tapered rays ahead of the chest, along the stream.
    for (const o of [-0.06, 0, 0.06]) {
      const a = -Math.PI / 2 + o, L = 26 + 8 * Math.sin(t * 0.4 + o * 30);
      b.draw(F.laser, cx + Math.cos(a) * (10 + L / 2), cy + Math.sin(a) * (10 + L / 2), L, 2, a, G[0], G[1], G[2], 0.45 * crowdFactor(p.w), 1);
    }
    return;
  }
  // Recovery: the halo opens out and fades; the core cools.
  halo(b, F, cx, cy, 14 + 30 * (1 - lv), 6, t * 0.17 * lv, lv);
}
