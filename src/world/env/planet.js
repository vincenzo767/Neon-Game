import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { meshBoulder } from '../kit/terrain.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// PLANET SURFACE (hostile world seen from low altitude): rolling regolith
// with impact craters and ridges (heightfield), boulder fields, glowing
// fissures, crystal clusters, optionally an installation (domes, pylons,
// landing pads, a crashed ship).
//
// Params: world 'crystal' | 'moon' | 'mars' | 'volcanic' | 'ice'
//         crystals 0..1, craters 0..1, fissures 0..1, base 0..1 (installation), groundZ

const LEN = 640;

const WORLDS = {
  crystal: { soil: [0.32, 0.26, 0.36], rock: [0.2, 0.17, 0.24], glow: [0.6, 0.35, 1], crystal: 'alien_crystal' },
  moon: { soil: [0.5, 0.5, 0.5], rock: [0.32, 0.32, 0.33], glow: [0.9, 0.9, 1], crystal: 'ice' },
  mars: { soil: [0.6, 0.32, 0.18], rock: [0.38, 0.2, 0.14], glow: [1, 0.5, 0.2], crystal: 'rock_sand' },
  volcanic: { soil: [0.15, 0.13, 0.13], rock: [0.08, 0.07, 0.07], glow: [1, 0.35, 0.05], crystal: 'molten_top' },
  ice: { soil: [0.72, 0.8, 0.88], rock: [0.45, 0.55, 0.66], glow: [0.4, 0.8, 1], crystal: 'ice' },
};

const hn = (a, b, c) => { let n = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };

/** Crater field: sum of bowls with raised rims from a jittered grid. */
function craterHeight(x, y, k) {
  let h = 0;
  const cell = 260, cx0 = Math.floor(x / cell), cy0 = Math.floor(y / cell);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx0 + i, gy = cy0 + j;
    if (hn(gx, gy, 1) > k) continue;
    const px = (gx + hn(gx, gy, 2)) * cell, py = (gy + hn(gx, gy, 3)) * cell, r = 30 + hn(gx, gy, 4) * 90;
    const d = Math.hypot(x - px, y - py) / r;
    if (d < 1.6) h += d < 1 ? -(1 - d * d) * r * 0.45 + d * d * r * 0.12 : Math.max(0, (1.6 - d) / 0.6) * r * 0.12;
  }
  return h;
}

