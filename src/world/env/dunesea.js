import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { scorch, debris, crate, drum, sandbags } from '../paint/props.js';
import { meshBoulder, meshHedgehog } from '../kit/terrain.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';
import { RAIL, PERIOD, railX, railSlope, wrapY } from './railLine.js';

// DUNE SEA: the desert battlefield the SANDBREAKER convoy runs through.
//
// The main line (world/env/railLine.js, shared with the train rig) runs up
// the middle of a cleared combat corridor: raised ballast bed with drifted
// sand, 3D sleepers, fastened rails and fishplates, a cable trough, signal
// posts and a line of telegraph poles with sagging wires. Beyond the
// corridor the ground rises into real dunes (heightfield relief), strewn
// with the wreckage of earlier convoys: an abandoned, half-buried branch
// line with derailed cars, container dumps, ruined depots, a water tower,
// fuel tanks, burnt-out armour and trucks, gun emplacements, shattered
// steel scaffolds, craters, scorch and oil, fires and smoke columns.
//
// Everything continuous across chunks (the lines, poles, sleepers) is a
// seeded function of y, so seams never show.
//
// PERIODIC WORLD: the whole arena repeats every PERIOD (= PER chunks) along
// y. The layer declares `period`, so ArenaWorld builds those PER chunks once
// and redraws them at offsets: the SANDBREAKER duel runs the field backward
// for minutes without a single chunk build mid-fight (a low-end CPU can't
// paint terrain as fast as the convoy covers it while the game renders).
// For that every y-dependence divides PERIOD: rail meander, sleeper / pole /
// signal spacing, index hashes, heightfield noise scales and painted pattern
// scales (powers of two), and neighbour layouts wrap across the seam.
//
// Params (0..1 unless noted): dunes, wrecks, depots, fires, craters, oil
// (derricks + burning spills), canyon (cliff walls), ruins (sandstone),
// salt (salt-flat surface), branch (bool: the abandoned line).

const LEN = 512;
const PER = PERIOD / LEN;
const TAU = Math.PI * 2;
const H = (x, y, s) => sampleField('fbm', x, y, s);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CLEAR = 116;          // nothing stands closer to the main line than this
const BRANCH = -214;        // abandoned line offset from the main line
const POLE = 256;           // telegraph pole spacing
const SIGNAL = 1024;        // signal post spacing
const pmod = (a, n) => ((a % n) + n) % n;
const SLEEPERS = PERIOD / RAIL.sleeperStep; // sleeper indices per period

export default {
  id: 'dunesea',
  label: 'Dune Sea convoy line',
  defaults: { dunes: 1, wrecks: 0.75, depots: 0.7, fires: 0.65, craters: 0.7, oil: 0, canyon: 0, ruins: 0, salt: 0, branch: true },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const height = (x, y) => {
      const d = Math.abs(x - railX(y));
      const bed = RAIL.bedZ * (1 - smooth(RAIL.bedHalf, RAIL.bedHalf + 12, d));
      const crest = Math.abs(Math.sin(x * 0.0026 + y * (3 * TAU / PERIOD) + H(x, y, 1024) * 5));
      const dunes = Math.max(0, (1 - crest) * 34 + (H(x, y, 2048) - 0.5) * 52 + 6) * P.dunes * (1 - P.salt * 0.75);
      const walls = P.canyon ? (Math.floor(smooth(300, 420, d) * 5) / 5 * 0.35 + smooth(300, 420, d) * 0.65) * 230 * P.canyon + (sampleField('ridged', x, y, 1024) - 0.5) * 50 * smooth(300, 420, d) * P.canyon : 0;
      return bed + dunes * smooth(150, 310, d) + walls;
    };
    // Pole m stands near y = m·POLE; its looks repeat every period.
    const poleAt = (side, m) => {
      const Rp = new RNG(`${seed}:pole:${side}:${pmod(m, PERIOD / POLE)}`), y = m * POLE + Rp.range(-8, 8);
      return { x: railX(y) + side * (124 + Rp.range(-4, 4)), y, lean: Rp.chance(0.18) ? Rp.range(-0.45, 0.45) : Rp.range(-0.05, 0.05), down: Rp.chance(0.1) };
    };
    const base = P.salt ? [0.88, 0.85, 0.79] : [0.8, 0.63, 0.41];
    const S = { P, seed, height, poleAt, base, dust: P.salt ? [0.86, 0.83, 0.77] : [0.8, 0.66, 0.46] };
    S.layers = [{
      id: 'ground', z: 0, x0: -440, x1: 440, length: LEN, ppu: 1.2, grid: [44, 24], height, flatLight: true, glow: P.fires > 0,
      period: PER,
      layout: (c) => periodicLayout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: 0 }];
    S.floorZ = 0;
    return S;
  },
};

// ----------------------------------------------------- periodic helpers

/**
 * Layout for chunk k of the periodic world: the content of chunk k mod PER,
 * shifted by whole periods (neighbour layouts across the seam must match the
 * chunk that is actually drawn there).
 */
function periodicLayout(c, S) {
  const km = pmod(c.k, PER);
  if (km === c.k) return layout(c, S);
  const dy = (c.k - km) * LEN;
  const lay = layout({ ...c, k: km, y0: c.y0 - dy, y1: c.y1 - dy, R: new RNG(`${S.seed}:ground:${km}`) }, S);
  for (const key of Object.keys(lay)) if (Array.isArray(lay[key])) lay[key] = lay[key].map((o) => (o && typeof o.y === 'number' ? { ...o, y: o.y + dy } : o));
  return lay;
}

/** Desert sand (wind ripples, drift patches): pattern scales divide PERIOD. */
function sandP(p, base) {
  p.allPath().fill(base);
  p.noise('large', 2048, 'soft-light', 0.55);
  p.noise('streak', 128, 'soft-light', 0.5, { sy: 0.5 });
  p.noise('streak', 64, 'overlay', 0.22, { sy: 0.5, ox: 17 });
  p.noise('grain', 128 / p.ppu, 'overlay', 0.35);
  p.patch('fbm_60', 512, shade(base, 0.82), 0.35);
  p.patch('fbm_70', 256, shade(base, 1.12, [1, 0.95, 0.85], 0.2), 0.3);
}

