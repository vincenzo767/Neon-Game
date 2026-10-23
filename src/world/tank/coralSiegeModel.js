import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// CORAL SIEGE — dreadnought-class coastal-assault battleship, built as real
// 3D parts.
//
// Model space (as the other 3D bosses): +y = FORWARD (the bow), +x = right
// (starboard), +z = up; the WATERLINE is z = 0. The hull is modelled down to
// its keel (z ≈ −12): the arena's water plane is depth-written before the
// boss is drawn, so everything under z = 0 is hidden by the sea and the ship
// sits IN the water at a real waterline (it pitches and rolls through it and
// sinks into it at the end). ≈ 300 × 480 units (sponsons ±150).
//
// The rig steams it bow-first toward the pilot, so the camera looks at the
// bow, the forward turrets, the wing sponsons and the front of the bridge.
//
//   hull        lofted hull: flared sides, knuckle, boot-top band, bilge,
//               keel, transom; deck (cambered), breakwater, anchors, chains,
//               bollards, rails, depth-charge rails, barbettes, hatches
//   sponsons    wide armoured wing decks either side of the hull (outrigger
//               blisters reaching the waterline), barbettes, VLS wells
//   house       forward deckhouse (ASW launcher deck, director, CIWS tubs)
//   bridge      stacked superstructure: deckhouse, two levels, the bridge
//               with wings, fire-control top, radar domes, lattice mast,
//               yards, antennas; funnels with caps
//   glass       bridge window bands (smoked glass, faint emissive)
//   red/cyan/white  emissive: navigation + combat lights, sensor lenses,
//               searchlights (drawn with their own glow)
//   radar       rotating search radar array (about local z)
//   mainHouse / mainBarrel      triple-gun turret (yaw) + its barrels (elevate, recoil)
//   secHouse / secBarrel        secondary twin rapid-fire mount
//   ciwsBase / ciwsRotor        anti-aircraft gatling: mount (yaw) + six-barrel rotor (spins)
//   vlsBase / vlsDoor           missile battery: 2 × 6 cells and the hinged cell doors
//   rbuBase / rbuTubes          ASW rocket (depth-charge) launcher: pedestal + 12-tube block
//   *Wreck      destroyed mounts; chunk / plate / shell / charge / missile: loose 3D pieces

const PAINT = [1, 1, 1];
const DARK = [0.78, 0.8, 0.84];
const RED = [2.3, 0.12, 0.12];
const CYAN = [0.25, 1.5, 2.4];
const WHITE = [2.3, 2.25, 2.1];
const GREEN = [0.2, 2.2, 0.5];

// Hull stations: [y, waterline half-beam, deck half-width, deck z, keel depth].
const STATIONS = [
  [-236, 46, 50, 19, 6], [-226, 54, 57, 19, 9], [-205, 59, 62, 19.5, 11], [-170, 62, 65, 20, 12],
  [-120, 64, 66, 21, 12], [-60, 64, 66, 21.5, 12], [0, 64, 66, 22, 12], [60, 63, 65, 22.5, 12],
  [110, 59, 62, 23, 12], [150, 52, 56, 24, 11], [182, 42, 47, 25, 10], [206, 30, 36, 26, 9],
  [224, 18, 24, 27, 8], [236, 7, 12, 28, 6], [243, 0.8, 3, 28.5, 3],
];

