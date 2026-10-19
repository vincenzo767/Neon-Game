import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, W } from '../util.js';
import { PALS, hull, body, wing, nozzles, armour, both, keyLight, circ, mpoly, canopy, turret, camo, hazard, rivetRow } from '../roster/art.js';
import { mini } from './common.js';

// AERIAL mini-bosses — aircraft (look anim 'carrier': afterburners, rotors,
// drop shadow on the ground far below): a recon jet over the fjords, an
// attack helicopter in the canyon, a weather-control drone in the
// supercell, a heavy gunship over the airbase and a tanker escort fighter
// at dawn.

const A = () => ({ lights: [], fans: [], nozzles: [] });

// ================================================================ RECON JET

const RJ = {
  gun: { shape: 'kunai', color: 'white', n: 1, speed: 5, fixed: true },
  chaff: { shape: 'orb', color: 'cyan', n: 14, speed: 1.8 },
  fan: { shape: 'rice', color: 'blue', n: 6, spread: 0.7, speed: 2.8 },
};

function reconJetArt(ctx) {
  const pal = PALS.frost, m = A();
  m.lights.push(...wing(ctx, pal, [0, 30, 58, -10, 58, -20, 20, -14, 12, -40, 30, -52, 30, -58, 0, -56], 'mb_jet_w'));
  m.lights.push(...body(ctx, pal, [0, 70, 7, 56, 11, 30, 11, -50, 8, -58, 0, -58], [-11, -58, 22, 128], 'mb_jet_b', { vents: 1, hazards: 0, pipes: 0 }));
  canopy(ctx, 0, 38, 6, 14);
  // Recon pod under the nose, roundels.
  ctx.fillStyle = '#20262e'; ctx.fillRect(-3, 52, 6, 10);
  both((s) => { circ(ctx, s * 36, -16, 5); ctx.fillStyle = '#e8eef4'; ctx.fill(); circ(ctx, s * 36, -16, 2.5); ctx.fillStyle = '#c02828'; ctx.fill(); });
  nozzles(ctx, pal, m, [[-5, -58], [5, -58]], 4.5);
  keyLight(ctx, -58, -58, 58, 70);
  return m;
}

const reconJet = mini({
  id: 'mb_recon_jet', name: 'SILVER LYNX', title: 'HIGH-ALTITUDE RECON JET', archetype: 'aerial',
  sprite: 'mb_recon_jet', r: 28, deathSequence: 'spin_out',
  art(add) { add('mb_recon_jet', 124, 136, hull('mb_recon_jet', reconJetArt)); },
  look: { faction: 'stratos', anim: 'carrier', weak: { x: 0, y: 20, r: 11, rgb: [0.5, 0.9, 1] }, shadow: { dx: 34, dy: 52, a: 0.3 }, sites: [[-30, -10], [30, -10], [0, 30], [0, -40]] },
  phases: [
    { name: 'PHOTO RUN', hp: 260, move: { type: 'sweep', amp: 170, y: 140, freq: 0.012 }, patterns: ['strafe', 'fan'] },
    { name: 'CHAFF SCREEN', hp: 290, move: { type: 'figure8', amp: 150, ampY: 40, y: 150, freq: 0.012 }, patterns: ['chaff', 'strafe'] },
    { name: 'AFTERBURNER', hp: 320, move: { type: 'sweep', amp: 180, y: 140, freq: 0.016 }, intensity: 1.15, patterns: ['strafe', 'chaff', 'fan'] },
  ],
  attacks: {
    strafe(c, w, t) { if ((t % 80) < 30 && t % 3 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 6, c.e.y + 50, DOWN + s * 0.04, RJ.gun.speed, RJ.gun); },
    chaff(c, w, t) { if (every(c, t, 90, 20)) P.ring(w, c.e.x, c.e.y - 40, RJ.chaff, w.rng.angle()); },
    fan(c, w, t) { if (every(c, t, 60, 30)) P.aimed(w, c.e.x, c.e.y + 40, RJ.fan); },
  },
});

