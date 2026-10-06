import { WORLD_W as W, WORLD_H as H } from '../core/constants.js';
import * as P from '../patterns/index.js';

// Small helpers shared by the boss attack tables.

export const DOWN = Math.PI / 2;
export const TAU = Math.PI * 2;
export { W, H };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * True every `n` steps (phase-local t), sped up by phase intensity
 * (desperation) and Mk level (+15% rate per Mk).
 */
export function every(c, t, n, off = 0) {
  const k = Math.max(2, Math.round(n / (c.intensity * (1 + 0.15 * (c.mk - 1)))));
  return (t + off) % k === 0;
}

/** Bullet count scaled by difficulty density (as the pattern library does). */
export const dens = (w, n) => Math.max(1, Math.round(n * w.diff.density));

/** Ring of ghost bullets (fade in and out). */
export function ghostRing(c, w, x, y, s, base = 0) {
  const n = dens(w, s.n);
  for (let k = 0; k < n; k++) c.kit.ghost(P.shoot(w, x, y, base + (k / n) * TAU, s.speed, s));
}

/** Artillery: mark a floor zone, then detonate it (optionally bursting a ring). */
export function artillery(c, x, y, r = 44, warn = 70, burst = null) {
  return c.kit.hazard({
    type: 'circle', x: clamp(x, 30, W - 30), y: clamp(y, 60, H - 30), r, warn, fire: 8, color: [1, 0.45, 0.1],
    onFire: (h, w) => {
      if (burst) P.ring(w, h.x, h.y, burst, w.rng.angle());
      w.g.camera.addTrauma(0.15);
    },
  });
}

/** A tendril reaching from a random screen edge through the player's position. */
export function tendril(c, w, warn = 50, fire = 40, width = 16) {
  const R = w.rng, side = R.int(0, 2); // left, right, bottom
  const x0 = side === 0 ? -20 : side === 1 ? W + 20 : R.range(40, W - 40);
  const y0 = side === 2 ? H + 20 : R.range(120, H - 60);
  const tx = w.aimX, ty = w.aimY, a = Math.atan2(ty - y0, tx - x0);
  return c.kit.hazard({ type: 'tendril', x0, y0, x1: tx + Math.cos(a) * 140, y1: ty + Math.sin(a) * 140, warn, fire, width, color: [0.8, 0.2, 1] });
}
