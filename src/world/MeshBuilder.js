import { MATERIAL_INDEX, MATERIALS } from './materials.js';

// CPU geometry builder for arena solids. Pure JS (runs in the build Worker):
// produces interleaved vertex data + indices with lighting baked per vertex.
//
// Vertex layout (11 floats): x y z | u v layer | r g b a | em
//   layer >= 0  material array layer (tiled uv in material repeats)
//   layer = -1  the plane texture bound with the draw (chunk terrain)
//
// Lighting: light(N) = ambient + sun · max(0, N·L), with a cheap ambient
// occlusion that darkens wall bases. Painted terrain is lit with the same
// light for an up-facing normal, so roofs and ground agree.

export const FLOATS = 11;
const TAU = Math.PI * 2;

export class MeshBuilder {
  /** @param light { sunDir: [x,y,z] (toward the sun), sun: [r,g,b], ambient: [r,g,b], ao } */
  constructor(light) {
    this.L = light;
    const d = light.sunDir, n = Math.hypot(d[0], d[1], d[2]) || 1;
    this.sd = [d[0] / n, d[1] / n, d[2] / n];
    this.v = new Float32Array(4096 * FLOATS);
    this.i = new Uint32Array(8192);
    this.nv = 0;
    this.ni = 0;
  }

  _growV(n) {
    if ((this.nv + n) * FLOATS <= this.v.length) return;
    const nv = new Float32Array(Math.max(this.v.length * 2, (this.nv + n) * FLOATS * 1.5));
    nv.set(this.v.subarray(0, this.nv * FLOATS));
    this.v = nv;
  }

  _growI(n) {
    if (this.ni + n <= this.i.length) return;
    const ni = new Uint32Array(Math.max(this.i.length * 2, (this.ni + n) * 1.5));
    ni.set(this.i.subarray(0, this.ni));
    this.i = ni;
  }

  /** Light colour for a normal (+ optional occlusion factor and tint). */
  light(nx, ny, nz, occ = 1, tint = null) {
    const L = this.L, s = this.sd;
    const k = Math.max(0, nx * s[0] + ny * s[1] + nz * s[2]);
    // Sky light: up-facing surfaces see more of the sky than walls.
    const sky = 0.55 + 0.45 * Math.max(0, nz);
    const r = (L.ambient[0] * sky + L.sun[0] * k) * occ, g = (L.ambient[1] * sky + L.sun[1] * k) * occ, b = (L.ambient[2] * sky + L.sun[2] * k) * occ;
    return tint ? [r * tint[0], g * tint[1], b * tint[2]] : [r, g, b];
  }

  vert(x, y, z, u, v, layer, c, a = 1, em = 0) {
    this._growV(1);
    const o = this.nv * FLOATS, V = this.v;
    V[o] = x; V[o + 1] = y; V[o + 2] = z; V[o + 3] = u; V[o + 4] = v; V[o + 5] = layer;
    V[o + 6] = c[0]; V[o + 7] = c[1]; V[o + 8] = c[2]; V[o + 9] = a; V[o + 10] = em;
    return this.nv++;
  }

  tri(a, b, c) { this._growI(3); this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c; }

  /** Material lookup: name → { layer, size: [u, v], em }. */
  mat(name) {
    const layer = MATERIAL_INDEX[name];
    if (layer === undefined) throw new Error(`unknown material "${name}"`);
    const m = MATERIALS[name];
    return { layer, size: m.size, em: m.em || 0 };
  }

  /**
   * Quad from 4 corners (counter-clockwise seen from outside), with per-corner
   * uv and a flat normal. o: { tint, alpha, em, occ: [o0..o3] }
   */
  quad(p, uv, layer, n, o = {}) {
    const occ = o.occ || [1, 1, 1, 1];
    const base = [];
    for (let k = 0; k < 4; k++) {
      const c = this.light(n[0], n[1], n[2], occ[k], o.tint);
      base.push(this.vert(p[k][0], p[k][1], p[k][2], uv[k][0], uv[k][1], layer, c, o.alpha ?? 1, o.em ?? 0));
    }
    this.tri(base[0], base[1], base[2]);
    this.tri(base[0], base[2], base[3]);
  }