/** Ballast gravel (call clipped to the bed). */
function gravelP(p, base) {
  p.allPath().fill(base);
  p.noise('grain', 128 / p.ppu, 'overlay', 0.85);
  p.noise('grain', (128 / p.ppu) * 1.7, 'overlay', 0.5, { ox: 11 });
  p.noise('fbm', 256, 'soft-light', 0.5);
  p.patch('fbm_60', 512, shade(base, 0.7), 0.35);
}

// ------------------------------------------------------------- layout

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, Z = S.height;
  const lay = { craters: [], oil: [], wrecks: [], cars: [], containers: [], depots: [], towers: [], tanks: [], guns: [], scaffolds: [], rocks: [], derricks: [], ruins: [], dumps: [], hogs: [], anchors: [], debris: [] };
  // Flank position at distance d from the main line (side ±1), clear of it.
  const flank = (side, d0, d1, y) => {
    const yy = y ?? R.range(y0 + 20, y1 - 20), x = Math.max(-410, Math.min(410, railX(yy) + side * R.range(d0, d1)));
    return { x, y: yy, z: Z(x, yy) };
  };
  const nearBranch = (x, y) => P.branch && Math.abs(x - (railX(y) + BRANCH)) < 34;
  // Craters: shell holes everywhere but the bed; fewer near the line.
  for (let i = 0; i < 4 + 12 * P.craters; i++) {
    const y = R.range(y0, y1), side = R.sign(), d = R.range(96, 420), x = railX(y) + side * d;
    lay.craters.push({ x, y, r: R.range(8, d < 160 ? 16 : 28) * (R.chance(0.08) ? 1.6 : 1), seed: R.next() });
  }
  // Derailed / abandoned cars along the branch line.
  if (P.branch) for (let i = 0; i < 2; i++) if (R.chance(0.5 * P.wrecks + 0.15)) {
    const y = R.range(y0 + 50, y1 - 50), x = railX(y) + BRANCH + R.range(-26, 26);
    const kind = R.pick(['box', 'box', 'flat', 'tanker']);
    lay.cars.push({ x, y, z: Z(x, y), kind, rot: Math.atan(railSlope(y)) + R.range(-0.5, 0.5), burnt: R.chance(0.6), seed: R.next() });
    if (R.chance(P.fires)) lay.anchors.push({ type: 'fire', x: x + R.range(-6, 6), y: y + R.range(-20, 20), z: Z(x, y) + 14, s: R.range(0.9, 1.3) });
    else lay.anchors.push({ type: 'smoke', x, y, z: Z(x, y) + 14, s: R.range(1, 1.5), dark: 0.85 });
  }
  // Container dumps (stacked, some burnt open).
  for (let i = 0; i < 2 * P.depots; i++) if (R.chance(0.6)) {
    const side = R.chance(0.6) ? 1 : -1, f = flank(side, CLEAR + 30, 300);
    if (nearBranch(f.x, f.y)) continue;
    const rot = R.range(-0.5, 0.5) + (R.chance(0.3) ? Math.PI / 2 : 0), n = R.int(2, 5);
    for (let k = 0; k < n; k++) {
      const u = (k - n / 2) * 15 + R.range(-2, 2), cx = f.x + Math.cos(rot) * u, cy = f.y + Math.sin(rot) * u;
      lay.containers.push({ x: cx, y: cy, z: Z(cx, cy), rot: rot + R.range(-0.12, 0.12), col: R.pick([[0.62, 0.28, 0.16], [0.24, 0.36, 0.42], [0.66, 0.54, 0.3], [0.32, 0.38, 0.24], [0.5, 0.5, 0.48]]), stack: R.chance(0.35), burnt: R.chance(0.35) });
    }
  }
  // Ruined depot buildings (concrete shells) and the water tower / fuel tanks of the line.
  for (let i = 0; i < 1.5 * P.depots; i++) if (R.chance(0.55)) {
    const side = R.sign(), f = flank(side, CLEAR + 60, 330);
    if (nearBranch(f.x, f.y)) continue;
    lay.depots.push({ ...f, w: R.range(40, 70), d: R.range(34, 60), h: R.range(14, 26), rot: R.range(-0.3, 0.3), seed: R.next() });
    if (R.chance(P.fires * 0.7)) lay.anchors.push({ type: 'fire', x: f.x + R.range(-10, 10), y: f.y + R.range(-10, 10), z: f.z + 12, s: R.range(1, 1.4) });
    lay.anchors.push({ type: 'smoke', x: f.x, y: f.y, z: f.z + 20, s: R.range(1.4, 2.2), dark: R.range(0.8, 0.95) });
  }
  if (R.chance(0.35 * P.depots)) { const f = flank(R.sign(), CLEAR + 24, 170); lay.towers.push({ ...f, h: R.range(46, 58), r: R.range(11, 14), broken: R.chance(0.3) }); }
  for (let i = 0; i < 2; i++) if (R.chance(0.35 * P.depots)) { const f = flank(R.sign(), CLEAR + 50, 300); if (!nearBranch(f.x, f.y)) lay.tanks.push({ ...f, r: R.range(12, 18), h: R.range(16, 26), burnt: R.chance(0.5) }); }
  // Wrecked armour and trucks (burning or smoking), steel scaffolds blown apart.
  for (let i = 0; i < 2 + 4 * P.wrecks; i++) {
    if (!R.chance(0.65)) continue;
    const side = R.sign(), f = flank(side, CLEAR + 8, 360);
    const w = { ...f, kind: R.pick(['truck', 'truck', 'tank', 'halftrack', 'apc']), rot: R.angle(), burning: R.chance(P.fires), seed: R.next() };
    lay.wrecks.push(w);
    lay.anchors.push(w.burning ? { type: 'fire', x: w.x + R.range(-4, 4), y: w.y + R.range(-4, 4), z: w.z + 7, s: R.range(0.8, 1.25) } : { type: 'smoke', x: w.x, y: w.y, z: w.z + 6, s: R.range(1, 1.6), dark: 0.85 });
  }
  for (let i = 0; i < 1.5 * P.wrecks; i++) if (R.chance(0.5)) {
    const f = flank(R.sign(), CLEAR + 40, 320);
    lay.scaffolds.push({ ...f, w: R.range(20, 34), h: R.range(30, 54), rot: R.range(-0.6, 0.6), seed: R.next() });
    if (R.chance(P.fires)) lay.anchors.push({ type: 'fire', x: f.x, y: f.y, z: f.z + 6, s: R.range(0.9, 1.4) });
  }
  // Gun emplacements: sandbag ring + an abandoned field gun.
  for (let i = 0; i < 2; i++) if (R.chance(0.4)) { const f = flank(R.sign(), CLEAR + 30, 260); lay.guns.push({ ...f, r: R.range(16, 22), rot: R.angle(), seed: R.next() }); }
  // Supply dumps: crates and drums. Tank traps on the flanks.
  for (let i = 0; i < 2; i++) if (R.chance(0.55)) { const f = flank(R.sign(), CLEAR + 4, 260); lay.dumps.push({ ...f, seed: R.next() }); }
  if (R.chance(0.45)) { const side = R.sign(), f = flank(side, CLEAR + 20, 200); for (let k = 0; k < R.int(3, 6); k++) { const x = f.x + side * k * 22, y = f.y + R.range(-12, 12); lay.hogs.push({ x, y, z: Z(x, y), rot: R.angle() }); } }
  for (let i = 0; i < 5; i++) { const f = flank(R.sign(), 150, 500); lay.rocks.push({ ...f, r: R.range(7, 16), h: R.range(5, 13), seed: R.next() }); }
  // Oil field: derricks, pumpjacks, black spills (burning).
  for (let i = 0; i < 2 * P.oil; i++) if (R.chance(0.7)) {
    const f = flank(R.sign(), CLEAR + 80, 380), burning = R.chance(0.6);
    lay.derricks.push({ ...f, h: R.range(70, 110), rot: R.range(0, 1.5), burning });
    lay.oil.push({ x: f.x + R.range(-30, 30), y: f.y + R.range(-30, 30), r: R.range(26, 46) });
    lay.anchors.push({ type: 'beacon', x: f.x, y: f.y, z: f.z + 110, c: [1, 0.2, 0.1], period: 60 });
    if (burning) { lay.anchors.push({ type: 'fire', x: f.x, y: f.y, z: f.z + 4, s: R.range(1.4, 2) }); lay.anchors.push({ type: 'smoke', x: f.x, y: f.y, z: f.z + 40, s: 2.4, dark: 0.95 }); }
  }
  for (let i = 0; i < 3 * P.oil; i++) { const f = flank(R.sign(), 100, 300); lay.oil.push({ x: f.x, y: f.y, r: R.range(14, 30) }); if (R.chance(0.5)) lay.anchors.push({ type: 'fire', x: f.x, y: f.y, z: f.z + 1, s: R.range(0.8, 1.3) }); }
  // Sandstone ruins (oasis / old city).
  for (let i = 0; i < 4 * P.ruins; i++) if (R.chance(0.7)) { const f = flank(R.sign(), CLEAR + 30, 380); lay.ruins.push({ ...f, w: R.range(30, 70), d: R.range(24, 50), h: R.range(10, 34), rot: R.range(-0.4, 0.4), seed: R.next() }); }
  // Smoke columns drifting across, a few loose fires, dust devils.
  for (let i = 0; i < 2 + 3 * P.fires; i++) {
    const f = flank(R.sign(), 140, 460);
    lay.anchors.push(R.chance(0.3 * P.fires) ? { type: 'fire', x: f.x, y: f.y, z: f.z + 1, s: R.range(0.5, 0.9) } : { type: 'smoke', x: f.x, y: f.y, z: f.z + 2, s: R.range(1.2, 2.2), dark: R.range(0.7, 0.95) });
  }
  if (R.chance(0.5)) { const f = flank(R.sign(), 160, 420); lay.anchors.push({ type: 'dust', x: f.x, y: f.y, z: f.z + 8, s: 2 }); }
  for (let i = 0; i < 6; i++) { const f = flank(R.sign(), 100, 420); lay.debris.push({ x: f.x, y: f.y, r: R.range(12, 30) }); }
  // Signal posts on the line (red / amber lamps).
  for (let m = Math.ceil(y0 / SIGNAL); m * SIGNAL < y1; m++) {
    const y = m * SIGNAL + 120, x = railX(y) - 98;
    lay.anchors.push({ type: 'beacon', x, y, z: 42, c: (m & 1) ? [1, 0.25, 0.08] : [1, 0.65, 0.12], period: 90 });
  }
  lay.seed = R.next();
  return lay;
}

