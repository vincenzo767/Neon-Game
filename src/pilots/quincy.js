import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, TAU, W, muzzle, ringPulse, targets, shipScale } from './common.js';

// QUINCY — ARROWHEAD (placeholder mecha; procedural until her art arrives)
// Ability "Arrow": she redirects any attack. Enemy bullets near her turn
// into homing brass arrows aimed at the nearest enemy; enemy lasers that
// cross her are sent back down their own line into whoever fired them.
// Special: Arrow · Bomb: Vector Storm · Ultimate: All Roads Lead Back

const BRASS = [1.0, 0.78, 0.35];
const STEEL = [0.55, 0.8, 1.0];
const ARROW_R = 150;  // Arrow (special) redirect radius
const FIELD_R = 120;  // ultimate redirect field radius

/**
 * Redirect every enemy bullet within r of (x, y) (r < 0: the whole screen)
 * into a homing player arrow aimed at the nearest enemy.
 */
function redirectBullets(p, w, x, y, r, dmg) {
  const B = w.bullets, S = w.shots, H = w.fxHigh;
  const tg = targets(w), r2 = r * r, fid = p.ps.fArrow.id;
  let i = 0, n = 0;
  while (i < B.count) {
    const bx = B.x[i], by = B.y[i], dx = bx - x, dy = by - y;
    if (r >= 0 && dx * dx + dy * dy > r2) { i++; continue; }
    let best = null, bd = 1e12;
    for (const e of tg) { const d = (e.x - bx) ** 2 + (e.y - by) ** 2; if (d < bd) { bd = d; best = e; } }
    const a = best ? Math.atan2(best.y - by, best.x - bx) : UP;
    const si = S.spawn(bx, by, a, 12, fid, 0, 6, 1);
    if (si >= 0) S.behave(si, dmg, 110, 0, 0.12);
    if ((n & 3) === 0) {
      const k = H.spawn(p.F.glow, bx, by, 0, 0, 10);
      if (k >= 0) { H.size(k, 16, 4); H.color(k, BRASS[0] * 2, BRASS[1] * 2, BRASS[2] * 2); H.look(k, 0.7, 1); }
    }
    B.remove(i);
    n++;
  }
  return n;
}

/** Send back every live enemy laser that passes within r of (x, y): it dies and its owner takes the hit. */
function redirectLasers(p, w, x, y, r, dmg) {
  for (const L of w.lasers) {
    if (L.dead || !L.owner.alive) continue;
    const x1 = L.x0 + Math.cos(L.ang) * L.len, y1 = L.y0 + Math.sin(L.ang) * L.len;
    const dx = x1 - L.x0, dy = y1 - L.y0;
    let t = ((x - L.x0) * dx + (y - L.y0) * dy) / (dx * dx + dy * dy || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    if ((L.x0 + dx * t - x) ** 2 + (L.y0 + dy * t - y) ** 2 > r * r) continue;
    L.dead = true;
    w.damage(L.owner, dmg);
    w.beam(x, y, L.owner.x, L.owner.y, 10, 0, BRASS);
    ringPulse(w, L.owner.x, L.owner.y, BRASS, 10, 60, 14);
  }
}

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Arrowhead frame: a long brass spearhead with swept fletching wings.
  mirrorPath(ctx, cx, [0, 0, 3, 8, 6, 18, 16, 34, 17, 42, 9, 38, 6, 46, 3, 50, 0, 49]);
  ctx.fillStyle = chrome(ctx, cx - 10, cx + 10, '#14100a', '#6a5430', '#f0d898'); ctx.fill(); outline(ctx);
  // Black coat-panel spine.
  mirrorPath(ctx, cx, [0, 10, 3, 18, 4, 36, 2, 46, 0, 46]);
  ctx.fillStyle = '#0c0d14'; ctx.fill(); outline(ctx, 0.5);
  // Fletching notches (more with tier).
  for (let k = 0; k < Math.min(4, tier + 1); k++) for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(140,200,255,0.9)';
    ctx.fillRect(cx + s * (8 + k * 2) - 0.7, 30 + k * 2.5, 1.4, 3);
  }
  // Goggle lenses on the brow.
  for (const s of [-1, 1]) glowDot(ctx, cx + s * 3.2, 14, 1.6, 'rgba(160,220,255,1)');
  if (tier >= 4) neonLines(ctx, cx, [3, 8, 16, 34, 6, 18, 9, 38], 'rgba(255,210,120,1)', 0.8, 6);
  canopy(ctx, cx, 22, 2.4, 4.2, '#ffffff', '#ffd890', '#2a1a06');
}

