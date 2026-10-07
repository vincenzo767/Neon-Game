import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, W, H, muzzle, ringPulse, nearestN, targets, shipScale } from './common.js';

// MAJOR ELDON PIKE — BASTION (flying fortress)
// Drone escort wing: the fortress fires heavy twin cannons while escort
// drones fly formation (2/3/4/6 drones by tier).
// Focus: drones lock into a firing line ahead and aim at your target.
// Special: Scramble (drones launch as homing interceptors, then re-form)
// Bomb: Siege Grid · Ultimate: Full Air Squadron Strike

const STEEL = [0.6, 0.8, 1.0];
const AMBERW = [1.0, 0.95, 0.8];
const DRONES = [2, 3, 4, 6];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Broad armoured wing (fortress silhouette).
  mirrorPath(ctx, cx, [0, 4, 8, 8, 16, 18, 30, 26, 30, 34, 18, 40, 10, 52, 0, 54]);
  ctx.fillStyle = chrome(ctx, cx - 30, cx + 30, '#0c1016', '#4a5466', '#b8c4d6'); ctx.fill(); outline(ctx, 1.2);
  // Armour plates + rivets.
  ctx.strokeStyle = 'rgba(8,12,20,0.7)'; ctx.lineWidth = 0.6;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 8, 10); ctx.lineTo(cx + s * 8, 50); ctx.moveTo(cx + s * 18, 20); ctx.lineTo(cx + s * 18, 40); ctx.stroke(); }
  ctx.fillStyle = 'rgba(200,210,230,0.7)';
  for (let x = -26; x <= 26; x += 4) ctx.fillRect(cx + x - 0.4, 30, 0.8, 0.8);
  // Turret blisters (tier adds more).
  const blisters = [[0, 14], [-12, 34], [12, 34], [-22, 28], [22, 28]].slice(0, 1 + tier);
  for (const [x, y] of blisters) {
    ctx.beginPath(); ctx.arc(cx + x, y, 3.4, 0, Math.PI * 2); ctx.fillStyle = chrome(ctx, cx + x - 3.4, cx + x + 3.4); ctx.fill(); outline(ctx, 0.5);
    ctx.fillStyle = '#10141c'; ctx.fillRect(cx + x - 0.8, y - 7, 1.6, 6);
  }
  // Drone bay (tier 3+), command spire (tier 4).
  if (tier >= 3) for (const s of [-1, 1]) { ctx.fillStyle = '#06080c'; ctx.fillRect(cx + s * 24 - 3, 31, 6, 4); glowDot(ctx, cx + s * 24, 33, 2, 'rgba(160,200,255,1)'); }
  if (tier >= 4) neonLines(ctx, cx, [3, 40, 3, 52, 6, 46, 10, 52], 'rgba(160,200,255,1)', 0.8, 5);
  canopy(ctx, cx, 24, 3.4, 5, '#ffffff', '#a8c8ff', '#0a1630');
  neonLines(ctx, cx, [16, 18, 30, 26, 30, 34, 18, 40], 'rgba(150,190,255,1)', 0.7, 5);
}

function drawDrone(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 2, 4, 6, 8, 6, 10, 2, 10, 1, 13, 0, 13]);
  ctx.fillStyle = chrome(ctx, cx - 6, cx + 6, '#0c1016', '#4a5466', '#c8d4e6'); ctx.fill(); outline(ctx, 0.5);
  glowDot(ctx, cx, 4, 1.8, 'rgba(160,200,255,1)');
}

function drawJet(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 3, 8, 4, 16, 16, 26, 16, 30, 5, 28, 4, 36, 0, 37]);
  ctx.fillStyle = chrome(ctx, cx - 16, cx + 16, '#0c1016', '#4a5872', '#d0dcf0'); ctx.fill(); outline(ctx, 0.8);
  canopy(ctx, cx, 12, 2, 4, '#ffffff', '#a8c8ff', '#0a1630');
  for (const s of [-1, 1]) glowDot(ctx, cx + s * 3, 36, 2.6, 'rgba(160,200,255,1)');
}

const shellSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(170,200,255,0.9)', '#ffffff');

export default {
  id: 'pike',
  name: 'MAJ. ELDON PIKE',
  vehicle: 'BASTION',
  role: 'Flying Fortress',
  bio: 'Thirty years of service and the last officer in the Precinct who still salutes. Pike never flies alone: the Bastion carries its own escort wing, and he knows every drone by serial number.',
  color: STEEL,
  css: '#9ac4ff',
  stats: { speed: 1, power: 4, range: 5, bomb: 4 },
  speed: { normal: 3.4, focus: 1.6 },
  hitbox: 3.2,
  bombStock: 4,
  engines: [[-10, 26], [0, 28], [10, 26]],
  engineColor: [0.55, 0.75, 1.0],
  optionSprite: 'p_drone',
  portrait: { skin: '#d8b090', hair: '#c8ccd4', style: 'buzz', eyes: 'eyes', iris: '#6a8ab0', accent: 'scar', badge: 'MAJ-1', suit: '#2a3040' },
  weapons: {
    main: 'Bastion Cannons + Escort Wing — heavy shells, drones in V formation',
    focus: 'Firing Line — drones lock ahead and aim at your target',
  },
  special: {
    name: 'SCRAMBLE',
    desc: 'Escort drones launch as homing interceptors, then re-form',
    cooldown: 480,
    duration: 150,
    activate(p, w) {
      p.ps.scramble = p.options.map((o) => ({ x: o.x, y: o.y, px: o.x, py: o.y, a: UP, t: 0, done: false }));
      ringPulse(w, p.x, p.y, STEEL, 10, 60, 14);
    },
    update(p, w) {
      for (const d of p.ps.scramble) {
        if (d.done) continue;
        d.px = d.x; d.py = d.y; d.t++;
        const [tg] = nearestN(w, d.x, d.y, 1, 700);
        if (tg) {
          let da = Math.atan2(tg.y - d.y, tg.x - d.x) - d.a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          d.a += Math.max(-0.18, Math.min(0.18, da));
        }
        d.x += Math.cos(d.a) * 8; d.y += Math.sin(d.a) * 8;
        w.cancelCircle(d.x, d.y, 10);
        if (tg && (tg.x - d.x) ** 2 + (tg.y - d.y) ** 2 < (tg.r + 8) ** 2) {
          w.damage(tg, 14); w.explosions.blast(d.x, d.y, 0.6, STEEL); d.done = true;
        }
        if (d.y < -40 || d.t > 120) d.done = true;
      }
    },
    end(p) { p.ps.scramble = null; },
  },
  bomb: {
    name: 'SIEGE GRID',
    duration: 110,
    activate() {},
    update(p, w, t) {
      w.cancelAll();
      // Broadside shells walk a checkerboard of blasts down the screen.
      if (t % 8 === 0 && t < 96) {
        const row = t / 8, y = 40 + row * 46;
        for (let k = 0; k < 6; k++) {
          const x = 40 + k * 80 + (row % 2 ? 40 : 0);
          if (x > W - 20) continue;
          w.explosions.blast(x, y, 0.8, STEEL);
          w.damageCircle(x, y, 48, 8);
        }
        w.g.camera.addTrauma(0.2);
      }
    },
  },
  ultimate: {
    name: 'FULL AIR SQUADRON STRIKE',
    duration: 280,
    activate(p) {
      // Three V formations of five jets, staggered.
      p.ps.squad = [];
      for (let wv = 0; wv < 3; wv++) {
        const cx = [W * 0.3, W * 0.7, W * 0.5][wv];
        for (let k = -2; k <= 2; k++) p.ps.squad.push({ x: cx + k * 38, y: H + 60 + Math.abs(k) * 30 + wv * 200, py: 0, vy: 5.2 + wv * 0.4 });
      }
    },
    update(p, w, t) {
      w.cancelAll();
      for (const j of p.ps.squad) {
        j.py = j.y; j.y -= j.vy;
        if (j.y < H && j.y > -40) {
          if (t % 4 === 0) { const i = w.shot(j.x, j.y - 20, UP, 16, p.ps.fShell, 2, 5); if (i >= 0) w.shots.behave(i, 2); }
          if (t % 10 === 0) { w.damageCircle(j.x, j.y + 30, 40, 5); w.explosions.blast(j.x, j.y + 40, 0.5, AMBERW); }
        }
      }
      if (t === 200) for (const e of targets(w)) w.damage(e, 20);
    },
    end(p) { p.ps.squad = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_pike_${t}`, 64, 58, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('p_drone', 14, 14, drawDrone, { scale: s });
    atlas.add('p_jet', 34, 38, drawJet, { scale: s * 0.7 });
    atlas.add('p_shell', 18, 6, shellSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fShell = w.r.frame('p_shell');
    p.ps.fDrone = w.r.frame('p_drone');
    p.ps.fJet = w.r.frame('p_jet');
  },

  reset(p) { p.ps.scramble = null; p.ps.squad = null; },

  optionLayout(p) {
    if (p.ps.scramble) return [];
    const n = DRONES[p.tier - 1], out = [];
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1, rank = (k >> 1) + 1;
      out.push(p.focus ? [side * (8 + rank * 12) * 0.9, -36 - (n > 4 ? 6 * (rank % 2) : 0)] : [side * (14 + rank * 16), 10 + rank * 12]);
    }
    return out;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots;
    p.fireCd = 9;
    for (const s of [-1, 1]) {
      const i = w.shot(p.x + s * 7, p.y - 24, UP, 13, p.ps.fShell, 2.2 + 0.2 * t, 6, 1.1 + t * 0.08);
      if (i >= 0) S.behave(i, 2.2 + 0.2 * t);
      muzzle(w, p.x + s * 7, p.y - 26, STEEL, 12);
    }
    // Escort drones: spread volleys, or aimed at the locked target when focused.
    const [tg] = p.focus ? nearestN(w, p.x, p.y - 80, 1, 600) : [];
    for (const o of p.options) {
      const a = tg ? Math.atan2(tg.y - o.y, tg.x - o.x) : UP + (o.x < p.x ? -0.08 : 0.08);
      const i = w.shot(o.x, o.y - 6, a, 14, p.ps.fShell, 0.8, 5, 0.7);
      if (i >= 0) S.behave(i, 0.8);
    }
    p.ps.lockT = tg || null;
  },

  renderFx(p, b, alpha) {
    const F = p.F;
    for (const d of p.ps.scramble || []) {
      if (d.done) continue;
      const x = d.px + (d.x - d.px) * alpha, y = d.py + (d.y - d.py) * alpha;
      b.draw(F.glow, x, y, 22, 22, 0, STEEL[0], STEEL[1], STEEL[2], 0.5, 1);
      b.draw(p.ps.fDrone, x, y, 14, 14, d.a + Math.PI / 2, 1, 1, 1, 1, 0);
    }
    for (const j of p.ps.squad || []) {
      const y = j.py + (j.y - j.py) * alpha;
      b.draw(F.glow, j.x, y + 22, 26, 34, 0, 0.5, 0.7, 1, 0.6, 1);
      b.draw(p.ps.fJet, j.x, y, 34, 38, 0, 1, 1, 1, 1, 0);
    }
    // Lock marker for the focused firing line.
    const L = p.ps.lockT;
    if (L && L.alive && p.focus) b.draw(F.ring, L.x, L.y, L.r * 2 + 24, L.r * 2 + 24, p.t * 0.08, STEEL[0] * 2, STEEL[1] * 2, STEEL[2] * 2, 0.6, 1);
  },
};
