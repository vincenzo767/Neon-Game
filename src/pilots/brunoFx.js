import { FADE_OUT, FADE_FLICKER, FADE_INOUT } from '../fx/Particles.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';
import { crowdFactor } from './art/mechaFx.js';
import { brunoArt, PAL, RIG_FX } from './brunoArt.js';
import { RIG, focusLevel } from './brunoRig.js';
import { BRUNO, ampNow, shieldR } from './brunoTuning.js';

// Bruno's FX, rebuilt in code from fx_reference.png: violet on the outside,
// orange inside, white-hot centre for his shells and airbursts; purple-white
// for the shoulder barrage, the shield, the bomb and the nuke. All cosmetic
// (fxRng only): hit areas and damage live in bruno.js / brunoTuning.js /
// World._flakBurst, and every effect is drawn at its gameplay origin (posed
// rig anchors, shot positions, blast centres). The bright core of each shell
// is drawn as wide as its hit area.
//
// Shots are told apart by frame (shots.aux holds the flak burst radius):
// b_flak = flak shell, b_shell = heavy shell, anything else = generic look.

const LOOK = brunoArt.LOOK;
const fxOf = () => brunoArt.frames().fx;
const ORANGE = [1.9, 0.75, 0.1];     // shell body, below the bloom's white clip
const WHITE = [1.8, 1.5, 1.1];       // white-hot centre
const BRASS = [1.3, 0.95, 0.4];
const V = PAL.mid, E = PAL.edge;
const MAG = [1.9, 0.35, 1.5];        // magenta (cannon mouths, gauge)
const PW = [2.2, 1.9, 2.6];          // purple-white (barrage, shield, blasts)
const TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
/** F.ring's bright band peaks at 86 % of its half-size: this size puts the peak exactly on radius r. */
const ringSize = (r) => (2 * r) / 0.86;

/** Per-tier VFX intensity (brunoRig RIG.fx): flash, channel, aura. */
export const tierFx = (key, p) => RIG.fx[key][Math.max(0, Math.min(3, p.tier - 1))];

/** A thin glowing line (soft violet glow, coloured core) from (x0, y0) to (x1, y1). */
function line(b, F, x0, y0, x1, y1, wd, a, col = MAG) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 0.5) return;
  const ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  b.draw(F.laser, mx, my, L, wd * 3, ang, V[0], V[1], V[2], 0.4 * a, 1);
  b.draw(F.laser, mx, my, L, wd, ang, col[0], col[1], col[2], a, 1);
}

/** A jagged electrical arc between two points (re-rolled every 2 steps). */
function arc(b, F, x0, y0, x1, y1, seed, a, wd = 1.2) {
  const n = 6, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let px = x0, py = y0;
  for (let k = 1; k <= n; k++) {
    const f = k / n, j = k < n ? (hash(seed + k * 3.7) - 0.5) * Math.min(12, L * 0.3) : 0;
    const qx = x0 + dx * f + nx * j, qy = y0 + dy * f + ny * j;
    line(b, F, px, py, qx, qy, wd, a, PW);
    px = qx; py = qy;
  }
}

// ------------------------------------------------------------ shots

