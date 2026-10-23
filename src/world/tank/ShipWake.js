// Wake of a displacement hull, in WORLD space (CORAL SIEGE).
//
// The ship's real path is recorded as a short history of samples (bow point,
// stern point, the sponson shoulders, heading, speed, odometer, time), one
// every few units travelled. Every frame that history becomes ribbons on the
// water, drawn by TankRenderer.foam:
//
//   arms    Kelvin wake: from each bow / shoulder sample, a point pushed out
//           sideways (perpendicular to THAT sample's heading) by a distance
//           growing with how far the ship has gone since (≈ tan 19.5°) and
//           with time (the waves keep spreading). Because every sample keeps
//           its own position and heading, the arms curve with the turns the
//           ship really made and stay where it was.
//   wash    propeller race behind the stern: a centre-heavy band that widens
//           and fades with age.
//
// Intensity follows the speed the ship had at each sample (a stopped ship
// leaves no new wake; the old one fades out). Output format matches the
// trail ribbons: x y z u age a.

const STEP = 7;

export class ShipWake {
  /**
   * @param o { life (steps the wash lasts), armLife, vRef (speed for full intensity), sternHalf, bowHalf }
   */
  constructor(o = {}) {
    this.life = o.life || 560;
    this.armLife = o.armLife || 420;
    this.vRef = o.vRef || 1.6;
    this.sternHalf = o.sternHalf || 40;
    this.bowHalf = o.bowHalf || 6;
    this.max = 240;
    const F = Float32Array, n = this.max;
    this.s = { bx: new F(n), by: new F(n), sx: new F(n), sy: new F(n), lx: new F(n), ly: new F(n), rx: new F(n), ry: new F(n), h: new F(n), v: new F(n), d: new F(n), t: new F(n), brk: new Uint8Array(n) };
    this.n = 0; this.start = 0;
    this.odo = 0;
    this.time = 0;
    this.lastX = null; this.lastY = 0;
    this.live = null;
    this.arms = new Float32Array(n * 4 * 36 + 4 * 36);
    this.wash = new Float32Array(n * 36 + 36);
    this.nArms = 0; this.nWash = 0;
    this.boost = 0;   // extra churn (turbulent manoeuvres, overdrive)
  }

  clear() { this.n = 0; this.start = 0; this.lastX = null; this.live = null; }

  /**
   * One step. pose: { bow:[x,y], stern:[x,y], shoulders:[[x,y],[x,y]], h, v }
   * (h = heading: forward = (sin h, cos h)).
   */
  step(pose) {
    this.time++;
    const S = this.s, M = this.max;
    const px = pose.stern[0], py = pose.stern[1];
    let brk = 0;
    if (this.lastX !== null) {
      const dd = Math.hypot(px - this.lastX, py - this.lastY);
      if (dd > 60) brk = 1;                       // re-placed (new arena world): start a new strip
      else this.odo += dd;
    }
    this.lastX = px; this.lastY = py;
    this.live = pose;
    // Drop samples past their life.
    while (this.n > 1 && this.time - S.t[this.start] > this.life) { this.start = (this.start + 1) % M; this.n--; }
    const last = this.n ? (this.start + this.n - 1) % M : -1;
    if (!brk && last >= 0 && this.odo - S.d[last] < STEP) return;
    if (pose.v < 0.05 && !brk && last >= 0) return;
    let i;
    if (this.n < M) { i = (this.start + this.n) % M; this.n++; } else { i = this.start; this.start = (this.start + 1) % M; }
    S.bx[i] = pose.bow[0]; S.by[i] = pose.bow[1]; S.sx[i] = px; S.sy[i] = py;
    S.lx[i] = pose.shoulders[0][0]; S.ly[i] = pose.shoulders[0][1]; S.rx[i] = pose.shoulders[1][0]; S.ry[i] = pose.shoulders[1][1];
    S.h[i] = pose.h; S.v[i] = Math.min(2.2, pose.v / this.vRef + this.boost); S.d[i] = this.odo; S.t[i] = this.time; S.brk[i] = brk;
  }

