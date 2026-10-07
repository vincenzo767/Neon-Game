import { mirrorPath, outline, canopy, glowDot, drawBolt, neonStroke } from '../fx/art.js';
import { UP, TAU, W, H, muzzle, ringPulse, mote, nearestN, shipScale } from './common.js';

// LIN HAYASE — PETAL ENGINE (bio-tech craft)
// Seeding spores that bloom into turrets · Focus: petals converge into a
// tight stream and turrets aim at the locked target · Special: Bloom
// (instant garden around the ship) · Bomb: Petal Storm
// Ultimate: Forest of Light (beam pillars sprout across the screen)

const LEAF = [0.45, 1.0, 0.6];
const PETAL = [1.0, 0.6, 0.85];
const MAX_TURRETS = [3, 4, 6, 8];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Leaf wings (more with tier).
  for (let k = 0; k < 1 + tier; k++) for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 26); ctx.rotate(s * (0.6 + k * 0.32));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -14, 0, -26 + k * 2); ctx.quadraticCurveTo(-7, -14, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, -26);
    g.addColorStop(0, '#103a20'); g.addColorStop(1, k % 2 ? '#ff9ad0' : '#7aff9a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,255,220,0.6)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -22); ctx.stroke();
    ctx.restore();
  }
  // Pod body.
  mirrorPath(ctx, cx, [0, 6, 7, 12, 9, 28, 7, 40, 3, 46, 0, 47]);
  const g = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
  g.addColorStop(0, '#0c2014'); g.addColorStop(0.45, '#4a8a5a'); g.addColorStop(1, '#0a1a10');
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  // Bio veins.
  ctx.beginPath(); ctx.moveTo(cx, 14); ctx.quadraticCurveTo(cx - 5, 30, cx, 44); ctx.moveTo(cx, 14); ctx.quadraticCurveTo(cx + 5, 30, cx, 44);
  neonStroke(ctx, 'rgba(120,255,160,1)', 0.6, 5);
  // Tier 3+: seed bulbs.
  if (tier >= 3) for (const s of [-1, 1]) glowDot(ctx, cx + s * 6, 36, 3.2, 'rgba(255,150,210,1)');
  // Tier 4: flower crown at the nose.
  if (tier >= 4) for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 3, 1.6, a, 0, TAU);
    ctx.fillStyle = 'rgba(255,170,220,0.95)'; ctx.fill();
  }
  canopy(ctx, cx, 20, 3, 5, '#ffffff', '#9affc0', '#0a2a18');
}

function drawSeed(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
  const g = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, w / 2);
  g.addColorStop(0, '#eaffef'); g.addColorStop(0.5, '#5ad87a'); g.addColorStop(1, '#0a3018');
  ctx.fillStyle = g; ctx.fill();
}

function drawBud(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5, 4.4, 2.4, a, 0, TAU);
    ctx.fillStyle = 'rgba(255,160,215,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(80,20,50,0.6)'; ctx.lineWidth = 0.4; ctx.stroke();
  }
  glowDot(ctx, cx, cy, 3.6, 'rgba(150,255,170,1)');
}

const petalSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(140,255,170,0.85)', '#f0fff4');
const needleSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(255,170,220,0.85)');