function drawArrow(ctx, w, h) {
  // Brass arrow, pointing right (shots rotate to their heading).
  const cy = h / 2;
  ctx.strokeStyle = 'rgba(255,230,170,1)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(2, cy); ctx.lineTo(w - 6, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 1, cy); ctx.lineTo(w - 7, cy - 3); ctx.lineTo(w - 7, cy + 3); ctx.closePath();
  ctx.fillStyle = '#fff4d8'; ctx.fill();
  ctx.fillStyle = 'rgba(140,200,255,0.95)';
  ctx.beginPath(); ctx.moveTo(1, cy - 3); ctx.lineTo(5, cy); ctx.lineTo(1, cy + 3); ctx.lineTo(3, cy); ctx.closePath(); ctx.fill();
}

function drawVane(ctx, w, h) {
  // Option drone: a small fletching vane.
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 0, 4, 6, 3, 10, 0, 8]);
  ctx.fillStyle = chrome(ctx, cx - 4, cx + 4, '#14100a', '#6a5430', '#f0d898'); ctx.fill(); outline(ctx, 0.6);
  glowDot(ctx, cx, 5, 1.2, 'rgba(160,220,255,1)');
}

export default {
  id: 'quincy',
  name: 'QUINCY',
  vehicle: 'ARROWHEAD',
  role: 'Redirect Mecha',
  bio: 'A courier in a black greatcoat and brass goggles who never misses a delivery. Quincy does not dodge an attack — she points it somewhere else.',
  color: BRASS,
  css: '#ffc75a',
  stats: { speed: 4, power: 3, range: 4, bomb: 3 },
  speed: { normal: 4.9, focus: 2.1 },
  hitbox: 2.2,
  bombStock: 3,
  engines: [[-5, 46], [5, 46]],
  engineColor: STEEL,
  optionSprite: 'q_vane',
  // Procedural fallback, matched to portrait.jpg (blonde bob, blue eyes, peaked cap, black coat).
  portrait: { skin: '#f2d6c0', hair: '#e8d68a', style: 'long', eyes: 'goggles', iris: '#8ac8ff', suit: '#14141c' },
  weapons: {
    main: 'Arrow Volley — homing brass arrows; the spread widens with tier',
    focus: 'True Line — fast piercing arrows straight ahead',
  },
  special: {
    name: 'ARROW',
    desc: `Redirects every enemy bullet within range into homing arrows, and sends crossing lasers back at their owners`,
    cooldown: 7,
    duration: 0,
    activate(p, w) {
      redirectBullets(p, w, p.x, p.y, ARROW_R, 1.4);
      redirectLasers(p, w, p.x, p.y, ARROW_R * 0.5, 18);
      ringPulse(w, p.x, p.y, BRASS, 20, ARROW_R, 16);
      w.r.post.shockwave(p.x, p.y, 0.02, 0.02, 0.4);
    },
  },
  bomb: {
    name: 'VECTOR STORM',
    duration: 120,
    activate(p) { p.ps.storm = 0; },
    update(p, w, t) {
      // Every bullet on screen, every step, turns on its shooter.
      redirectBullets(p, w, p.x, p.y, -1, 1.6);
      redirectLasers(p, w, p.x, p.y, 2000, 2);
      p.ps.storm = t;
      if (t % 30 === 0) { ringPulse(w, p.x, p.y, BRASS, 30, 420, 24, 0.6); w.g.camera.addTrauma(0.25); }
    },
    end(p) { p.ps.storm = null; },
  },
  ultimate: {
    name: 'ALL ROADS LEAD BACK',
    duration: 360,
    activate(p, w) {
      p.ps.field = true;
      w.r.post.flash(1, 0.85, 0.5, 0.6, 0.03);
      w.g.camera.addTrauma(0.6);
    },
    update(p, w, t) {
      // A redirect field rides with her, and arrows rain in from both screen edges.
      redirectBullets(p, w, p.x, p.y, FIELD_R, 2.2);
      redirectLasers(p, w, p.x, p.y, FIELD_R, 6);
      if (t % 6 === 0) {
        const tg = targets(w);
        for (const s of [-1, 1]) {
          const x = s < 0 ? 0 : W;
          const y = 120 + ((t * 37 + (s > 0 ? 200 : 0)) % 520);
          const e = tg.length ? tg[(t / 6 + (s > 0 ? 1 : 0)) % tg.length | 0] : null;
          const a = e ? Math.atan2(e.y - y, e.x - x) : (s < 0 ? -0.6 : Math.PI + 0.6);
          const i = w.shot(x, y, a, 14, p.ps.fArrow, 2.5, 7, 1.3);
          if (i >= 0) w.shots.behave(i, 2.5, 120, 1, 0.1);
        }
      }
      if (t % 45 === 0) w.r.post.shockwave(p.x, p.y, 0.015, 0.02, 0.5);
    },
    end(p) { p.ps.field = false; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_quincy_${t}`, 36, 52, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('q_arrow', 18, 8, drawArrow, { scale: s });
    atlas.add('q_vane', 9, 11, drawVane, { scale: s });
    atlas.add('q_bolt', 16, 6, (c, w, h) => drawBolt(c, w, h, 'rgba(255,210,120,1)'), { scale: s });
  },

  init(p, w) {
    p.ps.fArrow = w.r.frame('q_arrow');
    p.ps.fBolt = w.r.frame('q_bolt');
    p.ps.storm = null;
    p.ps.field = false;
  },

  reset(p) { p.ps.storm = null; p.ps.field = false; },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const o = p.focus ? [[-10, -6], [10, -6]] : [[-24, 10], [24, 10]];
    return t >= 4 ? [...o, ...(p.focus ? [[-18, 6], [18, 6]] : [[-38, 22], [38, 22]])] : o;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots;
    if (p.focus) {
      p.fireCd = 4;
      for (const ox of t >= 3 ? [-4, 4] : [0]) {
        const i = w.shot(p.x + ox, p.y - 24, UP, 16, p.ps.fArrow, 1.4, 6, 1.1);
        if (i >= 0) S.behave(i, 1.4, 60, 1);
      }
    } else {
      p.fireCd = 6;
      const n = 1 + t; // 2..5 arrows
      for (let k = 0; k < n; k++) {
        const a = UP + (n > 1 ? (k / (n - 1) - 0.5) * (0.3 + 0.12 * t) : 0);
        const i = w.shot(p.x, p.y - 22, a, 12, p.ps.fArrow, 1.1, 6, 1);
        if (i >= 0) S.behave(i, 1.1, 70, 0, 0.05);
      }
    }
    muzzle(w, p.x, p.y - 24, BRASS, 10);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 14, p.ps.fBolt, 0.5, 5, 0.8);
      if (i >= 0) S.behave(i, 0.5, 60, 0, 0.04);
    }
  },

  renderAbove(p, b, x, y) {
    // Arrow readiness: a brass ring hints the redirect radius while the special is ready.
    if (p.specialCd <= 0) {
      const k = 0.5 + 0.5 * Math.sin(p.t * 0.1);
      b.draw(p.F.ring, x, y, 30 + 4 * k, 30 + 4 * k, 0, BRASS[0], BRASS[1], BRASS[2], 0.18 + 0.12 * k, 1);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    if (p.ps.field) {
      const el = p.def.ultimate.duration - p.ultT;
      const fade = Math.min(1, el / 20, p.ultT / 30);
      const d = FIELD_R * 2.15;
      b.draw(F.ring, p.x, p.y, d, d, 0, BRASS[0] * 1.6, BRASS[1] * 1.6, BRASS[2] * 1.6, 0.55 * fade, 1);
      b.draw(F.glow, p.x, p.y, FIELD_R * 1.4, FIELD_R * 1.4, 0, BRASS[0], BRASS[1], BRASS[2], 0.12 * fade, 1);
      for (let k = 0; k < 6; k++) {
        const a = el * 0.05 + (k / 6) * TAU;
        b.draw(F.laser, p.x + Math.cos(a) * FIELD_R, p.y + Math.sin(a) * FIELD_R, 18, 4, a + Math.PI / 2, 2, 1.6, 0.8, 0.7 * fade, 1);
      }
    }
    if (p.ps.storm != null) {
      const a = 1 - p.ps.storm / 120;
      b.draw(F.glow, p.x, p.y, 220, 220, 0, BRASS[0], BRASS[1], BRASS[2], 0.2 * a, 1);
    }
  },
};
