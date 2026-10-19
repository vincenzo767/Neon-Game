import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W, H } from '../util.js';
import { PALS, hull, shipHull, armour, both, keyLight, turret, weather, circ, rivetRow, hazard, glowDot } from '../roster/art.js';
import { mini } from './common.js';

// NAVAL mini-bosses — surface ships. They sit on the water (look anim
// 'ship': waterline foam, bow wave, wake decals, funnel smoke) and never
// leave it: a seized coast-guard cutter in the lagoon, an ice-class corvette
// in the pack ice, a submarine tender in the storm, a fire-support tug in
// the burning oil field and a destroyer in the storm surge.

const ship = (hw, hl) => ({ lights: [], hw, hl, funnels: [] });
const bridge = (ctx, pal, y, w, h) => {
  ctx.beginPath(); ctx.rect(-w / 2, y, w, h); armour(ctx, pal, -w / 2, w / 2, 2);
  for (let k = -2; k <= 2; k++) { ctx.fillStyle = 'rgba(30,50,70,0.95)'; ctx.fillRect(k * (w / 6) - 1.4, y + h - 4, 2.8, 2.2); }
};
const funnel = (ctx, pal, m, y, rx = 7, ry = 9) => {
  ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); armour(ctx, pal, -rx, rx);
  ctx.beginPath(); ctx.ellipse(0, y - 1, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = '#0c1014'; ctx.fill();
  m.funnels.push([0, y - 1]);
};
const navLights = (ctx, m, hw, y = 0) => both((s) => { glowDot(ctx, s * (hw - 3), y, 1.8, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); m.lights.push({ x: s * (hw - 3), y, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });

// =================================================================== CUTTER

const CU = {
  bow: { shape: 'orb', color: 'orange', n: 1, speed: 3.2, layers: 4, dSpeed: 0.35, fixed: true },
  fan: { shape: 'rice', color: 'yellow', n: 7, spread: 0.8, speed: 2.5 },
  dc: { shape: 'orb', color: 'white', n: 10, speed: 1.6 },
};

function cutterArt(ctx) {
  const pal = PALS.coastal, m = ship(20, 66);
  const { path, lights } = shipHull(ctx, pal, 132, 40, 'mb_cutter');
  m.lights.push(...lights);
  weather(ctx, path, 0.35);
  // Faded white hull band with the seized coast-guard racing stripe painted over.
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = 'rgba(230,236,232,0.35)'; ctx.fillRect(-20, -66, 40, 132);
  ctx.fillStyle = 'rgba(200,60,30,0.6)'; ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-30, 18, 60, 6); ctx.restore(); ctx.restore();
  bridge(ctx, pal, 4, 26, 22);
  funnel(ctx, pal, m, -16);
  turret(ctx, pal, 0, 38, 7, 1, 18, 3);
  ctx.beginPath(); ctx.rect(-12, -52, 24, 20); armour(ctx, pal, -12, 12); // boat deck / RHIB davit
  ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.roundRect(-6, -50, 12, 16, 5); ctx.fill();
  navLights(ctx, m, 20, 10);
  keyLight(ctx, -20, -66, 20, 66);
  return m;
}

const cutter = mini({
  id: 'mb_patrol_cutter', name: 'RED HERON', title: 'SEIZED COAST-GUARD CUTTER', archetype: 'sea',
  sprite: 'mb_patrol_cutter', r: 30, deathSequence: 'sink_and_explode',
  art(add) { add('mb_patrol_cutter', 48, 140, hull('mb_patrol_cutter', cutterArt)); },
  look: { faction: 'blacktide', anim: 'ship', weak: { x: 0, y: 14, r: 12, rgb: [1, 0.55, 0.3] }, sites: [[0, 40], [0, -30], [-10, 10], [10, -50]] },
  phases: [
    { name: 'BOARDING PATROL', hp: 270, move: { type: 'sweep', amp: 150, y: 160, freq: 0.008 }, patterns: ['bowGun', 'fan'] },
    { name: 'DEPTH CHARGES', hp: 290, move: { type: 'hover', amp: 120, y: 150 }, patterns: ['charges', 'bowGun'] },
    { name: 'FLANK SPEED', hp: 320, move: { type: 'sweep', amp: 170, y: 160, freq: 0.011 }, intensity: 1.15, patterns: ['bowGun', 'fan', 'charges'] },
  ],
  attacks: {
    bowGun(c, w, t) { if (every(c, t, 46)) P.stack(w, c.e.x, c.e.y + 56, w.aimAngle(c.e.x, c.e.y + 56), CU.bow); },
    fan(c, w, t) { if (every(c, t, 70, 30)) P.aimed(w, c.e.x, c.e.y + 20, CU.fan); },
    charges(c, w, t) { if (every(c, t, 110)) for (let k = 0; k < 3; k++) artillery(c, clamp(w.aimX + (k - 1) * 90, 40, W - 40), w.aimY - 20 + w.rng.range(-40, 40), 40, 70 + k * 12, CU.dc); },
  },
});

// ============================================================ ICE CORVETTE

const IC = {
  icicle: { shape: 'rice', color: 'cyan', n: 2, speed: 2.8 },
  triple: { shape: 'orb', color: 'blue', n: 3, spread: 0.25, speed: 3 },
  shatter: { shape: 'bigorb', color: 'white', n: 1, speed: 2.4, accel: -0.03, minSpd: 0.2, splitAt: 60, fixed: true, split: { shape: 'rice', color: 'cyan', n: 12, speed: 2.2 } },
};

function iceCorvetteArt(ctx) {
  const pal = PALS.frost, m = ship(24, 72);
  const { path, lights } = shipHull(ctx, pal, 144, 48, 'mb_icecorvette');
  m.lights.push(...lights);
  weather(ctx, path, 0.25);
  // Ice-strengthened bow belt (red), rime on the foredeck.
  ctx.save(); path(); ctx.clip(); ctx.fillStyle = 'rgba(170,40,40,0.55)'; ctx.fillRect(-24, 50, 48, 22);
  for (let k = 0; k < 30; k++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(((k * 23) % 44) - 22, 20 + ((k * 13) % 50), 3, 1.5); } ctx.restore();
  bridge(ctx, pal, 2, 30, 26);
  funnel(ctx, pal, m, -22, 8, 10);
  turret(ctx, pal, 0, 44, 9, 1, 20, 3);
  turret(ctx, pal, 0, -52, 7, 2, 12, 2);
  both((s) => { circ(ctx, s * 16, -36, 6); armour(ctx, pal, s * 16 - 6, s * 16 + 6); });
  hazard(ctx, pal, -16, -68, 32, 3);
  navLights(ctx, m, 24, 10);
  keyLight(ctx, -24, -72, 24, 72);
  return m;
}

const iceCorvette = mini({
  id: 'mb_ice_corvette', name: 'KOLA', title: 'ICE-CLASS CORVETTE', archetype: 'sea',
  sprite: 'mb_ice_corvette', r: 32, deathSequence: 'sink_and_explode',
  art(add) { add('mb_ice_corvette', 56, 152, hull('mb_ice_corvette', iceCorvetteArt)); },
  look: { faction: 'blacktide', anim: 'ship', weak: { x: 0, y: 14, r: 13, rgb: [0.5, 0.85, 1] }, sites: [[0, 44], [0, -50], [-12, 0], [12, 20]] },
  phases: [
    { name: 'ICE LEAD', hp: 280, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['triple', 'icicles'] },
    { name: 'FROST SHELLS', hp: 300, move: { type: 'sweep', amp: 140, y: 160, freq: 0.007 }, patterns: ['shatter', 'triple'] },
    { name: 'POLAR SQUALL', hp: 330, move: { type: 'figure8', amp: 120, ampY: 24, y: 160 }, intensity: 1.15, patterns: ['icicles', 'shatter', 'triple'] },
  ],
  attacks: {
    triple(c, w, t) { if (every(c, t, 40)) P.aimed(w, c.e.x, c.e.y + 64, IC.triple); },
    icicles(c, w, t) { if ((t % 160) < 90 && every(c, t, 7)) P.rain(w, IC.icicle); },
    shatter(c, w, t) { if (every(c, t, 80, 20)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 16, c.e.y - 36, DOWN + s * 0.5, IC.shatter.speed, IC.shatter); },
  },
});

// ============================================================== SUB TENDER

const ST = {
  torp: { shape: 'kunai', color: 'cyan', n: 1, speed: 5.2, fixed: true },
  spiral: { shape: 'orb', color: 'blue', n: 4, speed: 2.2, turn: 0.2 },
  aimed: { shape: 'rice', color: 'cyan', n: 5, spread: 0.5, speed: 2.8 },
};

function tenderArt(ctx) {
  const pal = PALS.sub, m = ship(28, 78);
  const { path, lights } = shipHull(ctx, pal, 156, 56, 'mb_tender');
  m.lights.push(...lights);
  weather(ctx, path, 0.4);
  // Long open well deck with a midget submarine cradled in it, crane aft.
  ctx.beginPath(); ctx.rect(-18, -10, 36, 64); ctx.fillStyle = '#0a0e10'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 22, 9, 28, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, '#060808'); g.addColorStop(0.5, '#3a464c'); g.addColorStop(1, '#060808');
  ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 14, 4, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#20282c'; ctx.fill();
  rivetRow(ctx, pal, -16, -8, 16, -8, 4);
  bridge(ctx, pal, -44, 34, 26);
  funnel(ctx, pal, m, -58, 8, 9);
  ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(10, 10); ctx.stroke(); // crane jib
  turret(ctx, pal, 0, 64, 6, 2, 12, 2);
  navLights(ctx, m, 28, -30);
  keyLight(ctx, -28, -78, 28, 78);
  return m;
}

