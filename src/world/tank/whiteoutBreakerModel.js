import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// WHITEOUT BREAKER — colossal polar fortress warship, built as real 3D parts.
//
// Model space (as the other 3D bosses): +y = FORWARD (the bow), +x = right,
// +z = up; the WATERLINE is z = 0 and the hull is modelled down to its keel,
// so the depth-written sea clips it at a real waterline. The bow tip is at
// y = 0 and the hull runs aft to the transom at y ≈ −3030: ≈ 3030 × 252
// units, far longer than the screen. The rig lies it in the lead bow-down
// (toward the pilot) and moves the camera along it, section by section.
//
// TEN ARSENAL SECTIONS (WB.sections), each with its own hull segment, deck
// (citadel, barbettes, hatches, vents, conduits, rails, snow), emissive
// lights and weapon mounts, so the renderer culls by section:
//   0 ICEBREAKER BOW BATTERY       wedge bow, red ice belt, triple gun, twin heavies, bow autocannons
//   1 TRIPLE ARTILLERY DECK        three triple turrets, secondary twins, flak
//   2 ROCKET BATTERY               four rocket pods, side launchers, heavy rocket array
//   3 VERTICAL MISSILE COMPLEX     four 16-cell VLS blocks (hinged doors), four trainable missile boxes
//   4 MACHINE-GUN DEFENSE GRID     eight CIWS gatlings, autocannons, rotating gun arrays, directors
//   5 FUSION DECK                  twin heavy turrets, missile boxes, secondary twins, exhaust funnels
//   6 POLAR FLANK BATTERIES        sponsons with port / starboard twin turrets, rocket pods, flak
//   7 CRYOGENIC WEAPON ARRAY       three cryo projectors, frost mortars, coolant tanks and piping
//   8 WHITEOUT FROST BEAM          the main beam emitter, four focusing emitters, CIWS, the command tower
//   9 FINAL ARSENAL                rear triple turret, VLS, CIWS, rocket pods, alternate frost emitter, stern
//
// Mount meshes (instanced per mount by the rig):
//   triHouse/triBarrel  twinHouse/twinBarrel  secHouse/secBarrel  acBase/acGun
//   ciwsBase/ciwsRotor  flakHouse/flakGuns  podBase/podBox  rarrBase/rarrBox
//   vlsBlock/vlsDoor  mboxBase/mboxBox  mortarHouse/mortarTube  cryoHouse/cryoNozzle/cryoGlow
//   beamBase/beamHead/beamGlow  auxBase/auxHead/auxGlow  radar
//   wreckL/M/S/V   chunk / plate / shell / missile / rocket / cryoShell / spike / floe0-2 / icePatch

const PAINT = [1, 1, 1];
const DARK = [0.78, 0.8, 0.84];
const RED = [2.4, 0.14, 0.12];
const CYAN = [0.25, 1.6, 2.4];
const AMBER = [2.4, 1.2, 0.35];
const WHITE = [2.3, 2.3, 2.2];
const GREEN = [0.2, 2.2, 0.5];
const CRIMSON = [1.85, 0.36, 0.32];

// Hull stations: [y, waterline half-beam, deck half-width, deck z, keel depth].
const STATIONS = [
  [-3030, 100, 110, 27, 8], [-3000, 110, 118, 26.5, 11], [-2950, 118, 123, 26, 13], [-2880, 122, 126, 26, 14],
  [-360, 122, 126, 26, 14], [-280, 118, 124, 27, 14], [-210, 108, 117, 28, 14], [-150, 88, 102, 30, 14],
  [-104, 62, 82, 32, 13], [-64, 34, 58, 34, 12], [-34, 14, 36, 36, 10], [-14, 4, 18, 37, 8], [0, 1, 4, 38, 4],
];

/** Station values at y (linear between stations). */
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

const deckZ = (y) => station(y)[3];
const CIT = 38;     // citadel top (sections 1-9)
const BOWCIT = 43;  // forward citadel top (section 0)

// Section y-ranges (bow-side y1, stern-side y0) and their focus point (camera framing).
const SECS = [
  { y0: -340, y1: 0, name: 'ICEBREAKER BOW BATTERY' },
  { y0: -620, y1: -340, name: 'TRIPLE ARTILLERY DECK' },
  { y0: -900, y1: -620, name: 'ROCKET BATTERY' },
  { y0: -1180, y1: -900, name: 'VERTICAL MISSILE COMPLEX' },
  { y0: -1460, y1: -1180, name: 'MACHINE-GUN DEFENSE GRID' },
  { y0: -1740, y1: -1460, name: 'HEAVY MISSILE AND ARTILLERY FUSION DECK' },
  { y0: -2020, y1: -1740, name: 'POLAR FLANK BATTERIES' },
  { y0: -2300, y1: -2020, name: 'CRYOGENIC WEAPON ARRAY' },
  { y0: -2580, y1: -2300, name: 'WHITEOUT FROST BEAM' },
  { y0: -3030, y1: -2580, name: 'FINAL ARSENAL' },
];

// ------------------------------------------------------------ mount types
// pivot: barrel / box trunnion in mount space; muzzles: per barrel / tube, in barrel space.
const tubeGrid = (cols, rows, dx, dz) => { const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([(c - (cols - 1) / 2) * dx, 0, (r - (rows - 1) / 2) * dz]); return out; };

export const TYPES = {
  tri: { house: 'triHouse', barrel: 'triBarrel', wreck: 'wreckL', barrels: [[-8, 15, 7], [0, 15, 7], [8, 15, 7]], muzzle: 54, yaw: 0.02, el: [0, 0.75], rest: 0.04, kick: 8, r: 24, top: 16 },
  twin: { house: 'twinHouse', barrel: 'twinBarrel', wreck: 'wreckL', barrels: [[-6, 12, 6], [6, 12, 6]], muzzle: 44, yaw: 0.026, el: [0, 0.75], rest: 0.04, kick: 7, r: 19, top: 13 },
  sec: { house: 'secHouse', barrel: 'secBarrel', wreck: 'wreckM', barrels: [[-3.2, 7, 4], [3.2, 7, 4]], muzzle: 28, yaw: 0.05, el: [0, 0.5], rest: 0.05, kick: 4, r: 11, top: 9 },
  ac: { house: 'acBase', barrel: 'acGun', wreck: 'wreckS', single: true, pivot: [0, 1, 6.5], muzzles: [[-1.9, 19, 0], [1.9, 19, 0]], yaw: 0.075, el: [0, 0.5], rest: 0.12, kick: 2, r: 7, top: 9 },
  ciws: { house: 'ciwsBase', barrel: 'ciwsRotor', wreck: 'wreckS', single: true, pivot: [0, 4, 9], muzzles: [[0, 21, 0]], yaw: 0.12, el: [0, 0.3], rest: 0.15, kick: 0, r: 7, top: 18, spin: true },
  flak: { house: 'flakHouse', barrel: 'flakGuns', wreck: 'wreckM', single: true, pivot: [0, 3, 6], muzzles: [[-4.5, 19, 0], [-1.5, 19, 0], [1.5, 19, 0], [4.5, 19, 0]], yaw: 0.06, el: [0, 0.6], rest: 0.25, kick: 2.5, r: 10, top: 11 },
  pod: { house: 'podBase', barrel: 'podBox', wreck: 'wreckM', single: true, pivot: [0, 0, 9], muzzles: tubeGrid(4, 5, 3.6, 2.8).map(([x, , z]) => [x, 8.6, z]), yaw: 0.04, el: [0, 0.8], rest: 0.18, kick: 0.6, r: 10, top: 16 },
  rarr: { house: 'rarrBase', barrel: 'rarrBox', wreck: 'wreckL', single: true, pivot: [0, 0, 12], muzzles: tubeGrid(7, 4, 4.2, 4).map(([x, , z]) => [x, 12.6, z]), yaw: 0.025, el: [0, 0.9], rest: 0.22, kick: 0.6, r: 20, top: 24 },
  vls: { house: 'vlsBlock', wreck: 'wreckV', fixed: true, cells: (() => { const o = []; for (let i = 0; i < 8; i++) for (const x of [-5, 5]) o.push([x, -36 + i * 10.3]); return o; })(), top: 6, r: 20 },
  mbox: { house: 'mboxBase', barrel: 'mboxBox', wreck: 'wreckM', single: true, pivot: [0, 0, 9], muzzles: [[-3.7, 13.4, -3.7], [3.7, 13.4, -3.7], [-3.7, 13.4, 3.7], [3.7, 13.4, 3.7]], yaw: 0.035, el: [0, 0.75], rest: 0.12, kick: 0.5, r: 12, top: 16 },
  mortar: { house: 'mortarHouse', barrel: 'mortarTube', wreck: 'wreckM', barrels: [[-4.2, 3, 6], [4.2, 3, 6]], muzzle: 15, yaw: 0.04, el: [0.3, 1.15], rest: 0.75, kick: 4, r: 11, top: 9 },
  cryo: { house: 'cryoHouse', barrel: 'cryoNozzle', glow: 'cryoGlow', wreck: 'wreckM', single: true, pivot: [0, 5, 8], muzzles: [[0, 32, 0]], yaw: 0.035, el: [0, 0.5], rest: 0.08, kick: 2, r: 14, top: 14 },
  beam: { house: 'beamBase', barrel: 'beamHead', glow: 'beamGlow', wreck: 'wreckL', single: true, pivot: [0, 0, 16], muzzles: [[0, 46, 0]], yaw: 0.012, el: [-0.05, 0.3], rest: 0.02, kick: 0, r: 30, top: 34, headYaw: true },
  aux: { house: 'auxBase', barrel: 'auxHead', glow: 'auxGlow', wreck: 'wreckS', single: true, pivot: [0, 0, 19], muzzles: [[0, 13, 0]], yaw: 0.05, el: [-0.2, 0.4], rest: 0.0, kick: 0, r: 8, top: 24 },
};

