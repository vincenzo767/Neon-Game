import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, body, weather, track, drill, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe, turbine } from '../roster/art.js';

// GROUND — IRON VEIN (underground drilling fortress)
// A tunnel-boring machine turned fortress: a rotating cutter head the full
// width of the hull, a segmented train of thrust rams, conveyor spoil and
// ore cannons, crawling on six tracks. It fights where it digs — an open
// pit, its own mine shafts, a magma cavern it has breached, a buried
// military supply tunnel and finally a geothermal plant it bores into.
// Signature: the cutter head's spinning spoil spirals, seismic lanes that
// erupt from below, rockfall from the roof and ore slugs that shatter.

const S = {
  spoil: { shape: 'orb', color: 'orange', n: 6, speed: 1.9, turn: 0.21 },
  spoilB: { shape: 'rice', color: 'yellow', n: 6, speed: 2.4, turn: -0.17 },
  ore: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.2, fixed: true, split: { shape: 'kunai', color: 'yellow', n: 8, speed: 2.4 }, splitAt: 75 },
  rock: { shape: 'bigorb', color: 'red', n: 1, speed: 1.4, accel: 0.03, maxSpd: 3.6, fixed: true },
  grit: { shape: 'rice', color: 'orange', n: 2, speed: 2.1 },
  seismic: { shape: 'orb', color: 'orange', n: 1, speed: 2.4, fixed: true },
  magma: { shape: 'orb', color: 'red', n: 10, speed: 1.7 },
  cutter: { shape: 'kunai', color: 'yellow', n: 7, spread: 1.4, speed: 2.9 },
};

const HEAD_Y = 112;

const oreCannon = (ox, off) => ({
  label: 'ORE CANNON', sprite: 'iv_cannon', ox, oy: -10, r: 13, hp: 95, medals: 3, score: 7000, bossDamage: 0.07, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 90, off)) P.aimed(w, pe.x, pe.y, S.ore); },
});
const conveyor = {
  label: 'SPOIL CONVEYOR', sprite: 'iv_conveyor', ox: 0, oy: -92, r: 15, hp: 120, medals: 4, score: 9000, bossDamage: 0.08,
  // Spoil flung off the belt arcs out to the sides and curls down.
  attack(pe, c, w, t) {
    if (!every(c, t, 12, 3)) return;
    const s = w.rng.sign();
    P.shoot(w, pe.x, pe.y, (s > 0 ? -0.35 : Math.PI + 0.35) + w.rng.range(-0.2, 0.2), 2.4, s > 0 ? SPOIL_R : SPOIL_L);
  },
};
const SPOIL_R = { shape: 'orb', color: 'orange', angVel: 0.022 };
const SPOIL_L = { shape: 'orb', color: 'orange', angVel: -0.022 };

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.mining, meta = { lights: [], treads: [], stacks: [] };
  // Six track units in three pairs (the fortress is long and heavy).
  for (const [y0, y1] of [[-118, -64], [-48, 10], [26, 84]]) both((s) => track(ctx, pal, meta, s > 0 ? 66 : -96, s > 0 ? 96 : -66, y0, y1));
  // Segmented body: three articulated sections joined by thrust rams.
  const sections = [[-118, -62], [-54, 12], [20, 84]];
  for (let i = 0; i < 3; i++) {
    const [y0, y1] = sections[i], hw = 64 - i * 2;
    const pts = [0, y0, hw - 8, y0, hw, y0 + 8, hw, y1 - 8, hw - 8, y1, 0, y1];
    const path = () => mpoly(ctx, pts);
    meta.lights.push(...body(ctx, pal, pts, [-hw, y0, hw * 2, y1 - y0], 'ironvein' + i, { vents: 2, hazards: 1, pipes: 2, lights: 2 }));
    weather(ctx, path, 0.5);
    hazard(ctx, pal, -hw + 4, y1 - 6, hw * 2 - 8, 4);
  }
  for (const y of [-58, 16]) both((s) => { pipe(ctx, pal, s * 30, y - 8, s * 30, y + 8, 4, false); pipe(ctx, pal, s * 50, y - 8, s * 50, y + 8, 3, false); });
  // Rear section: power plant with cooling fan and exhaust.
  turbine(ctx, pal, 0, -92, 18, 12);
  both((s) => { circ(ctx, s * 42, -104, 6); ctx.fillStyle = '#120c06'; ctx.fill(); meta.stacks.push([s * 42, -104]); });
  // Middle: ore hoppers glowing with heat.
  both((s) => {
    ctx.beginPath(); ctx.rect(s * 26 - 14, -44, 28, 40); armour(ctx, pal, s * 26 - 14, s * 26 + 14);
    ctx.fillStyle = '#2a1408'; ctx.fillRect(s * 26 - 10, -40, 20, 32);
    const g = ctx.createRadialGradient(s * 26, -24, 1, s * 26, -24, 16);
    g.addColorStop(0, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(120,30,0,0)');
    ctx.fillStyle = g; ctx.fillRect(s * 26 - 10, -40, 20, 32);
  });
  // Front section: cutter-head carrier and gripper shoes.
  both((s) => { ctx.beginPath(); ctx.rect(s * 70 - 6, 30, 12, 46); armour(ctx, pal, s * 70 - 6, s * 70 + 6); });
  // Cutter head: a full-width disc of disc cutters, plus the pilot drill.
  circ(ctx, 0, HEAD_Y - 12, 62); ctx.fillStyle = '#1a140c'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, HEAD_Y - 6, 70, 26, 0, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.rect(-70, HEAD_Y - 32, 140, 52); armour(ctx, { plate: ['#2a2622', '#8a8278', '#d8d0c4'], hi: 'rgba(255,255,255,0.4)' }, -70, 70, 2);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI; ctx.strokeStyle = 'rgba(20,16,10,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, HEAD_Y - 6); ctx.lineTo(Math.cos(a) * 72, HEAD_Y - 6 + Math.sin(a) * 26); ctx.stroke(); }
  for (let k = 0; k < 14; k++) { const x = -60 + k * 9.2, y = HEAD_Y - 6 + Math.sin(k * 1.7) * 10; circ(ctx, x, y, 3); ctx.fillStyle = '#c8c0b4'; ctx.fill(); ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.8; ctx.stroke(); }
  ctx.restore();
  drill(ctx, pal, 0, HEAD_Y - 2, 13, 26);
  keyLight(ctx, -110, -130, 110, 140, 1);
  core(ctx, pal, 0, -16, 8, '#ff8a1a');
  both((s) => { lamp(ctx, s * 58, 88, '#ffe0a0', 1.8); meta.lights.push({ x: s * 58, y: 88, c: '#ffe0a0', ph: s > 0 ? 0 : 0.5 }); });
  both((s) => { lamp(ctx, s * 60, -60, pal.light, 1.2); meta.lights.push({ x: s * 60, y: -60, c: '#ffa020', ph: 0.25 }); });
  return meta;
}

