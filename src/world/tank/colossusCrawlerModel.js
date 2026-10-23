import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// COLOSSUS CRAWLER — eight-legged apocalypse engine, built as real 3D parts.
//
// Model space (as the other 3D bosses): +y = FORWARD (the weapon face: core
// eye, heavy cannons, front battery), +x = right seen from above, +z = up.
// The HULL frame has its origin at the chassis centre, z = 0 at the belly;
// the rig carries it at ride height above the ground and faces it toward the
// pilot. ≈ 150 wide × 290 long (chassis); the legs span ≈ ±215 × ±185.
//
//   hull        armoured chassis: layered deck plates, side housings, eight
//               hip sockets, front collar, rear stacks, dorsal reactor housing
//   red / cyan  emissive warning lights, optics / restrained energy conduits
//   core        front siege-core housing (cylinder along +y) — `eye` lens glows
//   plate       dorsal repair hatches (hinged at the spine, open during repair)
//   repair      the glowing repair reactor exposed under the hatches
//   armA/armB   articulated repair arms (shoulder on the spine, welding torch)
//   hcBase/hcBarrel   heavy cannon turret (yaw) and its barrel (recoils along −y)
//   rotBase/rotor     shoulder rotary cannon (rises to deploy, yaws; barrels spin about +y)
//   podBase/podCover  missile pod (2 × 4 tubes pitched back) and its hinged cover
//   mortBase/mortTube mortar (yaw) and its tube (elevates about x)
//   battery     front anti-air battery (fixed, six short barrels)
//   coxa / femur / tibia / foot / legGun     leg parts (see LEG frames below)
//   pistonB / pistonR unit cylinders spanned between joints (barrel / chrome rod)
//   *Wreck      destroyed mounts; chunk = loose debris
//
// LEG frames (all legs share the meshes):
//   coxa   origin at the hip socket, +y = outward along the leg's yaw, +z = hull up
//   femur  origin at the femur joint, +y along the femur, +x across, +z = the knee's outer side
//   tibia  origin at the knee, +y along the tibia toward the foot
//   foot   origin at the ground contact, +z = surface normal, +y = the leg's outward direction

const ARM = [1, 1, 1];
const DARK = [0.78, 0.8, 0.84];
const RED = [2.4, 0.08, 0.1];
const CYAN = [0.25, 1.5, 2.3];
const HOT = [2.4, 0.5, 0.2];
const HAZ = [1, 1, 1];

const C0 = {
  ride: 58,                                        // hull belly above the ground (standing)
  hips: [[-72, 76], [-76, 26], [-76, -26], [-72, -76], [72, 76], [76, 26], [76, -26], [72, -76]].map(([x, y]) => [x, y, 14]),
  rest: [[-165, 172], [-214, 64], [-214, -64], [-165, -172], [165, 172], [214, 64], [214, -64], [165, -172]], // hull-space feet (ground)
  coxa: 28, coxaZ: 10, femur: 112, tibia: 138,
  // Weapons (hull space).
  hc: [[-50, 82, 40], [50, 82, 40]],               // heavy cannon turret pivots
  hcMuzzle: [0, 92, 0],                            // barrel space (barrel origin at the mantlet)
  hcBarrel: [0, 6, 12],                            // barrel origin in turret space
  rot: [[-60, 14, 40], [60, 14, 40]],              // rotary cannon pivots (deck)
  rotor: [0, 14, 13],                              // rotor pivot in mount space
  rotMuzzle: [0, 40, 0],                           // rotor space
  pod: [[-42, -50, 40], [42, -50, 40]],            // missile pods
  podPitch: 0.75,                                  // tubes point up and back
  podTubes: [[-7.5, -4], [-2.5, -4], [2.5, -4], [7.5, -4], [-7.5, 4], [-2.5, 4], [2.5, 4], [7.5, 4]], // pod space (x, z)
  podMuzzle: 17,
  mort: [[-46, -102, 36], [46, -102, 36]],         // mortar pivots
  mortTube: [0, 4, 10],                            // tube trunnion in mount space
  mortMuzzle: [0, 40, 0],                          // tube space (+y along the tube)
  battery: [[-50, 128, 12], [-40, 130, 10], [-30, 128, 12], [30, 128, 12], [40, 130, 10], [50, 128, 12]],
  batteryMuzzle: 22,
  core: [0, 112, 30],                              // core housing centre
  eye: [0, 152, 30],                               // the lens (emitter muzzle)
  spine: [0, -14, 44],                             // repair arms' shoulder line (deck)
  armA: 46, armB: 40,
  stacks: [[-26, -134, 38], [-14, -136, 42], [14, -136, 42], [26, -134, 38]],
  legGun: [0, 44, 16],                             // femur space (front legs)
  legGunMuzzle: [0, 30, 0],
  halfW: 82, len: [-138, 156],
};