/** Draw every player shot (replaces the generic shot renderer). */
export function renderShots(p, b, alpha, S) {
  const fx = fxOf(), F = p.F, ps = p.ps;
  const flak = ps.fFlak && ps.fFlak.id, shell = ps.fShell && ps.fShell.id;
  const glowA = 0.42 * LOOK.glowMul * crowdFactor(p.w), wm = LOOK.widthMul;
  const grow = 1 + 0.08 * (p.tier - 1), amp = ampNow(p);
  // Shield bonus: shells burn hotter and more violet while it lasts.
  const hotK = 1 + 0.35 * amp, vio = 1 + 0.6 * amp;
  for (let i = 0; i < S.count; i++) {
    const x = S.px[i] + (S.x[i] - S.px[i]) * alpha, y = S.py[i] + (S.y[i] - S.py[i]) * alpha;
    const ang = S.ang[i], dx = Math.cos(ang), dy = Math.sin(ang), fr = S.frame[i];
    if (fr !== flak && fr !== shell) {
      // Untagged shots keep the generic look: their own frame, translucent, additive.
      const f = p.w.r.frames[fr], sc = S.scale[i];
      b.draw(f, x, y, f.w * sc, f.h * sc, ang, 1, 1, 1, 0.5, 1);
      continue;
    }
    const age = S.age[i], fade = Math.min(1, (age + alpha) / 2), r = S.radius[i], core = 2 * r * wm;
    // Fused shells (none in v2: they fly until they hit) flicker hotter just before bursting.
    const left = S.maxAge[i] - age;
    const arm = (S.maxAge[i] > 0 && left < 5 ? 1.25 + 0.25 * ((age >> 1) & 1) : 1) * hotK;
    const flick = 0.85 + 0.15 * Math.sin(age * 1.3 + i); // the trail breathes
    if (fr === flak) {
      // Flak round: orange slug with a white-hot centre and a violet flame tail that flickers as it flies.
      const L = 26 * wm * grow * flick;
      b.draw(fx.glow, x - dx * L * 0.48, y - dy * L * 0.48, L, core * 1.2 * grow, ang, V[0] * vio, V[1], V[2] * vio, glowA * fade, 1);
      b.draw(fx.glow, x - dx * L * 0.9, y - dy * L * 0.9, L * 0.9, core * 0.8 * grow, ang, E[0], E[1], E[2], glowA * 0.5 * fade, 1);
      b.draw(fx.shard, x - dx * 2, y - dy * 2, core * 1.5 * grow, core * 0.9 * grow, ang, ORANGE[0] * arm, ORANGE[1] * arm, ORANGE[2] * arm, 0.95 * fade, 1);
      b.draw(F.core, x, y, core * 0.5, core * 0.5, 0, WHITE[0], WHITE[1], WHITE[2], fade, 1);
    } else {
      // Heavy shell: long violet trail, orange shell body with a diamond nose, rings running back.
      const L = 64 * wm * grow * flick, Lc = 24 * grow;
      b.draw(fx.glow, x - dx * L * 0.42, y - dy * L * 0.42, L, core * 2.2, ang, V[0] * vio, V[1], V[2] * vio, glowA * fade, 1);
      b.draw(fx.glow, x - dx * L * 0.55, y - dy * L * 0.55, L * 1.15, core * 3, ang, E[0], E[1], E[2], glowA * 0.4 * fade, 1);
      const off = Lc / 2 - r, cx = x - dx * off, cy = y - dy * off;
      b.draw(fx.lance, cx, cy, Lc, core / 0.76, ang, ORANGE[0] * arm, ORANGE[1] * arm, ORANGE[2] * arm, 0.9 * fade, 1);
      b.draw(fx.lance, cx + dx * 3, cy + dy * 3, Lc * 0.6, core * 0.22 / 0.76, ang, WHITE[0], WHITE[1], WHITE[2], 0.6 * fade, 1);
      for (let k = 0; k < 2; k++) {
        const o = (age * 7 + k * 20) % 40, f = 1 - o / 40;
        b.draw(F.ring, x - dx * (o + 8), y - dy * (o + 8), 5, core * 2.2, ang, V[0], V[1], V[2], 0.55 * f * fade, 1);
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
 * at the centre, a violet shockwave ring as wide as the burst's damage
 * radius, violet spikes, dark debris chips and orange embers. Drawn in spawn
 * order: smoke first, fire on top. Hotter with the tier and the shield bonus.
 */
export function flakBurst(w, x, y, r) {
  const fx = fxOf();
  if (!fx) return; // headless (no atlas)
  const H = w.fxHigh, R = w.fxRng, F = w.F, big = r >= 30, s = r / 20;
  const p = w.player, heat = p ? 0.85 + 0.1 * p.tier + 0.4 * ampNow(p) : 1;
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
    H.color(i, 2.3 * heat, 1.05 * heat, 0.18, 1.1, 0.12, 0.75);
    H.spin(i, R.angle(), 0); H.look(i, 0.6, 1, FADE_OUT);
  }
  // 3. Hot core: white → yellow → orange flash, violet bloom around it.
  let i = H.spawn(F.glow, x, y, 0, 0, 14);
  if (i >= 0) { H.size(i, r * 2.4, r * 2.8); H.color(i, V[0], V[1], V[2], E[0] * 0.5, E[1] * 0.5, E[2] * 0.5); H.look(i, 0.4, 1); }
  i = H.spawn(F.glow, x, y, 0, 0, 13);
  if (i >= 0) { H.size(i, r * 1.6, r * 1.0); H.color(i, 2.6, 2.2, 1.3, 1.8, 0.6, 0.1); H.look(i, 1, 1); }
  i = H.spawn(F.core, x, y, 0, 0, 4);
  if (i >= 0) { H.size(i, r * 0.6, r * 0.3); H.color(i, 2.8, 2.6, 2.2); H.look(i, 1, 1); }
  // 4. Shockwave: a violet ring that opens out to the burst's damage radius.
  i = H.spawn(F.ring, x, y, 0, 0, 10);
  if (i >= 0) { H.size(i, r * 0.6, r * 2.1); H.color(i, V[0] * heat, V[1], V[2] * heat, E[0], E[1], E[2]); H.look(i, 0.7, 1, FADE_OUT); }
  // 5. Violet spikes shooting out.
  for (let n = 0; n < (big ? 7 : 4); n++) {
    const a = R.angle(), sp = R.range(4, 7) * Math.sqrt(s);
    i = H.spawn(F.spark, x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(6, 10));
    if (i < 0) break;
    H.size(i, big ? 5 : 4); H.color(i, 1.8, 0.8, 2.4, E[0], E[1], E[2]); H.phys(i, 0.85); H.look(i, 1, 1, FADE_OUT, 0.9);
  }
  // 6. Dark debris chips (alpha-blended, tumbling).
  for (let n = 0; n < (big ? 5 : 3); n++) {
    const a = R.angle(), sp = R.range(2, 4.5) * Math.sqrt(s);
    i = H.spawn(chip, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(18, 28));
    if (i < 0) break;
    H.size(i, R.range(3, 5.5) * Math.sqrt(s)); H.color(i, 0.32, 0.2, 0.42, 0.12, 0.08, 0.16);
    H.phys(i, 0.93, 0.03); H.spin(i, R.angle(), R.range(-0.4, 0.4)); H.look(i, 1, 0, FADE_OUT);
  }
  // 7. Orange embers.
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
  if (i >= 0) { H.size(i, size * 1.4, size * 0.8); H.color(i, V[0], V[1], V[2], E[0], E[1], E[2]); H.look(i, 0.6, 1, FADE_OUT); }
  i = H.spawn(fx.flare, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size * 1.2, size * 0.7); H.color(i, PAL.hot[0], PAL.hot[1], PAL.hot[2], V[0], V[1], V[2]); H.spin(i, R.range(-0.3, 0.3), 0); H.look(i, 0.85, 1, FADE_OUT); }
  i = H.spawn(F.core, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { H.size(i, size * 0.4, size * 0.2); H.color(i, WHITE[0], WHITE[1], WHITE[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); H.look(i, 1, 1, FADE_OUT); }
  if (side) {
    i = H.spawn(fx.shard, x - side * 3, y + 6, side * R.range(1.5, 3), R.range(0.8, 2), R.range(16, 24));
    if (i >= 0) { H.size(i, 5, 4); H.color(i, BRASS[0], BRASS[1], BRASS[2], BRASS[0] * 0.4, BRASS[1] * 0.4, BRASS[2] * 0.4); H.phys(i, 0.93, 0.05); H.spin(i, R.angle(), R.range(-0.4, 0.4)); H.look(i, 1, 0, FADE_OUT); }
  }
}

// ------------------------------------------------------------ rig layer FX

/** Glow strength around a layer's silhouette (armour-edge illumination). */
function edgeGlow(p, name) {
  const br = p.ps.br, aura = tierFx('aura', p) * (0.75 + 0.25 * Math.sin(p.t * 0.1));
  if (name.startsWith('gun')) return ((name.endsWith('L') ? br.flashL : br.flashR) / 6) * 0.45 * tierFx('flash', p) + aura * 0.15;
  if (name.startsWith('shoulder')) return (br.lockInner / 18) * 0.9 + (br.innerDir ? 0.35 : 0) + focusLevel(br) * 0.7 + aura * 0.2 * br.inner;
  if (name.startsWith('side')) return (br.lockOuter / 18) * 0.9 + (br.outerDir ? 0.35 : 0) + aura * 0.2 * br.outer;
  if (name === 'body') { const a = ampNow(p); return a > 0 ? 0.12 + 0.45 * a : 0; } // shield bonus: the armour glows purple
  return 0;
}

const BAY = [0.1, 0.08, 0.15];

RIG_FX.before = (p, b, api, name) => {
  const br = p.ps.br;
  if (!br) return;
  // Side-cannon bay: while the cannon is retracted, its empty launcher bay shows dark where it sits deployed.
  if (name.startsWith('sideTip') && br.outer < 0.999) {
    const s = name.slice(-1);
    api.drawLayer('sideRoot' + s, { rest: true, tint: BAY });
    api.drawLayer('sideTip' + s, { rest: true, tint: BAY });
  }
  const g = edgeGlow(p, name);
  if (g <= 0.02) return;
  // The layer drawn four times, nudged out and additive violet: a halo hugging its outline.
  const d = 1.7, a = Math.min(0.85, g) * 0.32;
  for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) api.drawLayer(name, { dx, dy, add: 1, tint: [V[0] * 0.55, V[1] * 0.5, V[2] * 0.6], alpha: a });
};

// Layer FX in one pass over the finished mecha (atlas textures: one batch).
RIG_FX.overlay = (p, b, api) => {
  const br = p.ps.br;
  if (!br || !fxOf()) return;
  for (const s of ['L', 'R']) { sideFx(p, b, api, s); shoulderFx(p, b, api, s); gunFx(p, b, api, s); }
  arsenalArcs(p, b, api);
  // Armour illumination after a shot: the hand guns flash violet (pilot texture, last).
  for (const s of ['L', 'R']) {
    const fl = (s === 'L' ? br.flashL : br.flashR) / 6;
    if (fl > 0) api.drawLayer('gun' + s, { add: 1, tint: [V[0] * 0.4, V[1] * 0.35, V[2] * 0.5], alpha: 0.4 * fl * tierFx('flash', p) });
  }
};

/** Hand gun: violet channel glow, charge pulses climbing to the bore between shots, the bore lit after a shot. */
function gunFx(p, b, api, s) {
  const br = p.ps.br, F = p.F, t = p.t, ch = tierFx('channel', p) * (1 + 0.5 * ampNow(p));
  const [cx, cy] = api.at(`chan${s}`), [mx, my] = api.at(`muzzle${s}`);
  const firing = br.fireT < 10, idle = 0.5 + 0.25 * Math.sin(t * 0.09 + (s === 'L' ? 0 : 1.3));
  const lv = ch * (firing ? 1 : idle);
  b.draw(F.glow, cx, cy, 8 * ch, 22 * ch, 0, V[0], V[1], V[2], 0.5 * lv, 1);
  b.draw(F.glow, cx, cy, 3.5, 12, 0, MAG[0], MAG[1], MAG[2], 0.7 * lv, 1);
  if (!firing) return;
  if (br.fireT < 4) {
    const g = 1 - br.fireT / 4;
    line(b, F, cx, cy, mx, my, 1.4, 0.8 * g * ch, PW);
    b.draw(F.glow, mx, my, 22 * g, 22 * g, 0, V[0], V[1], V[2], 0.75 * g, 1);
  }
  const f = Math.min(1, br.fireT / 7); // energy accumulating up the barrel for the next volley
  b.draw(F.glow, cx + (mx - cx) * f, cy + (my - cy) * f, 5, 9, 0, PW[0], PW[1], PW[2], 0.55 * ch, 1);
  b.draw(F.glow, mx, my, 8 * f * ch + 3, 8 * f * ch + 3, 0, MAG[0], MAG[1], MAG[2], 0.7 * f, 1);
}

/** Shoulder cannon: magenta glow inside the wide bore and the long barrel, housing core, lock flashes. */
function shoulderFx(p, b, api, s) {
  const br = p.ps.br, F = p.F, t = p.t, fx = fxOf(), d = br.inner, fl = focusLevel(br);
  const [wx, wy] = api.at(`wide${s}`), [hx, hy] = api.at(`housing${s}`), [tx, ty] = api.at(`shoulderTip${s}`);
  const [px, py] = api.at(`shoulderPivot${s}`), [jx, jy] = api.at(`shoulderJoint${s}`);
  const lv = 0.3 + 0.35 * d + 0.9 * fl, pu = 0.85 + 0.15 * Math.sin(t * 0.12 + (s === 'L' ? 0 : 2));
  b.draw(F.glow, wx, wy, 20 * lv * pu, 14 * lv * pu, 0, MAG[0], MAG[1], MAG[2], 0.55, 1);
  b.draw(F.core, wx, wy, 5 + 4 * fl, 4 + 3 * fl, 0, PW[0], PW[1], PW[2], 0.45 + 0.5 * fl, 1);
  b.draw(F.glow, hx, hy, 12 * lv, 18 * lv, 0, V[0], V[1], V[2], 0.35 * lv, 1);
  if (d > 0.4) { // the long barrel is live once it is out
    const e = Math.min(1, (d - 0.4) / 0.6);
    line(b, F, jx, jy, tx, ty, 1, 0.35 * e * (0.6 + 0.4 * pu + fl), MAG);
    b.draw(F.glow, tx, ty, 12 * e, 10 * e, 0, MAG[0], MAG[1], MAG[2], 0.55 * e, 1);
  }
  const lock = br.lockInner / 18;
  if (lock > 0) { // mechanical lock: a flash and a widening ring at the housing pivot and the barrel joint
    for (const [x, y] of [[px, py], [jx, jy]]) {
      b.draw(fx.flare, x, y, 22 * lock, 22 * lock, 0.4, PW[0], PW[1], PW[2], 0.75 * lock, 1);
      b.draw(F.ring, x, y, 24 * (1.4 - lock), 24 * (1.4 - lock), 0, V[0], V[1], V[2], 0.8 * lock, 1);
    }
  }
}

/** Side cannon: magenta mouth glow once it is out; lock flash. */
function sideFx(p, b, api, s) {
  const br = p.ps.br, F = p.F, t = p.t, fx = fxOf(), d = br.outer;
  if (d < 0.05) return;
  const [mx, my] = api.at(`sideTip${s}`), [jx, jy] = api.at(`sideJoint${s}`);
  const pu = 0.8 + 0.2 * Math.sin(t * 0.15 + (s === 'L' ? 0 : 1.5)), fire = br.fireT < 4 && p.tier >= 3 ? 1 - br.fireT / 4 : 0;
  b.draw(F.glow, mx, my, 14 * d * pu + 12 * fire, 12 * d * pu + 12 * fire, 0, MAG[0], MAG[1], MAG[2], 0.5 * d, 1);
  line(b, F, jx, jy, mx, my, 0.8, 0.3 * d * pu, MAG);
  const lock = br.lockOuter / 18;
  if (lock > 0) {
    b.draw(fx.flare, jx, jy, 20 * lock, 20 * lock, 0.4, PW[0], PW[1], PW[2], 0.75 * lock, 1);
    b.draw(F.ring, jx, jy, 22 * (1.4 - lock), 22 * (1.4 - lock), 0, V[0], V[1], V[2], 0.8 * lock, 1);
  }
}

/** Full arsenal (tier 4): controlled arcs crawling between the cannons; the barrels' interiors glow. */
function arsenalArcs(p, b, api) {
  const br = p.ps.br, F = p.F, t = p.t, aura = tierFx('aura', p) * br.outer;
  if (aura < 0.05 || (t >> 1) % 3 === 2) return;
  const pts = ['wideL', 'shoulderTipL', 'muzzleL', 'sideTipL', 'wideR', 'shoulderTipR', 'muzzleR', 'sideTipR'].map(api.at);
  const sd = (t >> 1) * 5.9;
  for (let k = 0; k < 2; k++) {
    const i = Math.floor(hash(sd + k) * 3) + (k ? 4 : 0);
    arc(b, F, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], sd + k * 13, 0.55 * aura);
  }
}

// ------------------------------------------------------------ transformation bursts

/** Particles for the rig's events (brunoRig.step). Bounded: under ~50 particles per event. */
export function rigEvents(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F;
  const at = (n) => brunoArt.animatedAnchor(p, n);
  const sparks = (x, y, n, sp, col = V) => {
    for (let k = 0; k < n; k++) {
      const a = R.range(0, TAU), v = R.range(sp * 0.4, sp);
      const i = H.spawn(F.spark, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(10, 18));
      if (i < 0) return;
      H.size(i, 4); H.spin(i, a, 0); H.phys(i, 0.9); H.color(i, PW[0], PW[1], PW[2], col[0], col[1], col[2]); H.look(i, 1, 1, FADE_OUT, 0.5);
    }
  };
  // Vented steam: dark violet puffs from the housings as they move.
  const steam = (x, y, n) => {
    const billow = w.r.frame('b_billow');
    for (let k = 0; k < n; k++) {
      const i = H.spawn(billow, x + R.range(-4, 4), y + R.range(-4, 4), R.range(-0.6, 0.6), R.range(0.2, 0.9), R.range(20, 30));
      if (i < 0) return;
      H.size(i, R.range(7, 11), R.range(14, 20)); H.color(i, 0.35, 0.25, 0.45, 0.1, 0.08, 0.14); H.phys(i, 0.95, -0.005); H.spin(i, R.angle(), 0.01); H.look(i, 0.55, 0, FADE_OUT);
    }
  };
  if (ev.deploy3) for (const s of ['L', 'R']) { sparks(...at(`shoulderPivot${s}`), 8, 3); steam(...at(`housing${s}`), 3); }
  if (ev.lock3) {
    w.r.post.shockwave(p.x, p.y, 0.02, 0.02, 0.45);
    for (const s of ['L', 'R']) { sparks(...at(`shoulderJoint${s}`), 8, 3.5); sparks(...at(`wide${s}`), 6, 3, MAG); }
  }
  if (ev.deploy4) for (const s of ['L', 'R']) sparks(...at(`sidePivot${s}`), 6, 2.5);
  if (ev.lock4) {
    for (const s of ['L', 'R']) sparks(...at(`sideTip${s}`), 6, 3, MAG);
    if (p.tier >= 4) { // full arsenal locked out: the transformation's climax
      w.r.post.flash(0.8, 0.4, 1, 0.22, 0.05);
      w.r.post.shockwave(p.x, p.y, 0.045, 0.025, 0.85);
      w.g.camera.addTrauma(0.22);
      for (const s of ['L', 'R']) { sparks(...at(`shoulderTip${s}`), 10, 4.5); sparks(...at(`muzzle${s}`), 6, 3.5, MAG); }
    }
  }
  for (const [e, n] of [['retract3', 'shoulderPivot'], ['retract4', 'sidePivot']]) {
    if (ev[e]) for (const s of ['L', 'R']) { sparks(...at(`${n}${s}`), 5, 2, E); steam(...at(`${n}${s}`), 2); }
  }
}

// ------------------------------------------------------------ focus: shoulder barrage

/** Barrage discharge at a shoulder-cannon mouth: purple-white flash, flare, ring, shards, a smoke puff. */
export function focusMuzzle(p, w, x, y, wide, side) {
  const fx = fxOf();
  if (!fx) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, k = (wide ? 1.25 : 1) * (1 + 0.3 * ampNow(p));
  let i = H.spawn(F.glow, x, y - 3, 0, -0.8, 5);
  if (i >= 0) { H.size(i, 34 * k, 22 * k); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 0.85, 1, FADE_OUT); }
  i = H.spawn(fx.flare, x, y - 4, 0, -0.8, 5);
  if (i >= 0) { H.size(i, 40 * k, 24 * k); H.spin(i, R.range(-0.2, 0.2), 0); H.color(i, MAG[0], MAG[1], MAG[2], E[0], E[1], E[2]); H.look(i, 0.85, 1, FADE_OUT); }
  i = H.spawn(F.ring, x, y, 0, -0.6, 9);
  if (i >= 0) { H.size(i, 6, 30 * k); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 0.6, 1, FADE_OUT); }
  for (let n = 0; n < 3; n++) {
    const a = -Math.PI / 2 + R.range(-0.5, 0.5), sp = R.range(4, 7);
    i = H.spawn(fx.shard, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(5, 8));
    if (i < 0) break;
    H.size(i, 11 * k, 4); H.spin(i, a, 0); H.phys(i, 0.8); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 0.9, 1, FADE_OUT);
  }
  const billow = w.r.frame('b_billow');
  i = H.spawn(billow, x + side * 3, y + 4, side * R.range(0.3, 0.8), R.range(0.3, 0.8), R.range(18, 26));
  if (i >= 0) { H.size(i, 10 * k, 18 * k); H.color(i, 0.4, 0.28, 0.5, 0.1, 0.08, 0.14); H.phys(i, 0.95, -0.004); H.spin(i, R.angle(), 0.02); H.look(i, 0.5, 0, FADE_OUT); }
}

