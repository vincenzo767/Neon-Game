import { paintHeightfield } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { scorch, debris, crate, drum } from '../paint/props.js';
import { meshBoulder } from '../kit/terrain.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// OPEN-PIT MINE: Iron Vein's quarry (Ground level 3).
//
// A broad, flat pit floor runs up the middle (the combat corridor), worn by
// haul traffic and the fortress's own excavation passes: twin track ruts,
// old trench strips, tyre tracks, shot-blast craters, scattered stone and
// ore. Either side the quarry climbs in three terraced benches (real
// heightfield relief: steep blasted faces with strata, flat haul roads on
// top, safety berms of loose rock along the crests, slumped collapses with
// rubble fans at their feet). The benches carry the mine: haul trucks (some
// driving the bench roads), excavators working the faces, a crusher station
// with its conveyor bridge, a long conveyor run on the second bench, light
// towers, substations, fuel tanks, site huts, containers, a toppled crane,
// burnt-out machinery with fires and smoke, sparks off broken power gear,
// dust and falling stones off the faces.
//
// Everything continuous across chunks (bench edges, the conveyor run, light
// tower spacing, ruts) is a seeded function of y, so seams never show.
//
// Params (0..1 unless noted): benches (relief scale), trucks, machines,
// conveyors, fires, craters, spoil (crushed-rock heaps), cracks (fractured
// floor), veins (exposed ore), core (molten fissures + glowing veins: the
// deep pit), dusk (bool, lamps lit).

const LEN = 512;
const TAU = Math.PI * 2;
const H = (x, y, s) => sampleField('fbm', x, y, s);
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DIRT = [0.5, 0.41, 0.31];
const TOWER = 320;   // light tower spacing along the bench crests
const TRESTLE = 64;  // conveyor trestle spacing

export default {
  id: 'openpit',
  label: 'Open-pit mine',
  defaults: { benches: 1, trucks: 0.8, machines: 0.8, conveyors: 0.8, fires: 0.5, craters: 0.6, spoil: 0.4, cracks: 0, veins: 0.5, core: 0, dusk: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const R0 = new RNG(`${seed}:pit`);
    const ph = [R0.angle(), R0.angle(), R0.angle(), R0.angle()];
    // Bench edges (|x| where each step starts), per side, as functions of y.
    const e1 = (s, y) => 170 + 6 * Math.sin(y / 330 + ph[s > 0 ? 0 : 1]) + 3 * Math.sin(y / 113 + s);
    const e2 = (s, y) => e1(s, y) + 88 + 9 * Math.sin(y / 260 + ph[2] * s);
    const e3 = (s, y) => e2(s, y) + 92 + 8 * Math.sin(y / 210 + ph[3]);
    const HB = [36 * P.benches, 76 * P.benches, 118 * P.benches];
    const height = (x, y) => {
      const s = x < 0 ? -1 : 1, d = Math.abs(x);
      if (d < 150) return 0;
      const n = (H(x, y, 600) - 0.5);
      const face = sampleField('ridged', x * 0.3, y, 90) - 0.5;
      const E = [e1(s, y), e2(s, y), e3(s, y)];
      let h = 0;
      for (let k = 0; k < 3; k++) {
        const w0 = E[k] + face * 6;
        h += (HB[k] - (k ? HB[k - 1] : 0)) * sm(w0 - 3, w0 + 11, d);
      }
      // Bench tops: slightly rough; the floor near the walls: a talus of fallen stone.
      return h + n * 4 * sm(E[0], E[0] + 20, d) + Math.max(0, 1 - Math.abs(d - (E[0] - 8)) / 14) * 4 * (0.5 + n);
    };
    const S = { P, seed, height, e1, e2, e3, HB, dust: [0.56, 0.47, 0.37] };
    // Rut / trench centreline on the pit floor (where the fortress has been working).
    S.cut = (y) => 26 * Math.sin(y / 760 + ph[0]) + 12 * Math.sin(y / 290);
    S.tower = (side, m) => {
      const Rt = new RNG(`${seed}:tw:${side}:${m}`), y = m * TOWER + Rt.range(-30, 30);
      return { x: side * (e1(side, y) + 14), y, z: HB[0], down: Rt.chance(0.15), lean: Rt.range(-0.4, 0.4) };
    };
    S.layers = [{
      id: 'ground', z: 0, x0: -480, x1: 480, length: LEN, ppu: 1.05, grid: [96, 48], height, flatLight: true, glow: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
      moverMesh: (mb, m) => { meshTruck(mb, m.x, m.y, m.z, m.rot, true, m.seed); return []; },
    }];
    S.surfacesTopDown = [{ z: 0 }];
    S.floorZ = 0;
    return S;
  },
};

