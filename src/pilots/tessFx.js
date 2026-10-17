import { crowdFactor } from './art/mechaFx.js';
import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { tessArt, PAL, RIG_FX } from './tessArt.js';
import { rigState } from './tessRig.js';

// Tess's weapon effects (v2), after the crescent-slash rows of fx_reference.png,
// in the owner's colours: violet outside, a scarlet band, orange inside,
// white-hot edge. All cosmetic: hit areas live in tess.js.
//
// Shots carry a visual tag in shots.aux: 1 = Tess's crescent, 3 = a glitch
// clone's crescent, anything else = generic look.
//
// Rig FX (RIG_FX.overlay): each blade's energy line (the art's white core is
// lost with the checkerboard halo), the smear of a swinging blade, and the
// glitch look of the clones / the shadow look of Shadow Form (drawn copies set
// copy.glitch / copy.shade).

const LOOK = tessArt.LOOK;
const fxOf = () => tessArt.frames().fx;
const ORANGE = [1.8, 0.65, 0.04];   // below the bloom's white clip
const WHITE = [2.0, 1.7, 1.3];
const SCARLET = [1.9, 0.03, 0.05];
const PINK = [2.0, 0.35, 1.5];      // the blades' magenta light
const CYAN = [0.2, 1.4, 2.0];
const MAGENTA = [2.0, 0.2, 1.6];
const DARK = [0.06, 0.0, 0.12];
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
let CRESCENT = null;

/**
 * Thin crescent bulging toward +x (the direction of travel), tapering to
 * points at both ends; brightest along the leading edge. White, tinted per draw.
 */
function crescentTex(ctx, w, h) {
  const R = h * 0.47, cx = w - R - 1, cy = h / 2, d = R * 0.3;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#fff'; // opaque: erase the inside completely
  ctx.beginPath(); ctx.arc(cx - d, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/** Atlas builder (part of Tess's `sprites`). */
export function buildSprites(atlas) {
  atlas.add('t_crescent', 20, 40, crescentTex, { scale: 2 });
}

// Looked up per draw call (not cached across atlas rebuilds).
const crescent = (r) => { CRESCENT = r.frame('t_crescent'); };

/** Four-layer crescent: violet halo, scarlet band, orange body, white-hot leading edge. */
function drawCrescent(b, x, y, H, ang, glowA, alpha) {
  const f = CRESCENT, W = H * 0.5, dx = Math.cos(ang), dy = Math.sin(ang);
  // Each layer is wider and longer than the next, so violet frames scarlet frames orange.
  b.draw(f, x - dx * 3, y - dy * 3, W * 1.6, H * 1.28, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * 0.45 * alpha, 1);
  b.draw(f, x - dx * 1.5, y - dy * 1.5, W * 1.15, H * 1.1, ang, SCARLET[0], SCARLET[1], SCARLET[2], 0.8 * alpha, 1);
  b.draw(f, x, y, W * 0.7, H * 0.9, ang, ORANGE[0], ORANGE[1], ORANGE[2], 0.95 * alpha, 1);
  b.draw(f, x + dx, y + dy, W * 0.4, H * 0.62, ang, WHITE[0], WHITE[1], WHITE[2], 0.3 * alpha, 1);
}

// ------------------------------------------------------------- crescents

/**
 * Draw every player shot (replaces the generic shot renderer). A crescent
 * peels off the blade over its first steps (it grows out of the blade's
 * light), then flies with a scarlet-violet wake bent along its curve. Clone
 * crescents glitch: cyan / magenta split copies that flicker.
 */
export function renderShots(p, b, alpha, S) {
  const fx = fxOf(), w = p.w;
  crescent(w.r);
  const glowA = 0.4 * LOOK.glowMul * crowdFactor(w), wm = LOOK.widthMul;
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), tag = S.aux[i];
    if (tag !== 1 && tag !== 3) {
      const f = w.r.frames[S.frame[i]], sc = S.scale[i];
      b.draw(f, x, y, f.w * sc, f.h * sc, ang, 1, 1, 1, 0.5, 1);
      continue;
    }
    const age = S.age[i] + alpha, form = Math.min(1, age / 4);
    const H = 2 * S.radius[i] * 1.6 * wm * (0.45 + 0.55 * form);
    // Wake: where it came from (a homing turn bends it), from the previous step.
    const vx = S.x[i] - S.px[i], vy = S.y[i] - S.py[i], sp = Math.hypot(vx, vy) || 1;
    const L = Math.min(40, 10 + sp * 1.8) * wm;
    const wa = Math.atan2(vy, vx);
    b.draw(fx.glow, x - Math.cos(wa) * L * 0.55, y - Math.sin(wa) * L * 0.55, L, H * 0.32, wa, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * 0.35 * form, 1);
    b.draw(fx.glow, x - Math.cos(wa) * L * 0.5, y - Math.sin(wa) * L * 0.5, L * 0.8, H * 0.15, wa, SCARLET[0], SCARLET[1], SCARLET[2], 0.45 * form, 1);
    if (age < 4) b.draw(fx.glow, x, y, H * 1.2, H * 1.2, 0, PINK[0], PINK[1], PINK[2], 0.35 * (1 - form), 1); // peeling off the blade
    if (tag === 3) {
      // Glitch clone crescent: split copies jitter across the travel direction.
      const fl = hash(i * 3.1 + (p.t >> 1)), o = (1.5 + 2.5 * fl) * wm, nx = -dy * o, ny = dx * o;
      b.draw(CRESCENT, x + nx, y + ny, H * 0.55, H, ang, CYAN[0], CYAN[1], CYAN[2], 0.4, 1);
      b.draw(CRESCENT, x - nx, y - ny, H * 0.55, H, ang, MAGENTA[0], MAGENTA[1], MAGENTA[2], 0.4, 1);
      drawCrescent(b, x, y, H, ang, glowA, fl < 0.12 ? 0.35 : 0.8);
    } else drawCrescent(b, x, y, H, ang, glowA, 1);
  }
}

