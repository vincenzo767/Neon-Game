import { RNG } from '../../core/RNG.js';
import { shade, css } from '../paint/core.js';

// Terrain & clutter kit shared by many environments: boulders, scrap piles,
// crushed-car stacks, tank traps, trenches, barbed wire, pipe runs. Mesh
// helpers add geometry; paint helpers draw flat detail with shadows.

const TAU = Math.PI * 2;

/** Irregular boulder: a faceted prism with a lower, offset top. */
export function meshBoulder(mb, x, y, r, h, seed, mat = 'rock', z0 = 0) {
  const R = new RNG(`boulder:${seed}`);
  const n = R.int(6, 9), pts = [], top = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R.range(-0.2, 0.2), d = r * R.range(0.7, 1.1);
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
    top.push(x + Math.cos(a) * d * 0.62 + r * 0.08, y + Math.sin(a) * d * 0.62 + r * 0.06);
  }
  // Sides: quads from the footprint to the shrunken top.
  const m = mb.mat(mat);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const cx = top[j * 2], cy = top[j * 2 + 1], dx = top[i * 2], dy = top[i * 2 + 1];
    const ex = by - ay, ey = -(bx - ax), el = Math.hypot(ex, ey) || 1;
    const len = Math.hypot(bx - ax, by - ay) / m.size[0];
    mb.quad([[ax, ay, z0], [bx, by, z0], [cx, cy, z0 + h], [dx, dy, z0 + h]], [[0, 0], [len, 0], [len, -h / m.size[1]], [0, -h / m.size[1]]], m.layer, [ex / el * 0.8, ey / el * 0.8, 0.6], { occ: [0.6, 0.6, 1, 1] });
  }
  mb.cap(top, z0 + h, mat);
}

export function shadowBoulder(p, x, y, r, h) { p.shadowCircle(x, y, r * 0.85, h, 0, 8); }

/** Scrap heap: jumbled slabs and beams of rusted metal. */
export function meshScrapPile(mb, x, y, r, h, seed) {
  const R = new RNG(`scrap:${seed}`);
  const mats = ['rust', 'rust', 'metal_dark', 'steel_painted', 'container_red', 'container_blue', 'container_grey'];
  const n = Math.round(6 + r / 6);
  for (let i = 0; i < n; i++) {
    const a = R.angle(), d = Math.sqrt(R.next()) * r * 0.75;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const hh = h * (1 - d / r) * R.range(0.4, 1) + 2;
    const w = R.range(8, 22), l = R.range(10, 34);
    const mat = R.pick(mats);
    mb.box(px, py, 0, w, l, Math.max(3, hh * R.range(0.4, 0.8)), R.angle(), { top: mat, side: mat });
  }
  for (let i = 0; i < n / 2; i++) {
    const a = R.angle(), d = R.next() * r * 0.6, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const b = R.angle(), L = R.range(20, 46), z = R.range(4, h * 0.8);
    mb.beam([px - Math.cos(b) * L / 2, py - Math.sin(b) * L / 2, z * R.range(0.3, 1)], [px + Math.cos(b) * L / 2, py + Math.sin(b) * L / 2, z], R.range(2, 4), R.range(2, 4), R.pick(['rust', 'steel_painted', 'metal_dark']));
  }
}

export function shadowScrapPile(p, x, y, r, h) { p.shadowCircle(x, y, r * 0.8, h * 0.8, 0, 10); }

/** Stack of crushed car bales (scrapyards). */
export function meshCarBales(mb, x, y, rot, cols, rows, layers, seed) {
  const R = new RNG(`bales:${seed}`);
  const bw = 11, bl = 16, bh = 6.5;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let k = 0; k < layers; k++) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (k > 0 && R.chance(0.25)) continue;
    const u = (i - (cols - 1) / 2) * (bw + 0.6) + R.range(-1, 1), v = (j - (rows - 1) / 2) * (bl + 0.6) + R.range(-1, 1);
    mb.box(x + u * c - v * s, y + u * s + v * c, k * bh, bw, bl, bh, rot + R.range(-0.08, 0.08), { top: `bale_${R.int(0, 3)}`, side: `bale_${R.int(0, 3)}` });
  }
}

/** Czech hedgehog anti-tank obstacle (three crossed beams). */
export function meshHedgehog(mb, x, y, s, rot = 0) {
  const c = Math.cos(rot), q = Math.sin(rot), h = 7 * s;
  const P = (u, v, z) => [x + u * c - v * q, y + u * q + v * c, z];
  mb.beam(P(-5 * s, -5 * s, 0), P(5 * s, 5 * s, h), 1.4, 1.4, 'rust');
  mb.beam(P(5 * s, -5 * s, 0), P(-5 * s, 5 * s, h), 1.4, 1.4, 'rust');
  mb.beam(P(0, -6 * s, h), P(0, 6 * s, 0.5), 1.4, 1.4, 'rust');
}