/** Focus-cycle particles: motes drawn into the shoulder cannons while charging; a vented burst on release. */
export function focusParticles(p, w, ev) {
  if (!fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, br = p.ps.br;
  if (br.fs === 'charge') {
    for (const s of ['L', 'R']) {
      const [x, y] = brunoArt.animatedAnchor(p, 'wide' + s), a = R.range(0, TAU), d = R.range(22, 38), life = 8;
      const i = H.spawn(F.glow, x + Math.cos(a) * d, y + Math.sin(a) * d, -Math.cos(a) * d / life, -Math.sin(a) * d / life, life);
      if (i < 0) break;
      H.size(i, 5, 2); H.color(i, MAG[0], MAG[1], MAG[2], PW[0], PW[1], PW[2]); H.look(i, 0.9, 1, FADE_INOUT);
    }
  }
  if (ev.release) {
    const billow = w.r.frame('b_billow');
    for (const s of ['L', 'R']) {
      const [x, y] = brunoArt.animatedAnchor(p, 'wide' + s);
      for (let k = 0; k < 3; k++) {
        const i = H.spawn(billow, x + R.range(-4, 4), y, R.range(-0.5, 0.5), R.range(-0.8, -0.2), R.range(20, 30));
        if (i < 0) return;
        H.size(i, R.range(8, 12), R.range(16, 22)); H.color(i, 0.4, 0.28, 0.5, 0.1, 0.08, 0.14); H.phys(i, 0.95, 0); H.spin(i, R.angle(), 0.015); H.look(i, 0.5, 0, FADE_OUT);
      }
    }
  }
}

/**
 * The focus cycle at the shoulder cannons, drawn over the mecha. Charge: the
 * bores brighten, rings close in, pulses run down the barrels, arcs crackle
 * over the housings. Barrage: the bores burn white-hot, flashing with each
 * volley. Recovery: the glow cools and fades. The shells are the attack.
 */
export function renderFocus(p, b, x, y) {
  const br = p.ps.br;
  if (!br || br.fs === 'off') return;
  const fx = fxOf(), F = p.F, t = p.t;
  if (!fx) return;
  const lv = focusLevel(br), at = (n) => brunoArt.animatedAnchor(p, n, x, y);
  for (const s of ['L', 'R']) {
    const [wx, wy] = at('wide' + s), [hx, hy] = at('housing' + s), [tx, ty] = at('shoulderTip' + s);
    const long = p.tier >= 3;
    if (br.fs === 'charge') {
      const R = 30 - 18 * lv;
      b.draw(F.ring, wx, wy, R, R, 0, MAG[0], MAG[1], MAG[2], 0.35 + 0.55 * lv, 1);
      b.draw(F.glow, wx, wy, 26 * lv + 6, 22 * lv + 6, 0, PW[0], PW[1], PW[2], 0.6 * lv, 1);
      for (let k = 0; k < 2; k++) { // energy pulses running up the housing into the bore
        const f = (t * 0.07 + k * 0.5) % 1;
        b.draw(F.glow, hx + (wx - hx) * f, hy + (wy - hy) * f, 7, 7, 0, MAG[0], MAG[1], MAG[2], 0.8 * lv, 1);
      }
      if (long) { b.draw(F.ring, tx, ty, R * 0.8, R * 0.8, 0, MAG[0], MAG[1], MAG[2], 0.3 + 0.5 * lv, 1); b.draw(F.glow, tx, ty, 18 * lv + 4, 16 * lv + 4, 0, PW[0], PW[1], PW[2], 0.55 * lv, 1); }
      if ((t >> 1) & 1) arc(b, F, hx + (s === 'L' ? -12 : 12), hy + 8, wx, wy, t * 1.7 + (s === 'L' ? 0 : 5), 0.7 * lv, 1);
    } else if (br.fs === 'active') {
      const v = Math.max(0, 1 - br.volT / 5);
      b.draw(F.glow, wx, wy, 26 + 14 * v, 22 + 12 * v, 0, MAG[0], MAG[1], MAG[2], 0.55 + 0.3 * v, 1);
      b.draw(F.core, wx, wy, 8 + 6 * v, 7 + 5 * v, 0, PW[0], PW[1], PW[2], 0.9, 1);
      if (long) b.draw(F.core, tx, ty, 6 + 5 * v, 6 + 5 * v, 0, PW[0], PW[1], PW[2], 0.85, 1);
      b.draw(F.glow, hx, hy, 18, 24, 0, V[0], V[1], V[2], 0.35, 1);
    } else {
      b.draw(F.glow, wx, wy, 22 * lv + 4, 18 * lv + 4, 0, MAG[0], MAG[1], MAG[2], 0.5 * lv, 1);
      if (long) b.draw(F.glow, tx, ty, 14 * lv, 12 * lv, 0, MAG[0], MAG[1], MAG[2], 0.45 * lv, 1);
    }
  }
}

// ------------------------------------------------------------ Reactive Shield

/** Absorbed enemy bullet: a flash where it struck the sphere, an energy mote drawn into Bruno. */
export function absorbFx(p, w, x, y) {
  if (!fxOf()) return;
  const H = w.fxHigh, F = p.F, dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1, life = 10;
  let i = H.spawn(F.glow, x, y, 0, 0, 6);
  if (i >= 0) { H.size(i, 14, 6); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 0.8, 1, FADE_OUT); }
  i = H.spawn(F.glow, x, y, dx / life, dy / life, life);
  if (i >= 0) { H.size(i, 5, 3); H.color(i, MAG[0], MAG[1], MAG[2], PW[0], PW[1], PW[2]); H.look(i, 0.9, 1, FADE_INOUT); }
  void d;
}

