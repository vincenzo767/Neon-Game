import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, TAU, W, H, clamp, muzzle, ringPulse, targets, shipScale } from './common.js';

// HOLT & HOLT — GEMINI (split-ship)
// Two ships. Unfocused they SPLIT: the twin flies the mirror image of your
// movement across the screen's centre line and both fire. Focus RECOMBINES
// them: the twin docks and the pair fires a single binary lance.
// The twin can't be hit (it's the brother flying wing, not a second life).
// Special: Tether (a damaging laser link between the twins)
// Bomb: Twin Cross · Ultimate: Binary Star

const CYAN = [0.35, 0.9, 1.0];
const ROSE = [1.0, 0.5, 0.8];

function drawShip(ctx, w, h, tier, neon, body) {
  const cx = w / 2;
  // Half-wing: the twins are mirror halves of one ship (fin on the outer side).
  mirrorPath(ctx, cx, [0, 2, 4, 10, 6, 24, 15, 32, 15, 37, 6, 36, 4, 44, 0, 45]);
  ctx.fillStyle = chrome(ctx, cx - 15, cx + 15, ...body); ctx.fill(); outline(ctx);
  // Docking clamps (glow when recombined).
  for (const s of [-1, 1]) { ctx.fillStyle = '#10141c'; ctx.fillRect(cx + s * 14 - 1.5, 30, 3, 6); glowDot(ctx, cx + s * 14, 33, 1.6, neon); }
  if (tier >= 2) {
    mirrorPath(ctx, cx, [6, 20, 12, 18, 12, 22, 6, 26]);
    ctx.fillStyle = '#121620'; ctx.fill(); outline(ctx, 0.5);
  }
  if (tier >= 3) for (const s of [-1, 1]) glowDot(ctx, cx + s * 10, 26, 2.2, neon);
  if (tier >= 4) neonLines(ctx, cx, [4, 10, 2, 2, 6, 24, 9, 14], neon, 0.8, 6);
  neonLines(ctx, cx, [6, 24, 15, 32, 4, 44, 6, 36], neon, 0.7, 5);
  canopy(ctx, cx, 15, 2.4, 4.4, '#ffffff', neon, '#081428');
}

function drawLink(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1, 0, TAU); ctx.strokeStyle = 'rgba(220,220,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
  glowDot(ctx, cx, cy, 2.4, 'rgba(255,255,255,1)');
}

const boltA = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(110,230,255,0.9)');
const boltB = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(255,150,210,0.9)');

/** Twin position: mirrored across the centre line when split, docked when focused. */
function twinTarget(p) {
  if (p.focus) return [p.x + 15, p.y + 1];
  return [clamp(W - p.x, 14, W - 14), p.y];
}

