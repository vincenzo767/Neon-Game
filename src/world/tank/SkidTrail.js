// Tyre marks for a wheeled vehicle, in WORLD space (URBAN DEVASTATOR).
//
// One strip per tyre: each records its contact point while it is marking,
// with an INTENSITY per sample (a light scuff while cruising, a black arc
// while drifting, braking hard or launching on the turbo). Consecutive
// samples become a ribbon (mitred at bends), so the marks curve with the
// real path and bend outward through a drift. They fade linearly over `life`
// steps (configurable) and are dropped once far behind the camera. A strip
// breaks where the tyre stops marking.
//
// Output format matches TrackTrail (x y z u v a) so TankRenderer.trail draws
// it with the SKID layer: a = intensity × fade.

const STEP = 5;

export class SkidTrail {
  /** @param widths ribbon width per tyre, life fade duration (steps), max samples per tyre */
  constructor(widths, life = 1500, max = 520) {
    this.life = life;
    this.max = max;
    this.tracks = widths.map((w) => ({ w, x: new Float32Array(max), y: new Float32Array(max), a: new Float32Array(max), t: new Float32Array(max), d: new Float32Array(max), brk: new Uint8Array(max), n: 0, start: 0, lift: true, dist: 0 }));
    this.data = new Float32Array(max * widths.length * 36);
    this.count = 0;
    this.time = 0;
    this.dirty = true;
    this.lastBuild = -99;
  }

  /** Tyre k at (x, y) marking with intensity a (0 = not marking: the strip breaks). */
  add(k, x, y, a) {
    const T = this.tracks[k];
    if (a <= 0.02) { T.lift = true; return; }
    const M = this.max;
    const last = T.n ? (T.start + T.n - 1) % M : -1;
    if (last >= 0 && !T.lift) {
      const dx = x - T.x[last], dy = y - T.y[last], d2 = dx * dx + dy * dy;
      if (d2 < STEP * STEP) { T.a[last] = Math.max(T.a[last], a); return; }
      T.dist += Math.sqrt(d2);
    }
    let i;
    if (T.n < M) { i = (T.start + T.n) % M; T.n++; } else { i = T.start; T.start = (T.start + 1) % M; }
    T.x[i] = x; T.y[i] = y; T.a[i] = a; T.t[i] = this.time; T.d[i] = T.dist; T.brk[i] = T.lift ? 1 : 0;
    T.lift = false;
    this.dirty = true;
  }

  step() { this.time++; }

  /** Drop samples behind the camera and those fully faded. */
  trim(minY) {
    const M = this.max;
    for (const T of this.tracks) {
      while (T.n > 1 && ((T.y[T.start] < minY && T.y[(T.start + 1) % M] < minY) || this.time - T.t[T.start] > this.life)) { T.start = (T.start + 1) % M; T.n--; this.dirty = true; }
    }
  }

  build(z = 0.4) {
    if (!this.dirty && this.time - this.lastBuild < 20) return this.count;
    this.lastBuild = this.time;
    this.dirty = false;
    const D = this.data, M = this.max;
    const E = this.edge || (this.edge = new Float32Array(M * 5));
    let o = 0;
    for (const T of this.tracks) {
      if (T.n < 2) continue;
      const hw = T.w / 2;
      for (let j = 0; j < T.n; j++) {
        const i = (T.start + j) % M;
        const ip = (T.start + Math.max(0, j - 1)) % M, inx = (T.start + Math.min(T.n - 1, j + 1)) % M;
        let tx = T.x[inx] - T.x[ip], ty = T.y[inx] - T.y[ip];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const age = this.time - T.t[i], fade = Math.max(0, 1 - age / this.life);
        E[j * 5] = T.x[i] - ty * hw; E[j * 5 + 1] = T.y[i] + tx * hw;
        E[j * 5 + 2] = T.x[i] + ty * hw; E[j * 5 + 3] = T.y[i] - tx * hw;
        E[j * 5 + 4] = T.a[i] * fade;
      }
      // Newest first (the renderer depth-rejects later overlaps inside the pass).
      for (let j = T.n - 1; j > 0; j--) {
        const i = (T.start + j) % M, h = (T.start + j - 1) % M;
        if (T.brk[i]) continue;
        const a = j * 5, b = (j - 1) * 5, va = T.d[i] / 90, vb = T.d[h] / 90;
        if (E[a + 4] < 0.01 && E[b + 4] < 0.01) continue;
        const quad = [[E[a], E[a + 1], 0, va, E[a + 4]], [E[a + 2], E[a + 3], 1, va, E[a + 4]], [E[b + 2], E[b + 3], 1, vb, E[b + 4]],
          [E[a], E[a + 1], 0, va, E[a + 4]], [E[b + 2], E[b + 3], 1, vb, E[b + 4]], [E[b], E[b + 1], 0, vb, E[b + 4]]];
        for (const q of quad) { D[o++] = q[0]; D[o++] = q[1]; D[o++] = z; D[o++] = q[2]; D[o++] = q[3]; D[o++] = q[4]; }
      }
    }
    this.count = o / 6;
    return this.count;
  }

  clear() { for (const T of this.tracks) { T.n = 0; T.start = 0; T.lift = true; } this.dirty = true; }
}