/** Hull half-width at the deck edge / deck height at station y (linear between stations). */
function station(y) {
  const S = STATIONS;
  if (y <= S[0][0]) return S[0];
  for (let i = 1; i < S.length; i++) {
    if (y <= S[i][0]) {
      const a = S[i - 1], b = S[i], t = (y - a[0]) / (b[0] - a[0]);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return S[S.length - 1];
}

const SP = { y0: -72, y1: 122, x0: 58, x1: 150, z: 20 };
// Starboard sponson outline (top view), mirrored for port.
const SPONSON = [[58, -72], [128, -72], [150, -40], [150, 74], [132, 104], [58, 122]];

export const CS = {
  length: [-236, 243], beam: 64, sponsonW: 150, deckZ: 22,
  station,
  sponson: SP,
  // Waterline outline (local, for the wake / water interaction): bow tip, sponson corners, stern.
  outline: [[0, 243], [24, 220], [44, 182], [56, 150], [58, 122], [132, 104], [150, 74], [150, -40], [128, -72], [62, -120], [60, -200], [48, -236],
    [-48, -236], [-60, -200], [-62, -120], [-128, -72], [-150, -40], [-150, 74], [-132, 104], [-58, 122], [-56, 150], [-44, 182], [-24, 220]],
  // Main turrets A (bow), B (port wing), C (starboard wing): ring centre on the barbette top.
  main: [[0, 150, 26], [-104, 62, 22.5], [104, 62, 22.5]],
  mainRest: [0, 0.22, -0.22],
  mainArc: [[-2.4, 2.4], [-0.75, 2.5], [-2.5, 0.75]],          // yaw limits (local Rz, 0 = forward, + = toward port)
  mainBarrels: [[-9, 17, 7.5], [0, 17, 7.5], [9, 17, 7.5]],    // trunnions (turret space)
  mainMuzzle: [0, 62, 0],                                       // barrel space
  // Secondary twin mounts (port, starboard) on the sponsons.
  sec: [[-100, 2, 22], [100, 2, 22]],
  secRest: [0.5, -0.5],
  secBarrels: [[-3.6, 9, 4.5], [3.6, 9, 4.5]],
  secMuzzle: [0, 34, 0],
  // CIWS gatlings: [x, y, z] per side (3 each). Index 0..2 port, 3..5 starboard.
  ciws: [[-126, 92, 22], [-126, -50, 22], [-30, 112, 36], [126, 92, 22], [126, -50, 22], [30, 112, 36]],
  ciwsRest: [0.9, 1.9, 0.4, -0.9, -1.9, -0.4],
  ciwsRotor: [0, 4, 9],                                         // mount space
  ciwsMuzzle: [0, 22, 0],                                       // rotor space
  // VLS batteries on the sponson outer strips: block centre; cells at local (cx, cy).
  vls: [[-136, 2, 20], [136, 2, 20]],
  vlsCells: [[-5, -30], [5, -30], [-5, -18], [5, -18], [-5, -6], [5, -6], [-5, 6], [5, 6], [-5, 18], [5, 18], [-5, 30], [5, 30]],
  vlsTop: 6,                                                    // cell mouth height above the block base
  // ASW rocket launchers on the forward deckhouse.
  rbu: [[-20, 84, 34.5], [20, 84, 34.5]],
  rbuPivot: [0, 0, 6],
  rbuTubes: (() => { const out = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push([(c - 1.5) * 3.6, 0, (r - 1) * 3.4]); return out; })(),
  rbuMuzzle: 16,
  // Superstructure.
  bridge: { y: -46, z: 66, front: -34 },
  radar: [0, -82, 128],
  searchlights: [[-46, -40, 63], [46, -40, 63]],
  funnels: [[0, -160, 20, 12, 17, 64], [0, -192, 20, 9, 12, 52]],   // x, y, z0, half-w, half-l, top
  stacks: [[0, -166, 64], [0, -196, 52]],                           // smoke source points
  houseFront: [0, 118, 34],
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- helpers

/** Flat plate polygon (xy outline) between z0 and z1. */
function plate(m, pts, z0, z1, layer, sideLayer = layer) {
  m.loft([{ pts, z: z0 }, { pts, z: z1 }], { layer: sideLayer, top: layer, bottom: layer, uv: 60 });
}

/** Up-facing quad with explicit UVs (decals: hazard stripes, hull number). */
function decal(m, x0, y0, x1, y1, z, layer, uv) {
  const [u0, v0, u1, v1] = uv;
  const a = m.vert(x0, y0, z, 0, 0, 1, u0, v1, layer), b = m.vert(x1, y0, z, 0, 0, 1, u1, v1, layer);
  const c = m.vert(x1, y1, z, 0, 0, 1, u1, v0, layer), d = m.vert(x0, y1, z, 0, 0, 1, u0, v0, layer);
  m.tri(a, b, c); m.tri(a, c, d);
}

/** Closed polygon rings (top view), any count, stepping inward: armoured houses. */
function house(m, pts, levels, layer, o = {}) {
  const rings = levels.map(([z, k, dy = 0]) => {
    let cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
    cx /= pts.length / 2; cy /= pts.length / 2;
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(cx + (pts[i] - cx) * k, cy + (pts[i + 1] - cy) * k + dy);
    return { pts: out, z };
  });
  m.loft(rings, { layer, top: o.top ?? layer, bottom: o.bottom, uv: o.uv || 50 });
}

/**
 * Smooth open strip through rows of 3D points (rows[j][k], all the same
 * count): normals averaged over the adjacent faces, oriented away from
 * `axis(p)`. Band k (between points k and k+1) uses layers[k].
 */
function strip(m, rows, layers, axis, uvScale = 80) {
  const J = rows.length, K = rows[0].length;
  const N = rows.map(() => new Array(K));
  for (let j = 0; j < J; j++) for (let k = 0; k < K; k++) {
    let nx = 0, ny = 0, nz = 0;
    for (const jj of [j - 1, j]) for (const kk of [k - 1, k]) {
      if (jj < 0 || jj >= J - 1 || kk < 0 || kk >= K - 1) continue;
      const a = rows[jj][kk], b = rows[jj][kk + 1], c = rows[jj + 1][kk];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const ax = axis(a), dx = a[0] - ax[0], dy = a[1] - ax[1], dz = a[2] - ax[2];
      if (fx * dx + fy * dy + fz * dz < 0) { fx = -fx; fy = -fy; fz = -fz; }
      const l = Math.hypot(fx, fy, fz) || 1;
      nx += fx / l; ny += fy / l; nz += fz / l;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    N[j][k] = [nx / l, ny / l, nz / l];
  }
  // u: distance around the ring (per row), v: along y.
  const U = rows.map((r) => { const u = [0]; for (let k = 1; k < K; k++) u.push(u[k - 1] + Math.hypot(r[k][0] - r[k - 1][0], r[k][2] - r[k - 1][2])); return u; });
  for (let k = 0; k < K - 1; k++) {
    const ids = [];
    for (let j = 0; j < J; j++) {
      const row = [];
      for (const kk of [k, k + 1]) {
        const p = rows[j][kk], n = N[j][kk];
        row.push(m.vert(p[0], p[1], p[2], n[0], n[1], n[2], U[j][kk] / uvScale, -p[1] / uvScale, layers[k]));
      }
      ids.push(row);
    }
    for (let j = 0; j < J - 1; j++) { const a = ids[j][0], b = ids[j][1], c = ids[j + 1][1], d = ids[j + 1][0]; m.tri(a, b, c); m.tri(a, c, d); }
  }
}

/** Bollard pair. */
function bollards(m, x, y, z) {
  for (const dy of [-3.2, 3.2]) m.lathe(x, y + dy, [[1.7, z], [1.5, z + 3], [2.2, z + 3.6], [2.2, z + 4.2]], TL.DARK, { seg: 10, uv: 20 });
}

/** Guard rail along a polyline (posts + two rails). */
function rail(m, pts, z, h = 4.2) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 11));
    for (let k = 0; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; m.tube([x, y, z], [x, y, z + h], 0.32, TL.DARK, { seg: 4, uvV: 10 }); }
    for (const zz of [z + h, z + h * 0.55]) m.tube([a[0], a[1], zz], [b[0], b[1], zz], 0.28, TL.DARK, { seg: 4, uvV: 30 });
  }
}

// ---------------------------------------------------------------- hull

