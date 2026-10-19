import * as P from '../../patterns/index.js';
import { every, artillery, clamp, W } from '../util.js';
import { PALS, hull, body, armour, both, keyLight, track, turret, camo, weather, circ, poly, mpoly, vent, rivetRow, hazard } from '../roster/art.js';
import { mini } from './common.js';

// GROUND mini-bosses — one per ground level, each a vehicle that belongs to
// its level's arena: a snowcat on the frozen front, a half-track in the
// dunes, a rock crusher in the open pit, a self-propelled howitzer in the
// besieged downtown and an armoured train on the burning overpass rails.
// All of them drive on the ground (tread marks, exhaust) — none fly.

const M = () => ({ lights: [], treads: [], stacks: [] });

// =================================================================== SNOWCAT

const SC = {
  mg: { shape: 'rice', color: 'white', n: 1, speed: 4.2, fixed: true },
  fan: { shape: 'orb', color: 'cyan', n: 7, spread: 0.9, speed: 2.4 },
  ice: { shape: 'orb', color: 'blue', n: 10, speed: 1.9 },
};

function snowcatArt(ctx) {
  const pal = PALS.arctic, m = M();
  both((s) => { track(ctx, pal, m, s * 46 - 12, s * 46 + 12, -60, -8); track(ctx, pal, m, s * 46 - 12, s * 46 + 12, 10, 60); });
  const pts = [0, 58, 26, 54, 34, 36, 34, -44, 26, -58, 0, -60];
  m.lights.push(...body(ctx, pal, pts, [-34, -60, 68, 118], 'mb_snowcat', { vents: 2, hazards: 0 }));
  camo(ctx, () => mpoly(ctx, pts), ['rgba(255,255,255,0.5)', 'rgba(150,165,180,0.5)'], 7, 18, 14);
  // Cab with a wraparound windscreen at the front.
  ctx.beginPath(); ctx.roundRect(-24, 18, 48, 32, 6); armour(ctx, pal, -24, 24, 2);
  ctx.fillStyle = 'rgba(40,70,100,0.9)'; ctx.fillRect(-20, 42, 40, 5);
  // Roof turret with twin MGs and a radar dish behind it.
  turret(ctx, pal, 0, 0, 12, 2, 26, 3);
  circ(ctx, 0, -38, 13); armour(ctx, pal, -13, 13);
  ctx.strokeStyle = 'rgba(30,40,50,0.8)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-12, -38 + k * 4); ctx.lineTo(12, -38 + k * 4); ctx.stroke(); }
  m.stacks.push([-20, -52], [20, -52]);
  keyLight(ctx, -50, -60, 50, 60);
  m.lights.push({ x: 0, y: 46, c: '#ffe8a0', ph: 0 });
  return m;
}

const snowcat = mini({
  id: 'mb_snowcat', name: 'SNOWCAT', title: 'ARCTIC RECON TRACKER', archetype: 'ground',
  sprite: 'mb_snowcat', r: 40, deathSequence: 'tank_cookoff',
  art(add) { add('mb_snowcat', 120, 130, hull('mb_snowcat', snowcatArt)); },
  look: { faction: 'ironclad', anim: 'crawler', weak: { x: 0, y: 0, r: 14, rgb: [0.6, 0.9, 1] }, sites: [[-30, -30], [30, 20], [0, 40], [-40, 30]] },
  phases: [
    { name: 'RECON SWEEP', hp: 280, move: { type: 'sweep', amp: 150, y: 150, freq: 0.008 }, patterns: ['twinMG', 'fan'] },
    { name: 'ICE MORTARS', hp: 300, move: { type: 'hover', amp: 110, y: 140, freq: 0.01 }, patterns: ['mortar', 'twinMG'] },
    { name: 'WHITEOUT RUN', hp: 320, move: { type: 'figure8', amp: 130, ampY: 30, y: 150 }, intensity: 1.15, patterns: ['twinMG', 'mortar', 'fan'] },
  ],
  attacks: {
    twinMG(c, w, t) { if ((t % 90) < 40 && t % 4 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 5, c.e.y + 26, w.aimAngle(c.e.x, c.e.y) + s * 0.05, SC.mg.speed, SC.mg); },
    fan(c, w, t) { if (every(c, t, 70, 30)) P.aimed(w, c.e.x, c.e.y + 40, SC.fan); },
    mortar(c, w, t) { if (every(c, t, 120)) for (let k = 0; k < 2; k++) artillery(c, w.aimX + w.rng.range(-70, 70), w.aimY + w.rng.range(-50, 30), 38, 70, SC.ice); },
  },
});

