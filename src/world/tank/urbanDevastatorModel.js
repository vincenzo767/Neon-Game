import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// URBAN DEVASTATOR — armoured pursuit supercar, built as real 3D parts.
//
// Model space (as the other 3D bosses): +y = FORWARD (the nose), +x = right
// as seen from above, +z = up; ground contact at z = 0. ≈ 180 × 338 units
// (blades to ±112). The rig drives it nose-up the screen, so the camera (and
// the pursuing pilot) look at its REAR: turbine, thrusters, diffuser, rear
// guns, taillights, the fat rear tyres.
//
//   body        armoured tub lofted along y: low pointed nose, layered hood,
//               waist, rear deck; side skirts with intakes; splitter; rear
//               face with the turbine housing, diffuser fins, valance
//   fenders     muscular rear haunches and front wings over the wheel arches
//   canopy      smoked teardrop cockpit glazing
//   spine       carbon ridge + intake scoop behind the cockpit
//   wing        rear wing: two elements on swan-neck pylons, endplates
//   blades      swept side aero blades (with red edge strips)
//   tail        red emissive: taillight bars, chevrons, side strips, gun ports
//   cyan        cyan emissive: turbine ring, thruster rings, vent slits
//   head        white emissive headlight slits (nose)
//   fan / core  turbine fan (spins about local y) and its glowing core
//   wheelF/R    tyre (tread) + alloy face; pivot = axle centre, axis = local x
//   link / coil suspension wishbone (unit length) and coil-over (spanned)
//   rearGunBase / rearBarrel     rear quarter cannon (yaw; twin barrels recoil)
//   sideGunBase / rotor          rotary cannon on the waist (deploys, yaws; barrels spin)
//   podBase / podCover           missile launcher (6 tubes) and its hinged cover
//   *Wreck      destroyed mounts

const PAINT = [1, 1, 1];
const DARK = [0.8, 0.82, 0.86];
const RED = [2.2, 0.12, 0.16];
const CYAN = [0.3, 1.6, 2.4];
const HOT = [2.4, 0.9, 0.35];
const WHITE = [2.2, 2.2, 2.4];

