import { asphalt, concrete, rock as rockSurf } from '../paint/surfaces.js';
import { car, truck, bus, rubble, debris, scorch, puddle, skid, carColor, crate, drum } from '../paint/props.js';
import { meshBoulder, shadowBoulder, railway } from '../kit/terrain.js';
import { dirt, gravel } from '../paint/surfaces.js';
import { RNG } from '../../core/RNG.js';

// UNDERGROUND HIGHWAY TUNNEL (cutaway): twin bores under a rock mass.
//
//   floor  z = 0     two carriageways, walkways, gutters, the central pillar
//                    line, puddles, wrecks; collapse rubble
//   cap    z = 126   the rock mass around the tunnel (cut out over the bore):
//                    fractured rock, strata, seepage; breaches spill rock in
//   solids           tunnel walls, arch ribs overhead every 96 units with jet
//                    fans and lane-control signals, pillars, fallen ribs,
//                    boulders
//
// Params: style 'road' | 'metro' | 'mine', collapse 0..1, damage 0..1,
//         traffic 0..1, fires 0..1, lights 0..1 (share of working lamps),
//         flood 0..1 (above 0.6 the bore stands in water), military 0..1

const LEN = 512, WALL = 152, CAP_Z = 126, RIB_STEP = 96, RIB_Z = 112;
const LANES = [22, 50, 78, 106, 134]; // per bore, measured from the centre line (x = ±)

const h01 = (s) => new RNG(s).next();

