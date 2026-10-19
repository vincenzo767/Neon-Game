import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe, turbine, weather, body } from '../roster/art.js';

// SEA — BLACK TIDE RIG (armoured offshore platform)
// A semi-submersible drilling platform converted into a sea fortress: four
// columns on pontoons, a plated main deck, a derrick over the moon pool, a
// flare boom, pedestal cranes carrying gun pods and a helideck. It barely
// moves — it is moored — so it controls space instead: burning oil spreads,
// the drill string pile-drives the sea floor, mines drift in on the swell.
// Arenas: a burning offshore oil field → the platform's own anchor-chain
// field in a storm → a night tanker terminal → a gas blowout → the black tide.

const S = {
  flame: { shape: 'rice', color: 'orange', n: 1, speed: 3.2, accel: -0.045, minSpd: 0.7, fixed: true },
  flameHot: { shape: 'rice', color: 'yellow', n: 1, speed: 3.6, accel: -0.05, minSpd: 0.6, fixed: true },
  crane: { shape: 'orb', color: 'yellow', n: 3, spread: 0.3, speed: 2.8 },
  slick: { shape: 'orb', color: 'orange', n: 16, speed: 1.4, accel: -0.02, minSpd: 0.25 },
  mine: { shape: 'bigorb', color: 'red', n: 1, speed: 0.8, homing: 0.012, homingTime: 200, fixed: true, split: { shape: 'orb', color: 'red', n: 10, speed: 1.9 }, splitAt: 210 },
  pile: { shape: 'orb', color: 'yellow', n: 12, speed: 2 },
  riser: { shape: 'rice', color: 'yellow', n: 4, speed: 2.4, turn: 0.21 },
  riserB: { shape: 'rice', color: 'orange', n: 4, speed: 2.4, turn: -0.17 },
  storm: { shape: 'rice', color: 'blue', n: 3, speed: 3 },
};

const COLS = [[-80, -78], [80, -78], [-80, 78], [80, 78]];
const BOOM = [-150, -20];