// ------------------------------------------------------------- layout

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, Z = S.height;
  const lay = { craters: [], rubble: [], boulders: [], trucks: [], diggers: [], crushers: [], containers: [], huts: [], subs: [], tanks: [], cranes: [], heaps: [], cracks: [], veins: [], wrecks: [], movers: [], anchors: [], debris: [], drums: [] };
  // Bench-top position on bench k (0..2) of a side, centred between its crest and the next face.
  const onBench = (side, k, y, f = 0.5) => {
    const a = k === 0 ? S.e1(side, y) : k === 1 ? S.e2(side, y) : S.e3(side, y);
    const b = k === 0 ? S.e2(side, y) : k === 1 ? S.e3(side, y) : a + 90;
    const x = side * (a + 14 + (b - a - 26) * f);
    return { x, y, z: Z(x, y) };
  };
  // Craters: shot-blast holes, fewer in the middle of the floor.
  for (let i = 0; i < 4 + 10 * P.craters; i++) {
    const x = R.range(-420, 420), y = R.range(y0, y1), mid = Math.abs(x) < 150;
    if (mid && R.chance(0.55)) continue;
    lay.craters.push({ x, y, r: R.range(8, mid ? 16 : 26), seed: R.next() });
  }
  // Collapsed faces: rubble fans at the foot of the first bench (+ dust and falling stones).
  for (const side of [-1, 1]) {
    if (!R.chance(0.6)) continue;
    const y = R.range(y0 + 40, y1 - 40), x = side * (S.e1(side, y) - 16);
    lay.rubble.push({ x, y, r: R.range(26, 44), side, seed: R.next() });
    lay.anchors.push({ type: 'rockfall', x: x + side * 20, y, z: S.HB[0] + 10, s: 1 });
    lay.anchors.push({ type: 'dust', x, y, z: 4, s: 1.2 });
  }
  // Loose boulders on the floor edges and the benches.
  for (let i = 0; i < 10; i++) {
    const side = R.sign(), y = R.range(y0, y1), k = R.int(0, 3);
    const p = k < 1 ? { x: side * R.range(20, 90), y, z: 0 } : onBench(side, k - 1, y, R.next());
    if (k < 1 && R.chance(0.7)) continue; // the pit floor stays mostly clear (the fortress works it)
    lay.boulders.push({ ...p, r: k < 1 ? R.range(3, 6) : R.range(5, 12), h: k < 1 ? R.range(3, 5) : R.range(5, 11), seed: R.next() });
  }
  // Haul trucks: parked / broken down on the benches and the floor edge; some drive the bench roads.
  for (let i = 0; i < 1 + 3 * P.trucks; i++) {
    if (!R.chance(0.65)) continue;
    const side = R.sign(), y = R.range(y0 + 30, y1 - 30), k = R.int(0, 2);
    const p = onBench(side, k, y, R.range(0.3, 0.7));
    const wreck = R.chance(0.3);
    lay.trucks.push({ ...p, rot: (R.chance(0.5) ? 0 : Math.PI) + R.range(-0.3, 0.3) + (k < 0 ? R.range(-0.6, 0.6) : 0), loaded: R.chance(0.7), wreck, seed: R.next() });
    if (wreck) lay.anchors.push({ type: R.chance(P.fires) ? 'fire' : 'smoke', x: p.x, y: p.y, z: p.z + 14, s: R.range(0.8, 1.2), dark: 0.8 });
    else lay.anchors.push({ type: 'beacon', x: p.x, y: p.y, z: p.z + 24, c: [1, 0.6, 0.1], period: 60 });
  }
  if (P.trucks > 0) for (const side of [-1, 1]) {
    if (!R.chance(0.5 * P.trucks)) continue;
    const y = R.range(y0, y1), dir = R.sign(), x = side * 212, z = Z(x, y);
    lay.movers.push({ kind: 'vehicle', x, y, z, rot: dir > 0 ? 0 : Math.PI, vx: 0, vy: dir * 0.28, w: 22, l: 40, h: 20, lights: true, seed: R.next() });
  }
  // Excavators working the faces of benches 1–2.
  for (let i = 0; i < 2 * P.machines; i++) {
    if (!R.chance(0.6)) continue;
    const side = R.sign(), y = R.range(y0 + 40, y1 - 40), k = R.int(0, 2), p = onBench(side, k, y, 0.3);
    const wreck = R.chance(0.25);
    lay.diggers.push({ ...p, side, rot: R.range(-0.5, 0.5), arm: R.range(-0.4, 0.4), wreck, seed: R.next() });
    if (wreck) lay.anchors.push({ type: 'smoke', x: p.x, y: p.y, z: p.z + 20, s: 1.1, dark: 0.85 });
  }
  // Crusher station on bench 1 or 2 with a conveyor bridge to the bench above (one per ~2 chunks).
  if (R.chance(0.55 * P.machines)) {
    const side = R.sign(), y = R.range(y0 + 80, y1 - 80), k = R.int(0, 2), p = onBench(side, k, y, 0.45);
    const top = onBench(side, Math.min(2, k + 1), y + R.range(-60, 60), 0.6);
    lay.crushers.push({ ...p, side, to: top, seed: R.next() });
    lay.anchors.push({ type: 'dust', x: p.x, y: p.y, z: p.z + 30, s: 1.3 });
    lay.anchors.push({ type: 'steam', x: p.x - side * 6, y: p.y + 8, z: p.z + 38, s: 0.6 });
  }
  // Site huts, containers, fuel tanks, substations on the upper benches.
  for (let i = 0; i < 3 * P.machines; i++) {
    if (!R.chance(0.55)) continue;
    const side = R.sign(), y = R.range(y0 + 20, y1 - 20), p = onBench(side, R.int(1, 3), y, R.next());
    const kind = R.pick(['container', 'container', 'hut', 'tank', 'sub']);
    if (kind === 'container') for (let k = 0; k < R.int(1, 4); k++) lay.containers.push({ x: p.x + R.range(-10, 10), y: p.y + k * 13, z: p.z + (k > 1 && R.chance(0.4) ? 9 : 0), rot: Math.PI / 2 + R.range(-0.1, 0.1), col: R.pick(['steel_painted', 'rust', 'steel_yellow']) });
    else if (kind === 'hut') lay.huts.push({ ...p, rot: R.range(-0.2, 0.2) + (R.chance(0.5) ? Math.PI / 2 : 0) });
    else if (kind === 'tank') { for (let k = 0; k < R.int(1, 3); k++) lay.tanks.push({ x: p.x, y: p.y + k * 22, z: p.z, r: R.range(7, 10) }); }
    else { lay.subs.push({ ...p }); lay.anchors.push({ type: 'spark', x: p.x, y: p.y, z: p.z + 16 }); }
  }
  // A toppled crane across a bench (rarely), burning.
  if (R.chance(0.2 * P.machines)) {
    const side = R.sign(), y = R.range(y0 + 60, y1 - 60), p = onBench(side, 1, y, 0.5);
    lay.cranes.push({ ...p, rot: R.range(-0.6, 0.6) + Math.PI / 2, seed: R.next() });
    lay.anchors.push({ type: R.chance(P.fires) ? 'fire' : 'smoke', x: p.x, y: p.y, z: p.z + 6, s: 1.2, dark: 0.85 });
  }
  // Spoil heaps (crushed rock) on the floor edges and benches.
  for (let i = 0; i < 6 * P.spoil; i++) {
    const side = R.sign(), y = R.range(y0, y1), k = R.int(0, 2);
    const p = onBench(side, k, y, R.next());
    lay.heaps.push({ ...p, r: R.range(14, 26), h: R.range(10, 20), seed: R.next() });
  }
  // Fractured floor (cracks) and exposed ore veins.
  for (let i = 0; i < 6 * P.cracks; i++) lay.cracks.push({ x: R.range(-200, 200), y: R.range(y0, y1), a: R.angle(), len: R.range(60, 160), seed: R.next() });
  for (let i = 0; i < 4 * (P.veins + P.core); i++) {
    const side = R.sign(), y = R.range(y0, y1);
    lay.veins.push({ x: side * R.range(120, 380), y, a: R.range(-0.5, 0.5) + (R.chance(0.5) ? Math.PI / 2 : 0), len: R.range(50, 140), seed: R.next() });
  }
  // Burnt-out machinery on the floor edges.
  for (let i = 0; i < 2 * P.fires; i++) {
    if (!R.chance(0.5)) continue;
    const side = R.sign(), y = R.range(y0, y1), p = onBench(side, R.int(0, 2), y, R.range(0.2, 0.8));
    lay.wrecks.push({ x: p.x, y, z: p.z, rot: R.angle(), seed: R.next() });
    lay.anchors.push({ type: R.chance(0.6) ? 'fire' : 'smoke', x: p.x, y, z: p.z + 6, s: R.range(0.8, 1.2), dark: 0.85 });
  }
  // Molten fissures glowing in the deep pit.
  if (P.core > 0) for (let i = 0; i < 3 * P.core; i++) {
    const x = R.sign() * R.range(130, 330), y = R.range(y0, y1);
    lay.anchors.push({ type: 'glow', x, y, z: 2, r: R.range(30, 50), c: [1, 0.35, 0.08], a: 0.35, flicker: true });
    if (R.chance(0.5)) lay.anchors.push({ type: 'steam', x, y, z: 2, s: 0.8 });
  }
  for (let i = 0; i < 6; i++) lay.debris.push({ x: R.range(-440, 440), y: R.range(y0, y1), r: R.range(10, 26) });
  for (let i = 0; i < 2; i++) if (R.chance(0.5)) { const side = R.sign(), y = R.range(y0, y1); lay.drums.push({ ...onBench(side, 1, y, R.next()), seed: R.next() }); }
  // Light towers along the first bench crest (continuous spacing in y).
  for (const side of [-1, 1]) {
    for (let m = Math.ceil(y0 / TOWER); m * TOWER < y1; m++) {
      const t = S.tower(side, m);
      if (t.down) continue;
      lay.anchors.push({ type: 'lamp', x: t.x, y: t.y, z: t.z + 44, c: [1, 0.9, 0.7], len: 12, rot: 0 });
      lay.anchors.push({ type: 'beacon', x: t.x, y: t.y, z: t.z + 47, c: [1, 0.2, 0.08], period: 90 });
    }
  }
  lay.seed = R.next();
  return lay;
}