export const UD = {
  length: [-160, 178], halfW: 95, bladeW: 110,
  wheels: [
    { x: -74, y: 92, r: 23, w: 26, front: true }, { x: 74, y: 92, r: 23, w: 26, front: true },
    { x: -78, y: -96, r: 26, w: 34, front: false }, { x: 78, y: -96, r: 26, w: 34, front: false },
  ],
  wheelbase: 188,
  rearGuns: [[-64, -126, 54], [64, -126, 54]],
  rearBarrels: [[-4.6, 4, 5.5], [4.6, 4, 5.5]],     // mount space; barrels run along +y
  rearMuzzle: [0, 38, 0],                             // barrel space
  sideGuns: [[-82, -58, 27], [82, -58, 27]],
  sideRest: [2.36, -2.36],                            // rest yaw (outward / back)
  sideRotor: [0, 12, 8],                              // rotor pivot in mount space
  sideMuzzle: [0, 30, 0],                             // rotor space
  pods: [[-38, -74, 50], [38, -74, 50]],
  podPitch: 0.95,                                     // tubes point back and up
  podTubes: [[-6.5, 0, -4], [0, 0, -4], [6.5, 0, -4], [-6.5, 0, 4], [0, 0, 4], [6.5, 0, 4]], // pod space (x, -, z)
  podMuzzle: 14,                                      // tube mouth along +y (pod space)
  turbine: { c: [0, -152, 30], r: 21, housing: 27 },
  exhausts: [[-44, -156, 14], [-58, -154, 19], [44, -156, 14], [58, -154, 19]],
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/**
 * Loft along y: sections [{ y, pts: [x, z, x, z, ...] }] (same count, ring in
 * the xz plane). Flat quads with normals away from the section centroid;
 * u runs around the ring, v along y. o: { layer, uv, cap0 (layer: cap the
 * first section), cap1, sides: [per-edge layer], mirror (also build x → −x) }.
 */
function loftY(m, sections, o) {
  if (o.smooth) { loftSmooth(m, sections, o); return; }
  const n = sections[0].pts.length / 2, uv = o.uv || 96;
  const build = (sx) => {
    const P = (s, k) => [s.pts[k * 2] * sx, s.y, s.pts[k * 2 + 1]];
    const cen = (s) => { let x = 0, z = 0; for (let k = 0; k < n; k++) { x += s.pts[k * 2] * sx; z += s.pts[k * 2 + 1]; } return [x / n, s.y, z / n]; };
    for (let j = 0; j < sections.length - 1; j++) {
      const A = sections[j], B = sections[j + 1], ca = cen(A), cb = cen(B), mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
      let u = 0;
      for (let k = 0; k < n; k++) {
        const q = (k + 1) % n;
        if (o.open && q === 0) break;
        const a0 = P(A, k), a1 = P(A, q), b0 = P(B, k), b1 = P(B, q);
        const el = Math.hypot(a1[0] - a0[0], a1[2] - a0[2]);
        const v0 = -A.y / uv, v1 = -B.y / uv;
        m.quad([a0, a1, b1, b0], [[u / uv, v0], [(u + el) / uv, v0], [(u + el) / uv, v1], [u / uv, v1]], (o.sides && o.sides[k]) ?? o.layer, mid);
        u += el;
      }
    }
    const cap = (s, layer, dir) => {
      const c = cen(s), ids = [];
      for (let k = 0; k < n; k++) { const p = P(s, k); ids.push(m.vert(p[0], p[1], p[2], 0, dir, 0, p[0] / uv, -p[2] / uv, layer)); }
      const cc = m.vert(c[0], c[1], c[2], 0, dir, 0, c[0] / uv, -c[2] / uv, layer);
      for (let k = 0; k < n; k++) m.tri(cc, ids[k], ids[(k + 1) % n]);
    };
    if (o.cap0 !== undefined) cap(sections[0], o.cap0, -1);
    if (o.cap1 !== undefined) cap(sections[sections.length - 1], o.cap1, 1);
  };
  build(1);
  if (o.mirror) build(-1);
}

/** loftY with smooth vertex normals (averaged over the adjacent faces), closed rings. */
function loftSmooth(m, sections, o) {
  const n = sections[0].pts.length / 2, S = sections.length, uv = o.uv || 96;
  const P = (j, k) => { const s = sections[j], q = ((k % n) + n) % n; return [s.pts[q * 2], s.y, s.pts[q * 2 + 1]]; };
  const cen = (j) => { const s = sections[j]; let x = 0, z = 0; for (let k = 0; k < n; k++) { x += s.pts[k * 2]; z += s.pts[k * 2 + 1]; } return [x / n, s.y, z / n]; };
  // Face normals (oriented away from the local centroid).
  const fn = [];
  for (let j = 0; j < S - 1; j++) {
    const ca = cen(j), cb = cen(j + 1), mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
    const row = [];
    for (let k = 0; k < n; k++) {
      const a0 = P(j, k), a1 = P(j, k + 1), b0 = P(j + 1, k);
      const ux = a1[0] - a0[0], uy = a1[1] - a0[1], uz = a1[2] - a0[2], vx = b0[0] - a0[0], vy = b0[1] - a0[1], vz = b0[2] - a0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const fc = [(a0[0] + a1[0] + b0[0]) / 3, (a0[1] + a1[1] + b0[1]) / 3, (a0[2] + a1[2] + b0[2]) / 3];
      if (nx * (fc[0] - mid[0]) + ny * (fc[1] - mid[1]) + nz * (fc[2] - mid[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      row.push([nx / l, ny / l, nz / l]);
    }
    fn.push(row);
  }
  const ids = [];
  for (let j = 0; j < S; j++) {
    const row = [];
    let u = 0;
    for (let k = 0; k <= n; k++) {
      let nx = 0, ny = 0, nz = 0;
      for (const jj of [j - 1, j]) for (const kk of [k - 1, k]) {
        if (jj < 0 || jj >= S - 1) continue;
        const f = fn[jj][((kk % n) + n) % n]; nx += f[0]; ny += f[1]; nz += f[2];
      }
      const l = Math.hypot(nx, ny, nz) || 1, p = P(j, k);
      if (k) { const q = P(j, k - 1); u += Math.hypot(p[0] - q[0], p[2] - q[2]); }
      row.push(m.vert(p[0], p[1], p[2], nx / l, ny / l, nz / l, u / uv, -p[1] / uv, o.layer));
    }
    ids.push(row);
  }
  for (let j = 0; j < S - 1; j++) for (let k = 0; k < n; k++) { const a = ids[j][k], b = ids[j][k + 1], c = ids[j + 1][k + 1], d = ids[j + 1][k]; m.tri(a, b, c); m.tri(a, c, d); }
  const cap = (j, layer, dir) => {
    const c = cen(j), rid = [];
    for (let k = 0; k < n; k++) { const p = P(j, k); rid.push(m.vert(p[0], p[1], p[2], 0, dir, 0, p[0] / uv, -p[2] / uv, layer)); }
    const cc = m.vert(c[0], c[1], c[2], 0, dir, 0, c[0] / uv, -c[2] / uv, layer);
    for (let k = 0; k < n; k++) m.tri(cc, rid[k], rid[(k + 1) % n]);
  };
  if (o.cap0 !== undefined) cap(0, o.cap0, -1);
  if (o.cap1 !== undefined) cap(S - 1, o.cap1, 1);
}

/** Symmetric 10-point body ring (rounded): [wb, zb, ws, zs, wt, zt, wc, zc] → x/z ring. */
function ring8(y, [wb, zb, ws, zs, wt, zt, wc, zc]) {
  const wm = (ws + wt) / 2 + 2, zm = (zs + zt) / 2 + 1.5;
  return { y, pts: [-wb, zb, -ws, zs, -wm, zm, -wt, zt, -wc, zc, wc, zc, wt, zt, wm, zm, ws, zs, wb, zb] };
}

/** Flat plate polygon (xy outline) between z0 and z1. */
function plate(m, pts, z0, z1, layer, sideLayer = layer) {
  m.loft([{ pts, z: z0 }, { pts, z: z1 }], { layer: sideLayer, top: layer, bottom: layer, uv: 60 });
}

/** Sloped thin slab following the bodywork: x0..x1 across, y0 → y1 along, top z from za to zb, thickness t. */
function slab(m, x0, x1, y0, y1, za, zb, t, layer, sideLayer = TL.DARK, taper = 0) {
  loftY(m, [
    { y: y0, pts: [x0, za - t, x1, za - t, x1, za, x0, za] },
    { y: y1, pts: [x0 + taper, zb - t, x1 - taper, zb - t, x1 - taper, zb, x0 + taper, zb] },
  ], { layer: sideLayer, sides: [sideLayer, sideLayer, layer, sideLayer], uv: 60, cap0: sideLayer, cap1: sideLayer });
}

/** Rounded fender ring (7 points) for side s: lower edge zb, outer xo, top zt. */
function fring(y, s, xo, zb, zt, xi = 50) {
  return { y, pts: [s * xi, zb, s * xo, zb, s * (xo + 2), zb + (zt - zb) * 0.45, s * (xo - 3), zb + (zt - zb) * 0.82, s * (xo - 12), zt, s * (xi + 14), zt - 0.5, s * xi, zt - 3] };
}

// ---------------------------------------------------------------- body

function body() {
  const m = new TankMesh();
  // Low armoured tub between the fenders: a long wedge from the turbine to the pointed nose.
  m.with({ tint: PAINT, ao: [4, 18] }, () => loftY(m, [
    ring8(-156, [56, 10, 62, 28, 52, 36, 18, 38]),
    ring8(-134, [58, 7, 68, 29, 56, 39, 20, 42]),
    ring8(-96, [58, 6, 69, 29, 55, 40, 18, 44]),
    ring8(-46, [56, 6, 70, 28, 52, 37, 20, 40]),
    ring8(10, [54, 6, 70, 27, 50, 34, 20, 37]),
    ring8(60, [52, 6, 66, 25, 46, 30.5, 16, 32.5]),
    ring8(110, [44, 6, 58, 20, 38, 25, 12, 26.5]),
    ring8(150, [26, 6, 34, 13.5, 22, 17, 7, 18]),
    ring8(176, [6, 7, 8, 9, 5, 10.5, 2, 11]),
  ], { layer: TL.CARPAINT, uv: 110, cap0: TL.CARBON, cap1: TL.CARPAINT, smooth: true }));
  // Layered hood armour: angular plates stepping down to the nose, a raised centre ridge.
  m.with({ tint: PAINT }, () => {
    for (const s of [-1, 1]) {
      slab(m, s > 0 ? 16 : -44, s > 0 ? 44 : -16, 64, 128, 33.4, 27.6, 2, TL.CARPAINT, TL.SILVER, 4);
      slab(m, s > 0 ? 8 : -30, s > 0 ? 30 : -8, 120, 160, 28, 18.6, 1.6, TL.CARBON, TL.DARK, 6);
      slab(m, s > 0 ? 50 : -66, s > 0 ? 66 : -50, 0, 60, 35.2, 31.4, 1.6, TL.SILVER, TL.DARK, 2);
      m.with({ tint: [0.5, 0.5, 0.54] }, () => slab(m, s > 0 ? 26 : -50, s > 0 ? 50 : -26, -120, -96, 42.4, 42.4, 1.4, TL.GRILLE, TL.DARK));
    }
    slab(m, -6, 6, 40, 150, 34, 19, 3, TL.CARPAINT, TL.SILVER, 2);           // centre ridge
    m.with({ tint: [0.5, 0.5, 0.54] }, () => slab(m, -12, 12, 76, 112, 32.6, 28.8, 1.2, TL.GRILLE, TL.DARK)); // hood vent
    plate(m, [-30, 156, 30, 156, 12, 186, -12, 186], 2, 5, TL.CARBON);         // splitter
    for (const s of [-1, 1]) plate(m, [s * 30, 150, s * 46, 140, s * 50, 148, s * 34, 162], 3, 5, TL.CARBON); // canards
  });
  // Side skirts with intakes between the wheels.
  m.with({ tint: DARK, ao: [4, 16] }, () => {
    for (const s of [-1, 1]) {
      loftY(m, [
        { y: -66, pts: [s * 64, 4, s * 82, 4, s * 82, 15, s * 76, 22, s * 64, 23] },
        { y: 60, pts: [s * 62, 4, s * 80, 4, s * 80, 14, s * 74, 20, s * 62, 21] },
      ], { layer: TL.CARBON, uv: 60, cap0: TL.CARBON, cap1: TL.CARBON });
      plate(m, [s * 72, -36, s * 81, -36, s * 80.6, 36, s * 72, 36], 8, 17, TL.GRILLE, TL.DARK);
    }
  });
  // Rear face: turbine housing (a barrel rising out of the deck), lip, throat, diffuser fins, valance.
  const T = UD.turbine;
  m.with({ tint: PAINT }, () => m.tube([0, -104, T.c[2]], [0, -150, T.c[2]], T.housing + 2, TL.CARPAINT, { seg: 24, uvU: 3, uvV: 60 }));
  m.with({ tint: DARK }, () => {
    m.tube([0, -150, T.c[2]], [0, -158, T.c[2]], T.housing, TL.SILVER, { r1: T.housing - 1, seg: 24, uvU: 3, uvV: 30 });
    m.tube([0, -158, T.c[2]], [0, -150, T.c[2]], T.r + 2, TL.DARK, { seg: 24, caps: 'end', capLayer: TL.DARK, uvV: 30 });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m.box(Math.cos(a) * (T.housing - 1), -156, T.c[2] + Math.sin(a) * (T.housing - 1) - 2, 4, 6, 4, TL.DARK, { bevel: 0.6, rot: a }); }
  });
  m.with({ tint: DARK, ao: [0, 12] }, () => {
    for (let k = -4; k <= 4; k++) m.box(k * 12.5, -150, 1, 2, 24, 11 - Math.abs(k) * 0.7, TL.CARBON, { bevel: 0.4 });
    m.box(0, -147, 1.5, 116, 18, 2.4, TL.CARBON, { bevel: 0.5 });
  });
  m.with({ tint: DARK }, () => { for (const e of UD.exhausts) m.tube([e[0], e[1] + 8, e[2]], [e[0], e[1] - 4, e[2]], 7, TL.BARREL, { r1: 6.2, seg: 14, uvV: 20 }); });
  // Rear deck armour: silver plates, warning panels on the quarter corners.
  m.with({ tint: PAINT }, () => {
    for (const s of [-1, 1]) {
      slab(m, s > 0 ? 24 : -54, s > 0 ? 54 : -24, -46, -10, 38.6, 36.6, 1.4, TL.SILVER, TL.DARK, 2);
    }
  });
  m.with({ tint: [0.3, 0.3, 0.32] }, () => m.box(0, 0, 2, 104, 300, 5, TL.DARK, { bevel: 0 }));
  return m.finish();
}

/** Muscular fenders over all four wheel arches (open underneath, the tyres show below). */
function fenders() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [24, 36] }, () => {
    for (const s of [-1, 1]) {
      loftY(m, [
        fring(-136, s, 80, 30, 46), fring(-124, s, 86, 28, 52), fring(-100, s, 88, 27, 55), fring(-74, s, 87, 27, 52), fring(-52, s, 78, 24, 41),
      ], { layer: TL.CARPAINT, uv: 90, cap0: TL.CARBON, cap1: TL.CARPAINT, smooth: true });
      loftY(m, [
        fring(56, s, 78, 22, 36), fring(72, s, 84, 22, 46), fring(110, s, 84, 22, 46), fring(142, s, 72, 18, 32, 46),
      ], { layer: TL.CARPAINT, uv: 90, cap0: TL.CARPAINT, cap1: TL.CARBON, smooth: true });
      // Silver armour on the haunches, vent behind each front wheel.
      slab(m, s > 0 ? 58 : -80, s > 0 ? 80 : -58, -122, -100, 54.2, 54.6, 1.4, TL.SILVER, TL.DARK);
      m.with({ tint: [0.5, 0.5, 0.54] }, () => slab(m, s > 0 ? 56 : -78, s > 0 ? 78 : -56, 80, 104, 46.2, 46.2, 1.2, TL.GRILLE, TL.DARK));
    }
  });
  return m.finish();
}

