import { FADE_OUT, FADE_INOUT } from '../fx/Particles.js';
import { crowdFactor } from './art/mechaFx.js';
import { brunoArt, PAL } from './brunoArt.js';

// Bruno's weapon effects, rebuilt in code from fx_reference.png: violet on the
// outside, orange on the inside, white-hot centre. All cosmetic (fxRng only):
// hit areas and burst damage live in bruno.js / World._flakBurst. The bright
// core of each shell is drawn as wide as its hit area.
//
// Shots are told apart by frame (shots.aux holds the flak burst radius):
// b_flak = flak shell, b_shell = siege shell, anything else = generic look.

const LOOK = brunoArt.LOOK;
const fxOf = () => brunoArt.frames().fx;
const ORANGE = [1.9, 0.75, 0.1];     // shell body, below the bloom's white clip
const WHITE = [1.8, 1.5, 1.1];       // white-hot centre
const BRASS = [1.3, 0.95, 0.4];

/** Draw every player shot (replaces the generic shot renderer). */
export function renderShots(p, b, alpha, S) {
  const fx = fxOf(), F = p.F, ps = p.ps;
  const flak = ps.fFlak && ps.fFlak.id, shell = ps.fShell && ps.fShell.id;
  const glowA = 0.42 * LOOK.glowMul * crowdFactor(p.w), wm = LOOK.widthMul;
  const grow = 1 + 0.08 * (p.tier - 1);
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), fr = S.frame[i];
    if (fr !== flak && fr !== shell) {
      // Untagged shots keep the generic look: their own frame, translucent, additive.
      const f = p.w.r.frames[fr], sc = S.scale[i];
      b.draw(f, x, y, f.w * sc, f.h * sc, ang, 1, 1, 1, 0.5, 1);
      continue;
    }
    const fade = Math.min(1, (S.age[i] + alpha) / 2), r = S.radius[i], core = 2 * r * wm;
    // Fuse: the shell flickers hotter in its last steps before the airburst.
    const left = S.maxAge[i] - S.age[i];
    const arm = left < 5 ? 1.25 + 0.25 * ((S.age[i] >> 1) & 1) : 1;
    if (fr === flak) {
      const L = 30 * wm * grow;
      // Violet tracer behind the shell (its bright head sits behind the core, so the orange stays orange).
      b.draw(fx.glow, x - dx * L * 0.48, y - dy * L * 0.48, L, core * 1.6 * grow, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * fade, 1);
      b.draw(F.ring, x, y, core * 1.9 * grow, core * 1.9 * grow, 0, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * 0.9 * fade, 1);
      b.draw(F.core, x, y, core * grow, core * grow, 0, ORANGE[0] * arm, ORANGE[1] * arm, ORANGE[2] * arm, 0.95 * fade, 1);
      b.draw(F.core, x, y, core * 0.45, core * 0.45, 0, WHITE[0], WHITE[1], WHITE[2], fade, 1);
    } else {
      // Siege shell: long violet trail, orange shell body with a diamond nose.
      const L = 64 * wm * grow, Lc = 24 * grow;
      b.draw(fx.glow, x - dx * L * 0.42, y - dy * L * 0.42, L, core * 2.2, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * fade, 1);
      b.draw(fx.glow, x - dx * L * 0.55, y - dy * L * 0.55, L * 1.15, core * 3, ang, PAL.edge[0], PAL.edge[1], PAL.edge[2], glowA * 0.4 * fade, 1);
      const off = Lc / 2 - r, cx = x - dx * off, cy = y - dy * off;
      b.draw(fx.lance, cx, cy, Lc, core / 0.76, ang, ORANGE[0] * arm, ORANGE[1] * arm, ORANGE[2] * arm, 0.9 * fade, 1);
      b.draw(fx.lance, cx + dx * 3, cy + dy * 3, Lc * 0.6, core * 0.22 / 0.76, ang, WHITE[0], WHITE[1], WHITE[2], 0.6 * fade, 1);
      // Rings running back along the trail.
      const age = S.age[i];
      for (let k = 0; k < 2; k++) {
        const o = (age * 7 + k * 20) % 40, f = 1 - o / 40;
        b.draw(F.ring, x - dx * (o + 8), y - dy * (o + 8), 5, core * 2.2, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.55 * f * fade, 1);
      }
    }
  }
}