/** Concrete bunker / pillbox. */
export function meshBunker(mb, x, y, w, d, h, rot = 0) {
  mb.box(x, y, 0, w, d, h, rot, { top: 'concrete_dark', side: 'concrete_dark' });
  mb.box(x, y, h, w * 0.8, d * 0.8, 2.5, rot, { top: 'concrete_scorched', side: 'concrete_dark' });
}

/** Straight pipe run between two points (round section via lathe segments laid flat is costly; use a beam). */
export function meshPipe(mb, a, b, r, mat = 'steel_painted') { mb.beam(a, b, r * 2, r * 2, mat); }

// ---------------------------------------------------------------- paint

/** Zig-zag trench with sandbag lips (painted, with shadow). */
export function trench(p, pts, w = 12, o = {}) {
  p.line(pts, w + 6, [0.24, 0.22, 0.2], 0.8, { join: 'miter' });            // spoil
  p.line(pts, w, [0.05, 0.045, 0.04], 1, { join: 'miter' });                 // trench floor in shadow
  p.line(pts, w * 0.35, [0.18, 0.15, 0.12], 0.8, { join: 'miter' });         // duckboards
  if (o.bags !== false) for (const side of [-1, 1]) {
    const q = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l * (w / 2 + 2) * side, ny = dx / l * (w / 2 + 2) * side;
      q.push(pts[i] + nx, pts[i + 1] + ny, pts[i + 2] + nx, pts[i + 3] + ny);
    }
    p.line(q, 3, o.bag || [0.5, 0.44, 0.32], 0.85, { dash: [3, 0.8] });
  }
}

/** Coiled barbed wire along a polyline. */
export function barbedWire(p, pts, alpha = 0.7) {
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const l = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(l / 3));
    const q = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, a = t * n * 1.9;
      q.push(x0 + (x1 - x0) * t + Math.cos(a) * 1.6, y0 + (y1 - y0) * t + Math.sin(a) * 1.6);
    }
    p.line(q, 0.35, [0.12, 0.11, 0.1], alpha);
    p.shadow([x0, y0 - 1, x1, y1 - 1, x1, y1 + 1, x0, y0 + 1], 3);
  }
}

/** Burnt tree stump / snapped trunk. */
export function stump(p, R, x, y, r) {
  p.shadowCircle(x, y, r, r * 3, 0, 7);
  p.circlePath(x, y, r).fill([0.08, 0.07, 0.06]);
  const a = R.angle(), l = r * R.range(4, 8);
  p.line([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l], r * 0.9, [0.1, 0.08, 0.07], 0.95, { cap: 'round' });
}

/** Pile of tyres. */
export function tyres(p, R, x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const px = x + R.range(-8, 8), py = y + R.range(-8, 8), r = R.range(3.5, 4.5);
    p.shadowCircle(px, py, r, 4, 0, 8);
    p.circlePath(px, py, r).fill([0.06, 0.06, 0.06]);
    p.circlePath(px, py, r * 0.45).fill([0.16, 0.15, 0.14]);
    p.circlePath(px - 0.6, py + 0.6, r).stroke([0.3, 0.3, 0.3], 0.4, 0.4);
  }
}

/** Railway track (painted): ballast, sleepers, two rails. dir 'y' straight along y between y0..y1 at x. */
export function railway(p, x, y0, y1, o = {}) {
  const g = o.gauge || 9;
  p.rectPath(x - g, y0 - 2, g * 2, y1 - y0 + 4).fill(o.ballast || [0.32, 0.3, 0.28]);
  p.noise('grain', 128 / p.ppu, 'overlay', 0.7, { path: () => p.rectPath(x - g, y0 - 2, g * 2, y1 - y0 + 4) });
  for (let y = Math.ceil(y0 / 3.5) * 3.5; y < y1; y += 3.5) p.rectPath(x - g * 0.75, y - 0.6, g * 1.5, 1.2).fill(o.sleeper || [0.22, 0.17, 0.12], 0.95);
  for (const s of [-1, 1]) p.line([x + s * g * 0.42, y0 - 2, x + s * g * 0.42, y1 + 2], 0.7, o.rust ? [0.4, 0.24, 0.14] : [0.62, 0.62, 0.64], 1);
}

export { shade, css };