function canopy() {
  const m = new TankMesh();
  m.with({ tint: [0.62, 0.66, 0.76] }, () => loftY(m, [
    { y: -34, pts: [-15, 40, -13, 47, -5, 50, 5, 50, 13, 47, 15, 40] },
    { y: -8, pts: [-25, 37, -23, 50, -9, 57.5, 9, 57.5, 23, 50, 25, 37] },
    { y: 30, pts: [-27, 35, -25, 49, -9, 58.5, 9, 58.5, 25, 49, 27, 35] },
    { y: 58, pts: [-21, 32, -19, 42, -7, 48, 7, 48, 19, 42, 21, 32] },
    { y: 74, pts: [-8, 31, -7, 34, -3, 35.5, 3, 35.5, 7, 34, 8, 31] },
  ], { layer: TL.GLASS, uv: 70, cap0: TL.GLASS, cap1: TL.GLASS, smooth: true }));
  m.with({ tint: DARK }, () => { for (const s of [-1, 1]) m.tube([s * 25, -6, 50.5], [s * 20, 56, 42.5], 1.3, TL.DARK, { seg: 6, uvV: 40 }); });
  return m.finish();
}

function spine() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [42, 52] }, () => loftY(m, [
    { y: -132, pts: [-10, 40, -9, 45, 0, 48, 9, 45, 10, 40] },
    { y: -90, pts: [-14, 43, -12, 51, 0, 54, 12, 51, 14, 43] },
    { y: -50, pts: [-15, 40, -13, 51, 0, 55, 13, 51, 15, 40] },
    { y: -34, pts: [-13, 38, -11, 48, 0, 51, 11, 48, 13, 38] },
  ], { layer: TL.CARBON, uv: 50, cap0: TL.CARBON, cap1: TL.GRILLE, smooth: true }));
  m.with({ tint: DARK }, () => { for (const s of [-1, 1]) m.tube([s * 11, -46, 50], [s * 11, -70, 51.5], 3.8, TL.BARREL, { seg: 10, caps: 'start', capLayer: TL.GRILLE, uvV: 20 }); });
  return m.finish();
}

