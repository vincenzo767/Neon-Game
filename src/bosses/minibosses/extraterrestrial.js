import * as P from '../../patterns/index.js';
import { every, dens, DOWN, TAU } from '../util.js';
import { PALS, hull, armour, both, keyLight, circ, chitin, eyeball, glowDot, poly, rivetRow, clipTo, greeble } from '../roster/art.js';
import { mini } from './common.js';

// EXTRATERRESTRIAL mini-bosses — spacecraft and creatures that belong in
// orbit and deep space (look anim 'alien': glyph rings, pulsing core): a
// rock-eating grazer in the asteroid belt, an ember lancer in the nebula, a
// null sentry guarding the citadel approach, a lens warden at the event
// horizon and a brood carrier over the invaded city.

// =============================================================== ROCK EATER

const RE = {
  chunk: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.6, accel: -0.03, minSpd: 0.3, splitAt: 55, fixed: true, split: { shape: 'orb', color: 'yellow', n: 8, speed: 2.2 } },
  grit: { shape: 'rice', color: 'orange', n: 4, speed: 2.4, turn: 0.27 },
  debris: { shape: 'orb', color: 'yellow', n: 2, speed: 2.6, scale: 0.9 },
};

function rockEaterArt(ctx) {
  const m = { lights: [] };
  // Segmented grazer: a ring of grinding mandibles around a gullet, plates behind.
  for (let k = 0; k < 5; k++) chitin(ctx, 0, -40 + k * 16, 34 - k * 3, 14, 0, ['#1a1410', '#5a4634', '#a08a6a']);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, x = Math.cos(a) * 24, y = 34 + Math.sin(a) * 18;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#c8b898'; poly(ctx, [-4, 0, 4, 0, 0, 14]); ctx.fill(); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }
  circ(ctx, 0, 34, 14); ctx.fillStyle = '#120806'; ctx.fill();
  const g = ctx.createRadialGradient(0, 34, 2, 0, 34, 12); g.addColorStop(0, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  circ(ctx, 0, 34, 12); ctx.fillStyle = g; ctx.fill();
  // Ore crystals grown into the back plates.
  for (let k = 0; k < 7; k++) { const x = ((k * 19) % 50) - 25, y = -46 + ((k * 11) % 40); ctx.fillStyle = k % 2 ? '#d8a050' : '#8a6a3a'; poly(ctx, [x, y - 7, x + 4, y, x, y + 5, x - 4, y]); ctx.fill(); }
  keyLight(ctx, -40, -56, 40, 56);
  return m;
}

const rockEater = mini({
  id: 'mb_rock_eater', name: 'GRAZER', title: 'ASTEROID GRAZER', archetype: 'extraterrestrial',
  sprite: 'mb_rock_eater', r: 34, deathSequence: 'dissolve',
  art(add) { add('mb_rock_eater', 92, 120, hull('mb_rock_eater', rockEaterArt)); },
  look: { faction: 'outerstar', anim: 'alien', organic: true, ichor: [1, 0.6, 0.2], weak: { x: 0, y: 34, r: 12, rgb: [1, 0.6, 0.2] }, rings: [{ r: 60, rgb: [1, 0.6, 0.3], spin: 0.004, a: 0.14 }], pulse: [1, 0.55, 0.2], sites: [[-20, -30], [20, -10], [0, 20], [0, -50]] },
  phases: [
    { name: 'GRAZING', hp: 270, move: { type: 'hover', amp: 110, y: 150 }, patterns: ['chunks', 'grit'] },
    { name: 'DEBRIS WAKE', hp: 300, move: { type: 'sweep', amp: 140, y: 150, freq: 0.007 }, patterns: ['debris', 'chunks'] },
    { name: 'FEEDING FRENZY', hp: 330, move: { type: 'figure8', amp: 130, ampY: 30, y: 150 }, intensity: 1.15, patterns: ['chunks', 'grit', 'debris'] },
  ],
  attacks: {
    chunks(c, w, t) { if (every(c, t, 65)) P.shoot(w, c.e.x, c.e.y + 40, w.aimAngle(c.e.x, c.e.y), RE.chunk.speed, RE.chunk); },
    grit(c, w, t) { if ((t % 130) < 70 && every(c, t, 6)) P.spiral(w, c.e, RE.grit); },
    debris(c, w, t) { if ((t % 150) < 90 && every(c, t, 8)) P.rain(w, RE.debris); },
  },
});

// ============================================================ EMBER LANCER

const EL = {
  ember: { shape: 'rice', color: 'red', n: 7, spread: 0.8, speed: 2.6 },
  swirl: { shape: 'orb', color: 'pink', n: 6, speed: 2.1, turn: 0.11 },
};

function emberArt(ctx) {
  const pal = PALS.crimson, m = { lights: [] };
  // A blade-shaped energy cruiser: long prow, swept fins, a burning heart.
  const pts = [0, 78, 10, 50, 26, 8, 44, -28, 30, -40, 14, -30, 0, -54];
  const path = () => { ctx.beginPath(); ctx.moveTo(0, pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); for (let i = pts.length - 2; i >= 0; i -= 2) ctx.lineTo(-pts[i], pts[i + 1]); ctx.closePath(); };
  path(); armour(ctx, pal, -44, 44, 2);
  m.lights.push(...clipTo(ctx, path, () => greeble(ctx, pal, [-44, -54, 88, 132], { seed: 'mb_ember', panel: 12, rivets: 0.2, vents: 2, pipes: 0, cables: 0, hazards: 0, lights: 3, glow: 0.6 })).lights);
  both((s) => { ctx.strokeStyle = 'rgba(255,90,70,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s * 6, 60); ctx.lineTo(s * 30, -20); ctx.stroke(); });
  const g = ctx.createRadialGradient(0, 4, 1, 0, 4, 16); g.addColorStop(0, '#fff0d0'); g.addColorStop(0.4, '#ff5a3a'); g.addColorStop(1, 'rgba(120,0,0,0)');
  circ(ctx, 0, 4, 16); ctx.fillStyle = g; ctx.fill();
  keyLight(ctx, -44, -54, 44, 78);
  return m;
}

const ember = mini({
  id: 'mb_ember_lancer', name: 'EMBER LANCER', title: 'NEBULA STRIKE CRUISER', archetype: 'extraterrestrial',
  sprite: 'mb_ember_lancer', r: 30, deathSequence: 'implode',
  art(add) { add('mb_ember_lancer', 96, 140, hull('mb_ember_lancer', emberArt)); },
  look: { faction: 'outerstar', anim: 'alien', weak: { x: 0, y: 4, r: 12, rgb: [1, 0.35, 0.25] }, shadow: { dx: 26, dy: 40, a: 0.2 }, rings: [{ r: 54, rgb: [1, 0.3, 0.2], spin: -0.006, a: 0.18 }], pulse: [1, 0.3, 0.2], sites: [[-24, -20], [24, -20], [0, 40], [0, -30]] },
  phases: [
    { name: 'LANCE VOLLEY', hp: 280, move: { type: 'sweep', amp: 150, y: 150, freq: 0.009 }, patterns: ['lances', 'embers'] },
    { name: 'EMBER SWIRL', hp: 300, move: { type: 'hover', amp: 110, y: 150 }, patterns: ['swirl', 'embers'] },
    { name: 'NOVA PROW', hp: 340, move: { type: 'figure8', amp: 140, ampY: 30, y: 150 }, intensity: 1.15, patterns: ['lances', 'swirl', 'embers'] },
  ],
  attacks: {
    lances(c, w, t) { if (every(c, t, 110)) for (const s of [-1, 0, 1]) P.laser(w, c.e, w.aimAngle(c.e.x, c.e.y) + s * 0.35, { warn: 48, fire: 26, width: 9, oy: 60, rgb: [1, 0.35, 0.25] }); },
    embers(c, w, t) { if (every(c, t, 55, 20)) P.aimed(w, c.e.x, c.e.y + 60, EL.ember); },
    swirl(c, w, t) { if ((t % 130) < 80 && every(c, t, 5)) P.spiral(w, c.e, EL.swirl); },
  },
});

// =============================================================== NULL SENTRY

const NS = {
  ring: { shape: 'orb', color: 'violet', n: 16, speed: 1.8 },
  dark: { shape: 'rice', color: 'blue', n: 4, speed: 2.2, turn: -0.19 },
  glyph: { shape: 'orb', color: 'violet', n: 1, speed: 1.5, fixed: true },
};

function sentryArt(ctx) {
  const pal = PALS.void, m = { lights: [] };
  // An obsidian octahedron seen from above, with four floating vanes.
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(36, 0); ctx.lineTo(0, 44); ctx.lineTo(-36, 0); ctx.closePath(); armour(ctx, pal, -36, 36, 2);
  ctx.strokeStyle = 'rgba(200,180,255,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 44); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    ctx.save(); ctx.translate(Math.cos(a) * 46, Math.sin(a) * 46); ctx.rotate(a);
    ctx.beginPath(); ctx.rect(-4, -12, 8, 24); armour(ctx, pal, -4, 4, 1);
    ctx.restore();
  }
  glowDot(ctx, 0, 0, 9, 'rgba(180,140,255,1)');
  rivetRow(ctx, pal, -18, -22, 18, -22, 5);
  keyLight(ctx, -56, -56, 56, 56);
  return m;
}

const sentry = mini({
  id: 'mb_null_sentry', name: 'NULL SENTRY', title: 'CITADEL GATE GUARDIAN', archetype: 'extraterrestrial',
  sprite: 'mb_null_sentry', r: 32, deathSequence: 'implode', transitionSpin: true,
  art(add) { add('mb_null_sentry', 120, 120, hull('mb_null_sentry', sentryArt)); },
  look: { faction: 'outerstar', anim: 'alien', weak: { x: 0, y: 0, r: 12, rgb: [0.7, 0.55, 1] }, shadow: { dx: 24, dy: 38, a: 0.2 }, rings: [{ r: 70, rgb: [0.7, 0.5, 1], spin: 0.005, a: 0.2 }, { r: 48, rgb: [0.4, 0.4, 1], spin: -0.008, a: 0.16 }], pulse: [0.7, 0.5, 1], sites: [[-24, 0], [24, 0], [0, 24], [0, -24]] },
  phases: [
    { name: 'GATE SCAN', hp: 280, move: { type: 'center', y: 150 }, patterns: ['sweep', 'rings'] },
    { name: 'NULL FIELD', hp: 300, move: { type: 'hover', amp: 90, y: 150 }, patterns: ['glyph', 'dark'] },
    { name: 'LOCKDOWN', hp: 340, move: { type: 'hover', amp: 110, y: 150 }, intensity: 1.15, patterns: ['sweep', 'glyph', 'dark'] },
  ],
  attacks: {
    sweep(c, w, t) { if (every(c, t, 160)) for (const s of [-1, 1]) P.laser(w, c.e, DOWN + s * 0.9, { warn: 55, fire: 90, width: 14, angVel: -s * 0.012, rgb: [0.7, 0.5, 1] }); },
    rings(c, w, t) { if (every(c, t, 70, 30)) P.ring(w, c.e.x, c.e.y, NS.ring, t * 0.05); },
    glyph(c, w, t) { if (every(c, t, 120, 20)) c.kit.glyph(c.e.x, c.e.y + 30, 'rune', NS.glyph, dens(w, 28), w.rng.range(-0.4, 0.4)); },
    dark(c, w, t) { if ((t % 120) < 70 && every(c, t, 5)) P.spiral(w, c.e, NS.dark); },
  },
  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.01) * 0.3; },
});

