// Headless pilot DPS harness (no browser, no WebGL). Runs the real World +
// Player simulation with stubbed rendering and reports damage per second
// against fixed dummy layouts, per power tier, for normal fire and focus.
//
//   node tools/dps.mjs kairo            measure this checkout
//   node tools/dps.mjs kairo ../other   measure another checkout (e.g. a main worktree)
//   node tools/dps.mjs kairo . --json   machine-readable output
//
// Layouts (targets are immortal; damage is summed):
//   boss   one r=50 target 180 units ahead (the balance.js method)
//   small  one r=14 target 180 ahead
//   line   six r=14 targets in a row 180 ahead, 40 apart (wave clear)
//   sweep  r=14 targets at x offsets -90..90 (step 15) and 120/240/360 ahead:
//          damage per cell shows the area the shots cover.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [pilotId = 'kairo', rootArg = '.', ...rest] = process.argv.slice(2);
const ROOT = path.resolve(rootArg);
const JSON_OUT = rest.includes('--json');
const imp = (p) => import(pathToFileURL(path.join(ROOT, 'src', p)).href);

const { World } = await imp('entities/World.js');
const { PILOTS } = await imp('pilots/index.js');
const { RNG } = await imp('core/RNG.js');

const noop = () => {};
const anyProxy = () => new Proxy(noop, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : anyProxy()), apply: () => anyProxy() });
let fid = 0;
const frames = new Map();
const frame = (name) => {
  if (!frames.has(name)) frames.set(name, { id: fid++, name, w: 10, h: 10, u0: 0, v0: 0, u1: 1, v1: 1 });
  return frames.get(name);
};

function makeGame(focus) {
  const input = {
    moveX: 0, moveY: 0,
    down: (a) => a === 'shot' || (a === 'focus' && focus),
    pressed: () => false, keyPressed: () => false, rumble: noop,
  };
  return {
    renderer: {
      frame, frames: [], bulletFrames: {}, atlas: { get: frame, has: () => true, factionBullets: null, size: 4096 },
      post: anyProxy(),
    },
    rng: new RNG('DPS'), fxRng: new RNG('FX'),
    input, camera: anyProxy(), hitStop: noop, settings: anyProxy(),
  };
}

const STEPS = 480; // 8 s

function run(def, power, focus, targets, tier) {
  const g = makeGame(focus);
  const w = new World(g);
  const p = w.setPlayer(def, { power });
  if (def.dpsLevel) def.dpsLevel(p, tier); // pilots whose strength isn't the power tier
  p.invuln = 1e9;
  // def.dpsBossTargets: the pilot one-hit-kills normal enemies (Miguerre), so the dummies count as bosses.
  const es = targets.map(([dx, dy, r]) => w.spawnEnemy({ x: p.x + dx, y: p.y - dy, r, hp: 1e12, blast: 0, boss: !!def.dpsBossTargets }));
  for (let s = 0; s < STEPS; s++) {
    w.update();
    p.x = 240; p.y = 570; // hold position
    for (const e of es) { e.x = e.px; e.y = e.py; }
  }
  return es.map((e) => (1e12 - e.hp) / (STEPS / 60));
}

const def = PILOTS.find((d) => d.id === pilotId);
if (!def) throw new Error(`no pilot ${pilotId}`);

const layouts = {
  boss: [[0, 180, 50]],
  small: [[0, 180, 14]],
  line: [-100, -60, -20, 20, 60, 100].map((x) => [x, 180, 14]),
};
const sweepX = []; for (let x = -90; x <= 90; x += 15) sweepX.push(x);
const sweepY = [120, 240, 360];

const out = {};
for (const focus of [false, true]) {
  for (let tier = 1; tier <= 4; tier++) {
    const power = tier === 4 ? 400 : (tier - 1) * 100;
    const key = `${focus ? 'focus' : 'shot'} T${tier}`;
    const r = {};
    for (const [name, L] of Object.entries(layouts)) r[name] = run(def, power, focus, L, tier).reduce((a, b) => a + b, 0);
    // Sweep: one target at a time (shots that pierce would otherwise double count).
    r.sweep = sweepY.map((dy) => sweepX.map((dx) => run(def, power, focus, [[dx, dy, 14]], tier)[0]));
    out[key] = r;
  }
}

if (JSON_OUT) { console.log(JSON.stringify(out)); process.exit(0); }
const f = (v) => v.toFixed(0).padStart(5);
console.log(`${def.id} @ ${ROOT}\n${'mode'.padEnd(9)} ${'boss'.padStart(5)} ${'small'.padStart(5)} ${'line'.padStart(5)}`);
for (const [k, r] of Object.entries(out)) console.log(`${k.padEnd(9)} ${f(r.boss)} ${f(r.small)} ${f(r.line)}`);
console.log('\nsweep (DPS on one r=14 target; columns = x offset, rows = distance ahead)');
for (const [k, r] of Object.entries(out)) {
  console.log(`${k}        ${sweepX.map((x) => String(x).padStart(4)).join('')}`);
  r.sweep.forEach((row, j) => console.log(`  ${String(sweepY[j]).padStart(3)} ahead ${row.map((v) => v.toFixed(0).padStart(4)).join('')}`));
}