function wing() {
  const m = new TankMesh();
  m.with({ tint: PAINT }, () => {
    // Ducktail lip across the rear deck, kicked up toward the turbine.
    for (const s of [-1, 1]) slab(m, s > 0 ? 28 : -58, s > 0 ? 58 : -28, -140, -158, 39.5, 44, 2, TL.CARBON, TL.DARK);
    // Shark fins along the haunch tops, rising toward the rear.
    for (const s of [-1, 1]) loftY(m, [
      { y: -92, pts: [s * 66, 54, s * 68, 54, s * 68, 55, s * 66, 55] },
      { y: -128, pts: [s * 66, 48, s * 68.5, 48, s * 68.5, 64, s * 66, 64] },
      { y: -136, pts: [s * 66.4, 46, s * 68, 46, s * 68, 61, s * 66.4, 61] },
    ], { layer: TL.CARPAINT, uv: 40, cap0: TL.DARK, cap1: TL.CARBON });
  });
  m.with({ tint: RED, em: 1 }, () => { for (const s of [-1, 1]) m.box(s * 43, -158.2, 43.4, 30, 0.8, 1, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function blades() {
  const m = new TankMesh();
  m.with({ tint: PAINT }, () => {
    for (const s of [-1, 1]) {
      plate(m, [s * 72, 22, s * UD.bladeW, -4, s * (UD.bladeW + 2), -16, s * 72, -44], 34, 36.4, TL.CARPAINT, TL.SILVER);
      plate(m, [s * 72, 6, s * 96, -8, s * 97, -14, s * 72, -30], 36.4, 37.6, TL.SILVER, TL.DARK);
    }
  });
  m.with({ tint: RED, em: 1 }, () => {
    for (const s of [-1, 1]) m.tube([s * 74, 21, 35.2], [s * (UD.bladeW + 1), -10, 35.2], 1, TL.GLOW, { seg: 5, uvV: 20 });
  });
  return m.finish();
}

/** Red emissive: taillight bars, rear chevrons, side strips, emblem. */
function tail() {
  const m = new TankMesh();
  m.with({ tint: RED, em: 1, ao: null }, () => {
    for (const s of [-1, 1]) {
      m.box(s * 52, -157.2, 28.5, 34, 1.8, 2.6, TL.GLOW, { bevel: 0 });
      m.box(s * 52, -157.2, 32.6, 30, 1.8, 2.2, TL.GLOW, { bevel: 0 });
      m.box(s * 76, -137, 38, 2.2, 1.6, 10, TL.GLOW, { bevel: 0 });
      m.loft([{ pts: [s * 2, -153, s * 20, -153, s * 16, -151, s * 2, -151], z: 59.4 }, { pts: [s * 2, -153, s * 20, -153, s * 16, -151, s * 2, -151], z: 60.8 }], { layer: TL.GLOW, uv: 40 });
      m.box(s * 82.4, -2, 15, 0.8, 106, 1.4, TL.GLOW, { bevel: 0 });
      m.box(s * 70.5, 30, 28.6, 0.8, 70, 1.2, TL.GLOW, { bevel: 0 });
      m.box(s * 36, 96, 30.8, 1, 36, 0.6, TL.GLOW, { bevel: 0, rot: s * 0.22 });
    }
    m.loft([{ pts: [-5, 150, 5, 150, 0, 141], z: 18.8 }, { pts: [-5, 150, 5, 150, 0, 141], z: 19.6 }], { layer: TL.GLOW, uv: 20 });
  });
  return m.finish();
}

/** Cyan emissive: turbine ring, thruster rings, deck slits. */
function cyan() {
  const m = new TankMesh();
  const T = UD.turbine;
  m.with({ tint: CYAN, em: 1, ao: null }, () => {
    m.tube([0, -158.4, T.c[2]], [0, -157.6, T.c[2]], T.r + 4.4, TL.GLOW, { r1: T.r + 4.4, seg: 28, uvV: 10 });
    for (const e of UD.exhausts) m.tube([e[0], e[1] - 4.2, e[2]], [e[0], e[1] - 3.6, e[2]], 5, TL.GLOW, { seg: 14, uvV: 10 });
    for (const s of [-1, 1]) {
      m.box(s * 40, -60, 41, 14, 1.2, 0.6, TL.GLOW, { bevel: 0 });
      m.box(s * 40, -54, 41, 14, 1.2, 0.6, TL.GLOW, { bevel: 0 });
      m.box(s * 80.8, 0, 12, 0.6, 52, 1, TL.GLOW, { bevel: 0 });
    }
  });
  return m.finish();
}

function head() {
  const m = new TankMesh();
  m.with({ tint: WHITE, em: 1, ao: null }, () => {
    for (const s of [-1, 1]) {
      m.loft([{ pts: [s * 10, 150, s * 32, 138, s * 34, 142, s * 12, 156], z: 17.6 }, { pts: [s * 10, 150, s * 32, 138, s * 34, 142, s * 12, 156], z: 18.8 }], { layer: TL.GLOW, uv: 30 });
      m.box(s * 38, 132, 25.6, 10, 2, 1, TL.GLOW, { bevel: 0 });
    }
  });
  return m.finish();
}

/** Turbine fan (blades in the xz plane, axis = local y). */
function fan() {
  const m = new TankMesh(), T = UD.turbine;
  m.with({ tint: DARK }, () => {
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2, b = a + 0.32;
      const p = (ang, r, y) => [Math.cos(ang) * r, y, Math.sin(ang) * r];
      m.quad([p(a, 6, -1), p(a + 0.15, T.r, 1), p(b + 0.15, T.r, -1.5), p(b, 6, 1)], [[0, 0], [1, 0], [1, 0.3], [0, 0.3]], TL.SILVER, [0, 4, 0]);
    }
    m.tube([0, 2, 0], [0, -3, 0], 7, TL.DARK, { r1: 5, seg: 14, caps: 'end', capLayer: TL.DARK, uvV: 10 });
  });
  return m.finish();
}

function core() {
  const m = new TankMesh();
  m.with({ tint: HOT, em: 1, ao: null }, () => m.tube([0, 0, 0], [0, -6, 0], 5, TL.GLOW, { r1: 1.5, seg: 14, caps: 'start', uvV: 10 }));
  return m.finish();
}

/** Wheel: tyre tread around local x, alloy faces both sides. */
function wheel(r, w) {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => {
    m.tube([-w / 2, 0, 0], [w / 2, 0, 0], r, TL.TIRE, { seg: 24, caps: true, capLayer: TL.RIM, uvU: 4, uvV: w });
    // Shoulder bevels so the tyre reads round, not as a drum.
    m.tube([-w / 2 - 1.4, 0, 0], [-w / 2, 0, 0], r - 2.5, TL.TIRE, { r1: r, seg: 24, uvU: 4, uvV: 6 });
    m.tube([w / 2, 0, 0], [w / 2 + 1.4, 0, 0], r, TL.TIRE, { r1: r - 2.5, seg: 24, uvU: 4, uvV: 6 });
    m.tube([-w / 2 - 1.5, 0, 0], [w / 2 + 1.5, 0, 0], r - 2.6, TL.RIM, { seg: 24, caps: true, capLayer: TL.RIM, uvU: 1, uvV: 50 });
  });
  return m.finish();
}

function unitTube(r, layer) {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => m.tube([0, 0, 0], [0, 1, 0], r, layer, { seg: 8, caps: true, capLayer: TL.DARK, uvV: 2 }));
  return m.finish();
}

function coil() {
  const m = new TankMesh();
  m.with({ tint: [2.2, 0.35, 0.25] }, () => {
    const turns = 6, seg = 48;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * turns * Math.PI * 2, a1 = ((i + 1) / seg) * turns * Math.PI * 2;
      m.tube([Math.cos(a0) * 1.6, i / seg, Math.sin(a0) * 1.6], [Math.cos(a1) * 1.6, (i + 1) / seg, Math.sin(a1) * 1.6], 0.45, TL.BARREL, { seg: 5, uvV: 2 });
    }
    m.tube([0, 0, 0], [0, 1, 0], 0.9, TL.BARREL, { seg: 8, uvV: 2 });
  });
  return m.finish();
}