// =============================================================== LENS WARDEN

const LW = {
  bend: { shape: 'orb', color: 'white', n: 1, speed: 2.4, angVel: 0.012, fixed: true },
  bendL: { shape: 'orb', color: 'white', n: 1, speed: 2.4, angVel: -0.012, fixed: true },
  pulse: { shape: 'rice', color: 'violet', n: 20, speed: 1.7 },
};

function lensArt(ctx) {
  const pal = PALS.regent, m = { lights: [] };
  // A ring-hulled observatory ship around a gravitational lens.
  circ(ctx, 0, 0, 48); armour(ctx, pal, -48, 48, 2);
  circ(ctx, 0, 0, 30); ctx.fillStyle = '#05040a'; ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, 'rgba(255,240,255,0.9)'); g.addColorStop(0.25, 'rgba(160,120,255,0.5)'); g.addColorStop(0.7, 'rgba(20,10,40,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  circ(ctx, 0, 0, 30); ctx.fillStyle = g; ctx.fill();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.save(); ctx.translate(Math.cos(a) * 39, Math.sin(a) * 39); ctx.rotate(a); ctx.beginPath(); ctx.rect(-3, -6, 6, 12); armour(ctx, pal, -3, 3); ctx.restore(); }
  both((s) => { ctx.beginPath(); ctx.rect(s * 52 - 6, -18, 12, 36); armour(ctx, pal, s * 52 - 6, s * 52 + 6, 1); });
  keyLight(ctx, -58, -48, 58, 48);
  return m;
}

