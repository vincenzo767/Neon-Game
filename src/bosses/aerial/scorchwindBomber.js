import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W, H } from '../util.js';
import { PALS, hull, wing, nozzles, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, canopy, turret, weather } from '../roster/art.js';

// AERIAL — SCORCHWIND BOMBER (heavy bombardment aircraft)
// A huge, slow strategic bomber: long straight wings carrying eight
// podded engines, a glazed nose, defensive gun turrets and a bomb bay
// that runs half the fuselage. It does not dodge — it flies its bomb run
// and drops everything. Carpet-bombing lines walk across the screen, while
// the turrets keep the player honest.
// Arenas: a desert canyon at low level → a refinery it set alight → a
// carpet-bombed town → the top of a dust storm → a firestorm sunset.

const S = {
  turret: { shape: 'orb', color: 'orange', n: 3, spread: 0.2, speed: 3 },
  bomb: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.2, accel: 0.02, maxSpd: 2.2, fixed: true, split: { shape: 'orb', color: 'red', n: 8, speed: 1.6 }, splitAt: 80 },
  incend: { shape: 'rice', color: 'orange', n: 1, speed: 1.6, accel: -0.01, minSpd: 0.8, fixed: true },
  flare: { shape: 'orb', color: 'yellow', n: 1, speed: 2.4, accel: -0.04, minSpd: 0.5, fixed: true },
  ring: { shape: 'orb', color: 'red', n: 10, speed: 1.8 },
  tail: { shape: 'rice', color: 'yellow', n: 5, spread: 0.6, speed: 2.6 },
  heat: { shape: 'rice', color: 'orange', n: 2, speed: 2.3 },
};

const ENGINES = [-150, -112, -74, -42, 42, 74, 112, 150];