// ================================================================ DUNE RAIDER

const DR = {
  rocket: { shape: 'kunai', color: 'orange', n: 1, speed: 1.6, accel: 0.04, maxSpd: 4, homing: 0.02, homingTime: 50, fixed: true },
  sand: { shape: 'rice', color: 'yellow', n: 12, speed: 2.2, gap: 1 },
  burst: { shape: 'orb', color: 'orange', n: 3, spread: 0.2, speed: 3.2 },
};

function duneRaiderArt(ctx) {
  const pal = PALS.desert, m = M();
  // Half-track: wheels at the front, tracks at the rear.
  both((s) => { track(ctx, pal, m, s * 34 - 10, s * 34 + 10, -66, -10); circ(ctx, s * 34, 44, 11); ctx.fillStyle = '#16120c'; ctx.fill(); circ(ctx, s * 34, 44, 5); ctx.fillStyle = '#6a5a40'; ctx.fill(); });
  const pts = [0, 64, 18, 62, 26, 46, 26, -56, 20, -66, 0, -68];
  m.lights.push(...body(ctx, pal, pts, [-26, -68, 52, 132], 'mb_dune', { hazards: 0 }));
  camo(ctx, () => mpoly(ctx, pts), ['rgba(120,90,50,0.6)', 'rgba(220,190,140,0.5)'], 3, 20, 12);
  // Engine grille, cab, and the rocket pod on the open bed.
  ctx.fillStyle = '#1a140c'; for (let k = 0; k < 6; k++) ctx.fillRect(-14 + k * 5, 52, 3, 8);
  ctx.beginPath(); ctx.rect(-20, 14, 40, 22); armour(ctx, pal, -20, 20, 1);
  ctx.fillStyle = 'rgba(40,40,30,0.9)'; ctx.fillRect(-16, 30, 32, 4);
  ctx.beginPath(); ctx.rect(-18, -44, 36, 40); armour(ctx, pal, -18, 18, 2);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { circ(ctx, -12 + k * 8, -38 + r * 9, 3); ctx.fillStyle = '#0c0a06'; ctx.fill(); }
  m.stacks.push([16, 6]);
  keyLight(ctx, -44, -68, 44, 68);
  return m;
}

const duneRaider = mini({
  id: 'mb_dune_raider', name: 'DUNE RAIDER', title: 'ROCKET HALF-TRACK', archetype: 'ground',
  sprite: 'mb_dune_raider', r: 38, deathSequence: 'tank_cookoff',
  art(add) { add('mb_dune_raider', 96, 140, hull('mb_dune_raider', duneRaiderArt)); },
  look: { faction: 'ironclad', anim: 'crawler', weak: { x: 0, y: -24, r: 14, rgb: [1, 0.6, 0.2] }, sites: [[-20, -30], [20, 30], [0, 0], [16, -50]] },
  phases: [
    { name: 'CONVOY RAID', hp: 290, move: { type: 'sweep', amp: 160, y: 150, freq: 0.009 }, patterns: ['salvo', 'burst'] },
    { name: 'SAND SKIM', hp: 300, move: { type: 'hover', amp: 120, y: 140 }, patterns: ['skim', 'burst'] },
    { name: 'FULL RIPPLE', hp: 330, move: { type: 'sweep', amp: 170, y: 150, freq: 0.011 }, intensity: 1.15, patterns: ['salvo', 'skim', 'burst'] },
  ],
  attacks: {
    salvo(c, w, t) {
      const k = t % 150;
      if (k < 48 && k % 6 === 0) { const s = (k / 6) % 2 ? 1 : -1; P.shoot(w, c.e.x + s * 10, c.e.y - 30, -Math.PI / 2 + s * 0.6, DR.rocket.speed, DR.rocket); }
    },
    skim(c, w, t) { if (every(c, t, 80, 20)) P.curtain(w, DR.sand); },
    burst(c, w, t) { if (every(c, t, 44)) P.aimed(w, c.e.x, c.e.y + 50, DR.burst); },
  },
});

