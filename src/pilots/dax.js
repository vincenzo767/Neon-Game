import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, W, muzzle, mote, shipScale } from './common.js';

// DAX MORROW — OVERCLOCK (hot-rod jet)
// Fire rate ramps up with heat (0–100) while the trigger is held; heat bleeds
// off when you stop. Focus: Heat Lance, a beam that widens with heat.
// Special: Vent Blast (dump all heat as a forward cone, damage ∝ heat)
// Bomb: Nitro Wall · Ultimate: Meltdown Nova (heat locked at max, nova rings)
//
// Shots run from cool white-blue to violet as heat builds (§4.5: player
// shots stay cool so they never hide enemy bullets).

const COOL = [0.6, 0.85, 1.0];
const HOT = [0.85, 0.5, 1.0];
const mix = (k) => [COOL[0] + (HOT[0] - COOL[0]) * k, COOL[1] + (HOT[1] - COOL[1]) * k, COOL[2] + (HOT[2] - COOL[2]) * k];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Tier 2+: canards.
  if (tier >= 2) { mirrorPath(ctx, cx, [4, 14, 14, 18, 14, 21, 4, 21]); ctx.fillStyle = '#1a1424'; ctx.fill(); outline(ctx, 0.6); }
  // Long hot-rod hull with exposed engine block at the back.
  mirrorPath(ctx, cx, [0, 1, 3, 8, 5, 22, 16, 34, 18, 40, 9, 41, 8, 50, 0, 51]);
  ctx.fillStyle = chrome(ctx, cx - 18, cx + 18, '#120a18', '#4a3a5e', '#c8b4e4'); ctx.fill(); outline(ctx);
  // Racing stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(cx - 2.2, 6, 1.2, 30); ctx.fillRect(cx + 1, 6, 1.2, 30);
  // Exhaust manifolds (more with tier).
  const pipes = 1 + Math.min(3, tier - 1);
  for (const s of [-1, 1]) for (let k = 0; k < pipes; k++) {
    ctx.fillStyle = '#2a2232'; ctx.fillRect(cx + s * (6 + k * 3) - 1, 38 + k, 2, 10);
    glowDot(ctx, cx + s * (6 + k * 3), 49 + k, 2, 'rgba(190,140,255,1)');
  }
  // Tier 3+: supercharger scoop.
  if (tier >= 3) { ctx.beginPath(); ctx.roundRect(cx - 4, 24, 8, 9, 2); ctx.fillStyle = chrome(ctx, cx - 4, cx + 4); ctx.fill(); outline(ctx, 0.6); }
  // Tier 4: heat fins.
  if (tier >= 4) neonLines(ctx, cx, [16, 34, 22, 44, 18, 40, 22, 47], 'rgba(200,140,255,1)', 0.9, 6);
  canopy(ctx, cx, 16, 2.6, 5, '#ffffff', '#b89aff', '#160a2a');
  neonLines(ctx, cx, [5, 22, 16, 34], 'rgba(200,160,255,1)', 0.7, 5);
}

function drawGun(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 3, 4, 3, h - 2, 0, h - 1]);
  ctx.fillStyle = chrome(ctx, cx - 3, cx + 3); ctx.fill(); outline(ctx, 0.5);
  glowDot(ctx, cx, 2, 2, 'rgba(200,170,255,1)');
}

const plasmaSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(200,190,255,0.9)');

const heatOf = (p) => (p.ps.nova ? 100 : p.ps.heat);

