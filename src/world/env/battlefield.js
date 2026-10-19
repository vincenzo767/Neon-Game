import { ash, asphalt, mud, snow as snowSurf, sand as sandSurf, dirt } from '../paint/surfaces.js';
import { tank, truck, crater, scorch, rubble, debris, sandbags, drum, carColor, car } from '../paint/props.js';
import { trench, barbedWire, stump } from '../kit/terrain.js';
import { meshBunker, meshHedgehog, meshBoulder } from '../kit/terrain.js';
import { planBuilding, meshBuilding, shadowBuilding, buildingAnchors } from '../kit/city.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// OPEN BATTLEFIELD / SIEGE LINE: cratered ground (ash, mud, snow or sand),
// a shattered road, zig-zag trench lines with sandbags and wire, bunkers,
// blast-wall lines with breaches, tank-trap rows, wrecked armour, ruined
// buildings at the flanks (a war-torn skyline leaning in at the edges),
// burnt stumps, artillery pits, fires and smoke columns.
//
// Params: ground 'ash' | 'mud' | 'snow' | 'sand' | 'dirt'
//         craters 0..1, ruins 0..1 (flank ruins), fort 0..1 (walls, bunkers),
//         fires 0..1, armour 0..1 (wrecked tanks), road (bool), trees 0..1

const LEN = 512;
const GROUND = { ash, mud, snow: snowSurf, sand: sandSurf, dirt };