// ------------------------------------------------------------- the mounts
// [section, type, part key, x, y, z, rest yaw (0 = toward the bow, + = toward −x), arc half-width]
const M = [
  // 0 ICEBREAKER BOW BATTERY
  [0, 'ac', 'acL', -32, -80, null, 0.25, 1.6], [0, 'ac', 'acR', 32, -80, null, -0.25, 1.6],
  [0, 'tri', 'tri', 0, -178, BOWCIT, 0, 2.2],
  [0, 'twin', 'twinL', -74, -262, null, 0.15, 1.9], [0, 'twin', 'twinR', 74, -262, null, -0.15, 1.9],
  // 1 TRIPLE ARTILLERY DECK
  [1, 'flak', 'flak', -28, -398, CIT, 0.2, 2.6], [1, 'flak', 'flak', 28, -398, CIT, -0.2, 2.6],
  [1, 'tri', 'triL', -76, -430, null, 0.18, 1.8], [1, 'tri', 'triR', 76, -430, null, -0.18, 1.8],
  [1, 'tri', 'triC', 0, -548, CIT, 0, 2.3],
  [1, 'sec', 'secs', -100, -572, null, 0.4, 2.2], [1, 'sec', 'secs', 100, -572, null, -0.4, 2.2],
  // 2 ROCKET BATTERY
  [2, 'pod', 'podsF', -24, -688, CIT, 0.1, 1.6], [2, 'pod', 'podsF', 24, -688, CIT, -0.1, 1.6],
  [2, 'pod', 'podsA', -24, -778, CIT, 0.1, 1.6], [2, 'pod', 'podsA', 24, -778, CIT, -0.1, 1.6],
  [2, 'pod', 'sides', -100, -730, null, 0.45, 1.8], [2, 'pod', 'sides', 100, -730, null, -0.45, 1.8],
  [2, 'rarr', 'array', 0, -858, CIT, 0, 1.2],
  // 3 VERTICAL MISSILE COMPLEX
  [3, 'vls', 'vlsF', -27, -966, CIT, 0, 0], [3, 'vls', 'vlsF', 27, -966, CIT, 0, 0],
  [3, 'vls', 'vlsA', -27, -1104, CIT, 0, 0], [3, 'vls', 'vlsA', 27, -1104, CIT, 0, 0],
  [3, 'mbox', 'mbL', -97, -990, null, 0.35, 1.8], [3, 'mbox', 'mbL', -97, -1118, null, 0.35, 1.8],
  [3, 'mbox', 'mbR', 97, -990, null, -0.35, 1.8], [3, 'mbox', 'mbR', 97, -1118, null, -0.35, 1.8],
  // 4 MACHINE-GUN DEFENSE GRID
  [4, 'ciws', 'gridL', -101, -1222, null, 0.5, 2.6], [4, 'ciws', 'gridL', -101, -1290, null, 0.7, 2.6], [4, 'ciws', 'gridL', -101, -1358, null, 0.9, 2.6], [4, 'ciws', 'gridL', -101, -1426, null, 1.1, 2.6],
  [4, 'ciws', 'gridR', 101, -1222, null, -0.5, 2.6], [4, 'ciws', 'gridR', 101, -1290, null, -0.7, 2.6], [4, 'ciws', 'gridR', 101, -1358, null, -0.9, 2.6], [4, 'ciws', 'gridR', 101, -1426, null, -1.1, 2.6],
  [4, 'ac', 'guns', -27, -1236, CIT, 0.2, 2.2], [4, 'ac', 'guns', 27, -1236, CIT, -0.2, 2.2],
  [4, 'ac', 'guns', -27, -1412, CIT, 0.3, 2.2], [4, 'ac', 'guns', 27, -1412, CIT, -0.3, 2.2],
  [4, 'flak', 'guns', 0, -1282, CIT, 0, 3.0], [4, 'flak', 'guns', 0, -1366, CIT, 0, 3.0],
  // 5 FUSION DECK
  [5, 'twin', 'twA', 0, -1516, CIT, 0, 2.3],
  [5, 'mbox', 'missiles', -97, -1560, null, 0.3, 1.8], [5, 'mbox', 'missiles', 97, -1560, null, -0.3, 1.8],
  [5, 'twin', 'twB', 0, -1700, CIT, 0, 2.3],
  [5, 'sec', 'secs', -100, -1670, null, 0.4, 2.2], [5, 'sec', 'secs', 100, -1670, null, -0.4, 2.2],
  // 6 POLAR FLANK BATTERIES
  [6, 'twin', 'port', -112, -1800, null, 0.55, 1.4], [6, 'twin', 'port', -112, -1956, null, 0.55, 1.4],
  [6, 'twin', 'stbd', 112, -1800, null, -0.55, 1.4], [6, 'twin', 'stbd', 112, -1956, null, -0.55, 1.4],
  [6, 'pod', 'rockets', -26, -1878, CIT, 0.15, 1.7], [6, 'pod', 'rockets', 26, -1878, CIT, -0.15, 1.7],
  [6, 'flak', 'flak', 0, -1790, CIT, 0, 2.8], [6, 'flak', 'flak', 0, -1966, CIT, 0, 2.8],
  // 7 CRYOGENIC WEAPON ARRAY
  [7, 'cryo', 'cryoWing', -68, -2096, null, 0.12, 1.4], [7, 'cryo', 'cryoWing', 68, -2096, null, -0.12, 1.4],
  [7, 'cryo', 'cryoC', 0, -2196, CIT, 0, 1.6],
  [7, 'mortar', 'mortarsL', -102, -2060, null, 0.2, 1.5], [7, 'mortar', 'mortarsL', -102, -2268, null, 0.2, 1.5],
  [7, 'mortar', 'mortarsR', 102, -2060, null, -0.2, 1.5], [7, 'mortar', 'mortarsR', 102, -2268, null, -0.2, 1.5],
  // 8 WHITEOUT FROST BEAM
  [8, 'beam', 'emitter', 0, -2366, CIT, 0, 0.95],
  [8, 'aux', 'auxL', -64, -2330, null, 0, 1.2], [8, 'aux', 'auxL', -64, -2430, null, 0, 1.2],
  [8, 'aux', 'auxR', 64, -2330, null, 0, 1.2], [8, 'aux', 'auxR', 64, -2430, null, 0, 1.2],
  [8, 'ciws', 'ciws', -104, -2500, null, 0.6, 2.6], [8, 'ciws', 'ciws', 104, -2500, null, -0.6, 2.6],
  // 9 FINAL ARSENAL
  [9, 'tri', 'triS', 0, -2640, CIT, 0, 2.3],
  [9, 'vls', 'vlsS', -28, -2752, CIT, 0, 0], [9, 'vls', 'vlsS', 28, -2752, CIT, 0, 0],
  [9, 'ciws', 'battery', -102, -2680, null, 0.6, 2.6], [9, 'ciws', 'battery', 102, -2680, null, -0.6, 2.6],
  [9, 'pod', 'battery', -100, -2820, null, 0.35, 1.8], [9, 'pod', 'battery', 100, -2820, null, -0.35, 1.8],
  [9, 'beam', 'emitterS', 0, -2862, 50, 0, 0.9],
];

export const WB = {
  length: [-3030, 0], beam: 122, deckW: 126, cit: CIT, bowCit: BOWCIT,
  station, deckZ,
  sections: SECS.map((s, k) => ({ ...s, k, mid: (s.y0 + s.y1) / 2 })),
  mounts: M.map(([sec, type, part, x, y, z, rest, arc], id) => ({ id, sec, type, part, x, y, z: z ?? deckZ(y), rest, arc, small: type === 'beam' && sec === 9 })),
  // Light points per section (bloom pass): the emissive meshes are built from the same lists.
  glows: SECS.map((s, k) => (k === 0 ? lightPoints(-340, -20, false) : lightPoints(k === 9 ? -2880 : s.y0, s.y1, true))),
  radar: [0, -2522, 124],
  searchlights: [[-40, -2452, 74], [40, -2452, 74]],
  stacks: [[-16, -1606, 66], [16, -1606, 66], [-10, -2548, 98], [10, -2548, 98], [0, -2925, 58]],
  vents: [[0, -2118, CIT + 6], [-60, -2240, 34], [60, -2240, 34], [0, -1350, CIT + 4], [0, -800, CIT + 4]],
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- helpers

function plate(m, pts, z0, z1, layer, sideLayer = layer) {
  m.loft([{ pts, z: z0 }, { pts, z: z1 }], { layer: sideLayer, top: layer, bottom: layer, uv: 60 });
}

/** Up-facing quad with explicit UVs (decals). */
function decal(m, x0, y0, x1, y1, z, layer, uv) {
  const [u0, v0, u1, v1] = uv;
  const a = m.vert(x0, y0, z, 0, 0, 1, u0, v1, layer), b = m.vert(x1, y0, z, 0, 0, 1, u1, v1, layer);
  const c = m.vert(x1, y1, z, 0, 0, 1, u1, v0, layer), d = m.vert(x0, y1, z, 0, 0, 1, u0, v0, layer);
  m.tri(a, b, c); m.tri(a, c, d);
}

/** Closed polygon rings stepping inward: armoured houses. levels: [[z, scale, dy]] */
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

/** Chamfered rectangle outline. */
const rectC = (x0, x1, y0, y1, c) => [x0 + c, y0, x1 - c, y0, x1, y0 + c, x1, y1 - c, x1 - c, y1, x0 + c, y1, x0, y1 - c, x0, y0 + c];

/**
 * Smooth open strip through rows of 3D points (rows[j][k], equal counts):
 * normals averaged over adjacent faces, oriented away from `axis(p)`.
 */
function strip(m, rows, layer, axis, uvScale = 80) {
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
  const U = rows.map((r) => { const u = [0]; for (let k = 1; k < K; k++) u.push(u[k - 1] + Math.hypot(r[k][0] - r[k - 1][0], r[k][2] - r[k - 1][2])); return u; });
  const ids = rows.map((r, j) => r.map((p, k) => m.vert(p[0], p[1], p[2], N[j][k][0], N[j][k][1], N[j][k][2], U[j][k] / uvScale, -p[1] / uvScale, layer)));
  for (let j = 0; j < J - 1; j++) for (let k = 0; k < K - 1; k++) { const a = ids[j][k], b = ids[j][k + 1], c = ids[j + 1][k + 1], d = ids[j + 1][k]; m.tri(a, b, c); m.tri(a, c, d); }
}

function bollards(m, x, y, z) {
  for (const dy of [-3.2, 3.2]) m.lathe(x, y + dy, [[1.7, z], [1.5, z + 3], [2.2, z + 3.6], [2.2, z + 4.2]], TL.DARK, { seg: 10, uv: 20 });
}

/** Guard rail along a polyline (posts + two rails). */
function rail(m, pts, h = 4.2) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 12));
    for (let k = 0; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t; m.tube([x, y, z], [x, y, z + h], 0.32, TL.DARK, { seg: 4, uvV: 10 }); }
    for (const hh of [h, h * 0.55]) m.tube([a[0], a[1], a[2] + hh], [b[0], b[1], b[2] + hh], 0.28, TL.DARK, { seg: 4, uvV: 30 });
  }
}

// ------------------------------------------------------------------ hull

/** Ring of hull points (deck edge → keel) at station st on side s. */
function ring(st, s) {
  const [y, w, f, z, k] = st;
  return [
    [s * f, y, z], [s * (f - 0.6), y, z - 2.5], [s * (w + (f - w) * 0.45), y, 12], [s * (w + (f - w) * 0.32), y, 9.5],
    [s * (w + (f - w) * 0.2), y, 4.2], [s * w, y, 2.6], [s * w, y, -1], [s * w * 0.8, y, -k * 0.65], [s * 0.01, y, -k],
  ];
}

// Bands between ring points: [k0, k1, layer, tint]
const BANDS = [
  [0, 2, TL.WBPLATE, [0.86, 0.89, 0.94]],       // upper hull side (frosted gunmetal)
  [2, 3, TL.WBPLATE, [0.82, 0.86, 0.9]],        // armour belt shoulder
  [3, 4, TL.WBPLATE, CRIMSON],                  // crimson ice belt
  [4, 6, TL.DARK, [0.5, 0.52, 0.56]],           // boot-top (black, scraped by the ice)
  [6, 8, TL.NHULL, [0.55, 0.58, 0.62]],         // under water
];

function stationsIn(y0, y1, step = 14) {
  const out = [];
  const keys = STATIONS.map((s) => s[0]).filter((y) => y > y0 && y < y1);
  const ys = [y0, ...keys, y1];
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1], n = Math.max(1, Math.round((b - a) / step));
    for (let k = 0; k < n; k++) out.push(station(a + ((b - a) * k) / n));
  }
  out.push(station(y1));
  return out;
}