// ================================================================ ROCK CRUSHER

const RC = {
  rock: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.6, accel: -0.035, minSpd: 0.3, splitAt: 55, fixed: true, split: { shape: 'orb', color: 'yellow', n: 9, speed: 2.1 } },
  grit: { shape: 'rice', color: 'yellow', n: 5, speed: 2.6, turn: 0.3 },
  ring: { shape: 'orb', color: 'orange', n: 16, speed: 1.7 },
};

function crusherArt(ctx) {
  const pal = PALS.mining, m = M();
  both((s) => track(ctx, pal, m, s * 50 - 15, s * 50 + 15, -64, 52));
  const pts = [0, 50, 34, 50, 38, 30, 38, -60, 30, -70, 0, -72];
  m.lights.push(...body(ctx, pal, pts, [-38, -72, 76, 122], 'mb_crusher', { hazards: 2 }));
  weather(ctx, () => mpoly(ctx, pts), 0.45);
  // Twin crusher drums across the front.
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(s > 0 ? 2 : -40, 50, 38, 20, 8);
    const g = ctx.createLinearGradient(0, 50, 0, 70); g.addColorStop(0, '#2a2a28'); g.addColorStop(0.5, '#9a968c'); g.addColorStop(1, '#1e1e1c');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#050505'; ctx.lineWidth = 1; ctx.stroke();
    for (let k = 0; k < 7; k++) { ctx.fillStyle = '#e0dcd0'; poly(ctx, [(s > 0 ? 6 : -36) + k * 5, 50, (s > 0 ? 8 : -34) + k * 5, 45, (s > 0 ? 10 : -32) + k * 5, 50]); ctx.fill(); }
  }
  hazard(ctx, pal, -38, 44, 76, 5);
  // Ore hopper, cab offset to the left, exhaust stacks.
  ctx.beginPath(); ctx.rect(-26, -58, 52, 46); armour(ctx, pal, -26, 26, 2);
  ctx.fillStyle = 'rgba(40,30,20,0.9)'; ctx.fillRect(-22, -54, 44, 38);
  for (let k = 0; k < 20; k++) { circ(ctx, -18 + (k * 13) % 36, -50 + (k * 7) % 32, 3 + (k % 3)); ctx.fillStyle = k % 2 ? '#6a5a48' : '#4a3e30'; ctx.fill(); }
  ctx.beginPath(); ctx.rect(-30, 0, 24, 26); armour(ctx, pal, -30, -6, 1);
  ctx.fillStyle = 'rgba(30,50,60,0.9)'; ctx.fillRect(-27, 20, 18, 4);
  m.stacks.push([24, -2], [24, 12]);
  keyLight(ctx, -64, -72, 64, 72);
  return m;
}

const crusher = mini({
  id: 'mb_rock_crusher', name: 'ROCK CRUSHER', title: 'MOBILE ORE CRUSHER', archetype: 'ground',
  sprite: 'mb_rock_crusher', r: 46, deathSequence: 'chain_explode',
  art(add) { add('mb_rock_crusher', 136, 150, hull('mb_rock_crusher', crusherArt)); },
  look: { faction: 'ironclad', anim: 'crawler', weak: { x: 10, y: -34, r: 16, rgb: [1, 0.55, 0.15] }, sites: [[-30, 30], [30, -40], [0, 56], [-40, -50]] },
  phases: [
    { name: 'SPOIL HEAP', hp: 300, move: { type: 'hover', amp: 100, y: 150 }, patterns: ['rocks', 'grit'] },
    { name: 'BLAST BENCH', hp: 320, move: { type: 'sweep', amp: 130, y: 150, freq: 0.007 }, patterns: ['charges', 'rocks'] },
    { name: 'PIT COLLAPSE', hp: 340, move: { type: 'hover', amp: 120, y: 145 }, intensity: 1.15, patterns: ['rocks', 'grit', 'charges'] },
  ],
  attacks: {
    rocks(c, w, t) { if (every(c, t, 70)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 20, c.e.y + 60, w.aimAngle(c.e.x, c.e.y) + s * 0.3, RC.rock.speed, RC.rock); },
    grit(c, w, t) { if ((t % 140) < 70 && every(c, t, 6)) P.spiral(w, c.e, RC.grit); },
    charges(c, w, t) {
      // Bench blasting: a row of charges goes off across the floor, then a ring from the crusher.
      if (!every(c, t, 160)) return;
      const y = clamp(w.aimY - 40, 220, 560);
      for (let k = 0; k < 4; k++) artillery(c, 70 + k * 113, y + (k % 2) * 40, 42, 60 + k * 8);
      P.ring(w, c.e.x, c.e.y, RC.ring, w.rng.angle());
    },
  },
});

