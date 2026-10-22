import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// IRON VEIN — open-pit mining war fortress, built as real 3D parts.
//
// Model space (as White Fang): +y = FORWARD (the cutter, toward the player
// when the nose points down the screen), +x = right as seen from above,
// +z = up; 1 unit ≈ 1 screen unit at the boss's row. Overall ≈ 270 × 440.
//
//   hull        chassis: fore deck (drive housing, thrust rams), mid section
//               (deep-core reactor, ore hoppers), rear power plant (engine
//               house, radiators, exhaust stacks), fenders, walkways, lamps
//   frame       suspension plates and guards of the six track units
//   track{L,R}{0,1,2}  belts of the three track pairs (texture scrolls)
//   wheel       unit road wheel (instanced)
//   carrier     cutter carrier: side frames, hood around the cutter's back,
//               drive shaft, aux-launcher plinths (pivots: lower / raise / thrust)
//   cutter      the rotary cutter head: armoured cone, radial ribs, four rings
//               of carbide picks, red drive hub (spins about its own axis)
//   cyl / rod   hydraulic cylinder barrel and piston rod (unit length, spanned
//               between a hull anchor and a carrier anchor each frame)
//   cannonBase / cannonBarrel   ore cannon (yaws; twin barrels recoil in turn)
//   conveyor / belt   spoil conveyor boom (slews) and its moving belt
//   aux         auxiliary chip launcher (yaws)
//   spike / boulder / chunk   loose rock (seismic spikes, quarry collapse, rubble)
//   *Wreck      destroyed mounts

const PAINT = [1, 1, 1];
const STEEL = [0.92, 0.9, 0.88];
const RED = [1.6, 0.22, 0.08];
const AMBER = [1.5, 0.7, 0.2];
const HOT = [1.5, 0.55, 0.14];

const TILT = 0.73; // cutter axis: forward of vertical (rad)

export const IV = {
  length: [-262, 178], halfW: 126,
  tracks: [
    { x: 106, hw: 20, y0: -6, y1: 96, r: 16 },
    { x: 108, hw: 18, y0: -140, y1: -42, r: 14 },
    { x: 100, hw: 20, y0: -262, y1: -170, r: 15 },
  ],
  cutter: { c: [0, 118, 56], R: 76, tilt: TILT },
  hinge: [0, 30, 40],                       // carrier pivot (hull space)
  cannons: [[-100, -62, 54], [100, -62, 54]],
  cannonBarrels: [[-5.5, 16, 14], [5.5, 16, 14]],
  cannonMuzzle: [0, 64, 0],                 // barrel space
  conveyors: [[-62, -104, 70], [62, -104, 70]],
  convYaw: [1.1, -1.1],                     // rest slew (boom pointing out and forward)
  convDischarge: [0, 86, 30],               // conveyor space
  aux: [[-84, 82, 70], [84, 82, 70]],       // carrier space
  auxMuzzle: [0, 20, 6],
  core: [0, -90, 74],
  stacks: [[-34, -214, 104], [34, -214, 104]],
  pistons: [
    [[-48, 18, 66], [-66, 100, 74]], [[48, 18, 66], [66, 100, 74]],
    [[-74, 26, 32], [-84, 112, 36]], [[74, 26, 32], [84, 112, 36]],
  ],
  lamps: [[-60, 46, 66], [60, 46, 66], [-90, -158, 78], [90, -158, 78], [-30, -238, 92], [30, -238, 92]],
  warn: [[-40, -150, 84], [40, -150, 84], [0, 40, 75], [-74, -30, 64], [74, -30, 64]],
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function octagon(hw, y0, y1, ch) {
  return [-hw + ch, y0, hw - ch, y0, hw, y0 + ch, hw, y1 - ch, hw - ch, y1, -hw + ch, y1, -hw, y1 - ch, -hw, y0 + ch];
}

/** Annular sector shell about the local z axis (hoods, rings): outer wall, top, inner wall. */
function arcShell(m, r0, r1, z0, z1, a0, a1, seg, layer) {
  for (let k = 0; k < seg; k++) {
    const t0 = a0 + (a1 - a0) * (k / seg), t1 = a0 + (a1 - a0) * ((k + 1) / seg);
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    const u0 = k / seg * 3, u1 = (k + 1) / seg * 3;
    m.quad([[c0 * r1, s0 * r1, z0], [c1 * r1, s1 * r1, z0], [c1 * r1, s1 * r1, z1], [c0 * r1, s0 * r1, z1]], [[u0, 0], [u1, 0], [u1, -0.4], [u0, -0.4]], layer, [0, 0, (z0 + z1) / 2]);
    m.quad([[c0 * r0, s0 * r0, z1], [c1 * r0, s1 * r0, z1], [c1 * r1, s1 * r1, z1], [c0 * r1, s0 * r1, z1]], [[u0, 0], [u1, 0], [u1, -0.15], [u0, -0.15]], layer, [(c0 + c1) * r0, (s0 + s1) * r0, z0 - 50]);
    m.quad([[c0 * r0, s0 * r0, z0], [c1 * r0, s1 * r0, z0], [c1 * r0, s1 * r0, z1], [c0 * r0, s0 * r0, z1]], [[u0, 0], [u1, 0], [u1, -0.4], [u0, -0.4]], layer, [(c0 + c1) * r1, (s0 + s1) * r1, (z0 + z1) / 2]);
  }
}

function railing(m, a, b, h = 9) {
  m.with({ tint: [1.1, 0.85, 0.3] }, () => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 18));
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; m.tube([x, y, a[2]], [x, y, a[2] + h], 0.7, TL.BARREL, { seg: 5, uvV: 20 }); }
    m.tube([a[0], a[1], a[2] + h], [b[0], b[1], b[2] + h], 0.7, TL.BARREL, { seg: 5, uvV: 40 });
    m.tube([a[0], a[1], a[2] + h * 0.55], [b[0], b[1], b[2] + h * 0.55], 0.5, TL.BARREL, { seg: 5, uvV: 40 });
  });
}

