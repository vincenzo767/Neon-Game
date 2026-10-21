import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// WHITE FANG — arctic siege tank, built as real 3D parts.
//
// Model space: +y = the tank's FORWARD (the ice-breaker ram), +x = its right
// as seen from above with the nose pointing down the screen, +z = up.
// 1 unit ≈ 1 gameplay screen unit at the boss's row. Overall ≈ 216 × 302.
//
// Parts (separate meshes so the rig can animate them):
//   hull          upper/lower hull, glacis, ram + teeth + ice, deck details
//   trackL/R      track belts (texture scrolls with the track speed)
//   frame         outer suspension plates (static on the ground)
//   wheel         unit disc, instanced per road wheel / sprocket / idler
//   turret        turret body, mantlet, sensor dome, capacitor packs
//   rail          one railgun (housing + coils + barrel), drawn at both mounts
//   cannonBase    side-cannon dome (yaws), cannonBarrel (recoils)
//   mortarPod     frost-mortar launcher (elevates)
//   mortarWreck / cannonWreck   destroyed mounts

const WHITE = [0.94, 0.96, 1.0];
const STEEL = [1, 1, 1];
const CYAN = [0.45, 0.85, 1.25];
const AMBER = [1.4, 0.62, 0.18];

export const WF = {
  length: [-152, 154], halfW: 108, hullTop: 46,
  track: { x: 88, hw: 16, y0: -128, y1: 108, r: 12 },
  wheels: [-128, -100, -70, -40, -10, 20, 50, 80, 108],  // sprocket … road wheels … idler
  turret: [0, -6, 46],
  rails: [[-15, 44, 10], [15, 44, 10]],    // turret space
  railMuzzle: [0, 100, 0],                 // rail space
  railLen: 100,
  cannons: [[-62, 64, 46], [62, 64, 46]],  // hull space
  cannonBarrel: [0, 6, 10],                // cannon space (barrel pivot)
  cannonMuzzle: [0, 48, 10],
  mortars: [[-42, -126, 50], [42, -126, 50]],
  mortarTubes: [[-11, 38, 5], [0, 38, 5], [11, 38, 5], [-11, 38, 12], [0, 38, 12], [11, 38, 12]],
  mortarMouth: [0, 38, 8.5],
  stacks: [[-30, -152, 54], [30, -152, 54]],
  sensor: [0, 22, 26],                     // turret space
  lamps: [[-50, 106, 31], [50, 106, 31], [-56, -140, 47], [56, -140, 47]],
  ram: { tip: [0, 154, 2], edgeL: [-108, 118], edgeR: [108, 118] },
  vents: [[-55, -66, 47], [55, -66, 47]],
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Irregular lump of snow / ice (faceted, white). */
function lump(m, x, y, z, r, R, h = 0.7) {
  m.with({ tint: [1, 1, 1], ao: null }, () => m.lathe(x, y, [[r, z], [r * (0.75 + R() * 0.15), z + r * h * 0.55], [r * 0.35, z + r * h]], TL.SNOW, { seg: 6, rot: R() * 6, uv: 40 }));
}

function octagon(hw, y0, y1, ch) {
  return [-hw + ch, y0, hw - ch, y0, hw, y0 + ch, hw, y1 - ch, hw - ch, y1, -hw + ch, y1, -hw, y1 - ch, -hw, y0 + ch];
}

// ---------------------------------------------------------------- hull

function hull() {
  const m = new TankMesh(), R = rnd(7);
  // Lower hull between the tracks (steel, mostly in shadow).
  m.with({ tint: STEEL, ao: [4, 26] }, () => m.box(0, -22, 4, 144, 244, 24, TL.DARK, { bevel: 0 }));
  // Upper hull: sloped sides, long front glacis, bevelled deck edge.
  m.with({ tint: WHITE, ao: [26, 40] }, () => m.loft([
    { pts: [-73, -146, 73, -146, 73, 96, 56, 114, -56, 114, -73, 96], z: 27 },
    { pts: [-67, -141, 67, -141, 67, 86, 50, 101, -50, 101, -67, 86], z: 41 },
    { pts: [-62, -136, 62, -136, 62, 78, 46, 90, -46, 90, -62, 78], z: 46 },
  ], { layer: TL.ARMOR, uv: 150 }));
  // Applique armour plates on the front deck (layered, bolted look).
  m.with({ tint: WHITE }, () => {
    for (const s of [-1, 1]) {
      m.box(s * 33, 66, 46, 34, 30, 3.2, TL.ARMOR, { bevel: 1.4, uv: 90 });
      m.box(s * 54, -14, 46, 14, 56, 6, TL.DARK, { bevel: 1.2, uv: 90 });        // stowage bins
      m.box(s * 54, -66, 46, 12, 22, 1.2, TL.GRILLE, { bevel: 0.3, uv: 22 });     // cooling vents
      m.box(s * 33, 100, 37, 22, 10, 3, TL.TRACK, { bevel: 0.6, uv: 72, rot: 0 }); // spare track links on the glacis
    }
  });
  // Engine deck: recessed grille between the mortar sleds, exhaust stacks.
  m.with({ tint: STEEL }, () => {
    m.box(0, -116, 46, 50, 40, 1.6, TL.DARK, { bevel: 0.8 });
    m.box(0, -116, 46.2, 42, 32, 1.6, TL.GRILLE, { bevel: 0, uv: 32 });
    for (const s of [-1, 1]) {
      m.tube([s * 30, -138, 42], [s * 30, -152, 54], 5.2, TL.BARREL, { caps: 'end', capLayer: TL.SCORCH, seg: 10, uvV: 30 });
      m.box(s * 42, -106, 46, 44, 40, 4, TL.DARK, { bevel: 1.2 });            // mortar sled platform
      m.box(s * 42, -88, 50, 30, 3, 1, TL.MARK, { bevel: 0, uv: 30 });         // hazard edge
    }
  });
  // Greebles: bolted skirt plates along the deck edges, headlamp housings,
  // tow hooks, fuel drums on the rear corners, pipe runs, cable reel.
  m.with({ tint: [0.9, 0.93, 0.97], ao: [40, 47] }, () => {
    for (const s of [-1, 1]) {
      for (let y = -126; y <= 62; y += 21) m.box(s * 64, y, 38, 5, 18, 7.5, TL.DARK, { bevel: 1, uv: 40 });
      m.box(s * 30, 86, 44.5, 12, 6, 4, TL.DARK, { bevel: 1 });
      m.box(s * 64, 104, 18, 8, 10, 6, TL.DARK, { bevel: 1.2 });
      m.tube([s * 50, -146, 40], [s * 70, -146, 40], 6, TL.DARK, { caps: true, capLayer: TL.MARK, seg: 10, uvV: 20 });
      m.tube([s * 38, -60, 48], [s * 38, 30, 48], 1.6, TL.BARREL, { seg: 6, uvV: 30 });
      m.tube([s * 44, -60, 48], [s * 44, 30, 48], 1.2, TL.BARREL, { seg: 6, uvV: 30 });
    }
    m.lathe(-46, -88, [[7, 46], [7, 50], [3, 50.5]], TL.DARK, { seg: 10 });
  });
  m.with({ tint: [1.2, 1.2, 1.1], em: 0.5, ao: null }, () => { for (const s of [-1, 1]) m.box(s * 30, 89.2, 45.4, 8, 0.6, 2.4, TL.GLOW, { bevel: 0 }); });
  // Warning lamps (amber, restrained) and the turret race ring.
  m.with({ tint: AMBER, em: 1, ao: null }, () => { for (const [x, y, z] of WF.lamps) m.box(x, y, z - 2.5, 6, 3.4, 3, TL.GLOW, { bevel: 0.6 }); });
  m.with({ tint: STEEL }, () => m.lathe(0, -6, [[49, 44], [49, 46.8], [47, 47.5]], TL.DARK, { seg: 24, uv: 60 }));
  // Ice-breaker ram: a steel wedge under the glacis.
  m.with({ tint: [0.92, 0.95, 1], ao: [2, 22] }, () => m.loft([
    { pts: [-106, 98, 106, 98, 109, 118, 0, 154, -109, 118], z: 2 },
    { pts: [-103, 96, 103, 96, 104, 112, 0, 141, -104, 112], z: 26 },
    { pts: [-100, 96, 100, 96, 100, 108, 0, 136, -100, 108], z: 30 },
  ], { layer: TL.DARK, top: TL.ARMOR, uv: 120 }));
  m.with({ tint: [0.8, 0.84, 0.9] }, () => m.box(0, 99, 22, 150, 8, 10, TL.DARK, { bevel: 2 })); // ram bracket
  // Serrated teeth along the leading edges.
  m.with({ tint: [0.9, 0.93, 0.98] }, () => {
    for (const [a, b] of [[[-109, 118], [0, 154]], [[0, 154], [109, 118]]]) {
      const n = 8;
      const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey), ux = ex / el, uy = ey / el;
      const nx = uy, ny = -ux; // outward normal (to the front / sides)
      const sgn = (nx * (a[0] + b[0]) / 2 + ny * ((a[1] + b[1]) / 2 - 100)) > 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.12) / n, t1 = (k + 0.88) / n, tm = (k + 0.5) / n;
        const P = [a[0] + ex * t0, a[1] + ey * t0], Q = [a[0] + ex * t1, a[1] + ey * t1], M = [a[0] + ex * tm, a[1] + ey * tm];
        const T = [M[0] + nx * sgn * 13, M[1] + ny * sgn * 13, 1.5];
        const Pb = [P[0], P[1], 1.5], Pt = [P[0] - nx * sgn * 2, P[1] - ny * sgn * 2, 13], Qb = [Q[0], Q[1], 1.5], Qt = [Q[0] - nx * sgn * 2, Q[1] - ny * sgn * 2, 13];
        const inside = [M[0], M[1], 6];
        m.triangle([Pt, Qt, T], [[0, 0], [1, 0], [0.5, 1]], TL.BARREL, inside);
        m.triangle([Pb, Pt, T], [[0, 0], [1, 0], [0.5, 1]], TL.BARREL, inside);
        m.triangle([Qb, Qt, T], [[0, 0], [1, 0], [0.5, 1]], TL.BARREL, inside);
      }
    }
  });
  // Frozen build-up: ice crust along the ram crest, icicles off the edge.
  for (const [a, b] of [[[-100, 108], [0, 136]], [[0, 136], [100, 108]]]) {
    for (let k = 0; k < 16; k++) {
      const t = (k + R() * 0.8) / 16, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      lump(m, x + (R() - 0.5) * 4, y - 3 + (R() - 0.5) * 4, 28.5, 2.6 + R() * 3.4, R, 0.8 + R() * 0.8);
      // Icicles hanging off the crest, pointing forward and down.
      const len = 10 + R() * 14, dx = x * 0.05 + (R() - 0.5) * 4;
      m.with({ tint: [0.9, 0.96, 1.06] }, () => m.tube([x, y + 1, 28], [x + dx, y + len, 10 + R() * 10], 1.3 + R() * 1.4, TL.SNOW, { r1: 0, seg: 5, uvV: 20 }));
    }
  }
  // Snow drifts on the deck corners and against fittings.
  for (const [x, y, r] of [[-62, -132, 9], [60, -128, 8], [-58, 30, 7], [58, 40, 6], [-40, -64, 6], [44, -58, 5], [-60, 88, 6], [62, 82, 7], [0, -96, 5]]) lump(m, x, y, 45.5, r, R, 0.5);
  return m;
}

