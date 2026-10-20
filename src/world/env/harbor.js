import { concrete, asphalt } from '../paint/surfaces.js';
import { container, truck, crate, drum, carColor, car } from '../paint/props.js';
import { meshShip, shipSize } from '../kit/ships.js';
import { RNG } from '../../core/RNG.js';

// HARBOUR / PORT: water basins and a shipping channel along the flight path,
// container quays with ship-to-shore gantry cranes reaching over the water,
// stacked boxes, warehouses, moored ships, a fuel pier, tugs under way,
// lights and searchlights at night, fires when under attack.
//
//   water   surface at z = 0
//   quay    land layer at z = 7 (cut: alpha where the water shows through)
//
// Params: night (bool), fires 0..1, ships 0..1 (moored), cranes 0..1,
//         channel (half-width of open water), tropical (bool: lighter water)

const LEN = 512, QZ = 7;

export default {
  id: 'harbor',
  label: 'Harbour / container port',
  defaults: { night: true, fires: 0.3, ships: 0.7, cranes: 0.8, channel: 170, tropical: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.5, 0.5, 0.5] };
    const ch = P.channel;
    // Quay edge on each side meanders a little; piers jut into the channel now and then.
    S.edge = (y, s) => ch + 18 * Math.sin(y / 700 + s) + (s > 0 ? 20 : 0);
    S.pierAt = (m) => { const R = new RNG(`${S.seed}:pier:${m}`); return R.chance(0.45) ? { y: m * 600 + R.range(100, 500), s: R.sign(), len: R.range(70, 130), w: R.range(30, 46) } : null; };
    S.atmosphere = {
      surfaces: [{ type: 'water', z: 0, deep: P.tropical ? [0.02, 0.18, 0.24] : [0.015, 0.05, 0.07], shallow: P.tropical ? [0.08, 0.36, 0.4] : [0.03, 0.09, 0.11], sky: P.night ? [0.08, 0.1, 0.14] : [0.45, 0.55, 0.65], wave: [0.35, 1.5, 0.6, 0.25], foam: [0.04, 0.95, 0.08, 0], wind: [0.6, 0.3] }],
      glowTint: [1.1, 1, 0.9],
    };
    S.layers = [{
      id: 'quay', z: QZ, x0: -520, x1: 520, length: LEN, ppu: 1.2, cut: true, glow: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: QZ, contains: (x, y) => Math.abs(x) > S.edge(y, Math.sign(x)) }, { z: 0, water: true }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { stacks: [], cranes: [], sheds: [], moored: [], movers: [], anchors: [], tanks: [], piers: [], trucks: [] };
  for (let m = Math.floor((y0 - 300) / 600); m <= Math.floor((y1 + 300) / 600); m++) { const pr = S.pierAt(m); if (pr && pr.y >= y0 && pr.y < y1) lay.piers.push(pr); }
  for (const s of [-1, 1]) {
    // STS cranes along the quay edge.
    for (let y = Math.ceil(y0 / 150) * 150; y < y1; y += 150) {
      if (!R.chance(P.cranes)) continue;
      const ex = s * S.edge(y, s);
      lay.cranes.push({ x: ex + s * 22, y, s, boom: R.chance(0.7) ? 1 : 0 });
      lay.anchors.push({ type: 'beacon', x: ex - s * 50, y, z: QZ + 120, c: [1, 0.15, 0.05], period: 70 + R.int(0, 20) });
      if (P.night) lay.anchors.push({ type: 'lamp', x: ex + s * 22, y, z: QZ + 70, c: [1, 0.85, 0.6], len: 14 });
    }
    // Container stacks behind the cranes, warehouses further back.
    for (let y = y0 + 20; y < y1 - 10; y += 46) {
      for (let k = 0; k < 4; k++) {
        const x = s * (S.edge(y, s) + 70 + k * 18);
        if (R.chance(0.82)) lay.stacks.push({ x, y, n: R.int(1, 4), seed: R.next() });
      }
    }
    for (let y = y0 + 60; y < y1; y += R.range(150, 220)) lay.sheds.push({ x: s * (S.edge(y, s) + 230), y, w: R.range(80, 120), d: R.range(90, 130), h: R.range(26, 40) });
    // Moored ships alongside.
    if (R.chance(P.ships)) {
      const type = R.pick(['freighter', 'tanker', 'freighter', 'destroyer']), sz = shipSize(type);
      const y = R.range(y0 + sz.l * 0.5, y1 - sz.l * 0.5);
      const x = s * (S.edge(y, s) - sz.b * 0.5 - 6);
      lay.moored.push({ type, x, y, burnt: R.chance(P.fires * 0.5) });
      if (lay.moored.at(-1).burnt) lay.anchors.push({ type: 'fire', x, y: y + R.range(-40, 40), z: 14, s: 1.8 });
    }
    if (R.chance(0.3)) lay.tanks.push({ x: s * (S.edge(y0, s) + 300), y: R.range(y0 + 60, y1 - 60), r: R.range(30, 42) });
    for (let i = 0; i < 3; i++) lay.trucks.push({ x: s * (S.edge(y0, s) + 50), y: R.range(y0, y1), rot: R.chance(0.5) ? 0 : Math.PI, color: carColor(R) });
  }
  // Tugs / patrol boats under way in the channel.
  if (R.chance(0.6)) lay.movers.push({ kind: 'ship', type: R.pick(['tug', 'patrol', 'trawler']), x: R.range(-90, 90), y: R.range(y0, y1), rot: R.chance(0.5) ? 0 : Math.PI, vx: 0, vy: 0, l: 50, b: 12 });
  for (const mv of lay.movers) { mv.vy = (mv.rot ? -1 : 1) * R.range(0.25, 0.5); const sz = shipSize(mv.type); mv.l = sz.l; mv.b = sz.b; }
  if (P.night) for (let i = 0; i < 2; i++) lay.anchors.push({ type: 'searchlight', x: R.sign() * R.range(200, 300), y: R.range(y0, y1), z: QZ + 40, base: R.chance(0.5) ? 0 : Math.PI, sweep: 0.8, speed: 0.008 });
  for (let i = 0; i < 2 * P.fires; i++) if (R.chance(0.5)) { const s = R.sign(); lay.anchors.push({ type: 'fire', x: s * R.range(220, 420), y: R.range(y0, y1), z: QZ + 2, s: R.range(1, 1.6) }); }
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  concrete(p, { color: [0.48, 0.47, 0.45], joints: [16, 16] });
  for (const s of [-1, 1]) {
    // Heavy-duty apron along the quay edge with crane rails; asphalt roads behind.
    const apron = () => { p.ctx.beginPath(); for (let y = y0 - 10; y <= y1 + 10; y += 16) p.ctx.lineTo(s * S.edge(y, s), y); for (let y = y1 + 10; y >= y0 - 10; y -= 16) p.ctx.lineTo(s * (S.edge(y, s) + 44), y); p.ctx.closePath(); };
    concrete(p, { path: apron, color: [0.56, 0.55, 0.52], joints: [20, 40] });
    for (const o of [8, 36]) { const pts = []; for (let y = y0 - 10; y <= y1 + 10; y += 16) pts.push(s * (S.edge(y, s) + o), y); p.line(pts, 1, [0.25, 0.25, 0.27], 0.9); }
    const road = () => { p.ctx.beginPath(); for (let y = y0 - 10; y <= y1 + 10; y += 16) p.ctx.lineTo(s * (S.edge(y, s) + 150), y); for (let y = y1 + 10; y >= y0 - 10; y -= 16) p.ctx.lineTo(s * (S.edge(y, s) + 190), y); p.ctx.closePath(); };
    asphalt(p, { path: road, color: [0.22, 0.22, 0.23] });
    // Yellow lane markings in the stack yard.
    for (let k = 0; k < 4; k++) { const pts = []; for (let y = y0 - 10; y <= y1 + 10; y += 16) pts.push(s * (S.edge(y, s) + 61 + k * 18), y); p.line(pts, 0.6, [0.9, 0.75, 0.15], 0.6); }
    // Quay edge: bollards and fenders.
    for (let y = Math.ceil(y0 / 24) * 24; y < y1; y += 24) { const ex = s * S.edge(y, s); p.circlePath(ex + s * 3, y, 1.6).fill([0.12, 0.12, 0.13]); p.rectPath(ex - 1, y - 4, 2, 8).fill([0.08, 0.08, 0.08]); }
  }
  for (const L of all) for (const pr of L.piers) concrete(p, { path: () => p.rectPath(pr.s > 0 ? S.edge(pr.y, 1) - pr.len : -S.edge(pr.y, -1), pr.y - pr.w / 2, pr.len, pr.w), color: [0.52, 0.5, 0.47] });
  p.props(() => new RNG(`hb:${lay.seed}`), (Rp) => {
    for (const L of all) for (const st of L.stacks) for (let k = 0; k < st.n; k++) p.shadowBox(st.x, st.y, 14, 38, (k + 1) * 14, Math.PI / 2, k * 14);
    for (const L of all) for (const cr of L.cranes) { p.shadowBox(cr.x, cr.y, 40, 24, 70); p.shadowBox(cr.x - cr.s * (cr.boom ? 60 : 20), cr.y, cr.boom ? 170 : 90, 8, 110, 0, 98); }
    for (const L of all) for (const sh of L.sheds) p.shadowBox(sh.x, sh.y, sh.w, sh.d, sh.h);
    for (const L of all) for (const t of L.tanks) p.shadowCircle(t.x, t.y, t.r, 34, 0, 14);
    for (const L of all) for (const t of L.trucks) Rp.chance(0.6) ? truck(p, t.x, t.y, t.rot, { cargo: 'box', color: [0.6, 0.12, 0.08], cab: [0.85, 0.85, 0.82] }) : car(p, t.x, t.y, t.rot, { color: t.color });
    for (let i = 0; i < 8; i++) { const s = Rp.sign(); drum(p, s * Rp.range(200, 460), Rp.range(y0, y1), { color: [0.2, 0.32, 0.5] }); crate(p, Rp, s * Rp.range(200, 460), Rp.range(y0, y1), Rp.range(5, 8)); }
  }, 0.55, 2.4);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) {
    if (a.type === 'lamp') p.env.glow.radial(a.x, a.y, 60, [[0, [1, 0.8, 0.55], 0.5], [1, [1, 0.7, 0.4], 0]], 'lighter');
    if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.42, 0.1], 0.5], [1, [1, 0.3, 0.05], 0]], 'lighter');
  }
  // Cut the water out: everything inside the quay edges (and around piers) is open water.
  p.ctx.beginPath();
  for (let y = y0 - 10; y <= y1 + 10; y += 16) p.ctx.lineTo(-S.edge(y, -1), y);
  for (let y = y1 + 10; y >= y0 - 10; y -= 16) p.ctx.lineTo(S.edge(y, 1), y);
  p.ctx.closePath();
  p.fill([0, 0, 0], 1, 'destination-out');
  // Piers back over the water.
  for (const L of all) for (const pr of L.piers) {
    const x0 = pr.s > 0 ? S.edge(pr.y, 1) - pr.len : -S.edge(pr.y, -1);
    p.layer(() => concrete(p, { path: () => p.rectPath(x0, pr.y - pr.w / 2, pr.len, pr.w), color: [0.52, 0.5, 0.47] }));
  }
  void P;
}

