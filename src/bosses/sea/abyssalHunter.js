import * as P from '../../patterns/index.js';
import { every, clamp, ghostRing, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, weather, body } from '../roster/art.js';

// SEA — ABYSSAL HUNTER (submarine warfare platform)
// A huge guided-missile submarine: a long black cigar hull in anechoic
// tiles, a tall sail with dive planes, two rows of missile hatches, bow
// torpedo tubes and a pump-jet. It hunts by sound — sonar pings sweep out
// as fading rings, torpedo spreads chase down lanes, captor mines wait on
// the bottom, and unmanned hunter drones swarm from the stern hangar.
// Arenas: a storm over the trench entrance → its own submarine pens at
// night → a kelp forest → the silent dark mid-water → the trench mouth.

const S = {
  torpedo: { shape: 'kunai', color: 'cyan', n: 1, speed: 1.8, accel: 0.09, maxSpd: 6, fixed: true },
  ping: { shape: 'orb', color: 'green', n: 20, speed: 1.6 },
  pingMk: { shape: 'rice', color: 'cyan', n: 14, speed: 2.1 },
  hatch: { shape: 'kunai', color: 'green', n: 1, speed: 2.2, homing: 0.05, homingTime: 90, accel: 0.03, maxSpd: 4.2, fixed: true },
  mine: { shape: 'bigorb', color: 'green', n: 1, speed: 2.4, accel: -0.05, minSpd: 0, fixed: true, split: { shape: 'kunai', color: 'cyan', n: 6, speed: 2.6, aimed: true }, splitAt: 120 },
  drone: { shape: 'rice', color: 'green', n: 2, spread: 0.2, speed: 3 },
  wake: { shape: 'orb', color: 'cyan', n: 1, speed: 0.4, fixed: true },
};

const HL = 168, HW = 30;
const HATCHES = [-10, 6, 22, 38, 54, 70];

/** Torpedo spread: lanes telegraphed under the bow, then fast torpedoes. */
function spread(c, w, n) {
  const base = clamp(w.aimX, 50, W - 50);
  for (let k = 0; k < n; k++) {
    const x = clamp(base + (k - (n - 1) / 2) * 56, 20, W - 20);
    c.kit.hazard({
      type: 'lane', x, w: 26, warn: 50 + k * 6, fire: 1, lethal: false, color: [0.3, 1, 0.85], y0: c.e.y + HL,
      onFire: (h, w2) => P.shoot(w2, h.x, c.e.y + HL - 10, DOWN, S.torpedo.speed, S.torpedo),
    });
  }
}

