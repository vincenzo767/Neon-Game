// Geometry builder for animated 3D boss parts (the White Fang tank). Unlike
// the arena's MeshBuilder (lighting baked per vertex for static solids), this
// keeps NORMALS so the part can be lit in the shader while it moves, turns
// and recoils.
//
// Vertex (13 floats): x y z | nx ny nz | u v layer | r g b | em
//   layer  index into the tank texture array (tankTextures.TL)
//   rgb    tint × baked ambient occlusion
//   em     emissive weight (× the draw's emissive colour)

export const TFLOATS = 13;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class TankMesh {
  constructor() {
    this.v = new Float32Array(4096 * TFLOATS);
    this.i = new Uint32Array(8192);
    this.nv = 0;
    this.ni = 0;
    this.tint = [1, 1, 1];
    this.em = 0;
    this.ao = null;      // [z0, z1]: vertices below z0 darken (contact AO)
  }

  _growV(n) {
    if ((this.nv + n) * TFLOATS <= this.v.length) return;
    const nv = new Float32Array(Math.max(this.v.length * 2, (this.nv + n) * TFLOATS * 1.5));
    nv.set(this.v.subarray(0, this.nv * TFLOATS)); this.v = nv;
  }

  _growI(n) {
    if (this.ni + n <= this.i.length) return;
    const ni = new Uint32Array(Math.max(this.i.length * 2, (this.ni + n) * 1.5));
    ni.set(this.i.subarray(0, this.ni)); this.i = ni;
  }

  /** Run fn with a temporary tint / emissive / AO. */
  with(o, fn) {
    const t = this.tint, e = this.em, a = this.ao;
    if (o.tint) this.tint = o.tint;
    if (o.em !== undefined) this.em = o.em;
    if (o.ao !== undefined) this.ao = o.ao;
    fn(this);
    this.tint = t; this.em = e; this.ao = a;
    return this;
  }

  vert(x, y, z, nx, ny, nz, u, v, layer) {
    this._growV(1);
    const o = this.nv * TFLOATS, V = this.v, t = this.tint;
    const k = this.ao ? 0.55 + 0.45 * smooth(this.ao[0], this.ao[1], z) : 1;
    V[o] = x; V[o + 1] = y; V[o + 2] = z; V[o + 3] = nx; V[o + 4] = ny; V[o + 5] = nz;
    V[o + 6] = u; V[o + 7] = v; V[o + 8] = layer;
    V[o + 9] = t[0] * k; V[o + 10] = t[1] * k; V[o + 11] = t[2] * k; V[o + 12] = this.em;
    return this.nv++;
  }

  tri(a, b, c) { this._growI(3); this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c; }

  /** Flat quad p0..p3 (any winding), normal oriented away from `inside` (or +z). */
  quad(p, uv, layer, inside = null) {
    let n = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    if (len(n) < 1e-9) n = cross(sub(p[2], p[0]), sub(p[3], p[0]));
    n = norm(n);
    const c = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, (p[0][2] + p[2][2]) / 2];
    const ref = inside ? sub(c, inside) : [0, 0, 1];
    if (dot(n, ref) < 0) n = [-n[0], -n[1], -n[2]];
    const ids = p.map((q, k) => this.vert(q[0], q[1], q[2], n[0], n[1], n[2], uv[k][0], uv[k][1], layer));
    this.tri(ids[0], ids[1], ids[2]); this.tri(ids[0], ids[2], ids[3]);
  }

  /** Flat triangle, normal away from `inside`. */
  triangle(p, uv, layer, inside = null) {
    let n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    const c = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3];
    const ref = inside ? sub(c, inside) : [0, 0, 1];
    if (dot(n, ref) < 0) n = [-n[0], -n[1], -n[2]];
    const ids = p.map((q, k) => this.vert(q[0], q[1], q[2], n[0], n[1], n[2], uv[k][0], uv[k][1], layer));
    this.tri(ids[0], ids[1], ids[2]);
  }

  /**
   * Loft through rings [{ pts: [x, y, ...], z }] (same vertex count, convex,
   * any winding). Flat-shaded side bands, cap on the last ring.
   * o: { layer, top (layer for the cap), bottom (layer: cap the first ring),
   *      uv (world units per texture tile), topUv }
   */
  loft(rings, o) {
    const n = rings[0].pts.length / 2, layer = o.layer, s = o.uv || 128;
    let cx = 0, cy = 0, cz = 0, m = 0;
    for (const r of rings) for (let k = 0; k < n; k++) { cx += r.pts[k * 2]; cy += r.pts[k * 2 + 1]; cz += r.z; m++; }
    const inside = [cx / m, cy / m, cz / m];
    let vAcc = 0;
    for (let j = 0; j < rings.length - 1; j++) {
      const A = rings[j], B = rings[j + 1];
      let slant = 0, uAcc = 0;
      for (let k = 0; k < n; k++) slant = Math.max(slant, Math.hypot(B.pts[k * 2] - A.pts[k * 2], B.pts[k * 2 + 1] - A.pts[k * 2 + 1], B.z - A.z));
      for (let k = 0; k < n; k++) {
        const q = (k + 1) % n;
        const a0 = [A.pts[k * 2], A.pts[k * 2 + 1], A.z], a1 = [A.pts[q * 2], A.pts[q * 2 + 1], A.z];
        const b0 = [B.pts[k * 2], B.pts[k * 2 + 1], B.z], b1 = [B.pts[q * 2], B.pts[q * 2 + 1], B.z];
        const el = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
        if (el < 1e-6 && Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) < 1e-6) continue;
        const u0 = uAcc / s, u1 = (uAcc + el) / s, v0 = -vAcc / s, v1 = -(vAcc + slant) / s;
        this.quad([a0, a1, b1, b0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], o.sides ? o.sides[k] ?? layer : layer, inside);
        uAcc += el;
      }
      vAcc += slant;
    }
    const cap = (R, l, down) => {
      const ts = o.topUv || s, ids = [];
      const nz = down ? -1 : 1;
      for (let k = 0; k < n; k++) ids.push(this.vert(R.pts[k * 2], R.pts[k * 2 + 1], R.z, 0, 0, nz, R.pts[k * 2] / ts, -R.pts[k * 2 + 1] / ts, l));
      for (let k = 1; k < n - 1; k++) this.tri(ids[0], ids[k], ids[k + 1]);
    };
    if (o.top !== false) cap(rings[rings.length - 1], o.top ?? layer, false);
    if (o.bottom !== undefined) cap(rings[0], o.bottom, true);
    return this;
  }

  /**
   * Bevelled box: centre (x, y), base z0, size w × d × h, bevel b on the top
   * edges (the chamfer catches the light: reads as machined armour).
   */
  box(x, y, z0, w, d, h, layer, o = {}) {
    const b = Math.min(o.bevel ?? 2, w / 3, d / 3, h / 2), r = o.rot || 0;
    const rect = (hw, hd) => {
      const c = Math.cos(r), s = Math.sin(r), out = [];
      for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) out.push(x + u * c - v * s, y + u * s + v * c);
      return out;
    };
    const rings = b > 0.05
      ? [{ pts: rect(w / 2, d / 2), z: z0 }, { pts: rect(w / 2, d / 2), z: z0 + h - b }, { pts: rect(w / 2 - b, d / 2 - b), z: z0 + h }]
      : [{ pts: rect(w / 2, d / 2), z: z0 }, { pts: rect(w / 2, d / 2), z: z0 + h }];
    return this.loft(rings, { layer, top: o.top ?? layer, uv: o.uv, topUv: o.topUv, bottom: o.bottom });
  }

  /**
   * Cylinder (or cone, r1) between 3D points a → b with smooth side normals.
   * o: { r1, seg, caps (true | 'end'), capLayer, uvU (tiles around), uvV (units per tile), vOff }
   */
  tube(a, b, r, layer, o = {}) {
    const seg = o.seg || 12, r1 = o.r1 ?? r;
    const ax = sub(b, a), L = len(ax), f = norm(ax);
    // Basis perpendicular to the axis.
    const up = Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const s = norm(cross(f, up)), t = cross(s, f);
    const uvU = o.uvU || 1, uvV = o.uvV || 64;
    const slope = (r - r1) / L;
    const rows = [];
    for (const [p, rr, vv] of [[a, r, 0], [b, r1, L]]) {
      const row = [];
      for (let k = 0; k <= seg; k++) {
        const ang = (k / seg) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const dx = s[0] * ca + t[0] * sa, dy = s[1] * ca + t[1] * sa, dz = s[2] * ca + t[2] * sa;
        const n = norm([dx + f[0] * slope, dy + f[1] * slope, dz + f[2] * slope]);
        row.push(this.vert(p[0] + dx * rr, p[1] + dy * rr, p[2] + dz * rr, n[0], n[1], n[2], (k / seg) * uvU, -((o.vOff || 0) + vv) / uvV, layer));
      }
      rows.push(row);
    }
    for (let k = 0; k < seg; k++) { const a0 = rows[0][k], a1 = rows[0][k + 1], b1 = rows[1][k + 1], b0 = rows[1][k]; this.tri(a0, a1, b1); this.tri(a0, b1, b0); }
    const capAt = (p, rr, nrm) => {
      if (rr <= 0.01) return;
      const cl = o.capLayer ?? layer;
      const c = this.vert(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], 0.5, -0.5, cl);
      const ring = [];
      for (let k = 0; k <= seg; k++) {
        const ang = (k / seg) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        ring.push(this.vert(p[0] + (s[0] * ca + t[0] * sa) * rr, p[1] + (s[1] * ca + t[1] * sa) * rr, p[2] + (s[2] * ca + t[2] * sa) * rr, nrm[0], nrm[1], nrm[2], 0.5 + ca * 0.5, -(0.5 + sa * 0.5), cl));
      }
      for (let k = 0; k < seg; k++) this.tri(c, ring[k], ring[k + 1]);
    };
    if (o.caps === true || o.caps === 'end') capAt(b, r1, f);
    if (o.caps === true || o.caps === 'start') capAt(a, r, [-f[0], -f[1], -f[2]]);
    return this;
  }

  /** Vertical lathe (domes, turret rings): profile [[r, z], ...], `seg` facets, centre (x, y). */
  lathe(x, y, profile, layer, o = {}) {
    const seg = o.seg || 16, rot = o.rot || 0;
    const rings = profile.map(([r, z]) => {
      const pts = [];
      for (let k = 0; k < seg; k++) { const a = rot + (k / seg) * Math.PI * 2; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      return { pts, z };
    });
    return this.loft(rings, { layer, top: o.top ?? layer, uv: o.uv || 64, topUv: o.topUv });
  }

  get count() { return this.ni; }

  finish() { return { v: this.v.slice(0, this.nv * TFLOATS), i: this.i.slice(0, this.ni), count: this.ni }; }
}

// ------------------------------------------------------------ vec3

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ------------------------------------------------------------ mat4 (column-major)

export const M4 = {
  ident(o = new Float32Array(16)) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  mul(a, b, o = new Float32Array(16)) {
    const r = o === a || o === b ? new Float32Array(16) : o;
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
      r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    }
    if (r !== o) o.set(r);
    return o;
  },
  trans(x, y, z, o = new Float32Array(16)) { M4.ident(o); o[12] = x; o[13] = y; o[14] = z; return o; },
  rotZ(a, o = new Float32Array(16)) { M4.ident(o); const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  rotX(a, o = new Float32Array(16)) { M4.ident(o); const c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY(a, o = new Float32Array(16)) { M4.ident(o); const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  /** Transform point p (vec3) by m → out. */
  point(m, x, y, z, out = [0, 0, 0]) {
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
  },
  /** Transform direction (no translation). */
  dir(m, x, y, z, out = [0, 0, 0]) {
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
  },
};
