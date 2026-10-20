import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, limb, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe, weather, body, camo } from '../roster/art.js';

// MECHA — FROSTFRAME COLOSSUS (heavy cold-weather combat machine)
// A squat, enormously heavy bipedal walker built for polar warfare: a
// hunched armoured torso with a heated cockpit, a coolant-fed cryo cannon
// on the right arm, a riot-shield arm with a hydraulic ram on the left,
// and a backpack reactor venting steam into the cold. It advances behind
// its shield, freezes lanes with the cryo beam and buries the field in
// frost mortars.
// Arenas: a frozen weapons facility → a glacier test site → a frozen rail
// depot → the cryo test hangar → a blizzard proving ground.

const S = {
  cryo: { shape: 'rice', color: 'cyan', n: 2, spread: 0.1, speed: 3.4 },
  shard: { shape: 'kunai', color: 'blue', n: 7, spread: 1.0, speed: 2.6 },
  mortar: { shape: 'orb', color: 'cyan', n: 10, speed: 1.7 },
  wall: { shape: 'bigorb', color: 'white', n: 12, speed: 1.4, gap: 1 },
  missile: { shape: 'kunai', color: 'blue', n: 1, speed: 2, homing: 0.04, homingTime: 70, accel: 0.04, maxSpd: 4.4, fixed: true },
  steam: { shape: 'orb', color: 'white', n: 1, speed: 1.2, accel: -0.015, minSpd: 0.2, fixed: true },
  bash: { shape: 'rice', color: 'blue', n: 13, spread: 1.7, speed: 2.4 },
};

const CANNON = [62, 92];      // muzzle of the cryo cannon (right arm)
const SHIELD = [-64, 60];

