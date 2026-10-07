import { mirrorPath, outline, glowDot } from '../fx/art.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL, DMG_INSTANT_PHASE_CLEAR } from '../core/damage.js';
import { segDist2 } from '../entities/World.js';
import { UP, TAU, W, H, clamp, muzzle, ringPulse, mote, targets, shipScale } from './common.js';

// VINCENZO THE CONQUEROR — DIMENSIONAL HYPERSHIP · LEGENDARY (UPDATE_01 §2)
//
// Holy Bullets: a countless golden-white stream with absolute penetration
// (pierce), ignoresShields, and a 60% chance per bullet to carry the
// instant-defeat flag: regular enemies and mid-bosses are destroyed, a main
// boss loses its current phase (instantPhaseClear, so every arena
// transition still plays). All instant defeats go through the M4b damage
// flags → the boss's normal defeat path.
// Absolute Intangibility: permanently invincible (onHit absorbs everything);
// bullets phase through with a ripple; grazing still charges the ultimate.
// Bomb: five Dimensional Rifts fire one-hit blast beams, then the ship
// transforms (1.5 s cut-in) into the Void Mecha for VOID_FORM_DURATION:
// screen-wide melee slashes tear dimensions open and abyssal hands drag
// nearby enemies into the tears (grabbed main bosses are defeated).
// Ultimate: The God's Trumpet. The mecha (or ship) shatters, revealing the
// four-winged divine owl (2 s cut-in); for DIVINE_FORM_DURATION every attack
// is the Trumpet, a screen-wide wave that one-hit-kills everything.
//
// Palette rule (UPDATE_02 §4.6): gold, white and void black only.

export const VOID_FORM_DURATION = 60 * 12;
export const DIVINE_FORM_DURATION = 60 * 20;
const PROC_CHANCE = 0.6;
const RIFT_STEPS = 100;     // rift phase of the bomb, then the transformation cut-in
const BOMB_STEPS = 130;

const GOLD = [1.0, 0.82, 0.38];
const WHITE = [1.0, 0.98, 0.92];
const HOLY = [1.0, 0.92, 0.65];
const ONE_HIT = DMG_INSTANT_KILL | DMG_IGNORES_SHIELDS;

// ------------------------------------------------------------------- art

const goldGrad = (ctx, x0, x1) => {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#5a3a08'); g.addColorStop(0.35, '#e8b850'); g.addColorStop(0.5, '#fff4c8'); g.addColorStop(0.65, '#e8b850'); g.addColorStop(1, '#5a3a08');
  return g;
};
const voidGrad = (ctx, x0, x1) => {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#000000'); g.addColorStop(0.45, '#14121a'); g.addColorStop(0.55, '#24202c'); g.addColorStop(1, '#000000');
  return g;
};
function goldLine(ctx, w = 0.8, blur = 5) {
  ctx.save(); ctx.shadowColor = '#ffd870'; ctx.shadowBlur = blur; ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
}

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Halo arcs behind the ship (more of the ring with each tier).
  ctx.beginPath(); ctx.arc(cx, 34, 20, Math.PI * (1.5 - 0.15 * tier), Math.PI * (1.5 + 0.15 * tier));
  goldLine(ctx, 1.2, 8);
  // Tier 2+: blade wings; tier 4: second pair.
  if (tier >= 2) {
    mirrorPath(ctx, cx, [6, 26, 24, 22, 26, 26, 10, 38]);
    ctx.fillStyle = voidGrad(ctx, cx - 26, cx + 26); ctx.fill(); goldLine(ctx, 0.7, 4);
  }
  if (tier >= 4) {
    mirrorPath(ctx, cx, [6, 40, 22, 46, 20, 50, 8, 46]);
    ctx.fillStyle = voidGrad(ctx, cx - 22, cx + 22); ctx.fill(); goldLine(ctx, 0.6, 4);
  }
  // Hull: a void-black blade with gold filigree.
  mirrorPath(ctx, cx, [0, 2, 3, 12, 7, 26, 14, 36, 13, 44, 5, 50, 0, 54]);
  ctx.fillStyle = voidGrad(ctx, cx - 14, cx + 14); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
  goldLine(ctx, 0.8, 6);
  ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, 46); ctx.moveTo(cx - 6, 30); ctx.quadraticCurveTo(cx, 24, cx + 6, 30); ctx.moveTo(cx - 8, 38); ctx.quadraticCurveTo(cx, 32, cx + 8, 38);
  goldLine(ctx, 0.5, 3);
  // Tier 3+: white core.
  glowDot(ctx, cx, 34, tier >= 3 ? 5 : 3.4, 'rgba(255,240,200,1)');
  ctx.beginPath(); ctx.arc(cx, 34, 1.8, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  // Eye-slit canopy.
  ctx.fillStyle = '#fff6d8'; ctx.fillRect(cx - 1, 14, 2, 7);
}

