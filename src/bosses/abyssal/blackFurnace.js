import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, mpoly, poly, circ, armour, both, keyLight, glowDot, pipe, vent, hazard, rivetRow, body, weather, turbine } from '../roster/art.js';

// ABYSSAL — BLACK FURNACE (hydrothermal war machine)
// A war machine built to live where nothing else can: a squat pressure
// hull on four anchor legs, tapping hydrothermal vents through intake
// spikes and turning the heat into weapons. Superheated plumes rise in
// columns, magma slugs crack open into embers that sink, steam jets sweep
// sideways and the furnace vents boil the water around it. Its glow is the
// only light in most of its arenas.
// Arenas: the hydrothermal vent field → a flooded military base it has
// seized → the black-smoker forest → the magma rift → the furnace heart.

const S = {
  slug: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.6, accel: -0.012, minSpd: 0.6, fixed: true, split: { shape: 'orb', color: 'red', n: 10, speed: 1.6 }, splitAt: 85 },
  ember: { shape: 'orb', color: 'orange', n: 1, speed: 0.6, accel: 0.02, maxSpd: 2.2, fixed: true },
  jet: { shape: 'rice', color: 'yellow', n: 1, speed: 3.4, accel: -0.04, minSpd: 0.8, fixed: true },
  plume: { shape: 'orb', color: 'red', n: 1, speed: 2.2, fixed: true },
  vent: { shape: 'orb', color: 'orange', n: 6, speed: 2, turn: 0.18 },
  ring: { shape: 'orb', color: 'red', n: 12, speed: 1.6 },
};

const VENTS = [[-60, -40], [60, -40], [-60, 40], [60, 40]];

