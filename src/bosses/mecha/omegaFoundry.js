import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, limb, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe, weather, body, turbine } from '../roster/art.js';

// MECHA — OMEGA FOUNDRY (autonomous mechanical weapons platform)
// Not a robot but a factory that builds them: a square gantry chassis on
// crawler bogies, four articulated assembly arms, a press line down the
// middle, a forge core and a conveyor that spits out freshly assembled
// drones. It manufactures its own escorts mid-fight, slams hydraulic presses
// into the floor, welds with plasma arcs and pours slag.
// Arenas: the underground reactor complex → its assembly line → a robot
// scrapyard → an orbital manufacturing station → the core forge.

const S = {
  rivet: { shape: 'kunai', color: 'orange', n: 1, speed: 4, fixed: true },
  press: { shape: 'orb', color: 'red', n: 14, speed: 1.8 },
  slag: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.2, accel: 0.03, maxSpd: 3, fixed: true },
  spark: { shape: 'rice', color: 'yellow', n: 5, spread: 0.9, speed: 2.6 },
  drone: { shape: 'orb', color: 'red', n: 3, spread: 0.3, speed: 2.4 },
  gear: { shape: 'orb', color: 'orange', n: 10, speed: 1.9, turn: 0.15 },
};

const ARMS = [[-74, -60], [74, -60], [-74, 56], [74, 56]];
const PRESS_X = [-26, 26];

function buildDrone(c, w, side) {
  const e = c.e;
  c.kit.spawnMinion({
    sprite: 'of_drone', name: 'ASSEMBLY DRONE', x: e.x + side * 30, y: e.y + 96, r: 9, hp: 8, score: 400, glow: [1, 0.5, 0.2],
    drops: w.rng.chance(0.3) ? ['M'] : null, data: { side, ph: w.rng.angle() },
    ai(m, c2, w2) {
      const d = m.data;
      if (m.t < 40) { m.y += 1.6; m.x += d.side * 1.2; return; }
      m.x += Math.sin(m.t * 0.04 + d.ph) * 1.6 + d.side * 0.3;
      m.y += 0.9;
      if (m.t % 60 === 20) P.aimed(w2, m.x, m.y, S.drone);
      m.rot = m.t * 0.1;
    },
  });
}