/** Hull segment between y0 and y1 (sides, deck, the transom on the stern segment). */
function hullSeg(m, y0, y1, o = {}) {
  const fine = stationsIn(y0, y1, o.step || 20);
  for (const s of [-1, 1]) for (const [k0, k1, layer, tint] of BANDS) {
    m.with({ tint, ao: [-6, 16] }, () => strip(m, fine.map((st) => ring(st, s).slice(k0, k1 + 1)), layer, (p) => [0, p[1], 6], 70));
  }
  if (o.transom) {
    m.with({ tint: [0.9, 0.92, 0.95], ao: [-4, 14] }, () => {
      const st = STATIONS[0], L = ring(st, -1), Rr = ring(st, 1);
      const pts = [...L, ...Rr.slice().reverse()];
      const c = m.vert(0, st[0], 8, 0, -1, 0, 0.5, 0, TL.WBPLATE), ids = pts.map((p) => m.vert(p[0], p[1], p[2], 0, -1, 0, p[0] / 60, -p[2] / 60, TL.WBPLATE));
      for (let i = 0; i < ids.length; i++) m.tri(c, ids[i], ids[(i + 1) % ids.length]);
    });
  }
  // Deck: cambered surface either side of the crown.
  m.with({ tint: [0.82, 0.85, 0.9] }, () => {
    for (let i = 0; i < fine.length - 1; i++) {
      const a = fine[i], b = fine[i + 1];
      for (const s of [-1, 1]) {
        const P = [[s * a[2], a[0], a[3]], [0, a[0], a[3] + 1.2], [0, b[0], b[3] + 1.2], [s * b[2], b[0], b[3]]];
        m.quad(P, P.map((p) => [p[0] / 70, -p[1] / 70]), TL.WBDECK, [0, (a[0] + b[0]) / 2, -50]);
      }
    }
  });
  // Armour belt plates along the shoulder and the gunwale strake.
  m.with({ tint: [0.9, 0.93, 0.97] }, () => {
    for (let y = Math.ceil(y0 / 24) * 24; y < y1 - 6; y += 24) {
      const st = station(y);
      if (st[1] < 60) continue;
      for (const s of [-1, 1]) m.box(s * (st[1] + (st[2] - st[1]) * 0.42 + 0.8), y, 9.6, 2, 20, 2.4, TL.WBPLATE, { bevel: 0.5 });
    }
  });
}

// ------------------------------------------------------------ deck kit

/** The armoured central citadel of a section (sections 1-9). */
function citadel(m, y0, y1, o = {}) {
  const w = o.w || 46, z1 = o.z ?? CIT;
  m.with({ tint: PAINT, ao: [26, z1] }, () => {
    house(m, rectC(-w, w, y0 + 2, y1 - 2, 6), [[26, 1], [z1 - 1.6, 1], [z1, 0.97]], TL.WBPLATE, { top: TL.WBDECK, uv: 44 });
    // Armour strakes down the citadel flanks, with lit gun ports between them.
    for (let y = y0 + 16; y < y1 - 10; y += 22) for (const s of [-1, 1]) m.box(s * (w + 0.6), y, 27.5, 1.6, 16, z1 - 30, TL.WBPLATE, { bevel: 0.4 });
  });
  m.with({ tint: DARK }, () => {
    // Bulkhead seam and the walkway rails on top.
    m.box(0, y1 - 3, z1 - 0.2, w * 2 - 6, 2, 0.9, TL.DARK, { bevel: 0.2 });
    m.box(0, y0 + 3, z1 - 0.2, w * 2 - 6, 2, 0.9, TL.DARK, { bevel: 0.2 });
  });
}

/** Barbette ring under a turret. */
function barbette(m, x, y, z, r) {
  m.with({ tint: PAINT, ao: [z - 2, z + 1] }, () => m.lathe(x, y, [[r + 3, z - 2.2], [r + 3, z + 0.6], [r + 1.2, z + 1.2]], TL.WBPLATE, { seg: 32, uv: 40, top: TL.DARK }));
}

/** Hatches, vents, lockers, conduits and snow over a deck strip. */
function clutter(m, R, x0, x1, y0, y1, z, n) {
  m.with({ tint: DARK }, () => {
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), t = R();
      if (t < 0.3) { m.box(x, y, z, 8 + R() * 6, 6 + R() * 4, 1.4, TL.WBPLATE, { bevel: 0.4 }); m.box(x + 2, y, z + 1.4, 1.4, 3, 0.6, TL.DARK, { bevel: 0.1 }); }
      else if (t < 0.55) m.box(x, y, z, 6 + R() * 6, 4 + R() * 4, 3 + R() * 2, TL.GRILLE, { bevel: 0.4 });
      else if (t < 0.75) { m.box(x, y, z, 5, 5, 4, TL.WBPLATE, { bevel: 0.6 }); m.lathe(x, y, [[1.4, z + 4], [1.4, z + 7], [2.2, z + 7.5]], TL.DARK, { seg: 8, uv: 20 }); }
      else if (t < 0.9) m.box(x, y, z, 10 + R() * 8, 3, 2.4, TL.WBPLATE, { bevel: 0.4 });
      else m.lathe(x, y, [[2.4, z], [2.4, z + 4], [1.6, z + 5]], TL.WBPLATE, { seg: 10, uv: 20 });
    }
  });
  // Snow banked in the corners and along the obstacles.
  m.with({ tint: [1, 1.02, 1.05] }, () => {
    for (let i = 0; i < n * 0.2; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), w = 4 + R() * 10, d = 3 + R() * 8;
      m.box(x, y, z - 0.2, w, d, 0.6 + R() * 0.8, TL.SNOW, { bevel: 0.3, rot: R() * 3 });
    }
  });
}

/** Deck-edge rails, bollards and the cable conduits along the citadel feet. */
function edges(m, y0, y1, o = {}) {
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      const pts = [];
      for (let y = y1 - 4; y >= y0 + 4; y -= 20) { const st = station(y); pts.push([s * (st[2] - 1.4), y, st[3]]); }
      if (pts.length > 1) rail(m, pts, 4);
      for (let y = Math.ceil((y0 + 30) / 90) * 90; y < y1 - 20; y += 90) { const st = station(y); bollards(m, s * (st[2] - 7), y, st[3]); }
      if (!o.noConduit) m.tube([s * 47.5, y1 - 6, 27.4], [s * 47.5, y0 + 6, 27.4], 1.1, TL.BARREL, { seg: 6, uvV: 40 });
    }
  });
}

// ------------------------------------------------------- lights per section

/** Light points shared by the emissive meshes and the rig's bloom pass: [x, y, z, kind (0 red, 1 amber)]. */
function lightPoints(y0, y1, citOn) {
  const out = [];
  for (let y = Math.ceil(y0 / 40) * 40; y < y1; y += 40) { const st = station(y); for (const s of [-1, 1]) out.push([s * (st[2] - 0.6), y, st[3] + 0.5, 0]); }
  if (citOn) {
    for (let y = Math.ceil(y0 / 60) * 60; y < y1; y += 60) for (const s of [-1, 1]) out.push([s * 44, y, CIT + 0.4, 0]);
    for (let y = y0 + 27; y < y1 - 10; y += 22) for (const s of [-1, 1]) out.push([s * 46.4, y, 32, 1]);
  }
  return out;
}

function lightsCommon(m, y0, y1, citOn = true) {
  const pts = lightPoints(y0, y1, citOn);
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const [x, y, z, k] of pts) if (k === 0) m.box(x, y, z, 2, 2, 2, TL.GLOW, { bevel: 0 }); });
  m.with({ tint: AMBER, em: 1, ao: null }, () => {
    // Lit gun-port / window slits down the citadel flanks.
    for (const [x, y, z, k] of pts) if (k === 1) m.box(x, y, z, 0.5, 6, 1.6, TL.GLOW, { bevel: 0 });
  });
  m.with({ tint: CYAN, em: 1, ao: null }, () => {
    if (citOn) for (const s of [-1, 1]) m.box(s * 46.5, (y0 + y1) / 2, 35.6, 0.5, 24, 0.8, TL.GLOW, { bevel: 0 });
  });
}

// --------------------------------------------------------------- sections

function section0() {
  const m = new TankMesh(), R = rnd(101);
  hullSeg(m, -340, 0, { step: 10 });
  // Ice knife / stem bar down the bow, icebreaking ribs on the flare, crimson ice belt plates.
  m.with({ tint: [0.86, 0.88, 0.92] }, () => {
    m.tube([0, 1.5, 38], [0, -40, -6], 2.4, TL.BARREL, { r1: 3.2, seg: 8, uvV: 20 });
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
      const y = -18 - k * 18, st = station(y), st2 = station(y - 8);
      m.tube([s * (st[1] + (st[2] - st[1]) * 0.85), y, st[3] - 3], [s * (st2[1] + 1.6), y - 8, 3], 1.3, TL.WBPLATE, { seg: 6, uvV: 20 });
    }
  });
  m.with({ tint: CRIMSON }, () => {
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
      const y = -20 - k * 22, st = station(y);
      if (st[1] < 8) continue;
      m.box(s * (st[1] + (st[2] - st[1]) * 0.24 + 0.6), y, 3.4, 1.6, 18, 5, TL.WBPLATE, { bevel: 0.4 });
    }
  });
  // Ice-class hazard stripes on the bow flare (crimson / black).
  for (const s of [-1, 1]) {
    const pa = station(-30), pb = station(-96);
    const A = [s * (pa[2] - 2), -30, pa[3] - 3], B = [s * (pb[2] - 2), -96, pb[3] - 3], C = [s * (pb[1] + 6), -96, 14], D = [s * (pa[1] + 4), -30, 14];
    const n = [s * 0.9, 0.3, 0.3];
    const ids = [[A, 0, 0], [B, 2.6, 0], [C, 2.6, 0.48], [D, 0, 0.48]].map(([q, u, v]) => m.vert(q[0] + s * 0.4, q[1], q[2], n[0], n[1], n[2], u, v, TL.WBMARK));
    m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]);
    // Hull number 22 on the flank.
    const p = (y, z) => { const st = station(y), w = st[1] + (st[2] - st[1]) * Math.max(0, Math.min(1, (z - 4) / (st[3] - 4))); return [s * (w + 0.5), y, z]; };
    const q = [[p(-120, 13), s > 0 ? 0.25 : 0.75, 1], [p(-160, 13), s > 0 ? 0.75 : 0.25, 1], [p(-160, 26), s > 0 ? 0.75 : 0.25, 0.55], [p(-120, 26), s > 0 ? 0.25 : 0.75, 0.55]];
    const id2 = q.map(([pp, u, v]) => m.vert(pp[0], pp[1], pp[2], s, 0, 0.1, u, v, TL.WBMARK));
    m.tri(id2[0], id2[1], id2[2]); m.tri(id2[0], id2[2], id2[3]);
  }
  // Forward citadel (narrows toward the bow) carrying the triple turret.
  m.with({ tint: PAINT, ao: [28, BOWCIT] }, () => {
    house(m, [-26, -118, 26, -118, 40, -150, 42, -334, -42, -334, -40, -150], [[deckZ(-118) - 2, 1], [BOWCIT - 1.6, 1], [BOWCIT, 0.97]], TL.WBPLATE, { top: TL.WBDECK, uv: 44 });
    for (const s of [-1, 1]) for (let y = -170; y > -330; y -= 22) m.box(s * 42.6, y, 29, 1.6, 16, BOWCIT - 31, TL.WBPLATE, { bevel: 0.4 });
  });
  barbette(m, 0, -178, BOWCIT, 25);
  barbette(m, -74, -262, deckZ(-262), 19);
  barbette(m, 74, -262, deckZ(-262), 19);
  // Breakwater ahead of the turrets, anchors, windlasses, chains.
  m.with({ tint: PAINT, ao: [30, 38] }, () => {
    for (const s of [-1, 1]) m.loft([{ pts: [0, -100, s * 50, -126, s * 50, -129, 0, -103], z: deckZ(-110) - 0.5 }, { pts: [0, -100, s * 50, -126, s * 50, -129, 0, -103], z: deckZ(-110) + 6 }], { layer: TL.WBPLATE, top: TL.DARK, uv: 40 });
  });
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      const st = station(-46);
      m.tube([s * (st[2] - 4), -46, st[3] - 1], [s * (st[2] + 1.5), -44, st[3] - 4], 3.4, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.DARK, uvV: 10 });
      m.box(s * (st[2] + 1), -46, 16, 3, 9, 10, TL.BARREL, { bevel: 1 });
      for (let k = 0; k < 9; k++) m.box(s * (8 + k * 1.6), -48 - k * 2.8, deckZ(-48 - k * 2.8) + 0.4, 1.6, 2.2, 0.9, TL.BARREL, { bevel: 0.2 });
      m.lathe(s * 11, -76, [[3.6, deckZ(-76)], [3.6, deckZ(-76) + 3.5], [2.8, deckZ(-76) + 5]], TL.DARK, { seg: 12, uv: 20 });
    }
    m.tube([0, -6, 38], [0, -6, 54], 0.5, TL.DARK, { seg: 5, uvV: 20 });   // jack staff
  });
  // Frost crust on the bow: snow piled on the foredeck and frozen spray along the flare.
  m.with({ tint: [1.02, 1.04, 1.08] }, () => {
    for (let i = 0; i < 9; i++) { const y = -8 - R() * 100, st = station(y), x = (R() - 0.5) * st[2] * 1.4; m.box(x, y, st[3] - 0.3, 4 + R() * 10, 3 + R() * 8, 0.8 + R() * 1.4, TL.SNOW, { bevel: 0.4, rot: R() * 3 }); }
    for (const s of [-1, 1]) for (let k = 0; k < 14; k++) { const y = -12 - k * 14, st = station(y); m.box(s * (st[2] - 1), y, st[3] - 3.5, 2.2, 10, 3, TL.SNOW, { bevel: 0.6 }); }
  });
  edges(m, -340, -20, { noConduit: true });
  clutter(m, R, -100, 100, -330, -200, deckZ(-260), 18);
  return m.finish();
}

