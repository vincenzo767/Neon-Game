import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, limb, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe, weather, body, camo, turret } from '../roster/art.js';

// MECHA — SANDSTORM JUGGERNAUT (desert assault mecha)
// A reverse-jointed artillery walker in desert tan: a wedge-shaped hull
// slung low between digitigrade legs, a long-barrelled howitzer along the
// spine, twin rocket-artillery racks on the hips and dust skirts over its
// feet. It is a mobile gun line — rocket barrages saturate the range,
// howitzer shells arrive where the player is going, and when it charges
// it drags a dust storm behind it.
// Arenas: the weapons-testing range → a mock target town → a dry lakebed
// impact range → a missile-silo field → the sandstorm.

const S = {
  rocket: { shape: 'kunai', color: 'orange', n: 1, speed: 3.2, fixed: true },
  shell: { shape: 'orb', color: 'red', n: 12, speed: 1.9 },
  scatter: { shape: 'orb', color: 'orange', n: 7, spread: 0.9, speed: 2.4 },
  coax: { shape: 'rice', color: 'yellow', n: 2, spread: 0.1, speed: 3.6 },
  dust: { shape: 'rice', color: 'orange', n: 4, speed: 2, turn: 0.24 },
  dustB: { shape: 'rice', color: 'yellow', n: 4, speed: 2, turn: -0.2 },
  grit: { shape: 'rice', color: 'yellow', n: 2, speed: 2.6 },
};

const GUN_Y = 124;

const rack = (ox, off) => ({
  label: 'ROCKET RACK', sprite: 'sj_rack', ox, oy: -16, r: 14, hp: 95, medals: 3, score: 7000, bossDamage: 0.07,
  attack(pe, c, w, t) {
    // Ripple fire: a staggered salvo arcing up then raining down.
    if ((t + off) % 150 < 36 && (t + off) % 6 === 0) {
      const x = clamp(w.aimX + w.rng.range(-90, 90), 20, W - 20);
      P.shoot(w, x, -12, DOWN + w.rng.range(-0.06, 0.06), S.rocket.speed, S.rocket);
      w.explosions.sparks(pe.x, pe.y, 3, [1, 0.7, 0.3], 3, 10, 2);
    }
  },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.sand, meta = { lights: [], treads: [], stacks: [], thrusters: [] };
  // Digitigrade legs: hip forward, knee back, long shin, splayed toes.
  both((s) => {
    limb(ctx, pal, s * 42, 10, s * 78, -30, 22);
    limb(ctx, pal, s * 78, -30, s * 70, 50, 16);
    circ(ctx, s * 78, -30, 11); armour(ctx, pal, s * 78 - 11, s * 78 + 11);
    for (const a of [-0.5, 0, 0.5]) limb(ctx, pal, s * 70, 50, s * 70 + Math.sin(a) * 22, 50 + Math.cos(a) * 22, 8);
    ctx.beginPath(); ctx.ellipse(s * 70, 54, 20, 12, 0, 0, TAU); ctx.fillStyle = 'rgba(150,120,80,0.35)'; ctx.fill();
  });
  // Wedge hull.
  const hullPts = [0, 76, 30, 64, 52, 20, 56, -40, 40, -76, 0, -82];
  meta.lights.push(...body(ctx, pal, hullPts, [-56, -82, 112, 158], 'juggernaut', { vents: 3, hazards: 1, pipes: 1 }));
  camo(ctx, () => mpoly(ctx, hullPts), ['#d8bc8a', '#9a7c52', '#6e5636', '#e8d4a8'], 41, 22, 16);
  weather(ctx, () => mpoly(ctx, hullPts), 0.45);
  // Sand skirts hanging off the hull sides.
  both((s) => { for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.rect(s * 52 - (s > 0 ? 0 : 8), -36 + k * 14, 8, 12); armour(ctx, { plate: ['#3a2c1a', '#b89a6a', '#e8d4a8'] }, -60, 60); } });
  // Spine howitzer with muzzle brake and recoil cylinders.
  ctx.beginPath(); ctx.rect(-5, -20, 10, GUN_Y + 14); armour(ctx, pal, -5, 5);
  ctx.beginPath(); ctx.rect(-8, GUN_Y - 12, 16, 12); armour(ctx, pal, -8, 8);
  ctx.fillStyle = '#060403'; ctx.fillRect(-2.5, GUN_Y - 4, 5, 4);
  both((s) => pipe(ctx, pal, s * 9, -10, s * 9, 40, 2.4));
  turret(ctx, pal, 0, -14, 24, 0);
  // Engine deck: exhausts and the reactor.
  vent(ctx, pal, -30, -74, 60, 12, 0.35, false);
  both((s) => { circ(ctx, s * 26, -60, 6); ctx.fillStyle = '#120c06'; ctx.fill(); meta.stacks.push([s * 26, -60]); meta.thrusters.push([s * 34, -80]); });
  // Sensor head at the prow.
  ctx.beginPath(); ctx.roundRect(-14, 56, 28, 18, 5); armour(ctx, pal, -14, 14);
  for (const x of [-7, 0, 7]) glowDot(ctx, x, 70, 2, 'rgba(255,160,60,1)');
  keyLight(ctx, -110, -100, 110, 130, 1);
  core(ctx, pal, 0, -44, 7, '#ff8a3a');
  meta.lights.push({ x: -7, y: 70, c: '#ffa040', ph: 0 }, { x: 7, y: 70, c: '#ffa040', ph: 0.3 });
  return meta;
}

