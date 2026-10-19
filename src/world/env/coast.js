import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { tree, pine, crater, scorch, rubble, sandbags, debris, drum } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding } from '../kit/city.js';
import { meshBoulder, shadowBoulder } from '../kit/terrain.js';
import { meshShip, shipSize } from '../kit/ships.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// COASTLINE: open water on one side of the flight path, land on the other —
// surf breaking on a beach (or against cliffs), shallows and reef, then
// dunes and jungle / pine forest inland. Optional coastal defences (pill-
// boxes, gun emplacements, trenches), a fishing village, jetties with boats,
// a lighthouse sweeping its beam, landing-craft wrecks, ships offshore.
//
//   sea      water surface at z = 0 (tropical or temperate colours)
//   shallows blend layer at z = 0.4: turquoise shallows, reef heads, surf
//   land     heightfield layer (cut: alpha over the water side)
//
// Params: side (1 = land on the right), shore (waterline distance from the
//         centre line), tropical (bool), cliffs 0..1, jungle 0..1,
//         bunkers 0..1, village 0..1, jetties 0..1, lighthouse 0..1,
//         fires 0..1, craters 0..1, reef 0..1, ships 0..1 (offshore),
//         wrecks 0..1 (beached landing craft), night (bool), storm 0..1

const LEN = 512;
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