// -------------------------------------------------------------- paint

const linePath = (p, y0, y1, off, half) => () => {
  const c = p.ctx;
  c.beginPath();
  for (let y = y0 - 24; y <= y1 + 24; y += 12) c.lineTo(railX(y) + off - half, y);
  for (let y = y1 + 24; y >= y0 - 24; y -= 12) c.lineTo(railX(y) + off + half, y);
  c.closePath();
};

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P, base = S.base;
  const all = [lay, ...nb.filter(Boolean)];
  // Relief: lit dunes, darker hollows, wind-scoured crests; canyon strata.
  // (Called per sample in the build worker: no allocations.)
  const lo = shade(base, 0.86), hi = shade(base, 1.08, [1, 0.96, 0.86], 0.2), dk = shade(base, 0.74, [0.55, 0.4, 0.28], 0.25), cy = [0.6, 0.42, 0.3];
  const out = [0, 0, 0];
  paintHeightfield(p, S.height, (h, slope, x, y) => {
    const a = Math.min(1, h / 40), n = sampleField('fbm', x, y, 256) * 0.35;
    const st = P.canyon && h > 40 ? 0.55 : 0, band = st && (Math.floor(h / 26) % 2) ? 0.8 : 1;
    const sl = slope > 0.3 ? 1 - Math.min(1, (slope - 0.3) * 2) * 0.2 : 1;
    for (let k = 0; k < 3; k++) {
      const c = lo[k] + (hi[k] - lo[k]) * a;
      out[k] = ((c + (dk[k] - c) * n) * (1 - st) + cy[k] * st * band) * sl;
    }
    return out;
  }, { eps: 7, step: 3, shadows: { range: P.canyon ? 380 : 160, steps: P.canyon ? 10 : 6 } });
  if (!P.salt) p.layer(() => sandP(p, base), { op: 'soft-light', alpha: 0.75 });
  else {
    p.noise('grain', 128 / p.ppu, 'overlay', 0.4);
    const Rs = new RNG(`salt:${lay.seed}`);
    for (let i = 0; i < 60; i++) p.crack(Rs, Rs.range(-560, 560), Rs.range(y0, y1), Rs.angle(), Rs.range(30, 90), 0.8, [0.55, 0.52, 0.46], 0.55, 2);
  }
  p.noise('fbm', 256, 'soft-light', 0.3);
  // Darker, compacted service strip either side of the bed; spilled oil; scorch.
  p.patch('fbm_60', 256, shade(base, 0.72, [0.4, 0.3, 0.2], 0.3), 0.45, { path: linePath(p, y0, y1, 0, RAIL.bedHalf + 40) });
  for (const L of all) for (const o of L.oil) { p.radial(o.x, o.y, o.r * 1.4, [[0, [0.05, 0.04, 0.03], 0.9], [0.7, [0.08, 0.06, 0.04], 0.7], [1, [0.2, 0.15, 0.1], 0]]); p.radial(o.x - o.r * 0.2, o.y + o.r * 0.2, o.r * 0.5, [[0, [0.35, 0.3, 0.25], 0.3], [1, [0.2, 0.2, 0.2], 0]]); }
  // Abandoned branch line: faded ballast swallowed by sand.
  if (P.branch) {
    const path = linePath(p, y0, y1, BRANCH, 48);
    p.clip(path, () => gravelP(p, [0.48, 0.42, 0.34]));
    p.patch('fbm_50', 128, base, 0.75, { path });
    p.patch('fbm_70', 64, shade(base, 1.06), 0.5, { path });
  }
  // Main line ballast bed with sand drifting in between the sleepers.
  const bed = linePath(p, y0, y1, 0, RAIL.bedHalf + 2);
  p.clip(bed, () => gravelP(p, [0.44, 0.39, 0.32]));
  p.patch('fbm_60', 256, [0.3, 0.27, 0.23], 0.35, { path: bed });                   // oil-darkened centre
  p.patch('fbm_50', 128, shade(base, 0.96), 0.55, { path: bed });                   // drifted sand
  p.patch('fine_70', 64, shade(base, 1.04), 0.35, { path: bed });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let y = y0 - 24; y <= y1 + 24; y += 12) pts.push(railX(y) + s * (RAIL.bedHalf + 4), y);
    p.line(pts, 10, shade(base, 1.1), 0.55);                                         // sand banked on the shoulder
    p.line(pts, 3, [0.25, 0.2, 0.15], 0.35);
  }
  // Cable trough beside the line (concrete lids).
  { const pts = []; for (let y = y0 - 24; y <= y1 + 24; y += 12) pts.push(railX(y) + 100, y); p.line(pts, 7, [0.6, 0.58, 0.54], 0.9); p.line(pts, 6, [0.42, 0.4, 0.37], 0.6, { dash: [2, 22] }); }
  p.props(() => new RNG(`ds:${lay.seed}`), (Rp) => {
    // Sleeper and rail shadows (the sleepers and rails themselves are 3D).
    for (let k = Math.ceil((y0 - 10) / RAIL.sleeperStep); k * RAIL.sleeperStep < y1 + 10; k++) {
      const y = k * RAIL.sleeperStep, x = railX(y), rot = Math.atan2(-railSlope(y), 1);
      p.shadowBox(x, y, RAIL.sleeperHalf * 2, RAIL.sleeperW, RAIL.sleeperZ[1] - RAIL.bedZ, rot);
      const kk = pmod(k, SLEEPERS);
      if (P.branch && hashKeep(S.seed, kk, 0.7)) p.shadowBox(railX(y) + BRANCH, y, 76, 7, 2, rot + (hash(S.seed, kk * 7) - 0.5) * 0.4);
    }
    for (const s of [-1, 1]) {
      const pts = [];
      for (let y = y0 - 8; y <= y1 + 8; y += 16) pts.push(railX(y) + s * RAIL.half, y);
      for (let i = 0; i < pts.length - 2; i += 2) p.shadow([pts[i] - 2, pts[i + 1], pts[i] + 2, pts[i + 1], pts[i + 2] + 2, pts[i + 3], pts[i + 2] - 2, pts[i + 3]], RAIL.railZ[1] - RAIL.bedZ);
    }
    for (const L of all) for (const cr of L.craters) crater(p, new RNG(`dsc:${cr.seed}`), cr.x, cr.y, cr.r, base);
    for (const L of all) for (const w of L.wrecks) { scorch(p, new RNG(`dsw:${w.seed}`), w.x, w.y, w.kind === 'tank' ? 34 : 26); p.shadowBox(w.x, w.y, ...wreckSize(w.kind), w.rot); }
    for (const L of all) for (const k of L.cars) { if (k.burnt) scorch(p, new RNG(`dsk:${k.seed}`), k.x, k.y, 44); p.shadowBox(k.x, k.y, 26, 84, k.kind === 'flat' ? 9 : 24, k.rot); }
    for (const L of all) for (const k of L.containers) p.shadowBox(k.x, k.y, 12, 30, k.stack ? 24 : 12, k.rot);
    for (const L of all) for (const d of L.depots) { scorch(p, new RNG(`dsd:${d.seed}`), d.x, d.y, 50); p.shadowBox(d.x, d.y, d.w, d.d, d.h, d.rot); }
    for (const L of all) for (const t of L.towers) p.shadowCircle(t.x, t.y, t.r, t.h + t.r * 0.8, 0, 12);
    for (const L of all) for (const t of L.tanks) p.shadowCircle(t.x, t.y, t.r, t.h, 0, 12);
    for (const L of all) for (const s of L.scaffolds) { scorch(p, new RNG(`dss:${s.seed}`), s.x, s.y, 30); p.shadowBox(s.x, s.y, s.w, s.w, s.h, s.rot); }
    for (const L of all) for (const r of L.ruins) p.shadowBox(r.x, r.y, r.w, r.d, r.h, r.rot);
    for (const L of all) for (const d of L.derricks) p.shadowBox(d.x, d.y, 18, 18, d.h, d.rot);
    for (const L of all) for (const g of L.guns) {
      const ring = [];
      for (let a = 0; a <= 5.4; a += 0.35) ring.push(g.x + Math.cos(a + g.rot) * g.r, g.y + Math.sin(a + g.rot) * g.r);
      sandbags(p, ring, { color: [0.72, 0.64, 0.48] });
      p.shadowBox(g.x, g.y, 8, 20, 7, g.rot);
    }
    for (const L of all) for (const h of L.hogs) p.shadowBox(h.x, h.y, 10, 10, 8, h.rot);
    for (const L of all) for (const r of L.rocks) p.shadowCircle(r.x, r.y, r.r * 0.85, r.h, 0, 8);
    for (const L of all) for (const d of L.dumps) {
      const Rd = new RNG(`dsdump:${d.seed}`);
      for (let k = 0; k < 6; k++) crate(p, Rd, d.x + Rd.range(-14, 14), d.y + Rd.range(-12, 12), Rd.range(5, 8), Rd.range(-0.4, 0.4), { color: [0.5, 0.38, 0.22] });
      for (let k = 0; k < 5; k++) drum(p, d.x + Rd.range(-18, 18), d.y + Rd.range(-16, 16), { color: Rd.pick([[0.34, 0.36, 0.24], [0.5, 0.22, 0.12], [0.24, 0.28, 0.3]]) });
    }
    // Telegraph pole shadows (poles and wires are 3D).
    for (let m = Math.floor((y0 - 200) / POLE); m <= Math.ceil((y1 + 200) / POLE); m++) {
      const q = S.poleAt(1, m);
      if (!q.down) { p.shadowCircle(q.x, q.y, 1.4, 58, 0, 6); p.shadow([q.x - 10, q.y - 0.6, q.x + 10, q.y - 0.6, q.x + 10, q.y + 0.6, q.x - 10, q.y + 0.6], 55, 53); }
    }
    for (const L of all) for (const d of L.debris) debris(p, Rp, d.x, d.y, d.r, 24, { color: [0.36, 0.3, 0.24] });
    // Spent shell casings and scrap glinting in the sand.
    for (let i = 0; i < 50; i++) p.at(Rp.range(-500, 500), Rp.range(y0, y1), Rp.angle(), (cx) => { cx.fillStyle = Rp.chance(0.6) ? 'rgba(210,170,80,0.9)' : 'rgba(60,55,50,0.8)'; cx.fillRect(-1, -0.4, 2, 0.8); });
  }, 0.55, 2.4);
  // Fires light the sand around them.
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 64 * a.s, [[0, [1, 0.5, 0.15], 0.55], [1, [1, 0.3, 0.05], 0]], 'lighter');
}