// ------------------------------------------------------------- weapons

function rearGunBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 8] }, () => {
    m.box(0, -2, -5, 20, 28, 5, TL.CARPAINT, { bevel: 1.2 });
    m.loft([{ pts: [-10, -16, 10, -16, 11, 8, 5, 18, -5, 18, -11, 8], z: 0 }, { pts: [-8, -13, 8, -13, 8.5, 6, 4, 14, -4, 14, -8.5, 6], z: 9 }], { layer: TL.CARPAINT, top: TL.CARBON, uv: 40 });
  });
  m.with({ tint: RED, em: 1 }, () => { m.box(0, 17.6, 5, 8, 0.8, 1.2, TL.GLOW, { bevel: 0 }); for (const s of [-1, 1]) m.box(s * 10.7, 0, 4, 0.6, 18, 0.8, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function rearBarrel() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.tube([0, 0, 0], [0, 14, 0], 3.6, TL.DARK, { seg: 10, uvV: 20 });
    m.tube([0, 14, 0], [0, 32, 0], 2.4, TL.BARREL, { seg: 10, uvV: 30 });
    m.tube([0, 32, 0], [0, 38, 0], 3.4, TL.BARREL, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    for (let k = 0; k < 3; k++) m.box(0, 33 + k * 1.8, 0, 7.6, 0.7, 2.4, TL.DARK, { bevel: 0 });
  });
  return m.finish();
}

function sideGunBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [0, 6] }, () => {
    m.lathe(0, 0, [[11, -4], [11, 2], [9, 6]], TL.CARPAINT, { seg: 14, uv: 30 });
    m.box(0, 2, 6, 14, 22, 9, TL.CARPAINT, { bevel: 1.4 });
    m.box(0, -8, 8, 12, 8, 8, TL.DARK, { bevel: 1 });
    m.box(0, 0, 15, 10, 12, 1.4, TL.CARBON, { bevel: 0.4 });
  });
  return m.finish();
}