export default {
  id: 'coast',
  label: 'Coastline',
  defaults: { side: 1, shore: 120, tropical: true, cliffs: 0, jungle: 0.7, bunkers: 0.4, village: 0.3, jetties: 0.4, lighthouse: 0.25, fires: 0.2, craters: 0.2, reef: 0.6, ships: 0.4, wrecks: 0.2, night: false, storm: 0.15 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const ph = new RNG(`${seed}:coast`).range(0, 50);
    const side = P.side >= 0 ? 1 : -1;
    const S = { P, seed, side, dust: P.tropical ? [0.86, 0.8, 0.66] : [0.7, 0.66, 0.58] };
    // Waterline (|x| from the centre line, on the land side) meanders into bays and headlands.
    S.shoreAt = (y) => P.shore + 46 * Math.sin(y / 560 + ph) + 24 * Math.sin(y / 190 + ph * 2) + 60 * Math.max(0, Math.sin(y / 1500 + ph)) ** 3;
    // Inland distance from the waterline (negative over the water).
    S.inland = (x, y) => side * x - S.shoreAt(y);
    const beach = P.cliffs > 0.5 ? 8 : 46;
    S.beach = beach;
    S.height = (x, y) => {
      const d = S.inland(x, y);
      if (d <= 0) return 0.2;
      const bump = sampleField('fbm', x, y, 700) - 0.5;
      const cliff = P.cliffs * sm(0, 26, d) * (70 + bump * 50);
      const dunes = sm(beach * 0.6, beach + 30, d) * (6 + bump * 22 + (sampleField('ridged', x, y, 1300) - 0.5) * 30);
      return 0.2 + Math.min(d, beach) / beach * 3 + cliff + dunes;
    };
    const st = P.storm;
    S.atmosphere = {
      surfaces: [{
        type: 'water', z: 0,
        deep: P.tropical ? [0.02, 0.14, 0.2] : [0.02, 0.07, 0.1],
        shallow: P.tropical ? [0.07, 0.34, 0.38] : [0.05, 0.16, 0.18],
        sky: P.night ? [0.08, 0.1, 0.14] : [0.5 - st * 0.2, 0.6 - st * 0.25, 0.7 - st * 0.25],
        wave: [0.5 + st, 1.1 - st * 0.3, 0.7 + st * 0.5, 0.4 + st],
        foam: [0.12 + st * 0.5, 0.85 - st * 0.3, 0.25 + st * 0.6, 0],
        wind: [0.8, 0.3 + st],
      }],
      glowTint: [1.1, 1, 0.9],
    };
    S.layers = [
      {
        id: 'shallows', z: 0.4, x0: -560, x1: 560, length: LEN, ppu: 0.7, blend: true,
        layout: (c) => ({ seed: c.R.next() }),
        paint: (p, lay, nb, c) => paintShallows(p, lay, c, S),
      },
      {
        id: 'land', z: 0, x0: -580, x1: 580, length: LEN, ppu: 1.0, cut: true, glow: true, grid: [40, 20], height: S.height, flatLight: true,
        layout: (c) => layout(c, S),
        paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
        mesh: (mb, lay) => mesh(mb, lay, S),
        moverMesh: (mb, m) => { meshShip(mb, m.type, m.x, m.y, m.rot, {}); return []; },
      },
    ];
    S.surfacesTopDown = [{ z: 6, contains: (x, y) => S.inland(x, y) > 0 }, { z: 0, water: true }];
    S.floorZ = 0;
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, side = S.side;
  const Z = (x, y) => S.height(x, y);
  const atInland = (d, y) => side * (S.shoreAt(y) + d);
  const lay = { trees: [], palms: [], bunkers: [], guns: [], huts: [], jetties: [], boats: [], light: null, wrecks: [], craters: [], boulders: [], posts: [], movers: [], anchors: [] };
  // Vegetation behind the beach.
  for (let i = 0; i < 70 * P.jungle; i++) {
    const y = R.range(y0, y1), d = R.range(S.beach + 10, 520), x = atInland(d, y);
    if (Math.abs(x) > 575) continue;
    if (P.tropical && d < S.beach + 70 && R.chance(0.6)) lay.palms.push({ x, y, r: R.range(9, 14), seed: R.next() });
    else lay.trees.push({ x, y, r: R.range(8, 15), seed: R.next() });
  }
  for (let i = 0; i < 10 * P.jungle; i++) { const y = R.range(y0, y1), d = R.range(4, S.beach - 4), x = atInland(d, y); if (P.tropical) lay.palms.push({ x, y, r: R.range(8, 12), seed: R.next() }); }
  // Coastal defences: pillboxes on the dune line, gun emplacements behind.
  for (let i = 0; i < 3 * P.bunkers; i++) if (R.chance(0.7)) {
    const y = R.range(y0 + 40, y1 - 40), d = S.beach + R.range(8, 40), x = atInland(d, y);
    lay.bunkers.push({ x, y, z: Z(x, y), w: R.range(22, 30), d: R.range(18, 24), rot: side > 0 ? 0 : Math.PI });
    lay.posts.push({ x: x - side * 26, y });
  }
  for (let i = 0; i < 2 * P.bunkers; i++) if (R.chance(0.6)) {
    const y = R.range(y0 + 50, y1 - 50), d = S.beach + R.range(70, 140), x = atInland(d, y);
    lay.guns.push({ x, y, z: Z(x, y), rot: side > 0 ? Math.PI : 0 });
  }
  // Fishing village: huts clustered behind the beach.
  if (R.chance(P.village)) {
    const yc = R.range(y0 + 100, y1 - 100), dc = S.beach + R.range(30, 90);
    for (let k = 0; k < R.int(5, 9); k++) {
      const y = yc + R.range(-90, 90), x = atInland(dc + R.range(-10, 80), y);
      const b = planBuilding(R, x, y, R.range(16, 26), R.range(14, 22), { hMin: 7, hMax: 11, style: R.pick(['brick', 'concrete']), roof: R.pick(['metal', 'tar']), burnt: P.fires * 0.5, rot: R.range(-0.3, 0.3) });
      b.z0 = Z(x, y); b.items = [];
      lay.huts.push(b);
      if (b.burnt && R.chance(0.6)) lay.anchors.push({ type: 'fire', x, y, z: b.z0 + b.h, s: R.range(0.8, 1.2) });
    }
  }
  // Jetties reaching out from the beach with boats alongside.
  for (let i = 0; i < 2 * P.jetties; i++) if (R.chance(0.6)) {
    const y = R.range(y0 + 40, y1 - 40), len = R.range(60, 110), xs = side * (S.shoreAt(y) + 10);
    lay.jetties.push({ x: xs - side * len / 2, y, len });
    if (R.chance(0.8)) { const t = R.pick(['trawler', 'patrol', 'tug']), sz = shipSize(t); lay.boats.push({ type: t, x: xs - side * (len * R.range(0.5, 0.9)), y: y + R.sign() * (sz.b / 2 + 6), rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 }); }
  }
  if (R.chance(P.lighthouse)) {
    const y = R.range(y0 + 80, y1 - 80), x = atInland(Math.max(6, S.beach * 0.5), y);
    lay.light = { x, y, z: Z(x, y) };
    lay.anchors.push({ type: 'searchlight', x, y, z: Z(x, y) + 58, base: 0, sweep: 6.3, speed: 0.012, c: [1, 0.95, 0.8] });
    lay.anchors.push({ type: 'glow', x, y, z: Z(x, y) + 58, r: 22, c: [1, 0.95, 0.75], a: 0.7 });
  }
  // Beached landing craft.
  for (let i = 0; i < 2 * P.wrecks; i++) if (R.chance(0.6)) {
    const y = R.range(y0 + 40, y1 - 40), x = side * (S.shoreAt(y) - R.range(4, 20));
    lay.wrecks.push({ type: 'patrol', x, y, rot: (side > 0 ? -Math.PI / 2 : Math.PI / 2) + R.range(-0.4, 0.4) });
    if (R.chance(0.6)) lay.anchors.push({ type: 'smoke', x, y, z: 6, s: R.range(1, 1.5), dark: 0.8 });
  }
  for (let i = 0; i < 8 * P.craters; i++) { const y = R.range(y0, y1), x = atInland(R.range(-10, 300), y); if (S.inland(x, y) > 2) lay.craters.push({ x, y, r: R.range(6, 14), seed: R.next() }); }
  for (let i = 0; i < 3 * P.fires; i++) { const y = R.range(y0, y1), x = atInland(R.range(S.beach, 400), y); lay.anchors.push({ type: 'fire', x, y, z: Z(x, y) + 2, s: R.range(0.9, 1.5) }); if (R.chance(0.6)) lay.anchors.push({ type: 'smoke', x, y, z: Z(x, y) + 24, s: R.range(1.4, 2), dark: 0.85 }); }
  // Rocks at the foot of cliffs / on headlands.
  for (let i = 0; i < 6 + 10 * P.cliffs; i++) { const y = R.range(y0, y1), x = side * (S.shoreAt(y) + R.range(-30, 8)); lay.boulders.push({ x, y, z: -3, r: R.range(6, 16), h: R.range(5, 14), seed: R.next() }); }
  // Ships offshore.
  if (R.chance(P.ships)) {
    const type = R.pick(['destroyer', 'frigate', 'freighter', 'patrol']), sz = shipSize(type);
    const x = -side * R.range(150, 320), y = R.range(y0 + 60, y1 - 60), ahead = R.chance(0.6);
    lay.movers.push({ kind: 'ship', type, x, y, rot: ahead ? 0 : Math.PI, vx: 0, vy: ahead ? R.range(0.2, 0.45) : -R.range(0.3, 0.5), l: sz.l, b: sz.b });
  }
  if (P.night) for (let y = Math.ceil(y0 / 90) * 90; y < y1; y += 90) if (R.chance(0.4)) { const x = atInland(S.beach + 20, y); lay.anchors.push({ type: 'lamp', x, y, z: Z(x, y) + 14, c: [1, 0.8, 0.5], len: 4 }); }
  lay.seed = R.next();
  return lay;
}

function landColour(S, h, slope, x, y) {
  const P = S.P, d = S.inland(x, y), n = sampleField('fine', x, y, 300);
  const wet = P.tropical ? [0.62, 0.55, 0.42] : [0.44, 0.4, 0.34];
  const dry = P.tropical ? mix([0.9, 0.84, 0.68], [0.82, 0.74, 0.58], n) : mix([0.72, 0.66, 0.54], [0.62, 0.58, 0.48], n);
  let c = mix(wet, dry, sm(0, 10, d));
  const veg = P.tropical ? mix([0.16, 0.3, 0.12], [0.24, 0.36, 0.16], sampleField('fbm', x, y, 260)) : mix([0.22, 0.3, 0.16], [0.36, 0.38, 0.22], sampleField('fbm', x, y, 260));
  c = mix(c, veg, sm(S.beach - 6, S.beach + 26, d) * (0.55 + 0.45 * P.jungle));
  const rock = mix([0.42, 0.4, 0.36], [0.3, 0.29, 0.27], n);
  return mix(c, rock, Math.min(1, Math.max(0, slope * 2.4 - 0.4)));
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P, side = S.side;
  const all = [lay, ...nb.filter(Boolean)];
  paintHeightfield(p, S.height, (h, slope, x, y) => landColour(S, h, slope, x, y), { eps: 5, step: 2, shadows: P.cliffs > 0.3 ? { range: 200, steps: 8 } : null });
  p.noise('grain', 128 / p.ppu, 'overlay', 0.35);
  p.noise('fbm', 260, 'soft-light', 0.3);
  // Wrack line and footpaths on the beach.
  const line = (off, w, col, a) => { const pts = []; for (let y = y0 - 20; y <= y1 + 20; y += 12) pts.push(side * (S.shoreAt(y) + off), y); p.line(pts, w, col, a); };
  line(7, 2, [0.4, 0.34, 0.24], 0.4);
  line(S.beach * 0.7, 3, [0.78, 0.72, 0.6], 0.3);
  for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`ccr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2); crater(p, Rc, cr.x, cr.y, cr.r, { rim: S.dust }); }
  p.props(() => new RNG(`cst:${lay.seed}`), (Rp) => {
    for (const L of all) for (const b of L.huts) shadowBuilding(p, b);
    for (const L of all) for (const b of L.bunkers) p.shadowBox(b.x, b.y, b.w, b.d, 10, b.rot);
    for (const L of all) for (const g of L.guns) p.shadowCircle(g.x, g.y, 14, 6, 0, 6);
    for (const L of all) if (L.light) p.shadowCircle(L.light.x, L.light.y, 6, 60, 0, 6);
    for (const L of all) for (const b of L.boulders) shadowBoulder(p, b.x, b.y, b.r, b.h);
    for (const L of all) for (const ps of L.posts) { const ring = []; for (let a = 0; a <= 6.3; a += 0.5) ring.push(ps.x + Math.cos(a) * 14, ps.y + Math.sin(a) * 12); sandbags(p, ring, { color: P.tropical ? [0.72, 0.66, 0.5] : undefined }); }
    for (const L of all) for (const t of L.trees) (P.tropical ? tree : pine)(p, new RNG(`ct:${t.seed}`), t.x, t.y, t.r, {});
    for (const L of all) for (const pm of L.palms) {
      const Rp2 = new RNG(`palm:${pm.seed}`);
      p.shadowCircle(pm.x, pm.y, pm.r * 0.6, pm.r * 3, pm.r * 2, 8);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + Rp2.range(0, 0.4); p.line([pm.x, pm.y, pm.x + Math.cos(a) * pm.r, pm.y + Math.sin(a) * pm.r], 3, [0.2, 0.34, 0.12], 0.95, { cap: 'round' }); }
      p.circlePath(pm.x, pm.y, 1.6).fill([0.3, 0.24, 0.14]);
    }
    for (const L of all) for (const b of L.huts) if (b.burnt) rubble(p, new RNG(`chr:${b.x}`), b.x, b.y, 14, { color: [0.3, 0.27, 0.24] });
    for (let i = 0; i < 3; i++) { const y = Rp.range(y0, y1); drum(p, side * (S.shoreAt(y) + Rp.range(4, 30)), y, { color: [0.5, 0.2, 0.12] }); }
    if (P.wrecks > 0.3) for (let i = 0; i < 3; i++) { const y = Rp.range(y0, y1); debris(p, Rp, side * (S.shoreAt(y) + Rp.range(0, 30)), y, Rp.range(16, 30), 20, { color: [0.4, 0.36, 0.3] }); }
  }, 0.5, 2.4);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) {
    if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 50 * a.s, [[0, [1, 0.42, 0.1], 0.45], [1, [1, 0.3, 0.05], 0]], 'lighter');
    if (a.type === 'lamp') p.env.glow.radial(a.x, a.y, 30, [[0, [1, 0.8, 0.5], 0.45], [1, [1, 0.7, 0.4], 0]], 'lighter');
  }
  // Cut out the sea (jetties are drawn back over it).
  p.ctx.beginPath();
  for (let y = y0 - 20; y <= y1 + 20; y += 12) p.ctx.lineTo(side * S.shoreAt(y), y);
  p.ctx.lineTo(-side * 2000, y1 + 20); p.ctx.lineTo(-side * 2000, y0 - 20);
  p.ctx.closePath();
  p.fill([0, 0, 0], 1, 'destination-out');
  for (const L of all) for (const j of L.jetties) {
    p.rectPath(j.x - j.len / 2, j.y - 5, j.len, 10).fill([0.42, 0.32, 0.22]);
    for (let x = j.x - j.len / 2; x < j.x + j.len / 2; x += 3) p.line([x, j.y - 5, x, j.y + 5], 0.4, [0.2, 0.15, 0.1], 0.6);
  }
}

function paintShallows(p, lay, c, S) {
  const { y0, y1 } = c, P = S.P, side = S.side;
  p.ctx.clearRect(-1e5, -1e5, 2e5, 2e5);
  const W = p.canvas.width, H = p.canvas.height, img = p.ctx.createImageData(W, H), d = img.data, { x0, x1 } = p.rect;
  const deepCol = P.tropical ? [40, 200, 200] : [60, 120, 120];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    const x = x0 + (i / W) * (x1 - x0), y = y1 - (j / H) * (y1 - y0);
    const dd = -S.inland(x, y);                                                  // distance out to sea
    if (dd < -2) continue;
    const n = sampleField('fbm', x, y, 240);
    // Turquoise shallows fading out to the drop-off; reef heads as darker patches.
    let a = Math.max(0, 1 - dd / (90 + n * 70)) * (P.tropical ? 0.75 : 0.4);
    let r = deepCol[0], g = deepCol[1], b = deepCol[2];
    const reef = P.reef * sm(0.55, 0.7, sampleField('ridged', x, y, 160)) * sm(10, 30, dd) * (1 - sm(80, 160, dd));
    if (reef > 0.05) { r = r * (1 - reef) + 110 * reef; g = g * (1 - reef) + 90 * reef; b = b * (1 - reef) + 70 * reef; a = Math.max(a, reef * 0.7); }
    // Surf: bands of foam just off the waterline.
    const surf = Math.max(0, 1 - Math.abs(dd - 6 - n * 10) / 5) * 0.8 + Math.max(0, 1 - Math.abs(dd - 24 - n * 18) / 4) * 0.35 * (0.5 + P.storm);
    if (surf > 0.02) { r = r * (1 - surf) + 245 * surf; g = g * (1 - surf) + 250 * surf; b = b * (1 - surf) + 250 * surf; a = Math.max(a, surf * 0.9); }
    for (let jj = 0; jj < 2; jj++) for (let ii = 0; ii < 2; ii++) { const o4 = ((j + jj) * W + i + ii) * 4; d[o4] = r; d[o4 + 1] = g; d[o4 + 2] = b; d[o4 + 3] = Math.min(255, a * 255); }
  }
  p.ctx.putImageData(img, 0, 0);
  void lay;
}

function mesh(mb, lay, S) {
  const P = S.P;
  for (const b of lay.huts) meshBuilding(mb, b, b.z0);
  for (const b of lay.bunkers) {
    mb.box(b.x, b.y, b.z - 3, b.w, b.d, 10, b.rot, { top: 'concrete_dark', side: 'concrete_dark' });
    mb.box(b.x, b.y, b.z + 7, b.w * 0.8, b.d * 0.8, 2, b.rot, { top: P.tropical ? 'rock_sand' : 'dirt', side: 'concrete_dark' });
  }
  for (const g of lay.guns) {
    mb.lathe(g.x, g.y, [[14, g.z - 1], [14, g.z + 3], [11, g.z + 4]], 'concrete', { seg: 14, top: false });
    mb.box(g.x, g.y, g.z, 9, 12, 5, g.rot, { top: 'steel_painted', side: 'steel_painted' });
    const c = Math.cos(g.rot), s = Math.sin(g.rot);
    mb.beam([g.x, g.y, g.z + 4], [g.x + c * 30, g.y + s * 30, g.z + 6], 2.4, 2.4, 'metal_dark');
  }
  if (lay.light) {
    const L = lay.light;
    mb.lathe(L.x, L.y, [[7, L.z], [5, L.z + 50], [6, L.z + 51], [6, L.z + 56], [3, L.z + 60], [0, L.z + 61]], 'concrete', { seg: 12, top: 'roof_metal' });
    mb.box(L.x + 8, L.y, L.z, 12, 10, 7, 0, { top: 'roof_tar', side: 'facade_brick' });
  }
  for (const j of lay.jetties) {
    mb.box(j.x, j.y, 1.2, j.len, 10, 1.4, 0, { top: 'timber', side: 'timber' });
    for (let x = j.x - j.len / 2 + 4; x < j.x + j.len / 2; x += 14) for (const o of [-4, 4]) mb.box(x, j.y + o, -2, 1.6, 1.6, 4, 0, { top: 'timber', side: 'timber' });
  }
  for (const bt of lay.boats) meshShip(mb, bt.type, bt.x, bt.y, bt.rot, {});
  for (const w of lay.wrecks) meshShip(mb, w.type, w.x, w.y, w.rot, { burnt: true, lowered: true });
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, P.tropical ? 'rock_dark' : 'rock', b.z);
}