function lights0() {
  const m = new TankMesh();
  lightsCommon(m, -340, -20, false);
  const dot = (x, y, z, s = 1.6) => m.box(x, y, z, s, s, s, TL.GLOW, { bevel: 0 });
  m.with({ tint: RED, em: 1, ao: null }, () => { dot(0, -6, 54.5, 1.8); for (const s of [-1, 1]) { dot(s * 41, -150, BOWCIT + 0.5); dot(s * 26, -118, BOWCIT + 0.5); } });
  m.with({ tint: AMBER, em: 1, ao: null }, () => { for (const s of [-1, 1]) for (let y = -160; y > -330; y -= 22) m.box(s * 43, y, 36, 0.5, 6, 1.4, TL.GLOW, { bevel: 0 }); });
  m.with({ tint: GREEN, em: 1, ao: null }, () => dot(38, -110, deckZ(-110) + 1.6));
  return m.finish();
}

/** Generic middle section: hull, citadel, barbettes for its centreline turrets, rails, clutter. */
function midSection(k, extra) {
  const m = new TankMesh(), s = SECS[k], R = rnd(200 + k * 17);
  hullSeg(m, s.y0, s.y1, { step: 20, transom: k === 9 });
  extra(m, R, s);
  edges(m, s.y0, s.y1);
  return m.finish();
}

function midLights(k, extra) {
  const m = new TankMesh(), s = SECS[k];
  lightsCommon(m, k === 9 ? -2880 : s.y0, s.y1, true);
  if (extra) extra(m);
  return m.finish();
}

function sec1(m, R) {
  citadel(m, -620, -340);
  barbette(m, -76, -430, 26, 24); barbette(m, 76, -430, 26, 24); barbette(m, 0, -548, CIT, 24);
  // Fire-control director between the side turrets.
  m.with({ tint: PAINT, ao: [CIT, CIT + 8] }, () => { m.lathe(0, -460, [[8, CIT], [7, CIT + 8], [5, CIT + 10]], TL.WBPLATE, { seg: 14, uv: 30 }); m.box(0, -460, CIT + 8, 26, 4, 3, TL.DARK, { bevel: 0.6 }); });
  clutter(m, R, -40, 40, -610, -350, CIT, 10);
  clutter(m, R, -120, -60, -610, -480, 26, 6); clutter(m, R, 60, 120, -610, -480, 26, 6);
}

function sec2(m, R) {
  citadel(m, -900, -620);
  // Blast deflectors behind the pods, ammunition racks with stowed rockets.
  m.with({ tint: [0.85, 0.88, 0.92] }, () => {
    for (const y of [-708, -798]) for (const s of [-1, 1]) m.loft([{ pts: [s * 12, y - 12, s * 38, y - 12, s * 38, y - 16, s * 12, y - 16], z: CIT }, { pts: [s * 12, y - 20, s * 38, y - 20, s * 38, y - 22, s * 12, y - 22], z: CIT + 9 }], { layer: TL.WBPLATE, top: TL.DARK, uv: 30 });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = -650 - i * 60;
      m.box(s * 70, y, 26, 18, 30, 5, TL.WBPLATE, { bevel: 0.6 });
      for (let j = 0; j < 5; j++) m.tube([s * (63 + j * 3.4), y - 13, 32.4], [s * (63 + j * 3.4), y + 13, 32.4], 1.3, TL.BARREL, { seg: 8, caps: true, capLayer: TL.DARK, uvV: 14 });
    }
  });
  m.with({ tint: [1, 0.8, 0.2] }, () => decal(m, -40, -830, 40, -826, CIT + 0.05, TL.WBMARK, [0, 0, 2.4, 0.12]));
  clutter(m, R, -120, -85, -890, -630, 26, 5); clutter(m, R, 85, 120, -890, -630, 26, 5);
}

function sec3(m, R) {
  citadel(m, -1180, -900);
  // VLS wells in the citadel roof, a radar director, the missile handling hatches.
  m.with({ tint: DARK }, () => { for (const [x, y] of [[-27, -966], [27, -966], [-27, -1104], [27, -1104]]) m.box(x, y, CIT - 1.2, 23, 88, 1.3, TL.DARK, { bevel: 0.3 }); });
  m.with({ tint: PAINT, ao: [CIT, CIT + 14] }, () => {
    m.lathe(0, -1035, [[7, CIT], [6, CIT + 9], [4.5, CIT + 10]], TL.WBPLATE, { seg: 12, uv: 30 });
    m.with({ tint: [1.3, 1.32, 1.36] }, () => m.lathe(0, -1035, [[6, CIT + 10], [7.4, CIT + 13], [6.6, CIT + 16], [4, CIT + 18], [0, CIT + 18.6]], TL.WBPLATE, { seg: 16, uv: 20 }));
  });
  for (const s of [-1, 1]) for (const y of [-990, -1118]) { m.with({ tint: PAINT, ao: [26, 28] }, () => m.lathe(s * 97, y, [[14, 25.6], [14, 27.2], [13, 27.6]], TL.WBPLATE, { seg: 18, uv: 30, top: TL.DARK })); }
  clutter(m, R, -120, -80, -1170, -910, 26, 6); clutter(m, R, 80, 120, -1170, -910, 26, 6);
}

function sec4(m, R) {
  citadel(m, -1460, -1180);
  for (const s of [-1, 1]) for (const y of [-1222, -1290, -1358, -1426]) m.with({ tint: PAINT, ao: [26, 29] }, () => m.lathe(s * 101, y, [[10, 25.6], [10, 28.4], [9.4, 28.8]], TL.WBPLATE, { seg: 16, uv: 30, top: TL.WBDECK }));
  // Tracking radar directors (white domes on masts) and ammunition feed trunks.
  for (const [x, y] of [[-27, -1324], [27, -1324]]) {
    m.with({ tint: DARK }, () => m.lathe(x, y, [[2, CIT], [2, CIT + 14]], TL.DARK, { seg: 8, uv: 20 }));
    m.with({ tint: [1.3, 1.32, 1.36] }, () => m.lathe(x, y, [[5, CIT + 14], [6, CIT + 17], [5, CIT + 20], [2, CIT + 22], [0, CIT + 22.4]], TL.WBPLATE, { seg: 16, uv: 20 }));
  }
  m.with({ tint: DARK }, () => { for (const s of [-1, 1]) m.tube([s * 92, -1210, 29], [s * 92, -1440, 29], 1.6, TL.BARREL, { seg: 6, uvV: 40 }); });
  clutter(m, R, -40, 40, -1450, -1190, CIT, 8);
}

function sec5(m, R) {
  citadel(m, -1740, -1460);
  barbette(m, 0, -1516, CIT, 19); barbette(m, 0, -1700, CIT, 19);
  // Exhaust funnels: raked oval stacks with grilles and soot.
  m.with({ tint: PAINT, ao: [CIT, CIT + 26] }, () => {
    for (const s of [-1, 1]) {
      const x = s * 16, y = -1606, z0 = CIT, top = 66, hw = 9, hl = 15;
      const ringF = (z, k, dy) => { const p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push(x + Math.cos(a) * hw * k, y + Math.sin(a) * hl * k + dy); } return { pts: p, z }; };
      m.loft([ringF(z0, 1.08, 0), ringF(top - 6, 0.94, -5), ringF(top - 4, 1.06, -5.4), ringF(top, 1.04, -6)], { layer: TL.WBPLATE, top: TL.GRILLE, uv: 50 });
    }
    m.box(0, -1606, CIT, 46, 40, 6, TL.WBPLATE, { bevel: 1 });
  });
  for (const s of [-1, 1]) for (const y of [-1560]) m.with({ tint: PAINT, ao: [26, 28] }, () => m.lathe(s * 97, y, [[14, 25.6], [14, 27.2], [13, 27.6]], TL.WBPLATE, { seg: 18, uv: 30, top: TL.DARK }));
  clutter(m, R, -120, -80, -1730, -1470, 26, 7); clutter(m, R, 80, 120, -1730, -1470, 26, 7);
}

