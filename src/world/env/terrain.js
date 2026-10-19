import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { asphalt, snow as snowSurf, sand as sandSurf, gravel } from '../paint/surfaces.js';
import { truck, tank, car, pine, tree, crater, scorch, rubble, debris, drum, crate, carColor, sandbags } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding } from '../kit/city.js';
import { meshBoulder, shadowBoulder, meshHedgehog, railway } from '../kit/terrain.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// NATURAL TERRAIN: the open-country kit. One heightfield (real relief, baked
// hillshade) with a surface type and a relief type, plus optional features.
//
// surface  snow | sand | rock | grass | ice | salt | dirt
// relief   flat | dunes | hills | canyon | glacier | crater | quarry
// features (params, 0..1 unless noted)
//   road (bool), convoy (moving vehicles on the road), wrecks, forest,
//   facility (compound: buildings, radar dome, masts, fences, tanks),
//   ruins (half-buried buildings), oasis, solar (mirror field + tower),
//   crevasses, avalanche, rigs (drilling derricks + pumpjacks), craters,
//   boulders, military (sandbag posts, hedgehogs), groundZ,
//   rails (number of parallel tracks: freight yard with wagons, derailments
//   and a moving train), pipeline (raised pipe run on supports), fires
//   (burning ground fires: oil spills, wreckage), airbase (runway, taxiway,
//   apron with hangars, control tower, fuel farm, parked aircraft, runway lights)

const LEN = 512;
const H = (x, y, s) => sampleField('fbm', x, y, s);

export default {
  id: 'terrain',
  label: 'Open terrain',
  defaults: { surface: 'snow', relief: 'hills', road: true, convoy: 0.4, wrecks: 0.3, forest: 0, facility: 0, ruins: 0, oasis: 0, solar: 0, crevasses: 0, avalanche: 0, rigs: 0, craters: 0.2, boulders: 0.3, military: 0, groundZ: 0, canyonW: 140, rails: 0, pipeline: 0, fires: 0, airbase: 0 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const roadX = (y) => (P.relief === 'canyon' || P.relief === 'quarry' ? 0.6 : 1) * (60 * Math.sin(y / 700) + 25 * Math.sin(y / 260));
    const pathX = (y) => roadX(y) * 0.8;
    const height = makeHeight(P, pathX);
    const S = { P, seed, roadX, pathX, height, gz: P.groundZ };
    // Airbase: runway centreline on the far side of the road, apron beyond it.
    S.runX = P.road ? -250 : 40; S.apronX = S.runX - 150;
    S.railX = (k) => (k - (P.rails - 1) / 2) * 34 + (P.road ? 150 : 0);
    S.dust = { snow: [0.88, 0.9, 0.95], sand: [0.78, 0.64, 0.46], rock: [0.5, 0.46, 0.42], grass: [0.45, 0.42, 0.32], ice: [0.85, 0.9, 0.95], salt: [0.92, 0.9, 0.86], dirt: [0.5, 0.42, 0.34] }[P.surface] || [0.6, 0.55, 0.5];
    S.atmosphere = {};
    S.layers = [{
      id: 'land', z: P.groundZ, x0: -580, x1: 580, length: LEN, ppu: 1.05, grid: P.relief === 'flat' ? [8, 4] : [44, 22], height, flatLight: true, glow: P.solar > 0 || P.facility > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
      moverMesh: (mb, m) => { mb.box(m.x, m.y, S.gz + S.height(m.x, m.y) + 0.5, m.w, m.l, m.h, m.rot, { top: m.mat, side: m.side || 'metal_dark' }); return []; },
    }];
    S.surfacesTopDown = [{ z: P.groundZ }];
    S.floorZ = P.groundZ;
    return S;
  },
};

function makeHeight(P, pathX) {
  const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  switch (P.relief) {
    case 'flat': return (x, y) => (H(x, y, 1800) - 0.5) * 14;
    case 'dunes': return (x, y) => {
      const crest = Math.abs(Math.sin((x * 0.6 + y) / 210 + H(x, y, 1400) * 5));
      return (1 - crest) * 34 + (H(x, y, 2600) - 0.5) * 60 - flatRoad(P, pathX, x, y) * 20;
    };
    case 'hills': return (x, y) => (H(x, y, 1100) - 0.5) * 150 + (sampleField('ridged', x, y, 2200) - 0.5) * 120 + (sampleField('large', x, y, 5000) - 0.5) * 90 - flatRoad(P, pathX, x, y) * 50;
    case 'canyon': return (x, y) => {
      const d = Math.abs(x - pathX(y)), w = P.canyonW;
      const wall = sm(w, w + 110, d);
      const terr = Math.floor(wall * 5) / 5 * 0.35 + wall * 0.65;                     // stepped strata
      return terr * 240 + (sampleField('ridged', x, y, 1300) - 0.5) * 60 * wall + (H(x, y, 900) - 0.5) * 16;
    };
    case 'glacier': return (x, y) => (H(x, y, 1500) - 0.5) * 40 + sm(260, 420, Math.abs(x)) * 160 + (sampleField('ridged', x, y, 1200) - 0.5) * 30 * sm(260, 420, Math.abs(x));
    case 'crater': return (x, y) => {
      const cy = Math.round(y / 1400) * 1400 + 400, d = Math.hypot(x * 0.9, y - cy) / 520;
      const bowl = d < 1 ? -(1 - d * d) * 120 + d * d * 30 : Math.max(0, (1.5 - d) / 0.5) * 30;
      return bowl + (H(x, y, 1500) - 0.5) * 30;
    };
    case 'quarry': return (x, y) => {
      const d = Math.abs(x - pathX(y));
      const depth = sm(330, 120, d);                                                   // 1 at the pit floor
      return -Math.round(depth * 5) / 5 * 170 + (H(x, y, 900) - 0.5) * 10;           // benches
    };
    default: return () => 0;
  }
}