const pod = (ox, off) => ({
  label: 'MISSILE POD', sprite: 'ff_pod', ox, oy: -40, r: 13, hp: 90, medals: 3, score: 6500, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (!every(c, t, 110, off)) return;
    for (let k = 0; k < (c.mk >= 2 ? 4 : 3); k++) P.shoot(w, pe.x, pe.y, -Math.PI / 2 + (k - 1.5) * 0.4, S.missile.speed, S.missile);
  },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.frost, meta = { lights: [], treads: [], stacks: [], thrusters: [] };
  // Legs splayed under the torso (feet visible below/behind).
  both((s) => { limb(ctx, pal, s * 30, -30, s * 44, -86, 26); ctx.beginPath(); ctx.roundRect(s * 44 - 18, -104, 36, 26, 6); armour(ctx, pal, s * 44 - 18, s * 44 + 18); });
  // Backpack reactor with steam vents and thrusters.
  ctx.beginPath(); ctx.roundRect(-40, -78, 80, 44, 8); armour(ctx, pal, -40, 40, 2);
  vent(ctx, pal, -32, -72, 64, 10, 0.3, false);
  both((s) => { circ(ctx, s * 22, -54, 8); ctx.fillStyle = '#0e1216'; ctx.fill(); meta.stacks.push([s * 22, -54]); meta.thrusters.push([s * 30, -78]); });
  // Torso: hunched, broad, heavily plated.
  const torso = [0, -40, 40, -42, 58, -24, 60, 20, 48, 44, 22, 58, 0, 60];
  meta.lights.push(...body(ctx, pal, torso, [-60, -42, 120, 102], 'frostframe', { vents: 2, hazards: 1, pipes: 2 }));
  camo(ctx, () => mpoly(ctx, torso), ['#dfe6ee', '#8c98a8', '#5a6674', '#f4f8fb'], 31, 18, 14);
  weather(ctx, () => mpoly(ctx, torso), 0.3);
  // Frost build-up on the upper surfaces.
  ctx.save(); mpoly(ctx, torso); ctx.clip();
  for (let k = 0; k < 20; k++) { ctx.fillStyle = `rgba(240,248,255,${0.2 + (k % 3) * 0.1})`; ctx.beginPath(); ctx.ellipse(((k * 29) % 100) - 50, ((k * 43) % 90) - 40, 8, 4, k, 0, TAU); ctx.fill(); }
  ctx.restore();
  // Heated cockpit with a slit visor.
  ctx.beginPath(); ctx.roundRect(-16, 26, 32, 26, 6); armour(ctx, pal, -16, 16);
  ctx.fillStyle = '#ffb060'; ctx.globalAlpha = 0.85; ctx.fillRect(-11, 42, 22, 3); ctx.globalAlpha = 1;
  // Shoulders.
  both((s) => { ctx.beginPath(); ctx.ellipse(s * 62, -10, 26, 30, 0, 0, TAU); armour(ctx, pal, s * 62 - 26, s * 62 + 26, 2); rivetRow(ctx, pal, s * 50, -32, s * 74, -32, 6); });
  // Right arm: cryo cannon with coolant tanks and a ringed barrel.
  limb(ctx, pal, 62, 8, 62, 50, 24);
  ctx.beginPath(); ctx.rect(54, 46, 16, CANNON[1] - 46); armour(ctx, pal, 54, 70);
  for (let y = 54; y < CANNON[1] - 4; y += 8) { ctx.fillStyle = '#5ab8ff'; ctx.globalAlpha = 0.65; ctx.fillRect(53, y, 18, 2); ctx.globalAlpha = 1; }
  both((s) => { if (s > 0) { ctx.beginPath(); ctx.ellipse(84, 30, 9, 16, 0, 0, TAU); armour(ctx, { plate: ['#1a3a5a', '#5aa8e0', '#cfe8ff'] }, 75, 93); pipe(ctx, pal, 80, 44, 66, 60, 1.8); } });
  // Left arm: tower shield with a hydraulic ram.
  limb(ctx, pal, -62, 8, -62, 40, 24);
  ctx.beginPath(); ctx.moveTo(-96, 30); ctx.lineTo(-34, 30); ctx.lineTo(-30, 76); ctx.lineTo(-64, 92); ctx.lineTo(-100, 76); ctx.closePath();
  armour(ctx, pal, -100, -30, 2);
  hazard(ctx, pal, -94, 66, 60, 5);
  ctx.beginPath(); ctx.rect(-68, 40, 8, 30); ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.fill();
  keyLight(ctx, -110, -110, 110, 110, 1);
  core(ctx, pal, 0, -56, 8, '#5ad0ff');
  glowDot(ctx, CANNON[0], CANNON[1] - 2, 4, 'rgba(120,220,255,1)');
  meta.lights.push({ x: CANNON[0], y: CANNON[1] - 2, c: '#7ad8ff', ph: 0 }, { x: 0, y: 44, c: '#ffb060', ph: 0.5 });
  return meta;
}

function podArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 4); armour(ctx, pal, 0, w);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { circ(ctx, cx - 5 + i * 10, cy - 5 + j * 10, 3.4); ctx.fillStyle = '#0a1018'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'frostframe_colossus',
  name: 'FROSTFRAME COLOSSUS',
  title: 'HEAVY COLD-WEATHER COMBAT MACHINE',
  archetype: 'mecha',
  sprite: 'b_frostframe', scale: 1, r: 52, glow: [0.6, 0.9, 1], score: 150000,
  deathSequence: 'meltdown',
  art(add) {
    add('b_frostframe', 232, 236, hull('b_frostframe', hullArt));
    add('ff_pod', 26, 26, podArt, 2.5);
  },
  look: {
    faction: 'helix', anim: 'titan',
    weak: { x: 0, y: -56, r: 18, rgb: [0.45, 0.85, 1] },
    shadow: { dx: 20, dy: 30, a: 0.3 },
    sites: [[-40, -10], [40, 20], [62, 60], [-64, 60], [0, -56], [20, 40]],
  },
  parts: { podL: pod(-62, 0), podR: pod(62, 55) },
  desperation: { name: 'ABSOLUTE WINTER' },

  phases: [
    {
      name: 'CRYO BEAM', hp: 740, arena: 'ff_weapons_facility', transitionFx: 'flash',
      move: { type: 'hover', amp: 80, y: 135, freq: 0.007 }, parts: ['podL', 'podR'],
      patterns: ['cryoBeam', 'shardBurst'], musicLayer: 'mecha_p1',
    },
    {
      name: 'ICE WALL', hp: 790, arena: 'ff_glacier_site', transitionFx: 'ice_crack',
      move: { type: 'sweep', amp: 90, y: 135, freq: 0.008 },
      patterns: ['frostMortar', 'iceWall'], musicLayer: 'mecha_p2',
    },
    {
      name: 'SHIELD BASH', hp: 830, arena: 'ff_rail_depot', transitionFx: 'flash',
      move: { type: 'hover', amp: 90, y: 135, freq: 0.008 }, parts: ['podL', 'podR'],
      patterns: ['shieldBash', 'cryoBeam'], musicLayer: 'mecha_p3',
    },
    {
      name: 'STEAM VENTS', hp: 870, arena: 'ff_cryo_hangar', transitionFx: 'screen_tear',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 135, freq: 0.008 },
      patterns: ['frostMortar', 'steamVents', 'shardBurst'], musicLayer: 'mecha_p4',
    },
    {
      name: 'DEEP FREEZE', hp: 950, arena: 'ff_proving_ground', transitionFx: 'ice_crack',
      move: { type: 'hover', amp: 100, y: 135, freq: 0.009 }, intensity: 1.1,
      patterns: ['cryoBeam', 'iceWall', 'shieldBash', 'frostMortar'], musicLayer: 'mecha_p5',
    },
  ],

  attacks: {
    // Cryo beam: a telegraphed freezing beam that slowly tracks, shedding ice.
    cryoBeam(c, w, t) {
      if (t % 240 === 20) {
        const ang = w.aimAngle(c.e.x + CANNON[0], c.e.y + CANNON[1]);
        P.laser(w, c.e, ang - 0.25, { warn: 60, fire: 100, width: 12, ox: CANNON[0], oy: CANNON[1], angVel: 0.005, rgb: [0.55, 0.9, 1] });
      }
      if ((t % 240) > 80 && (t % 240) < 180 && every(c, t, 8)) P.aimed(w, c.e.x + CANNON[0], c.e.y + CANNON[1], S.cryo, w.rng.range(-0.3, 0.3));
    },
    shardBurst(c, w, t) { if (every(c, t, 55, 25)) P.fan(w, c.e.x + CANNON[0], c.e.y + CANNON[1], w.aimAngle(c.e.x + CANNON[0], c.e.y + CANNON[1]), S.shard); },
    frostMortar(c, w, t) {
      if (every(c, t, 70)) artillery(c, w.aimX + w.rng.range(-40, 40), w.aimY + w.rng.range(-40, 20), 42, 65, S.mortar);
    },
    // Ice wall: a slow rank of heavy ice with one gap — advance through it.
    iceWall(c, w, t) { if (every(c, t, 150, 70)) P.curtain(w, S.wall); },
    // Shield bash: step forward behind the shield, then a sweeping ram.
    shieldBash(c, w, t) {
      const k = t % 260;
      if (k === 0) {
        c.data.bx = clamp(w.aimX + 40, 100, W - 60);
        c.kit.hazard({ type: 'arc', follow: true, fx: SHIELD[0], fy: SHIELD[1], r: 200, a0: Math.PI * 0.95, a1: Math.PI * 0.2, warn: 55, fire: 20, color: [0.5, 0.85, 1],
          onFire: (h, w2) => { P.fan(w2, h.cx, h.cy, DOWN, S.bash); w2.g.camera.addTrauma(0.25); } });
      }
      if (k < 55) { c.mx = c.data.bx; c.my = 180; c.ease = 0.05; }
    },
    // Steam vents: the backpack dumps coolant steam that hangs in the air.
    steamVents(c, w, t) { if (every(c, t, 6)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 22, c.e.y - 54, -Math.PI / 2 + s * 0.9 + w.rng.range(-0.4, 0.4), S.steam.speed + w.rng.range(0, 0.6), S.steam); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.07) * 0.01; },
};