function cannonArt(ctx, w, h) {
  const pal = PALS.mining, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 3.5, h * 0.42, 7, h * 0.58); armour(ctx, pal, cx - 3.5, cx + 3.5);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h * 0.5, 4); armour(ctx, pal, 0, w);
  hazard(ctx, pal, 4, 4, w - 8, 3);
  keyLight(ctx, 0, 0, w, h);
}

function conveyorArt(ctx, w, h) {
  const pal = PALS.mining;
  ctx.beginPath(); ctx.rect(4, 2, w - 8, h - 4); armour(ctx, pal, 4, w - 4);
  ctx.fillStyle = '#1a120a'; ctx.fillRect(8, 4, w - 16, h - 8);
  ctx.strokeStyle = 'rgba(150,120,80,0.6)'; ctx.lineWidth = 1.4;
  for (let y = 6; y < h - 4; y += 4) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(w - 8, y); ctx.stroke(); }
  for (let k = 0; k < 5; k++) { circ(ctx, 12 + (k * 7) % (w - 22), 8 + k * 5, 2.5); ctx.fillStyle = '#7a5a3a'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'iron_vein',
  name: 'IRON VEIN',
  title: 'UNDERGROUND DRILLING FORTRESS',
  archetype: 'ground',
  sprite: 'b_ironvein', scale: 1, r: 58, glow: [1, 0.6, 0.2], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_ironvein', 216, 272, hull('b_ironvein', hullArt));
    add('iv_cannon', 26, 32, cannonArt, 2.5);
    add('iv_conveyor', 40, 30, conveyorArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'crawler',
    weak: { x: 0, y: -16, r: 18, rgb: [1, 0.55, 0.15] },
    sites: [[-36, -90], [30, -24], [-30, 50], [40, 60], [-70, -10], [70, -80]],
  },
  parts: { oreL: oreCannon(-44, 0), oreR: oreCannon(44, 45), conveyor },
  desperation: { name: 'CORE BREACH' },

  phases: [
    {
      name: 'CUTTER HEAD', hp: 720, arena: 'iv_open_pit', transitionFx: 'flash',
      move: { type: 'hover', amp: 80, y: 130, freq: 0.008 }, parts: ['oreL', 'oreR'],
      patterns: ['cutterHead', 'spoilSpiral'], musicLayer: 'ground_p1',
    },
    {
      name: 'SEISMIC LANES', hp: 770, arena: 'iv_mine_shaft', transitionFx: 'rockfall',
      move: { type: 'sweep', amp: 70, y: 125, freq: 0.012 }, parts: ['conveyor'],
      patterns: ['rockfall', 'seismicLanes'], musicLayer: 'ground_p2',
    },
    {
      name: 'MAGMA VENTS', hp: 820, arena: 'iv_magma_breach', transitionFx: 'lava_flood',
      move: { type: 'figure8', amp: 90, ampY: 22, y: 125 }, parts: ['oreL', 'oreR', 'conveyor'],
      patterns: ['spoilSpiral', 'magmaVents'], musicLayer: 'ground_p3',
    },
    {
      name: 'CAVE-IN', hp: 860, arena: 'iv_supply_tunnel', transitionFx: 'rockfall',
      move: { type: 'hover', amp: 100, y: 125 },
      patterns: ['seismicLanes', 'cutterHead', 'rockfall'], musicLayer: 'ground_p4',
    },
    {
      name: 'DEEP CORE BREACH', hp: 940, arena: 'iv_geothermal_plant', transitionFx: 'lava_flood',
      move: { type: 'hover', amp: 110, y: 130, freq: 0.012 }, intensity: 1.1,
      patterns: ['spoilSpiral', 'seismicLanes', 'magmaVents', 'cutterHead'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    // Cutter head: flung disc-cutter chips in a wide fan, alternating sides.
    cutterHead(c, w, t) {
      if (every(c, t, 60)) P.fan(w, c.e.x, c.e.y + HEAD_Y, DOWN + ((t / 60) & 1 ? 0.25 : -0.25), S.cutter);
      if (c.mk >= 2 && every(c, t, 30, 15)) P.aimed(w, c.e.x, c.e.y + HEAD_Y, S.grit);
    },
    spoilSpiral(c, w, t) {
      if (every(c, t, 8)) P.spiral(w, c.e, S.spoil, 'spoil');
      if (c.mk >= 2 && every(c, t, 11)) P.spiral(w, c.e, S.spoilB, 'spoilB');
    },
    // Rockfall: boulders shaken from the roof accelerate as they fall.
    rockfall(c, w, t) {
      if (every(c, t, 26)) P.shoot(w, w.rng.range(20, W - 20), -12, DOWN + w.rng.range(-0.08, 0.08), S.rock.speed, S.rock);
      if (every(c, t, 9)) P.rain(w, S.grit);
    },
    // Seismic lanes: the floor cracks along a column, then erupts upward.
    seismicLanes(c, w, t) {
      if (!every(c, t, 170, 40)) return;
      const n = c.mk >= 3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const x = clamp(k === 0 ? w.aimX : w.rng.range(40, W - 40), 40, W - 40);
        c.kit.hazard({
          type: 'lane', x, w: 64, warn: 65, fire: 22, color: [1, 0.55, 0.15],
          onFire: (h, w2) => {
            for (let j = 0; j < 7; j++) P.shoot(w2, h.x + w2.rng.range(-24, 24), H - j * 20, -Math.PI / 2 + w2.rng.range(-0.2, 0.2), S.seismic.speed + j * 0.2, S.seismic);
            w2.g.camera.addTrauma(0.08);
          },
        });
      }
    },
    // Magma vents: breached pockets flare under the player and ring out.
    magmaVents(c, w, t) {
      if (every(c, t, 100, 50)) {
        artillery(c, w.aimX, w.aimY, 40, 65, S.magma);
        if (c.mk >= 2) artillery(c, w.rng.range(40, W - 40), w.rng.range(H * 0.4, H - 60), 36, 80, null);
      }
    },
  },

  update(c) { if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.5) * 0.003; },
};
