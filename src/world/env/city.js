import { asphalt, concrete, grass } from '../paint/surfaces.js';
import { car, truck, bus, rubble, debris, scorch, crater, tree, manhole, puddle, carColor, tank } from '../paint/props.js';
import { planBuilding, meshBuilding, shadowBuilding, buildingAnchors, meshBillboard } from '../kit/city.js';
import { meshBoulder } from '../kit/terrain.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// CITY: a downtown street grid seen from above — a central boulevard along
// the flight path, side avenues, cross streets, blocks of towers, plazas,
// moving traffic. Covers many briefs through params:
//
//   groundZ   0 street level · -300 skimming the rooftops · -900 megacity from altitude
//   height    tower heights [min, max] (above the street)
//   plaza 0..1     open plazas (paving, fountains, planters)
//   helipads 0..1  rooftop helipads
//   night (bool)   lit windows, street lights, headlights
//   wet 0..1       rain-soaked streets (dark, glossy, puddles)
//   damage 0..1    craters, debris, wrecks · burning 0..1 fires on roofs
//   collapse 0..1  collapsed towers (rubble mounds)
//   flood 0..1     streets under water (water surface at street level)
//   crystals 0..1  alien crystal spires piercing the blocks (invasion)
//   traffic 0..1   moving cars / buses · military 0..1 armour in the streets

const LEN = 512, AVE = 300, CROSS = 230;

