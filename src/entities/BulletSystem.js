import { WORLD_W, WORLD_H } from '../core/constants.js';
import { BULLET_COLORS, COLOR_NAMES } from '../fx/sprites.js';

// High-volume projectile store (struct-of-arrays, dense, swap-remove).
// Used for enemy bullets (thousands) and player shots (hundreds).
//
// Motion model per bullet: heading angle + speed, with optional
// acceleration and angular velocity (curving). Velocity is recomputed only
// for bullets that actually curve/accelerate.

const MARGIN = 40;
const COLOR_RGB = COLOR_NAMES.map((n) => BULLET_COLORS[n]);

export class BulletSystem {
  constructor(capacity = 4096) {
    this.capacity = capacity;
    this.count = 0;
    const F = Float32Array;
    this.x = new F(capacity); this.y = new F(capacity);
    this.px = new F(capacity); this.py = new F(capacity);
    this.vx = new F(capacity); this.vy = new F(capacity);
    this.ang = new F(capacity); this.spd = new F(capacity);
    this.acc = new F(capacity); this.angVel = new F(capacity);
    this.minSpd = new F(capacity); this.maxSpd = new F(capacity);
    this.radius = new F(capacity);   // collision radius (smaller than visual)
    this.scale = new F(capacity);    // visual scale
    this.age = new F(capacity);
    this.damage = new F(capacity);
    this.frame = new Uint16Array(capacity);
    this.color = new Uint8Array(capacity);
    this.grazed = new Uint8Array(capacity);
    this.dyn = new Uint8Array(capacity); // 1 if accel/curve active
    // Player-shot behaviour fields.
    this.maxAge = new F(capacity);     // range limit in steps (0 = default)
    this.homing = new F(capacity);     // max turn rate (rad/step) toward a target
    this.aux = new F(capacity);        // kind-specific (e.g. flak burst radius)
    this.pierce = new Uint8Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.spawnedTotal = 0;
    /** Optional callback(i) when a bullet reaches maxAge (before removal). */
    this.onExpire = null;
  }

