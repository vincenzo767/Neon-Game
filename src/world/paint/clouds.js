import { makeCanvas, noiseSet, sampleField } from './noise.js';
import { css } from './core.js';
import { RNG } from '../../core/RNG.js';

// Cloud painting for aerial / weather layers. Cumulus puffs are pre-rendered
// once per thread as white stamps with alpha (soft billows, eroded edges)
// plus a matching shade mask; a cloud layer chunk is painted by stamping
// them where a world-anchored coverage field says there is cloud, then
// tinting the lit side, the shaded side and the base.

const STAMPS = [];
const N_STAMPS = 6;

function puffStamp(seed) {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  const R = new RNG(`cloudstamp:${seed}`);
  const N = noiseSet();
  for (let k = 0; k < 26; k++) {
    const a = R.angle(), d = Math.sqrt(R.next()) * S * 0.28;
    const px = S / 2 + Math.cos(a) * d * 1.25, py = S / 2 + Math.sin(a) * d * 0.85;
    const r = S * R.range(0.1, 0.22) * (1 - d / (S * 0.45));
    const g = x.createRadialGradient(px, py, r * 0.2, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  // Erode the edge with noise for a cauliflower outline.
  x.globalCompositeOperation = 'destination-out';
  x.save(); x.translate(R.range(0, 100), R.range(0, 100)); x.scale(0.35, 0.35);
  x.globalAlpha = 0.55; x.fillStyle = x.createPattern(N.masks.fine_50, 'repeat'); x.fillRect(-1000, -1000, 4000, 4000);
  x.restore();
  x.globalCompositeOperation = 'source-over';
  return c;
}

export function cloudStamps() {
  if (!STAMPS.length) for (let i = 0; i < N_STAMPS; i++) STAMPS.push(puffStamp(i));
  return STAMPS;
}

/**
 * Paint a cloud layer chunk.
 *   cover(x, y) → 0..1 coverage at a world point (global, so chunks join)
 *   o: { scale (puff size), density, lit, shade, base, sun {dx, dy}, alpha, step }
 * Colours: lit = sunlit tops, shade = shaded flanks, base = darker undersides.
 */
export function paintClouds(p, cover, o = {}) {
  const st = cloudStamps();
  const { x0, x1, y0, y1 } = p.rect;
  const step = o.step || 46 * (o.scale || 1);
  const ctx = p.ctx;
  const sun = p.sun;
  // Three passes: shadowed underside (offset away from the sun), body, sunlit cap.
  const passes = [
    { col: o.base || [0.55, 0.58, 0.66], off: 0.28, k: 1.0, a: 0.9 },
    { col: o.shade || [0.78, 0.8, 0.86], off: 0.1, k: 0.92, a: 0.95 },
    { col: o.lit || [1, 1, 1], off: -0.12, k: 0.72, a: 0.9 },
  ];
  for (const pass of passes) {
    p.layer((pp) => {
      const R = new RNG(`clouds:${Math.round(y0)}:${o.seed || 0}`);
      for (let y = y0 - step * 2; y < y1 + step * 2; y += step * 0.7) {
        for (let x = x0 - step * 2; x < x1 + step * 2; x += step * 0.7) {
          const jx = x + (R.next() - 0.5) * step * 0.9, jy = y + (R.next() - 0.5) * step * 0.9;
          const cv = cover(jx, jy);
          const rnd = R.next(), rs = R.next(), rr = R.next();
          if (cv < 0.2 + rnd * 0.25) continue;
          const s = step * (0.9 + cv * 1.6) * (0.75 + rs * 0.5) * pass.k;
          const img = st[Math.floor(rr * st.length)];
          pp.ctx.save();
          pp.ctx.translate(jx + sun.dx * s * pass.off, jy + sun.dy * s * pass.off);
          pp.ctx.rotate(rr * 6.28);
          pp.ctx.globalAlpha = Math.min(1, cv * 1.2) * pass.a;
          pp.ctx.drawImage(img, -s, -s * 0.8, s * 2, s * 1.6);
          pp.ctx.restore();
        }
      }
      // Tint the stamped mask.
      pp.ctx.save();
      pp.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pp.ctx.globalCompositeOperation = 'source-in';
      pp.ctx.fillStyle = css(pass.col);
      pp.ctx.fillRect(0, 0, pp.canvas.width, pp.canvas.height);
      pp.ctx.restore();
      pp.noise('fbm', 220 * (o.scale || 1), 'soft-light', 0.35);
    }, { alpha: o.alpha ?? 1 });
  }
  void ctx;
}

/** Global cumulus coverage field (0..1) from the shared fbm. */
export function coverField(seedOffset = 0, scale = 1, bias = 0, contrast = 1.6) {
  return (x, y) => {
    const v = sampleField('large', x + seedOffset * 977, y + seedOffset * 613, 2600 * scale) * 0.6 + sampleField('fbm', x - seedOffset * 311, y + seedOffset * 157, 900 * scale) * 0.4;
    return Math.max(0, Math.min(1, (v - 0.5 + bias) * contrast + 0.5));
  };
}
