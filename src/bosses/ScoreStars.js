// Bullet → score conversion for boss phase breaks (UPDATE_01 §1.3 step 1).
// Every enemy bullet on screen is cancelled; a capped number of gold stars
// pop out of their positions and home onto the player, paying out the
// combined value of the bullets they stand for when they arrive.

const MAX_STARS = 320;
const VALUE_PER_BULLET = 20;

export class ScoreStars {
  constructor(world) {
    this.w = world;
    const r = world.r;
    this.F = { glow: r.frame('glow'), core: r.frame('core'), spark: r.frame('spark') };
    this.list = [];
    this.converted = 0; // bullets converted (debug / tests)
  }

  clear() { this.list.length = 0; }

  /** Cancel every enemy bullet into score stars. Returns the bullet count. */
  absorb() {
    const w = this.w, B = w.bullets, n = B.count;
    if (!n) return 0;
    const R = w.fxRng;
    const stars = Math.min(n, MAX_STARS - this.list.length);
    if (stars <= 0) w.score += VALUE_PER_BULLET * n;
    else {
      const step = n / stars, value = Math.round((VALUE_PER_BULLET * n) / stars);
      for (let s = 0; s < stars; s++) {
        const i = Math.floor(s * step), a = R.angle(), sp = R.range(0.5, 2.5);
        this.list.push({
          x: B.x[i], y: B.y[i], px: B.x[i], py: B.y[i],
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, t: 0, v: value, ph: R.range(0, 6.28),
        });
      }
    }
    B.clearAll();
    this.converted += n;
    return n;
  }

  update() {
    const L = this.list, w = this.w, p = w.player;
    const tx = p ? p.x : 240, ty = p ? p.y : 560;
    for (let i = L.length - 1; i >= 0; i--) {
      const s = L[i];
      s.px = s.x; s.py = s.y;
      s.t++;
      if (s.t < 20) { s.vx *= 0.9; s.vy *= 0.9; }
      else {
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(16, 3 + (s.t - 20) * 0.35);
        s.vx += (dx / d * sp - s.vx) * 0.25;
        s.vy += (dy / d * sp - s.vy) * 0.25;
        if (d < 16 || s.t > 170) {
          w.score += s.v;
          if ((i & 7) === 0) w.explosions.sparks(s.x, s.y, 2, [1, 0.85, 0.3], 2, 10, 3);
          L[i] = L[L.length - 1];
          L.pop();
          continue;
        }
      }
      s.x += s.vx; s.y += s.vy;
    }
  }

  render(b, alpha) {
    const F = this.F;
    for (const s of this.list) {
      const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
      const tw = 0.75 + 0.25 * Math.sin(s.t * 0.5 + s.ph);
      b.draw(F.glow, x, y, 18 * tw, 18 * tw, 0, 1.6, 1.1, 0.3, 0.6, 1);
      b.draw(F.core, x, y, 7, 7, 0, 2.2, 1.9, 1.1, 1, 1);
      b.draw(F.spark, x, y, 12 * tw, 3, s.t * 0.15, 2, 1.6, 0.6, 0.8, 1);
    }
  }
}
