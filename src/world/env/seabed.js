import { seabed as seabedSurf, rock as rockSurf } from '../paint/surfaces.js';
import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { meshBoulder } from '../kit/terrain.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// SEABED: underwater terrain from sunlit shallows to the hadal zone.
//
//   bed     heightfield seabed (z = bedZ) with an optional TRENCH carved
//           along the flight path (steep walls, ledges, a chasm floor),
//           sediment, rock outcrops, bioluminescent colonies (glow map),
//           hydrothermal vents (black smokers), coral / kelp when shallow
//   solids  rock spires and boulders, vent chimneys, ruins handled by
//           the ruins env
//   water   caustics + light shafts in the shallows; marine snow, bubbles,
//           drifting jellyfish; deep fog that swallows distance
//
// Params: depth 'shallow' | 'mid' | 'deep' | 'hadal', trench 0..1 (chasm
//         depth), spires 0..1, vents 0..1, glow 0..1 (bioluminescence),
//         coral 0..1, kelp 0..1, bedZ, sediment colour,
//         base 0..1 (a flooded military base: habitat domes, pressure
//         modules and tubes, pylons with work lights, a sub pen, wreckage),
//         bones 0..1 (whale-fall skeletons with bacterial mats)

const LEN = 512;

const DEPTHS = {
  shallow: { sand: [0.62, 0.56, 0.42], rock: [0.38, 0.36, 0.32], top: [0.12, 0.42, 0.52], bottom: [0.05, 0.22, 0.3], caustics: [0.55, 0.012, 1.1] },
  mid: { sand: [0.42, 0.42, 0.38], rock: [0.3, 0.3, 0.3], top: [0.04, 0.18, 0.26], bottom: [0.01, 0.08, 0.13], caustics: [0.18, 0.01, 0.8] },
  deep: { sand: [0.3, 0.3, 0.29], rock: [0.2, 0.2, 0.21], top: [0.01, 0.06, 0.1], bottom: [0.0, 0.02, 0.04], caustics: null },
  hadal: { sand: [0.24, 0.24, 0.25], rock: [0.15, 0.15, 0.17], top: [0.0, 0.025, 0.045], bottom: [0.0, 0.006, 0.014], caustics: null },
};

export default {
  id: 'seabed',
  label: 'Seabed / trench',
  defaults: { depth: 'deep', trench: 0, spires: 0.4, vents: 0.2, glow: 0.4, coral: 0, kelp: 0, bedZ: -220, base: 0, bones: 0 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const D = DEPTHS[P.depth] || DEPTHS.deep;
    const seed = cfg.seed || cfg.id;
    const trenchX = (y) => 70 * Math.sin(y / 900) + 30 * Math.sin(y / 340);
    const height = (x, y) => {
      let h = (sampleField('fbm', x, y, 1400) - 0.5) * 70 + (sampleField('ridged', x, y, 2400) - 0.5) * 60;
      if (P.trench > 0) {
        const d = Math.abs(x - trenchX(y));
        const wall = 1 - smooth01((d - 110) / 170);                          // 1 inside the chasm
        const ledge = Math.round((d - 110) / 60) * 60;                        // stepped terraces on the walls
        h -= wall * 520 * P.trench - (wall > 0 && wall < 1 ? Math.sin(ledge * 0.05) * 18 : 0);
        h += (sampleField('ridged', x * 2, y * 2, 900) - 0.5) * 90 * wall;    // shattered rock on the walls
      }
      return h;
    };
    const S = { P, seed, D, height, trenchX, dust: [0.35, 0.4, 0.42] };
    S.atmosphere = {
      sky: { mode: 2, top: D.top, bottom: D.bottom },
      caustics: D.caustics,
      // Water swallows light with depth below the action plane.
      hfog: [{ shallow: 1 / 900, mid: 1 / 520, deep: 1 / 360, hadal: 1 / 300 }[P.depth] || 1 / 400, 0, 0.94],
    };
    S.layers = [{
      id: 'bed', z: P.bedZ, x0: -620, x1: 620, length: LEN, ppu: 0.85, grid: [40, 22], height, flatLight: true, glow: P.glow > 0 || P.vents > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: P.bedZ }];
    S.floorZ = P.bedZ;
    return S;
  },
};

