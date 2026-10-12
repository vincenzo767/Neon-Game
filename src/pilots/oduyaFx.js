import { crowdFactor } from './art/mechaFx.js';
import { oduyaArt } from './oduyaArt.js';

// Oduya's lightning, after fx-reference.png: thick jagged bolts, blue outside,
// white inside, with forks and bright nodes where they strike. Render-time
// only (the jitter re-rolls every step, so the bolts flicker like real
// lightning); damage lives in oduya.js.

const LOOK = oduyaArt.LOOK;
export const BLUE_EDGE = [0.2, 0.45, 2.3];
export const BLUE = [0.55, 1.05, 2.5];
export const WHITE = [2.4, 2.55, 2.7];

const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

/** One straight segment in three layers: blue glow, blue body, white core. */
function seg(b, F, ax, ay, bx, by, width, alpha, glowA) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay) + 2, a = Math.atan2(by - ay, bx - ax);
  b.draw(F.laser, mx, my, l, width * 3.6, a, BLUE_EDGE[0], BLUE_EDGE[1], BLUE_EDGE[2], 0.42 * alpha * glowA, 1);
  b.draw(F.laser, mx, my, l, width * 1.7, a, BLUE[0], BLUE[1], BLUE[2], 0.85 * alpha, 1);
  b.draw(F.laser, mx, my, l, width * 0.6, a, WHITE[0], WHITE[1], WHITE[2], alpha, 1);
}

/**
 * A jagged bolt from (x0, y0) to (x1, y1). `seed` picks the shape; `forks`
 * adds short side branches like the FX sheet.
 */
export function bolt(b, F, x0, y0, x1, y1, width, alpha, seed, forks = true, glowA = 1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, segs = Math.max(3, Math.min(14, Math.round(len / 22)));
  const amp = Math.min(20, len * 0.12);
  let px = x0, py = y0;
  for (let k = 1; k <= segs; k++) {
    const t = k / segs, j = k === segs ? 0 : (hash(seed * 12.9 + k * 78.2) - 0.5) * 2 * amp;
    const qx = x0 + dx * t + nx * j, qy = y0 + dy * t + ny * j;
    seg(b, F, px, py, qx, qy, width, alpha, glowA);
    if (forks && k < segs && hash(seed * 3.1 + k * 17.7) > 0.62) {
      const side = hash(seed + k) > 0.5 ? 1 : -1, fl = len * (0.12 + 0.1 * hash(seed * 7 + k));
      const fa = Math.atan2(dy, dx) + side * (0.5 + 0.5 * hash(seed * 5 + k));
      bolt(b, F, qx, qy, qx + Math.cos(fa) * fl, qy + Math.sin(fa) * fl, width * 0.45, alpha * 0.85, seed * 1.7 + k, false, glowA);
    }
    px = qx; py = qy;
  }
}

/** Bright strike node: blue bloom, white core. */
export function node(b, F, x, y, size, alpha) {
  b.draw(F.glow, x, y, size * 2.4, size * 2.4, 0, BLUE[0], BLUE[1], BLUE[2], 0.5 * alpha, 1);
  b.draw(F.core, x, y, size * 0.8, size * 0.8, 0, WHITE[0], WHITE[1], WHITE[2], alpha, 1);
}

/** Every live lightning effect (strands, arcs, coils, shock, bomb, ultimate). */
export function renderLightning(p, b) {
  const F = p.F, ps = p.ps, t = p.t, wm = LOOK.widthMul;
  const glowA = LOOK.glowMul * crowdFactor(p.w);
  // Main strands: fist → chain of targets, plus arcs to the enemies around each hit.
  for (const s of ps.bolts) {
    const a = 1 - s.t / s.life, W = s.w * wm;
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      bolt(b, F, ax, ay, bx, by, W * (k === 1 ? 1 : 0.85), a, s.s + k * 3.7 + t, true, glowA);
      node(b, F, bx, by, W * 3.2, a);
    }
    for (const [ax, ay, bx, by] of s.arcs) bolt(b, F, ax, ay, bx, by, W * 0.5, a * 0.95, s.s * 2.3 + ax + t, false, glowA);
    if (s.pts.length) node(b, F, s.pts[0][0], s.pts[0][1], W * 3.6, a);
  }
  // Special: crackle over every electrified enemy until it explodes.
  if (ps.shock) {
    for (const e of ps.shock.list) {
      if (!e.alive) continue;
      for (let k = 0; k < 3; k++) {
        const a0 = hash(t * 0.37 + k * 9.1 + e.uid) * Math.PI * 2, r = e.r + 14;
        bolt(b, F, e.x + Math.cos(a0) * r, e.y + Math.sin(a0) * r, e.x - Math.cos(a0 + 0.8) * r, e.y - Math.sin(a0 + 0.8) * r, 4 * wm, 1, t + k * 11 + e.uid, true, glowA);
      }
      b.draw(F.glow, e.x, e.y, e.r * 3.2, e.r * 3.2, 0, BLUE[0], BLUE[1], BLUE[2], 0.3 + 0.2 * ((t >> 1) & 1), 1);
    }
  }
  // Sky strikes: bomb, special detonations and the ultimate barrage.
  for (const s of ps.strikes) {
    const a = 1 - s.t / s.life;
    bolt(b, F, s.x0, s.y0, s.x1, s.y1, s.w * wm, a, s.s + t, true, glowA);
    node(b, F, s.x1, s.y1, s.w * 4, a);
  }
}