/** A crescent leaves the blade at (x, y): a pink flash on the blade and a few sparks along its launch. */
export function bladeRelease(p, w, x, y, a, sz, clone) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  let i = Hp.spawn(F.glow, x, y, 0, 0, 6);
  if (i >= 0) { Hp.size(i, 16 * sz, 6 * sz); Hp.color(i, PINK[0], PINK[1], PINK[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, clone ? 0.35 : 0.6, 1, FADE_OUT); }
  for (let k = 0; k < 2; k++) {
    const aa = a + R.range(-0.5, 0.5), s = R.range(2, 5);
    i = Hp.spawn(F.spark, x, y, Math.cos(aa) * s, Math.sin(aa) * s, R.range(6, 10));
    if (i < 0) break;
    Hp.size(i, 5); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], SCARLET[0], SCARLET[1], SCARLET[2]); Hp.phys(i, 0.86); Hp.look(i, 0.9, 1, FADE_OUT, 0.5);
  }
}

// ------------------------------------------------------------- rig FX

/** One blade's energy line from base to tip (world points), optionally turned about (ex, ey) by `turn`. */
function bladeLine(b, F, x0, y0, x1, y1, a, wd, turn = 0, ex = 0, ey = 0) {
  if (turn) {
    const c = Math.cos(turn), s = Math.sin(turn);
    const rt = (x, y) => [ex + (x - ex) * c - (y - ey) * s, ey + (x - ex) * s + (y - ey) * c];
    [x0, y0] = rt(x0, y0); [x1, y1] = rt(x1, y1);
  }
  const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, L, wd * 3.2, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.35 * a, 1);
  b.draw(F.laser, mx, my, L * 0.96, wd * 1.4, ang, PINK[0], PINK[1], PINK[2], 0.7 * a, 1);
  b.draw(F.laser, mx, my, L * 0.9, wd * 0.5, ang, WHITE[0], WHITE[1], WHITE[2], 0.8 * a, 1);
}