function smooth01(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { spires: [], vents: [], blooms: [], coral: [], kelp: [], anchors: [], domes: [], modules: [], tubes: [], pylons: [], skeletons: [], mats: [] };
  const bz = P.bedZ;
  for (let i = 0; i < 8 * P.spires; i++) {
    const x = R.range(-560, 560), y = R.range(y0, y1);
    lay.spires.push({ x, y, r: R.range(10, 30), h: R.range(30, 120), seed: R.next(), z: bz + S.height(x, y) - 4 });
  }
  for (let i = 0; i < 3 * P.vents; i++) if (R.chance(0.7)) {
    const x = P.trench ? S.trenchX(R.range(y0, y1)) + R.range(-90, 90) : R.range(-400, 400), y = R.range(y0, y1), z = bz + S.height(x, y);
    const h = R.range(26, 70);
    lay.vents.push({ x, y, z, h, seed: R.next() });
    lay.anchors.push({ type: 'smoke', x, y, z: z + h, s: 1.3, dark: 1 });
    lay.anchors.push({ type: 'glow', x, y, z: z + h, r: 40, c: [1, 0.35, 0.1], a: 0.35, flicker: true });
    lay.anchors.push({ type: 'bubbles', x, y, z: z + h, s: 1 });
  }
  for (let i = 0; i < 20 * P.glow; i++) {
    const x = R.range(-560, 560), y = R.range(y0, y1);
    lay.blooms.push({ x, y, r: R.range(6, 22), c: R.pick([[0.2, 0.9, 1], [0.3, 1, 0.7], [0.6, 0.4, 1]]) });
  }
  for (let i = 0; i < 3 * P.glow; i++) lay.anchors.push({ type: 'jellyfish', x: R.range(-400, 400), y: R.range(y0, y1), z: bz + R.range(80, 260), s: R.range(0.7, 1.5), c: R.pick([[0.4, 0.8, 1], [1, 0.5, 0.8], [0.5, 1, 0.7]]) });
  for (let i = 0; i < 30 * P.coral; i++) lay.coral.push({ x: R.range(-560, 560), y: R.range(y0, y1), r: R.range(6, 18), c: R.pick([[0.85, 0.4, 0.35], [0.9, 0.7, 0.3], [0.6, 0.35, 0.65], [0.35, 0.65, 0.6]]), seed: R.next() });
  // Kelp grows in stands: clusters of tall stalks with fronds near the top.
  for (let i = 0; i < 7 * P.kelp; i++) {
    const cx = R.range(-560, 560), cy = R.range(y0, y1);
    for (let k = 0; k < R.int(4, 9); k++) { const x = cx + R.range(-50, 50), y = cy + R.range(-50, 50); lay.kelp.push({ x, y, z: P.bedZ + S.height(x, y), h: R.range(0.45, 0.85) * -P.bedZ, r: R.range(10, 20), lean: R.range(-0.3, 0.3), seed: R.next() }); }
  }
  // Flooded base: a cluster of habitats either side of the flight line.
  if (P.base > 0 && R.chance(P.base)) {
    const s = R.sign(), cx = s * R.range(110, 220), cy = R.range(y0 + 120, y1 - 120);
    const Z = (x, y) => bz + S.height(x, y);
    const pts = [];
    for (let k = 0; k < R.int(2, 4); k++) { const x = cx + R.range(-80, 80), y = cy + R.range(-110, 110), r = R.range(22, 36); lay.domes.push({ x, y, z: Z(x, y), r, broken: R.chance(0.35) }); pts.push([x, y]); lay.anchors.push({ type: 'glow', x, y, z: Z(x, y) + r * 0.8, r: r * 1.6, c: [0.5, 0.9, 1], a: 0.35, flicker: R.chance(0.4) }); }
    for (let k = 0; k < R.int(2, 3); k++) { const x = cx + R.range(-90, 90), y = cy + R.range(-120, 120), l = R.range(50, 90); lay.modules.push({ x, y, z: Z(x, y), l, r: R.range(8, 12), rot: R.chance(0.5) ? 0 : Math.PI / 2 }); pts.push([x, y]); }
    for (let k = 1; k < pts.length; k++) lay.tubes.push({ a: pts[k - 1], b: pts[k], za: Z(...pts[k - 1]) + 6, zb: Z(...pts[k]) + 6 });
    for (let k = 0; k < 4; k++) { const x = cx + R.range(-140, 140), y = cy + R.range(-150, 150), h = R.range(40, 80); lay.pylons.push({ x, y, z: Z(x, y), h }); lay.anchors.push({ type: 'searchlight', x, y, z: Z(x, y) + h, base: R.angle(), sweep: 0.9, speed: 0.006, c: [0.7, 0.9, 1] }); }
    lay.anchors.push({ type: 'beacon', x: cx, y: cy, z: Z(cx, cy) + 90, c: [1, 0.15, 0.1], period: 70 });
    lay.anchors.push({ type: 'bubbles', x: cx, y: cy, z: Z(cx, cy) + 30, s: 1.4 });
  }
  // Whale falls: a skeleton on the bed, a bacterial mat spreading around it.
  for (let i = 0; i < 2 * P.bones; i++) if (R.chance(0.75)) {
    const x = R.range(-300, 300), y = R.range(y0 + 150, y1 - 150), rot = R.range(-0.6, 0.6) + (R.chance(0.5) ? 0 : Math.PI), len = R.range(280, 420);
    lay.skeletons.push({ x, y, z: bz + S.height(x, y), rot, len, seed: R.next() });
    lay.mats.push({ x, y, r: len * 0.6, seed: R.next() });
    if (P.glow > 0) lay.anchors.push({ type: 'glow', x, y, z: bz + S.height(x, y) + 8, r: len * 0.5, c: [0.4, 1, 0.8], a: 0.2 });
  }
  if (S.D.caustics) for (let i = 0; i < 2; i++) lay.anchors.push({ type: 'shaftlight', x: R.range(-300, 300), y: R.range(y0, y1), z: 200, s: R.range(1, 1.6) });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const P = S.P, D = S.D;
  const all = [lay, ...nb.filter(Boolean)];
  // Sediment and rock materials, then the relief as a shading layer (multiply).
  seabedSurf(p, { color: D.sand });
  p.patch('fbm_60', 500, shade(D.sand, 0.75), 0.4);
  const trenchPath = () => { p.ctx.beginPath(); for (let y = c.y0 - 10; y <= c.y1 + 10; y += 16) p.ctx.lineTo(S.trenchX(y) - 260, y); for (let y = c.y1 + 10; y >= c.y0 - 10; y -= 16) p.ctx.lineTo(S.trenchX(y) + 260, y); p.ctx.closePath(); };
  if (P.trench > 0) rockSurf(p, { path: trenchPath, color: D.rock });
  p.layer((pp) => paintHeightfield(pp, S.height, (h, slope) => [1, 1, 1].map((v) => v * (1 - Math.min(0.5, Math.max(0, -h - 120) / 900))), { eps: 8, step: 2, shading: [0.32, 0.85] }), { op: 'multiply', alpha: 1 });
  for (const L of all) for (const cr of L.coral) {
    const R = new RNG(`cor:${cr.seed}`);
    for (let k = 0; k < 6; k++) p.radial(cr.x + R.range(-cr.r, cr.r), cr.y + R.range(-cr.r, cr.r), cr.r * R.range(0.4, 0.8), [[0, shade(cr.c, 1.15), 0.95], [0.7, cr.c, 0.8], [1, shade(cr.c, 0.6), 0]]);
  }
  for (const L of all) for (const m of L.mats) {
    const R = new RNG(`mat:${m.seed}`);
    for (let k = 0; k < 9; k++) p.radial(m.x + R.range(-0.6, 0.6) * m.r, m.y + R.range(-0.4, 0.4) * m.r, m.r * R.range(0.25, 0.5), [[0, [0.86, 0.84, 0.7], 0.55], [0.7, [0.7, 0.7, 0.55], 0.25], [1, [0.6, 0.6, 0.5], 0]]);
  }
  for (const L of all) for (const d of L.domes) p.radial(d.x, d.y, d.r * 2, [[0.5, [0.2, 0.2, 0.2], 0.45], [1, [0.2, 0.2, 0.2], 0]]);
  for (const L of all) for (const kp of L.kelp) {
    const R = new RNG(`kelp:${kp.seed}`);
    for (let k = 0; k < 7; k++) { const a = R.angle(), l = R.range(14, 34); p.line([kp.x, kp.y, kp.x + Math.cos(a) * l, kp.y + Math.sin(a) * l], R.range(2, 3.5), [0.25, 0.32, 0.12], 0.85, { cap: 'round' }); }
  }
  p.props(() => new RNG(`sb:${lay.seed}`), () => {
    for (const L of all) for (const s of L.spires) p.shadowCircle(s.x, s.y, s.r * 0.8, s.h, 0, 8);
    for (const L of all) for (const v of L.vents) p.shadowCircle(v.x, v.y, 8, v.h, 0, 8);
    for (const L of all) for (const d of L.domes) p.shadowCircle(d.x, d.y, d.r, d.r, 0, 10);
    for (const L of all) for (const m of L.modules) p.shadowBox(m.x, m.y, m.rot ? m.l : m.r * 2, m.rot ? m.r * 2 : m.l, m.r * 2, 0, 8);
    for (const L of all) for (const sk of L.skeletons) p.shadowBox(sk.x, sk.y, 30, sk.len, 12, sk.rot, 6);
  }, 0.4, 5);
  if (p.env.glow) {
    for (const L of all) for (const b of L.blooms) p.env.glow.radial(b.x, b.y, b.r, [[0, b.c, 0.9 * P.glow], [0.5, b.c, 0.35 * P.glow], [1, b.c, 0]], 'lighter');
    for (const L of all) for (const v of L.vents) p.env.glow.radial(v.x, v.y, 30, [[0, [1, 0.4, 0.1], 0.5], [1, [1, 0.2, 0.05], 0]], 'lighter');
  }
}

