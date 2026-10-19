import { concrete } from '../paint/surfaces.js';
import { scorch, debris, crate } from '../paint/props.js';
import { RNG } from '../../core/RNG.js';

// DATA CENTRE (cutaway, roof removed): raised-floor halls with rows of server
// racks along the flight path, hot/cold aisles, overhead cable trays crossing
// the hall, cooling units on the walls, a glass-walled core cage holding the
// main cluster, cable bundles. Compromised: alarm beacons, sparks, a rack fire.
//
// Params: alert 0..1, damage 0..1, coldLight (bool: blue-white work lights)

const LEN = 512, ROWS = [70, 128, 186, 244, 302, 360];

export default {
  id: 'datacenter',
  label: 'Data centre',
  defaults: { alert: 0.4, damage: 0.3 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.5, 0.52, 0.55] };
    S.layers = [{
      id: 'floor', z: 0, x0: -440, x1: 440, length: LEN, ppu: 1.4, glow: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.atmosphere = { hfog: [1 / 200, 20, 0.2] };
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { racks: [], trays: [], cages: [], cool: [], anchors: [], damaged: [] };
  for (const s of [-1, 1]) for (const x of ROWS) {
    // Each row: runs of racks with gaps for cross aisles every 160.
    for (let y = Math.ceil(y0 / 160) * 160 + 14; y < y1; y += 160) {
      const n = R.int(5, 7);
      for (let k = 0; k < n; k++) {
        const yy = y + k * 19, h = R.range(34, 40), broken = R.chance(P.damage * 0.12);
        if (yy >= y1) break;
        lay.racks.push({ x: s * x, y: yy, h, broken, face: s });
        if (broken) { lay.damaged.push({ x: s * x, y: yy }); if (R.chance(0.5)) lay.anchors.push({ type: 'spark', x: s * x, y: yy, z: h }); else lay.anchors.push({ type: 'fire', x: s * x, y: yy, z: h, s: 0.7 }); }
      }
    }
  }
  for (let y = Math.ceil(y0 / 128) * 128 + 64; y < y1; y += 128) lay.trays.push({ y });
  if (R.chance(0.35)) { const y = R.range(y0 + 100, y1 - 100); lay.cages.push({ y }); lay.anchors.push({ type: 'glow', x: 0, y, z: 10, r: 80, c: [0.3, 0.6, 1], a: 0.35, flicker: true }); }
  for (const s of [-1, 1]) for (let y = Math.ceil(y0 / 96) * 96; y < y1; y += 96) lay.cool.push({ x: s * 418, y });
  for (let i = 0; i < 3 * P.alert; i++) lay.anchors.push({ type: 'beacon', x: R.sign() * R.range(380, 420), y: R.range(y0, y1), z: 50, c: [1, 0.08, 0.05], period: 34 });
  for (let i = 0; i < 2 * P.alert; i++) lay.anchors.push({ type: 'searchlight', x: R.sign() * 400, y: R.range(y0, y1), z: 60, c: [1, 0.12, 0.08], base: R.angle(), sweep: 4, speed: 0.05 });
  for (let y = Math.ceil(y0 / 64) * 64; y < y1; y += 64) for (const x of [-30, 30]) lay.anchors.push({ type: 'lamp', x, y, z: 70, c: [0.75, 0.88, 1], len: 22, rot: Math.PI / 2 });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  // Raised floor: 600 mm tiles (≈ 3.6 units), some perforated (cold aisles).
  concrete(p, { color: [0.62, 0.63, 0.64] });
  const T = 12;
  for (let x = Math.floor(-440 / T) * T; x <= 440; x += T) p.line([x, y0 - 4, x, y1 + 4], 0.5, [0.32, 0.33, 0.35], 0.7);
  for (let y = Math.floor(y0 / T) * T; y <= y1; y += T) p.line([-444, y, 444, y], 0.5, [0.32, 0.33, 0.35], 0.7);
  for (const s of [-1, 1]) for (let i = 0; i < ROWS.length - 1; i += 2) {
    const x0 = s * (ROWS[i] + 10), x1 = s * (ROWS[i + 1] - 10);
    for (let y = Math.floor(y0 / T) * T; y < y1; y += T) for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += T) {
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) p.circlePath(x + 2.5 + a * 3.5, y + 2.5 + b * 3.5, 0.7).fill([0.2, 0.22, 0.25], 0.8);
    }
  }
  // Yellow-black edging along the central walkway; cable bundles under floor hatches.
  p.layer(() => { for (const s of [-1, 1]) p.line([s * 46, y0 - 4, s * 46, y1 + 4], 2.5, [0.9, 0.75, 0.1], 1, { dash: [6, 6], dashOffset: -(y0 % 12) }); }, { wear: ['fine_60', 50, 1], alpha: 0.8 });
  p.props(() => new RNG(`dc:${lay.seed}`), (Rp) => {
    for (const L of all) for (const r of L.racks) p.shadowBox(r.x, r.y, 12, 18, r.h);
    for (const L of all) for (const t of L.trays) p.shadowBox(0, t.y, 880, 10, 66, 0, 60);
    for (const L of all) for (const cg of L.cages) p.shadowBox(0, cg.y, 70, 90, 46);
    for (const L of all) for (const d of L.damaged) { scorch(p, Rp, d.x, d.y, 18); debris(p, Rp, d.x, d.y, 22, 25, { color: [0.3, 0.3, 0.32] }); }
    for (let i = 0; i < 5; i++) crate(p, Rp, Rp.sign() * Rp.range(392, 410), Rp.range(y0, y1), Rp.range(6, 9), 0, { color: [0.55, 0.52, 0.45] });
  }, 0.5, 2.5);
  if (p.env.glow) {
    for (const L of all) for (const r of L.racks) if (!r.broken) p.env.glow.rectPath(r.x - r.face * 7 - 1.5, r.y - 8, 3, 16).fill([0.2, 0.9, 0.5], 0.35, 'lighter');
    for (const L of all) for (const a of L.anchors) if (a.type === 'lamp') p.env.glow.radial(a.x, a.y, 36, [[0, [0.7, 0.85, 1], 0.35], [1, [0.6, 0.8, 1], 0]], 'lighter');
  }
}

