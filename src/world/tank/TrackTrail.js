// Persistent tread impressions for a tracked vehicle, in WORLD space.
//
// Each track records its ground contact point whenever it has moved a few
// units; consecutive samples become a ribbon (mitred at bends, so the marks
// curve with the real path and smear sideways in a pivot turn). The v
// coordinate is the distance travelled, so every grouser print stays where
// it was pressed. Prints fade slowly with age and are dropped once they have
// scrolled far behind the camera.

const STEP = 4;          // world units between samples
const MAX = 700;         // samples per track (~2800 units of path)
const FADE0 = 2400;      // steps before prints start to fade
const FADE1 = 6000;      // fully faded

export class TrackTrail {
  /** @param width ribbon width (track + berms), n tracks */
  constructor(width = 36, n = 2) {
    this.w = width;
    this.tracks = Array.from({ length: n }, () => ({ x: new Float32Array(MAX), y: new Float32Array(MAX), d: new Float32Array(MAX), t: new Float32Array(MAX), n: 0, start: 0, gap: [] }));
    this.data = new Float32Array(MAX * n * 6 * 6);
    this.count = 0;
    this.dirty = true;
    this.time = 0;
    this.lastBuild = -99;
  }

  /** Contact point of track k this step; dist = distance the track has rolled (signed). */
  add(k, x, y, dist, pressing = true) {
    const T = this.tracks[k];
    if (!pressing) { T.lift = true; return; }
    const last = T.n ? (T.start + T.n - 1) % MAX : -1;
    if (last >= 0 && !T.lift) {
      const dx = x - T.x[last], dy = y - T.y[last];
      if (dx * dx + dy * dy < STEP * STEP) return;
    }
    // A lifted track (teleport / reset) starts a fresh strip.
    if (T.lift && T.n) T.gap.push((T.start + T.n) % MAX);
    T.lift = false;
    let i;
    if (T.n < MAX) { i = (T.start + T.n) % MAX; T.n++; } else { i = T.start; T.start = (T.start + 1) % MAX; if (T.gap.length && T.gap[0] === T.start) T.gap.shift(); }
    T.x[i] = x; T.y[i] = y; T.d[i] = dist; T.t[i] = this.time;
    this.dirty = true;
  }

  /** Drop samples behind the camera (world y below `minY`). */
  trim(minY) {
    for (const T of this.tracks) {
      while (T.n > 1 && T.y[T.start] < minY && T.y[(T.start + 1) % MAX] < minY) {
        if (T.gap.length && T.gap[0] === T.start) T.gap.shift();
        T.start = (T.start + 1) % MAX; T.n--; this.dirty = true;
      }
    }
  }

  step() { this.time++; }

  /** Triangle list (x y z u v a) for the renderer; rebuilt when a sample lands (and twice a second for the fade). */
  build(z = 0.25) {
    if (!this.dirty && this.time - this.lastBuild < 30) return this.count;
    this.lastBuild = this.time;
    this.dirty = false;
    const D = this.data, hw = this.w / 2;
    let o = 0;
    // Newest prints first: the renderer depth-rejects later overlaps inside the
    // pass, so a track crossing its own path doesn't darken twice and the
    // freshest impression is the one that shows.
    const E = this.edge || (this.edge = new Float32Array(MAX * 5));
    for (const T of this.tracks) {
      if (T.n < 2) continue;
      const gaps = new Set(T.gap);
      for (let j = 0; j < T.n; j++) {
        const i = (T.start + j) % MAX;
        const ip = (T.start + Math.max(0, j - 1)) % MAX, inx = (T.start + Math.min(T.n - 1, j + 1)) % MAX;
        let tx = T.x[inx] - T.x[ip], ty = T.y[inx] - T.y[ip];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const age = this.time - T.t[i];
        E[j * 5] = T.x[i] - ty * hw; E[j * 5 + 1] = T.y[i] + tx * hw;   // left edge
        E[j * 5 + 2] = T.x[i] + ty * hw; E[j * 5 + 3] = T.y[i] - tx * hw; // right edge
        E[j * 5 + 4] = age < FADE0 ? 1 : Math.max(0.35, 1 - (age - FADE0) / (FADE1 - FADE0) * 0.65);
      }
      for (let j = T.n - 1; j > 0; j--) {
        const i = (T.start + j) % MAX, h = (T.start + j - 1) % MAX;
        if (gaps.has(i)) continue; // a fresh strip starts at i
        const a = j * 5, b = (j - 1) * 5, va = T.d[i] / 72, vb = T.d[h] / 72;
        const quad = [[E[a], E[a + 1], 0, va, E[a + 4]], [E[a + 2], E[a + 3], 1, va, E[a + 4]], [E[b + 2], E[b + 3], 1, vb, E[b + 4]],
          [E[a], E[a + 1], 0, va, E[a + 4]], [E[b + 2], E[b + 3], 1, vb, E[b + 4]], [E[b], E[b + 1], 0, vb, E[b + 4]]];
        for (const q of quad) { D[o++] = q[0]; D[o++] = q[1]; D[o++] = z; D[o++] = q[2]; D[o++] = q[3]; D[o++] = q[4]; }
      }
    }
    this.count = o / 6;
    return this.count;
  }

  clear() { for (const T of this.tracks) { T.n = 0; T.start = 0; T.gap.length = 0; } this.dirty = true; }
}
