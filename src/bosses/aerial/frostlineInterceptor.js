import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, W, H } from '../util.js';
import { PALS, hull, wing, nozzles, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, canopy, camo, weather } from '../roster/art.js';

// AERIAL — FROSTLINE INTERCEPTOR (high-speed aerial fighter)
// A forward-swept-wing twin-engine interceptor in arctic splinter camouflage
// — the smallest and fastest aerial boss. It never hangs still: it weaves,
// dives through the player's lane and climbs back out, leaving freezing
// contrails that hang in the air. Weapons: wing-root rotary cannons, a
// missile rack on each wing, and ice-cluster bombs.
// Arenas: glacier ridgelines → a fjord at wave-top height → the polar
// night under the aurora → its own mountain airbase → a blizzard front.

const S = {
  gun: { shape: 'kunai', color: 'cyan', n: 1, speed: 4.6, fixed: true },
  gunMk: { shape: 'kunai', color: 'white', n: 3, spread: 0.12, speed: 4.2 },
  missile: { shape: 'kunai', color: 'blue', n: 1, speed: 1.6, homing: 0.045, homingTime: 70, accel: 0.05, maxSpd: 4.8, fixed: true },
  contrail: { shape: 'rice', color: 'cyan', n: 1, speed: 0.35, fixed: true },
  cluster: { shape: 'bigorb', color: 'blue', n: 1, speed: 2.2, accel: -0.025, minSpd: 0.3, fixed: true, split: { shape: 'rice', color: 'cyan', n: 12, speed: 2 }, splitAt: 65 },
  roll: { shape: 'orb', color: 'blue', n: 8, speed: 2.1, turn: 0.26 },
  rollB: { shape: 'orb', color: 'cyan', n: 8, speed: 2.4, turn: -0.19 },
  flake: { shape: 'rice', color: 'white', n: 2, speed: 2.2 },
};

const GUNS = [-22, 22];

