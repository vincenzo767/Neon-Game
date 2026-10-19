import * as P from '../../patterns/index.js';
import { every, artillery, clamp, dens, DOWN, TAU, W } from '../util.js';
import { PALS, hull, armour, both, keyLight, circ, chitin, eyeball, tentacle, poly, glowDot, limb, rivetRow } from '../roster/art.js';
import { mini } from './common.js';

// ABYSSAL mini-bosses — things that live in the deep: a trench angler with
// its lure, a drowned knight in barnacled diving armour, a hydrothermal vent
// crab walking the seabed, a bone eel coiling through the whale-falls and a
// lamprey mother in the drowned city. Nothing here has wings or wheels.

const STAND = { dx: 8, dy: 12, a: 0.45 }; // on the seabed

// ============================================================ TRENCH ANGLER

const TA = {
  lure: { shape: 'bigorb', color: 'cyan', n: 1, speed: 1.2, homing: 0.03, homingTime: 120, fixed: true },
  teeth: { shape: 'kunai', color: 'white', n: 14, speed: 2.2 },
  gill: { shape: 'orb', color: 'green', n: 5, speed: 2.1, turn: 0.19 },
};

function anglerArt(ctx) {
  const m = { lights: [] };
  // Bulbous head, gaping jaw of needle teeth, short tail aft, the lure on its stalk ahead.
  ctx.strokeStyle = '#2a3a38'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(26, 40, 4, 74); ctx.stroke();
  glowDot(ctx, 4, 76, 9, 'rgba(120,255,230,1)');
  m.lights.push({ x: 4, y: 76, c: '#7affe6', ph: 0 });
  ctx.fillStyle = '#081210'; poly(ctx, [-10, -46, 10, -46, 22, -70, 0, -60, -22, -70]); ctx.fill();
  chitin(ctx, 0, -6, 46, 50, 0, ['#040a0a', '#1c3632', '#4a706a']);
  ctx.beginPath(); ctx.ellipse(0, 30, 34, 16, 0, 0, Math.PI); ctx.fillStyle = '#020404'; ctx.fill();
  for (let k = -6; k <= 6; k++) { ctx.fillStyle = '#e8f0e8'; poly(ctx, [k * 5 - 1.6, 30, k * 5 + 1.6, 30, k * 5, 30 + 8 + (k % 2) * 4]); ctx.fill(); }
  both((s) => eyeball(ctx, s * 22, 4, 5, '#6affd0'));
  keyLight(ctx, -46, -70, 46, 84);
  return m;
}

const angler = mini({
  id: 'mb_trench_angler', name: 'LANTERNJAW', title: 'TRENCH ANGLER', archetype: 'abyssal',
  sprite: 'mb_trench_angler', r: 34, deathSequence: 'dissolve',
  art(add) { add('mb_trench_angler', 100, 160, hull('mb_trench_angler', anglerArt)); },
  look: { faction: 'drowned', anim: 'alien', organic: true, ichor: [0.3, 1, 0.8], weak: { x: 4, y: 76, r: 10, rgb: [0.4, 1, 0.9] }, pulse: [0.4, 1, 0.9], sites: [[-24, -10], [24, -10], [0, 20], [0, -40]] },
  phases: [
    { name: 'THE LURE', hp: 270, move: { type: 'hover', amp: 100, y: 140 }, patterns: ['lure', 'gill'] },
    { name: 'SNAP', hp: 300, move: { type: 'sweep', amp: 130, y: 145, freq: 0.007 }, patterns: ['bite', 'lure'] },
    { name: 'BLACK WATER', hp: 330, move: { type: 'hover', amp: 120, y: 140 }, intensity: 1.15, patterns: ['lure', 'bite', 'gill'] },
  ],
  attacks: {
    lure(c, w, t) { if (every(c, t, 90)) P.shoot(w, c.e.x + 4, c.e.y + 76, w.aimAngle(c.e.x, c.e.y + 76), TA.lure.speed, TA.lure); },
    bite(c, w, t) { if (every(c, t, 80, 20)) { P.ring(w, c.e.x, c.e.y + 30, TA.teeth, w.rng.angle()); w.g.camera.addTrauma(0.06); } },
    gill(c, w, t) { if ((t % 130) < 70 && every(c, t, 5)) P.spiral(w, c.e, TA.gill); },
  },
});

