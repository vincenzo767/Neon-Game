import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// ORGANIC INTERIOR (inside a colossal creature): a gullet of wet flesh folds
// (heightfield) netted with veins, bone ribs arching across the flight path,
// rows of tooth ridges along the walls, glossy mucus, pools of digestive acid
// (an animated molten surface in bile colours), and a heartbeat that pulses
// light through the walls.
//
// Params: mode 'gullet' | 'heart', acid 0..1, ribs 0..1, teeth 0..1, pulse 0..1

const LEN = 512;

export default {
  id: 'flesh',
  label: 'Organic interior',
  defaults: { mode: 'gullet', acid: 0.5, ribs: 0.8, teeth: 0.6, pulse: 0.6, bedZ: -120 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const heart = P.mode === 'heart';
    const height = (x, y) => {
      // Folds run across the tube (peristalsis rings) with lumpy tissue on top;
      // walls rise steeply at the sides.
      const ring = Math.sin(y / (heart ? 60 : 44) + sampleField('fbm', x, y, 500) * 4) * (heart ? 26 : 18);
      const lump = (sampleField('fbm', x, y, 380) - 0.5) * 60 + (sampleField('ridged', x, y, 900) - 0.5) * 40;
      const wall = Math.max(0, Math.abs(x) - (heart ? 300 : 230)) * 0.9;
      return ring + lump + wall;
    };
    const S = { P, height, seed: cfg.seed || cfg.id, dust: [0.5, 0.2, 0.2], gz: P.bedZ };
    S.atmosphere = {
      sky: { mode: 3, top: [0.08, 0.0, 0.01], bottom: [0.04, 0.0, 0.01] },
      surfaces: P.acid > 0 ? [{ type: 'lava', z: P.bedZ - 6, hot: [0.6, 0.62, 0.16], crust: [0.16, 0.1, 0.05], flow: [0.3, -1, 0.5, 0.6] }] : [],
      hfog: [1 / 260, P.bedZ + 120, 0.6],
    };
    S.layers = [{
      id: 'tissue', z: P.bedZ, x0: -560, x1: 560, length: LEN, ppu: 0.95, grid: [40, 22], height, flatLight: true, glow: true, cut: P.acid > 0,
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
  const lay = { ribs: [], teeth: [], pools: [], anchors: [], vessels: [] };
  for (let y = Math.ceil(y0 / 150) * 150; y < y1; y += 150) if (R.chance(P.ribs)) lay.ribs.push({ y: y + R.range(-20, 20), bend: R.range(-30, 30) });
  for (const s of [-1, 1]) for (let y = Math.ceil(y0 / 46) * 46; y < y1; y += 46) if (R.chance(P.teeth)) lay.teeth.push({ x: s * R.range(200, 240), y, h: R.range(26, 60), r: R.range(8, 13), lean: -s * R.range(0.2, 0.5) });
  for (let i = 0; i < 2 * P.acid; i++) if (R.chance(0.7)) lay.pools.push({ x: R.range(-160, 160), y: R.range(y0 + 60, y1 - 60), r: R.range(40, 90), seed: R.next() });
  for (let i = 0; i < 4 * P.pulse; i++) lay.anchors.push({ type: 'pulse', x: R.range(-280, 280), y: R.range(y0, y1), z: S.gz + 10, r: R.range(70, 140), c: [1, 0.15, 0.2], a: 0.35 });
  if (S.P.mode === 'heart') for (const s of [-1, 1]) lay.vessels.push({ x: s * R.range(260, 340), y0, y1 });
  for (let i = 0; i < 3; i++) lay.anchors.push({ type: 'steam', x: R.range(-200, 200), y: R.range(y0, y1), z: S.gz + 6, s: 1.4 });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  const heart = P.mode === 'heart';
  paintHeightfield(p, S.height, (h, slope, x, y) => {
    const base = heart ? [0.5, 0.06, 0.1] : [0.55, 0.16, 0.16];
    const deep = shade(base, 0.45);
    const fat = [0.75, 0.55, 0.42];
    let col = mix(deep, base, Math.min(1, (h + 40) / 80));
    col = mix(col, fat, Math.max(0, sampleField('fine', x, y, 220) - 0.62) * 1.4);
    return col;
  }, { eps: 6, step: 2, shading: [0.3, 0.95] });
  // Veins: branching dark-red channels; wet specular sheen on the ridges.
  const R = new RNG(`veins:${lay.seed}`);
  for (let i = 0; i < 14; i++) p.crack(R, R.range(-540, 540), R.range(c.y0, c.y1), R.angle(), R.range(60, 200), 2.6, heart ? [0.32, 0.02, 0.08] : [0.36, 0.05, 0.1], 0.85, 3);
  p.patch('fine_70', 90, [1, 0.85, 0.85], 0.22);
  p.noise('fbm', 260, 'soft-light', 0.35);
  p.props(() => new RNG(`fl:${lay.seed}`), () => {
    for (const L of all) for (const r of L.ribs) p.shadowBox(r.bend * 0.3, r.y, 600, 22, 150, 0, 110);
    for (const L of all) for (const t of L.teeth) p.shadowCircle(t.x, t.y, t.r, t.h, 0, 7);
  }, 0.45, 5);
  if (p.env.glow) {
    const Rg = new RNG(`vg:${lay.seed}`);
    for (let i = 0; i < 10; i++) p.env.glow.crack(Rg, Rg.range(-500, 500), Rg.range(c.y0, c.y1), Rg.angle(), Rg.range(60, 180), 4, [0.9, 0.08, 0.15], 0.45, 2);
    for (const L of all) for (const pl of L.pools) p.env.glow.radial(pl.x, pl.y, pl.r * 1.4, [[0, [0.5, 0.9, 0.1], 0.35], [1, [0.4, 0.8, 0.1], 0]], 'lighter');
  }
  // Acid pools: holes through the tissue to the bile surface below, with a raw rim.
  for (const L of all) for (const pl of L.pools) {
    const Rp = new RNG(`pool:${pl.seed}`), pts = [];
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, rr = pl.r * Rp.range(0.75, 1.1); pts.push(pl.x + Math.cos(a) * rr, pl.y + Math.sin(a) * rr * 0.8); }
    p.poly(pts).stroke([0.8, 0.75, 0.3], 4, 0.6);
    p.poly(pts).fill([0, 0, 0], 1, 'destination-out');
  }
}

function mesh(mb, lay, S) {
  const gz = S.gz;
  for (const r of lay.ribs) {
    // A bone rib arching over the tube: segments up the wall, across, and down.
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, x = -320 + 640 * t; pts.push([x, r.y + r.bend * Math.sin(t * Math.PI), gz + 30 + Math.sin(t * Math.PI) * 120]); }
    for (let k = 0; k < 8; k++) mb.beam(pts[k], pts[k + 1], 18, 14, 'bone');
  }
  for (const t of lay.teeth) {
    const tipX = t.x + Math.sin(t.lean) * t.h;
    mb.lathe(t.x, t.y, [[t.r, gz + 10], [t.r * 0.8, gz + 10 + t.h * 0.5], [0.4, gz + 10 + t.h]], 'bone', { seg: 8 });
    void tipX;
  }
  for (const v of lay.vessels) {
    // Great arteries along the chamber wall.
    mb.beam([v.x, v.y0 - 2, gz + 40], [v.x + 20, v.y1 + 2, gz + 55], 34, 30, 'flesh_vessel');
  }
}