const tender = mini({
  id: 'mb_sub_tender', name: 'UNDERTOW', title: 'SUBMARINE TENDER', archetype: 'sea',
  sprite: 'mb_sub_tender', r: 34, deathSequence: 'sink_and_explode',
  art(add) { add('mb_sub_tender', 64, 164, hull('mb_sub_tender', tenderArt)); },
  look: { faction: 'blacktide', anim: 'ship', weak: { x: 0, y: 22, r: 13, rgb: [0.3, 1, 0.8] }, sites: [[0, -40], [0, 50], [-14, 10], [14, -10]] },
  phases: [
    { name: 'TORPEDO SCREEN', hp: 290, move: { type: 'hover', amp: 100, y: 160 }, patterns: ['torpedoes', 'aimed'] },
    { name: 'WOLFPACK', hp: 310, move: { type: 'sweep', amp: 140, y: 160, freq: 0.007 }, patterns: ['spiral', 'torpedoes'] },
    { name: 'CRASH DIVE', hp: 340, move: { type: 'hover', amp: 130, y: 155 }, intensity: 1.15, patterns: ['torpedoes', 'spiral', 'aimed'] },
  ],
  attacks: {
    // Torpedo lanes: the tracks are marked on the water, then fast torpedoes run up them from below.
    torpedoes(c, w, t) {
      if (!every(c, t, 130)) return;
      const xs = [clamp(w.aimX, 50, W - 50), w.rng.range(40, W - 40)];
      for (const x of xs) c.kit.hazard({ type: 'lane', x, w: 20, warn: 55, fire: 1, lethal: false, color: [0.4, 0.9, 1],
        onFire: (h, ww) => { for (let k = 0; k < 4; k++) P.shoot(ww, h.x, H + 10 + k * 26, -Math.PI / 2, ST.torp.speed, ST.torp); } });
    },
    spiral(c, w, t) { if ((t % 150) < 80 && every(c, t, 5)) P.spiral(w, c.e, ST.spiral); },
    aimed(c, w, t) { if (every(c, t, 56, 10)) P.aimed(w, c.e.x, c.e.y + 70, ST.aimed); },
  },
});