function flatRoad(P, pathX, x, y) { if (!P.road) return 0; const d = Math.abs(x - pathX(y) / 0.8); return d < 60 ? 1 - d / 60 : 0; }

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, gz = S.gz;
  const Z = (x, y) => gz + S.height(x, y);
  const lay = { trees: [], wrecks: [], buildings: [], domes: [], masts: [], tanks: [], ruins: [], palms: [], pond: null, mirrors: [], tower: null, crevasses: [], blocks: [], rigs: [], jacks: [], craters: [], boulders: [], posts: [], hedgehogs: [], movers: [], anchors: [] };
  const onRoad = (x, y) => P.road && Math.abs(x - S.roadX(y)) < 50;
  // Convoy on the road (movers: trucks / armour driving along it).
  if (P.road && R.chance(P.convoy)) {
    const dir = R.chance(0.6) ? 1 : -1, n = R.int(2, 5), yA = R.range(y0, y1);
    for (let k = 0; k < n; k++) {
      const y = yA - dir * k * 46, x = S.roadX(y) + dir * 9;
      const kind = R.chance(0.3) ? 'tank' : 'truck';
      lay.movers.push({ kind: 'vehicle', x, y, rot: dir > 0 ? 0 : Math.PI, vx: 0, vy: dir * 0.35, w: kind === 'tank' ? 20 : 14, l: kind === 'tank' ? 40 : 44, h: kind === 'tank' ? 12 : 16, mat: kind === 'tank' ? (P.surface === 'snow' ? 'hull_grey' : 'deck_rust') : 'tarp_canvas', side: 'metal_dark' });
    }
  }
  for (let i = 0; i < 4 * P.wrecks; i++) { const x = R.range(-500, 500), y = R.range(y0, y1); lay.wrecks.push({ x, y, rot: R.angle(), kind: R.pick(['tank', 'truck', 'car']), burnt: R.chance(0.7) }); if (R.chance(0.5)) lay.anchors.push({ type: R.chance(0.4) ? 'fire' : 'smoke', x, y, z: Z(x, y) + 6, s: R.range(0.8, 1.3), dark: 0.7 }); }
  for (let i = 0; i < 60 * P.forest; i++) { const x = R.range(-570, 570), y = R.range(y0, y1); if (!onRoad(x, y) && S.height(x, y) < 140) lay.trees.push({ x, y, r: R.range(6, 12), seed: R.next() }); }
  if (R.chance(P.facility)) {
    const s = R.sign(), cx = s * R.range(130, 250), cy = R.range(y0 + 110, y1 - 110);
    for (let k = 0; k < R.int(3, 5); k++) {
      const b = planBuilding(R, cx + R.range(-90, 90), cy + R.range(-110, 110), R.range(40, 80), R.range(40, 90), { hMin: 14, hMax: 40, styles: ['industrial', 'concrete'] });
      b.z0 = Z(b.x, b.y); b.snow = P.surface === 'snow';
      lay.buildings.push(b);
    }
    lay.domes.push({ x: cx + s * 70, y: cy - 60, z: Z(cx + s * 70, cy - 60), r: R.range(20, 30) });
    for (let k = 0; k < 2; k++) { const x = cx + R.range(-100, 100), y = cy + R.range(-120, 120); lay.masts.push({ x, y, z: Z(x, y), h: R.range(80, 140) }); lay.anchors.push({ type: 'beacon', x, y, z: Z(x, y) + 140, c: [1, 0.15, 0.1], period: 70 }); }
    for (let k = 0; k < 3; k++) { const x = cx + R.range(-90, 90), y = cy + R.range(-120, 120); lay.tanks.push({ x, y, z: Z(x, y), r: R.range(10, 16) }); }
    lay.fence = { x: cx, y: cy, w: 260, d: 300 };
    lay.anchors.push({ type: 'searchlight', x: cx, y: cy + 140, z: Z(cx, cy) + 30, base: -Math.PI / 2, sweep: 1, speed: 0.01 });
  }
  if (R.chance(P.ruins)) for (let k = 0; k < R.int(2, 4); k++) {
    const x = R.sign() * R.range(90, 420), y = R.range(y0 + 50, y1 - 50);
    const b = planBuilding(R, x, y, R.range(50, 110), R.range(50, 110), { hMin: 20, hMax: 70, collapse: 0.6, styles: ['concrete', 'brick'] });
    b.z0 = Z(x, y) - 18; b.sandstone = true;
    lay.ruins.push(b);
  }
  if (R.chance(P.oasis)) {
    const x = R.sign() * R.range(120, 300), y = R.range(y0 + 120, y1 - 120);
    lay.pond = { x, y, r: R.range(60, 100) };
    for (let k = 0; k < 18; k++) { const a = R.angle(), d = lay.pond.r * R.range(1.05, 1.6); lay.palms.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, r: R.range(9, 14), seed: R.next() }); }
  }
  if (R.chance(P.solar)) {
    const cx = R.sign() * R.range(180, 330), cy = R.range(y0 + 150, y1 - 150);
    for (let i = -4; i <= 4; i++) for (let j = -5; j <= 5; j++) { const x = cx + i * 22 + (j % 2) * 11, y = cy + j * 24; if (Math.hypot(i, j) > 1.5) lay.mirrors.push({ x, y, z: Z(x, y), rot: Math.atan2(cy - y, cx - x) }); }
    lay.tower = { x: cx, y: cy, z: Z(cx, cy), h: 180 };
    lay.anchors.push({ type: 'glow', x: cx, y: cy, z: Z(cx, cy) + 180, r: 40, c: [1, 0.9, 0.6], a: 0.6 });
  }
  for (let i = 0; i < 3 * P.crevasses; i++) lay.crevasses.push({ x: R.range(-520, 520), y: R.range(y0, y1), a: R.range(-0.4, 0.4), l: R.range(120, 320), w: R.range(8, 22), seed: R.next() });
  for (let i = 0; i < 40 * P.avalanche; i++) { const x = R.range(-560, 560), y = R.range(y0, y1); lay.blocks.push({ x, y, s: R.range(4, 14), seed: R.next() }); }
  if (P.avalanche > 0) for (let i = 0; i < 3; i++) lay.anchors.push({ type: 'dust', x: R.range(-400, 400), y: R.range(y0, y1), z: gz + 20, s: 2 });
  for (let i = 0; i < 2 * P.rigs; i++) if (R.chance(0.7)) { const x = R.sign() * R.range(120, 420), y = R.range(y0 + 60, y1 - 60); lay.rigs.push({ x, y, z: Z(x, y), h: R.range(90, 140) }); lay.anchors.push({ type: 'beacon', x, y, z: Z(x, y) + 140, c: [1, 0.2, 0.1], period: 60 }); if (R.chance(0.4)) lay.anchors.push({ type: 'fire', x: x + 40, y, z: Z(x, y) + 40, s: 1.2 }); }
  for (let i = 0; i < 5 * P.rigs; i++) { const x = R.range(-520, 520), y = R.range(y0, y1); lay.jacks.push({ x, y, z: Z(x, y), rot: R.angle() }); }
  for (let i = 0; i < 10 * P.craters; i++) lay.craters.push({ x: R.range(-560, 560), y: R.range(y0, y1), r: R.range(6, 16), seed: R.next() });
  for (let i = 0; i < 10 * P.boulders; i++) { const x = R.range(-560, 560), y = R.range(y0, y1); if (!onRoad(x, y)) lay.boulders.push({ x, y, z: Z(x, y) - 2, r: R.range(8, 26), h: R.range(6, 22), seed: R.next() }); }
  for (let i = 0; i < 3 * P.military; i++) { const x = R.range(-460, 460), y = R.range(y0, y1); lay.posts.push({ x, y }); }
  if (R.chance(P.military)) { const y = R.range(y0 + 50, y1 - 50), x0 = R.range(-400, 100); for (let k = 0; k < 6; k++) { const x = x0 + k * 26; lay.hedgehogs.push({ x, y, z: Z(x, y), rot: R.angle() }); } }
  // Freight yard: parked wagons on the sidings, a few derailed and burning,
  // and a moving freight train on one of the through tracks.
  lay.wagons = []; lay.fires = []; lay.pipes = []; lay.ys = [y0, y1];
  if (P.rails > 0) {
    for (let k = 0; k < P.rails; k++) {
      const x = S.railX(k);
      for (let y = y0 + 40; y < y1 - 40; y += R.range(74, 110)) {
        if (!R.chance(0.55)) continue;
        const derail = R.chance(0.12);
        lay.wagons.push({ x: x + (derail ? R.range(-10, 10) : 0), y, z: Z(x, y), rot: derail ? R.range(-0.5, 0.5) : 0, kind: R.pick(['box', 'box', 'tank', 'flat', 'hopper']), col: R.pick(['container_red', 'container_blue', 'container_green', 'container_orange', 'container_grey', 'container_teal']), derail });
        if (derail && R.chance(0.6)) lay.anchors.push({ type: R.chance(0.5) ? 'fire' : 'smoke', x, y, z: Z(x, y) + 18, s: R.range(0.9, 1.4), dark: 0.8 });
      }
    }
    if (R.chance(0.6)) {
      const k = R.int(0, P.rails - 1), x = S.railX(k), dir = R.chance(0.5) ? 1 : -1, yA = R.range(y0, y1);
      for (let j = 0; j < 6; j++) lay.movers.push({ kind: 'vehicle', x, y: yA - dir * j * 70, rot: 0, vx: 0, vy: dir * 0.9, w: 13, l: 64, h: 17, mat: j === 0 ? 'roof_metal' : 'train_roof', side: j === 0 ? 'steel_yellow' : 'train_side', lights: j === 0 });
    }
  }
  lay.hangars = []; lay.jets = []; lay.towers = []; lay.fuel = [];
  if (P.airbase > 0) {
    const rx = S.runX, ax = S.apronX;
    // Runway edge lights and approach strobes.
    for (let y = Math.ceil(y0 / 40) * 40; y < y1; y += 40) for (const s of [-1, 1]) lay.anchors.push({ type: 'glow', x: rx + s * 34, y, z: Z(rx, y) + 1.5, r: 5, c: s > 0 ? [1, 0.9, 0.7] : [1, 0.9, 0.7], a: 0.55 });
    for (let y = y0 + R.range(40, 160); y < y1 - 60; y += R.range(150, 260)) {
      const b = planBuilding(R, ax - R.range(0, 40), y, R.range(70, 96), R.range(56, 76), { hMin: 22, hMax: 30, style: 'industrial', roof: 'metal' });
      b.z0 = Z(b.x, b.y); b.snow = P.surface === 'snow'; b.items = [];
      lay.hangars.push(b);
      // Aircraft parked on the apron in front of the hangar.
      for (let k = 0; k < R.int(1, 3); k++) lay.jets.push({ x: ax + 70 + R.range(-6, 6), y: y + (k - 1) * 40 + R.range(-6, 6), rot: Math.PI / 2 + R.range(-0.15, 0.15), kind: R.pick(['fighter', 'fighter', 'transport', 'heli']), burnt: R.chance(P.wrecks * 0.5) });
    }
    if (R.chance(0.5)) { const x = ax + 10, y = R.range(y0 + 60, y1 - 60); lay.towers.push({ x, y, z: Z(x, y) }); lay.anchors.push({ type: 'beacon', x, y, z: Z(x, y) + 76, c: [1, 0.2, 0.1], period: 55 }); }
    if (R.chance(0.45)) { const x = ax - 90, y = R.range(y0 + 60, y1 - 60); for (let k = 0; k < 4; k++) lay.fuel.push({ x: x + (k % 2) * 34, y: y + (k >> 1) * 34, z: Z(x, y), r: 13 }); }
    // An aircraft rolling along the taxiway.
    if (R.chance(0.4)) lay.movers.push({ kind: 'vehicle', x: rx + 70, y: R.range(y0, y1), rot: 0, vx: 0, vy: R.sign() * 0.5, w: 30, l: 34, h: 6, mat: 'hull_grey', side: 'metal_dark', lights: true });
  }
  if (P.pipeline > 0) { const x = (P.road ? -1 : 1) * 260; lay.pipes.push({ x, z: Z(x, (y0 + y1) / 2) }); }
  for (let i = 0; i < 6 * P.fires; i++) {
    const x = R.range(-520, 520), y = R.range(y0, y1);
    if (onRoad(x, y)) continue;
    lay.fires.push({ x, y, r: R.range(14, 34), seed: R.next() });
    lay.anchors.push({ type: 'fire', x, y, z: Z(x, y) + 2, s: R.range(1, 1.8) });
    if (R.chance(0.5)) lay.anchors.push({ type: 'smoke', x, y, z: Z(x, y) + 30, s: R.range(1.4, 2.2), dark: 0.9 });
  }
  lay.seed = R.next();
  return lay;
}

