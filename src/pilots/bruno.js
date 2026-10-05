import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, chrome, outline, glowDot, drawBolt, neonLines } from './art.js';
import { SHOT_FLAK } from '../entities/World.js';

// BRUNO HAGEN — IRONHOUND (armored gunship)
// Wide flak airbursts · Focus: heavy cannon shells · Special: brace mode
// Bomb: Flak Barrage · Ultimate: Carpet-Bomb Run

const ORANGE = [1.0, 0.55, 0.15];
const UP = -Math.PI / 2;

const ARMOR = (ctx, x0, x1) => chrome(ctx, x0, x1, '#16180f', '#555a3a', '#b0b28a');

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Tier 4: armour skirts + missile racks behind the hull.
  if (tier >= 4) {
    mirrorPath(ctx, cx, [8, 30, 26, 34, 26, 44, 10, 46]);
    ctx.fillStyle = '#23251a'; ctx.fill(); outline(ctx);
    ctx.fillStyle = '#c33';
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ctx.fillRect(cx + s * (18 + k * 2.4) - 0.8, 36, 1.6, 6);
  }
  // Hull.
  mirrorPath(ctx, cx, [0, 3, 6, 5, 9, 13, 10, 21, 22, 25, 24, 33, 22, 39, 12, 41, 10, 49, 0, 50]);
  ctx.fillStyle = ARMOR(ctx, cx - 24, cx + 24); ctx.fill(); outline(ctx, 1);
  // Armour plate seams.
  ctx.strokeStyle = 'rgba(10,10,6,0.8)'; ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 21); ctx.lineTo(cx + 10, 21);
  ctx.moveTo(cx - 10, 33); ctx.lineTo(cx + 10, 33);
  ctx.moveTo(cx, 21); ctx.lineTo(cx, 49);
  ctx.stroke();
  // Hazard stripes on wings.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(s > 0 ? cx + 13 : cx - 22, 27, 9, 5); ctx.clip();
    for (let k = -2; k < 6; k++) {
      ctx.fillStyle = k & 1 ? '#111' : '#ff9a1a';
      ctx.beginPath();
      const x = (s > 0 ? cx + 13 : cx - 22) + k * 2.5;
      ctx.moveTo(x, 27); ctx.lineTo(x + 2.5, 27); ctx.lineTo(x + 0.5, 32); ctx.lineTo(x - 2, 32); ctx.fill();
    }
    ctx.restore();
  }
  // Visor slit.
  ctx.fillStyle = '#100800'; ctx.fillRect(cx - 5, 10, 10, 4);
  ctx.save(); ctx.shadowColor = '#ffa030'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffc060'; ctx.fillRect(cx - 4, 11, 8, 2); ctx.restore();
  // Tier 2+: chin turret.
  if (tier >= 2) {
    ctx.fillStyle = '#2b2e1e'; ctx.beginPath(); ctx.arc(cx, 19, 3.4, 0, Math.PI * 2); ctx.fill(); outline(ctx, 0.6);
    ctx.fillStyle = '#111'; ctx.fillRect(cx - 0.8, 12.5, 1.6, 6);
  }
  // Tier 3+: wing gun pods.
  if (tier >= 3) {
    for (const s of [-1, 1]) {
      const x = cx + s * 17;
      ctx.fillStyle = ARMOR(ctx, x - 3, x + 3); ctx.fillRect(x - 3, 16, 6, 12); ctx.strokeStyle = '#05060a'; ctx.lineWidth = 0.6; ctx.strokeRect(x - 3, 16, 6, 12);
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x - 0.9, 10, 1.8, 7);
      glowDot(ctx, x, 10, 1.8, 'rgba(255,170,60,1)');
    }
  }
  neonLines(ctx, cx, [10, 21.5, 22, 25.5], 'rgba(255,160,50,1)', 0.7, 5);
}

function drawPod(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = ARMOR(ctx, 0, w); ctx.fillRect(1, 4, w - 2, h - 5);
  ctx.strokeStyle = '#05060a'; ctx.lineWidth = 0.6; ctx.strokeRect(1, 4, w - 2, h - 5);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(cx - 1, 0, 2, 6);
  glowDot(ctx, cx, h - 3, 2, 'rgba(255,160,60,1)');
}

