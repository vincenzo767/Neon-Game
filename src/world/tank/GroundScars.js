// Ground fractures in WORLD space (seismic faults, deep-core fissures).
//
// A scar is a polyline on the ground with a width. It can grow along its
// length (a crack running out from the drill), widen while a charge builds,
// glow (molten fissure) and then cool and fade. The renderer draws two
// passes from the same strips: a multiplicative one (the dark crack and its
// heaved lips, TL.CRACK) and an additive one where the crack's darkness is the
// glow mask. Both are depth tested in the arena pass, so the boss hides the
// part of a fissure that runs under it.

const MAXV = 6 * 2400;

export class GroundScars {
  constructor() {
    this.list = [];
    this.dark = new Float32Array(MAXV * 6);
    this.glow = new Float32Array(MAXV * 6);
    this.nDark = 0;
    this.nGlow = 0;
  }

  /**
   * pts: [x0, y0, x1, y1, ...] world; o: { w (width), life (steps), grow
   * (steps to run its full length), glow (initial), period (texture units) }
   */
  add(pts, o = {}) {
    const s = { pts, w: o.w ?? 18, w0: o.w0 ?? (o.w ?? 18) * 0.35, t: 0, life: o.life ?? 1800, grow: o.grow ?? 1, glow: o.glow ?? 0, widen: o.widen ?? 1, period: o.period ?? 64, len: 0 };
    let L = 0;
    for (let k = 2; k < pts.length; k += 2) L += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    s.total = L;
    this.list.push(s);
    if (this.list.length > 90) this.list.shift();
    return s;
  }

  step() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t++;
      if (s.t >= s.life) this.list.splice(i, 1);
    }
  }

  clear() { this.list.length = 0; }

  /** Fill both strip buffers at ground height z. */
  build(z) {
    let od = 0, og = 0;
    const D = this.dark, G = this.glow;
    for (const s of this.list) {
      const reach = s.total * Math.min(1, s.t / Math.max(1, s.grow));
      const fade = Math.min(1, (s.life - s.t) / 240);
      const wNow = s.w0 + (s.w - s.w0) * Math.min(1, s.t / Math.max(1, s.grow)) * s.widen;
      const P = s.pts;
      let d = 0;
      for (let k = 2; k < P.length && d < reach; k += 2) {
        const ax = P[k - 2], ay = P[k - 1];
        let bx = P[k], by = P[k + 1];
        const l = Math.hypot(bx - ax, by - ay) || 1;
        const use = Math.min(l, reach - d);
        if (use < l) { bx = ax + (bx - ax) * (use / l); by = ay + (by - ay) * (use / l); }
        // Taper toward the growing tip so the crack runs to a point.
        const tipA = Math.min(1, (reach - d) / 30), tipB = Math.min(1, (reach - d - use) / 30 + 0.05);
        const nx = -(by - ay) / l, ny = (bx - ax) / l;
        const ha = wNow * 0.5 * tipA, hb = wNow * 0.5 * Math.max(0.1, tipB);
        const va = d / s.period, vb = (d + use) / s.period;
        const q = [
          [ax - nx * ha, ay - ny * ha, 0, va], [ax + nx * ha, ay + ny * ha, 1, va], [bx + nx * hb, by + ny * hb, 1, vb],
          [ax - nx * ha, ay - ny * ha, 0, va], [bx + nx * hb, by + ny * hb, 1, vb], [bx - nx * hb, by - ny * hb, 0, vb],
        ];
        if (od + 36 <= D.length) for (const v of q) { D[od++] = v[0]; D[od++] = v[1]; D[od++] = z; D[od++] = v[2]; D[od++] = v[3]; D[od++] = fade; }
        if (s.glow > 0.01 && og + 36 <= G.length) for (const v of q) { G[og++] = v[0]; G[og++] = v[1]; G[og++] = z + 0.2; G[og++] = v[2]; G[og++] = v[3]; G[og++] = s.glow * fade; }
        d += use;
      }
    }
    this.nDark = od / 6;
    this.nGlow = og / 6;
  }
}

/** Jagged polyline from (x, y) along angle a for len, kinking every ~seg units. */
export function jagged(R, x, y, a, len, seg = 16, wander = 0.45) {
  const pts = [x, y];
  let d = 0;
  while (d < len) {
    const s = Math.min(seg * R.range(0.7, 1.3), len - d);
    a += R.range(-wander, wander);
    x += Math.cos(a) * s; y += Math.sin(a) * s;
    pts.push(x, y);
    d += s;
  }
  return pts;
}