export default {
  id: 'dax',
  name: 'DAX MORROW',
  vehicle: 'OVERCLOCK',
  role: 'Hot-rod Jet',
  bio: 'Street racer with more tickets than flight hours. The Precinct recruited Dax instead of jailing him, on the condition that he only red-lines the engine at criminals.',
  color: HOT,
  css: '#c08aff',
  stats: { speed: 5, power: 4, range: 3, bomb: 2 },
  speed: { normal: 5.4, focus: 2.3 },
  hitbox: 2.3,
  bombStock: 2,
  engines: [[-6, 26], [6, 26]],
  engineColor: [0.8, 0.5, 1.0],
  optionSprite: 'd_gun',
  portrait: { skin: '#c88c64', hair: '#e8e4ff', style: 'undercut', eyes: 'goggles', accent: 'tattoo', suit: '#2c2238' },
  weapons: {
    main: 'Overclock Cannons — fire rate climbs with engine heat',
    focus: 'Heat Lance — piercing beam that widens as the engine heats',
  },
  special: {
    name: 'VENT BLAST',
    desc: 'Dump all heat as a forward cone; hotter = harder',
    cooldown: 240,
    duration: 14,
    activate(p, w) {
      p.ps.vent = Math.max(15, heatOf(p));
      if (!p.ps.nova) p.ps.heat = 0;
      w.g.camera.addTrauma(0.25);
      w.r.post.shockwave(p.x, p.y - 40, 0.03, 0.02, 0.4);
    },
    update(p, w, t) {
      const k = p.ps.vent / 100, reach = 120 + 220 * k;
      // Cone: three lines fanning forward.
      for (const da of [-0.35, 0, 0.35]) {
        const a = UP + da, x1 = p.x + Math.cos(a) * reach, y1 = p.y + Math.sin(a) * reach;
        w.cancelLine(p.x, p.y, x1, y1, 30 + 40 * k);
        if (t % 3 === 1) w.damageLine(p.x, p.y, x1, y1, 26, 2 + 10 * k);
      }
      for (let n = 0; n < 4; n++) {
        const a = UP + w.fxRng.range(-0.4, 0.4), s = w.fxRng.range(6, 12);
        mote(w, p.x, p.y - 16, Math.cos(a) * s, Math.sin(a) * s, mix(k), 12, 18);
      }
    },
  },
  bomb: {
    name: 'NITRO WALL',
    duration: 100,
    activate(p) { p.ps.wall = { y: p.y }; },
    update(p, w, t) {
      w.cancelAll();
      const wl = p.ps.wall;
      wl.y = p.y - t * 7;
      w.damageLine(-10, wl.y, W + 10, wl.y, 30, 14, w.bombId);
      for (let k = 0; k < 8; k++) mote(w, w.fxRng.range(0, W), wl.y + w.fxRng.range(-10, 10), w.fxRng.range(-1, 1), 3, mix(0.8), 14, 20);
    },
    end(p) { p.ps.wall = null; },
  },
  ultimate: {
    name: 'MELTDOWN NOVA',
    duration: 280,
    activate(p, w) { p.ps.nova = { rings: [] }; w.r.post.heat(0.8); },
    update(p, w, t) {
      w.cancelAll();
      const nv = p.ps.nova;
      if (t % 18 === 0) { nv.rings.push({ x: p.x, y: p.y, r: 10 }); w.g.camera.addTrauma(0.2); }
      for (const r of nv.rings) {
        r.r += 9;
        w.cancelCircle(r.x, r.y, r.r);
        for (const e of w.enemies.active) {
          if (!e.alive || e.untargetable) continue;
          const d = Math.hypot(e.x - r.x, e.y - r.y);
          if (Math.abs(d - r.r) < 14 + e.r) w.damage(e, 2.4);
        }
      }
      nv.rings = nv.rings.filter((r) => r.r < 720);
      if (t % 30 === 0) w.r.post.heat(0.5);
    },
    end(p) { p.ps.nova = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_dax_${t}`, 46, 54, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('d_gun', 6, 14, drawGun, { scale: s });
    atlas.add('d_plasma', 20, 6, plasmaSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fPlasma = w.r.frame('d_plasma');
    p.ps.heat = 0;
    p.ps.vent = 0;
  },

  reset(p) { p.ps.heat = 0; p.ps.nova = null; },

  update(p, w) {
    if (p.ps.nova) return;
    if (p.firing) p.ps.heat = Math.min(100, p.ps.heat + 0.55);
    else p.ps.heat = Math.max(0, p.ps.heat - 1.6);
    if (p.ps.heat >= 100 && p.t % 6 === 0) mote(w, p.x + w.fxRng.range(-10, 10), p.y + 20, 0, 2, HOT, 6, 14);
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const o = p.focus ? [[-9, -6], [9, -6]] : [[-16, 0], [16, 0]];
    return t >= 4 ? [...o, ...(p.focus ? [[-15, 4], [15, 4]] : [[-26, 10], [26, 10]])] : o;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots, k = heatOf(p) / 100, col = mix(k);
    if (p.focus) {
      const wd = 4 + t + 16 * k;
      w.beam(p.x, p.y - 24, p.x, -20, wd, 0.16 + 0.05 * t + 0.25 * k, col);
    }
    if (p.fireCd > 0) return;
    p.fireCd = Math.round(9 - 6.5 * k); // 9 → 2-3 steps as the engine heats
    const dmg = 0.8 + 0.4 * k;
    const n = p.focus ? 1 : 1 + t;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 6, a = UP + (p.focus ? 0 : (i - (n - 1) / 2) * 0.05);
      const j = w.shot(p.x + off, p.y - 24, a, 15, p.ps.fPlasma, dmg, 5, 0.9 + 0.4 * k);
      if (j >= 0) S.behave(j, dmg);
    }
    muzzle(w, p.x, p.y - 26, col, 10 + 8 * k);
    for (const o of p.options) {
      const j = w.shot(o.x, o.y - 8, UP, 15, p.ps.fPlasma, 0.6, 5, 0.8);
      if (j >= 0) S.behave(j, 0.6);
    }
  },

  renderAbove(p, b, x, y) {
    // Heat gauge arc under the ship.
    const F = p.F, k = heatOf(p) / 100, c = mix(k);
    if (k > 0.02) b.draw(F.glow, x, y + 22, 26 + 30 * k, 14 + 10 * k, 0, c[0], c[1], c[2], 0.25 + 0.5 * k, 1);
    const segs = Math.round(k * 10);
    for (let s = 0; s < 10; s++) {
      const a = Math.PI * (0.15 + 0.07 * s);
      b.draw(F.white, x + Math.cos(a) * 26, y + Math.sin(a) * 26, 2.6, 2.6, 0, s < segs ? c[0] * 2 : 0.2, s < segs ? c[1] * 2 : 0.2, s < segs ? c[2] * 2 : 0.25, s < segs ? 0.9 : 0.35, s < segs ? 1 : 0);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    if (p.ps.wall) b.draw(F.laser, W / 2, p.ps.wall.y, W + 40, 50, 0, HOT[0] * 1.6, HOT[1] * 1.6, HOT[2] * 1.6, 0.8, 1);
    for (const r of p.ps.nova ? p.ps.nova.rings : []) {
      const a = Math.max(0, 1 - r.r / 720);
      b.draw(F.ring, r.x, r.y, r.r * 2.15, r.r * 2.15, 0, 1.6, 1.0, 2.2, a, 1);
    }
    if (p.specialT > 0) {
      const k = p.ps.vent / 100, reach = 120 + 220 * k;
      for (const da of [-0.35, 0, 0.35]) {
        const a = UP + da;
        b.draw(F.laser, p.x + Math.cos(a) * reach / 2, p.y + Math.sin(a) * reach / 2, reach, 30 + 30 * k, a, 1.2, 1, 2, 0.5 * (p.specialT / 14), 1);
      }
    }
  },
};

