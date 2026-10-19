import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, shipHull, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, turret, weather } from '../roster/art.js';

// SEA — CORAL SIEGE (coastal missile battleship)
// A broad-beamed shore-bombardment battleship in faded tropical grey:
// three triple-gun turrets, armoured box launchers for cruise missiles
// along both beams and a tall pagoda bridge. It fights close to the coast
// and turns the shoreline into a target — walking barrages up the beach,
// missile arcs from the beam launchers and cruise missiles that hunt.
// Arenas: a tropical naval harbour → reef shallows → an island beachhead
// under bombardment → a lagoon fleet anchorage → a monsoon strait.

const S = {
  triple: { shape: 'orb', color: 'orange', n: 3, spread: 0.22, speed: 2.8 },
  tripleMk: { shape: 'orb', color: 'yellow', n: 3, spread: 0.12, speed: 3.4 },
  shore: { shape: 'orb', color: 'orange', n: 10, speed: 1.8 },
  boxR: { shape: 'kunai', color: 'red', n: 1, speed: 2.8, angVel: 0.016, fixed: true },
  boxL: { shape: 'kunai', color: 'red', n: 1, speed: 2.8, angVel: -0.016, fixed: true },
  cruise: { shape: 'bigorb', color: 'red', n: 1, speed: 1.1, homing: 0.02, homingTime: 160, accel: 0.012, maxSpd: 2.6, fixed: true, split: { shape: 'rice', color: 'orange', n: 14, speed: 2.1 }, splitAt: 170 },
  aa: { shape: 'rice', color: 'yellow', n: 4, spread: 0.5, speed: 3 },
  monsoon: { shape: 'rice', color: 'white', n: 3, speed: 3.2 },
};

const HL = 160, HW = 62;
const BOXES = [-40, -10, 20, 50];