function drawOrb(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1.5, 0, TAU); ctx.fillStyle = '#050407'; ctx.fill(); goldLine(ctx, 1, 5);
  glowDot(ctx, cx, cy, 2.6, 'rgba(255,245,215,1)');
}

function drawHoly(ctx, w, h) {
  // Golden-white bolt with a soft halo.
  // Elliptical halo (a rect fill would show the sprite box at low alpha).
  ctx.save(); ctx.translate(w * 0.55, h / 2); ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.45);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,236,170,0.9)"); g.addColorStop(1, "rgba(255,200,90,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 0.45, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(w * 0.62, h / 2, w * 0.28, h * 0.16, 0, 0, TAU); ctx.fill();
}

function drawRift(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.moveTo(cx, 0);
  for (let k = 1; k < 10; k++) ctx.lineTo(cx + (k % 2 ? 1 : -1) * (w * 0.32) * Math.sin((k / 10) * Math.PI), (k / 10) * h);
  ctx.lineTo(cx, h);
  for (let k = 9; k > 0; k--) ctx.lineTo(cx - (k % 2 ? 1 : -1) * (w * 0.22) * Math.sin((k / 10) * Math.PI), (k / 10) * h);
  ctx.closePath();
  ctx.fillStyle = '#000000'; ctx.fill();
  ctx.save(); ctx.shadowColor = '#fff2c0'; ctx.shadowBlur = 8; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
}

