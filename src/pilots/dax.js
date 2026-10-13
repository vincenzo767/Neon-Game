import { mirrorPath, chrome, neonLines, outline, canopy, glowDot } from '../fx/art.js';
import { TAU, W, H, ringPulse, targets, shipScale } from './common.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL } from '../core/damage.js';
import { FADE_OUT } from '../fx/Particles.js';
import { daxArt, PAL } from './daxArt.js';
import {
  daxFxSprites, renderBeams, hitSpark, burst, voidExhaust, renderGhost,
  renderCrescent, renderRods, renderCannon, ghostSmoke, crescentPts, crescentSmoke, cannonSpray, CHAIN_FADE,
} from './daxFx.js';

// DAX MORROW — OVERCLOCK (void knight) · LEGENDARY
// Void Beam: an instant straight beam to the nearest enemy; from there it races
// on, enemy to enemy, at any range (a visible chain), destroying normal enemies
// in one hit and erasing attacks in its path and around him
// Focus: Ghost Launch (a smoke ghost and five clones fire; he is intangible)
// Special: Void Crescent · Bomb: Void Rod Rain (5 s) · Ultimate: Void Cannon (7 s)
// In focus the two outermost clones cast the crescent and fire the cannon too.
//
// DAX ART TEST: the hand-made mecha art (daxArt.js) replaces drawShip() when it
// loads; drawShip() stays as the automatic fallback. Every beam leaves the red
// chest core (owner's choice); the legs (feet) never fire.

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

