import { WORLD_W, WORLD_H } from '../../core/constants.js';
import * as P from '../../patterns/index.js';
import { MOVERS } from './movers.js';
import { buildEnemySprites } from './art.js';

// Syndicate enemy roster — data definitions + factory.
//
// Definition fields:
//   name, sprite, sprite2 (overlay: turret barrel / rotor), r, hp, score
//   move: mover name (see movers.js) + mp: default mover params
//   fire: [{ start, every, fn(e, w), elite? }]  scheduled by the factory;
//         `every` is scaled by difficulty and elite status
//   update(e, w): per-step custom logic (aiming, multi-step bursts)
//   drops: [[itemKind, chance], ...]   big: break-apart death
//   ground, armor (damage multiplier), blast (explosion scale), glow
//   boss: shows the boss HP bar; phases: HP fractions for the bar segments

export { buildEnemySprites };

const PI = Math.PI;
const DOWN = PI / 2;

// ------------------------------------------------------------ pattern specs

const S = {
  droneFan: { shape: 'kunai', color: 'red', n: 3, spread: 0.36, speed: 3.0 },
  droneFan2: { shape: 'kunai', color: 'red', n: 5, spread: 0.9, speed: 2.4 },
  dartShot: { shape: 'kunai', color: 'pink', n: 1, speed: 4.6, fixed: true },
  carFan: { shape: 'rice', color: 'pink', n: 2, spread: 0.5, speed: 2.8 },
  turretStream: { shape: 'orb', color: 'red', n: 1, speed: 3.0, layers: 3, dSpeed: 0.45, fixed: true },
  flakRing: { shape: 'orb', color: 'orange', n: 12, speed: 2.0 },
  flakRing2: { shape: 'rice', color: 'yellow', n: 12, speed: 2.6 },
  truckFan: { shape: 'rice', color: 'orange', n: 5, spread: 0.8, speed: 2.6 },
  truckMortar: {
    shape: 'bigorb', color: 'red', n: 1, speed: 2.4, accel: -0.04, minSpd: 0, splitAt: 60, fixed: true,
    split: { shape: 'orb', color: 'red', n: 10, speed: 2.2 },
  },
  carrierCurtain: { shape: 'rice', color: 'blue', n: 14, speed: 2.2, gap: 1 },
  carrierSpiral: { shape: 'orb', color: 'violet', n: 5, speed: 2.2, turn: 0.25 },
  mine: {
    shape: 'bigorb', color: 'violet', n: 1, speed: 1.2, accel: -0.03, minSpd: 0, splitAt: 80, fixed: true,
    split: { shape: 'orb', color: 'violet', n: 8, speed: 2.4, random: true },
  },
  walkerSpiral: { shape: 'rice', color: 'yellow', n: 3, speed: 2.4, turn: 0.21 },
  gunshipStream: { shape: 'kunai', color: 'red', n: 1, speed: 4, fixed: true },
  sniperShot: { shape: 'kunai', color: 'white', n: 1, speed: 6.5, layers: 5, dSpeed: 0.6, fixed: true },
  spinnerRing: { shape: 'orb', color: 'orange', n: 6, speed: 2.4, turn: 0.3 },
  bugShot: { shape: 'orb', color: 'green', n: 1, speed: 2.6, fixed: true },
  bomberDrop: { shape: 'rice', color: 'blue', n: 1, speed: 1.6, accel: 0.03, maxSpd: 3.4, fixed: true },
  tankShot: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.2, layers: 3, dSpeed: 0.5, fixed: true },
  orbitRing: { shape: 'orb', color: 'green', n: 10, speed: 1.7 },
  splitShot: {
    shape: 'bigorb', color: 'yellow', n: 1, speed: 2.8, accel: -0.03, minSpd: 0.4, splitAt: 50, fixed: true,
    split: { shape: 'rice', color: 'yellow', n: 7, spread: 1.0, speed: 3, aimed: true },
  },
  seekerMissile: { shape: 'kunai', color: 'violet', n: 4, spread: 1.6, speed: 2.4, homing: 0.035, homingTime: 80, fixed: true },
  frigateFan: { shape: 'rice', color: 'cyan', n: 15, spread: 1.6, speed: 2.4 },
  frigateRing: { shape: 'bigorb', color: 'red', n: 12, speed: 1.6 },
  frigateSpiral: { shape: 'orb', color: 'pink', n: 4, speed: 2.6, turn: 0.17 },
  revenge: { shape: 'orb', color: 'white', n: 2, spread: 0.35, speed: 2.2 },
  // Mid-boss / boss placeholders.
  gateSpiral: { shape: 'orb', color: 'pink', n: 6, speed: 2.4, turn: 0.13 },
  gateAim: { shape: 'bigorb', color: 'orange', n: 5, spread: 0.7, speed: 2.2 },
  gateCurtain: { shape: 'rice', color: 'blue', n: 16, speed: 2.4, gap: 1 },
  coreSpiralA: { shape: 'orb', color: 'violet', n: 6, speed: 2.2, turn: 0.15 },
  coreSpiralB: { shape: 'rice', color: 'cyan', n: 6, speed: 4.2, accel: -0.05, angVel: 0.006, minSpd: 1.6, maxSpd: 4.2, turn: -0.09 },
  coreRing: { shape: 'bigorb', color: 'orange', n: 16, speed: 1.5 },
  coreRain: { shape: 'orb', color: 'yellow', n: 2, speed: 3, scale: 0.8 },
};