const gunTurret = (ox, oy, off, label) => ({
  label, sprite: 'sc_turret', ox, oy, r: 12, hp: 80, medals: 3, score: 6000, bossDamage: 0.06, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 40, off)) P.aimed(w, pe.x, pe.y, S.turret); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.bomber, meta = { lights: [], treads: [], stacks: [], fans: [] };
  // Long, straight high-aspect wings with slight sweep.
  const wingPts = [0, 10, 60, 6, 172, -14, 178, -4, 176, 4, 60, 34, 0, 36];
  meta.lights.push(...wing(ctx, pal, wingPts, 'scorch_w', { lights: 2 }));
  weather(ctx, () => mpoly(ctx, wingPts), 0.35);
  // Fuel tanks under the wingtips.
  both((s) => { ctx.beginPath(); ctx.ellipse(s * 172, -2, 5, 16, 0, 0, Math.PI * 2); armour(ctx, pal, s * 172 - 5, s * 172 + 5); });
  // Engine pods (paired) hanging ahead of the wing.
  for (const x of ENGINES) {
    ctx.beginPath(); ctx.roundRect(x - 6, 6, 12, 40, 5); armour(ctx, pal, x - 6, x + 6);
    circ(ctx, x, 44, 5); ctx.fillStyle = '#121010'; ctx.fill();
    (meta.nozzles = meta.nozzles || []).push([x, 6]);
  }
  // Tailplane and fin.
  const tail = [0, -112, 20, -112, 58, -124, 60, -114, 22, -96, 0, -94];
  meta.lights.push(...wing(ctx, pal, tail, 'scorch_t', { lights: 0 }));
  ctx.beginPath(); ctx.rect(-3, -130, 6, 40); armour(ctx, pal, -3, 3);
  // Fuselage: long tube, glazed nose, bomb bay doors.
  const fus = [0, 116, 10, 108, 16, 90, 18, 40, 18, -90, 12, -118, 0, -124];
  const path = () => mpoly(ctx, fus);
  path(); armour(ctx, pal, -18, 18, 2);
  weather(ctx, path, 0.3);
  rivetRow(ctx, pal, -12, 90, -12, -100, 7); rivetRow(ctx, pal, 12, 90, 12, -100, 7);
  ctx.beginPath(); ctx.rect(-9, -40, 18, 64); ctx.fillStyle = '#1a1612'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, 24); ctx.stroke();
  hazard(ctx, pal, -9, -44, 18, 4);
  // Glazed bombardier nose and cockpit windows.
  canopy(ctx, 0, 104, 9, 12, '#ffffff', '#c8b890', '#2a2010');
  for (let k = -2; k <= 2; k++) { ctx.fillStyle = '#1a2a34'; ctx.fillRect(k * 4 - 1.5, 84, 3, 5); }
  // Nose art stripe / unit markings.
  ctx.fillStyle = 'rgba(160,40,20,0.85)'; ctx.fillRect(-18, 60, 36, 4);
  // Tail gun position.
  turret(ctx, pal, 0, -120, 6, 2, 10, 1.6);
  vent(ctx, pal, -8, 30, 16, 14, 0.2, false);
  keyLight(ctx, -190, -140, 190, 130, 1);
  core(ctx, pal, 0, -60, 7, '#ff8a2a');
  both((s) => { glowDot(ctx, s * 178, 0, 2.8, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * 178, y: 0, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  lamp(ctx, 0, 40, '#ff4a2a', 1.5); meta.lights.push({ x: 0, y: 40, c: '#ff4a2a', ph: 0.5 });
  return meta;
}

function turretArt(ctx, w, h) {
  const pal = PALS.bomber, cx = w / 2, cy = h * 0.45;
  for (const dx of [-3, 3]) { ctx.beginPath(); ctx.rect(cx + dx - 1, cy, 2, h * 0.55); armour(ctx, pal, cx + dx - 1, cx + dx + 1); }
  circ(ctx, cx, cy, w * 0.36); armour(ctx, pal, 0, w);
  circ(ctx, cx, cy - 2, w * 0.2); ctx.fillStyle = 'rgba(160,200,220,0.7)'; ctx.fill();
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'scorchwind_bomber',
  name: 'SCORCHWIND BOMBER',
  title: 'HEAVY BOMBARDMENT AIRCRAFT',
  archetype: 'aerial',
  sprite: 'b_scorchwind', scale: 1, r: 50, glow: [1, 0.6, 0.3], score: 150000,
  deathSequence: 'spin_out',
  art(add) {
    add('b_scorchwind', 368, 268, hull('b_scorchwind', hullArt));
    add('sc_turret', 22, 26, turretArt, 2.5);
  },
  look: {
    faction: 'stratos', anim: 'carrier',
    weak: { x: 0, y: -60, r: 18, rgb: [1, 0.55, 0.2] },
    shadow: { dx: 40, dy: 60, a: 0.32 },
    sites: [[-112, 20], [112, 20], [-10, 60], [10, -80], [-150, 10], [150, 10]],
  },
  parts: {
    dorsal: gunTurret(0, 40, 0, 'DORSAL TURRET'),
    chinL: gunTurret(-30, 70, 20, 'CHIN TURRET'), chinR: gunTurret(30, 70, 0, 'CHIN TURRET'),
    tail: { ...gunTurret(0, -118, 10, 'TAIL GUN'), attack(pe, c, w, t) { if (every(c, t, 50, 10)) P.fan(w, pe.x, pe.y, DOWN, S.tail); } },
  },
  desperation: { name: 'FIRESTORM' },

  phases: [
    {
      name: 'CARPET BOMBING', hp: 740, arena: 'sc_canyon_run', transitionFx: 'flash',
      move: { type: 'hover', amp: 70, y: 115, freq: 0.006 }, parts: ['chinL', 'chinR'],
      patterns: ['carpetBomb', 'flares'], musicLayer: 'aerial_p1',
    },
    {
      name: 'INCENDIARIES', hp: 790, arena: 'sc_refinery_fires', transitionFx: 'flash',
      move: { type: 'sweep', amp: 80, y: 115, freq: 0.007 }, parts: ['dorsal', 'tail'],
      patterns: ['incendiary', 'bombBay'], musicLayer: 'aerial_p2',
    },
    {
      name: 'OPEN BOMB BAY', hp: 830, arena: 'sc_bombed_town', transitionFx: 'screen_tear',
      move: { type: 'hover', amp: 90, y: 120, freq: 0.007 }, parts: ['chinL', 'chinR', 'dorsal'],
      patterns: ['carpetBomb', 'bombBay'], musicLayer: 'aerial_p3',
    },
    {
      name: 'HEAT HAZE', hp: 870, arena: 'sc_dust_ceiling', transitionFx: 'sandstorm',
      move: { type: 'sweep', amp: 90, y: 115, freq: 0.008 }, parts: ['tail'],
      patterns: ['incendiary', 'flares', 'heatHaze'], musicLayer: 'aerial_p4',
    },
    {
      name: 'FIRESTORM', hp: 950, arena: 'sc_firestorm_sunset', transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 120, freq: 0.008 }, intensity: 1.1,
      patterns: ['carpetBomb', 'incendiary', 'bombBay', 'flares'], musicLayer: 'aerial_p5',
    },
  ],

  attacks: {
    // Carpet bombing: a line of impact zones walks down the screen in a
    // column (the bomber's track), each one a delayed blast with a ring.
    carpetBomb(c, w, t) {
      const k = t % 260;
      if (k === 0) c.data.cx = clamp(w.aimX + w.rng.range(-50, 50), 60, W - 60);
      if (k < 90 && k % 15 === 0) {
        const y = 170 + (k / 15) * 90;
        if (y < H - 30) artillery(c, c.data.cx + w.rng.range(-26, 26), y, 48, 55 + k * 0.2, c.mk >= 2 ? S.ring : null);
      }
    },
    // Bomb bay: heavy bombs fall slowly and burst.
    bombBay(c, w, t) {
      if (every(c, t, 70, 10)) for (let k = -1; k <= 1; k++) P.shoot(w, c.e.x + k * 8, c.e.y - 10, DOWN + k * 0.12, S.bomb.speed, S.bomb);
    },
    // Incendiaries: a burning curtain shed from the wings.
    incendiary(c, w, t) {
      if (every(c, t, 6)) {
        const x = c.e.x + ENGINES[(t / 6 | 0) % ENGINES.length];
        P.shoot(w, x, c.e.y + 30, DOWN + w.rng.range(-0.15, 0.15), S.incend.speed, S.incend);
      }
    },
    // Defensive flares: bursts fanning backward that drift and hang.
    flares(c, w, t) {
      if (every(c, t, 110, 40)) for (let k = 0; k < 8; k++) P.shoot(w, c.e.x, c.e.y - 40, DOWN + (k - 3.5) * 0.3, S.flare.speed + w.rng.range(-0.4, 0.4), S.flare);
    },
    // Heat haze: rising thermals push grit upward through the arena.
    heatHaze(c, w, t) {
      if (every(c, t, 8)) P.shoot(w, w.rng.range(20, W - 20), H + 6, -Math.PI / 2 + w.rng.range(-0.2, 0.2), S.heat.speed, S.heat);
    },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.002; },
};