function rotor() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.tube([Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], [Math.cos(a) * 3.2, 30, Math.sin(a) * 3.2], 1.15, TL.BARREL, { seg: 6, caps: 'end', capLayer: TL.DARK, uvV: 20 }); }
    for (const y of [2, 14, 27]) m.tube([0, y, 0], [0, y + 2.4, 0], 5.2, TL.DARK, { seg: 12, caps: true, capLayer: TL.DARK, uvV: 10 });
  });
  return m.finish();
}

function podBase() {
  const m = new TankMesh();
  m.with({ tint: PAINT, ao: [-12, -4] }, () => {
    m.box(0, -2, -10, 26, 28, 20, TL.CARPAINT, { bevel: 1.6 });
    m.box(0, 12.4, -9, 24, 1.4, 18, TL.DARK, { bevel: 0 });
  });
  m.with({ tint: DARK }, () => {
    for (const [x, , z] of UD.podTubes) m.tube([x, 2, z], [x, UD.podMuzzle, z], 2.8, TL.BARREL, { seg: 10, caps: 'end', capLayer: TL.GRILLE, uvV: 10 });
  });
  m.with({ tint: RED, em: 1 }, () => { for (const s of [-1, 1]) m.box(s * 13.3, 0, 0.4, 0.6, 22, 0.8, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function podCover() {
  const m = new TankMesh();
  // Built hinged at its top edge (local origin): it swings up about local x.
  m.with({ tint: PAINT }, () => m.box(0, 0.8, -17, 25, 2, 17, TL.CARPAINT, { bevel: 0.6 }));
  return m.finish();
}

function wreckMount(w, d, h) {
  const m = new TankMesh(), R = rnd(77 + w);
  m.with({ tint: [0.5, 0.45, 0.42] }, () => {
    m.box(0, 0, -4, w, d, h * 0.5, TL.SCORCH, { bevel: 0.8 });
    for (let k = 0; k < 5; k++) m.box((R() - 0.5) * w * 0.7, (R() - 0.5) * d * 0.7, h * 0.3, 2 + R() * 4, 2 + R() * 5, 2 + R() * h * 0.5, TL.SCORCH, { bevel: 0.3, rot: R() * 3 });
  });
  return m.finish();
}

/** Loose debris: barrier chunks, wreck panels (roadblock breaker). */
function chunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => m.loft([
    { pts: [-1, -0.8, 0.9, -1, 1, 0.7, -0.6, 1], z: -0.5 },
    { pts: [-0.7, -0.6, 0.6, -0.8, 0.8, 0.5, -0.5, 0.7], z: 0.5 },
  ], { layer: TL.CONCRETE, top: TL.CONCRETE, bottom: TL.CONCRETE, uv: 2 }));
  return m.finish();
}

function barrier() {
  const m = new TankMesh();
  // Jersey barrier, 1 unit long along x (scaled by the rig).
  m.with({ tint: [1, 1, 1], ao: [0, 4] }, () => m.loft([
    { pts: [-0.5, -3.2, 0.5, -3.2, 0.5, 3.2, -0.5, 3.2], z: 0 },
    { pts: [-0.5, -3, 0.5, -3, 0.5, 3, -0.5, 3], z: 2.2 },
    { pts: [-0.5, -1.4, 0.5, -1.4, 0.5, 1.4, -0.5, 1.4], z: 4 },
    { pts: [-0.5, -1.1, 0.5, -1.1, 0.5, 1.1, -0.5, 1.1], z: 7.4 },
  ], { layer: TL.CONCRETE, top: TL.CONCRETE, uv: 8 }));
  return m.finish();
}

function hulk() {
  const m = new TankMesh();
  // Burnt civilian car hulk (roadblock), 26 long.
  m.with({ tint: [0.42, 0.38, 0.36] }, () => {
    m.box(0, 0, 1.8, 11, 26, 3.6, TL.SCORCH, { bevel: 0.8 });
    m.box(0, -1.5, 5.4, 9, 12, 2.8, TL.SCORCH, { bevel: 1 });
    for (const sx of [-1, 1]) for (const sy of [-8, 8]) m.box(sx * 5, sy, 0, 2.2, 5, 4, TL.DARK, { bevel: 0.4 });
  });
  return m.finish();
}

/** All parts: name → mesh data. */
export function buildUrbanDevastator() {
  const out = {
    body: body(), fenders: fenders(), canopy: canopy(), spine: spine(), wing: wing(), blades: blades(),
    tail: tail(), cyan: cyan(), head: head(), fan: fan(), core: core(),
    wheelF: wheel(23, 26), wheelR: wheel(26, 32), link: unitTube(1.6, TL.BARREL), coil: coil(),
    rearGunBase: rearGunBase(), rearBarrel: rearBarrel(), sideGunBase: sideGunBase(), rotor: rotor(),
    podBase: podBase(), podCover: podCover(),
    rearWreck: wreckMount(22, 30, 12), sideWreck: wreckMount(16, 22, 12), podWreck: wreckMount(26, 28, 14),
    chunk: chunk(), barrier: barrier(), hulk: hulk(),
  };
  return out;
}