  /**
   * Vertical wall from (x0,y0) to (x1,y1) between z0 and z1, outward normal
   * to the right of the edge direction. uv: s along the wall, z up.
   */
  wall(x0, y0, x1, y1, z0, z1, matName, o = {}) {
    const m = this.mat(matName), len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-4 || z1 <= z0) return;
    const nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
    const s0 = o.s0 || 0, su = m.size[0], sv = m.size[1];
    const u0 = s0 / su, u1 = (s0 + len) / su, v0 = -(z0 + (o.zOff || 0)) / sv, v1 = -(z1 + (o.zOff || 0)) / sv;
    // AO: darker near the ground, gently.
    const ao = o.ao ?? (z0 <= 0.5 ? 0.62 : 0.85);
    this.quad([[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], m.layer, [nx, ny, 0],
      { tint: o.tint, alpha: o.alpha, em: (o.em ?? 1) * m.em, occ: [ao, ao, 1, 1] });
  }

  /** Horizontal polygon cap at height z (convex or simple; fan-triangulated). Normal ±z. */
  cap(pts, z, matName, o = {}) {
    const m = this.mat(matName), n = pts.length / 2, up = o.down ? -1 : 1;
    const c = this.light(0, 0, up, o.occ ?? 1, o.tint);
    const su = m.size[0], sv = m.size[1], ox = o.uvx || 0, oy = o.uvy || 0;
    const rot = o.uvRot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
    const idx = [];
    for (let k = 0; k < n; k++) {
      const x = pts[k * 2], y = pts[k * 2 + 1];
      const lx = (x - ox) * cr + (y - oy) * sr, ly = -(x - ox) * sr + (y - oy) * cr;
      idx.push(this.vert(x, y, z, lx / su, -ly / sv, m.layer, c, o.alpha ?? 1, (o.em ?? 1) * m.em));
    }
    for (let k = 1; k < n - 1; k++) if (up > 0) this.tri(idx[0], idx[k], idx[k + 1]); else this.tri(idx[0], idx[k + 1], idx[k]);
  }