// ============================================================ ATTACK HELI

const AH = {
  rocket: { shape: 'kunai', color: 'orange', n: 1, speed: 3.6, fixed: true },
  chin: { shape: 'rice', color: 'yellow', n: 1, speed: 4.2, fixed: true },
  hellfire: { shape: 'bigorb', color: 'red', n: 1, speed: 1.2, accel: 0.03, maxSpd: 3.2, homing: 0.03, homingTime: 90, fixed: true },
};

function heliArt(ctx) {
  const pal = PALS.desert, m = A();
  // Stub wings with rocket pods, slim tandem-cockpit fuselage, tail boom aft.
  m.lights.push(...wing(ctx, pal, [0, 10, 30, 6, 30, -8, 0, -6], 'mb_heli_w', { lights: 1 }));
  both((s) => { ctx.beginPath(); ctx.roundRect(s * 30 - 5, -12, 10, 26, 4); armour(ctx, pal, s * 30 - 5, s * 30 + 5); for (let k = 0; k < 3; k++) { circ(ctx, s * 30 + (k - 1) * 3, 11, 1.4); ctx.fillStyle = "#0a0806"; ctx.fill(); } });
  m.lights.push(...body(ctx, pal, [0, 52, 7, 44, 10, 20, 10, -14, 4, -30, 3, -74, 0, -76], [-10, -76, 20, 128], 'mb_heli_b', { vents: 2, hazards: 0, pipes: 1 }));
  camo(ctx, () => mpoly(ctx, [0, 52, 7, 44, 10, 20, 10, -14, 4, -30, 3, -74, 0, -76]), ['rgba(120,90,50,0.6)', 'rgba(70,60,40,0.5)'], 5, 14, 8);
  canopy(ctx, 0, 30, 5, 9); canopy(ctx, 0, 14, 5, 8);
  turret(ctx, pal, 0, 46, 4, 1, 10, 2);
  ctx.beginPath(); ctx.rect(-12, -72, 24, 4); armour(ctx, pal, -12, 12); // tail plane
  m.fans.push([0, 0, 44], [6, -72, 9]); // main rotor + tail rotor
  keyLight(ctx, -44, -76, 44, 52);
  return m;
}

const heli = mini({
  id: 'mb_attack_heli', name: 'DUST DEVIL', title: 'ATTACK HELICOPTER', archetype: 'aerial',
  sprite: 'mb_attack_heli', r: 30, deathSequence: 'spin_out',
  art(add) { add('mb_attack_heli', 96, 136, hull('mb_attack_heli', heliArt)); },
  look: { faction: 'stratos', anim: 'carrier', weak: { x: 0, y: 6, r: 11, rgb: [1, 0.6, 0.25] }, shadow: { dx: 26, dy: 40, a: 0.32 }, sites: [[-30, 0], [30, 0], [0, 30], [0, -40]] },
  phases: [
    { name: 'CANYON HUNT', hp: 270, move: { type: 'hover', amp: 120, y: 150, freq: 0.012 }, patterns: ['rockets', 'chin'] },
    { name: 'HELLFIRE', hp: 300, move: { type: 'sweep', amp: 150, y: 150, freq: 0.009 }, patterns: ['hellfire', 'chin'] },
    { name: 'NAP OF THE EARTH', hp: 330, move: { type: 'figure8', amp: 140, ampY: 40, y: 160 }, intensity: 1.15, patterns: ['rockets', 'hellfire', 'chin'] },
  ],
  attacks: {
    rockets(c, w, t) { const k = t % 110; if (k < 36 && k % 4 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 30, c.e.y + 12, DOWN + s * (0.1 + (k / 36) * 0.4), AH.rocket.speed, AH.rocket); },
    chin(c, w, t) { if ((t % 70) < 28 && t % 3 === 0) P.shoot(w, c.e.x, c.e.y + 56, w.aimAngle(c.e.x, c.e.y) + Math.sin(t * 0.2) * 0.2, AH.chin.speed, AH.chin); },
    hellfire(c, w, t) { if (every(c, t, 100, 30)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 30, c.e.y, DOWN + s * 0.9, AH.hellfire.speed, AH.hellfire); },
  },
});

