// Seamless (tileable) noise textures, generated once per thread and reused by
// every painter as Canvas2D patterns. Painting terrain by compositing these
// patterns with blend modes is fast (no per-pixel JS per chunk) and, because
// patterns are anchored to world coordinates, continuous across chunk seams.
//
// Works in a Worker (OffscreenCanvas) and on the main thread.

export function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Small integer hash → [0, 1). */
function h2(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Periodic value noise sampled on a size×size grid with `period` lattice cells. */
export function valueTile(size, period, seed) {
  const out = new Float32Array(size * size);
  const lat = new Float32Array(period * period);
  for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) lat[j * period + i] = h2(i, j, seed);
  const k = period / size;
  for (let y = 0; y < size; y++) {
    const gy = y * k, j0 = Math.floor(gy), fy = gy - j0, j1 = (j0 + 1) % period;
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = x * k, i0 = Math.floor(gx), fx = gx - i0, i1 = (i0 + 1) % period;
      const sx = fx * fx * (3 - 2 * fx);
      const a = lat[j0 * period + i0], b = lat[j0 * period + i1], c = lat[j1 * period + i0], d = lat[j1 * period + i1];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

export function fbmTile(size, base, octaves, seed, gain = 0.5, ridged = false) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, period = base;
  for (let o = 0; o < octaves && period <= size; o++) {
    const v = valueTile(size, period, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += (ridged ? 1 - Math.abs(v[i] * 2 - 1) : v[i]) * amp;
    total += amp; amp *= gain; period *= 2;
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < out.length; i++) { out[i] /= total; lo = Math.min(lo, out[i]); hi = Math.max(hi, out[i]); }
  const r = hi - lo || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / r; // normalise to 0..1
  return out;
}

/** Tileable cellular noise: returns {f1, edge} (edge = F2 - F1, small on cell borders). */
function cellTile(size, cells, seed) {
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + h2(i, j, seed)) / cells, (j + h2(i, j, seed + 7)) / cells]);
  const f1 = new Float32Array(size * size), edge = new Float32Array(size * size), id = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size, cj = Math.floor(v * cells);
    for (let x = 0; x < size; x++) {
      const u = x / size, ci = Math.floor(u * cells);
      let d1 = 9, d2 = 9, best = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ci + di, jj = cj + dj;
        const wi = (ii + cells) % cells, wj = (jj + cells) % cells;
        const p = pts[wj * cells + wi];
        const px = p[0] + (ii - wi) / cells, py = p[1] + (jj - wj) / cells;
        const d = Math.hypot(px - u, py - v) * cells;
        if (d < d1) { d2 = d1; d1 = d; best = h2(wi, wj, seed + 3); } else if (d < d2) d2 = d;
      }
      f1[y * size + x] = d1; edge[y * size + x] = d2 - d1; id[y * size + x] = best;
    }
  }
  return { f1, edge, id };
}

/** Gray canvas from a value field; alphaMode puts the value in alpha instead (white mask). */
function toCanvas(size, field, map = (v) => v, alphaMode = false) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(map(field[i], i) * 255)));
    const o = i * 4;
    if (alphaMode) { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = v; } else { d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

let SET = null;
let FIELDS = null;

/** The raw noise fields (pure arrays; no canvas — usable anywhere, e.g. layouts in Node). */
export function noiseFields() {
  if (FIELDS) return FIELDS;
  FIELDS = {
    fine: fbmTile(256, 16, 4, 11),
    fbm: fbmTile(512, 8, 6, 23),
    large: fbmTile(512, 4, 4, 37),
    ridged: fbmTile(512, 8, 5, 41, 0.55, true),
  };
  return FIELDS;
}

/**
 * The shared noise set (built on first use, ~100 ms):
 *   grain     per-pixel speckle (aggregate, sand grains, sparkle), 128²
 *   fine      high-frequency fbm (surface wear), 256²
 *   fbm       medium fbm (patches, stains, dune shading), 512²
 *   large     very low-frequency fbm (big tonal variation), 512²
 *   ridged    ridged fbm (rock veins, cracks in ice, lava crust), 512²
 *   cells     cellular borders (cobbles, crazing, plates), 256²
 *   streak    stretched noise (wind-swept snow/sand, brushed metal), 256×256
 *   masks     alpha masks of fbm/large at several thresholds: patchy layers
 */
export function noiseSet() {
  if (SET) return SET;
  const grainF = new Float32Array(128 * 128);
  for (let i = 0; i < grainF.length; i++) grainF[i] = h2(i % 128, (i / 128) | 0, 99);
  const { fine, fbm, large, ridged } = noiseFields();
  const cell = cellTile(256, 10, 53);
  // Streaks: noise stretched 16× along x (tileable because the period divides both axes).
  const st = valueTile(256, 32, 61), st2 = valueTile(256, 16, 67);
  const streakF = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const sx = (x >> 4) + ((y * 7) % 256);
    streakF[y * 256 + x] = st[y * 256 + (sx % 256)] * 0.6 + st2[y * 256 + ((x >> 3) % 256)] * 0.4;
  }
  SET = {
    grain: toCanvas(128, grainF),
    fine: toCanvas(256, fine),
    fbm: toCanvas(512, fbm),
    large: toCanvas(512, large),
    ridged: toCanvas(512, ridged),
    cells: toCanvas(256, cell.edge, (v) => smooth(0, 0.18, v)),
    cellId: toCanvas(256, cell.id),
    streak: toCanvas(256, streakF),
    masks: {},
    fields: { fbm, large, ridged, fine },
  };
  // Alpha masks: m(name, lo, hi) → white with alpha = smoothstep(lo, hi, field).
  for (const [name, f, size] of [['fbm', fbm, 512], ['large', large, 512], ['ridged', ridged, 512], ['fine', fine, 256]]) {
    for (const [lo, hi] of [[0.35, 0.55], [0.5, 0.65], [0.6, 0.72], [0.7, 0.8], [0.78, 0.88]]) {
      SET.masks[`${name}_${Math.round(lo * 100)}`] = toCanvas(size, f, (v) => smooth(lo, hi, v), true);
    }
  }
  SET.masks.cracks = toCanvas(256, cell.edge, (v) => 1 - smooth(0.0, 0.035, v), true);
  SET.masks.grain_90 = toCanvas(128, grainF, (v) => smooth(0.88, 0.95, v), true);
  SET.masks.grain_97 = toCanvas(128, grainF, (v) => smooth(0.96, 0.99, v), true);
  return SET;
}

/** Sample the shared fbm fields at world coords (period `scale` world units). */
export function sampleField(name, x, y, scale) {
  const f = noiseFields()[name], size = name === 'fine' ? 256 : 512;
  let u = (x / scale) % 1, v = (y / scale) % 1;
  if (u < 0) u += 1; if (v < 0) v += 1;
  const fx = u * size, fy = v * size, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
  const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
  const a = f[y0 * size + x0], b = f[y0 * size + x1], c = f[y1 * size + x0], d = f[y1 * size + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
