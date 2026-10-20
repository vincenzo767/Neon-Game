import { Painter } from './core.js';
import { makeCanvas } from './noise.js';

// Seamless square tiles for the material array. A TilePainter is a Painter
// over [0, S]² (1 px per unit) whose noise scales divide the tile, plus a
// `wrap` helper that draws a feature at every periodic offset so shapes that
// cross an edge reappear on the opposite side.

export const TILE = 256;

export class TilePainter extends Painter {
  constructor(size = TILE, env = {}) {
    const c = makeCanvas(size, size);
    super(c, { x0: 0, x1: size, y0: 0, y1: size }, 1, env);
    this.S = size;
  }

  /** Draw fn(dx, dy) at the 9 periodic offsets (features crossing the tile edge). */
  wrap(fn) {
    for (const dy of [-this.S, 0, this.S]) for (const dx of [-this.S, 0, this.S]) fn(dx, dy);
    return this;
  }

  /** Noise with a tile-divisible scale: k repeats of the pattern across the tile. */
  tn(name, k, op, alpha, o) { return this.noise(name, this.S / k, op, alpha, o); }

  /** Masked patch with a tile-divisible scale. */
  tp(mask, k, color, alpha, o) { return this.patch(mask, this.S / k, color, alpha, o); }
}