// --------------------------------------------------------------- tracks

/** Track belt loop (top run + wrapped ends) for one side; v runs along the belt (72 units per tile). */
function belt(side) {
  const m = new TankMesh(), T = WF.track, x0 = side * T.x - T.hw, x1 = side * T.x + T.hw;
  const path = [];
  const N = 8, zc = T.r;
  // Rear wrap: from the ground (bottom) up around the sprocket to the top.
  for (let k = 0; k <= N; k++) { const a = -Math.PI / 2 - (k / N) * Math.PI; path.push([T.y0 + Math.cos(a) * T.r, zc + Math.sin(a) * T.r]); }
  // Top run.
  path.push([T.y1, zc + T.r]);
  // Front wrap down over the idler.
  for (let k = 1; k <= N; k++) { const a = Math.PI / 2 - (k / N) * Math.PI; path.push([T.y1 + Math.cos(a) * T.r, zc + Math.sin(a) * T.r]); }
  let s = 0;
  m.with({ tint: [0.95, 0.97, 1], ao: null }, () => {
    for (let k = 0; k < path.length - 1; k++) {
      const [ya, za] = path[k], [yb, zb] = path[k + 1], l = Math.hypot(yb - ya, zb - za);
      const ny = (zb - za) / l, nz = -(yb - ya) / l; // outward (rotate the direction)
      const out = [0, -ny, -nz];
      const v0 = -s / 72, v1 = -(s + l) / 72;
      const ids = [
        m.vert(x0, ya, za, out[0], out[1], out[2], 0, v0, TL.TRACK), m.vert(x1, ya, za, out[0], out[1], out[2], 1, v0, TL.TRACK),
        m.vert(x1, yb, zb, out[0], out[1], out[2], 1, v1, TL.TRACK), m.vert(x0, yb, zb, out[0], out[1], out[2], 0, v1, TL.TRACK),
      ];
      m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]);
      s += l;
    }
  });
  return m;
}