function sec6(m, R) {
  citadel(m, -2020, -1740);
  // Gun sponsons: armoured blisters carrying the flank turrets outboard.
  for (const s of [-1, 1]) {
    const pts = (k = 0) => { const P = [[118, -1760], [138, -1772], [142, -1984], [126, -2000], [118, -2000]]; const out = []; for (const [x, y] of P) out.push(s * (x - (x > 120 ? k : 0)), y); return out; };
    m.with({ tint: PAINT, ao: [-4, 26] }, () => m.loft([{ pts: pts(10), z: -8 }, { pts: pts(0), z: 2 }, { pts: pts(-1), z: 24 }, { pts: pts(0), z: 26 }], { layer: TL.WBPLATE, top: TL.WBDECK, uv: 60 }));
    m.with({ tint: CRIMSON }, () => m.loft([{ pts: pts(0.6), z: 4 }, { pts: pts(0.4), z: 9 }], { layer: TL.WBPLATE, top: false, uv: 40 }));
    barbette(m, s * 112, -1800, 26, 19); barbette(m, s * 112, -1956, 26, 19);
  }
  clutter(m, R, -40, 40, -2010, -1750, CIT, 8);
  clutter(m, R, -100, -60, -1990, -1760, 26, 5); clutter(m, R, 60, 100, -1990, -1760, 26, 5);
}

function sec7(m, R) {
  citadel(m, -2300, -2020);
  barbette(m, 0, -2196, CIT, 14);
  // Coolant tanks (frosted cylinders), pipe runs to the projectors, heat-exchanger stacks.
  m.with({ tint: [0.92, 0.98, 1.06] }, () => {
    for (const s of [-1, 1]) for (const y of [-2150, -2232]) m.tube([s * 76, y - 22, 34], [s * 76, y + 22, 34], 7.5, TL.WBPLATE, { seg: 16, caps: true, capLayer: TL.WBPLATE, uvV: 30 });
    for (const y of [-2060, -2250]) m.tube([-40, y, CIT + 4], [40, y, CIT + 4], 6, TL.WBPLATE, { seg: 14, caps: true, capLayer: TL.WBPLATE, uvV: 30 });
  });
  m.with({ tint: DARK }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 76, -2128, 42], [s * 68, -2104, 34], 1.6, TL.BARREL, { seg: 8, uvV: 20 });
      m.tube([s * 40, -2060, CIT + 4], [s * 14, -2180, CIT + 4], 1.4, TL.BARREL, { seg: 8, uvV: 40 });
      m.box(s * 60, -2240, 26, 12, 14, 8, TL.GRILLE, { bevel: 0.6 });
    }
  });
  // Frost crust spreading over the cryo deck.
  m.with({ tint: [1.02, 1.05, 1.1] }, () => { for (let i = 0; i < 30; i++) { const x = (R() - 0.5) * 220, y = -2030 - R() * 260, z = Math.abs(x) < 46 ? CIT : 26; m.box(x, y, z - 0.2, 4 + R() * 12, 3 + R() * 9, 0.8 + R() * 1.6, TL.SNOW, { bevel: 0.4, rot: R() * 3 }); } });
  clutter(m, R, -120, -90, -2290, -2030, 26, 4); clutter(m, R, 90, 120, -2290, -2030, 26, 4);
}

function sec8(m, R) {
  citadel(m, -2580, -2300);
  // Emitter plinth: a stepped armoured drum the beam head turns on.
  m.with({ tint: PAINT, ao: [CIT, CIT + 12] }, () => m.lathe(0, -2366, [[40, CIT], [40, CIT + 6], [36, CIT + 9], [34, CIT + 10]], TL.WBPLATE, { seg: 36, uv: 44, top: TL.DARK }));
  // Focusing-emitter pads.
  for (const s of [-1, 1]) for (const y of [-2330, -2430]) m.with({ tint: PAINT, ao: [26, 28] }, () => m.lathe(s * 64, y, [[10, 25.6], [10, 27.4], [9, 27.8]], TL.WBPLATE, { seg: 16, uv: 30, top: TL.DARK }));
  // Command superstructure: stacked levels, the bridge with its wings, the mast, stacks.
  m.with({ tint: PAINT, ao: [CIT, 100] }, () => {
    house(m, rectC(-46, 46, -2570, -2414, 8), [[CIT, 1], [56, 0.99], [57.5, 0.97]], TL.WBPLATE, { top: TL.WBDECK });
    house(m, rectC(-38, 38, -2560, -2432, 7), [[57, 1], [72, 0.99], [73.2, 0.97]], TL.WBPLATE, { top: TL.WBDECK });
    house(m, [-34, -2470, 34, -2470, 36, -2444, 26, -2436, -26, -2436, -36, -2444], [[73, 1], [82, 1, 0.6], [86, 0.95, -0.8], [87, 0.92, -1]], TL.WBPLATE, { top: TL.DARK });
    for (const s of [-1, 1]) plate(m, [s * 34, -2452, s * 52, -2450, s * 52, -2440, s * 34, -2442], 76, 78, TL.WBDECK, TL.WBPLATE);
    house(m, rectC(-22, 22, -2530, -2476, 5), [[73, 1], [92, 0.97], [93, 0.94]], TL.WBPLATE, { top: TL.WBDECK });
    for (const s of [-1, 1]) {
      const x = s * 10, y = -2548, z0 = 73, top = 98, hw = 7, hl = 10;
      const ringF = (z, k, dy) => { const p = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; p.push(x + Math.cos(a) * hw * k, y + Math.sin(a) * hl * k + dy); } return { pts: p, z }; };
      m.loft([ringF(z0, 1.05, 0), ringF(top - 5, 0.94, -4), ringF(top - 3, 1.05, -4.2), ringF(top, 1.04, -4.6)], { layer: TL.WBPLATE, top: TL.GRILLE, uv: 50 });
    }
    for (const [x, y, z] of WB.searchlights) { m.lathe(x, y, [[3, z - 2], [3, z], [2.6, z + 0.6]], TL.DARK, { seg: 10, uv: 20 }); m.tube([x, y + 1, z + 2.5], [x, y - 3, z + 2.5], 2.6, TL.DARK, { seg: 12, caps: 'start', capLayer: TL.DARK, uvV: 8 }); }
  });
  m.with({ tint: DARK }, () => {
    const top = [0, -2522, 150];
    for (const [x, y] of [[-14, -2504], [14, -2504], [0, -2534]]) m.tube([x, y, 92], top, 1.3, TL.BARREL, { seg: 6, uvV: 40 });
    m.tube([-28, -2522, 136], [28, -2522, 136], 0.8, TL.BARREL, { seg: 6, uvV: 30 });
    m.tube([-18, -2522, 146], [18, -2522, 146], 0.6, TL.BARREL, { seg: 6, uvV: 30 });
    m.lathe(0, -2522, [[9, 120], [9, 122], [8, 122.6]], TL.DARK, { seg: 12, uv: 20 });
    m.tube([0, -2522, 150], [0, -2522, 176], 0.45, TL.DARK, { seg: 5, uvV: 30 });
    for (const [x, y] of [[-30, -2460], [30, -2460], [-18, -2520], [18, -2520]]) m.tube([x, y, 87], [x, y, 110], 0.25, TL.DARK, { seg: 4, uvV: 20 });
  });
  m.with({ tint: [1.3, 1.32, 1.36] }, () => { for (const s of [-1, 1]) m.lathe(s * 16, -2500, [[6.5, 93], [8, 96], [7.6, 99], [5.4, 101.4], [2.2, 102.6], [0, 103]], TL.WBPLATE, { seg: 18, uv: 30 }); });
  clutter(m, R, -120, -80, -2570, -2310, 26, 5); clutter(m, R, 80, 120, -2570, -2310, 26, 5);
}

function sec9(m, R) {
  citadel(m, -2880, -2580);
  barbette(m, 0, -2640, CIT, 24);
  for (const s of [-1, 1]) m.with({ tint: PAINT, ao: [26, 29] }, () => m.lathe(s * 102, -2680, [[10, 25.6], [10, 28.4], [9.4, 28.8]], TL.WBPLATE, { seg: 16, uv: 30, top: TL.WBDECK }));
  // Stern tower for the alternate emitter, the stern machinery house, crane, helideck markings.
  m.with({ tint: PAINT, ao: [26, 50] }, () => {
    house(m, rectC(-40, 40, -2896, -2828, 8), [[CIT - 1, 1], [49, 0.98], [50, 0.95]], TL.WBPLATE, { top: TL.DARK });
    house(m, rectC(-60, 60, -3010, -2900, 10), [[26, 1], [44, 0.99], [45.4, 0.96]], TL.WBPLATE, { top: TL.WBDECK });
    m.lathe(0, -2925, [[6, 45], [5.4, 58], [6, 59]], TL.WBPLATE, { seg: 12, uv: 30, top: TL.GRILLE });
  });
  m.with({ tint: DARK }, () => {
    m.lathe(70, -2960, [[4, 26], [3, 44]], TL.DARK, { seg: 10, uv: 20 });
    m.tube([70, -2960, 42], [30, -2930, 64], 1.6, TL.BARREL, { seg: 6, uvV: 30 });
    m.tube([0, -3028, 26], [0, -3028, 46], 0.45, TL.DARK, { seg: 5, uvV: 20 });
  });
  m.with({ tint: [0.95, 0.85, 0.3] }, () => decal(m, -54, -3004, 54, -3000, 45.5, TL.WBMARK, [0, 0, 3.2, 0.12]));
  clutter(m, R, -120, -70, -2870, -2600, 26, 7); clutter(m, R, 70, 120, -2870, -2600, 26, 7);
  clutter(m, R, -110, 110, -3020, -2900, 26, 6);
}

// ------------------------------------------------------------- mount meshes

