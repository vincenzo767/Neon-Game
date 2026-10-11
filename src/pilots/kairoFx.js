import { FADE_OUT } from '../fx/Particles.js';
import { LOOK, PAL, kairoFrames } from './kairoArt.js';

// Lance body colour: kept below the bloom's white clip so it stays cyan-blue.
const LANCE = [0.25, 0.85, 1.45];

// KAIRO ART TEST, Step 4: Kairo's weapon effects, rebuilt in code from the
// "Rifle shot effects" and "Burst / Charged shot" rows of FX Sprite Sheet.png.
// All additive (feeds the bloom). Purely visual: hit areas live in kairo.js,
// and the bright core of each shot is drawn exactly as wide as its hit area.

/** Hit radius of a main lance per power tier (the bright core is 2r wide). */
export const LANCE_R = [5, 5, 5.5, 6];
export const SHARD_TAG = 10; // shots.aux tag for option shards (lances store their tier)

/** Glow fades as the screen fills with enemy bullets (readability rule). */
export function crowdFactor(w) {
  const n = w.bullets.count;
  return 1 - Math.min(0.55, Math.max(0, (n - 250) / 1100));
}

/** Draw every player shot (replaces the generic shot renderer for Kairo). */
export function renderShots(p, b, alpha, S) {
  const fx = kairoFrames().fx, F = p.F, w = p.w;
  const glowA = 0.38 * LOOK.glowMul * crowdFactor(w), wm = LOOK.widthMul;
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), tag = S.aux[i];
    if (tag === SHARD_TAG) {
      // Spread shards: small diamonds with a soft glow.
      b.draw(fx.glow, x - dx * 4, y - dy * 4, 26 * wm, 12 * wm, ang, PAL.blue[0], PAL.blue[1], PAL.blue[2], glowA, 1);
      b.draw(fx.shard, x, y, 12 * wm, 6 * wm, ang, PAL.cyan[0] * 1.2, PAL.cyan[1] * 1.2, PAL.cyan[2] * 1.2, 0.95, 1);
      continue;
    }
    const t = tag >= 1 && tag <= 4 ? tag : 1;
    // Fade in over the first steps so a fresh lance's glow doesn't sit on the mecha.
    const fade = Math.min(1, (S.age[i] + alpha) / 2.5);
    const r = S.radius[i], bright = (1 + 0.12 * (t - 1)) * fade;
    const core = 2 * r * wm, Lc = 34 + 8 * t;
    // Outer glow (semi-transparent, blue → violet), long fading tail.
    const Lg = Lc * 1.6 + 12, gh = core * 2.3;
    b.draw(fx.glow, x - dx * (Lg * 0.22), y - dy * (Lg * 0.22), Lg, gh, ang, PAL.blue[0], PAL.blue[1], PAL.blue[2], glowA * fade * fade, 1);
    b.draw(fx.glow, x - dx * (Lg * 0.3), y - dy * (Lg * 0.3), Lg * 1.1, gh * 1.35, ang, PAL.violet[0], PAL.violet[1], PAL.violet[2], glowA * 0.35 * fade * fade, 1);
    // Bright core: diamond tip just ahead of the hit point, tail behind.
    // The texture's body spans 76 % of its height, so height = core / 0.76.
    const off = Lc / 2 - r;
    const cx = x - dx * off, cy = y - dy * off;
    b.draw(fx.lance, cx, cy, Lc, core / 0.76, ang, LANCE[0] * bright, LANCE[1] * bright, LANCE[2] * bright, 0.85, 1);
    b.draw(fx.lance, cx + dx * 3, cy + dy * 3, Lc * 0.8, core * 0.3 / 0.76, ang, 1.5 * bright, 1.6 * bright, 1.7 * bright, 0.9, 1);
    // Tier 4: ring pulses running back along the lance.
    if (t >= 4) {
      const age = S.age[i];
      for (let k = 0; k < 2; k++) {
        const o = (age * 9 + k * 22) % 44, f = 1 - o / 44;
        b.draw(F.ring, x - dx * o, y - dy * o, 5, core * 2.6, ang, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.6 * f, 1);
      }
    }
  }
}