function hull() {
  const m = new TankMesh();
  // Sides: one strip per side from the deck edge down to the keel.
  const ring = (st, s) => {
    const [y, w, f, z, k] = st;
    return [
      [s * f, y, z], [s * (f - 0.6), y, z - 2.5], [s * (w + (f - w) * 0.25), y, 4], [s * w, y, 3], [s * w, y, -1], [s * w * 0.8, y, -k * 0.65], [s * 0.01, y, -k],
    ];
  };
  const fine = [];
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const a = STATIONS[i], b = STATIONS[i + 1], n = Math.max(1, Math.round((b[0] - a[0]) / 14));
    for (let k = 0; k < n; k++) fine.push(station(a[0] + ((b[0] - a[0]) * k) / n));
  }
  fine.push(STATIONS[STATIONS.length - 1]);
  m.with({ tint: PAINT, ao: [-6, 16] }, () => {
    for (const s of [-1, 1]) {
      strip(m, fine.map((st) => ring(st, s)), [TL.NAVY, TL.NHULL, TL.DARK, TL.DARK, TL.NHULL, TL.NHULL], (p) => [0, p[1], 6], 70);
    }
  });
  // Transom (flat stern face).
  m.with({ tint: [0.9, 0.92, 0.95], ao: [-4, 14] }, () => {
    const st = STATIONS[0], L = ring(st, -1), Rr = ring(st, 1);
    const pts = [...L, ...Rr.slice().reverse()];
    const c = m.vert(0, st[0], 6, 0, -1, 0, 0.5, 0, TL.NHULL), ids = pts.map((p) => m.vert(p[0], p[1], p[2], 0, -1, 0, p[0] / 60, -p[2] / 60, TL.NHULL));
    for (let i = 0; i < ids.length; i++) m.tri(c, ids[i], ids[(i + 1) % ids.length]);
  });
  // Deck: cambered surface (two bands either side of the crown).
  m.with({ tint: [0.92, 0.94, 0.96] }, () => {
    for (let i = 0; i < fine.length - 1; i++) {
      const a = fine[i], b = fine[i + 1];
      for (const s of [-1, 1]) {
        const P = [[s * a[2], a[0], a[3]], [0, a[0], a[3] + 1.2], [0, b[0], b[3] + 1.2], [s * b[2], b[0], b[3]]];
        const uv = P.map((p) => [p[0] / 70, -p[1] / 70]);
        m.quad(P, uv, TL.NDECK, [0, (a[0] + b[0]) / 2, -50]);
      }
    }
  });
  // Bow: breakwater, hull number panels on the flanks, anchors, chains, jack staff.
  m.with({ tint: PAINT, ao: [24, 30] }, () => {
    for (const s of [-1, 1]) {
      m.loft([{ pts: [0, 188, s * 40, 168, s * 40, 165, 0, 185], z: 24.5 }, { pts: [0, 188, s * 40, 168, s * 40, 165, 0, 185], z: 30 }], { layer: TL.NAVY, top: TL.DARK, uv: 40 });
    }
  });
  // Hull number "21" on both bow flanks (vertical decals slightly proud of the side).
  for (const s of [-1, 1]) {
    const y0 = 196, y1 = 216, za = 8, zb = 20;
    const p = (y, z) => { const st = station(y), w = st[1] + (st[2] - st[1]) * Math.max(0, Math.min(1, (z - 4) / (st[3] - 4))); return [s * (w + 0.4), y, z]; };
    const A = p(y0, za), B = p(y1, za), C = p(y1, zb), D = p(y0, zb), n = [s * 0.85, 0.5, 0.15];
    const ids = [[A, s > 0 ? 0.25 : 0.75, 1], [B, s > 0 ? 0.75 : 0.25, 1], [C, s > 0 ? 0.75 : 0.25, 0.55], [D, s > 0 ? 0.25 : 0.75, 0.55]].map(([q, u, v]) => m.vert(q[0], q[1], q[2], n[0], n[1], n[2], u, v, TL.CSMARK));
    m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]);
  }
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      const st = station(214);
      m.tube([s * (st[2] - 3), 214, 21], [s * (st[2] + 1.5), 216, 19], 3.2, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.DARK, uvV: 10 }); // hawse pipe
      m.box(s * (st[2] + 1.2), 214, 9, 3, 9, 9, TL.BARREL, { bevel: 1 });                                                            // stowed anchor
      for (let k = 0; k < 9; k++) m.box(s * (7 + k * 1.3), 212 - k * 2.6, 27.6, 1.6, 2.2, 0.9, TL.BARREL, { bevel: 0.2 });              // chain to the windlass
      m.lathe(s * 9, 186, [[3.4, 25], [3.4, 28.5], [2.6, 30]], TL.DARK, { seg: 12, uv: 20 });                                      // windlass
    }
    m.tube([0, 238, 28], [0, 238.5, 42], 0.5, TL.DARK, { seg: 5, uvV: 20 });
    // Bollards and fairleads along the deck edges.
    for (const y of [200, 164, -182, -214]) { const st = station(y); for (const s of [-1, 1]) bollards(m, s * (st[2] - 6), y, st[3]); }
    // Hatches, vents and lockers on the open decks.
    const R = rnd(91);
    for (const [x, y, w, d] of [[0, 128, 14, 10], [-30, -196, 10, 8], [30, -196, 10, 8], [0, -220, 16, 6], [-36, 132, 8, 8], [36, 132, 8, 8]]) {
      const z = station(y)[3] + 0.6;
      m.box(x, y, z, w, d, 1.6, TL.NAVY, { bevel: 0.5 });
      m.box(x + w * 0.3, y, z + 1.6, 1.4, d * 0.6, 0.6, TL.DARK, { bevel: 0.1 });
    }
    for (let k = 0; k < 8; k++) { const y = -232 + R() * 30, x = (R() - 0.5) * 70; m.lathe(x, y, [[1.6, station(y)[3]], [1.6, station(y)[3] + 3], [2.2, station(y)[3] + 3.4]], TL.DARK, { seg: 8, uv: 20 }); }
  });
  // Barbette of A (the turret house turns on it).
  m.with({ tint: PAINT, ao: [24, 27] }, () => m.lathe(0, CS.main[0][1], [[30, 23.6], [30, 25.2], [28, 26]], TL.NAVY, { seg: 32, uv: 40, top: TL.DARK }));
  // Quarterdeck: depth-charge rails with charges, hazard edge, flag staff.
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      for (const o of [-3, 3]) m.box(s * 26 + o, -219, 19.4, 1, 34, 1.2, TL.BARREL, { bevel: 0.1 });
      for (let k = 0; k < 5; k++) m.tube([s * 26, -232 + k * 6.6, 22.6], [s * 26, -227 + k * 6.6, 22.6], 2.4, TL.BARREL, { seg: 10, caps: true, capLayer: TL.DARK, uvV: 8 });
    }
    m.tube([0, -233, 19], [0, -233, 34], 0.45, TL.DARK, { seg: 5, uvV: 20 });
  });
  decal(m, -44, -235, 44, -231, 19.6, TL.CSMARK, [0, 0, 2.4, 0.12]);
  return m.finish();
}

/** Guard rails on the forecastle and quarterdeck (posts follow the sheer of the deck). */
function rails() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) for (const [ya, yb] of [[176, 234], [-234, -150]]) {
      for (let y = ya; y < yb; y += 10) {
        const a = station(y), b = station(Math.min(yb, y + 10)), xa = s * (a[2] - 1), xb = s * (b[2] - 1);
        m.tube([xa, y, a[3]], [xa, y, a[3] + 4.4], 0.32, TL.DARK, { seg: 4, uvV: 10 });
        for (const h of [4.4, 2.4]) m.tube([xa, y, a[3] + h], [xb, Math.min(yb, y + 10), b[3] + h], 0.26, TL.DARK, { seg: 4, uvV: 30 });
      }
    }
  });
  return m.finish();
}

