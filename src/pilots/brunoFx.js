import { FADE_OUT, FADE_FLICKER } from '../fx/Particles.js';
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
      // Flak round: orange slug with a white-hot centre and a short violet flame tail.
      const L = 26 * wm * grow;
      b.draw(fx.glow, x - dx * L * 0.48, y - dy * L * 0.48, L, core * 1.2 * grow, ang, PAL.mid[0], PAL.mid[1], PAL.mid[2], glowA * fade, 1);
      b.draw(fx.shard, x - dx * 2, y - dy * 2, core * 1.5 * grow, core * 0.9 * grow, ang, ORANGE[0] * arm, ORANGE[1] * arm, ORANGE[2] * arm, 0.95 * fade, 1);
      b.draw(F.core, x, y, core * 0.5, core * 0.5, 0, WHITE[0], WHITE[1], WHITE[2], fade, 1);
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

// ------------------------------------------------- explosion textures

/** Lumpy cloud: overlapping puffs, bright in the middle, darker toward the rim (tinted per draw). */
function billowTex(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R0 = w * 0.2;
  const lobes = [[0, 0, 1.15], [-0.95, -0.35, 0.85], [0.9, -0.5, 0.9], [-0.55, 0.85, 0.8], [0.7, 0.8, 0.85], [0.05, -1.05, 0.8], [-1.05, 0.4, 0.7], [1.1, 0.25, 0.7]];
  for (const [ox, oy, s] of lobes) {
    const x = cx + ox * R0, y = cy + oy * R0, r = R0 * s;
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(190,190,190,1)'); g.addColorStop(0.9, 'rgba(90,90,90,1)'); g.addColorStop(1, 'rgba(60,60,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/** Jagged debris chip (tinted per draw). */
function chipTex(ctx, w, h) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.5); ctx.lineTo(w * 0.45, h * 0.05); ctx.lineTo(w * 0.95, h * 0.35); ctx.lineTo(w * 0.6, h * 0.95); ctx.closePath(); ctx.fill();
}

/** Atlas builder (part of Bruno's `sprites`). */
export function buildSprites(atlas) {
  atlas.add('b_billow', 40, 40, billowTex, { scale: 1.5 });
  atlas.add('b_chip', 8, 8, chipTex, { scale: 1 });
}

/**
 * Airburst (World flakBurst hook), after fx_reference.png: a billowing dark
 * purple smoke cloud lit violet from inside, a white-yellow-orange fireball
 * at the centre, violet spikes, dark debris chips and orange embers.
 * Drawn in spawn order: smoke first, fire on top.
 */
export function flakBurst(w, x, y, r) {
  const fx = fxOf();
  if (!fx) return; // headless (no atlas)
  const H = w.fxHigh, R = w.fxRng, F = w.F, big = r >= 30, s = r / 20;
  const billow = w.r.frame('b_billow'), chip = w.r.frame('b_chip');
  // 1. Smoke cloud (alpha-blended, billows outward and drifts).
  for (let n = 0, N = big ? 6 : 4; n < N; n++) {
    const a = (n / N) * Math.PI * 2 + R.range(-0.4, 0.4), d = r * R.range(0.15, 0.45), sp = R.range(0.25, 0.6) * s;
    const i = H.spawn(billow, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp - 0.15, R.range(28, 42) * (big ? 1.2 : 1));
    if (i < 0) break;
    H.size(i, r * R.range(0.75, 0.95), r * R.range(1.4, 1.8));
    H.color(i, 0.2, 0.08, 0.27, 0.05, 0.03, 0.07);
    H.phys(i, 0.94, -0.008); H.spin(i, R.angle(), R.range(-0.02, 0.02)); H.look(i, 0.88, 0, FADE_OUT);
  }
  // 2. Fire billows: the cloud lit from inside (orange core cooling to violet rims).
  for (let n = 0, N = big ? 4 : 3; n < N; n++) {
    const a = R.angle(), d = r * R.range(0, 0.3);
    const i = H.spawn(billow, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * 0.3 * s, Math.sin(a) * 0.3 * s, R.range(15, 22));
    if (i < 0) break;
    H.size(i, r * 0.6, r * 1.05);
    H.color(i, 2.3, 1.05, 0.18, 1.1, 0.12, 0.75);
    H.spin(i, R.angle(), 0); H.look(i, 0.6, 1, FADE_OUT);
  }
  // 3. Hot core: white → yellow → orange flash, violet bloom around it.
  let i = H.spawn(F.glow, x, y, 0, 0, 14);
  if (i >= 0) { H.size(i, r * 2.4, r * 2.8); H.color(i, PAL.mid[0], PAL.mid[1], PAL.mid[2], PAL.edge[0] * 0.5, PAL.edge[1] * 0.5, PAL.edge[2] * 0.5); H.look(i, 0.4, 1); }
  i = H.spawn(F.glow, x, y, 0, 0, 13);
  if (i >= 0) { H.size(i, r * 1.6, r * 1.0); H.color(i, 2.6, 2.2, 1.3, 1.8, 0.6, 0.1); H.look(i, 1, 1); }
  i = H.spawn(F.core, x, y, 0, 0, 4);
  if (i >= 0) { H.size(i, r * 0.6, r * 0.3); H.color(i, 2.8, 2.6, 2.2); H.look(i, 1, 1); }
  // 4. Violet spikes shooting out.
  for (let n = 0; n < (big ? 7 : 4); n++) {
    const a = R.angle(), sp = R.range(4, 7) * Math.sqrt(s);
    i = H.spawn(F.spark, x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(6, 10));
    if (i < 0) break;
    H.size(i, big ? 5 : 4); H.color(i, 1.8, 0.8, 2.4, PAL.edge[0], PAL.edge[1], PAL.edge[2]); H.phys(i, 0.85); H.look(i, 1, 1, FADE_OUT, 0.9);
  }
  // 5. Dark debris chips (alpha-blended, tumbling).
  for (let n = 0; n < (big ? 5 : 3); n++) {
    const a = R.angle(), sp = R.range(2, 4.5) * Math.sqrt(s);
    i = H.spawn(chip, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(18, 28));
    if (i < 0) break;
    H.size(i, R.range(3, 5.5) * Math.sqrt(s)); H.color(i, 0.32, 0.2, 0.42, 0.12, 0.08, 0.16);
    H.phys(i, 0.93, 0.03); H.spin(i, R.angle(), R.range(-0.4, 0.4)); H.look(i, 1, 0, FADE_OUT);
  }
  // 6. Orange embers.
  for (let n = 0; n < (big ? 5 : 3); n++) {
    const a = R.angle(), sp = R.range(1.5, 4) * Math.sqrt(s);
    i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(14, 24));
    if (i < 0) break;
    H.size(i, 3); H.color(i, 2.5, 1.6, 0.6, 1.4, 0.35, 0.05); H.phys(i, 0.93, 0.02); H.look(i, 1, 1, FADE_FLICKER, 0.4);
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