/** Shell crater in sand: blown-out ejecta, sunlit rim, dark scorched bowl. */
function crater(p, R, x, y, r, base) {
  const s = p.sun;
  p.radial(x, y, r * 2.4, [[0, [0.3, 0.22, 0.16], 0.55], [0.55, shade(base, 0.7), 0.35], [1, base, 0]]);
  for (let i = 0; i < 24; i++) {
    const a = R.angle(), d = r * R.range(1.1, 2.4), rr = R.range(0.6, 2.4) * (1.6 - d / (r * 2.4));
    p.circlePath(x + Math.cos(a) * d, y + Math.sin(a) * d, rr).fill(R.chance(0.4) ? shade(base, 1.1) : [0.28, 0.22, 0.17], 0.85);
  }
  p.circlePath(x, y, r * 1.22).fill(shade(base, 0.8), 0.95);
  p.ctx.save(); p.circlePath(x, y, r * 1.22); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.3, y - s.dy * r * 0.3, r * 1.15).fill(shade(base, 1.08), 0.9);
  p.ctx.restore();
  p.circlePath(x, y, r).fill([0.26, 0.2, 0.15]);
  p.radial(x, y, r, [[0, [0.1, 0.07, 0.05], 1], [0.7, [0.2, 0.15, 0.11], 0.6], [1, [0.3, 0.23, 0.17], 0]]);
  p.ctx.save(); p.circlePath(x, y, r); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.55, y - s.dy * r * 0.55, r * 0.95).fill([0, 0, 0], 0.35);
  p.radial(x + s.dx * r * 0.5, y + s.dy * r * 0.5, r * 0.5, [[0, shade(base, 0.9), 0.45], [1, base, 0]]);
  p.ctx.restore();
}