// -------------------------------------------------------------- paint

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  const HB = S.HB;
  paintHeightfield(p, S.height, (h, slope, x, y) => {
    const n = sampleField('fbm', x, y, 220);
    // Pit floor: compacted brown dirt; benches: paler dust; faces: blasted rock with strata.
    let col = mix([0.5, 0.41, 0.31], [0.42, 0.34, 0.26], n);
    if (h > 3) col = mix(col, [0.58, 0.49, 0.38], Math.min(1, h / HB[0]));
    if (slope > 0.22) {
      const k = Math.min(1, (slope - 0.22) * 2.6);
      const strata = (Math.floor(h / 9) % 3) * 0.08;
      const rock = mix([0.44, 0.38, 0.33], [0.33, 0.29, 0.26], strata * 4 + sampleField('ridged', x * 0.3, y, 80) * 0.4);
      col = mix(col, rock, k);
      // Iron staining running down the faces.
      col = mix(col, [0.5, 0.3, 0.18], k * Math.max(0, sampleField('ridged', x * 0.15, y * 0.6, 120) - 0.55) * 1.6 * P.veins);
    }
    return col;
  }, { eps: 7, step: 2, shadows: { range: 260, steps: 9 } });
  p.noise('grain', 128 / p.ppu, 'overlay', 0.5);
  p.noise('fbm', 300, 'soft-light', 0.35);
  p.patch('fbm_60', 420, [0.36, 0.29, 0.22], 0.25);
  // Haul roads on the bench tops: lighter compacted lanes with tyre ruts.
  for (const side of [-1, 1]) {
    for (const k of [0, 1]) {
      const pts = [];
      for (let y = y0 - 20; y <= y1 + 20; y += 16) { const a = k ? S.e2(side, y) : S.e1(side, y), b = k ? S.e3(side, y) : S.e2(side, y); pts.push(side * (a + (b - a) * 0.45), y); }
      p.line(pts, 34, [0.66, 0.56, 0.44], 0.35);
      for (const o of [-8, 8]) p.line(pts.map((v, i) => (i % 2 ? v : v + o)), 3, [0.26, 0.21, 0.16], 0.35);
    }
    // Safety berm along each crest: loose rock lit on top.
    for (const k of [0, 1, 2]) {
      const pts = [];
      for (let y = y0 - 20; y <= y1 + 20; y += 12) pts.push(side * ((k === 0 ? S.e1(side, y) : k === 1 ? S.e2(side, y) : S.e3(side, y)) + 13), y);
      p.line(pts, 7, [0.32, 0.27, 0.22], 0.45);
      p.line(pts.map((v, i) => (i % 2 ? v : v - side * 1.5)), 3, [0.74, 0.65, 0.53], 0.35);
    }
  }
  // The fortress's earlier passes: old trench strip and twin track ruts down the floor.
  const cut = (off) => { const pts = []; for (let y = y0 - 24; y <= y1 + 24; y += 10) pts.push(S.cut(y) + off, y); return pts; };
  p.line(cut(0), 120, [0.3, 0.24, 0.18], 0.18);
  p.line(cut(0), 70, [0.26, 0.2, 0.15], 0.12);
  for (const s of [-1, 1]) {
    p.line(cut(s * 106), 48, [0.66, 0.56, 0.44], 0.18);
    p.line(cut(s * 106), 38, [0.3, 0.24, 0.18], 0.3);
    p.line(cut(s * 106), 32, [0.2, 0.16, 0.12], 0.16, { dash: [1.6, 2.6] });
  }
  // Haul-truck tyre tracks curving across the floor.
  const Rt = new RNG(`opt:${lay.seed}`);
  for (let i = 0; i < 3; i++) {
    const xa = Rt.range(-160, 160), amp = Rt.range(40, 120), ph = Rt.angle(), pts = [];
    for (let y = y0 - 20; y <= y1 + 20; y += 16) pts.push(xa + Math.sin(y / 300 + ph) * amp, y);
    for (const o of [-11, 11]) p.line(pts.map((v, j) => (j % 2 ? v : v + o)), 4.5, [0.25, 0.2, 0.15], 0.3, { dash: [2.4, 1.6] });
  }
  p.props(() => new RNG(`opp:${lay.seed}`), (Rp) => {
    for (const L of all) for (const cr of L.craters) crater(p, new RNG(`opc:${cr.seed}`), cr.x, cr.y, cr.r);
    for (const L of all) for (const r of L.rubble) {
      const Rr = new RNG(`opr:${r.seed}`);
      p.radial(r.x, r.y, r.r * 1.4, [[0, [0.3, 0.26, 0.22], 0.6], [1, [0.4, 0.34, 0.28], 0]]);
      debris(p, Rr, r.x, r.y, r.r, 60, { color: [0.42, 0.36, 0.3] });
    }
    for (const L of all) for (const v of L.veins) vein(p, new RNG(`opv:${v.seed}`), v, P.core);
    for (const L of all) for (const k of L.cracks) { const Rk = new RNG(`opk:${k.seed}`); p.crack(Rk, k.x, k.y, k.a, k.len, 1.6, [0.08, 0.06, 0.05], 0.85, 4); }
    for (const L of all) for (const h of L.heaps) { p.radial(h.x, h.y, h.r * 1.5, [[0, [0.2, 0.17, 0.14], 0.45], [1, [0.2, 0.17, 0.14], 0]]); p.shadowCircle(h.x, h.y, h.r * 0.8, h.h, h.z, 10); }
    for (const L of all) for (const t of L.trucks) { if (t.wreck) scorch(p, new RNG(`ops:${t.seed}`), t.x, t.y, 30); p.shadowBox(t.x, t.y, 24, 40, t.z + 20, t.rot); }
    for (const L of all) for (const d of L.diggers) p.shadowBox(d.x, d.y, 30, 34, d.z + 22, d.rot);
    for (const L of all) for (const k of L.crushers) p.shadowBox(k.x, k.y, 44, 40, k.z + 34, 0);
    for (const L of all) for (const k of L.huts) p.shadowBox(k.x, k.y, 22, 14, k.z + 10, k.rot);
    for (const L of all) for (const k of L.containers) p.shadowBox(k.x, k.y, 10, 24, k.z + 10, k.rot);
    for (const L of all) for (const k of L.tanks) p.shadowCircle(k.x, k.y, k.r, k.z + 14, k.z, 10);
    for (const L of all) for (const b of L.boulders) p.shadowCircle(b.x, b.y, b.r * 0.85, b.z + b.h, b.z, 8);
    for (const L of all) for (const w of L.wrecks) { scorch(p, new RNG(`opw:${w.seed}`), w.x, w.y, 26); p.shadowBox(w.x, w.y, 18, 30, w.z + 10, w.rot); }
    for (const L of all) for (const d of L.debris) debris(p, Rp, d.x, d.y, d.r, 24, { color: [0.36, 0.3, 0.25] });
    for (const L of all) for (const d of L.drums) {
      const Rd = new RNG(`opd:${d.seed}`);
      for (let k = 0; k < 5; k++) drum(p, d.x + Rd.range(-12, 12), d.y + Rd.range(-12, 12), { color: Rd.pick([[0.55, 0.42, 0.12], [0.42, 0.2, 0.12], [0.3, 0.3, 0.28]]) });
      for (let k = 0; k < 3; k++) crate(p, Rd, d.x + Rd.range(-14, 14), d.y + Rd.range(-14, 14), Rd.range(4, 7), Rd.range(-0.4, 0.4), { color: [0.42, 0.33, 0.22] });
    }
    // Scattered stones and ore lumps over everything.
    for (let i = 0; i < 160; i++) {
      const x = Rp.range(-470, 470), y = Rp.range(y0, y1), r = Rp.range(0.8, 2.6);
      const ore = Rp.chance(0.15 * (P.veins + 0.3));
      p.circlePath(x, y, r).fill(ore ? [0.56, 0.3, 0.16] : shade(DIRT, Rp.range(0.55, 1.3)), 0.9);
    }
    // Tower shadows on the first bench.
    for (const side of [-1, 1]) for (let m = Math.floor((y0 - 200) / TOWER); m <= Math.ceil((y1 + 200) / TOWER); m++) {
      const t = S.tower(side, m);
      if (!t.down) p.shadowCircle(t.x, t.y, 1.6, t.z + 46, t.z, 6);
    }
  }, 0.5, 2.6);
  // Lights: fires glow on the ground, molten fissures in the deep pit.
  if (p.env.glow) {
    for (const L of all) for (const a of L.anchors) {
      if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.45, 0.12], 0.5], [1, [1, 0.3, 0.05], 0]], 'lighter');
      if (a.type === 'glow') p.env.glow.radial(a.x, a.y, a.r * 1.2, [[0, [1, 0.4, 0.08], 0.35], [1, [1, 0.25, 0.04], 0]], 'lighter');
    }
    if (P.core > 0) for (const L of all) for (const v of L.veins) {
      const Rv = new RNG(`opv:${v.seed}`), pts = veinPts(Rv, v);
      p.env.glow.line(pts, 6, [1, 0.42, 0.1], 0.65 * P.core, { op: 'lighter' });
      p.env.glow.line(pts, 2, [1, 0.8, 0.4], 0.8 * P.core, { op: 'lighter' });
    }
  }
}

