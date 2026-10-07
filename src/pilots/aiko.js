import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, TAU, W, H, muzzle, ringPulse, mote, targets, shipScale } from './common.js';

// AIKO BRANDT — TEMPEST (twin-rotor gunship)
// Rotating tornado shots: rotor streams plus tornado cells that drift up
// the screen, spin bullets out of the air and grind whatever they touch.
// Focus: tornadoes hold in front of the ship as a spinning shield-drill.
// Special: Downdraft (bullets near the ship are blown back up)
// Bomb: Cyclone Walls · Ultimate: Hurricane Eye

const WIND = [0.45, 1.0, 0.9];
const PALE = [0.85, 1.0, 0.98];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Twin rotor booms.
  for (const s of [-1, 1]) {
    ctx.fillStyle = chrome(ctx, cx + s * 18 - 3, cx + s * 18 + 3, '#0a1416', '#3a6066', '#a8d4d8');
    ctx.beginPath(); ctx.rect(cx + s * 4, 21, s * 14, 5); ctx.fill(); outline(ctx, 0.5);
    ctx.beginPath(); ctx.arc(cx + s * 19, 22, 9, 0, TAU); ctx.fillStyle = 'rgba(10,20,22,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,255,230,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    glowDot(ctx, cx + s * 19, 22, 2.2, 'rgba(160,255,240,1)');
    // Tier 2+: stub wings with pylons.
    if (tier >= 2) { ctx.fillStyle = '#16262a'; ctx.fillRect(cx + s * 8 - (s < 0 ? 6 : 0), 32, 6, 3); }
    if (tier >= 3) { ctx.fillStyle = '#20343a'; ctx.beginPath(); ctx.rect(cx + s * 12 - 1.5, 30, 3, 10); ctx.fill(); outline(ctx, 0.4); }
  }
  // Fuselage.
  mirrorPath(ctx, cx, [0, 6, 5, 10, 7, 24, 6, 38, 3, 50, 0, 51]);
  ctx.fillStyle = chrome(ctx, cx - 7, cx + 7, '#08100f', '#3a6a6a', '#c8f0ec'); ctx.fill(); outline(ctx);
  // Tail fin + tier 4 tail rotor.
  ctx.fillStyle = '#16262a'; ctx.fillRect(cx - 5, 47, 10, 2.5);
  if (tier >= 4) { ctx.beginPath(); ctx.arc(cx, 48, 4, 0, TAU); ctx.strokeStyle = 'rgba(160,255,240,0.9)'; ctx.lineWidth = 0.8; ctx.stroke(); }
  neonLines(ctx, cx, [5, 10, 7, 24, 6, 38, 3, 50], 'rgba(120,255,230,1)', 0.6, 5);
  canopy(ctx, cx, 13, 3.6, 5, '#ffffff', '#8affe8', '#082420');
}

function drawRotor(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 0.5;
  ctx.fillStyle = 'rgba(190,255,245,0.55)';
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - 0.08) * r, cy + Math.sin(a - 0.08) * r); ctx.lineTo(cx + Math.cos(a + 0.12) * r, cy + Math.sin(a + 0.12) * r); ctx.closePath(); ctx.fill();
  }
}

function drawGust(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 3, 5, 3, h - 3, 0, h - 1]);
  ctx.fillStyle = chrome(ctx, cx - 3, cx + 3, '#0a1416', '#3a6066', '#a8d4d8'); ctx.fill(); outline(ctx, 0.4);
  glowDot(ctx, cx, 2, 2, 'rgba(160,255,240,1)');
}

const windSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(140,255,230,0.85)', '#f0fffc');

/** Spawn a tornado cell. */
function tornado(p, x, y, vy, life, r) {
  p.ps.cells.push({ x, y, px: x, py: y, vy, t: 0, life, r });
}