/** Turret house (origin: ring centre on its barbette, front = +y), scaled by r. */
function turretHouse(r, h, ports, o = {}) {
  const m = new TankMesh(), k = r / 25;
  m.with({ tint: PAINT, ao: [0, h * 0.6] }, () => {
    m.lathe(0, 0, [[r, -1], [r, 1.4], [r - 1, 1.8]], TL.DARK, { seg: 28, uv: 30 });
    const P = [-20, -22, 20, -22, 25, -7, 23, 13, 13, 25, -13, 25, -23, 13, -25, -7].map((v) => v * k);
    house(m, P, [[1.4, 1], [h * 0.62, 1, -1.4 * k], [h * 0.95, 0.93, -2.4 * k], [h, 0.88, -2.6 * k]], TL.WBPLATE, { top: TL.WBPLATE, uv: 40 });
    m.box(0, -6 * k, h + 0.3, 28 * k, 20 * k, 1.2, TL.WBPLATE, { bevel: 0.5 });
    for (const s of [-1, 1]) { m.box(s * 9 * k, -12 * k, h + 1.5, 6 * k, 6 * k, 1.2, TL.DARK, { bevel: 0.3 }); m.box(s * 15 * k, 9 * k, h, 3 * k, 3 * k, 2.6, TL.DARK, { bevel: 0.3 }); }
    if (o.ears) for (const s of [-1, 1]) { m.box(s * 26 * k, -14 * k, h * 0.4, 6 * k, 10 * k, 6 * k, TL.WBPLATE, { bevel: 0.8 }); m.tube([s * 26 * k, -9 * k, h * 0.55], [s * 26 * k, -8 * k, h * 0.55], 2 * k, TL.DARK, { seg: 8, caps: 'end', capLayer: TL.GLOW, uvV: 4 }); }
    for (const x of ports) m.box(x, 25 * k + 0.2, h * 0.22, 6 * k, 2.4, h * 0.5, TL.DARK, { bevel: 0.4 });
    m.box(0, -25 * k, h * 0.25, 34 * k, 6 * k, h * 0.55, TL.WBPLATE, { bevel: 0.8 });
    m.box(0, -28.2 * k, h * 0.35, 24 * k, 0.8, h * 0.25, TL.GRILLE, { bevel: 0 });
  });
  // Rime on the roof.
  m.with({ tint: [1.02, 1.04, 1.08] }, () => { m.box(-6 * k, 4 * k, h + 0.4, 10 * k, 8 * k, 0.6, TL.SNOW, { bevel: 0.3, rot: 0.4 }); m.box(8 * k, -10 * k, h + 0.4, 8 * k, 6 * k, 0.5, TL.SNOW, { bevel: 0.3, rot: -0.3 }); });
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 22 * k, 18 * k, h * 0.7, 1, 1, 1, TL.GLOW, { bevel: 0 }); m.box(0, 26.6 * k, h * 0.85, 12 * k, 0.5, 0.7, TL.GLOW, { bevel: 0 }); });
  m.with({ tint: CYAN, em: 1, ao: null }, () => m.box(0, -25 * k - 0.4, h * 0.6, 10 * k, 0.4, 0.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

/** Gun barrel: mantlet + tapered tube + muzzle brake (origin: trunnion, along +y). */
function gunBarrel(r0, len) {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 2, -r0, r0 * 1.7, 10, r0 * 2, TL.WBPLATE, { bevel: 0.8 });
    m.tube([0, 6, 0], [0, 14, 0], r0 * 1.15, TL.BARREL, { r1: r0, seg: 14, uvV: 20 });
    m.tube([0, 14, 0], [0, len - 6, 0], r0 * 0.92, TL.BARREL, { r1: r0 * 0.72, seg: 14, uvV: 50 });
    m.tube([0, len - 6, 0], [0, len, 0], r0 * 0.9, TL.DARK, { r1: r0 * 0.86, seg: 14, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    m.tube([0, len, 0], [0, len - 1, 0], r0 * 0.5, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.DARK, uvV: 4 });
  });
  return m.finish();
}

function acBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 4] }, () => {
    m.lathe(0, 0, [[7, 0], [6.5, 3], [5.5, 4]], TL.WBPLATE, { seg: 14, uv: 20 });
    m.box(0, -1, 3.5, 11, 11, 4.5, TL.WBPLATE, { bevel: 1 });
    for (const s of [-1, 1]) m.box(s * 5, 0, 5, 1.4, 7, 5, TL.WBPLATE, { bevel: 0.3 });
  });
  m.with({ tint: RED, em: 1, ao: null }, () => m.box(0, 4.6, 6.6, 3, 0.4, 0.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function acGun() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 0, -2.2, 8, 8, 4.4, TL.WBPLATE, { bevel: 0.6 });
    for (const s of [-1, 1]) { m.tube([s * 1.9, 3, 0], [s * 1.9, 17, 0], 0.75, TL.BARREL, { seg: 8, uvV: 20 }); m.tube([s * 1.9, 16, 0], [s * 1.9, 19, 0], 1, TL.DARK, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 6 }); }
    m.box(4.6, -2, -1, 3, 6, 3, TL.DARK, { bevel: 0.3 });
  });
  return m.finish();
}

function ciwsBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 4] }, () => { m.lathe(0, 0, [[7, 0], [6.5, 3], [5.5, 4]], TL.WBPLATE, { seg: 14, uv: 20 }); m.box(0, -1, 4, 10, 12, 6, TL.WBPLATE, { bevel: 1 }); });
  m.with({ tint: [1.3, 1.32, 1.36] }, () => m.lathe(0, -3, [[5, 9], [5.2, 14], [4.4, 17], [2.4, 18.6], [0, 19]], TL.NAVY, { seg: 16, uv: 20 }));
  m.with({ tint: DARK }, () => { m.box(0, 4, 7, 6, 6, 4, TL.DARK, { bevel: 0.4 }); m.tube([4.6, -4, 8], [6.4, -4, 8], 2, TL.DARK, { seg: 8, caps: true, uvV: 5 }); });
  m.with({ tint: RED, em: 1, ao: null }, () => m.box(0, -9.2, 10, 2, 0.4, 0.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function ciwsRotor() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.tube([Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6], [Math.cos(a) * 1.6, 21, Math.sin(a) * 1.6], 0.55, TL.BARREL, { seg: 5, caps: 'end', capLayer: TL.DARK, uvV: 20 }); }
    for (const y of [1, 11, 19.5]) m.tube([0, y, 0], [0, y + 1.4, 0], 2.6, TL.DARK, { seg: 10, caps: true, capLayer: TL.DARK, uvV: 6 });
  });
  return m.finish();
}

function flakHouse() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 6] }, () => {
    m.lathe(0, 0, [[10.5, 0], [10.5, 2], [10, 6], [8, 9], [5, 10.4], [0, 10.8]], TL.WBPLATE, { seg: 20, uv: 30 });
    m.box(0, 7, 3, 12, 4, 6, TL.DARK, { bevel: 0.5 });
  });
  m.with({ tint: RED, em: 1, ao: null }, () => m.box(0, -9.6, 5, 3, 0.4, 0.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function flakGuns() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 0, -1.8, 13, 6, 3.6, TL.WBPLATE, { bevel: 0.5 });
    for (const x of [-4.5, -1.5, 1.5, 4.5]) { m.tube([x, 2, 0], [x, 17, 0], 0.7, TL.BARREL, { seg: 7, uvV: 20 }); m.tube([x, 16, 0], [x, 19, 0], 0.95, TL.DARK, { seg: 7, caps: 'end', capLayer: TL.DARK, uvV: 5 }); }
  });
  return m.finish();
}

/** Trainable launcher pedestal (pods, missile boxes, rocket arrays). */
function launcherBase(r, h) {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 4] }, () => {
    m.lathe(0, 0, [[r, 0], [r * 0.9, 2.6], [r * 0.75, 3.2]], TL.WBPLATE, { seg: 16, uv: 20 });
    for (const s of [-1, 1]) m.box(s * r * 0.95, 0, 2, 2.4, r * 0.9, h - 2, TL.WBPLATE, { bevel: 0.4 });
    m.box(0, -r * 0.4, 2, r * 1.4, r * 0.6, 3, TL.DARK, { bevel: 0.4 });
  });
  return m.finish();
}

/** Launcher box: tube block about its trunnion (tubes along +y, mouths on the +y face). */
function launcherBox(w, d, h, muzzles, tr, o = {}) {
  const m = new TankMesh();
  m.with({ tint: PAINT }, () => {
    m.box(0, 0, -h / 2, w, d, h, TL.WBPLATE, { bevel: 0.8 });
    m.box(0, -d / 2 - 1, -h / 2 + 1, w - 2, 2, h - 2, TL.GRILLE, { bevel: 0.2 });
  });
  m.with({ tint: DARK }, () => { for (const [x, y, z] of muzzles) m.tube([x, y - 1.6, z], [x, y + 0.2, z], tr, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.GRILLE, uvV: 4 }); });
  if (o.stripe) m.with({ tint: [1, 1, 1] }, () => decal(m, -w / 2 + 1, -d / 2 + 2, w / 2 - 1, -d / 2 + 5, h / 2 + 0.05, TL.WBMARK, [0, 0, 1.2, 0.1]));
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * (w / 2 + 0.3), d / 2 - 2, h * 0.3, 0.4, 1.4, 1.4, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function vlsBlock() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 5] }, () => {
    m.box(0, 0, 0, 22, 86, 5.6, TL.WBPLATE, { bevel: 0.6 });
    for (const [cx, cy] of TYPES.vls.cells) m.box(cx, cy, 5.6, 9, 9.6, 0.3, TL.DARK, { bevel: 0 });
  });
  m.with({ tint: [0.22, 0.22, 0.25] }, () => { for (const [cx, cy] of TYPES.vls.cells) m.box(cx, cy, 5.7, 7.2, 8, 0.2, TL.GRILLE, { bevel: 0 }); });
  m.with({ tint: [1, 1, 1] }, () => decal(m, -11, 42, 11, 43.4, 5.65, TL.WBMARK, [0, 0, 1, 0.12]));
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const [cx, cy] of TYPES.vls.cells) m.box(cx + (cx > 0 ? 4.9 : -4.9), cy, 5.2, 0.5, 5, 0.6, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

/** One cell door, hinged at its outer edge (origin on the hinge, the door lies toward −x). */
function vlsDoor() {
  const m = new TankMesh();
  m.with({ tint: [0.95, 0.97, 1] }, () => m.box(-4.4, 0, 0, 8.6, 9.4, 0.9, TL.WBPLATE, { bevel: 0.2 }));
  m.with({ tint: [1.02, 1.04, 1.08] }, () => m.box(-4.4, 1.6, 0.9, 6, 4, 0.3, TL.SNOW, { bevel: 0.1 }));
  return m.finish();
}

function mortarHouse() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 6] }, () => {
    m.lathe(0, 0, [[11, -1], [11, 1], [10, 1.5]], TL.DARK, { seg: 20, uv: 30 });
    house(m, [-9, -10, 9, -10, 11, -2, 9, 8, -9, 8, -11, -2], [[1, 1], [7, 1], [9, 0.9]], TL.WBPLATE, { top: TL.WBPLATE, uv: 30 });
    for (const s of [-1, 1]) m.tube([s * 9, -6, 6], [s * 9, 4, 6], 2.2, TL.WBPLATE, { seg: 10, caps: true, capLayer: TL.WBPLATE, uvV: 10 });
  });
  m.with({ tint: CYAN, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 11.4, -3, 6, 0.4, 3, 1, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function mortarTube() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 0, -3, 6, 6, 6, TL.WBPLATE, { bevel: 0.6 });
    m.tube([0, 1, 0], [0, 13, 0], 3.2, TL.BARREL, { r1: 3, seg: 14, uvV: 16 });
    m.tube([0, 12, 0], [0, 15, 0], 3.6, TL.DARK, { seg: 14, caps: 'end', capLayer: TL.DARK, uvV: 5 });
    for (const y of [4, 8]) m.tube([0, y, 0], [0, y + 1, 0], 3.5, TL.WBPLATE, { seg: 14, uvV: 3 });
  });
  m.with({ tint: [0.4, 1.6, 2.2], em: 0.8, ao: null }, () => m.tube([0, 15.05, 0], [0, 14.9, 0], 2.3, TL.GLOW, { seg: 12, caps: 'end', uvV: 2 }));
  return m.finish();
}

function cryoHouse() {
  const m = new TankMesh();
  m.with({ tint: [0.92, 0.96, 1.02], ao: [0, 8] }, () => {
    m.lathe(0, 0, [[14, -1], [14, 1.4], [13, 1.8]], TL.DARK, { seg: 24, uv: 30 });
    m.lathe(0, -2, [[12.5, 1.4], [13, 6], [11.5, 11], [8, 13.6], [3, 14.4], [0, 14.5]], TL.WBPLATE, { seg: 24, uv: 30 });
    // Coolant ribs round the dome.
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; m.box(Math.cos(a) * 12.6, -2 + Math.sin(a) * 12.6, 2, 2.2, 2.2, 7, TL.WBPLATE, { bevel: 0.4, rot: a }); }
  });
  m.with({ tint: [1.02, 1.05, 1.1] }, () => m.lathe(0, -2, [[9, 13.4], [6, 14.6], [0, 15]], TL.SNOW, { seg: 18, uv: 20 }));
  m.with({ tint: CYAN, em: 1, ao: null }, () => { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; m.box(Math.cos(a) * 13.9, -2 + Math.sin(a) * 13.9, 6, 0.5, 0.5, 4, TL.GLOW, { bevel: 0, rot: a }); } });
  return m.finish();
}

