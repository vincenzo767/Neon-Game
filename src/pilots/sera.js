import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, TAU, W, H, muzzle, ringPulse, mote, targets, stun, wash, shipScale } from './common.js';

// SERA VOSS — GLACIER (cryo frigate)
// Freeze rays that slow enemy bullets · Focus: Cryo Beam (slows every bullet
// in its path) · Special: Cryo Shell (frost field around the ship)
// Bomb: Absolute Zero (freeze everything, then shatter)
// Ultimate: Time-Stop Shatter (bullets hang in the air, regular enemies
// freeze solid; everything shatters at the end)

const ICE = [0.6, 0.9, 1.0];
const FROST = [0.85, 0.95, 1.0];

/** Slow bullet i toward `floor` (caps dynamic bullets so they stay slow). */
export function slowBullet(B, i, factor, floor = 0.6) {
  const s = Math.max(floor, B.spd[i] * factor);
  if (s >= B.spd[i]) return;
  if (B.dyn[i]) { B.maxSpd[i] = s; if (B.minSpd[i] > s) B.minSpd[i] = s; }
  B.setHeading(i, B.ang[i], s);
}

/** Stop bullet i dead (time-stop). */
function freezeBullet(B, i) {
  B.dyn[i] = 0;
  if (B.spd[i] !== 0) B.setHeading(i, B.ang[i], 0);
}

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Ice-blade outriggers (longer with tier).
  for (const s of [-1, 1]) {
    const L = 10 + tier * 3;
    ctx.beginPath(); ctx.moveTo(cx + s * 12, 18); ctx.lineTo(cx + s * (12 + L), 30); ctx.lineTo(cx + s * (12 + L * 0.6), 40); ctx.lineTo(cx + s * 12, 36); ctx.closePath();
    const g = ctx.createLinearGradient(cx + s * 12, 0, cx + s * (12 + L), 0);
    g.addColorStop(0, 'rgba(160,220,255,0.95)'); g.addColorStop(1, 'rgba(230,250,255,0.6)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,50,80,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  // Frigate hull: long, armoured.
  mirrorPath(ctx, cx, [0, 2, 5, 8, 9, 18, 12, 30, 11, 44, 6, 52, 0, 53]);
  ctx.fillStyle = chrome(ctx, cx - 12, cx + 12, '#0a1420', '#5a7a96', '#e0f0ff'); ctx.fill(); outline(ctx);
  // Deck plates.
  ctx.strokeStyle = 'rgba(10,30,50,0.6)'; ctx.lineWidth = 0.5;
  for (const y of [14, 24, 34, 44]) { ctx.beginPath(); ctx.moveTo(cx - 9, y); ctx.lineTo(cx + 9, y); ctx.stroke(); }
  // Cryo emitters (tier 2+ adds side emitters, tier 3 aft tanks).
  glowDot(ctx, cx, 5, 3, 'rgba(170,230,255,1)');
  if (tier >= 2) for (const s of [-1, 1]) glowDot(ctx, cx + s * 9, 20, 2.4, 'rgba(170,230,255,1)');
  if (tier >= 3) for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 7, 44, 3, 6, 0, 0, TAU); ctx.fillStyle = 'rgba(140,210,255,0.85)'; ctx.fill(); outline(ctx, 0.5); }
  // Tier 4: crystal crown.
  if (tier >= 4) neonLines(ctx, cx, [4, 10, 10, 2, 8, 14, 16, 8], 'rgba(200,240,255,1)', 0.8, 6);
  canopy(ctx, cx, 28, 3, 5, '#ffffff', '#aee8ff', '#0a2034');
}

function drawPod(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.moveTo(cx, 1); ctx.lineTo(w - 1, cy); ctx.lineTo(cx, h - 1); ctx.lineTo(1, cy); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#f0fbff'); g.addColorStop(1, '#4a90c0');
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
  glowDot(ctx, cx, cy, 2.4, 'rgba(200,240,255,1)');
}

const shardSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(170,230,255,0.9)', '#ffffff');