/** Outer and inner suspension plates (don't move with the belt). */
function frame() {
  const m = new TankMesh(), T = WF.track;
  m.with({ tint: [0.85, 0.88, 0.92], ao: [2, 18] }, () => {
    for (const s of [-1, 1]) {
      for (const x of [s * (T.x + T.hw + 0.6), s * (T.x - T.hw - 0.6)]) {
        const p = [[x, T.y0 + 4, 5], [x, T.y1 - 4, 5], [x, T.y1 - 8, 19], [x, T.y0 + 8, 19]];
        m.quad(p, [[0, 0], [3, 0], [3, 0.3], [0, 0.3]], TL.DARK, [s * T.x, (T.y0 + T.y1) / 2, 12]);
      }
      // Mudguards at the front and back of the run.
      m.box(s * T.x, T.y1 + 6, 25, T.hw * 2 + 4, 14, 2.4, TL.DARK, { bevel: 0.8 });
      m.box(s * T.x, T.y0 - 4, 25, T.hw * 2 + 4, 12, 2.4, TL.DARK, { bevel: 0.8 });
    }
  });
  return m;
}

/** Unit wheel disc facing +x (scaled per instance). */
function wheel() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => m.tube([0, 0, 0], [1, 0, 0], 1, TL.DARK, { caps: 'end', capLayer: TL.WHEEL, seg: 14, uvV: 4 }));
  return m;
}

