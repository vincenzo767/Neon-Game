import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { tree, scorch, crater, rubble, debris, crate, drum, container, sandbags } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding, meshCrane, shadowCrane } from '../kit/city.js';
import { meshBoulder, shadowBoulder } from '../kit/terrain.js';
import { meshShip, shipSize } from '../kit/ships.js';
import { mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';
import { CHUNK, NCH, channelX, channelSlope, halfBank, shoreX, installationsAt, pierAt, jettyAt, shoalsAt } from './lagoonMap.js';

// LAGOON ANCHORAGE: the tropical naval lagoon where CORAL SIEGE is fought
// (level 2-1, all five of its phase arenas; the level's waves fly over it too).
//
// The map (world/env/lagoonMap.js, shared with the boss rig) is a deep-water
// channel winding up a lagoon between two inhabited banks:
//   starboard (x > 0)  the naval anchorage: a concrete quay wall with tyre
//                      fenders and bollards, concrete piers with patrol
//                      boats, warships moored alongside (some burning and
//                      settling), fuel tanks in bund walls, bunkers, radar
//                      towers, warehouses, cranes and container stacks
//   port (x < 0)       a palm beach, jungle and a fishing village of huts,
//                      wooden jetties with trawlers, a lighthouse on a rocky
//                      point, gun pits dug into the dunes
// INSTALLATIONS (lagoonMap) are built exactly where the boss will shell them.
// The water itself is the animated sea surface (z = 0); a translucent
// SHALLOWS layer over it paints turquoise shallows, sand and coral heads,
// seaweed, shoals and surf, smoothly (no blocks) and fading into the deep
// channel. Wrecks lie half-sunk off both banks; fires and smoke rise from the
// damaged waterfront.
//
// PERIODIC: both layers repeat every PERIOD (NCH chunks), built once.
//
// Params (0..1): fires, smoke, wrecks, reef, village, jungle, storm; night (bool).

const LEN = CHUNK;
const XW = 470;
const TAU = Math.PI * 2;
const pmod = (a, n) => ((a % n) + n) % n;
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const F = (x, y, s) => sampleField('fbm', x, y, s);

export default {
  id: 'lagoon',
  label: 'Lagoon Anchorage (periodic naval channel)',
  defaults: { fires: 0.35, smoke: 0.5, wrecks: 0.7, reef: 0.9, village: 0.8, jungle: 0.85, storm: 0.15, night: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || 'lagoon'; // one lagoon for every phase arena: only params / light differ
    const S = { P, seed, dust: [0.86, 0.82, 0.7] };
    // Inland distance from the waterline (negative over the water) and which bank.
    S.bank = (x, y) => (x >= channelX(y) ? 1 : -1);
    S.inland = (x, y) => { const s = S.bank(x, y); return s * (x - channelX(y)) - halfBank(s, y); };
    S.height = (x, y) => {
      const s = S.bank(x, y), d = s * (x - channelX(y)) - halfBank(s, y);
      if (d <= 0) return 0.2 - Math.min(6, -d * 0.05);
      const hill = (F(x, y, 512) - 0.35) * 46 + (sampleField('ridged', x, y, 1024) - 0.5) * 30;
      if (s > 0) return 4.2 + sm(150, 230, d) * Math.max(0, 8 + hill);                        // quay apron, jungle hills behind
      return 0.2 + Math.min(d, 40) / 40 * 3 + sm(46, 90, d) * 3 + sm(110, 220, d) * Math.max(0, 6 + hill);  // beach, dunes, hills
    };
    const st = P.storm;
    S.atmosphere = {
      surfaces: [{
        type: 'water', z: 0,
        deep: P.night ? [0.01, 0.05, 0.08] : [0.015, 0.13 - st * 0.04, 0.19 - st * 0.05],
        shallow: P.night ? [0.03, 0.12, 0.15] : [0.05, 0.36 - st * 0.1, 0.4 - st * 0.1],
        sky: P.night ? [0.08, 0.1, 0.14] : [0.52 - st * 0.22, 0.64 - st * 0.26, 0.74 - st * 0.26],
        wave: [0.45 + st * 1.1, 1.15 - st * 0.3, 0.75 + st * 0.6, 0.38 + st * 1.1],
        foam: [0.1 + st * 0.6, 0.86 - st * 0.32, 0.22 + st * 0.65, 0],
        wind: [0.8, 0.35 + st],
        hq: [0.55, 0.6, 0.65, 0],
      }],
      glowTint: [1.1, 1, 0.9],
    };
    S.layers = [
      {
        id: 'shallows', z: 0.35, x0: -XW, x1: XW, length: LEN, ppu: 0.8, blend: true, period: NCH,
        layout: (c) => periodicLayout(c, S, shallowsLayout),
        paint: (p, lay, nb, c) => paintShallows(p, lay, nb, c, S),
      },
      {
        id: 'land', z: 0, x0: -XW, x1: XW, length: LEN, ppu: 0.9, cut: true, glow: true, grid: [44, 18], height: S.height, flatLight: true, period: NCH,
        layout: (c) => periodicLayout(c, S, layout),
        paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
        mesh: (mb, lay) => mesh(mb, lay, S),
      },
    ];
    S.surfacesTopDown = [{ z: 4, contains: (x, y) => S.inland(x, y) > 0 }, { z: 0, water: true }];
    S.floorZ = 0;
    return S;
  },
};

// ----------------------------------------------------- periodic helpers

function periodicLayout(c, S, fn) {
  const km = pmod(c.k, NCH);
  if (km === c.k) return fn(c, S);
  const dy = (c.k - km) * LEN;
  const lay = fn({ ...c, k: km, y0: c.y0 - dy, y1: c.y1 - dy, R: new RNG(`${S.seed}:${fn.name}:${km}`) }, S);
  return shiftLayout(lay, dy);
}

function shiftLayout(lay, dy) {
  for (const key of Object.keys(lay)) {
    const v = lay[key];
    if (Array.isArray(v)) lay[key] = v.map((o) => shiftObj(o, dy));
    else if (v && typeof v === 'object') lay[key] = shiftObj(v, dy);
    else if (key === 'y0' || key === 'y1') lay[key] = v + dy;
  }
  return lay;
}

function shiftObj(o, dy) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const n = { ...o };
  for (const k of ['y', 'y0', 'y1']) if (typeof n[k] === 'number') n[k] += dy;
  return n;
}