/** Shield particles: energy flowing round the sphere; a burst ring as it forms. */
export function shieldParticles(p, w) {
  const sh = p.ps.shield;
  if (!sh || !fxOf()) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, r = shieldR(sh.t);
  if (sh.t === 1) {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU, i = H.spawn(F.glow, p.x, p.y, Math.cos(a) * 5, Math.sin(a) * 5, 12);
      if (i < 0) break;
      H.size(i, 6, 2); H.phys(i, 0.86); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 0.9, 1, FADE_OUT);
    }
  }
  if (p.t & 1) return;
  const a = R.range(0, TAU), tx = -Math.sin(a), ty = Math.cos(a), sp = R.range(1.5, 2.5);
  const i = H.spawn(F.glow, p.x + Math.cos(a) * r * 0.97, p.y + Math.sin(a) * r * 0.97, tx * sp + p.x - p.px, ty * sp + p.y - p.py, 12);
  if (i >= 0) { H.size(i, 4, 2); H.color(i, MAG[0], MAG[1], MAG[2], V[0], V[1], V[2]); H.look(i, 0.8, 1, FADE_INOUT); }
}

/**
 * The shield sphere (centred on the player, drawn above the mecha): a
 * translucent purple body, a bright boundary that flares on every
 * absorbed hit, two counter-rotating hexagons, crawling filaments, and an
 * outer gauge of 25 ticks lighting up with the absorbed power. After it
 * ends, the bonus shows as a purple aura and a fading gauge.
 */
