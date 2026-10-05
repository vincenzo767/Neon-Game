import { FADE_OUT, FADE_INOUT, FADE_FLICKER } from './Particles.js';

// Layered explosion composer + small FX timeline.
//
// A blast is built from five layers so it reads as "weighty":
//   1. flash      – a single huge additive bloom, a few frames long
//   2. fireball   – hot glow puffs cooling from white-yellow to deep red
//   3. debris     – alpha-blended metal shards with gravity and spin
//   4. smoke      – dark puffs that fade in, rise and expand
//   5. embers     – long-lived velocity-stretched sparks
// plus a shock ring sprite and post-FX (refraction wave, aberration, shake).
//
// `low` particles (smoke/debris) are drawn under ships; `high` (fire/sparks)
// over them.

export class Explosions {
  constructor(game, low, high) {
    this.game = game;
    this.low = low;
    this.high = high;
    this.rng = game.fxRng;
    const r = game.renderer;
    this.f = {
      glow: r.frame('glow'), core: r.frame('core'), spark: r.frame('spark'),
      ring: r.frame('ring'), smoke: r.frame('smoke'),
      shards: [0, 1, 2, 3].map((i) => r.frame(`shard${i}`)),
    };
    this.timers = [];
  }

  /** Run fn after `delay` simulation steps. */
  schedule(delay, fn) { this.timers.push({ t: delay, fn }); }

  update() {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if (--tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }
  }

  clear() { this.timers.length = 0; }

  /**
   * Layered blast.
   * @param s scale: 0.5 small drone .. 1 medium .. 3 boss chunk
   * @param tint optional [r,g,b] accent for the fireball (biome / enemy colour)
   */
  blast(x, y, s = 1, tint = null) {
    const R = this.rng, H = this.high, L = this.low, f = this.f;
    const tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 0.35, tb = tint ? tint[2] : 0.08;

    // 1. Flash.
    let i = H.spawn(f.glow, x, y, 0, 0, 7);
    if (i >= 0) { H.size(i, 90 * s, 150 * s); H.color(i, 2.2, 2.0, 1.7); H.look(i, 1, 1); }
    i = H.spawn(f.core, x, y, 0, 0, 5);
    if (i >= 0) { H.size(i, 40 * s, 60 * s); H.color(i, 3, 3, 3); H.look(i, 1, 1); }

    // Shock ring.
    i = H.spawn(f.ring, x, y, 0, 0, 16 + 4 * s);
    if (i >= 0) { H.size(i, 20 * s, 150 * s); H.color(i, 1.6, 1.2, 0.8, tr, tg, tb); H.look(i, 0.9, 1); }

    // 2. Fireball.
    const nFire = Math.round(10 + 10 * s);
    for (let k = 0; k < nFire; k++) {
      const a = R.angle(), sp = R.range(0.3, 2.6) * Math.sqrt(s);
      i = H.spawn(f.glow, x + R.range(-6, 6) * s, y + R.range(-6, 6) * s, Math.cos(a) * sp, Math.sin(a) * sp, R.range(16, 34) * (0.8 + s * 0.2));
      if (i < 0) break;
      H.size(i, R.range(26, 44) * s, R.range(6, 14) * s);
      H.color(i, 2.0, 1.7, 1.0, tr * 1.4, tg, tb);
      H.phys(i, 0.92, -0.02);
      H.look(i, 0.9, 1);
    }

    // 3. Debris shards.
    const nDeb = Math.round(5 + 6 * s);
    for (let k = 0; k < nDeb; k++) {
      const a = R.angle(), sp = R.range(1.5, 5.5) * Math.sqrt(s);
      i = L.spawn(R.pick(f.shards), x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1, R.range(40, 75));
      if (i < 0) break;
      L.size(i, R.range(6, 13) * Math.sqrt(s));
      L.color(i, 1.3, 1.1, 1.0, 0.5, 0.5, 0.55);
      L.phys(i, 0.975, 0.09);
      L.spin(i, R.angle(), R.range(-0.35, 0.35));
      L.look(i, 1, 0, FADE_OUT);
    }

    // 4. Smoke.
    const nSmoke = Math.round(4 + 5 * s);
    for (let k = 0; k < nSmoke; k++) {
      const a = R.angle(), sp = R.range(0.2, 1.2) * Math.sqrt(s);
      i = L.spawn(f.smoke, x + R.range(-8, 8) * s, y + R.range(-8, 8) * s, Math.cos(a) * sp, Math.sin(a) * sp, R.range(55, 95));
      if (i < 0) break;
      L.size(i, R.range(18, 30) * s, R.range(50, 80) * s);
      L.color(i, 0.16, 0.12, 0.16, 0.07, 0.07, 0.09);
      L.phys(i, 0.96, -0.012);
      L.spin(i, R.angle(), R.range(-0.02, 0.02));
      L.look(i, 0.75, 0, FADE_INOUT);
    }

    // 5. Embers.
    const nEmb = Math.round(10 + 14 * s);
    for (let k = 0; k < nEmb; k++) {
      const a = R.angle(), sp = R.range(1.5, 8) * Math.sqrt(s);
      i = H.spawn(f.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(25, 70));
      if (i < 0) break;
      H.size(i, R.range(3, 6));
      H.color(i, 2.5, 2.0, 1.2, 1.4, 0.3, 0.05);
      H.phys(i, 0.955, 0.035);
      H.look(i, 1, 1, FADE_FLICKER, 0.45);
    }

    // Post-FX + camera.
    const g = this.game;
    g.renderer.post.shockwave(x, y, 0.012 * s, 0.012 + 0.004 * s, 0.12 + 0.1 * s);
    g.renderer.post.aberrate(0.002 * s);
    g.renderer.post.heat(0.25 * s);
    g.camera.addTrauma(0.12 * s);
    if (s >= 1.8) g.hitStop(Math.round(2 + s));
  }