// ========================================================= WEATHER DRONE

const WD = {
  hail: { shape: 'orb', color: 'white', n: 2, speed: 3.2, scale: 0.8 },
  spiral: { shape: 'rice', color: 'cyan', n: 5, speed: 2.4, turn: 0.15 },
  gust: { shape: 'rice', color: 'blue', n: 16, speed: 2.1, gap: 2 },
};

function droneArt(ctx) {
  const pal = PALS.storm, m = A();
  // Flying-wing drone with a sensor dome and four seeding pods.
  m.lights.push(...wing(ctx, pal, [0, 46, 74, -10, 70, -24, 40, -20, 20, -36, 0, -30], 'mb_wd_w', { lights: 3 }));
  circ(ctx, 0, 6, 18); armour(ctx, pal, -18, 18, 2);
  const g = ctx.createRadialGradient(-5, 0, 2, 0, 6, 14); g.addColorStop(0, '#e8f0ff'); g.addColorStop(0.5, '#7088b0'); g.addColorStop(1, '#202838');
  circ(ctx, 0, 6, 12); ctx.fillStyle = g; ctx.fill();
  both((s) => { for (const x of [30, 52]) { ctx.beginPath(); ctx.roundRect(s * x - 4, -10, 8, 18, 3); armour(ctx, pal, s * x - 4, s * x + 4); ctx.fillStyle = 'rgba(160,200,255,0.8)'; ctx.fillRect(s * x - 1.5, 6, 3, 2); } });
  nozzles(ctx, pal, m, [[-10, -30], [10, -30]], 4);
  hazard(ctx, pal, -16, 36, 32, 3);
  keyLight(ctx, -74, -36, 74, 46);
  return m;
}

const weatherDrone = mini({
  id: 'mb_weather_drone', name: 'NIMBUS', title: 'WEATHER-CONTROL DRONE', archetype: 'aerial',
  sprite: 'mb_weather_drone', r: 30, deathSequence: 'chain_explode',
  art(add) { add('mb_weather_drone', 156, 92, hull('mb_weather_drone', droneArt)); },
  look: { faction: 'stratos', anim: 'carrier', weak: { x: 0, y: 6, r: 12, rgb: [0.6, 0.8, 1] }, shadow: { dx: 30, dy: 48, a: 0.28 }, sites: [[-40, 0], [40, 0], [0, 20], [0, -20]] },
  phases: [
    { name: 'CLOUD SEEDING', hp: 270, move: { type: 'hover', amp: 110, y: 140 }, patterns: ['hail', 'spiral'] },
    { name: 'LIGHTNING ROD', hp: 300, move: { type: 'sweep', amp: 130, y: 140, freq: 0.008 }, patterns: ['bolts', 'spiral'] },
    { name: 'DOWNBURST', hp: 330, move: { type: 'hover', amp: 130, y: 140 }, intensity: 1.15, patterns: ['hail', 'bolts', 'gust'] },
  ],
  attacks: {
    hail(c, w, t) { if ((t % 160) < 100 && every(c, t, 6)) P.rain(w, WD.hail); },
    spiral(c, w, t) { if ((t % 120) < 60 && every(c, t, 6)) P.spiral(w, c.e, WD.spiral); },
    bolts(c, w, t) {
      if (!every(c, t, 120)) return;
      for (const s of [-1, 1]) P.laser(w, c.e, DOWN + s * 0.3, { warn: 50, fire: 40, width: 12, angVel: -s * 0.006, ox: s * 52, rgb: [0.7, 0.85, 1] });
    },
    gust(c, w, t) { if (every(c, t, 90, 40)) P.curtain(w, WD.gust); },
  },
});