function drawFlak(ctx, w, h) { glowDot(ctx, w / 2, h / 2, w / 2, 'rgba(255,150,40,1)'); }
function drawShell(ctx, w, h) { drawBolt(ctx, w, h, 'rgba(255,140,40,1)', '#fff0c0'); }

function drawBomber(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 5, 10, 6, 26, 44, 40, 44, 46, 8, 44, 6, 60, 16, 66, 16, 69, 0, 68]);
  ctx.fillStyle = chrome(ctx, 0, w, '#101208', '#3b3f2a', '#80846a'); ctx.fill(); outline(ctx, 1.2);
  for (const s of [-1, 1]) for (const ex of [16, 30]) glowDot(ctx, cx + s * ex, 45, 3, 'rgba(255,150,50,1)');
  ctx.fillStyle = '#ffb040'; ctx.fillRect(cx - 3, 12, 6, 3);
}

/** Pick an airburst target: a live enemy if any, otherwise a random spot up-field. */
function burstTarget(w) {
  const E = w.enemies.active.filter((e) => e.alive && e.y > 0);
  if (E.length && w.rng.chance(0.7)) {
    const e = w.rng.pick(E);
    return [e.x + w.rng.range(-20, 20), e.y + w.rng.range(-20, 20)];
  }
  return [w.rng.range(30, WORLD_W - 30), w.rng.range(40, WORLD_H * 0.6)];
}