// ------------------------------------------------------------- sponsons

function sponsons() {
  const m = new TankMesh();
  for (const s of [-1, 1]) {
    const pts = (k = 0) => { const out = []; for (const [x, y] of SPONSON) out.push(s * (x - (x > 60 ? k : 0)), y + (y > 0 ? -k * 0.5 : k * 0.5)); return out; };
    m.with({ tint: PAINT, ao: [-4, 17] }, () => m.loft([
      { pts: pts(8), z: -11 }, { pts: pts(0), z: 1 }, { pts: pts(-1.5), z: 15 }, { pts: pts(-1.5), z: 18.2 }, { pts: pts(0), z: SP.z },
    ], { layer: TL.NAVY, top: TL.NDECK, uv: 60, sides: undefined }));
    // Boot-top band where the blister meets the sea.
    m.with({ tint: [0.6, 0.62, 0.66] }, () => m.loft([{ pts: pts(0.4), z: -0.5 }, { pts: pts(-0.2), z: 3.2 }], { layer: TL.DARK, top: false, uv: 40 }));
    // Armour belt plates along the outer face.
    m.with({ tint: [0.96, 0.98, 1] }, () => {
      for (let k = 0; k < 6; k++) {
        const y = -30 + k * 18;
        m.box(s * 151.4, y, 6, 2.2, 16, 9, TL.NAVY, { bevel: 0.6 });
      }
    });
    // Barbette of the wing turret, secondary mount ring, CIWS tubs.
    m.with({ tint: PAINT, ao: [19, 22] }, () => {
      m.lathe(s * 104, 62, [[30, SP.z - 0.5], [30, SP.z + 1.8], [28, SP.z + 2.5]], TL.NAVY, { seg: 32, uv: 40, top: TL.DARK });
      m.lathe(s * 100, 2, [[16, SP.z - 0.5], [16, SP.z + 1.6], [15, SP.z + 2]], TL.NAVY, { seg: 20, uv: 30, top: TL.DARK });
      for (const [x, y] of [[126, 92], [126, -50]]) m.lathe(s * x, y, [[10, SP.z - 0.5], [10, SP.z + 2.5], [9.4, SP.z + 2.8]], TL.NAVY, { seg: 16, uv: 30, top: TL.NDECK });
    });
    // VLS well (the battery sits in it), RHIB on its davit, lockers, vents, deck-edge hazard strips.
    m.with({ tint: DARK }, () => {
      m.box(s * 136, 2, SP.z - 1.2, 26, 82, 1.4, TL.DARK, { bevel: 0.3 });
      const R = rnd(s > 0 ? 7 : 8);
      for (let k = 0; k < 4; k++) m.box(s * (72 + R() * 18), -64 + k * 9, SP.z, 7, 5, 3, TL.NAVY, { bevel: 0.6 });
      m.box(s * 92, -48, SP.z, 10, 18, 4, TL.GRILLE, { bevel: 0.4 });
    });
    m.with({ tint: [1.1, 0.5, 0.25] }, () => { m.tube([s * 112, -66, SP.z + 4], [s * 112, -40, SP.z + 4], 4, TL.NAVY, { r1: 3.4, seg: 12, caps: true, uvV: 20 }); });
    for (const [ya, yb] of [[-38, 70]]) decal(m, s > 0 ? 147 : -150, ya, s > 0 ? 150 : -147, yb, SP.z + 0.05, TL.CSMARK, [0, 0, 0.25, 2.2]);
    decal(m, s > 0 ? 70 : -126, -71, s > 0 ? 126 : -70, -68, SP.z + 0.05, TL.CSMARK, [0, 0, 1.6, 0.1]);
  }
  return m.finish();
}

/** Guard rails on the sponson edges. */
function sponsonRails() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      const pts = SPONSON.map(([x, y]) => [s * (x - 1.5), y]).slice(1, 5);
      rail(m, pts, SP.z, 3.6);
    }
  });
  return m.finish();
}

// ------------------------------------------------------- superstructure

/** Forward deckhouse: ASW deck, director pedestal, CIWS tubs at its front corners. */
function deckhouse() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [22, 33] }, () => {
    house(m, [-38, 56, 38, 56, 40, 104, 30, 120, -30, 120, -40, 104], [[22, 1], [33, 0.98], [34.5, 0.96]], TL.NAVY, { top: TL.NDECK });
    for (const s of [-1, 1]) m.lathe(s * 30, 112, [[8, 34], [8, 36.4], [7.4, 36.8]], TL.NAVY, { seg: 14, uv: 30, top: TL.NDECK });
    // Fire-control director: drum + rangefinder arms.
    m.lathe(0, 66, [[9, 34], [8, 41], [6, 44]], TL.NAVY, { seg: 14, uv: 30 });
    m.box(0, 66, 41, 30, 4, 3.4, TL.DARK, { bevel: 0.6 });
    for (const s of [-1, 1]) m.tube([s * 15, 66, 42.7], [s * 17, 66, 42.7], 2, TL.DARK, { seg: 8, caps: true, capLayer: TL.GLOW, uvV: 5 });
  });
  // Doors and portholes on the front face.
  m.with({ tint: DARK }, () => { for (const x of [-14, 14]) m.box(x, 120.4, 22.5, 6, 0.8, 9, TL.DARK, { bevel: 0.2 }); });
  decal(m, -30, 118.6, 30, 120.2, 34.6, TL.CSMARK, [0, 0, 1.2, 0.1]);
  return m.finish();
}

/** Superstructure base: the long deckhouse, level 2, radar domes, funnels. */
function bridgeBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [22, 42] }, () => {
    // Level 1: the long deckhouse.
    house(m, [-46, -150, 46, -150, 48, -30, 40, -18, -40, -18, -48, -30], [[21, 1], [40, 0.99], [41.5, 0.97]], TL.NAVY, { top: TL.NDECK });
    // Level 2.
    house(m, [-38, -128, 38, -128, 38, -40, 30, -32, -30, -32, -38, -40], [[41, 1], [54, 0.98], [55.2, 0.96]], TL.NAVY, { top: TL.NDECK });
    // Radar domes on the level-2 roof.
    for (const s of [-1, 1]) {
      m.lathe(s * 24, -110, [[2, 55], [2, 60]], TL.DARK, { seg: 8, uv: 20 });
      m.with({ tint: [1.25, 1.27, 1.3] }, () => m.lathe(s * 24, -110, [[6.5, 60], [8, 63], [7.6, 66], [5.4, 68.4], [2.2, 69.6], [0, 70]], TL.NAVY, { seg: 18, uv: 30 }));
    }
    // Funnels: raked oval stacks with caps.
    for (const [x, y, z0, hw, hl, top] of CS.funnels) {
      const ring = (z, k, dy) => { const p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push(x + Math.cos(a) * hw * k, y + Math.sin(a) * hl * k + dy); } return { pts: p, z }; };
      m.loft([ring(z0, 1.05, 0), ring(top - 6, 0.94, -(top - z0) * 0.18), ring(top - 4, 1.05, -(top - z0) * 0.19), ring(top, 1.04, -(top - z0) * 0.2)], { layer: TL.NAVY, top: TL.GRILLE, uv: 50 });
    }
  });
  return m.finish();
}

