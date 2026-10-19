import { asphalt, concrete, dirt, snow as snowSurf } from '../paint/surfaces.js';
import { car, truck, bus, tank, rubble, debris, scorch, crater, skid, lamp, tree, manhole, carColor, crate, sandbags, drum, puddle } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding, buildingAnchors, meshCrane, shadowCrane, meshSkeleton, meshBillboard, meshTent, meshCanopy } from '../kit/city.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// ELEVATED HIGHWAY through a city district (urban battlefield).
//
// Layers
//   ground  z = 0    street under the overpass, sidewalks, city blocks with
//                    buildings (solids), parking, cross streets; deck shadow
//   deck    z = 72   six-lane elevated carriageway: worn asphalt, markings,
//                    joints, wrecks, craters, collapsed sections (holes cut
//                    through to the ground), parapets, median barrier,
//                    light poles, sign gantries
//
// Params (arena config `params`):
//   fires 0..1      burning wrecks on the deck
//   damage 0..1     craters, debris, cracks
//   collapse 0..1   chance of a collapsed deck section per 900 units
//   cityBurn 0..1   burning / collapsed buildings
//   traffic 0..1    abandoned vehicles
//   military 0..1   military vehicles, sandbag checkpoints
//   lamps 0..1      street lights on (dusk / night)
//   snow 0..1       snow cover (winter variant)
//   night           lit windows

const LEN = 512;
const DECK_Z = 72, DECK_T = 11, HALF = 100;
const LANES = [9, 31, 53, 75];        // lane boundaries (right carriageway; mirrored)
const PIER_STEP = 128;
const CROSS_STEP = 380;

const hash = (n, s) => new RNG(`hw:${s}:${n}`).next();

export default {
  id: 'highway',
  label: 'Elevated highway through a city district',
  defaults: { fires: 0.5, damage: 0.5, collapse: 0.35, cityBurn: 0.25, traffic: 0.6, military: 0.2, lamps: 0, snow: 0, night: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    // Collapsed deck sections: one candidate per 900 units.
    const gapAt = (m) => {
      if (m < 1 || hash(m, `${seed}:gap`) > P.collapse) return null;
      const R = new RNG(`${seed}:gap:${m}`);
      const y0 = m * 900 + R.range(100, 600), len = R.range(60, 110);
      const side = R.chance(0.25) ? 0 : R.sign(); // 0 = full width
      return { y0, y1: y0 + len, side, jag: R.range(0, 1000) };
    };
    const gapsIn = (y0, y1) => {
      const out = [];
      for (let m = Math.floor((y0 - 200) / 900); m <= Math.floor((y1 + 200) / 900); m++) { const g = gapAt(m); if (g && g.y1 > y0 && g.y0 < y1) out.push(g); }
      return out;
    };
    // Cross streets under the deck.
    const crossAt = (m) => m * CROSS_STEP + hash(m, `${seed}:cross`) * 70;
    const crossIn = (y0, y1) => {
      const out = [];
      for (let m = Math.floor(y0 / CROSS_STEP) - 1; m <= Math.floor(y1 / CROSS_STEP) + 1; m++) { const y = crossAt(m); if (y > y0 - 40 && y < y1 + 40) out.push({ m, y }); }
      return out;
    };
    const S = { P, seed, gapsIn, crossIn, crossAt };
    const snowy = P.snow > 0;

    S.layers = [
      {
        id: 'ground', z: 0, x0: -460, x1: 460, length: LEN, ppu: 1.35, glow: P.lamps > 0 || P.fires > 0,
        layout: (c) => layoutGround(c, S),
        paint: (p, lay, nb, c) => paintGround(p, lay, nb, c, S),
        mesh: (mb, lay) => {
          for (const b of lay.buildings) {
            meshBuilding(mb, b);
            if (b.bill) meshBillboard(mb, b.bill.x, b.y, b.h + 2.6, 46, 18, b.bill.face, b.bill.mat);
          }
          for (const lt of lay.lots) {
            if (lt.kind === 'construction') { meshSkeleton(mb, lt.frame); meshCrane(mb, lt.crane.x, lt.crane.y, lt.crane.h, lt.crane.rot, { jib: lt.crane.jib }); }
            else if (lt.kind === 'gas') { meshCanopy(mb, lt.x, lt.y + lt.d * 0.12, lt.w * 0.6, lt.d * 0.45, 14); mb.box(lt.x, lt.y - lt.d * 0.32, 0, lt.w * 0.45, lt.d * 0.22, 12, 0, { top: 'roof_metal', side: 'facade_concrete' }); }
            else if (lt.kind === 'checkpoint') for (const tn of lt.tents) meshTent(mb, tn.x, tn.y, 18, 30, 12, tn.rot);
          }
          for (const pr of lay.piers) {
            for (const sx of [-1, 1]) mb.lathe(sx * 52, pr.y, [[10, 0], [9, DECK_Z - DECK_T - 8], [11, DECK_Z - DECK_T - 6]], 'concrete', { seg: 14, top: false });
            mb.box(0, pr.y, DECK_Z - DECK_T - 8, 150, 16, 8, 0, { top: 'concrete', side: 'concrete_dark' });
          }
          for (const s of lay.slabs) fallenSlab(mb, s);
        },
      },
      {
        id: 'deck', z: DECK_Z, x0: -HALF, x1: HALF, length: LEN, ppu: 2.0, cut: true, glow: P.fires > 0 || P.lamps > 0,
        layout: (c) => layoutDeck(c, S),
        paint: (p, lay, nb, c) => paintDeck(p, lay, nb, c, S),
        mesh: (mb, lay) => meshDeck(mb, lay, S),
      },
    ];
    S.snowy = snowy;
    S.dust = snowy ? [0.75, 0.78, 0.82] : [0.46, 0.43, 0.39];
    // Walkable surfaces, top first (impacts land on the deck where it exists).
    const onDeck = (x, y) => Math.abs(x) < HALF && !gapsIn(y - 1, y + 1).some((g) => y > g.y0 && y < g.y1 && (g.side === 0 || Math.sign(x) === g.side));
    S.surfacesTopDown = [{ z: DECK_Z, contains: onDeck }, { z: 0 }];
    return S;
  },
};