const aimTurret = (e, w) => { e.rot2 = w.aimAngle(e.x, e.y); };

// ---------------------------------------------------------------- roster

export const ENEMIES = {
  drone: {
    name: 'Patrol Drone', sprite: 'drone', r: 14, hp: 12, score: 300,
    move: 'dive', mp: { stopY: 120, hold: 160, exit: 'down' },
    drops: [['P', 0.25], ['M', 0.4]],
    fire: [
      { start: 50, every: 80, fn: (e, w) => P.aimed(w, e.x, e.y + 8, S.droneFan) },
      { start: 90, every: 80, elite: true, fn: (e, w) => P.aimed(w, e.x, e.y + 8, S.droneFan2) },
    ],
  },
  dart: {
    name: 'Dart Interceptor', sprite: 'e_dart', r: 11, hp: 6, score: 200, blast: 0.5,
    move: 'swoop', mp: { speed: 4.2, turn: 0.016, face: true },
    drops: [['M', 0.3]],
    fire: [{ start: 24, every: 36, fn: (e, w) => P.aimed(w, e.x, e.y + 10, S.dartShot) }],
  },
  car: {
    name: 'Syndicate Hover Car', sprite: 'e_car', r: 12, hp: 16, score: 400,
    move: 'straight', mp: { vy: 2.4 },
    drops: [['P', 0.2], ['M', 0.5]],
    fire: [{ start: 40, every: 55, fn: (e, w) => P.aimed(w, e.x, e.y + 14, S.carFan) }],
  },
  bike: {
    name: 'Suicide Bike', sprite: 'e_bike', r: 9, hp: 5, score: 250, blast: 0.6,
    move: 'chase', mp: { speed: 2, accel: 0.1, max: 7, turn: 0.05, lockAfter: 70 },
    drops: [['M', 0.3]],
    fire: [],
    onDeath: (e, w) => { if (e.elite || w.diff.revenge) P.ring(w, e.x, e.y, S.flakRing); },
  },
  turret: {
    name: 'Gun Turret', sprite: 'e_turret', sprite2: 'e_turret_gun', ground: true, r: 14, hp: 22, score: 500,
    move: 'ground', mp: {}, update: aimTurret,
    drops: [['P', 0.3], ['M', 0.4]],
    fire: [{ start: 40, every: 60, fn: (e, w) => P.stack(w, e.x, e.y, e.rot2, S.turretStream) }],
  },
  flak: {
    name: 'Flak Battery', sprite: 'e_flak', sprite2: 'e_flak_gun', ground: true, r: 16, hp: 34, score: 700,
    move: 'ground', mp: {}, update: aimTurret,
    drops: [['P', 0.35], ['M', 0.5]],
    fire: [
      { start: 50, every: 95, fn: (e, w) => P.ring(w, e.x, e.y, S.flakRing, e.rot2) },
      { start: 70, every: 95, elite: true, fn: (e, w) => P.ring(w, e.x, e.y, S.flakRing2, e.rot2 + 0.13) },
    ],
  },
  truck: {
    name: 'Armored Truck', sprite: 'e_truck', ground: true, r: 22, hp: 90, score: 1500, big: true,
    move: 'ground', mp: { vy: -0.7 },
    drops: [['P', 1], ['M', 1], ['M', 0.7], ['B', 0.12]],
    fire: [
      { start: 40, every: 100, fn: (e, w) => P.aimed(w, e.x, e.y - 12, S.truckMortar) },
      { start: 60, every: 50, fn: (e, w) => P.aimed(w, e.x, e.y + 30, S.truckFan) },
    ],
  },
  tank: {
    name: 'Hover Tank', sprite: 'e_tank', sprite2: 'e_tank_gun', ground: true, r: 18, hp: 55, score: 1000,
    move: 'ground', mp: { vy: -0.4, amp: 30, freq: 0.02 }, update: aimTurret,
    drops: [['P', 0.6], ['M', 0.8]],
    fire: [{ start: 50, every: 75, fn: (e, w) => P.stack(w, e.x, e.y, e.rot2, S.tankShot) }],
  },
  walker: {
    name: 'Shield Walker', sprite: 'e_walker', ground: true, r: 18, hp: 60, score: 1100, armor: 0.5,
    move: 'ground', mp: { vy: -0.3 },
    drops: [['P', 0.5], ['M', 0.8]],
    update: (e, w) => {
      // Spiral bursts: 60 steps on, 60 off.
      const k = (e.t - 40) % 120;
      if (e.t > 40 && k < 60 && k % 5 === 0 && e.y > 10 && e.y < WORLD_H * 0.75) P.spiral(w, e, S.walkerSpiral);
    },
    fire: [],
  },
  carrier: {
    name: 'Carrier Ship', sprite: 'e_carrier', r: 46, hp: 320, score: 6000, big: true,
    move: 'hover', mp: { stopY: 105, hold: 760, amp: 50 },
    drops: [['P', 1], ['P', 1], ['M', 1], ['M', 1], ['M', 1], ['B', 0.3], ['S', 0.3]],
    fire: [
      { start: 120, every: 220, fn: (e, w) => {
        for (const s of [-1, 1]) spawnEnemy(w, 'dart', e.x + s * 44, e.y + 10, { dir: s, ang: DOWN + s * 0.4 });
      } },
      { start: 80, every: 110, fn: (e, w) => P.curtain(w, S.carrierCurtain) },
      { start: 60, every: 8, fn: (e, w) => { if ((e.t >> 6) & 1) P.spiral(w, e, S.carrierSpiral); } },
    ],
  },
  minelayer: {
    name: 'Mine Layer', sprite: 'e_minelayer', r: 18, hp: 30, score: 800,
    move: 'strafe', mp: { speed: 1.6 },
    drops: [['P', 0.4], ['M', 0.6]],
    update: (e) => { e.rot = e.t * 0.03; },
    fire: [{ start: 20, every: 32, fn: (e, w) => P.shoot(w, e.x, e.y + 10, DOWN, 1.2, S.mine) }],
  },
  gunship: {
    name: 'Heli Gunship', sprite: 'e_gunship', sprite2: 'e_rotor', r: 22, hp: 80, score: 1800,
    move: 'hover', mp: { stopY: 140, hold: 420, amp: 70, freq: 0.018 },
    drops: [['P', 0.8], ['M', 1], ['M', 0.6]],
    update: (e, w) => {
      e.rot2 = e.t * 0.6;
      const d = e.data;
      if (d.sweep > 0) {
        d.sweep--;
        if (d.sweep % 3 === 0) P.shoot(w, e.x, e.y + 30, DOWN + Math.sin(d.sweep * 0.17) * 0.8, 4, S.gunshipStream);
      }
    },
    fire: [{ start: 60, every: 120, fn: (e) => { e.data.sweep = 40; } }],
  },
  sniper: {
    name: 'Sniper Pod', sprite: 'e_sniper', r: 12, hp: 18, score: 600,
    move: 'dive', mp: { stopY: 70, hold: 260, exit: 'up' },
    drops: [['M', 0.6]],
    update: (e, w) => {
      const d = e.data;
      if (d.snipeAt === e.t && d.L) {
        P.fan(w, e.x, e.y + 18, d.L.ang, S.sniperShot);
        d.L = null;
      }
    },
    fire: [{ start: 30, every: 130, fn: (e, w) => {
      e.data.L = w.enemyLaser(e, w.aimAngle(e.x, e.y), { warn: 45, fire: 0, width: 2, track: true, rgb: [1, 0.9, 0.9], oy: 18 });
      e.data.snipeAt = e.t + 45;
    } }],
  },
  laserpod: {
    name: 'Laser Drone', sprite: 'e_laserpod', r: 16, hp: 40, score: 900,
    move: 'dive', mp: { stopY: 100, hold: 330, sway: 0.3 },
    drops: [['P', 0.5], ['M', 0.6]],
    fire: [{ start: 40, every: 190, fn: (e, w) => {
      const side = e.x < WORLD_W / 2 ? 1 : -1;
      P.laser(w, e, DOWN - side * 0.35, { warn: 55, fire: 80, width: 18, angVel: side * 0.008, oy: 8 });
    } }],
  },
  spinner: {
    name: 'Spinner Mine', sprite: 'e_spinner', r: 13, hp: 20, score: 450,
    move: 'sine', mp: { speed: 1.5, amp: 60, freq: 0.03 },
    drops: [['M', 0.5]],
    update: (e) => { e.rot += 0.15; },
    fire: [{ start: 30, every: 22, fn: (e, w) => P.spiral(w, e, S.spinnerRing) }],
  },
  bug: {
    name: 'Swarm Bug', sprite: 'e_bug', r: 7, hp: 3, score: 80, blast: 0.35,
    move: 'sine', mp: { speed: 2.4, amp: 40, freq: 0.06 },
    drops: [['M', 0.12]],
    fire: [{ start: 40, every: 90, elite: true, fn: (e, w) => P.aimed(w, e.x, e.y, S.bugShot) }],
  },
  bomber: {
    name: 'Syndicate Bomber', sprite: 'e_bomber', r: 24, hp: 70, score: 1600,
    move: 'strafe', mp: { speed: 1.7, face: true },
    drops: [['P', 0.7], ['M', 1], ['M', 0.6]],
    fire: [{ start: 10, every: 9, fn: (e, w) => P.shoot(w, e.x - 4 * (e.p.dir || 1), e.y + 6, DOWN, 1.6, S.bomberDrop) }],
  },
  orbiter: {
    name: 'Shield Orbiter', sprite: 'e_orbiter', r: 13, hp: 16, score: 500,
    move: 'orbit', mp: { radius: 60, speed: 0.03, drift: 0.55 },
    drops: [['M', 0.5]],
    fire: [{ start: 50, every: 70, fn: (e, w) => P.ring(w, e.x, e.y, S.orbitRing, w.rng.angle()) }],
  },
  splitter: {
    name: 'Splitter Pod', sprite: 'e_splitter', r: 15, hp: 26, score: 700,
    move: 'dive', mp: { stopY: 150, hold: 230 },
    drops: [['P', 0.4], ['M', 0.6]],
    update: (e) => { e.rot = Math.sin(e.t * 0.05) * 0.4; },
    fire: [{ start: 40, every: 90, fn: (e, w) => P.aimed(w, e.x, e.y, S.splitShot) }],
  },
  seeker: {
    name: 'Seeker Launcher', sprite: 'e_seeker', r: 16, hp: 34, score: 900,
    move: 'dive', mp: { stopY: 90, hold: 280 },
    drops: [['P', 0.5], ['M', 0.7]],
    fire: [{ start: 40, every: 110, fn: (e, w) => P.fan(w, e.x, e.y + 10, DOWN, S.seekerMissile) }],
  },
  frigate: {
    name: 'Sentinel Frigate', sprite: 'e_frigate', r: 40, hp: 260, score: 5000, big: true,
    move: 'hover', mp: { stopY: 125, hold: 640, amp: 40 },
    drops: [['P', 1], ['P', 1], ['M', 1], ['M', 1], ['B', 0.25]],
    fire: [
      { start: 50, every: 75, fn: (e, w) => P.aimed(w, e.x, e.y + 50, S.frigateFan) },
      { start: 90, every: 130, fn: (e, w) => P.ring(w, e.x, e.y, S.frigateRing, w.aimAngle(e.x, e.y)) },
      { start: 60, every: 6, elite: true, fn: (e, w) => P.spiral(w, e, S.frigateSpiral) },
    ],
  },

  // ----------------------------------------- mid-boss / boss placeholders
  // M4 replaces the boss slot with the real archetype bosses; these keep the
  // stage flow complete and testable.
  gatekeeper: {
    name: 'GATEKEEPER PLATFORM', sprite: 'e_fortress', r: 52, hp: 900, score: 30000, big: true, boss: true,
    phases: [0.5], glow: [1, 0.2, 0.7],
    move: 'hover', mp: { stopY: 140, hold: 0, amp: 80, freq: 0.01 },
    drops: [['P', 1], ['P', 1], ['P', 1], ['B', 1], ['M', 1], ['M', 1], ['M', 1], ['M', 1], ['S', 0.5]],
    update: (e, w) => {
      if (e.y < 60) return;
      e.rot = Math.sin(e.t * 0.01) * 0.2;
      const hi = e.hp / e.maxHp > 0.5;
      if (hi) {
        if (e.t % 5 === 0) P.spiral(w, e, S.gateSpiral);
        if (e.t % 70 === 0) P.aimed(w, e.x, e.y + 40, S.gateAim);
      } else {
        if (e.t % 160 === 0) for (const s of [-1, 1]) P.laser(w, e, DOWN + s * 0.6, { warn: 50, fire: 90, width: 20, angVel: -s * 0.009, ox: s * 40, oy: 20 });
        if (e.t % 60 === 0) P.curtain(w, S.gateCurtain);
        if (e.t % 9 === 0) P.spiral(w, e, S.gateSpiral);
      }
    },
    fire: [],
  },
  syndicateCore: {
    name: 'SYNDICATE CORE PROTOTYPE', sprite: 'emitter', r: 34, hp: 2600, score: 100000, big: true, boss: true,
    scale: 1.4, phases: [0.66, 0.33], glow: [1, 0.2, 0.7],
    move: 'hover', mp: { stopY: 150, hold: 0, amp: 110, freq: 0.009 },
    drops: [['P', 1], ['P', 1], ['P', 1], ['B', 1], ['L', 0.5], ['M', 1], ['M', 1], ['M', 1], ['M', 1], ['M', 1], ['M', 1]],
    update: (e, w) => {
      if (e.y < 100) return;
      e.rot = e.t * 0.01;
      const f = e.hp / e.maxHp, t = e.t;
      if (t % 4 === 0) P.spiral(w, e, S.coreSpiralA, 'a');
      if (f < 0.66 && t % 7 === 0) P.spiral(w, e, S.coreSpiralB, 'b');
      if (t % 50 === 0) P.ring(w, e.x, e.y, S.coreRing, w.aimAngle(e.x, e.y));
      if (f < 0.33 && t % 4 === 0) P.rain(w, S.coreRain);
    },
    fire: [],
  },
};

