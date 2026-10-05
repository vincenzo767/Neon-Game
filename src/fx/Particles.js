// Struct-of-arrays particle system. Dense storage with swap-remove, so
// update/render loops touch only live particles and never allocate.
//
// Usage:
//   const i = particles.spawn(frame, x, y, vx, vy, life);
//   if (i >= 0) { particles.size(i, 10, 30); particles.color(i, ...); ... }

export const FADE_OUT = 0;     // alpha 1 -> 0
export const FADE_INOUT = 1;   // alpha 0 -> 1 -> 0 (smoke)
export const FADE_FLICKER = 2; // fade out with flicker (embers)

export class Particles {
  constructor(capacity = 8192) {
    this.capacity = capacity;
    this.count = 0;
    const F = Float32Array;
    this.x = new F(capacity); this.y = new F(capacity);
    this.px = new F(capacity); this.py = new F(capacity);
    this.vx = new F(capacity); this.vy = new F(capacity);
    this.drag = new F(capacity); this.grav = new F(capacity);
    this.life = new F(capacity); this.maxLife = new F(capacity);
    this.s0 = new F(capacity); this.s1 = new F(capacity);
    this.rot = new F(capacity); this.vrot = new F(capacity);
    this.r0 = new F(capacity); this.g0 = new F(capacity); this.b0 = new F(capacity);
    this.r1 = new F(capacity); this.g1 = new F(capacity); this.b1 = new F(capacity);
    this.alpha = new F(capacity);
    this.add = new F(capacity);
    this.stretch = new F(capacity);
    this.aspect = new F(capacity);
    this.frame = new Uint16Array(capacity);
    this.fade = new Uint8Array(capacity);
  }

  spawn(frame, x, y, vx, vy, life) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.frame[i] = frame.id;
    this.x[i] = this.px[i] = x;
    this.y[i] = this.py[i] = y;
    this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = this.maxLife[i] = life;
    this.drag[i] = 1; this.grav[i] = 0;
    this.s0[i] = this.s1[i] = frame.w;
    this.aspect[i] = frame.h / frame.w;
    this.rot[i] = 0; this.vrot[i] = 0;
    this.r0[i] = this.g0[i] = this.b0[i] = 1;
    this.r1[i] = this.g1[i] = this.b1[i] = 1;
    this.alpha[i] = 1;
    this.add[i] = 1;
    this.stretch[i] = 0;
    this.fade[i] = FADE_OUT;
    return i;
  }

  size(i, s0, s1 = s0) { this.s0[i] = s0; this.s1[i] = s1; return this; }
  color(i, r0, g0, b0, r1 = r0, g1 = g0, b1 = b0) {
    this.r0[i] = r0; this.g0[i] = g0; this.b0[i] = b0;
    this.r1[i] = r1; this.g1[i] = g1; this.b1[i] = b1;
    return this;
  }
  phys(i, drag = 1, grav = 0) { this.drag[i] = drag; this.grav[i] = grav; return this; }
  spin(i, rot, vrot) { this.rot[i] = rot; this.vrot[i] = vrot; return this; }
  /** blend: add 1 = additive, 0 = alpha. stretch: velocity elongation factor. */
  look(i, alpha = 1, add = 1, fade = FADE_OUT, stretch = 0) {
    this.alpha[i] = alpha; this.add[i] = add; this.fade[i] = fade; this.stretch[i] = stretch;
    return this;
  }

  update() {
    let i = 0;
    while (i < this.count) {
      if (--this.life[i] <= 0) { this._remove(i); continue; }
      this.px[i] = this.x[i]; this.py[i] = this.y[i];
      const d = this.drag[i];
      this.vx[i] *= d;
      this.vy[i] = this.vy[i] * d + this.grav[i];
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
      this.rot[i] += this.vrot[i];
      i++;
    }
  }

  _remove(i) {
    const j = --this.count;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j];
    this.px[i] = this.px[j]; this.py[i] = this.py[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
    this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
    this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
    this.rot[i] = this.rot[j]; this.vrot[i] = this.vrot[j];
    this.r0[i] = this.r0[j]; this.g0[i] = this.g0[j]; this.b0[i] = this.b0[j];
    this.r1[i] = this.r1[j]; this.g1[i] = this.g1[j]; this.b1[i] = this.b1[j];
    this.alpha[i] = this.alpha[j]; this.add[i] = this.add[j];
    this.stretch[i] = this.stretch[j]; this.aspect[i] = this.aspect[j];
    this.frame[i] = this.frame[j]; this.fade[i] = this.fade[j];
  }

  clear() { this.count = 0; }

  render(batch, frames, alpha) {
    for (let i = 0; i < this.count; i++) {
      const t = 1 - this.life[i] / this.maxLife[i]; // 0 -> 1 over lifetime
      const x = this.px[i] + (this.x[i] - this.px[i]) * alpha;
      const y = this.py[i] + (this.y[i] - this.py[i]) * alpha;
      let a = this.alpha[i];
      const fm = this.fade[i];
      if (fm === FADE_OUT) a *= 1 - t * t;
      else if (fm === FADE_INOUT) a *= Math.sin(t * Math.PI);
      else a *= (1 - t) * (0.6 + 0.4 * ((i * 7 + (this.life[i] | 0)) % 3 === 0 ? 1 : 0.4));
      if (a <= 0.004) continue;
      const s = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      let w = s, h = s * this.aspect[i], rot = this.rot[i];
      const st = this.stretch[i];
      if (st > 0) {
        const vx = this.vx[i], vy = this.vy[i];
        const sp = Math.sqrt(vx * vx + vy * vy);
        w = s * (1 + sp * st);
        rot = Math.atan2(vy, vx);
      }
      batch.draw(frames[this.frame[i]], x, y, w, h, rot,
        this.r0[i] + (this.r1[i] - this.r0[i]) * t,
        this.g0[i] + (this.g1[i] - this.g0[i]) * t,
        this.b0[i] + (this.b1[i] - this.b0[i]) * t,
        a, this.add[i]);
    }
  }
}