// ------------------------------------------------------------- layout

function shallowsLayout(c) {
  return { k: c.k, y0: c.y0, y1: c.y1, shoals: shoalsAt(c.k), seed: c.R.next() };
}

function layout(c, S) {
  const { R, y0, y1, k } = c, P = S.P;
  const lay = {
    k, y0, y1, inst: [], pier: null, jetty: null, quayShips: [], boats: [], wrecks: [], palms: [], trees: [], huts: [], sheds: [],
    cranes: [], containers: [], rocks: [], light: null, anchors: [], craters: [], lamps: [], seed: R.next(),
  };
  const own = (y) => y >= y0 && y < y1;
  // ---- Installations (the bombardment targets): built exactly where lagoonMap puts them.
  for (const it of installationsAt(k)) {
    lay.inst.push({ ...it });
    if (it.kind === 'lighthouse') lay.light = { x: it.x, y: it.y };
  }
  // ---- Starboard quay: pier with a patrol boat, a warship alongside, cranes, containers, sheds.
  const pr = pierAt(k);
  lay.pier = { y: pr.y, root: pr.root, tip: pr.tip };
  lay.boats.push({ type: R.pick(['patrol', 'tug', 'patrol']), x: (pr.root + pr.tip) / 2 - 2, y: pr.y + 18, rot: R.chance(0.5) ? 0 : Math.PI, burnt: R.chance(P.fires * 0.4) });
  lay.anchors.push({ type: 'beacon', x: pr.tip + 2, y: pr.y - 9, z: 8, c: [0.2, 1, 0.3], period: 70 });
  if (k % 2 === 0) {
    const type = R.pick(['frigate', 'destroyer', 'freighter']), sz = shipSize(type), y = y0 + R.range(140, LEN - 140);
    const x = shoreX(1, y) - sz.b / 2 - 4, burning = R.chance(0.35 + P.fires * 0.5);
    lay.quayShips.push({ type, x, y, rot: R.chance(0.5) ? 0 : Math.PI, burnt: burning, lowered: burning && R.chance(0.6) });
    if (burning) for (let i = 0; i < 2; i++) lay.anchors.push({ type: 'fire', x: x + R.range(-4, 4), y: y + R.range(-sz.l * 0.3, sz.l * 0.3), z: 9, s: R.range(1.1, 1.7) });
    if (burning) lay.anchors.push({ type: 'smoke', x, y, z: 24, s: 1.8, dark: 0.9 });
  }
  for (let i = 0; i < 2; i++) {
    const y = y0 + 60 + i * 250 + R.range(-30, 30);
    if (Math.abs(y - pr.y) < 50) continue;
    lay.cranes.push({ x: shoreX(1, y) + R.range(30, 46), y, h: R.range(70, 96), rot: Math.PI + R.range(-0.5, 0.5) });
  }
  for (let i = 0; i < 6; i++) {
    const y = R.range(y0 + 20, y1 - 20), x = shoreX(1, y) + R.range(80, 150);
    lay.containers.push({ x, y, rot: R.chance(0.7) ? 0 : Math.PI / 2, mat: R.pick(['container_red', 'container_blue', 'container_orange', 'container_grey', 'container_teal', 'container_green']), stack: R.int(1, 3) });
  }
  for (let i = 0; i < 2; i++) {
    const y = y0 + 130 + i * 250, x = shoreX(1, y) + R.range(190, 240);
    lay.sheds.push(planBuilding(R, x, y, R.range(60, 90), R.range(70, 110), { hMin: 16, hMax: 26, style: 'industrial', burnt: P.fires * 0.4, collapse: P.fires * 0.25 }));
  }
  // Quay lamps.
  for (let y = Math.ceil(y0 / 64) * 64; y < y1; y += 64) lay.lamps.push({ x: shoreX(1, y) + 10, y });
  // ---- Port bank: beach, palms, jungle, village, jetty with a trawler.
  const jt = jettyAt(k);
  lay.jetty = { y: jt.y, root: jt.root, tip: jt.tip };
  lay.boats.push({ type: 'trawler', x: (jt.root + jt.tip) / 2, y: jt.y - 13, rot: R.chance(0.5) ? 0 : Math.PI, burnt: false });
  for (let i = 0; i < 46 * P.jungle; i++) {
    const y = R.range(y0, y1), d = R.range(70, 230), x = shoreX(-1, y) - d;
    if (x < -XW + 8) continue;
    if (d < 120 && R.chance(0.65)) lay.palms.push({ x, y, r: R.range(9, 14), seed: R.next() });
    else lay.trees.push({ x, y, r: R.range(9, 16), seed: R.next() });
  }
  for (let i = 0; i < 14; i++) { const y = R.range(y0, y1), x = shoreX(-1, y) - R.range(12, 60); lay.palms.push({ x, y, r: R.range(8, 12), seed: R.next() }); }
  // Starboard jungle beyond the base.
  for (let i = 0; i < 18 * P.jungle; i++) { const y = R.range(y0, y1), x = shoreX(1, y) + R.range(250, 340); if (x < XW - 6) lay.trees.push({ x, y, r: R.range(10, 16), seed: R.next() }); }
  if (R.chance(P.village)) {
    const yc = y0 + R.range(110, LEN - 110);
    for (let i = 0; i < R.int(4, 7); i++) {
      const y = yc + R.range(-80, 80), x = shoreX(-1, y) - R.range(70, 150);
      if (lay.inst.some((it) => Math.hypot(it.x - x, it.y - y) < it.r + 22)) continue;
      const b = planBuilding(R, x, y, R.range(14, 22), R.range(12, 18), { hMin: 7, hMax: 10, style: R.pick(['brick', 'concrete']), roof: R.pick(['metal', 'tar']), burnt: P.fires * 0.5, rot: R.range(-0.4, 0.4) });
      lay.huts.push(b);
      if (b.burnt && R.chance(0.6)) lay.anchors.push({ type: 'fire', x, y, z: b.h + 4, s: R.range(0.7, 1.1) });
    }
  }
  // ---- Water: wrecks half-sunk off the banks, rocks on the headlands and shoals.
  if (R.chance(P.wrecks)) {
    const side = R.sign(), y = y0 + R.range(100, LEN - 100), type = R.pick(['patrol', 'trawler', 'tug', 'frigate']), sz = shipSize(type);
    const x = shoreX(side, y) - side * R.range(8, 22), rot = side > 0 ? R.range(-0.5, 0.5) : Math.PI + R.range(-0.5, 0.5);
    lay.wrecks.push({ type, x, y, rot });
    lay.anchors.push({ type: R.chance(P.fires) ? 'fire' : 'smoke', x, y, z: 6, s: R.range(1.1, 1.6), dark: 0.85 });
    void sz;
  }
  for (const sh of shoalsAt(k)) for (let i = 0; i < 2; i++) lay.rocks.push({ x: sh.x + R.range(-12, 12), y: sh.y + R.range(-12, 12), r: R.range(5, 10), h: R.range(3, 7), seed: R.next() });
  if (lay.light) for (let i = 0; i < 6; i++) lay.rocks.push({ x: lay.light.x + R.range(-10, 30), y: lay.light.y + R.range(-36, 36), r: R.range(8, 16), h: R.range(5, 12), seed: R.next() });
  // ---- Fires, smoke and scorched ground along the waterfront.
  for (let i = 0; i < 4 * P.fires; i++) {
    const side = R.sign(), y = R.range(y0, y1), x = shoreX(side, y) + side * R.range(30, 200);
    lay.anchors.push({ type: 'fire', x, y, z: S.height(x, y) + 2, s: R.range(0.8, 1.4) });
    lay.craters.push({ x, y, r: R.range(8, 14), seed: R.next() });
    if (R.chance(0.7)) lay.anchors.push({ type: 'smoke', x, y, z: S.height(x, y) + 24, s: R.range(1.4, 2.2), dark: 0.85 });
  }
  for (let i = 0; i < 2 * P.smoke; i++) { const side = R.sign(), y = R.range(y0, y1), x = shoreX(side, y) + side * R.range(200, 300); lay.anchors.push({ type: 'smoke', x, y, z: 30, s: 2.4, dark: 0.75 }); }
  // Installations: lights and smoke where appropriate.
  for (const it of lay.inst) {
    const z = S.height(it.x, it.y);
    if (it.kind === 'radar') lay.anchors.push({ type: 'beacon', x: it.x, y: it.y, z: z + 64, c: [1, 0.1, 0.05], period: 54 });
    if (it.kind === 'tank' && R.chance(P.fires * 0.5)) lay.anchors.push({ type: 'fire', x: it.x, y: it.y, z: z + 28, s: 1.6 });
    if (it.kind === 'lighthouse') {
      lay.anchors.push({ type: 'searchlight', x: it.x, y: it.y, z: z + 66, base: 0, sweep: 6.3, speed: 0.012, c: [1, 0.95, 0.8] });
      lay.anchors.push({ type: 'glow', x: it.x, y: it.y, z: z + 66, r: 22, c: [1, 0.95, 0.75], a: 0.7 });
    }
  }
  if (P.night) for (const lp of lay.lamps) lay.anchors.push({ type: 'lamp', x: lp.x, y: lp.y, z: 18, c: [1, 0.8, 0.5], len: 5 });
  for (const an of lay.anchors) if (!own(an.y)) an.y = Math.max(y0 + 2, Math.min(y1 - 2, an.y));
  return lay;
}