export default {
  id: 'tunnel',
  label: 'Underground highway tunnel',
  defaults: { style: 'road', collapse: 0.5, damage: 0.5, traffic: 0.5, fires: 0.3, lights: 0.7, flood: 0.15, military: 0.2 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    // Collapse zones: one candidate per 700 units.
    const zoneAt = (m) => {
      if (m < 1 || h01(`${seed}:tz:${m}`) > P.collapse) return null;
      const R = new RNG(`${seed}:tzone:${m}`);
      return { y: m * 700 + R.range(150, 550), side: R.sign(), r: R.range(60, 110), breach: R.chance(0.6), seed: R.next() };
    };
    const zonesIn = (y0, y1) => {
      const out = [];
      for (let m = Math.floor((y0 - 200) / 700); m <= Math.floor((y1 + 200) / 700); m++) { const z = zoneAt(m); if (z && z.y > y0 - 200 && z.y < y1 + 200) out.push(z); }
      return out;
    };
    const S = { P, seed, zonesIn, dust: [0.42, 0.38, 0.32] };
    S.atmosphere = { hfog: [1 / 90, 40, 0.35] }; // dust hanging over the roadway
    if (P.flood > 0.6) S.atmosphere.surfaces = [{ type: 'water', z: 6, deep: [0.02, 0.05, 0.05], shallow: [0.06, 0.1, 0.09], sky: [0.12, 0.12, 0.1], wave: [0.2, 2, 0.4, 0.2], foam: [0.03, 0.95, 0.05, 0], wind: [0.3, 1] }];
    S.layers = [
      {
        id: 'floor', z: 0, x0: -WALL - 4, x1: WALL + 4, length: LEN, ppu: 1.6, glow: true,
        layout: (c) => layoutFloor(c, S),
        paint: (p, lay, nb, c) => paintFloor(p, lay, nb, c, S),
        mesh: (mb, lay, c) => meshTunnel(mb, lay, c, S),
      },
      {
        id: 'cap', z: CAP_Z, x0: -480, x1: 480, length: LEN, ppu: 0.9, cut: true,
        layout: (c) => ({ zones: S.zonesIn(c.y0, c.y1), seed: c.R.next() }),
        paint: (p, lay, nb, c) => paintCap(p, lay, c, S),
      },
    ];
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

// ================================================================= floor

function layoutFloor(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { zones: S.zonesIn(y0, y1), vehicles: [], ribs: [], pillars: [], anchors: [], puddles: [], debris: [], boulders: [], fallen: [] };
  for (let y = Math.ceil(y0 / RIB_STEP) * RIB_STEP; y < y1; y += RIB_STEP) {
    const z = lay.zones.find((zz) => Math.abs(zz.y - y) < zz.r * 0.6);
    const fallen = z && R.chance(0.7);
    lay.ribs.push({ y, fallen, side: z ? z.side : 0, fan: !fallen && R.chance(0.45), sig: !fallen && R.chance(0.5) });
    if (fallen) lay.fallen.push({ y, side: z.side, tilt: R.range(0.25, 0.5), seed: R.next() });
    // Wall lamps on both walls, sodium orange; some dead, some flickering.
    for (const s of [-1, 1]) for (const dy of [0, RIB_STEP / 2]) {
      const ok = R.chance(P.lights) && !(z && z.side === s);
      if (ok) lay.anchors.push({ type: 'lamp', x: s * (WALL - 3), y: y + dy, z: P.style === 'mine' ? 60 : 88, c: P.style === 'metro' ? [0.85, 0.92, 1] : [1, 0.66, 0.28], len: P.style === 'mine' ? 4 : 12, rot: Math.PI / 2 });
      else if (R.chance(0.3)) lay.anchors.push({ type: 'glow', x: s * (WALL - 3), y: y + dy, z: 88, r: 22, c: [1, 0.6, 0.25], a: 0.5, flicker: true });
    }
  }
  for (let y = Math.ceil(y0 / 40) * 40; y < y1 && P.style === 'road'; y += 40) {
    if (lay.zones.some((z) => Math.abs(z.y - y) < z.r * 0.5)) continue;
    lay.pillars.push({ y });
  }
  for (const z of lay.zones) if (z.y >= y0 && z.y < y1) {
    const Rz = new RNG(`tz:${z.seed}`);
    const cx = z.side * Rz.range(50, 110);
    for (let i = 0; i < 6 + 6 * S.P.collapse; i++) lay.boulders.push({ x: cx + Rz.range(-z.r, z.r) * 0.6, y: z.y + Rz.range(-z.r, z.r) * 0.7, r: Rz.range(8, 22), h: Rz.range(8, 24), seed: Rz.next() });
    lay.anchors.push({ type: 'dust', x: cx, y: z.y, z: 4, s: 1.6 });
    lay.anchors.push({ type: 'rockfall', x: cx, y: z.y, z: CAP_Z - 6, s: 1 });
    lay.anchors.push({ type: 'spark', x: z.side * 60, y: z.y + Rz.range(-30, 30), z: RIB_Z - 4 });
    if (Rz.chance(S.P.fires)) lay.anchors.push({ type: 'fire', x: cx + Rz.range(-20, 20), y: z.y + Rz.range(-20, 20), z: 3, s: 1.1 });
  }
  lay.carts = []; lay.trains = [];
  if (P.style === 'mine') for (let i = 0; i < 3; i++) { const s = R.sign(); lay.carts.push({ x: s * 50, y: R.range(y0 + 20, y1 - 20), n: R.int(2, 4), tilt: R.chance(P.damage * 0.5) ? R.range(-0.5, 0.5) : 0 }); }
  if (P.style === 'metro' && R.chance(0.6)) { const s = R.sign(); lay.trains.push({ x: s * 45, y: R.range(y0 + 60, y1 - 60), cars: R.int(2, 3), derail: R.chance(P.damage * 0.6) ? R.range(-0.25, 0.25) : 0 }); }
  const nVeh = P.style === 'road' ? Math.round(3 + 6 * P.traffic) : 0;
  for (let i = 0; i < nVeh; i++) {
    const s = R.sign(), lane = R.int(0, 3), x = s * (LANES[lane] + LANES[lane + 1]) / 2, y = R.range(y0 + 30, y1 - 30);
    if (lay.zones.some((z) => Math.abs(z.y - y) < z.r) || lay.vehicles.some((v) => Math.hypot(v.x - x, v.y - y) < 44)) continue;
    const kind = R.chance(0.15) ? 'truck' : R.chance(0.06) ? 'bus' : 'car';
    const crashed = R.chance(0.3 + P.damage * 0.4);
    const burnt = R.chance(P.fires * 0.5);
    lay.vehicles.push({ kind, x, y, rot: (s > 0 ? 0 : Math.PI) + (crashed ? R.range(-0.7, 0.7) : R.range(-0.05, 0.05)), burnt, color: carColor(R), crashed, mil: R.chance(P.military) });
    if (burnt) lay.anchors.push({ type: 'fire', x, y, z: 5, s: kind === 'car' ? 0.9 : 1.3 });
    else if (crashed && R.chance(0.5)) lay.anchors.push({ type: 'beacon', x, y, z: 9, c: R.chance(0.5) ? [1, 0.55, 0.05] : [0.2, 0.4, 1], period: 40 });
  }
  for (let i = 0; i < 3 + 8 * P.flood; i++) lay.puddles.push({ x: R.sign() * R.range(20, 140), y: R.range(y0, y1), r: R.range(6, 18) * (1 + P.flood), seed: R.next() });
  for (let i = 0; i < 4 + 6 * P.damage; i++) lay.debris.push({ x: R.range(-140, 140), y: R.range(y0, y1), r: R.range(10, 26), seed: R.next() });
  // Steam from ruptured pipes along the walls.
  if (R.chance(0.5)) lay.anchors.push({ type: 'steam', x: R.sign() * (WALL - 6), y: R.range(y0, y1), z: 40, s: 1 });
  lay.seed = R.next();
  return lay;
}

function paintFloor(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  if (P.style === 'mine') paintMine(p, c, S);
  else if (P.style === 'metro') paintMetro(p, c, S);
  else paintRoad(p, c, S);
  // Seepage stains along the walls; flood water pooled in the dips.
  for (const s of [-1, 1]) p.linear(s * WALL, 0, s * (WALL - 40), 0, [[0, [0.08, 0.09, 0.08], 0.6], [1, [0.1, 0.1, 0.1], 0]], () => p.rectPath(s > 0 ? WALL - 40 : -WALL, y0 - 4, 40, y1 - y0 + 8));
  if (P.flood > 0.3) p.patch('fbm_60', 380, [0.05, 0.07, 0.08], 0.6 * P.flood);
  const R = new RNG(`tcrack:${lay.seed}`);
  for (let i = 0; i < 10; i++) p.crack(R, R.range(-140, 140), R.range(y0, y1), R.angle(), R.range(20, 60), 0.7);
  paintProps(p, lay, all, c, S);
}

function paintRoad(p, c, S) {
  const { y0, y1 } = c;
  concrete(p, { color: [0.36, 0.35, 0.33] });
  for (const s of [-1, 1]) {
    const xa = s > 0 ? 18 : -138;
    asphalt(p, { path: () => p.rectPath(xa, y0 - 4, 120, y1 - y0 + 8), color: [0.15, 0.15, 0.155], wear: 0.8 });
    // Gutter + kerb at the walkway.
    p.rectPath(s > 0 ? 138 : -141, y0 - 4, 3, y1 - y0 + 8).fill([0.06, 0.06, 0.06]);
    concrete(p, { path: () => p.rectPath(s > 0 ? 141 : -WALL - 2, y0 - 4, 13, y1 - y0 + 8), color: [0.48, 0.47, 0.44], joints: [13, 20] });
    // Tyre-worn darker paths.
    for (let l = 0; l < 4; l++) {
      const cx = s * (LANES[l] + LANES[l + 1]) / 2;
      for (const o of [-6, 6]) p.rectPath(cx + o - 2.5, y0 - 4, 5, y1 - y0 + 8).fill([0.05, 0.05, 0.05], 0.18);
    }
  }
  // Markings.
  p.layer(() => {
    for (const s of [-1, 1]) {
      for (const l of [1, 2, 3]) p.line([s * LANES[l], y0 - 30, s * LANES[l], y1 + 30], 1.2, [0.88, 0.88, 0.84], 1, { dash: [16, 24], dashOffset: -((y0 - 30) % 40) });
      p.line([s * 20, y0 - 4, s * 20, y1 + 4], 1.3, [0.9, 0.72, 0.12], 1);
      p.line([s * 136, y0 - 4, s * 136, y1 + 4], 1.3, [0.88, 0.88, 0.84], 1);
    }
  }, { wear: ['fine_60', 50, 1], alpha: 0.75 });
}

function paintMine(p, c, S) {
  const { y0, y1 } = c;
  dirt(p, { color: [0.3, 0.26, 0.22] });
  gravel(p, { path: () => p.rectPath(-80, y0 - 4, 160, y1 - y0 + 8), color: [0.32, 0.3, 0.28] });
  for (const s of [-1, 1]) railway(p, s * 50, y0 - 4, y1 + 4, { rust: true, ballast: [0.26, 0.24, 0.22], sleeper: [0.2, 0.14, 0.09] });
  p.patch('fbm_60', 300, [0.12, 0.1, 0.08], 0.5);      // wet mud
}

function paintMetro(p, c, S) {
  const { y0, y1 } = c;
  concrete(p, { color: [0.4, 0.4, 0.4] });
  gravel(p, { path: () => p.rectPath(-92, y0 - 4, 184, y1 - y0 + 8), color: [0.3, 0.29, 0.28] });
  for (const s of [-1, 1]) {
    railway(p, s * 45, y0 - 4, y1 + 4, { ballast: [0.3, 0.29, 0.28] });
    concrete(p, { path: () => p.rectPath(s > 0 ? 95 : -WALL - 2, y0 - 4, WALL - 93, y1 - y0 + 8), color: [0.62, 0.6, 0.56], joints: [12, 12] });
    p.rectPath(s > 0 ? 95 : -101, y0 - 4, 6, y1 - y0 + 8).fill([0.9, 0.78, 0.15], 0.9);   // platform edge line
    for (let y = Math.ceil(y0 / 6) * 6; y < y1; y += 6) p.rectPath(s > 0 ? 102 : -106, y, 4, 3).fill([0.75, 0.72, 0.6], 0.6); // tactile strip
  }
}

function paintProps(p, lay, all, c, S) {
  const { y0, y1 } = c;
  p.props(() => new RNG(`tprops:${lay.seed}`), (Rp) => {
    // Walls + pillars + ribs cast shadows on the floor (light from the lamps is diffuse: keep them soft).
    for (const L of all) for (const pl of L.pillars) p.shadowBox(0, pl.y, 10, 10, RIB_Z);
    for (const L of all) for (const rb of L.ribs) if (!rb.fallen) p.shadowBox(0, rb.y, WALL * 2, 7, RIB_Z + 10, 0, RIB_Z);
    for (const s of [-1, 1]) p.shadow([s * WALL, y0 - 200, s * (WALL + 6), y0 - 200, s * (WALL + 6), y1 + 200, s * WALL, y1 + 200], CAP_Z);
    for (const L of all) for (const pd of L.puddles) puddle(p, new RNG(`pd:${pd.seed}`), pd.x, pd.y, pd.r, { color: [0.05, 0.06, 0.07] });
    for (const L of all) for (const z of L.zones) {
      if (z.y < y0 - 300 || z.y > y1 + 300) continue;
      const Rz = new RNG(`tzr:${z.seed}`);
      rubble(p, Rz, z.side * 80, z.y, z.r * 0.9, { rebar: true, scale: 1.4, color: [0.42, 0.4, 0.37] });
      debris(p, Rz, z.side * 70, z.y, z.r * 1.4, 80, { color: [0.45, 0.42, 0.38] });
    }
    for (const L of all) for (const d of L.debris) debris(p, new RNG(`tdb:${d.seed}`), d.x, d.y, d.r, Math.round(d.r));
    for (const L of all) for (const b of L.boulders) shadowBoulder(p, b.x, b.y, b.r, b.h);
    for (const L of all) for (const v of L.vehicles) {
      if (v.crashed) skid(p, [v.x, v.y, v.x - Math.sin(v.rot) * 4, v.y - 40 * Math.sign(Math.cos(v.rot) || 1)], 8, 0.35);
      if (v.burnt) scorch(p, Rp, v.x, v.y, 26);
      if (v.kind === 'car') car(p, v.x, v.y, v.rot, { color: v.mil ? [0.3, 0.32, 0.24] : v.color, kind: Rp.pick(['sedan', 'suv', 'van']), burnt: v.burnt, wrecked: v.crashed && !v.burnt });
      else if (v.kind === 'truck') truck(p, v.x, v.y, v.rot, { burnt: v.burnt, cargo: v.mil ? 'canvas' : Rp.pick(['box', 'tank']), cab: v.mil ? [0.28, 0.3, 0.22] : v.color, color: v.mil ? [0.3, 0.32, 0.24] : undefined });
      else bus(p, v.x, v.y, v.rot, { burnt: v.burnt, color: [0.85, 0.85, 0.82] });
    }
    // Maintenance clutter on the walkways.
    for (const L of all) for (const t of L.trains || []) p.shadowBox(t.x, t.y, 18, t.cars * 64, 24, t.derail);
    for (const L of all) for (const ct of L.carts || []) for (let k = 0; k < ct.n; k++) p.shadowBox(ct.x, ct.y + k * 18, 11, 16, 9, ct.tilt);
    for (let i = 0; i < 6; i++) { const s = Rp.sign(); if (Rp.chance(0.5)) crate(p, Rp, s * Rp.range(143, 150), Rp.range(y0 + 10, y1 - 10), Rp.range(5, 7)); else drum(p, s * Rp.range(143, 150), Rp.range(y0 + 10, y1 - 10), { color: [0.7, 0.45, 0.1] }); }
  }, 0.5, 4);
  if (p.env.glow) {
    for (const L of all) for (const a of L.anchors) {
      if (a.type === 'lamp') p.env.glow.radial(a.x * 0.86, a.y, 70, [[0, [1, 0.62, 0.28], 0.4], [1, [1, 0.5, 0.2], 0]], 'lighter', 1, 0.9);
      if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 50 * a.s, [[0, [1, 0.42, 0.1], 0.6], [1, [1, 0.3, 0.05], 0]], 'lighter');
    }
  }
}

function meshTunnel(mb, lay, c, S) {
  const { y0, y1 } = c;
  // Tunnel walls (inner faces), cast concrete with a darker plinth.
  for (const s of [-1, 1]) {
    // Inner faces face the bore: the edge runs so its right-hand normal points to the centre.
    mb.wall(s > 0 ? WALL : -WALL, s > 0 ? y1 : y0, s > 0 ? WALL : -WALL, s > 0 ? y0 : y1, 14, CAP_Z, S.P.style === 'mine' ? 'rock' : 'tunnel_wall', { ao: 1 });
    if (S.P.style === 'metro') mb.box(s * (WALL + 95) / 2 + s * 2, (y0 + y1) / 2, 0, WALL - 95, y1 - y0, 6, 0, { top: 'concrete', side: 'concrete_dark' });
    mb.wall(s > 0 ? WALL : -WALL, s > 0 ? y1 : y0, s > 0 ? WALL : -WALL, s > 0 ? y0 : y1, 0, 14, 'concrete_dark', { ao: 0.6 });
    // Cable trays along the wall.
    mb.box(s * (WALL - 2.5), (y0 + y1) / 2, 98, 4, y1 - y0, 2, 0, { top: 'metal_dark', side: 'metal_dark' });
  }
  for (const pl of lay.pillars) mb.box(0, pl.y, 0, 9, 9, RIB_Z, 0, { top: 'concrete', side: 'concrete_dark' });
  mb.box(0, (y0 + y1) / 2, 0, 6, y1 - y0, 1.2, 0, { top: 'concrete', side: 'concrete' }); // kerb line between bores
  for (const t of lay.trains || []) for (let k = 0; k < t.cars; k++) {
    const y = t.y + (k - (t.cars - 1) / 2) * 66, x = t.x + Math.sin(t.derail) * k * 14;
    mb.box(x, y, 1, 18, 62, 22, t.derail * (k % 2 ? 1 : -0.6), { top: 'train_roof', side: 'train_side' });
  }
  for (const ct of lay.carts || []) for (let k = 0; k < ct.n; k++) mb.box(ct.x, ct.y + k * 18, 2, 11, 16, 8, ct.tilt, { top: 'rust', side: 'rust' });
  for (const rb of lay.ribs) {
    if (rb.fallen) continue;
    if (S.P.style === 'mine') {
      // Timber set: two posts and a cap beam.
      for (const s of [-1, 1]) mb.box(s * (WALL - 8), rb.y, 0, 9, 9, 104, 0, { top: 'timber', side: 'timber' });
      mb.box(0, rb.y, 104, WALL * 2, 10, 10, 0, { top: 'timber', side: 'timber' });
      continue;
    }
    mb.box(0, rb.y, RIB_Z, WALL * 2, 8, 12, 0, { top: 'concrete_dark', side: 'concrete' });
    if (S.P.style === 'metro') continue;
    if (rb.fan) for (const s of [-1, 1]) {
      // Jet fans hung under the rib.
      const x = s * 70;
      mb.lathe(x, rb.y + 1, [[0, RIB_Z - 18], [5.5, RIB_Z - 17], [6, RIB_Z - 9], [5.5, RIB_Z - 1], [0, RIB_Z]], 'steel_painted', { seg: 10 });
      mb.box(x, rb.y + 10, RIB_Z - 15, 12, 5, 12, 0, { top: 'metal_dark', side: 'metal_dark' });
      mb.box(x, rb.y - 10, RIB_Z - 15, 12, 5, 12, 0, { top: 'metal_dark', side: 'metal_dark' });
    }
    if (rb.sig) for (let l = 0; l < 4; l++) for (const s of [-1, 1]) {
      const x = s * (LANES[l] + LANES[l + 1]) / 2;
      mb.box(x, rb.y - 5, RIB_Z - 7, 7, 2, 7, 0, { top: 'metal_dark', side: 'metal_dark', sides: [(l + (s > 0 ? 0 : 1)) % 3 ? 'lane_green' : 'lane_red', null, null, null] });
    }
  }
  // Fallen ribs: slabs lying from the wall down to the road.
  for (const f of lay.fallen) {
    const s = f.side, xa = s * WALL, xb = s * (WALL - 230);
    const ya = f.y, yb = f.y + 20 * s * f.tilt;
    const m = mb.mat('concrete_dark');
    mb.quad([[xa, ya - 4, RIB_Z], [xb, yb - 4, 6], [xb, yb + 4, 6], [xa, ya + 4, RIB_Z]], [[0, 0], [3, 0], [3, 0.1], [0, 0.1]], m.layer, [-s * 0.4, 0, 0.9]);
    mb.quad([[xa, ya - 4, RIB_Z - 10], [xb, yb - 4, -2], [xb, yb - 4, 6], [xa, ya - 4, RIB_Z]], [[0, 0], [3, 0], [3, 0.1], [0, 0.1]], m.layer, [0, -1, 0]);
  }
  for (const b of lay.boulders) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, 'rock_dark');
}