const lens = mini({
  id: 'mb_lens_warden', name: 'LENS WARDEN', title: 'GRAVITATIONAL OBSERVATORY', archetype: 'extraterrestrial',
  sprite: 'mb_lens_warden', r: 36, deathSequence: 'implode',
  art(add) { add('mb_lens_warden', 128, 108, hull('mb_lens_warden', lensArt)); },
  look: { faction: 'outerstar', anim: 'alien', weak: { x: 0, y: 0, r: 14, rgb: [0.8, 0.6, 1] }, shadow: { dx: 24, dy: 38, a: 0.2 }, rings: [{ r: 80, rgb: [0.8, 0.6, 1], spin: 0.003, a: 0.16 }], pulse: [0.9, 0.7, 1], sites: [[-40, 0], [40, 0], [0, 30], [0, -30]] },
  phases: [
    { name: 'BENT LIGHT', hp: 280, move: { type: 'hover', amp: 100, y: 150 }, patterns: ['bend', 'pulse'] },
    { name: 'TIDAL FORCE', hp: 310, move: { type: 'center', y: 150 }, patterns: ['well', 'bend'] },
    { name: 'EINSTEIN RING', hp: 340, move: { type: 'hover', amp: 110, y: 150 }, intensity: 1.15, patterns: ['bend', 'pulse', 'well'] },
  ],
  attacks: {
    // Bent light: twin streams that curve around the lens toward the player.
    bend(c, w, t) { if (t % 6 === 0 && (t % 120) < 70) { P.shoot(w, c.e.x - 40, c.e.y, DOWN - 0.8, LW.bend.speed, LW.bend); P.shoot(w, c.e.x + 40, c.e.y, DOWN + 0.8, LW.bendL.speed, LW.bendL); } },
    pulse(c, w, t) { if (every(c, t, 80, 30)) P.ring(w, c.e.x, c.e.y, LW.pulse, w.rng.angle()); },
    well(c, w, t) { if (every(c, t, 240)) c.kit.well({ x: w.rng.range(120, 360), y: w.rng.range(320, 460), r: 140, strength: 0.05, life: 180 }); },
  },
});