  /**
   * @returns index or -1 when full
   * @param frameId atlas frame id (see renderer.bulletFrames)
   * @param colorIdx index into COLOR_NAMES (used for glow tint / FX)
   */
  spawn(x, y, angle, speed, frameId, colorIdx = 0, radius = 3, scale = 1) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.x[i] = this.px[i] = x;
    this.y[i] = this.py[i] = y;
    this.ang[i] = angle;
    this.spd[i] = speed;
    this.vx[i] = Math.cos(angle) * speed;
    this.vy[i] = Math.sin(angle) * speed;
    this.acc[i] = 0; this.angVel[i] = 0;
    this.minSpd[i] = 0; this.maxSpd[i] = 99;
    this.radius[i] = radius;
    this.scale[i] = scale;
    this.age[i] = 0;
    this.damage[i] = 1;
    this.frame[i] = frameId;
    this.color[i] = colorIdx;
    this.grazed[i] = 0;
    this.dyn[i] = 0;
    this.maxAge[i] = 0;
    this.homing[i] = 0;
    this.aux[i] = 0;
    this.pierce[i] = 0;
    this.kind[i] = 0;
    this.spawnedTotal++;
    return i;
  }

  /** Give bullet i acceleration and/or curvature. */
  motion(i, accel = 0, angVel = 0, minSpd = 0, maxSpd = 99) {
    this.acc[i] = accel;
    this.angVel[i] = angVel;
    this.minSpd[i] = minSpd;
    this.maxSpd[i] = maxSpd;
    this.dyn[i] = accel !== 0 || angVel !== 0 ? 1 : 0;
  }

  /** Set player-shot behaviour for bullet i. */
  behave(i, damage = 1, maxAge = 0, pierce = 0, homing = 0, kind = 0, aux = 0) {
    this.damage[i] = damage;
    this.maxAge[i] = maxAge;
    this.pierce[i] = pierce;
    this.homing[i] = homing;
    this.kind[i] = kind;
    this.aux[i] = aux;
  }

  /** Re-aim bullet i (used by homing and reflection). */
  setHeading(i, angle, speed = this.spd[i]) {
    this.ang[i] = angle;
    this.spd[i] = speed;
    this.vx[i] = Math.cos(angle) * speed;
    this.vy[i] = Math.sin(angle) * speed;
  }

  update() {
    let i = 0;
    const maxX = WORLD_W + MARGIN, maxY = WORLD_H + MARGIN;
    while (i < this.count) {
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
      if (this.dyn[i]) {
        let s = this.spd[i] + this.acc[i];
        if (s < this.minSpd[i]) s = this.minSpd[i];
        else if (s > this.maxSpd[i]) s = this.maxSpd[i];
        this.spd[i] = s;
        const a = (this.ang[i] += this.angVel[i]);
        this.vx[i] = Math.cos(a) * s;
        this.vy[i] = Math.sin(a) * s;
      }
      const x = (this.x[i] += this.vx[i]);
      const y = (this.y[i] += this.vy[i]);
      const age = ++this.age[i];
      const ma = this.maxAge[i];
      if (ma > 0 && age >= ma) {
        if (this.onExpire) this.onExpire(i);
        this.remove(i);
        continue;
      }
      if (x < -MARGIN || x > maxX || y < -MARGIN || y > maxY || this.age[i] > 1800) {
        this.remove(i);
        continue;
      }
      i++;
    }
  }

  remove(i) {
    const j = --this.count;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j];
    this.px[i] = this.px[j]; this.py[i] = this.py[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.ang[i] = this.ang[j]; this.spd[i] = this.spd[j];
    this.acc[i] = this.acc[j]; this.angVel[i] = this.angVel[j];
    this.minSpd[i] = this.minSpd[j]; this.maxSpd[i] = this.maxSpd[j];
    this.radius[i] = this.radius[j]; this.scale[i] = this.scale[j];
    this.age[i] = this.age[j]; this.damage[i] = this.damage[j];
    this.frame[i] = this.frame[j]; this.color[i] = this.color[j];
    this.grazed[i] = this.grazed[j]; this.dyn[i] = this.dyn[j];
    this.maxAge[i] = this.maxAge[j]; this.homing[i] = this.homing[j];
    this.aux[i] = this.aux[j]; this.pierce[i] = this.pierce[j]; this.kind[i] = this.kind[j];
  }

  /** Remove every bullet, calling fn(x, y, colorRGB) for each (bomb cancel FX). */
  clearAll(fn) {
    if (fn) for (let i = 0; i < this.count; i++) fn(this.x[i], this.y[i], COLOR_RGB[this.color[i]]);
    this.count = 0;
  }

  /** Remove bullets within radius r of (cx, cy). */
  clearRadius(cx, cy, r, fn) {
    const r2 = r * r;
    let i = 0;
    while (i < this.count) {
      const dx = this.x[i] - cx, dy = this.y[i] - cy;
      if (dx * dx + dy * dy <= r2) {
        if (fn) fn(this.x[i], this.y[i], COLOR_RGB[this.color[i]]);
        this.remove(i);
      } else i++;
    }
  }

  /** Remove bullets within `width` of segment (x0,y0)-(x1,y1). */
  clearLine(x0, y0, x1, y1, width, fn) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    const w2 = width * width;
    let i = 0;
    while (i < this.count) {
      let t = ((this.x[i] - x0) * dx + (this.y[i] - y0) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + dx * t - this.x[i], ey = y0 + dy * t - this.y[i];
      if (ex * ex + ey * ey <= w2) {
        if (fn) fn(this.x[i], this.y[i], COLOR_RGB[this.color[i]]);
        this.remove(i);
      } else i++;
    }
  }

  /** Insert every bullet into a spatial grid (as points). */
  buildGrid(grid) {
    grid.clear();
    for (let i = 0; i < this.count; i++) grid.insertPoint(i, this.x[i], this.y[i]);
  }

  colorOf(i) { return COLOR_RGB[this.color[i]]; }

  /**
   * Draw: a soft additive glow under each bullet, then the outlined cores on
   * top, so overlapping bullets stay individually readable.
   */
  render(batch, frames, alpha, glowFrame, opts = {}) {
    const n = this.count;
    const glowA = opts.glowAlpha ?? 0.45;
    const glowScale = opts.glowScale ?? 2.4;
    const coreAlpha = opts.alpha ?? 1;
    const coreAdd = opts.add ?? 0;
    const tint = opts.tint || [1, 1, 1];
    if (glowA > 0) {
      for (let i = 0; i < n; i++) {
        const x = this.px[i] + (this.x[i] - this.px[i]) * alpha;
        const y = this.py[i] + (this.y[i] - this.py[i]) * alpha;
        const f = frames[this.frame[i]];
        const s = Math.max(f.w, f.h) * this.scale[i] * glowScale;
        const c = COLOR_RGB[this.color[i]];
        batch.draw(glowFrame, x, y, s, s, 0, c[0], c[1], c[2], glowA, 1);
      }
    }
    for (let i = 0; i < n; i++) {
      const x = this.px[i] + (this.x[i] - this.px[i]) * alpha;
      const y = this.py[i] + (this.y[i] - this.py[i]) * alpha;
      const f = frames[this.frame[i]];
      const sc = this.scale[i];
      batch.draw(f, x, y, f.w * sc, f.h * sc, this.ang[i], tint[0], tint[1], tint[2], coreAlpha, coreAdd);
    }
  }
}
