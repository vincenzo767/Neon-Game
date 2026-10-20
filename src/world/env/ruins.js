import { seabed as seabedSurf } from '../paint/surfaces.js';
import { rubble, debris, car, carColor } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding } from '../kit/city.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// SUNKEN RUINS on the seabed: a drowned city block grid, a cathedral nave, or
// temple terraces — algae-crusted, silted, broken; caustics and light shafts
// when shallow, bioluminescence and murk when deep.
//
// Params: mode 'city' | 'cathedral' | 'temple', depth 'shallow' | 'mid' | 'deep',
//         bedZ, glow 0..1, collapse 0..1

const LEN = 512;
const WATER = {
  shallow: { top: [0.1, 0.38, 0.46], bottom: [0.04, 0.2, 0.27], caustics: [0.45, 0.012, 1.0], fog: 1 / 800, sand: [0.52, 0.5, 0.4] },
  mid: { top: [0.03, 0.17, 0.24], bottom: [0.01, 0.07, 0.11], caustics: [0.16, 0.01, 0.8], fog: 1 / 480, sand: [0.38, 0.4, 0.36] },
  deep: { top: [0.01, 0.05, 0.08], bottom: [0.0, 0.015, 0.03], caustics: null, fog: 1 / 340, sand: [0.26, 0.28, 0.27] },
};