export default {
  id: 'city',
  label: 'City / downtown',
  defaults: { groundZ: 0, height: [40, 220], plaza: 0.2, helipads: 0.2, night: false, wet: 0, damage: 0.2, burning: 0, collapse: 0, flood: 0, crystals: 0, traffic: 0.7, military: 0 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const gz = P.groundZ;
    const S = { P, seed, gz, dust: [0.5, 0.48, 0.45] };
    const A = {};
    if (P.flood > 0) A.surfaces = [{ type: 'water', z: gz + 4 + P.flood * 6, deep: [0.04, 0.08, 0.08], shallow: [0.1, 0.16, 0.14], sky: [0.4, 0.45, 0.5], wave: [0.35, 1.6, 0.6, 0.3], foam: [0.05, 0.9, 0.15, 0], wind: [1, 0.2] }];
    if (P.night) A.glowTint = [1.1, 1.0, 0.9];
    S.atmosphere = A;
    S.layers = [{
      id: 'ground', z: gz, x0: -560, x1: 560, length: LEN, ppu: gz < -500 ? 0.75 : gz < -100 ? 1.0 : 1.35, glow: P.night || P.burning > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
      moverMesh: (mb, m) => { mb.box(m.x, m.y, gz + 0.5, m.w, m.l, m.h, m.rot, { top: m.mat, side: 'metal_dark' }); return []; },
    }];
    // Impacts land on roofs where the screen point is over a building (approximated: the street plane).
    S.surfacesTopDown = [{ z: gz }];
    S.floorZ = gz;
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P, gz = S.gz;
  const lay = { buildings: [], plazas: [], parks: [], anchors: [], movers: [], cars: [], craters: [], crystals: [], rubble: [], armour: [] };
  // Blocks: between the boulevard (|x| < 40) and avenues at ±AVE, ±2·AVE, between cross streets.
  const cy0 = Math.floor(y0 / CROSS) - 1, cy1 = Math.floor(y1 / CROSS) + 1;
  for (let m = cy0; m <= cy1; m++) {
    const by0 = m * CROSS + 20, by1 = (m + 1) * CROSS - 20;
    for (const [xa, xb] of [[44, AVE - 24], [AVE + 24, 2 * AVE - 24], [-(AVE - 24), -44], [-(2 * AVE - 24), -(AVE + 24)]]) {
      const Rb = new RNG(`${S.seed}:cb:${m}:${xa}`);
      const cx = (xa + xb) / 2, w = Math.abs(xb - xa);
      // A block is either a plaza / park or 1-4 towers.
      const kind = Rb.next();
      if (kind < P.plaza) {
        const cyc = (by0 + by1) / 2;
        if (cyc >= y0 && cyc < y1) lay.plazas.push({ x: cx, y: cyc, w: w - 8, d: by1 - by0 - 8, seed: Rb.next(), tower: Rb.chance(0.6) });
        continue;
      }
      const nLots = Rb.int(1, 3);
      let y = by0;
      for (let k = 0; k < nLots; k++) {
        const dep = k === nLots - 1 ? by1 - y : (by1 - by0) / nLots;
        const lcx = cx, lcy = y + dep / 2;
        y += dep;
        if (lcy < y0 || lcy >= y1) continue;
        const [hMin, hMax] = P.height;
        const b = planBuilding(Rb, lcx, lcy, w - Rb.range(6, 16), dep - Rb.range(6, 14), {
          hMin, hMax, burnt: P.burning * 0.5, collapse: P.collapse, night: P.night,
          styles: hMax > 200 ? ['glass', 'glass', 'office', 'office', 'concrete'] : ['office', 'brick', 'concrete', 'glass'],
        });
        b.z0 = gz;
        if (!b.collapse && Rb.chance(P.helipads) && b.w > 50 && b.d > 50) b.helipad = true;
        if (!b.collapse && !b.helipad && Rb.chance(0.12)) b.garden = true;
        lay.buildings.push(b);
        buildingAnchors(Rb, b, lay.anchors, { fireScale: 1.3 });
        for (const an of lay.anchors) if (an.z != null && an.z < 1e5 && !an.zAbs) { an.z += gz; an.zAbs = true; }
        if (b.collapse) lay.rubble.push({ x: lcx, y: lcy, r: Math.min(w, dep) * 0.45, seed: Rb.next() });
        if (P.crystals > 0 && Rb.chance(P.crystals * 0.35)) lay.crystals.push({ x: lcx + Rb.range(-20, 20), y: lcy + Rb.range(-20, 20), h: b.h + Rb.range(40, 160), seed: Rb.next() });
      }
    }
  }
  // Traffic on the boulevard and avenues (movers), parked / wrecked cars.
  const lanes = [-28, -12, 12, 28, AVE - 8, AVE + 8, -AVE - 8, -AVE + 8];
  for (const lx of lanes) {
    if (!R.chance(P.traffic * (1 - P.flood))) continue;
    const dir = lx > (lx > 200 ? AVE : lx < -200 ? -AVE : 0) ? 1 : -1;
    for (let k = 0; k < R.int(1, 3); k++) {
      const kind = R.chance(0.1) ? 'bus' : 'car';
      lay.movers.push({ kind: 'vehicle', x: lx, y: R.range(y0, y1), rot: dir > 0 ? 0 : Math.PI, vx: 0, vy: dir * R.range(0.35, 0.8), w: kind === 'bus' ? 14 : 10.5, l: kind === 'bus' ? 60 : 25, h: kind === 'bus' ? 16 : 8, mat: kind === 'bus' ? 'car_white' : R.pick(['car_red', 'car_white', 'car_black', 'car_blue', 'car_silver', 'car_taxi']), lights: P.night });
    }
  }
  for (let i = 0; i < 4 + 8 * P.damage; i++) lay.cars.push({ x: R.pick([-36, -20, 20, 36, AVE - 14, AVE + 14, -AVE + 14, -AVE - 14]) + R.range(-3, 3), y: R.range(y0, y1), rot: R.chance(0.5) ? 0 : Math.PI, color: carColor(R), burnt: R.chance(P.damage * 0.6), kind: R.pick(['sedan', 'hatch', 'suv', 'van']) });
  for (let i = 0; i < 8 * P.damage; i++) lay.craters.push({ x: R.range(-560, 560), y: R.range(y0, y1), r: R.range(6, 14), seed: R.next() });
  for (let i = 0; i < 2 * P.military; i++) lay.armour.push({ x: R.range(-30, 30), y: R.range(y0, y1), rot: R.chance(0.5) ? 0 : Math.PI, burnt: R.chance(0.4) });
  if (P.night) for (let y = Math.ceil(y0 / 60) * 60; y < y1; y += 60) for (const x of [-42, 42, AVE - 22, AVE + 22, -AVE - 22, -AVE + 22]) lay.anchors.push({ type: 'lamp', x, y, z: gz + 34, c: [1, 0.82, 0.55], len: 6 });
  if (P.burning > 0) for (let i = 0; i < 3 * P.burning; i++) lay.anchors.push({ type: 'smoke', x: R.range(-500, 500), y: R.range(y0, y1), z: gz + 2, s: 2, dark: 0.8 });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  const wetK = P.wet;
  concrete(p, { color: shade([0.5, 0.49, 0.47], 1 - wetK * 0.35), joints: [10, 10] });          // sidewalks / lots
  const road = shade([0.2, 0.2, 0.21], 1 - wetK * 0.4);
  asphalt(p, { path: () => p.rectPath(-40, y0 - 4, 80, y1 - y0 + 8), color: road });
  for (const s of [-1, 1]) for (const ax of [AVE, 2 * AVE]) asphalt(p, { path: () => p.rectPath(s * ax - 20, y0 - 4, 40, y1 - y0 + 8), color: road });
  for (let m = Math.floor(y0 / CROSS) - 1; m <= Math.floor(y1 / CROSS) + 1; m++) asphalt(p, { path: () => p.rectPath(-570, m * CROSS - 18, 1140, 36), color: road });
  // Boulevard median with trees; markings.
  concrete(p, { path: () => p.rectPath(-4, y0 - 4, 8, y1 - y0 + 8), color: [0.55, 0.54, 0.5] });
  p.layer(() => {
    for (const s of [-1, 1]) p.line([s * 20, y0 - 30, s * 20, y1 + 30], 1, [0.9, 0.9, 0.86], 1, { dash: [12, 16], dashOffset: -((y0 - 30) % 28) });
    for (const s of [-1, 1]) p.line([s * AVE, y0 - 30, s * AVE, y1 + 30], 1, [0.9, 0.8, 0.2], 1, { dash: [12, 10], dashOffset: -((y0 - 30) % 22) });
    for (let m = Math.floor(y0 / CROSS) - 1; m <= Math.floor(y1 / CROSS) + 1; m++) {
      const y = m * CROSS;
      for (const cx of [0, AVE, -AVE]) for (const sy of [-1, 1]) for (let k = 0; k < 8; k++) p.rectPath(cx - 18 + k * 5, y + sy * 26 - 5, 2.6, 10).fill([0.92, 0.92, 0.88], 0.9);
      p.line([-570, y, 570, y], 0.9, [0.9, 0.9, 0.86], 1, { dash: [10, 12] });
    }
  }, { wear: ['fine_60', 60, 0.8], alpha: 0.75 });
  // Plazas: paving pattern, a fountain, planters.
  for (const L of all) for (const pz of L.plazas) {
    const pth = () => p.rectPath(pz.x - pz.w / 2, pz.y - pz.d / 2, pz.w, pz.d);
    concrete(p, { path: pth, color: [0.66, 0.63, 0.58], joints: [8, 8] });
    p.circlePath(pz.x, pz.y, 26).fill([0.55, 0.53, 0.5]); p.circlePath(pz.x, pz.y, 22).fill([0.15, 0.32, 0.38]); p.circlePath(pz.x, pz.y, 4).fill([0.85, 0.9, 0.95], 0.8);
    grass(p, { path: () => { p.ctx.beginPath(); for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) p.ctx.rect(pz.x + dx * pz.w - 14, pz.y + dy * pz.d - 10, 28, 20); } });
  }
  if (wetK > 0) p.patch('fbm_60', 220, [0.03, 0.035, 0.045], 0.45 * wetK);                      // standing water sheen
  for (let i = 0; i < 24; i++) { const Rm = new RNG(`cmh:${lay.seed}:${i}`); manhole(p, Rm.pick([-28, -12, 12, 28]), Rm.range(y0, y1)); }
  p.props(() => new RNG(`city:${lay.seed}`), (Rp) => {
    for (const L of all) for (const b of L.buildings) shadowBuilding(p, b);
    for (const L of all) for (const pz of L.plazas) {
      const Rz = new RNG(`pz:${pz.seed}`);
      for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) tree(p, Rz, pz.x + dx * pz.w, pz.y + dy * pz.d, Rz.range(8, 11));
    }
    for (let y = Math.ceil(y0 / 34) * 34; y < y1; y += 34) { const Rt = new RNG(`ctree:${S.seed}:${y}`); if (Rt.chance(0.7)) tree(p, Rt, 0, y, Rt.range(5, 7), { color: [0.22, 0.32, 0.15] }); }
    for (const L of all) for (const r of L.rubble) rubble(p, new RNG(`crb:${r.seed}`), r.x, r.y, r.r, { rebar: true, scale: 1.3 });
    for (const L of all) for (const cr of L.craters) { const Rc = new RNG(`ccr:${cr.seed}`); scorch(p, Rc, cr.x, cr.y, cr.r * 2); crater(p, Rc, cr.x, cr.y, cr.r); }
    for (const L of all) for (const v of L.cars) car(p, v.x, v.y, v.rot, { color: v.color, kind: v.kind, burnt: v.burnt });
    for (const L of all) for (const a of L.armour) tank(p, a.x, a.y, a.rot, { burnt: a.burnt, turret: Rp.range(-1, 1) });
    if (P.damage > 0.3) for (let i = 0; i < 6; i++) debris(p, Rp, Rp.range(-500, 500), Rp.range(y0, y1), Rp.range(20, 45), 40);
    if (wetK > 0) for (let i = 0; i < 10 * wetK; i++) puddle(p, Rp, Rp.range(-40, 40), Rp.range(y0, y1), Rp.range(4, 9), { color: [0.05, 0.06, 0.08] });
  }, 0.6, 2.4);
  if (p.env.glow) {
    for (const L of all) for (const a of L.anchors) {
      if (a.type === 'lamp') p.env.glow.radial(a.x * 0.9, a.y, 30, [[0, [1, 0.8, 0.5], 0.45 + wetK * 0.25], [1, [1, 0.7, 0.4], 0]], 'lighter', 1, wetK > 0 ? 1.6 : 1);
      if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 50 * a.s, [[0, [1, 0.42, 0.1], 0.4], [1, [1, 0.3, 0.05], 0]], 'lighter');
    }
  }
}

