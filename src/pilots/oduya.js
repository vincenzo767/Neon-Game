import { SHOT_FLAK } from '../entities/World.js';
import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, W, H, muzzle, ringPulse, chainTargets, nearestN, targets, zap, stun, shipScale } from './common.js';

// ODUYA REX — THUNDERJAW (hover tank)
// Arcing plasma mortars · Focus: chain-lightning strand that locks on and
// jumps between targets · Special: ground-slam EMP (stuns + clears)
// Bomb: Storm Cell · Ultimate: Chain-Lightning Storm

const ELEC = [0.55, 0.68, 1.0];
const WHITE = [0.9, 0.95, 1.0];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Hover skirt.
  mirrorPath(ctx, cx, [0, 8, 18, 10, 24, 18, 25, 46, 20, 52, 0, 53]);
  ctx.fillStyle = chrome(ctx, cx - 25, cx + 25, '#0c0f16', '#3a4256', '#8e9ab4'); ctx.fill(); outline(ctx, 1.1);
  ctx.fillStyle = 'rgba(140,170,255,0.5)';
  for (const s of [-1, 1]) ctx.fillRect(cx + s * 23 - 1, 20, 2, 24);
  // Tier 2+: side mortar pods.
  if (tier >= 2) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(cx + s * 22 - 5, 14, 10, 18, 3);
    ctx.fillStyle = chrome(ctx, cx + s * 22 - 5, cx + s * 22 + 5); ctx.fill(); outline(ctx, 0.7);
    for (const y of [18, 26]) glowDot(ctx, cx + s * 22, y, 2.2, 'rgba(140,170,255,1)');
  }
  // Tier 3+: tesla coils at the back.
  if (tier >= 3) for (const s of [-1, 1]) {
    ctx.fillStyle = '#20263a'; ctx.fillRect(cx + s * 12 - 2.5, 40, 5, 10);
    for (let y = 41; y < 50; y += 2) { ctx.fillStyle = '#c08a40'; ctx.fillRect(cx + s * 12 - 3, y, 6, 0.9); }
    glowDot(ctx, cx + s * 12, 40, 3.2, 'rgba(200,220,255,1)');
  }
  // Turret.
  ctx.beginPath(); ctx.arc(cx, 28, 11, 0, Math.PI * 2);
  ctx.fillStyle = chrome(ctx, cx - 11, cx + 11, '#10141e', '#4a5672', '#b4c2e0'); ctx.fill(); outline(ctx);
  // Twin plasma barrels.
  for (const s of [-1, 1]) { ctx.fillStyle = '#141824'; ctx.beginPath(); ctx.rect(cx + s * 4 - 1.8, 4, 3.6, 18); ctx.fill(); outline(ctx, 0.5); }
  for (const s of [-1, 1]) glowDot(ctx, cx + s * 4, 5, 2.4, 'rgba(160,190,255,1)');
  // Tier 4: capacitor ring around the turret.
  if (tier >= 4) {
    ctx.beginPath(); ctx.arc(cx, 28, 14, 0, Math.PI * 2);
    ctx.save(); ctx.shadowColor = '#9cf'; ctx.shadowBlur = 8; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  canopy(ctx, cx, 30, 3.2, 3.6, '#ffffff', '#8aa6ff', '#0a1430');
  neonLines(ctx, cx, [18, 10, 24, 18, 25, 46, 20, 52], 'rgba(140,170,255,1)', 0.7, 5);
}

function drawCoil(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = '#1a2032'; ctx.beginPath(); ctx.rect(cx - 3, 3, 6, h - 6); ctx.fill(); outline(ctx, 0.6);
  for (let y = 4; y < h - 4; y += 2.2) { ctx.fillStyle = '#c08a40'; ctx.fillRect(cx - 3.5, y, 7, 0.9); }
  glowDot(ctx, cx, 3, 3, 'rgba(200,220,255,1)');
}

const boltSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(140,170,255,0.9)');
function shellSprite(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, 'rgba(170,200,255,1)'); g.addColorStop(1, 'rgba(60,90,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/** Lob a plasma mortar that curves onto (tx, ty) and bursts there. */
function mortar(p, w, x, y, tx, ty, dmg, r, side) {
  const S = w.shots, d = Math.hypot(tx - x, ty - y), steps = Math.max(10, Math.min(70, d / 7));
  const a = Math.atan2(ty - y, tx - x), bend = 0.7 * side;
  const i = w.shot(x, y, a - bend, 7, p.ps.fShell, dmg, 6, 1 + p.tier * 0.1);
  if (i < 0) return;
  S.behave(i, dmg, Math.round(steps), 0, 0, SHOT_FLAK, r);
  S.motion(i, 0, (bend * 2) / steps);
}

export default {
  id: 'oduya',
  name: 'ODUYA REX',
  vehicle: 'THUNDERJAW',
  role: 'Hover Tank',
  bio: 'A foundry foreman who held the Furnace gates for three days with a welding rig and a temper. The Thunderjaw is slow, heavy and loud, and so is he.',
  color: ELEC,
  css: '#8aa6ff',
  stats: { speed: 2, power: 5, range: 3, bomb: 3 },
  speed: { normal: 3.8, focus: 1.7 },
  hitbox: 3.0,
  bombStock: 3,
  engines: [[-12, 24], [12, 24]],
  engineColor: [0.5, 0.6, 1.0],
  optionSprite: 'o_coil',
  portrait: { skin: '#5a3626', hair: '#141010', style: 'bald', eyes: 'cyber', accent: 'scar', iris: '#8aa6ff', suit: '#2a2c38' },
  weapons: {
    main: 'Plasma Mortars — arcing shells that burst on the nearest targets',
    focus: 'Thunder Strand — lightning that locks on and chains between targets',
  },
  special: {
    name: 'GROUND-SLAM EMP',
    desc: 'Slam the deck: clears nearby bullets and stuns enemies',
    cooldown: 600,
    duration: 24,
    activate(p, w) {
      w.cancelCircle(p.x, p.y, 160);
      w.damageCircle(p.x, p.y, 120, 10);
      for (const e of targets(w)) if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 260 * 260) stun(e, 110);
      ringPulse(w, p.x, p.y, ELEC, 10, 170, 22);
      w.r.post.shockwave(p.x, p.y, 0.04, 0.02, 0.6);
      w.g.camera.addTrauma(0.35);
    },
    update(p, w, t) { if (t < 12) w.cancelCircle(p.x, p.y, 60 + t * 9); },
  },
  bomb: {
    name: 'STORM CELL',
    duration: 120,
    activate(p) { p.ps.strikes = []; },
    update(p, w, t) {
      w.cancelAll();
      if (t % 4 === 0 && t < 108) {
        const T = targets(w);
        const e = T.length && w.rng.chance(0.75) ? w.rng.pick(T) : { x: w.rng.range(30, W - 30), y: w.rng.range(40, H - 140) };
        p.ps.strikes.push({ x: e.x, y: e.y, t: 0, s: w.fxRng.next() });
        w.damageCircle(e.x, e.y, 46, 9);
        w.explosions.sparks(e.x, e.y, 10, WHITE, 5, 16, 4);
        if (t % 12 === 0) w.r.post.flash(0.6, 0.7, 1, 0.12, 0.08);
      }
      for (const s of p.ps.strikes) s.t++;
      p.ps.strikes = p.ps.strikes.filter((s) => s.t < 8);
    },
    end(p) { p.ps.strikes = []; },
  },
  ultimate: {
    name: 'CHAIN-LIGHTNING STORM',
    duration: 260,
    activate(p) { p.ps.storm = []; },
    update(p, w, t) {
      w.cancelAll();
      if (t % 5 === 0 && t < 240) {
        const sx = w.fxRng.range(20, W - 20);
        const chain = chainTargets(w, sx, 0, 10, 280);
        const pts = [[sx, -10], ...chain.map((e) => [e.x, e.y])];
        if (!chain.length) pts.push([w.rng.range(40, W - 40), w.rng.range(60, H - 160)]);
        for (const e of chain) { w.damage(e, 6); stun(e, 30); }
        p.ps.storm.push({ pts, t: 0, s: w.fxRng.next() });
        if (t % 20 === 0) { w.r.post.flash(0.5, 0.6, 1, 0.18, 0.06); w.g.camera.addTrauma(0.2); }
      }
      for (const s of p.ps.storm) s.t++;
      p.ps.storm = p.ps.storm.filter((s) => s.t < 9);
    },
    end(p) { p.ps.storm = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_oduya_${t}`, 54, 56, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('o_coil', 10, 16, drawCoil, { scale: s });
    atlas.add('o_bolt', 22, 6, boltSprite, { scale: s });
    atlas.add('o_shell', 12, 12, shellSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fBolt = w.r.frame('o_bolt');
    p.ps.fShell = w.r.frame('o_shell');
    p.ps.chain = null;
    p.ps.side = 1;
  },

  reset(p) { p.ps.chain = null; },

  update(p, w) {
    // The thunder strand only exists while focus-firing.
    if (!(p.focus && p.firing)) p.ps.chain = null;
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const base = p.focus ? [[-18, 6], [18, 6]] : [[-28, 10], [28, 10]];
    return t >= 4 ? [...base, [-12, 26], [12, 26]] : base;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots;
    if (p.focus) {
      // Lock on and chain: damage every step while held.
      const chain = chainTargets(w, p.x, p.y - 20, 1 + Math.ceil(t / 2), 170);
      p.ps.chain = chain.length ? { pts: [[p.x, p.y - 24], ...chain.map((e) => [e.x, e.y])], s: (p.t >> 2) } : null;
      for (const e of chain) w.damage(e, 0.22 + 0.05 * t);
    }
    if (p.fireCd > 0) return;
    p.fireCd = 8;
    for (const s of [-1, 1]) {
      const i = w.shot(p.x + s * 5, p.y - 24, UP, 13, p.ps.fBolt, 1.1, 5);
      if (i >= 0) S.behave(i, 1.1);
      muzzle(w, p.x + s * 5, p.y - 26, ELEC, 10);
    }
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 8, UP, 12, p.ps.fBolt, 0.7, 5);
      if (i >= 0) S.behave(i, 0.7);
    }
    // Mortars every other volley (unfocused: the main weapon).
    if (!p.focus && (p.t >> 3) % 2 === 0) {
      const n = 1 + (t >> 1);
      const T = nearestN(w, p.x, p.y, n, 520);
      for (let k = 0; k < n; k++) {
        const tg = T[k % Math.max(1, T.length)];
        const tx = tg ? tg.x : p.x + (k - (n - 1) / 2) * 60, ty = tg ? tg.y : p.y - 300;
        p.ps.side = -p.ps.side;
        mortar(p, w, p.x + p.ps.side * 14, p.y - 10, tx, ty, 3 + t * 0.6, 28 + t * 4, p.ps.side);
      }
    }
  },

  renderFx(p, b) {
    const F = p.F;
    const c = p.ps.chain;
    if (c) for (let k = 1; k < c.pts.length; k++) zap(b, F, c.pts[k - 1][0], c.pts[k - 1][1], c.pts[k][0], c.pts[k][1], ELEC, 3, 0.9, c.s + k);
    for (const s of p.ps.strikes || []) zap(b, F, s.x + 20, -10, s.x, s.y, WHITE, 6, 1 - s.t / 8, s.s * 9, 12);
    for (const s of p.ps.storm || []) {
      const a = 1 - s.t / 9;
      for (let k = 1; k < s.pts.length; k++) zap(b, F, s.pts[k - 1][0], s.pts[k - 1][1], s.pts[k][0], s.pts[k][1], ELEC, 5, a, s.s * 7 + k, 10);
    }
  },
};