function rackArt(ctx, w, h) {
  const pal = PALS.sand;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 3); armour(ctx, pal, 0, w);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { circ(ctx, 7 + i * 7, 6 + j * 6.5, 2.4); ctx.fillStyle = '#100a04'; ctx.fill(); }
  hazard(ctx, pal, 3, h - 5, w - 6, 3);
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'sandstorm_juggernaut',
  name: 'SANDSTORM JUGGERNAUT',
  title: 'DESERT ASSAULT MECHA',
  archetype: 'mecha',
  sprite: 'b_juggernaut', scale: 1, r: 50, glow: [1, 0.65, 0.3], score: 150000,
  deathSequence: 'meltdown',
  art(add) {
    add('b_juggernaut', 220, 264, hull('b_juggernaut', hullArt));
    add('sj_rack', 30, 34, rackArt, 2.5);
  },
  look: {
    faction: 'helix', anim: 'titan',
    weak: { x: 0, y: -44, r: 16, rgb: [1, 0.6, 0.25] },
    shadow: { dx: 22, dy: 34, a: 0.32 },
    sites: [[-30, -40], [30, 10], [-70, 50], [70, 50], [0, 60], [-40, -70]],
  },
  parts: { rackL: rack(-44, 0), rackR: rack(44, 75) },
  desperation: { name: 'DUST TO DUST' },

  phases: [
    {
      name: 'HOWITZER', hp: 740, arena: 'sj_test_range', transitionFx: 'flash',
      move: { type: 'sweep', amp: 110, y: 130, freq: 0.01 }, parts: ['rackL', 'rackR'],
      patterns: ['howitzer', 'coaxBursts'], musicLayer: 'mecha_p1',
    },
    {
      name: 'SCATTER SHELLS', hp: 790, arena: 'sj_target_town', transitionFx: 'sandstorm',
      move: { type: 'hover', amp: 100, y: 130, freq: 0.009 },
      patterns: ['scatterShells', 'charge'], musicLayer: 'mecha_p2',
    },
    {
      name: 'DUST DEVIL', hp: 830, arena: 'sj_lakebed_range', transitionFx: 'flash',
      move: { type: 'sweep', amp: 120, y: 130, freq: 0.011 }, parts: ['rackL', 'rackR'],
      patterns: ['howitzer', 'dustDevil'], musicLayer: 'mecha_p3',
    },
    {
      name: 'SILO SALVO', hp: 870, arena: 'sj_silo_field', transitionFx: 'screen_tear',
      move: { type: 'figure8', amp: 100, ampY: 25, y: 130, freq: 0.009 }, parts: ['rackL', 'rackR'],
      patterns: ['scatterShells', 'charge', 'coaxBursts'], musicLayer: 'mecha_p4',
    },
    {
      name: 'THE SANDSTORM', hp: 950, arena: 'sj_sandstorm', transitionFx: 'sandstorm',
      move: { type: 'sweep', amp: 130, y: 130, freq: 0.012 }, intensity: 1.1,
      patterns: ['howitzer', 'dustDevil', 'charge', 'grit'], musicLayer: 'mecha_p5',
    },
  ],

  attacks: {
    // Howitzer: shells land where the player is heading (lead the target).
    howitzer(c, w, t) {
      if (!every(c, t, 85)) return;
      const p = w.player, vx = p ? (p.x - (p.px ?? p.x)) * 35 : 0, vy = p ? (p.y - (p.py ?? p.y)) * 35 : 0;
      artillery(c, w.aimX + vx, w.aimY + vy, 46, 60, S.shell);
      w.explosions.sparks(c.e.x, c.e.y + GUN_Y, 8, [1, 0.7, 0.3], 4, 14, 3);
      w.g.camera.addTrauma(0.08);
    },
    scatterShells(c, w, t) { if (every(c, t, 50)) P.fan(w, c.e.x, c.e.y + GUN_Y, w.aimAngle(c.e.x, c.e.y + GUN_Y), S.scatter); },
    coaxBursts(c, w, t) { if ((t % 70) < 30 && every(c, t, 5)) P.aimed(w, c.e.x, c.e.y + 70, S.coax); },
    // Charge: a dash down a telegraphed lane, dragging dust behind.
    charge(c, w, t) {
      const k = t % 320;
      if (k === 0) { c.data.cx = clamp(w.aimX, 80, W - 80); c.kit.hazard({ type: 'lane', x: c.data.cx, w: 130, warn: 60, fire: 40, color: [1, 0.65, 0.3] }); }
      c.data.charging = k < 130;
      if (k < 60) { c.mx = c.data.cx; c.my = 110; c.ease = 0.08; }
      else if (k < 100) { c.mx = c.data.cx; c.my = H - 80; c.ease = 0.14; if (k % 3 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 60, c.e.y, DOWN + s * 1.4, 2, S.grit); w.g.camera.addTrauma(0.04); }
      else if (k < 130) { c.mx = c.data.cx; c.my = 130; c.ease = 0.05; }
    },
    // Dust devils: counter-rotating sand spirals and a well that drags bullets.
    dustDevil(c, w, t) {
      if (every(c, t, 8)) { P.spiral(w, c.e, S.dust, 'dust'); P.spiral(w, c.e, S.dustB, 'dustB'); }
      if (t % 280 === 0) c.kit.well({ x: w.rng.range(120, W - 120), y: w.rng.range(H * 0.35, H * 0.6), r: 150, strength: 0.02, life: 220 });
    },
    grit(c, w, t) { if (every(c, t, 4)) P.shoot(w, -8, w.rng.range(30, H * 0.8), 0.15 + w.rng.range(-0.05, 0.05), 2.8, S.grit); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.002 + Math.sin(c.w.t * 0.12) * 0.008; },
};
