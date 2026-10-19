import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W } from '../util.js';
import { PALS, hull, body, armour, both, keyLight, limb, circ, mpoly, camo, hazard, vent, core, turret, rivetRow } from '../roster/art.js';
import { mini } from './common.js';

// MECHA mini-bosses — walking machines. They stand on the ground: a tight
// contact shadow (no drop shadow at altitude), broad feet planted under the
// hull, stomps that shake the floor. A desert scout walker, a cryo walker at
// the weapons facility, a lancer frame in the ruined district, an assembly
// drone rig in the reactor complex and a riot frame on the corporate plaza.

const STAND = { dx: 10, dy: 14, a: 0.42 }; // grounded contact shadow

/** Top-down walker: two feet + legs, a hull, two arms ending in weapons. */
function walker(ctx, pal, o, seed) {
  const m = { lights: [], thrusters: [] };
  // Feet (planted, seen past the hull) and legs.
  both((s) => {
    ctx.beginPath(); ctx.roundRect(s * o.foot - 12, o.fy - 18, 24, 36, 6); armour(ctx, pal, s * o.foot - 12, s * o.foot + 12, 1);
    for (const dy of [-12, 12]) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s * o.foot - 10, o.fy + dy - 1, 20, 2); }
    limb(ctx, pal, s * o.hip, 0, s * o.foot, o.fy, 14);
  });
  m.lights.push(...body(ctx, pal, o.hull, o.rect, seed, { vents: 2, hazards: 1, pipes: 1 }));
  // Arms out to the sides, weapons pointing forward (+y).
  both((s) => {
    limb(ctx, pal, s * o.sh, 0, s * o.arm, 16, 12);
    ctx.beginPath(); ctx.roundRect(s * o.arm - o.gw / 2, 6, o.gw, o.gl, 4); armour(ctx, pal, s * o.arm - o.gw / 2, s * o.arm + o.gw / 2, 1);
    ctx.fillStyle = '#060606'; ctx.fillRect(s * o.arm - 2.5, 6 + o.gl - 3, 5, 3);
    circ(ctx, s * o.sh, 0, 11); armour(ctx, pal, s * o.sh - 11, s * o.sh + 11, 2);
  });
  return m;
}

// ============================================================ SCOUT WALKER

const SW = {
  mg: { shape: 'rice', color: 'orange', n: 1, speed: 4, fixed: true },
  stomp: { shape: 'orb', color: 'yellow', n: 18, speed: 1.9 },
  rocket: { shape: 'kunai', color: 'red', n: 4, spread: 0.6, speed: 3 },
};

function scoutArt(ctx) {
  const pal = PALS.sand;
  const m = walker(ctx, pal, { foot: 30, fy: -34, hip: 14, sh: 30, arm: 44, gw: 10, gl: 34, hull: [0, 34, 18, 30, 24, 10, 22, -26, 12, -34, 0, -36], rect: [-24, -36, 48, 70] }, 'mb_scout');
  camo(ctx, () => mpoly(ctx, [0, 34, 18, 30, 24, 10, 22, -26, 12, -34, 0, -36]), ['rgba(150,110,60,0.5)', 'rgba(220,190,140,0.45)'], 9, 14, 9);
  ctx.beginPath(); ctx.ellipse(0, 12, 12, 9, 0, 0, Math.PI * 2); armour(ctx, pal, -12, 12, 1);
  ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.fillRect(-6, 17, 12, 2); // sensor slit
  both((s) => { ctx.beginPath(); ctx.rect(s * 16 - 6, -26, 12, 16); armour(ctx, pal, s * 16 - 6, s * 16 + 6); for (let k = 0; k < 2; k++) { circ(ctx, s * 16 - 2 + k * 4, -14, 1.6); ctx.fillStyle = '#0a0806'; ctx.fill(); } });
  keyLight(ctx, -56, -52, 56, 44);
  return m;
}