function veinPts(R, v) {
  const pts = [];
  let x = v.x, y = v.y, a = v.a;
  for (let d = 0; d < v.len; d += 12) { pts.push(x, y); a += R.range(-0.35, 0.35); x += Math.cos(a) * 12; y += Math.sin(a) * 12; }
  return pts;
}

/** Exposed ore vein: rusty / dark seam with oxidised halo (molten in the deep pit). */
function vein(p, R, v, core) {
  const pts = veinPts(R, v);
  p.line(pts, 14, [0.5, 0.27, 0.14], 0.35);
  p.line(pts, 5, core > 0 ? [0.85, 0.36, 0.1] : [0.32, 0.18, 0.12], 0.8);
  for (let k = 0; k < pts.length; k += 2) if (R.chance(0.5)) p.circlePath(pts[k] + R.range(-6, 6), pts[k + 1] + R.range(-6, 6), R.range(1.2, 3)).fill([0.6, 0.32, 0.16], 0.85);
}

/** Blast crater in dirt: ejecta, lit rim, dark bowl. */
function crater(p, R, x, y, r) {
  const s = p.sun;
  p.radial(x, y, r * 2.2, [[0, [0.28, 0.22, 0.17], 0.5], [0.6, [0.38, 0.31, 0.24], 0.25], [1, [0.5, 0.42, 0.33], 0]]);
  for (let i = 0; i < 20; i++) {
    const a = R.angle(), d = r * R.range(1.1, 2.2), rr = R.range(0.6, 2.4);
    p.circlePath(x + Math.cos(a) * d, y + Math.sin(a) * d, rr).fill(shade(DIRT, R.range(0.5, 1.2)), 0.85);
  }
  p.circlePath(x, y, r * 1.2).fill([0.45, 0.37, 0.29], 0.95);
  p.ctx.save(); p.circlePath(x, y, r * 1.2); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.3, y - s.dy * r * 0.3, r * 1.12).fill([0.62, 0.53, 0.42], 0.85);
  p.ctx.restore();
  p.circlePath(x, y, r).fill([0.18, 0.14, 0.11]);
  p.radial(x, y, r, [[0, [0.08, 0.06, 0.05], 1], [0.7, [0.16, 0.13, 0.1], 0.6], [1, [0.22, 0.18, 0.14], 0]]);
  for (let i = 0; i < 4; i++) { const a = R.angle(); p.crack(R, x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, a, r * R.range(0.6, 1.3), 0.6, [0.12, 0.1, 0.08], 0.5, 1); }
}