const armPart = (k, off) => ({
  label: 'ASSEMBLY ARM', sprite: 'of_arm', ox: ARMS[k][0], oy: ARMS[k][1], r: 14, hp: 85, medals: 3, score: 6500, bossDamage: 0.06, aim: true,
  attack(pe, c, w, t) { if ((t + off) % 120 < 30 && every(c, t, 6, off)) P.aimed(w, pe.x, pe.y, S.rivet, w.rng.range(-0.1, 0.1)); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.foundry, meta = { lights: [], treads: [], stacks: [], thrusters: [] };
  // Gantry chassis: an open square frame on four crawler bogies.
  for (const [x, y] of ARMS) { ctx.beginPath(); ctx.roundRect(x - 18, y - 24, 36, 48, 6); ctx.fillStyle = '#0c0a09'; ctx.fill(); ctx.strokeStyle = 'rgba(110,100,90,0.5)'; ctx.lineWidth = 1.4; for (let yy = y - 20; yy < y + 22; yy += 5) { ctx.beginPath(); ctx.moveTo(x - 16, yy); ctx.lineTo(x + 16, yy); ctx.stroke(); } }
  const frame = [0, -96, 86, -96, 96, -86, 96, 86, 86, 96, 0, 96];
  meta.lights.push(...body(ctx, pal, frame, [-96, -96, 192, 192], 'omegafoundry', { vents: 4, hazards: 3, pipes: 4, cables: 2, lights: 4 }));
  weather(ctx, () => mpoly(ctx, frame), 0.5);
  // Open bay in the centre: the press line over a glowing forge.
  ctx.beginPath(); ctx.rect(-50, -54, 100, 116); ctx.fillStyle = '#0a0706'; ctx.fill();
  const g = ctx.createRadialGradient(0, 10, 4, 0, 10, 60); g.addColorStop(0, 'rgba(255,170,60,0.95)'); g.addColorStop(0.5, 'rgba(200,60,10,0.6)'); g.addColorStop(1, 'rgba(60,10,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-50, -54, 100, 116);
  for (const x of PRESS_X) { ctx.beginPath(); ctx.rect(x - 16, -40, 32, 30); armour(ctx, pal, x - 16, x + 16, 2); hazard(ctx, pal, x - 16, -14, 32, 4); for (const s of [-1, 1]) pipe(ctx, pal, x + s * 12, -50, x + s * 12, -40, 3, false); }
  // Conveyor running out of the bay toward the front.
  ctx.beginPath(); ctx.rect(-14, 20, 28, 82); ctx.fillStyle = '#1a1612'; ctx.fill();
  ctx.strokeStyle = 'rgba(150,130,100,0.6)'; ctx.lineWidth = 1.2;
  for (let y = 24; y < 100; y += 5) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); }
  for (const y of [40, 70]) { circ(ctx, 0, y, 6); armour(ctx, { plate: ['#3a1a10', '#a05a30', '#e09060'] }, -6, 6); }
  // Gantry rails across the top with a travelling crane.
  for (const y of [-80, 80]) { ctx.beginPath(); ctx.rect(-96, y - 4, 192, 8); armour(ctx, pal, -96, 96); }
  ctx.beginPath(); ctx.rect(-12, -88, 24, 176); ctx.globalAlpha = 0.85; armour(ctx, { plate: ['#3a2a08', '#c89a20', '#f0d060'] }, -12, 12); ctx.globalAlpha = 1;
  // Exhaust stacks at the rear corners.
  both((s) => { circ(ctx, s * 60, -90, 7); ctx.fillStyle = '#0a0808'; ctx.fill(); meta.stacks.push([s * 60, -90]); meta.thrusters.push([s * 30, -98]); });
  turbine(ctx, pal, 0, -72, 12, 10);
  keyLight(ctx, -110, -110, 110, 110, 1);
  core(ctx, pal, 0, 10, 9, '#ff6a10');
  for (const [x, y] of ARMS) meta.lights.push({ x, y, c: '#ffa040', ph: (x * 3 + y) * 0.01 });
  return meta;
}

function armArt(ctx, w, h) {
  const pal = PALS.foundry, cx = w / 2, cy = h / 2;
  circ(ctx, cx, cy, w * 0.36); armour(ctx, pal, 0, w);
  ctx.beginPath(); ctx.rect(cx - 3, cy, 6, h * 0.5); armour(ctx, pal, cx - 3, cx + 3);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 2, h - 6); ctx.lineTo(cx + s * 7, h - 1); ctx.lineWidth = 2; ctx.strokeStyle = '#8a7c70'; ctx.stroke(); }
  hazard(ctx, pal, cx - 6, cy - 2, 12, 3);
  keyLight(ctx, 0, 0, w, h);
}

function droneArt(ctx, w, h) {
  const pal = PALS.foundry, cx = w / 2, cy = h / 2;
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w * 0.45, cy + Math.sin(a) * h * 0.45); ctx.lineWidth = 2; ctx.strokeStyle = '#6a5e54'; ctx.stroke(); circ(ctx, cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.42, 2.6); ctx.fillStyle = '#2a2420'; ctx.fill(); }
  circ(ctx, cx, cy, w * 0.22); armour(ctx, pal, 0, w);
  glowDot(ctx, cx, cy, 2, 'rgba(255,120,40,1)');
}