const scout = mini({
  id: 'mb_scout_walker', name: 'JACKAL', title: 'DESERT SCOUT WALKER', archetype: 'mecha',
  sprite: 'mb_scout_walker', r: 30, deathSequence: 'chain_explode',
  art(add) { add('mb_scout_walker', 116, 108, hull('mb_scout_walker', scoutArt)); },
  look: { faction: 'helix', anim: 'titan', weak: { x: 0, y: 12, r: 11, rgb: [1, 0.6, 0.2] }, shadow: STAND, sites: [[-30, 0], [30, 0], [0, 20], [0, -20]] },
  phases: [
    { name: 'RANGE PATROL', hp: 270, move: { type: 'sweep', amp: 150, y: 160, freq: 0.008 }, patterns: ['mg', 'rockets'] },
    { name: 'STOMP', hp: 300, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['stomp', 'mg'] },
    { name: 'FULL STRIDE', hp: 330, move: { type: 'sweep', amp: 170, y: 160, freq: 0.01 }, intensity: 1.15, patterns: ['mg', 'stomp', 'rockets'] },
  ],
  attacks: {
    mg(c, w, t) { if ((t % 80) < 30 && t % 3 === 0) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 44, c.e.y + 40, w.aimAngle(c.e.x + s * 44, c.e.y + 40), SW.mg.speed, SW.mg); },
    rockets(c, w, t) { if (every(c, t, 90, 30)) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 16, c.e.y - 14, DOWN + s * 0.3, SW.rocket); },
    stomp(c, w, t) { if (every(c, t, 100)) { P.ring(w, c.e.x, c.e.y + 20, SW.stomp, w.rng.angle()); w.g.camera.addTrauma(0.12); if (w.arena && w.arena.fx) w.arena.fx.impact(c.e.x, c.e.y - 30, 18); } },
  },
});

// ============================================================= CRYO WALKER

const CW = {
  spray: { shape: 'rice', color: 'cyan', n: 3, spread: 0.3, speed: 3 },
  spike: { shape: 'kunai', color: 'white', n: 12, speed: 2.2 },
  frost: { shape: 'bigorb', color: 'blue', n: 1, speed: 2.2, accel: -0.03, minSpd: 0.3, splitAt: 60, fixed: true, split: { shape: 'rice', color: 'cyan', n: 10, speed: 2 } },
};

function cryoArt(ctx) {
  const pal = PALS.frost;
  const m = walker(ctx, pal, { foot: 36, fy: -40, hip: 18, sh: 36, arm: 52, gw: 14, gl: 30, hull: [0, 40, 22, 36, 30, 12, 28, -32, 14, -42, 0, -44], rect: [-30, -44, 60, 84] }, 'mb_cryo');
  // Coolant tanks on the back, frosted vents, cryo nozzles on the arms.
  both((s) => { ctx.beginPath(); ctx.roundRect(s * 14 - 8, -40, 16, 28, 7); armour(ctx, pal, s * 14 - 8, s * 14 + 8, 2); ctx.fillStyle = 'rgba(120,210,255,0.7)'; ctx.fillRect(s * 14 - 2, -36, 4, 20); });
  vent(ctx, pal, -10, 0, 20, 10, 0.5);
  core(ctx, pal, 0, 20, 6, '#7ad8ff');
  hazard(ctx, pal, -20, 34, 40, 3);
  keyLight(ctx, -66, -60, 66, 50);
  return m;
}

const cryo = mini({
  id: 'mb_cryo_walker', name: 'PERMAFROST', title: 'CRYO ASSAULT WALKER', archetype: 'mecha',
  sprite: 'mb_cryo_walker', r: 34, deathSequence: 'chain_explode',
  art(add) { add('mb_cryo_walker', 136, 120, hull('mb_cryo_walker', cryoArt)); },
  look: { faction: 'helix', anim: 'titan', weak: { x: 0, y: 20, r: 12, rgb: [0.5, 0.9, 1] }, shadow: STAND, sites: [[-36, 0], [36, 0], [0, 30], [0, -30]] },
  phases: [
    { name: 'COOLANT VENT', hp: 280, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['spray', 'frost'] },
    { name: 'ICE SPIKES', hp: 310, move: { type: 'sweep', amp: 140, y: 160, freq: 0.007 }, patterns: ['spikes', 'spray'] },
    { name: 'ABSOLUTE ZERO', hp: 340, move: { type: 'hover', amp: 130, y: 155 }, intensity: 1.15, patterns: ['spray', 'spikes', 'frost'] },
  ],
  attacks: {
    spray(c, w, t) { if ((t % 90) < 45 && t % 4 === 0) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 52, c.e.y + 36, w.aimAngle(c.e.x, c.e.y) + Math.sin(t * 0.08) * 0.3 * s, CW.spray); },
    spikes(c, w, t) { if (every(c, t, 110)) for (let k = 0; k < 3; k++) artillery(c, clamp(w.aimX + (k - 1) * 100, 40, W - 40), w.aimY - 30, 36, 60 + k * 10, CW.spike); },
    frost(c, w, t) { if (every(c, t, 75, 20)) P.shoot(w, c.e.x, c.e.y + 30, w.aimAngle(c.e.x, c.e.y), CW.frost.speed, CW.frost); },
  },
});