function wreckSize(kind) { return kind === 'tank' ? [24, 40, 11] : kind === 'halftrack' ? [12, 28, 9] : kind === 'apc' ? [16, 30, 11] : [12, 30, 11]; }

// Deterministic per-index hashes (sleepers, rail segments: continuous across chunks).
function hash(seed, k) { let h = 2166136261 ^ k; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
function hashKeep(seed, k, p) { return hash(seed, k) < p; }

// --------------------------------------------------------------- mesh

function mesh(mb, lay, S) {
  const P = S.P, Z = S.height, y0 = lay.y0, y1 = lay.y1;
  // ---- Main line: sleepers, fasteners, rails, fishplates.
  const sz = RAIL.sleeperZ, rz = RAIL.railZ;
  for (let k = Math.ceil(y0 / RAIL.sleeperStep); k * RAIL.sleeperStep < y1; k++) {
    const y = k * RAIL.sleeperStep, x = railX(y), rot = Math.atan2(-railSlope(y), 1), hk = hash(S.seed, pmod(k, SLEEPERS));
    // A few cracked / sunk sleepers; concrete ones replace timber here and there.
    const sunk = hk < 0.06 ? 1.6 : 0, conc = hk > 0.82;
    mb.box(x, y, sz[0] - sunk, RAIL.sleeperHalf * 2 - (hk < 0.03 ? 30 : 0), RAIL.sleeperW, sz[1] - sz[0], rot, conc ? { top: 'concrete', side: 'concrete_dark' } : { top: 'timber', side: 'timber', tint: [0.72, 0.62, 0.52] });
    for (const s of [-1, 1]) for (const o of [-4.6, 4.6]) {
      const px = x + Math.cos(rot) * (s * RAIL.half + o), py = y + Math.sin(rot) * (s * RAIL.half + o);
      mb.box(px, py, sz[1], 3, 5, 1.6, rot, { top: 'metal_dark', side: 'metal_dark' });
    }
  }
  const seg = 16;
  for (let y = Math.floor(y0 / seg) * seg; y < y1; y += seg) {
    for (const s of [-1, 1]) {
      const a = [railX(y) + s * RAIL.half, y], b = [railX(y + seg) + s * RAIL.half, y + seg];
      mb.beam([a[0], a[1], rz[0] + 0.7], [b[0], b[1], rz[0] + 0.7], 8, 1.4, 'metal_dark', { tint: [0.7, 0.64, 0.58] });   // foot
      mb.beam([a[0], a[1], rz[0] + 3], [b[0], b[1], rz[0] + 3], 2.6, 4.2, 'metal_dark', { tint: [0.62, 0.52, 0.44] });   // web (rust brown)
      mb.beam([a[0], a[1], rz[1] - 1.1], [b[0], b[1], rz[1] - 1.1], 5, 2.2, 'metal_dark', { tint: [2.3, 2.2, 2.05] });  // polished head
    }
    if (y % RAIL.joint === 0) for (const s of [-1, 1]) for (const o of [-3, 3]) { const x = railX(y) + s * RAIL.half + o; mb.box(x, y, rz[0] + 1.5, 1.6, 12, 4, 0, { top: 'metal_dark', side: 'metal_dark' }); }
  }
  // Cable trough lids.
  for (let y = Math.ceil(y0 / 24) * 24; y < y1; y += 24) mb.box(railX(y) + 100, y, Z(railX(y) + 100, y) - 1, 7, 22, 2.4, Math.atan2(-railSlope(y), 1) - Math.PI / 2 + Math.PI / 2, { top: 'concrete', side: 'concrete_dark' });
  // Signal posts.
  for (let m = Math.ceil(y0 / SIGNAL); m * SIGNAL < y1; m++) {
    const y = m * SIGNAL + 120, x = railX(y) - 98;
    mb.beam([x, y, 0], [x, y, 44], 2.4, 2.4, 'steel_painted', { tint: [0.6, 0.55, 0.5] });
    mb.box(x, y + 1, 36, 8, 4, 12, 0, { top: 'metal_dark', side: 'metal_dark' });
    mb.box(x + 3, y, 0, 8, 8, 6, 0, { top: 'concrete', side: 'concrete_dark' });
  }
  // ---- Telegraph poles with crossarms and sagging wires (continuous).
  for (let m = Math.ceil(y0 / POLE); m * POLE < y1; m++) {
    const q = S.poleAt(1, m), nx = S.poleAt(1, m + 1);
    if (q.down) { mb.beam([q.x, q.y, 1.4], [q.x + 54 * Math.cos(q.lean + 0.4), q.y + 54 * Math.sin(q.lean + 0.4), 1.4], 2.4, 2.4, 'timber'); continue; }
    const top = [q.x + Math.sin(q.lean) * 56, q.y, 56 * Math.cos(q.lean)];
    mb.beam([q.x, q.y, 0], top, 2.4, 2.4, 'timber');
    mb.beam([top[0] - 10, top[1], top[2] - 3], [top[0] + 10, top[1], top[2] - 3], 1.4, 1.4, 'timber');
    if (nx.down) continue;
    const nt = [nx.x + Math.sin(nx.lean) * 56, nx.y, 56 * Math.cos(nx.lean)];
    for (const o of [-9, 9]) {
      const a = [top[0] + o, top[1], top[2] - 2.6], b = [nt[0] + o, nt[1], nt[2] - 2.6], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 7];
      mb.beam(a, mid, 0.45, 0.45, 'metal_dark');
      mb.beam(mid, b, 0.45, 0.45, 'metal_dark');
    }
  }
  // ---- Abandoned branch: rusted, half-buried, sleepers and rails missing in places.
  if (P.branch) {
    for (let k = Math.ceil(y0 / RAIL.sleeperStep); k * RAIL.sleeperStep < y1; k++) {
      if (!hashKeep(S.seed, pmod(k, SLEEPERS), 0.7)) continue;
      const y = k * RAIL.sleeperStep, x = railX(y) + BRANCH, rot = Math.atan2(-railSlope(y), 1) + (hash(S.seed, pmod(k, SLEEPERS) * 7) - 0.5) * 0.4;
      const z = Z(x, y);
      mb.box(x, y, z - 1.5, 76, 7, 2.6, rot, { top: 'timber', side: 'timber', tint: [0.55, 0.47, 0.4] });
    }
    for (let y = Math.floor(y0 / 32) * 32; y < y1; y += 32) {
      for (const s of [-1, 1]) {
        if (hash(S.seed, (wrapY(y) / 32) * 13 + s * 5) < 0.22) continue; // missing / torn-up segment
        const ax = railX(y) + BRANCH + s * 27, bx = railX(y + 32) + BRANCH + s * 27;
        const bend = hash(S.seed, wrapY(y) + s) < 0.12 ? 6 : 0;
        mb.beam([ax, y, Z(ax, y) + 1.4], [bx + bend, y + 32, Z(bx, y + 32) + 1.4 + bend * 0.4], 3, 3, 'rust');
      }
    }
  }
  // ---- Wreckage, depots and the rest of the battlefield.
  for (const k of lay.cars) meshCar(mb, k);
  for (const w of lay.wrecks) meshWreck(mb, w);
  for (const k of lay.containers) {
    const t = k.burnt ? [0.35, 0.28, 0.24] : k.col.map((v) => v * 2.2);
    mb.box(k.x, k.y, k.z - 1, 12, 30, 12, k.rot, { top: k.burnt ? 'roof_burnt' : 'steel_painted', side: k.burnt ? 'rust' : 'steel_painted', tint: t });
    if (k.stack) mb.box(k.x + 1, k.y, k.z + 11, 12, 30, 12, k.rot + 0.05, { top: 'steel_painted', side: 'steel_painted', tint: t.map((v) => v * 0.9) });
  }
  for (const d of lay.depots) {
    const R = new RNG(`dsdm:${d.seed}`), c = Math.cos(d.rot), s = Math.sin(d.rot);
    const at = (u, v) => [d.x + u * c - v * s, d.y + u * s + v * c];
    // Shell of broken concrete walls (varying heights, a breach), rubble inside.
    const walls = [[-d.w / 2, 0, 3, d.d], [d.w / 2, 0, 3, d.d], [0, -d.d / 2, d.w, 3], [0, d.d / 2, d.w, 3]];
    for (const [u, v, ww, dd] of walls) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        if (R.chance(0.2)) continue;
        const t = (i + 0.5) / n - 0.5, [x, y] = at(u + (ww > 3 ? t * ww : 0), v + (dd > 3 ? t * dd : 0));
        mb.box(x, y, d.z - 2, ww > 3 ? ww / n + 0.5 : 3, dd > 3 ? dd / n + 0.5 : 3, d.h * R.range(0.35, 1), d.rot, { top: 'concrete_scorched', side: R.chance(0.5) ? 'concrete' : 'concrete_scorched' });
      }
    }
    for (let k = 0; k < 5; k++) { const [x, y] = at(R.range(-d.w / 3, d.w / 3), R.range(-d.d / 3, d.d / 3)); mb.box(x, y, d.z - 1, R.range(5, 10), R.range(4, 9), R.range(2, 5), R.angle(), { top: 'concrete_scorched', side: 'concrete_dark' }); }
  }
  for (const t of lay.towers) {
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mb.beam([t.x + u * t.r * 0.8, t.y + v * t.r * 0.8, t.z - 1], [t.x + u * t.r * 0.5, t.y + v * t.r * 0.5, t.z + t.h], 1.8, 1.8, 'steel_painted', { tint: [0.6, 0.52, 0.42] });
    if (!t.broken) mb.lathe(t.x, t.y, [[t.r, t.z + t.h], [t.r, t.z + t.h + t.r * 1.2], [t.r * 0.7, t.z + t.h + t.r * 1.5]], 'rust', { seg: 14 });
    else mb.lathe(t.x + 4, t.y + 6, [[t.r, t.z], [t.r * 0.9, t.z + t.r * 0.8]], 'rust', { seg: 12 });
  }
  for (const t of lay.tanks) mb.lathe(t.x, t.y, [[t.r, t.z - 1], [t.r, t.z + t.h], [t.r * 0.8, t.z + t.h + 3]], t.burnt ? 'roof_burnt' : 'steel_painted', { seg: 16, tint: t.burnt ? null : [2.1, 2.0, 1.85] });
  for (const s of lay.scaffolds) meshScaffold(mb, s);
  for (const g of lay.guns) {
    const c = Math.cos(g.rot), s = Math.sin(g.rot);
    mb.box(g.x, g.y, g.z, 8, 12, 5, g.rot, { top: 'metal_dark', side: 'metal_dark' });
    mb.beam([g.x, g.y, g.z + 5], [g.x - s * 22, g.y + c * 22, g.z + 9], 2.2, 2.2, 'metal_dark');
    for (let a = 0; a < 5.4; a += 0.9) mb.box(g.x + Math.cos(a + g.rot) * g.r, g.y + Math.sin(a + g.rot) * g.r, g.z - 1, 9, 5, 4.5, a + g.rot + Math.PI / 2, { top: 'hesco', side: 'hesco' });
  }
  for (const d of lay.dumps) {
    const R = new RNG(`dsdump:${d.seed}`);
    for (let k = 0; k < 6; k++) { const s = R.range(5, 8); mb.box(d.x + R.range(-14, 14), d.y + R.range(-12, 12), d.z - 0.5, s, s, s * 0.8, R.range(-0.4, 0.4), { top: 'timber', side: 'timber' }); }
  }
  for (const h of lay.hogs) meshHedgehog(mb, h.x, h.y, 1.1, h.rot);
  for (const r of lay.rocks) meshBoulder(mb, r.x, r.y, r.r, r.h, r.seed, 'rock_sand', r.z - 2);
  for (const d of lay.derricks) meshDerrick(mb, d);
  for (const r of lay.ruins) {
    const R = new RNG(`dsr:${r.seed}`), c = Math.cos(r.rot), s = Math.sin(r.rot);
    for (let k = 0; k < 6; k++) {
      const u = R.range(-r.w / 2, r.w / 2), v = R.range(-r.d / 2, r.d / 2), x = r.x + u * c - v * s, y = r.y + u * s + v * c;
      if (R.chance(0.35)) mb.lathe(x, y, [[3.4, r.z - 2], [3, r.z + r.h * R.range(0.4, 1)]], 'sandstone', { seg: 8 });
      else mb.box(x, y, r.z - 2, R.range(8, 22), 4, r.h * R.range(0.3, 0.9), r.rot + (R.chance(0.5) ? Math.PI / 2 : 0), { top: 'sandstone', side: 'sandstone' });
    }
  }
}