function mesh(mb, lay, S) {
  for (const d of lay.domes) {
    const prof = []; for (let k = 0; k <= 7; k++) { const a = (k / 7) * Math.PI / 2; prof.push([Math.cos(a) * d.r + 0.01, d.z + 6 + Math.sin(a) * d.r * (d.broken ? 0.55 : 0.85)]); }
    mb.lathe(d.x, d.y, [[d.r + 3, d.z - 2], [d.r + 3, d.z + 6], ...prof], d.broken ? 'rust' : 'containment', { seg: 16 });
  }
  for (const m of lay.modules) {
    const c = Math.cos(m.rot), s = Math.sin(m.rot), dx = s * m.l / 2, dy = c * m.l / 2;
    mb.beam([m.x - dx, m.y - dy, m.z + m.r], [m.x + dx, m.y + dy, m.z + m.r], m.r * 2, m.r * 2, 'hull_grey');
    for (const k of [-1, 1]) mb.box(m.x + dx * k * 0.8, m.y + dy * k * 0.8, m.z - 2, m.r * 2.4, 6, m.r + 2, m.rot, { top: 'concrete_dark', side: 'concrete_dark' });
  }
  for (const tb of lay.tubes) mb.beam([tb.a[0], tb.a[1], tb.za], [tb.b[0], tb.b[1], tb.zb], 5, 5, 'steel_painted');
  for (const py of lay.pylons) { mb.box(py.x, py.y, py.z, 4, 4, py.h, 0, { top: 'lattice_grey', side: 'lattice_grey' }); mb.box(py.x, py.y, py.z + py.h, 9, 6, 4, 0, { top: 'metal_dark', side: 'metal_dark' }); }
  for (const sk of lay.skeletons) {
    const R = new RNG(`skel:${sk.seed}`), c = Math.cos(sk.rot), s = Math.sin(sk.rot);
    const at = (u, v) => [sk.x - s * u + c * v, sk.y + c * u + s * v];
    // Spine of vertebrae, the skull at one end, rib arcs along the front half.
    for (let u = -sk.len / 2; u < sk.len / 2 - 30; u += 9) { const [x, y] = at(u, 0); mb.box(x, y, sk.z, 12, 8, 8 + R.range(0, 3), sk.rot, { top: 'bone', side: 'bone' }); }
    const [hx, hy] = at(sk.len / 2 - 14, 0);
    mb.box(hx, hy, sk.z, 44, 60, 16, sk.rot, { top: 'bone', side: 'bone' });
    for (let u = -sk.len * 0.15; u < sk.len * 0.35; u += 18) for (const side of [-1, 1]) {
      const w = 46 * (1 - Math.abs(u) / sk.len), p0 = at(u, 0), p1 = at(u - 6, side * w * 0.7), p2 = at(u - 12, side * w);
      mb.beam([p0[0], p0[1], sk.z + 8], [p1[0], p1[1], sk.z + 24], 4, 4, 'bone');
      mb.beam([p1[0], p1[1], sk.z + 24], [p2[0], p2[1], sk.z + 2], 3.6, 3.6, 'bone');
    }
  }
  for (const kp of lay.kelp) {
    const tx = kp.x + kp.lean * kp.h * 0.4, ty = kp.y + kp.h * 0.15;
    mb.beam([kp.x, kp.y, kp.z], [tx, ty, kp.z + kp.h], 1.6, 1.6, 'roof_garden');
    // Frond canopy: an irregular blade cluster at the stalk top, plus a mid-level frond.
    for (const [f, rr] of [[1, kp.r], [0.6, kp.r * 0.6]]) {
      const z = kp.z + kp.h * f, cx = kp.x + (tx - kp.x) * f, cy = kp.y + (ty - kp.y) * f, pts = [];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + kp.seed * 9, q = rr * (0.55 + 0.45 * Math.abs(Math.sin(kp.seed * 70 + k * 1.9))); pts.push(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
      mb.prism(pts, z - 0.6, z, { top: 'roof_garden', side: 'roof_garden' });
    }
  }
  for (const s of lay.spires) meshBoulder(mb, s.x, s.y, s.r, s.h, s.seed, 'rock_dark', s.z);
  for (const v of lay.vents) {
    const R = new RNG(`vent:${v.seed}`);
    mb.lathe(v.x, v.y, [[14, v.z], [10, v.z + v.h * 0.4], [7 + R.range(0, 3), v.z + v.h * 0.8], [5, v.z + v.h]], 'vent_rock', { seg: 10, top: 'molten_top' });
  }
}
