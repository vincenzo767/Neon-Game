import { mirrorPath, chrome, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { SHOT_FLAK } from '../entities/World.js';
import { UP, TAU, W, H, muzzle, ringPulse, mote, targets, shipScale } from './common.js';

// RUFUS GRAINE — JUNKYARD SAINT (scrap ship)
// Random scrap weapons: every 2 seconds the scrap hopper deals a new gun
// (nails, rivet rails, spring bouncers, saw blades, bolt flak).
// Focus: Magnet Choke — every scrap gun fires straight and tight.
// Special: Magnet Pull (vacuums items, swallows nearby bullets into a scrap
// ball that's flung forward) · Bomb: Scrap Storm · Ultimate: Junk Meteor

const SCRAP = [0.6, 0.95, 0.85];
const SPARK = [0.85, 0.9, 1.0];
const GUNS = ['NAILS', 'RAILS', 'SPRINGS', 'SAWS', 'BOLTS'];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Mismatched welded wings: different on each side.
  ctx.beginPath(); ctx.moveTo(cx - 8, 18); ctx.lineTo(cx - 24, 30); ctx.lineTo(cx - 22, 38); ctx.lineTo(cx - 8, 34); ctx.closePath();
  ctx.fillStyle = chrome(ctx, cx - 24, cx - 8, '#1a1408', '#6a5a30', '#c8b070'); ctx.fill(); outline(ctx, 0.8);
  ctx.beginPath(); ctx.moveTo(cx + 8, 16); ctx.lineTo(cx + 22, 22); ctx.lineTo(cx + 26, 34); ctx.lineTo(cx + 8, 36); ctx.closePath();
  ctx.fillStyle = chrome(ctx, cx + 8, cx + 26, '#0c1418', '#3a5a60', '#9ac0c8'); ctx.fill(); outline(ctx, 0.8);
  // Hull.
  mirrorPath(ctx, cx, [0, 4, 6, 10, 9, 24, 9, 40, 6, 48, 0, 49]);
  ctx.fillStyle = chrome(ctx, cx - 9, cx + 9, '#140f0a', '#5a4a3a', '#b8a088'); ctx.fill(); outline(ctx);
  // Weld beads + patches.
  ctx.save(); ctx.setLineDash([1, 0.8]); ctx.strokeStyle = 'rgba(255,200,120,0.7)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(cx - 6, 20); ctx.lineTo(cx + 5, 26); ctx.moveTo(cx - 7, 36); ctx.lineTo(cx + 7, 34); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#3a4048'; ctx.beginPath(); ctx.rect(cx + 2, 28, 6, 5); ctx.fill(); outline(ctx, 0.4);
  // Hopper drum on the back.
  ctx.beginPath(); ctx.arc(cx, 40, 6, 0, TAU); ctx.fillStyle = chrome(ctx, cx - 6, cx + 6); ctx.fill(); outline(ctx, 0.7);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.fillStyle = '#20180e'; ctx.fillRect(cx + Math.cos(a) * 3.6 - 0.7, 40 + Math.sin(a) * 3.6 - 0.7, 1.4, 1.4); }
  // Tier 2+: bolted-on gun (left), tier 3: magnet coil (right), tier 4: second hopper.
  if (tier >= 2) { ctx.fillStyle = '#20242a'; ctx.beginPath(); ctx.rect(cx - 17, 16, 3, 14); ctx.fill(); outline(ctx, 0.4); }
  if (tier >= 3) { ctx.beginPath(); ctx.arc(cx + 18, 28, 4.5, 0, TAU); ctx.strokeStyle = '#c87a3a'; ctx.lineWidth = 1.6; ctx.stroke(); glowDot(ctx, cx + 18, 28, 2, 'rgba(160,255,220,1)'); }
  if (tier >= 4) { ctx.beginPath(); ctx.arc(cx - 12, 42, 4, 0, TAU); ctx.fillStyle = chrome(ctx, cx - 16, cx - 8); ctx.fill(); outline(ctx, 0.5); }
  canopy(ctx, cx, 16, 2.8, 4.5, '#ffffff', '#9ae8d0', '#082018');
}