// ----------------------------------------------------------------- factory

function makeAI(def) {
  const move = MOVERS[def.move];
  return (e, w) => {
    move(e, w, e.p);
    if (def.update) def.update(e, w);
    // No fire from off-screen or point-blank near the bottom edge.
    if (e.y < 4 || e.y > WORLD_H * 0.78 || e.x < 0 || e.x > WORLD_W) return;
    const rate = w.diff.fireRate * (e.elite ? 0.7 : 1);
    const fire = def.fire;
    for (let i = 0; i < fire.length; i++) {
      const f = fire[i];
      if (f.elite && !e.elite) continue;
      const every = Math.max(3, Math.round(f.every * rate));
      const t = e.t - f.start;
      if (t >= 0 && t % every === 0) f.fn(e, w);
    }
  };
}

function rollDrops(def, elite, w) {
  const out = [];
  for (const [k, ch] of def.drops || []) if (w.rng.chance(ch)) out.push(k);
  if (elite) out.push('M', 'M', 'P');
  return out.length ? out : null;
}

function onDeath(e, w) {
  const def = e.def;
  if (def.big) {
    w.explosions.breakApart(e.x, e.y, e.r * 0.8, Math.round(3 + e.r / 10));
    w.cancelCircle(e.x, e.y, 100 + e.r * 2);
  } else if (w.diff.revenge && !e.ground) {
    // Later loops: every small kill spits a few "revenge" bullets.
    P.aimed(w, e.x, e.y, S.revenge);
  }
  if (def.onDeath) def.onDeath(e, w);
}