/** Focused rail beam (drawn under the mecha) — `bm` is the World beam it fired. */
export function renderBeam(p, b, bm) {
  const fx = kairoFrames().fx, F = p.F, t = p.t;
  const x0 = bm.x0, y0 = bm.y0, len = Math.hypot(bm.x1 - x0, bm.y1 - y0), ang = Math.atan2(bm.y1 - y0, bm.x1 - x0);
  const mx = (x0 + bm.x1) / 2, my = (y0 + bm.y1) / 2, wv = bm.w, wm = LOOK.widthMul;
  const glowA = LOOK.glowMul * crowdFactor(p.w);
  const pulse = 0.92 + 0.08 * Math.sin(t * 0.9), hot = 0.8 + 0.2 * Math.sin(t * 0.55);
  // Glowing edges (semi-transparent), then the solid core (exactly the hit width), then the pulsing white centre.
  b.draw(F.laser, mx, my, len, wv * 3.6 * wm * pulse, ang, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.38 * glowA, 1);
  b.draw(F.laser, mx, my, len, wv * 2.2 * wm, ang, PAL.violet[0], PAL.violet[1], PAL.violet[2], 0.3 * glowA, 1);
  b.draw(fx.beam, mx, my, len, (wv / 0.62) * wm, ang, LANCE[0], LANCE[1], LANCE[2], 0.8, 1);
  b.draw(fx.beam, mx, my, len, wv * 0.36 * wm * hot, ang, 1.6, 1.7, 1.8, 0.95, 1);
  const nx = -Math.sin(ang), ny = Math.cos(ang), e = wv * 0.5 * wm;
  for (const s of [-1, 1]) b.draw(F.laser, mx + nx * e * s, my + ny * e * s, len, 2.4, ang, PAL.cyan[0] * 1.3, PAL.cyan[1] * 1.3, PAL.cyan[2] * 1.3, 0.55 * glowA, 1);
  // Rings travelling up the beam.
  const n = 6, step = len / n;
  for (let k = 0; k < n; k++) {
    const d = (t * 8 + k * step) % len, f = d / len;
    b.draw(F.ring, x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d, wv * 0.8, wv * 2.8 * wm, ang, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.65 * (1 - f * 0.75), 1);
  }
}

/** Charge orb with crosshair rings at the beam origin (the central spike; drawn over the mecha). */
export function renderChargeOrb(p, b, bm) {
  const fx = kairoFrames().fx, F = p.F, t = p.t, wv = bm.w, x = bm.x0, y = bm.y0;
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
  const o = 12 + wv * 0.8; // orb diameter: ~17 at tier 1, ~22 at tier 4
  b.draw(F.glow, x, y, o * 2.6 * pulse, o * 2.6 * pulse, 0, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.45 * LOOK.glowMul, 1);
  b.draw(F.core, x, y, o * 0.75 * pulse, o * 0.75 * pulse, 0, 1.6, 1.8, 2, 0.9, 1);
  const R1 = o * 1.3, R2 = o * 1.9 * (0.95 + 0.05 * Math.sin(t * 0.3));
  b.draw(F.ring, x, y, R1, R1, 0, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.8, 1);
  b.draw(F.ring, x, y, R2, R2, 0, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.5, 1);
  // Crosshair ticks, slowly turning.
  const rot = t * 0.03;
  for (let k = 0; k < 4; k++) {
    const a = rot + k * Math.PI / 2, d = R2 * 0.5;
    b.draw(F.laser, x + Math.cos(a) * d, y + Math.sin(a) * d, o * 0.7, 2, a, PAL.cyan[0] * 1.4, PAL.cyan[1] * 1.4, PAL.cyan[2] * 1.4, 0.8, 1);
  }
  b.draw(fx.flare, x, y, o * 1.6 * pulse, o * 1.6 * pulse, rot, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.45, 1);
}

/** Bright 2–3 frame blue flare at a muzzle. */
export function muzzleFlash(p, w, x, y, size = 26) {
  const H = w.fxHigh, fx = kairoFrames().fx, F = p.F;
  if (!fx) return; // headless (no atlas)
  let i = H.spawn(F.glow, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size, size * 0.6); H.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.cyan[0], PAL.cyan[1], PAL.cyan[2]); H.look(i, 0.6, 1, FADE_OUT); }
  i = H.spawn(fx.flare, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size * 1.15, size * 0.7); H.color(i, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], PAL.blue[0], PAL.blue[1], PAL.blue[2]); H.look(i, 0.7, 1, FADE_OUT); }
}

/** Blue-white impact burst where Kairo's shots and beams hit (World hitSpark hook). */
export function hitSpark(w, x, y, angle) {
  const H = w.fxHigh, R = w.fxRng, F = w.F;
  let i = H.spawn(F.glow, x, y, 0, 0, 4);
  if (i >= 0) { H.size(i, 34, 18); H.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.cyan[0], PAL.cyan[1], PAL.cyan[2]); H.look(i, 0.9, 1, FADE_OUT); }
  i = H.spawn(F.ring, x, y, 0, 0, 10);
  if (i >= 0) { H.size(i, 6, 30); H.color(i, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], PAL.blue[0], PAL.blue[1], PAL.blue[2]); H.look(i, 0.7, 1, FADE_OUT); }
  for (let k = 0; k < 5; k++) {
    const a = angle + R.range(-0.9, 0.9), sp = R.range(3, 7);
    i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 14));
    if (i < 0) return;
    H.size(i, 5);
    H.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.blue[0], PAL.blue[1], PAL.blue[2]);
    H.phys(i, 0.86);
    H.look(i, 1, 1, FADE_OUT, 0.5);
  }
}

