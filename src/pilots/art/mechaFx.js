import { FADE_OUT } from '../../fx/Particles.js';

// Weapon effects for a hand-made-art pilot (ART_PIPELINE.md §8), rebuilt in
// code from the pilot's FX sheet. All additive (feeds the bloom). Purely
// visual: hit areas live in the pilot file, and the bright core of each shot
// is drawn exactly as wide as its hit area.
//
//   const fx = createMechaFx(art, { body, lanceLen });
//
// art       the pilot's createMechaArt() instance (palette, LOOK, frames)
// body      lance body colour, kept below the bloom's white clip so the hue survives
// lanceLen  (tier) => bright-core length in world units
//
// Shots carry a visual tag in shots.aux: 1-4 = lance of that tier, SHARD_TAG = option shard,
// 0 = untagged (drawn with the generic shot look).

export const SHARD_TAG = 10;

/** Glow fades as the screen fills with enemy bullets (readability rule). */
export function crowdFactor(w) {
  const n = w.bullets.count;
  return 1 - Math.min(0.55, Math.max(0, (n - 250) / 1100));
}

export function createMechaFx(art, opts = {}) {
  const P = art.pal, LOOK = art.LOOK;
  const BODY = opts.body || P.hot;
  const lanceLen = opts.lanceLen || ((t) => 34 + 8 * t);
  const fxOf = () => art.frames().fx;

  /** Draw every player shot (replaces the generic shot renderer). */
  function renderShots(p, b, alpha, S) {
    const fx = fxOf(), F = p.F, w = p.w;
    const glowA = 0.38 * LOOK.glowMul * crowdFactor(w), wm = LOOK.widthMul;
    for (let i = 0; i < S.count; i++) {
      const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
      const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), tag = S.aux[i];
      if (tag === 0) {
        // Untagged shots (e.g. enemy bullets turned into player shots by an
        // ultimate) keep the generic look: their own frame, translucent, additive.
        const fr = p.w.r.frames[S.frame[i]], sc = S.scale[i];
        b.draw(fr, x, y, fr.w * sc, fr.h * sc, ang, 1, 1, 1, 0.5, 1);
        continue;
      }
      if (tag === SHARD_TAG) {
        // Spread shards: small diamonds with a soft glow.
        b.draw(fx.glow, x - dx * 4, y - dy * 4, 26 * wm, 12 * wm, ang, P.mid[0], P.mid[1], P.mid[2], glowA, 1);
        b.draw(fx.shard, x, y, 12 * wm, 6 * wm, ang, P.hot[0] * 1.2, P.hot[1] * 1.2, P.hot[2] * 1.2, 0.95, 1);
        continue;
      }
      const t = tag >= 1 && tag <= 4 ? tag : 1;
      // Fade in over the first steps so a fresh lance's glow doesn't sit on the mecha.
      const fade = Math.min(1, (S.age[i] + alpha) / 2.5);
      const r = S.radius[i], bright = (1 + 0.12 * (t - 1)) * fade;
      const core = 2 * r * wm, Lc = lanceLen(t);
      // Outer glow (semi-transparent, mid → edge colour), long fading tail.
      const Lg = Lc * 1.6 + 12, gh = core * 2.3;
      b.draw(fx.glow, x - dx * (Lg * 0.22), y - dy * (Lg * 0.22), Lg, gh, ang, P.mid[0], P.mid[1], P.mid[2], glowA * fade * fade, 1);
      b.draw(fx.glow, x - dx * (Lg * 0.3), y - dy * (Lg * 0.3), Lg * 1.1, gh * 1.35, ang, P.edge[0], P.edge[1], P.edge[2], glowA * 0.35 * fade * fade, 1);
      // Bright core: diamond tip just ahead of the hit point, tail behind.
      // The texture's body spans 76 % of its height, so height = core / 0.76.
      const off = Lc / 2 - r;
      const cx = x - dx * off, cy = y - dy * off;
      b.draw(fx.lance, cx, cy, Lc, core / 0.76, ang, BODY[0] * bright, BODY[1] * bright, BODY[2] * bright, 0.85, 1);
      b.draw(fx.lance, cx + dx * 3, cy + dy * 3, Lc * 0.8, core * 0.3 / 0.76, ang, 1.5 * bright, 1.6 * bright, 1.7 * bright, 0.9, 1);
      // Tier 4: ring pulses running back along the lance.
      if (t >= 4) {
        const age = S.age[i];
        for (let k = 0; k < 2; k++) {
          const o = (age * 9 + k * 22) % 44, f = 1 - o / 44;
          b.draw(F.ring, x - dx * o, y - dy * o, 5, core * 2.6, ang, P.hot[0], P.hot[1], P.hot[2], 0.6 * f, 1);
        }
      }
    }
  }

  /** Focused beam (drawn under the mecha) — `bm` is the World beam it fired. */
  function renderBeam(p, b, bm) {
    const fx = fxOf(), F = p.F, t = p.t;
    const x0 = bm.x0, y0 = bm.y0, len = Math.hypot(bm.x1 - x0, bm.y1 - y0), ang = Math.atan2(bm.y1 - y0, bm.x1 - x0);
    const mx = (x0 + bm.x1) / 2, my = (y0 + bm.y1) / 2, wv = bm.w, wm = LOOK.widthMul;
    const glowA = LOOK.glowMul * crowdFactor(p.w);
    const pulse = 0.92 + 0.08 * Math.sin(t * 0.9), hot = 0.8 + 0.2 * Math.sin(t * 0.55);
    // Glowing edges (semi-transparent), then the solid core (exactly the hit width), then the pulsing white centre.
    b.draw(F.laser, mx, my, len, wv * 3.6 * wm * pulse, ang, P.mid[0], P.mid[1], P.mid[2], 0.38 * glowA, 1);
    b.draw(F.laser, mx, my, len, wv * 2.2 * wm, ang, P.edge[0], P.edge[1], P.edge[2], 0.3 * glowA, 1);
    b.draw(fx.beam, mx, my, len, (wv / 0.62) * wm, ang, BODY[0], BODY[1], BODY[2], 0.8, 1);
    b.draw(fx.beam, mx, my, len, wv * 0.36 * wm * hot, ang, 1.6, 1.7, 1.8, 0.95, 1);
    const nx = -Math.sin(ang), ny = Math.cos(ang), e = wv * 0.5 * wm;
    for (const s of [-1, 1]) b.draw(F.laser, mx + nx * e * s, my + ny * e * s, len, 2.4, ang, P.hot[0] * 1.3, P.hot[1] * 1.3, P.hot[2] * 1.3, 0.55 * glowA, 1);
    // Rings travelling up the beam.
    const n = 6, step = len / n;
    for (let k = 0; k < n; k++) {
      const d = (t * 8 + k * step) % len, f = d / len;
      b.draw(F.ring, x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d, wv * 0.8, wv * 2.8 * wm, ang, P.hot[0], P.hot[1], P.hot[2], 0.65 * (1 - f * 0.75), 1);
    }
  }

  /** Charge orb with crosshair rings at the beam origin (drawn over the mecha). */
  function renderChargeOrb(p, b, bm) {
    const fx = fxOf(), F = p.F, t = p.t, wv = bm.w, x = bm.x0, y = bm.y0;
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
    const o = 12 + wv * 0.8; // orb diameter: ~17 at tier 1, ~22 at tier 4
    b.draw(F.glow, x, y, o * 2.6 * pulse, o * 2.6 * pulse, 0, P.mid[0], P.mid[1], P.mid[2], 0.45 * LOOK.glowMul, 1);
    b.draw(F.core, x, y, o * 0.75 * pulse, o * 0.75 * pulse, 0, 1.6, 1.8, 2, 0.9, 1);
    const R1 = o * 1.3, R2 = o * 1.9 * (0.95 + 0.05 * Math.sin(t * 0.3));
    b.draw(F.ring, x, y, R1, R1, 0, P.hot[0], P.hot[1], P.hot[2], 0.8, 1);
    b.draw(F.ring, x, y, R2, R2, 0, P.mid[0], P.mid[1], P.mid[2], 0.5, 1);
    // Crosshair ticks, slowly turning.
    const rot = t * 0.03;
    for (let k = 0; k < 4; k++) {
      const a = rot + k * Math.PI / 2, d = R2 * 0.5;
      b.draw(F.laser, x + Math.cos(a) * d, y + Math.sin(a) * d, o * 0.7, 2, a, P.hot[0] * 1.4, P.hot[1] * 1.4, P.hot[2] * 1.4, 0.8, 1);
    }
    b.draw(fx.flare, x, y, o * 1.6 * pulse, o * 1.6 * pulse, rot, P.hot[0], P.hot[1], P.hot[2], 0.45, 1);
  }

  /** Bright 2–3 frame flare at a muzzle. */
  function muzzleFlash(p, w, x, y, size = 26) {
    const H = w.fxHigh, fx = fxOf(), F = p.F;
    if (!fx) return; // headless (no atlas)
    let i = H.spawn(F.glow, x, y - 2, 0, -0.6, 3);
    if (i >= 0) { H.size(i, size, size * 0.6); H.color(i, P.core[0], P.core[1], P.core[2], P.hot[0], P.hot[1], P.hot[2]); H.look(i, 0.6, 1, FADE_OUT); }
    i = H.spawn(fx.flare, x, y - 2, 0, -0.6, 3);
    if (i >= 0) { H.size(i, size * 1.15, size * 0.7); H.color(i, P.hot[0], P.hot[1], P.hot[2], P.mid[0], P.mid[1], P.mid[2]); H.look(i, 0.7, 1, FADE_OUT); }
  }

  /** Impact burst where the pilot's shots and beams hit (World hitSpark hook). */
  function hitSpark(w, x, y, angle) {
    const H = w.fxHigh, R = w.fxRng, F = w.F;
    let i = H.spawn(F.glow, x, y, 0, 0, 4);
    if (i >= 0) { H.size(i, 34, 18); H.color(i, P.core[0], P.core[1], P.core[2], P.hot[0], P.hot[1], P.hot[2]); H.look(i, 0.9, 1, FADE_OUT); }
    i = H.spawn(F.ring, x, y, 0, 0, 10);
    if (i >= 0) { H.size(i, 6, 30); H.color(i, P.hot[0], P.hot[1], P.hot[2], P.mid[0], P.mid[1], P.mid[2]); H.look(i, 0.7, 1, FADE_OUT); }
    for (let k = 0; k < 5; k++) {
      const a = angle + R.range(-0.9, 0.9), sp = R.range(3, 7);
      i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 14));
      if (i < 0) return;
      H.size(i, 5);
      H.color(i, P.core[0], P.core[1], P.core[2], P.mid[0], P.mid[1], P.mid[2]);
      H.phys(i, 0.86);
      H.look(i, 1, 1, FADE_OUT, 0.5);
    }
  }

  return { renderShots, renderBeam, renderChargeOrb, muzzleFlash, hitSpark, crowdFactor, SHARD_TAG };
}