function drawHand(ctx, w, h) {
  // Abyssal hand reaching UP (+ the arm trailing down).
  const cx = w / 2;
  ctx.fillStyle = '#030204';
  ctx.beginPath(); ctx.moveTo(cx - 6, h); ctx.quadraticCurveTo(cx - 9, h * 0.6, cx - 12, h * 0.42); ctx.lineTo(cx + 12, h * 0.42); ctx.quadraticCurveTo(cx + 9, h * 0.6, cx + 6, h); ctx.closePath(); ctx.fill();
  const fingers = [[-12, 0.42, -16, 0.1], [-5, 0.4, -6, 0.02], [2, 0.4, 3, 0.0], [9, 0.42, 12, 0.06], [12, 0.5, 19, 0.3]];
  for (const [x0, y0, x1, y1] of fingers) {
    ctx.beginPath(); ctx.moveTo(cx + x0 - 2.4, h * y0); ctx.quadraticCurveTo(cx + (x0 + x1) / 2 - 3, h * (y0 + y1) / 2, cx + x1, h * y1); ctx.quadraticCurveTo(cx + (x0 + x1) / 2 + 3, h * (y0 + y1) / 2, cx + x0 + 2.4, h * y0); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(cx - 12, h * 0.42); ctx.lineTo(cx + 12, h * 0.42); ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.fillStyle = 'rgba(255,250,235,0.9)'; ctx.fillRect(cx - 4, h * 0.55, 8, 1);
}

function drawMecha(ctx, w, h) {
  const cx = w / 2;
  // Void wings / back blades.
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 22, 58); ctx.lineTo(cx + s * 62, 8); ctx.lineTo(cx + s * 56, 36); ctx.lineTo(cx + s * 64, 50); ctx.lineTo(cx + s * 34, 84); ctx.closePath();
    ctx.fillStyle = voidGrad(ctx, cx + s * 22, cx + s * 64); ctx.fill(); goldLine(ctx, 0.9, 6);
  }
  // Legs.
  for (const s of [-1, 1]) { mirrorPath(ctx, cx + s * 14, [0, 96, 8, 100, 9, 132, 5, 146, 0, 148]); ctx.fillStyle = voidGrad(ctx, cx + s * 14 - 9, cx + s * 14 + 9); ctx.fill(); goldLine(ctx, 0.7, 4); }
  // Arms with long claw blades reaching forward (up).
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 28, 50); ctx.lineTo(cx + s * 44, 54); ctx.lineTo(cx + s * 46, 90); ctx.lineTo(cx + s * 34, 92); ctx.closePath();
    ctx.fillStyle = voidGrad(ctx, cx + s * 28, cx + s * 46); ctx.fill(); goldLine(ctx, 0.8, 5);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(cx + s * (36 + k * 4), 52); ctx.lineTo(cx + s * (40 + k * 6), 4 + k * 6); ctx.lineTo(cx + s * (42 + k * 4), 52); ctx.closePath();
      ctx.fillStyle = '#fff6dc'; ctx.fill(); goldLine(ctx, 0.5, 6);
    }
  }
  // Torso.
  mirrorPath(ctx, cx, [0, 40, 20, 42, 28, 52, 24, 84, 14, 100, 0, 102]);
  ctx.fillStyle = voidGrad(ctx, cx - 28, cx + 28); ctx.fill(); goldLine(ctx, 1, 6);
  ctx.beginPath(); ctx.moveTo(cx, 46); ctx.lineTo(cx, 98); ctx.moveTo(cx - 18, 60); ctx.lineTo(cx, 70); ctx.lineTo(cx + 18, 60); goldLine(ctx, 0.6, 4);
  glowDot(ctx, cx, 72, 8, 'rgba(255,245,215,1)');
  // Head with a V crest and white eyes.
  mirrorPath(ctx, cx, [0, 22, 8, 26, 10, 36, 6, 42, 0, 43]);
  ctx.fillStyle = voidGrad(ctx, cx - 10, cx + 10); ctx.fill(); goldLine(ctx, 0.8, 5);
  ctx.beginPath(); ctx.moveTo(cx - 3, 26); ctx.lineTo(cx - 16, 8); ctx.moveTo(cx + 3, 26); ctx.lineTo(cx + 16, 8); goldLine(ctx, 1.4, 6);
  for (const s of [-1, 1]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + s * 4 - 2, 32, 4, 1.6); }
}

function feather(ctx, x0, y0, x1, y1, w, light) {
  const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -w, len, 0); ctx.quadraticCurveTo(len * 0.5, w * 0.8, 0, 0);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, light ? '#fff8e8' : '#f0d898'); g.addColorStop(0.8, light ? '#ffe8a8' : '#d8a840'); g.addColorStop(1, '#1a1206');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,6,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(len * 0.92, 0); ctx.strokeStyle = 'rgba(120,80,20,0.6)'; ctx.lineWidth = 0.4; ctx.stroke();
  ctx.restore();
}

