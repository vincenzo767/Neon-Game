import { mirrorPath, chrome, neonLines, outline, glowDot } from '../fx/art.js';
import { UP, TAU, W, H, clamp, muzzle, ringPulse, nearestN, targets, stun, wash, shipScale } from './common.js';

// NOVA-7 — CIPHER (hacker pod)
// Hacks enemies into allies · Focus: Breach Beam locks onto the nearest
// regular enemy; hold it long enough and the target turns: it stops firing
// at you, hunts its old squad, then self-destructs. Bosses can't be
// hacked; the beam just burns them.
// Special: Firewall · Bomb: System Crash · Ultimate: City-Wide Override

const DATA = [0.35, 1.0, 0.65];
const HACKED = [0.4, 1.4, 0.7];
const HACK_LIFE = 360;

const isHacked = (e) => !!(e.ai && e.ai.hacked);
const hackable = (e) => e.alive && !isHacked(e) && !e.boss && !e.ctrl && e.kind !== 'bosspart';

/** Turn an enemy into a temporary ally (replaces its AI; it can't be shot or touched). */
function hack(w, p, e, announce = false) {
  if (!hackable(e)) return false;
  e.untargetable = true;
  const f = p.ps.fBit;
  const ai = (en, w2) => {
    ai.t++;
    const [tg] = nearestN(w2, en.x, en.y, 1, 600);
    if (tg) en.x += clamp(tg.x - en.x, -1.3, 1.3);
    en.y += clamp(Math.max(70, Math.min(H * 0.6, en.y)) - en.y, -1, 1) - 0.15;
    if (tg && ai.t % 9 === 0) {
      const i = w2.shot(en.x, en.y, Math.atan2(tg.y - en.y, tg.x - en.x), 11, f, 1.2, 5);
      if (i >= 0) w2.shots.behave(i, 1.2, 90, 0, 0.05);
    }
    if (ai.t > HACK_LIFE) {
      // Logic bomb: blows up among its old squad, pays out like a kill.
      w2.damageCircle(en.x, en.y, 70, 10);
      w2.explosions.blast(en.x, en.y, 0.9, DATA);
      w2.score += en.score;
      w2.kills++;
      en.alive = false;
    }
  };
  ai.hacked = true; // flag lives on the AI fn: the pool gives every spawn a fresh one
  ai.t = 0;
  e.ai = ai;
  w.explosions.sparks(e.x, e.y, 12, DATA, 4, 18, 4);
  ringPulse(w, e.x, e.y, DATA, 6, 40, 14);
  if (announce) w.event('toast', { text: `${e.name} HACKED`, cls: 'pc' });
  return true;
}

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Data fins (count with tier).
  for (let k = 0; k < tier; k++) for (const s of [-1, 1]) {
    const y = 14 + k * 7;
    ctx.beginPath(); ctx.moveTo(cx + s * 10, y); ctx.lineTo(cx + s * (22 + k), y + 3); ctx.lineTo(cx + s * 10, y + 5); ctx.closePath();
    ctx.fillStyle = '#0c1a14'; ctx.fill(); ctx.strokeStyle = 'rgba(90,255,160,0.9)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  // Pod: hexagonal shell.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(cx + Math.cos(a) * 13, 26 + Math.sin(a) * 15); }
  ctx.closePath(); ctx.fillStyle = chrome(ctx, cx - 13, cx + 13, '#0a1210', '#3a5a4c', '#b8e8d0'); ctx.fill(); outline(ctx);
  // Circuit traces.
  ctx.strokeStyle = 'rgba(90,255,160,0.7)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx - 8, 18); ctx.lineTo(cx - 3, 22); ctx.lineTo(cx - 3, 32); ctx.moveTo(cx + 8, 34); ctx.lineTo(cx + 3, 30); ctx.lineTo(cx + 3, 20); ctx.stroke();
  // Sensor eye.
  ctx.beginPath(); ctx.arc(cx, 24, 5, 0, TAU); ctx.fillStyle = '#020604'; ctx.fill();
  glowDot(ctx, cx, 24, 4.5, 'rgba(90,255,160,1)');
  // Antenna array (tier 3+), uplink dish (tier 4).
  if (tier >= 3) neonLines(ctx, cx, [3, 11, 6, 3, 6, 11, 11, 5], 'rgba(90,255,160,1)', 0.7, 5);
  if (tier >= 4) { ctx.beginPath(); ctx.arc(cx, 42, 6, Math.PI, TAU); ctx.strokeStyle = '#b8e8d0'; ctx.lineWidth = 1.2; ctx.stroke(); glowDot(ctx, cx, 40, 2.4, 'rgba(90,255,160,1)'); }
  mirrorPath(ctx, cx, [0, 38, 5, 38, 4, 44, 0, 45]);
  ctx.fillStyle = '#1a2a22'; ctx.fill(); outline(ctx, 0.6);
}