export default {
  id: 'planet',
  label: 'Planet surface',
  defaults: { world: 'crystal', crystals: 0.6, craters: 0.5, fissures: 0.5, base: 0, fires: 0, groundZ: -60 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const Wd = WORLDS[P.world] || WORLDS.crystal;
    const memo = new Map();
    const height = (x, y) => {
      const key = `${Math.round(x)}:${Math.round(y)}`;
      let h = memo.get(key);
      if (h !== undefined) return h;
      h = (sampleField('fbm', x, y, 1600) - 0.5) * 110 + (sampleField('ridged', x, y, 2600) - 0.5) * 90 + craterHeight(x, y, P.craters);
      if (memo.size > 200000) memo.clear();
      memo.set(key, h);
      return h;
    };
    const S = { P, Wd, height, seed: cfg.seed || cfg.id, dust: shade(Wd.soil, 1.2) };
    S.atmosphere = { sky: { mode: 1, top: [0, 0, 0.01], bottom: [0.02, 0.01, 0.04], accent: Wd.glow } };
    S.layers = [{
      id: 'ground', z: P.groundZ, x0: -620, x1: 620, length: LEN, ppu: 0.85, grid: [40, 22], height, flatLight: true, glow: P.fissures > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: P.groundZ }];
    S.floorZ = P.groundZ;
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, gz = P.groundZ;
  const lay = { crystals: [], boulders: [], domes: [], pylons: [], anchors: [], wreck: null };
  for (let i = 0; i < 10 * P.crystals; i++) {
    const x = R.range(-600, 600), y = R.range(y0, y1);
    lay.crystals.push({ x, y, z: gz + S.height(x, y) - 3, n: R.int(3, 7), h: R.range(30, 110), seed: R.next() });
    lay.anchors.push({ type: 'glow', x, y, z: gz + S.height(x, y) + 20, r: 50, c: S.Wd.glow, a: 0.25, flicker: true });
  }
  for (let i = 0; i < 14; i++) { const x = R.range(-600, 600), y = R.range(y0, y1); lay.boulders.push({ x, y, z: gz + S.height(x, y) - 2, r: R.range(6, 22), h: R.range(6, 20), seed: R.next() }); }
  if (R.chance(P.base)) {
    const x = R.sign() * R.range(140, 360), y = R.range(y0 + 120, y1 - 120);
    for (let k = 0; k < R.int(2, 4); k++) lay.domes.push({ x: x + R.range(-60, 60), y: y + R.range(-80, 80), z: gz + S.height(x, y), r: R.range(22, 40) });
    for (let k = 0; k < 3; k++) { const px = x + R.range(-120, 120), py = y + R.range(-120, 120); lay.pylons.push({ x: px, y: py, z: gz + S.height(px, py), h: R.range(60, 110) }); lay.anchors.push({ type: 'beacon', x: px, y: py, z: gz + S.height(px, py) + 100, c: [1, 0.2, 0.1], period: 60 }); }
  }
  if (R.chance(0.2)) { const x = R.sign() * R.range(150, 400), y = R.range(y0, y1); lay.wreck = { x, y, z: gz + S.height(x, y), rot: R.angle() }; lay.anchors.push({ type: 'smoke', x, y, z: gz + S.height(x, y) + 10, s: 1.6, dark: 0.7 }); lay.anchors.push({ type: 'fire', x, y, z: gz + S.height(x, y) + 6, s: 1.2 }); }
  // Fires (a burning colony): wreckage and fuel blazes with smoke.
  for (let i = 0; i < 5 * (P.fires || 0); i++) { const x = R.range(-400, 400), y = R.range(y0, y1), z = gz + S.height(x, y); lay.anchors.push({ type: 'fire', x, y, z: z + 2, s: R.range(1, 1.7) }); if (R.chance(0.6)) lay.anchors.push({ type: 'smoke', x, y, z: z + 26, s: R.range(1.4, 2.2), dark: 0.9 }); }
  for (let i = 0; i < 2; i++) { const x = R.range(-500, 500), y = R.range(y0, y1); lay.anchors.push({ type: 'dust', x, y, z: gz + S.height(x, y) + 2, s: 1.4 }); }
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const P = S.P, Wd = S.Wd;
  const all = [lay, ...nb.filter(Boolean)];
  paintHeightfield(p, S.height, (h, slope, x, y) => {
    const soil = mix(Wd.soil, shade(Wd.soil, 0.75), sampleField('fine', x, y, 260) * (P.world === 'moon' ? 0.5 : 1));
    return mix(soil, Wd.rock, Math.min(1, slope * 2.4 + Math.max(0, -h - 40) / 80));
  }, { eps: 7, step: 2, shading: [0.25, 1.0] });
  // Airless worlds (moon) read better with subtler mottling.
  const soft = P.world === 'moon' ? 0.5 : 1;
  p.noise('grain', 128 / p.ppu, 'overlay', 0.4 * soft);
  p.noise('fbm', 300, 'soft-light', 0.4 * soft);
  // Fissures: glowing cracks (glow map) in the darker rock.
  if (P.fissures > 0) {
    const R = new RNG(`fis:${lay.seed}`);
    for (let i = 0; i < 5 * P.fissures; i++) {
      const x = R.range(-580, 580), y = R.range(c.y0, c.y1), a = R.angle();
      p.crack(R, x, y, a, R.range(80, 220), 2.4, shade(Wd.rock, 0.4), 0.9, 3);
      if (p.env.glow) p.env.glow.crack(new RNG(`fisg:${lay.seed}:${i}`), x, y, a, R.range(80, 220), 3.5, Wd.glow, 0.5, 2);
    }
  }
  p.props(() => new RNG(`pl:${lay.seed}`), () => {
    for (const L of all) for (const cr of L.crystals) p.shadowCircle(cr.x, cr.y, 14, cr.h, 0, 6);
    for (const L of all) for (const b of L.boulders) p.shadowCircle(b.x, b.y, b.r * 0.85, b.h, 0, 7);
    for (const L of all) for (const d of L.domes) p.shadowCircle(d.x, d.y, d.r, d.r * 0.8, 0, 12);
    for (const L of all) for (const py of L.pylons) p.shadowCircle(py.x, py.y, 3, py.h, 0, 6);
  }, 0.6, 3);
  if (p.env.glow) for (const L of all) for (const cr of L.crystals) p.env.glow.radial(cr.x, cr.y, 40, [[0, Wd.glow, 0.35], [1, Wd.glow, 0]], 'lighter');
}

function mesh(mb, lay, S) {
  const Wd = S.Wd;
  for (const cr of lay.crystals) {
    const R = new RNG(`pc:${cr.seed}`);
    for (let k = 0; k < cr.n; k++) {
      const a = R.angle(), d = R.range(0, 16), h = cr.h * R.range(0.4, 1), r = R.range(5, 11);
      const x = cr.x + Math.cos(a) * d, y = cr.y + Math.sin(a) * d;
      mb.lathe(x, y, [[r, cr.z], [r * 0.9, cr.z + h * 0.75], [0.2, cr.z + h]], Wd.crystal, { seg: 6 });
    }
  }
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, 'rock_dark', b.z);
  for (const d of lay.domes) {
    const prof = [];
    for (let k = 0; k <= 7; k++) { const a = (k / 7) * Math.PI / 2; prof.push([Math.cos(a) * d.r + 0.01, d.z + Math.sin(a) * d.r * 0.8]); }
    mb.lathe(d.x, d.y, prof, 'station_hull', { seg: 20 });
  }
  for (const py of lay.pylons) { mb.box(py.x, py.y, py.z, 5, 5, py.h, 0, { top: 'metal_dark', side: 'steel_painted' }); mb.box(py.x, py.y, py.z + py.h - 8, 14, 3, 3, 0, { top: 'solar_panel', side: 'metal_dark' }); }
  if (lay.wreck) {
    const w = lay.wreck;
    mb.box(w.x, w.y, w.z - 4, 34, 90, 16, w.rot, { top: 'scorch', side: 'metal_dark' });
    mb.box(w.x + Math.cos(w.rot) * 30, w.y + Math.sin(w.rot) * 30, w.z - 2, 70, 16, 4, w.rot + 0.3, { top: 'scorch', side: 'metal_dark' });
  }
}