// ============================================================ BROOD CARRIER

const BC = {
  spore: { shape: 'bigorb', color: 'green', n: 1, speed: 1.4, accel: -0.015, minSpd: 0.3, splitAt: 90, fixed: true, split: { shape: 'orb', color: 'green', n: 8, speed: 1.9 } },
  sting: { shape: 'kunai', color: 'green', n: 3, spread: 0.5, speed: 2.4, homing: 0.02, homingTime: 40 },
  acid: { shape: 'rice', color: 'yellow', n: 5, speed: 2.2, turn: 0.23 },
};

function broodArt(ctx) {
  const m = { lights: [] };
  // A swollen brood sac slung under bony ribs, egg pods and eyes along the flanks.
  chitin(ctx, 0, 0, 44, 58, 0, ['#0e1a0c', '#3a5a2a', '#8aa86a']);
  for (let k = -3; k <= 3; k++) { ctx.strokeStyle = 'rgba(220,230,200,0.65)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, k * 14); ctx.quadraticCurveTo(0, k * 14 - 10, 40, k * 14); ctx.stroke(); }
  both((s) => { for (let k = 0; k < 4; k++) { circ(ctx, s * 46, -30 + k * 20, 7); const g = ctx.createRadialGradient(s * 44, -32 + k * 20, 1, s * 46, -30 + k * 20, 7); g.addColorStop(0, '#e8ffb0'); g.addColorStop(1, '#3a6a20'); ctx.fillStyle = g; ctx.fill(); } });
  eyeball(ctx, 0, 40, 9, '#9aff4a');
  both((s) => eyeball(ctx, s * 18, 28, 5, '#9aff4a'));
  keyLight(ctx, -54, -58, 54, 58);
  return m;
}

const brood = mini({
  id: 'mb_brood_carrier', name: 'BROODMOTHER', title: 'HIVE BROOD CARRIER', archetype: 'extraterrestrial',
  sprite: 'mb_brood_carrier', r: 38, deathSequence: 'dissolve',
  art(add) { add('mb_brood_carrier', 112, 124, hull('mb_brood_carrier', broodArt)); },
  look: { faction: 'outerstar', anim: 'alien', organic: true, ichor: [0.5, 1, 0.4], weak: { x: 0, y: 40, r: 12, rgb: [0.6, 1, 0.3] }, shadow: { dx: 26, dy: 40, a: 0.26 }, rings: [{ r: 66, rgb: [0.5, 1, 0.4], spin: 0.004, a: 0.12 }], pulse: [0.5, 1, 0.4], sites: [[-30, -20], [30, 10], [0, 30], [0, -40]] },
  phases: [
    { name: 'SPORE DROP', hp: 290, move: { type: 'hover', amp: 110, y: 150 }, patterns: ['spores', 'stings'] },
    { name: 'ACID MIST', hp: 310, move: { type: 'sweep', amp: 140, y: 150, freq: 0.007 }, patterns: ['acid', 'stings'] },
    { name: 'HATCHING', hp: 350, move: { type: 'hover', amp: 120, y: 150 }, intensity: 1.15, patterns: ['spores', 'acid', 'stings'] },
  ],
  attacks: {
    spores(c, w, t) { if (every(c, t, 60)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 46, c.e.y, DOWN + s * 0.6, BC.spore.speed, BC.spore); },
    stings(c, w, t) { if (every(c, t, 50, 20)) P.aimed(w, c.e.x, c.e.y + 48, BC.sting); },
    acid(c, w, t) { if ((t % 130) < 80 && every(c, t, 5)) P.spiral(w, c.e, BC.acid); },
  },
});

export default [rockEater, ember, sentry, lens, brood];