function mesh(mb, lay) {
  for (const r of lay.racks) {
    mb.box(r.x, r.y, 0, 12, 18, r.h, 0, { top: 'rack_top', side: 'metal_dark', sides: [null, r.face < 0 ? 'server_rack' : null, null, r.face > 0 ? 'server_rack' : null] });
    if (r.broken) mb.box(r.x + 4, r.y, 0, 12, 18, 8, 0.6, { top: 'scorch', side: 'scorch' });
  }
  for (const t of lay.trays) {
    mb.box(0, t.y, 60, 880, 10, 3, 0, { top: 'grating', side: 'steel_yellow' });
    for (const o of [-3, 0, 3]) mb.beam([-440, t.y + o, 63.5], [440, t.y + o, 63.5], 1.6, 1.6, o ? 'metal_dark' : 'steel_yellow');
  }
  for (const cg of lay.cages) {
    // Core cluster behind glass: a ring of racks around a cooling core.
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; mb.box(Math.cos(a) * 26, cg.y + Math.sin(a) * 30, 0, 10, 14, 44, a, { top: 'rack_top', side: 'server_rack' }); }
    mb.lathe(0, cg.y, [[9, 0], [9, 50], [0, 54]], 'containment', { seg: 14 });
    for (const [x0, y0a, x1, y1a] of [[-35, -45, 35, -45], [35, -45, 35, 45], [35, 45, -35, 45], [-35, 45, -35, -45]]) mb.wall(x0, cg.y + y0a, x1, cg.y + y1a, 0, 46, 'facade_glass', { ao: 1 });
  }
  for (const cu of lay.cool) mb.box(cu.x, cu.y, 0, 34, 60, 34, 0, { top: 'roof_metal', side: 'steel_painted' });
}
