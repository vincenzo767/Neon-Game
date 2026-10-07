import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { SHOT_FLAK } from '../entities/World.js';
import { UP, TAU, W, H, muzzle, ringPulse, mote, targets, shipScale } from './common.js';

// ZURI ANKARA — SOLAR FANG (sunskiff)
// Charge beam that grows with hold time: hold focus + fire and the beam
// widens and hardens (up to 3 seconds); release focus with a full charge to
// throw a Solar Lance. Main: translucent solar darts.
// Special: Solar Flare · Bomb: Corona · Ultimate: Miniature-Sun Collapse

const SUN = [1.0, 0.95, 0.75];
const CORE = [1.0, 1.0, 0.95];
const CHARGE_MAX = 180;

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Solar sail fins (fan out with tier).
  for (let k = 0; k < 1 + tier; k++) for (const s of [-1, 1]) {
    const a = s * (0.35 + k * 0.28);
    ctx.save(); ctx.translate(cx, 30); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, -24 + k * 2); ctx.lineTo(2, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -24);
    g.addColorStop(0, '#3a2a10'); g.addColorStop(1, 'rgba(255,240,180,0.95)');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  // Skiff hull: a fang.
  mirrorPath(ctx, cx, [0, 0, 3, 10, 6, 26, 9, 38, 5, 46, 0, 44]);
  ctx.fillStyle = chrome(ctx, cx - 9, cx + 9, '#140e06', '#6a5a3a', '#f0e4c0'); ctx.fill(); outline(ctx);
  // Sun core (bigger with tier).
  glowDot(ctx, cx, 32, 4 + tier, 'rgba(255,240,170,1)');
  ctx.beginPath(); ctx.arc(cx, 32, 2.2 + tier * 0.5, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (tier >= 4) { ctx.beginPath(); ctx.arc(cx, 32, 9, 0, TAU); ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 0.8; ctx.stroke(); }
  neonLines(ctx, cx, [3, 10, 6, 26, 9, 38, 5, 46], 'rgba(255,240,180,1)', 0.6, 5);
  canopy(ctx, cx, 16, 2.2, 4.4, '#ffffff', '#fff0b0', '#2a1a06');
}

function drawMirror(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.moveTo(cx, 1); ctx.lineTo(w - 1, cy); ctx.lineTo(cx, h - 1); ctx.lineTo(1, cy); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#8a7240');
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
}

const dartSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(255,245,200,0.75)', '#ffffff');