export default {
  id: 'ruins',
  label: 'Sunken ruins',
  defaults: { mode: 'city', depth: 'mid', bedZ: -200, glow: 0.3, collapse: 0.6 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const Wt = WATER[P.depth] || WATER.mid;
    const S = { P, Wt, seed: cfg.seed || cfg.id, dust: [0.4, 0.44, 0.42], gz: P.bedZ };
    S.atmosphere = { sky: { mode: 2, top: Wt.top, bottom: Wt.bottom }, caustics: Wt.caustics, hfog: [Wt.fog, 0, 0.92] };
    S.layers = [{
      id: 'bed', z: P.bedZ, x0: -560, x1: 560, length: LEN, ppu: 1.0, glow: P.glow > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: P.bedZ }];
    S.floorZ = P.bedZ;
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { buildings: [], toppled: [], columns: [], arches: [], walls: [], pews: [], glass: [], terraces: [], statues: [], anchors: [], cars: [] };
  if (P.mode === 'city') {
    for (const s of [-1, 1]) for (let y = Math.ceil(y0 / 170) * 170; y < y1; y += 170) for (const x of [140, 330]) {
      const Rb = new RNG(`${S.seed}:rb:${y}:${s}:${x}`);
      if (Rb.chance(0.15)) continue;
      const b = planBuilding(Rb, s * x, y + 85, Rb.range(90, 150), Rb.range(100, 140), { hMin: 40, hMax: 170, collapse: P.collapse, styles: ['concrete', 'office', 'brick'] });
      b.drowned = true;
      lay.buildings.push(b);
    }
    if (R.chance(0.4)) lay.toppled.push({ x: R.sign() * R.range(60, 200), y: R.range(y0 + 100, y1 - 100), rot: R.range(-0.6, 0.6) + Math.PI / 2, l: R.range(160, 260), w: R.range(40, 60) });
    for (let i = 0; i < 6; i++) lay.cars.push({ x: R.range(-60, 60), y: R.range(y0, y1), rot: R.angle(), color: carColor(R) });
  } else if (P.mode === 'cathedral') {
    for (let y = Math.ceil(y0 / 72) * 72; y < y1; y += 72) {
      for (const s of [-1, 1]) {
        const broken = R.chance(P.collapse * 0.35);
        lay.columns.push({ x: s * 96, y, h: broken ? R.range(30, 80) : 150, broken });
        lay.columns.push({ x: s * 190, y, h: R.chance(P.collapse * 0.5) ? R.range(20, 60) : 110 });
        if (!broken && R.chance(1 - P.collapse * 0.5)) lay.arches.push({ y, s });
      }
      if (R.chance(0.7)) lay.pews.push({ y: y + 36 });
    }
    for (const s of [-1, 1]) lay.walls.push({ x: s * 240, y0, y1, broken: R.range(0, 1) });
    for (let i = 0; i < 3; i++) lay.glass.push({ x: R.range(-200, 200), y: R.range(y0, y1), r: R.range(16, 34), seed: R.next() });
    if (R.chance(0.3)) lay.anchors.push({ type: 'glow', x: 0, y: R.range(y0, y1), z: S.gz + 4, r: 90, c: [1, 0.3, 0.4], a: 0.3, flicker: true });
  } else {
    for (let y = Math.ceil(y0 / 320) * 320 + 160; y < y1; y += 320) {
      const s = R.sign();
      lay.terraces.push({ x: s * R.range(170, 280), y, w: R.range(140, 200), steps: R.int(3, 5) });
      lay.statues.push({ x: -s * R.range(110, 160), y: y + R.range(-60, 60), h: R.range(50, 80), fallen: R.chance(0.4), rot: R.angle() });
    }
    for (let y = Math.ceil(y0 / 90) * 90; y < y1; y += 90) for (const s of [-1, 1]) if (R.chance(0.7)) lay.columns.push({ x: s * 70, y, h: R.chance(P.collapse * 0.5) ? R.range(20, 50) : 90 });
  }
  for (let i = 0; i < 12 * P.glow; i++) lay.anchors.push({ type: 'glow', x: R.range(-520, 520), y: R.range(y0, y1), z: S.gz + 3, r: R.range(12, 30), c: R.pick([[0.2, 0.9, 1], [0.3, 1, 0.6], [0.6, 0.4, 1]]), a: 0.4, flicker: true });
  for (let i = 0; i < 2 * P.glow; i++) lay.anchors.push({ type: 'jellyfish', x: R.range(-400, 400), y: R.range(y0, y1), z: S.gz + R.range(80, 200), s: R.range(0.7, 1.4), c: R.pick([[0.4, 0.8, 1], [1, 0.5, 0.8]]) });
  if (S.Wt.caustics) for (let i = 0; i < 2; i++) lay.anchors.push({ type: 'shaftlight', x: R.range(-300, 300), y: R.range(y0, y1), z: 100, s: R.range(1, 1.5) });
  lay.anchors.push({ type: 'bubbles', x: R.range(-300, 300), y: R.range(y0, y1), z: S.gz + 10, s: 0.8 });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P, Wt = S.Wt;
  const all = [lay, ...nb.filter(Boolean)];
  seabedSurf(p, { color: Wt.sand });
  if (P.mode === 'city') {
    // Silted streets: the asphalt still shows in patches under the sand.
    for (const x of [0, 235, -235]) { p.rectPath(x - 36, y0 - 4, 72, y1 - y0 + 8).fill([0.16, 0.17, 0.17], 0.55); }
    for (let y = Math.ceil(y0 / 170) * 170; y < y1; y += 170) p.rectPath(-560, y - 18, 1120, 36).fill([0.16, 0.17, 0.17], 0.5);
    p.patch('fbm_50', 260, Wt.sand, 0.65);
  } else if (P.mode === 'cathedral') {
    // Nave floor: marble chequer under silt, a central runner, a mosaic rosette.
    for (let y = Math.floor(y0 / 24) * 24; y < y1; y += 24) for (let x = -216; x < 216; x += 24) p.rectPath(x, y, 24, 24).fill(((x + y) / 24) % 2 ? [0.6, 0.58, 0.54] : [0.34, 0.32, 0.3], 0.85);
    p.rectPath(-28, y0 - 4, 56, y1 - y0 + 8).fill([0.36, 0.08, 0.1], 0.7);
    p.patch('fbm_50', 240, Wt.sand, 0.6);
    p.patch('fine_60', 60, [0.2, 0.3, 0.22], 0.35);
  } else {
    p.patch('large_50', 700, [0.48, 0.42, 0.32], 0.5);
  }
  p.props(() => new RNG(`ru:${lay.seed}`), (Rp) => {
    for (const L of all) for (const b of L.buildings) { shadowBuilding(p, b); if (b.collapse) rubble(p, new RNG(`rr:${b.x}:${b.y}`), b.x, b.y, Math.max(b.w, b.d) * 0.5, { color: [0.36, 0.4, 0.36], rebar: true }); }
    for (const L of all) for (const t of L.toppled) p.shadowBox(t.x, t.y, t.l, t.w, t.w * 0.8, t.rot);
    for (const L of all) for (const col of L.columns) p.shadowCircle(col.x, col.y, 10, col.h, 0, 8);
    for (const L of all) for (const w of L.walls) p.shadowBox(w.x, (w.y0 + w.y1) / 2, 14, w.y1 - w.y0, 60 + 80 * w.broken);
    for (const L of all) for (const t of L.terraces) for (let k = 0; k < t.steps; k++) p.shadowBox(t.x, t.y, t.w - k * 26, t.w - k * 26, (k + 1) * 14);
    for (const L of all) for (const v of L.cars) car(p, v.x, v.y, v.rot, { color: shade(v.color, 0.4, [0.2, 0.3, 0.25], 0.5), burnt: true, embers: false });
    for (let i = 0; i < 5; i++) debris(p, Rp, Rp.range(-500, 500), Rp.range(y0, y1), Rp.range(20, 40), 30, { color: [0.35, 0.38, 0.34] });
  }, 0.45, 4);
  if (p.env.glow) {
    for (const L of all) for (const g of L.glass) {
      const R = new RNG(`gl:${g.seed}`);
      for (let k = 0; k < 12; k++) { const col = R.pick([[0.9, 0.2, 0.2], [0.2, 0.4, 1], [1, 0.8, 0.2], [0.3, 0.9, 0.5]]); p.env.glow.poly([g.x + R.range(-g.r, g.r), g.y + R.range(-g.r, g.r), g.x + R.range(-g.r, g.r), g.y + R.range(-g.r, g.r), g.x + R.range(-g.r, g.r), g.y + R.range(-g.r, g.r)]).fill(col, 0.5, 'lighter'); }
    }
    for (const L of all) for (const a of L.anchors) if (a.type === 'glow') p.env.glow.radial(a.x, a.y, a.r, [[0, a.c, 0.5], [1, a.c, 0]], 'lighter');
  }
  void mix;
}

function mesh(mb, lay, S) {
  const gz = S.gz;
  for (const b of lay.buildings) {
    // Drowned towers: algae-crusted façades, silted roofs.
    const cp = { ...b, style: 'drowned', roof: 'algae' };
    meshBuilding(mb, cp, gz - 6);
  }
  for (const t of lay.toppled) mb.box(t.x, t.y, gz - 4, t.l, t.w, t.w * 0.8, t.rot, { top: 'facade_drowned', side: 'facade_drowned' });
  for (const col of lay.columns) {
    mb.lathe(col.x, col.y, [[14, gz], [11, gz + 8], [9, gz + col.h - 10], [12, gz + col.h - 4], [12, gz + col.h]], 'stone_algae', { seg: 10 });
    if (col.broken) mb.box(col.x + 30, col.y + 10, gz, 60, 18, 16, 0.7, { top: 'stone_algae', side: 'stone_algae' });
  }
  for (const a of lay.arches) {
    // Half-arch rib from the outer column over to the nave.
    const pts = [[a.s * 190, a.y, gz + 110], [a.s * 160, a.y, gz + 150], [a.s * 120, a.y, gz + 162], [a.s * 96, a.y, gz + 150]];
    for (let i = 0; i < 3; i++) mb.beam(pts[i], pts[i + 1], 10, 12, 'stone_algae');
  }
  for (const p of lay.pews) for (const s of [-1, 1]) mb.box(s * 60, p.y, gz, 50, 6, 7, 0, { top: 'rust', side: 'stone_algae' });
  for (const w of lay.walls) {
    const n = Math.ceil((w.y1 - w.y0) / 64);
    for (let k = 0; k < n; k++) { const h = 60 + 90 * Math.abs(Math.sin(k * 2.1 + w.broken * 5)); mb.box(w.x, w.y0 + (k + 0.5) * 64, gz, 14, 64, h, 0, { top: 'stone_algae', side: 'stone_algae' }); }
  }
  for (const t of lay.terraces) for (let k = 0; k < t.steps; k++) mb.box(t.x, t.y, gz + k * 14, t.w - k * 26, t.w - k * 26, 14, 0, { top: 'stone_algae', side: 'sandstone' });
  for (const st of lay.statues) {
    if (st.fallen) { mb.box(st.x, st.y, gz, 16, st.h, 14, st.rot, { top: 'stone_algae', side: 'stone_algae' }); continue; }
    mb.box(st.x, st.y, gz, 22, 22, 12, 0, { top: 'stone_algae', side: 'sandstone' });
    mb.lathe(st.x, st.y, [[8, gz + 12], [9, gz + st.h * 0.6], [6, gz + st.h * 0.75], [5, gz + st.h * 0.85], [4, gz + st.h]], 'stone_algae', { seg: 8 });
  }
}
