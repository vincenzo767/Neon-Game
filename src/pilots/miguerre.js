import { mirrorPath, chrome, neonLines, outline, canopy, glowDot } from '../fx/art.js';
import { TAU, W, H, ringPulse, targets, shipScale, stun } from './common.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL } from '../core/damage.js';
import { FADE_OUT } from '../fx/Particles.js';
import { miguerreArt, PAL } from './miguerreArt.js';
import {
  miguerreFxSprites, renderBeams, hitSpark, burst, renderGhost,
  renderCrescent, renderCannon, ghostSmoke, crescentPts, crescentSmoke, cannonSpray, CHAIN_FADE,
  wingTrail, wingGust, swordCharge, swordRelease, terrorBurst, fearWisp, renderFear, chaosVortex, ultCharge,
} from './miguerreFx.js';
import { rigState, step as rigStep, swing, spread, clench, charge, hornFlash, SWING } from './miguerreRig.js';

// MIGUERRE ZO'RAJAH — OVERCLOCK (void knight) · LEGENDARY
// Void Beam: an instant straight beam to the nearest enemy; from there it races
// on, enemy to enemy, at any range (a visible chain), destroying normal enemies
// in one hit and erasing attacks in its path and around him
// Focus: Ghost Launch (a smoke ghost and five clones fire, harder the longer
// he holds it; he is intangible)
// Special: Crescent of Chaos (kills regular enemies outright)
// Bomb: Chaos Clone (six thick-smoke clones far from him, firing until the
// stage is cleared; each bomb adds six more) · Ultimate: Breathe of the Chaos (7 s)
// In focus the two outermost clones cast the crescent and fire the cannon too.
//
// MIGUERRE v2 (ASSET_NOTES.md "Rebuild v2", owner's 1B, 2A, 3A, 4A): the horned,
// winged sword knight as a component mecha (miguerreArt.js + miguerreRig.js +
// miguerreFx.js) replaces drawShip() when the art loads; drawShip() stays as the
// automatic fallback. Every void beam leaves both horns on his head (two beams
// converging on the target, one hit). No thrusters: the wings beat. The sword
// swing launches the Crescent of Chaos, and its terrifying vibration freezes
// regular enemies in fear. Each Chaos Clone guards its own side of the screen.
// The Breathe of the Chaos pours from between the horns after a horn charge.
// The legs (feet) never fire.

const RED = [1.0, 0.15, 0.18];
const KILL = DMG_INSTANT_KILL | DMG_IGNORES_SHIELDS;
const STRIKE_CD = 4;        // a strike every 4 steps (15 / s) from the body or the ghost
const CLONE_CD = 8;         // each clone strikes every 8 steps, staggered
const NULL_R = 110;         // attacks this close are chased down and erased
const LAUNCH = 110;         // the ghost launches this far forward
const CLONES = [[-150, 50], [-82, -28], [82, -28], [150, 50], [0, 105]]; // well spread around the ghost
const SIDE = [0, 3];        // the two outermost clones: they also cast the crescent and fire the cannon
const CRESCENT_SPEED = 3.2;  // units per step (medium)
const CHAIN_SPEED = 18;     // units per step the chain races between enemies (~0.45 s across the screen)
const CHAIN_MAX = 64;       // hops per chain
const FOCUS_RAMP = 240;     // focus beams build up to ×3 damage over this many steps (4 s)
const CHAOS_PER = 6;        // Chaos Clones per bomb
const CHAOS_MAX = 30;       // at most five bombs' worth on screen
const CHAOS_CD = 6;         // each Chaos Clone strikes every 6 steps, staggered
const CHAOS_MUL = 0.45;     // its boss damage per strike (× bossDmg)
const CRESCENT_BOSS = 9;    // Crescent of Chaos damage to bosses every 5 steps
const BREATH_DMG = 4;       // Breathe of the Chaos damage per step (was 2.6)
const FEAR_T = 120;         // v2: regular enemies freeze in fear this long (2 s) after the swing's wind-up
const ULT_CHARGE = 24;      // v2: the horns charge 0.4 s before the cannon pours (he is invulnerable throughout)

