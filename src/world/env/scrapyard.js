import { dirt, sand, gravel } from '../paint/surfaces.js';
import { car, truck, crate, drum, puddle, debris, scorch, carColor } from '../paint/props.js';
import { meshScrapPile, shadowScrapPile, meshCarBales, tyres, railway } from '../kit/terrain.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// SALVAGE / SCRAPYARD at golden hour: compacted dirt yard, haul roads, a rail
// spur, container stacks, scrap heaps, crushed-car bale stacks, rows of
// wrecks, tyre piles, crawler cranes with magnets, a gantry crane over the
// rail, a conveyor up to the shredder, portacabins.
//
// Params: density 0..1 (clutter), fires 0..1, wet 0..1 (puddles), desert 0..1
//         (sandier ground), gantry (bool), damage 0..1

const LEN = 512;
const CONTAINERS = ['container_red', 'container_blue', 'container_green', 'container_orange', 'container_grey', 'container_teal'];

export default {
  id: 'scrapyard',
  label: 'Scrapyard / salvage yard',
  defaults: { density: 0.7, fires: 0.25, wet: 0.2, desert: 0.4, gantry: true, damage: 0.3 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.6, 0.48, 0.34] };
    S.layers = [{
      id: 'ground', z: 0, x0: -470, x1: 470, length: LEN, ppu: 1.35, glow: P.fires > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { stacks: [], heaps: [], bales: [], wrecks: [], tyres: [], cranes: [], cabins: [], anchors: [], conveyors: [], gantries: [], drums: [], puddles: [] };
  // Lots in a 2 × 4 grid around the central haul road (x ∈ [-30, 30]) and the rail at x = 120.
  const cells = [];
  for (const [xa, xb] of [[-450, -250], [-240, -45], [45, 100], [150, 450]]) for (let k = 0; k < 4; k++) cells.push({ xa, xb, ya: y0 + k * (LEN / 4) + 8, yb: y0 + (k + 1) * (LEN / 4) - 8 });
  for (const cell of cells) {
    const cx = (cell.xa + cell.xb) / 2, cy = (cell.ya + cell.yb) / 2, w = cell.xb - cell.xa, d = cell.yb - cell.ya;
    if (w < 80) { // the strip between road and rail: wreck rows
      for (let y = cell.ya + 14; y < cell.yb - 10; y += 30) if (R.chance(0.7 * P.density + 0.2)) lay.wrecks.push({ x: cx + R.range(-6, 6), y, rot: Math.PI / 2 + R.range(-0.2, 0.2), color: carColor(R), burnt: R.chance(0.25 + P.damage * 0.3), seed: R.next() });
      continue;
    }
    const roll = R.next();
    if (roll < 0.3) {
      // Container stack block: rows of 40-unit boxes, 1-3 high.
      const rows = Math.floor(d / 17), cols = Math.floor(w / 44);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (R.chance(0.15)) continue;
        lay.stacks.push({ x: cell.xa + 22 + i * 44, y: cell.ya + 8.5 + j * 17, n: R.int(1, 3), mats: [R.pick(CONTAINERS), R.pick(CONTAINERS), R.pick(CONTAINERS)], rot: R.range(-0.03, 0.03) });
      }
    } else if (roll < 0.62) {
      const n = R.int(1, 2);
      for (let i = 0; i < n; i++) {
        const r = R.range(30, Math.min(w, d) * 0.45), h = R.range(18, 40);
        lay.heaps.push({ x: cx + R.range(-0.2, 0.2) * w, y: cy + R.range(-0.2, 0.2) * d, r, h, seed: R.next() });
        if (R.chance(P.fires)) lay.anchors.push({ type: 'fire', x: cx, y: cy, z: h * 0.6, s: R.range(1, 1.6) });
        else if (R.chance(0.3)) lay.anchors.push({ type: 'smoke', x: cx, y: cy, z: h * 0.5, s: 0.8, dark: 0.5 });
      }
      if (R.chance(0.45)) lay.cranes.push({ x: cell.xa + R.range(20, 40) * Math.sign(cx), y: cy + R.range(-30, 30), rot: R.angle(), boom: R.range(90, 130), lift: R.range(0.45, 0.8) });
    } else if (roll < 0.82) {
      lay.bales.push({ x: cx, y: cy, rot: R.range(-0.1, 0.1) + (R.chance(0.5) ? 0 : Math.PI / 2), cols: Math.max(2, Math.floor(w / 13) - 2), rows: Math.max(2, Math.floor(d / 18) - 1), layers: R.int(2, 4), seed: R.next() });
    } else {
      for (let k = 0; k < 6; k++) lay.wrecks.push({ x: cx + R.range(-0.4, 0.4) * w, y: cy + R.range(-0.4, 0.4) * d, rot: R.angle(), color: carColor(R), burnt: R.chance(0.3), seed: R.next() });
      lay.tyres.push({ x: cx + R.range(-0.3, 0.3) * w, y: cy + R.range(-0.3, 0.3) * d, n: R.int(6, 14), seed: R.next() });
      if (R.chance(0.6)) lay.cabins.push({ x: cx + R.range(-0.3, 0.3) * w, y: cy + R.range(-0.3, 0.3) * d, rot: R.chance(0.5) ? 0 : Math.PI / 2 });
    }
  }
  if (P.gantry && R.chance(0.5)) lay.gantries.push({ y: R.range(y0 + 60, y1 - 60) });
  if (R.chance(0.4)) lay.conveyors.push({ x: R.sign() * R.range(200, 380), y: R.range(y0 + 80, y1 - 80), rot: R.range(-0.4, 0.4) });
  for (let i = 0; i < 10; i++) lay.drums.push({ x: R.range(-440, 440), y: R.range(y0, y1), seed: R.next() });
  for (let i = 0; i < 2 + 8 * P.wet; i++) lay.puddles.push({ x: R.range(-440, 440), y: R.range(y0, y1), r: R.range(6, 16), seed: R.next() });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  dirt(p, { color: shade([0.42, 0.33, 0.24], 1, [0.66, 0.52, 0.36], P.desert * 0.6) });
  if (P.desert > 0.2) sand(p, { path: () => { p.allPath(); }, color: [0.7, 0.55, 0.38] }), p.patch('large_50', 1000, [0.4, 0.32, 0.24], 0.5);
  // Oil-soaked patches and rust bleed.
  p.patch('fbm_70', 380, [0.12, 0.1, 0.08], 0.55);
  p.patch('fine_70', 140, [0.36, 0.2, 0.1], 0.3);
  // Haul roads: central (along y) and cross roads every 256.
  gravel(p, { path: () => p.rectPath(-34, y0 - 4, 68, y1 - y0 + 8), color: [0.42, 0.38, 0.33] });
  for (let y = Math.ceil(y0 / 256) * 256; y < y1; y += 256) gravel(p, { path: () => p.rectPath(-470, y - 16, 940, 32), color: [0.42, 0.38, 0.33] });
  // Tyre ruts along the roads.
  for (const s of [-1, 1]) for (const o of [-12, 12]) p.line([s * 0 + o, y0 - 4, o + s * 2, y1 + 4], 2.5, [0.2, 0.16, 0.12], 0.35);
  railway(p, 120, y0 - 4, y1 + 4, { rust: true, ballast: [0.36, 0.32, 0.28] });
  p.props(() => new RNG(`sy:${lay.seed}`), (Rp) => {
    for (const L of all) for (const st of L.stacks) for (let k = 0; k < st.n; k++) p.shadowBox(st.x, st.y, 40, 15, (k + 1) * 15, st.rot, k * 15);
    for (const L of all) for (const h of L.heaps) { shadowScrapPile(p, h.x, h.y, h.r, h.h); scorch(p, Rp, h.x, h.y, h.r * 1.15); debris(p, Rp, h.x, h.y, h.r * 1.35, 60, { color: [0.4, 0.26, 0.16] }); }
    for (const L of all) for (const b of L.bales) p.shadowBox(b.x, b.y, b.cols * 11.6, b.rows * 16.6, b.layers * 6.5, b.rot);
    for (const L of all) for (const cr of L.cranes) { p.shadowBox(cr.x, cr.y, 22, 30, 14, cr.rot); const ex = cr.x + Math.cos(cr.rot) * cr.boom * 0.8, ey = cr.y + Math.sin(cr.rot) * cr.boom * 0.8; p.shadow([cr.x - 2, cr.y - 2, ex - 2, ey - 2, ex + 2, ey + 2, cr.x + 2, cr.y + 2], 110 * cr.lift, 14); }
    for (const L of all) for (const g of L.gantries) for (const s of [-1, 1]) p.shadowBox(120 + s * 60, g.y, 8, 8, 86);
    for (const L of all) for (const g of L.gantries) p.shadowBox(120, g.y, 140, 10, 92, 0, 84);
    for (const L of all) for (const cb of L.cabins) p.shadowBox(cb.x, cb.y, 16, 34, 12, cb.rot);
    for (const L of all) for (const cv of L.conveyors) p.shadow([cv.x - 3, cv.y - 70, cv.x + 3, cv.y - 70, cv.x + 3, cv.y + 70, cv.x - 3, cv.y + 70], 50, 6);
    for (const L of all) for (const pd of L.puddles) puddle(p, new RNG(`sp:${pd.seed}`), pd.x, pd.y, pd.r, { color: [0.08, 0.07, 0.06] });
    for (const L of all) for (const t of L.tyres) tyres(p, new RNG(`ty:${t.seed}`), t.x, t.y, t.n);
    for (const L of all) for (const w of L.wrecks) car(p, w.x, w.y, w.rot, { color: shade(w.color, 0.75, [0.4, 0.22, 0.1], 0.35), kind: new RNG(`wk:${w.seed}`).pick(['sedan', 'hatch', 'suv', 'van']), burnt: w.burnt, wrecked: !w.burnt });
    for (const L of all) for (const d of L.drums) { const Rd = new RNG(`dr:${d.seed}`); for (let k = 0; k < 3; k++) drum(p, d.x + Rd.range(-5, 5), d.y + Rd.range(-5, 5), { color: Rd.pick([[0.2, 0.32, 0.5], [0.55, 0.2, 0.1], [0.3, 0.3, 0.3]]) }); }
    // A few haul trucks and loaders on the roads.
    for (let i = 0; i < 2; i++) truck(p, Rp.range(-20, 20), Rp.range(y0 + 30, y1 - 30), Rp.chance(0.5) ? 0 : Math.PI, { cab: [0.85, 0.6, 0.1], cargo: 'flat', color: [0.35, 0.3, 0.26] });
    for (let i = 0; i < 6; i++) crate(p, Rp, Rp.range(-440, 440), Rp.range(y0, y1), Rp.range(5, 9), Rp.range(-0.5, 0.5));
  }, 0.62, 2.4);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.42, 0.1], 0.6], [1, [1, 0.3, 0.05], 0]], 'lighter');
}