// ---------------------------------------------------------------- hull

function hull() {
  const m = new TankMesh(), R = rnd(17);
  // Belly between the tracks.
  m.with({ tint: STEEL, ao: [6, 30] }, () => m.box(0, -82, 6, 176, 330, 26, TL.RUSTY, { bevel: 0 }));
  // Fore deck: sloped armour, the drive housing on the centreline.
  m.with({ tint: STEEL, ao: [26, 44] }, () => m.loft([
    { pts: [-86, -44, 86, -44, 86, 30, 74, 44, -74, 44, -86, 30], z: 30 },
    { pts: [-82, -42, 82, -42, 82, 26, 70, 40, -70, 40, -82, 26], z: 52 },
    { pts: [-78, -40, 78, -40, 78, 22, 66, 34, -66, 34, -78, 22], z: 58 },
  ], { layer: TL.RUSTY, uv: 140 }));
  m.with({ tint: PAINT }, () => {
    m.box(0, 8, 58, 54, 52, 12, TL.IVPAINT, { bevel: 2.4, uv: 90 });               // drive housing
    m.lathe(0, 8, [[17, 70], [17, 74], [13, 76]], TL.RUSTY, { seg: 18, uv: 40 });   // gearbox cover
    for (const s of [-1, 1]) {
      m.box(s * 60, -6, 58, 26, 64, 5, TL.RUSTY, { bevel: 1.4, uv: 80 });           // deck plates
      m.box(s * 60, 30, 58, 22, 6, 2.5, TL.IVMARK, { bevel: 0.4, uv: 40 });
    }
  });
  // Thrust rams along the fore deck (cylinders into the carrier).
  m.with({ tint: STEEL }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 30, -30, 66], [s * 30, 28, 66], 5.4, TL.BARREL, { seg: 12, caps: true, capLayer: TL.DARK, uvV: 50 });
      m.box(s * 30, -34, 60, 16, 10, 10, TL.RUSTY, { bevel: 1.2 });
    }
  });
  // Mid section: core module with the deep-core reactor, ore hoppers both sides.
  m.with({ tint: STEEL, ao: [30, 50] }, () => m.loft([
    { pts: [-84, -156, 84, -156, 84, -40, -84, -40], z: 30 },
    { pts: [-80, -154, 80, -154, 80, -42, -80, -42], z: 62 },
    { pts: [-76, -150, 76, -150, 76, -46, -76, -46], z: 68 },
  ], { layer: TL.RUSTY, uv: 140 }));
  m.with({ tint: PAINT }, () => {
    m.loft([{ pts: octagon(34, -128, -52, 10), z: 68 }, { pts: octagon(31, -125, -55, 9), z: 76 }], { layer: TL.RUSTY, uv: 70 });
    m.lathe(0, -90, [[26, 76], [26, 80], [22, 81]], TL.RUSTY, { seg: 20, uv: 50 });
  });
  m.with({ tint: STEEL }, () => {
    m.lathe(0, -90, [[21, 80.5], [21, 81.5]], TL.GRILLE, { seg: 20, topUv: 30 });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m.box(Math.cos(a) * 24, -90 + Math.sin(a) * 24, 80, 4, 4, 3, TL.DARK, { bevel: 0.6, rot: a }); }
    for (const s of [-1, 1]) m.tube([s * 40, -140, 70], [s * 40, -60, 70], 3, TL.BARREL, { seg: 8, uvV: 40 });
  });
  m.with({ tint: RED, em: 1, ao: null }, () => {
    m.lathe(0, -90, [[12, 81.6], [9, 82.4], [0.5, 82.8]], TL.GLOW, { seg: 18, topUv: 26 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; m.box(Math.cos(a) * 17, -90 + Math.sin(a) * 17, 81.2, 5, 1.6, 0.6, TL.GLOW, { bevel: 0, rot: a + Math.PI / 2 }); }
  });
  // Ore hoppers (open bins full of hot crushed ore).
  for (const s of [-1, 1]) {
    m.with({ tint: PAINT }, () => {
      for (const [dx, dy, w, d] of [[-15, 0, 3, 46], [15, 0, 3, 46], [0, -22, 30, 3], [0, 22, 30, 3]]) m.box(s * 58 + dx, -92 + dy, 68, w, d, 12, TL.IVPAINT, { bevel: 0.5, uv: 60 });
    });
    m.with({ tint: [0.9, 0.82, 0.74] }, () => m.box(s * 58, -92, 68, 28, 42, 7, TL.ROCK, { bevel: 2, uv: 40 }));
    m.with({ tint: HOT, em: 0.55, ao: null }, () => { for (let k = 0; k < 7; k++) m.lathe(s * 58 + R() * 18 - 9, -92 + R() * 32 - 16, [[3 + R() * 3, 74], [1.5, 77 + R() * 2]], TL.ROCK, { seg: 6, rot: R() * 6 }); });
  }
  // Rear power plant: engine house, radiators, fans, exhaust stacks.
  m.with({ tint: STEEL, ao: [30, 56] }, () => m.loft([
    { pts: [-82, -268, 82, -268, 82, -158, -82, -158], z: 30 },
    { pts: [-78, -264, 78, -264, 78, -160, -78, -160], z: 76 },
    { pts: [-72, -258, 72, -258, 72, -164, -72, -164], z: 86 },
  ], { layer: TL.RUSTY, uv: 140 }));
  m.with({ tint: PAINT }, () => {
    m.box(0, -184, 86, 120, 30, 8, TL.IVPAINT, { bevel: 1.8, uv: 80 });
    m.box(0, -184, 94, 112, 4, 2, TL.IVMARK, { bevel: 0.3, uv: 50 });
  });
  m.with({ tint: STEEL }, () => {
    for (const s of [-1, 1]) {
      m.box(s * 38, -230, 86, 52, 40, 3, TL.DARK, { bevel: 0.8 });
      m.box(s * 38, -230, 88.6, 46, 34, 1.4, TL.GRILLE, { bevel: 0, uv: 30 });
      m.lathe(s * 38, -230, [[12, 89.5], [12, 90.5]], TL.WHEEL, { seg: 16, topUv: 24 });
      m.tube([s * 34, -210, 84], [s * 34, -214, 104], 6, TL.BARREL, { caps: 'end', capLayer: TL.SCORCH, seg: 12, uvV: 30 });
      m.lathe(s * 34, -212, [[8, 96], [8, 99], [6.5, 100]], TL.DARK, { seg: 12 });
    }
  });
  // Fenders over the six tracks, walkways with railings, ladders.
  for (const T of IV.tracks) {
    for (const s of [-1, 1]) {
      m.with({ tint: PAINT }, () => m.box(s * T.x, (T.y0 + T.y1) / 2, T.r * 2 + 2, T.hw * 2 + 6, T.y1 - T.y0 + 18, 3.2, TL.IVPAINT, { bevel: 1, uv: 70 }));
      m.with({ tint: [1, 1, 1] }, () => m.box(s * (T.x + T.hw + 2), (T.y0 + T.y1) / 2, T.r * 2 - 4, 1.6, T.y1 - T.y0 + 14, 8, TL.IVMARK, { bevel: 0.3, uv: 60 }));
      // Fender braces down to the hull side.
      m.with({ tint: STEEL }, () => { for (const y of [T.y0 + 10, T.y1 - 10]) m.box(s * (T.x - T.hw - 4), y, 18, 6, 6, T.r * 2 - 14, TL.RUSTY, { bevel: 1 }); });
    }
  }
  for (const s of [-1, 1]) {
    railing(m, [s * 84, -150, 68], [s * 84, -50, 68]);
    railing(m, [s * 80, -258, 86], [s * 80, -170, 86]);
    m.with({ tint: STEEL }, () => { for (let k = 0; k < 6; k++) m.box(s * 88, -160 + k * 3.2, 34 + k * 6, 6, 2, 1, TL.DARK, { bevel: 0 }); });
  }
  // Pipe runs and cable trays over the deck.
  m.with({ tint: [0.9, 0.86, 0.82] }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 50, -156, 72], [s * 50, -40, 64], 2.2, TL.BARREL, { seg: 6, uvV: 40 });
      m.tube([s * 54, -156, 72], [s * 54, -40, 64], 1.6, TL.BARREL, { seg: 6, uvV: 40 });
      m.box(s * 70, -200, 86, 8, 60, 3, TL.DARK, { bevel: 0.6 });
    }
  });
  // Bolted armour plates and access hatches scattered over the decks.
  m.with({ tint: PAINT }, () => {
    for (const [x, y, z, w, d] of [[-50, -128, 68, 22, 18], [50, -132, 68, 20, 22], [-58, -60, 68, 18, 16], [56, -64, 68, 20, 14], [0, -150, 76, 30, 8], [-30, 30, 58, 14, 10], [30, 30, 58, 14, 10]]) m.box(x, y, z, w, d, 2.4, TL.IVPAINT, { bevel: 0.9, uv: 50 });
  });
  m.with({ tint: STEEL }, () => {
    for (const [x, y, z] of [[-20, -246, 86], [20, -246, 86], [-62, -20, 58], [62, -20, 58], [0, -40, 68]]) m.lathe(x, y, [[5, z], [5, z + 2], [3.5, z + 2.6]], TL.DARK, { seg: 10 });
  });
  // Warning beacons (red) and work lamps (warm white).
  m.with({ tint: RED, em: 1, ao: null }, () => { for (const [x, y, z] of IV.warn) m.lathe(x, y, [[2.6, z], [2.6, z + 2.4], [1.4, z + 3.4]], TL.GLOW, { seg: 8 }); });
  m.with({ tint: [1.6, 1.3, 0.9], em: 1, ao: null }, () => { for (const [x, y, z] of IV.lamps) m.box(x, y, z, 7, 3, 3, TL.GLOW, { bevel: 0.5 }); });
  // Dust drifts and spilled ore caught on the decks.
  m.with({ tint: [0.85, 0.75, 0.62], ao: null }, () => {
    for (const [x, y, z, r] of [[-70, -150, 68, 7], [72, -48, 68, 6], [-66, 36, 58, 5], [64, -250, 86, 6], [-20, -158, 68, 5], [10, 40, 58, 4]]) m.lathe(x, y, [[r, z], [r * 0.6, z + r * 0.35], [r * 0.2, z + r * 0.5]], TL.ROCK, { seg: 7, rot: R() * 6 });
  });
  return m;
}