/** Uniform model scale: the meshes are authored at 1, scaled at build time; CC is the scaled copy. */
export const SCALE = 0.74;
const scaleTree = (v, k) => (Array.isArray(v) ? v.map((x) => scaleTree(x, k)) : typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([n, x]) => [n, n === 'podPitch' ? x : scaleTree(x, k)])) : v * k);
export const CC = scaleTree(C0, SCALE);

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/**
 * Loft along y: sections [{ y, pts: [x, z, ...] }] (same count, convex ring in
 * the xz plane). Flat quads, normals away from the local centre.
 * o: { layer, uv, cap0, cap1 (layers), sides: [per-edge layer] }
 */
function loftY(m, sections, o) {
  const n = sections[0].pts.length / 2, uv = o.uv || 60;
  const P = (s, k) => [s.pts[k * 2], s.y, s.pts[k * 2 + 1]];
  const cen = (s) => { let x = 0, z = 0; for (let k = 0; k < n; k++) { x += s.pts[k * 2]; z += s.pts[k * 2 + 1]; } return [x / n, s.y, z / n]; };
  for (let j = 0; j < sections.length - 1; j++) {
    const A = sections[j], B = sections[j + 1], ca = cen(A), cb = cen(B), mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
    let u = 0;
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n;
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
}

/** Chamfered box section ring (xz) of half-width w, z from zb to zt, top chamfer b. */
const sect = (y, w, zb, zt, b = 3) => ({ y, pts: [-w, zb, w, zb, w, zt - b, w - b, zt, -(w - b), zt, -w, zt - b] });

/** Flat plate polygon (xy outline) between z0 and z1. */
function plate(m, pts, z0, z1, layer, sideLayer = layer) {
  m.loft([{ pts, z: z0 }, { pts, z: z1 }], { layer: sideLayer, top: layer, bottom: layer, uv: 60 });
}

const both = (fn) => { fn(-1); fn(1); };

// ---------------------------------------------------------------- hull

function hull() {
  const m = new TankMesh();
  // Belly pan and the main armoured tub (lofted along y: tapered nose and tail).
  m.with({ tint: DARK, ao: [0, 14] }, () => loftY(m, [
    { y: -132, pts: [-44, 4, 44, 4, 52, 22, 46, 34, -46, 34, -52, 22] },
    { y: -112, pts: [-56, 0, 56, 0, 66, 20, 60, 36, -60, 36, -66, 20] },
    { y: -40, pts: [-62, 0, 62, 0, 72, 20, 66, 38, -66, 38, -72, 20] },
    { y: 40, pts: [-62, 0, 62, 0, 72, 20, 66, 38, -66, 38, -72, 20] },
    { y: 104, pts: [-58, 0, 58, 0, 68, 18, 62, 34, -62, 34, -68, 18] },
    { y: 128, pts: [-48, 4, 48, 4, 56, 16, 50, 28, -50, 28, -56, 16] },
  ], { layer: TL.CCARMOR, uv: 70, cap0: TL.DARK, cap1: TL.DARK }));
  // Layered deck plates (stepped, chamfered), centre ridge, rear deck.
  m.with({ tint: ARM, ao: [30, 44] }, () => {
    both((s) => {
      m.box(s * 40, 52, 36, 46, 72, 6, TL.CCARMOR, { bevel: 2 });
      m.box(s * 44, -20, 36, 40, 84, 7, TL.CCARMOR, { bevel: 2.2 });
      m.box(s * 40, -92, 34, 40, 50, 6, TL.CCARMOR, { bevel: 2 });
      m.box(s * 64, 10, 18, 14, 190, 22, TL.CCARMOR, { bevel: 2.4 });      // side housings
      m.box(s * 68, 10, 30, 8, 150, 8, TL.DARK, { bevel: 1.4 });
      // Hazard-striped deck edge strips.
      m.box(s * 30, 104, 36, 30, 6, 3, TL.CCMARK, { bevel: 0.5, top: TL.CCMARK, uv: 30 });
      // Vent grilles on the rear deck.
      m.box(s * 22, -118, 34, 22, 14, 3, TL.GRILLE, { bevel: 0.6 });
    });
    m.box(0, -30, 38, 26, 150, 8, TL.CCARMOR, { bevel: 2.6 });              // centre ridge
    m.box(0, 92, 34, 46, 30, 8, TL.CCARMOR, { bevel: 2 });                  // front deck block
  });
  // Hip sockets: armoured rings the coxa housings turn in.
  m.with({ tint: DARK, ao: [6, 18] }, () => {
    for (const [x, y] of C0.hips) {
      m.lathe(x, y, [[17, 4], [17, 20], [14, 26]], TL.CCARMOR, { seg: 14, uv: 40 });
      m.lathe(x, y, [[12, 26], [12, 30]], TL.BARREL, { seg: 12, uv: 30 });
    }
  });
  // Front collar around the core housing, chin under it.
  m.with({ tint: ARM, ao: [4, 20] }, () => {
    m.tube([0, 86, C0.core[2]], [0, 98, C0.core[2]], 33, TL.CCARMOR, { seg: 20, uvU: 3, uvV: 40 });
    m.box(0, 112, 2, 64, 30, 14, TL.CCARMOR, { bevel: 2 });
    m.box(0, 128, 0, 54, 16, 8, TL.DARK, { bevel: 1.5 });
  });
  // Rear: exhaust stacks, engine louvres, tow eyes.
  m.with({ tint: DARK }, () => {
    for (const [x, y, z] of C0.stacks) m.tube([x, y + 12, z - 16], [x, y, z], 5.2, TL.BARREL, { r1: 4.6, seg: 10, caps: 'end', capLayer: TL.GRILLE, uvV: 20 });
    m.box(0, -128, 8, 70, 8, 22, TL.GRILLE, { bevel: 1 });
    both((s) => m.box(s * 46, -132, 6, 10, 10, 10, TL.RUSTY, { bevel: 1.5 }));
  });
  // Dorsal reactor housing (the hatches close over it).
  m.with({ tint: ARM, ao: [40, 52] }, () => {
    m.box(0, -14, 40, 36, 66, 10, TL.CCARMOR, { bevel: 2.2 });
    for (const y of [-40, 12]) m.box(0, y, 50, 40, 6, 4, TL.CCMARK, { bevel: 0.6, top: TL.CCMARK, uv: 40 });
  });
  // Bolt heads / rivet rows along the housings.
  m.with({ tint: DARK }, () => {
    both((s) => { for (let y = -70; y <= 90; y += 20) m.box(s * 71.6, y, 34, 2, 2.4, 2.4, TL.BARREL, { bevel: 0.4 }); });
  });
  return m.finish();
}

/** Red warning lights / sensor strips; cyan conduit strips. */
function red() {
  const m = new TankMesh();
  m.with({ tint: RED, em: 1 }, () => {
    both((s) => {
      for (let k = 0; k < 6; k++) m.box(s * 72.4, -60 + k * 26, 24, 1, 6, 3, TL.GLOW, { bevel: 0 });
      m.box(s * 58, 114, 30, 10, 1.2, 2.4, TL.GLOW, { bevel: 0 });
      m.box(s * 44, -136.2, 24, 16, 1, 2, TL.GLOW, { bevel: 0 });
      for (const [x, y] of C0.hips.filter((h) => Math.sign(h[0]) === s)) m.box(x + s * 2, y, 27.5, 6, 6, 1.2, TL.GLOW, { bevel: 0 });
      m.box(s * 20, 118, 36.5, 6, 6, 1, TL.GLOW, { bevel: 0 });
    });
    m.box(0, 70, 46.5, 10, 3, 1, TL.GLOW, { bevel: 0 });
  });
  return m.finish();
}

function cyan() {
  const m = new TankMesh();
  m.with({ tint: CYAN, em: 1 }, () => {
    both((s) => { m.box(s * 10, -14, 50.2, 2, 50, 0.8, TL.GLOW, { bevel: 0 }); m.box(s * 64, 10, 40.6, 1.4, 120, 0.8, TL.GLOW, { bevel: 0 }); });
    m.tube([0, 98.6, C0.core[2]], [0, 99.4, C0.core[2]], 34.6, TL.GLOW, { seg: 24, uvV: 10 });
  });
  return m.finish();
}

/** Front siege-core housing (static on the hull): barrel-shaped, banded, with the lens bezel. */
function core() {
  const m = new TankMesh();
  const [, , z] = C0.core;
  m.with({ tint: ARM }, () => {
    m.tube([0, 98, z], [0, 140, z], 25, TL.CCARMOR, { seg: 22, uvU: 3, uvV: 50 });
    for (const y of [106, 120, 134]) m.tube([0, y, z], [0, y + 3.6, z], 26.6, TL.DARK, { seg: 22, uvV: 10 });
    m.tube([0, 140, z], [0, 150, z], 25, TL.DARK, { r1: 21, seg: 22, uvV: 10 });
  });
  m.with({ tint: DARK }, () => {
    m.tube([0, 150, z], [0, 152, z], 17, TL.BARREL, { seg: 22, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    // Heat sinks ringed around the housing.
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; m.box(Math.cos(a) * 25, 114, z + Math.sin(a) * 25, 3, 26, 3, TL.GRILLE, { bevel: 0.4 }); }
  });
  return m.finish();
}

/** The emitter lens: cyan iris ring + red pupil (glow drawn per frame). */
function eye() {
  const m = new TankMesh();
  const z = C0.eye[2];
  m.with({ tint: CYAN, em: 1 }, () => m.tube([0, 151.6, z], [0, 152.4, z], 15, TL.GLOW, { r1: 15, seg: 24, uvV: 10 }));
  m.with({ tint: RED, em: 1 }, () => m.tube([0, 151, z], [0, 154, z], 9, TL.GLOW, { r1: 6, seg: 20, caps: 'end', uvV: 10 }));
  return m.finish();
}

/** Dorsal hatch (hinged along +y at its inner edge, the local origin). */
function plateMesh(side) {
  const m = new TankMesh();
  m.with({ tint: ARM }, () => m.box(side * 10, 0, 0, 20, 62, 5, TL.CCARMOR, { bevel: 1.2 }));
  m.with({ tint: HAZ }, () => m.box(side * 19, 0, 4.6, 2.4, 62, 1, TL.CCMARK, { bevel: 0, top: TL.CCMARK, uv: 30 }));
  return m.finish();
}

function repairCore() {
  const m = new TankMesh();
  m.with({ tint: CYAN, em: 1 }, () => {
    m.tube([0, -36, 0], [0, 8, 0], 9, TL.GLOW, { seg: 16, caps: true, uvV: 20 });
    for (const y of [-30, -14, 2]) m.tube([0, y, 0], [0, y + 3, 0], 12, TL.GLOW, { seg: 16, uvV: 10 });
  });
  return m.finish();
}

/** Repair arm segments (+y along the segment). */
function armSeg(len, r, torch) {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    loftY(m, [sect(0, r, -r, r, 1.5), sect(len, r * 0.8, -r * 0.8, r * 0.8, 1.2)], { layer: TL.CCARMOR, uv: 30, cap0: TL.DARK, cap1: TL.DARK });
    m.tube([-r - 1, 0, 0], [r + 1, 0, 0], r * 0.9, TL.BARREL, { seg: 10, caps: true, uvV: 10 });
    if (torch) { m.tube([0, len, 0], [0, len + 9, 0], 2.6, TL.SILVER, { r1: 1.2, seg: 8, caps: 'end', uvV: 10 }); m.box(0, len - 6, r * 0.8, 5, 8, 3, TL.CCMARK, { bevel: 0.4 }); }
  });
  return m.finish();
}

