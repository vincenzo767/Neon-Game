import { sampleField } from './noise.js';

// Heightfield terrain: a global height function (so chunks join) and a
// per-pixel painter that bakes hillshade, slope and altitude colouring into
// the chunk texture. The same function displaces the plane mesh, so relief is
// real geometry (perspective parallax) and lit consistently with the arena sun.

/**
 * Ridged mountain range. o: { amp, scale, base, ridge (0..1), valley (x of a valley), valleyW }
 */
export function mountainHeight(o = {}) {
  const amp = o.amp ?? 900, sc = o.scale ?? 1;
  return (x, y) => {
    let h = sampleField('ridged', x, y, 5200 * sc) * 0.62 + sampleField('ridged', x * 1.7 + 300, y * 1.7, 3100 * sc) * 0.26 + sampleField('fbm', x, y, 1500 * sc) * 0.12;
    h = Math.pow(Math.max(0, h - (o.floor ?? 0.32)) / (1 - (o.floor ?? 0.32)), o.sharp ?? 1.6);
    if (o.valley != null) { const d = Math.abs(x - o.valley(y)) / (o.valleyW || 400); h *= Math.min(1, d * d); }
    return h * amp + (o.base ?? 0);
  };
}

/** Rolling dunes / hills. */
export function hillHeight(o = {}) {
  const amp = o.amp ?? 120, sc = o.scale ?? 1;
  return (x, y) => (sampleField('fbm', x, y, 2200 * sc) * 0.7 + sampleField('large', x, y, 5000 * sc) * 0.3 - 0.5) * 2 * amp + (o.base ?? 0);
}

/**
 * Paint a heightfield chunk pixel by pixel.
 *   colour(h, slope, x, y) → [r, g, b] albedo (0..1)
 *   sun: arena paint sun {dx, dy, elev}; light → shading curve
 */
export function paintHeightfield(p, height, colour, o = {}) {
  const { x0, x1, y0, y1 } = p.rect;
  const W = p.canvas.width, H = p.canvas.height;
  const img = p.ctx.createImageData(W, H), d = img.data;
  const sun = p.sun;
  // Light direction (toward the sun) in world space.
  const ce = Math.cos(sun.elev), lx = -sun.dx * ce, ly = -sun.dy * ce, lz = Math.sin(sun.elev);
  const e = o.eps ?? 6;
  // Arena light colours (ambient sky + sun), so relief matches lit geometry.
  const L = p.env.light;
  // o.shading [ambient, sun] overrides the arena light with neutral relief shading
  // (deep water: keep terrain legible; the scene's darkness comes from fog).
  const amb = o.shading ? [o.shading[0], o.shading[0], o.shading[0]] : L ? L.ambient.map((v) => v * 1.05) : [0.42, 0.42, 0.42];
  const sc = o.shading ? [o.shading[1], o.shading[1], o.shading[1]] : L ? L.sunCol : [0.9, 0.9, 0.9];
  const step = o.step || 1; // compute every `step` pixels, replicate (fast low-res relief)
  // o.shadows { range, steps }: ray-march toward the sun so ridges and canyon
  // walls cast soft shadows across the terrain below them.
  const sh = o.shadows, hl = Math.hypot(lx, ly) || 1, sdx = lx / hl, sdy = ly / hl, rise = Math.tan(Math.max(0.05, sun.elev));
  const shadowAt = (x, y, h) => {
    if (!sh) return 0;
    const n = sh.steps || 12, range = sh.range || 360;
    let occ = 0;
    for (let k = 1; k <= n; k++) {
      const t = (k / n) ** 1.6 * range;
      const d = height(x + sdx * t, y + sdy * t) - (h + t * rise);
      if (d > 0) { occ = Math.max(occ, Math.min(1, d / (3 + t * 0.08))); if (occ >= 1) break; }
    }
    return occ;
  };
  // Shadows vary slowly: march on a coarse grid (every 4th sample) and
  // interpolate bilinearly, ~16x cheaper than per-sample marching.
  let shadow = () => 0;
  if (sh) {
    const G = step * 4, gw = Math.ceil(W / G) + 1, gh = Math.ceil(H / G) + 1, grid = new Float32Array(gw * gh);
    for (let gj = 0; gj < gh; gj++) for (let gi = 0; gi < gw; gi++) {
      const x = x0 + ((gi * G + 0.5) / W) * (x1 - x0), y = y1 - ((gj * G + 0.5) / H) * (y1 - y0);
      grid[gj * gw + gi] = shadowAt(x, y, height(x, y));
    }
    shadow = (i, j) => {
      const fi = i / G, fj = j / G, i0 = Math.min(gw - 2, fi | 0), j0 = Math.min(gh - 2, fj | 0), u = fi - i0, v = fj - j0;
      const a = grid[j0 * gw + i0], b = grid[j0 * gw + i0 + 1], c = grid[(j0 + 1) * gw + i0], d = grid[(j0 + 1) * gw + i0 + 1];
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };
  }
  // Heights are evaluated once per sample on a padded grid; normals come from
  // central differences k samples apart (k·spacing ≈ eps), so the height
  // function runs ~once per sample instead of five times.
  const sx = step * (x1 - x0) / W, sy = step * (y1 - y0) / H;
  const kx = Math.max(1, Math.round(e / sx)), ky = Math.max(1, Math.round(e / sy)), pad = Math.max(kx, ky);
  const nx0 = Math.ceil(W / step), ny0 = Math.ceil(H / step), gw = nx0 + pad * 2, gh = ny0 + pad * 2;
  const hg = new Float32Array(gw * gh);
  for (let gj = 0; gj < gh; gj++) {
    const y = y1 - (((gj - pad) * step + 0.5) / H) * (y1 - y0);
    for (let gi = 0; gi < gw; gi++) hg[gj * gw + gi] = height(x0 + (((gi - pad) * step + 0.5) / W) * (x1 - x0), y);
  }
  for (let j = 0; j < H; j += step) {
    const y = y1 - ((j + 0.5) / H) * (y1 - y0), gj = j / step + pad;
    for (let i = 0; i < W; i += step) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0), gi = i / step + pad, gk = gj * gw + gi;
      const h = hg[gk];
      const hx = (hg[gk + kx] - hg[gk - kx]) / (2 * kx * sx), hy = (hg[gk - ky * gw] - hg[gk + ky * gw]) / (2 * ky * sy);
      const nl = Math.hypot(hx, hy, 1);
      const nx = -hx / nl, ny = -hy / nl, nz = 1 / nl;
      const dot = Math.max(0, nx * lx + ny * ly + nz * lz) * (1 - 0.85 * shadow(i, j));
      const c = colour(h, 1 - nz, x, y);
      const r = c[0] * (amb[0] + sc[0] * dot), g = c[1] * (amb[1] + sc[1] * dot), b = c[2] * (amb[2] + sc[2] * dot);
      for (let jj = 0; jj < step && j + jj < H; jj++) for (let ii = 0; ii < step && i + ii < W; ii++) {
        const o4 = ((j + jj) * W + i + ii) * 4;
        d[o4] = Math.min(255, r * 255); d[o4 + 1] = Math.min(255, g * 255); d[o4 + 2] = Math.min(255, b * 255); d[o4 + 3] = 255;
      }
    }
  }
  p.ctx.putImageData(img, 0, 0);
}