// ============================================================= LANCER FRAME

const LF = {
  blade: { shape: 'kunai', color: 'yellow', n: 9, spread: 1.4, speed: 2.6 },
  sun: { shape: 'orb', color: 'orange', n: 6, speed: 2.3, turn: 0.13 },
};

function lancerArt(ctx) {
  const pal = PALS.helios;
  const m = walker(ctx, pal, { foot: 26, fy: -42, hip: 12, sh: 28, arm: 40, gw: 8, gl: 20, hull: [0, 38, 14, 34, 22, 14, 20, -30, 10, -40, 0, -42], rect: [-22, -42, 44, 80] }, 'mb_lancer');
  // The lance: a long energy spear held forward in the right hand.
  ctx.beginPath(); ctx.rect(38, 10, 5, 76); armour(ctx, pal, 38, 43, 1);
  const g = ctx.createLinearGradient(0, 76, 0, 96); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(36, 80); ctx.lineTo(45, 80); ctx.lineTo(40.5, 98); ctx.closePath(); ctx.fill();
  // Shield on the left arm, sun-crest head.
  ctx.beginPath(); ctx.ellipse(-44, 26, 12, 22, 0, 0, Math.PI * 2); armour(ctx, pal, -56, -32, 2);
  ctx.beginPath(); ctx.ellipse(0, 16, 9, 8, 0, 0, Math.PI * 2); armour(ctx, pal, -9, 9, 1);
  ctx.fillStyle = 'rgba(255,220,120,0.95)'; ctx.fillRect(-5, 20, 10, 2);
  keyLight(ctx, -60, -60, 60, 98);
  return m;
}

const lancer = mini({
  id: 'mb_lancer_frame', name: 'DAWNSPEAR', title: 'LANCER COMBAT FRAME', archetype: 'mecha',
  sprite: 'mb_lancer_frame', r: 30, deathSequence: 'chain_explode',
  art(add) { add('mb_lancer_frame', 124, 200, hull('mb_lancer_frame', lancerArt)); },
  look: { faction: 'helix', anim: 'titan', weak: { x: 0, y: 16, r: 11, rgb: [1, 0.85, 0.4] }, shadow: STAND, sites: [[-30, 0], [30, 0], [0, 20], [0, -30]] },
  phases: [
    { name: 'SPEAR LINE', hp: 280, move: { type: 'hover', amp: 110, y: 150 }, patterns: ['lance', 'blades'] },
    { name: 'CHARGE', hp: 300, move: { type: 'sweep', amp: 140, y: 150, freq: 0.008 }, patterns: ['charge', 'blades'] },
    { name: 'SOLAR CREST', hp: 340, move: { type: 'hover', amp: 130, y: 150 }, intensity: 1.15, patterns: ['lance', 'charge', 'sun'] },
  ],
  attacks: {
    lance(c, w, t) { if (every(c, t, 120)) P.laser(w, c.e, w.aimAngle(c.e.x + 40, c.e.y + 90), { warn: 55, fire: 34, width: 14, ox: 40, oy: 90, rgb: [1, 0.85, 0.4] }); },
    blades(c, w, t) { if (every(c, t, 70, 30)) P.aimed(w, c.e.x, c.e.y + 40, LF.blade); },
    // Charge: marks the lane, then lunges down it and back.
    charge(c, w, t) {
      const k = t % 200;
      if (k === 0) { c.data.cx = clamp(w.aimX, 60, W - 60); c.kit.hazard({ type: 'lane', x: c.data.cx, w: 70, warn: 50, fire: 40, color: [1, 0.8, 0.3] }); }
      if (k >= 50 && k < 90) { c.mx = c.data.cx; c.my = 470; c.ease = 0.12; }
      if (k === 70) P.ring(w, c.e.x, c.e.y, LF.sun, w.rng.angle());
    },
    sun(c, w, t) { if ((t % 140) < 70 && every(c, t, 6)) P.spiral(w, c.e, LF.sun); },
  },
});