// --------------------------------------------------------------- mesh

function mesh(mb, lay, S) {
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, b.z > 1 ? 'rock' : 'rock_dark', b.z);
  for (const r of lay.rubble) {
    const R = new RNG(`opr:${r.seed}`);
    for (let k = 0; k < 9; k++) { const a = R.angle(), d = R.range(0, r.r); meshBoulder(mb, r.x + Math.cos(a) * d, r.y + Math.sin(a) * d * 1.3, R.range(3, 8), R.range(3, 9), R.next(), R.chance(0.5) ? 'rock' : 'rock_dark', 0); }
  }
  for (const h of lay.heaps) {
    const R = new RNG(`oph:${h.seed}`), seg = 9, prof = [[h.r, h.z], [h.r * 0.75, h.z + h.h * 0.45], [h.r * 0.4, h.z + h.h * 0.85], [h.r * 0.08, h.z + h.h]];
    mb.lathe(h.x, h.y, prof, R.chance(0.5) ? 'rock' : 'dirt', { seg });
  }
  for (const t of lay.trucks) meshTruck(mb, t.x, t.y, t.z, t.rot, t.loaded, t.seed, t.wreck);
  for (const d of lay.diggers) meshDigger(mb, d);
  for (const k of lay.crushers) meshCrusher(mb, k);
  for (const k of lay.containers) mb.box(k.x, k.y, k.z, 10, 24, 9.5, k.rot, { top: 'roof_metal', side: k.col });
  for (const k of lay.huts) { mb.box(k.x, k.y, k.z, 22, 14, 9, k.rot, { top: 'roof_metal', side: 'steel_painted' }); mb.box(k.x, k.y, k.z + 9, 23, 15, 1.2, k.rot, { top: 'roof_metal', side: 'metal_dark' }); }
  for (const k of lay.tanks) { mb.lathe(k.x, k.y, [[k.r, k.z], [k.r, k.z + 13], [k.r * 0.85, k.z + 15], [k.r * 0.2, k.z + 16]], 'steel_painted', { seg: 14 }); mb.beam([k.x + k.r, k.y, k.z], [k.x + k.r, k.y, k.z + 15], 0.8, 0.8, 'metal_dark'); }
  for (const k of lay.subs) meshSub(mb, k);
  for (const k of lay.cranes) meshCrane(mb, k);
  for (const w of lay.wrecks) {
    const R = new RNG(`opw:${w.seed}`), c = Math.cos(w.rot), s = Math.sin(w.rot);
    mb.box(w.x, w.y, w.z + 0.5, 16, 28, 7, w.rot, { top: 'roof_burnt', side: 'metal_dark' });
    mb.box(w.x + s * 8, w.y - c * 8, w.z + 7.5, 12, 10, 6, w.rot + R.range(-0.3, 0.3), { top: 'rust', side: 'metal_dark' });
  }
  // Conveyor run along bench 2 (left side): belt on trestles, continuous in y.
  if (S.P.conveyors > 0) {
    const side = -1, y0 = lay.y0, y1 = lay.y1;
    const at = (y) => [side * (S.e2(side, y) + 54), y, S.HB[1]];
    for (let m = Math.floor(y0 / TRESTLE); m * TRESTLE < y1; m++) {
      const ya = m * TRESTLE, yb = ya + TRESTLE, A = at(ya), B = at(yb);
      const za = A[2] + 16, zb = B[2] + 16;
      for (const o of [-4, 4]) mb.beam([A[0] + o, A[1], za], [B[0] + o, B[1], zb], 1.4, 2.4, 'steel_yellow');
      mb.beam([A[0], A[1], za + 1.4], [B[0], B[1], zb + 1.4], 7, 0.8, 'rust');
      for (const o of [-4, 4]) mb.beam([A[0] + o, A[1], A[2]], [A[0] + o, A[1], za], 1.2, 1.2, 'metal_dark');
      mb.beam([A[0] - 5, A[1], za - 6], [A[0] + 5, A[1], za - 6], 1, 1, 'metal_dark');
    }
  }
  // Light towers (lattice mast + lamp head) along the first bench crest.
  for (const side of [-1, 1]) {
    for (let m = Math.ceil(lay.y0 / TOWER); m * TOWER < lay.y1; m++) {
      const t = S.tower(side, m);
      if (t.down) { mb.beam([t.x, t.y, t.z + 1], [t.x + Math.cos(t.lean + side) * 44, t.y + Math.sin(t.lean + side) * 44, t.z + 1], 2.4, 2.4, 'lattice_grey'); continue; }
      mb.box(t.x, t.y, t.z, 8, 8, 2, 0, { top: 'concrete', side: 'concrete' });
      mb.beam([t.x, t.y, t.z + 2], [t.x, t.y, t.z + 44], 2.4, 2.4, 'lattice_grey');
      mb.box(t.x, t.y, t.z + 43, 14, 5, 3.5, 0, { top: 'metal_dark', side: 'metal_dark' });
    }
  }
}