const cranePod = (ox, oy, off) => ({
  label: 'CRANE GUN POD', sprite: 'bt_pod', ox, oy, r: 13, hp: 95, medals: 3, score: 7000, bossDamage: 0.07, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 50, off)) P.aimed(w, pe.x, pe.y, S.crane); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.oil, meta = { lights: [], treads: [], stacks: [], hw: 104, hl: 104, funnels: [] };
  // Pontoons visible under the deck edge, and the four columns.
  both((s) => { ctx.beginPath(); ctx.roundRect(s * 80 - 16, -108, 32, 216, 12); armour(ctx, { plate: ['#141414', '#5a3a2a', '#8a5a3a'] }, s * 80 - 16, s * 80 + 16); });
  for (const [x, y] of COLS) { circ(ctx, x, y, 22); armour(ctx, { plate: ['#2a2210', '#c8a020', '#f0d060'] }, x - 22, x + 22); hazard(ctx, { hazard: ['#1a1a1a', '#e8c020'] }, x - 18, y - 3, 36, 6, 3); }
  // Main deck: square, plated, with lower-level modules visible at the edges.
  const deck = [0, -92, 88, -92, 96, -84, 96, 84, 88, 92, 0, 92];
  meta.lights.push(...body(ctx, pal, deck, [-96, -92, 192, 184], 'blacktide', { vents: 4, hazards: 2, pipes: 3, cables: 2, lights: 4 }));
  weather(ctx, () => mpoly(ctx, deck), 0.55);
  // Oil staining around the moon pool.
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120);
  // Derrick over the moon pool (lattice tower seen from above).
  ctx.beginPath(); ctx.rect(-22, -22, 44, 44); ctx.strokeStyle = '#c8a020'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-22, -22); ctx.lineTo(22, 22); ctx.moveTo(22, -22); ctx.lineTo(-22, 22); ctx.stroke();
  for (let r = 18; r > 4; r -= 5) { ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.strokeStyle = 'rgba(200,160,32,0.6)'; ctx.stroke(); }
  circ(ctx, 0, 0, 5); ctx.fillStyle = '#050505'; ctx.fill();
  // Pipe racks, risers and a mud-pump module.
  for (let k = 0; k < 4; k++) pipe(ctx, pal, -70, -50 + k * 6, 40, -50 + k * 6, 1.8);
  for (let k = 0; k < 3; k++) pipe(ctx, pal, 30 + k * 6, 30, 30 + k * 6, 84, 2);
  ctx.beginPath(); ctx.rect(-80, 30, 46, 44); armour(ctx, pal, -80, -34);
  vent(ctx, pal, -76, 34, 38, 10, 0.3, false);
  // Helideck cantilevered off one corner.
  ctx.beginPath(); ctx.moveTo(50, 92); ctx.lineTo(108, 92); ctx.lineTo(108, 128); ctx.lineTo(80, 140); ctx.lineTo(50, 128); ctx.closePath();
  ctx.fillStyle = '#2e3a2e'; ctx.fill(); ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(80, 114, 14, 0, TAU); ctx.strokeStyle = 'rgba(230,200,40,0.85)'; ctx.stroke();
  ctx.fillStyle = 'rgba(240,240,240,0.8)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 80, 114);
  // Flare boom reaching out over the sea.
  ctx.save(); ctx.translate(-96, -20); ctx.rotate(Math.PI);
  ctx.beginPath(); ctx.rect(0, -5, 56, 10); ctx.strokeStyle = '#8a8070'; ctx.lineWidth = 1.6; ctx.stroke();
  for (let x = 0; x < 56; x += 8) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 8, 5); ctx.stroke(); }
  ctx.restore();
  circ(ctx, BOOM[0] + 2, BOOM[1], 5); ctx.fillStyle = '#1a1410'; ctx.fill();
  meta.funnels.push(BOOM);
  // Crane pedestals (the gun pods are breakable parts).
  for (const [x, y] of [[66, -60], [-60, 66]]) { circ(ctx, x, y, 10); armour(ctx, pal, x - 10, x + 10); }
  keyLight(ctx, -160, -150, 120, 150, 1);
  core(ctx, pal, 0, 0, 7, '#ff7a10');
  for (const [x, y] of COLS) meta.lights.push({ x, y, c: '#ffb040', ph: (x + y) * 0.01 });
  meta.lights.push({ x: 0, y: 0, c: '#ff3a10', ph: 0 });
  return meta;
}