export default {
  id: 'aiko',
  name: 'AIKO BRANDT',
  vehicle: 'TEMPEST',
  role: 'Twin-rotor Gunship',
  bio: 'A storm-chaser who flies the Storm Ring weather that grounds the Cartel. Aiko does not fight the wind: she points it.',
  color: WIND,
  css: '#6affe0',
  stats: { speed: 4, power: 3, range: 4, bomb: 3 },
  speed: { normal: 4.7, focus: 2.1 },
  hitbox: 2.4,
  bombStock: 3,
  engines: [[0, 26]],
  engineColor: [0.5, 1.0, 0.9],
  optionSprite: 'a_gust',
  portrait: { skin: '#e8c8a8', hair: '#3a2418', style: 'braids', eyes: 'eyes', iris: '#4ad8c0', accent: 'headphones', suit: '#1c2c2c' },
  weapons: {
    main: 'Rotor Streams + Tornado Cells — spinning cells grind and sweep bullets',
    focus: 'Drill Wind — tornadoes hold in front of the ship',
  },
  special: {
    name: 'DOWNDRAFT',
    desc: 'A gust blasts nearby bullets back up the screen',
    cooldown: 420,
    duration: 60,
    activate(p, w) { ringPulse(w, p.x, p.y, WIND, 10, 150, 18); },
    update(p, w) {
      const B = w.bullets;
      for (let i = 0; i < B.count; i++) {
        const dx = B.x[i] - p.x, dy = B.y[i] - p.y, d2 = dx * dx + dy * dy;
        if (d2 > 150 * 150) continue;
        B.dyn[i] = 0;
        const a = Math.atan2(dy, dx);
        B.setHeading(i, a, Math.max(4, B.spd[i]));
      }
      w.cancelCircle(p.x, p.y, 28);
    },
  },
  bomb: {
    name: 'CYCLONE WALLS',
    duration: 120,
    activate(p) { p.ps.walls = 0; },
    update(p, w, t) {
      w.cancelAll();
      p.ps.walls = t;
      const k = t / 120;
      for (const s of [-1, 1]) {
        const x = W / 2 + s * (W / 2 - k * (W / 2 - 10)) * 1;
        w.damageLine(x, -10, x, H + 10, 46, 2.2);
        for (let n = 0; n < 2; n++) mote(w, x + w.fxRng.range(-30, 30), w.fxRng.range(0, H), -s * 4, w.fxRng.range(-3, 3), WIND, 10, 16);
      }
    },
    end(p) { p.ps.walls = null; },
  },
  ultimate: {
    name: 'HURRICANE EYE',
    duration: 300,
    activate(p) { p.ps.eye = { t: 0 }; },
    update(p, w, t) {
      p.ps.eye.t = t;
      const B = w.bullets;
      // Every bullet is caught by the storm wall and spun out of existence.
      for (let i = 0; i < B.count; i++) {
        const dx = B.x[i] - p.x, dy = B.y[i] - p.y, d = Math.hypot(dx, dy) || 1;
        B.dyn[i] = 0;
        B.setHeading(i, Math.atan2(dy, dx) + Math.PI / 2 + 0.25, 6);
        if (B.age[i] % 3 === 0) B.x[i] += dx / d * 3;
      }
      w.cancelCircle(p.x, p.y, 70);
      if (t % 30 === 0) w.cancelAll();
      if (t % 4 === 0) for (const e of targets(w)) w.damage(e, 1.3);
      for (let n = 0; n < 4; n++) {
        const a = t * 0.08 + n * (TAU / 4), r = 120 + (t * 3) % 260;
        mote(w, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.cos(a + 1.6) * 5, Math.sin(a + 1.6) * 5, PALE, 12, 20);
      }
    },
    end(p) { p.ps.eye = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_aiko_${t}`, 58, 54, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('a_rotor', 20, 20, drawRotor, { scale: s });
    atlas.add('a_gust', 6, 14, drawGust, { scale: s });
    atlas.add('a_wind', 18, 5, windSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fWind = w.r.frame('a_wind');
    p.ps.fRotor = w.r.frame('a_rotor');
    p.ps.cells = [];
  },

  reset(p) { p.ps.cells = []; p.ps.eye = null; },

  update(p, w) {
    for (const c of p.ps.cells) {
      c.px = c.x; c.py = c.y; c.t++;
      if (c.hold !== undefined && p.focus && p.firing) {
        // Drill wind: the cell holds just ahead of the ship.
        c.x += (p.x + c.hold * 22 - c.x) * 0.3;
        c.y += (p.y - 70 - c.y) * 0.3;
      } else c.y += c.vy;
      w.cancelCircle(c.x, c.y, c.r * 0.55);
      if (c.t % 5 === 0) w.damageCircle(c.x, c.y, c.r, 0.9 + p.tier * 0.15);
    }
    p.ps.cells = p.ps.cells.filter((c) => c.t < c.life && c.y > -60);
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const o = p.focus ? [[-10, -10], [10, -10]] : [[-24, 6], [24, 6]];
    return t >= 4 ? [...o, ...(p.focus ? [[-20, -2], [20, -2]] : [[-36, 16], [36, 16]])] : o;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots;
    p.fireCd = 5;
    // Twin rotor streams that corkscrew around each other.
    const ph = p.t * 0.25;
    for (const s of [-1, 1]) {
      const x = p.x + s * 8 + Math.sin(ph) * 3 * s;
      const i = w.shot(x, p.y - 20, UP + s * 0.02 * (p.focus ? 0 : 1), 13, p.ps.fWind, 0.8, 5);
      if (i >= 0) { S.behave(i, 0.8); S.motion(i, 0, -s * 0.004); }
    }
    muzzle(w, p.x, p.y - 22, WIND, 10);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 13, p.ps.fWind, 0.55, 5);
      if (i >= 0) S.behave(i, 0.55);
    }
    // Tornado cells: unfocused they drift up the screen; focused they hold as a drill.
    const every = p.focus ? 30 : 36 - t * 3, live = p.ps.cells.length;
    if (p.t % every < 5 && live < 2 + t) {
      if (p.focus) {
        const used = new Set(p.ps.cells.filter((c) => c.hold !== undefined).map((c) => c.hold));
        const hold = [-1, 1, 0].find((hh) => !used.has(hh) && (hh !== 0 || t >= 3));
        if (hold !== undefined) {
          tornado(p, p.x, p.y - 40, -3, 240, 20 + t * 2);
          p.ps.cells[p.ps.cells.length - 1].hold = hold;
        }
      } else tornado(p, p.x + w.rng.range(-20, 20), p.y - 30, -2.4, 260, 18 + t * 3);
    }
  },

  renderAbove(p, b, x, y) {
    // Spinning rotor discs over the booms.
    const f = p.ps.fRotor;
    for (const s of [-1, 1]) b.draw(f, x + s * 19 * (1 - Math.abs(p.bank) * 0.18), y - 4, 20, 20, p.t * 0.9 * s, 1, 1, 1, 0.8 * p.alpha, 0.3);
  },

  renderFx(p, b, alpha) {
    const F = p.F;
    for (const c of p.ps.cells) {
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha, fade = Math.min(1, (c.life - c.t) / 30);
      for (let k = 0; k < 4; k++) {
        const r = c.r * (0.4 + k * 0.22);
        b.draw(F.ring, x, y - k * 3, r * 2.2, r * 1.4, c.t * (0.2 + k * 0.05), WIND[0], WIND[1], WIND[2], (0.5 - k * 0.08) * fade, 1);
      }
      b.draw(F.glow, x, y, c.r * 2, c.r * 2, 0, WIND[0], WIND[1], WIND[2], 0.25 * fade, 1);
    }
    if (p.ps.walls !== null && p.ps.walls !== undefined) {
      const k = p.ps.walls / 120;
      for (const s of [-1, 1]) {
        const x = W / 2 + s * (W / 2 - k * (W / 2 - 10));
        b.draw(F.laser, x, H / 2, H + 40, 90, Math.PI / 2, WIND[0], WIND[1], WIND[2], 0.4, 1);
      }
    }
    if (p.ps.eye) {
      const t = p.ps.eye.t;
      for (let k = 0; k < 5; k++) b.draw(F.ring, p.x, p.y, 140 + k * 120, 140 + k * 120, t * (0.03 + k * 0.01), PALE[0], PALE[1], PALE[2], 0.3 - k * 0.04, 1);
      b.draw(F.glow, p.x, p.y, 140, 140, 0, 0.3, 0.6, 0.6, 0.3, 1);
    }
  },
};