/** Mining haul truck: chassis, tipper body (loaded with ore), cab deck, big tyres. */
function meshTruck(mb, x, y, z, rot, loaded, seed, wreck = false) {
  const R = new RNG(`optr:${seed}`), c = Math.cos(rot), s = Math.sin(rot);
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const box = (u, v, zz, w, d, h, o) => { const [px, py] = at(u, v); mb.box(px, py, z + zz, w, d, h, rot, o); };
  const paint = wreck ? 'rust' : 'steel_yellow';
  // Tyres (dark blocks), axles front + twin rear.
  for (const v of [13, -8, -15]) for (const u of [-11, 11]) box(u, v, 0, 6, 9, 10, { top: 'metal_dark', side: 'metal_dark' });
  box(0, 0, 4, 16, 38, 5, { top: 'metal_dark', side: 'metal_dark' });
  // Tipper body: sloped prism, load on top.
  box(0, -6, 9, 22, 28, 9, { top: paint, side: paint });
  box(0, 9, 11, 22, 4, 9, { top: paint, side: paint });
  if (loaded && !wreck) {
    const [lx, ly] = at(0, -6);
    mb.lathe(lx, ly, [[10, z + 17], [8, z + 20], [4, z + 22], [1, z + 22.5]], R.chance(0.5) ? 'rock' : 'rock_dark', { seg: 8 });
  }
  // Canopy over the cab, cab + deck at the front-left, radiator grille.
  box(0, 13, 18, 22, 8, 1.4, { top: paint, side: paint });
  box(-6, 15, 9, 9, 7, 8, { top: 'roof_metal', side: wreck ? 'roof_burnt' : 'steel_painted' });
  box(5, 17, 8, 9, 3, 5, { top: 'metal_dark', side: 'grating' });
  if (wreck) box(R.range(-4, 4), R.range(-8, 4), 18, 8, 10, 3, { top: 'roof_burnt', side: 'rust' });
}