RIG_FX.overlay = (p, b, api) => {
  const F = p.F, tr = rigState(p), a = api.a;
  // Glitch clone / shadow: tinted passes over every layer (same texture: no batch flush).
  if (p.glitch) {
    const g = p.glitch, j = hash(g * 7.3 + (p.t >> 2)), o = (1.2 + 2.4 * j) / api.k; // world units → @2x px
    for (const name of ['armRootL', 'armRootR', 'body', 'armTipL', 'armTipR']) {
      api.drawLayer(name, { dx: -o, tint: CYAN, alpha: 0.28 * a, add: 1 });
      api.drawLayer(name, { dx: o, tint: MAGENTA, alpha: 0.28 * a, add: 1 });
    }
  }
  if (p.shade) {
    for (const name of ['armRootL', 'armRootR', 'body', 'armTipL', 'armTipR']) api.drawLayer(name, { tint: DARK, alpha: 0.82 * a, add: 0 });
    for (const name of ['armRootL', 'armRootR', 'body', 'armTipL', 'armTipR']) api.drawLayer(name, { grow: 1.05, tint: [0.5, 0.15, 1.0], alpha: (0.18 + 0.08 * Math.sin(p.t * 0.3)) * a, add: 1 });
  }
  // Blade energy lines; the swinging blade flares and smears back along its arc.
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const arm = tr[s], [x0, y0] = api.at('bladeBase' + s), [x1, y1] = api.at('bladeTip' + s);
    const pulse = 0.75 + 0.15 * Math.sin(p.t * 0.21 + sg), flare = arm.rel;
    const wd = (2.2 + 1.6 * flare) * (LOOK.size / 68);
    if (p.shade) { bladeLine(b, F, x0, y0, x1, y1, 0.5 * a, wd * 0.8); continue; }
    if (arm.r < 6) {
      const [ex, ey] = api.at('elbow' + s), f = 1 - arm.r / 6;
      for (let g = 1; g <= 3; g++) bladeLine(b, F, x0, y0, x1, y1, 0.2 * f * (1 - g / 4) * a, wd, -sg * g * 0.08, ex, ey);
    }
    bladeLine(b, F, x0, y0, x1, y1, (pulse + 0.6 * flare) * a, wd);
    b.draw(F.glow, x1, y1, 14 + 16 * flare, 14 + 16 * flare, 0, PINK[0], PINK[1], PINK[2], (0.35 + 0.5 * flare) * a, 1);
  }
  if (p.glitch) {
    // Scanlines sliding down the clone, and a torn slice now and then.
    const g = p.glitch, [cx, cy] = api.at('hitbox');
    for (let s = 0; s < 3; s++) {
      const yy = cy - 40 + ((p.t * 1.7 + s * 29 + g * 13) % 80);
      b.draw(F.white, cx, yy, 96, 0.8, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.18 * a, 1);
    }
    if (hash(g * 2.1 + (p.t >> 2)) < 0.3) {
      const yy = cy - 40 + 80 * hash(g + p.t * 0.37), o = (hash(p.t * 0.11 + g) - 0.5) * 16;
      b.draw(F.white, cx + o, yy, 70, 3 + 5 * hash(p.t + g), 0, CYAN[0], CYAN[1], CYAN[2], 0.22 * a, 1);
    }
  }
};

// ------------------------------------------------------------- clones

/**
 * The two glitch clones (focus and bomb): full copies of the mecha (same pose,
 * arm swings and thrusters) that glitch: RGB split, scanlines, torn slices,
 * flicker and a sideways jump now and then.
 */