/** Nearest live target to (x, y) that this chain hasn't hit yet (no range limit). */
function nextTarget(w, x, y, hit) {
  let best = null, bd = Infinity;
  for (const e of targets(w)) {
    if (hit.has(e)) continue;
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

/**
 * One void strike from (x0, y0): an instant straight beam to the nearest
 * enemy, then a chain that races on from enemy to enemy (stepChains).
 * Bullets the beam crosses are erased.
 */
function strike(p, w, x0, y0, bossMul, wide = 1) {
  const ps = p.ps, R = w.fxRng, e = nextTarget(w, x0, y0, new Set());
  if (!e) {
    // Nothing to chase: the beam cracks straight ahead.
    const tx = x0 + R.range(-30, 30), ty = y0 - 320;
    w.damageLine(x0, y0, tx, ty, 12, bossDmg(p.tier) * bossMul);
    w.cancelLine(x0, y0, tx, ty, 14);
    ps.bolts.push({ pts: [[x0, y0], [tx, ty]], t: 0, life: 6, w: 9 * wide, s: R.next() * 100 });
    return;
  }
  const ex = e.x, ey = e.y;
  w.cancelLine(x0, y0, ex, ey, 14);
  hitEnemy(p, w, e, bossMul);
  if ((p.t >> 2) & 1) hitSpark(w, ex, ey + e.r * 0.4, Math.PI / 2);
  ps.bolts.push({ pts: [[x0, y0], [ex, ey]], t: 0, life: 6, w: 9 * wide, s: R.next() * 100 });
  const hit = new Set([e]);
  const next = nextTarget(w, ex, ey, hit);
  if (next) ps.chains.push({ x: ex, y: ey, lx: ex, ly: ey, e: next, hit, hops: 1, segs: [], w: 9 * wide, mul: bossMul * 0.7, s: R.next() * 100 });
}

/** Chains race toward their next enemy; on arrival they hit it and pick the next one. */
function stepChains(p, w) {
  const ps = p.ps;
  for (const c of ps.chains) {
    let move = CHAIN_SPEED;
    while (c.e && move > 0) {
      if (!c.e.alive) { // someone else got it: turn toward the next one from here
        if (Math.hypot(c.x - c.lx, c.y - c.ly) > 2) { c.segs.push({ x0: c.lx, y0: c.ly, x1: c.x, y1: c.y, t: p.t }); c.lx = c.x; c.ly = c.y; }
        c.e = nextTarget(w, c.x, c.y, c.hit);
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
        c.e = ++c.hops < CHAIN_MAX ? nextTarget(w, c.x, c.y, c.hit) : null;
      } else {
        c.x += dx / d * move; c.y += dy / d * move; move = 0;
        w.cancelLine(px, py, c.x, c.y, 14);
      }
    }
  }
  if (ps.chains.length) ps.chains = ps.chains.filter((c) => c.e || (c.segs.length && p.t - c.segs[c.segs.length - 1].t < CHAIN_FADE));
  for (const c of ps.chains) if (c.segs.length > 6) c.segs = c.segs.filter((g) => p.t - g.t < CHAIN_FADE);
}

/** The beam also chases down attacks coming at (x, y): arcs to the nearest bullets, then erases all close ones. */
function nullify(p, w, x, y) {
  const B = w.bullets, near = [];
  for (let i = 0; i < B.count; i++) {
    const d = (B.x[i] - x) ** 2 + (B.y[i] - y) ** 2;
    if (d < NULL_R * NULL_R) near.push([d, B.x[i], B.y[i]]);
  }
  if (!near.length) return;
  near.sort((a, b) => a[0] - b[0]);
  for (const [, bx, by] of near.slice(0, 4)) p.ps.arcs.push({ x0: x, y0: y, x1: bx, y1: by, t: 0, life: 5 });
  w.cancelCircle(x, y, NULL_R);
}

function muzzle(p, w, x, y, size = 30) {
  const fx = daxArt.frames().fx, Hp = w.fxHigh;
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
  id: 'dax',
  name: 'DAX MORROW',
  vehicle: 'OVERCLOCK',
  role: 'Void Knight',
  legendary: true,
  bio: 'Street racer with more tickets than flight hours, until he crashed through the edge of the Grid into the void and something answered. Dax came back flying the Overclock, a black-and-red void knight whose beams never miss and never stop.',
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
    focus: 'Ghost Launch — a smoke ghost and five clones fire void beams; completely intangible',
  },
  art: daxArt,
  special: {
    name: 'VOID CRESCENT',
    desc: 'A gigantic void crescent sweeps forward, erasing every attack it touches and burning what it crosses (three in focus)',
    cooldown: 600,
    duration: 300,
    activate(p, w) {
      // In focus the two outermost clones cast one too.
      const at = [[p.x, p.y]];
      if (p.ps.ghost) for (const k of SIDE) at.push(clonesOf(p)[k]);
      p.ps.crescents = at.map(([x, y]) => ({ x, y: y - 110, w: 300, t: 0, life: 300 }));
      w.r.post.flash(1, 0.15, 0.2, 0.25, 0.06);
      w.r.post.shockwave(p.x, p.y - 70, 0.04, 0.02, 0.5);
      w.g.camera.addTrauma(0.3);
    },
    update(p, w, t) {
      for (const c of p.ps.crescents) {
        c.t = t;
        c.y -= CRESCENT_SPEED;
        crescentSmoke(w, c);
        // The crescent's band as circles: attacks touching it vanish; what it crosses burns.
        const hit = new Set();
        for (const q of crescentPts(c, 12)) {
          const r = q.th / 2 + 18;
          w.cancelCircle(q.mx, q.my, r);
          if (t % 5 === 0) for (const e of targets(w)) if ((e.x - q.mx) ** 2 + (e.y - q.my) ** 2 < (r + e.r) ** 2) hit.add(e);
        }
        for (const e of hit) { w.damage(e, 5, DMG_IGNORES_SHIELDS); if (!e.alive) burst(w, e.x, e.y, 0.8); }
      }
    },
    end(p) { p.ps.crescents = []; },
  },
  bomb: {
    name: 'VOID ROD RAIN',
    duration: 300, // 5 s
    activate(p, w) { p.ps.rods = []; w.r.post.flash(1, 0.1, 0.15, 0.3, 0.06); },
    update(p, w, t) {
      w.cancelAll();
      const ps = p.ps, R = w.rng;
      // Countless rods: two a step (a big one every 12), half aimed at enemies.
      if (t <= 288) for (let k = 0; k < 2; k++) {
        const T = targets(w), e = T.length && R.chance(0.5) ? R.pick(T) : null;
        const tx = e ? e.x + R.range(-10, 10) : R.range(10, W - 10), ty = e ? e.y : R.range(30, H - 110);
        ps.rods.push({ x: tx - 2 * (ty + 60) / 30, y: -40 - R.range(0, 60), tx, ty, vx: 2, vy: 30, big: k === 0 && t % 12 === 0 });
      }
      for (const r of ps.rods) {
        r.x += r.vx; r.y += r.vy;
        if (r.y < r.ty) continue;
        r.dead = true;
        w.damageCircle(r.tx, r.ty, r.big ? 90 : 52, r.big ? 14 : 5, DMG_IGNORES_SHIELDS);
        burst(w, r.tx, r.ty, r.big ? 1.6 : 0.75);
        if (r.big) w.g.camera.addTrauma(0.12);
      }
      ps.rods = ps.rods.filter((r) => !r.dead);
    },
    end(p) { p.ps.rods = []; },
  },
  ultimate: {
    name: 'VOID CANNON',
    duration: 420, // 7 s; the Player is invulnerable for all of it
    // In focus the two outermost clones fire a cannon too (three in all).
    activate(p, w) {
      p.ps.cannon = { w: 150, fade: 0, side: p.ps.ghost ? 1 : 0 };
      w.r.post.flash(1, 0.1, 0.15, 0.5, 0.05);
    },
    update(p, w, t) {
      const u = p.ps.cannon;
      if (!u) return;
      u.fade = Math.min(1, t / 12) * (t > 400 ? (420 - t) / 20 : 1);
      u.side += ((p.ps.ghost ? 1 : 0) - u.side) * 0.15;
      const guns = [[p.x, p.y]];
      if (p.ps.ghost) for (const k of SIDE) guns.push(clonesOf(p)[k]);
      for (const [gx, gy] of guns) {
        const bm = w.beam(gx, gy - 20, gx, -30, u.w, 2.6, RED, 1, DMG_IGNORES_SHIELDS);
        bm.skin = true;
        w.cancelLine(gx, gy - 20, gx, -30, u.w * 1.1);
        cannonSpray(w, gx, gy - 24, u.w, gx !== p.x || gy !== p.y);
      }
      if (t % 30 === 0) { w.g.camera.addTrauma(0.2); w.r.post.shockwave(p.x, p.y - 60, 0.02, 0.02, 0.4); }
    },
    end(p) { p.ps.cannon = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_dax_${t}`, 46, 54, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    daxFxSprites(atlas);
    daxArt.buildSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip(p, b, x, y, a) {
    const g = p.ps.ghost;
    if (!g) return daxArt.renderMecha(p, b, x, y, a);
    // Focus: the body stays parked (untargetable); the ghost and its clones are smoke.
    const body = Object.create(p);
    body.focus = false;
    if (!daxArt.renderMecha(body, b, g.bx, g.by, a * 0.85)) return false;
    for (const [k, [cx, cy]] of clonesOf(p).entries()) renderGhost(p, b, cx, cy, 0.75 * a, k + 1);
    renderGhost(p, b, x, y, a, 0);
    return true;
  },
  exhaust: voidExhaust,
  hitSpark,
  /** Focus: completely intangible (every attack passes through; the body can't be targeted). */
  intangible: (p) => !!p.ps.ghost,
  /** tools/dps.mjs: normal enemies die in one hit, so measure against boss-flagged dummies. */
  dpsBossTargets: true,

  init(p, w) {
    const ps = p.ps;
    ps.fRod = w.r.frame('dx_rod');
    ps.fShard = w.r.frame('dx_shard');
    ps.fCresBody = w.r.frame('dx_cres_body');
    ps.fCresRim = w.r.frame('dx_cres_rim');
    ps.fOrb = w.r.frame('dx_orb');
    ps.chains = [];
    ps.bolts = [];
    ps.arcs = [];
    ps.rods = [];
    ps.ghost = null;
    ps.crescents = [];
    ps.cannon = null;
  },

  reset(p) { p.ps.ghost = null; p.ps.bolts = []; p.ps.chains = []; p.ps.arcs = []; },

  update(p, w) {
    daxArt.animate(p);
    const ps = p.ps;
    // Ghost Launch: on focus the ghost dashes forward; the body stays where it was.
    const focusing = p.focus && p.state === 'alive';
    if (focusing && !ps.ghost) {
      ps.ghost = { bx: p.x, by: p.y, t: 0, ty: Math.max(50, p.y - LAUNCH) };
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
    if (ps.ghost) {
      strike(p, w, p.x, p.y, 0.55);
      muzzle(p, w, p.x, p.y, 26);
      // Five clones, staggered over the clone cycle (the outer two are busy firing cannons during the ultimate).
      clonesOf(p).forEach(([cx, cy], k) => {
        if (ps.cannon && SIDE.includes(k)) return;
        if ((p.t + k * 2) % CLONE_CD < STRIKE_CD) strike(p, w, cx, cy, 0.2, 0.7);
      });
    } else {
      const [cx, cy] = daxArt.anchor('core');
      strike(p, w, p.x + cx, p.y + cy, 1);
      muzzle(p, w, p.x + cx, p.y + cy, 30);
    }
    nullify(p, w, p.x, p.y);
  },

  renderBelow(p, b, x, y) {
    const u = p.ps.cannon;
    if (!u) return;
    renderCannon(p, b, x, y - 24, u.w, u.fade, 0);
    if (u.side > 0.02) {
      const cl = clonesOf(p);
      for (const k of SIDE) renderCannon(p, b, cl[k][0] + (x - p.x), cl[k][1] + (y - p.y) - 24, u.w, u.fade * u.side, k + 1);
    }
  },

  renderFx(p, b) {
    renderCrescent(p, b);
    renderBeams(p, b);
    renderRods(p, b);
  },
};