function drawOwl(ctx, w, h) {
  const cx = w / 2;
  // Halo + rays.
  ctx.save(); ctx.translate(cx, 64);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU, r0 = 56, r1 = k % 2 ? 84 : 100;
    ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.03) * r0, Math.sin(a - 0.03) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a + 0.03) * r0, Math.sin(a + 0.03) * r0); ctx.closePath();
    ctx.fillStyle = 'rgba(255,230,160,0.35)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); goldLine(ctx, 2.4, 12);
  ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); goldLine(ctx, 0.8, 4);
  ctx.restore();
  // Four wings: upper pair sweeping up and out, lower pair down and out.
  for (const s of [-1, 1]) {
    for (const [ry, tipX, tipY, n, spread] of [[100, 148, 6, 9, 1.0], [140, 140, 214, 7, -0.9]]) {
      const rx = cx + s * 26;
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1);
        const ex = cx + s * (tipX * (0.45 + 0.55 * f)), ey = ry + (tipY - ry) * (0.25 + 0.75 * Math.pow(f, 1.3)) + spread * (1 - f) * 10;
        feather(ctx, rx + s * k * 3, ry + (spread > 0 ? -k * 2 : k * 2), ex, ey, 9 - f * 3, k % 2 === 0);
      }
      // Coverts.
      for (let k = 0; k < 4; k++) {
        const f = k / 3;
        feather(ctx, rx, ry, cx + s * (40 + 46 * f), ry + (spread > 0 ? -26 - 12 * f : 22 + 14 * f), 7, true);
      }
    }
  }
  // Tail feathers.
  for (let k = -3; k <= 3; k++) feather(ctx, cx + k * 3, 160, cx + k * 12, 222, 7, k % 2 === 0);
  // Body.
  ctx.beginPath(); ctx.ellipse(cx, 130, 34, 46, 0, 0, TAU);
  const bg = ctx.createRadialGradient(cx - 10, 116, 4, cx, 130, 48);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#f4e2b0'); bg.addColorStop(1, '#8a6420');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1; ctx.stroke();
  // Gold chevron breast pattern.
  for (let r = 0; r < 4; r++) for (let k = -2; k <= 2; k++) {
    const x = cx + k * 11 + (r % 2 ? 5 : 0), y = 118 + r * 12;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x + 4, y);
    ctx.strokeStyle = 'rgba(180,120,30,0.8)'; ctx.lineWidth = 0.9; ctx.stroke();
  }
  // Head + facial disc.
  ctx.beginPath(); ctx.arc(cx, 76, 32, 0, TAU);
  const hg = ctx.createRadialGradient(cx - 8, 66, 2, cx, 76, 34);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.7, '#f0dca8'); hg.addColorStop(1, '#6a4a14');
  ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1; ctx.stroke();
  for (const s of [-1, 1]) {
    // Ear tufts.
    ctx.beginPath(); ctx.moveTo(cx + s * 16, 52); ctx.lineTo(cx + s * 30, 34); ctx.lineTo(cx + s * 26, 56); ctx.closePath();
    ctx.fillStyle = '#e8c878'; ctx.fill(); ctx.stroke();
    // Facial disc rims.
    ctx.beginPath(); ctx.arc(cx + s * 13, 76, 15, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,110,30,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    // Luminous eyes.
    const eg = ctx.createRadialGradient(cx + s * 13, 76, 0, cx + s * 13, 76, 10);
    eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.35, '#fff0a0'); eg.addColorStop(0.75, '#e8a820'); eg.addColorStop(1, '#3a2406');
    ctx.beginPath(); ctx.arc(cx + s * 13, 76, 10, 0, TAU); ctx.fillStyle = eg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 13, 76, 3.4, 0, TAU); ctx.fillStyle = '#000000'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + s * 13 + 1, 72, 2, 2);
  }
  // Beak.
  ctx.beginPath(); ctx.moveTo(cx - 5, 84); ctx.lineTo(cx + 5, 84); ctx.lineTo(cx, 98); ctx.closePath();
  ctx.fillStyle = goldGrad(ctx, cx - 5, cx + 5); ctx.fill(); ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 0.6; ctx.stroke();
}

function drawFeather(ctx, w, h) { feather(ctx, w / 2, h - 1, w / 2, 1, w / 2 - 1, true); }

// ----------------------------------------------------------- mechanics

/** Holy bullet: pierce + ignoresShields; 60% carry the instant-defeat flag. */
function holy(p, w, x, y, a, sp = 17) {
  const S = w.shots, i = w.shot(x, y, a, sp, p.ps.fHoly, 1, 6, 1 + p.tier * 0.06);
  if (i < 0) return;
  S.behave(i, 1, 0, 1);
  S.dflags[i] = DMG_IGNORES_SHIELDS | (w.rng.chance(PROC_CHANCE) ? DMG_INSTANT_PHASE_CLEAR : 0);
}

/** Golden flash + smite particle burst (instant-defeat proc). */
function smite(w, x, y, big = false) {
  ringPulse(w, x, y, GOLD, 6, big ? 140 : 46, big ? 26 : 14, 0.9);
  for (let k = 0; k < (big ? 24 : 10); k++) {
    const a = w.fxRng.angle(), s = w.fxRng.range(2, big ? 9 : 5);
    mote(w, x, y, Math.cos(a) * s, Math.sin(a) * s, k % 3 ? GOLD : WHITE, big ? 10 : 6, 18);
  }
  if (big) w.r.post.flash(1, 0.92, 0.7, 0.35, 0.04);
}