// -------------------------------------------------------------- paint

function landColour(S, x, y, slope) {
  const s = S.bank(x, y), d = S.inland(x, y), n = sampleField('fine', x, y, 256), P = S.P;
  let c;
  if (s > 0) {
    // Concrete apron and yards, then grass and jungle behind the base.
    const conc = mix([0.58, 0.58, 0.56], [0.46, 0.46, 0.45], n);
    const yard = mix([0.32, 0.32, 0.33], [0.26, 0.26, 0.27], n);
    c = mix(conc, yard, sm(60, 70, d) * (1 - sm(150, 160, d)) * 0.8);
    const veg = mix([0.17, 0.3, 0.12], [0.25, 0.37, 0.16], F(x, y, 256));
    c = mix(c, veg, sm(160, 200, d) * (0.6 + 0.4 * P.jungle));
  } else {
    const wet = [0.66, 0.6, 0.47], dry = mix([0.92, 0.86, 0.7], [0.84, 0.77, 0.6], n);
    c = mix(wet, dry, sm(0, 12, d));
    const veg = mix([0.15, 0.29, 0.11], [0.24, 0.37, 0.15], F(x, y, 256));
    c = mix(c, veg, sm(52, 96, d) * (0.55 + 0.45 * P.jungle));
  }
  const rock = mix([0.44, 0.42, 0.38], [0.3, 0.29, 0.27], n);
  return mix(c, rock, Math.min(1, Math.max(0, slope * 2.2 - 0.5)));
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  paintHeightfield(p, S.height, (h, slope, x, y) => landColour(S, x, y, slope), { eps: 5, step: 2 });
  p.noise('grain', 128 / p.ppu, 'overlay', 0.3);
  p.noise('fbm', 256, 'soft-light', 0.28);
  const along = (side, off, fn) => { const pts = []; for (let y = y0 - 24; y <= y1 + 24; y += 12) pts.push(shoreX(side, y) + side * off, y); fn(pts); };
  // Starboard quay: edge line, worn yellow safety line, yard markings, rail track, oil stains.
  along(1, 2, (pts) => p.line(pts, 4, [0.72, 0.71, 0.68], 0.9));
  along(1, 7, (pts) => p.line(pts, 1.6, [0.86, 0.68, 0.16], 0.75));
  along(1, 58, (pts) => p.line(pts, 1.2, [0.86, 0.84, 0.78], 0.45));
  for (const off of [34, 42]) along(1, off, (pts) => p.line(pts, 0.9, [0.24, 0.22, 0.2], 0.85));
  const Rp = new RNG(`lag:${lay.seed}`);
  for (let i = 0; i < 10; i++) { const y = Rp.range(y0, y1), x = shoreX(1, y) + Rp.range(10, 150); p.radial(x, y, Rp.range(5, 16), [[0, [0.06, 0.06, 0.07], 0.6], [1, [0.08, 0.08, 0.08], 0]]); }
  // Port beach: wrack line, foot paths, beached boats.
  along(-1, 6, (pts) => p.line(pts, 2, [0.42, 0.36, 0.26], 0.35));
  along(-1, 30, (pts) => p.line(pts, 3, [0.8, 0.74, 0.6], 0.3));
  for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`lcr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2.2); crater(p, Rc, cr.x, cr.y, cr.r, { rim: S.dust }); }
  p.props(() => new RNG(`lgp:${lay.seed}`), (Rq) => {
    for (const L of all) for (const b of L.huts) shadowBuilding(p, b);
    for (const L of all) for (const b of L.sheds) shadowBuilding(p, b, 4.2);
    for (const L of all) for (const cr of L.cranes) shadowCrane(p, cr.x, cr.y, cr.h, cr.rot, { jib: 70, counter: 26, z: 4.2 });
    for (const L of all) for (const ct of L.containers) for (let s = 0; s < ct.stack; s++) container(p, ct.x, ct.y, ct.rot, { color: CONT[ct.mat], z: 4.2 + s * 9, h: 9, w: 9, l: 24 });
    for (const L of all) for (const it of L.inst) shadowInst(p, it, S);
    for (const L of all) for (const b of L.rocks) shadowBoulder(p, b.x, b.y, b.r, b.h);
    for (const L of all) for (const t of L.trees) tree(p, new RNG(`lt:${t.seed}`), t.x, t.y, t.r, { color: [0.17, 0.3, 0.12] });
    for (const L of all) for (const pm of L.palms) palm(p, pm);
    for (const L of all) for (const b of L.huts) if (b.burnt) rubble(p, new RNG(`lhr:${b.x}`), b.x, b.y, 12, { color: [0.3, 0.27, 0.24] });
    for (let i = 0; i < 4; i++) { const y = Rq.range(y0, y1); crate(p, Rq, shoreX(1, y) + Rq.range(14, 60), y, Rq.range(4, 7), Rq.range(-0.4, 0.4), { color: [0.42, 0.36, 0.28] }); }
    for (let i = 0; i < 4; i++) { const y = Rq.range(y0, y1); drum(p, shoreX(1, y) + Rq.range(12, 50), y, { color: Rq.pick([[0.5, 0.2, 0.12], [0.2, 0.32, 0.5], [0.24, 0.3, 0.2]]) }); }
    for (let i = 0; i < 3; i++) { const y = Rq.range(y0, y1); debris(p, Rq, shoreX(-1, y) - Rq.range(0, 24), y, Rq.range(10, 20), 16, { color: [0.4, 0.34, 0.26] }); }
    // Gun pits on the port dunes: sandbag rings.
    for (const L of all) for (const it of L.inst) if (it.kind === 'battery' && it.side < 0) { const ring = []; for (let a = 0; a <= 6.3; a += 0.45) ring.push(it.x + Math.cos(a) * 22, it.y + Math.sin(a) * 20); sandbags(p, ring, { color: [0.72, 0.66, 0.5] }); }
  }, 0.5, 2.4);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) {
    if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 52 * a.s, [[0, [1, 0.42, 0.1], 0.45], [1, [1, 0.3, 0.05], 0]], 'lighter');
    else if (a.type === 'lamp') p.env.glow.radial(a.x, a.y, 30, [[0, [1, 0.8, 0.5], 0.45], [1, [1, 0.7, 0.4], 0]], 'lighter');
  }
  // Cut the sea out (piers and jetties are drawn back over it).
  for (const side of [-1, 1]) {
    p.ctx.beginPath();
    for (let y = y0 - 24; y <= y1 + 24; y += 8) p.ctx.lineTo(shoreX(side, y), y);
    p.ctx.lineTo(channelX(y1 + 24), y1 + 24); p.ctx.lineTo(channelX(y0 - 24), y0 - 24);
    p.ctx.closePath();
    p.fill([0, 0, 0], 1, 'destination-out');
  }
  for (const L of all) {
    if (L.pier) { const pr = L.pier; p.rectPath(pr.tip, pr.y - 11, pr.root - pr.tip + 4, 22).fill([0.55, 0.55, 0.53]); p.line([pr.tip + 1, pr.y - 10, pr.tip + 1, pr.y + 10], 1.4, [0.86, 0.68, 0.16], 0.8); }
    if (L.jetty) {
      const jt = L.jetty;
      p.rectPath(jt.root - 4, jt.y - 5, jt.tip - jt.root + 4, 10).fill([0.44, 0.33, 0.22]);
      for (let x = jt.root; x < jt.tip; x += 3) p.line([x, jt.y - 5, x, jt.y + 5], 0.4, [0.2, 0.15, 0.1], 0.6);
    }
  }
  void P;
}

const CONT = { container_red: [0.55, 0.13, 0.08], container_blue: [0.12, 0.24, 0.45], container_orange: [0.78, 0.38, 0.1], container_grey: [0.5, 0.52, 0.53], container_teal: [0.08, 0.4, 0.42], container_green: [0.18, 0.34, 0.18] };

function palm(p, pm) {
  const R = new RNG(`palm:${pm.seed}`);
  p.shadowCircle(pm.x, pm.y, pm.r * 0.6, pm.r * 3, pm.r * 2, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + R.range(0, 0.4), l = pm.r * R.range(0.85, 1.1);
    p.line([pm.x, pm.y, pm.x + Math.cos(a) * l * 0.6, pm.y + Math.sin(a) * l * 0.6, pm.x + Math.cos(a + 0.12) * l, pm.y + Math.sin(a + 0.12) * l], 3.2, [0.18, 0.33, 0.12], 0.95, { cap: 'round' });
    p.line([pm.x, pm.y, pm.x + Math.cos(a) * l * 0.9, pm.y + Math.sin(a) * l * 0.9], 0.6, [0.32, 0.46, 0.2], 0.8);
  }
  p.circlePath(pm.x, pm.y, 1.8).fill([0.3, 0.24, 0.14]);
}

function shadowInst(p, it, S) {
  const z = S.height(it.x, it.y);
  if (it.kind === 'tank') p.shadowCircle(it.x, it.y, it.r, z + 26, z, 14);
  else if (it.kind === 'bunker') p.shadowBox(it.x, it.y, 30, 24, z + 10, 0, z);
  else if (it.kind === 'radar') { p.shadowCircle(it.x, it.y, 8, z + 60, z, 6); p.shadowBox(it.x, it.y, 22, 4, z + 64, 0.6, z + 56); }
  else if (it.kind === 'depot') p.shadowBox(it.x, it.y, 56, 46, z + 18, 0, z);
  else if (it.kind === 'battery') p.shadowCircle(it.x, it.y, 14, z + 6, z, 10);
  else if (it.kind === 'lighthouse') p.shadowCircle(it.x, it.y, 7, z + 66, z, 10);
}

// ------------------------------------------------------------- shallows

function paintShallows(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  p.ctx.clearRect(-1e5, -1e5, 2e5, 2e5);
  // Half-resolution field, upscaled with filtering: smooth gradients, no blocky texels.
  const W = Math.ceil(p.canvas.width / 2), H = Math.ceil(p.canvas.height / 2);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const cx2 = cv.getContext('2d'), img = cx2.createImageData(W, H), d = img.data;
  const { x0, x1 } = p.rect;
  const shoals = [...lay.shoals, ...nb.filter(Boolean).flatMap((L) => L.shoals)];
  for (let j = 0; j < H; j++) {
    const y = y1 - ((j + 0.5) / H) * (y1 - y0), cx = channelX(y);
    const hbP = halfBank(-1, y), hbS = halfBank(1, y);
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0), side = x >= cx ? 1 : -1;
      const dd = (side > 0 ? hbS : hbP) - side * (x - cx);          // distance out from the waterline
      if (dd < -3) continue;
      const n = F(x, y, 256), n2 = sampleField('fine', x, y, 128);
      // Shallows: wide sandy shelf on the beach side, a narrow ledge under the quay wall.
      const shelf = side < 0 ? 95 + n * 70 : 38 + n * 22;
      const k = 1 - sm(0, shelf, dd);
      let r = 0.1 + 0.32 * k, g = 0.48 + 0.4 * k, b = 0.52 + 0.28 * k;      // turquoise → deep teal
      let a = Math.pow(k, 0.8) * (side < 0 ? 0.78 : 0.55);
      // Sand ripples visible through clear water.
      const rip = Math.sin((x * 0.31 + y * 0.12) + n * 6) * 0.5 + 0.5;
      r += rip * 0.04 * k; g += rip * 0.04 * k; b += rip * 0.02 * k;
      // Coral reef heads and seaweed in the mid shallows.
      const ridge = sampleField('ridged', x, y, 256);
      const reef = P.reef * sm(0.58, 0.74, ridge) * sm(6, 22, dd) * (1 - sm(shelf * 0.45, shelf * 0.85, dd)) * 0.85;
      if (reef > 0.02) {
        const hue = sampleField('fbm', x + 300, y, 128);
        const cr = hue < 0.4 ? [0.5, 0.42, 0.46] : hue < 0.6 ? [0.52, 0.5, 0.36] : [0.24, 0.44, 0.34];
        const sh = 0.75 + n2 * 0.5;
        r = r * (1 - reef) + cr[0] * sh * reef; g = g * (1 - reef) + cr[1] * sh * reef; b = b * (1 - reef) + cr[2] * sh * reef;
        a = Math.max(a, reef * 0.7);
      }
      const weed = sm(0.62, 0.74, n2) * sm(16, 30, dd) * (1 - sm(shelf * 0.4, shelf * 0.75, dd)) * 0.5;
      if (weed > 0.02) { r = r * (1 - weed) + 0.08 * weed; g = g * (1 - weed) + 0.24 * weed; b = b * (1 - weed) + 0.16 * weed; a = Math.max(a, weed * 0.55); }
      // Shoals: coral heads rising toward the surface, with breaking water round the shallowest.
      for (const s of shoals) {
        const q = Math.hypot(x - s.x, (y - s.y) * 1.2);
        if (q > s.r * 1.9) continue;
        const h = 1 - sm(s.r * 0.3, s.r * 1.6, q + (n - 0.5) * 18);
        if (h <= 0) continue;
        const cr = n2 < 0.5 ? [0.6, 0.48, 0.36] : [0.55, 0.36, 0.4];
        r = r * (1 - h) + cr[0] * h; g = g * (1 - h) + (cr[1] + 0.1) * h; b = b * (1 - h) + (cr[2] + 0.1) * h;
        a = Math.max(a, h * 0.8);
        const br = Math.max(0, 1 - Math.abs(q - s.r * 0.75 - n * 6) / 4) * 0.8 * sm(0.4, 0.6, n2);
        if (br > 0) { r = r * (1 - br) + 0.95 * br; g = g * (1 - br) + 0.97 * br; b = b * (1 - br) + 0.97 * br; a = Math.max(a, br); }
      }
      // Surf: two foam bands off the beach; a thin wash line against the quay wall.
      const surf = side < 0
        ? Math.max(0, 1 - Math.abs(dd - 5 - n * 9) / 4.5) * 0.85 + Math.max(0, 1 - Math.abs(dd - 22 - n * 16) / 3.5) * (0.3 + P.storm * 0.5)
        : Math.max(0, 1 - dd / 4) * 0.7 * (0.6 + 0.4 * n2);
      if (surf > 0.02) { r = r * (1 - surf) + 0.95 * surf; g = g * (1 - surf) + 0.97 * surf; b = b * (1 - surf) + 0.98 * surf; a = Math.max(a, surf * 0.92); }
      const o = (j * W + i) * 4;
      d[o] = Math.min(255, r * 255); d[o + 1] = Math.min(255, g * 255); d[o + 2] = Math.min(255, b * 255); d[o + 3] = Math.min(255, a * 255);
    }
  }
  cx2.putImageData(img, 0, 0);
  p.ctx.save();
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  p.ctx.imageSmoothingEnabled = true;
  p.ctx.imageSmoothingQuality = 'high';
  p.ctx.drawImage(cv, 0, 0, p.canvas.width, p.canvas.height);
  p.ctx.restore();
}

// ----------------------------------------------------------------- mesh

function mesh(mb, lay, S) {
  const P = S.P, y0 = lay.y0, y1 = lay.y1;
  // ---- Quay wall along the starboard waterline, tyre fenders, bollards.
  for (let y = y0; y < y1; y += 16) {
    const ya = y, yb = y + 16, xa = shoreX(1, ya), xb = shoreX(1, yb), cx = (xa + xb) / 2, rot = -Math.atan2(xb - xa, yb - ya);
    mb.box(cx + 1.5, (ya + yb) / 2, -5, 4, 16.6, 9.4, rot, { top: 'concrete', side: 'concrete_dark' });
  }
  for (let y = Math.ceil(y0 / 24) * 24; y < y1; y += 24) {
    const x = shoreX(1, y);
    mb.lathe(x - 1.4, y, [[1.8, -1.5], [1.8, 2.5]], 'metal_dark', { seg: 8, top: false });
    if (y % 48 === 0) mb.lathe(x + 4, y, [[1.4, 4.2], [1.2, 7], [1.9, 7.6]], 'steel_painted', { seg: 8 });
  }
  // ---- Pier with piles, patrol boat; jetty with posts and a trawler.
  if (lay.pier) {
    const pr = lay.pier, cx = (pr.root + pr.tip) / 2, w = pr.root - pr.tip + 4;
    mb.box(cx, pr.y, 2.2, w, 22, 2, 0, { top: 'concrete', side: 'concrete_dark' });
    for (let x = pr.tip + 4; x < pr.root; x += 12) for (const o of [-8, 8]) mb.lathe(x, pr.y + o, [[1.6, -5], [1.6, 2.2]], 'concrete_dark', { seg: 8, top: false });
    for (const o of [-10, 10]) mb.lathe(pr.tip + 3, pr.y + o, [[1.2, 4.2], [1, 6.4], [1.6, 7]], 'steel_painted', { seg: 8 });
  }
  if (lay.jetty) {
    const jt = lay.jetty, cx = (jt.root + jt.tip) / 2, w = jt.tip - jt.root + 4;
    mb.box(cx, jt.y, 1.2, w, 10, 1.2, 0, { top: 'timber', side: 'timber' });
    for (let x = jt.root + 4; x < jt.tip; x += 10) for (const o of [-4, 4]) mb.box(x, jt.y + o, -3, 1.6, 1.6, 6, 0, { top: 'timber', side: 'timber' });
  }
  for (const bt of lay.boats) meshShip(mb, bt.type, bt.x, bt.y, bt.rot, { burnt: bt.burnt });
  for (const sh of lay.quayShips) meshShip(mb, sh.type, sh.x, sh.y, sh.rot, { burnt: sh.burnt, lowered: sh.lowered });
  for (const w of lay.wrecks) meshShip(mb, w.type, w.x, w.y, w.rot, { burnt: true, lowered: true });
  // ---- Yard: cranes, containers, sheds.
  for (const cr of lay.cranes) meshCrane(mb, cr.x, cr.y, cr.h, cr.rot, { jib: 70, counter: 26, z: 4.2, trolley: 0.7, hook: 30 });
  for (const ct of lay.containers) for (let s = 0; s < ct.stack; s++) mb.box(ct.x, ct.y, 4.2 + s * 9, 9, 24, 9, ct.rot, { top: ct.mat, side: ct.mat });
  for (const b of lay.sheds) meshBuilding(mb, b, 4.2);
  for (const b of lay.huts) meshBuilding(mb, b, S.height(b.x, b.y));
  // ---- Installations.
  for (const it of lay.inst) meshInstallation(mb, it, S);
  // ---- Rocks.
  for (const b of lay.rocks) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, 'rock_dark', -2);
  void P; void y1;
}

function meshInstallation(mb, it, S) {
  const z = S.height(it.x, it.y), s = it.side, face = s > 0 ? Math.PI : 0; // toward the channel
  switch (it.kind) {
    case 'tank': {
      mb.lathe(it.x, it.y, [[it.r + 6, z - 1], [it.r + 6, z + 3], [it.r + 4.5, z + 3]], 'concrete', { seg: 20, top: false });           // bund wall
      mb.lathe(it.x, it.y, [[it.r, z], [it.r, z + 24], [it.r * 0.96, z + 25.5], [it.r * 0.5, z + 27.5], [0, z + 28]], 'steel_painted', { seg: 22, tint: [1.15, 1.15, 1.12] });
      mb.beam([it.x + it.r, it.y, z + 2], [it.x + it.r * 0.5, it.y + it.r * 0.8, z + 27], 1, 1, 'steel_yellow');                         // stair
      break;
    }
    case 'bunker': {
      mb.box(it.x, it.y, z - 2, 30, 24, 10, 0, { top: 'concrete_dark', side: 'concrete_dark' });
      mb.box(it.x, it.y, z + 8, 24, 19, 2.5, 0, { top: 'concrete_scorched', side: 'concrete_dark' });
      mb.box(it.x - s * 15.2, it.y, z + 3, 0.6, 14, 2.4, 0, { top: 'metal_dark', side: 'metal_dark' });                                   // firing slit
      break;
    }
    case 'radar': {
      mb.lathe(it.x, it.y, [[9, z], [3, z + 56]], 'lattice', { seg: 4, top: false });
      mb.box(it.x, it.y, z + 56, 10, 10, 4, 0, { top: 'roof_metal', side: 'steel_painted' });
      mb.box(it.x, it.y, z + 60, 22, 2, 7, 0.6, { top: 'metal_dark', side: 'metal_dark' });
      break;
    }
    case 'depot': {
      mb.box(it.x, it.y, z - 1, 56, 46, 18, 0, { top: 'roof_metal', side: 'facade_industrial' });
      mb.box(it.x - s * 28.4, it.y, z, 0.8, 20, 12, 0, { top: 'metal_dark', side: 'metal_dark' });
      break;
    }
    case 'battery': {
      mb.lathe(it.x, it.y, [[16, z - 1], [16, z + 3], [12, z + 4]], 'concrete', { seg: 16, top: false });
      mb.box(it.x, it.y, z, 10, 12, 6, face, { top: 'steel_painted', side: 'steel_painted' });
      const c = Math.cos(face), q = Math.sin(face);
      mb.beam([it.x, it.y, z + 4.5], [it.x + c * 30, it.y + q * 30, z + 7], 2.4, 2.4, 'metal_dark');
      break;
    }
    case 'lighthouse': {
      mb.lathe(it.x, it.y, [[8, z - 2], [5.6, z + 56], [7, z + 57], [7, z + 62], [3.6, z + 66], [0, z + 67]], 'concrete', { seg: 14, top: 'roof_metal' });
      for (let k = 0; k < 4; k++) mb.lathe(it.x, it.y, [[7.6 - k * 0.5, z + 8 + k * 12], [7.4 - k * 0.5, z + 13 + k * 12]], 'lane_red', { seg: 14, top: false });
      mb.box(it.x + 12, it.y, z, 14, 12, 8, 0, { top: 'roof_tar', side: 'facade_brick' });
      break;
    }
    default: break;
  }
}

export { XW, channelSlope };