const gunTurret = (oy, off, label) => ({
  label, sprite: 'cs_turret', ox: 0, oy, r: 16, hp: 110, medals: 4, score: 8000, bossDamage: 0.07, aim: true,
  attack(pe, c, w, t) {
    if (!every(c, t, 60, off)) return;
    P.aimed(w, pe.x, pe.y, c.mk >= 2 ? S.tripleMk : S.triple);
  },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.coastal, meta = { lights: [], treads: [], stacks: [], hw: HW, hl: HL, funnels: [] };
  const { path, lights } = shipHull(ctx, pal, HL * 2, HW * 2, 'coralsiege');
  meta.lights.push(...lights);
  weather(ctx, path, 0.45);
  // Rust streaks from the hawse pipes and scuppers.
  ctx.save(); path(); ctx.clip();
  for (let k = 0; k < 18; k++) { const s = k % 2 ? 1 : -1, y = -130 + k * 15; ctx.fillStyle = 'rgba(120,60,30,0.35)'; ctx.fillRect(s * (HW - 6) - 1, y, 2, 10 + (k % 3) * 4); }
  ctx.restore();
  // Teak deck strips fore and aft of the citadel.
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = 'rgba(150,120,80,0.55)'; ctx.fillRect(-HW, 60, HW * 2, 100); ctx.fillRect(-HW, -160, HW * 2, 60);
  ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 0.5;
  for (let x = -HW; x < HW; x += 4) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 160); ctx.moveTo(x, -160); ctx.lineTo(x, -100); ctx.stroke(); }
  ctx.restore();
  // Armoured box launchers along both beams.
  both((s) => { for (const y of BOXES) { ctx.beginPath(); ctx.rect(s * 44 - 9, y - 10, 18, 20); armour(ctx, pal, s * 44 - 9, s * 44 + 9); for (let k = 0; k < 2; k++) { ctx.fillStyle = '#141c1c'; ctx.fillRect(s * 44 - 6 + k * 7, y - 7, 5, 14); } } });
  // Pagoda bridge and twin funnels.
  ctx.beginPath(); ctx.rect(-26, 0, 52, 46); armour(ctx, pal, -26, 26, 2);
  ctx.beginPath(); ctx.rect(-18, 10, 36, 28); armour(ctx, pal, -18, 18);
  ctx.beginPath(); ctx.rect(-11, 18, 22, 14); armour(ctx, pal, -11, 11);
  for (let k = -3; k <= 3; k++) { ctx.fillStyle = 'rgba(30,50,60,0.9)'; ctx.fillRect(k * 5 - 1.8, 40, 3.6, 3); }
  for (const fy of [-22, -48]) { ctx.beginPath(); ctx.ellipse(0, fy, 11, 14, 0, 0, TAU); armour(ctx, pal, -11, 11); ctx.beginPath(); ctx.ellipse(0, fy - 2, 7, 9, 0, 0, TAU); ctx.fillStyle = '#0e1212'; ctx.fill(); meta.funnels.push([0, fy - 2]); }
  // Barbettes (turret rings) — the turrets themselves are breakable parts.
  for (const y of [110, 76, -100]) { circ(ctx, 0, y, 21); armour(ctx, pal, -21, 21); circ(ctx, 0, y, 17); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
  // AA gun tubs along the deck edge.
  both((s) => { for (const y of [-70, 64]) { circ(ctx, s * 50, y, 7); armour(ctx, pal, s * 50 - 7, s * 50 + 7); ctx.fillStyle = '#0a0e0e'; ctx.fillRect(s * 50 - 1, y, 2, 9); } });
  hazard(ctx, pal, -HW * 0.6, -150, HW * 1.2, 3);
  keyLight(ctx, -90, -180, 90, 180, 1);
  core(ctx, pal, 0, 24, 6, '#ff5a3a');
  both((s) => { glowDot(ctx, s * (HW - 4), 0, 2.4, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * (HW - 4), y: 0, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  return meta;
}

function turretArt(ctx, w, h) {
  const pal = PALS.coastal, cx = w / 2, cy = h * 0.36;
  for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.rect(cx + dx - 1.5, cy, 3, h * 0.64); armour(ctx, pal, cx + dx - 1.5, cx + dx + 1.5); ctx.fillStyle = '#050606'; ctx.fillRect(cx + dx - 1, h - 2, 2, 2); }
  ctx.beginPath(); ctx.moveTo(cx - w * 0.45, cy - h * 0.28); ctx.lineTo(cx + w * 0.45, cy - h * 0.28); ctx.lineTo(cx + w * 0.42, cy + h * 0.1); ctx.lineTo(cx - w * 0.42, cy + h * 0.1); ctx.closePath();
  armour(ctx, pal, 0, w);
  ctx.beginPath(); ctx.rect(cx - 4, cy - h * 0.22, 8, 4); ctx.fillStyle = '#1a2222'; ctx.fill();
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'coral_siege',
  name: 'CORAL SIEGE',
  title: 'COASTAL MISSILE BATTLESHIP',
  archetype: 'sea',
  sprite: 'b_coralsiege', scale: 1, r: 50, glow: [1, 0.55, 0.35], score: 150000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_coralsiege', 150, 350, hull('b_coralsiege', hullArt));
    add('cs_turret', 34, 40, turretArt, 2.5);
  },
  look: {
    faction: 'blacktide', anim: 'ship',
    weak: { x: 0, y: 24, r: 16, rgb: [1, 0.45, 0.3] },
    sites: [[-40, 20], [40, -40], [-20, 120], [24, -120], [-44, -80], [44, 90]],
  },
  parts: { turA: gunTurret(110, 0, 'A TURRET'), turB: gunTurret(76, 30, 'B TURRET'), turC: gunTurret(-100, 15, 'C TURRET') },
  desperation: { name: 'SCORCHED REEF' },

  phases: [
    {
      name: 'BOX LAUNCHERS', hp: 740, arena: 'cs_tropical_harbor', transitionFx: 'flash',
      move: { type: 'hover', amp: 60, y: 160, freq: 0.006 }, parts: ['turA', 'turB'],
      patterns: ['boxLaunchers', 'aaScreen'], musicLayer: 'sea_p1',
    },
    {
      name: 'SHORE BARRAGE', hp: 790, arena: 'cs_reef_shallows', transitionFx: 'water_flood',
      move: { type: 'sweep', amp: 70, y: 160, freq: 0.007 }, parts: ['turC'],
      patterns: ['shoreBarrage', 'cruise'], musicLayer: 'sea_p2',
    },
    {
      name: 'BEACH ASSAULT', hp: 840, arena: 'cs_island_beachhead', transitionFx: 'flash',
      move: { type: 'hover', amp: 70, y: 160, freq: 0.007 }, parts: ['turA', 'turB', 'turC'],
      patterns: ['shoreBarrage', 'boxLaunchers'], musicLayer: 'sea_p3',
    },
    {
      name: 'CRUISE MISSILES', hp: 880, arena: 'cs_lagoon_anchorage', transitionFx: 'water_flood',
      move: { type: 'figure8', amp: 70, ampY: 18, y: 160, freq: 0.007 },
      patterns: ['cruise', 'boxLaunchers', 'aaScreen'], musicLayer: 'sea_p4',
    },
    {
      name: 'MONSOON', hp: 960, arena: 'cs_monsoon_strait', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 90, y: 160, freq: 0.008 }, intensity: 1.1,
      patterns: ['shoreBarrage', 'cruise', 'boxLaunchers', 'monsoon'], musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    // Box launchers: missiles leave the beams sideways and curl in.
    boxLaunchers(c, w, t) {
      if (!every(c, t, 90, 20)) return;
      for (const y of BOXES) {
        P.shoot(w, c.e.x + 50, c.e.y + y, -0.2, S.boxR.speed, S.boxR);
        P.shoot(w, c.e.x - 50, c.e.y + y, Math.PI + 0.2, S.boxL.speed, S.boxL);
      }
    },
    // Shore barrage: a walking barrage — impact zones march up the screen.
    shoreBarrage(c, w, t) {
      const k = t % 240;
      if (k === 0) c.data.bx = clamp(w.aimX, 60, W - 60);
      if (k < 100 && k % 20 === 0) {
        const y = H - 60 - (k / 20) * 90;
        for (const s of [-1, 1]) artillery(c, c.data.bx + s * 60 + w.rng.range(-15, 15), y, 40, 50, c.mk >= 2 ? S.shore : null);
      }
    },
    // Cruise missiles: slow, hunting, and they burst if they run out of fuel.
    cruise(c, w, t) { if (every(c, t, 160, 40)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 44, c.e.y - 20, DOWN + s * 0.9, S.cruise.speed, S.cruise); },
    aaScreen(c, w, t) { if (every(c, t, 40)) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 50, c.e.y + 64, DOWN + s * 0.35, S.aa); },
    // Monsoon: rain squalls in sheets.
    monsoon(c, w, t) { if ((t % 180) < 100 && every(c, t, 6)) P.rain(w, S.monsoon); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.0012 + Math.sin(c.w.t * 0.018) * 0.008; },
};