function openRifts(p, w) {
  p.ps.rifts = [];
  for (let k = 0; k < 5; k++) {
    p.ps.rifts.push({ x: 48 + k * 96, y: w.rng.range(110, 330), t: -k * 9 });
  }
}

/** Mecha slash: a screen-wide cut that leaves a tear; hands grab what's near it. */
function slash(p, w) {
  const T = targets(w);
  const tgt = T.length ? T.reduce((a, e) => (Math.abs(e.y - (p.y - 200)) < Math.abs(a.y - (p.y - 200)) ? e : a)) : null;
  const y = clamp(tgt ? tgt.y : p.y - 220, 40, p.y - 60);
  const tilt = (p.ps.slashN++ % 2 ? 1 : -1) * 0.12;
  const x0 = -20, x1 = W + 20, y0 = y - tilt * W / 2, y1 = y + tilt * W / 2;
  w.cancelLine(x0, y0, x1, y1, 40);
  w.damageLine(x0, y0, x1, y1, 30, 24, -1, DMG_IGNORES_SHIELDS);
  const tear = { x0, y0, x1, y1, t: 0, life: 80 };
  p.ps.tears.push(tear);
  w.g.camera.addTrauma(0.35);
  w.r.post.shockwave(W / 2, y, 0.03, 0.03, 0.5);
  // Abyssal hands reach out of the tear for anything near it.
  for (const e of T) {
    if (p.ps.hands.length >= 10) break;
    if (p.ps.hands.some((hd) => hd.e === e)) continue;
    if (segDist2(e.x, e.y, x0, y0, x1, y1) > 170 * 170) continue;
    const k = clamp((e.x - x0) / (x1 - x0), 0, 1);
    p.ps.hands.push({ e, ox: x0 + (x1 - x0) * k, oy: y0 + (y1 - y0) * k, t: 0 });
  }
}

/** The Trumpet: a screen-wide wave of sound and light; one hit kills everything. */
function trumpet(p, w) {
  const ox = p.x, oy = Math.min(p.y - 90, H - 150); // from the owl
  p.ps.waves.push({ x: ox, y: oy, r: 10 });
  w.cancelAll();
  for (const e of targets(w)) { w.damage(e, 1, ONE_HIT); smite(w, e.x, e.y, !!(e.ctrl || e.boss)); }
  w.r.post.flash(1, 0.95, 0.75, 0.3, 0.04);
  w.r.post.shockwave(ox, oy, 0.1, 0.035, 1.4);
  w.g.camera.addTrauma(0.6);
  for (let k = 0; k < 14; k++) mote(w, ox + w.fxRng.range(-150, 150), oy + w.fxRng.range(-80, 80), w.fxRng.range(-1, 1), w.fxRng.range(0.5, 2), WHITE, 10, 60, 0.01, p.ps.fFeather);
}