// ========================================================== ASSEMBLY DRONE

const AD = {
  rivets: { shape: 'rice', color: 'orange', n: 4, speed: 2.6, turn: 0.21 },
  sparks: { shape: 'orb', color: 'yellow', n: 5, spread: 0.7, speed: 2.8 },
  slag: { shape: 'bigorb', color: 'red', n: 1, speed: 1.8, accel: -0.02, minSpd: 0.2, splitAt: 80, fixed: true, split: { shape: 'orb', color: 'orange', n: 12, speed: 1.8 } },
};

function assemblyArt(ctx) {
  const pal = PALS.foundry, m = { lights: [], thrusters: [] };
  // A heavy gantry robot on four splayed legs, two welding arms, a crane hook.
  both((s) => { for (const fy of [-38, 34]) { limb(ctx, pal, s * 18, fy * 0.4, s * 46, fy, 10); ctx.beginPath(); ctx.roundRect(s * 46 - 9, fy - 9, 18, 18, 5); armour(ctx, pal, s * 46 - 9, s * 46 + 9, 1); } });
  m.lights.push(...body(ctx, pal, [0, 32, 22, 30, 28, 14, 28, -24, 20, -32, 0, -34], [-28, -34, 56, 66], 'mb_assembly', { vents: 3, hazards: 2, pipes: 2 }));
  both((s) => { limb(ctx, pal, s * 14, 10, s * 26, 48, 7); circ(ctx, s * 26, 52, 5); armour(ctx, pal, s * 26 - 5, s * 26 + 5); ctx.fillStyle = '#ffd060'; circ(ctx, s * 26, 58, 2); ctx.fill(); });
  turret(ctx, pal, 0, -6, 10, 1, 14, 3);
  rivetRow(ctx, pal, -24, -28, 24, -28, 4);
  core(ctx, pal, 0, 18, 5, '#ff7a1a');
  keyLight(ctx, -56, -48, 56, 60);
  return m;
}

const assembly = mini({
  id: 'mb_assembly_drone', name: 'FABRICATOR', title: 'ASSEMBLY GANTRY ROBOT', archetype: 'mecha',
  sprite: 'mb_assembly_drone', r: 32, deathSequence: 'meltdown',
  art(add) { add('mb_assembly_drone', 116, 120, hull('mb_assembly_drone', assemblyArt)); },
  look: { faction: 'helix', anim: 'titan', weak: { x: 0, y: 18, r: 11, rgb: [1, 0.5, 0.15] }, shadow: STAND, sites: [[-40, -30], [40, 30], [0, 20], [0, -20]] },
  phases: [
    { name: 'RIVET LINE', hp: 280, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['rivets', 'weld'] },
    { name: 'SLAG POUR', hp: 310, move: { type: 'sweep', amp: 130, y: 160, freq: 0.007 }, patterns: ['slag', 'rivets'] },
    { name: 'OVERTIME', hp: 340, move: { type: 'hover', amp: 130, y: 155 }, intensity: 1.15, patterns: ['rivets', 'weld', 'slag'] },
  ],
  attacks: {
    rivets(c, w, t) { if ((t % 130) < 80 && every(c, t, 5)) P.spiral(w, c.e, AD.rivets); },
    weld(c, w, t) {
      if (!every(c, t, 130, 40)) return;
      for (const s of [-1, 1]) P.laser(w, c.e, DOWN - s * 0.5, { warn: 50, fire: 60, width: 10, angVel: s * 0.01, ox: s * 26, oy: 58, rgb: [1, 0.85, 0.5] });
      P.aimed(w, c.e.x, c.e.y + 50, AD.sparks);
    },
    slag(c, w, t) { if (every(c, t, 80, 10)) for (const a of [-0.5, 0.5]) P.shoot(w, c.e.x, c.e.y + 20, DOWN + a, AD.slag.speed, AD.slag); },
  },
});