export function renderClones(p, b, alpha) {
  const ps = p.ps, A = ps.cloneA;
  if (!(A > 0)) return;
  const F = p.F;
  ps.clones.forEach((c, k) => {
    const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
    const h = hash(k * 5.7 + (p.t >> 2)), jump = h < 0.12 ? (hash(p.t + k) - 0.5) * 10 : 0;
    const fl = h > 0.93 ? 0.35 : 1;
    b.draw(F.glow, x, y, 100, 100, 0, PAL.mid[0] * 0.4, PAL.mid[1] * 0.4, PAL.mid[2] * 0.4, 0.35 * A, 1);
    const copy = Object.create(p);
    copy.focus = false;
    copy.glitch = k + 1;
    if (tessArt.renderMecha(copy, b, x + jump, y, 0.78 * A * fl)) return;
    const f = p.frames[p.tier - 1];
    b.draw(f, x + jump, y, f.w, f.h, 0, 0.6, 0.5, 1.2, 0.6 * A * fl, 1);
  });
}

/** Clones spring out of her (in) or collapse (out): glitch shards and a flash. */
export function cloneBurst(p, w, x, y, into) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  let i = Hp.spawn(F.glow, x, y, 0, 0, 10);
  if (i >= 0) { Hp.size(i, 30, into ? 90 : 20); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  for (let k = 0; k < 14; k++) {
    const c = k % 2 ? CYAN : MAGENTA;
    i = Hp.spawn(F.white, x + R.range(-30, 30), y + R.range(-36, 36), R.range(-2.5, 2.5), R.range(-0.6, 0.6), R.range(8, 18));
    if (i < 0) break;
    Hp.size(i, R.range(6, 18), 1); Hp.color(i, c[0], c[1], c[2]); Hp.look(i, 0.5, 1, FADE_OUT);
    Hp.aspect[i] = R.range(0.08, 0.3);
  }
}

// ------------------------------------------------------------- Shadow Form

/**
 * Tess as a living shadow: the mecha drawn black with a flickering violet
 * edge, its blades dimmed. Returns false without the art.
 */
export function renderShadow(p, b, x, y, a) {
  const F = p.F, fl = (p.t >> 1) % 7 === 0 ? 0.7 : 1;
  b.draw(F.glow, x, y, 120, 120, 0, 0.35, 0.05, 0.7, 0.35 * a, 1);
  b.draw(F.glow, x, y + 4, 110, 110, 0, DARK[0], DARK[1], DARK[2], 0.55 * a, 0);
  const copy = Object.create(p);
  copy.shade = true;
  const ok = tessArt.renderMecha(copy, b, x + Math.sin(p.t * 0.9) * 0.8, y, a * fl);
  if (!ok) {
    const f = p.frames[p.tier - 1];
    b.draw(f, x, y, f.w, f.h, 0, 0.1, 0.05, 0.2, 0.85 * a, 0);
    b.draw(f, x, y, f.w, f.h, 0, 0.5, 0.2, 1.0, 0.35 * a, 1);
  }
  return true;
}

/** Smoke boiling off the shadow, violet embers and wisps trailing behind. */
export function shadowParticles(p, w) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < 2; k++) {
    const i = Hp.spawn(F.glow, p.x + R.range(-34, 34), p.y + R.range(-26, 30), R.range(-0.4, 0.4), R.range(0.6, 1.6), R.range(24, 40));
    if (i < 0) return;
    Hp.size(i, R.range(10, 18), R.range(30, 50)); Hp.color(i, 0.05, 0.0, 0.1, 0.12, 0.02, 0.2); Hp.phys(i, 0.97); Hp.look(i, 0.55, 0, FADE_INOUT);
  }
  if (R.next() < 0.5) {
    const i = Hp.spawn(F.core, p.x + R.range(-40, 40), p.y + R.range(-30, 30), R.range(-0.5, 0.5), R.range(0.5, 1.5), R.range(16, 28));
    if (i >= 0) { Hp.size(i, R.range(1.5, 3)); Hp.color(i, 1.4, 0.4, 2.0, 0.5, 0.1, 1.0); Hp.look(i, 0.9, 1, FADE_OUT); }
  }
}