/** The bridge proper: bridge level with wings, fire-control top, mast, radar platform, antennas. */
function bridge() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [22, 42] }, () => {
    // Bridge level (front at y = −34) with wings.
    house(m, [-34, -74, 34, -74, 36, -40, 26, -30, -26, -30, -36, -40], [[55, 1], [63, 1.0, 0.6], [67, 0.95, -0.8], [68, 0.92, -1]], TL.NAVY, { top: TL.DARK });
    for (const s of [-1, 1]) plate(m, [s * 34, -44, s * 50, -42, s * 50, -34, s * 34, -36], 59, 61, TL.NDECK, TL.NAVY);
    // Fire-control top and its rangefinder.
    house(m, [-22, -98, 22, -98, 24, -60, 16, -52, -16, -52, -24, -60], [[67, 1], [76, 0.96], [77, 0.92]], TL.NAVY, { top: TL.NDECK });
    m.box(0, -60, 77, 44, 5, 4, TL.DARK, { bevel: 0.6 });
    for (const s of [-1, 1]) m.tube([s * 22, -60, 79], [s * 25, -60, 79], 2.4, TL.DARK, { seg: 8, caps: true, capLayer: TL.GLOW, uvV: 5 });
    // Searchlight platforms on the wings.
    for (const [x, y, z] of CS.searchlights) { m.lathe(x, y, [[3, z - 2], [3, z], [2.6, z + 0.6]], TL.DARK, { seg: 10, uv: 20 }); m.tube([x, y - 1, z + 2.5], [x, y + 3, z + 2.5], 2.6, TL.DARK, { seg: 12, caps: 'start', capLayer: TL.DARK, uvV: 8 }); }
  });
  // Lattice mast: tripod legs, yards, platforms, antennas.
  m.with({ tint: DARK }, () => {
    const top = [0, -84, 150];
    for (const [x, y] of [[-14, -70], [14, -70], [0, -98]]) m.tube([x, y, 76], top, 1.3, TL.BARREL, { seg: 6, uvV: 40 });
    for (const z of [96, 112]) { const k = (z - 76) / (150 - 76); m.tube([-14 * (1 - k), -70 - (-84 + 70) * k * -1, z], [14 * (1 - k), -70 - (-84 + 70) * k * -1, z], 0.7, TL.BARREL, { seg: 5, uvV: 20 }); }
    m.tube([-26, -84, 136], [26, -84, 136], 0.8, TL.BARREL, { seg: 6, uvV: 30 });
    m.tube([-18, -84, 146], [18, -84, 146], 0.6, TL.BARREL, { seg: 6, uvV: 30 });
    m.lathe(0, -84, [[9, 120], [9, 122], [8, 122.6]], TL.DARK, { seg: 12, uv: 20 });                 // radar platform
    m.tube([0, -84, 150], [0, -84, 172], 0.45, TL.DARK, { seg: 5, uvV: 30 });                        // topmast
    for (const s of [-1, 1]) { m.tube([s * 22, -84, 136], [s * 22, -84, 126], 0.3, TL.DARK, { seg: 4, uvV: 10 }); m.tube([s * 4, -82, 160], [s * 12, -78, 154], 0.3, TL.DARK, { seg: 4, uvV: 10 }); }
    // Whip antennas on the bridge roof.
    for (const [x, y] of [[-30, -70], [30, -70], [-20, -96], [20, -96]]) m.tube([x, y, 68], [x, y, 92], 0.25, TL.DARK, { seg: 4, uvV: 20 });
  });
  m.with({ tint: [0.95, 0.85, 0.3] }, () => decal(m, -16, -52.5, 16, -51.6, 77.1, TL.CSMARK, [0, 0, 0.8, 0.08]));
  return m.finish();
}

/** Bridge window bands (smoked glass with a faint lit interior). */
function glass() {
  const m = new TankMesh();
  m.with({ tint: [0.55, 0.62, 0.7], em: 0.25 }, () => {
    const band = (pts, z0, z1, out) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        m.quad([[a[0], a[1], z0], [b[0], b[1], z0], [b[0] + out[i][0], b[1] + out[i][1], z1], [a[0] + out[i][0], a[1] + out[i][1], z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], TL.GLASS, [0, -55, z0]);
      }
    };
    // Bridge front, raked outward (windows lean out at the top).
    band([[-36.2, -40], [-26.2, -29.8], [26.2, -29.8], [36.2, -40]], 60, 64.6, [[-0.4, 0.5], [0, 0.7], [0.4, 0.5]]);
    band([[-36.4, -70], [-36.4, -41]], 60, 64.6, [[-0.5, 0]]);
    band([[36.4, -41], [36.4, -70]], 60, 64.6, [[0.5, 0]]);
    band([[-24.2, -60], [-16.2, -51.8], [16.2, -51.8], [24.2, -60]], 70.5, 74, [[-0.2, 0.2], [0, 0.3], [0.2, 0.2]]);
    // Level-2 portholes as a narrow band.
    band([[-30.4, -32.2], [30.4, -32.2]], 47, 49, [[0, 0.1]]);
  });
  return m.finish();
}

