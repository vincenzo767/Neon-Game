import { shade } from '../paint/core.js';
import { scorch, debris, crater, skid, rubble, manhole, car, bus, truck, tank, puddle, crate, drum } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding, buildingAnchors, meshBillboard } from '../kit/city.js';
import { meshVehicle, WRECK } from './downtown.js';
import { RNG } from '../../core/RNG.js';
import { PERIOD, CHUNK, NCH, ROAD, siteAt, laneLines } from './overpassMap.js';

// BURNING OVERPASS: the devastated urban highway where COLOSSUS CRAWLER is
// fought (level 5 of the ground campaign, all five of its phase arenas).
//
// The map (world/env/overpassMap.js, shared with the boss rig) is a straight
// sixteen-lane highway: worn, cracked and cratered asphalt, broken lane lines,
// a painted median, curbs and sidewalks. Burnt-out traffic is painted on the
// carriageways (the crawler's feet walk over it); 3D wrecks, lamps, barriers
// and poles stand on the shoulders and sidewalks. Burning, gutted and
// collapsed towers line both sides, with a skyline of taller towers behind.
//
// CLIMB SITES (one per chunk, alternating sides) are the structures the
// crawler can actually scale and leap between: multi-storey car parks, the
// stubs of a collapsed elevated highway on piers (a solid abutment wall at
// the broken end, the fallen middle span lying across the road as rubble),
// and office podiums with their towers set back. Their roofs are kept clear
// (hazard-striped edges, red beacons on the corners) so the machine has a
// pad to stand on. Fires, smoke columns, sparks and embers everywhere.
//
// PERIODIC: the layer repeats every PERIOD (NCH chunks), built once.
//
// Params (0..1): fires, damage, collapse, traffic, military, lamps, smoke, night (bool).

const LEN = CHUNK;
const XW = 860;                 // layer half-width (the camera pans toward the sites)
const LAMP = 128;               // street-lamp spacing (divides PERIOD)
const DASH = 64, DASH_ON = 26;
const FAR = ROAD.face + 380;    // the back row of towers starts here
const pmod = (a, n) => ((a % n) + n) % n;
const TAU = Math.PI * 2;

function hash(seed, k) { let h = 2166136261 ^ k; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }

