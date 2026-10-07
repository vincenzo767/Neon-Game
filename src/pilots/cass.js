import { mirrorPath, chrome, neonLines, outline, canopy, glowDot } from '../fx/art.js';
import { UP, TAU, W, H, muzzle, ringPulse, targets, shipScale } from './common.js';

// CASS RIVERA — PULSE RIDER (hoverbike)
// Sonic rings on a 128 BPM beat clock (one beat = 28 steps). Every shot
// volley is a ring; on the downbeat the bike drops a big bass ring.
// Special: Drop the Beat (rhythm-timed): press it ON the beat to stack a
// combo (up to ×4) that multiplies all damage; off-beat resets it.
// Bomb: Subwoofer · Ultimate: Bass-Drop Shockwave

const PULSE = [0.75, 0.5, 1.0];
const TEAL = [0.35, 0.95, 1.0];
const BEAT = 28;
const WINDOW = 5; // ± steps that count as "on the beat"

const beatPhase = (p) => p.t % BEAT;
const onBeat = (p) => { const ph = beatPhase(p); return ph <= WINDOW || ph >= BEAT - WINDOW; };
const dmgMul = (p) => 1 + 0.25 * p.ps.combo;

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Hoverbike: long, narrow, with speaker pods.
  mirrorPath(ctx, cx, [0, 2, 4, 8, 5, 20, 7, 30, 6, 42, 3, 50, 0, 51]);
  ctx.fillStyle = chrome(ctx, cx - 7, cx + 7, '#120a1a', '#4a3a66', '#d0c0f0'); ctx.fill(); outline(ctx);
  // Speaker pods (more with tier).
  const pods = [[10, 22], [11, 34], [14, 14], [14, 42]].slice(0, Math.min(4, tier + 1));
  for (const [x, y] of pods) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx + s * x, y, 4.2, 0, TAU); ctx.fillStyle = '#0c0812'; ctx.fill(); outline(ctx, 0.6);
    ctx.beginPath(); ctx.arc(cx + s * x, y, 2.6, 0, TAU); ctx.strokeStyle = 'rgba(190,140,255,0.9)'; ctx.lineWidth = 0.6; ctx.stroke();
    glowDot(ctx, cx + s * x, y, 1.4, 'rgba(120,240,255,1)');
  }
  // Equaliser stripe along the spine.
  for (let k = 0; k < 7; k++) { ctx.fillStyle = k % 2 ? 'rgba(120,240,255,0.9)' : 'rgba(200,140,255,0.9)'; ctx.fillRect(cx - 1.5, 22 + k * 3, 3, 1.4); }
  if (tier >= 4) neonLines(ctx, cx, [5, 20, 9, 12, 7, 30, 12, 46], 'rgba(200,150,255,1)', 0.8, 6);
  canopy(ctx, cx, 12, 2.4, 4.4, '#ffffff', '#c8a8ff', '#1a0a2a');
}

function drawSpeaker(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1, 0, TAU); ctx.fillStyle = '#0c0812'; ctx.fill(); outline(ctx, 0.6);
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 3, 0, TAU); ctx.strokeStyle = 'rgba(200,150,255,1)'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 2.4, 'rgba(120,240,255,1)');
}

function drawWave(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.ellipse(cx, h, w / 2 - 1, h - 1, 0, Math.PI, TAU);
  ctx.strokeStyle = 'rgba(210,180,255,0.95)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8; ctx.stroke();
}

