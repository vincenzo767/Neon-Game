import { mirrorPath, chrome, neonLines, outline, canopy, glowDot } from '../fx/art.js';
import { TAU, W, H, ringPulse, targets, shipScale } from './common.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL } from '../core/damage.js';
import { FADE_OUT } from '../fx/Particles.js';
import { daxArt, PAL } from './daxArt.js';
import {
  daxFxSprites, renderBeams, hitSpark, burst, voidExhaust, renderGhost,
  renderCrescent, renderRods, renderCannon,
} from './daxFx.js';

// DAX MORROW — OVERCLOCK (void knight) · LEGENDARY
// Void Beam: instant zigzag beams that chain through every enemy at any range,
// destroy normal enemies in one hit and erase attacks aimed at him
// Focus: Ghost Launch (a smoke ghost and five clones fire; he is intangible)
// Special: Void Crescent · Bomb: Void Rod Rain (5 s) · Ultimate: Void Cannon (7 s)
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
const CLONES = [[-66, 28], [-36, -16], [36, -16], [66, 28], [0, 44]];

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

/** Every target, ordered as one chain: nearest to the origin, then nearest to the last (no range limit). */
function chainAll(w, x, y, max = 64) {
  const left = targets(w), out = [];
  let cx = x, cy = y;
  while (left.length && out.length < max) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = (left[i].x - cx) ** 2 + (left[i].y - cy) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    const e = left.splice(bi, 1)[0];
    out.push(e); cx = e.x; cy = e.y;
  }
  return out;
}

/**
 * One void strike from (x0, y0): an instant beam that chains through every
 * enemy. Normal enemies die (through shields); bosses and mid-bosses take
 * `bossMul` × bossDmg. Bullets the beam crosses are erased.
 */
function strike(p, w, x0, y0, bossMul, wide = 1) {
  const ps = p.ps, d = bossDmg(p.tier) * bossMul;
  const chain = chainAll(w, x0, y0);
  const pts = [[x0, y0]];
  let px = x0, py = y0;
  chain.forEach((e, k) => {
    const ex = e.x, ey = e.y;
    w.cancelLine(px, py, ex, ey, 14);
    if (isBoss(e)) w.damage(e, k === 0 ? d : d * 0.7, DMG_IGNORES_SHIELDS);
    else { w.damage(e, 1, KILL); if (!e.alive) burst(w, ex, ey, 0.7); }
    pts.push([ex, ey]); px = ex; py = ey;
  });
  if (!chain.length) {
    // Nothing to chase: the beam cracks straight ahead.
    const tx = x0 + w.fxRng.range(-30, 30), ty = y0 - 320;
    w.damageLine(x0, y0, tx, ty, 12, d);
    w.cancelLine(x0, y0, tx, ty, 14);
    pts.push([tx, ty]);
  } else if ((p.t >> 2) & 1) {
    hitSpark(w, chain[0].x, chain[0].y + chain[0].r * 0.4, Math.PI / 2);
  }
  ps.bolts.push({ pts, t: 0, life: 6, w: 9 * wide, s: w.fxRng.next() * 100 });
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
const clonesOf = (p) => CLONES.map(([dx, dy], k) => [p.x + dx + Math.sin(p.t * 0.05 + k) * 4, p.y + dy + Math.cos(p.t * 0.06 + k * 2) * 3]);

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
    main: 'Void Beam — instant beams that chain through every enemy at any range, one-hit kills (not bosses), erase attacks aimed at him',
    focus: 'Ghost Launch — a smoke ghost and five clones fire void beams; completely intangible',
  },
  art: daxArt,
  special: {
    name: 'VOID CRESCENT',
    desc: 'A gigantic void crescent drifts forward, erasing every attack it touches and burning what it crosses',
    cooldown: 600,
    duration: 300,
    activate(p, w) {
      p.ps.crescent = { x: p.x, y: p.y - 70, w: 260, t: 0, life: 300 };
      w.r.post.flash(1, 0.15, 0.2, 0.25, 0.06);
      w.r.post.shockwave(p.x, p.y - 70, 0.04, 0.02, 0.5);
      w.g.camera.addTrauma(0.3);
    },
    update(p, w, t) {
      const c = p.ps.crescent;
      if (!c) return;
      c.t = t;
      c.y -= 1.8;
      // The crescent's arc as nine circles: attacks touching it vanish; what it crosses burns.
      const R = c.w * 0.42, hit = new Set();
      for (let k = 0; k <= 8; k++) {
        const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.2, px = c.x + Math.cos(a) * R, py = c.y + 30 + Math.sin(a) * R * 0.75;
        w.cancelCircle(px, py, 40);
        if (t % 5 === 0) for (const e of targets(w)) if ((e.x - px) ** 2 + (e.y - py) ** 2 < (40 + e.r) ** 2) hit.add(e);
      }
      for (const e of hit) { w.damage(e, 5, DMG_IGNORES_SHIELDS); if (!e.alive) burst(w, e.x, e.y, 0.8); }
    },
    end(p) { p.ps.crescent = null; },
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
    activate(p, w) {
      p.ps.cannon = { w: 150, fade: 0 };
      w.r.post.flash(1, 0.1, 0.15, 0.5, 0.05);
    },
    update(p, w, t) {
      const u = p.ps.cannon;
      if (!u) return;
      u.fade = Math.min(1, t / 12) * (t > 400 ? (420 - t) / 20 : 1);
      const bm = w.beam(p.x, p.y - 20, p.x, -30, u.w, 2.6, RED, 1, DMG_IGNORES_SHIELDS);
      bm.skin = true;
      w.cancelLine(p.x, p.y - 20, p.x, -30, u.w * 1.1);
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
    ps.bolts = [];
    ps.arcs = [];
    ps.rods = [];
    ps.ghost = null;
    ps.crescent = null;
    ps.cannon = null;
  },

  reset(p) { p.ps.ghost = null; p.ps.bolts = []; p.ps.arcs = []; },

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
      if (p.t % 3 === 0) smokeBurst(w, p.x + w.fxRng.range(-14, 14), p.y + 18, 1, false);
    }
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
      // Five clones, staggered over the clone cycle.
      clonesOf(p).forEach(([cx, cy], k) => { if ((p.t + k * 2) % CLONE_CD < STRIKE_CD) strike(p, w, cx, cy, 0.2, 0.7); });
    } else {
      const [cx, cy] = daxArt.anchor('core');
      strike(p, w, p.x + cx, p.y + cy, 1);
      muzzle(p, w, p.x + cx, p.y + cy, 30);
    }
    nullify(p, w, p.x, p.y);
  },

  renderBelow(p, b, x, y) {
    if (p.ps.cannon) renderCannon(p, b, x, y - 24);
  },

  renderFx(p, b) {
    renderCrescent(p, b);
    renderBeams(p, b);
    renderRods(p, b);
  },
};