const rack = (ox, off) => ({
  label: 'MISSILE RACK', sprite: 'fl_rack', ox, oy: 20, r: 12, hp: 75, medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (!every(c, t, 120, off)) return;
    for (let k = 0; k < (c.mk >= 2 ? 3 : 2); k++) P.shoot(w, pe.x, pe.y, DOWN + Math.sign(ox) * (0.25 + k * 0.3), S.missile.speed, S.missile);
  },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.frost, meta = { lights: [], treads: [], stacks: [], fans: [] };
  // Forward-swept main wing (tips ahead of the roots).
  const wingPts = [0, -20, 40, -26, 92, 18, 98, 36, 86, 40, 36, 10, 0, 12];
  meta.lights.push(...wing(ctx, pal, wingPts, 'frostline_w', { lights: 1 }));
  camo(ctx, () => mpoly(ctx, wingPts), ['#c4ccd6', '#7a8696', '#eef2f6', '#4a5462'], 3, 26, 16);
  // Canted tail fins and tailplanes.
  const tail = [0, -100, 24, -100, 54, -112, 56, -98, 26, -78, 0, -76];
  meta.lights.push(...wing(ctx, pal, tail, 'frostline_t', { lights: 0 }));
  both((s) => { poly(ctx, [s * 18, -86, s * 30, -80, s * 34, -112, s * 26, -114]); armour(ctx, pal, -40, 40); });
  // Canards ahead of the wing.
  both((s) => { poly(ctx, [s * 14, 44, s * 44, 34, s * 46, 40, s * 16, 56]); armour(ctx, pal, -50, 50); });
  // Fuselage: long and narrow with side intakes.
  const fus = [0, 116, 8, 100, 14, 70, 22, 40, 26, -30, 24, -96, 16, -110, 0, -112];
  const path = () => mpoly(ctx, fus);
  path(); armour(ctx, pal, -26, 26, 2);
  camo(ctx, path, ['#c4ccd6', '#7a8696', '#eef2f6', '#4a5462'], 9, 14, 10);
  weather(ctx, path, 0.18);
  both((s) => { poly(ctx, [s * 22, 36, s * 30, 30, s * 32, -12, s * 24, -14]); ctx.fillStyle = '#12161c'; ctx.fill(); });
  rivetRow(ctx, pal, 0, 90, 0, -96, 8);
  vent(ctx, pal, -10, -60, 20, 24, 0.2, true);
  // Bubble canopy.
  canopy(ctx, 0, 70, 7, 18, '#ffffff', '#8ad8ff', '#0a2030');
  // Rotary cannons in the wing roots.
  for (const x of GUNS) { ctx.beginPath(); ctx.rect(x - 2, 10, 4, 22); armour(ctx, pal, x - 2, x + 2); ctx.fillStyle = '#050608'; ctx.fillRect(x - 1, 30, 2, 2); }
  // Engines: two nozzles at the tail.
  nozzles(ctx, pal, meta, [[-11, -112], [11, -112]], 8);
  keyLight(ctx, -100, -120, 100, 120, 1);
  core(ctx, pal, 0, -20, 6, '#5ad0ff');
  both((s) => { glowDot(ctx, s * 96, 36, 2.6, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * 96, y: 36, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  lamp(ctx, 0, -114, '#ffffff', 1.2); meta.lights.push({ x: 0, y: -114, c: '#ffffff', ph: 0.5 });
  return meta;
}

function rackArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2;
  for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.roundRect(cx + dx - 2, 3, 4, h - 6, 2); armour(ctx, pal, cx + dx - 2, cx + dx + 2); ctx.fillStyle = '#3a8adf'; ctx.fillRect(cx + dx - 2, h - 8, 4, 3); }
  ctx.beginPath(); ctx.rect(2, h * 0.3, w - 4, 5); armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'frostline_interceptor',
  name: 'FROSTLINE INTERCEPTOR',
  title: 'HIGH-SPEED AERIAL FIGHTER',
  archetype: 'aerial',
  sprite: 'b_frostline', scale: 1, r: 40, glow: [0.5, 0.85, 1], score: 150000,
  deathSequence: 'spin_out',
  art(add) {
    add('b_frostline', 204, 236, hull('b_frostline', hullArt));
    add('fl_rack', 22, 30, rackArt, 2.5);
  },
  look: {
    faction: 'stratos', anim: 'carrier',
    weak: { x: 0, y: -20, r: 14, rgb: [0.45, 0.85, 1] },
    shadow: { dx: 34, dy: 52, a: 0.3 },
    sites: [[-60, 10], [60, 14], [-14, 60], [14, -70], [-40, -96], [40, -96]],
  },
  parts: { rackL: rack(-64, 0), rackR: rack(64, 60) },
  desperation: { name: 'ZERO VISIBILITY' },

  phases: [
    {
      name: 'ROTARY GUNS', hp: 680, arena: 'fl_glacier_ridge', transitionFx: 'flash',
      move: { type: 'figure8', amp: 140, ampY: 40, y: 115, freq: 0.018 }, parts: ['rackL', 'rackR'],
      patterns: ['rotaryGuns', 'contrails'], musicLayer: 'aerial_p1',
    },
    {
      name: 'DIVE BOMBING', hp: 740, arena: 'fl_fjord_run', transitionFx: 'cloud_burst',
      move: { type: 'sweep', amp: 150, y: 110, freq: 0.02 },
      patterns: ['diveAttack', 'clusterBombs'], musicLayer: 'aerial_p2',
    },
    {
      name: 'BARREL ROLL', hp: 790, arena: 'fl_polar_night', transitionFx: 'cloud_burst',
      move: { type: 'figure8', amp: 120, ampY: 35, y: 120, freq: 0.016 }, parts: ['rackL', 'rackR'],
      patterns: ['barrelRoll', 'rotaryGuns'], musicLayer: 'aerial_p3',
    },
    {
      name: 'CLUSTER STRIKE', hp: 840, arena: 'fl_mountain_airbase', transitionFx: 'flash',
      move: { type: 'sweep', amp: 140, y: 115, freq: 0.018 },
      patterns: ['diveAttack', 'contrails', 'clusterBombs'], musicLayer: 'aerial_p4',
    },
    {
      name: 'WHITEOUT DIVE', hp: 920, arena: 'fl_blizzard_front', transitionFx: 'cloud_burst',
      move: { type: 'figure8', amp: 150, ampY: 40, y: 115, freq: 0.02 }, intensity: 1.1,
      patterns: ['diveAttack', 'barrelRoll', 'rotaryGuns', 'blizzard'], musicLayer: 'aerial_p5',
    },
  ],

  attacks: {
    // Rotary cannons: alternating long aimed bursts from the wing roots.
    rotaryGuns(c, w, t) {
      if (c.data.diving) return;
      if ((t % 80) < 36 && every(c, t, 4)) { const x = GUNS[(t >> 2) & 1]; P.aimed(w, c.e.x + x, c.e.y + 32, S.gun, w.rng.range(-0.06, 0.06)); }
      if (c.mk >= 2 && every(c, t, 80, 50)) P.aimed(w, c.e.x, c.e.y + 40, S.gunMk);
    },
    // Freezing contrails: hanging ice crystals left along the flight path.
    contrails(c, w, t) {
      if (every(c, t, 5)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 11, c.e.y - 112, DOWN + w.rng.range(-0.4, 0.4), S.contrail.speed, S.contrail);
    },
    // Dive: lock a lane, plunge down it with guns blazing, climb back out.
    diveAttack(c, w, t) {
      const k = t % 300;
      if (k === 0) {
        c.data.dx = clamp(w.aimX, 70, W - 70);
        c.kit.hazard({ type: 'lane', x: c.data.dx, w: 90, warn: 60, fire: 40, color: [0.5, 0.85, 1] });
      }
      c.data.diving = k < 150;
      if (k < 60) { c.mx = c.data.dx; c.my = 70; c.ease = 0.08; }
      else if (k < 100) {
        c.mx = c.data.dx; c.my = H + 40; c.ease = 0.12;
        if (k % 3 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 20, c.e.y, DOWN + s * 1.25, 3, S.contrail);
      } else if (k < 150) { c.mx = c.data.dx; c.my = 110; c.ease = 0.05; }
    },
    clusterBombs(c, w, t) {
      if (every(c, t, 95, 30) && !c.data.diving) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 40, c.e.y + 20, DOWN + s * 0.35, S.cluster.speed, S.cluster);
    },
    // Barrel roll: counter-rotating ice rings.
    barrelRoll(c, w, t) {
      if (every(c, t, 9)) P.spiral(w, c.e, S.roll, 'roll');
      if (c.mk >= 2 && every(c, t, 13)) P.spiral(w, c.e, S.rollB, 'rollB');
    },
    // Blizzard: wind-driven ice from the side, gusting.
    blizzard(c, w, t) {
      if (every(c, t, 5) && (t % 240) < 150) P.shoot(w, W + 8, w.rng.range(30, H * 0.7), Math.PI - 0.2 + w.rng.range(-0.08, 0.08), 2.4, S.flake);
    },
  },

  // Banks hard into every turn.
  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = clamp((c.mx - c.e.x) * -0.006, -0.35, 0.35); },
};