/** Hydraulic excavator: tracks, turntable, house, counterweight, boom, stick, bucket. */
function meshDigger(mb, d) {
  const c = Math.cos(d.rot), s = Math.sin(d.rot), side = d.side, z = d.z;
  const at = (u, v) => [d.x + u * c - v * s, d.y + u * s + v * c];
  const box = (u, v, zz, w, dd, h, o, r = 0) => { const [px, py] = at(u, v); mb.box(px, py, z + zz, w, dd, h, d.rot + r, o); };
  const paint = d.wreck ? 'rust' : 'steel_yellow';
  for (const u of [-10, 10]) box(u, 0, 0, 7, 32, 7, { top: 'metal_dark', side: 'metal_dark' });
  const [tx, ty] = at(0, 0);
  mb.lathe(tx, ty, [[8, z + 7], [8, z + 9]], 'metal_dark', { seg: 12 });
  box(0, 0, 9, 18, 20, 9, { top: d.wreck ? 'roof_burnt' : paint, side: paint });
  box(0, 10, 9, 18, 6, 7, { top: 'metal_dark', side: 'metal_dark' });          // counterweight (rear)
  box(-5, -6, 18, 7, 7, 6, { top: 'roof_metal', side: 'grating' });           // cab
  // Boom reaching toward the bench face (outward), stick down, bucket.
  const out = side * 1, b0 = [tx - s * 0 + out * 0, ty, z + 16];
  const ang = (side > 0 ? 0 : Math.PI) + d.arm;
  const b1 = [b0[0] + Math.cos(ang) * 30, b0[1] + Math.sin(ang) * 30, z + 30];
  const b2 = [b1[0] + Math.cos(ang) * 14, b1[1] + Math.sin(ang) * 14, z + 8];
  mb.beam(b0, b1, 4, 4, paint);
  mb.beam(b1, b2, 3, 3, paint);
  mb.box(b2[0], b2[1], z + 2, 8, 6, 6, ang + Math.PI / 2, { top: 'metal_dark', side: 'metal_dark' });
}