export default {
  id: 'battlefield',
  label: 'Battlefield / siege line',
  defaults: { ground: 'ash', craters: 0.7, ruins: 0.6, fort: 0.6, fires: 0.5, armour: 0.5, road: true, trees: 0.4 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const roadX = (y) => -70 + 40 * Math.sin(y / 600);
    // Fortification lines across the field, one candidate every 650 units.
    const lineAt = (m) => {
      const R = new RNG(`${seed}:fortline:${m}`);
      if (m < 0 || R.next() > P.fort) return null;
      return { y: m * 650 + R.range(100, 500), gap: R.range(-150, 150), gw: R.range(60, 110), kind: R.chance(0.5) ? 'wall' : 'hesco', seed: R.next() };
    };
    const linesIn = (y0, y1) => {
      const out = [];
      for (let m = Math.floor((y0 - 100) / 650); m <= Math.floor((y1 + 100) / 650); m++) { const l = lineAt(m); if (l && l.y > y0 - 120 && l.y < y1 + 120) out.push(l); }
      return out;
    };
    const tint = { ash: [0.42, 0.4, 0.38], mud: [0.34, 0.29, 0.24], snow: [0.8, 0.82, 0.86], sand: [0.66, 0.55, 0.42], dirt: [0.45, 0.38, 0.3] }[P.ground] || [0.4, 0.38, 0.35];
    const S = { P, seed, roadX, linesIn, dust: tint };
    S.layers = [{
      id: 'ground', z: 0, x0: -470, x1: 470, length: LEN, ppu: 1.3, glow: P.fires > 0,
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
  const lay = { craters: [], trenches: [], wire: [], bunkers: [], hedgehogs: [], tanks: [], ruins: [], stumps: [], pits: [], anchors: [], lines: S.linesIn(y0, y1), boulders: [], vehicles: [] };
  for (let i = 0; i < 6 + 18 * P.craters; i++) lay.craters.push({ x: R.range(-460, 460), y: R.range(y0, y1), r: R.range(5, 16) * (R.chance(0.1) ? 2 : 1), seed: R.next() });
  // Trench: one zig-zag across most chunks.
  if (R.chance(0.75)) {
    const pts = [], ty = R.range(y0 + 80, y1 - 80);
    for (let x = -470; x <= 470; x += R.range(30, 55)) pts.push(x, ty + R.range(-22, 22));
    lay.trenches.push(pts);
    const wpts = [];
    for (let k = 0; k < pts.length; k += 2) wpts.push(pts[k], pts[k + 1] + 26);
    lay.wire.push(wpts);
  }
  for (let i = 0; i < 2 * P.fort; i++) if (R.chance(0.6)) lay.bunkers.push({ x: R.sign() * R.range(120, 400), y: R.range(y0 + 40, y1 - 40), w: R.range(24, 40), d: R.range(20, 30), h: R.range(10, 16), rot: R.range(-0.3, 0.3) });
  if (R.chance(0.5 * P.fort + 0.2)) {
    const y = R.range(y0 + 60, y1 - 60), x0 = R.range(-400, 100);
    for (let k = 0; k < 7; k++) lay.hedgehogs.push({ x: x0 + k * 28 + R.range(-5, 5), y: y + R.range(-8, 8), rot: R.angle() });
  }
  for (let i = 0; i < 3 * P.armour; i++) if (R.chance(0.7)) {
    const x = R.range(-420, 420), y = R.range(y0 + 20, y1 - 20);
    lay.tanks.push({ x, y, rot: R.angle(), turret: R.range(-1.5, 1.5), burnt: R.chance(0.75) });
    if (R.chance(P.fires * 0.7)) lay.anchors.push({ type: 'fire', x, y, z: 8, s: R.range(1, 1.5) });
    else lay.anchors.push({ type: 'smoke', x, y, z: 8, s: 1, dark: 0.75 });
  }
  if (R.chance(0.3)) { const x = S.roadX((y0 + y1) / 2) + R.range(-20, 20); lay.vehicles.push({ kind: 'truck', x, y: R.range(y0, y1), rot: R.range(-0.4, 0.4), burnt: true }); }
  // Flank ruins: collapsed and burnt-out blocks rising at the screen edges.
  for (const s of [-1, 1]) {
    for (let y = y0 + 40; y < y1; y += R.range(90, 160)) {
      if (!R.chance(P.ruins)) continue;
      const b = planBuilding(R, s * R.range(255, 420), y, R.range(60, 110), R.range(50, 90), { hMin: 40, hMax: 170, burnt: 1, collapse: 0.7, styles: ['concrete', 'brick', 'office'] });
      lay.ruins.push(b);
      buildingAnchors(R, b, lay.anchors, { smoke: 0.5 });
    }
  }
  for (let i = 0; i < 18 * P.trees; i++) lay.stumps.push({ x: R.range(-460, 460), y: R.range(y0, y1), r: R.range(1.4, 2.6), seed: R.next() });
  if (R.chance(0.4)) lay.pits.push({ x: R.sign() * R.range(100, 380), y: R.range(y0 + 40, y1 - 40), seed: R.next() });
  // Muddy shell holes full of water, scattered wrecks.
  for (let i = 0; i < 3; i++) lay.craters.push({ x: R.range(-200, 200), y: R.range(y0, y1), r: R.range(14, 26), seed: R.next(), water: P.ground === 'mud' || R.chance(0.3) });
  for (let i = 0; i < 4 + 6 * P.fires; i++) {
    const x = R.range(-450, 450), y = R.range(y0, y1);
    lay.anchors.push(R.chance(P.fires) ? { type: 'fire', x, y, z: 1, s: R.range(0.6, 1.1) } : { type: 'smoke', x, y, z: 2, s: R.range(0.8, 1.6), dark: 0.6 });
  }
  for (const l of lay.lines) if (l.y >= y0 && l.y < y1) {
    lay.anchors.push({ type: 'smoke', x: l.gap, y: l.y, z: 4, s: 1.8, dark: 0.7 });
    if (R.chance(0.5)) lay.anchors.push({ type: 'searchlight', x: l.gap + 80, y: l.y + 10, z: 40, base: Math.PI / 2, sweep: 1.0, speed: 0.01 });
  }
  if (S.P.ground === 'snow' || S.P.ground === 'sand') for (let i = 0; i < 4; i++) lay.boulders.push({ x: R.range(-450, 450), y: R.range(y0, y1), r: R.range(8, 18), h: R.range(6, 16), seed: R.next() });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  (GROUND[P.ground] || ash)(p, {});
  if (P.ground !== 'snow') p.patch('fbm_50', 600, [0.12, 0.11, 0.1], 0.35); // scorched expanses
  else p.patch('fbm_50', 600, [0.35, 0.33, 0.32], 0.3); // dirty, churned snow
  // Shattered road.
  if (P.road) {
    p.ctx.beginPath();
    for (let y = y0 - 20; y <= y1 + 20; y += 16) p.ctx.lineTo(S.roadX(y) - 28, y);
    for (let y = y1 + 20; y >= y0 - 20; y -= 16) p.ctx.lineTo(S.roadX(y) + 28, y);
    p.ctx.closePath();
    const path = () => { p.ctx.beginPath(); for (let y = y0 - 20; y <= y1 + 20; y += 16) p.ctx.lineTo(S.roadX(y) - 28, y); for (let y = y1 + 20; y >= y0 - 20; y -= 16) p.ctx.lineTo(S.roadX(y) + 28, y); p.ctx.closePath(); };
    asphalt(p, { path, color: [0.22, 0.21, 0.2], wear: 1.5 });
    p.patch('fbm_60', 200, P.ground === 'snow' ? [0.82, 0.84, 0.88] : [0.3, 0.28, 0.26], 0.55, { path });
    p.layer(() => { const pts = []; for (let y = y0 - 20; y <= y1 + 20; y += 16) pts.push(S.roadX(y), y); p.line(pts, 1.1, [0.85, 0.85, 0.8], 1, { dash: [12, 16], dashOffset: -((y0 - 20) % 28) }); }, { wear: ['fine_50', 40, 1], alpha: 0.6 });
  }
  // Tracks of armour churned into the ground.
  const Rt = new RNG(`bft:${lay.seed}`);
  for (let i = 0; i < 4; i++) {
    const x = Rt.range(-400, 400), a = Rt.range(-0.5, 0.5);
    for (const g of [-6, 6]) p.line([x + g, y0 - 10, x + g + Math.sin(a) * 560, y1 + 10], 3, [0.1, 0.09, 0.08], 0.3);
  }
  for (const L of all) for (const t of L.trenches) trench(p, t, 15, { bag: P.ground === 'snow' ? [0.72, 0.72, 0.68] : [0.5, 0.44, 0.32] });
  p.props(() => new RNG(`bf:${lay.seed}`), (Rp) => {
    for (const L of all) for (const r of L.ruins) shadowBuilding(p, r);
    for (const L of all) for (const r of L.ruins) rubble(p, new RNG(`bfr:${r.x}:${r.y}`), r.x, r.y, Math.max(r.w, r.d) * 0.55, { rebar: true, scale: 1.3 });
    for (const L of all) for (const cr of L.craters) {
      const Rc = new RNG(`bfc:${cr.seed}`);
      scorch(p, Rc, cr.x, cr.y, cr.r * 2.1); crater(p, Rc, cr.x, cr.y, cr.r, { rim: S.dust });
      if (cr.water) p.circlePath(cr.x + 1, cr.y - 1, cr.r * 0.62).fill([0.06, 0.07, 0.07], 0.9), p.circlePath(cr.x - cr.r * 0.15, cr.y + cr.r * 0.15, cr.r * 0.25).fill([0.4, 0.42, 0.45], 0.25);
    }
    for (const L of all) for (const w of L.wire) barbedWire(p, w);
    for (const L of all) for (const b of L.bunkers) { p.shadowBox(b.x, b.y, b.w, b.d, b.h + 2.5, b.rot); sandbags(p, [b.x - b.w * 0.7, b.y - b.d * 0.8, b.x + b.w * 0.7, b.y - b.d * 0.8]); }
    for (const L of all) for (const h of L.hedgehogs) p.shadowBox(h.x, h.y, 10, 10, 7, h.rot);
    for (const L of all) for (const l of L.lines) {
      const Rl = new RNG(`bfl:${l.seed}`);
      for (let x = -470; x < 470; x += 22) if (Math.abs(x - l.gap) > l.gw / 2) p.shadowBox(x + 11, l.y, 20, l.kind === 'wall' ? 4 : 12, l.kind === 'wall' ? 34 : 14);
      rubble(p, Rl, l.gap, l.y, l.gw * 0.5, { rebar: true, scale: 1.4 });
    }
    for (const L of all) for (const t of L.tanks) tank(p, t.x, t.y, t.rot, { turret: t.turret, burnt: t.burnt, color: P.ground === 'snow' ? [0.75, 0.77, 0.78] : P.ground === 'sand' ? [0.62, 0.55, 0.4] : [0.3, 0.32, 0.24] });
    for (const L of all) for (const v of L.vehicles) truck(p, v.x, v.y, v.rot, { burnt: v.burnt, cargo: 'canvas' });
    for (const L of all) for (const s of L.stumps) stump(p, new RNG(`st:${s.seed}`), s.x, s.y, s.r);
    for (const L of all) for (const pit of L.pits) {
      const Rp2 = new RNG(`pit:${pit.seed}`), ring = [];
      for (let a = 0; a <= 6.3; a += 0.45) ring.push(pit.x + Math.cos(a) * 26, pit.y + Math.sin(a) * 22);
      sandbags(p, ring);
      p.at(pit.x, pit.y, Rp2.range(-0.6, 0.6) + Math.PI / 2, (cx) => { cx.fillStyle = 'rgb(48,52,40)'; cx.fillRect(-7, -9, 14, 18); cx.fillStyle = 'rgb(30,32,26)'; cx.fillRect(-1.4, 6, 2.8, 26); });
      for (let k = 0; k < 6; k++) drum(p, pit.x + Rp2.range(-14, 14), pit.y + Rp2.range(-12, 12), { color: [0.3, 0.32, 0.2] });
    }
    for (const L of all) for (const b of L.boulders) p.shadowCircle(b.x, b.y, b.r * 0.85, b.h, 0, 8);
    for (let i = 0; i < 5; i++) debris(p, Rp, Rp.range(-450, 450), Rp.range(y0, y1), Rp.range(15, 40), 30);
    if (Rp.chance(0.4)) car(p, Rp.range(-400, 400), Rp.range(y0, y1), Rp.angle(), { color: carColor(Rp), burnt: true });
  }, 0.6, 2.4);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 55 * a.s, [[0, [1, 0.42, 0.1], 0.6], [1, [1, 0.3, 0.05], 0]], 'lighter');
}

function mesh(mb, lay, S) {
  for (const r of lay.ruins) meshBuilding(mb, r);
  for (const b of lay.bunkers) meshBunker(mb, b.x, b.y, b.w, b.d, b.h, b.rot);
  for (const h of lay.hedgehogs) meshHedgehog(mb, h.x, h.y, 1, h.rot);
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, S.P.ground === 'snow' ? 'rock' : 'rock_sand');
  for (const l of lay.lines) {
    for (let x = -470; x < 470; x += 22) {
      if (Math.abs(x + 11 - l.gap) < l.gw / 2) continue;
      if (l.kind === 'wall') mb.box(x + 11, l.y, 0, 20, 4, 34, 0, { top: 'concrete', side: 'concrete_dark' });
      else mb.box(x + 11, l.y, 0, 20, 12, 14, 0, { top: 'hesco', side: 'hesco' });
    }
    if (l.kind === 'wall') for (const s of [-1, 1]) {
      // Watch towers flanking the breach.
      const x = l.gap + s * (l.gw / 2 + 24);
      mb.box(x, l.y - 6, 0, 16, 16, 52, 0, { top: 'roof_metal', side: 'concrete_dark' });
    }
  }
}

export { shade };