export function renderShield(p, b, x, y) {
  const fx = fxOf(), F = p.F, t = p.t, sh = p.ps.shield, amp = ampNow(p), C = BRUNO.shield;
  if (!fx || (!sh && amp <= 0)) return;
  const gauge = (R, a) => { // absorbed power: ticks round the sphere, lit up to amp / cap
    const lit = Math.round((amp / C.cap) * 25);
    for (let k = 0; k < 25; k++) {
      const ang = -Math.PI / 2 + (k / 25) * TAU, on = k < lit;
      b.draw(F.laser, x + Math.cos(ang) * R, y + Math.sin(ang) * R, 4, on ? 2.2 : 1.2, ang + Math.PI / 2, on ? MAG[0] : E[0], on ? MAG[1] : E[1], on ? MAG[2] : E[2], (on ? 0.9 : 0.25) * a, 1);
    }
  };
  if (!sh) { // bonus window: the stored power still burns around him
    const a = Math.min(1, amp / C.cap * 2), pu = 0.8 + 0.2 * Math.sin(t * 0.25);
    b.draw(F.glow, x, y, 70 * pu, 70 * pu, 0, V[0], V[1], V[2], 0.18 * a, 1);
    b.draw(F.ring, x, y, ringSize(30 + 2 * pu), ringSize(30 + 2 * pu), 0, MAG[0], MAG[1], MAG[2], 0.3 * a, 1);
    gauge(34, a * Math.min(1, (p.ps.ampT || 0) / C.fade));
    return;
  }
  const R = shieldR(sh.t), left = p.specialT, blink = left < 60 && (t >> 2) & 1 ? 0.45 : 1;
  const hit = sh.hitT / 8, charge = amp / C.cap, pu = 0.9 + 0.1 * Math.sin(t * 0.2);
  // Body: translucent purple, denser toward the rim, brighter as power builds.
  b.draw(F.glow, x, y, R * 2.3, R * 2.3, 0, V[0], V[1], V[2], (0.16 + 0.14 * charge) * blink, 1);
  b.draw(F.glow, x, y, R * 1.6, R * 1.6, 0, E[0], E[1], E[2], 0.12 * blink, 1);
  // Boundary: a crisp bright edge exactly at the shield radius (flares on hits) over a soft violet halo.
  b.draw(F.ring, x, y, ringSize(R), ringSize(R), 0, V[0], V[1], V[2], (0.22 + 0.25 * hit) * blink, 1);
  const N = 40, ec = hit > 0 ? PW : MAG;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * TAU, a1 = ((k + 1) / N) * TAU;
    line(b, F, x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, 1.1, (0.55 + 0.4 * hit) * pu * blink, ec);
  }
  // Two counter-rotating hexagons of energy.
  for (const [rr, sp, a] of [[0.93, 0.02, 0.55], [0.72, -0.03, 0.3]]) {
    for (let k = 0; k < 6; k++) {
      const a0 = t * sp + (k / 6) * TAU, a1 = a0 + TAU / 6;
      line(b, F, x + Math.cos(a0) * R * rr, y + Math.sin(a0) * R * rr, x + Math.cos(a1) * R * rr, y + Math.sin(a1) * R * rr, 0.9, a * (0.6 + 0.6 * charge) * blink, MAG);
    }
  }
  // Electrical filaments crawling over the surface (re-rolled every 2 steps).
  if ((t >> 1) % 3 !== 2) {
    for (let k = 0; k < 2; k++) {
      const sd = (t >> 1) * 3.1 + k * 7, a0 = hash(sd) * TAU, a1 = a0 + 0.6 + hash(sd + 1) * 0.9;
      arc(b, F, x + Math.cos(a0) * R * 0.95, y + Math.sin(a0) * R * 0.95, x + Math.cos(a1) * R * 0.95, y + Math.sin(a1) * R * 0.95, sd, (0.4 + 0.4 * charge) * blink, 1);
    }
  }
  gauge(R + 7, blink);
  // Power converging on the mecha as it builds.
  if (charge > 0) b.draw(F.glow, x, y, 34 + 20 * charge, 34 + 20 * charge, 0, MAG[0], MAG[1], MAG[2], 0.25 * charge * pu, 1);
}