function drawMagnet(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.arc(cx, h / 2, w / 2 - 2, Math.PI * 0.1, Math.PI * 0.9, true);
  ctx.strokeStyle = '#d04a3a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#d8dce4'; ctx.fillRect(1, h / 2 + 1, 4, 3); ctx.fillRect(w - 5, h / 2 + 1, 4, 3);
}

const nailSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(170,230,220,0.85)', '#ffffff');
function sawSprite(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 0.5;
  ctx.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, rr = k % 2 ? r : r * 0.78; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = 'rgba(200,240,235,0.9)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(40,70,70,1)'; ctx.fill();
}
function junkSprite(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU, rr = (w / 2 - 1) * (0.7 + 0.3 * Math.sin(k * 2.3)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = chrome(ctx, 0, w, '#1a1612', '#6a5e50', '#c0b4a0'); ctx.fill(); outline(ctx, 0.6);
  ctx.fillStyle = 'rgba(255,200,120,0.6)'; ctx.fillRect(cx - 2, cy - 1, 4, 1);
}

export default {
  id: 'rufus',
  name: 'RUFUS GRAINE',
  vehicle: 'JUNKYARD SAINT',
  role: 'Scrap Ship',
  bio: 'A scrapyard preacher who builds his ship from whatever the Black Tide sinks. Rufus never knows which gun the hopper will hand him next, and neither do the people he points it at.',
  color: SCRAP,
  css: '#9af0d8',
  stats: { speed: 3, power: 4, range: 3, bomb: 3 },
  speed: { normal: 4.3, focus: 2.0 },
  hitbox: 2.6,
  bombStock: 3,
  engines: [[-4, 24], [5, 25]],
  engineColor: [0.5, 1.0, 0.85],
  optionSprite: 'r_magnet',
  optionSpin: 0.08,
  portrait: { skin: '#b8865e', hair: '#8a8a8a', style: 'buzz', eyes: 'eyes', iris: '#5ad8b0', accent: 'monocle', suit: '#30281c' },
  weapons: {
    main: 'Scrap Hopper — a random scrap gun every 2 seconds',
    focus: 'Magnet Choke — scrap guns fire straight and tight',
  },
  special: {
    name: 'MAGNET PULL',
    desc: 'Vacuum every item; nearby bullets become a scrap ball you fling',
    cooldown: 480,
    duration: 120,
    activate(p, w) { w.autoCollect = Math.max(w.autoCollect, 120); p.ps.ball = 0; ringPulse(w, p.x, p.y, SCRAP, 200, 20, 18); },
    update(p, w) {
      const B = w.bullets, bx = p.x, by = p.y - 40;
      // Pull bullets in, absorb those that arrive.
      for (let i = 0; i < B.count; i++) {
        const dx = bx - B.x[i], dy = by - B.y[i], d2 = dx * dx + dy * dy;
        if (d2 < 170 * 170) { B.dyn[i] = 0; B.setHeading(i, Math.atan2(dy, dx), Math.max(B.spd[i], 5)); }
      }
      const before = B.count;
      w.cancelCircle(bx, by, 18 + Math.min(20, p.ps.ball * 0.2));
      p.ps.ball += before - B.count;
    },
    end(p, w) {
      // Fling the scrap ball: damage scales with what it swallowed.
      const dmg = 6 + Math.min(60, p.ps.ball * 0.6);
      const i = w.shot(p.x, p.y - 40, UP, 9, p.ps.fJunk, dmg, 16, 1.6 + Math.min(1.6, p.ps.ball * 0.02));
      if (i >= 0) w.shots.behave(i, dmg, 80, 0, 0, SHOT_FLAK, 60);
      p.ps.ball = 0;
    },
  },
  bomb: {
    name: 'SCRAP STORM',
    duration: 100,
    activate() {},
    update(p, w, t) {
      w.cancelAll();
      if (t % 2 === 0 && t < 90) {
        const left = t % 4 === 0, y = w.rng.range(20, H - 120);
        const i = w.shot(left ? -10 : W + 10, y, left ? w.rng.range(-0.3, 0.3) : Math.PI + w.rng.range(-0.3, 0.3), 9, t % 6 === 0 ? p.ps.fSaw : p.ps.fJunk, 4, 12, 1.4);
        if (i >= 0) w.shots.behave(i, 4, 90, 1);
      }
    },
  },
  ultimate: {
    name: 'JUNK METEOR',
    duration: 240,
    activate(p) { p.ps.meteor = { x: W / 2, y: -140, r: 30, t: 0 }; },
    update(p, w, t) {
      w.cancelAll();
      const m = p.ps.meteor;
      m.t = t;
      if (t < 120) {
        // Gather: scrap from every edge flies into the growing meteor.
        m.r = 30 + t * 0.6;
        m.y = -60 + t * 1.2;
        for (let k = 0; k < 3; k++) {
          const a = w.fxRng.angle(), d = w.fxRng.range(200, 320);
          mote(w, m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, -Math.cos(a) * d / 18, -Math.sin(a) * d / 18, SCRAP, 8, 18, 0, p.ps.fJunk);
        }
      } else if (t < 170) {
        // Fall: crushes everything in its path.
        m.y += 11;
        w.damageCircle(m.x, m.y, m.r, 3);
        w.g.camera.addTrauma(0.12);
      } else if (t === 170) {
        w.explosions.blast(m.x, Math.min(H - 60, m.y), 3, SCRAP);
        for (const e of targets(w)) w.damage(e, 45);
        w.r.post.shockwave(m.x, Math.min(H - 60, m.y), 0.08, 0.03, 1.2);
        w.r.post.flash(0.8, 1, 0.95, 0.6, 0.03);
        w.g.camera.addTrauma(0.9);
        w.g.hitStop(6);
        m.gone = true;
      }
    },
    end(p) { p.ps.meteor = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_rufus_${t}`, 56, 52, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('r_magnet', 12, 10, drawMagnet, { scale: s });
    atlas.add('r_nail', 16, 4, nailSprite, { scale: s });
    atlas.add('r_saw', 14, 14, sawSprite, { scale: s });
    atlas.add('r_junk', 12, 12, junkSprite, { scale: s });
  },

  init(p, w) {
    p.ps.fNail = w.r.frame('r_nail');
    p.ps.fSaw = w.r.frame('r_saw');
    p.ps.fJunk = w.r.frame('r_junk');
    p.ps.gun = 0;
    p.ps.gunT = 0;
    p.ps.ball = 0;
  },

  reset(p) { p.ps.meteor = null; p.ps.ball = 0; },

  update(p, w) {
    // The hopper deals a new gun every 2 seconds while firing (gameplay RNG: replayable).
    if (p.firing && ++p.ps.gunT >= 120) {
      p.ps.gunT = 0;
      let g = w.rng.int(0, GUNS.length - 1);
      if (g === p.ps.gun) g = (g + 1) % GUNS.length;
      p.ps.gun = g;
      w.event('toast', { text: `HOPPER: ${GUNS[g]}`, cls: '' });
      w.explosions.sparks(p.x, p.y + 10, 8, SPARK, 3, 14, 3);
    }
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 3) return [];
    return p.focus ? [[-14, -8], [14, -8]] : t >= 4 ? [[-24, 4], [24, 4], [0, 26]] : [[-24, 4], [24, 4]];
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots, R = w.rng, tight = p.focus ? 0.25 : 1;
    const shoot = (x, y, a, sp, f, dmg, r, sc, age = 0, pierce = 0, kind = 0, aux = 0) => {
      const i = w.shot(x, y, a, sp, f, dmg, r, sc);
      if (i >= 0) S.behave(i, dmg, age, pierce, 0, kind, aux);
      return i;
    };
    const muz = () => muzzle(w, p.x, p.y - 20, SCRAP, 11);
    switch (GUNS[p.ps.gun]) {
      case 'NAILS': {
        p.fireCd = 4;
        const n = 2 + t;
        for (let k = 0; k < n; k++) shoot(p.x + R.range(-6, 6), p.y - 18, UP + R.range(-0.25, 0.25) * tight, 14, p.ps.fNail, 0.7, 4, 1);
        break;
      }
      case 'RAILS':
        p.fireCd = 10;
        for (let k = 0; k < 1 + (t >> 1); k++) shoot(p.x + (k - (t >> 2) / 2) * 8, p.y - 20, UP, 18, p.ps.fNail, 2.2, 5, 1.8, 0, 1);
        break;
      case 'SPRINGS': {
        p.fireCd = 7;
        // Spring shots zig-zag: alternating curvature.
        for (const s of [-1, 1]) for (let k = 0; k < Math.ceil(t / 2); k++) {
          const i = shoot(p.x + s * 6, p.y - 16, UP + s * 0.35 * tight, 10, p.ps.fJunk, 1.1, 6, 0.9);
          if (i >= 0) S.motion(i, 0, -s * 0.03 * tight);
        }
        break;
      }
      case 'SAWS':
        p.fireCd = 16;
        for (let k = 0; k < (t >= 3 ? 2 : 1); k++) shoot(p.x + (k ? 12 : t >= 3 ? -12 : 0), p.y - 22, UP, 7, p.ps.fSaw, 1.6, 10, 1.4 + t * 0.15, 0, 1);
        break;
      case 'BOLTS':
        p.fireCd = 9;
        for (let k = 0; k < 1 + t; k++) shoot(p.x, p.y - 18, UP + (k - t / 2) * 0.16 * tight, 10, p.ps.fJunk, 2, 6, 1, 22 + R.int(0, 8), 0, SHOT_FLAK, 22);
        break;
    }
    muz();
    for (const o of p.options) shoot(o.x, o.y - 6, UP, 13, p.ps.fNail, 0.6, 4, 1);
  },

  renderAbove(p, b, x, y) {
    const F = p.F;
    if (p.specialT > 0) {
      const s = 30 + Math.min(40, p.ps.ball * 0.4);
      b.draw(F.ring, x, y - 40, 340, 340, -p.t * 0.06, SCRAP[0], SCRAP[1], SCRAP[2], 0.25, 1);
      b.draw(F.glow, x, y - 40, s * 1.6, s * 1.6, 0, SCRAP[0], SCRAP[1], SCRAP[2], 0.5, 1);
      b.draw(p.ps.fJunk, x, y - 40, s, s, p.t * 0.2, 1, 1, 1, 1, 0);
    }
  },

  renderFx(p, b, alpha) {
    const m = p.ps.meteor;
    if (!m || m.gone) return;
    const F = p.F;
    b.draw(F.glow, m.x, m.y, m.r * 4, m.r * 4, 0, SCRAP[0], SCRAP[1], SCRAP[2], 0.45, 1);
    b.draw(p.ps.fJunk, m.x, m.y, m.r * 2.2, m.r * 2.2, m.t * 0.03, 1, 1, 1, 1, 0);
    b.draw(p.ps.fSaw, m.x + m.r * 0.4, m.y - m.r * 0.3, m.r, m.r, -m.t * 0.1, 1, 1, 1, 1, 0);
    if (m.t >= 120) b.draw(F.laser, m.x, m.y - m.r * 2, m.r * 4, m.r * 1.6, Math.PI / 2, 1.4, 1.8, 1.6, 0.7, 1);
  },
};