  /** Quick spark spray (bullet hits, graze, bullet cancel). */
  sparks(x, y, n, rgb, speed = 3, life = 18, size = 4) {
    const R = this.rng, H = this.high, f = this.f;
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(0.3, 1) * speed;
      const i = H.spawn(f.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(life * 0.6, life));
      if (i < 0) return;
      H.size(i, size);
      H.color(i, rgb[0] * 2, rgb[1] * 2, rgb[2] * 2, rgb[0], rgb[1], rgb[2]);
      H.phys(i, 0.9, 0);
      H.look(i, 1, 1, FADE_OUT, 0.5);
    }
  }

  /** Directional hit spark (player shot hitting an armoured target). */
  hitSpark(x, y, angle, rgb) {
    const R = this.rng, H = this.high, f = this.f;
    let i = H.spawn(f.glow, x, y, 0, 0, 4);
    if (i >= 0) { H.size(i, 18, 10); H.color(i, rgb[0] * 2, rgb[1] * 2, rgb[2] * 2); }
    for (let k = 0; k < 2; k++) {
      const a = angle + R.range(-0.7, 0.7), sp = R.range(2, 5);
      i = H.spawn(f.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(6, 12));
      if (i < 0) return;
      H.size(i, 3);
      H.color(i, 2, 2, 2, rgb[0], rgb[1], rgb[2]);
      H.phys(i, 0.85);
      H.look(i, 1, 1, FADE_OUT, 0.4);
    }
  }

  /**
   * Large enemy break-apart: a sequence of staggered blasts over the hull,
   * ending with a big final detonation. Used by bosses and heavy units.
   */
  breakApart(x, y, radius = 40, chunks = 6, onDone = null) {
    for (let k = 0; k < chunks; k++) {
      this.schedule(k * 7, () => {
        const a = this.rng.angle(), d = this.rng.range(0.2, 1) * radius;
        this.blast(x + Math.cos(a) * d, y + Math.sin(a) * d, this.rng.range(0.6, 1.1));
      });
    }
    this.schedule(chunks * 7 + 10, () => {
      this.blast(x, y, 2.6);
      this.game.renderer.post.flash(1, 0.9, 0.8, 0.55, 0.04);
      this.game.renderer.post.shockwave(x, y, 0.05, 0.02, 0.7);
      if (onDone) onDone();
    });
  }
}