// ============================================================ HEAVY GUNSHIP

const GS = {
  side: { shape: 'orb', color: 'orange', n: 1, speed: 3.2, fixed: true },
  howitzer: { shape: 'bigorb', color: 'red', n: 1, speed: 2.2, accel: -0.025, minSpd: 0.3, splitAt: 70, fixed: true, split: { shape: 'orb', color: 'orange', n: 12, speed: 2 } },
  curtain: { shape: 'rice', color: 'yellow', n: 14, speed: 2.2, gap: 1 },
};

function gunshipArt(ctx) {
  const pal = PALS.bomber, m = A();
  m.lights.push(...wing(ctx, pal, [0, 24, 92, 14, 92, 4, 0, -4], 'mb_gs_w', { lights: 3 }));
  m.lights.push(...body(ctx, pal, [0, 76, 10, 68, 15, 50, 15, -60, 8, -76, 0, -78], [-15, -78, 30, 154], 'mb_gs_b', { vents: 2, hazards: 0 }));
  both((s) => { for (const x of [36, 66]) { ctx.beginPath(); ctx.ellipse(s * x, 18, 7, 14, 0, 0, Math.PI * 2); armour(ctx, pal, s * x - 7, s * x + 7); m.fans.push([s * x, 30, 14]); } });
  ctx.beginPath(); ctx.rect(-34, -70, 68, 8); armour(ctx, pal, -34, 34); // tailplane
  // Side-firing gun ports along the left of the fuselage.
  for (let k = 0; k < 3; k++) { ctx.fillStyle = '#0a0806'; ctx.fillRect(-16, 10 - k * 16, 5, 6); }
  canopy(ctx, 0, 62, 7, 9);
  rivetRow(ctx, pal, -12, -40, 12, -40, 4);
  keyLight(ctx, -92, -78, 92, 78);
  return m;
}

const gunship = mini({
  id: 'mb_gunship', name: 'HALO SPECTRE', title: 'HEAVY GUNSHIP', archetype: 'aerial',
  sprite: 'mb_gunship', r: 40, deathSequence: 'spin_out',
  art(add) { add('mb_gunship', 190, 162, hull('mb_gunship', gunshipArt)); },
  look: { faction: 'stratos', anim: 'carrier', weak: { x: 0, y: 0, r: 14, rgb: [1, 0.6, 0.3] }, shadow: { dx: 32, dy: 50, a: 0.32 }, sites: [[-50, 18], [50, 18], [0, 40], [0, -40]] },
  phases: [
    { name: 'PYLON TURN', hp: 300, move: { type: 'figure8', amp: 110, ampY: 30, y: 150 }, patterns: ['orbitFire', 'curtain'] },
    { name: '105MM', hp: 320, move: { type: 'hover', amp: 110, y: 145 }, patterns: ['howitzer', 'orbitFire'] },
    { name: 'DANGER CLOSE', hp: 350, move: { type: 'figure8', amp: 130, ampY: 36, y: 150 }, intensity: 1.15, patterns: ['orbitFire', 'howitzer', 'curtain'] },
  ],
  attacks: {
    // Pylon turn: the side guns rake a slowly rotating circle around the player.
    orbitFire(c, w, t) {
      if (t % 4) return;
      const a = t * 0.035, tx = clamp(w.aimX + Math.cos(a) * 90, 20, W - 20), ty = w.aimY + Math.sin(a) * 60;
      P.shoot(w, c.e.x - 16, c.e.y + 6, Math.atan2(ty - c.e.y, tx - c.e.x), GS.side.speed, GS.side);
    },
    howitzer(c, w, t) { if (every(c, t, 75)) P.shoot(w, c.e.x - 16, c.e.y, w.aimAngle(c.e.x, c.e.y), GS.howitzer.speed, GS.howitzer); },
    curtain(c, w, t) { if (every(c, t, 100, 50)) P.curtain(w, GS.curtain); },
  },
});