// ============================================================ DROWNED KNIGHT

const DK = {
  trident: { shape: 'kunai', color: 'yellow', n: 3, spread: 0.18, speed: 3 },
  current: { shape: 'rice', color: 'cyan', n: 14, speed: 2, gap: 1 },
  sigil: { shape: 'orb', color: 'yellow', n: 1, speed: 1.5, fixed: true },
};

function knightArt(ctx) {
  const pal = PALS.monarch, m = { lights: [] };
  // Brass diving helmet, barnacled plate armour, a trident held forward.
  both((s) => { limb(ctx, pal, s * 14, -20, s * 18, -56, 13); ctx.beginPath(); ctx.roundRect(s * 18 - 9, -64, 18, 14, 4); armour(ctx, pal, s * 18 - 9, s * 18 + 9); });
  ctx.beginPath(); ctx.roundRect(-26, -30, 52, 54, 12); armour(ctx, pal, -26, 26, 2);
  for (let k = 0; k < 16; k++) { circ(ctx, ((k * 17) % 46) - 23, -26 + ((k * 11) % 46), 1.6 + (k % 3)); ctx.fillStyle = k % 2 ? '#c8c0a8' : '#8a8470'; ctx.fill(); }
  rivetRow(ctx, pal, -22, -24, 22, -24, 4);
  circ(ctx, 0, 20, 17); const g = ctx.createRadialGradient(-5, 14, 2, 0, 20, 17); g.addColorStop(0, '#f0d890'); g.addColorStop(0.5, '#a07a30'); g.addColorStop(1, '#3a2a10'); ctx.fillStyle = g; ctx.fill();
  circ(ctx, 0, 26, 7); ctx.fillStyle = 'rgba(90,255,200,0.6)'; ctx.fill(); // faceplate glow
  both((s) => { circ(ctx, s * 13, 18, 4); ctx.fillStyle = '#2a2010'; ctx.fill(); });
  // Trident (right hand).
  limb(ctx, pal, 26, 0, 36, 20, 10);
  ctx.fillStyle = '#c8a050'; ctx.fillRect(34, 0, 4, 90);
  for (const dx of [-7, 0, 7]) { ctx.fillStyle = '#e8c870'; poly(ctx, [36 + dx - 2, 82, 36 + dx + 2, 82, 36 + dx, 98]); ctx.fill(); }
  ctx.fillRect(28, 80, 16, 3);
  keyLight(ctx, -30, -66, 46, 98);
  return m;
}

const knight = mini({
  id: 'mb_drowned_knight', name: 'BARNACLE KNIGHT', title: 'DROWNED ROYAL GUARD', archetype: 'abyssal',
  sprite: 'mb_drowned_knight', r: 32, deathSequence: 'dissolve',
  art(add) { add('mb_drowned_knight', 96, 172, hull('mb_drowned_knight', knightArt)); },
  look: { faction: 'drowned', anim: 'alien', weak: { x: 0, y: 26, r: 10, rgb: [0.4, 1, 0.8] }, shadow: STAND, rings: [{ r: 60, rgb: [1, 0.85, 0.4], spin: 0.004, a: 0.12 }], sites: [[-20, -20], [20, 0], [0, 20], [36, 60]] },
  phases: [
    { name: 'GUARD STANCE', hp: 290, move: { type: 'hover', amp: 100, y: 145 }, patterns: ['thrust', 'current'] },
    { name: 'ROYAL DECREE', hp: 310, move: { type: 'sweep', amp: 130, y: 145, freq: 0.007 }, patterns: ['decree', 'thrust'] },
    { name: 'LAST VIGIL', hp: 350, move: { type: 'hover', amp: 120, y: 145 }, intensity: 1.15, patterns: ['thrust', 'decree', 'current'] },
  ],
  attacks: {
    thrust(c, w, t) { if (every(c, t, 36)) P.aimed(w, c.e.x + 36, c.e.y + 98, DK.trident); },
    current(c, w, t) { if (every(c, t, 80, 40)) P.curtain(w, DK.current); },
    decree(c, w, t) { if (every(c, t, 110, 20)) c.kit.glyph(c.e.x, c.e.y + 60, 'trident', DK.sigil, dens(w, 26), w.rng.range(-0.3, 0.3)); },
  },
});