function mesh(mb, lay, S) {
  const gz = S.gz;
  for (const b of lay.buildings) {
    meshBuilding(mb, b, gz);
    if (b.helipad) mb.box(b.x, b.y, gz + b.h, Math.min(b.w, b.d) * 0.7, Math.min(b.w, b.d) * 0.7, 1.5, b.rot, { top: 'helipad', side: 'steel_painted' });
    if (b.garden) mb.box(b.x, b.y, gz + b.h, b.w * 0.6, b.d * 0.6, 1, b.rot, { top: 'roof_garden', side: 'concrete' });
  }
  for (const pz of lay.plazas) {
    if (!pz.tower) continue;
    // Corporate HQ: a stepped glass tower at the head of the plaza with a lit crown.
    const y = pz.y + pz.d * 0.32;
    mb.box(pz.x, y, gz, pz.w * 0.5, pz.d * 0.3, 260, 0, { top: 'roof_concrete', side: 'facade_glass' });
    mb.box(pz.x, y, gz + 260, pz.w * 0.38, pz.d * 0.22, 40, 0, { top: 'helipad', side: 'facade_glass' });
  }
  for (const cr of lay.crystals) {
    const R = new RNG(`cry:${cr.seed}`);
    for (let k = 0; k < 4; k++) {
      const a = R.angle(), d = R.range(0, 14), h = cr.h * R.range(0.5, 1);
      const x = cr.x + Math.cos(a) * d, y = cr.y + Math.sin(a) * d, r = R.range(6, 12);
      mb.lathe(x, y, [[r, gz], [r * 0.85, gz + h * 0.8], [0.1, gz + h]], 'alien_crystal', { seg: 6 });
    }
  }
}

export { meshBoulder, meshBillboard, bus, truck };
