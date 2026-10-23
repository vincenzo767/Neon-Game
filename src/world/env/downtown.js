import { shade } from '../paint/core.js';
import { scorch, debris, crater, skid, tree, puddle, manhole, rubble, crate, drum, sandbags } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding, buildingAnchors, meshCrane, shadowCrane, meshSkeleton, meshBillboard, meshTent } from '../kit/city.js';
import { RNG } from '../../core/RNG.js';
import {
  PERIOD, SEG, NSEG, ROAD, roadX, roadSlope, splitAt, envelope, islandHalf, crossY, crossIndex, isSplit, forkAt,
} from './downtownRoad.js';

// DOWNTOWN SIEGE: the devastated city boulevard the URBAN DEVASTATOR races
// through (and level 4 of the campaign is fought over).
//
// The road (world/env/downtownRoad.js, shared with the car rig) is a twelve-
// lane boulevard that bends at its intersections and forks twice per period
// around a raised island. It is painted with worn asphalt (wheel-path
// polish, oil drips, patches, cracks, potholes, oil stains, glass, scorch,
// old skid marks), real markings (dashed lanes, solid edges, the double
// yellow centre line, gore hatching, crosswalks, stop lines, turn arrows)
// and 3D curbs. Off the road: sidewalks, street lamps, traffic-signal masts
// over the carriageway, bus stops, jersey barriers, construction zones with
// barrels, fences, scaffolds and tower cranes; damaged office towers and
// brick blocks set back from the curb (burning, gutted, collapsed into
// rubble); wrecked civilian cars, buses, trucks, police cruisers and
// ambulances with flashing beacons, burnt-out military vehicles; a collapsed
// elevated expressway; the fork islands with a monument, dead trees and a
// burnt tank. Fires, smoke columns, sparks from broken lamps and signals.
//
// PERIODIC WORLD: the layer repeats every PERIOD (= PER chunks). Everything
// that depends on y divides PERIOD (road keypoints, lamp and dash spacing,
// noise / pattern scales are powers of two, hashes use y mod PERIOD), so
// ArenaWorld builds the PER chunks once and redraws them: the chase never
// waits for terrain.
//
// Params (0..1 unless noted): fires, damage, collapse (buildings), traffic
// (wrecks), military, lamps (street lights lit), wet (puddles, gloss),
// construction, night (bool: lit windows), smoke.

const LEN = SEG;
const PER = PERIOD / LEN;
const XW = 600;               // layer half-width
const LAMP = 128;             // street-lamp spacing (divides PERIOD)
const DASH = 64, DASH_ON = 24; // lane dash period / length (period divides PERIOD)
const CORNER = ROAD.cross + 24; // building setback from a cross street's centre
const pmod = (a, n) => ((a % n) + n) % n;
const TAU = Math.PI * 2;

/** Seeded per-index hash in [0, 1). */
function hash(seed, k) { let h = 2166136261 ^ k; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }

export default {
  id: 'downtown',
  label: 'Downtown Siege boulevard (periodic)',
  defaults: { fires: 0.6, damage: 0.7, collapse: 0.35, traffic: 0.7, military: 0.5, lamps: 0.7, wet: 0, construction: 0.5, night: false, smoke: 0.6 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || 'downtown'; // one city for every phase arena: only params differ
    const S = { P, seed, dust: [0.46, 0.43, 0.4] };
    S.layers = [{
      id: 'ground', z: 0, x0: -XW, x1: XW, length: LEN, ppu: 1.0, glow: true, period: PER,
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

/** Layout of chunk k = chunk k mod PER shifted by whole periods (neighbours across the seam). */
function periodicLayout(c, S) {
  const km = pmod(c.k, PER);
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
  }
  return lay;
}

function shiftObj(o, dy) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const n = { ...o };
  for (const k of ['y', 'ya', 'yb', 'y0', 'y1']) if (typeof n[k] === 'number') n[k] += dy;
  if (n.frame) n.frame = { ...n.frame, y: n.frame.y + dy };
  if (n.crane) n.crane = { ...n.crane, y: n.crane.y + dy };
  if (Array.isArray(n.tents)) n.tents = n.tents.map((t) => ({ ...t, y: t.y + dy }));
  if (Array.isArray(n.pts)) n.pts = n.pts.map((v, i) => (i & 1 ? v + dy : v));
  return n;
}

/** World point at lateral offset `off` from the centreline at y. */
const at = (off, y) => [roadX(y) + off, y];

/** Polyline along the road: offset fn(y) or number, from ya to yb. */
function along(off, ya, yb, step = 8) {
  const pts = [], f = typeof off === 'function' ? off : () => off;
  const n = Math.max(1, Math.ceil((yb - ya) / step));
  for (let i = 0; i <= n; i++) { const y = ya + ((yb - ya) * i) / n; pts.push(roadX(y) + f(y), y); }
  return pts;
}

/** Closed band between two offset functions from ya to yb. */
function band(offA, offB, ya, yb, step = 8) {
  const a = along(offA, ya, yb, step), b = along(offB, ya, yb, step), out = a.slice();
  for (let i = b.length - 2; i >= 0; i -= 2) out.push(b[i], b[i + 1]);
  return out;
}

const maxEnv = (ya, yb) => { let m = 0; for (let i = 0; i <= 6; i++) m = Math.max(m, envelope(ya + ((yb - ya) * i) / 6)); return m; };

// ------------------------------------------------------------- layout

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, k = c.k, ki = pmod(k, NSEG), seed = S.seed;
  const lay = {
    buildings: [], lots: [], lamps: [], signals: [], wrecks: [], barriers: [], barrels: [], stops: [], fences: [],
    anchors: [], debris: [], craters: [], oil: [], puddles: [], skids: [], potholes: [], glass: [], arrows: [], rubble: [],
    island: [], monuments: [], overpass: [], trees: [], hydrants: [], poles: [],
  };
  const yc = crossY(k);
  const own = (y) => y >= y0 && y < y1;

  // ---- City blocks either side, between this chunk's junctions (each lot is built by the chunk holding its centre).
  for (const b of [k - 1, k]) {
    const ya = crossY(b) + CORNER, yb = crossY(b + 1) - CORNER, bi = pmod(b, NSEG);
    for (const s of [-1, 1]) {
      // Near column (facing the boulevard) and far column behind it.
      for (const col of [0, 1]) {
        const Rb = new RNG(`${seed}:blk:${bi}:${s}:${col}`);
        let y = ya;
        while (y < yb - 30) {
          const dep = Math.min(yb - y, Rb.range(col ? 90 : 64, col ? 190 : 150));
          const cy = y + dep / 2, front = maxEnv(y, y + dep) + ROAD.sidewalk + 6 + (col ? 136 : 0);
          const w = col ? Rb.range(110, 210) : Rb.range(72, 124);
          const roll = Rb.next(), odd = Rb.next(), hk = Rb.next();
          const rot = -Math.atan(roadSlope(cy));
          const xc = roadX(cy) + s * (front + w / 2);
          if (own(cy) && Math.abs(xc) + w / 2 < XW + 60) {
            const lw = w - 10, ld = dep - 12;
            if (roll < (col ? 0.85 : 0.7)) {
              const bd = planBuilding(Rb, xc, cy, lw, ld, {
                hMin: col ? 90 : 46, hMax: col ? 300 : 190, burnt: P.fires * 0.45, collapse: P.collapse * (col ? 0.35 : 0.5), night: P.night, rot,
                styles: col ? ['office', 'glass', 'concrete', 'office'] : ['brick', 'concrete', 'office', 'industrial', 'glass'],
              });
              lay.buildings.push(bd);
              buildingAnchors(Rb, bd, lay.anchors, { fireScale: 0.9, smoke: 0.3 * P.smoke });
              if (!col && !bd.collapse && !bd.burnt && bd.h < 110 && hk < 0.3) bd.bill = { x: xc - s * lw * 0.3, face: -s, mat: `billboard_${Rb.int(0, 3)}` };
              if (bd.collapse) lay.rubble.push({ x: xc - s * lw * 0.25, y: cy, r: Math.min(lw, ld) * 0.45, seed: Rb.next(), big: true });
              if (!col && hk > 0.7 && !bd.collapse && P.construction > 0.2) lay.lots.push({ kind: 'scaffold', x: xc - s * (lw / 2 + 3), y: cy, d: ld * 0.8, h: Math.min(bd.h, 70), rot, s });
            } else {
              const lot = { x: xc, y: cy, w: lw, d: ld, rot, s, seed: Rb.next() };
              if (odd < 0.3 * P.construction + 0.05 && dep > 90) {
                lot.kind = 'construction';
                lot.frame = { x: xc + s * 8, y: cy, w: lw * 0.6, d: ld * 0.6, h: Rb.range(50, 110), rot, done: Rb.range(0.4, 0.9) };
                lot.crane = { x: xc - s * lw * 0.25, y: cy + Rb.range(-0.25, 0.25) * ld, h: Rb.range(150, 220), rot: Rb.angle(), jib: Rb.range(120, 170) };
                lay.anchors.push({ type: 'beacon', x: lot.crane.x, y: lot.crane.y, z: lot.crane.h + 16, c: [1, 0.1, 0.05], period: 70 });
              } else if (odd < 0.55) lot.kind = 'parking';
              else if (odd < 0.55 + 0.25 * P.military) {
                lot.kind = 'checkpoint';
                lot.tents = [0, 1].map((q) => ({ x: xc + Rb.range(-0.2, 0.2) * lw, y: cy + (q - 0.5) * ld * 0.45, rot: rot + Rb.range(-0.3, 0.3) }));
                lay.anchors.push({ type: 'searchlight', x: xc - s * lw * 0.3, y: cy, z: 6, base: s > 0 ? Math.PI : 0, sweep: 0.9, speed: 0.012 });
              } else {
                lot.kind = 'rubble';
                lay.rubble.push({ x: xc, y: cy, r: Math.min(lw, ld) * 0.48, seed: lot.seed, big: true });
                if (Rb.chance(P.fires)) lay.anchors.push({ type: 'fire', x: xc + Rb.range(-15, 15), y: cy + Rb.range(-15, 15), z: 6, s: Rb.range(1, 1.8) });
                if (Rb.chance(P.smoke * 0.6)) lay.anchors.push({ type: 'smoke', x: xc, y: cy, z: 10, s: Rb.range(0.9, 1.4), dark: 0.7 });
              }
              lay.lots.push(lot);
            }
          }
          y += dep;
        }
      }
    }
  }

  // ---- Intersection: crosswalks, stop lines, signal masts, turn arrows, manholes.
  if (own(yc)) {
    const Ri = new RNG(`${seed}:x:${ki}`);
    for (const s of [-1, 1]) for (const sy of [-1, 1]) {
      const y = yc + sy * (ROAD.cross + 10), e = envelope(y);
      const down = Ri.chance(0.14 + P.damage * 0.12);
      lay.signals.push({ x: roadX(y) + s * (e + 12), y, s, sy, down, rot: Ri.range(-0.5, 0.5), arm: Ri.range(78, 104) });
      if (down) lay.anchors.push({ type: 'spark', x: roadX(y) + s * (e + 4), y, z: 3 });
      else {
        // Signal heads: dead, stuck on red, or flashing amber.
        const mode = Ri.next();
        for (let h = 0; h < 3; h++) {
          const off = e + 12 - 22 - h * 26;
          if (mode < 0.35) continue;
          lay.anchors.push({ type: 'beacon', x: roadX(y) + s * off, y: y + sy * 2, z: 92, c: mode < 0.7 ? [1, 0.12, 0.06] : [1, 0.62, 0.1], period: mode < 0.7 ? 160 : 46 });
        }
      }
    }
    // Turn arrows painted in the approach lanes (both carriageways).
    for (const dir of [1, -1]) {
      const ys = yc - dir * (ROAD.cross + 64);
      for (let l = 0; l < 6; l++) {
        // Inner lane turns left, outer lane right (the arrow is rotated with the direction of travel).
        const kind = l === 0 ? 'left' : l === 5 ? 'right' : l === 4 && Ri.chance(0.5) ? 'straightRight' : 'straight';
        lay.arrows.push({ off: dir * (12 + l * 24), y: ys, dir, kind });
      }
    }
    // Collapsed elevated expressway along this cross street (one per period).
    if (ki === 9) lay.overpass.push({ y: yc, seed: Ri.next() });
  }

  // ---- Street lamps both sides (and on the fork islands).
  for (let m = Math.ceil((y0 - LAMP / 2) / LAMP); m * LAMP + LAMP / 2 < y1; m++) {
    const y = m * LAMP + LAMP / 2;
    if (Math.abs(y - crossY(crossIndex(y))) < ROAD.cross + 22) continue;
    for (const s of [-1, 1]) {
      const hk = hash(seed, pmod(m, PERIOD / LAMP) * 2 + (s > 0 ? 1 : 0));
      const broken = hk < 0.12 + P.damage * 0.2, on = !broken && hk > 1 - P.lamps;
      const e = envelope(y);
      lay.lamps.push({ x: roadX(y) + s * (e + 14), y, s, broken, on, lean: broken ? (hk * 7) % 1 - 0.5 : 0 });
      if (on) lay.anchors.push({ type: 'lamp', x: roadX(y) + s * (e + 14 - 30), y, z: 92, c: [1, 0.78, 0.5], len: 8 });
      if (broken && hk < 0.08) lay.anchors.push({ type: 'spark', x: roadX(y) + s * (e + 14), y, z: 40 });
    }
    const ih = islandHalf(y);
    if (ih > 24) {
      lay.lamps.push({ x: roadX(y), y, s: 0, broken: false, on: P.lamps > 0.3, lean: 0 });
      if (P.lamps > 0.3) for (const s of [-1, 1]) lay.anchors.push({ type: 'lamp', x: roadX(y) + s * 24, y, z: 92, c: [1, 0.8, 0.55], len: 8 });
    }
  }

  // ---- Fork island: monument at the full split, dead trees, a burnt tank, barriers at the noses.
  const f = forkAt((y0 + y1) / 2) || forkAt(y0 + 10) || forkAt(y1 - 10);
  if (f) {
    const Rf = new RNG(`${seed}:island:${pmod(f.k, NSEG)}`);
    const mid = (f.y0 + f.y1) / 2;
    if (own(mid)) {
      lay.monuments.push({ x: roadX(mid), y: mid, h: Rf.range(40, 56), broken: Rf.chance(0.5) });
      lay.anchors.push({ type: 'glow', x: roadX(mid), y: mid, z: 2, r: 30, c: [1, 0.55, 0.25], a: 0.18, flicker: true });
    }
    for (let i = 0; i < 18; i++) {
      const y = Rf.range(f.y0 + 120, f.y1 - 120), ih = islandHalf(y);
      if (ih < 22 || !own(y) || Math.abs(y - mid) < 40) continue;
      lay.trees.push({ x: roadX(y) + Rf.range(-ih + 12, ih - 12), y, r: Rf.range(7, 12), seed: Rf.next() });
    }
    const ty = mid + (Rf.chance(0.5) ? 1 : -1) * Rf.range(110, 170);
    if (own(ty) && islandHalf(ty) > 40) {
      lay.wrecks.push({ kind: 'tank', x: roadX(ty) + Rf.range(-14, 14), y: ty, rot: Rf.range(-1, 1), burnt: true, seed: Rf.next() });
      lay.anchors.push({ type: 'fire', x: roadX(ty), y: ty, z: 8, s: 1.3 });
    }
    // Crash barriers / attenuators at the island noses.
    for (const yn of [f.y0 + 150, f.y1 - 150]) if (own(yn)) lay.barriers.push({ x: roadX(yn), y: yn, rot: -Math.atan(roadSlope(yn)), len: 14, nose: true });
  }

  // ---- Wrecks: along the curbs (never in the car's path), on the sidewalks and the cross street.
  const nW = Math.round(R.range(3, 7) * P.traffic + 1);
  for (let i = 0; i < nW; i++) {
    const y = R.range(y0 + 8, y1 - 8), s = R.sign();
    if (isSplit(y) || Math.abs(y - yc) < ROAD.cross + 30) continue;
    const roll = R.next(), e = envelope(y);
    const kind = roll < 0.1 ? 'bus' : roll < 0.22 ? 'truck' : roll < 0.3 ? 'police' : roll < 0.35 ? 'ambulance' : roll < 0.35 + 0.15 * P.military ? 'apc' : 'car';
    const big = kind === 'bus' || kind === 'truck' || kind === 'apc';
    const onWalk = !big && R.chance(0.35);
    const off = onWalk ? e + R.range(8, 24) : e - (big ? 7 : 5.5);
    const dr = -Math.atan(roadSlope(y)) + (s > 0 ? 0 : Math.PI) + (R.chance(0.4) ? R.range(-0.5, 0.5) : R.range(-0.06, 0.06));
    if (lay.wrecks.some((w) => Math.hypot(w.x - (roadX(y) + s * off), w.y - y) < (big ? 70 : 34))) continue;
    const burnt = R.chance(P.fires * 0.5);
    const w = { kind, x: roadX(y) + s * off, y, rot: big ? -Math.atan(roadSlope(y)) + (s > 0 ? 0 : Math.PI) + R.range(-0.08, 0.08) : dr, burnt, seed: R.next(), col: R.pick([[0.55, 0.08, 0.06], [0.12, 0.16, 0.3], [0.62, 0.62, 0.6], [0.16, 0.16, 0.17], [0.32, 0.34, 0.3], [0.7, 0.55, 0.15]]) };
    lay.wrecks.push(w);
    if (burnt) lay.anchors.push({ type: 'fire', x: w.x, y: w.y, z: big ? 10 : 6, s: big ? R.range(1.0, 1.4) : R.range(0.7, 1.0) });
    else if (R.chance(0.35 * P.smoke)) lay.anchors.push({ type: 'smoke', x: w.x, y: w.y, z: 6, s: R.range(0.6, 1), dark: 0.6 });
    if (!burnt && (kind === 'police' || kind === 'ambulance')) {
      lay.anchors.push({ type: 'beacon', x: w.x - 2, y: w.y, z: 12, c: [1, 0.08, 0.06], period: 22 });
      lay.anchors.push({ type: 'beacon', x: w.x + 2, y: w.y + 1, z: 12, c: kind === 'police' ? [0.15, 0.35, 1] : [1, 0.9, 0.85], period: 23 });
    }
    // Glass and fragments around it; an old skid mark leading in.
    lay.glass.push({ x: w.x, y: w.y, r: big ? 26 : 16, seed: R.next() });
    if (!onWalk && R.chance(0.5)) lay.skids.push({ x: w.x, y: w.y, s, len: R.range(50, 120), seed: R.next() });
  }
  // Wrecks parked / abandoned along the cross street.
  if (own(yc)) for (let i = 0; i < 3 + 3 * P.traffic; i++) {
    const s = R.sign(), x = roadX(yc) + s * (envelope(yc) + R.range(60, 420));
    if (Math.abs(x) > XW - 20) continue;
    const kind = R.chance(0.15 * P.military) ? 'apc' : R.chance(0.1) ? 'bus' : 'car';
    const burnt = R.chance(P.fires * 0.45);
    lay.wrecks.push({ kind, x, y: yc + R.range(-14, 14), rot: Math.PI / 2 * s + R.range(-0.4, 0.4), burnt, seed: R.next(), col: R.pick([[0.55, 0.08, 0.06], [0.12, 0.16, 0.3], [0.62, 0.62, 0.6], [0.16, 0.16, 0.17]]) });
    if (burnt) lay.anchors.push({ type: 'fire', x, y: yc, z: 6, s: R.range(0.9, 1.4) });
  }

  // ---- Jersey barriers along stretches of curb (knocked about), construction barrels.
  for (let i = 0; i < 2; i++) {
    if (!R.chance(0.35 + P.damage * 0.25)) continue;
    const s = R.sign(), ya = R.range(y0, y1 - 80), n = R.int(3, 7);
    for (let j = 0; j < n; j++) {
      const y = ya + j * 21;
      if (isSplit(y) || Math.abs(y - yc) < ROAD.cross + 24) continue;
      const knocked = R.chance(0.3);
      lay.barriers.push({ x: roadX(y) + s * (envelope(y) - 5 + (knocked ? R.range(-2, 8) : 0)), y, rot: -Math.atan(roadSlope(y)) + (knocked ? R.range(-0.6, 0.6) : 0), len: 20 });
    }
  }
  if (R.chance(P.construction)) {
    const s = R.sign(), y = R.range(y0 + 30, y1 - 30);
    if (!isSplit(y) && Math.abs(y - yc) > ROAD.cross + 40) {
      const e = envelope(y);
      for (let j = 0; j < 7; j++) lay.barrels.push({ x: roadX(y + j * 14) + s * (e + 6 + (j % 2) * 4), y: y + j * 14, knocked: R.chance(0.25) });
      lay.fences.push({ pts: along(s * (e + 22), y - 10, y + 100, 20), s });
    }
  }
  // Bus stop now and then.
  if (R.chance(0.4)) {
    const s = R.sign(), y = R.range(y0 + 40, y1 - 40);
    if (Math.abs(y - yc) > ROAD.cross + 40) lay.stops.push({ x: roadX(y) + s * (envelope(y) + 22), y, rot: -Math.atan(roadSlope(y)), s, broken: R.chance(P.damage * 0.6) });
  }
  // Hydrants, one burst (spray anchor).
  for (let i = 0; i < 2; i++) {
    const s = R.sign(), y = R.range(y0, y1);
    if (Math.abs(y - yc) < ROAD.cross + 16) continue;
    const x = roadX(y) + s * (envelope(y) + 6), burst = R.chance(0.2);
    lay.hydrants.push({ x, y });
    if (burst) lay.anchors.push({ type: 'steam', x, y, z: 4, s: 0.6 });
  }

  // ---- Road surface damage and dressing (painted).
  for (let i = 0; i < 2 + 5 * P.damage; i++) {
    const y = R.range(y0, y1), off = R.range(-150, 150);
    if (Math.abs(off) > envelope(y) - 8 || islandHalf(y) > Math.abs(off) - 4) continue;
    if (R.chance(0.35)) lay.craters.push({ x: roadX(y) + off, y, r: R.range(7, 14), seed: R.next() });
    else lay.potholes.push({ x: roadX(y) + off, y, r: R.range(3, 7), seed: R.next() });
  }
  for (let i = 0; i < 4; i++) { const y = R.range(y0, y1); lay.oil.push({ x: roadX(y) + R.range(-140, 140), y, r: R.range(6, 18), seed: R.next() }); }
  for (let i = 0; i < 4 + 6 * P.damage; i++) { const y = R.range(y0, y1), s = R.sign(); lay.debris.push({ x: roadX(y) + s * R.range(20, envelope(y) + 40), y, r: R.range(8, 26), seed: R.next() }); }
  if (P.wet > 0) for (let i = 0; i < 4 + 10 * P.wet; i++) { const y = R.range(y0, y1); lay.puddles.push({ x: roadX(y) + R.range(-170, 170), y, r: R.range(5, 16) * (0.6 + P.wet), seed: R.next() }); }
  for (let i = 0; i < 2; i++) { const y = R.range(y0, y1); lay.skids.push({ x: roadX(y) + R.range(-110, 110), y, s: R.sign(), len: R.range(60, 160), seed: R.next(), free: true }); }
  if (R.chance(0.5)) { const y = R.range(y0, y1); lay.poles.push({ x: roadX(y) + R.sign() * (envelope(y) + 26), y, down: R.chance(0.3 + P.damage * 0.2), rot: R.angle() }); }
  lay.seed = R.next();
  return lay;
}

// ---------------------------------------------------------------- paint

/** City asphalt (scales are powers of two: the period wraps seamlessly). */
function asphaltP(p, base, wet) {
  p.allPath().fill(base);
  p.noise('large', 2048, 'soft-light', 0.55);
  p.noise('fbm', 256, 'soft-light', 0.45);
  p.noise('grain', 128, 'overlay', 0.55);
  p.patch('fbm_60', 512, shade(base, 0.55), 0.38);
  p.patch('fine_70', 128, shade(base, 1.45), 0.16);
  if (wet) p.patch('fbm_50', 512, [0.05, 0.06, 0.08], 0.3 * wet);
}

function pavementP(p, base) {
  p.allPath().fill(base);
  p.noise('large', 2048, 'soft-light', 0.5);
  p.noise('grain', 128, 'overlay', 0.3);
  p.patch('fbm_60', 512, shade(base, 0.7), 0.32);
}

function paint(p, lay, nb, c, S) {
  const P = S.P, { y0, y1 } = c, all = [lay, ...nb.filter(Boolean)];
  const ya = y0 - 24, yb = y1 + 24;
  // 1) Asphalt everywhere (boulevard, cross street), once.
  const env = (y) => envelope(y);
  asphaltP(p, [0.19, 0.19, 0.2], P.wet);
  // 2) Sidewalks and blocks either side (concrete pavers): one compound clip, one paint pass.
  const yc0 = crossY(lay.k), cuts = [[ya, Math.max(ya, Math.min(yb, yc0 - ROAD.cross))], [Math.min(yb, Math.max(ya, yc0 + ROAD.cross)), yb]];
  p.clip(() => {
    const cx = p.ctx;
    cx.beginPath();
    for (const [a, b] of cuts) {
      if (b - a < 1) continue;
      for (const s of [-1, 1]) {
        const e = along((y) => s * env(y), a, b, 8);
        cx.moveTo(e[0], e[1]);
        for (let i = 2; i < e.length; i += 2) cx.lineTo(e[i], e[i + 1]);
        cx.lineTo(s * (XW + 8), b); cx.lineTo(s * (XW + 8), a); cx.closePath();
      }
    }
  }, () => {
    pavementP(p, [0.42, 0.41, 0.39]);
    for (let x = -XW; x <= XW; x += 16) p.line([x, ya, x, yb], 0.5, [0.2, 0.2, 0.19], 0.35);
    for (let y = Math.floor(ya / 16) * 16; y <= yb; y += 16) p.line([-XW - 4, y, XW + 4, y], 0.5, [0.2, 0.2, 0.19], 0.35);
  });
  // Lots: parking (dark asphalt + bays), rubble / checkpoint / construction (dirt).
  for (const L of all) for (const lt of L.lots) {
    const pts = rectPts(lt.x, lt.y, lt.w, lt.d, lt.rot);
    if (lt.kind === 'parking') {
      p.poly(pts).fill([0.17, 0.17, 0.18], 0.92);
      p.at(lt.x, lt.y, lt.rot, (cx) => {
        cx.strokeStyle = 'rgba(220,220,210,0.45)'; cx.lineWidth = 0.6;
        for (let v = -lt.d / 2 + 8; v < lt.d / 2 - 6; v += 14) for (const su of [-1, 1]) { cx.beginPath(); cx.moveTo(su * 6, v); cx.lineTo(su * (lt.w / 2 - 6), v); cx.stroke(); }
      });
    } else if (lt.kind !== 'scaffold') {
      p.poly(pts).fill(lt.kind === 'checkpoint' ? [0.34, 0.31, 0.25] : [0.36, 0.32, 0.27], 0.92);
      p.clip(() => p.poly(pts), () => p.noise('grain', 128, 'overlay', 0.5));
    }
  }
  // 3) The fork islands.
  const islandBand = (pad) => {
    const segs = [];
    let cur = null;
    for (let y = ya; y <= yb; y += 8) {
      if (islandHalf(y) > 0.5) { if (!cur) cur = [y]; cur[1] = y; } else if (cur) { segs.push(cur); cur = null; }
    }
    if (cur) segs.push(cur);
    return segs.map(([a, b]) => band((y) => -Math.max(0, islandHalf(y) - pad), (y) => Math.max(0, islandHalf(y) - pad), a, b, 6));
  };
  for (const pts of islandBand(0)) { p.poly(pts).fill([0.5, 0.49, 0.46]); }
  for (const pts of islandBand(4)) {
    p.poly(pts).fill([0.27, 0.26, 0.2]);
    p.clip(() => p.poly(pts), () => { p.noise('fbm', 256, 'soft-light', 0.6); p.noise('grain', 128, 'overlay', 0.5); p.patch('fbm_60', 128, [0.2, 0.24, 0.12], 0.4); });
  }
  // Curb strips (light concrete edge) along the asphalt.
  for (const s of [-1, 1]) p.line(along((y) => s * (env(y) + 1.5), ya, yb), 3, [0.58, 0.57, 0.53], 0.95);

  // 5) Surface wear: wheel-path polish and oil drips in every lane, patches, cracks.
  for (const s of [-1, 1]) for (let l = 0; l < 6; l++) {
    const off = (y) => s * splitAt(y) + (l - 2.5) * ROAD.lane;
    for (const o of [-6, 6]) p.line(along((y) => off(y) + o, ya, yb, 16), 4.5, [0.3, 0.3, 0.3], 0.13);
    p.line(along(off, ya, yb, 16), 2.6, [0.03, 0.03, 0.03], 0.24);
  }
  const Rp = new RNG(`dtp:${lay.seed}`);
  for (let i = 0; i < 6; i++) {
    const y = Rp.range(y0, y1), off = Rp.range(-140, 140), w = Rp.range(14, 46), d = Rp.range(14, 60);
    p.poly(rectPts(roadX(y) + off, y, w, d, -Math.atan(roadSlope(y)))).fill([0.1, 0.1, 0.11], 0.55);
  }
  for (let i = 0; i < 10 + 18 * P.damage; i++) { const y = Rp.range(y0, y1); p.crack(Rp, roadX(y) + Rp.range(-150, 150), y, Rp.angle(), Rp.range(14, 60), 0.7); }
  for (const L of all) for (const o of L.oil) {
    const Ro = new RNG(`oil:${o.seed}`);
    p.radial(o.x, o.y, o.r, [[0, [0.02, 0.02, 0.03], 0.75], [0.7, [0.04, 0.04, 0.05], 0.45], [1, [0.05, 0.05, 0.05], 0]], 'source-over', 1, Ro.range(0.6, 1.4));
    if (Ro.chance(0.6)) p.radial(o.x + o.r * 0.2, o.y, o.r * 0.6, [[0, [0.35, 0.2, 0.5], 0.12], [0.5, [0.2, 0.45, 0.4], 0.1], [1, [0.4, 0.4, 0.1], 0]], 'screen');
  }
  for (const L of all) for (const h of L.potholes) {
    const Rh = new RNG(`ph:${h.seed}`), pts = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, d = h.r * Rh.range(0.7, 1.15); pts.push(h.x + Math.cos(a) * d * 1.2, h.y + Math.sin(a) * d); }
    p.poly(pts).fill([0.05, 0.05, 0.05], 0.9);
    p.poly(pts).stroke([0.32, 0.3, 0.28], 0.8, 0.6);
    if (P.wet > 0) p.poly(pts).fill([0.12, 0.14, 0.18], 0.5 * P.wet);
  }
  for (let i = 0; i < 24; i++) { const y = Rp.range(y0, y1); manhole(p, roadX(y) + (Rp.chance(0.5) ? -1 : 1) * Rp.range(20, 130), y); }

  // 6) Markings (worn).
  p.layer(() => {
    const W = [0.88, 0.88, 0.84], Y = [0.92, 0.72, 0.14];
    // Dashed lane lines: per carriageway lane, dashes on a fixed y grid.
    for (const s of [-1, 1]) for (let l = -2; l <= 2; l++) {
      const off = (y) => s * splitAt(y) + l * ROAD.lane;
      for (let yd = Math.floor(ya / DASH) * DASH; yd < yb; yd += DASH) {
        if (Math.abs(yd + DASH_ON / 2 - crossY(crossIndex(yd))) < ROAD.cross + 30) continue;
        p.line(along(off, yd, yd + DASH_ON, 6), 1.5, W, 1);
      }
    }
    // Solid edges (outer, and inner where the carriageways part) - broken at the cross street.
    const spans = solidSpans(ya, yb);
    for (const [a, b] of spans) {
      for (const s of [-1, 1]) {
        p.line(along((y) => s * (splitAt(y) + ROAD.forkEdge), a, b, 6), 1.7, W, 1);
        // Inner edges: only where they have moved off the centre.
        let run = null;
        for (let y = a; y <= b + 0.1; y += 6) {
          const ok = splitAt(y) - ROAD.forkEdge > 3;
          if (ok && !run) run = [y, y]; else if (ok) run[1] = y; else if (run) { p.line(along((yy) => s * (splitAt(yy) - ROAD.forkEdge), run[0], run[1], 6), 1.7, W, 1); run = null; }
        }
        if (run) p.line(along((yy) => s * (splitAt(yy) - ROAD.forkEdge), run[0], run[1], 6), 1.7, W, 1);
      }
      // Double yellow centre line where the road is not split.
      let run = null;
      const flush = () => { if (run && run[1] > run[0]) for (const o of [-1.8, 1.8]) p.line(along(o, run[0], run[1], 6), 1.2, Y, 1); run = null; };
      for (let y = a; y <= b + 0.1; y += 6) { const ok = splitAt(y) - ROAD.forkEdge <= 3; if (ok && !run) run = [y, y]; else if (ok) run[1] = y; else flush(); }
      flush();
      // Gore hatching between the parting carriageways (before the island curb).
      for (let y = Math.ceil(a / 12) * 12; y < b; y += 12) {
        const g = splitAt(y) - ROAD.forkEdge;
        if (g < 4 || islandHalf(y) > 1) continue;
        const x = roadX(y);
        p.line([x - g, y - 5, x + g, y + 5], 1.4, W, 0.9);
      }
    }
    // Crosswalks and stop lines at the junction.
    for (const L of all) {
      const yc = crossY(L.k);
      if (yc < ya - 120 || yc > yb + 120) continue;
      for (const sy of [-1, 1]) {
        const yz = yc + sy * (ROAD.cross + 9);
        const e = envelope(yz);
        for (let o = -e + 4; o < e - 3; o += 8) {
          if (islandHalf(yz) > Math.abs(o) - 2) continue;
          p.poly([roadX(yz - 7) + o - 2.4, yz - 7, roadX(yz - 7) + o + 2.4, yz - 7, roadX(yz + 7) + o + 2.4, yz + 7, roadX(yz + 7) + o - 2.4, yz + 7]).fill(W, 0.95);
        }
        // Stop line across the carriageway that approaches on this side (+y traffic stops before yc).
        const ys = yc + sy * (ROAD.cross + 22), side = sy < 0 ? 1 : -1;
        p.line([roadX(ys) + side * 3, ys, roadX(ys) + side * (envelope(ys) - 16), ys], 3.4, W, 0.95);
        // Cross-street markings: crosswalks either side of the boulevard + centre dashes.
        for (const s of [-1, 1]) {
          const xe = roadX(yc) + s * (envelope(yc) + 8);
          for (let q = -ROAD.cross + 4; q < ROAD.cross - 3; q += 8) p.rectPath(xe + s * 0 - 7, yc + q - 2.4, 14, 4.8).fill(W, 0.9);
          for (let x = xe + s * 20; Math.abs(x) < XW; x += s * 40) p.line([x, yc, x + s * 22, yc], 1.3, Y, 0.9);
        }
      }
      for (const ar of L.arrows) arrow(p, roadX(ar.y) + ar.off, ar.y, ar.dir, ar.kind, -Math.atan(roadSlope(ar.y)));
    }
  }, { wear: ['fine_60', 64, 0.9], alpha: 0.82 });

  // 7) Props with shadows: buildings, wrecks, lamps, signals, debris, scorch, skid marks, puddles.
  p.props(() => new RNG(`dtprops:${lay.seed}`), (Rq) => {
    for (const L of all) for (const sk of L.skids) {
      const Rs = new RNG(`sk:${sk.seed}`), pts = [], bend = Rs.range(-0.6, 0.6);
      for (let t = 0; t <= 1.001; t += 0.1) { const yy = sk.y - sk.len * (1 - t); pts.push(roadX(yy) + (sk.x - roadX(sk.y)) + Math.sin(t * 2.4) * bend * 30 * (sk.free ? 1 : 1 - t), yy); }
      skid(p, pts, 18, 0.32);
      skid(p, pts.map((v, i) => (i & 1 ? v : v + 2)), 18, 0.18);
    }
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`cr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2.4); crater(p, Rc, cr.x, cr.y, cr.r, { rim: [0.3, 0.29, 0.28] }); }
    for (const L of all) for (const d of L.debris) debris(p, new RNG(`db:${d.seed}`), d.x, d.y, d.r, Math.round(d.r * 1.4));
    for (const L of all) for (const g of L.glass) {
      const Rg = new RNG(`gl:${g.seed}`);
      for (let i = 0; i < 40; i++) { const a = Rg.angle(), d = Math.sqrt(Rg.next()) * g.r; p.rectPath(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d, Rg.range(0.5, 1.4), Rg.range(0.5, 1.2)).fill(Rg.chance(0.5) ? [0.8, 0.88, 0.92] : [0.3, 0.32, 0.34], 0.8); }
    }
    for (const L of all) for (const r of L.rubble) rubble(p, new RNG(`rb:${r.seed}`), r.x, r.y, r.r, { rebar: true, scale: r.big ? 1.5 : 1 });
    for (const L of all) for (const pd of L.puddles) puddle(p, new RNG(`pd:${pd.seed}`), pd.x, pd.y, pd.r, { color: [0.07, 0.08, 0.11] });
    for (const L of all) for (const b of L.buildings) shadowBuilding(p, b);
    for (const L of all) for (const w of L.wrecks) { const d = WRECK[w.kind] || WRECK.car; p.shadowBox(w.x, w.y, d[0], d[1], d[2], w.rot); }
    for (const L of all) for (const lp of L.lamps) {
      if (lp.broken) { p.line([lp.x, lp.y, lp.x + lp.lean * 60, lp.y + 40 * Math.sign(lp.lean || 1)], 1.6, [0.2, 0.2, 0.22], 0.9); continue; }
      p.shadowCircle(lp.x, lp.y, 1.2, 92, 0, 6);
      if (lp.s) p.shadow([lp.x, lp.y - 0.8, lp.x - lp.s * 30, lp.y - 0.8, lp.x - lp.s * 30, lp.y + 0.8, lp.x, lp.y + 0.8], 93, 90);
    }
    for (const L of all) for (const sg of L.signals) {
      if (sg.down) { p.line([sg.x, sg.y, sg.x + Math.cos(sg.rot) * 60 * sg.s, sg.y + Math.sin(sg.rot) * 50], 2.4, [0.16, 0.16, 0.17], 0.95); continue; }
      p.shadowCircle(sg.x, sg.y, 2, 96, 0, 6);
      p.shadow([sg.x, sg.y - 1.2, sg.x - sg.s * sg.arm, sg.y - 1.2, sg.x - sg.s * sg.arm, sg.y + 1.2, sg.x, sg.y + 1.2], 97, 93);
    }
    for (const L of all) for (const t of L.trees) tree(p, new RNG(`tr:${t.seed}`), t.x, t.y, t.r, { dead: true, color: [0.18, 0.16, 0.1] });
    for (const L of all) for (const lt of L.lots) {
      const Rl = new RNG(`lot:${lt.seed}`);
      if (lt.kind === 'construction') {
        shadowCrane(p, lt.crane.x, lt.crane.y, lt.crane.h, lt.crane.rot, { jib: lt.crane.jib });
        p.shadowBox(lt.frame.x, lt.frame.y, lt.frame.w, lt.frame.d, lt.frame.h * lt.frame.done, lt.rot, 0);
        for (let q = 0; q < 8; q++) crate(p, Rl, lt.x + Rl.range(-0.4, 0.4) * lt.w, lt.y + Rl.range(-0.4, 0.4) * lt.d, Rl.range(5, 9), Rl.range(-0.3, 0.3), { color: [0.55, 0.5, 0.42] });
      } else if (lt.kind === 'checkpoint') {
        for (const tn of lt.tents) p.shadowBox(tn.x, tn.y, 18, 30, 12, tn.rot);
        const r = Math.min(lt.w, lt.d) * 0.4, ring = [];
        for (let a = 0; a <= 6.3; a += 0.4) ring.push(lt.x + Math.cos(a) * r, lt.y + Math.sin(a) * r * 0.8);
        sandbags(p, ring);
        for (let q = 0; q < 5; q++) drum(p, lt.x + Rl.range(-0.3, 0.3) * lt.w, lt.y + Rl.range(-0.3, 0.3) * lt.d, { color: [0.25, 0.3, 0.18] });
      } else if (lt.kind === 'scaffold') p.shadowBox(lt.x, lt.y, 8, lt.d, lt.h, lt.rot);
    }
    for (const L of all) for (const m of L.monuments) p.shadowBox(m.x, m.y, 16, 16, m.h, 0);
    for (const L of all) for (const st of L.stops) p.shadowBox(st.x, st.y, 10, 30, 14, st.rot);
    for (const L of all) for (const ov of L.overpass) for (const s of [-1, 1]) {
      const xa = roadX(ov.y) + s * (envelope(ov.y) + 26), xb = s * (XW + 20);
      p.shadow([Math.min(xa, xb), ov.y - 18, Math.max(xa, xb), ov.y - 18, Math.max(xa, xb), ov.y + 18, Math.min(xa, xb), ov.y + 18], 104, 92);
    }
    // Scorch blooms under burning wrecks and fires.
    for (const L of all) for (const a of L.anchors) if (a.type === 'fire' && a.z < 14) scorch(p, new RNG(`fs:${Math.round(a.x * 7 + a.y)}`), a.x, a.y, 20 * a.s);
  }, 0.62, 2.4);

  // 8) Light map: lamp pools on the road, fire glow, lit windows spilling onto the sidewalk.
  const G = p.env.glow;
  if (G) {
    for (const L of all) for (const a of L.anchors) {
      if (a.type === 'lamp') G.radial(a.x, a.y, 46, [[0, [1, 0.72, 0.42], 0.34], [0.6, [1, 0.6, 0.3], 0.12], [1, [1, 0.5, 0.2], 0]], 'lighter', 1, 1.25);
      else if (a.type === 'fire') G.radial(a.x, a.y, 52 * a.s, [[0, [1, 0.42, 0.1], 0.6], [1, [1, 0.3, 0.05], 0]], 'lighter');
      else if (a.type === 'beacon') G.radial(a.x, a.y, 16, [[0, a.c, 0.3], [1, a.c, 0]], 'lighter');
    }
    if (P.night) for (const L of all) for (const b of L.buildings) if (!b.burnt && !b.collapse) G.radial(b.x, b.y, Math.max(b.w, b.d) * 0.7, [[0, [1, 0.8, 0.5], 0.1], [1, [1, 0.7, 0.4], 0]], 'lighter');
  }
}

/** Solid-line spans broken at the cross street. */
function solidSpans(ya, yb) {
  const out = [];
  let a = ya;
  for (let k = crossIndex(ya) - 1; k <= crossIndex(yb) + 1; k++) {
    const yc = crossY(k), g0 = yc - ROAD.cross - 16, g1 = yc + ROAD.cross + 16;
    if (g1 < a || g0 > yb) continue;
    if (g0 > a) out.push([a, g0]);
    a = Math.max(a, g1);
  }
  if (a < yb) out.push([a, yb]);
  return out;
}

function rectPts(x, y, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2, out = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) out.push(x + u * c - v * s, y + u * s + v * c);
  return out;
}

/** Painted lane arrow (dir +1 = northbound). */
function arrow(p, x, y, dir, kind, rot) {
  p.at(x, y, rot + (dir > 0 ? 0 : Math.PI), (c) => {
    c.fillStyle = 'rgba(225,225,215,0.9)';
    c.beginPath(); c.rect(-1.4, -14, 2.8, 16); c.fill();
    const head = (hx, hy, a) => { c.save(); c.translate(hx, hy); c.rotate(a); c.beginPath(); c.moveTo(0, 7); c.lineTo(-4.5, 0); c.lineTo(4.5, 0); c.closePath(); c.fill(); c.restore(); };
    if (kind === 'straight' || kind === 'straightRight') head(0, 2, 0);
    if (kind === 'left' || kind === 'right' || kind === 'straightRight') {
      const sx = kind === 'left' ? -1 : 1;
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(0, 3, sx * 5, 3); c.lineWidth = 2.8; c.strokeStyle = c.fillStyle; c.stroke();
      head(sx * 5, 3, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  });
}

// ----------------------------------------------------------------- mesh

const WRECK = { car: [11, 26, 8], police: [11, 27, 8], ambulance: [13, 32, 13], bus: [14, 60, 14], truck: [13, 44, 14], apc: [17, 32, 11], tank: [22, 38, 9] };

function mesh(mb, lay, S) {
  const P = S.P, y0 = lay.y0, y1 = lay.y1;
  // ---- Curbs along the real asphalt edges (outer and island), broken at the cross street.
  const step = 12;
  const curb = (xa0, xb0, xa1, xb1, ya, yb, h) => mb.prism([Math.min(xa0, xb0), ya, Math.max(xa0, xb0), ya, Math.max(xa1, xb1), yb, Math.min(xa1, xb1), yb], 0, h, { top: 'concrete', side: 'concrete' });
  for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
    const ya = y, yb = y + step;
    if (Math.abs(y + step / 2 - crossY(crossIndex(y + step / 2))) < ROAD.cross + 2) continue;
    for (const s of [-1, 1]) {
      const e0 = roadX(ya) + s * envelope(ya), e1 = roadX(yb) + s * envelope(yb);
      curb(e0, e0 + s * 3.2, e1, e1 + s * 3.2, ya, yb, 2.6);
      const i0 = islandHalf(ya), i1 = islandHalf(yb);
      if (i0 > 2 && i1 > 2) {
        const c0 = roadX(ya) + s * i0, c1 = roadX(yb) + s * i1;
        curb(c0, c0 - s * 2.8, c1, c1 - s * 2.8, ya, yb, 2.4);
      }
    }
  }
  // ---- Street lamps: tapered pole, arm over the road, head.
  for (const lp of lay.lamps) {
    if (lp.broken) {
      const a = [lp.x, lp.y, 0.8], b = [lp.x + lp.lean * 80, lp.y + 50 * Math.sign(lp.lean || 1), 2];
      mb.beam(a, b, 2.2, 2.2, 'steel_painted', { tint: [0.6, 0.6, 0.62] });
      continue;
    }
    mb.lathe(lp.x, lp.y, [[2.2, 0], [1.8, 6], [1.2, 90], [1, 93]], 'steel_painted', { seg: 8, tint: [0.62, 0.63, 0.66] });
    const arms = lp.s ? [lp.s] : [-1, 1];
    for (const s of arms) {
      const tip = [lp.x - s * 30, lp.y, 92.5];
      mb.beam([lp.x, lp.y, 91], tip, 1.2, 1.4, 'steel_painted', { tint: [0.62, 0.63, 0.66] });
      mb.box(tip[0], tip[1], 89.5, 9, 4.2, 2.4, 0, { top: 'metal_dark', side: 'metal_dark' });
    }
  }
  // ---- Traffic-signal masts over the carriageway.
  for (const sg of lay.signals) {
    if (sg.down) {
      const a = [sg.x, sg.y, 1.4], b = [sg.x + Math.cos(sg.rot) * 70 * sg.s, sg.y + Math.sin(sg.rot) * 56, 2.5];
      mb.beam(a, b, 3, 3, 'steel_yellow', { tint: [0.55, 0.5, 0.35] });
      mb.box(b[0], b[1], 0, 6, 10, 5, sg.rot, { top: 'metal_dark', side: 'metal_dark' });
      continue;
    }
    mb.lathe(sg.x, sg.y, [[3.4, 0], [2.6, 6], [2.2, 98]], 'steel_yellow', { seg: 8, tint: [0.6, 0.55, 0.4] });
    mb.beam([sg.x, sg.y, 96], [sg.x - sg.s * sg.arm, sg.y, 97.5], 2.2, 2.6, 'steel_yellow', { tint: [0.6, 0.55, 0.4] });
    for (let h = 0; h < 3; h++) {
      const x = sg.x - sg.s * (22 + h * 26);
      mb.box(x, sg.y, 83, 4.6, 4.6, 13, 0, { top: 'metal_dark', side: 'metal_dark' });
    }
    mb.box(sg.x - sg.s * 6, sg.y + sg.sy * 2, 40, 6, 3, 8, 0, { top: 'metal_dark', side: 'sign_green' });
  }
  // ---- Buildings (+ billboards), lots.
  for (const b of lay.buildings) {
    meshBuilding(mb, b);
    if (b.bill) meshBillboard(mb, b.bill.x, b.y, b.h + 2.6, 46, 18, b.bill.face, b.bill.mat);
  }
  for (const lt of lay.lots) {
    if (lt.kind === 'construction') { meshSkeleton(mb, lt.frame); meshCrane(mb, lt.crane.x, lt.crane.y, lt.crane.h, lt.crane.rot, { jib: lt.crane.jib }); }
    else if (lt.kind === 'checkpoint') for (const tn of lt.tents) meshTent(mb, tn.x, tn.y, 18, 30, 12, tn.rot);
    else if (lt.kind === 'scaffold') meshScaffoldFace(mb, lt);
  }
  // ---- Wrecked vehicles (3D).
  for (const w of lay.wrecks) meshVehicle(mb, w);
  // ---- Jersey barriers / attenuators, barrels, fences, bus stops, hydrants, poles.
  for (const b of lay.barriers) {
    if (b.nose) {
      mb.box(b.x, b.y, 0, 12, 18, 6, b.rot, { top: 'steel_yellow', side: 'steel_yellow' });
      mb.box(b.x, b.y, 6, 9, 12, 2, b.rot, { top: 'metal_dark', side: 'metal_dark' });
      continue;
    }
    mb.box(b.x, b.y, 0, 5.4, b.len - 1, 2.4, b.rot, { top: 'concrete', side: 'concrete' });
    mb.box(b.x, b.y, 2.4, 2.6, b.len - 1, 4.8, b.rot, { top: 'concrete', side: 'concrete' });
  }
  for (const r of lay.barrels) {
    if (r.knocked) { mb.beam([r.x - 3, r.y, 2], [r.x + 3, r.y + 1, 2], 4.4, 4.4, 'steel_painted', { tint: [2.4, 0.9, 0.2] }); continue; }
    mb.lathe(r.x, r.y, [[2.4, 0], [2.4, 2], [2.2, 2.2], [2.2, 3.6], [2.4, 3.8], [2.2, 6]], 'steel_painted', { seg: 8, tint: [2.4, 0.9, 0.2] });
  }
  for (const f of lay.fences) for (let i = 0; i + 3 < f.pts.length; i += 2) {
    const a = [f.pts[i], f.pts[i + 1]], b = [f.pts[i + 2], f.pts[i + 3]];
    mb.beam([a[0], a[1], 0], [a[0], a[1], 13], 0.9, 0.9, 'metal_dark');
    mb.wall(a[0], a[1], b[0], b[1], 1, 12, 'lattice_grey', { ao: 1 });
    mb.wall(b[0], b[1], a[0], a[1], 1, 12, 'lattice_grey', { ao: 1 });
  }
  for (const st of lay.stops) {
    const c = Math.cos(st.rot), s = Math.sin(st.rot), P0 = (u, v) => [st.x + u * c - v * s, st.y + u * s + v * c];
    for (const v of [-13, 13]) { const [x, y] = P0(st.s * 3, v); mb.box(x, y, 0, 1.4, 1.4, 14, st.rot, { top: 'metal_dark', side: 'metal_dark' }); }
    const [rx, ry] = P0(0, 0);
    mb.box(rx, ry, 14, 11, 30, 1.6, st.rot + (st.broken ? 0.15 : 0), { top: 'roof_metal', side: 'metal_dark' });
    if (!st.broken) { const [gx, gy] = P0(st.s * 4.5, 0); mb.box(gx, gy, 1, 0.8, 28, 12, st.rot, { top: 'facade_glass', side: 'facade_glass' }); }
    const [bx, by] = P0(st.s * 2, 0);
    mb.box(bx, by, 0, 3, 18, 3.2, st.rot, { top: 'metal_dark', side: 'metal_dark' });
  }
  for (const h of lay.hydrants) mb.lathe(h.x, h.y, [[1.4, 0], [1.2, 3.4], [0.9, 4.4]], 'steel_painted', { seg: 6, tint: [2.2, 0.5, 0.3] });
  for (const pl of lay.poles) {
    if (pl.down) { mb.beam([pl.x, pl.y, 1.2], [pl.x + Math.cos(pl.rot) * 70, pl.y + Math.sin(pl.rot) * 70, 1.6], 2.4, 2.4, 'timber'); continue; }
    mb.beam([pl.x, pl.y, 0], [pl.x, pl.y, 76], 2.6, 2.6, 'timber');
    mb.beam([pl.x - 12, pl.y, 72], [pl.x + 12, pl.y, 72], 1.4, 1.6, 'timber');
    // Snapped cables hanging to the sidewalk.
    for (const o of [-10, 10]) { mb.beam([pl.x + o, pl.y, 72], [pl.x + o * 1.6, pl.y + 18, 30], 0.5, 0.5, 'metal_dark'); mb.beam([pl.x + o * 1.6, pl.y + 18, 30], [pl.x + o * 2, pl.y + 24, 0.5], 0.5, 0.5, 'metal_dark'); }
  }
  // ---- Fork islands: monument, dead trees.
  for (const m of lay.monuments) {
    mb.box(m.x, m.y, 0, 34, 34, 3, 0, { top: 'plaza_paving', side: 'concrete' });
    mb.box(m.x, m.y, 3, 18, 18, 9, 0, { top: 'marble', side: 'marble' });
    if (m.broken) {
      mb.lathe(m.x, m.y, [[5, 12], [4, 12 + m.h * 0.45]], 'marble', { seg: 6 });
      mb.beam([m.x + 6, m.y + 4, 3], [m.x + 28, m.y + 20, 5], 6, 6, 'marble');
    } else mb.lathe(m.x, m.y, [[5, 12], [3.4, 12 + m.h], [0.4, 14 + m.h]], 'marble', { seg: 4 });
  }
  for (const t of lay.trees) {
    const R = new RNG(`dtree:${t.seed}`);
    mb.beam([t.x, t.y, 0], [t.x, t.y, t.r * 2.2], 1.6, 1.6, 'timber');
    for (let k = 0; k < 4; k++) { const a = R.angle(); mb.beam([t.x, t.y, t.r * 1.6], [t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r, t.r * 2.6], 0.8, 0.8, 'timber'); }
  }
  // ---- Collapsed elevated expressway along the cross street: decks end in broken stubs at the boulevard.
  for (const ov of lay.overpass) {
    const R = new RNG(`ovp:${ov.seed}`), y = ov.y, z = 98, T = 10;
    for (const s of [-1, 1]) {
      const xa = roadX(y) + s * (envelope(y) + 30 + R.range(0, 24)), xb = s * (XW + 30);
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      mb.box((x0 + x1) / 2, y, z - T, x1 - x0, 40, T, 0, { top: 'asphalt_tile', side: 'concrete_dark' });
      mb.box((x0 + x1) / 2, y - 19, z, x1 - x0, 2.4, 6, 0, { top: 'concrete', side: 'concrete' });
      mb.box((x0 + x1) / 2, y + 19, z, x1 - x0, 2.4, 6, 0, { top: 'concrete', side: 'concrete' });
      for (let x = xa + s * 40; Math.abs(x) < XW; x += s * 110) for (const dy of [-12, 12]) mb.lathe(x, y + dy, [[6, 0], [5, z - T - 6], [7, z - T]], 'concrete', { seg: 10, top: false });
      // Broken edge: rebar and a slab hanging off the stub down to the sidewalk.
      for (let k = 0; k < 10; k++) mb.beam([xa, y + R.range(-18, 18), z - R.range(1, 8)], [xa - s * R.range(4, 12), y + R.range(-20, 20), z - R.range(6, 22)], 0.6, 0.6, 'rust');
      const sx = xa - s * 6;
      mb.quad([[sx, y - 18, z - T], [sx, y + 18, z - T], [sx - s * 26, y + 20, 3], [sx - s * 26, y - 16, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]], mb.mat('asphalt_tile').layer, [-s * 0.6, 0, 0.8]);
      for (let k = 0; k < 7; k++) mb.box(sx - s * R.range(10, 40), y + R.range(-26, 26), 0, R.range(6, 14), R.range(6, 12), R.range(3, 8), R.angle(), { top: 'concrete_scorched', side: 'concrete_dark' });
    }
  }
}

/** Scaffolding on a building face: standards, ledgers, boards. */
function meshScaffoldFace(mb, sc) {
  const c = Math.cos(sc.rot), s = Math.sin(sc.rot), P0 = (u, v, z) => [sc.x + u * c - v * s, sc.y + u * s + v * c, z];
  const n = Math.max(2, Math.round(sc.d / 18));
  for (let i = 0; i <= n; i++) {
    const v = -sc.d / 2 + (sc.d * i) / n;
    for (const u of [-2.5, 2.5]) mb.beam(P0(u, v, 0), P0(u, v, sc.h), 0.7, 0.7, 'steel_painted', { tint: [0.7, 0.7, 0.72] });
  }
  for (let z = 14; z < sc.h; z += 14) {
    for (const u of [-2.5, 2.5]) mb.beam(P0(u, -sc.d / 2, z), P0(u, sc.d / 2, z), 0.6, 0.6, 'steel_painted', { tint: [0.7, 0.7, 0.72] });
    const [x, y] = P0(0, 0, 0);
    mb.box(x, y, z, 5, sc.d, 0.8, sc.rot, { top: 'timber', side: 'timber' });
  }
  const [x, y] = P0(0, 0, 0);
  mb.box(x, y, sc.h * 0.4, 0.4, sc.d * 0.6, sc.h * 0.5, sc.rot, { top: 'tarp_canvas', side: 'tarp_canvas', tint: [0.4, 0.55, 0.7] });
}

/** Wrecked / abandoned vehicle as solids. */
function meshVehicle(mb, w) {
  const R = new RNG(`dtv:${w.seed}`), c = Math.cos(w.rot), s = Math.sin(w.rot);
  const at2 = (u, v) => [w.x + u * c - v * s, w.y + u * s + v * c];
  const z0 = w.z || 0; // base height (a wreck left on a deck / an upper level)
  const box = (u, v, z, bw, bl, bh, side, top = side, o = {}) => { const [x, y] = at2(u, v); mb.box(x, y, z0 + z, bw, bl, bh, w.rot + (o.dr || 0), { top, side, tint: o.tint }); };
  const burnt = w.burnt, paint = burnt ? null : w.col.map((v) => v * 2.4);
  const body = burnt ? 'rust' : 'steel_painted', roof = burnt ? 'roof_burnt' : 'steel_painted';
  const wheels = (hw, ys) => { for (const v of ys) for (const u of [-hw, hw]) box(u, v, 0, 2.2, 5.2, 4.2, 'metal_dark'); };
  switch (w.kind) {
    case 'bus':
      wheels(6.4, [-20, 20]);
      box(0, 0, 2.2, 14, 60, 11, body, roof, { tint: burnt ? null : [2.2, 1.7, 0.4] });
      if (!burnt) for (const u of [-7.05, 7.05]) box(u, 0, 7, 0.3, 50, 4, 'facade_glass', 'facade_glass');
      break;
    case 'truck':
      wheels(5.8, [-16, -6, 14]);
      box(0, 15, 2.2, 12, 11, 10, body, roof, { tint: paint });
      box(0, -6, 2.2, 13, 30, 3, 'metal_dark');
      if (R.chance(0.6)) box(0, -6, 5.2, 13, 28, 9, burnt ? 'rust' : 'steel_painted', burnt ? 'roof_burnt' : 'roof_metal', { tint: burnt ? null : [1.6, 1.6, 1.55] });
      else box(0, -6, 5.2, 12, 26, 8, 'tarp_canvas', 'tarp_canvas');
      break;
    case 'apc':
      wheels(8, [-10, 0, 10]);
      box(0, 0, 2, 17, 32, 7, burnt ? 'rust' : 'metal_dark', roof, { tint: burnt ? null : [0.9, 1.0, 0.8] });
      box(0, -3, 9, 8, 9, 3, 'metal_dark');
      { const [x, y] = at2(0, -3); mb.beam([x, y, z0 + 10.5], [x - s * 16, y + c * 16, z0 + 10.8], 1.2, 1.2, 'metal_dark'); }
      break;
    case 'tank': {
      for (const u of [-8, 8]) box(u, 0, 0, 6, 38, 5, 'metal_dark');
      box(0, 0, 3, 18, 34, 5, burnt ? 'rust' : 'metal_dark', 'roof_burnt');
      const tr = R.range(-1.2, 1.2), [tx, ty] = at2(R.range(-2, 2), -2);
      mb.box(tx, ty, z0 + 8, 12, 14, 5, w.rot + tr, { top: 'rust', side: 'metal_dark' });
      const ga = w.rot + tr + Math.PI / 2;
      mb.beam([tx, ty, z0 + 10.5], [tx + Math.cos(ga) * 24, ty + Math.sin(ga) * 24, z0 + (R.chance(0.4) ? 4 : 10.5)], 1.8, 1.8, 'metal_dark');
      break;
    }
    case 'ambulance':
      wheels(5.6, [-10, 10]);
      box(0, 0, 2, 13, 32, 10, body, roof, { tint: burnt ? null : [2.3, 2.3, 2.25] });
      if (!burnt) { box(0, 13, 12, 9, 2.4, 1.4, 'steel_painted', 'steel_painted', { tint: [2.4, 0.4, 0.3] }); box(6.6, 0, 6, 0.3, 26, 1.6, 'steel_painted', 'steel_painted', { tint: [2.4, 0.3, 0.2] }); }
      break;
    default: { // car / police
      wheels(4.9, [-8, 8]);
      const tint = w.kind === 'police' ? [0.3, 0.32, 0.36] : paint;
      box(0, 0, 1.8, 11, 26, 3.6, body, roof, { tint });
      box(0, -1.5, 5.4, 9.4, 13, 2.8, burnt ? 'metal_dark' : 'facade_glass', roof, { tint: burnt ? null : tint });
      if (w.kind === 'police' && !burnt) { box(0, -1.5, 8.2, 8, 2.6, 1.4, 'metal_dark', 'steel_painted', { tint: [2, 2, 2.2] }); box(0, 6, 5.4, 11.2, 7, 0.3, 'steel_painted', 'steel_painted', { tint: [2.3, 2.3, 2.3] }); }
    }
  }
}

export { XW, meshVehicle, WRECK };