// ================================================================ VENT CRAB

const VC = {
  claw: { shape: 'rice', color: 'orange', n: 6, spread: 0.6, speed: 2.6 },
  magma: { shape: 'bigorb', color: 'red', n: 1, speed: 2, accel: -0.025, minSpd: 0.2, splitAt: 70, fixed: true, split: { shape: 'orb', color: 'orange', n: 10, speed: 2 } },
  steam: { shape: 'orb', color: 'white', n: 8, speed: 1.6 },
};

function crabArt(ctx) {
  const m = { lights: [], treads: [], stacks: [] };
  // Eight walking legs splayed on the seabed, two huge claws forward.
  both((s) => { for (let k = 0; k < 4; k++) { const y = -30 + k * 16; ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s * 30, y); ctx.lineTo(s * 56, y - 8); ctx.lineTo(s * 66, y + 10); ctx.stroke(); ctx.strokeStyle = '#7a4a34'; ctx.lineWidth = 3; ctx.stroke(); } });
  both((s) => { ctx.strokeStyle = '#3a2218'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(s * 22, 24); ctx.lineTo(s * 34, 50); ctx.stroke(); chitin(ctx, s * 34, 62, 16, 20, s * 0.3, ['#1a0a06', '#7a3a20', '#d88a5a']); ctx.fillStyle = '#100604'; poly(ctx, [s * 30, 74, s * 38, 74, s * 34, 84]); ctx.fill(); });
  chitin(ctx, 0, 0, 40, 36, 0, ['#140806', '#5a2a18', '#b0684a']);
  // Chimney growths on the shell: they vent hot water (anim smoke = steam).
  for (const [x, y] of [[-14, -14], [12, -18], [0, -2]]) { circ(ctx, x, y, 6); ctx.fillStyle = '#2a1e18'; ctx.fill(); circ(ctx, x, y, 3); ctx.fillStyle = '#ff7a2a'; ctx.fill(); m.stacks.push([x, y]); }
  both((s) => eyeball(ctx, s * 9, 28, 3.5, '#ffb030'));
  keyLight(ctx, -66, -40, 66, 84);
  return m;
}

const crab = mini({
  id: 'mb_vent_crab', name: 'SMOKER', title: 'HYDROTHERMAL VENT CRAB', archetype: 'abyssal',
  sprite: 'mb_vent_crab', r: 36, deathSequence: 'chain_explode',
  art(add) { add('mb_vent_crab', 140, 132, hull('mb_vent_crab', crabArt)); },
  look: { faction: 'drowned', anim: 'crawler', organic: true, ichor: [1, 0.5, 0.2], weak: { x: 0, y: -2, r: 12, rgb: [1, 0.5, 0.2] }, shadow: STAND, sites: [[-34, 62], [34, 62], [0, 0], [-20, -20]] },
  phases: [
    { name: 'PINCER', hp: 290, move: { type: 'sweep', amp: 140, y: 160, freq: 0.006 }, patterns: ['claws', 'steam'] },
    { name: 'BLACK SMOKERS', hp: 310, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['vents', 'claws'] },
    { name: 'MAGMA BED', hp: 350, move: { type: 'sweep', amp: 150, y: 160, freq: 0.008 }, intensity: 1.15, patterns: ['claws', 'vents', 'magma'] },
  ],
  attacks: {
    claws(c, w, t) { if (every(c, t, 50)) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 34, c.e.y + 80, w.aimAngle(c.e.x + s * 34, c.e.y + 80), VC.claw); },
    steam(c, w, t) { if (every(c, t, 70, 30)) P.ring(w, c.e.x, c.e.y - 10, VC.steam, w.rng.angle()); },
    // Vent eruptions: the seabed around the player bursts in boiling columns.
    vents(c, w, t) { if (every(c, t, 120)) for (let k = 0; k < 3; k++) artillery(c, clamp(w.aimX + w.rng.range(-110, 110), 40, W - 40), w.aimY + w.rng.range(-80, 20), 38, 64 + k * 10, VC.steam); },
    magma(c, w, t) { if (every(c, t, 80, 10)) P.shoot(w, c.e.x, c.e.y + 20, w.aimAngle(c.e.x, c.e.y), VC.magma.speed, VC.magma); },
  },
});