// --------------------------------------------------------------- tracks

/** Belt loop (top run + wrapped ends) of track unit T on one side. */
function belt(T, side) {
  const m = new TankMesh(), x0 = side * T.x - T.hw, x1 = side * T.x + T.hw;
  const path = [], N = 8, zc = T.r;
  for (let k = 0; k <= N; k++) { const a = -Math.PI / 2 - (k / N) * Math.PI; path.push([T.y0 + Math.cos(a) * T.r, zc + Math.sin(a) * T.r]); }
  path.push([T.y1, zc + T.r]);
  for (let k = 1; k <= N; k++) { const a = Math.PI / 2 - (k / N) * Math.PI; path.push([T.y1 + Math.cos(a) * T.r, zc + Math.sin(a) * T.r]); }
  let s = 0;
  m.with({ tint: [1, 1, 1], ao: null }, () => {
    for (let k = 0; k < path.length - 1; k++) {
      const [ya, za] = path[k], [yb, zb] = path[k + 1], l = Math.hypot(yb - ya, zb - za);
      const ny = (zb - za) / l, nz = -(yb - ya) / l;
      const v0 = -s / 72, v1 = -(s + l) / 72;
      const ids = [
        m.vert(x0, ya, za, 0, -ny, -nz, 0, v0, TL.IVTRACK), m.vert(x1, ya, za, 0, -ny, -nz, 1, v0, TL.IVTRACK),
        m.vert(x1, yb, zb, 0, -ny, -nz, 1, v1, TL.IVTRACK), m.vert(x0, yb, zb, 0, -ny, -nz, 0, v1, TL.IVTRACK),
      ];
      m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]);
      s += l;
    }
  });
  return m;
}