/** Red: navigation / combat lights (deck edges, mast, bridge, sponson corners). */
function red() {
  const m = new TankMesh();
  m.with({ tint: RED, em: 1, ao: null }, () => {
    const dot = (x, y, z, s = 1.4) => m.box(x, y, z, s, s, s, TL.GLOW, { bevel: 0 });
    for (const s of [-1, 1]) {
      for (const [x, y] of [[132, 103], [150, 72], [150, -38], [128, -71]]) dot(s * x, y, SP.z + 4.8, 1.8);
      for (const y of [150, 100, 40, -20, -90, -150, -200]) { const st = station(y); dot(s * (st[2] - 0.5), y, st[3] + 0.4, 1.4); }
      dot(s * 50, -38, 61.4, 1.8);
      dot(s * 26, -84, 136.6, 1.4);
      m.box(s * 39.5, 104, 30, 0.6, 10, 1, TL.GLOW, { bevel: 0 });
      m.box(s * 47.6, -90, 36, 0.6, 30, 1, TL.GLOW, { bevel: 0 });
    }
    dot(0, -84, 172.4, 1.8);
    dot(0, 238.5, 42.4, 1.2);
    m.box(0, -18.2, 36, 40, 0.6, 1, TL.GLOW, { bevel: 0 });
  });
  m.with({ tint: GREEN, em: 1, ao: null }, () => m.box(50, -36, 61.4, 1.8, 1.8, 1.8, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function cyan() {
  const m = new TankMesh();
  m.with({ tint: CYAN, em: 1, ao: null }, () => {
    for (const s of [-1, 1]) {
      m.box(s * 24, -60, 74.2, 6, 0.6, 1.2, TL.GLOW, { bevel: 0 });
      m.box(s * 46.2, -80, 30, 0.6, 18, 1, TL.GLOW, { bevel: 0 });
      m.box(s * 15, 120.6, 28, 3, 0.5, 1, TL.GLOW, { bevel: 0 });
    }
    m.box(0, -30.4, 52, 34, 0.5, 0.8, TL.GLOW, { bevel: 0 });
  });
  return m.finish();
}

function white() {
  const m = new TankMesh();
  m.with({ tint: WHITE, em: 1, ao: null }, () => {
    for (const [x, y, z] of CS.searchlights) m.tube([x, y - 1.2, z + 2.5], [x, y - 1.6, z + 2.5], 2.2, TL.GLOW, { seg: 12, caps: 'end', uvV: 4 });
    m.box(0, -84, 151, 1.2, 1.2, 1.2, TL.GLOW, { bevel: 0 });
  });
  return m.finish();
}

/** Search radar: a slatted planar array on a turning head (about local z). */
function radar() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.lathe(0, 0, [[3, 0], [2.6, 5], [2, 6]], TL.DARK, { seg: 10, uv: 20 });
    m.box(0, 1, 6, 30, 2, 8, TL.GRILLE, { bevel: 0.3 });
    m.box(0, -1.5, 8, 10, 3, 4, TL.NAVY, { bevel: 0.5 });
  });
  return m.finish();
}

// ------------------------------------------------------------- weapons

/** Main triple-gun turret house (origin: ring centre on the barbette top, front = +y). */
function mainHouse() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 9] }, () => {
    m.lathe(0, 0, [[27, -1], [27, 1.5], [26, 2]], TL.DARK, { seg: 28, uv: 30 });
    house(m, [-22, -24, 22, -24, 27, -8, 25, 14, 14, 27, -14, 27, -25, 14, -27, -8], [[1.5, 1], [10, 1, -1.5], [15.5, 0.93, -2.6], [16.6, 0.88, -2.8]], TL.NAVY, { top: TL.NAVY, uv: 44 });
    // Roof: armour plates, hatches, periscopes.
    m.box(0, -6, 16.4, 30, 22, 1.2, TL.NAVY, { bevel: 0.5 });
    for (const s of [-1, 1]) { m.box(s * 10, -12, 17.6, 6, 6, 1.2, TL.DARK, { bevel: 0.3 }); m.box(s * 16, 10, 16.4, 3, 3, 2.8, TL.DARK, { bevel: 0.3 }); }
    // Rangefinder ears either side at the back.
    for (const s of [-1, 1]) { m.box(s * 27, -14, 7, 6, 10, 6, TL.NAVY, { bevel: 0.8 }); m.tube([s * 27, -9, 10], [s * 27, -8, 10], 2, TL.DARK, { seg: 8, caps: 'end', capLayer: TL.GLOW, uvV: 4 }); }
    // Gun ports: dark slots in the front face where the barrels leave the house.
    for (const [x] of [[-9], [0], [9]]) m.box(x, 25.2, 3.5, 6, 2.4, 8, TL.DARK, { bevel: 0.4 });
    // Rear overhang / bustle with vents.
    m.box(0, -25, 4, 34, 6, 9, TL.NAVY, { bevel: 0.8 });
    m.box(0, -28.2, 6, 24, 0.8, 4, TL.GRILLE, { bevel: 0 });
  });
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 22, 18, 11, 1, 1, 1, TL.GLOW, { bevel: 0 }); m.box(0, 26.6, 13.6, 12, 0.5, 0.7, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

/** One big gun: mantlet + tapered barrel + muzzle ring (origin: trunnion, along +y). */
function mainBarrel() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 2, -3.6, 6.4, 10, 7.2, TL.NAVY, { bevel: 0.8 });
    m.tube([0, 6, 0], [0, 14, 0], 3.7, TL.BARREL, { r1: 3.3, seg: 14, uvV: 20 });
    m.tube([0, 14, 0], [0, 56, 0], 3.0, TL.BARREL, { r1: 2.3, seg: 14, uvV: 50 });
    m.tube([0, 56, 0], [0, 62, 0], 2.9, TL.DARK, { r1: 2.8, seg: 14, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    m.tube([0, 62, 0], [0, 61, 0], 1.6, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.DARK, uvV: 4 });
  });
  return m.finish();
}

function secHouse() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 6] }, () => {
    m.lathe(0, 0, [[15, -1], [15, 1], [14, 1.5]], TL.DARK, { seg: 20, uv: 30 });
    house(m, [-11, -12, 11, -12, 14, -2, 12, 9, 6, 15, -6, 15, -12, 9, -14, -2], [[1, 1], [7, 1, -1], [9.6, 0.9, -1.8]], TL.NAVY, { top: TL.NAVY, uv: 30 });
    for (const x of [-3.6, 3.6]) m.box(x, 14.4, 2, 3.6, 1.6, 5, TL.DARK, { bevel: 0.2 });
    m.box(-8, -6, 9.6, 4, 4, 1.4, TL.DARK, { bevel: 0.3 });
  });
  m.with({ tint: RED, em: 1, ao: null }, () => m.box(0, 15.2, 8, 6, 0.4, 0.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function secBarrel() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.tube([0, 0, 0], [0, 8, 0], 2.2, TL.BARREL, { seg: 10, uvV: 10 });
    m.tube([0, 8, 0], [0, 30, 0], 1.5, TL.BARREL, { r1: 1.25, seg: 10, uvV: 30 });
    m.tube([0, 30, 0], [0, 34, 0], 1.8, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.DARK, uvV: 6 });
  });
  return m.finish();
}