export default {
  id: 'bruno',
  name: 'BRUNO HAGEN',
  vehicle: 'IRONHOUND',
  role: 'Armored Gunship',
  bio: 'Twenty years on riot detail and two rebuilt knees. Bruno doesn\'t dodge so much as lean into the storm and fill the sky with flak until it stops.',
  color: ORANGE,
  css: '#ff9a3a',
  stats: { speed: 2, power: 5, range: 2, bomb: 4 },
  speed: { normal: 3.6, focus: 1.6 },
  hitbox: 3.0,
  bombStock: 4,
  engines: [[-6, 24], [6, 24]],
  engineColor: [1.0, 0.6, 0.3],
  optionSprite: 'b_pod',
  portrait: { skin: '#a96c4b', hair: '#3a2b22', style: 'buzz', eyes: 'eyes', iris: '#8aa0b0', accent: 'beard' },
  weapons: {
    main: 'Flak Spread — wide airburst shells, area damage',
    focus: 'Siege Cannon — heavy high-yield shells',
  },
  special: {
    name: 'BRACE',
    desc: 'Lock armour plating: absorbs one lethal hit',
    cooldown: 900,
    duration: 300,
    activate(p) { p.ps.brace = true; p.speedMul = 0.8; },
    end(p) { p.ps.brace = false; p.speedMul = 1; },
  },
  bomb: {
    name: 'FLAK BARRAGE',
    duration: 100,
    activate() {},
    update(p, w, t) {
      w.cancelAll();
      if (t % 3 === 0) {
        const [x, y] = burstTarget(w);
        w.explosions.blast(x, y, 0.9, ORANGE);
        w.damageCircle(x, y, 55, 7);
      }
    },
  },
  ultimate: {
    name: 'CARPET-BOMB RUN',
    duration: 250,
    activate(p) {
      const xs = [60, 150, 240, 330, 420];
      p.ps.bombers = xs.map((x, k) => ({ x, y: WORLD_H + 80 + Math.abs(k - 2) * 50, py: 0, drop: k * 2 }));
      p.ps.drops = [];
    },
    update(p, w) {
      w.cancelAll();
      for (const bm of p.ps.bombers) {
        bm.py = bm.y;
        bm.y -= 4.2;
        if (bm.y < WORLD_H && bm.y > 0 && ++bm.drop % 6 === 0) p.ps.drops.push({ x: bm.x + w.rng.range(-14, 14), y: bm.y + 10, t: 18 });
      }
      for (const d of p.ps.drops) {
        d.y += 0.6;
        if (--d.t === 0) {
          w.explosions.blast(d.x, d.y, 1.2, ORANGE);
          w.damageCircle(d.x, d.y, 60, 9);
        }
      }
      p.ps.drops = p.ps.drops.filter((d) => d.t > 0);
    },
    end(p) { p.ps.bombers = null; p.ps.drops = null; },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_bruno_${t}`, 52, 52, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('b_pod', 10, 14, drawPod, { scale: 3 });
    atlas.add('b_flak', 10, 10, drawFlak, { scale: 3 });
    atlas.add('b_shell', 16, 7, drawShell, { scale: 3 });
    atlas.add('b_bomber', 92, 70, drawBomber, { scale: 2 });
  },

  init(p, w) {
    p.ps.fFlak = w.r.frame('b_flak');
    p.ps.fShell = w.r.frame('b_shell');
    p.ps.fBomber = w.r.frame('b_bomber');
    p.ps.brace = false;
  },

  reset(p) { p.ps.brace = false; p.speedMul = 1; },

  onHit(p, w) {
    if (!p.ps.brace) return false;
    // Brace absorbs the hit: plating shatters, nearby bullets are blown away.
    p.ps.brace = false;
    p.specialT = 0;
    p.speedMul = 1;
    p.invuln = 90;
    w.cancelCircle(p.x, p.y, 130);
    w.explosions.blast(p.x, p.y, 0.8, ORANGE);
    w.r.post.flash(1, 0.6, 0.2, 0.3, 0.05);
    w.g.camera.addTrauma(0.4);
    w.event('brace');
    return true;
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    if (p.focus) return t >= 4 ? [[-16, -2], [16, -2], [-26, 6], [26, 6]] : [[-16, -2], [16, -2]];
    return t >= 4 ? [[-26, 8], [26, 8], [-38, 18], [38, 18]] : [[-26, 8], [26, 8]];
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots, R = w.rng;
    if (p.focus) {
      p.fireCd = 10;
      const n = 1 + (t >> 1);
      for (let k = 0; k < n; k++) {
        const i = w.shot(p.x + (k - (n - 1) / 2) * 8, p.y - 22, UP, 12, p.ps.fShell, 4.5, 6);
        if (i >= 0) S.behave(i, 4.5, 34, 0, 0, SHOT_FLAK, 34);
      }
      for (const o of p.options) {
        const i = w.shot(o.x, o.y - 8, UP, 12, p.ps.fShell, 2.5, 6);
        if (i >= 0) S.behave(i, 2.5, 30, 0, 0, SHOT_FLAK, 26);
      }
      w.g.camera.kick(0, 1.2);
      return;
    }
    p.fireCd = 8;
    const n = 3 + t * 2;
    const spread = 0.5 + 0.08 * t;
    for (let k = 0; k < n; k++) {
      const a = UP + (k / (n - 1) - 0.5) * spread;
      const i = w.shot(p.x, p.y - 18, a, 9 + R.range(-0.6, 0.6), p.ps.fFlak, 1.6, 5);
      if (i >= 0) S.behave(i, 1.6, 20 + t * 2 + R.int(0, 4), 0, 0, SHOT_FLAK, 20);
    }
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 8, UP, 10, p.ps.fFlak, 1.4, 5);
      if (i >= 0) S.behave(i, 1.4, 26, 0, 0, SHOT_FLAK, 20);
    }
  },

  renderAbove(p, b, x, y) {
    if (!p.ps.brace) return;
    const F = p.F, pulse = 0.75 + 0.25 * Math.sin(p.t * 0.25);
    const ending = p.specialT < 60 && (p.t >> 2) & 1;
    b.draw(F.ring, x, y, 64 * pulse, 64 * pulse, 0, 2, 1.1, 0.3, ending ? 0.3 : 0.7, 1);
    b.draw(F.glow, x, y, 70, 70, 0, 1, 0.5, 0.1, 0.25, 1);
  },

  renderFx(p, b, alpha) {
    if (!p.ps.bombers) return;
    const F = p.F;
    for (const d of p.ps.drops) {
      b.draw(p.ps.fShell, d.x, d.y, 14, 7, Math.PI / 2, 0.5, 0.5, 0.5, 1, 0);
      b.draw(F.glow, d.x, d.y, 26, 26, 0, 2, 0.6, 0.1, (d.t & 2) ? 0.6 : 0.2, 1);
    }
    for (const bm of p.ps.bombers) {
      const y = bm.py + (bm.y - bm.py) * alpha;
      b.draw(F.glow, bm.x, y + 34, 50, 50, 0, 1, 0.5, 0.2, 0.5, 1);
      b.draw(p.ps.fBomber, bm.x, y, 92, 70, 0, 1, 1, 1, 1, 0);
    }
  },
};