// =========================================================== SIEGE HOWITZER

const SH = {
  shell: { shape: 'bigorb', color: 'red', n: 1, speed: 3.2, fixed: true },
  shrap: { shape: 'rice', color: 'orange', n: 12, speed: 2.4 },
  coax: { shape: 'orb', color: 'red', n: 5, spread: 0.6, speed: 2.6 },
};

function howitzerArt(ctx) {
  const pal = PALS.urban, m = M();
  both((s) => track(ctx, pal, m, s * 40 - 12, s * 40 + 12, -62, 50));
  const pts = [0, 52, 28, 50, 30, 30, 30, -60, 24, -64, 0, -64];
  m.lights.push(...body(ctx, pal, pts, [-30, -64, 60, 116], 'mb_howitzer', { hazards: 1 }));
  camo(ctx, () => mpoly(ctx, pts), ['rgba(60,50,48,0.6)', 'rgba(110,96,90,0.5)', 'rgba(30,26,26,0.5)'], 11, 22, 14);
  // Big boxy turret aft, the long barrel reaching past the bow.
  ctx.beginPath(); ctx.rect(-6, -10, 12, 82); armour(ctx, pal, -6, 6, 1);
  ctx.beginPath(); ctx.rect(-9, 60, 18, 12); armour(ctx, pal, -9, 9); // muzzle brake
  ctx.fillStyle = '#060404'; ctx.fillRect(-3, 70, 6, 3);
  ctx.beginPath(); ctx.roundRect(-26, -50, 52, 46, 5); armour(ctx, pal, -26, 26, 2);
  rivetRow(ctx, pal, -22, -46, 22, -46, 4);
  ctx.beginPath(); ctx.rect(14, -44, 8, 10); armour(ctx, pal, 14, 22); // commander's cupola
  vent(ctx, pal, -20, -30, 14, 10, 0);
  m.stacks.push([-22, -58]);
  keyLight(ctx, -52, -64, 52, 72);
  return m;
}

const howitzer = mini({
  id: 'mb_siege_howitzer', name: 'SIEGE HOWITZER', title: 'SELF-PROPELLED ARTILLERY', archetype: 'ground',
  sprite: 'mb_siege_howitzer', r: 40, deathSequence: 'tank_cookoff',
  art(add) { add('mb_siege_howitzer', 110, 150, hull('mb_siege_howitzer', howitzerArt)); },
  look: { faction: 'ironclad', anim: 'crawler', weak: { x: 0, y: -28, r: 15, rgb: [1, 0.35, 0.25] }, sites: [[-20, -40], [20, 10], [0, 40], [-30, 20]] },
  phases: [
    { name: 'FIRE MISSION', hp: 290, move: { type: 'hover', amp: 90, y: 140 }, patterns: ['barrage', 'coax'] },
    { name: 'DIRECT FIRE', hp: 310, move: { type: 'sweep', amp: 140, y: 150, freq: 0.008 }, patterns: ['direct', 'coax'] },
    { name: 'TIME ON TARGET', hp: 340, move: { type: 'hover', amp: 110, y: 140 }, intensity: 1.15, patterns: ['barrage', 'direct', 'coax'] },
  ],
  attacks: {
    barrage(c, w, t) {
      // A creeping barrage that walks onto the player's position.
      const k = t % 220;
      if (k === 0) c.data.bx = clamp(w.aimX, 60, W - 60);
      if (k < 120 && k % 24 === 0) artillery(c, c.data.bx + w.rng.range(-40, 40), 600 - (k / 24) * 80, 44, 60, k >= 72 ? SH.shrap : null);
    },
    direct(c, w, t) { if (every(c, t, 50)) { P.shoot(w, c.e.x, c.e.y + 72, w.aimAngle(c.e.x, c.e.y + 72), SH.shell.speed, SH.shell); w.g.camera.addTrauma(0.05); } },
    coax(c, w, t) { if (every(c, t, 64, 20)) P.aimed(w, c.e.x + 12, c.e.y + 20, SH.coax); },
  },
});