// --------------------------------------------------------------- turret

function turret() {
  const m = new TankMesh(), R = rnd(31);
  m.with({ tint: WHITE, ao: [0, 10] }, () => m.loft([
    { pts: octagon(46, -46, 48, 15), z: 0 },
    { pts: octagon(43, -42, 44, 13), z: 12 },
    { pts: octagon(39, -38, 40, 11), z: 19 },
  ], { layer: TL.ARMOR, uv: 110 }));
  // Mantlet carrying both railguns.
  m.with({ tint: [0.9, 0.93, 0.97] }, () => m.box(0, 47, 2, 60, 16, 15, TL.DARK, { bevel: 2.2 }));
  // Sensor dome with the blue optic (lens drawn emissive).
  m.with({ tint: STEEL }, () => m.lathe(WF.sensor[0], WF.sensor[1], [[12, 18.5], [11, 23], [8.5, 25.5]], TL.DARK, { seg: 14 }));
  m.with({ tint: CYAN, em: 1, ao: null }, () => m.lathe(WF.sensor[0], WF.sensor[1], [[7, 25.4], [5.5, 26.6], [0.5, 27]], TL.GLOW, { seg: 16, topUv: 14 }));
  // Capacitor packs with glowing charge slits.
  for (const s of [-1, 1]) {
    m.with({ tint: [0.85, 0.88, 0.93] }, () => m.box(s * 28, -6, 18.5, 11, 52, 5, TL.DARK, { bevel: 1.2 }));
    m.with({ tint: CYAN, em: 1, ao: null }, () => { for (let y = -26; y <= 14; y += 8) m.box(s * 28, y, 23.4, 6, 2.4, 0.6, TL.GLOW, { bevel: 0 }); });
  }
  // Commander's cupola with vision blocks, loader's hatch, periscope, top
  // armour plates, smoke dischargers on the cheeks, stencil panel.
  m.with({ tint: WHITE }, () => {
    m.lathe(-16, -24, [[11, 18.5], [10.5, 24], [9, 26], [6, 27]], TL.ARMOR, { seg: 10, uv: 30 });
    m.lathe(16, -26, [[9, 18.5], [9, 21], [7.5, 22]], TL.ARMOR, { seg: 12, uv: 30 });
    for (const s of [-1, 1]) m.box(s * 22, 14, 18.6, 18, 22, 2.2, TL.ARMOR, { bevel: 1, uv: 60 });
  });
  m.with({ tint: STEEL }, () => {
    for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; m.box(-16 + Math.cos(a) * 10.2, -24 + Math.sin(a) * 10.2, 22.5, 3, 3, 2.4, TL.DARK, { bevel: 0.4, rot: a }); }
    m.box(4, -36, 19, 5, 8, 4.5, TL.DARK, { bevel: 0.8 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) m.tube([s * 36, 26 + k * 5, 8], [s * 44, 30 + k * 5, 13], 1.7, TL.BARREL, { caps: 'end', capLayer: TL.SCORCH, seg: 6, uvV: 12 });
  });
  m.with({ tint: [1, 1, 1] }, () => m.quad([[-17, -40, 19.06], [17, -40, 19.06], [17, -27, 19.06], [-17, -27, 19.06]], [[0, -0.95], [1, -0.95], [1, -0.55], [0, -0.55]], TL.MARK));
  for (const [x, y, r] of [[-34, -36, 6], [33, 30, 5], [-30, 34, 4]]) lump(m, x, y, 18.5, r, R, 0.45);
  return m;
}

