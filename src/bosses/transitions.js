import { WORLD_W as W, WORLD_H as H } from '../core/constants.js';

// Themed arena crossfades. Each effect draws over the arena layers (under
// enemies, bullets and the player) and must fully cover the screen at the
// midpoint, where the Arena swaps background mode and parallax set.
//
//   draw(b, F, k, tr, time)   k = 0..1 progress, tr = transition state
//   init(tr, R)               optional: precompute random layout (fx RNG)
//
// Names used by boss data (UPDATE_01 §1.3): flash, fade, screen_tear,
// water_flood, warp_tunnel, darkness_swallow, armor_break. Unknown names
// fall back to `flash`.

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** Coverage: rises to 1 shortly before the midpoint, holds, then falls. */
export const cover = (k, edge = 0.38) => smooth(Math.min(k, 1 - k) / edge);

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function rect(b, F, x0, y0, x1, y1, c, a, add = 0) {
  if (x1 <= x0 || y1 <= y0 || a <= 0) return;
  b.draw(F.white, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, c[0], c[1], c[2], a, add);
}

export const TRANSITIONS = {
  /** Bright palette flash. */
  flash: {
    draw(b, F, k, tr) {
      const c = cover(k), col = mix3(tr.from.bg.neonA, tr.to.bg.neonA, k > 0.5 ? 1 : 0);
      rect(b, F, -10, -10, W + 10, H + 10, mix3(col, [1, 1, 1], 0.6), c);
      b.draw(F.glow, W / 2, H / 2, W * 2.2 * c, H * 2 * c, 0, col[0] * 2, col[1] * 2, col[2] * 2, c * 0.8, 1);
    },
  },

  /** Dip to black (arena hand-back). */
  fade: {
    draw(b, F, k) { rect(b, F, -10, -10, W + 10, H + 10, [0, 0, 0], cover(k, 0.45)); },
  },

  /** Horizontal bands tear across from alternating sides, glitching neon edges. */
  screen_tear: {
    init(tr, R) {
      tr.bands = Array.from({ length: 18 }, (_, i) => ({ side: i % 2 ? 1 : -1, d: R.range(0, 0.35), j: R.range(-1, 1) }));
    },
    draw(b, F, k, tr, time) {
      const c = cover(k, 0.42), n = tr.bands.length, bh = H / n;
      const col = k < 0.5 ? tr.from.bg.neonB : tr.to.bg.neonB;
      for (let i = 0; i < n; i++) {
        const band = tr.bands[i];
        const f = smooth((c * 1.35 - band.d) / 0.65);
        if (f <= 0) continue;
        const wpx = (W + 40) * f, y0 = i * bh, y1 = y0 + bh + 1;
        const jit = Math.sin(time * 40 + i * 7.1) * 6 * (1 - f) * band.j;
        const x0 = band.side < 0 ? -20 + jit : W + 20 - wpx + jit;
        rect(b, F, x0, y0, x0 + wpx, y1, [0.02, 0.01, 0.04], 1);
        // Neon tear edge + scanline.
        const ex = band.side < 0 ? x0 + wpx : x0;
        b.draw(F.laser, ex, (y0 + y1) / 2, bh * 1.4, 8, Math.PI / 2, col[0] * 2, col[1] * 2, col[2] * 2, f < 1 ? 0.9 : 0, 1);
        b.draw(F.laser, x0 + wpx / 2, y0 + 1, wpx, 2, 0, col[0], col[1], col[2], 0.35 * f, 1);
      }
    },
  },

  /** Water rises from the bottom, swallows the screen, then drains. */
  water_flood: {
    init(tr, R) {
      tr.bubbles = Array.from({ length: 50 }, () => ({ x: R.range(0, W), o: R.range(0, 1), s: R.range(3, 9) }));
    },
    draw(b, F, k, tr, time) {
      const c = cover(k, 0.42);
      const level = H + 30 - (H + 70) * c;
      const deep = [0.0, 0.07, 0.11], mid = [0.02, 0.22, 0.3];
      rect(b, F, -10, level + 12, W + 10, H + 20, deep, 0.97);
      rect(b, F, -10, level, W + 10, level + 14, mid, 0.9);
      // Wavy surface: glow beads riding two sine waves.
      for (let x = -10; x <= W + 10; x += 12) {
        const y = level + Math.sin(x * 0.04 + time * 4) * 6 + Math.sin(x * 0.09 - time * 2.6) * 3;
        b.draw(F.glow, x, y, 30, 16, 0, 0.5, 1.2, 1.4, 0.55, 1);
        b.draw(F.white, x, y + 6, 13, 10, 0, mid[0], mid[1], mid[2], 0.9, 0);
      }
      for (const bb of tr.bubbles) {
        const y = H - ((bb.o + k * 2.2) % 1) * (H - level);
        if (y < level) continue;
        b.draw(F.ring, bb.x + Math.sin(time * 3 + bb.o * 9) * 4, y, bb.s, bb.s, 0, 0.6, 1, 1.2, 0.5, 1);
      }
    },
  },

  /** Hyperspace: radial streaks accelerate out of the centre into a white-out. */
  warp_tunnel: {
    init(tr, R) {
      tr.rays = Array.from({ length: 90 }, () => ({ a: R.angle(), o: R.range(0, 1), w: R.range(1.5, 4) }));
    },
    draw(b, F, k, tr) {
      const c = cover(k, 0.4), cx = W / 2, cy = H * 0.42;
      const col = k < 0.5 ? tr.to.bg.neonA : tr.from.bg.neonA;
      const speed = 0.4 + c * 2.5;
      for (const r of tr.rays) {
        const d = ((r.o + k * speed * 3) % 1) * 520;
        const len = 30 + c * 260 * (d / 520);
        const x = cx + Math.cos(r.a) * (d + len / 2), y = cy + Math.sin(r.a) * (d + len / 2);
        b.draw(F.laser, x, y, len, r.w * (0.5 + c), r.a, col[0] * 1.8, col[1] * 1.8, col[2] * 1.8, 0.25 + c * 0.6, 1);
      }
      b.draw(F.glow, cx, cy, 120 + c * 900, 120 + c * 900, 0, 2, 2, 2.2, c, 1);
      rect(b, F, -10, -10, W + 10, H + 10, mix3(col, [1, 1, 1], 0.75), smooth((c - 0.55) / 0.45));
    },
  },

  /** Darkness creeps in from every edge with grasping blots until all is black. */
  darkness_swallow: {
    init(tr, R) {
      tr.blots = Array.from({ length: 40 }, (_, i) => {
        const side = i % 4;
        return { side, p: R.range(0, 1), s: R.range(60, 130), o: R.range(0, 6.28) };
      });
    },
    draw(b, F, k, tr, time) {
      const c = cover(k, 0.44), black = [0, 0, 0];
      const dx = (W / 2 + 20) * c, dy = (H / 2 + 20) * c;
      rect(b, F, -10, -10, W + 10, dy, black, 1);
      rect(b, F, -10, H - dy, W + 10, H + 10, black, 1);
      rect(b, F, -10, dy, dx, H - dy, black, 1);
      rect(b, F, W - dx, dy, W + 10, H - dy, black, 1);
      // Soft grasping edge: black blots ride the closing frame.
      for (const bl of tr.blots) {
        const wob = Math.sin(time * 2 + bl.o) * 12;
        let x, y;
        switch (bl.side) {
          case 0: x = bl.p * W; y = dy + wob; break;
          case 1: x = bl.p * W; y = H - dy - wob; break;
          case 2: x = dx + wob; y = bl.p * H; break;
          default: x = W - dx - wob; y = bl.p * H;
        }
        b.draw(F.glow, x, y, bl.s, bl.s, 0, 0, 0, 0, Math.min(1, c * 3), 0);
      }
      // Faint violet rim so the edge reads as alive.
      b.draw(F.ring, W / 2, H / 2, (W - dx * 2) * 1.5 + 40, (H - dy * 2) * 1.3 + 40, 0, 0.5, 0.1, 0.8, 0.25 * c * (1 - c), 1);
    },
  },

  /** Armour plates shatter outward over a flash. */
  armor_break: {
    init(tr, R) {
      tr.plates = Array.from({ length: 36 }, () => ({ a: R.angle(), v: R.range(2, 9), s: R.range(14, 40), r: R.angle(), sp: R.range(-0.3, 0.3) }));
    },
    draw(b, F, k, tr, time) {
      TRANSITIONS.flash.draw(b, F, k, tr, time);
      const cx = W / 2, cy = H * 0.3, t = k * 90;
      for (const p of tr.plates) {
        const d = p.v * t;
        b.draw(F.shard, cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d + 0.04 * t * t, p.s, p.s, p.r + p.sp * t, 0.7, 0.7, 0.8, 1 - k, 0);
      }
    },
  },
};

export const transitionFor = (name) => TRANSITIONS[name] || TRANSITIONS.flash;