export default {
  id: 'vincenzo',
  name: 'VINCENZO THE CONQUEROR',
  vehicle: 'DIMENSIONAL HYPERSHIP',
  role: 'The Herald',
  legendary: true,
  bio: 'No record exists. He stepped out of the Upper Breach in the first hour, walked through the alien vanguard untouched, and offered his service without a word. The syndicates call him the Herald.',
  color: GOLD,
  css: '#ffd870',
  stats: { speed: 5, power: 5, range: 5, bomb: 5 },
  speed: { normal: 5.0, focus: 2.4 },
  hitbox: 2.0,
  bombStock: 3,
  engines: [[-4, 26], [4, 26]],
  engineColor: [1.0, 0.85, 0.5],
  optionSprite: 'v_orb',
  portrait: { skin: '#e8c8a0', hair: '#050407', style: 'hood', eyes: 'eyes', iris: '#ffd040', accent: 'crown', legendary: true, badge: 'XVII', suit: '#0a0806' },
  weapons: {
    main: 'Holy Bullets — countless piercing rounds; ignore shields; 60% instant defeat per hit',
    focus: 'Judgement Stream — the holy stream narrows to a single column',
  },
  special: {
    name: 'ABSOLUTE INTANGIBILITY',
    desc: 'Permanent: nothing can touch him (passive)',
    cooldown: 60,
    duration: 0,
    activate(p, w) { ringPulse(w, p.x, p.y, WHITE, 10, 60, 16, 0.6); },
  },
  bomb: {
    name: 'DIMENSIONAL RIFTS',
    duration: BOMB_STEPS,
    activate(p, w) { openRifts(p, w); p.ps.mechaT = 0; },
    update(p, w, t) {
      w.cancelAll();
      for (const r of p.ps.rifts) {
        r.t++;
        // Each rift fires a one-hit blast beam down its column.
        if (r.t > 20 && r.t < 52) w.beam(r.x, -20, r.x, H + 20, 44, 1, GOLD, 1, ONE_HIT);
        if (r.t === 21) { w.g.camera.addTrauma(0.3); w.r.post.shockwave(r.x, r.y, 0.03, 0.03, 0.4); }
      }
      if (t === RIFT_STEPS) {
        // Transformation cut-in (1.5 s freeze), then the Void Mecha takes over.
        w.event('cutin', { def: p.def, title: 'VOID MECHA', sub: 'DIMENSIONAL TRANSFORMATION', steps: 90 });
        smite(w, p.x, p.y, true);
      }
    },
    end(p) {
      p.ps.rifts = [];
      p.ps.mechaT = VOID_FORM_DURATION;
      p.ps.slashT = 0;
    },
  },
  ultimate: {
    name: "THE GOD'S TRUMPET",
    duration: DIVINE_FORM_DURATION,
    cutin: 120, // 2 s cinematic
    activate(p, w) {
      // The mecha armour (or the ship) shatters, revealing the divine form.
      const shards = w.explosions.f.shards;
      for (let k = 0; k < 30; k++) {
        const a = w.fxRng.angle(), s = w.fxRng.range(2, 8);
        mote(w, p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, k % 2 ? GOLD : [0.15, 0.12, 0.1], 10, 40, 0.1, shards[k % shards.length]);
      }
      p.ps.mechaT = 0;
      p.ps.divine = true;
      p.ps.waves = [];
      p.ps.trumpetT = 0;
    },
    update(p, w) {
      for (const wv of p.ps.waves) wv.r += 16;
      p.ps.waves = p.ps.waves.filter((wv) => wv.r < 900);
      if (p.ps.trumpetT > 0) p.ps.trumpetT--;
      if (w.t % 5 === 0) mote(w, p.x + w.fxRng.range(-150, 150), p.y - 160, w.fxRng.range(-0.5, 0.5), w.fxRng.range(0.8, 1.6), WHITE, 9, 90, 0.005, p.ps.fFeather);
    },
    end(p, w) {
      p.ps.divine = false;
      p.ps.waves = [];
      smite(w, p.x, p.y, true);
    },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_vincenzo_${t}`, 54, 58, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('v_orb', 12, 12, drawOrb, { scale: s });
    atlas.add('v_holy', 16, 7, drawHoly, { scale: s });
    atlas.add('v_rift', 26, 110, drawRift, { scale: shipScale(atlas, 1.6) });
    atlas.add('v_hand', 40, 64, drawHand, { scale: shipScale(atlas, 1.8) });
    atlas.add('v_mecha', 130, 152, drawMecha, { scale: shipScale(atlas, 1.6) });
    atlas.add('v_owl', 300, 232, drawOwl, { scale: shipScale(atlas, 1.5) });
    atlas.add('v_feather', 8, 22, drawFeather, { scale: s });
  },

  init(p, w) {
    p.ps.fHoly = w.r.frame('v_holy');
    p.ps.fRift = w.r.frame('v_rift');
    p.ps.fHand = w.r.frame('v_hand');
    p.ps.fMecha = w.r.frame('v_mecha');
    p.ps.fOwl = w.r.frame('v_owl');
    p.ps.fFeather = w.r.frame('v_feather');
    p.ps.rifts = [];
    p.ps.tears = [];
    p.ps.hands = [];
    p.ps.waves = [];
    p.ps.mechaT = 0;
    p.ps.slashN = 0;
    p.ps.prev = [];
    p.ps.rippleT = 0;
  },

  reset(p) { p.ps.mechaT = 0; p.ps.divine = false; },

  /** Absolute Intangibility: every hit (bullets, lasers, hazards, contact) phases through. */
  onHit(p, w) {
    if (p.ps.rippleT <= 0) {
      p.ps.rippleT = 6;
      ringPulse(w, p.x, p.y, WHITE, 4, 34, 12, 0.6);
    }
    return true;
  },

  update(p, w) {
    if (p.ps.rippleT > 0) p.ps.rippleT--;
    // Forms hide the hypership (the form is drawn in its place).
    const form = p.ps.divine || p.ps.mechaT > 0;
    p.alpha = form ? 0 : 1;
    if (p.ps.mechaT > 0 && --p.ps.mechaT === 0) {
      // The mecha folds back into the hypership.
      smite(w, p.x, p.y, true);
      w.event('toast', { text: 'VOID FORM ENDS', cls: 'gold' });
    }
    // Smite: enemies destroyed since the last step (holy procs, rifts, hands).
    for (const e of p.ps.prev) if (!e.alive && e.hp <= 0) smite(w, e.x, e.y);
    p.ps.prev = w.enemies.active.filter((e) => e.alive && !e.ctrl && e.kind !== 'bosspart');
    // Big smite when a boss phase is struck clear.
    const c = w.boss && w.boss.ctrl;
    if (c && c.state === 'transition' && c.st === 1) smite(w, c.e.x, c.e.y, true);
    // Tears and hands.
    for (const tr of p.ps.tears) tr.t++;
    p.ps.tears = p.ps.tears.filter((tr) => tr.t < tr.life);
    for (const hd of p.ps.hands) {
      hd.t++;
      const e = hd.e;
      if (!e.alive) { hd.done = true; continue; }
      if (hd.t > 14) {
        // Drag it into the rift…
        e.x += (hd.ox - e.x) * 0.16;
        e.y += (hd.oy - e.y) * 0.16;
      }
      if (hd.t === 38) {
        // …where it vanishes (grabbed main bosses are defeated through the normal path).
        w.damage(e, 1, ONE_HIT);
        smite(w, hd.ox, hd.oy, !!(e.ctrl || e.boss));
        hd.done = true;
      }
    }
    p.ps.hands = p.ps.hands.filter((hd) => !hd.done);
  },

  optionLayout(p) {
    const t = p.tier;
    if (t < 2 || p.ps.divine || p.ps.mechaT > 0) return [];
    const n = t >= 4 ? 4 : 2, out = [];
    for (let k = 0; k < n; k++) {
      const a = p.t * 0.05 + (k / n) * TAU;
      out.push(p.focus ? [(k % 2 ? 1 : -1) * (10 + (k >> 1) * 10), -10] : [Math.cos(a) * 30, Math.sin(a) * 10 + 4]);
    }
    return out;
  },

  fire(p, w) {
    if (p.ps.divine) {
      // Every attack is the Trumpet.
      if (p.ps.trumpetT <= 0) { p.ps.trumpetT = 40; trumpet(p, w); }
      return;
    }
    if (p.ps.mechaT > 0) {
      if (p.fireCd > 0) return;
      p.fireCd = 18;
      slash(p, w);
      return;
    }
    if (p.fireCd > 0) return;
    p.fireCd = 2;
    const t = p.tier, n = 5 + 2 * t, spread = p.focus ? 0.05 : 0.24;
    for (let k = 0; k < n; k++) {
      const a = UP + (k / (n - 1) - 0.5) * spread;
      holy(p, w, p.x + (k - (n - 1) / 2) * (p.focus ? 1.5 : 3), p.y - 22, a);
    }
    for (const o of p.options) holy(p, w, o.x, o.y - 6, UP);
    muzzle(w, p.x, p.y - 26, HOLY, 14);
  },

  renderBelow(p, b, x, y) {
    // Shimmering dimensional aura (only around the hypership).
    if (p.alpha <= 0) return;
    const F = p.F, t = p.t;
    b.draw(F.ring, x, y, 54 + Math.sin(t * 0.13) * 4, 54 + Math.sin(t * 0.13) * 4, t * 0.02, GOLD[0], GOLD[1], GOLD[2], 0.3, 1);
    b.draw(F.ring, x, y, 40 + Math.sin(t * 0.21 + 1) * 3, 40 + Math.sin(t * 0.21 + 1) * 3, -t * 0.03, WHITE[0], WHITE[1], WHITE[2], 0.22, 1);
    b.draw(F.glow, x, y, 60, 60, 0, 1, 0.85, 0.5, 0.18, 1);
  },

  renderAbove(p, b, x, y) {
    const F = p.F;
    if (p.ps.mechaT > 0) {
      const m = p.ps.fMecha, end = p.ps.mechaT < 90 && (p.t >> 2) & 1;
      b.draw(F.glow, x, y - 10, 220, 220, 0, 0.6, 0.5, 0.3, 0.25, 1);
      b.draw(m, x, y - 30, m.w, m.h, p.bank * 0.05, 1, 1, 1, end ? 0.6 : 1, 0);
    }
    if (p.ps.divine) {
      // The owl towers over the ship (kept on screen near the bottom edge).
      const o = p.ps.fOwl, flap = 1 + 0.03 * Math.sin(p.t * 0.12), oy = Math.min(y - 90, H - 150);
      b.draw(F.glow, x, oy, 380, 320, 0, 1, 0.85, 0.5, 0.16, 1);
      b.draw(o, x, oy, o.w * flap, o.h, 0, 1, 1, 1, 1, 0);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    for (const r of p.ps.rifts) {
      if (r.t < 0) continue;
      const open = Math.min(1, r.t / 18), firing = r.t > 20 && r.t < 52;
      b.draw(p.ps.fRift, r.x, r.y, 26 * open, 110, 0, 1, 1, 1, 1, 0);
      if (firing) {
        const k = 1 - (r.t - 20) / 32;
        b.draw(F.laser, r.x, H / 2, H + 40, 60 * k + 20, Math.PI / 2, 2, 1.7, 1.1, 0.85, 1);
        b.draw(F.laser, r.x, H / 2, H + 40, 14, Math.PI / 2, 2.5, 2.5, 2.4, 1, 1);
      }
    }
    for (const tr of p.ps.tears) {
      const k = tr.t / tr.life, len = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0), a = Math.atan2(tr.y1 - tr.y0, tr.x1 - tr.x0);
      const mx = (tr.x0 + tr.x1) / 2, my = (tr.y0 + tr.y1) / 2;
      if (tr.t < 8) b.draw(F.slash, mx, my, len, 120 * (1 - tr.t / 8), a, 2.2, 2, 1.6, 1 - tr.t / 8, 1);
      b.draw(p.ps.fRift, mx, my, 34 * (1 - k * 0.6), len, a - Math.PI / 2, 1, 1, 1, Math.min(1, (1 - k) * 2), 0);
    }
    for (const hd of p.ps.hands) {
      const e = hd.e, reach = Math.min(1, hd.t / 14);
      const tx = hd.ox + (e.x - hd.ox) * reach, ty = hd.oy + (e.y - hd.oy) * reach;
      const len = Math.max(20, Math.hypot(tx - hd.ox, ty - hd.oy)), a = Math.atan2(ty - hd.oy, tx - hd.ox);
      b.draw(p.ps.fHand, (hd.ox + tx) / 2, (hd.oy + ty) / 2, 40, len + 24, a + Math.PI / 2, 1, 1, 1, 1, 0);
    }
    for (const wv of p.ps.waves) {
      const a = Math.max(0, 1 - wv.r / 900);
      b.draw(F.ring, wv.x, wv.y, wv.r * 2.15, wv.r * 2.15, 0, 2.2, 1.9, 1.2, a, 1);
      b.draw(F.ring, wv.x, wv.y, wv.r * 1.7, wv.r * 1.7, 0, 2.4, 2.4, 2.2, a * 0.6, 1);
    }
  },
};