  /** Rebuild the ribbons (z: water height). */
  build(z = 0.5) {
    const S = this.s, M = this.max, live = this.live;
    this.nArms = 0; this.nWash = 0;
    if (!live || this.n < 1) return;
    // Sample list newest → oldest, with the live pose as sample 0.
    const idx = [];
    for (let j = this.n - 1; j >= 0; j--) idx.push((this.start + j) % M);
    const cnt = idx.length + 1;
    const g = (k, key) => (k === 0 ? null : S[key][idx[k - 1]]);
    const hd = (k) => (k === 0 ? live.h : g(k, 'h'));
    const vv = (k) => (k === 0 ? Math.min(2.2, live.v / this.vRef + this.boost) : g(k, 'v'));
    const dist = (k) => (k === 0 ? 0 : this.odo - g(k, 'd'));
    const age = (k) => (k === 0 ? 0 : this.time - g(k, 't'));
    const brk = (k) => (k > 0 && S.brk[idx[k - 1]]);
    const pt = (k, which) => {
      if (k === 0) return which === 'b' ? live.bow : which === 's' ? live.stern : which === 'l' ? live.shoulders[0] : live.shoulders[1];
      const i = idx[k - 1];
      return which === 'b' ? [S.bx[i], S.by[i]] : which === 's' ? [S.sx[i], S.sy[i]] : which === 'l' ? [S.lx[i], S.ly[i]] : [S.rx[i], S.ry[i]];
    };
    // ---- Kelvin arms (bow ×2, shoulders ×2).
    const P = new Float32Array(cnt * 2), Wd = new Float32Array(cnt), A = new Float32Array(cnt), G = new Float32Array(cnt);
    let o = 0;
    for (const [which, side, b0, k0, gain] of [['b', -1, this.bowHalf, 0.34, 1], ['b', 1, this.bowHalf, 0.34, 1], ['l', -1, 2, 0.27, 0.75], ['r', 1, 2, 0.27, 0.75]]) {
      for (let k = 0; k < cnt; k++) {
        const h = hd(k), rx = Math.cos(h), ry = -Math.sin(h), d = dist(k), ag = age(k);
        const lat = b0 + d * k0 + ag * 0.05;
        const q = pt(k, which);
        P[k * 2] = q[0] + rx * side * lat; P[k * 2 + 1] = q[1] + ry * side * lat;
        Wd[k] = Math.min(46, 5 + d * 0.05 + ag * 0.035);
        const life = Math.max(0, 1 - ag / this.armLife);
        A[k] = vv(k) * gain * life * life * Math.min(1, 0.35 + d / 30);
        G[k] = Math.min(1, ag / this.armLife);
      }
      o = ribbon(this.arms, o, P, Wd, A, G, cnt, z, brk);
    }
    this.nArms = o / 6;
    // ---- Propeller race / stern wash.
    for (let k = 0; k < cnt; k++) {
      const d = dist(k), ag = age(k), q = pt(k, 's');
      P[k * 2] = q[0]; P[k * 2 + 1] = q[1];
      Wd[k] = Math.min(150, this.sternHalf * 0.7 + d * 0.09 + ag * 0.05);
      const life = Math.max(0, 1 - ag / this.life);
      A[k] = vv(k) * Math.pow(life, 1.2) * Math.min(1, 0.45 + d / 40) * 1.15;
      G[k] = Math.min(1, ag / this.life);
    }
    this.nWash = ribbon(this.wash, 0, P, Wd, A, G, cnt, z + 0.05, brk) / 6;
  }
}

/** Mitred ribbon through P (half-widths W, intensity A, age G) → triangles appended to D at o. */
function ribbon(D, o, P, W, A, G, n, z, brk) {
  let ex0 = 0, ey0 = 0, ex1 = 0, ey1 = 0, prevOk = false;
  for (let k = 0; k < n; k++) {
    const kp = Math.max(0, k - 1), kn = Math.min(n - 1, k + 1);
    let tx = P[kn * 2] - P[kp * 2], ty = P[kn * 2 + 1] - P[kp * 2 + 1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const x = P[k * 2], y = P[k * 2 + 1], w = W[k];
    const ax = x - ty * w, ay = y + tx * w, bx = x + ty * w, by = y - tx * w;
    if (prevOk && !brk(k) && (A[k] > 0.01 || A[k - 1] > 0.01)) {
      const q = [[ex0, ey0, 0, G[k - 1], A[k - 1]], [ex1, ey1, 1, G[k - 1], A[k - 1]], [bx, by, 1, G[k], A[k]], [ex0, ey0, 0, G[k - 1], A[k - 1]], [bx, by, 1, G[k], A[k]], [ax, ay, 0, G[k], A[k]]];
      for (const v of q) { D[o++] = v[0]; D[o++] = v[1]; D[o++] = z; D[o++] = v[2]; D[o++] = v[3]; D[o++] = v[4]; }
    }
    ex0 = ax; ey0 = ay; ex1 = bx; ey1 = by; prevOk = true;
  }
  return o;
}