// ================================================================== deck

function layoutDeck(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const gaps = S.gapsIn(y0 - 60, y1 + 60);
  const inGap = (x, y, m = 6) => gaps.some((g) => y > g.y0 - m && y < g.y1 + m && (g.side === 0 || Math.sign(x) === g.side));
  const lay = { gaps, vehicles: [], craters: [], debris: [], skids: [], anchors: [], lamps: [], gantries: [], patches: [] };
  // Vehicles: abandoned traffic, wrecks, burning hulks, military.
  const nVeh = Math.round(R.range(4, 9) * P.traffic + 2);
  for (let i = 0; i < nVeh; i++) {
    const side = R.sign(), lane = R.int(0, 2);
    const x = side * ((LANES[lane] + LANES[lane + 1]) / 2 + R.range(-4, 4));
    const y = R.range(y0 + 30, y1 - 30);
    if (inGap(x, y, 30)) continue;
    const roll = R.next();
    const kind = roll < 0.08 ? 'bus' : roll < 0.24 ? 'truck' : roll < 0.24 + 0.2 * P.military ? 'tank' : 'car';
    const burning = R.chance(P.fires * 0.55);
    const crashed = R.chance(0.35 + P.damage * 0.3);
    const rot = (side > 0 ? 0 : Math.PI) + (crashed ? R.range(-0.9, 0.9) : R.range(-0.08, 0.08));
    if (lay.vehicles.some((v) => Math.hypot(v.x - x, v.y - y) < 40)) continue;
    lay.vehicles.push({ kind, x, y, rot, burnt: burning || R.chance(P.damage * 0.25), color: carColor(R), carKind: R.pick(['sedan', 'sedan', 'hatch', 'suv', 'van']) });
    if (burning) lay.anchors.push({ type: 'fire', x, y, z: DECK_Z + 5, s: kind === 'car' ? R.range(0.8, 1.2) : R.range(1.2, 1.7) });
    else if (crashed && R.chance(0.4)) lay.anchors.push({ type: 'smoke', x, y, z: DECK_Z + 4, s: R.range(0.6, 1), dark: 0.6 });
    if (crashed) lay.skids.push({ x, y, rot, len: R.range(40, 90) });
  }
  // Craters, patches and debris fields.
  const nCr = Math.round(R.range(1, 4) * P.damage);
  for (let i = 0; i < nCr; i++) {
    const x = R.range(-HALF + 14, HALF - 14), y = R.range(y0 + 20, y1 - 20);
    if (inGap(x, y, 20)) continue;
    lay.craters.push({ x, y, r: R.range(7, 15), seed: R.next() });
    if (R.chance(P.fires * 0.4)) lay.anchors.push({ type: 'fire', x, y, z: DECK_Z + 1, s: 0.55 });
  }
  for (let i = 0; i < 3 + 6 * P.damage; i++) lay.debris.push({ x: R.range(-HALF + 8, HALF - 8), y: R.range(y0 + 10, y1 - 10), r: R.range(10, 30), seed: R.next() });
  for (let i = 0; i < 4; i++) lay.patches.push({ x: R.range(-80, 80), y: R.range(y0, y1), w: R.range(14, 40), d: R.range(12, 50) });
  // Light poles on the median every 64 units.
  for (let y = Math.ceil(y0 / 64) * 64; y < y1; y += 64) {
    if (inGap(0, y, 4)) continue;
    const broken = R.chance(0.2 + P.damage * 0.3);
    lay.lamps.push({ y, broken, on: !broken && R.chance(P.lamps) });
    if (!broken && lay.lamps[lay.lamps.length - 1].on) for (const s of [-1, 1]) lay.anchors.push({ type: 'lamp', x: s * 15, y, z: DECK_Z + 46, c: [1, 0.78, 0.48] });
    if (broken && R.chance(0.3)) lay.anchors.push({ type: 'spark', x: 0, y, z: DECK_Z + 40 });
  }
  // Sign gantry: one candidate per chunk.
  if (R.chance(0.45)) {
    const y = R.range(y0 + 60, y1 - 60);
    if (!inGap(0, y, 40)) lay.gantries.push({ y, signs: R.int(2, 3), tilt: R.chance(P.damage * 0.4) ? R.range(-0.15, 0.15) : 0 });
  }
  lay.seed = R.next();
  return lay;
}