export default {
  id: 'overpass',
  label: 'Burning Overpass highway (periodic, climbable structures)',
  defaults: { fires: 0.75, damage: 0.75, collapse: 0.4, traffic: 0.75, military: 0.45, lamps: 0.35, smoke: 0.75, night: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || 'overpass'; // one city for every phase arena: only params / light differ
    const S = { P, seed, dust: [0.42, 0.39, 0.36] };
    S.layers = [{
      id: 'ground', z: 0, x0: -XW, x1: XW, length: LEN, ppu: 0.85, glow: true, period: NCH,
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

function periodicLayout(c, S) {
  const km = pmod(c.k, NCH);
  if (km === c.k) return layout(c, S);
  const dy = (c.k - km) * LEN;
  const lay = layout({ ...c, k: km, y0: c.y0 - dy, y1: c.y1 - dy, R: new RNG(`${S.seed}:ground:${km}`) }, S);
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
  for (const k of ['y', 'y0', 'y1', 'ya', 'yb']) if (typeof n[k] === 'number') n[k] += dy;
  if (Array.isArray(n.pts)) n.pts = n.pts.map((v, i) => (i & 1 ? v + dy : v));
  return n;
}

// ------------------------------------------------------------- layout

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, k = c.k, seed = S.seed;
  const lay = {
    k, y0, y1, site: null, buildings: [], lamps: [], wrecks: [], painted: [], anchors: [], rubble: [], craters: [], debris: [],
    oil: [], glass: [], skids: [], potholes: [], barriers: [], poles: [], stub: null, fallen: [], burning: [],
  };
  const own = (y) => y >= y0 && y < y1;

  // ---- The climb site of this chunk (a plain copy: periodic shifting only touches y fields).
  const st = siteAt(k);
  const Rs = new RNG(`${seed}:site:${pmod(k, NCH)}`);
  lay.site = { kind: st.kind, top: st.top, side: st.side, y: st.y, y0: st.y0, y1: st.y1, x0: st.x0, x1: st.x1, seed: Rs.next(), tower: Rs.range(200, 300) };
  // Rooftop beacons on the pad corners (they mark the structure as reachable).
  for (const sy of [-1, 1]) for (const ax of [st.x0 + 10, st.x1 - 10]) lay.anchors.push({ type: 'beacon', x: st.side * ax, y: st.y + sy * (st.hd - 10), z: st.top + 6, c: [1, 0.1, 0.05], period: 64 + Rs.int(0, 20) });
  // A collapsed elevated highway: the deck site keeps its stub, the opposite side a shorter stub,
  // the fallen middle span lies across the road as rubble.
  if (st.kind === 'deck') {
    lay.stub = { side: -st.side, y: st.y, top: st.top - 6, reach: Rs.range(40, 90), seed: Rs.next() };
    for (let i = 0; i < 9; i++) lay.fallen.push({ x: Rs.range(-180, 180), y: st.y + Rs.range(-70, 70), r: Rs.range(16, 34), seed: Rs.next() });
    lay.anchors.push({ type: 'smoke', x: Rs.range(-80, 80), y: st.y, z: 6, s: 1.6, dark: 0.8 });
    lay.anchors.push({ type: 'fire', x: -st.side * Rs.range(150, 190), y: st.y + Rs.range(-50, 50), z: 6, s: 1.6 });
  }

  // ---- Blocks either side: a front row facing the highway and taller towers behind.
  for (const s of [-1, 1]) {
    const spans = s === st.side ? [[y0 + 4, st.y0 - 10], [st.y1 + 10, y1 - 4]] : [[y0 + 4, y1 - 4]];
    for (const [a, b] of spans) {
      for (const col of [0, 1]) {
        const Rb = new RNG(`${seed}:blk:${pmod(k, NCH)}:${s}:${col}:${a - y0}`);
        let y = a;
        while (y < b - 24) {
          const dep = Math.min(b - y, Rb.range(col ? 120 : 70, col ? 230 : 160));
          if (dep < 30) break;
          const cy = y + dep / 2, w = col ? Rb.range(150, 260) : Rb.range(110, 170);
          const front = col ? FAR + Rb.range(0, 30) : ROAD.face + Rb.range(0, 6);
          const xc = s * (front + w / 2);
          // Next to a climb site the near row stays low: it must not hide the machine on the roof.
          const nearSite = s === st.side && !col;
          const lw = w - 8, ld = dep - 10;
          if (Rb.chance(col ? 0.92 : 0.82) && own(cy)) {
            const bd = planBuilding(Rb, xc, cy, lw, ld, {
              hMin: col ? 140 : 50, hMax: col ? 340 : nearSite ? 120 : 220,
              burnt: P.fires * (col ? 0.45 : 0.6), collapse: P.collapse * (col ? 0.3 : 0.55),
              night: P.night, styles: col ? ['office', 'glass', 'concrete', 'office'] : ['concrete', 'office', 'brick', 'industrial', 'glass'],
            });
            lay.buildings.push(bd);
            buildingAnchors(Rb, bd, lay.anchors, { fireScale: 1.1, smoke: 0.55 * P.smoke });
            // Burning floors facing the highway (window fires along the facade).
            if (bd.burnt && !bd.collapse && !col) {
              const n = Rb.int(1, 3);
              for (let q = 0; q < n; q++) lay.anchors.push({ type: 'fire', x: s * (front - 2), y: cy + Rb.range(-0.35, 0.35) * ld, z: Rb.range(14, bd.h * 0.8), s: Rb.range(0.9, 1.5) });
            }
            if (bd.collapse) lay.rubble.push({ x: xc - s * lw * 0.3, y: cy, r: Math.min(lw, ld) * 0.5, seed: Rb.next(), big: true });
            if (!col && !bd.collapse && !bd.burnt && bd.h < 120 && Rb.chance(0.25)) bd.bill = { x: xc - s * lw * 0.3, face: -s, mat: `billboard_${Rb.int(0, 3)}` };
          } else if (own(cy)) {
            // Empty lot: rubble field, a fire, smoke.
            lay.rubble.push({ x: xc, y: cy, r: Math.min(lw, ld) * 0.5, seed: Rb.next(), big: true });
            if (Rb.chance(P.fires)) lay.anchors.push({ type: 'fire', x: xc, y: cy, z: 6, s: Rb.range(1.2, 2) });
            if (Rb.chance(P.smoke)) lay.anchors.push({ type: 'smoke', x: xc, y: cy, z: 10, s: Rb.range(1.2, 1.8), dark: 0.8 });
          }
          y += dep;
        }
      }
    }
  }

  // ---- Street lamps on the curbs (many broken, a few still lit).
  for (let m = Math.ceil((y0 - LAMP / 2) / LAMP); m * LAMP + LAMP / 2 < y1; m++) {
    const y = m * LAMP + LAMP / 2;
    for (const s of [-1, 1]) {
      if (s === st.side && y > st.y0 - 20 && y < st.y1 + 20) continue;
      const hk = hash(seed, pmod(m, PERIOD / LAMP) * 2 + (s > 0 ? 1 : 0));
      const broken = hk < 0.25 + P.damage * 0.3, on = !broken && hk > 1 - P.lamps;
      lay.lamps.push({ x: s * (ROAD.curb + 4), y, s, broken, on, lean: broken ? (hk * 7) % 1 - 0.5 : 0 });
      if (on) lay.anchors.push({ type: 'lamp', x: s * (ROAD.curb + 4 - 30), y, z: 92, c: [1, 0.74, 0.45], len: 8 });
      if (broken && hk < 0.12) lay.anchors.push({ type: 'spark', x: s * (ROAD.curb + 4), y, z: 30 });
    }
  }

  // ---- 3D wrecks on the shoulders / sidewalks (never in the crawler's footpath).
  const nW = Math.round(R.range(3, 6) * P.traffic + 1);
  for (let i = 0; i < nW; i++) {
    const y = R.range(y0 + 10, y1 - 10), s = R.sign();
    if (s === st.side && y > st.y0 - 30 && y < st.y1 + 30) continue;
    const roll = R.next();
    const kind = roll < 0.12 ? 'bus' : roll < 0.26 ? 'truck' : roll < 0.34 ? 'police' : roll < 0.34 + 0.2 * P.military ? 'apc' : roll < 0.6 + 0.1 * P.military ? 'tank' : 'car';
    const big = kind === 'bus' || kind === 'truck';
    const x = s * (big ? ROAD.half + 10 : R.range(ROAD.half - 4, ROAD.walk - 8));
    if (lay.wrecks.some((w) => Math.abs(w.y - y) < (big ? 70 : 36))) continue;
    const burnt = R.chance(0.35 + P.fires * 0.5);
    const rot = big ? (s > 0 ? 0 : Math.PI) + R.range(-0.08, 0.08) : R.range(-0.6, 0.6) + (R.chance(0.5) ? Math.PI : 0);
    const w = { kind, x, y, rot, burnt, seed: R.next(), col: R.pick([[0.55, 0.08, 0.06], [0.12, 0.16, 0.3], [0.62, 0.62, 0.6], [0.16, 0.16, 0.17], [0.32, 0.34, 0.3]]) };
    lay.wrecks.push(w);
    if (burnt) lay.anchors.push({ type: 'fire', x: w.x, y: w.y, z: big ? 10 : 6, s: big ? R.range(1.1, 1.6) : R.range(0.8, 1.2) });
    else if (R.chance(0.5 * P.smoke)) lay.anchors.push({ type: 'smoke', x: w.x, y: w.y, z: 6, s: R.range(0.7, 1.1), dark: 0.7 });
    if (!burnt && kind === 'police') {
      lay.anchors.push({ type: 'beacon', x: w.x - 2, y: w.y, z: 12, c: [1, 0.08, 0.06], period: 22 });
      lay.anchors.push({ type: 'beacon', x: w.x + 2, y: w.y + 1, z: 12, c: [0.15, 0.35, 1], period: 23 });
    }
    lay.glass.push({ x: w.x, y: w.y, r: big ? 28 : 16, seed: R.next() });
  }
  // Jersey barriers knocked about along the shoulders; utility poles on the sidewalks.
  for (let i = 0; i < 2; i++) {
    if (!R.chance(0.5 + P.damage * 0.2)) continue;
    const s = R.sign(), ya = R.range(y0, y1 - 90), n = R.int(2, 5);
    for (let j = 0; j < n; j++) {
      const y = ya + j * 22;
      if (s === st.side && y > st.y0 - 20 && y < st.y1 + 20) continue;
      const knocked = R.chance(0.35);
      lay.barriers.push({ x: s * (ROAD.half - 2 + (knocked ? R.range(-4, 6) : 0)), y, rot: knocked ? R.range(-0.7, 0.7) : 0, len: 20 });
    }
  }
  if (R.chance(0.6)) { const s = R.sign(), y = R.range(y0, y1); if (!(s === st.side && y > st.y0 - 20 && y < st.y1 + 20)) lay.poles.push({ x: s * (ROAD.walk - 4), y, down: R.chance(0.4 + P.damage * 0.2), rot: R.angle() }); }

  // ---- Painted traffic on the carriageways (burnt, crushed: walked over), burning debris piles.
  const nP = Math.round(R.range(4, 8) * P.traffic);
  for (let i = 0; i < nP; i++) {
    const y = R.range(y0 + 10, y1 - 10), s = R.sign(), lane = R.int(0, ROAD.lanes - 1);
    const x = s * (ROAD.median + 2 + ROAD.lane * (lane + 0.5)) + R.range(-5, 5);
    if (lay.painted.some((q) => Math.abs(q.y - y) < 34 && Math.abs(q.x - x) < 20)) continue;
    const roll = R.next();
    const kind = roll < 0.08 ? 'bus' : roll < 0.18 ? 'truck' : roll < 0.18 + 0.12 * P.military ? 'tank' : 'car';
    lay.painted.push({ kind, x, y, rot: (s > 0 ? 0 : Math.PI) + R.range(-0.5, 0.5), burnt: R.chance(0.55 + P.fires * 0.35), col: R.pick([[0.62, 0.62, 0.6], [0.12, 0.16, 0.3], [0.55, 0.08, 0.06], [0.16, 0.16, 0.17]]), seed: R.next() });
  }
  for (let i = 0; i < 2 + 3 * P.fires; i++) {
    const y = R.range(y0, y1), s = R.sign(), x = s * R.range(150, ROAD.half - 6);
    lay.burning.push({ x, y, r: R.range(14, 26), seed: R.next() });
    lay.anchors.push({ type: 'fire', x, y, z: 4, s: R.range(1.0, 1.6) });
    if (R.chance(0.5 * P.smoke)) lay.anchors.push({ type: 'smoke', x, y, z: 8, s: R.range(1, 1.5), dark: 0.85 });
  }

  // ---- Road surface damage (painted).
  for (let i = 0; i < 3 + 6 * P.damage; i++) {
    const y = R.range(y0, y1), x = R.range(-ROAD.half + 10, ROAD.half - 10);
    if (R.chance(0.45)) lay.craters.push({ x, y, r: R.range(8, 18), seed: R.next() });
    else lay.potholes.push({ x, y, r: R.range(3, 8), seed: R.next() });
  }
  for (let i = 0; i < 4; i++) lay.oil.push({ x: R.range(-190, 190), y: R.range(y0, y1), r: R.range(6, 18), seed: R.next() });
  for (let i = 0; i < 6 + 8 * P.damage; i++) { const y = R.range(y0, y1); lay.debris.push({ x: R.sign() * R.range(30, ROAD.walk), y, r: R.range(8, 28), seed: R.next() }); }
  for (let i = 0; i < 3; i++) { const y = R.range(y0, y1); lay.skids.push({ x: R.range(-170, 170), y, len: R.range(60, 170), seed: R.next() }); }
  for (let i = 0; i < 3; i++) { const y = R.range(y0, y1); lay.rubble.push({ x: R.sign() * R.range(ROAD.half - 30, ROAD.walk), y, r: R.range(10, 20), seed: R.next() }); }
  lay.seed = R.next();
  return lay;
}

// ---------------------------------------------------------------- paint

function asphaltP(p, base) {
  p.allPath().fill(base);
  p.noise('large', 2048, 'soft-light', 0.55);
  p.noise('fbm', 256, 'soft-light', 0.5);
  p.noise('grain', 128, 'overlay', 0.6);
  p.patch('fbm_60', 512, shade(base, 0.5), 0.42);
  p.patch('fine_70', 128, shade(base, 1.5), 0.15);
  p.patch('fbm_50', 256, [0.09, 0.05, 0.03], 0.22); // soot
}

function pavementP(p, base) {
  p.allPath().fill(base);
  p.noise('large', 2048, 'soft-light', 0.5);
  p.noise('grain', 128, 'overlay', 0.35);
  p.patch('fbm_60', 512, shade(base, 0.6), 0.4);
}

const rectPts = (x, y, w, d) => [x - w / 2, y - d / 2, x + w / 2, y - d / 2, x + w / 2, y + d / 2, x - w / 2, y + d / 2];

function paint(p, lay, nb, c, S) {
  const P = S.P, { y0, y1 } = c, all = [lay, ...nb.filter(Boolean)];
  const ya = y0 - 24, yb = y1 + 24;
  // 1) Asphalt everywhere, sidewalks + block lots either side.
  asphaltP(p, [0.17, 0.165, 0.165]);
  p.clip(() => {
    const cx = p.ctx;
    cx.beginPath();
    for (const s of [-1, 1]) { const xa = s * ROAD.curb, xb = s * (XW + 8); cx.rect(Math.min(xa, xb), ya, Math.abs(xb - xa), yb - ya); }
  }, () => {
    pavementP(p, [0.36, 0.345, 0.33]);
    for (const s of [-1, 1]) for (let x = ROAD.curb; x <= ROAD.walk; x += 14) p.line([s * x, ya, s * x, yb], 0.5, [0.18, 0.17, 0.16], 0.35);
    for (let y = Math.floor(ya / 14) * 14; y <= yb; y += 14) for (const s of [-1, 1]) p.line([s * ROAD.curb, y, s * ROAD.walk, y], 0.5, [0.18, 0.17, 0.16], 0.35);
  });
  // Lots beyond the sidewalks: dirt and ash where no building stands.
  p.clip(() => { const cx = p.ctx; cx.beginPath(); for (const s of [-1, 1]) { const xa = s * ROAD.face, xb = s * (XW + 8); cx.rect(Math.min(xa, xb), ya, Math.abs(xb - xa), yb - ya); } }, () => {
    p.allPath().fill([0.2, 0.18, 0.16], 0.85);
    p.noise('fbm', 256, 'soft-light', 0.6); p.noise('grain', 128, 'overlay', 0.5);
    p.patch('fbm_50', 256, [0.07, 0.06, 0.05], 0.45);
  });
  for (const s of [-1, 1]) p.line([s * (ROAD.curb + 1.5), ya, s * (ROAD.curb + 1.5), yb], 3, [0.5, 0.48, 0.45], 0.9);

  // 2) Wear: wheel paths and oil drips in every lane, patches, cracks, potholes, oil, manholes.
  for (const s of [-1, 1]) for (let l = 0; l < ROAD.lanes; l++) {
    const x = s * (ROAD.median + 2 + ROAD.lane * (l + 0.5));
    for (const o of [-6, 6]) p.line([x + o, ya, x + o, yb], 4.5, [0.28, 0.27, 0.27], 0.12);
    p.line([x, ya, x, yb], 2.6, [0.03, 0.03, 0.03], 0.22);
  }
  const Rp = new RNG(`ovp:${lay.seed}`);
  for (let i = 0; i < 7; i++) p.poly(rectPts(Rp.range(-180, 180), Rp.range(y0, y1), Rp.range(14, 50), Rp.range(14, 70))).fill([0.09, 0.09, 0.1], 0.55);
  for (let i = 0; i < 14 + 22 * P.damage; i++) p.crack(Rp, Rp.range(-200, 200), Rp.range(y0, y1), Rp.angle(), Rp.range(16, 80), Rp.range(0.6, 1.2));
  for (const L of all) for (const o of L.oil) p.radial(o.x, o.y, o.r, [[0, [0.02, 0.02, 0.03], 0.75], [0.7, [0.04, 0.04, 0.05], 0.45], [1, [0.05, 0.05, 0.05], 0]], 'source-over', 1, 0.8);
  for (const L of all) for (const h of L.potholes) {
    const Rh = new RNG(`ph:${h.seed}`), pts = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, d = h.r * Rh.range(0.7, 1.15); pts.push(h.x + Math.cos(a) * d * 1.2, h.y + Math.sin(a) * d); }
    p.poly(pts).fill([0.04, 0.04, 0.04], 0.9);
    p.poly(pts).stroke([0.3, 0.28, 0.26], 0.8, 0.6);
  }
  for (let i = 0; i < 3; i++) manhole(p, Rp.sign() * Rp.range(30, 170), Rp.range(y0, y1));

  // 3) Markings (worn, broken by the damage): dashed lanes, solid edges, the double median line.
  p.layer(() => {
    const Wc = [0.86, 0.85, 0.8], Y = [0.92, 0.7, 0.14];
    const ll = laneLines();
    for (const x of ll.dashed) for (let yd = Math.floor(ya / DASH) * DASH; yd < yb; yd += DASH) p.line([x, yd, x, yd + DASH_ON], 1.6, Wc, 1);
    for (const x of ll.solid) {
      if (Math.abs(x) < ROAD.median + 4) for (const o of [-1.8, 1.8]) p.line([x + o * Math.sign(x), ya, x + o * Math.sign(x), yb], 1.3, Y, 1);
      else p.line([x, ya, x, yb], 1.8, Wc, 1);
    }
    // Median hatching.
    for (let y = Math.ceil(ya / 16) * 16; y < yb; y += 16) p.line([-ROAD.median + 1, y - 5, ROAD.median - 1, y + 5], 1.4, Y, 0.85);
  }, { wear: ['fine_60', 64, 0.85], alpha: 0.78 });

  // 4) Props with shadows.
  p.props(() => new RNG(`ovprops:${lay.seed}`), () => {
    for (const L of all) for (const sk of L.skids) {
      const Rs = new RNG(`sk:${sk.seed}`), pts = [], bend = Rs.range(-0.5, 0.5);
      for (let t = 0; t <= 1.001; t += 0.1) pts.push(sk.x + Math.sin(t * 2.4) * bend * 30, sk.y - sk.len * (1 - t));
      skid(p, pts, 16, 0.32);
    }
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`cr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2.6); crater(p, Rc, cr.x, cr.y, cr.r, { rim: [0.3, 0.28, 0.26] }); }
    for (const L of all) for (const d of L.debris) debris(p, new RNG(`db:${d.seed}`), d.x, d.y, d.r, Math.round(d.r * 1.5));
    for (const L of all) for (const g of L.glass) {
      const Rg = new RNG(`gl:${g.seed}`);
      for (let i = 0; i < 40; i++) { const a = Rg.angle(), d = Math.sqrt(Rg.next()) * g.r; p.rectPath(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d, Rg.range(0.5, 1.4), Rg.range(0.5, 1.2)).fill(Rg.chance(0.5) ? [0.8, 0.88, 0.92] : [0.3, 0.32, 0.34], 0.8); }
    }
    for (const L of all) for (const r of L.rubble) rubble(p, new RNG(`rb:${r.seed}`), r.x, r.y, r.r, { rebar: true, scale: r.big ? 1.5 : 1 });
    // The fallen span of the collapsed overpass across the carriageways.
    for (const L of all) for (const f of L.fallen) {
      const Rf = new RNG(`fl:${f.seed}`);
      scorch(p, Rf, f.x, f.y, f.r * 1.6);
      rubble(p, Rf, f.x, f.y, f.r, { rebar: true, scale: 1.6, color: [0.48, 0.46, 0.43] });
    }
    for (const L of all) for (const b of L.burning) { const Rb = new RNG(`bn:${b.seed}`); scorch(p, Rb, b.x, b.y, b.r * 2); rubble(p, Rb, b.x, b.y, b.r * 0.7, { color: [0.2, 0.17, 0.15] }); }
    for (const L of all) for (const q of L.painted) {
      const Rq = new RNG(`pc:${q.seed}`);
      if (q.burnt) scorch(p, Rq, q.x, q.y, 22);
      if (q.kind === 'bus') bus(p, q.x, q.y, q.rot, { burnt: q.burnt, l: 64 });
      else if (q.kind === 'truck') truck(p, q.x, q.y, q.rot, { burnt: q.burnt, color: q.col });
      else if (q.kind === 'tank') tank(p, q.x, q.y, q.rot, { burnt: true, turret: Rq.range(-1, 1) });
      else car(p, q.x, q.y, q.rot, { burnt: q.burnt, color: q.col, kind: Rq.pick(['sedan', 'hatch', 'suv', 'van']) });
    }
    for (const L of all) for (const b of L.buildings) shadowBuilding(p, b);
    for (const L of all) if (L.site) shadowSite(p, L.site);
    for (const L of all) if (L.stub) { const s = L.stub, xa = s.side * (ROAD.face + s.reach), xb = s.side * (XW + 20); p.shadow([Math.min(xa, xb), s.y - 60, Math.max(xa, xb), s.y - 60, Math.max(xa, xb), s.y + 60, Math.min(xa, xb), s.y + 60], s.top + 6, s.top - 12); }
    for (const L of all) for (const w of L.wrecks) { const d = WRECK[w.kind] || WRECK.car; p.shadowBox(w.x, w.y, d[0], d[1], d[2], w.rot); }
    for (const L of all) for (const lp of L.lamps) {
      if (lp.broken) { p.line([lp.x, lp.y, lp.x + lp.lean * 60, lp.y + 40 * Math.sign(lp.lean || 1)], 1.6, [0.18, 0.18, 0.2], 0.9); continue; }
      p.shadowCircle(lp.x, lp.y, 1.2, 92, 0, 6);
      p.shadow([lp.x, lp.y - 0.8, lp.x - lp.s * 30, lp.y - 0.8, lp.x - lp.s * 30, lp.y + 0.8, lp.x, lp.y + 0.8], 93, 90);
    }
    for (const L of all) for (const b of L.barriers) p.shadowBox(b.x, b.y, 5.4, b.len, 7, b.rot);
    // Scorch blooms under fires.
    for (const L of all) for (const a of L.anchors) if (a.type === 'fire' && a.z < 14) scorch(p, new RNG(`fs:${Math.round(a.x * 7 + a.y)}`), a.x, a.y, 22 * a.s);
    for (let i = 0; i < 4; i++) { const Rd = new RNG(`cr2:${lay.seed}:${i}`); crate(p, Rd, Rd.sign() * Rd.range(ROAD.curb + 4, ROAD.walk - 4), Rd.range(y0, y1), Rd.range(4, 7), Rd.range(-0.4, 0.4), { color: [0.4, 0.36, 0.3] }); }
    if (P.military > 0.3) for (let i = 0; i < 3; i++) { const Rd = new RNG(`dr:${lay.seed}:${i}`); drum(p, Rd.sign() * Rd.range(ROAD.curb + 4, ROAD.walk - 4), Rd.range(y0, y1), { color: [0.24, 0.28, 0.18] }); }
    if (P.wet) for (let i = 0; i < 6; i++) { const Rw = new RNG(`pd:${lay.seed}:${i}`); puddle(p, Rw, Rw.range(-190, 190), Rw.range(y0, y1), Rw.range(6, 16), { color: [0.07, 0.08, 0.11] }); }
  }, 0.64, 2.4);

  // 5) Light map: fire glow, lamp pools, beacons.
  const G = p.env.glow;
  if (G) {
    for (const L of all) for (const a of L.anchors) {
      if (a.type === 'fire') G.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.4, 0.08], 0.65], [1, [1, 0.28, 0.04], 0]], 'lighter');
      else if (a.type === 'lamp') G.radial(a.x, a.y, 44, [[0, [1, 0.7, 0.4], 0.3], [0.6, [1, 0.6, 0.3], 0.1], [1, [1, 0.5, 0.2], 0]], 'lighter', 1, 1.25);
      else if (a.type === 'beacon' && a.z < 20) G.radial(a.x, a.y, 16, [[0, a.c, 0.3], [1, a.c, 0]], 'lighter');
    }
    for (const L of all) for (const b of L.burning) G.radial(b.x, b.y, b.r * 3, [[0, [1, 0.36, 0.06], 0.5], [1, [1, 0.25, 0.03], 0]], 'lighter');
  }
}

/** Ground shadow of a climb site (block + tower / deck span). */
function shadowSite(p, st) {
  const s = st.side, xa = s * st.x0, xb = s * st.x1;
  if (st.kind === 'deck') {
    p.shadow([Math.min(xa, s * (XW + 20)), st.y0, Math.max(xa, s * (XW + 20)), st.y0, Math.max(xa, s * (XW + 20)), st.y1, Math.min(xa, s * (XW + 20)), st.y1], st.top + 6, st.top - 14);
    p.shadowBox(s * (st.x0 + 26), st.y, 52, st.y1 - st.y0, st.top, 0);
    return;
  }
  p.shadowBox((xa + xb) / 2, st.y, Math.abs(xb - xa), st.y1 - st.y0, st.top + 3, 0);
  if (st.kind === 'podium') p.shadowBox(s * (st.x1 + 90), st.y, 170, (st.y1 - st.y0) * 0.8, st.tower, 0);
}

// ----------------------------------------------------------------- mesh

function mesh(mb, lay, S) {
  const P = S.P;
  // ---- Curbs.
  for (const s of [-1, 1]) mb.box(s * (ROAD.curb + 1.6), (lay.y0 + lay.y1) / 2, 0, 3.2, lay.y1 - lay.y0, 2.6, 0, { top: 'concrete', side: 'concrete' });
  // ---- The climb site.
  if (lay.site) meshSite(mb, lay.site, P);
  if (lay.stub) meshStub(mb, lay.stub);
  // ---- Blocks.
  for (const b of lay.buildings) {
    meshBuilding(mb, b);
    if (b.bill) meshBillboard(mb, b.bill.x, b.y, b.h + 2.6, 46, 18, b.bill.face, b.bill.mat);
  }
  // ---- Lamps.
  for (const lp of lay.lamps) {
    if (lp.broken) {
      mb.beam([lp.x, lp.y, 0.8], [lp.x + lp.lean * 80, lp.y + 50 * Math.sign(lp.lean || 1), 2], 2.2, 2.2, 'steel_painted', { tint: [0.5, 0.5, 0.52] });
      continue;
    }
    mb.lathe(lp.x, lp.y, [[2.2, 0], [1.8, 6], [1.2, 90], [1, 93]], 'steel_painted', { seg: 8, tint: [0.55, 0.55, 0.58] });
    const tip = [lp.x - lp.s * 30, lp.y, 92.5];
    mb.beam([lp.x, lp.y, 91], tip, 1.2, 1.4, 'steel_painted', { tint: [0.55, 0.55, 0.58] });
    mb.box(tip[0], tip[1], 89.5, 9, 4.2, 2.4, 0, { top: 'metal_dark', side: 'metal_dark' });
  }
  // ---- Wrecks, barriers, poles.
  for (const w of lay.wrecks) meshVehicle(mb, w);
  for (const b of lay.barriers) {
    mb.box(b.x, b.y, 0, 5.4, b.len - 1, 2.4, b.rot, { top: 'concrete', side: 'concrete' });
    mb.box(b.x, b.y, 2.4, 2.6, b.len - 1, 4.8, b.rot, { top: 'concrete', side: 'concrete' });
  }
  for (const pl of lay.poles) {
    if (pl.down) { mb.beam([pl.x, pl.y, 1.2], [pl.x + Math.cos(pl.rot) * 60, pl.y + Math.sin(pl.rot) * 60, 1.6], 2.4, 2.4, 'timber'); continue; }
    mb.beam([pl.x, pl.y, 0], [pl.x, pl.y, 76], 2.6, 2.6, 'timber');
    mb.beam([pl.x - 12, pl.y, 72], [pl.x + 12, pl.y, 72], 1.4, 1.6, 'timber');
    for (const o of [-10, 10]) { mb.beam([pl.x + o, pl.y, 72], [pl.x + o * 1.6, pl.y + 18, 30], 0.5, 0.5, 'metal_dark'); mb.beam([pl.x + o * 1.6, pl.y + 18, 30], [pl.x + o * 2, pl.y + 24, 0.5], 0.5, 0.5, 'metal_dark'); }
  }
}

/** Hazard-striped edge + corner posts on a site's roof pad. */
function padEdge(mb, st, z) {
  const s = st.side, xa = s * st.x0, xb = s * st.x1, cx = (xa + xb) / 2, w = Math.abs(xb - xa);
  for (const sy of [-1, 1]) mb.box(cx, st.y + sy * ((st.y1 - st.y0) / 2 - 2), z, w, 3, 1.4, 0, { top: 'steel_yellow', side: 'steel_yellow' });
  for (const [x, k] of [[xa, 1], [xb, -1]]) mb.box(x + s * k * 2, st.y, z, 3, st.y1 - st.y0, 1.4, 0, { top: 'steel_yellow', side: 'steel_yellow' });
  for (const sy of [-1, 1]) for (const ax of [st.x0 + 10, st.x1 - 10]) mb.box(s * ax, st.y + sy * ((st.y1 - st.y0) / 2 - 10), z, 3, 3, 6, 0, { top: 'metal_dark', side: 'metal_dark' });
}

function meshSite(mb, st, P) {
  const s = st.side, R = new RNG(`site:${st.seed}`);
  const xa = s * st.x0, xb = s * st.x1, cx = (xa + xb) / 2, w = st.x1 - st.x0, d = st.y1 - st.y0, top = st.top;
  if (st.kind === 'garage') {
    // Multi-storey car park: four decks on a column grid, concrete fins on the road face, roof deck.
    const levels = 4, lh = top / levels;
    for (let l = 1; l <= levels; l++) mb.box(cx, st.y, l * lh - 3, w, d, 3, 0, { top: l === levels ? 'asphalt_tile' : 'concrete', side: 'concrete_dark', bottom: 'concrete_dark' });
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 5; j++) {
      const x = xa + s * (8 + (i / 6) * (w - 16)), y = st.y0 + 8 + (j / 5) * (d - 16);
      mb.box(x, y, 0, 4, 4, top - 3, 0, { top: 'concrete', side: 'concrete' });
    }
    // Road face: solid concrete fins (the climbing wall) and spandrel walls per level.
    for (let j = 0; j <= 9; j++) mb.box(xa + s * 2, st.y0 + 6 + (j / 9) * (d - 12), 0, 4, 10, top, 0, { top: 'concrete', side: 'concrete_scorched' });
    for (let l = 1; l <= levels; l++) mb.box(xa + s * 2, st.y, l * lh - 9, 4, d, 6, 0, { top: 'concrete', side: R.chance(0.5) ? 'concrete_scorched' : 'concrete' });
    for (const sy of [-1, 1]) for (let l = 1; l <= levels; l++) mb.box(cx, st.y + sy * (d / 2 - 2), l * lh - 9, w, 4, 6, 0, { top: 'concrete', side: 'concrete_dark' });
    // Ramp housing at the far corner, parking bays on the roof (thin, walkable).
    mb.box(xb - s * 30, st.y1 - 34, top, 52, 60, 14, 0, { top: 'roof_concrete', side: 'concrete_dark' });
    for (let j = 0; j < 8; j++) mb.box(cx, st.y0 + 30 + j * ((d - 60) / 7), top, w * 0.7, 0.8, 0.25, 0, { top: 'concrete', side: 'concrete' });
    // A couple of burnt cars left on the lower decks (seen through the open sides).
    for (let l = 0; l < levels - 1; l++) if (R.chance(0.6)) meshVehicle(mb, { kind: 'car', x: cx + R.range(-w / 3, w / 3), y: st.y + R.range(-d / 3, d / 3), rot: R.chance(0.5) ? 0 : Math.PI / 2, burnt: true, seed: R.next(), col: [0.3, 0.3, 0.3], z: l * lh });
  } else if (st.kind === 'podium') {
    // Office podium (the pad) with its tower set back behind it.
    mb.box(cx, st.y, 0, w, d, top, 0, { top: 'roof_concrete', side: 'facade_burnt', sides: [null, s > 0 ? null : 'facade_office', null, s > 0 ? 'facade_office' : null] });
    mb.box(xa + s * 3, st.y, 0, 6, d - 10, 22, 0, { top: 'concrete', side: 'concrete_dark' });         // ground-floor canopy band
    mb.box(s * (st.x1 + 90), st.y, 0, 170, d * 0.8, st.tower, 0, { top: 'roof_burnt', side: 'facade_burnt' });
    mb.box(s * (st.x1 + 90), st.y, st.tower, 120, d * 0.5, 16, 0, { top: 'roof_tar', side: 'concrete_dark' });
  } else {
    // Elevated-highway stub: deck on piers out to the edge of the map, solid abutment at the broken end.
    const x1 = s * (XW + 30), dcx = (xa + x1) / 2, dw = Math.abs(x1 - xa), T = 12;
    mb.box(dcx, st.y, top - T, dw, d, T, 0, { top: 'asphalt_tile', side: 'concrete_dark', bottom: 'concrete_dark' });
    for (const sy of [-1, 1]) mb.box(dcx, st.y + sy * (d / 2 - 1.5), top, dw, 3, 6, 0, { top: 'concrete', side: 'concrete' });
    for (let x = st.x0 + 130; x < XW; x += 130) for (const dy of [-d * 0.32, d * 0.32]) mb.lathe(s * x, st.y + dy, [[9, 0], [8, top - T - 8], [11, top - T]], 'concrete', { seg: 10, top: false });
    mb.box(xa + s * 26, st.y, 0, 52, d, top - T, 0, { top: 'concrete', side: 'concrete_scorched' });          // abutment (the climbing wall)
    for (let k = 0; k < 14; k++) mb.beam([xa, st.y + R.range(-d / 2 + 6, d / 2 - 6), top - R.range(1, 10)], [xa - s * R.range(4, 14), st.y + R.range(-d / 2, d / 2), top - R.range(4, 26)], 0.7, 0.7, 'rust');
    // Lane paint on the deck (thin strips), a burnt bus left up there beyond the pad.
    for (const o of [-26, 26]) mb.box(dcx, st.y + o, top, dw, 1.2, 0.2, 0, { top: 'concrete', side: 'concrete' });
    meshVehicle(mb, { kind: 'bus', x: s * (st.x1 + 70), y: st.y + R.range(-30, 30), rot: s > 0 ? Math.PI / 2 : -Math.PI / 2, burnt: true, seed: R.next(), col: [0.3, 0.3, 0.3], z: top });
  }
  padEdge(mb, st, top);
}

/** The opposite stub of a collapsed overpass (not climbable: the span beyond it fell). */
function meshStub(mb, sb) {
  const s = sb.side, R = new RNG(`stub:${sb.seed}`), z = sb.top, T = 12;
  const xa = s * (ROAD.face + sb.reach), x1 = s * (XW + 30), dcx = (xa + x1) / 2, dw = Math.abs(x1 - xa);
  mb.box(dcx, sb.y, z - T, dw, 120, T, 0, { top: 'asphalt_tile', side: 'concrete_dark', bottom: 'concrete_dark' });
  for (const sy of [-1, 1]) mb.box(dcx, sb.y + sy * 58.5, z, dw, 3, 6, 0, { top: 'concrete', side: 'concrete' });
  for (let x = ROAD.face + sb.reach + 70; x < XW; x += 130) for (const dy of [-40, 40]) mb.lathe(s * x, sb.y + dy, [[9, 0], [8, z - T - 8], [11, z - T]], 'concrete', { seg: 10, top: false });
  for (let k = 0; k < 12; k++) mb.beam([xa, sb.y + R.range(-56, 56), z - R.range(1, 10)], [xa - s * R.range(6, 18), sb.y + R.range(-60, 60), z - R.range(6, 30)], 0.7, 0.7, 'rust');
  // The hanging slab, down to the sidewalk.
  mb.quad([[xa, sb.y - 56, z - T], [xa, sb.y + 56, z - T], [s * (ROAD.walk - 6), sb.y + 52, 2], [s * (ROAD.walk - 6), sb.y - 52, 2]], [[0, 0], [1, 0], [1, 1], [0, 1]], mb.mat('asphalt_tile').layer, [-s * 0.7, 0, 0.7]);
}

export { XW };