const intake = (k, off) => ({
  label: 'VENT INTAKE', sprite: 'bf_intake', ox: VENTS[k][0] * 1.45, oy: VENTS[k][1] * 1.6, r: 13, hp: 90, medals: 3, score: 6500, bossDamage: 0.06,
  attack(pe, c, w, t) { if (every(c, t, 80, off)) P.ring(w, pe.x, pe.y, S.ring, w.rng.angle()); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.furnace, meta = { lights: [], treads: [], stacks: [] };
  // Anchor legs with intake spikes driven into the vents below.
  for (const [x, y] of VENTS) {
    const ex = x * 1.45, ey = y * 1.6;
    ctx.beginPath(); ctx.moveTo(x * 0.6, y * 0.6); ctx.lineTo(ex, ey); ctx.lineWidth = 14; ctx.strokeStyle = '#1e1816'; ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = '#3e322c'; ctx.stroke();
    pipe(ctx, pal, x * 0.7, y * 0.7, ex, ey, 2.4);
    circ(ctx, ex, ey, 12); armour(ctx, pal, ex - 12, ex + 12);
  }
  // Pressure hull: thick, rounded, riveted, scorched by its own heat.
  const pts = [0, -78, 42, -74, 70, -44, 76, 0, 70, 44, 42, 74, 0, 80];
  meta.lights.push(...body(ctx, pal, pts, [-76, -78, 152, 158], 'blackfurnace', { vents: 4, hazards: 1, pipes: 3, cables: 1, lights: 3 }));
  weather(ctx, () => mpoly(ctx, pts), 0.6);
  for (let r = 70; r > 20; r -= 16) { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke(); rivetRow(ctx, pal, -r * 0.7, -r * 0.7, r * 0.7, -r * 0.7, 9); }
  // Furnace mouths glowing through grilles.
  for (const [x, y] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) {
    ctx.beginPath(); ctx.rect(x - 12, y - 8, 24, 16); ctx.fillStyle = '#100604'; ctx.fill();
    const g = ctx.createRadialGradient(x, y, 1, x, y, 14); g.addColorStop(0, 'rgba(255,200,90,1)'); g.addColorStop(0.5, 'rgba(255,90,20,0.8)'); g.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 12, y - 8, 24, 16);
    ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1.4; for (let k = -10; k <= 10; k += 4) { ctx.beginPath(); ctx.moveTo(x + k, y - 8); ctx.lineTo(x + k, y + 8); ctx.stroke(); }
    meta.lights.push({ x, y, c: '#ff8a30', ph: (x + y) * 0.01 });
  }
  // Exhaust stack crown and the heat exchanger turbine.
  turbine(ctx, pal, 0, 0, 16, 12);
  both((s) => { circ(ctx, s * 22, -64, 7); ctx.fillStyle = '#0a0606'; ctx.fill(); meta.stacks.push([s * 22, -64]); });
  hazard(ctx, pal, -40, 66, 80, 5);
  // Forward heat cannon.
  ctx.beginPath(); ctx.rect(-8, 70, 16, 34); armour(ctx, pal, -8, 8);
  circ(ctx, 0, 104, 7); ctx.fillStyle = '#ff7a20'; ctx.fill();
  glowDot(ctx, 0, 104, 6, 'rgba(255,140,40,1)');
  keyLight(ctx, -120, -130, 120, 130, 0.5);
  meta.lights.push({ x: 0, y: 104, c: '#ffa040', ph: 0 });
  return meta;
}

function intakeArt(ctx, w, h) {
  const pal = PALS.furnace, cx = w / 2, cy = h / 2;
  circ(ctx, cx, cy, w * 0.42); armour(ctx, pal, 0, w);
  circ(ctx, cx, cy, w * 0.24); ctx.fillStyle = '#0a0404'; ctx.fill();
  glowDot(ctx, cx, cy, 3.5, 'rgba(255,120,40,1)');
}

export default {
  id: 'black_furnace',
  name: 'BLACK FURNACE',
  title: 'HYDROTHERMAL WAR MACHINE',
  archetype: 'abyssal',
  sprite: 'b_furnace', scale: 1, r: 56, glow: [1, 0.5, 0.15], score: 150000,
  deathSequence: 'dissolve',
  art(add) {
    add('b_furnace', 232, 256, hull('b_furnace', hullArt));
    add('bf_intake', 26, 26, intakeArt, 2.5);
  },
  look: {
    faction: 'drowned', anim: 'crawler',
    weak: { x: 0, y: 0, r: 18, rgb: [1, 0.5, 0.15] },
    sites: [[-30, -30], [30, 30], [-30, 30], [30, -30], [-60, 0], [60, 0]],
  },
  parts: Object.fromEntries(VENTS.map((_, k) => [`intake${k}`, intake(k, k * 20)])),
  desperation: { name: 'MELTDOWN' },

  phases: [
    {
      name: 'SLUG CANNON', hp: 760, arena: 'bf_vent_field', transitionFx: 'water_flood',
      move: { type: 'hover', amp: 70, y: 145, freq: 0.005 }, parts: ['intake2', 'intake3'],
      patterns: ['slugs', 'embers'], musicLayer: 'abyssal_p1',
    },
    {
      name: 'STEAM JETS', hp: 810, arena: 'bf_flooded_base', transitionFx: 'water_flood',
      move: { type: 'sweep', amp: 80, y: 145, freq: 0.006 },
      patterns: ['steamJets', 'plumes'], musicLayer: 'abyssal_p2',
    },
    {
      name: 'BLACK SMOKERS', hp: 850, arena: 'bf_smoker_forest', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 80, y: 145, freq: 0.006 }, parts: ['intake0', 'intake1', 'intake2', 'intake3'],
      patterns: ['plumes', 'embers'], musicLayer: 'abyssal_p3',
    },
    {
      name: 'BOILING SEA', hp: 890, arena: 'bf_magma_rift', transitionFx: 'lava_flood',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 145, freq: 0.006 },
      patterns: ['slugs', 'boil', 'steamJets'], musicLayer: 'abyssal_p4',
    },
    {
      name: 'THE FURNACE HEART', hp: 970, arena: 'bf_furnace_heart', transitionFx: 'lava_flood',
      move: { type: 'hover', amp: 90, y: 145, freq: 0.007 }, intensity: 1.1,
      patterns: ['plumes', 'slugs', 'boil', 'embers'], musicLayer: 'abyssal_p5',
    },
  ],

  attacks: {
    // Magma slugs: heavy, slow, cracking open into embers.
    slugs(c, w, t) { if (every(c, t, 65)) P.aimed(w, c.e.x, c.e.y + 104, S.slug, w.rng.range(-0.2, 0.2)); },
    // Embers: cinders drift up out of the vents and sink back toward the player.
    embers(c, w, t) { if (every(c, t, 9)) P.shoot(w, w.rng.range(20, W - 20), -10, DOWN + w.rng.range(-0.2, 0.2), S.ember.speed, S.ember); },
    // Plumes: superheated columns erupt from the floor under the player.
    plumes(c, w, t) {
      if (!every(c, t, 120, 30)) return;
      const x = clamp(w.aimX + w.rng.range(-30, 30), 40, W - 40);
      c.kit.hazard({ type: 'lane', x, w: 50, warn: 65, fire: 30, color: [1, 0.45, 0.12],
        onFire: (h, w2) => { for (let k = 0; k < 8; k++) P.shoot(w2, h.x + w2.rng.range(-20, 20), H + 5, -Math.PI / 2 + w2.rng.range(-0.15, 0.15), S.plume.speed + k * 0.15, S.plume); } });
    },
    // Steam jets: sweeping horizontal jets from the hull flanks.
    steamJets(c, w, t) {
      const k = t % 180;
      if (k < 90 && every(c, t, 3)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 76, c.e.y, (s > 0 ? 0 : Math.PI) + s * (0.2 + k * 0.012), S.jet.speed, S.jet);
    },
    // Boil: the water around the furnace boils — spinning vent spirals.
    boil(c, w, t) { if (every(c, t, 8)) P.spiral(w, c.e, S.vent, 'boil'); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.015) * 0.012; },
};