// ------------------------------------------------------------ bomb: opening blast

/** The bomb's opening blast at Bruno: flash, shockwave, sparks, debris and smoke (bounded). */
export function blastBurst(p, w, x, y) {
  const H = w.fxHigh, R = w.fxRng, F = p.F, fx = fxOf();
  w.r.post.flash(0.85, 0.55, 1, 0.5, 0.04);
  w.r.post.shockwave(x, y, 0.06, 0.03, 0.9);
  w.r.post.heat(0.6);
  if (!fx) return;
  const billow = w.r.frame('b_billow'), chip = w.r.frame('b_chip');
  for (let k = 0; k < 28; k++) {
    const a = R.range(0, TAU), sp = R.range(5, 11);
    const i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(14, 24));
    if (i < 0) break;
    H.size(i, 6); H.spin(i, a, 0); H.phys(i, 0.92); H.color(i, PW[0], PW[1], PW[2], V[0], V[1], V[2]); H.look(i, 1, 1, FADE_OUT, 0.8);
  }
  for (let k = 0; k < 10; k++) {
    const a = R.range(0, TAU), sp = R.range(3, 7);
    const i = H.spawn(chip, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(24, 36));
    if (i < 0) break;
    H.size(i, R.range(4, 7)); H.color(i, 0.32, 0.2, 0.42, 0.12, 0.08, 0.16); H.phys(i, 0.94, 0.02); H.spin(i, R.angle(), R.range(-0.4, 0.4)); H.look(i, 1, 0, FADE_OUT);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + R.range(-0.2, 0.2), sp = R.range(2.5, 4.5);
    const i = H.spawn(billow, x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * sp, Math.sin(a) * sp, R.range(34, 48));
    if (i < 0) break;
    H.size(i, R.range(30, 40), R.range(60, 80)); H.color(i, 0.3, 0.12, 0.4, 0.06, 0.03, 0.09); H.phys(i, 0.95, 0); H.spin(i, R.angle(), 0.01); H.look(i, 0.7, 0, FADE_OUT);
  }
}