/** Derailed railway cars on the abandoned branch. */
function meshCar(mb, k) {
  const c = Math.cos(k.rot), s = Math.sin(k.rot);
  const at = (u, v) => [k.x + u * c - v * s, k.y + u * s + v * c];
  const side = k.burnt ? 'rust' : 'steel_painted', top = k.burnt ? 'roof_burnt' : 'steel_painted', tint = k.burnt ? null : [1.9, 1.5, 1.1];
  mb.box(k.x, k.y, k.z, 24, 82, 6, k.rot, { top: 'metal_dark', side: 'metal_dark' });
  if (k.kind === 'box') mb.box(k.x, k.y, k.z + 6, 23, 78, 17, k.rot, { top, side, tint });
  else if (k.kind === 'tanker') { const [a0, a1] = [at(0, -36), at(0, 36)]; mb.beam([a0[0], a0[1], k.z + 14], [a1[0], a1[1], k.z + 14], 18, 16, side, { tint }); }
  else for (let n = 0; n < 4; n++) { const [x, y] = at(0, -27 + n * 18); mb.box(x, y, k.z + 6, 10, 10, 8, k.rot + n * 0.2, { top: 'timber', side: 'timber' }); }
  for (const v of [-30, 30]) { const [x, y] = at(0, v); mb.box(x, y, k.z - 3, 26, 14, 4, k.rot, { top: 'rust', side: 'rust' }); }
}

