import { WORLD_W, WORLD_H } from '../core/constants.js';

// Perspective camera for the arena world pass.
//
// World axes: X right, Y forward (up the screen, the direction of flight),
// Z up toward the camera. The camera looks at a ground target T = (0, y, 0)
// from distance D, pitched forward by `pitch` radians, so the top of the
// screen sees farther away (like the reference boards). At the target the
// horizontal scale is exactly 1 world unit = 1 screen unit, so arena geometry
// is authored at the same scale as gameplay (≈ 6 units per metre).
//
// The vertex shaders and the CPU projection below use the same numbers, so
// world-anchored effects (fire on a wreck, a crater at an impact point) land
// exactly on the geometry they belong to.

const HW = WORLD_W / 2, HH = WORLD_H / 2;

export class Camera3D {
  constructor(o = {}) {
    this.D = o.distance ?? 900;
    this.pitch = o.pitch ?? 0.3;
    this.near = o.near ?? 40;
    this.far = o.far ?? 30000;
    this.x = 0;          // lateral sway
    this.y = 0;          // forward travel (look target)
    this.py = 0;         // previous step (render interpolation)
    this.roll = 0;
    this.speed = 1;      // world units per step
    this.vp = new Float32Array(16);
    this._update(0);
  }

  /** Advance one simulation step. */
  step(speed = this.speed) {
    this.py = this.y;
    this.y += speed;
  }

  /** Compute the basis + view-projection for render interpolation alpha. */
  _update(alpha, shakeX = 0, shakeY = 0) {
    const y = this.py + (this.y - this.py) * alpha;
    const s = Math.sin(this.pitch), c = Math.cos(this.pitch), D = this.D;
    // Eye, forward, up, right (roll rotates up/right around forward).
    this.ex = this.x; this.ey = y - D * s; this.ez = D * c;
    const fx = 0, fy = s, fz = -c;
    let ux = 0, uy = c, uz = s, rx = 1, ry = 0, rz = 0;
    if (this.roll) {
      const cr = Math.cos(this.roll), sr = Math.sin(this.roll);
      [rx, ry, rz, ux, uy, uz] = [rx * cr + ux * sr, ry * cr + uy * sr, rz * cr + uz * sr, ux * cr - rx * sr, uy * cr - ry * sr, uz * cr - rz * sr];
    }
    this.f = [fx, fy, fz]; this.u = [ux, uy, uz]; this.r = [rx, ry, rz];
    this.cy = y;
    // clip.x = (r·(P-E)) * D/HW, clip.y = (u·(P-E)) * D/HH, clip.w = f·(P-E)
    const n = this.near, fa = this.far, A = (fa + n) / (fa - n), B = (-2 * fa * n) / (fa - n);
    const kx = D / HW, ky = D / HH;
    const ex = this.ex, ey = this.ey, ez = this.ez;
    const tx = -(rx * ex + ry * ey + rz * ez), ty = -(ux * ex + uy * ey + uz * ez), tz = -(fx * ex + fy * ey + fz * ez);
    // Shake: screen-space offset applied after projection (clip += off * w).
    const ox = -shakeX / HW, oy = shakeY / HH;
    const m = this.vp; // column-major
    m[0] = rx * kx + fx * ox; m[1] = ux * ky + fx * oy; m[2] = fx * A; m[3] = fx;
    m[4] = ry * kx + fy * ox; m[5] = uy * ky + fy * oy; m[6] = fy * A; m[7] = fy;
    m[8] = rz * kx + fz * ox; m[9] = uz * ky + fz * oy; m[10] = fz * A; m[11] = fz;
    m[12] = tx * kx + tz * ox; m[13] = ty * ky + tz * oy; m[14] = tz * A + B; m[15] = tz;
    this.shakeX = shakeX; this.shakeY = shakeY;
    return m;
  }

  /** Prepare for a frame (interpolated); returns the view-projection matrix. */
  frame(alpha, shakeX = 0, shakeY = 0) { return this._update(alpha, shakeX, shakeY); }

  /**
   * World → gameplay screen space (480×640 units, before camera shake: the
   * sprite batch applies shake itself). out = [sx, sy, scale, depth].
   */
  project(x, y, z, out = [0, 0, 0, 0]) {
    const dx = x - this.ex, dy = y - this.ey, dz = z - this.ez;
    const r = this.r, u = this.u, f = this.f;
    const d = f[0] * dx + f[1] * dy + f[2] * dz;
    const k = this.D / Math.max(1e-3, d);
    out[0] = HW + (r[0] * dx + r[1] * dy + r[2] * dz) * k;
    out[1] = HH - (u[0] * dx + u[1] * dy + u[2] * dz) * k;
    out[2] = k;
    out[3] = d;
    return out;
  }

  /** Screen point (480×640 units) → world point on the plane z = h. Returns null if parallel. */
  unproject(sx, sy, h = 0, out = [0, 0, 0]) {
    const a = (sx - HW) / this.D, b = (HH - sy) / this.D;
    const r = this.r, u = this.u, f = this.f;
    const dx = f[0] + r[0] * a + u[0] * b, dy = f[1] + r[1] * a + u[1] * b, dz = f[2] + r[2] * a + u[2] * b;
    if (Math.abs(dz) < 1e-6) return null;
    const t = (h - this.ez) / dz;
    if (t <= 0) return null;
    out[0] = this.ex + dx * t; out[1] = this.ey + dy * t; out[2] = h;
    return out;
  }

  /**
   * Area of the plane z = h visible on screen (with a margin in screen units),
   * as {x0, x1, y0, y1}. Uses the current (interpolated) pose.
   */
  footprint(h = 0, margin = 40) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const p = [0, 0, 0];
    for (const [sx, sy] of [[-margin, -margin], [WORLD_W + margin, -margin], [-margin, WORLD_H + margin], [WORLD_W + margin, WORLD_H + margin]]) {
      if (!this.unproject(sx, sy, h, p)) continue;
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }
    return { x0, x1, y0, y1 };
  }
}