export default {
  id: 'cass',
  name: 'CASS RIVERA',
  vehicle: 'PULSE RIDER',
  role: 'Hoverbike',
  bio: 'An underground DJ whose sonic rigs drive the Covenant\'s whispers out of the Undercity vents. Cass rides the beat: hit it and everything she fires hits harder.',
  color: PULSE,
  css: '#c09aff',
  stats: { speed: 5, power: 3, range: 2, bomb: 3 },
  speed: { normal: 5.3, focus: 2.3 },
  hitbox: 2.2,
  bombStock: 3,
  engines: [[0, 26]],
  engineColor: [0.7, 0.5, 1.0],
  optionSprite: 'c_speaker',
  portrait: { skin: '#a8704c', hair: '#ff6ab0', style: 'mohawk', eyes: 'eyes', iris: '#9a6aff', accent: 'headphones', suit: '#241a30' },
  weapons: {
    main: 'Sonic Rings — piercing waves; the downbeat drops a bass ring',
    focus: 'Tight Groove — narrow, faster ring stream',
  },
  special: {
    // Shown in the toast: reports the combo after activation.
    get name() { return this._label || 'DROP THE BEAT'; },
    desc: 'Press ON the beat: stacks a ×1.25 damage combo (up to ×2); off-beat resets',
    cooldown: 10,
    duration: 0,
    activate(p, w) {
      const sp = p.def.special;
      if (onBeat(p)) {
        p.ps.combo = Math.min(4, p.ps.combo + 1);
        p.ps.comboT = BEAT * 4;
        const r = 70 + 22 * p.ps.combo;
        w.cancelCircle(p.x, p.y, r);
        w.damageCircle(p.x, p.y, r, 3 * p.ps.combo);
        ringPulse(w, p.x, p.y, TEAL, 10, r, 16);
        sp._label = `ON BEAT ×${dmgMul(p).toFixed(2)}`;
      } else {
        p.ps.combo = 0;
        sp._label = 'OFF BEAT';
      }
    },
  },
  bomb: {
    name: 'SUBWOOFER',
    duration: 120,
    activate(p) { p.ps.subs = [{ x: p.x, y: p.y, r: 0 }]; },
    update(p, w, t) {
      w.cancelAll();
      if (t % BEAT === 0 && t > 0 && t < 100) { p.ps.subs.push({ x: p.x, y: p.y, r: 0 }); w.g.camera.addTrauma(0.3); }
      for (const s of p.ps.subs) {
        s.r += 10;
        for (const e of w.enemies.active) {
          if (!e.alive || e.untargetable) continue;
          if (Math.abs(Math.hypot(e.x - s.x, e.y - s.y) - s.r) < 18 + e.r) w.damage(e, 3.5);
        }
      }
    },
    end(p) { p.ps.subs = null; },
  },
  ultimate: {
    name: 'BASS-DROP SHOCKWAVE',
    duration: 330,
    activate(p) { p.ps.drop = { t: 0, rings: [] }; },
    update(p, w, t) {
      const d = p.ps.drop;
      d.t = t;
      w.cancelAll();
      if (t < 90) {
        // Build-up: rings collapse into the bike, faster and faster.
        if (t % Math.max(4, 16 - (t >> 3)) === 0) ringPulse(w, p.x, p.y, PULSE, 240, 10, 16, 0.5);
        if (t % 10 === 0) w.r.post.aberrate(0.002 + t * 0.0001);
      } else if (t === 90) {
        // THE DROP.
        w.r.post.flash(0.8, 0.6, 1, 0.8, 0.03);
        w.r.post.shockwave(p.x, p.y, 0.12, 0.03, 1.5);
        w.g.camera.addTrauma(1);
        w.g.hitStop(8);
        for (const e of targets(w)) w.damage(e, 25);
        d.rings.push({ x: p.x, y: p.y, r: 0 });
      } else if ((t - 90) % BEAT === 0) {
        d.rings.push({ x: p.x, y: p.y, r: 0 });
        for (const e of targets(w)) w.damage(e, 7);
        w.g.camera.addTrauma(0.35);
        w.r.post.shockwave(p.x, p.y, 0.04, 0.03, 0.6);
      }
      for (const r of d.rings) r.r += 14;
      d.rings = d.rings.filter((r) => r.r < 800);
    },
    end(p) { p.ps.drop = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_cass_${t}`, 36, 54, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('c_speaker', 10, 10, drawSpeaker, { scale: s });
    atlas.add('c_wave', 20, 8, drawWave, { scale: s });
  },

  init(p, w) {
    p.ps.fWave = w.r.frame('c_wave');
    p.ps.combo = 0;
    p.ps.comboT = 0;
  },

  reset(p) { p.ps.combo = 0; p.ps.comboT = 0; p.ps.drop = null; },

  update(p) {
    if (p.ps.comboT > 0 && --p.ps.comboT === 0) p.ps.combo = 0;
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const bob = Math.sin((beatPhase(p) / BEAT) * TAU) * 3;
    const o = p.focus ? [[-12, -4 + bob], [12, -4 + bob]] : [[-22, 8 + bob], [22, 8 + bob]];
    return t >= 4 ? [...o, ...(p.focus ? [[-20, 8 - bob], [20, 8 - bob]] : [[-36, 18 - bob], [36, 18 - bob]])] : o;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots, m = dmgMul(p);
    // Downbeat: a big bass ring regardless of fire cooldown.
    if (beatPhase(p) === 0) {
      const i = w.shot(p.x, p.y - 22, UP, 9, p.ps.fWave, 3 * m, 18, 2.4 + 0.3 * t);
      if (i >= 0) S.behave(i, 3 * m, 60, 1);
      ringPulse(w, p.x, p.y, TEAL, 14, 40, 10, 0.6);
    }
    if (p.fireCd > 0) return;
    p.fireCd = p.focus ? 5 : 7;
    const n = p.focus ? 1 : 1 + (t >> 1);
    for (let k = 0; k < n; k++) {
      const a = UP + (n > 1 ? (k / (n - 1) - 0.5) * 0.5 : 0);
      const i = w.shot(p.x, p.y - 20, a, p.focus ? 13 : 10, p.ps.fWave, 0.9 * m, 9, 1 + 0.12 * t);
      if (i >= 0) S.behave(i, 0.9 * m, 50, 1);
    }
    muzzle(w, p.x, p.y - 22, PULSE, 10);
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 11, p.ps.fWave, 0.5 * m, 6, 0.7);
      if (i >= 0) S.behave(i, 0.5 * m, 50, 1);
    }
  },

  renderAbove(p, b, x, y) {
    // Beat indicator: a ring that closes onto the ship each beat; green when the window is open.
    const F = p.F, k = beatPhase(p) / BEAT, ok = onBeat(p);
    const r = 34 + 30 * (1 - k);
    b.draw(F.ring, x, y, r, r, 0, ok ? TEAL[0] * 2 : PULSE[0], ok ? TEAL[1] * 2 : PULSE[1], ok ? TEAL[2] * 2 : PULSE[2], ok ? 0.55 : 0.2, 1);
    for (let c = 0; c < p.ps.combo; c++) b.draw(F.white, x - 9 + c * 6, y + 30, 4, 3, 0, 1.4, 1, 2, 0.9, 1);
  },

  renderFx(p, b) {
    const F = p.F;
    for (const s of p.ps.subs || []) b.draw(F.ring, s.x, s.y, s.r * 2.15, s.r * 2.15, 0, PULSE[0] * 1.6, PULSE[1] * 1.6, PULSE[2] * 1.6, Math.max(0, 1 - s.r / 600), 1);
    const d = p.ps.drop;
    if (d) {
      for (const r of d.rings) b.draw(F.ring, r.x, r.y, r.r * 2.15, r.r * 2.15, 0, 1.6, 1.2, 2.2, Math.max(0, 1 - r.r / 800), 1);
      if (d.t < 90) b.draw(F.glow, p.x, p.y, 60 + d.t, 60 + d.t, 0, PULSE[0], PULSE[1], PULSE[2], d.t / 180, 1);
    }
  },
};