function cryoNozzle() {
  const m = new TankMesh();
  m.with({ tint: [0.88, 0.92, 0.98] }, () => {
    m.box(0, 0, -3.5, 10, 10, 7, TL.WBPLATE, { bevel: 0.8 });
    m.tube([0, 4, 0], [0, 26, 0], 3.6, TL.BARREL, { r1: 3.1, seg: 16, uvV: 20 });
    m.tube([0, 26, 0], [0, 32, 0], 4.6, TL.WBPLATE, { r1: 5.4, seg: 16, caps: 'end', capLayer: TL.DARK, uvV: 6 });
    for (const y of [8, 13, 18, 23]) m.tube([0, y, 0], [0, y + 1.6, 0], 4.4, TL.DARK, { seg: 16, uvV: 3 });
    for (const s of [-1, 1]) m.tube([s * 5.5, -2, 0], [s * 4.6, 22, 0], 1, TL.BARREL, { seg: 8, uvV: 20 });
  });
  return m.finish();
}

function cryoGlow() {
  const m = new TankMesh();
  m.with({ tint: [0.5, 1.7, 2.4], em: 1, ao: null }, () => {
    for (const y of [8, 13, 18, 23]) m.tube([0, y + 0.4, 0], [0, y + 1.2, 0], 4.55, TL.GLOW, { seg: 16, uvV: 3 });
    m.tube([0, 32.05, 0], [0, 31.9, 0], 4.2, TL.GLOW, { seg: 16, caps: 'end', uvV: 2 });
  });
  return m.finish();
}

function beamBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 14] }, () => {
    m.lathe(0, 0, [[31, 0], [31, 4], [29, 6]], TL.DARK, { seg: 32, uv: 40 });
    house(m, [-20, -26, 20, -26, 27, -12, 27, 10, 18, 22, -18, 22, -27, 10, -27, -12], [[5, 1], [14, 1], [16, 0.95]], TL.WBPLATE, { top: TL.WBDECK, uv: 40 });
    for (const s of [-1, 1]) { m.box(s * 20, 0, 14, 7, 16, 14, TL.WBPLATE, { bevel: 1 }); m.box(s * 27, -14, 4, 4, 10, 10, TL.GRILLE, { bevel: 0.4 }); }
    m.box(0, -24, 6, 30, 8, 12, TL.WBPLATE, { bevel: 1 });
  });
  m.with({ tint: CYAN, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 23.6, 0, 20, 0.4, 12, 1, TL.GLOW, { bevel: 0 }); m.box(0, -28.2, 12, 20, 0.4, 1, TL.GLOW, { bevel: 0 }); });
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 27.4, 10, 8, 0.4, 2, 2, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

/** Beam head (origin: trunnion; the beam leaves along +y): housing, focusing rings, capacitor bank, fins. */
function beamHead() {
  const m = new TankMesh();
  m.with({ tint: [0.86, 0.9, 0.96] }, () => {
    m.tube([0, -22, 0], [0, 8, 0], 12, TL.WBPLATE, { r1: 13, seg: 22, caps: 'start', capLayer: TL.WBPLATE, uvV: 30 });
    m.box(0, -18, -12, 22, 18, 24, TL.WBPLATE, { bevel: 1.4 });
    for (const [y, r] of [[10, 17], [22, 15], [34, 13]]) { m.tube([0, y, 0], [0, y + 4, 0], r, TL.WBPLATE, { seg: 24, caps: true, capLayer: TL.DARK, uvV: 6 }); }
    m.tube([0, 8, 0], [0, 44, 0], 8.6, TL.BARREL, { r1: 7.4, seg: 20, uvV: 30 });
    m.tube([0, 44, 0], [0, 47, 0], 11, TL.DARK, { seg: 22, caps: 'end', capLayer: TL.DARK, uvV: 4 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.box(Math.cos(a) * 14, -6, Math.sin(a) * 14 - 1.5, 2, 26, 3, TL.WBPLATE, { bevel: 0.3, rot: 0 }); }
    for (const s of [-1, 1]) m.tube([s * 13, -22, -6], [s * 9, 6, -6], 1.6, TL.BARREL, { seg: 8, uvV: 20 });
  });
  return m.finish();
}

function beamGlow() {
  const m = new TankMesh();
  m.with({ tint: [0.6, 1.8, 2.4], em: 1, ao: null }, () => {
    m.tube([0, 47.1, 0], [0, 46.9, 0], 8, TL.GLOW, { seg: 22, caps: 'end', uvV: 2 });
    for (const [y, r] of [[12, 17.1], [24, 15.1], [36, 13.1]]) m.tube([0, y, 0], [0, y + 0.8, 0], r, TL.GLOW, { seg: 24, uvV: 2 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.box(Math.cos(a) * 15.2, -6, Math.sin(a) * 15.2 - 0.6, 0.4, 20, 1, TL.GLOW, { bevel: 0 }); }
  });
  return m.finish();
}

function auxBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 6] }, () => {
    m.lathe(0, 0, [[8, 0], [7.5, 2.4], [6, 3]], TL.WBPLATE, { seg: 14, uv: 20 });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; m.tube([Math.cos(a) * 5.5, Math.sin(a) * 5.5, 2.5], [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 18], 1.1, TL.BARREL, { seg: 6, uvV: 20 }); }
    m.lathe(0, 0, [[3, 16], [3.4, 18], [2.6, 19]], TL.DARK, { seg: 10, uv: 20 });
  });
  return m.finish();
}

function auxHead() {
  const m = new TankMesh();
  m.with({ tint: [0.88, 0.92, 0.98] }, () => {
    m.tube([0, -6, 0], [0, 6, 0], 4.2, TL.WBPLATE, { seg: 14, caps: 'start', capLayer: TL.WBPLATE, uvV: 10 });
    m.tube([0, 6, 0], [0, 12, 0], 5.6, TL.DARK, { r1: 6.2, seg: 16, caps: 'end', capLayer: TL.DARK, uvV: 6 });
    for (const s of [-1, 1]) m.box(s * 5.6, -1, -1, 1.4, 8, 2, TL.WBPLATE, { bevel: 0.2 });
  });
  return m.finish();
}

function auxGlow() {
  const m = new TankMesh();
  m.with({ tint: [0.5, 1.7, 2.4], em: 1, ao: null }, () => { m.tube([0, 12.1, 0], [0, 11.9, 0], 4.6, TL.GLOW, { seg: 16, caps: 'end', uvV: 2 }); m.tube([0, 2, 0], [0, 3, 0], 4.3, TL.GLOW, { seg: 14, uvV: 2 }); });
  return m.finish();
}

function radar() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.lathe(0, 0, [[3, 0], [2.6, 5], [2, 6]], TL.DARK, { seg: 10, uv: 20 });
    m.box(0, 1, 6, 32, 2, 8, TL.GRILLE, { bevel: 0.3 });
    m.box(0, -1.5, 8, 10, 3, 4, TL.WBPLATE, { bevel: 0.5 });
  });
  return m.finish();
}

function sectionGlass() {
  const m = new TankMesh();
  m.with({ tint: [0.85, 0.65, 0.4], em: 0.45 }, () => {
    const band = (pts, z0, z1, out) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        m.quad([[a[0], a[1], z0], [b[0], b[1], z0], [b[0] + out[i][0], b[1] + out[i][1], z1], [a[0] + out[i][0], a[1] + out[i][1], z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], TL.GLASS, [0, -2480, z0]);
      }
    };
    band([[-36.2, -2444], [-26.2, -2435.8], [26.2, -2435.8], [36.2, -2444]], 78, 82.6, [[-0.4, 0.5], [0, 0.7], [0.4, 0.5]]);
    band([[-36.4, -2468], [-36.4, -2445]], 78, 82.6, [[-0.5, 0]]);
    band([[36.4, -2445], [36.4, -2468]], 78, 82.6, [[0.5, 0]]);
    band([[-37.4, -2433.8], [37.4, -2433.8]], 62, 64.4, [[0, 0.1]]);
    band([[-45.4, -2415.6], [45.4, -2415.6]], 47, 49, [[0, 0.1]]);
  });
  return m.finish();
}

function lights8extra(m) {
  const dot = (x, y, z, s = 1.6) => m.box(x, y, z, s, s, s, TL.GLOW, { bevel: 0 });
  m.with({ tint: RED, em: 1, ao: null }, () => { dot(0, -2522, 176.4, 2); for (const s of [-1, 1]) { dot(s * 28, -2522, 136.6, 1.4); dot(s * 52, -2445, 78.6, 1.8); dot(s * 44, -2420, 57.8, 1.6); } });
  m.with({ tint: GREEN, em: 1, ao: null }, () => dot(52, -2448, 78.6, 1.8));
  m.with({ tint: WHITE, em: 1, ao: null }, () => { for (const [x, y, z] of WB.searchlights) m.tube([x, y - 3.2, z + 2.5], [x, y - 3.6, z + 2.5], 2.2, TL.GLOW, { seg: 12, caps: 'end', uvV: 4 }); dot(0, -2522, 151, 1.2); });
  m.with({ tint: CYAN, em: 1, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 38.6, -2500, 66, 0.4, 40, 1, TL.GLOW, { bevel: 0 }); m.box(0, -2415.2, 52, 50, 0.4, 0.8, TL.GLOW, { bevel: 0 }); });
}

function lights9extra(m) {
  const dot = (x, y, z, s = 1.6) => m.box(x, y, z, s, s, s, TL.GLOW, { bevel: 0 });
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const s of [-1, 1]) { dot(s * 60, -2902, 45.6); dot(s * 60, -3008, 45.6); dot(s * 40, -2830, 50.6); } dot(0, -3028, 46.4, 1.4); });
  m.with({ tint: WHITE, em: 1, ao: null }, () => dot(0, -3029, 30, 1.6));
  m.with({ tint: AMBER, em: 1, ao: null }, () => { for (const s of [-1, 1]) for (let y = -2912; y > -3000; y -= 18) m.box(s * 60.4, y, 36, 0.5, 6, 1.4, TL.GLOW, { bevel: 0 }); });
}

// ----------------------------------------------------------- wrecks & pieces

