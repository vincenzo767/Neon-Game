import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, shipHull, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, turret, weather, camo } from '../roster/art.js';

// SEA — WHITEOUT BREAKER (arctic warship)
// A polar battlecruiser built on an icebreaker hull: a red-belted, rounded
// ice bow, a twin forward gun house, vertical-launch cells amidships, a
// squat funnel, radar mast and a helicopter deck aft. It cuts its own lead
// through the pack ice — shattering floes into shard fans — and fights from
// the lead it opens.
// Arenas: a pack-ice lead → an iced-in naval harbour → iceberg alley →
// a polar gale → the collapsing ice shelf.

const S = {
  gun: { shape: 'orb', color: 'blue', n: 2, spread: 0.12, speed: 3.2 },
  ciws: { shape: 'rice', color: 'cyan', n: 1, speed: 4.2, fixed: true },
  vls: { shape: 'kunai', color: 'white', n: 1, speed: 2.4, homing: 0.07, homingTime: 80, accel: 0.03, maxSpd: 4.2, fixed: true },
  shard: { shape: 'kunai', color: 'cyan', n: 9, spread: 1.6, speed: 2.6 },
  floe: { shape: 'bigorb', color: 'white', n: 1, speed: 0.9, fixed: true, scale: 1.4, radius: 10 },
  depth: { shape: 'bigorb', color: 'blue', n: 1, speed: 1.6, accel: -0.03, minSpd: 0.2, fixed: true, split: { shape: 'orb', color: 'cyan', n: 12, speed: 2 }, splitAt: 70 },
  calve: { shape: 'orb', color: 'white', n: 14, speed: 1.5, gap: 1 },
  spray: { shape: 'rice', color: 'blue', n: 2, speed: 2.4 },
};

const HL = 150, HW = 52;