function mesh(mb, lay) {
  for (const st of lay.stacks) for (let k = 0; k < st.n; k++) mb.box(st.x, st.y, k * 15, 40, 15, 15, st.rot, { top: st.mats[k], side: st.mats[k] });
  for (const h of lay.heaps) meshScrapPile(mb, h.x, h.y, h.r, h.h, h.seed);
  for (const b of lay.bales) meshCarBales(mb, b.x, b.y, b.rot, b.cols, b.rows, b.layers, b.seed);
  for (const cb of lay.cabins) mb.box(cb.x, cb.y, 0, 16, 34, 11, cb.rot, { top: 'roof_metal', side: 'facade_industrial' });
  // Crawler cranes: tracked base, cab, lattice boom, magnet on a cable.
  for (const cr of lay.cranes) {
    const c = Math.cos(cr.rot), s = Math.sin(cr.rot);
    for (const side of [-1, 1]) mb.box(cr.x - s * side * 8, cr.y + c * side * 8, 0, 6, 30, 5, cr.rot + Math.PI / 2, { top: 'metal_dark', side: 'metal_dark' });
    mb.box(cr.x, cr.y, 5, 18, 22, 10, cr.rot, { top: 'steel_yellow', side: 'steel_yellow' });
    const tipZ = 110 * cr.lift, tx = cr.x + c * cr.boom, ty = cr.y + s * cr.boom;
    mb.beam([cr.x + c * 6, cr.y + s * 6, 14], [tx, ty, tipZ], 5, 5, 'lattice');
    mb.beam([tx, ty, tipZ], [tx, ty, tipZ * 0.35], 0.6, 0.6, 'metal_dark');
    mb.lathe(tx, ty, [[0, tipZ * 0.35 - 4], [9, tipZ * 0.35 - 3], [9, tipZ * 0.35], [0, tipZ * 0.35 + 1]], 'metal_dark', { seg: 12 });
  }
  // Gantry crane over the rail spur.
  for (const g of lay.gantries) {
    for (const s of [-1, 1]) {
      mb.box(120 + s * 60, g.y - 12, 0, 6, 6, 86, 0, { top: 'steel_yellow', side: 'steel_yellow' });
      mb.box(120 + s * 60, g.y + 12, 0, 6, 6, 86, 0, { top: 'steel_yellow', side: 'steel_yellow' });
      mb.beam([120 + s * 60, g.y - 12, 86], [120 + s * 60, g.y + 12, 86], 6, 4, 'steel_yellow');
    }
    mb.box(120, g.y, 86, 140, 10, 7, 0, { top: 'steel_yellow', side: 'steel_yellow' });
    mb.box(120 + 20, g.y, 80, 14, 14, 6, 0, { top: 'metal_dark', side: 'metal_dark' });
  }
  // Inclined conveyor up to the shredder hopper.
  for (const cv of lay.conveyors) {
    const c = Math.cos(cv.rot), s = Math.sin(cv.rot);
    const a = [cv.x - s * 70, cv.y - c * 70, 4], b = [cv.x + s * 60, cv.y + c * 60, 46];
    mb.beam(a, b, 7, 2, 'metal_dark');
    for (let k = 1; k < 4; k++) { const t = k / 4; mb.beam([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], 1.5, 1.5, 'steel_painted'); }
    mb.box(b[0] + s * 14, b[1] + c * 14, 0, 30, 30, 40, cv.rot, { top: 'rust', side: 'facade_industrial' });
  }
}