function mesh(mb, lay, S) {
  const MATS = ['container_red', 'container_blue', 'container_green', 'container_orange', 'container_grey', 'container_teal'];
  for (const st of lay.stacks) {
    const R = new RNG(`hst:${st.seed}`);
    for (let k = 0; k < st.n; k++) { const m = R.pick(MATS); mb.box(st.x, st.y, QZ + k * 14, 14, 38, 14, Math.PI / 2, { top: m, side: m }); }
  }
  for (const cr of lay.cranes) {
    // Ship-to-shore gantry: four legs, portal beams, the boom out over the water, machinery house.
    const s = cr.s;
    for (const dy of [-11, 11]) for (const dx of [-16, 16]) mb.box(cr.x + dx, cr.y + dy, QZ, 3.5, 3.5, 74, 0, { top: 'steel_painted', side: 'steel_painted' });
    for (const dy of [-11, 11]) mb.beam([cr.x - 18, cr.y + dy, QZ + 72], [cr.x + 18, cr.y + dy, QZ + 72], 4, 6, 'steel_painted');
    const out = cr.boom ? 150 : 40, back = 60;
    mb.box(cr.x - s * (out - back) / 2, cr.y, QZ + 96, out + back, 9, 8, 0, { top: 'steel_yellow', side: 'steel_yellow' });
    mb.box(cr.x + s * 28, cr.y, QZ + 104, 26, 18, 14, 0, { top: 'roof_metal', side: 'steel_yellow' });
    mb.beam([cr.x, cr.y, QZ + 104], [cr.x, cr.y, QZ + 128], 3, 3, 'steel_painted');
    mb.beam([cr.x, cr.y, QZ + 128], [cr.x - s * out, cr.y, QZ + 104], 1, 1, 'metal_dark');
    mb.box(cr.x - s * out * 0.6, cr.y, QZ + 90, 10, 12, 6, 0, { top: 'metal_dark', side: 'metal_dark' });
  }
  for (const sh of lay.sheds) mb.box(sh.x, sh.y, QZ, sh.w, sh.d, sh.h, 0, { top: 'roof_metal', side: 'facade_industrial' });
  for (const t of lay.tanks) mb.lathe(t.x, t.y, [[t.r, QZ], [t.r, QZ + 30], [t.r * 0.9, QZ + 33], [0, QZ + 35]], 'containment', { seg: 20 });
  for (const ms of lay.moored) meshShip(mb, ms.type, ms.x, ms.y, 0, { burnt: ms.burnt });
}