/** Burnt-out vehicles as solids (blackened hulls, rust, sand drifted over). */
function meshWreck(mb, w) {
  const R = new RNG(`dsv:${w.seed}`), c = Math.cos(w.rot), s = Math.sin(w.rot);
  const at = (u, v) => [w.x + u * c - v * s, w.y + u * s + v * c];
  const box = (u, v, z, bw, bl, bh, mat, top = mat, dr = 0) => { const [x, y] = at(u, v); mb.box(x, y, w.z - 1 + z, bw, bl, bh, w.rot + dr, { top, side: mat }); };
  switch (w.kind) {
    case 'truck':
      box(0, 9, 0.8, 11, 10, 9, 'metal_dark', 'roof_burnt');
      box(0, -6, 2, 12, 20, 2.5, 'rust');
      if (R.chance(0.6)) box(0, -6, 4.5, 11, 18, 5, 'tarp_canvas', 'tarp_canvas');
      else for (let k = 0; k < 3; k++) box(R.range(-3, 3), -6 + R.range(-6, 6), 4.5, 4.5, 4.5, 4, 'timber', 'timber', R.range(-0.5, 0.5));
      break;
    case 'halftrack':
      box(0, 0, 1, 12, 28, 6, 'metal_dark', 'roof_burnt');
      box(0, 9, 7, 10, 8, 3, 'rust');
      break;
    case 'apc':
      box(0, 0, 1, 16, 30, 9, 'rust', 'roof_burnt');
      box(0, -4, 10, 8, 8, 3, 'metal_dark');
      break;
    default: { // tank
      box(0, 0, 1, 22, 38, 7, 'metal_dark', 'roof_burnt');
      const tr = R.range(-1.2, 1.2), [tx, ty] = at(R.range(-2, 2), -2);
      mb.box(tx, ty, w.z + 7, 13, 15, 5, w.rot + tr, { top: 'rust', side: 'metal_dark' });
      const ga = w.rot + tr + Math.PI / 2 + R.range(-0.2, 0.2);
      mb.beam([tx, ty, w.z + 9.5], [tx + Math.cos(ga) * 24, ty + Math.sin(ga) * 24, w.z + (R.chance(0.4) ? 3 : 9.5)], 1.8, 1.8, 'metal_dark');
    }
  }
}