/** One railgun in its own space: pivot at the mantlet, firing along +y. */
function rail() {
  const m = new TankMesh();
  m.with({ tint: WHITE, ao: null }, () => m.box(0, 30, -6, 13, 62, 12, TL.ARMOR, { bevel: 2, uv: 70 }));
  m.with({ tint: STEEL }, () => {
    for (const s of [-1, 1]) m.box(s * 7.2, 30, -4, 2, 60, 8, TL.DARK, { bevel: 0.5 });
    for (let y = 6; y <= 54; y += 8) m.box(0, y, 5.6, 10, 3.6, 1.2, TL.DARK, { bevel: 0.4 });
    m.tube([0, 58, 0], [0, 92, 0], 4.6, TL.BARREL, { seg: 12, uvV: 40 });
    m.tube([0, 88, 0], [0, 100, 0], 6.2, TL.DARK, { seg: 12, caps: 'end', capLayer: TL.SCORCH, uvV: 20 });
    for (const y of [91, 95]) m.box(0, y, -1.5, 15, 1.2, 3, TL.DARK, { bevel: 0.2 }); // muzzle brake ports
  });
  // Coil glow strips (the charge visibly runs along them).
  m.with({ tint: CYAN, em: 1, ao: null }, () => { for (let y = 6; y <= 54; y += 8) m.box(0, y, 6.7, 7, 1.8, 0.5, TL.GLOW, { bevel: 0 }); });
  return m;
}