// ------------------------------------------------------------- weapons

function hcBase() {
  const m = new TankMesh();
  m.with({ tint: ARM, ao: [-6, 6] }, () => {
    m.lathe(0, 0, [[20, -6], [20, 0], [18, 3]], TL.DARK, { seg: 16, uv: 40 });
    loftY(m, [
      { y: -22, pts: [-15, 0, 15, 0, 17, 10, 12, 18, -12, 18, -17, 10] },
      { y: 8, pts: [-19, 0, 19, 0, 21, 12, 15, 22, -15, 22, -21, 12] },
      { y: 20, pts: [-16, 2, 16, 2, 17, 12, 12, 19, -12, 19, -17, 12] },
    ], { layer: TL.CCARMOR, uv: 40, cap0: TL.DARK, cap1: TL.CCARMOR });
    m.box(0, 14, 7, 18, 10, 12, TL.DARK, { bevel: 1.5 });                    // mantlet
  });
  m.with({ tint: RED, em: 1 }, () => { both((s) => m.box(s * 17.6, -6, 10, 0.6, 14, 2, TL.GLOW, { bevel: 0 })); m.box(0, -20, 16, 8, 1, 1.4, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

function hcBarrel() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.tube([0, 0, 0], [0, 26, 0], 8.6, TL.CCARMOR, { seg: 14, uvU: 2, uvV: 30 });   // armoured sleeve
    m.tube([0, 26, 0], [0, 80, 0], 6.2, TL.BARREL, { r1: 5.6, seg: 14, uvV: 50 });
    for (const y of [40, 58]) m.tube([0, y, 0], [0, y + 3, 0], 7.4, TL.DARK, { seg: 14, uvV: 10 });
    m.tube([0, 80, 0], [0, 94, 0], 9.6, TL.DARK, { r1: 10.4, seg: 16, caps: 'end', capLayer: TL.DARK, uvV: 20 }); // muzzle brake
    for (const s of [-1, 1]) m.box(s * 10.4, 87, 0, 1.4, 9, 6, TL.DARK, { bevel: 0 });
  });
  m.with({ tint: HOT, em: 1 }, () => m.tube([0, 94, 0], [0, 94.6, 0], 6.4, TL.GLOW, { r1: 6.4, seg: 16, caps: 'end', uvV: 10 }));
  return m.finish();
}

function rotBase() {
  const m = new TankMesh();
  m.with({ tint: ARM, ao: [-4, 4] }, () => {
    m.lathe(0, 0, [[13, -10], [13, 4], [11, 8]], TL.CCARMOR, { seg: 14, uv: 30 });
    m.box(0, 6, 6, 18, 26, 12, TL.CCARMOR, { bevel: 1.6 });
    m.box(0, -8, 8, 14, 10, 10, TL.DARK, { bevel: 1.2 });                      // ammo drum housing
    m.tube([-9, -8, 13], [9, -8, 13], 6, TL.RUSTY, { seg: 12, caps: true, uvV: 10 });
  });
  m.with({ tint: RED, em: 1 }, () => m.box(0, 19.4, 15, 6, 0.6, 1.4, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function rotor() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; m.tube([Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6], [Math.cos(a) * 3.6, 40, Math.sin(a) * 3.6], 1.3, TL.BARREL, { seg: 6, caps: 'end', capLayer: TL.DARK, uvV: 20 }); }
    for (const y of [2, 18, 36]) m.tube([0, y, 0], [0, y + 2.6, 0], 6, TL.DARK, { seg: 12, caps: true, capLayer: TL.DARK, uvV: 10 });
  });
  return m.finish();
}