export default {
  id: 'zuri',
  name: 'ZURI ANKARA',
  vehicle: 'SOLAR FANG',
  role: 'Sunskiff',
  bio: 'A solar-skiff smuggler turned informant, she charts where the Choir lands its crystal pods. Zuri is patient: the longer she holds the trigger, the brighter the sky gets.',
  color: SUN,
  css: '#ffe89a',
  stats: { speed: 4, power: 4, range: 5, bomb: 2 },
  speed: { normal: 4.8, focus: 1.9 },
  hitbox: 2.2,
  bombStock: 2,
  engines: [[0, 22]],
  engineColor: [1.0, 0.9, 0.6],
  optionSprite: 'z_mirror',
  optionSpin: 0.03,
  portrait: { skin: '#6a4430', hair: '#1a1210', style: 'afro', eyes: 'eyes', iris: '#f0c040', accent: 'tattoo', suit: '#302814' },
  weapons: {
    main: 'Solar Darts — translucent light darts',
    focus: 'Fang Beam — grows with hold time; release at full charge for a Solar Lance',
  },
  special: {
    name: 'SOLAR FLARE',
    desc: 'A blinding forward flare erases bullets in a wide cone',
    cooldown: 480,
    duration: 16,
    activate(p, w) { w.r.post.flash(1, 0.95, 0.8, 0.5, 0.04); w.r.post.aberrate(0.012); },
    update(p, w, t) {
      for (const da of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const a = UP + da, L = 120 + t * 22;
        w.cancelLine(p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, 40);
      }
      if (t === 4) w.damageCircle(p.x, p.y - 140, 140, 8);
    },
  },
  bomb: {
    name: 'CORONA',
    duration: 100,
    activate(p) { p.ps.corona = { x: p.x, y: p.y, t: 0 }; },
    update(p, w, t) {
      const c = p.ps.corona;
      c.t = t;
      const r = Math.min(420, t * 7);
      w.cancelAll();
      for (const e of w.enemies.active) {
        if (!e.alive || e.lastBomb === w.bombId) continue;
        if (Math.hypot(e.x - c.x, e.y - c.y) < r + e.r) { e.lastBomb = w.bombId; w.damage(e, 28); }
      }
      for (let k = 0; k < 6; k++) { const a = w.fxRng.angle(); mote(w, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.cos(a) * 2, Math.sin(a) * 2, SUN, 12, 18); }
    },
    end(p) { p.ps.corona = null; },
  },
  ultimate: {
    name: 'MINIATURE-SUN COLLAPSE',
    duration: 270,
    activate(p) { p.ps.sun = { x: W / 2, y: H * 0.3, r: 4, t: 0 }; },
    update(p, w, t) {
      const s = p.ps.sun;
      s.t = t;
      const B = w.bullets;
      if (t < 200) {
        s.r = Math.min(110, 4 + t * 0.8);
        // Gravity: every bullet falls into the sun.
        for (let i = 0; i < B.count; i++) {
          const dx = s.x - B.x[i], dy = s.y - B.y[i];
          B.dyn[i] = 0; B.setHeading(i, Math.atan2(dy, dx), Math.min(9, B.spd[i] + 0.4));
        }
        w.cancelCircle(s.x, s.y, s.r);
        if (t % 3 === 0) w.damageCircle(s.x, s.y, s.r * 2.2, 1.2);
      } else if (t < 230) {
        s.r *= 0.85; // collapse
        w.cancelAll();
      } else if (t === 230) {
        w.explosions.blast(s.x, s.y, 3.2, SUN);
        for (const e of targets(w)) w.damage(e, 50);
        w.r.post.flash(1, 1, 0.9, 0.9, 0.025);
        w.r.post.shockwave(s.x, s.y, 0.1, 0.03, 1.4);
        w.g.camera.addTrauma(1);
        w.g.hitStop(8);
        s.gone = true;
      } else w.cancelAll();
    },
    end(p) { p.ps.sun = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_zuri_${t}`, 50, 50, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('z_mirror', 10, 12, drawMirror, { scale: s });
    atlas.add('z_dart', 18, 5, dartSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fDart = w.r.frame('z_dart');
    p.ps.charge = 0;
  },

  reset(p) { p.ps.charge = 0; p.ps.sun = null; },

  update(p, w) {
    const charging = p.focus && p.firing;
    if (charging) p.ps.charge = Math.min(CHARGE_MAX, p.ps.charge + 1);
    else if (p.ps.charge > 0) {
      // Release: a full charge throws a Solar Lance.
      if (p.ps.charge >= CHARGE_MAX * 0.75) {
        const k = p.ps.charge / CHARGE_MAX;
        const i = w.shot(p.x, p.y - 30, UP, 10, p.ps.fDart, 30 * k, 18, 3.5 * k);
        if (i >= 0) w.shots.behave(i, 30 * k, 90, 0, 0, SHOT_FLAK, 70);
        ringPulse(w, p.x, p.y - 30, SUN, 8, 60, 14);
        w.g.camera.addTrauma(0.2);
        w.event('toast', { text: 'SOLAR LANCE!', cls: 'gold' });
      }
      p.ps.charge = 0;
    }
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const n = t >= 4 ? 4 : 2, out = [];
    for (let k = 0; k < n; k++) {
      const a = p.t * 0.03 + (k / n) * TAU;
      out.push(p.focus ? [(k % 2 ? 1 : -1) * (12 + (k >> 1) * 10), -6] : [Math.cos(a) * 28, Math.sin(a) * 12 - 6]);
    }
    return out;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots;
    if (p.focus) {
      // Fang beam: width and damage grow with hold time (it visually locks
      // on: the mirrors bend their light into it).
      const k = p.ps.charge / CHARGE_MAX;
      const wd = 4 + t + 40 * k;
      w.beam(p.x, p.y - 24, p.x, -20, wd, 0.15 + 0.03 * t + 0.85 * k, SUN);
      if (p.ps.charge >= CHARGE_MAX) w.cancelLine(p.x, p.y - 24, p.x, -20, wd * 0.5);
    }
    if (p.fireCd > 0) return;
    p.fireCd = 6;
    if (!p.focus) {
      const n = 2 + t;
      for (let k = 0; k < n; k++) {
        const a = UP + (k / (n - 1) - 0.5) * 0.32;
        const i = w.shot(p.x + (k - (n - 1) / 2) * 4, p.y - 20, a, 15, p.ps.fDart, 0.85, 5, 0.9 + 0.1 * t);
        if (i >= 0) S.behave(i, 0.85);
      }
      muzzle(w, p.x, p.y - 22, SUN, 10);
    }
    for (const o of p.options) {
      if (p.focus) continue; // mirrors feed the beam instead
      const i = w.shot(o.x, o.y - 6, UP, 15, p.ps.fDart, 0.55, 4);
      if (i >= 0) S.behave(i, 0.55);
    }
  },

  renderAbove(p, b, x, y) {
    const F = p.F, k = p.ps.charge / CHARGE_MAX;
    if (k > 0) {
      // Charge orb at the nose, and the mirrors' light bending into the beam.
      b.draw(F.glow, x, y - 26, 16 + 40 * k, 16 + 40 * k, 0, SUN[0], SUN[1], SUN[2], 0.4 + 0.5 * k, 1);
      if (k >= 1) b.draw(F.ring, x, y - 26, 50, 50, p.t * 0.2, 2, 1.9, 1.5, 0.8, 1);
      for (const o of p.options) b.draw(F.laser, (o.x + x) / 2, (o.y + y - 26) / 2, Math.hypot(o.x - x, o.y - y + 26), 4, Math.atan2(y - 26 - o.y, x - o.x), 1.8, 1.7, 1.2, 0.6, 1);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    const c = p.ps.corona;
    if (c) {
      const r = Math.min(420, c.t * 7), a = 1 - c.t / 100;
      b.draw(F.ring, c.x, c.y, r * 2.2, r * 2.2, 0, 2, 1.8, 1.2, a, 1);
      b.draw(F.glow, c.x, c.y, r * 1.4, r * 1.4, 0, 1, 0.8, 0.4, a * 0.3, 1);
    }
    const s = p.ps.sun;
    if (s && !s.gone) {
      const pulse = 1 + 0.06 * Math.sin(s.t * 0.4);
      b.draw(F.glow, s.x, s.y, s.r * 5 * pulse, s.r * 5 * pulse, 0, 1, 0.7, 0.3, 0.6, 1);
      b.draw(F.core, s.x, s.y, s.r * 2 * pulse, s.r * 2 * pulse, 0, 3, 2.8, 2.2, 1, 1);
      b.draw(F.ring, s.x, s.y, s.r * 4.4, s.r * 4.4, s.t * 0.02, CORE[0] * 2, CORE[1] * 1.8, CORE[2] * 1.2, 0.5, 1);
    }
  },
};