// ================================================================ FIRE TUG

const FT = {
  oil: { shape: 'orb', color: 'orange', n: 3, speed: 2.2, turn: 0.17 },
  flame: { shape: 'rice', color: 'red', n: 1, speed: 3.6, fixed: true },
  slick: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.4, accel: -0.02, minSpd: 0, splitAt: 90, fixed: true, split: { shape: 'orb', color: 'red', n: 10, speed: 1.8 } },
};

function tugArt(ctx) {
  const pal = PALS.oil, m = ship(30, 58);
  const { path, lights } = shipHull(ctx, pal, 116, 60, 'mb_tug');
  m.lights.push(...lights);
  weather(ctx, path, 0.5);
  // Fat tyre fenders around the hull, a high wheelhouse, fire monitors.
  ctx.save(); path(); ctx.lineWidth = 5; ctx.strokeStyle = '#141414'; ctx.stroke(); ctx.restore();
  bridge(ctx, pal, -10, 34, 34);
  ctx.fillStyle = '#c8a020'; ctx.fillRect(-17, -10, 34, 3);
  funnel(ctx, pal, m, -34, 9, 10);
  both((s) => { circ(ctx, s * 12, 40, 6); armour(ctx, pal, s * 12 - 6, s * 12 + 6); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(s * 12 - 1.5, 40, 3, 12); });
  circ(ctx, 0, 30, 5); armour(ctx, pal, -5, 5); // bow monitor
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -58); ctx.stroke(); // towing hook
  navLights(ctx, m, 30, 0);
  keyLight(ctx, -30, -58, 30, 58);
  return m;
}