function frame() {
  const m = new TankMesh();
  m.with({ tint: [0.86, 0.82, 0.78], ao: [2, 20] }, () => {
    for (const T of IV.tracks) {
      for (const s of [-1, 1]) {
        for (const x of [s * (T.x + T.hw + 0.6), s * (T.x - T.hw - 0.6)]) {
          const p = [[x, T.y0 + 4, 5], [x, T.y1 - 4, 5], [x, T.y1 - 8, T.r * 2 - 6], [x, T.y0 + 8, T.r * 2 - 6]];
          m.quad(p, [[0, 0], [3, 0], [3, 0.3], [0, 0.3]], TL.RUSTY, [s * T.x, (T.y0 + T.y1) / 2, T.r]);
        }
        // Return-roller brackets along the top run.
        for (let y = T.y0 + 24; y < T.y1 - 16; y += 32) m.box(s * (T.x + T.hw + 2), y, T.r * 2 - 10, 3, 6, 7, TL.DARK, { bevel: 0.5 });
      }
    }
  });
  return m;
}

/** Wheel positions along a track unit (sprocket, road wheels, idler). */
export function wheelsOf(T) {
  const n = Math.max(4, Math.round((T.y1 - T.y0) / 22));
  const out = [];
  for (let k = 0; k <= n; k++) out.push(T.y0 + (T.y1 - T.y0) * (k / n));
  return out;
}