function wreckMount(w, d, h, seed, stubs = 0) {
  const m = new TankMesh(), R = rnd(seed);
  m.with({ tint: [0.5, 0.46, 0.44] }, () => {
    m.box(0, 0, -1, w, d, h * 0.45, TL.SCORCH, { bevel: 0.8, rot: R() * 0.3 });
    for (let k = 0; k < 6; k++) m.box((R() - 0.5) * w * 0.7, (R() - 0.5) * d * 0.7, h * 0.3, 2 + R() * 5, 2 + R() * 5, 2 + R() * h * 0.5, TL.SCORCH, { bevel: 0.3, rot: R() * 3 });
    for (let k = 0; k < stubs; k++) {
      const x = (k - (stubs - 1) / 2) * 8, a = (R() - 0.5) * 0.9, l = 10 + R() * 18;
      m.tube([x, d * 0.3, h * 0.4], [x + Math.sin(a) * l, d * 0.3 + Math.cos(a) * l, h * 0.4 - R() * 6], 2.2, TL.SCORCH, { r1: 1.7, seg: 8, caps: true, capLayer: TL.SCORCH, uvV: 20 });
    }
  });
  return m.finish();
}

function chunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => m.loft([{ pts: [-1, -0.8, 0.9, -1, 1, 0.7, -0.6, 1], z: -0.5 }, { pts: [-0.7, -0.6, 0.6, -0.8, 0.8, 0.5, -0.5, 0.7], z: 0.5 }], { layer: TL.WBPLATE, top: TL.WBPLATE, bottom: TL.SCORCH, uv: 2 }));
  return m.finish();
}

function plateChunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => {
    m.loft([{ pts: [-1, -1, 1, -1, 1, 0, -1, 0], z: 0 }, { pts: [-1, -1, 1, -1, 1, 0, -1, 0], z: 0.14 }], { layer: TL.WBPLATE, top: TL.WBPLATE, bottom: TL.SCORCH, uv: 2 });
    m.loft([{ pts: [-1, 0, 1, 0, 0.9, 0.8, -0.9, 0.9], z: 0.05 }, { pts: [-1, 0, 1, 0, 0.9, 0.8, -0.9, 0.9], z: 0.4 }], { layer: TL.WBPLATE, top: TL.SCORCH, uv: 2 });
  });
  return m.finish();
}

function shell() {
  const m = new TankMesh();
  m.with({ tint: [1.2, 1.1, 0.9] }, () => { m.tube([0, -6, 0], [0, 3, 0], 2.2, TL.BARREL, { seg: 10, caps: 'start', capLayer: TL.DARK, uvV: 8 }); m.tube([0, 3, 0], [0, 8, 0], 2.2, TL.BARREL, { r1: 0.3, seg: 10, uvV: 6 }); });
  m.with({ tint: [2.4, 0.9, 0.3], em: 1 }, () => m.tube([0, -6.1, 0], [0, -6.4, 0], 1.6, TL.GLOW, { seg: 8, caps: 'end', uvV: 2 }));
  return m.finish();
}

function cryoShell() {
  const m = new TankMesh();
  m.with({ tint: [0.9, 1.0, 1.1] }, () => { m.tube([0, -7, 0], [0, 4, 0], 2.8, TL.WBPLATE, { seg: 12, caps: 'start', capLayer: TL.DARK, uvV: 8 }); m.tube([0, 4, 0], [0, 9, 0], 2.8, TL.WBPLATE, { r1: 0.6, seg: 12, uvV: 6 }); });
  m.with({ tint: [0.5, 1.8, 2.4], em: 1 }, () => { for (const y of [-3, 1]) m.tube([0, y, 0], [0, y + 1, 0], 2.9, TL.GLOW, { seg: 12, uvV: 2 }); });
  return m.finish();
}

function missile() {
  const m = new TankMesh();
  m.with({ tint: [1.2, 1.22, 1.25] }, () => {
    m.tube([0, -10, 0], [0, 8, 0], 2, TL.NAVY, { seg: 10, caps: 'start', capLayer: TL.DARK, uvV: 12 });
    m.tube([0, 8, 0], [0, 13, 0], 2, TL.NAVY, { r1: 0.2, seg: 10, uvV: 6 });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; m.box(Math.cos(a) * 2.8, -8, Math.sin(a) * 2.8 - 1.2, 0.4, 4, 2.4, TL.DARK, { bevel: 0 }); }
  });
  m.with({ tint: RED, em: 1 }, () => m.tube([0, 9, 0], [0, 10, 0], 1.7, TL.GLOW, { seg: 8, uvV: 2 }));
  return m.finish();
}

/** Ice crystal spike (frozen corridor): hexagonal shaft with a jagged point, faintly lit from within. */
function spike() {
  const m = new TankMesh();
  m.with({ tint: [0.75, 1.0, 1.25], em: 0.12 }, () => {
    const ring = (z, r, tw) => { const p = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + tw; p.push(Math.cos(a) * r, Math.sin(a) * r); } return { pts: p, z }; };
    m.loft([ring(-4, 1, 0), ring(0.6, 1, 0.05), ring(0.82, 0.75, 0.1), ring(1, 0.06, 0.2)], { layer: TL.SNOW, top: TL.SNOW, uv: 1.2 });
  });
  return m.finish();
}

/** Ice cake (trapped against the hull): slab with a snow top, unit-ish size. */
function floe(seed) {
  const m = new TankMesh(), R = rnd(seed), n = 6 + ((seed * 7) % 3), pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.5, d = 0.8 + R() * 0.35; pts.push(Math.cos(a) * d, Math.sin(a) * d); }
  m.with({ tint: [0.72, 0.9, 1.12] }, () => m.loft([{ pts, z: -1.2 }, { pts, z: 0.3 }], { layer: TL.SNOW, top: false, uv: 1 }));
  m.with({ tint: [1, 1.02, 1.05] }, () => m.loft([{ pts, z: 0.3 }, { pts: pts.map((v) => v * 0.9), z: 0.42 }], { layer: TL.SNOW, top: TL.SNOW, uv: 1 }));
  return m.finish();
}

/**
 * Ice cakes trapped along both sides of the hull, baked into one static mesh per
 * section (they ride the hull's slow heave): deterministic sizes and offsets.
 */
function trappedIce(k) {
  const m = new TankMesh(), S = SECS[k];
  let s = 4242 + k * 977;
  const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const side of [-1, 1]) for (let y = Math.min(-40, S.y1); y > Math.max(-3020, S.y0); y -= 13 + R() * 15) {
    if (R() < 0.22) continue;
    const r = 4 + R() * 11, e = 0.6 + R() * 0.4, rot = R() * Math.PI * 2, n = 6 + Math.floor(R() * 3);
    const st = station(y), cx = side * (st[1] + r * 0.55 + R() * 6), c = Math.cos(rot), sn = Math.sin(rot);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.5, d = 0.8 + R() * 0.35, u = Math.cos(a) * d * r, v = Math.sin(a) * d * r * e;
      pts.push(cx + u * c - v * sn, y + u * sn + v * c);
    }
    const zt = r * 0.28 + R() * 0.6;
    m.with({ tint: [0.6, 0.86, 1.12] }, () => m.loft([{ pts, z: -1.5 }, { pts, z: zt }], { layer: TL.SNOW, top: false, uv: 6 }));
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += pts[i * 2]; my += pts[i * 2 + 1]; }
    mx /= n; my /= n;
    const inner = pts.map((v, i) => (i & 1 ? my + (v - my) * 0.9 : mx + (v - mx) * 0.9));
    m.with({ tint: [1, 1.02, 1.05] }, () => m.loft([{ pts, z: zt }, { pts: inner, z: zt + 0.5 }], { layer: TL.SNOW, top: TL.SNOW, uv: 8 }));
  }
  return m.finish();
}

/** All 16 doors of a VLS block, closed (one draw while none is moving). */
function vlsDoorsClosed() {
  const m = new TankMesh();
  for (const [cx, cy] of TYPES.vls.cells) {
    const hx = cx > 0 ? cx + 4.4 : cx - 4.4, x = cx > 0 ? hx - 4.4 : hx + 4.4;
    m.with({ tint: [0.95, 0.97, 1] }, () => m.box(x, cy, TYPES.vls.top + 0.15, 8.6, 9.4, 0.9, TL.WBPLATE, { bevel: 0.2 }));
    m.with({ tint: [1.02, 1.04, 1.08] }, () => m.box(x, cy + (cx > 0 ? 1.6 : -1.6), TYPES.vls.top + 1.05, 6, 4, 0.3, TL.SNOW, { bevel: 0.1 }));
  }
  return m.finish();
}

function icePatch() {
  const m = new TankMesh();
  m.with({ tint: [0.82, 0.95, 1.1], em: 0.05 }, () => m.lathe(0, 0, [[1, 0], [0.92, 0.12], [0.5, 0.18], [0, 0.2]], TL.SNOW, { seg: 14, uv: 1 }));
  return m.finish();
}

// ----------------------------------------------------------------- build

/** All parts: name → mesh data. */
export function buildWhiteoutBreaker() {
  const out = {
    sec0: section0(),
    sec1: midSection(1, sec1), sec2: midSection(2, sec2), sec3: midSection(3, sec3), sec4: midSection(4, sec4), sec5: midSection(5, sec5),
    sec6: midSection(6, sec6), sec7: midSection(7, sec7), sec8: midSection(8, sec8), sec9: midSection(9, sec9),
    lights0: lights0(),
    glass8: sectionGlass(), radar: radar(),
    triHouse: turretHouse(24, 16, [-8, 0, 8], { ears: true }), triBarrel: gunBarrel(3.3, 54),
    twinHouse: turretHouse(19, 13, [-6, 6], { ears: true }), twinBarrel: gunBarrel(2.9, 44),
    secHouse: turretHouse(11, 9, [-3.2, 3.2]), secBarrel: gunBarrel(1.6, 28),
    acBase: acBase(), acGun: acGun(), ciwsBase: ciwsBase(), ciwsRotor: ciwsRotor(), flakHouse: flakHouse(), flakGuns: flakGuns(),
    podBase: launcherBase(9, 9), podBox: launcherBox(17, 17, 15, TYPES.pod.muzzles, 1.25, { stripe: true }),
    rarrBase: launcherBase(18, 12), rarrBox: launcherBox(32, 25, 18, TYPES.rarr.muzzles, 1.7, { stripe: true }),
    vlsBlock: vlsBlock(), vlsDoor: vlsDoor(),
    mboxBase: launcherBase(11, 9), mboxBox: launcherBox(16, 27, 15, TYPES.mbox.muzzles, 3, { stripe: true }),
    mortarHouse: mortarHouse(), mortarTube: mortarTube(),
    cryoHouse: cryoHouse(), cryoNozzle: cryoNozzle(), cryoGlow: cryoGlow(),
    beamBase: beamBase(), beamHead: beamHead(), beamGlow: beamGlow(),
    auxBase: auxBase(), auxHead: auxHead(), auxGlow: auxGlow(),
    wreckL: wreckMount(44, 44, 14, 701, 3), wreckM: wreckMount(22, 22, 10, 703, 2), wreckS: wreckMount(12, 12, 8, 705), wreckV: wreckMount(22, 86, 6, 707),
    chunk: chunk(), plate: plateChunk(), shell: shell(), cryoShell: cryoShell(), missile: missile(), spike: spike(),
    floe0: floe(3), floe1: floe(5), floe2: floe(8), icePatch: icePatch(),
  };
  for (let k = 1; k <= 9; k++) out[`lights${k}`] = midLights(k, k === 8 ? lights8extra : k === 9 ? lights9extra : null);
  for (let k = 0; k <= 9; k++) out[`ice${k}`] = trappedIce(k);
  out.vlsDoorsClosed = vlsDoorsClosed();
  return out;
}