function podArt(ctx, w, h) {
  const pal = PALS.oil, cx = w / 2, cy = h * 0.4;
  for (const dx of [-3.5, 3.5]) { ctx.beginPath(); ctx.rect(cx + dx - 1.5, cy, 3, h * 0.6); armour(ctx, pal, cx + dx - 1.5, cx + dx + 1.5); }
  ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h * 0.45, 3); armour(ctx, { plate: ['#2a2210', '#c8a020', '#f0d060'] }, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'black_tide_rig',
  name: 'BLACK TIDE RIG',
  title: 'ARMOURED OFFSHORE PLATFORM',
  archetype: 'sea',
  sprite: 'b_blacktide', scale: 1, r: 60, glow: [1, 0.6, 0.2], score: 150000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_blacktide', 324, 296, hull('b_blacktide', hullArt));
    add('bt_pod', 24, 30, podArt, 2.5);
  },
  look: {
    faction: 'blacktide', anim: 'ship', moored: true,
    weak: { x: 0, y: 0, r: 18, rgb: [1, 0.5, 0.15] },
    sites: [[-60, -50], [60, 40], [-80, 78], [80, -78], [30, -70], [-50, 40]],
  },
  parts: { podA: cranePod(66, -60, 0), podB: cranePod(-60, 66, 25) },
  desperation: { name: 'BLACK TIDE' },

  phases: [
    {
      name: 'FLARE BOOM', hp: 760, arena: 'bt_oil_field', transitionFx: 'flash',
      move: { type: 'hover', amp: 30, y: 150, freq: 0.004 }, parts: ['podA', 'podB'],
      patterns: ['flareBoom', 'oilFire'], musicLayer: 'sea_p1',
    },
    {
      name: 'SEA MINES', hp: 810, arena: 'bt_anchor_gale', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 40, y: 150, freq: 0.005 },
      patterns: ['seaMines', 'pileDriver', 'squall'], musicLayer: 'sea_p2',
    },
    {
      name: 'BURNING RISERS', hp: 850, arena: 'bt_tanker_terminal', transitionFx: 'flash',
      move: { type: 'hover', amp: 40, y: 150, freq: 0.005 }, parts: ['podA', 'podB'],
      patterns: ['oilFire', 'risers'], musicLayer: 'sea_p3',
    },
    {
      name: 'GAS BLOWOUT', hp: 890, arena: 'bt_gas_blowout', transitionFx: 'flash',
      move: { type: 'hover', amp: 50, y: 150, freq: 0.006 },
      patterns: ['risers', 'flareBoom', 'pileDriver'], musicLayer: 'sea_p4',
    },
    {
      name: 'THE BLACK TIDE', hp: 970, arena: 'bt_black_tide', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 50, y: 150, freq: 0.006 }, intensity: 1.1,
      patterns: ['oilFire', 'seaMines', 'flareBoom', 'risers'], musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    // Flare boom: the boom vents a sweeping jet of burning gas.
    flareBoom(c, w, t) {
      const k = t % 220;
      if (k < 120 && every(c, t, 2)) {
        const ang = DOWN + 0.2 + Math.sin(k * 0.04) * 0.75;
        P.shoot(w, c.e.x + BOOM[0], c.e.y + BOOM[1], ang + w.rng.range(-0.08, 0.08), S.flame.speed + w.rng.range(-0.4, 0.3), k % 3 ? S.flame : S.flameHot);
      }
    },
    // Oil fire: a ring of burning oil spreads out and slows, lingering.
    oilFire(c, w, t) {
      if (every(c, t, 100, 30)) {
        const x = clamp(w.aimX + w.rng.range(-60, 60), 40, W - 40), y = clamp(w.aimY - w.rng.range(60, 160), 120, H - 80);
        P.ring(w, x, y, S.slick, w.rng.angle());
        const fx = w.arena && w.arena.fx;
        if (fx) fx.impact(x, y, 26, { crater: false });
      }
    },
    // Sea mines: dropped off the pontoons, they drift toward the player.
    seaMines(c, w, t) { if (every(c, t, 120, 50)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 80, c.e.y + 90, DOWN + s * 0.4, S.mine.speed, S.mine); },
    // Pile driver: the drill string slams down a lane; the impact rings out.
    pileDriver(c, w, t) {
      if (!every(c, t, 180, 60)) return;
      const x = clamp(w.aimX, 40, W - 40), y = clamp(w.aimY, 200, H - 40);
      c.kit.hazard({
        type: 'lane', x, w: 40, warn: 60, fire: 14, color: [1, 0.6, 0.15],
        onFire: (h, w2) => { P.ring(w2, h.x, y, S.pile, w2.rng.angle()); w2.g.camera.addTrauma(0.12); },
      });
    },
    // Risers: high-pressure jets spiral out of the wellheads.
    risers(c, w, t) {
      if (every(c, t, 7)) P.spiral(w, c.e, S.riser, 'riser');
      if (c.mk >= 2 && every(c, t, 10)) P.spiral(w, c.e, S.riserB, 'riserB');
    },
    squall(c, w, t) { if ((t % 200) < 110 && every(c, t, 7)) P.rain(w, S.storm); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.012) * 0.015; },
};