export default {
  id: 'holt',
  name: 'HOLT & HOLT',
  vehicle: 'GEMINI',
  role: 'Split-ship',
  bio: 'Twin salvage divers who mapped the drowned streets before the Covenant sealed them. They argue about everything except where to shoot.',
  color: CYAN,
  css: '#6ae0ff',
  stats: { speed: 4, power: 4, range: 4, bomb: 2 },
  speed: { normal: 4.8, focus: 2.1 },
  hitbox: 2.3,
  bombStock: 2,
  engines: [[0, 20]],
  engineColor: [0.4, 0.85, 1.0],
  optionSprite: 'h_link',
  portrait: {
    skin: '#e0b898', hair: '#20304a', style: 'spiky', eyes: 'eyes', iris: '#4ad0ff', accent: 'scar', badge: 'HOLT-A',
    twins: { hair: '#4a2030', style: 'bob', iris: '#ff6ab0', accent: 'freckles', badge: 'HOLT-B' },
  },
  weapons: {
    main: 'Split Fire — the twin mirrors your flight across the screen; both fire',
    focus: 'Binary Lance — the twins dock and fire one combined lance',
  },
  special: {
    name: 'TETHER',
    desc: 'A laser link between the twins cuts enemies and bullets for 3s',
    cooldown: 480,
    duration: 180,
    activate(p, w) { ringPulse(w, p.x, p.y, ROSE, 8, 50, 12); },
    update(p, w, t) {
      const tw = p.ps.twin;
      w.cancelLine(p.x, p.y, tw.x, tw.y, 12);
      if (t % 3 === 0) w.damageLine(p.x, p.y, tw.x, tw.y, 10, 1.6);
    },
  },
  bomb: {
    name: 'TWIN CROSS',
    duration: 100,
    activate(p) { p.ps.cross = 0; },
    update(p, w, t) {
      w.cancelAll();
      p.ps.cross = t;
      // Two diagonal beams sweep into an X centred on the screen.
      const k = Math.min(1, t / 40), a = 0.7 * k;
      for (const s of [-1, 1]) {
        const ang = Math.PI / 2 + s * a, L = 700;
        const x0 = W / 2 - Math.cos(ang) * L, y0 = H / 2 - Math.sin(ang) * L, x1 = W / 2 + Math.cos(ang) * L, y1 = H / 2 + Math.sin(ang) * L;
        w.beam(x0, y0, x1, y1, 50, 1.6, s > 0 ? CYAN : ROSE);
      }
    },
    end(p) { p.ps.cross = null; },
  },
  ultimate: {
    name: 'BINARY STAR',
    duration: 300,
    activate(p) { p.ps.binary = { t: 0, a: 0 }; },
    update(p, w, t) {
      w.cancelAll();
      const b = p.ps.binary;
      b.t = t;
      b.a += 0.07 + t * 0.0004;
      const r = Math.min(200, 40 + t * 1.2);
      b.stars = [0, Math.PI].map((o) => [W / 2 + Math.cos(b.a + o) * r, H * 0.42 + Math.sin(b.a + o) * r * 0.8]);
      for (const [x, y] of b.stars) if (t % 3 === 0) w.damageCircle(x, y, 46, 2.5);
      w.beam(b.stars[0][0], b.stars[0][1], b.stars[1][0], b.stars[1][1], 22, 0.9, [1, 0.8, 1]);
      if (t === 280) {
        for (const e of targets(w)) w.damage(e, 30);
        w.r.post.flash(0.8, 0.8, 1, 0.6, 0.03);
        w.r.post.shockwave(W / 2, H * 0.42, 0.08, 0.03, 1.2);
        w.g.camera.addTrauma(0.8);
      }
    },
    end(p) { p.ps.binary = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) {
      atlas.add(`ship_holt_${t}`, 34, 48, (c, w, h) => drawShip(c, w, h, t, 'rgba(110,230,255,1)', ['#08101c', '#3a5a7a', '#c0e4ff']), { scale: s });
      atlas.add(`holt_twin_${t}`, 34, 48, (c, w, h) => drawShip(c, w, h, t, 'rgba(255,140,200,1)', ['#1a0812', '#7a3a5a', '#ffc8e4']), { scale: s });
    }
    atlas.add('h_link', 10, 10, drawLink, { scale: s });
    atlas.add('h_boltA', 18, 5, boltA, { scale: s });
    atlas.add('h_boltB', 18, 5, boltB, { scale: s });
  },

  init(p, w) {
    p.ps.fA = w.r.frame('h_boltA');
    p.ps.fB = w.r.frame('h_boltB');
    p.ps.twinFrames = [1, 2, 3, 4].map((t) => w.r.frame(`holt_twin_${t}`));
    p.ps.twin = { x: p.x + 15, y: p.y, px: p.x + 15, py: p.y };
  },

  reset(p) { p.ps.binary = null; },

  update(p) {
    const tw = p.ps.twin, [tx, ty] = twinTarget(p);
    tw.px = tw.x; tw.py = tw.y;
    const k = p.focus ? 0.35 : 0.2;
    tw.x += (tx - tw.x) * k; tw.y += (ty - tw.y) * k;
    tw.docked = Math.hypot(tx - tw.x, ty - tw.y) < 3 && p.focus;
  },

  optionLayout(p) {
    // Link nodes sit between the twins (tier 3+).
    if (p.tier < 3 || p.focus) return [];
    const tw = p.ps.twin, n = p.tier >= 4 ? 2 : 1, out = [];
    for (let k = 1; k <= n; k++) out.push([(tw.x - p.x) * (k / (n + 1)), (tw.y - p.y) * (k / (n + 1)) - 8]);
    return out;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots, tw = p.ps.twin;
    if (p.focus && tw.docked) {
      // Binary lance: one thick combined beam from the docked pair.
      w.beam(p.x + 7, p.y - 26, p.x + 7, -20, 10 + t * 3, 0.28 + 0.07 * t, [0.8, 0.8, 1]);
    }
    if (p.fireCd > 0) return;
    p.fireCd = 6;
    const n = 1 + (t >> 1);
    const volley = (x, y, f, side) => {
      for (let k = 0; k < n; k++) {
        const a = UP + (n > 1 ? (k / (n - 1) - 0.5) * 0.25 : 0) * side;
        const i = w.shot(x + (k - (n - 1) / 2) * 5, y - 20, a, 13, f, 0.85, 5, 1 + 0.08 * t);
        if (i >= 0) S.behave(i, 0.85);
      }
    };
    if (!p.focus || !tw.docked) {
      volley(p.x, p.y, p.ps.fA, 1);
      volley(tw.x, tw.y, p.ps.fB, -1);
      muzzle(w, p.x, p.y - 22, CYAN, 9);
      muzzle(w, tw.x, tw.y - 22, ROSE, 9);
    }
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 12, p.ps.fA, 0.6, 5);
      if (i >= 0) S.behave(i, 0.6);
    }
  },

  renderBelow(p, b, x, y, alpha) {
    // The twin ship (drawn under the lead).
    const tw = p.ps.twin, f = p.ps.twinFrames[p.tier - 1];
    const tx = tw.px + (tw.x - tw.px) * alpha, ty = tw.py + (tw.y - tw.py) * alpha;
    b.draw(p.F.glow, tx, ty + 20, 13, 19, 0, ROSE[0] * 1.6, ROSE[1] * 1.6, ROSE[2] * 1.6, 0.8 * p.alpha, 1);
    b.draw(f, tx, ty, f.w, f.h, -p.bank * 0.06, 1, 1, 1, p.alpha, 0);
    if (tw.docked) b.draw(p.F.glow, (x + tx) / 2, y, 50, 40, 0, 0.8, 0.8, 1, 0.4, 1);
  },

  renderFx(p, b) {
    const F = p.F, tw = p.ps.twin;
    if (p.specialT > 0) {
      const len = Math.hypot(tw.x - p.x, tw.y - p.y), a = Math.atan2(tw.y - p.y, tw.x - p.x);
      b.draw(F.laser, (p.x + tw.x) / 2, (p.y + tw.y) / 2, len, 16, a, 1.4, 1, 1.8, 0.85, 1);
      b.draw(F.laser, (p.x + tw.x) / 2, (p.y + tw.y) / 2, len, 4, a, 2.4, 2.4, 2.4, 1, 1);
    }
    const bs = p.ps.binary;
    if (bs && bs.stars) {
      bs.stars.forEach(([x, y], k) => {
        const c = k ? ROSE : CYAN;
        b.draw(F.glow, x, y, 140, 140, 0, c[0], c[1], c[2], 0.6, 1);
        b.draw(F.core, x, y, 40, 40, 0, 3, 3, 3, 1, 1);
        b.draw(F.ring, x, y, 100, 100, bs.t * 0.1, c[0] * 2, c[1] * 2, c[2] * 2, 0.5, 1);
      });
    }
  },
};