// ============================================================ ARMOURED TRAIN

const AT = {
  broad: { shape: 'rice', color: 'orange', n: 6, spread: 0.7, speed: 2.3 },
  stream: { shape: 'orb', color: 'red', n: 1, speed: 3.4, layers: 3, dSpeed: 0.35, fixed: true },
  flak: { shape: 'orb', color: 'yellow', n: 14, speed: 1.9 },
};

function trainArt(ctx) {
  const pal = PALS.steel, m = M();
  // Seen from above: a locomotive in the middle, a gun wagon at each end.
  const car = (y0, y1) => { ctx.beginPath(); ctx.roundRect(-22, y0, 44, y1 - y0, 4); armour(ctx, pal, -22, 22, 2); weather(ctx, () => { ctx.beginPath(); ctx.rect(-22, y0, 44, y1 - y0); }, 0.35); };
  for (const [y0, y1] of [[-118, -50], [-44, 44], [50, 118]]) {
    car(y0, y1);
    both((s) => { for (let y = y0 + 6; y < y1 - 4; y += 10) { ctx.fillStyle = '#0c0d10'; ctx.fillRect(s * 22 - 3, y, 3, 6); } });
  }
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-4, -50, 8, 6); ctx.fillRect(-4, 44, 8, 6); // couplings
  // Locomotive details: radiator grille, cab, exhaust.
  ctx.fillStyle = '#16181c'; for (let k = 0; k < 7; k++) ctx.fillRect(-16, -36 + k * 5, 32, 2.5);
  ctx.beginPath(); ctx.rect(-18, 18, 36, 20); armour(ctx, pal, -18, 18); ctx.fillStyle = 'rgba(30,50,70,0.9)'; ctx.fillRect(-14, 32, 28, 4);
  m.stacks.push([0, -8]);
  turret(ctx, pal, 0, 84, 14, 2, 26, 3);
  turret(ctx, pal, 0, -84, 12, 1, 22, 3);
  hazard(ctx, pal, -22, 112, 44, 5);
  keyLight(ctx, -22, -118, 22, 118);
  return m;
}

const train = mini({
  id: 'mb_armoured_train', name: 'IRONSIDE EXPRESS', title: 'ARMOURED TRAIN', archetype: 'ground',
  sprite: 'mb_armoured_train', r: 44, deathSequence: 'chain_explode',
  art(add) { add('mb_armoured_train', 60, 244, hull('mb_armoured_train', trainArt)); },
  look: { faction: 'ironclad', anim: 'crawler', weak: { x: 0, y: 0, r: 16, rgb: [1, 0.5, 0.2] }, sites: [[0, -84], [0, 84], [0, -20], [0, 30]] },
  phases: [
    { name: 'RAIL GUNNERS', hp: 300, move: { type: 'sweep', amp: 150, y: 170, freq: 0.006 }, patterns: ['broadside', 'stream'] },
    { name: 'FLAK WAGON', hp: 320, move: { type: 'hover', amp: 120, y: 170 }, patterns: ['flak', 'stream'] },
    { name: 'FULL STEAM', hp: 350, move: { type: 'sweep', amp: 170, y: 175, freq: 0.009 }, intensity: 1.15, patterns: ['broadside', 'flak', 'stream'] },
  ],
  attacks: {
    broadside(c, w, t) { if (every(c, t, 60)) for (const y of [-84, 0, 84]) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 24, c.e.y + y, s > 0 ? 0.4 : Math.PI - 0.4, AT.broad); },
    stream(c, w, t) { if (every(c, t, 40, 10)) P.stack(w, c.e.x, c.e.y + 110, w.aimAngle(c.e.x, c.e.y + 110), AT.stream); },
    flak(c, w, t) { if (every(c, t, 90)) P.ring(w, c.e.x, c.e.y - 84, AT.flak, w.rng.angle()); },
  },
});

export default [snowcat, duneRaider, crusher, howitzer, train];