function cannonBase() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[16, -1], [16, 3], [14.5, 4.5]], TL.DARK, { seg: 16 }));
  m.with({ tint: WHITE }, () => m.lathe(0, 0, [[14, 4], [13.4, 9], [11, 14], [6.5, 16.5]], TL.ARMOR, { seg: 12, uv: 40 }));
  m.with({ tint: STEEL }, () => m.box(0, 9, 7, 9, 8, 7, TL.DARK, { bevel: 1 }));
  m.with({ tint: CYAN, em: 1, ao: null }, () => m.box(-5, -6, 15.3, 3, 3, 1, TL.GLOW, { bevel: 0 }));
  return m;
}

function cannonBarrel() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.tube([0, 6, 10], [0, 42, 10], 3.1, TL.BARREL, { seg: 10, uvV: 30 });
    m.tube([0, 40, 10], [0, 48, 10], 4.3, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.SCORCH, uvV: 10 });
  });
  return m;
}

/** Frost-mortar pod: pivot on its rear edge, six tubes facing +y (elevates about x). */
function mortarPod() {
  const m = new TankMesh();
  m.with({ tint: WHITE, ao: null }, () => m.box(0, 18, 0, 38, 36, 17, TL.ARMOR, { bevel: 2, uv: 60 }));
  m.with({ tint: [1, 1, 1] }, () => { for (const s of [-1, 1]) m.quad([[s * 19.05, 2, 3], [s * 19.05, 34, 3], [s * 19.05, 34, 9], [s * 19.05, 2, 9]], [[0, 0], [1.4, 0], [1.4, -0.25], [0, -0.25]], TL.MARK, [0, 18, 8]); });
  m.with({ tint: STEEL }, () => {
    for (const [x, , z] of WF.mortarTubes) m.tube([x, 30, z], [x, 38, z], 3.6, TL.BARREL, { seg: 10, caps: 'end', capLayer: TL.SCORCH, uvV: 12 });
    m.box(0, 6, 17, 22, 8, 2.5, TL.DARK, { bevel: 0.8 }); // loader hatch
  });
  m.with({ tint: CYAN, em: 1, ao: null }, () => m.box(0, 20, 17.1, 14, 2, 0.6, TL.GLOW, { bevel: 0 }));
  return m;
}

function mortarWreck() {
  const m = new TankMesh(), R = rnd(13);
  m.with({ tint: [1, 1, 1] }, () => {
    m.box(0, 14, -1, 34, 30, 6, TL.SCORCH, { bevel: 2, rot: 0.18 });
    for (let k = 0; k < 4; k++) m.tube([R() * 20 - 10, 10 + R() * 14, 3], [R() * 30 - 15, 18 + R() * 20, 8 + R() * 10], 2.6, TL.SCORCH, { seg: 6, uvV: 10 });
    m.box(-8, 22, 4, 16, 10, 3, TL.SCORCH, { bevel: 1, rot: -0.7 });
  });
  return m;
}

function cannonWreck() {
  const m = new TankMesh();
  m.with({ tint: [1, 1, 1] }, () => {
    m.lathe(0, 0, [[15, -1], [14, 3], [10, 5]], TL.SCORCH, { seg: 9 });
    m.tube([2, 2, 4], [9, 17, 9], 3, TL.SCORCH, { seg: 7, uvV: 10 });
  });
  return m;
}

/** Build every part once (pure data, reusable across GL contexts). */
export function buildWhiteFang() {
  const out = {
    hull: hull(), trackL: belt(-1), trackR: belt(1), frame: frame(), wheel: wheel(),
    turret: turret(), rail: rail(), cannonBase: cannonBase(), cannonBarrel: cannonBarrel(),
    mortarPod: mortarPod(), mortarWreck: mortarWreck(), cannonWreck: cannonWreck(),
  };
  return Object.fromEntries(Object.entries(out).map(([k, m]) => [k, m.finish()]));
}