/** Boss / mid-boss damage per strike (one-hit kills don't apply to them). T4 ≈ 130 DPS. */
const bossDmg = (t) => 2.5 + 1.8 * t;
const isBoss = (e) => !!(e.boss || e.ctrl || e.kind === 'bosspart');

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Blade wings.
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 5, 30); ctx.lineTo(cx + s * 22, 50); ctx.lineTo(cx + s * 9, 38); ctx.closePath();
    ctx.fillStyle = '#0c0a0e'; ctx.fill(); outline(ctx, 0.6);
  }
  if (tier >= 2) for (const s of [-1, 1]) { mirrorPath(ctx, cx, [4, 14, 14, 18, 14, 21, 4, 21]); ctx.fillStyle = '#1a0a0e'; ctx.fill(); outline(ctx, 0.6); }
  mirrorPath(ctx, cx, [0, 1, 3, 8, 5, 22, 16, 34, 18, 40, 9, 41, 8, 50, 0, 51]);
  ctx.fillStyle = chrome(ctx, cx - 18, cx + 18, '#0a0608', '#2a1a20', '#6a4a52'); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(255,40,50,0.85)'; ctx.fillRect(cx - 0.8, 8, 1.6, 26);
  glowDot(ctx, cx, 28, 3.2, 'rgba(255,40,60,1)');
  if (tier >= 4) neonLines(ctx, cx, [16, 34, 22, 44, 18, 40, 22, 47], 'rgba(255,60,70,1)', 0.9, 6);
  canopy(ctx, cx, 16, 2.6, 5, '#ffffff', '#ff6a6a', '#2a0608');
  neonLines(ctx, cx, [5, 22, 16, 34], 'rgba(255,50,60,1)', 0.7, 5);
}

// ------------------------------------------------------------- the kit