function surfaceColour(P, h, slope, x, y) {
  const n = sampleField('fine', x, y, 300);
  switch (P.surface) {
    case 'snow': {
      const rockK = Math.min(1, Math.max(0, slope * 3.2 - 0.6));
      return mix(mix([0.8, 0.84, 0.9], [0.66, 0.72, 0.82], n * 0.7), mix([0.26, 0.25, 0.26], [0.4, 0.39, 0.39], n), rockK);
    }
    case 'sand': {
      const rockK = Math.min(1, Math.max(0, slope * 2.6 - 0.4));
      return mix(mix([0.84, 0.68, 0.46], [0.72, 0.55, 0.36], n), mix([0.62, 0.42, 0.28], [0.48, 0.32, 0.22], n), rockK);
    }
    case 'ice': return mix(mix([0.75, 0.86, 0.94], [0.88, 0.93, 0.98], n), [0.48, 0.62, 0.74], Math.min(1, slope * 2));
    case 'salt': return mix([0.93, 0.91, 0.86], [0.82, 0.8, 0.74], n);
    case 'grass': return mix(mix([0.3, 0.38, 0.18], [0.42, 0.44, 0.24], n), [0.4, 0.37, 0.33], Math.min(1, slope * 2.2));
    case 'dirt': return mix(mix([0.48, 0.38, 0.28], [0.4, 0.32, 0.24], n), [0.36, 0.32, 0.3], Math.min(1, slope * 2.2));
    default: return mix(mix([0.48, 0.45, 0.42], [0.36, 0.34, 0.32], n), [0.28, 0.26, 0.25], Math.min(1, slope * 1.5));
  }
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  paintHeightfield(p, S.height, (h, slope, x, y) => {
    let col = surfaceColour(P, h, slope, x, y);
    if (P.relief === 'canyon' && h > 40) col = mix(col, shade(col, 0.82, [0.6, 0.4, 0.3], 0.1), (Math.floor(h / 28) % 2) * 0.35); // strata bands
    // Erosion gullies down steep walls (noise stretched across the slope).
    if (slope > 0.25 && (P.relief === 'canyon' || P.relief === 'quarry' || P.relief === 'glacier')) col = mix(col, shade(col, 0.62), Math.min(1, (slope - 0.25) * 2.5) * sampleField('ridged', x * 0.25, y, 70) * 0.6);
    if (P.relief === 'quarry') col = mix(col, shade(col, 0.75), Math.abs(Math.sin(h / 34 * Math.PI)) * 0.25);
    return col;
  }, { eps: 7, step: 2, shadows: P.relief === 'canyon' || P.relief === 'quarry' || P.relief === 'hills' || P.relief === 'glacier' || P.relief === 'dunes' ? { range: P.relief === 'dunes' ? 160 : 380, steps: P.relief === 'dunes' ? 7 : 11 } : null });
  // Material grain over the relief.
  if (P.surface === 'snow' || P.surface === 'ice') { p.noise('streak', 150, 'soft-light', 0.4, { rot: -0.4, sy: 0.4 }); p.noise('grain', 128 / p.ppu, 'soft-light', 0.3); p.patch('grain_97', 128 / p.ppu, [1, 1, 1], 0.6); }
  else if (P.surface === 'sand') p.layer(() => sandSurf(p, { color: [0.8, 0.65, 0.45] }), { op: 'soft-light', alpha: 0.7 });
  else p.noise('grain', 128 / p.ppu, 'overlay', 0.45);
  p.noise('fbm', 320, 'soft-light', 0.3);
  if (P.surface === 'salt') { const R = new RNG(`salt:${lay.seed}`); for (let i = 0; i < 40; i++) p.crack(R, R.range(-570, 570), R.range(y0, y1), R.angle(), R.range(30, 80), 0.7, [0.6, 0.58, 0.52], 0.6, 2); }
  // Road / track.
  if (P.road) {
    const path = () => { p.ctx.beginPath(); for (let y = y0 - 20; y <= y1 + 20; y += 16) p.ctx.lineTo(S.roadX(y) - 26, y); for (let y = y1 + 20; y >= y0 - 20; y -= 16) p.ctx.lineTo(S.roadX(y) + 26, y); p.ctx.closePath(); };
    if (P.surface === 'sand' || P.surface === 'dirt') gravel(p, { path, color: [0.55, 0.47, 0.36] });
    else asphalt(p, { path, color: [0.25, 0.25, 0.26] });
    if (P.surface === 'snow') p.patch('fbm_50', 260, [0.86, 0.89, 0.94], 0.7, { path });
    if (P.surface === 'sand') p.patch('fbm_50', 300, [0.82, 0.66, 0.45], 0.6, { path });
    for (const o of [-9, 9]) { const pts = []; for (let y = y0 - 20; y <= y1 + 20; y += 16) pts.push(S.roadX(y) + o, y); p.line(pts, 3, [0.1, 0.09, 0.08], 0.35); }
  }
  if (P.rails > 0) {
    const bx0 = S.railX(0) - 26, bx1 = S.railX(P.rails - 1) + 26;
    p.rectPath(bx0, y0 - 4, bx1 - bx0, y1 - y0 + 8).fill([0.3, 0.28, 0.25], 0.85);
    p.noise('grain', 128 / p.ppu, 'overlay', 0.5);
    for (let k = 0; k < P.rails; k++) railway(p, S.railX(k), y0 - 4, y1 + 4, { rust: true, ballast: [0.34, 0.31, 0.28] });
  }
  if (P.airbase > 0) {
    const rx = S.runX, ax = S.apronX;
    p.rectPath(ax - 60, y0 - 4, rx - ax + 40, y1 - y0 + 8).fill([0.42, 0.41, 0.39], 0.95);           // apron concrete
    p.noise('grain', 128 / p.ppu, 'overlay', 0.4);
    for (let y = Math.ceil(y0 / 30) * 30; y < y1; y += 30) p.line([ax - 60, y, rx - 40, y], 0.6, [0.25, 0.25, 0.24], 0.5);  // slab joints
    asphalt(p, { path: () => p.rectPath(rx - 36, y0 - 4, 72, y1 - y0 + 8), color: [0.2, 0.2, 0.21] });
    for (const s of [-1, 1]) p.line([rx + s * 32, y0 - 4, rx + s * 32, y1 + 4], 1.2, [0.9, 0.9, 0.86], 0.85);
    for (let y = Math.ceil(y0 / 48) * 48; y < y1; y += 48) p.rectPath(rx - 1, y, 2, 26).fill([0.92, 0.92, 0.9], 0.85);
    // Rubber deposits in the touchdown zones.
    p.patch('fbm_60', 200, [0.06, 0.06, 0.06], 0.45, { path: () => p.rectPath(rx - 20, y0, 40, y1 - y0) });
    asphalt(p, { path: () => p.rectPath(rx + 58, y0 - 4, 24, y1 - y0 + 8), color: [0.24, 0.24, 0.25] });   // taxiway
    p.line([rx + 70, y0 - 4, rx + 70, y1 + 4], 0.7, [0.95, 0.8, 0.2], 0.85);
    for (const L of all) for (const j of L.jets) if (j.burnt) scorch(p, new RNG(`js:${j.x}`), j.x, j.y, 30);
  }
  for (const L of all) for (const f of L.fires) { const Rf = new RNG(`tfi:${f.seed}`); scorch(p, Rf, f.x, f.y, f.r * 2.2); p.radial(f.x, f.y, f.r, [[0, [0.03, 0.02, 0.02], 0.85], [1, [0.05, 0.04, 0.03], 0]]); }
  for (const L of all) for (const cv of L.crevasses) {
    const R = new RNG(`crev:${cv.seed}`), c0 = Math.cos(cv.a), s0 = Math.sin(cv.a), pts = [], back = [];
    for (let k = 0; k <= 10; k++) { const t = (k / 10 - 0.5) * cv.l, w = cv.w * Math.sin((k / 10) * Math.PI) * R.range(0.7, 1.2); pts.push(cv.x + c0 * t - s0 * w, cv.y + s0 * t + c0 * w); back.push(cv.x + c0 * t + s0 * w, cv.y + s0 * t - c0 * w); }
    for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
    p.poly(pts).fill([0.12, 0.25, 0.42]);
    p.poly(pts).stroke([0.5, 0.7, 0.9], 1.5, 0.6);
  }
  if (lay.pond || nb.some((L) => L && L.pond)) for (const L of all) if (L.pond) {
    const pd = L.pond;
    p.radial(pd.x, pd.y, pd.r * 1.5, [[0.6, [0.35, 0.38, 0.22], 0.8], [1, [0.4, 0.36, 0.24], 0]]);
    p.ellipsePath(pd.x, pd.y, pd.r, pd.r * 0.75).fill([0.06, 0.25, 0.3]);
    p.radial(pd.x - pd.r * 0.3, pd.y + pd.r * 0.2, pd.r * 0.6, [[0, [0.5, 0.7, 0.75], 0.35], [1, [0.2, 0.4, 0.45], 0]]);
  }
  p.props(() => new RNG(`tr:${lay.seed}`), (Rp) => {
    for (const L of all) for (const b of L.buildings) shadowBuilding(p, b);
    for (const L of all) for (const b of L.ruins) { shadowBuilding(p, b); rubble(p, new RNG(`trr:${b.x}`), b.x, b.y, Math.max(b.w, b.d) * 0.6, { color: P.surface === 'sand' ? [0.7, 0.58, 0.42] : [0.5, 0.48, 0.45] }); }
    for (const L of all) for (const d of L.domes) p.shadowCircle(d.x, d.y, d.r, d.r);
    for (const L of all) for (const m of L.masts) p.shadowCircle(m.x, m.y, 2, m.h, 0, 6);
    for (const L of all) for (const t of L.tanks) p.shadowCircle(t.x, t.y, t.r, 18, 0, 10);
    for (const L of all) if (L.tower) p.shadowCircle(L.tower.x, L.tower.y, 8, L.tower.h, 0, 8);
    for (const L of all) for (const m of L.mirrors) p.shadowBox(m.x, m.y, 14, 8, 8, m.rot, 4);
    for (const L of all) for (const r of L.rigs) p.shadowBox(r.x, r.y, 20, 20, r.h);
    for (const L of all) for (const b of L.boulders) shadowBoulder(p, b.x, b.y, b.r, b.h);
    for (const L of all) for (const h of L.hedgehogs) p.shadowBox(h.x, h.y, 10, 10, 7, h.rot);
    for (const L of all) for (const b of L.hangars) shadowBuilding(p, b);
    for (const L of all) for (const tw of L.towers) p.shadowBox(tw.x, tw.y, 14, 14, 76);
    for (const L of all) for (const f of L.fuel) p.shadowCircle(f.x, f.y, f.r, 14, 0, 8);
    for (const L of all) for (const j of L.jets) aircraft(p, j);
    for (const L of all) for (const wg of L.wagons) p.shadowBox(wg.x, wg.y, 14, 66, wg.kind === 'flat' ? 6 : 18, wg.rot, 4);
    for (const L of all) for (const pp of L.pipes) p.rectPath(pp.x - 3 + 10, y0 - 4, 6, y1 - y0 + 8).fill([0, 0, 0], 0.35);
    for (const L of all) if (L.fence) { const f = L.fence; p.rectPath(f.x - f.w / 2, f.y - f.d / 2, f.w, f.d).stroke([0.25, 0.25, 0.27], 0.8, 0.8); }
    for (const L of all) for (const t of L.trees) (P.surface === 'snow' || P.surface === 'rock' ? pine : tree)(p, new RNG(`tt:${t.seed}`), t.x, t.y, t.r, { snow: P.surface === 'snow' });
    for (const L of all) for (const pm of L.palms) { const Rp2 = new RNG(`palm:${pm.seed}`); p.shadowCircle(pm.x, pm.y, pm.r * 0.6, pm.r * 3, pm.r * 2, 8); for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + Rp2.range(0, 0.4); p.line([pm.x, pm.y, pm.x + Math.cos(a) * pm.r, pm.y + Math.sin(a) * pm.r], 3, [0.24, 0.36, 0.14], 0.95, { cap: 'round' }); } }
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`tcr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2); crater(p, Rc, cr.x, cr.y, cr.r, { rim: S.dust }); }
    for (const L of all) for (const w of L.wrecks) {
      if (w.kind === 'tank') tank(p, w.x, w.y, w.rot, { burnt: w.burnt, color: P.surface === 'snow' ? [0.78, 0.8, 0.8] : P.surface === 'sand' ? [0.62, 0.55, 0.4] : undefined });
      else if (w.kind === 'truck') truck(p, w.x, w.y, w.rot, { burnt: w.burnt, cargo: 'canvas' });
      else car(p, w.x, w.y, w.rot, { burnt: w.burnt, color: carColor(Rp) });
    }
    for (const L of all) for (const bl of L.blocks) { const Rb = new RNG(`blk:${bl.seed}`); p.shadowBox(bl.x, bl.y, bl.s, bl.s * 0.8, bl.s * 0.6, Rb.angle()); p.at(bl.x, bl.y, Rb.angle(), (cx) => { cx.fillStyle = 'rgb(232,238,246)'; cx.fillRect(-bl.s / 2, -bl.s * 0.4, bl.s, bl.s * 0.8); }); }
    for (const L of all) for (const j of L.jacks) { p.shadowBox(j.x, j.y, 6, 22, 14, j.rot); p.at(j.x, j.y, j.rot, (cx) => { cx.fillStyle = 'rgb(60,62,66)'; cx.fillRect(-3, -11, 6, 22); cx.fillStyle = 'rgb(200,140,30)'; cx.fillRect(-4, 6, 8, 6); }); }
    for (const L of all) for (const ps of L.posts) { const ring = []; for (let a = 0; a <= 6.3; a += 0.5) ring.push(ps.x + Math.cos(a) * 16, ps.y + Math.sin(a) * 14); sandbags(p, ring, { color: P.surface === 'snow' ? [0.75, 0.75, 0.72] : undefined }); }
    for (let i = 0; i < 4; i++) { drum(p, Rp.range(-500, 500), Rp.range(y0, y1)); if (P.facility > 0) crate(p, Rp, Rp.range(-500, 500), Rp.range(y0, y1), Rp.range(5, 8)); }
    if (P.wrecks > 0.4) for (let i = 0; i < 4; i++) debris(p, Rp, Rp.range(-500, 500), Rp.range(y0, y1), Rp.range(20, 40), 25);
  }, 0.55, 2.6);
  if (p.env.glow) {
    for (const L of all) for (const m of L.mirrors) p.env.glow.rectPath(m.x - 6, m.y - 3, 12, 6).fill([1, 0.95, 0.8], 0.25, 'lighter');
    for (const L of all) for (const a of L.anchors) if (a.type === 'beacon') p.env.glow.radial(a.x, a.y, 14, [[0, [1, 0.3, 0.2], 0.4], [1, [1, 0.2, 0.1], 0]], 'lighter');
  }
}

function mesh(mb, lay, S) {
  const P = S.P;
  for (const b of lay.buildings) { meshBuilding(mb, b, b.z0); if (b.snow) mb.box(b.x, b.y, b.z0 + b.h + 0.1, b.w * 0.94, b.d * 0.94, 1.6, b.rot, { top: 'snow', side: 'snow' }); }
  for (const b of lay.ruins) meshBuilding(mb, { ...b, style: 'brick' }, b.z0);
  for (const d of lay.domes) { const prof = []; for (let k = 0; k <= 7; k++) { const a = (k / 7) * Math.PI / 2; prof.push([Math.cos(a) * d.r + 0.01, d.z + 10 + Math.sin(a) * d.r]); } mb.lathe(d.x, d.y, [[d.r, d.z], [d.r, d.z + 10], ...prof.slice(1)], 'containment', { seg: 18 }); }
  for (const m of lay.masts) { mb.prism([m.x - 2, m.y - 2, m.x + 2, m.y - 2, m.x + 2, m.y + 2, m.x - 2, m.y + 2], m.z, m.z + m.h, { side: 'lattice_grey', top: 'lattice_grey' }); }
  for (const t of lay.tanks) mb.lathe(t.x, t.y, [[t.r, t.z], [t.r, t.z + 16], [t.r * 0.8, t.z + 18], [0, t.z + 19]], P.surface === 'snow' ? 'containment' : 'steel_painted', { seg: 12 });
  if (lay.tower) { const t = lay.tower; mb.lathe(t.x, t.y, [[10, t.z], [7, t.z + t.h - 20], [11, t.z + t.h - 18], [11, t.z + t.h]], 'concrete', { seg: 10, top: 'molten_top' }); }
  for (const m of lay.mirrors) mb.box(m.x, m.y, m.z + 4, 14, 8, 0.8, m.rot, { top: 'solar_panel', side: 'steel_painted' });
  for (const r of lay.rigs) {
    mb.box(r.x, r.y, r.z, 30, 30, 8, 0, { top: 'grating', side: 'steel_painted' });
    mb.lathe(r.x, r.y, [[9, r.z + 8], [2, r.z + r.h]], 'lattice', { seg: 4, top: false });
    mb.box(r.x + 22, r.y, r.z, 14, 20, 12, 0, { top: 'roof_metal', side: 'facade_industrial' });
  }
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, P.surface === 'sand' ? 'rock_sand' : P.surface === 'snow' ? 'rock' : 'rock_dark', b.z);
  for (const h of lay.hedgehogs) meshHedgehog(mb, h.x, h.y, 1, h.rot);
  for (const b of lay.hangars) { meshBuilding(mb, b, b.z0); if (b.snow) mb.box(b.x, b.y, b.z0 + b.h + 0.1, b.w * 0.94, b.d * 0.94, 1.4, b.rot, { top: 'snow', side: 'snow' }); }
  for (const tw of lay.towers) {
    mb.box(tw.x, tw.y, tw.z, 10, 10, 62, 0, { top: 'concrete', side: 'concrete' });
    mb.box(tw.x, tw.y, tw.z + 62, 18, 18, 9, 0, { top: 'roof_metal', side: 'facade_glass' });
    mb.box(tw.x, tw.y, tw.z + 71, 14, 14, 3, 0, { top: 'roof_metal', side: 'metal_dark' });
  }
  for (const f of lay.fuel) mb.lathe(f.x, f.y, [[f.r, f.z], [f.r, f.z + 12], [f.r * 0.9, f.z + 13], [0, f.z + 13.5]], P.surface === 'snow' ? 'containment' : 'steel_painted', { seg: 14 });
  for (const wg of lay.wagons) {
    const z = wg.z + 3;
    mb.box(wg.x, wg.y, z, 10, 62, 3, wg.rot, { top: 'metal_dark', side: 'metal_dark' });
    if (wg.kind === 'box') mb.box(wg.x, wg.y, z + 3, 13, 62, 14, wg.rot, { top: 'train_roof', side: 'train_side' });
    else if (wg.kind === 'hopper') mb.box(wg.x, wg.y, z + 3, 13, 60, 12, wg.rot, { top: 'rust', side: 'rust' });
    else if (wg.kind === 'flat') { const c = Math.cos(wg.rot), s = Math.sin(wg.rot); for (const o of [-15, 15]) mb.box(wg.x - s * o, wg.y + c * o, z + 3, 12, 28, 12, wg.rot, { top: wg.col, side: wg.col }); }
    else { mb.box(wg.x, wg.y, z + 3, 12, 58, 11, wg.rot, { top: 'containment', side: 'steel_painted' }); }
  }
  for (const pp of lay.pipes) {
    for (let y = lay.ys[0]; y <= lay.ys[1]; y += 40) mb.box(pp.x, y, pp.z, 4, 4, 9, 0, { top: 'concrete', side: 'concrete' });
    mb.beam([pp.x, lay.ys[0] - 2, pp.z + 11], [pp.x, lay.ys[1] + 2, pp.z + 11], 7, 7, 'steel_painted');
  }
}

/** Parked aircraft seen from above (fighter, transport, helicopter). */
function aircraft(p, j) {
  const body = j.burnt ? [0.1, 0.09, 0.08] : j.kind === 'transport' ? [0.5, 0.52, 0.5] : [0.56, 0.6, 0.64];
  const L = j.kind === 'transport' ? 1.7 : 1;
  p.shadowBox(j.x + 6, j.y - 6, 26 * L, 34 * L, 4, j.rot, 3);
  p.at(j.x, j.y, j.rot, (cx) => {
    const fill = (pts, c, a = 1) => { cx.beginPath(); cx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]); cx.closePath(); cx.fillStyle = `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${a})`; cx.fill(); };
    if (j.kind === 'heli') {
      fill([-3, -14, 3, -14, 4, 8, 1.5, 22, -1.5, 22, -4, 8], body);
      cx.strokeStyle = 'rgba(20,22,24,0.7)'; cx.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); cx.stroke(); }
      return;
    }
    if (j.kind === 'transport') {
      fill([-5, -30, 5, -30, 6, 26, 2, 32, -2, 32, -6, 26], body);
      fill([-40, -2, 40, -2, 40, 6, -40, 6], shade(body, 0.92));
      fill([-14, 24, 14, 24, 14, 28, -14, 28], shade(body, 0.9));
      for (const x of [-26, -14, 14, 26]) fill([x - 2, -6, x + 2, -6, x + 2, 2, x - 2, 2], [0.15, 0.15, 0.16]);
      return;
    }
    fill([0, -18, 3, -10, 3, 4, 15, 10, 15, 13, 3, 12, 3, 15, 8, 18, 8, 20, -8, 20, -8, 18, -3, 15, -3, 12, -15, 13, -15, 10, -3, 4, -3, -10], body);
    fill([-1.4, -12, 1.4, -12, 1.4, -6, -1.4, -6], [0.12, 0.18, 0.22]);
  });
}