// =================================================================== cap

function paintCap(p, lay, c, S) {
  const { y0, y1 } = c;
  rockSurf(p, { color: [0.36, 0.33, 0.3] });
  p.noise('large', 900, 'soft-light', 0.5);
  p.patch('fbm_60', 500, [0.22, 0.19, 0.16], 0.4); // damp, darker seams
  // Strata bands parallel to the bore, darker toward the cut.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) p.rectPath(s > 0 ? WALL + 12 + k * 26 : -WALL - 12 - k * 26 - 9, y0 - 4, 9, y1 - y0 + 8).fill([0.12, 0.11, 0.1], 0.25);
    p.linear(s * WALL, 0, s * (WALL + 60), 0, [[0, [0.03, 0.03, 0.03], 0.6], [1, [0.03, 0.03, 0.03], 0]], () => p.rectPath(s > 0 ? WALL : -WALL - 60, y0 - 4, 60, y1 - y0 + 8));
  }
  const R = new RNG(`cap:${lay.seed}`);
  for (let i = 0; i < 18; i++) p.crack(R, R.sign() * R.range(WALL, 470), R.range(y0, y1), R.angle(), R.range(30, 90), 1.2, [0.02, 0.02, 0.02], 0.8);
  // Breaches: the rock face caved in over a collapse zone (the cut widens, raw rock).
  const cut = [];
  for (const z of lay.zones) if (z.breach) cut.push(z);
  // Bore opening (alpha 0) with a ragged rim, wider at breaches.
  p.ctx.beginPath();
  const n = 40;
  const wAt = (y) => {
    let w = WALL;
    for (const z of cut) { const d = Math.abs(y - z.y) / z.r; if (d < 1) w = Math.max(w, WALL + (1 - d * d) * 40); }
    return w;
  };
  for (let i = 0; i <= n; i++) { const y = y0 - 4 + ((y1 - y0 + 8) * i) / n; p.ctx.lineTo(-wAt(y) - R.range(0, 3), y); }
  for (let i = n; i >= 0; i--) { const y = y0 - 4 + ((y1 - y0 + 8) * i) / n; p.ctx.lineTo(wAt(y) + R.range(0, 3), y); }
  p.ctx.closePath();
  p.fill([0, 0, 0], 1, 'destination-out');
}