export default {
  id: 'sera',
  name: 'SERA VOSS',
  vehicle: 'GLACIER',
  role: 'Cryo Frigate',
  bio: 'Cryo-systems officer from the ring station; she was in orbit when the Upper Breach opened. Sera does not dodge the storm, she stops it in the air.',
  color: ICE,
  css: '#9ae4ff',
  stats: { speed: 2, power: 3, range: 4, bomb: 4 },
  speed: { normal: 3.9, focus: 1.8 },
  hitbox: 2.6,
  bombStock: 3,
  engines: [[-4, 26], [4, 26]],
  engineColor: [0.6, 0.9, 1.0],
  optionSprite: 's_pod',
  optionSpin: 0.06,
  portrait: { skin: '#f4e2d6', hair: '#dff2ff', style: 'bob', eyes: 'eyes', iris: '#7ad0ff', accent: 'earpiece', suit: '#24303c' },
  weapons: {
    main: 'Frost Shards — piercing ice that chills the air it crosses',
    focus: 'Cryo Beam — slows every enemy bullet in its path',
  },
  special: {
    name: 'CRYO SHELL',
    desc: 'Frost field: bullets near the ship crawl to a near stop',
    cooldown: 660,
    duration: 300,
    activate(p, w) { ringPulse(w, p.x, p.y, ICE, 10, 110, 20); },
    update(p, w) {
      const B = w.bullets;
      for (let i = 0; i < B.count; i++) {
        const dx = B.x[i] - p.x, dy = B.y[i] - p.y;
        if (dx * dx + dy * dy < 110 * 110) slowBullet(B, i, 0.82, 0.35);
      }
    },
  },
  bomb: {
    name: 'ABSOLUTE ZERO',
    duration: 100,
    activate(p, w) { p.ps.zero = 0; w.r.post.flash(0.7, 0.9, 1, 0.5, 0.03); },
    update(p, w, t) {
      p.ps.zero = t;
      const B = w.bullets;
      if (t < 40) for (let i = 0; i < B.count; i++) freezeBullet(B, i);
      if (t === 40) {
        w.cancelAll();
        for (const e of targets(w)) { w.damage(e, 18); w.explosions.sparks(e.x, e.y, 10, FROST, 5, 20, 4); }
        w.r.post.shockwave(W / 2, H / 2, 0.06, 0.03, 1);
        w.g.camera.addTrauma(0.5);
      }
      if (t > 40) w.cancelAll();
    },
    end(p) { p.ps.zero = null; },
  },
  ultimate: {
    name: 'TIME-STOP SHATTER',
    duration: 300,
    activate(p, w) { p.ps.stop = { t: 0 }; w.r.post.aberrate(0.02); },
    update(p, w, t) {
      p.ps.stop.t = t;
      const B = w.bullets;
      if (t < 270) {
        // The world holds still: bullets hang in the air, regular enemies freeze.
        for (let i = 0; i < B.count; i++) freezeBullet(B, i);
        for (const e of targets(w, true)) stun(e, 4);
        if (t % 12 === 0) for (const e of targets(w)) w.damage(e, 1.5);
      } else if (t === 270) {
        // Shatter: every frozen bullet breaks, everything frozen takes the hit.
        for (let i = 0; i < B.count; i += 3) mote(w, B.x[i], B.y[i], w.fxRng.range(-2, 2), w.fxRng.range(-2, 2), FROST, 6, 18);
        w.cancelAll();
        for (const e of targets(w)) w.damage(e, 40);
        w.r.post.flash(0.8, 0.95, 1, 0.7, 0.03);
        w.r.post.shockwave(W / 2, H / 2, 0.08, 0.03, 1.2);
        w.g.camera.addTrauma(0.8);
        w.g.hitStop(6);
      } else w.cancelAll();
    },
    end(p) { p.ps.stop = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_sera_${t}`, 60, 56, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('s_pod', 10, 12, drawPod, { scale: s });
    atlas.add('s_shard', 18, 6, shardSprite, { scale: s });
  },

  init(p, w) { p.ps.fShard = w.r.frame('s_shard'); },
  reset(p) { p.ps.stop = null; p.ps.zero = null; },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const n = t >= 4 ? 4 : t >= 3 ? 3 : 2, out = [];
    for (let k = 0; k < n; k++) out.push(p.focus ? [(k - (n - 1) / 2) * 12, -16] : [(k - (n - 1) / 2) * 22, 14 + Math.abs(k - (n - 1) / 2) * 4]);
    return out;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots;
    if (p.focus) {
      // Cryo beam: chills (slows) every enemy bullet in the column ahead.
      const wd = 10 + t * 3;
      w.beam(p.x, p.y - 24, p.x, -20, wd, 0.14 + 0.04 * t, ICE);
      const B = w.bullets, half = wd * 1.4;
      for (let i = 0; i < B.count; i++) if (B.y[i] < p.y && Math.abs(B.x[i] - p.x) < half) slowBullet(B, i, 0.9, 0.7);
    }
    if (p.fireCd > 0) return;
    p.fireCd = 7;
    const n = p.focus ? 1 : 1 + t;
    for (let k = 0; k < n; k++) {
      const a = UP + (n > 1 ? (k / (n - 1) - 0.5) * 0.4 : 0);
      const i = w.shot(p.x + (k - (n - 1) / 2) * 5, p.y - 26, a, 13, p.ps.fShard, 1.0, 5, 0.9 + t * 0.08);
      if (i >= 0) S.behave(i, 1.0, 0, 1);
    }
    muzzle(w, p.x, p.y - 28, ICE, 11);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 13, p.ps.fShard, 0.6, 5);
      if (i >= 0) S.behave(i, 0.6, 0, 1);
    }
    // Frost shards chill bullets they fly past.
    const B = w.bullets;
    if (!p.focus) for (let i = 0; i < B.count; i++) if (B.y[i] < p.y && Math.abs(B.x[i] - p.x) < 40 + t * 10) slowBullet(B, i, 0.96, 1.0);
  },

  renderAbove(p, b, x, y) {
    if (p.specialT <= 0) return;
    const F = p.F, end = p.specialT < 60 && (p.t >> 2) & 1;
    b.draw(F.ring, x, y, 220, 220, p.t * 0.01, ICE[0], ICE[1], ICE[2], end ? 0.2 : 0.45, 1);
    b.draw(F.glow, x, y, 230, 230, 0, 0.3, 0.5, 0.7, 0.18, 1);
  },

  renderFx(p, b) {
    const F = p.F;
    if (p.ps.zero !== null && p.ps.zero !== undefined && p.ps.zero < 40) wash(b, F, [0.25, 0.5, 0.8], 0.1);
    if (p.ps.stop) {
      const t = p.ps.stop.t;
      if (t < 270) {
        wash(b, F, [0.15, 0.35, 0.6], 0.14 + 0.04 * Math.sin(t * 0.2));
        // Clock-face ring around the ship.
        b.draw(F.ring, p.x, p.y, 300, 300, -t * 0.02, FROST[0], FROST[1], FROST[2], 0.35, 1);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU;
          b.draw(F.white, p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 140, 2, 10, a + Math.PI / 2, 2, 2, 2.4, 0.6, 1);
        }
      }
    }
  },
};