/** Nearest live target to (x, y) that this chain hasn't hit yet (no range limit), passing `own` if given. */
function nextTarget(w, x, y, hit, own = null) {
  let best = null, bd = Infinity;
  for (const e of targets(w)) {
    if (hit.has(e) || (own && !own(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** A void hit: normal enemies die (through shields); bosses and mid-bosses take bossDmg × mul. */
function hitEnemy(p, w, e, mul) {
  if (isBoss(e)) w.damage(e, bossDmg(p.tier) * mul, DMG_IGNORES_SHIELDS);
  else { w.damage(e, 1, KILL); if (!e.alive) burst(w, e.x, e.y, 0.7); }
}

/** The two horn points (world) of a ghost or clone at (x, y) (the art's anchors, unposed). */
const hornsAt = (x, y) => ['hornL', 'hornR'].map((n) => { const [ax, ay] = miguerreArt.anchor(n); return [x + ax, y + ay]; });
/** His own horns, riding the wing beat's bob. */
const horns = (p) => [miguerreArt.animatedAnchor(p, 'hornL'), miguerreArt.animatedAnchor(p, 'hornR')];

/**
 * One void strike from the horns at `from` (owner's 1B: both fire, two beams
 * converging on the target, one hit): an instant straight beam to the enemy
 * nearest to them, then a chain that races on from enemy to enemy
 * (stepChains). Bullets the beams cross are erased. `own` (Chaos Clones)
 * limits the target and its chain to the clone's own side; without a target
 * there it doesn't fire (returns false).
 */
function strike(p, w, from, bossMul, wide = 1, own = null) {
  const ps = p.ps, R = w.fxRng, n = from.length, bw = 9 * wide * (n > 1 ? 0.8 : 1);
  const x0 = from.reduce((v, q) => v + q[0], 0) / n, y0 = from.reduce((v, q) => v + q[1], 0) / n;
  const e = nextTarget(w, x0, y0, new Set(), own);
  if (!e) {
    if (own) return false;
    // Nothing to chase: the beams crack straight ahead.
    const tx = x0 + R.range(-30, 30), ty = y0 - 320;
    w.damageLine(x0, y0, tx, ty, 12, bossDmg(p.tier) * bossMul);
    for (const [fx, fy] of from) {
      w.cancelLine(fx, fy, tx, ty, 14);
      ps.bolts.push({ pts: [[fx, fy], [tx, ty]], t: 0, life: 6, w: bw, s: R.next() * 100 });
    }
    return true;
  }
  const ex = e.x, ey = e.y;
  for (const [fx, fy] of from) {
    w.cancelLine(fx, fy, ex, ey, 14);
    ps.bolts.push({ pts: [[fx, fy], [ex, ey]], t: 0, life: 6, w: bw, s: R.next() * 100 });
  }
  hitEnemy(p, w, e, bossMul);
  if ((p.t >> 2) & 1) hitSpark(w, ex, ey + e.r * 0.4, Math.PI / 2);
  const hit = new Set([e]);
  const next = nextTarget(w, ex, ey, hit, own);
  if (next) ps.chains.push({ x: ex, y: ey, lx: ex, ly: ey, e: next, hit, hops: 1, segs: [], w: 9 * wide, mul: bossMul * 0.7, s: R.next() * 100, own });
  return true;
}

/** Chains race toward their next enemy; on arrival they hit it and pick the next one. */
function stepChains(p, w) {
  const ps = p.ps;
  for (const c of ps.chains) {
    let move = CHAIN_SPEED;
    while (c.e && move > 0) {
      if (!c.e.alive) { // someone else got it: turn toward the next one from here
        if (Math.hypot(c.x - c.lx, c.y - c.ly) > 2) { c.segs.push({ x0: c.lx, y0: c.ly, x1: c.x, y1: c.y, t: p.t }); c.lx = c.x; c.ly = c.y; }
        c.e = nextTarget(w, c.x, c.y, c.hit, c.own);
        continue;
      }
      const dx = c.e.x - c.x, dy = c.e.y - c.y, d = Math.hypot(dx, dy), px = c.x, py = c.y;
      if (d <= move) {
        c.x = c.e.x; c.y = c.e.y; move -= d;
        w.cancelLine(px, py, c.x, c.y, 14);
        hitEnemy(p, w, c.e, c.mul);
        c.segs.push({ x0: c.lx, y0: c.ly, x1: c.x, y1: c.y, t: p.t });
        c.lx = c.x; c.ly = c.y;
        c.hit.add(c.e);
        c.e = ++c.hops < CHAIN_MAX ? nextTarget(w, c.x, c.y, c.hit, c.own) : null;
      } else {
        c.x += dx / d * move; c.y += dy / d * move; move = 0;
        w.cancelLine(px, py, c.x, c.y, 14);
      }
    }
  }
  if (ps.chains.length) ps.chains = ps.chains.filter((c) => c.e || (c.segs.length && p.t - c.segs[c.segs.length - 1].t < CHAIN_FADE));
  for (const c of ps.chains) if (c.segs.length > 6) c.segs = c.segs.filter((g) => p.t - g.t < CHAIN_FADE);
}

/** The beam also chases down attacks coming at (x, y): arcs (from the horns) to the nearest bullets, then erases all close ones. */
function nullify(p, w, x, y, from = [[x, y]]) {
  const B = w.bullets, near = [];
  for (let i = 0; i < B.count; i++) {
    const d = (B.x[i] - x) ** 2 + (B.y[i] - y) ** 2;
    if (d < NULL_R * NULL_R) near.push([d, B.x[i], B.y[i]]);
  }
  if (!near.length) return;
  near.sort((a, b) => a[0] - b[0]);
  near.slice(0, 4).forEach(([, bx, by], k) => { const [ox, oy] = from[k % from.length]; p.ps.arcs.push({ x0: ox, y0: oy, x1: bx, y1: by, t: 0, life: 5 }); });
  w.cancelCircle(x, y, NULL_R);
}

function muzzle(p, w, x, y, size = 30) {
  const fx = miguerreArt.frames().fx, Hp = w.fxHigh;
  if (!fx) return;
  let i = Hp.spawn(p.F.glow, x, y, 0, 0, 3);
  if (i >= 0) { Hp.size(i, size, size * 0.6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  i = Hp.spawn(fx.flare, x, y, 0, 0, 4);
  if (i >= 0) { Hp.size(i, size * 1.2, size * 0.6); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.8, 1, FADE_OUT); }
}

/** Ghost clone positions (world) around the ghost. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clonesOf = (p) => CLONES.map(([dx, dy], k) => [
  clamp(p.x + dx + Math.sin(p.t * 0.05 + k) * 4, 24, W - 24),
  clamp(p.y + dy + Math.cos(p.t * 0.06 + k * 2) * 3, 30, H - 30),
]);

/**
 * Chaos Clone slots for bomb number n: a wide hexagon around the middle of
 * the screen, far from where he usually flies, turned a little per bomb.
 */
function chaosSlots(n) {
  const out = [], r = 170 + (n % 2) * 40, rot = n * 0.52;
  for (let k = 0; k < CHAOS_PER; k++) {
    const a = rot + (k / CHAOS_PER) * TAU;
    out.push([clamp(W / 2 + Math.cos(a) * r, 30, W - 30), clamp(H * 0.4 + Math.sin(a) * r * 0.85, 40, H - 140)]);
  }
  return out;
}

/** Chaos Clone positions now (they drift slowly where they were placed). */
const chaosPos = (p, c) => [c.x + Math.sin(p.t * 0.03 + c.seed) * 10, c.y + Math.cos(p.t * 0.025 + c.seed * 2) * 8];

/** Index of the Chaos Clone (positions `pos`) nearest to (x, y): that enemy is on its side. */
function sideOf(pos, x, y) {
  let best = 0, bd = Infinity;
  for (let k = 0; k < pos.length; k++) { const d = (pos[k][0] - x) ** 2 + (pos[k][1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}

/**
 * The swing's terrifying vibration at its peak: every regular enemy on screen
 * freezes in fear (stunned: no moving or shooting) and backs away from him,
 * trembling; bosses only tremble (owner's 2A).
 */
function terrify(p, w) {
  const ps = p.ps, list = [];
  for (const e of targets(w)) {
    const boss = isBoss(e);
    if (!boss) stun(e, FEAR_T);
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    const f = { e, t: 0, life: FEAR_T, boss, ux: (e.x - p.x) / d, uy: (e.y - p.y) / d, jx: 0, jy: 0, s: (e.x * 7 + e.y * 3) % 17 };
    ps.fear = ps.fear.filter((g) => g.e !== e);
    ps.fear.push(f); list.push(f);
  }
  terrorBurst(p, w, list);
}

/** Feared enemies back away from him (slowing) and tremble; their wisps of dread rise. */
function stepFear(p, w) {
  const ps = p.ps;
  for (const f of ps.fear) {
    f.t++;
    const e = f.e;
    if (!e.alive || f.boss) continue;
    e.x -= f.jx; e.y -= f.jy;
    const k = 1 - f.t / f.life, sp = 0.9 * k;
    const nx = e.x + f.ux * sp, ny = e.y + f.uy * sp;
    if (nx > 16 && nx < W - 16) e.x = nx;
    if (ny > 16 && ny < H - 16) e.y = ny;
    f.jx = (f.t & 1 ? 1 : -1) * 1.3 * k; f.jy = (f.t & 2 ? 1 : -1) * 0.8 * k;
    e.x += f.jx; e.y += f.jy;
    if ((f.t + f.s) % 6 === 0) fearWisp(w, e);
  }
  if (ps.fear.length) ps.fear = ps.fear.filter((f) => f.t < f.life && f.e.alive);
}

/** Smoke puffs (alpha-blended black-red) for the ghost launch and the body's return. */
function smokeBurst(w, x, y, n = 10, ring = true) {
  const Hp = w.fxHigh, R = w.fxRng, F = w.F;
  for (let k = 0; k < n; k++) {
    const a = R.range(0, TAU), sp = R.range(0.5, 2.5);
    const i = Hp.spawn(F.glow, x + R.range(-12, 12), y + R.range(-16, 16), Math.cos(a) * sp, Math.sin(a) * sp, R.range(20, 34));
    if (i < 0) return;
    Hp.size(i, 16, 40); Hp.color(i, 0.25, 0.0, 0.03, 0.03, 0, 0); Hp.phys(i, 0.94); Hp.look(i, 0.6, 0, FADE_OUT);
  }
  if (ring) ringPulse(w, x, y, RED, 8, 60, 16);
}

export default {
  id: 'miguerre',
  name: "MIGUERRE ZO'RAJAH",
  vehicle: 'OVERCLOCK',
  role: 'Void Knight',
  legendary: true,
  bio: 'Street racer with more tickets than flight hours, until he crashed through the edge of the Grid into the void and something answered. Miguerre came back flying the Overclock, a black-and-red void knight whose beams never miss and never stop.',
  color: RED,
  css: '#ff2a3a',
  // Art test: the Overclock's paint (black armour, red light).
  palette: { armour: '#141016', frame: '#060406', trim: '#ff2a3a', energy: '#ff3040' },
  stats: { speed: 5, power: 5, range: 5, bomb: 4 },
  speed: { normal: 5.4, focus: 2.3 },
  hitbox: 2.3,
  bombStock: 3,
  engines: [[-6, 26], [6, 26]],
  engineColor: [1.0, 0.15, 0.2],
  // Procedural fallback, matched to pilot-portrait.jpg (white hair, orange shades, tattoos, black jacket).
  portrait: { skin: '#c89070', hair: '#eeeeee', style: 'spiky', eyes: 'goggles', accent: 'tattoo', suit: '#0c0a0e' },
  weapons: {
    main: 'Void Beam — an instant straight beam, then a chain racing through every enemy at any range; one-hit kills (not bosses); erases attacks aimed at him',
    focus: 'Ghost Launch — a smoke ghost and five clones fire void beams that grow stronger the longer he holds focus; completely intangible',
  },
  art: miguerreArt,
  special: {
    name: 'CRESCENT OF CHAOS',
    desc: 'Swing the long sword: a gigantic chaos crescent tears off the blade and sweeps forward, erasing every attack it touches, killing regular enemies outright and burning bosses (three in focus); its terrifying vibration freezes enemies in fear',
    cooldown: 600,
    duration: 300,
    activate(p, w) {
      // v2: the sword swing starts; the crescent tears off the blade mid-slash (SWING.launch).
      swing(p);
      p.ps.crescents = [];
      p.ps.trail = [];
      w.g.camera.addTrauma(0.15);
    },
    update(p, w, t) {
      const ps = p.ps;
      // The swing: the blade charges, the wings flare; a terrifying vibration rolls out.
      if (t <= SWING.slash) {
        spread(p, 1);
        if (t < SWING.wind) swordCharge(p, w, t / SWING.wind);
        if (t % 4 === 0) { w.r.post.shockwave(p.x, p.y, 0.025, 0.022, 0.55); w.r.post.aberrate(0.012); }
        w.r.post.heat(0.06);
        w.g.camera.addTrauma(0.05);
        if (t === SWING.wind) terrify(p, w);
      }
      // The blade's path, for the arc trail (relative to him).
      if (t >= SWING.wind - 2 && t <= SWING.hold) {
        const [gx, gy] = miguerreArt.animatedAnchor(p, 'guard'), [tx, ty] = miguerreArt.animatedAnchor(p, 'swordTip');
        ps.trail.push({ gx: gx - p.x, gy: gy - p.y, tx: tx - p.x, ty: ty - p.y, a: 1 });
        if (ps.trail.length > 9) ps.trail.shift();
      } else if (ps.trail.length) ps.trail.shift();
      if (t === SWING.launch) {
        // The crescent tears off the blade (in focus the two outermost clones cast one too).
        const [bx] = miguerreArt.animatedAnchor(p, 'swordMid');
        const at = [[bx, p.y]];
        if (ps.ghost) for (const k of SIDE) at.push(clonesOf(p)[k]);
        ps.crescents = at.map(([x, y]) => ({ x, y: y - 110, w: 300, t: 0, t0: t, life: 300 - t }));
        swordRelease(p, w);
        w.r.post.flash(1, 0.15, 0.2, 0.25, 0.06);
        w.r.post.shockwave(p.x, p.y - 70, 0.04, 0.02, 0.5);
        w.g.camera.addTrauma(0.3);
      }
      for (const c of ps.crescents) {
        c.t = t - c.t0;
        c.y -= CRESCENT_SPEED;
        crescentSmoke(w, c);
        // The crescent's band as circles: attacks touching it vanish; regular enemies it
        // touches die outright (through shields); bosses and mid-bosses burn every 5 steps.
        const hit = new Set();
        for (const q of crescentPts(c, 12)) {
          const r = q.th / 2 + 18;
          w.cancelCircle(q.mx, q.my, r);
          for (const e of targets(w)) if ((e.x - q.mx) ** 2 + (e.y - q.my) ** 2 < (r + e.r) ** 2) hit.add(e);
        }
        for (const e of hit) {
          if (isBoss(e)) { if (t % 5 === 0) w.damage(e, CRESCENT_BOSS, DMG_IGNORES_SHIELDS); }
          else w.damage(e, 1, KILL);
          if (!e.alive) burst(w, e.x, e.y, 0.8);
        }
      }
    },
    end(p) { p.ps.crescents = []; p.ps.trail = []; },
  },
  bomb: {
    name: 'CHAOS CLONE',
    // A short cast (the Player's bomb clears bullets and covers him); the clones stay until the stage is cleared.
    duration: 60,
    activate(p, w) {
      const ps = p.ps, n = Math.floor(ps.chaos.length / CHAOS_PER);
      if (ps.chaos.length + CHAOS_PER > CHAOS_MAX) ps.chaos.splice(0, CHAOS_PER); // the oldest six make room
      chaosSlots(n).forEach(([x, y], k) => {
        ps.chaos.push({ x, y, t: 0, cd: k % CHAOS_CD, seed: ps.chaos.length * 1.7 + k });
        chaosVortex(w, x, y);
        smokeBurst(w, x, y, 14);
        burst(w, x, y, 0.8);
      });
      w.r.post.flash(1, 0.05, 0.1, 0.35, 0.05);
      w.g.camera.addTrauma(0.3);
    },
    update() {},
  },
  ultimate: {
    name: 'BREATHE OF THE CHAOS',
    // v2 (owner's 4A): a 0.4 s horn charge, then 7 s of cannon; the Player is invulnerable for all of it.
    duration: ULT_CHARGE + 420,
    // In focus the two outermost clones fire a cannon too (three in all).
    activate(p, w) {
      p.ps.cannon = { w: 150, fade: 0, side: p.ps.ghost ? 1 : 0 };
      w.r.post.flash(0.6, 0.05, 0.1, 0.25, 0.05);
    },
    update(p, w, t) {
      const u = p.ps.cannon;
      if (!u) return;
      spread(p, 1); clench(p, 1);
      if (t <= ULT_CHARGE) {
        // The horns blaze; black lightning and red motes gather between them.
        charge(p, t / ULT_CHARGE);
        ultCharge(p, w, t / ULT_CHARGE);
        w.g.camera.addTrauma(0.04 + 0.1 * t / ULT_CHARGE);
        w.r.post.heat(0.05);
        if (t === ULT_CHARGE) { w.r.post.flash(1, 0.1, 0.15, 0.5, 0.05); w.r.post.shockwave(p.x, p.y, 0.05, 0.03, 0.7); }
        return;
      }
      const tc = t - ULT_CHARGE;
      charge(p, 0.6);
      w.r.post.heat(0.03);
      u.fade = Math.min(1, tc / 12) * (tc > 400 ? (420 - tc) / 20 : 1);
      u.side += ((p.ps.ghost ? 1 : 0) - u.side) * 0.15;
      // From between the horns (the clones' heads in focus).
      const [hx, hy] = miguerreArt.anchor('core');
      const guns = [miguerreArt.animatedAnchor(p, 'core')];
      if (p.ps.ghost) for (const k of SIDE) { const [cx, cy] = clonesOf(p)[k]; guns.push([cx + hx, cy + hy]); }
      guns.forEach(([gx, gy], k) => {
        const bm = w.beam(gx, gy, gx, -30, u.w, BREATH_DMG, RED, 1, DMG_IGNORES_SHIELDS);
        bm.skin = true;
        w.cancelLine(gx, gy, gx, -30, u.w * 1.1);
        cannonSpray(w, gx, gy - 4, u.w, k > 0);
      });
      if (tc % 30 === 0) { w.g.camera.addTrauma(0.2); w.r.post.shockwave(p.x, p.y - 60, 0.02, 0.02, 0.4); }
    },
    end(p) { p.ps.cannon = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_miguerre_${t}`, 46, 54, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    miguerreFxSprites(atlas);
    miguerreArt.buildSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip(p, b, x, y, a) {
    const g = p.ps.ghost;
    // Chaos Clones (bomb): thick-smoke ghosts placed far from him.
    p.ps.chaos.forEach((c, k) => {
      const [cx, cy] = chaosPos(p, c), grow = Math.min(1, c.t / 20);
      renderGhost(p, b, cx + (x - p.x), cy + (y - p.y), 0.85 * a * grow, 20 + k, true);
    });
    if (!g) return miguerreArt.renderMecha(p, b, x, y, a);
    // Focus: the body stays parked (untargetable); the ghost and its clones are smoke.
    const body = Object.create(p);
    body.focus = false;
    if (!miguerreArt.renderMecha(body, b, g.bx, g.by, a * 0.85)) return false;
    for (const [k, [cx, cy]] of clonesOf(p).entries()) renderGhost(p, b, cx, cy, 0.75 * a, k + 1);
    renderGhost(p, b, x, y, a, 0);
    return true;
  },
  exhaust: wingTrail, // no thrusters: smoke and embers off the wing tips
  hitSpark,
  /** Focus: completely intangible (every attack passes through; the body can't be targeted). */
  intangible: (p) => !!p.ps.ghost,
  /** The stage is cleared: the Chaos Clones dissolve into smoke. */
  stageClear(p, w) {
    for (const c of p.ps.chaos) { const [cx, cy] = chaosPos(p, c); smokeBurst(w, cx, cy, 10); }
    p.ps.chaos = [];
  },
  /** tools/dps.mjs: normal enemies die in one hit, so measure against boss-flagged dummies. */
  dpsBossTargets: true,

  init(p, w) {
    const ps = p.ps;
    ps.fShard = w.r.frame('mz_shard');
    ps.fCresBody = w.r.frame('mz_cres_body');
    ps.fCresRim = w.r.frame('mz_cres_rim');
    ps.fOrb = w.r.frame('mz_orb');
    ps.fColumn = w.r.frame('mz_column');
    ps.fBar = w.r.frame('mz_bar');
    ps.chains = [];
    ps.bolts = [];
    ps.arcs = [];
    ps.chaos = [];
    ps.ghost = null;
    ps.crescents = [];
    ps.cannon = null;
    ps.fear = [];
    ps.trail = [];
    rigState(p);
  },

  reset(p) { p.ps.ghost = null; p.ps.bolts = []; p.ps.chains = []; p.ps.arcs = []; },

  update(p, w) {
    miguerreArt.animate(p);
    rigStep(p);
    const ps = p.ps;
    // Each downstroke: a gust and void feathers off the wings.
    if (rigState(p).stroke && !ps.ghost && miguerreArt.frames().art) wingGust(p, w);
    stepFear(p, w);
    // Ghost Launch: on focus the ghost dashes forward (the wings snap down); the body stays where it was.
    const focusing = p.focus && p.state === 'alive';
    if (focusing && !ps.ghost) {
      ps.ghost = { bx: p.x, by: p.y, t: 0, ty: Math.max(50, p.y - LAUNCH) };
      rigState(p).ph = 0;
      smokeBurst(w, p.x, p.y);
      w.g.camera.addTrauma(0.12);
    } else if (!focusing && ps.ghost) {
      // Release: the body flashes to the ghost.
      smokeBurst(w, ps.ghost.bx, ps.ghost.by, 8);
      smokeBurst(w, p.x, p.y, 6);
      ps.ghost = null;
    }
    if (ps.ghost) {
      const g = ps.ghost;
      if (g.t++ < 8) p.y += (g.ty - p.y) * 0.4;
      // Real smoke billowing off the ghost and each clone.
      ghostSmoke(w, p.x, p.y, 3);
      for (const [cx, cy] of clonesOf(p)) ghostSmoke(w, cx, cy, 2);
    }
    // Chaos Clones: thick smoke (the total stays about six clones' worth however many there are), and their own void beams.
    // v2 fix (owner's 3A): each guards its own side (the enemies nearer to it than to any other
    // clone). It fires as soon as one is there, on its own cooldown, and its chain stays on its
    // side, so every enemy is shot by the clone nearest to it. Bosses are everyone's: with
    // nothing on its side, a clone fires at the nearest boss (boss damage unchanged).
    const every = Math.ceil(ps.chaos.length / CHAOS_PER);
    const pos = ps.chaos.map((c) => chaosPos(p, c));
    ps.chaos.forEach((c, k) => {
      c.t++;
      if (c.cd > 0) c.cd--;
      const [cx, cy] = pos[k];
      if ((p.t + k) % every === 0) ghostSmoke(w, cx, cy, 2, true);
      if (p.state === 'alive' && c.t > 20 && c.cd <= 0) {
        const mine = (e) => sideOf(pos, e.x, e.y) === k, from = hornsAt(cx, cy);
        if (strike(p, w, from, CHAOS_MUL, 0.9, mine) || strike(p, w, from, CHAOS_MUL, 0.9, (e) => isBoss(e) || mine(e))) {
          c.cd = CHAOS_CD;
          for (const [hx, hy] of from) muzzle(p, w, hx, hy, 16);
        }
      }
    });
    stepChains(p, w);
    for (const s of ps.bolts) s.t++;
    if (ps.bolts.length) ps.bolts = ps.bolts.filter((s) => s.t < s.life);
    for (const c of ps.arcs) c.t++;
    if (ps.arcs.length) ps.arcs = ps.arcs.filter((c) => c.t < c.life);
  },

  optionLayout: () => [],

  fire(p, w) {
    if (p.fireCd > 0) return;
    p.fireCd = STRIKE_CD;
    w.shotsFired++; // no projectile, but the audio director voices one per strike
    const ps = p.ps;
    // Every void beam leaves both horns (the ghost's and the clones' too).
    const from = horns(p);
    hornFlash(p);
    if (ps.ghost) {
      // Focus beams build up the longer he holds it: ×1 → ×3 over FOCUS_RAMP steps.
      const ramp = 1 + 2 * Math.min(1, ps.ghost.t / FOCUS_RAMP);
      strike(p, w, from, 0.55 * ramp);
      for (const [hx, hy] of from) muzzle(p, w, hx, hy, 20);
      // Five clones, staggered over the clone cycle (the outer two are busy firing cannons during the ultimate).
      clonesOf(p).forEach(([cx, cy], k) => {
        if (ps.cannon && ps.cannon.fade > 0 && SIDE.includes(k)) return;
        if ((p.t + k * 2) % CLONE_CD < STRIKE_CD) strike(p, w, hornsAt(cx, cy), 0.2 * ramp, 0.7);
      });
    } else {
      strike(p, w, from, 1);
      for (const [hx, hy] of from) muzzle(p, w, hx, hy, 24);
    }
    nullify(p, w, p.x, p.y, from);
  },

  renderBelow(p, b, x, y) {
    const u = p.ps.cannon;
    if (!u || u.fade <= 0) return;
    // From between the horns (the clones' heads in focus).
    const [hx, hy] = miguerreArt.animatedAnchor(p, 'core', x, y), [ax, ay] = miguerreArt.anchor('core');
    renderCannon(p, b, hx, hy, u.w, u.fade, 0);
    if (u.side > 0.02) {
      const cl = clonesOf(p);
      for (const k of SIDE) renderCannon(p, b, cl[k][0] + ax + (x - p.x), cl[k][1] + ay + (y - p.y), u.w, u.fade * u.side, k + 1);
    }
  },

  renderFx(p, b) {
    renderFear(p, b);
    renderCrescent(p, b);
    renderBeams(p, b);
  },
};