function drawNode(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(cx + Math.cos(a) * (w / 2 - 1), cy + Math.sin(a) * (h / 2 - 1)); }
  ctx.closePath(); ctx.fillStyle = '#0a1a12'; ctx.fill(); ctx.strokeStyle = 'rgba(90,255,160,1)'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 2.6, 'rgba(90,255,160,1)');
}

function drawBit(ctx, w, h) {
  ctx.fillStyle = 'rgba(90,255,160,0.35)'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(200,255,220,1)'; ctx.fillRect(1.2, 1.2, w - 2.4, h - 2.4);
  ctx.fillStyle = 'rgba(20,80,40,1)'; ctx.fillRect(w / 2 - 0.5, 1.2, 1, h - 2.4);
}

export default {
  id: 'nova',
  name: 'NOVA-7',
  vehicle: 'CIPHER',
  role: 'Hacker Pod',
  bio: 'A Helix security android that refused a kill order and walked into Precinct 9 asking for a badge. NOVA-7 does not destroy enemy machines when it can recruit them.',
  color: DATA,
  css: '#5affa6',
  stats: { speed: 4, power: 2, range: 4, bomb: 3 },
  speed: { normal: 4.6, focus: 2.0 },
  hitbox: 2.3,
  bombStock: 3,
  engines: [[0, 22]],
  engineColor: [0.4, 1.0, 0.6],
  optionSprite: 'n_node',
  optionSpin: 0.05,
  portrait: { skin: '#c8d4dc', hair: '#202a30', style: 'bald', eyes: 'android', accent: 'faceplate', badge: 'NOVA-7', suit: '#1c2a26' },
  weapons: {
    main: 'Packet Stream — homing data bolts',
    focus: 'Breach Beam — lock on; hold it to hack the target into an ally',
  },
  special: {
    name: 'FIREWALL',
    desc: 'A hex barrier ahead of the ship blocks bullets for 3 seconds',
    cooldown: 600,
    duration: 180,
    activate(p, w) { ringPulse(w, p.x, p.y - 70, DATA, 10, 90, 14); },
    update(p, w, t) {
      const y = p.y - 70, half = 90;
      w.cancelLine(p.x - half, y, p.x + half, y, 14);
      if (t % 4 === 0) w.damageLine(p.x - half, y, p.x + half, y, 8, 1.5);
    },
  },
  bomb: {
    name: 'SYSTEM CRASH',
    duration: 110,
    activate(p, w) { p.ps.crash = []; w.r.post.aberrate(0.03); },
    update(p, w, t) {
      w.cancelAll();
      if (t % 6 === 0) for (const e of targets(w)) { w.damage(e, 4); stun(e, 20); }
      if (t % 3 === 0) p.ps.crash.push({ y: w.fxRng.range(0, H), h: w.fxRng.range(4, 26), t: 0 });
      for (const g of p.ps.crash) g.t++;
      p.ps.crash = p.ps.crash.filter((g) => g.t < 6);
      if (t % 20 === 0) w.r.post.aberrate(0.02);
    },
    end(p) { p.ps.crash = null; },
  },
  ultimate: {
    name: 'CITY-WIDE OVERRIDE',
    duration: 320,
    activate(p) { p.ps.override = true; },
    update(p, w, t) {
      // Every regular enemy on screen is recruited; every enemy bullet is rewritten.
      for (const e of targets(w, true)) hack(w, p, e);
      const B = w.bullets, S = w.shots, f = p.ps.fBit;
      for (let i = 0; i < B.count; i++) {
        const j = S.spawn(B.x[i], B.y[i], UP + w.fxRng.range(-0.4, 0.4), 9, f.id, 0, 5, 1);
        if (j >= 0) S.behave(j, 0.8, 120, 0, 0.08);
      }
      B.count = 0;
      if (t % 2 === 0) for (const e of targets(w)) if (e.boss || e.ctrl) w.damage(e, 1);
    },
    end(p) { p.ps.override = false; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_nova_${t}`, 50, 48, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('n_node', 10, 10, drawNode, { scale: s });
    atlas.add('n_bit', 6, 6, drawBit, { scale: s });
  },

  init(p, w) {
    p.ps.fBit = w.r.frame('n_bit');
    p.ps.lock = null;
    p.ps.lockT = 0;
  },

  reset(p) { p.ps.lock = null; p.ps.lockT = 0; },

  update(p) {
    if (!(p.focus && p.firing)) { p.ps.lock = null; p.ps.lockT = 0; }
  },

  optionLayout(p) {
    const n = p.tier - 1, out = [];
    for (let k = 0; k < n; k++) {
      const a = -p.t * 0.05 + (k / Math.max(1, n)) * TAU;
      out.push(p.focus ? [(k - (n - 1) / 2) * 12, 18] : [Math.cos(a) * 24, Math.sin(a) * 24]);
    }
    return out;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots;
    if (p.focus) {
      // Breach beam: keep the lock on one target; enough lock time hacks it.
      let e = p.ps.lock;
      if (!e || !e.alive || isHacked(e)) {
        e = nearestN(w, p.x, p.y - 60, 1, 380)[0] || null;
        p.ps.lock = e; p.ps.lockT = 0;
      }
      if (e) {
        p.ps.lockT++;
        w.damage(e, e.boss || e.ctrl ? 0.35 + 0.05 * t : 0.12);
        const need = Math.min(120, 24 + e.maxHp * 0.9) / (1 + 0.15 * (t - 1));
        if (hackable(e) && p.ps.lockT >= need) { hack(w, p, e, true); p.ps.lock = null; p.ps.lockT = 0; }
      }
    }
    if (p.fireCd > 0) return;
    p.fireCd = 6;
    const n = p.focus ? 1 : 1 + t, f = p.ps.fBit;
    for (let k = 0; k < n; k++) {
      const a = UP + (n > 1 ? (k / (n - 1) - 0.5) * 0.5 : 0);
      const i = w.shot(p.x + (k - (n - 1) / 2) * 4, p.y - 18, a, 12, f, 0.75, 5, 1 + t * 0.1);
      if (i >= 0) S.behave(i, 0.75, 120, 0, 0.05);
    }
    muzzle(w, p.x, p.y - 20, DATA, 10);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y, UP, 12, f, 0.5, 4);
      if (i >= 0) S.behave(i, 0.5, 120, 0, 0.07);
    }
  },

  renderFx(p, b) {
    const F = p.F, w = p.w;
    // Hacked allies glitch in green.
    for (const e of w.enemies.active) {
      if (!e.alive || !isHacked(e) || !e.f) continue;
      const ht = e.ai.t;
      const fl = (ht >> 1) % 7 === 0 ? 1.2 : 0.55;
      b.draw(e.f, e.x + ((ht >> 2) % 3 - 1), e.y, e.f.w * e.scale, e.f.h * e.scale, e.rot, HACKED[0], HACKED[1], HACKED[2], fl, 1);
      b.draw(F.ring, e.x, e.y, e.r * 3, e.r * 3, ht * 0.05, DATA[0], DATA[1], DATA[2], 0.4, 1);
    }
    // Lock beam with a progress ring on the target.
    const L = p.ps.lock;
    if (L && L.alive) {
      const len = Math.hypot(L.x - p.x, L.y - p.y), a = Math.atan2(L.y - p.y, L.x - p.x);
      b.draw(F.laser, (p.x + L.x) / 2, (p.y + L.y) / 2, len, 6, a, DATA[0] * 1.6, DATA[1] * 1.6, DATA[2] * 1.6, 0.8, 1);
      if (!L.boss && !L.ctrl) {
        const need = Math.min(120, 24 + L.maxHp * 0.9) / (1 + 0.15 * (p.tier - 1));
        const k = Math.min(1, p.ps.lockT / need);
        b.draw(F.ring, L.x, L.y, (L.r * 2 + 30) * (1.6 - 0.6 * k), (L.r * 2 + 30) * (1.6 - 0.6 * k), p.t * 0.1, DATA[0] * 2, DATA[1] * 2, DATA[2] * 2, 0.4 + 0.5 * k, 1);
      }
    }
    // Firewall.
    if (p.specialT > 0) {
      const y = p.y - 70, fade = p.specialT < 40 && (p.t >> 2) & 1 ? 0.4 : 1;
      for (let k = -4; k <= 4; k++) b.draw(F.ring, p.x + k * 20, y, 24, 24, Math.PI / 6, DATA[0], DATA[1], DATA[2], 0.6 * fade, 1);
      b.draw(F.laser, p.x, y, 190, 12, 0, DATA[0], DATA[1], DATA[2], 0.5 * fade, 1);
    }
    // System crash glitch bars.
    for (const g of p.ps.crash || []) b.draw(F.white, W / 2, g.y, W, g.h, 0, 0.2, 1, 0.5, 0.25 * (1 - g.t / 6), 1);
    if (p.ps.override) wash(b, F, [0.05, 0.4, 0.15], 0.12);
  },
};