/** Steel scaffold / gantry tower blown apart: bent legs, fallen braces. */
function meshScaffold(mb, sc) {
  const R = new RNG(`dssc:${sc.seed}`), c = Math.cos(sc.rot), s = Math.sin(sc.rot), hw = sc.w / 2;
  const at = (u, v, z) => [sc.x + u * c - v * s, sc.y + u * s + v * c, sc.z + z];
  const legs = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
  const tops = legs.map(([u, v]) => { const hh = sc.h * R.range(0.45, 1); return at(u + R.range(-5, 5), v + R.range(-5, 5), hh); });
  legs.forEach(([u, v], i) => mb.beam(at(u, v, -1), tops[i], 2, 2, 'rust'));
  for (let i = 0; i < 4; i++) {
    const a = tops[i], b = tops[(i + 1) % 4];
    if (R.chance(0.7)) mb.beam(a, b, 1.4, 1.4, 'metal_dark');
    const [u0, v0] = legs[i], [u1, v1] = legs[(i + 1) % 4];
    if (R.chance(0.6)) mb.beam(at(u0, v0, 2), [b[0], b[1], b[2] * 0.5], 1.1, 1.1, 'rust');
    if (R.chance(0.5)) mb.beam(at(u1 * 1.4, v1 * 1.4, 0.4), at(u0 * 0.6, v0 * 1.6, 0.4), 1.2, 1.2, 'metal_dark');
  }
  mb.box(sc.x, sc.y, sc.z - 0.5, sc.w * 0.8, sc.w * 0.6, 1.4, sc.rot + 0.3, { top: 'grating', side: 'metal_dark' });
}

/** Oil derrick: tapering lattice tower. */
function meshDerrick(mb, d) {
  const c = Math.cos(d.rot), s = Math.sin(d.rot), b = 10, t = 3;
  const P = (u, v, z) => [d.x + u * c - v * s, d.y + u * s + v * c, d.z + z];
  const cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [u, v] of cor) mb.beam(P(u * b, v * b, -1), P(u * t, v * t, d.h), 1.6, 1.6, 'steel_yellow');
  for (let k = 1; k < 6; k++) {
    const z = (k / 6) * d.h, w = b + (t - b) * (k / 6);
    for (let i = 0; i < 4; i++) { const [u0, v0] = cor[i], [u1, v1] = cor[(i + 1) % 4]; mb.beam(P(u0 * w, v0 * w, z), P(u1 * w, v1 * w, z), 0.9, 0.9, 'steel_yellow'); }
  }
  mb.box(d.x, d.y, d.z - 1, 26, 26, 3, d.rot, { top: 'concrete_scorched', side: 'concrete_dark' });
  if (d.burning) mb.box(d.x, d.y, d.z + 2, 8, 8, 6, d.rot, { top: 'roof_burnt', side: 'rust' });
}

export { BRANCH, CLEAR, TAU };