// =============================================================== RIOT FRAME

const RF = {
  gas: { shape: 'bigorb', color: 'green', n: 1, speed: 1.2, accel: -0.012, minSpd: 0.25, fixed: true },
  wall: { shape: 'rice', color: 'pink', n: 16, speed: 2.1, gap: 1 },
  slug: { shape: 'orb', color: 'red', n: 7, spread: 0.8, speed: 2.6 },
};

function riotArt(ctx) {
  const pal = PALS.steel;
  const m = walker(ctx, pal, { foot: 34, fy: -40, hip: 16, sh: 34, arm: 48, gw: 12, gl: 26, hull: [0, 40, 22, 36, 28, 14, 26, -32, 14, -42, 0, -44], rect: [-28, -44, 56, 84] }, 'mb_riot');
  // Full-width riot shield across the front, light bar, launchers on the shoulders.
  ctx.beginPath(); ctx.roundRect(-36, 40, 72, 12, 4); armour(ctx, pal, -36, 36, 2);
  ctx.fillStyle = 'rgba(160,200,230,0.35)'; ctx.fillRect(-30, 42, 60, 3);
  hazard(ctx, pal, -30, 48, 60, 3);
  both((s) => { ctx.fillStyle = s > 0 ? '#3a6aff' : '#ff3a3a'; ctx.fillRect(s * 8 - 4, -40, 8, 3); m.lights.push({ x: s * 8, y: -39, c: s > 0 ? '#3a6aff' : '#ff3a3a', ph: s > 0 ? 0 : 3 }); });
  both((s) => { ctx.beginPath(); ctx.rect(s * 34 - 7, -12, 14, 14); armour(ctx, pal, s * 34 - 7, s * 34 + 7); for (let k = 0; k < 3; k++) { circ(ctx, s * 34 - 4 + k * 4, -2, 1.5); ctx.fillStyle = '#0a0a0a'; ctx.fill(); } });
  keyLight(ctx, -62, -60, 62, 52);
  return m;
}

const riot = mini({
  id: 'mb_riot_frame', name: 'BULWARK', title: 'RIOT-CONTROL FRAME', archetype: 'mecha',
  sprite: 'mb_riot_frame', r: 34, deathSequence: 'chain_explode',
  art(add) { add('mb_riot_frame', 128, 116, hull('mb_riot_frame', riotArt)); },
  look: { faction: 'helix', anim: 'titan', weak: { x: 0, y: 10, r: 12, rgb: [0.5, 0.7, 1] }, shadow: STAND, sites: [[-34, 0], [34, 0], [0, 30], [0, -30]] },
  phases: [
    { name: 'CROWD LINE', hp: 290, move: { type: 'sweep', amp: 140, y: 160, freq: 0.007 }, patterns: ['wall', 'slugs'] },
    { name: 'GAS CANISTERS', hp: 310, move: { type: 'hover', amp: 110, y: 160 }, patterns: ['gas', 'slugs'] },
    { name: 'KETTLE', hp: 350, move: { type: 'hover', amp: 130, y: 155 }, intensity: 1.15, patterns: ['wall', 'gas', 'slugs'] },
  ],
  attacks: {
    wall(c, w, t) { if (every(c, t, 70)) P.curtain(w, RF.wall); },
    slugs(c, w, t) { if (every(c, t, 55, 20)) P.aimed(w, c.e.x, c.e.y + 50, RF.slug); },
    // Gas canisters: slow green clouds lobbed around the player — they linger and box you in.
    gas(c, w, t) { if (every(c, t, 40)) { const s = (t / 40) % 2 ? 1 : -1; P.shoot(w, c.e.x + s * 34, c.e.y, w.aimAngle(c.e.x, c.e.y) + s * w.rng.range(0.2, 0.6), RF.gas.speed, RF.gas); } },
  },
});

export default [scout, cryo, lancer, assembly, riot];