/** Jagged collapse outline across the deck. */
function gapPoly(g, x0 = -HALF - 2, x1 = HALF + 2) {
  const R = new RNG(`gap:${g.jag}`);
  const xa = g.side > 0 ? 0 : x0, xb = g.side < 0 ? 0 : x1;
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) pts.push(xa + ((xb - xa) * i) / n, g.y0 + R.range(-7, 7));
  for (let i = n; i >= 0; i--) pts.push(xa + ((xb - xa) * i) / n, g.y1 + R.range(-7, 7));
  return pts;
}

function paintDeck(p, lay, nb, c, S) {
  const P = S.P, { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  // Asphalt carriageway + concrete edge strips.
  asphalt(p, { color: [0.2, 0.2, 0.205], wear: 1.2, dust: S.snowy ? null : [0.36, 0.33, 0.3], dustAlpha: 0.22 });
  for (const s of [-1, 1]) {
    concrete(p, { path: () => p.rectPath(s > 0 ? 95 : -HALF - 2, y0 - 4, 7, y1 - y0 + 8), color: [0.5, 0.49, 0.46] });
  }
  concrete(p, { path: () => p.rectPath(-5, y0 - 4, 10, y1 - y0 + 8), color: [0.47, 0.46, 0.44] });
  // Wheel-path polishing and oil drips in each lane.
  for (const s of [-1, 1]) for (let l = 0; l < 3; l++) {
    const cx = s * (LANES[l] + LANES[l + 1]) / 2;
    for (const o of [-6, 6]) p.rectPath(cx + o - 2.5, y0 - 4, 5, y1 - y0 + 8).fill([0.27, 0.27, 0.27], 0.18);
    p.rectPath(cx - 1.5, y0 - 4, 3, y1 - y0 + 8).fill([0.05, 0.05, 0.05], 0.22);
  }
  // Repair patches.
  for (const q of lay.patches) p.rectPath(q.x - q.w / 2, q.y - q.d / 2, q.w, q.d).fill([0.13, 0.13, 0.14], 0.55);
  // Markings (worn): dashed lane lines, edge lines, yellow inner edge.
  p.layer(() => {
    for (const s of [-1, 1]) {
      for (const x of [LANES[1], LANES[2]]) p.line([s * x, y0 - 30, s * x, y1 + 30], 1.3, [0.92, 0.92, 0.88], 1, { dash: [18, 26], dashOffset: -((y0 - 30) % 44) });
      p.line([s * LANES[3], y0 - 4, s * LANES[3], y1 + 4], 1.4, [0.92, 0.92, 0.88], 1);
      p.line([s * LANES[0], y0 - 4, s * LANES[0], y1 + 4], 1.2, [0.9, 0.72, 0.12], 1);
      // Hatched gore near the shoulder now and then.
    }
  }, { wear: ['fine_60', 60, 1], alpha: 0.8 });
  // Expansion joints.
  for (let y = Math.ceil(y0 / 256) * 256 + 40; y < y1; y += 256) {
    p.rectPath(-HALF, y - 1.6, HALF * 2, 3.2).fill([0.12, 0.12, 0.12], 0.9);
    p.line([-HALF, y, HALF, y], 0.5, [0.55, 0.55, 0.55], 0.7, { dash: [2, 2] });
  }
  // Cracks.
  const R = new RNG(`deckcrack:${lay.seed}`);
  for (let i = 0; i < 6 + 10 * P.damage; i++) p.crack(R, R.range(-90, 90), R.range(y0, y1), R.angle(), R.range(15, 60), 0.7);
  // Snow cover (winter variant): banked against barriers, thinner in the wheel paths.
  if (S.snowy) {
    p.patch('fbm_35', 360, [0.86, 0.89, 0.94], 0.55 * P.snow);
    for (const s of [-1, 1]) { p.linear(s * 70, 0, s * 98, 0, [[0, [0.86, 0.9, 0.95], 0], [1, [0.9, 0.93, 0.97], 0.95 * P.snow]], () => p.rectPath(s > 0 ? 70 : -98, y0 - 4, 28, y1 - y0 + 8)); }
  }
  // Craters, scorch, debris, wrecks — props with shadows under them.
  p.props(() => new RNG(`deckprops:${lay.seed}`), (Rp) => {
    for (const L of all) for (const k of L.skids) {
      // Trail behind the car, bending back toward the lane it left.
      const fx = -Math.sin(k.rot), fy = Math.cos(k.rot), lane = Math.sign(fy) || 1, pts = [];
      for (let t = 0; t <= 1.001; t += 0.125) { const bend = t * t; pts.push(k.x - fx * k.len * t * (1 - bend), k.y - fy * k.len * t * (1 - bend) - lane * k.len * bend); }
      skid(p, pts, 8, 0.3);
    }
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`cr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2.2); crater(p, Rc, cr.x, cr.y, cr.r, { rim: [0.32, 0.31, 0.3] }); }
    for (const L of all) for (const d of L.debris) debris(p, new RNG(`db:${d.seed}`), d.x, d.y, d.r, Math.round(d.r * 1.3));
    for (const L of all) for (const v of L.vehicles) {
      if (v.kind === 'car') car(p, v.x, v.y, v.rot, { color: v.color, kind: v.carKind, burnt: v.burnt, wrecked: !v.burnt });
      else if (v.kind === 'truck') truck(p, v.x, v.y, v.rot, { burnt: v.burnt, cab: v.color, cargo: Rp.pick(['box', 'tank', 'canvas']) });
      else if (v.kind === 'bus') bus(p, v.x, v.y, v.rot, { burnt: v.burnt });
      else tank(p, v.x, v.y, v.rot, { burnt: v.burnt, turret: Rp.range(-0.8, 0.8) });
    }
    // Light poles (median) with their long shadows across the lanes.
    for (const L of all) for (const lp of L.lamps) {
      if (lp.broken) { p.line([0, lp.y, Rp.range(-30, 30), lp.y + Rp.range(-40, 40)], 1.4, [0.3, 0.3, 0.32], 0.9); continue; }
      for (const s of [-1, 1]) lamp(p, 0, lp.y, s, { h: 46, arm: 14, on: lp.on, shadowOnly: true });
    }
    // Gantry posts' shadows.
    for (const L of all) for (const gt of L.gantries) p.shadow([-HALF, gt.y - 2, HALF, gt.y - 2, HALF, gt.y + 2, -HALF, gt.y + 2], 50, 40);
    // Parapet + median barrier shadows.
    for (const s of [-1, 1]) p.shadow([s * 96, y0 - 4, s * 100, y0 - 4, s * 100, y1 + 4, s * 96, y1 + 4], 8);
    p.shadow([-2, y0 - 4, 2, y0 - 4, 2, y1 + 4, -2, y1 + 4], 7);
  }, 0.6, 1.6);
  // Glow under fires (emissive map).
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 26 * a.s, [[0, [1, 0.42, 0.1], 0.65], [1, [1, 0.3, 0.05], 0]], 'lighter');
  // Cut the collapsed sections out of the deck (alpha = 0) with ragged edges.
  for (const g of lay.gaps) {
    const pts = gapPoly(g);
    p.poly(pts).fill([0, 0, 0], 1, 'destination-out');
    // Broken edge: exposed concrete lip + rebar.
    p.poly(pts).stroke([0.42, 0.4, 0.38], 2.5, 0.9, 'source-atop');
    const Rr = new RNG(`rebar:${g.jag}`);
    for (let i = 0; i < 40; i++) {
      const top = Rr.chance(0.5), x = Rr.range(g.side > 0 ? 0 : -HALF, g.side < 0 ? 0 : HALF), y = top ? g.y1 : g.y0;
      p.line([x, y, x + Rr.range(-3, 3), y + (top ? -1 : 1) * Rr.range(4, 12)], 0.6, [0.4, 0.22, 0.1], 0.95);
    }
  }
}

/** Spans of intact deck between collapse gaps on one side (±1). */
function deckSpans(gaps, side, y0, y1) {
  let segs = [[y0, y1]];
  for (const g of gaps) if (g.side === 0 || g.side === side) {
    const n = [];
    for (const [a, b] of segs) { if (g.y1 <= a || g.y0 >= b) n.push([a, b]); else { if (g.y0 > a) n.push([a, g.y0]); if (g.y1 < b) n.push([g.y1, b]); } }
    segs = n;
  }
  return segs;
}

function meshDeck(mb, lay, S) {
  const { gaps } = lay;
  const spans = (side, a, b) => deckSpans(gaps, side, a, b);
  const y0 = lay.y0, y1 = lay.y1;
  for (const s of [-1, 1]) {
    for (const [a, b] of spans(s, y0, y1)) {
      if (b - a < 2) continue;
      // Slab edge (visible deck thickness) and parapet wall.
      mb.wall(s > 0 ? HALF : -HALF, s > 0 ? a : b, s > 0 ? HALF : -HALF, s > 0 ? b : a, DECK_Z - DECK_T, DECK_Z, 'concrete_dark', { ao: 0.75 });
      mb.box(s * 98, (a + b) / 2, DECK_Z, 4, b - a, 7.5, 0, { top: 'concrete', side: 'concrete' });
      // Median barrier on this half.
      mb.box(s * 1.2, (a + b) / 2, DECK_Z, 2.4, b - a, 6.5, 0, { top: 'concrete', side: 'concrete' });
    }
  }
  // Broken slab faces at gap edges.
  for (const g of gaps) {
    const xa = g.side > 0 ? 0 : -HALF, xb = g.side < 0 ? 0 : HALF;
    if (g.y0 > y0 - 1 && g.y0 < y1 + 1) mb.wall(xa, g.y0, xb, g.y0, DECK_Z - DECK_T, DECK_Z, 'concrete_dark', { ao: 0.7 });
    if (g.y1 > y0 - 1 && g.y1 < y1 + 1) mb.wall(xb, g.y1, xa, g.y1, DECK_Z - DECK_T, DECK_Z, 'concrete_dark', { ao: 0.7 });
  }
  // Light poles: pole + twin arms + heads.
  for (const lp of lay.lamps) {
    if (lp.broken) continue;
    mb.cyl(0, lp.y, DECK_Z + 6.5, 0.9, 40, 'steel_painted', { seg: 6 });
    for (const s of [-1, 1]) {
      mb.beam([0, lp.y, DECK_Z + 46], [s * 14, lp.y, DECK_Z + 46.5], 1.2, 1.2, 'steel_painted');
      mb.box(s * 15, lp.y, DECK_Z + 45, 4.5, 2.6, 1.6, 0, { top: 'metal_dark', side: 'metal_dark' });
    }
  }
  // Sign gantries: posts on the parapets, truss, green signs.
  for (const gt of lay.gantries) {
    const y = gt.y, zt = DECK_Z + 50;
    for (const s of [-1, 1]) mb.box(s * 99, y, DECK_Z + 7, 3, 3, 46 + (s < 0 ? gt.tilt * 40 : 0), 0, { top: 'steel_painted', side: 'steel_painted' });
    mb.beam([-HALF, y, zt + gt.tilt * 20], [HALF, y, zt - gt.tilt * 20], 3.5, 5, 'steel_painted');
    for (let k = 0; k < gt.signs; k++) {
      const x = -60 + k * (120 / Math.max(1, gt.signs - 1)) * (gt.signs > 1 ? 1 : 0) + (gt.signs === 1 ? 60 : 0);
      mb.box(x, y - 3, zt - 13 - gt.tilt * x * 0.2, 34, 1.4, 14, 0, { top: 'steel_painted', side: 'sign_green' });
    }
  }
}

// ================================================================= ground

function layoutGround(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { buildings: [], piers: [], slabs: [], anchors: [], cars: [], trees: [], rubble: [], craters: [], lots: [] };
  for (let y = Math.ceil(y0 / PIER_STEP) * PIER_STEP; y < y1; y += PIER_STEP) {
    const gaps = S.gapsIn(y - 20, y + 20);
    if (!gaps.some((g) => g.side === 0 && y > g.y0 && y < g.y1)) lay.piers.push({ y });
  }
  // Fallen deck slabs + rubble under collapsed sections (owned by the chunk holding the gap start).
  for (const g of S.gapsIn(y0, y1)) if (g.y0 >= y0 && g.y0 < y1) {
    lay.slabs.push(g);
    lay.anchors.push({ type: 'smoke', x: g.side === 0 ? 0 : g.side * 50, y: (g.y0 + g.y1) / 2, z: 6, s: 1.2, dark: 0.5 });
    if (R.chance(P.fires)) lay.anchors.push({ type: 'fire', x: g.side === 0 ? R.range(-40, 40) : g.side * 50, y: (g.y0 + g.y1) / 2, z: 8, s: 1.3 });
  }
  // City blocks between cross streets, both sides.
  const cross = S.crossIn(y0 - CROSS_STEP, y1 + CROSS_STEP).map((c2) => c2.y).sort((a, b) => a - b);
  for (let i = 0; i < cross.length - 1; i++) {
    const by0 = cross[i] + 26, by1 = cross[i + 1] - 26;
    for (const s of [-1, 1]) {
      // Two lot columns: near (126..262) and far (276..450).
      for (const [xa, xb, near] of [[126, 262, true], [276, 450, false]]) {
        let y = by0;
        const Rb = new RNG(`${S.seed}:block:${cross[i] | 0}:${s}:${xa}`);
        while (y < by1 - 30) {
          const dep = Math.min(by1 - y, Rb.range(70, 150));
          const cy = y + dep / 2;
          if (cy >= y0 && cy < y1) { // the chunk owning the lot centre builds it
            const cx = s * (xa + xb) / 2, w = xb - xa;
            const roll = Rb.next();
            const odd = Rb.next();
            if (roll < (near ? 0.6 : 0.82)) {
              const b = planBuilding(Rb, cx, cy, w - Rb.range(10, 22), dep - Rb.range(10, 18), {
                hMin: near ? 26 : 50, hMax: near ? 96 : 180, burnt: P.cityBurn, collapse: P.cityBurn * 0.45, night: P.night,
                styles: near ? ['brick', 'concrete', 'office', 'industrial'] : ['office', 'glass', 'concrete', 'brick'],
              });
              lay.buildings.push(b);
              buildingAnchors(Rb, b, lay.anchors);
              if (near && !b.collapse && !b.burnt && b.h < 80 && Rb.chance(0.35)) b.bill = { x: cx - s * (w * 0.2), face: -s, mat: `billboard_${Rb.int(0, 3)}` };
              if (b.collapse) lay.rubble.push({ x: cx + Rb.range(-20, 20), y: cy, r: Math.min(w, dep) * 0.4, seed: Rb.next() });
            } else {
              const lot = { x: cx, y: cy, w: w - 12, d: dep - 10, seed: Rb.next() };
              if (odd < 0.22 && dep > 100) {
                lot.kind = 'construction';
                lot.frame = { x: cx + s * 10, y: cy, w: w * 0.5, d: dep * 0.55, h: Rb.range(50, 100), rot: 0, done: Rb.range(0.5, 0.9) };
                lot.crane = { x: cx - s * w * 0.3, y: cy + Rb.range(-0.3, 0.3) * dep, h: Rb.range(130, 190), rot: Rb.angle(), jib: Rb.range(120, 170) };
                lay.anchors.push({ type: 'beacon', x: lot.crane.x, y: lot.crane.y, z: lot.crane.h + 16, c: [1, 0.1, 0.05], period: 70 });
              } else if (odd < 0.38 && near) lot.kind = 'gas';
              else if (odd < 0.38 + 0.3 * P.military && near) {
                lot.kind = 'checkpoint';
                lot.tents = [0, 1].map((k) => ({ x: cx + Rb.range(-0.2, 0.2) * w, y: cy + (k - 0.5) * dep * 0.45, rot: Rb.range(-0.3, 0.3) }));
                lay.anchors.push({ type: 'searchlight', x: cx - s * w * 0.35, y: cy, z: 6, base: s > 0 ? Math.PI : 0, sweep: 0.9, speed: 0.012 });
              } else lot.kind = odd < 0.8 ? 'parking' : 'park';
              lay.lots.push(lot);
            }
          }
          y += dep;
        }
      }
    }
  }
  // Street-level wrecks and craters.
  for (let i = 0; i < 2 + 5 * P.damage; i++) lay.craters.push({ x: R.sign() * R.range(70, 430), y: R.range(y0, y1), r: R.range(6, 14), seed: R.next() });
  for (let i = 0; i < 6 * P.traffic + 2; i++) {
    const x = R.range(-50, 50), y = R.range(y0 + 10, y1 - 10);
    lay.cars.push({ x, y, rot: (x > 0 ? 0 : Math.PI) + R.range(-0.2, 0.2), color: carColor(R), burnt: R.chance(0.3 * P.damage), kind: R.pick(['sedan', 'hatch', 'suv']) });
  }
  lay.seed = R.next();
  return lay;
}

function paintGround(p, lay, nb, c, S) {
  const P = S.P, { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  // Base: worn pavement / sidewalks everywhere, asphalt streets on top.
  concrete(p, { color: [0.46, 0.45, 0.42], joints: [12, 12] });
  dirt(p, { path: () => { p.ctx.beginPath(); for (const s of [-1, 1]) p.ctx.rect(s > 0 ? 70 : -118, y0 - 4, 48, y1 - y0 + 8); }, color: [0.33, 0.29, 0.24] });
  asphalt(p, { path: () => p.rectPath(-62, y0 - 4, 124, y1 - y0 + 8), color: [0.18, 0.18, 0.19] });
  for (const cs of S.crossIn(y0, y1)) asphalt(p, { path: () => p.rectPath(-470, cs.y - 20, 940, 40), color: [0.19, 0.19, 0.2] });
  // Street markings.
  p.layer(() => {
    p.line([0, y0 - 30, 0, y1 + 30], 1, [0.9, 0.75, 0.15], 1, { dash: [14, 10], dashOffset: -((y0 - 30) % 24) });
    for (const s of [-1, 1]) p.line([s * 58, y0 - 4, s * 58, y1 + 4], 0.9, [0.85, 0.85, 0.82], 1);
    for (const cs of S.crossIn(y0, y1)) {
      p.line([-470, cs.y, 470, cs.y], 0.9, [0.9, 0.9, 0.86], 1, { dash: [12, 12] });
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) p.rectPath(s * (72 + k * 5), cs.y - 18, 2.6, 36).fill([0.9, 0.9, 0.86], 0.9); // crosswalk
    }
  }, { wear: ['fine_60', 60, 0.9], alpha: 0.7 });
  // Lots: parking (striped asphalt), parks (grass + trees).
  for (const L of all) for (const lt of L.lots) {
    if (lt.kind === 'parking') {
      asphalt(p, { path: () => p.rectPath(lt.x - lt.w / 2, lt.y - lt.d / 2, lt.w, lt.d), color: [0.22, 0.22, 0.22] });
      for (let x = lt.x - lt.w / 2 + 6; x < lt.x + lt.w / 2 - 6; x += 15) for (const sy of [-1, 1]) p.line([x, lt.y + sy * 4, x, lt.y + sy * (lt.d / 2 - 6)], 0.6, [0.85, 0.85, 0.8], 0.5);
    } else if (lt.kind === 'park') {
      p.rectPath(lt.x - lt.w / 2, lt.y - lt.d / 2, lt.w, lt.d).fill(S.snowy ? [0.8, 0.84, 0.9] : [0.24, 0.29, 0.15]);
      p.noise('fbm', 200, 'soft-light', 0.5, { path: () => p.rectPath(lt.x - lt.w / 2, lt.y - lt.d / 2, lt.w, lt.d) });
    } else if (lt.kind === 'gas') {
      concrete(p, { path: () => p.rectPath(lt.x - lt.w / 2, lt.y - lt.d / 2, lt.w, lt.d), color: [0.58, 0.57, 0.54], joints: [10, 10] });
      for (let k = -1; k <= 1; k++) p.rectPath(lt.x + k * lt.w * 0.18 - 2, lt.y + lt.d * 0.12 - 8, 4, 16).fill([0.75, 0.74, 0.7]);
    } else {
      dirt(p, { path: () => p.rectPath(lt.x - lt.w / 2, lt.y - lt.d / 2, lt.w, lt.d), color: lt.kind === 'checkpoint' ? [0.36, 0.32, 0.24] : [0.42, 0.34, 0.25] });
    }
  }
  for (let i = 0; i < 30; i++) { const Rm = new RNG(`mh:${lay.seed}:${i}`); manhole(p, Rm.range(-50, 50), Rm.range(y0, y1)); }
  // Snow (winter).
  if (S.snowy) snowSurf(p, { path: () => { p.ctx.beginPath(); p.ctx.rect(-470, y0 - 4, 940, y1 - y0 + 8); }, dirty: 0.15 });
  // Deck shadow (the overpass above), interrupted by collapse gaps — painted
  // with the props pass so everything shares one shadow buffer.
  p.props(() => new RNG(`gprops:${lay.seed}`), (Rp) => {
    const gaps = S.gapsIn(y0 - 300, y1 + 300);
    for (const s of [-1, 1]) for (const [a, b] of deckSpans(gaps, s, y0 - 300, y1 + 300)) {
      const xa = s > 0 ? 0 : -HALF, xb = s > 0 ? HALF : 0;
      p.shadow([xa, a, xb, a, xb, b, xa, b], DECK_Z, DECK_Z - DECK_T);
    }
    for (const L of all) for (const b of L.buildings) shadowBuilding(p, b);
    for (const L of all) for (const pr of L.piers) for (const sx of [-1, 1]) p.shadowCircle(sx * 52, pr.y, 10, DECK_Z - DECK_T, 0, 10);
    for (const L of all) for (const r of L.rubble) rubble(p, new RNG(`rb:${r.seed}`), r.x, r.y, r.r, { rebar: true });
    for (const L of all) for (const g of L.slabs) rubble(p, new RNG(`slabrb:${g.jag}`), g.side === 0 ? 0 : g.side * 50, (g.y0 + g.y1) / 2, 45, { rebar: true, scale: 1.6 });
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`gcr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2); crater(p, Rc, cr.x, cr.y, cr.r); }
    for (const L of all) for (const v of L.cars) car(p, v.x, v.y, v.rot, { color: v.color, kind: v.kind, burnt: v.burnt });
    for (const L of all) for (const lt of L.lots) {
      const Rl = new RNG(`lot:${lt.seed}`);
      if (lt.kind === 'construction') {
        shadowCrane(p, lt.crane.x, lt.crane.y, lt.crane.h, lt.crane.rot, { jib: lt.crane.jib });
        p.shadowBox(lt.frame.x, lt.frame.y, lt.frame.w, lt.frame.d, lt.frame.h * lt.frame.done, 0, lt.frame.h * lt.frame.done - 2);
        for (let k = 0; k < 8; k++) crate(p, Rl, lt.x + Rl.range(-0.4, 0.4) * lt.w, lt.y + Rl.range(-0.4, 0.4) * lt.d, Rl.range(5, 9), Rl.range(-0.3, 0.3), { color: [0.55, 0.5, 0.42] });
        for (let k = 0; k < 3; k++) puddle(p, Rl, lt.x + Rl.range(-0.4, 0.4) * lt.w, lt.y + Rl.range(-0.4, 0.4) * lt.d, Rl.range(4, 9));
        truck(p, lt.x + Rl.range(-0.2, 0.2) * lt.w, lt.y - lt.d * 0.35, Rl.range(1.2, 2), { cab: [0.85, 0.6, 0.1], cargo: 'flat', color: [0.4, 0.38, 0.34] });
      } else if (lt.kind === 'gas') {
        for (let k = 0; k < 3; k++) if (Rl.chance(0.6)) car(p, lt.x + (k - 1) * lt.w * 0.18 + 9, lt.y + lt.d * 0.12, Rl.chance(0.5) ? 0 : Math.PI, { color: carColor(Rl), burnt: Rl.chance(0.3 * P.damage) });
        p.shadowBox(lt.x, lt.y + lt.d * 0.12, lt.w * 0.6, lt.d * 0.45, 17, 0, 14);
        p.shadowBox(lt.x, lt.y - lt.d * 0.32, lt.w * 0.45, lt.d * 0.22, 12);
      } else if (lt.kind === 'checkpoint') {
        for (const tn of lt.tents) p.shadowBox(tn.x, tn.y, 18, 30, 12, tn.rot);
        const r = Math.min(lt.w, lt.d) * 0.42;
        const ring = []; for (let a = 0; a <= 6.3; a += 0.4) ring.push(lt.x + Math.cos(a) * r, lt.y + Math.sin(a) * r * 0.8);
        sandbags(p, ring);
        truck(p, lt.x + lt.w * 0.3, lt.y, 0.1, { cargo: 'canvas', cab: [0.28, 0.3, 0.22], color: [0.3, 0.32, 0.24] });
        tank(p, lt.x - lt.w * 0.25, lt.y + lt.d * 0.25, Rl.range(-0.5, 0.5), { turret: Rl.range(-1, 1), burnt: Rl.chance(P.damage * 0.4) });
        for (let k = 0; k < 6; k++) drum(p, lt.x + Rl.range(-0.3, 0.3) * lt.w, lt.y + Rl.range(-0.3, 0.3) * lt.d, { color: [0.25, 0.3, 0.18] });
      } else if (lt.kind === 'parking') {
        for (let x = lt.x - lt.w / 2 + 13.5; x < lt.x + lt.w / 2 - 6; x += 15) for (const sy of [-1, 1]) if (Rl.chance(0.55)) car(p, x, lt.y + sy * (lt.d / 4 + 1), sy > 0 ? 0 : Math.PI, { color: carColor(Rl), kind: Rl.pick(['sedan', 'hatch', 'suv']), burnt: Rl.chance(0.2 * P.damage) });
      } else {
        for (let k = 0; k < (lt.w * lt.d) / 900; k++) tree(p, Rl, lt.x + Rl.range(-0.45, 0.45) * lt.w, lt.y + Rl.range(-0.45, 0.45) * lt.d, Rl.range(7, 12), { dead: P.cityBurn > 0.4 && Rl.chance(0.5), color: S.snowy ? [0.3, 0.32, 0.3] : undefined });
      }
    }
    // Street trees along the sidewalks.
    for (let y = Math.ceil(y0 / 40) * 40; y < y1; y += 40) for (const s of [-1, 1]) { const Rt = new RNG(`st:${S.seed}:${y}:${s}`); if (Rt.chance(0.6)) tree(p, Rt, s * Rt.range(122, 126), y + Rt.range(-6, 6), Rt.range(6, 9)); }
  }, 0.62, 2.6);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 40 * a.s, [[0, [1, 0.42, 0.1], 0.5], [1, [1, 0.3, 0.05], 0]], 'lighter');
}

