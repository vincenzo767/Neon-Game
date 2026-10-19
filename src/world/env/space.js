import { meshBoulder } from '../kit/terrain.js';
import { RNG } from '../../core/RNG.js';

// DEEP SPACE: starfield backdrop, nebula gas decks (cloud shader in emissive
// colours, slowly drifting at several depths), asteroids tumbling past
// (movers), wreckage, and optionally a black hole with its accretion disc
// and gravitational lensing ahead of the flight path.
//
// Params: nebula [[r,g,b] lit, [r,g,b] shade] colours, gas 0..1, asteroids 0..1,
//         wreckage 0..1, blackhole 0..1 (horizon radius scale), disc colour

const LEN = 640;

export default {
  id: 'space',
  label: 'Deep space / nebula',
  defaults: { gas: 0.6, asteroids: 0.5, wreckage: 0.3, blackhole: 0, nebula: [[0.95, 0.45, 0.85], [0.35, 0.2, 0.7]], disc: [1, 0.5, 0.2] },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const [lit, shade] = P.nebula;
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.6, 0.55, 0.6] };
    const surfaces = [];
    if (P.gas > 0) {
      surfaces.push({ type: 'cloud', z: -2600, cloud: [0.75 * P.gas + 0.2, 3.2, 0.5, 30], lit: lit.map((v) => v * 0.9), shade: shade.map((v) => v * 0.8), base: shade.map((v) => v * 0.35), drift: [3, 1], seed: 3.1, alpha: 0.75 });
      surfaces.push({ type: 'cloud', z: -1300, cloud: [0.5 * P.gas + 0.1, 2.2, 0.45, 26], lit: [lit[1], lit[2], lit[0]].map((v, i) => (v + lit[i]) * 0.5), shade: shade.map((v) => v * 0.7), base: shade.map((v) => v * 0.3), drift: [5, 2], seed: 9.7, alpha: 0.5 });
    }
    if (P.blackhole > 0) surfaces.push({ type: 'blackhole', z: -2400, bh: [0, 0, 140 * P.blackhole, 0.32], disc: P.disc, ahead: 1100 });
    S.atmosphere = { sky: { mode: 1, top: [0, 0, 0.012], bottom: [0.01, 0.005, 0.02], accent: shade }, surfaces, fog: [8000, 20000, 0.2], fogCol: [0, 0, 0] };
    S.layers = [{
      id: 'field', z: 0, x0: -10, x1: 10, length: LEN, ppu: 0.05,
      layout: (c) => layout(c, S),
      mesh: (mb, lay) => { for (const w of lay.wrecks) wreck(mb, w); },
      moverMesh: (mb, m) => { meshBoulder(mb, m.x, m.y, m.r, m.r * 1.3, m.seed, 'asteroid', m.z - m.r * 0.65); return []; },
    }];
    S.surfacesTopDown = [{ z: -80 }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { movers: [], wrecks: [], anchors: [] };
  for (let i = 0; i < 9 * P.asteroids; i++) {
    const r = R.chance(0.15) ? R.range(40, 90) : R.range(8, 28);
    lay.movers.push({ kind: 'rock', x: R.range(-560, 560), y: R.range(y0, y1), z: R.range(-700, 80), r, rot: 0, vx: R.range(-0.25, 0.25), vy: R.range(-0.35, 0.1), l: r * 2, b: r * 2, seed: R.next() });
  }
  if (R.chance(P.wreckage)) {
    const w = { x: R.sign() * R.range(150, 400), y: R.range(y0 + 100, y1 - 100), z: R.range(-400, -120), rot: R.angle() };
    lay.wrecks.push(w);
    lay.anchors.push({ type: 'spark', x: w.x, y: w.y, z: w.z + 20 }, { type: 'glow', x: w.x, y: w.y, z: w.z + 10, r: 60, c: [1, 0.45, 0.15], a: 0.3, flicker: true });
  }
  return lay;
}

/** Broken warship hull drifting: two hull halves, exposed decks, girders. */
function wreck(mb, w) {
  const c = Math.cos(w.rot), s = Math.sin(w.rot);
  const at = (u, v) => [w.x + u * c - v * s, w.y + u * s + v * c];
  const [ax, ay] = at(0, 60), [bx, by] = at(16, -70);
  mb.box(ax, ay, w.z, 46, 110, 30, w.rot, { top: 'metal_dark', side: 'hull_grey' });
  mb.box(bx, by, w.z - 10, 46, 90, 30, w.rot + 0.25, { top: 'scorch', side: 'hull_grey' });
  for (let k = 0; k < 5; k++) { const [gx, gy] = at(-18 + k * 9, 0); mb.beam([gx, gy - 6, w.z + 15], [gx + 4, gy - 40, w.z + 5 + k * 3], 3, 3, 'steel_painted'); }
}