export default {
  id: 'lin',
  name: 'LIN HAYASE',
  vehicle: 'PETAL ENGINE',
  role: 'Bio-tech Craft',
  bio: 'A botanist from the Crown\'s sky-gardens who grows her own weapons. Everything Lin fires takes root, and her garden keeps fighting after she has moved on.',
  color: LEAF,
  css: '#7aff9a',
  stats: { speed: 3, power: 3, range: 4, bomb: 3 },
  speed: { normal: 4.4, focus: 2.0 },
  hitbox: 2.4,
  bombStock: 3,
  engines: [[0, 22]],
  engineColor: [0.5, 1.0, 0.6],
  optionSprite: 'l_bud',
  optionSpin: 0.04,
  portrait: { skin: '#f0d2b8', hair: '#2a5a34', style: 'ponytail', eyes: 'eyes', iris: '#5ad87a', accent: 'freckles' },
  weapons: {
    main: 'Seed Spread — petals plus spores that take root as turrets',
    focus: 'Pollen Lance — converged petals; every turret fires on your target',
  },
  special: {
    name: 'BLOOM',
    desc: 'A ring of turrets bursts open around the ship; buds eat bullets',
    cooldown: 540,
    duration: 1,
    activate(p, w) {
      for (let k = 0; k < 5; k++) {
        const a = UP + (k - 2) * 0.55;
        plant(p, w, p.x + Math.cos(a) * 54, p.y + Math.sin(a) * 54, 300);
      }
      w.cancelCircle(p.x, p.y, 90);
      ringPulse(w, p.x, p.y, PETAL, 10, 90, 20);
    },
  },
  bomb: {
    name: 'PETAL STORM',
    duration: 110,
    activate(p) { p.ps.storm = { x: p.x, y: p.y }; },
    update(p, w, t) {
      w.cancelAll();
      const st = p.ps.storm;
      const r = Math.min(360, t * 6);
      if (t % 3 === 0) w.damageCircle(st.x, st.y, r, 3.2);
      for (let k = 0; k < 6; k++) {
        const a = t * 0.12 + (k / 6) * TAU;
        mote(w, st.x + Math.cos(a) * r, st.y + Math.sin(a) * r, Math.cos(a + 1.6) * 3, Math.sin(a + 1.6) * 3, k % 2 ? PETAL : LEAF, 9, 26);
      }
    },
    end(p) { p.ps.storm = null; },
  },
  ultimate: {
    name: 'FOREST OF LIGHT',
    duration: 300,
    activate(p) {
      // Nine pillars grow in a sweep from the centre outward.
      const xs = [240, 190, 290, 140, 340, 90, 390, 40, 440];
      p.ps.forest = xs.map((x, k) => ({ x, born: 20 + k * 10, sway: k * 1.3 }));
    },
    update(p, w, t) {
      w.cancelAll();
      for (const pl of p.ps.forest) {
        if (t < pl.born) continue;
        const age = t - pl.born, wd = Math.min(36, age * 3);
        const x = pl.x + Math.sin(t * 0.03 + pl.sway) * 14;
        pl.cx = x; pl.wd = wd;
        w.beam(x, H + 10, x, -10, wd, 1.1, LEAF);
        if (age === 0) { ringPulse(w, x, H - 20, LEAF, 10, 70, 18); w.g.camera.addTrauma(0.12); }
        if (t % 4 === 0) mote(w, x + w.fxRng.range(-wd, wd) * 0.5, H - w.fxRng.range(0, H), 0, -2, PETAL, 8, 24);
      }
    },
    end(p) { p.ps.forest = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_lin_${t}`, 56, 50, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('l_bud', 16, 16, drawBud, { scale: s });
    atlas.add('l_seed', 8, 10, drawSeed, { scale: s });
    atlas.add('l_petal', 16, 6, petalSprite, { scale: s });
    atlas.add('l_needle', 14, 4, needleSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fPetal = w.r.frame('l_petal');
    p.ps.fNeedle = w.r.frame('l_needle');
    p.ps.fSeed = w.r.frame('l_seed');
    p.ps.fBud = w.r.frame('l_bud');
    p.ps.seeds = [];
    p.ps.turrets = [];
  },

  reset(p) { p.ps.seeds = []; },

  update(p, w) {
    // Seeds fly, slow down and take root as turrets.
    for (const s of p.ps.seeds) {
      s.px = s.x; s.py = s.y;
      s.y += s.vy; s.vy *= 0.94; s.t++;
      if (s.t >= 26) { plant(p, w, s.x, s.y, 200 + p.tier * 30); s.dead = true; }
    }
    p.ps.seeds = p.ps.seeds.filter((s) => !s.dead);
    // Turrets fire homing needles; buds also eat bullets that touch them.
    const lock = p.focus && p.firing ? nearestN(w, p.x, p.y - 40, 1, 600)[0] : null;
    for (const tu of p.ps.turrets) {
      tu.t++;
      w.cancelCircle(tu.x, tu.y, 9);
      if (tu.t % (p.focus ? 9 : 14) !== 0) continue;
      const tg = lock || nearestN(w, tu.x, tu.y, 1, 380)[0];
      const a = tg ? Math.atan2(tg.y - tu.y, tg.x - tu.x) : UP;
      const i = w.shot(tu.x, tu.y, a, 11, p.ps.fNeedle, 0.6, 4);
      if (i >= 0) w.shots.behave(i, 0.6, 80, 0, 0.08);
    }
    p.ps.turrets = p.ps.turrets.filter((tu) => tu.t < tu.life);
  },

  optionLayout(p) {
    const n = p.tier >= 2 ? p.tier - 1 : 0, out = [];
    for (let k = 0; k < n; k++) {
      const a = p.t * 0.04 + (k / n) * TAU;
      out.push(p.focus ? [(k - (n - 1) / 2) * 14, -18] : [Math.cos(a) * 26, Math.sin(a) * 16 + 6]);
    }
    return out;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots;
    p.fireCd = 6;
    const n = 2 + t, spread = p.focus ? 0.1 : 0.5;
    for (let k = 0; k < n; k++) {
      const a = UP + (k / (n - 1) - 0.5) * spread;
      const i = w.shot(p.x, p.y - 16, a, 12, p.ps.fPetal, 0.8, 5, 0.9 + t * 0.08);
      if (i >= 0) S.behave(i, 0.8);
    }
    muzzle(w, p.x, p.y - 18, LEAF, 12);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 12, p.ps.fNeedle, 0.5, 4);
      if (i >= 0) S.behave(i, 0.5, 90, 0, 0.06);
    }
    // A seed every few volleys (more often unfocused).
    if ((p.t % (p.focus ? 48 : 30)) < 6 && p.ps.seeds.length < 3) {
      p.ps.seeds.push({ x: p.x + w.rng.range(-30, 30), y: p.y - 20, px: p.x, py: p.y, vy: -9, t: 0 });
    }
  },

  renderBelow(p, b, x, y, alpha) {
    const F = p.F;
    for (const tu of p.ps.turrets) {
      const k = Math.min(1, tu.t / 12), fade = tu.life - tu.t < 40 && (tu.t >> 2) & 1 ? 0.4 : 1;
      b.draw(F.glow, tu.x, tu.y, 34 * k, 34 * k, 0, LEAF[0], LEAF[1], LEAF[2], 0.35 * fade, 1);
      b.draw(p.ps.fBud, tu.x, tu.y, 16 * k, 16 * k, tu.t * 0.03, 1, 1, 1, fade, 0);
    }
    for (const s of p.ps.seeds) {
      const sx = s.px + (s.x - s.px) * alpha, sy = s.py + (s.y - s.py) * alpha;
      b.draw(F.glow, sx, sy, 20, 20, 0, LEAF[0], LEAF[1], LEAF[2], 0.4, 1);
      b.draw(p.ps.fSeed, sx, sy, 8, 10, s.t * 0.2, 1, 1, 1, 1, 0);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    if (p.ps.storm) {
      const t = p.def.bomb.duration - p.bombT, r = Math.min(360, t * 6);
      b.draw(F.ring, p.ps.storm.x, p.ps.storm.y, r * 2.2, r * 2.2, t * 0.05, PETAL[0], PETAL[1], PETAL[2], 0.5 * (1 - t / 110), 1);
    }
    for (const pl of p.ps.forest || []) {
      if (!pl.wd) continue;
      b.draw(F.glow, pl.cx, H - 10, pl.wd * 3, 60, 0, LEAF[0], LEAF[1], LEAF[2], 0.6, 1);
    }
  },
};

function plant(p, w, x, y, life) {
  const T = p.ps.turrets, cap = MAX_TURRETS[p.tier - 1] + 5;
  if (T.length >= cap) T.shift();
  T.push({ x: Math.max(10, Math.min(W - 10, x)), y: Math.max(20, Math.min(H - 30, y)), t: 0, life });
  w.explosions.sparks(x, y, 6, PETAL, 2.5, 14, 3);
}