/** CIWS mount: pedestal, turning body with the white radome, elevating cradle. */
function ciwsBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 4] }, () => {
    m.lathe(0, 0, [[7, 0], [6.5, 3], [5.5, 4]], TL.NAVY, { seg: 14, uv: 20 });
    m.box(0, -1, 4, 10, 12, 6, TL.NAVY, { bevel: 1 });
  });
  m.with({ tint: [1.3, 1.32, 1.36] }, () => m.lathe(0, -3, [[5, 9], [5.2, 14], [4.4, 17], [2.4, 18.6], [0, 19]], TL.NAVY, { seg: 16, uv: 20 }));
  m.with({ tint: DARK }, () => { m.box(0, 4, 7, 6, 6, 4, TL.DARK, { bevel: 0.4 }); m.tube([4.6, -4, 8], [6.4, -4, 8], 2, TL.DARK, { seg: 8, caps: true, uvV: 5 }); });
  return m.finish();
}

function ciwsRotor() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.tube([Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6], [Math.cos(a) * 1.6, 22, Math.sin(a) * 1.6], 0.55, TL.BARREL, { seg: 5, caps: 'end', capLayer: TL.DARK, uvV: 20 }); }
    for (const y of [1, 11, 20]) m.tube([0, y, 0], [0, y + 1.4, 0], 2.6, TL.DARK, { seg: 10, caps: true, capLayer: TL.DARK, uvV: 6 });
  });
  return m.finish();
}

/** VLS battery block: 2 × 6 cells (origin: block centre at its base). */
function vlsBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 5] }, () => {
    m.box(0, 0, 0, 24, 78, 5.4, TL.NAVY, { bevel: 0.6 });
    for (const [cx, cy] of CS.vlsCells) m.box(cx, cy, 5.4, 9, 11, 0.3, TL.DARK, { bevel: 0 });
  });
  m.with({ tint: [0.25, 0.25, 0.28] }, () => { for (const [cx, cy] of CS.vlsCells) m.box(cx, cy, 5.5, 7, 9, 0.2, TL.GRILLE, { bevel: 0 }); });
  m.with({ tint: [0.9, 0.85, 0.7] }, () => decal(m, -12, 39.2, 12, 40.6, 5.45, TL.CSMARK, [0, 0, 1, 0.12]));
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const [cx, cy] of CS.vlsCells) m.box(cx + (cx > 0 ? 4.8 : -4.8), cy, 5, 0.5, 6, 0.6, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

/** One cell door, hinged at its outer edge (local origin on the hinge, the door lies toward −x). */
function vlsDoor() {
  const m = new TankMesh();
  m.with({ tint: [0.95, 0.97, 1] }, () => m.box(-4.4, 0, 0, 8.6, 10.4, 0.9, TL.NAVY, { bevel: 0.2 }));
  return m.finish();
}

function rbuBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 4] }, () => {
    m.lathe(0, 0, [[6.5, 0], [6, 2.5], [5, 3]], TL.NAVY, { seg: 14, uv: 20 });
    for (const s of [-1, 1]) m.box(s * 8.4, 0, 1, 2.2, 8, 7, TL.NAVY, { bevel: 0.4 });
  });
  return m.finish();
}

/** 12-tube rocket block (origin: trunnion, tubes along +y). */
function rbuTubes() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 4, -6, 16.4, 13, 12, TL.NAVY, { bevel: 0.6 });
    for (const [x, , z] of CS.rbuTubes) m.tube([x, 8, z], [x, CS.rbuMuzzle, z], 1.6, TL.BARREL, { seg: 8, caps: 'end', capLayer: TL.GRILLE, uvV: 10 });
  });
  m.with({ tint: [1, 0.8, 0.2] }, () => m.box(0, 10.5, 6.1, 14, 4, 0.3, TL.CSMARK, { bevel: 0 }));
  return m.finish();
}

function wreckMount(w, d, h, seed, stubs = 0) {
  const m = new TankMesh(), R = rnd(seed);
  m.with({ tint: [0.5, 0.46, 0.44] }, () => {
    m.box(0, 0, -2, w, d, h * 0.45, TL.SCORCH, { bevel: 0.8, rot: R() * 0.3 });
    for (let k = 0; k < 6; k++) m.box((R() - 0.5) * w * 0.7, (R() - 0.5) * d * 0.7, h * 0.3, 2 + R() * 5, 2 + R() * 5, 2 + R() * h * 0.5, TL.SCORCH, { bevel: 0.3, rot: R() * 3 });
    for (let k = 0; k < stubs; k++) {
      const x = (k - (stubs - 1) / 2) * 9, a = (R() - 0.5) * 0.8, l = 12 + R() * 20;
      m.tube([x, d * 0.3, h * 0.4], [x + Math.sin(a) * l, d * 0.3 + Math.cos(a) * l, h * 0.4 - R() * 6], 2.4, TL.SCORCH, { r1: 1.8, seg: 8, caps: true, capLayer: TL.SCORCH, uvV: 20 });
    }
  });
  return m.finish();
}

/** Collapsed bridge tops (after the bridge is destroyed: drawn instead of levels 3–4 and the mast). */
function bridgeWreck() {
  const m = new TankMesh(), R = rnd(331);
  m.with({ tint: [0.55, 0.5, 0.48] }, () => {
    house(m, [-34, -74, 34, -74, 36, -40, 26, -30, -26, -30, -36, -40], [[55, 1], [59, 0.92, -1]], TL.SCORCH, { top: TL.SCORCH });
    for (let k = 0; k < 14; k++) m.box((R() - 0.5) * 60, -70 + R() * 40, 58 + R() * 4, 3 + R() * 10, 3 + R() * 8, 2 + R() * 6, TL.SCORCH, { bevel: 0.4, rot: R() * 3 });
    // The mast, folded over the side.
    m.tube([0, -84, 60], [44, -60, 40], 1.4, TL.SCORCH, { seg: 6, uvV: 30 });
    m.tube([10, -80, 58], [52, -48, 30], 1.2, TL.SCORCH, { seg: 6, uvV: 30 });
  });
  return m.finish();
}

// ----------------------------------------------------------- loose pieces

function chunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => m.loft([
    { pts: [-1, -0.8, 0.9, -1, 1, 0.7, -0.6, 1], z: -0.5 },
    { pts: [-0.7, -0.6, 0.6, -0.8, 0.8, 0.5, -0.5, 0.7], z: 0.5 },
  ], { layer: TL.NAVY, top: TL.NAVY, bottom: TL.SCORCH, uv: 2 }));
  return m.finish();
}

/** Bent armour plate fragment. */
function plateChunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => {
    m.loft([{ pts: [-1, -1, 1, -1, 1, 0, -1, 0], z: 0 }, { pts: [-1, -1, 1, -1, 1, 0, -1, 0], z: 0.14 }], { layer: TL.NAVY, top: TL.NAVY, bottom: TL.SCORCH, uv: 2 });
    m.loft([{ pts: [-1, 0, 1, 0, 0.9, 0.8, -0.9, 0.9], z: 0.05 }, { pts: [-1, 0, 1, 0, 0.9, 0.8, -0.9, 0.9], z: 0.4 }], { layer: TL.NAVY, top: TL.SCORCH, uv: 2 });
  });
  return m.finish();
}

/** Heavy shell (along +y). */
function shell() {
  const m = new TankMesh();
  m.with({ tint: [1.2, 1.1, 0.9] }, () => {
    m.tube([0, -6, 0], [0, 3, 0], 2.2, TL.BARREL, { seg: 10, caps: 'start', capLayer: TL.DARK, uvV: 8 });
    m.tube([0, 3, 0], [0, 8, 0], 2.2, TL.BARREL, { r1: 0.3, seg: 10, uvV: 6 });
  });
  m.with({ tint: [2.4, 0.9, 0.3], em: 1 }, () => m.tube([0, -6.1, 0], [0, -6.4, 0], 1.6, TL.GLOW, { seg: 8, caps: 'end', uvV: 2 }));
  return m.finish();
}

/** Depth bomb (ASW rocket round) along +y. */
function charge() {
  const m = new TankMesh();
  m.with({ tint: [0.5, 0.55, 0.45] }, () => {
    m.tube([0, -5, 0], [0, 4, 0], 2.2, TL.BARREL, { seg: 10, caps: true, capLayer: TL.DARK, uvV: 8 });
    m.tube([0, 4, 0], [0, 7, 0], 2.2, TL.BARREL, { r1: 1, seg: 10, caps: 'end', uvV: 4 });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; m.box(Math.cos(a) * 2.6, -4, Math.sin(a) * 2.6 - 1.6, 0.4, 3, 3.2, TL.DARK, { bevel: 0 }); }
  });
  return m.finish();
}

/** Cruise missile (along +y): body, nose, fins. */
function missile() {
  const m = new TankMesh();
  m.with({ tint: [1.2, 1.22, 1.25] }, () => {
    m.tube([0, -9, 0], [0, 7, 0], 1.8, TL.NAVY, { seg: 10, caps: 'start', capLayer: TL.DARK, uvV: 12 });
    m.tube([0, 7, 0], [0, 12, 0], 1.8, TL.NAVY, { r1: 0.2, seg: 10, uvV: 6 });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; m.box(Math.cos(a) * 2.6, -7, Math.sin(a) * 2.6 - 1.2, 0.4, 4, 2.4, TL.DARK, { bevel: 0, rot: 0 }); }
  });
  m.with({ tint: RED, em: 1 }, () => m.tube([0, 8, 0], [0, 9, 0], 1.5, TL.GLOW, { seg: 8, uvV: 2 }));
  return m.finish();
}

/** Channel buoy (float under the waterline, cage tower, lamp); paint tint per side. */
function buoy(col) {
  const m = new TankMesh();
  m.with({ tint: col, ao: [-4, 4] }, () => {
    m.lathe(0, 0, [[4, -5], [6, -1], [6, 2.6], [4.6, 3.6]], TL.NHULL, { seg: 14, uv: 20 });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; m.tube([Math.cos(a) * 3.6, Math.sin(a) * 3.6, 3.4], [Math.cos(a) * 1.2, Math.sin(a) * 1.2, 15], 0.5, TL.NAVY, { seg: 5, uvV: 10 }); }
    m.lathe(0, 0, [[2.6, 9], [2.6, 10.2]], TL.NAVY, { seg: 10, uv: 10 });
  });
  m.with({ tint: [1.6, 1.6, 1.6], ao: null }, () => m.lathe(0, 0, [[1.4, 15], [1.4, 16.6], [0, 17]], TL.NAVY, { seg: 8, uv: 10 }));
  return m.finish();
}

function floatingCrate() {
  const m = new TankMesh();
  m.with({ tint: [0.95, 0.75, 0.5] }, () => { m.box(0, 0, -3, 9, 9, 6, TL.NDECK, { bevel: 0.5 }); for (const s of [-1, 1]) m.box(s * 4.2, 0, -2.8, 0.8, 9.2, 6, TL.DARK, { bevel: 0.1 }); });
  return m.finish();
}

function floatingDrum() {
  const m = new TankMesh();
  m.with({ tint: [1.3, 0.5, 0.25] }, () => m.tube([0, -6, 0], [0, 6, 0], 3, TL.BARREL, { seg: 12, caps: true, capLayer: TL.DARK, uvV: 10 }));
  return m.finish();
}

/** All parts: name → mesh data. */
export function buildCoralSiege() {
  return {
    hull: hull(), rails: rails(), sponsons: sponsons(), sponsonRails: sponsonRails(), deckhouse: deckhouse(), bridgeBase: bridgeBase(), bridge: bridge(), glass: glass(),
    buoyR: buoy([1.3, 0.3, 0.25]), buoyG: buoy([0.3, 1.05, 0.45]), crate: floatingCrate(), drum: floatingDrum(),
    red: red(), cyan: cyan(), white: white(), radar: radar(),
    mainHouse: mainHouse(), mainBarrel: mainBarrel(), secHouse: secHouse(), secBarrel: secBarrel(),
    ciwsBase: ciwsBase(), ciwsRotor: ciwsRotor(), vlsBase: vlsBase(), vlsDoor: vlsDoor(), rbuBase: rbuBase(), rbuTubes: rbuTubes(),
    mainWreck: wreckMount(50, 50, 16, 501, 3), secWreck: wreckMount(26, 26, 10, 503, 2), ciwsWreck: wreckMount(12, 12, 8, 505), vlsWreck: wreckMount(24, 78, 6, 507), rbuWreck: wreckMount(14, 14, 6, 509),
    bridgeWreck: bridgeWreck(),
    chunk: chunk(), plate: plateChunk(), shell: shell(), charge: charge(), missile: missile(),
  };
}
