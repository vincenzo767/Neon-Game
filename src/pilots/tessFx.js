import { crowdFactor } from './art/mechaFx.js';
import { tessArt, PAL } from './tessArt.js';

// Tess's weapon effects, after the crescent-slash rows of fx_reference.png,
// in the owner's colours: violet outside, a scarlet band, orange inside,
// white-hot edge.
// All cosmetic: hit areas live in tess.js. The orange crescent spans the
// shot's hit area.
//
// Shots carry a visual tag in shots.aux: 1 = wire-blade crescent,
// 2 = ghost-slash crescent, anything else = generic look.

const LOOK = tessArt.LOOK;
const fxOf = () => tessArt.frames().fx;
const ORANGE = [1.8, 0.65, 0.04];   // below the bloom's white clip
const WHITE = [2.0, 1.7, 1.3];
const SCARLET = [1.9, 0.03, 0.05];
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

/** Draw every player shot (replaces the generic shot renderer). */
export function renderShots(p, b, alpha, S) {
  const fx = fxOf(), w = p.w;
  crescent(w.r);
  const glowA = 0.55 * LOOK.glowMul * crowdFactor(w), wm = LOOK.widthMul;
  const grow = 1 + 0.06 * (p.tier - 1);
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), tag = S.aux[i];
    if (tag !== 1 && tag !== 2) {
      const f = w.r.frames[S.frame[i]], sc = S.scale[i];
      b.draw(f, x, y, f.w * sc, f.h * sc, ang, 1, 1, 1, 0.5, 1);
      continue;
    }
    // Fade in over the first steps, out over the last ones (the crescents dissolve at short range).
    const age = S.age[i] + alpha, left = S.maxAge[i] - age;
    const fade = Math.min(1, age / 2, Math.max(0, left) / 5);
    const H = 2 * S.radius[i] * 2.3 * wm * grow * (tag === 2 ? 1.2 : 1);
    // Thin scarlet-violet wake trailing from the crescent's centre.
    const L = 22 * wm;
    b.draw(fx.glow, x - dx * L * 0.55, y - dy * L * 0.55, L, H * 0.3, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * 0.4 * fade, 1);
    b.draw(fx.glow, x - dx * L * 0.5, y - dy * L * 0.5, L * 0.8, H * 0.16, ang, SCARLET[0], SCARLET[1], SCARLET[2], 0.6 * fade, 1);
    drawCrescent(b, x, y, H, ang, glowA, fade);
  }
}

/** Ghost Slash: a big crescent swept by one arm blade (s: {x, y, r, t, flip}, 10 steps). */
export function renderSlash(p, b, s) {
  crescent(p.w.r);
  const k = s.t / 10, a = 1 - k * k, glowA = 0.6 * LOOK.glowMul * crowdFactor(p.w);
  const UP = -Math.PI / 2;
  // Sweep from the swinging arm's side across the front.
  const sweep = (step) => UP - s.flip * (0.9 - step * 1.5);
  const H = s.r * 2.2;
  for (let g = 2; g >= 1; g--) {
    const kk = Math.max(0, k - g * 0.12);
    drawCrescent(b, s.x, s.y, H * 0.95, sweep(kk), glowA * 0.5, a * (0.35 - g * 0.1));
  }
  drawCrescent(b, s.x, s.y, H, sweep(k), glowA, a * 0.8);
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

/**
 * The whole mecha at (x, y): a Shadow Clone or the Cloak decoy. Same art,
 * pose, wing animation and thrusters as Tess, plus a violet sheen. Returns
 * false without the art (the caller draws the procedural copy).
 */
export function renderCopy(p, b, x, y, alpha, sheen = 0.45) {
  const copy = Object.create(p);
  copy.focus = false; // no hitbox dot on a copy
  if (!tessArt.renderMecha(copy, b, x, y, alpha)) return false;
  const K = tessArt.frames(), set = K.art[LOOK.outline ? 'outline' : 'plain'] || K.art.outline;
  const A = tessArt.anchorData(), hb = A.anchors.hitbox, k = tessArt.unitsPerPx();
  const rot = p.bank * 0.14, sq = 1 - Math.abs(p.bank) * 0.08, bob = Math.sin(p.t * 0.07) * 0.8;
  const lx = (A.image.w / 2 - hb[0]) * k * sq, ly = (A.image.h / 2 - hb[1]) * k;
  const cx = x + lx * Math.cos(rot) - ly * Math.sin(rot), cy = y + bob + lx * Math.sin(rot) + ly * Math.cos(rot);
  b.draw(set.full.frame, cx, cy, A.image.w * k * sq, A.image.h * k, rot, PAL.mid[0] * 0.6, PAL.mid[1] * 0.6, PAL.mid[2] * 0.6, sheen * alpha, 1);
  return true;
}