/**
 * Spawn enemy `id` at (x, y). `params` override the def's mover params
 * (e.g. { dir: -1, stopY: 90 }). Elites get more HP, faster fire and an
 * extra pattern layer where defined.
 */
export function spawnEnemy(w, id, x, y, params = null, elite = false) {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy "${id}"`);
  if (!def._ai) def._ai = makeAI(def);
  const r = w.r;
  const hpMul = (elite ? 1.8 : 1) * (def.boss ? w.diff.bossHp || 1 : w.diff.hp || 1);
  const e = w.spawnEnemy({
    kind: id, name: def.name, def, x, y, r: def.r, hp: Math.round(def.hp * hpMul),
    f: r.frame(def.sprite), f2: def.sprite2 ? r.frame(def.sprite2) : null,
    ground: !!def.ground, armor: def.armor ?? 1, scale: def.scale || 1,
    score: def.score * (elite ? 2 : 1), ult: def.ult ?? Math.min(15, Math.max(1, def.hp / 12)),
    blast: def.big ? 0 : def.blast ?? 0.7, drops: rollDrops(def, elite, w),
    elite, glow: def.glow || null, boss: !!def.boss, ai: def._ai, onDeath,
  });
  e.p = params ? { ...def.mp, ...params } : def.mp;
  if (def.boss) w.boss = e;
  return e;
}

export const ENEMY_IDS = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss);