function podBase() {
  const m = new TankMesh();
  m.with({ tint: ARM, ao: [-12, -2] }, () => {
    m.box(0, -2, -12, 30, 34, 24, TL.CCARMOR, { bevel: 1.8 });
    m.box(0, 15.4, -10, 28, 1.4, 20, TL.DARK, { bevel: 0 });
  });
  m.with({ tint: DARK }, () => {
    for (const [x, z] of C0.podTubes) m.tube([x, 2, z], [x, C0.podMuzzle, z], 2.3, TL.BARREL, { seg: 10, caps: 'end', capLayer: TL.GRILLE, uvV: 10 });
  });
  m.with({ tint: RED, em: 1 }, () => { for (const [x, z] of C0.podTubes) m.tube([x, C0.podMuzzle - 0.4, z], [x, C0.podMuzzle + 0.2, z], 1.3, TL.GLOW, { seg: 8, caps: 'end', uvV: 10 }); });
  m.with({ tint: HAZ }, () => both((s) => m.box(s * 15.4, -2, -2, 0.8, 30, 4, TL.CCMARK, { bevel: 0 })));
  return m.finish();
}

function podCover() {
  const m = new TankMesh();
  // Hinged at its top edge (origin): swings up about local x.
  m.with({ tint: ARM }, () => m.box(0, 0.8, -21, 29, 2, 21, TL.CCARMOR, { bevel: 0.6 }));
  return m.finish();
}