const foreTurret = {
  label: 'FORE GUN HOUSE', sprite: 'wb_turret', ox: 0, oy: 80, r: 15, hp: 110, medals: 4, score: 8000, bossDamage: 0.08, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 45)) P.aimed(w, pe.x, pe.y, S.gun); },
};
const ciws = (ox, off) => ({
  label: 'CIWS MOUNT', sprite: 'wb_ciws', ox, oy: -10, r: 11, hp: 70, medals: 3, score: 5000, bossDamage: 0.05, aim: true,
  attack(pe, c, w, t) { if ((t + off) % 110 < 40 && every(c, t, 5, off)) P.aimed(w, pe.x, pe.y, S.ciws, w.rng.range(-0.08, 0.08)); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.frost, meta = { lights: [], treads: [], stacks: [], hw: HW, hl: HL, funnels: [] };
  // Red anti-fouling ice belt showing at the bow (drawn first, under the hull).
  ctx.beginPath(); ctx.ellipse(0, HL - 34, HW * 0.92, 44, 0, 0, Math.PI); ctx.fillStyle = '#7a1e18'; ctx.fill();
  const { path, lights } = shipHull(ctx, pal, HL * 2, HW * 2, 'whiteout');
  meta.lights.push(...lights);
  camo(ctx, path, ['#e8eef4', '#9aa6b4', '#5a6674', '#c4ccd6'], 17, 30, 22);
  weather(ctx, path, 0.35);
  // Rounded icebreaker bow plating and ice-knife.
  ctx.beginPath(); ctx.moveTo(-HW * 0.6, HL - 40); ctx.quadraticCurveTo(0, HL + 14, HW * 0.6, HL - 40); ctx.lineWidth = 3; ctx.strokeStyle = '#8a2a20'; ctx.stroke();
  ctx.beginPath(); ctx.rect(-2, HL - 30, 4, 28); armour(ctx, { plate: ['#2a1010', '#8a3a30', '#c86a60'] }, -2, 2);
  // Snow and ice crusted on the foredeck.
  ctx.save(); path(); ctx.clip();
  for (let k = 0; k < 30; k++) { const x = ((k * 37) % 90) - 45, y = HL - 60 + ((k * 53) % 70) - 30; ctx.fillStyle = `rgba(240,246,252,${0.25 + (k % 4) * 0.08})`; ctx.beginPath(); ctx.ellipse(x, y, 6 + (k % 5) * 2, 3 + (k % 3), k, 0, TAU); ctx.fill(); }
  ctx.restore();
  // Vertical launch cells (two blocks of 4x4).
  for (const by of [32, -2]) {
    ctx.beginPath(); ctx.rect(-26, by - 14, 52, 28); armour(ctx, pal, -26, 26);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = '#20262e'; ctx.fillRect(-23 + i * 8, by - 11 + j * 8, 6, 6); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.strokeRect(-23 + i * 8, by - 11 + j * 8, 6, 6); }
  }
  // Superstructure: bridge block with windows, then the funnel.
  ctx.beginPath(); ctx.rect(-30, -50, 60, 34); armour(ctx, pal, -30, 30, 2);
  for (let k = -5; k <= 5; k++) { ctx.fillStyle = 'rgba(30,50,70,0.95)'; ctx.fillRect(k * 5 - 1.8, -20, 3.6, 3); }
  ctx.beginPath(); ctx.roundRect(-14, -78, 28, 22, 6); armour(ctx, { plate: ['#2a2a2a', '#c8c8c8', '#f4f4f4'] }, -14, 14);
  ctx.fillStyle = '#c82a20'; ctx.fillRect(-14, -66, 28, 4);
  ctx.beginPath(); ctx.ellipse(0, -72, 8, 5, 0, 0, TAU); ctx.fillStyle = '#121212'; ctx.fill();
  meta.funnels.push([0, -72]);
  // Radar mast and dome.
  circ(ctx, 0, -36, 9); armour(ctx, pal, -9, 9);
  ctx.strokeStyle = '#2a3038'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-16, -36); ctx.lineTo(16, -36); ctx.stroke();
  // Helicopter deck aft.
  ctx.beginPath(); ctx.rect(-36, -136, 72, 50); ctx.fillStyle = '#3a4048'; ctx.fill();
  ctx.strokeStyle = 'rgba(240,240,240,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -112, 16, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(240,240,240,0.7)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, -112);
  hazard(ctx, pal, -36, -88, 72, 3);
  // Depth-charge rails at the stern.
  both((s) => { ctx.fillStyle = '#20262e'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(s * (24 + k * 4), -142, 2.6, 0, TAU); ctx.fill(); } });
  keyLight(ctx, -80, -170, 80, 170, 1);
  core(ctx, pal, 0, -2, 6, '#5ad0ff');
  both((s) => { glowDot(ctx, s * (HW - 4), 10, 2.4, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * (HW - 4), y: 10, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  meta.lights.push({ x: 0, y: -36, c: '#ffffff', ph: 0.5 });
  return meta;
}

function turretArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2, cy = h * 0.38;
  for (const dx of [-4, 4]) { ctx.beginPath(); ctx.rect(cx + dx - 1.6, cy, 3.2, h * 0.62); armour(ctx, pal, cx + dx - 1.6, cx + dx + 1.6); }
  ctx.beginPath(); ctx.moveTo(cx - w * 0.42, cy - h * 0.25); ctx.lineTo(cx + w * 0.42, cy - h * 0.25); ctx.lineTo(cx + w * 0.34, cy + h * 0.12); ctx.lineTo(cx - w * 0.34, cy + h * 0.12); ctx.closePath();
  armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

function ciwsArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2, cy = h * 0.42;
  ctx.beginPath(); ctx.rect(cx - 1.4, cy, 2.8, h * 0.58); armour(ctx, pal, cx - 1.4, cx + 1.4);
  ctx.beginPath(); ctx.roundRect(cx - w * 0.36, cy - h * 0.3, w * 0.72, h * 0.5, w * 0.3); armour(ctx, { plate: ['#6a7480', '#e8eef4', '#ffffff'] }, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'whiteout_breaker',
  name: 'WHITEOUT BREAKER',
  title: 'ARCTIC WARSHIP',
  archetype: 'sea',
  sprite: 'b_whiteout', scale: 1, r: 46, glow: [0.6, 0.9, 1], score: 150000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_whiteout', 130, 330, hull('b_whiteout', hullArt));
    add('wb_turret', 30, 34, turretArt, 2.5);
    add('wb_ciws', 20, 24, ciwsArt, 2.5);
  },
  look: {
    faction: 'blacktide', anim: 'ship',
    weak: { x: 0, y: -2, r: 16, rgb: [0.5, 0.85, 1] },
    sites: [[-30, 40], [30, -30], [-10, 100], [20, -110], [-36, -60], [36, 70]],
  },
  parts: { fore: foreTurret, ciwsL: ciws(-40, 0), ciwsR: ciws(40, 55) },
  desperation: { name: 'WHITEOUT' },

  phases: [
    {
      name: 'ICE BREAKING', hp: 720, arena: 'wb_pack_ice', transitionFx: 'flash',
      move: { type: 'hover', amp: 70, y: 150, freq: 0.007 }, parts: ['fore'],
      patterns: ['iceBreak', 'vls'], musicLayer: 'sea_p1',
    },
    {
      name: 'DEPTH CHARGES', hp: 770, arena: 'wb_frozen_harbor', transitionFx: 'ice_crack',
      move: { type: 'sweep', amp: 80, y: 150, freq: 0.008 }, parts: ['ciwsL', 'ciwsR'],
      patterns: ['depthCharges', 'floes'], musicLayer: 'sea_p2',
    },
    {
      name: 'MISSILE CELLS', hp: 820, arena: 'wb_iceberg_alley', transitionFx: 'ice_crack',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 150, freq: 0.008 }, parts: ['fore', 'ciwsL', 'ciwsR'],
      patterns: ['vls', 'iceBreak', 'floes'], musicLayer: 'sea_p3',
    },
    {
      name: 'POLAR GALE', hp: 860, arena: 'wb_polar_gale', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 90, y: 150, freq: 0.009 },
      patterns: ['depthCharges', 'gale', 'vls'], musicLayer: 'sea_p4',
    },
    {
      name: 'CALVING ICE', hp: 940, arena: 'wb_shelf_collapse', transitionFx: 'ice_crack',
      move: { type: 'hover', amp: 100, y: 150, freq: 0.01 }, intensity: 1.1,
      patterns: ['iceBreak', 'calving', 'vls', 'depthCharges'], musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    // Ice break: the bow smashes a floe — a shard fan, plus spray.
    iceBreak(c, w, t) {
      if (every(c, t, 70)) { P.fan(w, c.e.x, c.e.y + HL, DOWN + Math.sin(t * 0.02) * 0.3, S.shard); w.g.camera.addTrauma(0.05); }
      if (c.mk >= 2 && every(c, t, 35, 17)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 30, c.e.y + HL - 20, DOWN + s * 0.9, 2.2, S.spray);
    },
    // Vertical launch: missiles climb out of the cells, then turn on the player.
    vls(c, w, t) {
      if (!every(c, t, 110, 20)) return;
      const n = c.mk >= 2 ? 6 : 4;
      for (let k = 0; k < n; k++) P.shoot(w, c.e.x + (k % 3 - 1) * 14, c.e.y + 20 - (k >> 1) * 6, -Math.PI / 2 + (k - (n - 1) / 2) * 0.22, S.vls.speed, S.vls);
    },
    depthCharges(c, w, t) {
      if (every(c, t, 80, 10)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 28, c.e.y - HL + 10, DOWN + s * 1.1, S.depth.speed, S.depth);
    },
    // Floes: big slabs of ice drift across the lead — cover and obstacle.
    floes(c, w, t) {
      if (every(c, t, 60)) {
        const s = w.rng.sign();
        P.shoot(w, s > 0 ? -12 : W + 12, w.rng.range(H * 0.3, H * 0.85), s > 0 ? 0.04 : Math.PI - 0.04, S.floe.speed, S.floe);
      }
    },
    // Polar gale: spray driven sideways by the wind.
    gale(c, w, t) {
      if (every(c, t, 5) && (t % 220) < 140) P.shoot(w, -8, w.rng.range(20, H * 0.75), 0.18 + w.rng.range(-0.06, 0.06), 2.6, S.spray);
    },
    // Calving: the shelf face breaks — walls of ice fall with a gap.
    calving(c, w, t) { if (every(c, t, 130, 60)) { P.curtain(w, S.calve); w.g.camera.addTrauma(0.1); } },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.0015 + Math.sin(c.w.t * 0.02) * 0.01; },
};