const tug = mini({
  id: 'mb_fire_tug', name: 'CINDERHAUL', title: 'FIRE-SUPPORT TUG', archetype: 'sea',
  sprite: 'mb_fire_tug', r: 32, deathSequence: 'sink_and_explode',
  art(add) { add('mb_fire_tug', 68, 124, hull('mb_fire_tug', tugArt)); },
  look: { faction: 'blacktide', anim: 'ship', weak: { x: 0, y: 6, r: 13, rgb: [1, 0.5, 0.15] }, sites: [[0, 30], [0, -30], [-14, 0], [14, 10]] },
  phases: [
    { name: 'OIL SPRAY', hp: 290, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['spray', 'monitors'] },
    { name: 'SLICK FIRE', hp: 310, move: { type: 'sweep', amp: 140, y: 160, freq: 0.008 }, patterns: ['slicks', 'monitors'] },
    { name: 'FIRESTORM', hp: 340, move: { type: 'hover', amp: 130, y: 155 }, intensity: 1.15, patterns: ['spray', 'slicks', 'monitors'] },
  ],
  attacks: {
    spray(c, w, t) { if ((t % 140) < 90 && every(c, t, 5)) P.spiral(w, c.e, FT.oil); },
    monitors(c, w, t) { if ((t % 100) < 36 && t % 3 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 12, c.e.y + 46, w.aimAngle(c.e.x, c.e.y) + s * 0.12 + Math.sin(t * 0.15) * 0.15, FT.flame.speed, FT.flame); },
    slicks(c, w, t) { if (every(c, t, 70, 20)) for (const a of [-0.6, 0, 0.6]) P.shoot(w, c.e.x, c.e.y + 30, DOWN + a, FT.slick.speed, FT.slick); },
  },
});

// =============================================================== DESTROYER

const DE = {
  twin: { shape: 'rice', color: 'orange', n: 9, spread: 0.9, speed: 2.5 },
  missile: { shape: 'kunai', color: 'red', n: 1, speed: 1.4, accel: 0.035, maxSpd: 3.8, homing: 0.03, homingTime: 70, fixed: true },
  aa: { shape: 'orb', color: 'yellow', n: 18, speed: 2.4, gap: 2 },
};

function destroyerArt(ctx) {
  const pal = PALS.navy, m = ship(26, 92);
  const { path, lights } = shipHull(ctx, pal, 184, 52, 'mb_destroyer');
  m.lights.push(...lights);
  weather(ctx, path, 0.35);
  bridge(ctx, pal, 18, 32, 28);
  funnel(ctx, pal, m, -6, 8, 11);
  funnel(ctx, pal, m, -34, 7, 9);
  turret(ctx, pal, 0, 62, 10, 2, 20, 3);
  turret(ctx, pal, 0, -66, 10, 2, 18, 3);
  // Vertical launch cells forward of the bridge.
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { ctx.fillStyle = '#20262c'; ctx.fillRect(-12 + k * 6.4, 46 + r * 6.4, 5.2, 5.2); }
  both((s) => { ctx.beginPath(); ctx.rect(s * 18 - 4, -24, 8, 22); armour(ctx, pal, s * 18 - 4, s * 18 + 4); }); // torpedo mounts
  ctx.fillStyle = '#e8e8e0'; ctx.fillRect(-14, -88, 28, 2); ctx.fillRect(-1, -86, 2, 12); // helideck H
  navLights(ctx, m, 26, 20);
  keyLight(ctx, -26, -92, 26, 92);
  return m;
}

const destroyer = mini({
  id: 'mb_destroyer', name: 'STORMBREAKER', title: 'GUIDED-MISSILE DESTROYER', archetype: 'sea',
  sprite: 'mb_destroyer', r: 36, deathSequence: 'sink_and_explode',
  art(add) { add('mb_destroyer', 60, 192, hull('mb_destroyer', destroyerArt)); },
  look: { faction: 'blacktide', anim: 'ship', weak: { x: 0, y: 30, r: 14, rgb: [1, 0.5, 0.25] }, sites: [[0, 62], [0, -66], [-14, 0], [14, -30], [0, 30]] },
  phases: [
    { name: 'GUN LINE', hp: 300, move: { type: 'hover', amp: 110, y: 170 }, patterns: ['twins', 'aa'] },
    { name: 'MISSILE SALVO', hp: 320, move: { type: 'sweep', amp: 140, y: 170, freq: 0.007 }, patterns: ['missiles', 'twins'] },
    { name: 'CROSSING THE T', hp: 360, move: { type: 'sweep', amp: 160, y: 170, freq: 0.01 }, intensity: 1.15, patterns: ['twins', 'missiles', 'aa'] },
  ],
  attacks: {
    twins(c, w, t) { if (every(c, t, 60)) { P.aimed(w, c.e.x, c.e.y + 80, DE.twin); P.fan(w, c.e.x, c.e.y - 80, DOWN, DE.twin); } },
    missiles(c, w, t) { const k = t % 170; if (k < 40 && k % 5 === 0) { const s = (k / 5) % 2 ? 1 : -1; P.shoot(w, c.e.x + s * 8, c.e.y + 50, -Math.PI / 2 + s * 0.5, DE.missile.speed, DE.missile); } },
    aa(c, w, t) { if (every(c, t, 90, 40)) P.ring(w, c.e.x, c.e.y, DE.aa, w.rng.angle()); },
  },
});

export default [cutter, iceCorvette, tender, tug, destroyer];