function mortBase() {
  const m = new TankMesh();
  m.with({ tint: ARM, ao: [-6, 4] }, () => {
    m.lathe(0, 0, [[16, -8], [16, 2], [13, 6]], TL.CCARMOR, { seg: 14, uv: 30 });
    both((s) => m.box(s * 12, 4, 4, 5, 18, 14, TL.CCARMOR, { bevel: 1.2 }));   // trunnion cheeks
  });
  m.with({ tint: RED, em: 1 }, () => m.box(0, -14, 5, 6, 0.6, 1.2, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function mortTube() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.tube([-10, 0, 0], [10, 0, 0], 4, TL.BARREL, { seg: 10, caps: true, uvV: 10 });   // trunnion
    m.tube([0, -10, 0], [0, 38, 0], 8.4, TL.CCARMOR, { r1: 7.6, seg: 14, caps: 'start', capLayer: TL.DARK, uvU: 2, uvV: 30 });
    m.tube([0, 38, 0], [0, 42, 0], 9.4, TL.DARK, { seg: 14, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    for (const y of [6, 22]) m.tube([0, y, 0], [0, y + 2.4, 0], 9.2, TL.DARK, { seg: 14, uvV: 10 });
  });
  return m.finish();
}

function battery() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    for (const [x, y, z] of C0.battery) {
      m.box(x, y - 4, z - 5, 9, 12, 9, TL.CCARMOR, { bevel: 1 });
      m.tube([x, y, z], [x, y + C0.batteryMuzzle, z], 2.2, TL.BARREL, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    }
  });
  m.with({ tint: RED, em: 1 }, () => { for (const [x, y, z] of C0.battery) m.tube([x, y + C0.batteryMuzzle - 0.4, z], [x, y + C0.batteryMuzzle + 0.3, z], 1.6, TL.GLOW, { seg: 8, caps: 'end', uvV: 10 }); });
  return m.finish();
}