function wheel() {
  const m = new TankMesh();
  m.with({ tint: [0.78, 0.7, 0.6] }, () => m.tube([0, 0, 0], [1, 0, 0], 1, TL.RUSTY, { caps: 'end', capLayer: TL.WHEEL, seg: 14, uvV: 4 }));
  return m;
}

// -------------------------------------------------------------- cutter

/** Cutter carrier (hull-space coordinates; the rig pivots it about IV.hinge). */
function carrier() {
  const m = new TankMesh(), C = IV.cutter, R = C.R;
  const cs = Math.cos(C.tilt), sn = Math.sin(C.tilt);
  // Side frames holding the cutter axle.
  m.with({ tint: STEEL, ao: [6, 30] }, () => {
    for (const s of [-1, 1]) {
      m.loft([
        { pts: [s * 80, 34, s * 92, 34, s * 92, 138, s * 80, 146], z: 10 },
        { pts: [s * 80, 34, s * 92, 34, s * 92, 128, s * 80, 136], z: 60 },
        { pts: [s * 81, 36, s * 91, 36, s * 91, 120, s * 81, 126], z: 68 },
      ], { layer: TL.RUSTY, uv: 100 });
      m.box(s * 86, 70, 68, 14, 40, 3, TL.IVMARK, { bevel: 0.4, uv: 40 });
      // Axle boss on the inside of each frame.
      m.tube([s * 80, C.c[1] - 6 * cs, C.c[2] - 6 * sn], [s * 72, C.c[1] - 6 * cs, C.c[2] - 6 * sn], 12, TL.DARK, { seg: 14, caps: 'end', capLayer: TL.WHEEL, uvV: 20 });
    }
  });
  m.with({ tint: PAINT }, () => {
    for (const s of [-1, 1]) {
      m.box(s * 86, 104, 60, 16, 30, 9, TL.IVPAINT, { bevel: 1.6, uv: 60 });         // aux plinth
      m.box(s * 86, 50, 64, 16, 20, 5, TL.IVPAINT, { bevel: 1.2, uv: 60 });
    }
    // Cross beam behind the hood.
    m.box(0, 44, 54, 168, 16, 14, TL.IVPAINT, { bevel: 2, uv: 90 });
  });
  // Drive shaft housing from the deck to the cutter's back.
  m.with({ tint: STEEL }, () => {
    m.tube([0, 30, 50], [0, C.c[1] - 30 * sn, C.c[2] - 30 * cs], 16, TL.RUSTY, { seg: 16, uvV: 40 });
    for (const s of [-1, 1]) m.tube([s * 76, 60, 30], [s * 40, C.c[1] - 26 * sn, C.c[2] - 26 * cs], 4, TL.BARREL, { seg: 8, uvV: 30 });
  });
  return m;
}

/** Hood over the back of the cutter, built in cutter space (static: doesn't spin). */
function hood() {
  const m = new TankMesh(), R = IV.cutter.R;
  m.with({ tint: STEEL, ao: null }, () => {
    arcShell(m, R + 3, R + 12, -34, 4, Math.PI * 1.08, Math.PI * 1.92, 14, TL.RUSTY);
    arcShell(m, R + 12, R + 15, -30, 0, Math.PI * 1.12, Math.PI * 1.88, 12, TL.IVPAINT);
    // Back drum (closed, hidden mostly by the cone in front of it).
    m.lathe(0, 0, [[R - 2, -30], [R - 2, -6]], TL.DARK, { seg: 28, top: false, uv: 60 });
  });
  // Hazard lip along the hood's front edge.
  m.with({ tint: [1, 1, 1] }, () => {
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * (1.12 + 0.76 * (k + 0.5) / 10), c = Math.cos(a), s = Math.sin(a);
      m.box(c * (R + 9), s * (R + 9), 4, 9, 4, 1.2, TL.IVMARK, { bevel: 0.2, rot: a + Math.PI / 2, uv: 30 });
    }
  });
  return m;
}