export default {
  id: 'omega_foundry',
  name: 'OMEGA FOUNDRY',
  title: 'AUTONOMOUS WEAPONS PLATFORM',
  archetype: 'mecha',
  sprite: 'b_omegafoundry', scale: 1, r: 58, glow: [1, 0.5, 0.15], score: 150000,
  deathSequence: 'meltdown',
  art(add) {
    add('b_omegafoundry', 216, 216, hull('b_omegafoundry', hullArt));
    add('of_arm', 28, 34, armArt, 2.5);
    add('of_drone', 22, 22, droneArt, 2.5);
  },
  look: {
    faction: 'helix', anim: 'titan',
    weak: { x: 0, y: 10, r: 20, rgb: [1, 0.5, 0.15] },
    shadow: { dx: 18, dy: 28, a: 0.3 },
    sites: [[-60, -40], [60, 40], [-26, -26], [26, -26], [-70, 70], [70, -70]],
  },
  parts: { armFL: armPart(2, 0), armFR: armPart(3, 30), armRL: armPart(0, 60), armRR: armPart(1, 90) },
  desperation: { name: 'OVERPRODUCTION' },

  phases: [
    {
      name: 'HYDRAULIC PRESSES', hp: 760, arena: 'of_reactor_complex', transitionFx: 'flash',
      move: { type: 'hover', amp: 70, y: 135, freq: 0.006 }, parts: ['armFL', 'armFR'],
      patterns: ['presses', 'weldArc'], musicLayer: 'mecha_p1',
    },
    {
      name: 'ASSEMBLY LINE', hp: 810, arena: 'of_assembly_line', transitionFx: 'screen_tear',
      move: { type: 'sweep', amp: 80, y: 135, freq: 0.007 },
      patterns: ['assemble', 'gears'], musicLayer: 'mecha_p2',
    },
    {
      name: 'SLAG POUR', hp: 850, arena: 'of_robot_scrapyard', transitionFx: 'flash',
      move: { type: 'hover', amp: 90, y: 135, freq: 0.008 }, parts: ['armRL', 'armRR'],
      patterns: ['presses', 'assemble', 'slag'], musicLayer: 'mecha_p3',
    },
    {
      name: 'ARC WELDERS', hp: 890, arena: 'of_orbital_factory', transitionFx: 'warp_tunnel',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 135, freq: 0.008 }, parts: ['armFL', 'armFR', 'armRL', 'armRR'],
      patterns: ['weldArc', 'gears'], musicLayer: 'mecha_p4',
    },
    {
      name: 'CORE FORGE', hp: 970, arena: 'of_core_forge', transitionFx: 'lava_flood',
      move: { type: 'hover', amp: 100, y: 135, freq: 0.009 }, intensity: 1.1,
      patterns: ['presses', 'assemble', 'slag', 'weldArc'], musicLayer: 'mecha_p5',
    },
  ],

  attacks: {
    // Presses: the press heads slam two telegraphed lanes; each impact rings.
    presses(c, w, t) {
      if (!every(c, t, 150)) return;
      const n = c.mk >= 2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const x = clamp(k === 0 ? w.aimX : w.rng.range(50, W - 50), 40, W - 40), y = clamp(w.aimY + w.rng.range(-40, 40), 220, H - 40);
        c.kit.hazard({ type: 'lane', x, w: 54, warn: 60 + k * 10, fire: 12, color: [1, 0.45, 0.15],
          onFire: (h, w2) => { P.ring(w2, h.x, y, S.press, w2.rng.angle()); w2.g.camera.addTrauma(0.1); const fx = w2.arena && w2.arena.fx; if (fx) fx.impact(h.x, y, 24); } });
      }
    },
    // Weld arc: a plasma beam sweeps across, showering sparks.
    weldArc(c, w, t) {
      if (t % 230 === 40) { const dir = w.rng.sign(); P.laser(w, c.e, DOWN - dir * 0.7, { warn: 50, fire: 110, width: 10, ox: 0, oy: 60, angVel: dir * 0.012, rgb: [0.6, 0.8, 1] }); }
      if ((t % 230) > 90 && (t % 230) < 200 && every(c, t, 10)) P.fan(w, c.e.x, c.e.y + 60, DOWN + w.rng.range(-0.8, 0.8), S.spark);
    },
    assemble(c, w, t) { if (every(c, t, 130, 30)) { buildDrone(c, w, -1); buildDrone(c, w, 1); } },
    slag(c, w, t) { if (every(c, t, 30)) P.shoot(w, w.rng.range(30, W - 30), -12, DOWN + w.rng.range(-0.1, 0.1), S.slag.speed, S.slag); },
    gears(c, w, t) { if (every(c, t, 10)) P.spiral(w, c.e, S.gear, 'gear'); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.01) * 0.01; },
};