// ----------------------------------------------------------------- legs

/** Coxa housing: yaw ring, armoured block reaching out to the femur joint, coil-over on top. */
function coxa() {
  const m = new TankMesh();
  m.with({ tint: ARM, ao: [-4, 14] }, () => {
    loftY(m, [sect(-12, 15, -6, 16, 3), sect(C0.coxa + 6, 13, 0, 20, 3)], { layer: TL.CCARMOR, uv: 40, cap0: TL.DARK, cap1: TL.DARK });
    m.tube([-13, C0.coxa, C0.coxaZ], [13, C0.coxa, C0.coxaZ], 11, TL.DARK, { seg: 14, caps: true, capLayer: TL.BARREL, uvV: 10 }); // femur joint drum
  });
  // Coil spring (red, as in the reference) + its strut.
  m.with({ tint: [2.0, 0.3, 0.22] }, () => {
    const turns = 6, seg = 36, a0 = [0, -6, 18], a1 = [0, 18, 30];
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg, w0 = t0 * turns * Math.PI * 2, w1 = t1 * turns * Math.PI * 2;
      const p = (t, w) => [Math.cos(w) * 4.2, a0[1] + (a1[1] - a0[1]) * t, a0[2] + (a1[2] - a0[2]) * t + Math.sin(w) * 4.2];
      m.tube(p(t0, w0), p(t1, w1), 0.9, TL.BARREL, { seg: 5, uvV: 4 });
    }
  });
  m.with({ tint: DARK }, () => m.tube([0, -6, 18], [0, 18, 30], 2, TL.SILVER, { seg: 8, uvV: 10 }));
  m.with({ tint: RED, em: 1 }, () => m.box(0, 4, 16.4, 4, 4, 0.8, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

/** Femur: heavy armoured beam, plate layers on the top (+z = outer side of the knee), knee drum. */
function femur() {
  const m = new TankMesh(), L = C0.femur;
  m.with({ tint: ARM, ao: null }, () => {
    loftY(m, [sect(-6, 12, -12, 14, 3), sect(L * 0.5, 13, -10, 16, 3.5), sect(L - 6, 10, -9, 12, 3)], { layer: TL.CCARMOR, uv: 50, cap0: TL.DARK, cap1: TL.DARK });
    // Armour plate layers with a hazard band.
    m.box(0, L * 0.3, 15, 22, 30, 4, TL.CCARMOR, { bevel: 1.4 });
    m.box(0, L * 0.62, 15.5, 20, 26, 4, TL.CCARMOR, { bevel: 1.4 });
    m.box(0, L * 0.82, 12, 18, 6, 3.4, TL.CCMARK, { bevel: 0.5, top: TL.CCMARK, uv: 30 });
    m.tube([-14, L, 0], [14, L, 0], 13, TL.DARK, { seg: 16, caps: true, capLayer: TL.BARREL, uvV: 10 });   // knee drum
    m.tube([-15, L, 0], [15, L, 0], 6, TL.BARREL, { seg: 10, caps: true, uvV: 10 });
  });
  m.with({ tint: DARK }, () => { for (let y = 14; y < L - 14; y += 16) for (const s of [-1, 1]) m.box(s * 13.4, y, 2, 1.6, 2.4, 2.4, TL.BARREL, { bevel: 0.3 }); });
  m.with({ tint: RED, em: 1 }, () => { m.box(0, L * 0.45, 17.6, 4, 6, 0.8, TL.GLOW, { bevel: 0 }); for (const s of [-1, 1]) m.box(s * 13.2, L * 0.75, 6, 0.6, 8, 1.6, TL.GLOW, { bevel: 0 }); });
  return m.finish();
}

/** Tibia: tapering armoured shin down to the ankle. */
function tibia() {
  const m = new TankMesh(), L = C0.tibia;
  m.with({ tint: ARM, ao: null }, () => {
    loftY(m, [sect(0, 11, -10, 12, 3), sect(L * 0.35, 12, -9, 14, 3), sect(L - 18, 8, -7, 9, 2.4), sect(L - 8, 7, -6, 7, 2)], { layer: TL.CCARMOR, uv: 50, cap0: TL.DARK, cap1: TL.DARK });
    m.box(0, L * 0.22, 13, 20, 28, 4, TL.CCARMOR, { bevel: 1.4 });           // knee guard
    m.box(0, L * 0.55, 10, 15, 30, 3, TL.CCARMOR, { bevel: 1 });
    m.tube([-9, L - 6, 0], [9, L - 6, 0], 7.5, TL.DARK, { seg: 12, caps: true, capLayer: TL.BARREL, uvV: 10 }); // ankle
  });
  m.with({ tint: RED, em: 1 }, () => m.box(0, L * 0.4, 15.6, 3, 8, 0.8, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

/** Foot: hexagonal pad with three forward claws (+y), ankle post up to the tibia. */
function foot() {
  const m = new TankMesh();
  m.with({ tint: DARK, ao: [0, 6] }, () => {
    const hex = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; hex.push(Math.cos(a) * 18, Math.sin(a) * 20); }
    m.loft([{ pts: hex, z: 0 }, { pts: hex.map((v) => v * 0.86), z: 6 }, { pts: hex.map((v) => v * 0.6), z: 10 }], { layer: TL.CCARMOR, top: TL.DARK, bottom: TL.DARK, uv: 30 });
    for (const x of [-10, 0, 10]) m.loft([{ pts: [x - 3, 14, x + 3, 14, x + 1, 30, x - 1, 30], z: 0 }, { pts: [x - 2.4, 14, x + 2.4, 14, x + 0.6, 26, x - 0.6, 26], z: 5 }], { layer: TL.RUSTY, top: TL.RUSTY, uv: 20 });
    m.tube([0, 0, 8], [0, 0, 18], 6.5, TL.BARREL, { r1: 5.5, seg: 10, uvV: 10 });
  });
  return m.finish();
}

function legGun() {
  const m = new TankMesh();
  m.with({ tint: DARK }, () => {
    m.box(0, 0, -2, 14, 18, 8, TL.CCARMOR, { bevel: 1.2 });
    for (const s of [-1, 1]) m.tube([s * 4, 6, 2], [s * 4, C0.legGunMuzzle[1], 2], 1.8, TL.BARREL, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 10 });
  });
  m.with({ tint: RED, em: 1 }, () => m.box(0, -8.6, 2, 6, 0.6, 1.6, TL.GLOW, { bevel: 0 }));
  return m.finish();
}

function unitTube(layer, tint = DARK, seg = 10) {
  const m = new TankMesh();
  m.with({ tint }, () => m.tube([0, 0, 0], [0, 1, 0], 1, layer, { seg, caps: true, capLayer: TL.DARK, uvV: 1 }));
  return m.finish();
}

function wreckMount(w, d, h, seed) {
  const m = new TankMesh(), R = rnd(seed);
  m.with({ tint: [0.5, 0.45, 0.42] }, () => {
    m.box(0, 0, -4, w, d, h * 0.5, TL.SCORCH, { bevel: 0.8 });
    for (let k = 0; k < 6; k++) m.box((R() - 0.5) * w * 0.7, (R() - 0.5) * d * 0.7, h * 0.25, 2 + R() * 5, 2 + R() * 6, 2 + R() * h * 0.6, TL.SCORCH, { bevel: 0.3, rot: R() * 3 });
  });
  return m.finish();
}

function chunk() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => m.loft([
    { pts: [-1, -0.8, 0.9, -1, 1, 0.7, -0.6, 1], z: -0.5 },
    { pts: [-0.7, -0.6, 0.6, -0.8, 0.8, 0.5, -0.5, 0.7], z: 0.5 },
  ], { layer: TL.CONCRETE, top: TL.CONCRETE, bottom: TL.CONCRETE, uv: 2 }));
  return m.finish();
}

function plateChunk() {
  const m = new TankMesh();
  m.with({ tint: [0.8, 0.8, 0.82] }, () => m.box(0, 0, -0.5, 2, 2.6, 1, TL.CCARMOR, { bevel: 0.2 }));
  return m.finish();
}

/** Scale a mesh's positions (normals are unchanged by a uniform scale). */
function scaled(d, k = SCALE) {
  for (let o = 0; o < d.v.length; o += 13) { d.v[o] *= k; d.v[o + 1] *= k; d.v[o + 2] *= k; }
  return d;
}

const UNIT = new Set(['pistonB', 'pistonR', 'chunk', 'plateChunk']);

/** All parts: name → mesh data. */
export function buildColossusCrawler() {
  const out = {
    hull: hull(), red: red(), cyan: cyan(), core: core(), eye: eye(),
    plateL: plateMesh(-1), plateR: plateMesh(1), repair: repairCore(),
    armA: armSeg(C0.armA, 5, false), armB: armSeg(C0.armB, 4, true),
    hcBase: hcBase(), hcBarrel: hcBarrel(), rotBase: rotBase(), rotor: rotor(),
    podBase: podBase(), podCover: podCover(), mortBase: mortBase(), mortTube: mortTube(), battery: battery(),
    coxa: coxa(), femur: femur(), tibia: tibia(), foot: foot(), legGun: legGun(),
    pistonB: unitTube(TL.DARK), pistonR: unitTube(TL.SILVER, [1, 1, 1], 8),
    hcWreck: wreckMount(30, 40, 14, 11), rotWreck: wreckMount(18, 24, 12, 23), podWreck: wreckMount(30, 34, 16, 37), mortWreck: wreckMount(24, 26, 12, 41),
    coreWreck: wreckMount(40, 44, 26, 53),
    chunk: chunk(), plateChunk: plateChunk(),
  };
  for (const [k, d] of Object.entries(out)) if (!UNIT.has(k)) scaled(d);
  return out;
}