/**
 * The opening blast: a shock front exactly as wide as the damage radius at
 * each step (bruno.js applies damage to what it reaches), a purple-white
 * core, trailing rings, then a fade. Stays where the bomb went off.
 */
export function renderBlast(p, b) {
  const bl = p.ps.blast, F = p.F;
  if (!bl) return;
  const C = BRUNO.bomb, t = bl.t, u = Math.min(1, t / C.grow), r = C.r * (1 - (1 - u) ** 2);
  const fade = t <= C.grow ? 1 : Math.max(0, 1 - (t - C.grow) / 34);
  if (fade <= 0) return;
  b.draw(F.glow, bl.x, bl.y, r * 2.4, r * 2.4, 0, V[0], V[1], V[2], 0.3 * fade, 1);
  b.draw(F.ring, bl.x, bl.y, ringSize(r), ringSize(r), 0, PW[0], PW[1], PW[2], 0.9 * fade, 1); // the shock front = damage radius
  b.draw(F.ring, bl.x, bl.y, ringSize(r * 0.8), ringSize(r * 0.8), 0, MAG[0], MAG[1], MAG[2], 0.5 * fade, 1);
  b.draw(F.ring, bl.x, bl.y, ringSize(r * 0.58), ringSize(r * 0.58), 0, V[0], V[1], V[2], 0.4 * fade, 1);
  const core = Math.max(0, 1 - t / 24);
  b.draw(F.glow, bl.x, bl.y, 160 * core + 40, 160 * core + 40, 0, PW[0], PW[1], PW[2], 0.8 * core, 1);
  b.draw(F.core, bl.x, bl.y, 50 * core, 50 * core, 0, PW[0], PW[1], PW[2], core, 1);
}

// ------------------------------------------------------------ ultimate: carpet bombing + nuke

/** The final nuke: screen flash, distortion, shake and a dense but bounded burst. */
export function nukeBurst(p, w, x, y) {
  w.r.post.flash(0.95, 0.75, 1, 0.95, 0.018);
  w.r.post.shockwave(x, y, 0.07, 0.022, 1.6);
  w.r.post.shockwave(x, y, 0.04, 0.032, 1.6);
  w.r.post.aberrate(0.05);
  w.r.post.heat(2);
  w.g.camera.addTrauma(0.85);
  w.g.input.rumble(1, 1, 700);
  const fx = fxOf();
  if (!fx) return;
  const H = w.fxHigh, R = w.fxRng, F = p.F, billow = w.r.frame('b_billow'), chip = w.r.frame('b_chip');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + R.range(-0.15, 0.15), sp = R.range(3, 6);
    const i = H.spawn(billow, x + Math.cos(a) * 30, y + Math.sin(a) * 30, Math.cos(a) * sp, Math.sin(a) * sp, R.range(50, 70));
    if (i < 0) break;
    H.size(i, R.range(60, 80), R.range(120, 160)); H.color(i, 0.5, 0.2, 0.6, 0.06, 0.03, 0.1); H.phys(i, 0.96, 0); H.spin(i, R.angle(), 0.008); H.look(i, 0.75, 0, FADE_OUT);
  }
  for (let k = 0; k < 40; k++) {
    const a = R.range(0, TAU), sp = R.range(6, 16);
    const i = H.spawn(F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(20, 34));
    if (i < 0) break;
    H.size(i, 8); H.spin(i, a, 0); H.phys(i, 0.95); H.color(i, PW[0], PW[1], PW[2], MAG[0], MAG[1], MAG[2]); H.look(i, 1, 1, FADE_OUT, 0.8);
  }
  for (let k = 0; k < 14; k++) {
    const a = R.range(0, TAU), sp = R.range(4, 9);
    const i = H.spawn(chip, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(30, 44));
    if (i < 0) break;
    H.size(i, R.range(6, 10)); H.color(i, 0.32, 0.2, 0.42, 0.12, 0.08, 0.16); H.phys(i, 0.96, 0.02); H.spin(i, R.angle(), R.range(-0.3, 0.3)); H.look(i, 1, 0, FADE_OUT);
  }
}