/** Airburst (World flakBurst hook): violet star burst, orange core, a little dark smoke. */
export function flakBurst(w, x, y, r) {
  const fx = fxOf();
  if (!fx) return; // headless (no atlas)
  const H = w.fxHigh, Lo = w.fxLow, R = w.fxRng, F = w.F, big = r >= 30;
  let i = H.spawn(F.glow, x, y, 0, 0, 9);
  if (i >= 0) { H.size(i, r * 2.2, r * 3); H.color(i, PAL.mid[0] * 1.2, PAL.mid[1] * 1.2, PAL.mid[2] * 1.2, PAL.edge[0] * 0.6, PAL.edge[1] * 0.6, PAL.edge[2] * 0.6); H.look(i, 0.55, 1); }
  i = H.spawn(fx.flare, x, y, 0, 0, 6);
  if (i >= 0) { H.size(i, r * 1.9, r * 2.7); H.color(i, PAL.mid[0] * 1.4, PAL.mid[1] * 1.4, PAL.mid[2] * 1.4, PAL.edge[0], PAL.edge[1], PAL.edge[2]); H.spin(i, R.angle(), 0); H.look(i, 0.8, 1); }
  i = H.spawn(F.glow, x, y, 0, 0, 6);
  if (i >= 0) { H.size(i, r * 1.1, r * 0.5); H.color(i, PAL.hot[0] * 1.1, PAL.hot[1] * 1.1, PAL.hot[2], PAL.hot[0] * 0.6, PAL.hot[1] * 0.5, PAL.hot[2] * 0.3); H.look(i, 0.9, 1); }
  i = H.spawn(F.ring, x, y, 0, 0, big ? 14 : 10);
  if (i >= 0) { H.size(i, r * 0.4, r * 2.2); H.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); H.look(i, 0.6, 1); }
  for (let n = 0; n < (big ? 7 : 3); n++) {
    const a = R.angle(), sp = R.range(1.5, big ? 5 : 3.5);
    i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 16));
    if (i < 0) break;
    H.size(i, big ? 4 : 3); H.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); H.phys(i, 0.9); H.look(i, 1, 1, FADE_OUT, 0.4);
  }
  // Dark violet smoke (under the ships).
  for (let n = 0; n < (big ? 3 : 1); n++) {
    if (!big && R.chance(0.5)) break;
    i = Lo.spawn(F.smoke, x + R.range(-r, r) * 0.4, y + R.range(-r, r) * 0.4, R.range(-0.3, 0.3), R.range(-0.4, 0.1), R.range(28, 44));
    if (i < 0) break;
    Lo.size(i, r * 0.8, r * 1.9); Lo.color(i, 0.2, 0.1, 0.26, 0.06, 0.05, 0.09); Lo.spin(i, R.angle(), R.range(-0.02, 0.02)); Lo.look(i, 0.6, 0, FADE_INOUT);
  }
}

/**
 * Star-shaped muzzle flash (violet outside, orange inside) and, with
 * `side`, a brass casing ejected outward.
 */
export function muzzleFlash(p, w, x, y, size = 24, side = 0) {
  const fx = fxOf();
  if (!fx) return;
  const H = w.fxHigh, F = p.F, R = w.fxRng;
  let i = H.spawn(F.glow, x, y - 2, 0, -0.6, 4);
  if (i >= 0) { H.size(i, size * 1.4, size * 0.8); H.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0], PAL.edge[1], PAL.edge[2]); H.look(i, 0.6, 1, FADE_OUT); }
  i = H.spawn(fx.flare, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size * 1.2, size * 0.7); H.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); H.spin(i, R.range(-0.3, 0.3), 0); H.look(i, 0.85, 1, FADE_OUT); }
  i = H.spawn(F.core, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size * 0.4, size * 0.2); H.color(i, WHITE[0], WHITE[1], WHITE[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); H.look(i, 1, 1, FADE_OUT); }
  if (side) {
    i = H.spawn(fx.shard, x - side * 3, y + 6, side * R.range(1.5, 3), R.range(0.8, 2), R.range(16, 24));
    if (i >= 0) { H.size(i, 5, 4); H.color(i, BRASS[0], BRASS[1], BRASS[2], BRASS[0] * 0.4, BRASS[1] * 0.4, BRASS[2] * 0.4); H.phys(i, 0.93, 0.05); H.spin(i, R.angle(), R.range(-0.4, 0.4)); H.look(i, 1, 0, FADE_OUT); }
  }
}