function hunterDrone(c, w, side) {
  const e = c.e;
  c.kit.spawnMinion({
    sprite: 'ah_drone', name: 'HUNTER UUV', x: e.x + side * 20, y: e.y - HL + 20, r: 8, hp: 6, score: 350, glow: [0.3, 1, 0.8],
    drops: w.rng.chance(0.25) ? ['M'] : null, data: { side, vx: side * 2 },
    ai(m, c2, w2) {
      const d = m.data;
      d.vx += (w2.aimX - m.x) * 0.0012; d.vx *= 0.985;
      m.x += d.vx; m.y += m.t < 30 ? -0.5 : 1.3;
      if (m.t % 55 === 30) P.aimed(w2, m.x, m.y, S.drone);
      m.rot = Math.atan2(1.3, d.vx) - Math.PI / 2;
    },
  });
}

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.sub, meta = { lights: [], treads: [], stacks: [], hw: HW, hl: HL, funnels: [] };
  // Cigar hull: rounded bow, long parallel mid-body, tapering stern.
  const pts = [0, HL, 14, HL - 6, 26, HL - 30, HW, HL - 70, HW, -HL + 60, 22, -HL + 22, 10, -HL + 4, 0, -HL];
  meta.lights.push(...body(ctx, pal, pts, [-HW, -HL, HW * 2, HL * 2], 'abyssalhunter', { vents: 2, hazards: 0, pipes: 0, cables: 0, lights: 2, panel: 7, glow: 0.2 }));
  // Anechoic tiles: a fine grid, some missing.
  ctx.save(); mpoly(ctx, pts); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
  for (let y = -HL; y < HL; y += 5) { ctx.beginPath(); ctx.moveTo(-HW, y); ctx.lineTo(HW, y); ctx.stroke(); }
  for (let x = -HW; x < HW; x += 5) { ctx.beginPath(); ctx.moveTo(x, -HL); ctx.lineTo(x, HL); ctx.stroke(); }
  for (let k = 0; k < 26; k++) { ctx.fillStyle = 'rgba(70,80,86,0.6)'; ctx.fillRect(((k * 37) % 56) - 28, ((k * 71) % 300) - 150, 5, 5); }
  ctx.restore();
  weather(ctx, () => mpoly(ctx, pts), 0.2);
  // Missile hatches in two rows behind the sail.
  both((s) => { for (const y of HATCHES) { circ(ctx, s * 10, y, 6); armour(ctx, pal, s * 10 - 6, s * 10 + 6); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s * 10 - 6, y); ctx.lineTo(s * 10 + 6, y); ctx.stroke(); } });
  // Sail (fin) with dive planes.
  ctx.beginPath(); ctx.ellipse(0, 100, 11, 30, 0, 0, TAU); armour(ctx, pal, -11, 11, 2);
  ctx.beginPath(); ctx.rect(-36, 104, 72, 6); armour(ctx, pal, -36, 36);
  for (const x of [-4, 0, 4]) { ctx.fillStyle = '#2a3238'; ctx.fillRect(x - 1, 82, 2, 10); }
  // Stern: cruciform control surfaces and the pump-jet shroud.
  ctx.beginPath(); ctx.rect(-40, -HL + 30, 80, 7); armour(ctx, pal, -40, 40);
  ctx.beginPath(); ctx.rect(-3, -HL - 6, 6, 40); armour(ctx, pal, -3, 3);
  circ(ctx, 0, -HL + 6, 12); armour(ctx, pal, -12, 12);
  circ(ctx, 0, -HL + 6, 8); ctx.fillStyle = '#060a0c'; ctx.fill();
  // Drone hangar hatch.
  ctx.beginPath(); ctx.rect(-14, -110, 28, 26); armour(ctx, pal, -14, 14); hazard(ctx, pal, -14, -110, 28, 3);
  // Bow torpedo tube doors.
  both((s) => { for (let k = 0; k < 2; k++) { circ(ctx, s * (8 + k * 8), HL - 26, 3); ctx.fillStyle = '#020405'; ctx.fill(); } });
  keyLight(ctx, -60, -180, 60, 180, 0.8);
  core(ctx, pal, 0, -40, 6, '#2affc0');
  both((s) => { glowDot(ctx, s * 36, 107, 2.2, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * 36, y: 107, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  meta.lights.push({ x: 0, y: 128, c: '#ffffff', ph: 0.5 });
  return meta;
}

function droneArt(ctx, w, h) {
  const pal = PALS.sub, cx = w / 2;
  ctx.beginPath(); ctx.ellipse(cx, h / 2, w * 0.28, h * 0.46, 0, 0, TAU); armour(ctx, pal, 0, w);
  ctx.beginPath(); ctx.rect(2, h * 0.22, w - 4, 3); armour(ctx, pal, 0, w);
  glowDot(ctx, cx, h * 0.8, 2, 'rgba(60,255,200,1)');
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'abyssal_hunter',
  name: 'ABYSSAL HUNTER',
  title: 'SUBMARINE WARFARE PLATFORM',
  archetype: 'sea',
  sprite: 'b_hunter', scale: 1, r: 40, glow: [0.3, 1, 0.85], score: 150000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_hunter', 96, 352, hull('b_hunter', hullArt));
    add('ah_drone', 16, 24, droneArt, 2.5);
  },
  look: {
    faction: 'blacktide', anim: 'ship',
    weak: { x: 0, y: -40, r: 14, rgb: [0.25, 1, 0.8] },
    sites: [[-14, 60], [14, -20], [0, 120], [-10, -100], [14, 30], [-14, -60]],
  },
  parts: {
    hatches: {
      label: 'MISSILE HATCHES', sprite: 'e_flak', ox: 0, oy: 30, r: 16, hp: 120, medals: 4, score: 8000, bossDamage: 0.08,
      attack(pe, c, w, t) { if (every(c, t, 100, 30)) for (let k = 0; k < 4; k++) P.shoot(w, pe.x + (k % 2 ? 10 : -10), pe.y - 20 + k * 12, (k % 2 ? 0 : Math.PI) + (k % 2 ? -0.5 : 0.5), S.hatch.speed, S.hatch); },
    },
  },
  desperation: { name: 'CRUSH DEPTH' },

  phases: [
    {
      name: 'TORPEDO SPREAD', hp: 720, arena: 'ah_trench_storm', transitionFx: 'water_flood',
      move: { type: 'sweep', amp: 110, y: 170, freq: 0.008 }, parts: ['hatches'],
      patterns: ['torpedoSpread', 'sonar'], musicLayer: 'sea_p1',
    },
    {
      name: 'HUNTER DRONES', hp: 770, arena: 'ah_sub_pens', transitionFx: 'flash',
      move: { type: 'hover', amp: 70, y: 170, freq: 0.007 },
      patterns: ['drones', 'torpedoSpread'], musicLayer: 'sea_p2',
    },
    {
      name: 'MINE CURTAIN', hp: 810, arena: 'ah_kelp_forest', transitionFx: 'water_flood',
      move: { type: 'figure8', amp: 100, ampY: 22, y: 170, freq: 0.008 }, parts: ['hatches'],
      patterns: ['mines', 'sonar'], musicLayer: 'sea_p3',
    },
    {
      name: 'SILENT RUNNING', hp: 860, arena: 'ah_silent_running', transitionFx: 'darkness_swallow',
      move: { type: 'sweep', amp: 120, y: 170, freq: 0.009 },
      patterns: ['sonar', 'drones', 'mines'], musicLayer: 'sea_p4',
    },
    {
      name: 'KILL ORDER', hp: 940, arena: 'ah_trench_mouth', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 110, y: 170, freq: 0.01 }, intensity: 1.1,
      patterns: ['torpedoSpread', 'sonar', 'mines', 'drones'], musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    torpedoSpread(c, w, t) { if (every(c, t, 140)) spread(c, w, c.mk >= 2 ? 4 : 3); },
    // Sonar: pings expand as fading rings; the active ping follows up with darts.
    sonar(c, w, t) {
      if (every(c, t, 75)) ghostRing(c, w, c.e.x, c.e.y + 100, S.ping, t * 0.05);
      if (c.mk >= 2 && every(c, t, 150, 37)) P.ring(w, c.e.x, c.e.y + 100, S.pingMk, w.aimAngle(c.e.x, c.e.y + 100));
    },
    // Captor mines: laid in a line, they arm, then fire darts at the player.
    mines(c, w, t) { if (every(c, t, 130, 60)) for (let k = -1; k <= 1; k++) P.shoot(w, c.e.x + k * 20, c.e.y + 40, DOWN + k * 0.6, S.mine.speed, S.mine); },
    drones(c, w, t) { if (every(c, t, 120)) { hunterDrone(c, w, -1); hunterDrone(c, w, 1); } },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.0018; },
};
