import { WORLD_W } from '../core/constants.js';
import { COLOR_NAMES } from '../fx/sprites.js';

// Placeholder opposition for the M1/M2 test range: drone waves plus a
// pattern "core". Replaced by the data-driven enemy roster in M3.

const C = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i]));
const TAU = Math.PI * 2;

export const DENSITY = [
  { arms: 6, label: 'LOW' },
  { arms: 12, label: 'MED' },
  { arms: 22, label: 'HIGH' },
  { arms: 34, label: 'MANIC' },
];

function droneAI(e, w) {
  if (e.t < 70) e.y += 2.2;
  else if (e.t < 520) e.x = e.data.baseX + Math.sin((e.t - 70) * 0.03) * 40 * e.data.dir;
  else e.y += 1.8;
  if (e.t > 60 && e.t < 520 && --e.data.fireT <= 0) {
    e.data.fireT = 70;
    const aim = w.aimAngle(e.x, e.y);
    for (let k = -1; k <= 1; k++) w.bullets.spawn(e.x, e.y + 8, aim + k * 0.18, 3.2, w.BF.kunai.red, C.red, 3);
  }
}

function coreAI(e, w) {
  const d = DENSITY[w.density ?? 1];
  if (e.t < 90) { e.y += (150 - e.y) * 0.04; return; }
  const t = e.t, B = w.bullets, BF = w.BF;
  e.x = WORLD_W / 2 + Math.sin(t * 0.009) * 110;
  e.y = 150 + Math.sin(t * 0.017) * 26;
  e.rot = t * 0.01;
  if (t % 3 === 0) {
    e.data.angle += 0.13;
    for (let k = 0; k < d.arms; k++) {
      const a = e.data.angle + (k / d.arms) * TAU;
      const col = k % 2 ? C.pink : C.violet;
      B.spawn(e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, a, 2.3, BF.orb[COLOR_NAMES[col]], col, 3.2);
    }
  }
  if (t % 7 === 0) {
    const n = Math.max(4, d.arms >> 1);
    for (let k = 0; k < n; k++) {
      const i = B.spawn(e.x, e.y, -e.data.angle * 0.7 + (k / n) * TAU, 4.2, BF.rice.cyan, C.cyan, 2.5);
      if (i >= 0) B.motion(i, -0.05, 0.006, 1.6, 4.2);
    }
  }
  if ((w.density ?? 1) >= 2 && t % 50 === 0) {
    const aim = w.aimAngle(e.x, e.y);
    for (let k = 0; k < 16; k++) B.spawn(e.x, e.y, aim + (k / 16) * TAU, 1.5, BF.bigorb.orange, C.orange, 7);
  }
  if ((w.density ?? 1) >= 3 && t % 4 === 0) {
    B.spawn(w.rng.range(10, WORLD_W - 10), -10, Math.PI / 2 + w.rng.range(-0.1, 0.1), w.rng.range(2.5, 3.5), BF.orb.yellow, C.yellow, 2.5, 0.8);
  }
}

export class TestSpawner {
  constructor(world) {
    this.w = world;
    const r = world.r;
    this.fDrone = r.frame('drone');
    this.fCore = r.frame('emitter');
    this.coreRespawn = 0;
    this.spawnCore();
  }

  spawnCore() {
    const w = this.w;
    const drops = ['P', 'P', 'P', 'P', 'B', 'S', 'M', 'M', 'M', 'M', 'M'];
    if (w.rng.chance(0.35)) drops.push('L');
    w.spawnEnemy({
      kind: 'core', x: WORLD_W / 2, y: -60, r: 26, hp: 700, f: this.fCore, glow: [1, 0.2, 0.7],
      score: 20000, ult: 15, blast: 0, drops, ai: coreAI, data: { angle: 0 },
      onDeath: (e, w2) => {
        w2.explosions.breakApart(e.x, e.y, 34, 7);
        w2.cancelAll();
        this.coreRespawn = 300;
        w2.event('coreDown');
      },
    });
  }

  spawnDroneWave() {
    const w = this.w, fromLeft = w.rng.chance(0.5);
    for (let k = 0; k < 4; k++) {
      const x = fromLeft ? 60 + k * 40 : WORLD_W - 60 - k * 40;
      w.spawnEnemy({
        kind: 'drone', x, y: -30 - k * 30, r: 14, hp: 14, f: this.fDrone, score: 500, ult: 1.5, blast: 0.7,
        drops: [w.rng.chance(0.45) ? 'P' : 'M'], ai: droneAI,
        data: { baseX: x, dir: fromLeft ? 1 : -1, fireT: 40 + k * 10 },
      });
    }
  }

  update() {
    const w = this.w;
    let drones = 0;
    for (const e of w.enemies.active) if (e.alive && e.kind === 'drone') drones++;
    if (drones === 0 && w.rng.chance(0.02)) this.spawnDroneWave();
    if (this.coreRespawn > 0 && --this.coreRespawn === 0) this.spawnCore();
  }
}
