import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { SHOT_FLAK } from '../entities/World.js';
import { UP, TAU, W, H, muzzle, ringPulse, targets, stun, shipScale } from './common.js';
import { lastBossArchetype } from './unlocks.js';

// "WARDEN" — VERDICT (prototype), unlockable
// Adaptive weapon that copies the last boss defeated: the Verdict reads the
// archetype of the most recent Undercrown main boss you destroyed (this run
// or a previous one) and rebuilds its gun to match:
//   none     Verdict Rounds   twin piercing rounds
//   ground   Siege Slugs      heavy flak slugs (Colossus Crawler)
//   aerial   Curtain Lances   a sweeping row of rails (Skywarden Carrier)
//   sea      Torpedoes        accelerating piercing torpedoes (Leviathan)
//   mecha    Spiral Docket    rotating spiral stream (Titan Enforcer)
//   extraterrestrial Shards   homing crystal shards that burst (Hive Sovereign)
//   abyssal  Void Writs       slow piercing orbs that seek (Maw of the Deep)
// Focus: Verdict Beam (tinted by the copied archetype).
// Special: Objection · Bomb: Sentence · Ultimate: Final Judgment

const SILVER = [0.85, 0.88, 1.0];
const MODE = {
  none: { label: 'VERDICT ROUNDS', rgb: SILVER },
  ground: { label: 'SIEGE SLUGS', rgb: [1.0, 0.75, 0.55] },
  aerial: { label: 'CURTAIN LANCES', rgb: [0.5, 0.85, 1.0] },
  sea: { label: 'TORPEDOES', rgb: [0.45, 1.0, 0.9] },
  mecha: { label: 'SPIRAL DOCKET', rgb: [1.0, 0.5, 0.85] },
  extraterrestrial: { label: 'CRYSTAL SHARDS', rgb: [0.75, 0.55, 1.0] },
  abyssal: { label: 'VOID WRITS', rgb: [0.75, 0.6, 0.85] },
};

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Prototype: angular black hull with a sword-like nose and silver trim.
  mirrorPath(ctx, cx, [0, 0, 2, 12, 5, 20, 18, 30, 20, 36, 8, 34, 6, 46, 0, 48]);
  ctx.fillStyle = chrome(ctx, cx - 20, cx + 20, '#050608', '#262a34', '#8a90a4'); ctx.fill(); outline(ctx);
  // Scales-of-justice crossbar.
  ctx.fillStyle = '#c8ccd8'; ctx.fillRect(cx - 12, 24, 24, 1.4);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 12, 28, 3, 0, Math.PI); ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 0.9; ctx.stroke(); }
  // Adaptive modules (tier).
  if (tier >= 2) for (const s of [-1, 1]) { ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.rect(cx + s * 16 - 2, 26, 4, 10); ctx.fill(); outline(ctx, 0.4); glowDot(ctx, cx + s * 16, 26, 2, 'rgba(220,225,255,1)'); }
  if (tier >= 3) neonLines(ctx, cx, [2, 12, 7, 4, 5, 20, 10, 12], 'rgba(220,225,255,1)', 0.7, 5);
  if (tier >= 4) { ctx.beginPath(); ctx.arc(cx, 40, 5, 0, TAU); ctx.strokeStyle = 'rgba(220,225,255,0.95)'; ctx.lineWidth = 1; ctx.stroke(); glowDot(ctx, cx, 40, 3, 'rgba(255,255,255,1)'); }
  neonLines(ctx, cx, [5, 20, 18, 30, 6, 46, 8, 34], 'rgba(200,205,240,1)', 0.7, 5);
  canopy(ctx, cx, 15, 2, 4, '#ffffff', '#c8ccf0', '#0a0c18');
}

function drawSeal(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? w / 2 - 3 : w / 2 - 1; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = '#0c0e16'; ctx.fill(); ctx.strokeStyle = 'rgba(220,225,255,1)'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 2.2, 'rgba(255,255,255,1)');
}

function drawHammer(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = chrome(ctx, cx - 4, cx + 4, '#0a0c12', '#4a5060', '#d0d4e0'); ctx.beginPath(); ctx.rect(cx - 4, h * 0.35, 8, h * 0.65); ctx.fill(); outline(ctx);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h * 0.36, 4);
  ctx.fillStyle = chrome(ctx, 0, w, '#0a0c12', '#5a6070', '#e8ecf4'); ctx.fill(); outline(ctx, 1.2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(6, h * 0.16, w - 12, 1.2);
}

const roundSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(225,230,255,0.9)', '#ffffff');
function orbSprite(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, 'rgba(225,230,255,0.9)'); g.addColorStop(1, 'rgba(120,130,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

const modeOf = (p) => MODE[p.ps.arch] || MODE.none;

export default {
  id: 'warden',
  name: '"WARDEN"',
  vehicle: 'VERDICT',
  role: 'Prototype',
  bio: 'The masked Commissioner. Authorises every Precinct operation; no officer has seen the face behind the visor. The Verdict is a prototype that learns: it rebuilds its gun from the last boss you put down.',
  color: SILVER,
  css: '#d8dcff',
  stats: { speed: 3, power: 4, range: 4, bomb: 3 },
  speed: { normal: 4.5, focus: 2.0 },
  hitbox: 2.3,
  bombStock: 3,
  engines: [[0, 24]],
  engineColor: [0.8, 0.85, 1.0],
  optionSprite: 'w_seal',
  optionSpin: 0.04,
  unlockHint: 'UNLOCK: DEFEAT ANY UNDERCROWN MAIN BOSS',
  portrait: { skin: '#9aa0b0', hair: '#06070a', style: 'hood', eyes: 'visor', accent: 'faceplate', badge: 'CMSR', suit: '#14161e' },
  weapons: {
    main: 'Adaptive Verdict — copies the weapon of the last boss you defeated',
    focus: 'Verdict Beam — a focused beam in the copied archetype\'s colour',
  },
  special: {
    name: 'OBJECTION',
    desc: 'A cross-shaped seal around the ship erases bullets for 2 seconds',
    cooldown: 540,
    duration: 120,
    activate(p, w) { ringPulse(w, p.x, p.y, SILVER, 8, 80, 14); },
    update(p, w) {
      w.cancelLine(p.x - 150, p.y, p.x + 150, p.y, 18);
      w.cancelLine(p.x, p.y - 180, p.x, p.y + 90, 18);
      w.cancelCircle(p.x, p.y, 36);
    },
  },
  bomb: {
    name: 'SENTENCE',
    duration: 100,
    activate(p) { p.ps.gavel = { x: W / 2, t: 0 }; },
    update(p, w, t) {
      w.cancelAll();
      p.ps.gavel.t = t;
      if (t === 30) {
        // The gavel falls: the whole court is in contempt.
        for (const e of targets(w)) { w.damage(e, 30); stun(e, 90); }
        w.r.post.shockwave(W / 2, H * 0.4, 0.1, 0.03, 1.4);
        w.r.post.flash(0.9, 0.9, 1, 0.6, 0.03);
        w.g.camera.addTrauma(0.9);
        w.g.hitStop(6);
      }
    },
    end(p) { p.ps.gavel = null; },
  },
  ultimate: {
    name: 'FINAL JUDGMENT',
    duration: 260,
    activate(p) { p.ps.judge = { t: 0 }; },
    update(p, w, t) {
      w.cancelAll();
      p.ps.judge.t = t;
      // A vertical blade of light sweeps across, then a horizontal one sweeps down.
      if (t >= 30 && t < 100) { const x = ((t - 30) / 70) * (W + 80) - 40; w.beam(x, -20, x, H + 20, 60, 2.2, SILVER); }
      if (t >= 110 && t < 180) { const y = ((t - 110) / 70) * (H + 80) - 40; w.beam(-20, y, W + 20, y, 60, 2.2, SILVER); }
      if (t === 200) {
        for (const e of targets(w)) w.damage(e, 40);
        w.r.post.flash(1, 1, 1, 0.8, 0.025);
        w.r.post.shockwave(W / 2, H / 2, 0.1, 0.03, 1.4);
        w.g.camera.addTrauma(1);
        w.g.hitStop(8);
      }
    },
    end(p) { p.ps.judge = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_warden_${t}`, 44, 50, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('w_seal', 10, 10, drawSeal, { scale: s });
    atlas.add('w_round', 18, 5, roundSprite, { scale: s });
    atlas.add('w_orb', 12, 12, orbSprite, { scale: s });
    atlas.add('w_hammer', 90, 120, drawHammer, { scale: s * 0.6 });
  },

  init(p, w) {
    p.ps.fRound = w.r.frame('w_round');
    p.ps.fOrb = w.r.frame('w_orb');
    p.ps.fHammer = w.r.frame('w_hammer');
    p.ps.arch = lastBossArchetype();
    p.ps.spin = 0;
  },

  reset(p) { p.ps.gavel = null; p.ps.judge = null; },

  update(p, w) {
    // A boss defeated during this run re-teaches the Verdict immediately.
    const a = w.lastBossArchetype;
    if (a && a !== p.ps.arch) {
      p.ps.arch = a;
      w.event('toast', { text: `VERDICT ADAPTS · ${modeOf(p).label}`, cls: 'gold' });
      ringPulse(w, p.x, p.y, modeOf(p).rgb, 10, 80, 18);
    }
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2) return [];
    const o = p.focus ? [[-12, -6], [12, -6]] : [[-24, 8], [24, 8]];
    return t >= 4 ? [...o, [0, p.focus ? -22 : 26]] : o;
  },

  fire(p, w) {
    const t = p.tier, S = w.shots, m = modeOf(p), c = m.rgb;
    if (p.focus) w.beam(p.x, p.y - 24, p.x, -20, 8 + t * 2, 0.2 + 0.06 * t, c);
    if (p.fireCd > 0) return;
    const shot = (x, y, a, sp, f, dmg, r = 5, sc = 1) => { const i = w.shot(x, y, a, sp, f, dmg, r, sc); if (i >= 0) S.behave(i, dmg); return i; };
    const mul = p.focus ? 0.5 : 1;
    switch (p.ps.arch) {
      case 'ground':
        p.fireCd = 10;
        for (let k = 0; k < 1 + (t >> 1); k++) {
          const i = shot(p.x + (k - (t >> 2)) * 10, p.y - 20, UP + (k - (t >> 2)) * 0.12 * mul, 10, p.ps.fOrb, 3, 6, 1.2);
          if (i >= 0) S.behave(i, 3, 30, 0, 0, SHOT_FLAK, 30);
        }
        break;
      case 'aerial':
        p.fireCd = 7;
        for (let k = 0; k < 2 + t; k++) shot(p.x + (k - (1 + t) / 2) * 10 * mul, p.y - 20, UP, 16, p.ps.fRound, 0.75);
        break;
      case 'sea':
        p.fireCd = 12;
        for (const s of [-1, 1]) for (let k = 0; k < (t >= 3 ? 2 : 1); k++) {
          const i = shot(p.x + s * (8 + k * 10) * mul, p.y - 16, UP, 3, p.ps.fRound, 2.4, 6, 1.4);
          if (i >= 0) { S.behave(i, 2.4, 0, 1); S.motion(i, 0.45, 0, 0, 16); }
        }
        break;
      case 'mecha':
        p.fireCd = 3;
        p.ps.spin += 0.35;
        for (let k = 0; k < 1 + (t >> 1); k++) shot(p.x, p.y - 16, UP + Math.sin(p.ps.spin + k * 2.1) * 0.45 * mul, 13, p.ps.fRound, 0.55);
        break;
      case 'extraterrestrial':
        p.fireCd = 8;
        for (let k = 0; k < 1 + t; k++) {
          const i = shot(p.x, p.y - 18, UP + (k - t / 2) * 0.22 * mul, 11, p.ps.fOrb, 1.2, 5, 0.8);
          if (i >= 0) S.behave(i, 1.2, 40, 0, 0.07, SHOT_FLAK, 18);
        }
        break;
      case 'abyssal':
        p.fireCd = 14;
        for (let k = 0; k < (t >= 3 ? 3 : 2); k++) {
          const i = shot(p.x + (k - 1) * 14 * mul, p.y - 18, UP, 6, p.ps.fOrb, 1.6, 10, 1.8);
          if (i >= 0) S.behave(i, 1.6, 140, 1, 0.03);
        }
        break;
      default:
        p.fireCd = 6;
        for (const s of [-1, 1]) {
          const i = shot(p.x + s * 5, p.y - 20, UP, 15, p.ps.fRound, 1.1, 5, 1 + 0.1 * t);
          if (i >= 0) S.behave(i, 1.1, 0, 1);
        }
    }
    muzzle(w, p.x, p.y - 22, c, 11);
    for (const o of p.options) shot(o.x, o.y - 6, UP, 14, p.ps.fRound, 0.6);
  },

  renderAbove(p, b, x, y) {
    if (p.specialT <= 0) return;
    const F = p.F, a = p.specialT < 40 && (p.t >> 2) & 1 ? 0.3 : 0.75;
    b.draw(F.laser, x, y, 300, 14, 0, 1.6, 1.6, 2, a, 1);
    b.draw(F.laser, x, y - 45, 270, 14, Math.PI / 2, 1.6, 1.6, 2, a, 1);
    b.draw(F.ring, x, y, 72, 72, p.t * 0.05, 1.6, 1.6, 2, a, 1);
  },

  renderFx(p, b) {
    const F = p.F;
    const g = p.ps.gavel;
    if (g) {
      const k = Math.min(1, g.t / 30), y = -100 + k * (H * 0.4 + 40), rot = (1 - k) * -1.2;
      b.draw(p.ps.fHammer, g.x, y, 90, 120, rot, 1, 1, 1, g.t < 70 ? 1 : (100 - g.t) / 30, 0);
      if (g.t >= 30) b.draw(F.ring, g.x, H * 0.4, (g.t - 30) * 18, (g.t - 30) * 18, 0, 2, 2, 2.4, Math.max(0, 1 - (g.t - 30) / 50), 1);
    }
    const j = p.ps.judge;
    if (j && j.t < 30) {
      // Scales appear before the blades fall.
      b.draw(F.white, W / 2, H * 0.3, 200 * (j.t / 30), 3, 0, 2, 2, 2.4, 0.8, 1);
      b.draw(F.ring, W / 2, H * 0.3, 60, 60, j.t * 0.1, 2, 2, 2.4, j.t / 30, 1);
    }
  },
};