// ================================================================ BONE EEL

const BE = {
  wave: { shape: 'orb', color: 'violet', n: 1, speed: 2.6, fixed: true },
  tail: { shape: 'rice', color: 'pink', n: 6, speed: 2.2, turn: 0.15 },
  fan: { shape: 'kunai', color: 'white', n: 7, spread: 0.9, speed: 2.6 },
};

function eelArt(ctx) {
  const m = { lights: [] };
  // A long ribbed eel coiled in an S, its skeleton showing through the skin.
  const pts = [];
  for (let k = 0; k <= 24; k++) { const y = -110 + k * 9; pts.push([Math.sin(k * 0.42) * 16, y]); }
  tentacle(ctx, pts.slice().reverse(), 26, 6, '#1a1020', 'rgba(220,200,230,0.3)');
  for (let k = 2; k < pts.length - 2; k += 2) { const [x, y] = pts[k], wdt = 6 + (k / pts.length) * 9; ctx.strokeStyle = 'rgba(230,220,210,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - wdt, y); ctx.lineTo(x + wdt, y + 2); ctx.stroke(); }
  // Head at the bottom (forward), skull plates and glowing eyes.
  chitin(ctx, pts[24][0], 104, 16, 18, 0, ['#0a060c', '#3a2a40', '#a090a8']);
  both((s) => eyeball(ctx, pts[24][0] + s * 7, 110, 3.5, '#d050ff'));
  keyLight(ctx, -30, -110, 30, 120);
  return m;
}

const eel = mini({
  id: 'mb_bone_eel', name: 'OSSUARY EEL', title: 'WHALE-FALL SCAVENGER', archetype: 'abyssal',
  sprite: 'mb_bone_eel', r: 26, deathSequence: 'dissolve',
  art(add) { add('mb_bone_eel', 68, 240, hull('mb_bone_eel', eelArt)); },
  look: { faction: 'drowned', anim: 'alien', organic: true, ichor: [0.8, 0.3, 1], weak: { x: 0, y: 104, r: 12, rgb: [0.8, 0.4, 1] }, pulse: [0.8, 0.3, 1], sites: [[0, -60], [0, 0], [0, 60], [10, -100]] },
  phases: [
    { name: 'COILING', hp: 280, move: { type: 'sweep', amp: 160, y: 130, freq: 0.01 }, patterns: ['wave', 'fan'] },
    { name: 'TAIL LASH', hp: 300, move: { type: 'figure8', amp: 140, ampY: 30, y: 130 }, patterns: ['tail', 'wave'] },
    { name: 'BONE STORM', hp: 340, move: { type: 'sweep', amp: 170, y: 130, freq: 0.013 }, intensity: 1.15, patterns: ['wave', 'tail', 'fan'] },
  ],
  attacks: {
    // Sine stream: bullets peel off the body down its whole length.
    wave(c, w, t) { if (t % 5 === 0 && (t % 100) < 60) { const k = (t / 5) % 9; P.shoot(w, c.e.x + Math.sin(k * 0.9 + t * 0.05) * 16, c.e.y - 90 + k * 24, DOWN + Math.sin(t * 0.07) * 0.5, BE.wave.speed, BE.wave); } },
    tail(c, w, t) { if ((t % 120) < 70 && every(c, t, 5)) P.spiral(w, c.e, BE.tail); },
    fan(c, w, t) { if (every(c, t, 60, 30)) P.aimed(w, c.e.x, c.e.y + 110, BE.fan); },
  },
});

// =========================================================== LAMPREY MOTHER

const LM = {
  leech: { shape: 'kunai', color: 'red', n: 1, speed: 1.6, homing: 0.03, homingTime: 90, accel: 0.01, maxSpd: 2.8, fixed: true },
  ring: { shape: 'orb', color: 'pink', n: 18, speed: 1.7 },
  spit: { shape: 'rice', color: 'red', n: 8, spread: 1.1, speed: 2.4 },
};

function lampreyArt(ctx) {
  const m = { lights: [] };
  // A round sucker mouth ringed with rasping teeth, gill slits down the body, brood on the back.
  chitin(ctx, 0, -20, 34, 60, 0, ['#14060a', '#4a1822', '#a05060']);
  both((s) => { for (let k = 0; k < 7; k++) { circ(ctx, s * 22, -50 + k * 9, 2.4); ctx.fillStyle = '#1a0408'; ctx.fill(); } });
  circ(ctx, 0, 40, 30); ctx.fillStyle = '#2a0a10'; ctx.fill();
  for (let r = 0; r < 3; r++) for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU + r * 0.2, rr = 26 - r * 8; ctx.fillStyle = r === 0 ? '#f0d8c8' : '#c89888'; ctx.save(); ctx.translate(Math.cos(a) * rr, 40 + Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2); poly(ctx, [-1.8, 0, 1.8, 0, 0, 5]); ctx.fill(); ctx.restore(); }
  circ(ctx, 0, 40, 6); ctx.fillStyle = '#ff2a4a'; ctx.fill();
  for (let k = 0; k < 6; k++) { circ(ctx, ((k * 13) % 30) - 15, -60 + ((k * 7) % 30), 4); ctx.fillStyle = 'rgba(255,90,110,0.7)'; ctx.fill(); }
  keyLight(ctx, -34, -80, 34, 70);
  return m;
}