/** The rotary cutter head in its own space: disc in xy, face toward +z. */
function cutter() {
  const m = new TankMesh(), R = IV.cutter.R, Rr = rnd(5);
  const cone = (r) => 28 * (1 - r / R) + 2; // face height at radius r
  // Armoured cone of plates.
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[R, -6], [R, 2], [R * 0.78, cone(R * 0.78)], [R * 0.5, cone(R * 0.5)], [R * 0.26, cone(R * 0.26)], [R * 0.2, cone(R * 0.2)]], TL.RUSTY, { seg: 24, uv: 70 }));
  // Outer gauge ring (wear band).
  m.with({ tint: [0.85, 0.8, 0.74] }, () => m.lathe(0, 0, [[R + 2, -6], [R + 2, 3], [R - 2, 4.5]], TL.DARK, { seg: 28, top: false, uv: 50 }));
  // Hot internals glowing through the vents between the ribs.
  m.with({ tint: RED, em: 0.85, ao: null }, () => {
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) / 8) * Math.PI * 2, r = R * 0.62;
      m.box(Math.cos(a) * r, Math.sin(a) * r, cone(r) - 0.6, 3.2, 13, 1.8, TL.GLOW, { bevel: 0, rot: a + Math.PI / 2 });
    }
  });
  // Radial ribs (cutting arms): dark steel, every other one with a worn ochre face.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    m.with({ tint: k & 1 ? PAINT : STEEL }, () => m.tube([c * R * 0.22, s * R * 0.22, cone(R * 0.22) + 2.5], [c * (R - 3), s * (R - 3), cone(R - 3) + 2.5], 4.2, k & 1 ? TL.IVPAINT : TL.RUSTY, { seg: 6, uvV: 50 }));
  }
  // Picks: holder block + carbide cone, pointing out of the face and leaning
  // into the direction of rotation.
  const rings = [[R * 0.95, 16, 15], [R * 0.74, 13, 13], [R * 0.52, 10, 11.5], [R * 0.32, 7, 10]];
  for (let j = 0; j < rings.length; j++) {
    const [r, n, L] = rings[j];
    for (let k = 0; k < n; k++) {
      const a = ((k + j * 0.5) / n) * Math.PI * 2 + Rr() * 0.05, c = Math.cos(a), s = Math.sin(a);
      const out = j === 0 ? 0.85 : 0.42, up = j === 0 ? 0.55 : 0.88, lean = 0.35;
      let dx = c * out - s * lean, dy = s * out + c * lean, dz = up;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const base = [c * r, s * r, cone(r) + 1];
      const mid = [base[0] + dx * 5, base[1] + dy * 5, base[2] + dz * 5];
      const tip = [base[0] + dx * L, base[1] + dy * L, base[2] + dz * L];
      m.with({ tint: STEEL }, () => m.tube(base, mid, 3.4, TL.DARK, { seg: 6, caps: 'end', uvV: 10 }));
      m.with({ tint: [1, 1, 1] }, () => m.tube(mid, tip, 2.5, TL.CARBIDE, { r1: 0.3, seg: 7, uvV: L - 5 }));
    }
  }
  // Drive hub: armoured boss with the red core eye.
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[R * 0.22, cone(R * 0.22)], [18, 34], [15, 38], [10, 40]], TL.DARK, { seg: 18, uv: 30 }));
  m.with({ tint: PAINT }, () => { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.box(Math.cos(a) * 14, Math.sin(a) * 14, 36, 5, 5, 3.4, TL.IVPAINT, { bevel: 0.8, rot: a }); } });
  m.with({ tint: RED, em: 1, ao: null }, () => {
    m.lathe(0, 0, [[9.5, 39.8], [7, 41.2], [0.5, 42]], TL.GLOW, { seg: 18, topUv: 20 });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; m.box(Math.cos(a) * 21, Math.sin(a) * 21, cone(21) + 0.2, 2.6, 2.6, 1, TL.GLOW, { bevel: 0, rot: a }); }
  });
  return m;
}

/** Unit hydraulic cylinder along +y (0..1), radius 1 (scaled per instance). */
function cyl() {
  const m = new TankMesh();
  m.with({ tint: [0.95, 0.85, 0.5] }, () => m.tube([0, 0, 0], [0, 1, 0], 1, TL.IVPAINT, { seg: 10, caps: true, capLayer: TL.DARK, uvV: 1, uvU: 1 }));
  return m;
}

function rod() {
  const m = new TankMesh();
  m.with({ tint: [1.15, 1.15, 1.15] }, () => m.tube([0, 0, 0], [0, 1, 0], 1, TL.CARBIDE, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 1 }));
  return m;
}

// --------------------------------------------------------------- weapons

function cannonBase() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[20, -2], [20, 3], [18, 4.5]], TL.RUSTY, { seg: 18 }));
  m.with({ tint: PAINT, ao: [0, 8] }, () => m.loft([
    { pts: octagon(17, -20, 22, 6), z: 3 },
    { pts: octagon(16, -18, 20, 5.5), z: 18 },
    { pts: octagon(14, -15, 17, 4.5), z: 23 },
  ], { layer: TL.IVPAINT, uv: 50 }));
  m.with({ tint: STEEL }, () => {
    m.box(0, 18, 6, 26, 9, 15, TL.DARK, { bevel: 1.6 });                            // mantlet
    m.box(0, -22, 18, 14, 14, 9, TL.RUSTY, { bevel: 1 });                           // ore feed hopper
    m.tube([0, -16, 24], [0, -2, 23], 4, TL.BARREL, { seg: 8, uvV: 20 });           // feed chute
    m.box(-11, -6, 23, 7, 10, 3, TL.DARK, { bevel: 0.6 });                           // sight
  });
  m.with({ tint: [1, 1, 1] }, () => m.box(0, -14, 23, 22, 3, 0.8, TL.IVMARK, { bevel: 0.2, uv: 30 }));
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(-11, 0, 26, 3, 2, 1, TL.GLOW, { bevel: 0 }));
  return m;
}