/** A collapsed deck section lying from the broken edge down to the street. */
function fallenSlab(mb, g) {
  const xa = g.side > 0 ? 4 : -HALF + 4, xb = g.side < 0 ? -4 : HALF - 4;
  const ya = g.y0 + 6, yb = g.y1 - 6;
  // Hinged at the near edge: top surface slopes from deck level to the ground.
  const zA = DECK_Z - DECK_T - 2, zB = 4;
  mb.quad([[xa, ya, zA], [xb, ya, zA], [xb, yb, zB], [xa, yb, zB]], [[0, 0], [(xb - xa) / 60, 0], [(xb - xa) / 60, (yb - ya) / 60], [0, (yb - ya) / 60]], mb.mat('asphalt_tile').layer, [0, -0.6, 0.8]);
  mb.quad([[xa, ya, zA - DECK_T], [xa, ya, zA], [xa, yb, zB], [xa, yb, zB - DECK_T]], [[0, 0], [0, 0.2], [1, 0.2], [1, 0]], mb.mat('concrete_dark').layer, [-1, 0, 0]);
  mb.quad([[xb, ya, zA], [xb, ya, zA - DECK_T], [xb, yb, zB - DECK_T], [xb, yb, zB]], [[0, 0], [0, 0.2], [1, 0.2], [1, 0]], mb.mat('concrete_dark').layer, [1, 0, 0]);
}

export { shade };