/** Into the shadow (on) or out of it: a black-violet smoke burst, a ring and chromatic tear. */
export function shadowBurst(p, w, on) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < 18; k++) {
    const a = R.range(0, Math.PI * 2), s = R.range(0.8, 3);
    const i = Hp.spawn(F.glow, p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, R.range(26, 44));
    if (i < 0) break;
    Hp.size(i, 14, R.range(40, 70)); Hp.color(i, 0.04, 0, 0.08, 0.1, 0.02, 0.18); Hp.phys(i, 0.93); Hp.look(i, 0.7, 0, FADE_INOUT);
  }
  const i = Hp.spawn(F.ring, p.x, p.y, 0, 0, 22);
  if (i >= 0) { Hp.size(i, 20, on ? 160 : 110); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3, 0.05, 0.6); Hp.look(i, 0.7, 1, FADE_OUT); }
  w.r.post.aberrate(on ? 0.02 : 0.012);
  w.r.post.shockwave(p.x, p.y, 0.02, 0.02, 0.3);
}

// ------------------------------------------------------------- bomb

/** The bomb's wide crescents: the four-layer crescent at scale, with a smeared wake behind. */
export function renderWaves(p, b, waves, pts) {
  if (!waves.length) return;
  crescent(p.w.r);
  const glowA = 0.6 * LOOK.glowMul;
  for (const v of waves) {
    const a = Math.min(1, v.t / 5), dx = Math.cos(v.ang), dy = Math.sin(v.ang);
    for (const [o, al] of [[30, 0.18], [16, 0.32]]) drawCrescent(b, v.x - dx * o, v.y - dy * o, v.w * 0.95, v.ang, glowA * 0.6, al * a);
    drawCrescent(b, v.x, v.y, v.w, v.ang, glowA, a);
    const tips = pts(v, 2);
    for (const [x, y] of [tips[0], tips[2]]) b.draw(p.F.glow, x, y, 26, 26, 0, PINK[0], PINK[1], PINK[2], 0.5 * a, 1);
  }
}

/** Sparks and violet vapour shed off a wide crescent's edge. */
export function waveTrail(p, w, v, pts) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  if (R.next() > 0.7) return;
  const [x, y] = pts[R.int(0, pts.length - 1)];
  const i = Hp.spawn(F.glow, x, y, -Math.cos(v.ang) * 0.8, -Math.sin(v.ang) * 0.8, R.range(12, 20));
  if (i >= 0) { Hp.size(i, 8, 24); Hp.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3, 0.05, 0.6); Hp.phys(i, 0.94); Hp.look(i, 0.4, 1, FADE_INOUT); }
}

/** A crescent wave cuts an enemy. */
export function cutFx(p, w, x, y) {
  w.explosions.sparks(x, y, 6, [1.0, 0.45, 0.1], 5, 14, 4);
  w.explosions.sparks(x, y, 5, [0.75, 0.4, 1.0], 6, 12, 5);
}

/** Thousand Cuts line (c: {x0, y0, x1, y1, t}, 12 steps). */
export function renderCut(p, b, c) {
  const F = p.F, k = c.t / 12, a = 1 - k;
  const mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2;
  const len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0), ang = Math.atan2(c.y1 - c.y0, c.x1 - c.x0);
  b.draw(F.laser, mx, my, len, 30 * a, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.55 * a, 1);
  b.draw(F.laser, mx, my, len, 18 * a, ang, SCARLET[0], SCARLET[1], SCARLET[2], 0.8 * a, 1);
  b.draw(F.laser, mx, my, len, 9 * a, ang, ORANGE[0], ORANGE[1], ORANGE[2], 0.9 * a, 1);
  b.draw(F.laser, mx, my, len, 3.5 * a, ang, WHITE[0], WHITE[1], WHITE[2], a, 1);
}