// ============================================================ TANKER ESCORT

const TE = {
  missile: { shape: 'kunai', color: 'red', n: 1, speed: 1.3, accel: 0.04, maxSpd: 4, homing: 0.03, homingTime: 60, fixed: true },
  guns: { shape: 'rice', color: 'orange', n: 8, spread: 1.0, speed: 2.6 },
  flares: { shape: 'orb', color: 'white', n: 16, speed: 1.6 },
};

function escortArt(ctx) {
  const pal = PALS.steel, m = A();
  m.lights.push(...wing(ctx, pal, [0, 24, 62, -6, 62, -16, 18, -10, 16, -36, 34, -48, 34, -54, 0, -52], 'mb_te_w'));
  m.lights.push(...body(ctx, pal, [0, 74, 9, 60, 14, 30, 14, -50, 10, -56, 0, -56], [-14, -56, 28, 130], 'mb_te_b', { vents: 1, hazards: 0 }));
  canopy(ctx, 0, 44, 6, 13);
  // Conformal fuel tanks, missiles on the wingtips, refuelling probe.
  both((s) => { ctx.beginPath(); ctx.roundRect(s * 18 - 5, -30, 10, 46, 5); armour(ctx, pal, s * 18 - 5, s * 18 + 5); ctx.fillStyle = '#d8d8d0'; ctx.fillRect(s * 60 - 1.5, -24, 3, 22); ctx.fillStyle = '#c02020'; ctx.fillRect(s * 60 - 1.5, -4, 3, 3); });
  ctx.strokeStyle = '#a0a8b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, 56); ctx.lineTo(9, 72); ctx.stroke();
  nozzles(ctx, pal, m, [[-6, -56], [6, -56]], 5);
  keyLight(ctx, -62, -56, 62, 74);
  return m;
}

const escort = mini({
  id: 'mb_tanker_escort', name: 'GALEHAWK', title: 'TANKER ESCORT FIGHTER', archetype: 'aerial',
  sprite: 'mb_tanker_escort', r: 30, deathSequence: 'spin_out',
  art(add) { add('mb_tanker_escort', 132, 140, hull('mb_tanker_escort', escortArt)); },
  look: { faction: 'stratos', anim: 'carrier', weak: { x: 0, y: 14, r: 12, rgb: [0.4, 0.8, 1] }, shadow: { dx: 32, dy: 50, a: 0.3 }, sites: [[-30, -10], [30, -10], [0, 30], [0, -40]] },
  phases: [
    { name: 'INTERCEPT', hp: 290, move: { type: 'sweep', amp: 160, y: 140, freq: 0.011 }, patterns: ['missiles', 'guns'] },
    { name: 'FLARE BREAK', hp: 310, move: { type: 'figure8', amp: 140, ampY: 40, y: 150, freq: 0.013 }, patterns: ['flares', 'guns'] },
    { name: 'MERGE', hp: 350, move: { type: 'sweep', amp: 180, y: 140, freq: 0.014 }, intensity: 1.15, patterns: ['missiles', 'flares', 'guns'] },
  ],
  attacks: {
    missiles(c, w, t) { const k = t % 140; if (k < 30 && k % 10 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 60, c.e.y - 10, DOWN + s * 1.0, TE.missile.speed, TE.missile); },
    guns(c, w, t) { if (every(c, t, 50)) P.aimed(w, c.e.x, c.e.y + 60, TE.guns); },
    flares(c, w, t) { if (every(c, t, 85, 20)) P.ring(w, c.e.x, c.e.y - 40, TE.flares, w.rng.angle()); },
  },
});

export default [reconJet, heli, weatherDrone, gunship, escort];