/** One ore-cannon barrel in its own space: breech at y=0, muzzle at IV.cannonMuzzle. */
function cannonBarrel() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.box(0, 4, -4.5, 9, 10, 9, TL.RUSTY, { bevel: 1 });
    m.tube([0, 6, 0], [0, 54, 0], 3.8, TL.BARREL, { seg: 12, uvV: 30 });
    for (const y of [20, 34]) m.tube([0, y, 0], [0, y + 3, 0], 4.8, TL.DARK, { seg: 12, uvV: 10 });
    m.tube([0, 52, 0], [0, 64, 0], 5.6, TL.DARK, { seg: 12, caps: 'end', capLayer: TL.SCORCH, uvV: 12 });
    for (const y of [56, 60]) m.box(0, y, -1.5, 13, 1.4, 3, TL.DARK, { bevel: 0.2 });
  });
  return m;
}

/** Spoil conveyor: slewing turntable, inclined boom truss, rollers, head chute (local +y = boom). */
function conveyor() {
  const m = new TankMesh(), D = IV.convDischarge;
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[17, -2], [17, 4], [14, 5.5]], TL.RUSTY, { seg: 16 }));
  m.with({ tint: PAINT }, () => {
    m.box(0, -2, 5, 26, 24, 12, TL.IVPAINT, { bevel: 1.4, uv: 50 });                // receiving hopper
    m.box(0, -2, 17, 30, 28, 2, TL.IVPAINT, { bevel: 0.5, uv: 50 });
  });
  const z = (y) => 12 + (y / D[1]) * (D[2] - 12);
  m.with({ tint: [1.0, 0.9, 0.7] }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 9, 4, z(4) - 2], [s * 9, D[1], z(D[1]) - 2], 1.6, TL.IVPAINT, { seg: 6, uvV: 40 });   // top chord
      m.tube([s * 9, 8, z(8) - 10], [s * 9, D[1] - 6, z(D[1]) - 10], 1.4, TL.IVPAINT, { seg: 6, uvV: 40 }); // bottom chord
      for (let y = 10; y < D[1] - 6; y += 12) m.tube([s * 9, y, z(y) - 10], [s * 9, y + 12, z(y + 12) - 2], 0.9, TL.IVPAINT, { seg: 5, uvV: 20 });
      m.quad([[s * 7.6, 4, z(4)], [s * 7.6, D[1], z(D[1])], [s * 7.6, D[1], z(D[1]) + 3.2], [s * 7.6, 4, z(4) + 3.2]], [[0, 0], [3, 0], [3, -0.1], [0, -0.1]], TL.RUSTY, [0, D[1] / 2, z(D[1] / 2) + 1]);
    }
    for (let y = 8; y < D[1] - 2; y += 9) m.tube([-7, y, z(y) - 0.5], [7, y, z(y) - 0.5], 1.2, TL.BARREL, { seg: 6, uvV: 10 });
  });
  // Head pulley + discharge chute, support strut.
  m.with({ tint: STEEL }, () => {
    m.tube([-9, D[1], D[2] - 1], [9, D[1], D[2] - 1], 4, TL.DARK, { seg: 12, caps: true, capLayer: TL.WHEEL, uvV: 10 });
    m.loft([{ pts: [-8, D[1] + 2, 8, D[1] + 2, 8, D[1] + 10, -8, D[1] + 10], z: D[2] - 8 }, { pts: [-6, D[1] + 4, 6, D[1] + 4, 6, D[1] + 8, -6, D[1] + 8], z: D[2] + 4 }], { layer: TL.RUSTY, uv: 30 });
    m.tube([0, 0, 4], [0, D[1] * 0.55, z(D[1] * 0.55) - 10], 2.4, TL.BARREL, { seg: 8, uvV: 30 });
  });
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(0, D[1] + 6, D[2] + 4.2, 4, 2, 1.2, TL.GLOW, { bevel: 0 }));
  return m;
}

/** The moving belt surface of a conveyor (texture scrolls along v). */
function convBelt() {
  const m = new TankMesh(), D = IV.convDischarge;
  const z = (y) => 12 + (y / D[1]) * (D[2] - 12) + 1.2;
  m.with({ tint: [1, 1, 1], ao: null }, () => m.quad([[-6.5, 4, z(4)], [6.5, 4, z(4)], [6.5, D[1], z(D[1])], [-6.5, D[1], z(D[1])]], [[0, 0], [1, 0], [1, -(D[1] - 4) / 60], [0, -(D[1] - 4) / 60]], TL.BELT));
  return m;
}