/**
 * Ultimate visuals (world layer, under the mecha): the opening target lanes,
 * the bombers and their falling bombs, the nuke's warning reticle, its drop,
 * and the screen-wide detonation (expanding rings, a core that fills the
 * playfield, then a fade back to normal).
 */
export function renderUlt(p, b, alpha) {
  const ps = p.ps, F = p.F, nk = ps.nuke;
  if (!ps.bombers || !nk) return;
  const U = BRUNO.ult, t = nk.t, fx = fxOf();
  // Phase A: target lanes and reticles light up as the run begins.
  if (t < 50) {
    const a = Math.min(1, t / 8) * (1 - t / 50), blink = (t >> 2) & 1 ? 1 : 0.5;
    for (const x of [60, 150, 240, 330, 420]) {
      b.draw(F.laser, x, WORLD_H / 2, WORLD_H, 2, Math.PI / 2, V[0], V[1], V[2], 0.35 * a, 1);
      for (const y of [120, 260, 400]) b.draw(F.ring, x, y, 26, 26, 0, MAG[0], MAG[1], MAG[2], 0.6 * a * blink, 1);
    }
  }
  // Phase B: falling bombs and the bombers.
  for (const d of ps.drops) {
    b.draw(ps.fShell, d.x, d.y, 14, 7, Math.PI / 2, 0.5, 0.5, 0.5, 1, 0);
    b.draw(F.glow, d.x, d.y, 30, 30, 0, 0.9, 0.35, 1.5, (d.t & 2) ? 0.5 : 0.18, 1);
    b.draw(F.glow, d.x, d.y, 14, 14, 0, 2, 0.6, 0.1, (d.t & 2) ? 0.6 : 0.2, 1);
  }
  for (const bm of ps.bombers) {
    const y = bm.py + (bm.y - bm.py) * alpha;
    b.draw(F.glow, bm.x, y + 34, 50, 50, 0, 0.75, 0.3, 1, 0.5, 1);
    b.draw(ps.fBomber, bm.x, y, 92, 70, 0, 1, 1, 1, 1, 0);
  }
  if (!fx) return;
  const hitT = U.run + U.drop;
  // Phase C: warning reticle on the impact point, then the bomb's drop.
  if (t >= U.warn && t < hitT) {
    const blink = (t >> 2) & 1 ? 1 : 0.4, u = Math.min(1, (t - U.warn) / (hitT - U.warn));
    const R = 120 - 70 * u;
    b.draw(F.ring, nk.x, nk.y, R * 2, R * 2, 0, MAG[0], MAG[1], MAG[2], 0.8 * blink, 1);
    b.draw(F.ring, nk.x, nk.y, R * 1.3, R * 1.3, 0, PW[0], PW[1], PW[2], 0.5 * blink, 1);
    b.draw(F.laser, nk.x, nk.y, WORLD_W, 2, 0, MAG[0], MAG[1], MAG[2], 0.45 * blink, 1);
    b.draw(F.laser, nk.x, nk.y, WORLD_H, 2, Math.PI / 2, MAG[0], MAG[1], MAG[2], 0.45 * blink, 1);
    for (let k = 0; k < 4; k++) { // corner brackets turning in
      const a = t * 0.04 + k * Math.PI / 2, d = R * 0.9;
      b.draw(F.laser, nk.x + Math.cos(a) * d, nk.y + Math.sin(a) * d, 18, 3, a + Math.PI / 2, PW[0], PW[1], PW[2], 0.8 * blink, 1);
    }
    b.draw(F.glow, WORLD_W / 2, 6, WORLD_W, 18, 0, MAG[0], MAG[1], MAG[2], 0.35 * blink, 1);          // danger bars, top
    b.draw(F.glow, WORLD_W / 2, WORLD_H - 6, WORLD_W, 18, 0, MAG[0], MAG[1], MAG[2], 0.35 * blink, 1); // and bottom
  }
  if (t > U.run && t < hitT) {
    const u = (t - U.run + alpha) / U.drop, by = -40 + (nk.y + 40) * u * u; // accelerating fall
    const s = 1 + 0.6 * u;
    b.draw(F.glow, nk.x, by - 30 * s, 26 * s, 90 * s, 0, V[0], V[1], V[2], 0.5, 1); // trail
    b.draw(F.glow, nk.x, by, 70 * s, 70 * s, 0, MAG[0], MAG[1], MAG[2], 0.35 + 0.4 * u, 1);
    b.draw(ps.fShell, nk.x, by, 40 * s, 20 * s, Math.PI / 2, 0.55, 0.5, 0.6, 1, 0);       // the bomb casing
    b.draw(F.core, nk.x, by + 8 * s, 12 * s, 12 * s, 0, PW[0], PW[1], PW[2], 0.6 + 0.4 * ((t >> 1) & 1), 1);
  }
  // Phase C/D: the detonation fills the playfield, then fades away (gone by the ultimate's end).
  if (t >= hitT) {
    const e = t - hitT, f = Math.max(0, 1 - e / U.tail), diag = Math.hypot(WORLD_W, WORLD_H);
    b.draw(F.glow, nk.x, nk.y, diag * 2.4, diag * 2.4, 0, PW[0], PW[1], PW[2], 0.85 * f * f, 1); // screen-filling light
    b.draw(F.glow, nk.x, nk.y, diag * 1.2, diag * 1.2, 0, MAG[0], MAG[1], MAG[2], 0.5 * f, 1);
    b.draw(F.core, nk.x, nk.y, 220 * f, 220 * f, 0, PW[0], PW[1], PW[2], f, 1);
    for (let k = 0; k < 4; k++) { // radial shock rings, staggered, out past the screen edges
      const g = Math.max(0, e - k * 6) / (U.tail * 0.7), R = diag * 1.25 * Math.min(1, g);
      if (g <= 0 || g >= 1) continue;
      const col = k & 1 ? MAG : PW;
      b.draw(F.ring, nk.x, nk.y, R * 2, R * 2, 0, col[0], col[1], col[2], 0.8 * (1 - g), 1);
    }
  }
}