  /**
   * Extruded polygon (counter-clockwise footprint, world xy) from z0 to z1.
   * o: { top, side (material names), sides: [per-edge material], bottom, uvRot }
   */
  prism(pts, z0, z1, o) {
    const n = pts.length / 2;
    let s = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      const x0 = pts[k * 2], y0 = pts[k * 2 + 1], x1 = pts[j * 2], y1 = pts[j * 2 + 1];
      const mat = (o.sides && o.sides[k]) || o.side;
      if (mat) this.wall(x0, y0, x1, y1, z0, z1, mat, { tint: o.tint, em: o.em, ao: o.ao, s0: o.continuous ? s : 0 });
      s += Math.hypot(x1 - x0, y1 - y0);
    }
    if (o.top) this.cap(pts, z1, o.top, { tint: o.topTint || o.tint, uvRot: o.uvRot, uvx: pts[0], uvy: pts[1], em: o.em });
    if (o.bottom) this.cap(pts, z0, o.bottom, { down: true, tint: o.tint, occ: 0.55 });
  }

  /**
   * Box centred at (x, y), base z, size w (x) × d (y) × h, rotated by rot.
   * o: { top, side, sides: [s(-y), e(+x), n(+y), w(-x)], bottom }
   */
  box(x, y, z, w, d, h, rot, o) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    const pts = [];
    for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) pts.push(x + u * c - v * s, y + u * s + v * c);
    this.prism(pts, z, z + h, { ...o, uvRot: rot });
  }

  /**
   * Surface of revolution around a vertical axis: profile = [[r, z], ...]
   * from bottom to top. Smooth normals; a cap on top if the last r > 0.
   */
  lathe(x, y, profile, matName, o = {}) {
    const m = this.mat(matName), seg = o.seg || 16, su = m.size[0], sv = m.size[1];
    const rows = [];
    let vacc = 0;
    for (let j = 0; j < profile.length; j++) {
      const [r, z] = profile[j];
      if (j) vacc += Math.hypot(r - profile[j - 1][0], z - profile[j - 1][1]);
      // Profile slope → normal tilt.
      const pr = profile[Math.max(0, j - 1)], nx2 = profile[Math.min(profile.length - 1, j + 1)];
      const dr = nx2[0] - pr[0], dz = nx2[1] - pr[1], len = Math.hypot(dr, dz) || 1;
      const nh = dz / len, nz = -dr / len;
      const row = [];
      const ao = z <= 0.5 ? 0.65 : 1;
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const circ = (TAU * Math.max(r, 1)) / su;
        const col = this.light(ca * nh, sa * nh, nz, ao, o.tint);
        row.push(this.vert(x + ca * r, y + sa * r, z, (k / seg) * Math.max(1, Math.round(circ)), -vacc / sv, m.layer, col, o.alpha ?? 1, (o.em ?? 1) * m.em));
      }
      rows.push(row);
    }
    for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < seg; k++) {
      const a = rows[j][k], b = rows[j][k + 1], c2 = rows[j + 1][k + 1], d = rows[j + 1][k];
      this.tri(a, b, c2); this.tri(a, c2, d);
    }
    const [rTop, zTop] = profile[profile.length - 1];
    if (rTop > 0 && o.top !== false) {
      const pts = [];
      for (let k = 0; k < seg; k++) { const a = (k / seg) * TAU; pts.push(x + Math.cos(a) * rTop, y + Math.sin(a) * rTop); }
      this.cap(pts, zTop, o.top || matName, { tint: o.tint, em: o.em });
    }
  }

  /** Cylinder shortcut. */
  cyl(x, y, z, r, h, matName, o = {}) { this.lathe(x, y, [[r, z], [r, z + h]], matName, o); }

  /** Oriented box between two 3D points (girders, beams, pipes as square sections). */
  beam(a, b, w, h, matName, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    // Side vector: horizontal, perpendicular to the beam; up = forward × side.
    let sx = -fy, sy = fx, sz = 0;
    const sl = Math.hypot(sx, sy) || 1;
    if (sl < 1e-3) { sx = 1; sy = 0; } else { sx /= sl; sy /= sl; }
    const ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx;
    const m = this.mat(matName), su = m.size[0];
    const hw = w / 2, hh = h / 2;
    const corner = (p, ks, ku) => [p[0] + sx * ks * hw + ux * ku * hh, p[1] + sy * ks * hw + uy * ku * hh, p[2] + sz * ks * hw + uz * ku * hh];
    const faces = [[1, 1, [ux, uy, uz]], [-1, -1, [-ux, -uy, -uz]]];
    const sides = [
      [[1, -1], [1, 1], [sx, sy, sz]], [[-1, 1], [-1, -1], [-sx, -sy, -sz]],
      [[1, 1], [-1, 1], [ux, uy, uz]], [[-1, -1], [1, -1], [-ux, -uy, -uz]],
    ];
    void faces;
    for (const [[s0, u0], [s1, u1], n] of sides) {
      const p = [corner(a, s0, u0), corner(a, s1, u1), corner(b, s1, u1), corner(b, s0, u0)];
      this.quad(p, [[0, 0], [w / su, 0], [w / su, len / m.size[1]], [0, len / m.size[1]]], m.layer, n, { tint: o.tint, em: m.em });
    }
  }

  /**
   * Terrain / deck plane from x0..x1, y0..y1 (uv 0..1 over the rect, using
   * the draw's plane texture: layer -1). Optional height function and grid.
   */
  plane(x0, x1, y0, y1, z, o = {}) {
    const nx = o.nx || 1, ny = o.ny || 1, hf = o.height;
    const c = this.light(0, 0, 1, 1, o.tint);
    const idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, y = y0 + ((y1 - y0) * j) / ny;
      const zz = z + (hf ? hf(x, y) : 0);
      idx.push(this.vert(x, y, zz, i / nx, 1 - j / ny, -1, o.flat ? [1, 1, 1] : c, o.alpha ?? 1, o.em ?? 0));
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = idx[j * (nx + 1) + i], b = idx[j * (nx + 1) + i + 1], c2 = idx[(j + 1) * (nx + 1) + i + 1], d = idx[(j + 1) * (nx + 1) + i];
      this.tri(a, b, c2); this.tri(a, c2, d);
    }
  }

  get empty() { return this.ni === 0; }

  /** Trimmed copies (transferable). */
  finish() {
    return { v: this.v.slice(0, this.nv * FLOATS), i: this.i.slice(0, this.ni), count: this.ni };
  }
}