const lamprey = mini({
  id: 'mb_lamprey_swarm', name: 'LAMPREY MOTHER', title: 'DROWNED-CITY PARASITE', archetype: 'abyssal',
  sprite: 'mb_lamprey_swarm', r: 34, deathSequence: 'dissolve',
  art(add) { add('mb_lamprey_swarm', 80, 164, hull('mb_lamprey_swarm', lampreyArt)); },
  look: { faction: 'drowned', anim: 'alien', organic: true, ichor: [1, 0.15, 0.25], weak: { x: 0, y: 40, r: 12, rgb: [1, 0.2, 0.3] }, pulse: [1, 0.2, 0.3], sites: [[-20, -30], [20, -10], [0, 40], [0, -60]] },
  phases: [
    { name: 'LATCH', hp: 290, move: { type: 'hover', amp: 110, y: 140 }, patterns: ['leeches', 'spit'] },
    { name: 'BLOOD RING', hp: 310, move: { type: 'sweep', amp: 130, y: 140, freq: 0.007 }, patterns: ['rings', 'leeches'] },
    { name: 'FEEDING', hp: 350, move: { type: 'hover', amp: 130, y: 140 }, intensity: 1.15, patterns: ['leeches', 'rings', 'spit'] },
  ],
  attacks: {
    leeches(c, w, t) { if (every(c, t, 70)) for (let k = 0; k < 4; k++) P.shoot(w, c.e.x, c.e.y + 40, DOWN + (k - 1.5) * 0.6, LM.leech.speed, LM.leech); },
    rings(c, w, t) { if (every(c, t, 60, 20)) P.ring(w, c.e.x, c.e.y + 40, LM.ring, t * 0.07); },
    spit(c, w, t) { if (every(c, t, 50, 30)) P.aimed(w, c.e.x, c.e.y + 60, LM.spit); },
  },
});

export default [angler, knight, crab, eel, lamprey];