/** Crusher station: frame, feed hopper, jaw house, conveyor bridge up to the next bench. */
function meshCrusher(mb, k) {
  const z = k.z;
  mb.box(k.x, k.y, z, 40, 34, 18, 0, { top: 'concrete', side: 'concrete_dark' });
  mb.box(k.x, k.y, z + 18, 30, 26, 12, 0, { top: 'roof_metal', side: 'steel_yellow' });
  mb.lathe(k.x - k.side * 6, k.y + 6, [[6, z + 30], [13, z + 40], [14, z + 42]], 'rust', { seg: 4 });
  for (const [dx, dy] of [[-18, -15], [18, -15], [-18, 15], [18, 15]]) mb.beam([k.x + dx, k.y + dy, z], [k.x + dx, k.y + dy, z + 30], 2, 2, 'steel_yellow');
  // Conveyor bridge.
  const A = [k.x + k.side * 18, k.y, z + 26], B = [k.to.x, k.to.y, k.to.z + 30];
  for (const o of [-4, 4]) mb.beam([A[0], A[1] + o, A[2]], [B[0], B[1] + o, B[2]], 1.5, 3, 'lattice');
  mb.beam([A[0], A[1], A[2] + 2], [B[0], B[1], B[2] + 2], 7, 0.8, 'rust');
  const n = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 40));
  for (let j = 1; j < n; j++) {
    const t = j / n, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, zt = A[2] + (B[2] - A[2]) * t;
    const zg = Math.max(z, Math.min(zt - 2, k.to.z));
    mb.beam([x, y, zt > k.to.z + 4 ? k.to.z : z], [x, y, zt], 1.6, 1.6, 'metal_dark');
    void zg;
  }
  mb.box(B[0], B[1], k.to.z, 10, 10, 30, 0, { top: 'rust', side: 'steel_yellow' });
}

/** Electrical substation: pad, transformers, insulators, a pole. */
function meshSub(mb, k) {
  const z = k.z;
  mb.box(k.x, k.y, z, 26, 20, 1.5, 0, { top: 'concrete', side: 'concrete' });
  for (const dx of [-7, 7]) {
    mb.box(k.x + dx, k.y, z + 1.5, 9, 10, 9, 0, { top: 'metal_dark', side: 'steel_painted' });
    for (const dy of [-3, 3]) mb.lathe(k.x + dx, k.y + dy, [[1, z + 10.5], [1.6, z + 12], [1, z + 13], [1.4, z + 14]], 'concrete', { seg: 6 });
  }
  mb.beam([k.x + 14, k.y + 9, z], [k.x + 14, k.y + 9, z + 30], 1.6, 1.6, 'timber');
  mb.beam([k.x + 8, k.y + 9, z + 28], [k.x + 20, k.y + 9, z + 28], 1, 1, 'timber');
}

/** Toppled lattice crane lying across a bench. */
function meshCrane(mb, k) {
  const R = new RNG(`opcr:${k.seed}`), c = Math.cos(k.rot), s = Math.sin(k.rot), z = k.z;
  mb.box(k.x, k.y, z, 16, 16, 8, k.rot, { top: 'roof_burnt', side: 'rust' });
  const len = R.range(80, 110), A = [k.x, k.y, z + 6], B = [k.x + c * len, k.y + s * len, z + 2];
  for (const o of [-3, 3]) mb.beam([A[0] - s * o, A[1] + c * o, A[2]], [B[0] - s * o, B[1] + c * o, B[2]], 1.2, 1.2, 'steel_yellow');
  for (let j = 0; j < 10; j++) {
    const t = j / 10, t2 = (j + 0.5) / 10;
    mb.beam([A[0] + (B[0] - A[0]) * t - s * 3, A[1] + (B[1] - A[1]) * t + c * 3, A[2] + (B[2] - A[2]) * t], [A[0] + (B[0] - A[0]) * t2 + s * 3, A[1] + (B[1] - A[1]) * t2 - c * 3, A[2] + (B[2] - A[2]) * t2 + 3], 0.8, 0.8, 'steel_yellow');
  }
}

export { TAU };