/** Auxiliary chip launcher: four-tube pod on a yaw ring (local +y = barrels). */
function aux() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[9, -1], [9, 3]], TL.RUSTY, { seg: 12 }));
  m.with({ tint: PAINT }, () => m.box(0, 4, 2, 18, 22, 11, TL.IVPAINT, { bevel: 1.4, uv: 40 }));
  m.with({ tint: STEEL }, () => {
    for (const x of [-4.2, 4.2]) for (const zz of [5, 10]) m.tube([x, 12, zz], [x, 20, zz], 2.4, TL.BARREL, { seg: 8, caps: 'end', capLayer: TL.SCORCH, uvV: 8 });
  });
  m.with({ tint: [1, 1, 1] }, () => m.box(0, -2, 13, 14, 3, 0.6, TL.IVMARK, { bevel: 0.1, uv: 30 }));
  return m;
}

// ------------------------------------------------------------------ rock

/** Faceted rock lump on the ground (unit size: radius 1, height ~1). */
function lump(seed, sharp = 0) {
  const m = new TankMesh(), R = rnd(seed);
  const seg = 7, rings = sharp ? [[1, 0], [0.75, 0.45], [0.4, 1.1], [0.08, 2.2]] : [[1, 0], [0.92, 0.35], [0.6, 0.8], [0.15, 1]];
  m.with({ tint: [1, 1, 1], ao: [0, 0.6] }, () => {
    const ringsPts = rings.map(([r, z], j) => {
      const pts = [];
      for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2 + j * 0.4, rr = r * (0.75 + R() * 0.45); pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      return { pts, z };
    });
    m.loft(ringsPts, { layer: TL.ROCK, uv: 1.2, topUv: 1.2 });
  });
  return m;
}

// ----------------------------------------------------------------- wrecks

function cannonWreck() {
  const m = new TankMesh(), R = rnd(29);
  m.with({ tint: [1, 1, 1] }, () => {
    m.lathe(0, 0, [[19, -2], [18, 3], [12, 6]], TL.SCORCH, { seg: 10 });
    m.box(2, 2, 3, 22, 26, 8, TL.SCORCH, { bevel: 2, rot: 0.3 });
    for (let k = 0; k < 2; k++) m.tube([k * 8 - 4, 10, 6], [k * 14 - 8 + R() * 6, 40 + R() * 10, 2 + R() * 8], 3.2, TL.SCORCH, { seg: 7, uvV: 10 });
  });
  return m;
}

function convWreck() {
  const m = new TankMesh(), D = IV.convDischarge;
  m.with({ tint: [1, 1, 1] }, () => {
    m.lathe(0, 0, [[16, -2], [15, 4]], TL.SCORCH, { seg: 10 });
    m.box(0, -2, 4, 26, 24, 9, TL.SCORCH, { bevel: 1.2, rot: 0.15 });
    // The boom has buckled and dropped onto the deck.
    for (const s of [-1, 1]) m.tube([s * 9, 4, 10], [s * 12 + 6, D[1] * 0.7, -4], 1.6, TL.SCORCH, { seg: 6, uvV: 20 });
    m.box(4, D[1] * 0.4, 0, 14, 40, 3, TL.SCORCH, { bevel: 0.5, rot: 0.25 });
  });
  return m;
}

/** Shattered drive hub (drawn over the cutter once the drive is destroyed). */
function hubWreck() {
  const m = new TankMesh(), R = rnd(41);
  m.with({ tint: [1, 1, 1] }, () => {
    m.lathe(0, 0, [[24, 20], [20, 30], [12, 33], [6, 30]], TL.SCORCH, { seg: 9 });
    for (let k = 0; k < 6; k++) { const a = R() * 6.28; m.tube([Math.cos(a) * 8, Math.sin(a) * 8, 30], [Math.cos(a) * 20, Math.sin(a) * 20, 36 + R() * 8], 2 + R() * 2, TL.SCORCH, { seg: 5, uvV: 8 }); }
  });
  return m;
}

/** Build every part once (pure data, reusable across GL contexts). */
export function buildIronVein() {
  const out = {
    hull: hull(), frame: frame(), wheel: wheel(), carrier: carrier(), hood: hood(), cutter: cutter(),
    cyl: cyl(), rod: rod(), cannonBase: cannonBase(), cannonBarrel: cannonBarrel(), conveyor: conveyor(), belt: convBelt(), aux: aux(),
    boulder: lump(3), boulder2: lump(9), spike: lump(21, 1), chunk: lump(33),
    cannonWreck: cannonWreck(), convWreck: convWreck(), hubWreck: hubWreck(),
  };
  IV.tracks.forEach((T, k) => { out[`trackL${k}`] = belt(T, -1); out[`trackR${k}`] = belt(T, 1); });
  return Object.fromEntries(Object.entries(out).map(([k, m]) => [k, m.finish()]));
}
