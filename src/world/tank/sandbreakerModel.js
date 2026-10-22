import { TankMesh } from './TankMesh.js';
import { TL } from './tankTextures.js';

// SANDBREAKER — armoured siege locomotive + three cars, built as real 3D parts
// for the arena world pass (drawn by TankRenderer under the `sb.` prefix).
//
// Model space (every vehicle): +y = FORWARD (the locomotive's ram; toward the
// player when the train heads down the screen), +x = right as seen from above
// in that pose, +z = up. z = 0 is the ground; the rail heads are at
// SB.railTop, the rails at x = ±SB.gauge. 1 unit ≈ 1 gameplay screen unit at
// the boss's row.
//
// Parts (separate meshes so the rig can animate them):
//   loco            hull, beast-head ram, boiler, stacks, sponsons, deck kit
//   locoFrame       chassis, cylinders + slide bars, splashers (static)
//   wheel           unit wheel disc (instanced: drivers, trucks, bogies)
//   rodC / rodM / cross   coupling rod, main rod, crosshead + piston rod
//   bogie           2-axle bogie side frames (cars + the trailing truck)
//   coupler         drawbar between two vehicles (scaled to the gap)
//   car1 / car2 / car3    artillery, rocket and command cars
//   scBase / scBarrel     locomotive side-cannon turret (yaw) / barrel (recoil)
//   mbTurret / mbBarrel   twin main battery (yaw) / barrel (recoil)
//   mortar          rear mortar battery (elevates)
//   howTurret / howBarrel car 1 heavy howitzer (yaw / elevate + recoil)
//   rotBase / gatling     car 1 rotary guns (yaw / barrel spin)
//   rocketPod       car 2 rocket launchers (yaw + elevate)
//   radar           car 3 search radar (spins)
//   wreck           scorched stub left by a destroyed mount

const W = [1, 1, 1];
const GOLDT = [1.06, 0.97, 0.8];
const STEEL = [0.86, 0.8, 0.72];     // gunmetal warmed by the desert light (TL.DARK is cool grey)
const IRON = [0.62, 0.58, 0.52];
const AMBER = [1.5, 0.78, 0.22];
const HOT = [1.7, 0.6, 0.16];
const RED = [1.6, 0.18, 0.08];

export const SB = {
  railTop: 12,
  gauge: 55,
  loco: {
    front: 152, rear: -146,
    pivots: [56, -99],                      // rail pivots: driver group centre / trailing truck
    drivers: [74, 38, 2, -34], dr: 17,
    trailing: [-84, -114], tr: 13,
    pony: [112], pr: 11,
    crank: 8, rodX: 67, mainLen: 60,
    cannons: [[-64, 56, 56], [64, 56, 56]], // hull space: side-cannon turrets
    scBarrels: [[-5, 6, 8], [5, 6, 8]],     // cannon space: barrel pivots
    scMuzzle: [0, 46, 0],                   // barrel space
    turret: [0, -84, 80],                   // main battery turret pivot (on the barbette)
    mbBarrels: [[-10, 22, 12], [10, 22, 12]],
    mbMuzzle: [0, 100, 0],
    mortar: [0, -126, 58],
    mortarTubes: [[-12, 32, 5], [0, 32, 5], [12, 32, 5], [-12, 32, 12], [0, 32, 12], [12, 32, 12]],
    mortarMouth: [0, 34, 8.5],
    stacks: [[-18, 74, 100], [18, 74, 100]],
    safety: [[-7, -30, 92], [7, -30, 92]],
    vents: [[-30, 40, 59], [30, 40, 59], [-30, -40, 59], [30, -40, 59]],
    eyes: [[-15, 112, 58], [15, 112, 58]],
    head: [0, 118, 50],
  },
  cars: [
    {
      kind: 'artillery', half: 110, bogies: [72, -72],
      how: [0, -18, 64], howBarrels: [[-8, 18, 10], [8, 18, 10]], howMuzzle: [0, 70, 0],
      rot: [[-30, 76, 37], [30, 76, 37]], gatling: [0, 4, 9], gatMuzzle: [0, 42, 0],
    },
    {
      kind: 'rocket', half: 105, bogies: [68, -68],
      pods: [[-22, 8, 42], [22, 8, 42]],
      tubes: [[-9, 22, 6], [0, 22, 6], [9, 22, 6], [-9, 22, 14], [0, 22, 14], [9, 22, 14], [-9, 22, 22], [0, 22, 22], [9, 22, 22]],
    },
    { kind: 'command', half: 95, bogies: [60, -60], radar: [0, -66, 84] },
  ],
  bogie: { axles: [16, -16], r: 13 },
  couplerZ: 30,
};

function rnd(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Drift of sand settled on a flat (faceted lump, sand texture). */
function drift(m, x, y, z, r, R, h = 0.45) {
  m.with({ tint: W, ao: null }, () => m.lathe(x, y, [[r, z], [r * (0.7 + R() * 0.15), z + r * h * 0.5], [r * 0.3, z + r * h]], TL.SAND, { seg: 7, rot: R() * 6, uv: 40 }));
}

/** Hazard stripe plate lying on a deck at height z. */
function stripe(m, x, y, z, w, d) {
  m.with({ tint: W, ao: null }, () => m.quad([[x - w / 2, y - d / 2, z], [x + w / 2, y - d / 2, z], [x + w / 2, y + d / 2, z], [x - w / 2, y + d / 2, z]], [[0, 0], [w / 30, 0], [w / 30, -0.45], [0, -0.45]], TL.SBMARK));
}

/** Stencil panel (SB-02 / IRONCLAD SYNDICATE) lying on a deck. */
function stencil(m, x, y, z, w, d, flip = false) {
  const v = flip ? [[1, -0.55], [0, -0.55], [0, -0.97], [1, -0.97]] : [[0, -0.97], [1, -0.97], [1, -0.55], [0, -0.55]];
  m.with({ tint: W, ao: null }, () => m.quad([[x - w / 2, y - d / 2, z], [x + w / 2, y - d / 2, z], [x + w / 2, y + d / 2, z], [x - w / 2, y + d / 2, z]], v, TL.SBMARK));
}

function lamp(m, x, y, z, col = AMBER, s = 1) {
  m.with({ tint: STEEL }, () => m.box(x, y, z - 1, 7 * s, 5 * s, 3, TL.DARK, { bevel: 0.8 }));
  m.with({ tint: col, em: 1, ao: null }, () => m.box(x, y + 0.6 * s, z + 1.6, 5 * s, 3.4 * s, 1.4, TL.GLOW, { bevel: 0.4 }));
}

function hatch(m, x, y, z, r) {
  m.with({ tint: W }, () => m.lathe(x, y, [[r, z], [r, z + 1.6], [r * 0.85, z + 2.4]], TL.BRONZE, { seg: 12, uv: 30 }));
  m.with({ tint: STEEL }, () => m.box(x, y, z + 2.2, r * 1.1, 1.6, 1.2, TL.DARK, { bevel: 0.3 }));
}

/** Buffers + drawbar socket at a vehicle end (dir +1 front, -1 rear). */
function buffers(m, y, dir) {
  m.with({ tint: STEEL }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 30, y, 30], [s * 30, y + dir * 7, 30], 3, TL.BARREL, { seg: 8, uvV: 10 });
      m.tube([s * 30, y + dir * 7, 30], [s * 30, y + dir * 9, 30], 6, TL.DARK, { seg: 10, caps: 'end', uvV: 6 });
    }
    m.box(0, y + dir * 3, 25, 20, 8, 10, TL.DARK, { bevel: 1.2 });
  });
}

// ---------------------------------------------------------------- locomotive

function loco() {
  const m = new TankMesh(), R = rnd(19), L = SB.loco;
  // Armoured body: sloped skirts over the frame, bevelled deck edge.
  m.with({ tint: GOLDT, ao: [28, 44] }, () => m.loft([
    { pts: [-47, -142, 47, -142, 47, 92, 40, 98, -40, 98, -47, 92], z: 28 },
    { pts: [-46, -140, 46, -140, 46, 90, 39, 96, -39, 96, -46, 90], z: 50 },
    { pts: [-40, -134, 40, -134, 40, 86, 34, 90, -34, 90, -40, 86], z: 58 },
  ], { layer: TL.GOLD, uv: 120 }));
  // Side-cannon sponsons over the front drivers.
  for (const s of [-1, 1]) {
    m.with({ tint: GOLDT, ao: [36, 50] }, () => m.loft([
      { pts: [s * 38, 24, s * 74, 30, s * 78, 50, s * 74, 84, s * 38, 88], z: 38 },
      { pts: [s * 38, 26, s * 72, 32, s * 76, 50, s * 72, 82, s * 38, 86], z: 52 },
      { pts: [s * 38, 30, s * 68, 35, s * 72, 50, s * 68, 79, s * 38, 82], z: 56 },
    ], { layer: TL.GOLD, uv: 80 }));
    stripe(m, s * 70, 50, 56.05, 4, 30);
    // Ammunition feed chute from the deck magazine to the cannon.
    m.with({ tint: STEEL }, () => {
      m.box(s * 30, 30, 58, 16, 22, 6, TL.DARK, { bevel: 1.2 });
      m.tube([s * 34, 36, 62], [s * 54, 50, 60], 2.8, TL.BRONZE, { seg: 8, uvV: 16 });
    });
  }
  // Boiler: a riveted gold drum along the spine with bronze bands.
  m.with({ tint: GOLDT, ao: [56, 70] }, () => m.tube([0, -62, 62], [0, 62, 62], 21, TL.GOLD, { seg: 18, uvU: 3, uvV: 90, caps: 'end', capLayer: TL.BRONZE }));
  m.with({ tint: W }, () => { for (const y of [-46, -23, 0, 23, 46]) m.tube([0, y - 2.4, 62], [0, y + 2.4, 62], 22.6, TL.BRONZE, { seg: 18, uvU: 3, uvV: 10 }); });
  // Steam dome, sand dome, safety valves, whistle.
  m.with({ tint: W }, () => {
    m.lathe(0, 14, [[12, 78], [11.5, 86], [9, 90], [4, 91.5]], TL.BRONZE, { seg: 14, uv: 40 });
    m.lathe(0, -12, [[9, 80], [8.5, 86], [5, 88.5]], TL.GOLD, { seg: 12, uv: 40 });
    for (const [x, y, z] of L.safety) m.tube([x, y, 80], [x, y, z], 2.2, TL.BRONZE, { seg: 8, caps: 'end', capLayer: TL.DARK, uvV: 10 });
    m.tube([0, 34, 80], [0, 34, 90], 1.6, TL.GOLD, { seg: 8, caps: 'end', uvV: 10 });
  });
  // Pipe runs along the boiler, sand pipes down to the drivers.
  m.with({ tint: STEEL }, () => {
    for (const s of [-1, 1]) {
      m.tube([s * 22, -56, 70], [s * 22, 58, 70], 1.8, TL.BARREL, { seg: 6, uvV: 30 });
      m.tube([s * 24.5, -56, 64], [s * 24.5, 58, 64], 1.3, TL.BARREL, { seg: 6, uvV: 30 });
      for (const y of [-34, 2, 38]) m.tube([s * 24, y, 62], [s * 40, y, 56], 1.4, TL.BRONZE, { seg: 6, uvV: 10 });
    }
  });
  // Firebox glow behind the boiler (the furnace door grille) and the barbette.
  m.with({ tint: STEEL }, () => m.box(0, -70, 58, 34, 14, 12, TL.DARK, { bevel: 1.5 }));
  m.with({ tint: HOT, em: 1, ao: null }, () => { for (const x of [-10, 0, 10]) m.box(x, -63.4, 60, 6, 0.8, 7, TL.GLOW, { bevel: 0 }); });
  m.with({ tint: STEEL, ao: [58, 66] }, () => m.lathe(L.turret[0], L.turret[1], [[31, 58], [31, 78], [29, 80]], TL.DARK, { seg: 24, uv: 60 }));
  // Exhaust stacks rising behind the head (flared caps, sooted mouths).
  m.with({ tint: W }, () => {
    for (const [x, y, z] of L.stacks) {
      m.tube([x, y - 2, 56], [x, y, z - 8], 7, TL.BRONZE, { seg: 12, uvV: 30 });
      m.tube([x, y, z - 8], [x, y, z], 7, TL.GOLD, { r1: 10, seg: 12, caps: 'end', capLayer: TL.SCORCH, uvV: 10 });
    }
  });
  // Deck kit: hatches, vents, armour applique, stencils, cable reel, lamps.
  for (const s of [-1, 1]) {
    hatch(m, s * 28, -14, 58, 7);
    m.with({ tint: STEEL }, () => m.box(s * 30, -44, 58, 14, 20, 1.6, TL.GRILLE, { bevel: 0.2, uv: 20 }));
    m.with({ tint: GOLDT }, () => {
      m.box(s * 30, 74, 58, 16, 20, 3, TL.GOLD, { bevel: 1.2, uv: 60 });
      m.box(s * 34, -100, 58, 12, 26, 4, TL.GOLD, { bevel: 1.2, uv: 60 });
    });
    lamp(m, s * 44, -140, 50, RED, 0.9);
  }
  stencil(m, 0, -104, 58.05, 26, 20);
  stripe(m, 0, -138, 58.05, 64, 5);
  // Rear deck: ammunition lockers either side of the mortar battery.
  m.with({ tint: STEEL }, () => { for (const s of [-1, 1]) m.box(s * 33, -124, 58, 12, 22, 9, TL.DARK, { bevel: 1.4 }); });
  buffers(m, L.rear + 4, -1);

  // ---- The beast head: wedge ram + sculpted mask with glowing eyes.
  m.with({ tint: W, ao: [4, 30] }, () => m.loft([
    { pts: [-54, 92, 54, 92, 56, 112, 0, 152, -56, 112], z: 3 },
    { pts: [-52, 90, 52, 90, 53, 110, 0, 146, -53, 110], z: 28 },
    { pts: [-50, 90, 50, 90, 51, 108, 0, 142, -51, 108], z: 33 },
  ], { layer: TL.BRONZE, top: TL.GOLD, uv: 100 }));
  // Plough blades along the leading edges (dark steel slats, angled outward).
  m.with({ tint: STEEL }, () => {
    for (const [a, b] of [[[-56, 112], [0, 152]], [[0, 152], [56, 112]]]) {
      const n = 7, ex = b[0] - a[0], ey = b[1] - a[1];
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = a[0] + ex * t, y = a[1] + ey * t;
        m.box(x, y - 3, 3, 3, 12, 22, TL.BARREL, { bevel: 0.6, rot: Math.atan2(ey, ex) + Math.PI / 2 });
      }
    }
  });
  m.with({ tint: GOLDT, ao: [33, 50] }, () => m.loft([
    { pts: [-44, 84, 44, 84, 46, 104, 18, 128, 0, 138, -18, 128, -46, 104], z: 33 },
    { pts: [-38, 82, 38, 82, 38, 100, 15, 120, 0, 128, -15, 120, -38, 100], z: 54 },
    { pts: [-28, 80, 28, 80, 26, 96, 11, 110, 0, 115, -11, 110, -26, 96], z: 68 },
  ], { layer: TL.GOLD, uv: 70 }));
  // Snout ridge and brow plates.
  m.with({ tint: W }, () => {
    m.tube([0, 82, 72], [0, 134, 42], 4.5, TL.BRONZE, { r1: 2.5, seg: 6, uvV: 30 });
    for (const s of [-1, 1]) {
      m.tube([s * 6, 98, 68], [s * 26, 106, 61], 3.4, TL.BRONZE, { r1: 2, seg: 6, uvV: 20 });   // brow
      m.tube([s * 12, 124, 46], [s * 34, 112, 44], 2.6, TL.BRONZE, { r1: 1.4, seg: 6, uvV: 20 }); // cheek line
      // Swept "ears": armoured fins rising back over the neck.
      m.tube([s * 22, 86, 64], [s * 36, 64, 96], 7, TL.GOLD, { r1: 1.2, seg: 5, uvV: 30 });
    }
  });
  // Eyes: amber lenses in dark sockets on the face slope, a gem on the brow.
  for (const [x, y, z] of L.eyes) {
    m.with({ tint: [0.4, 0.36, 0.3] }, () => m.lathe(x, y, [[8, z - 4], [7.6, z + 2], [6.2, z + 4]], TL.DARK, { seg: 12 }));
    m.with({ tint: AMBER, em: 1, ao: null }, () => m.lathe(x, y, [[6, z + 3.6], [4.6, z + 5.6], [1, z + 6.6]], TL.GLOW, { seg: 14, topUv: 12 }));
  }
  m.with({ tint: W }, () => m.lathe(0, 96, [[7, 67], [6, 71], [3, 73]], TL.BRONZE, { seg: 6 }));
  m.with({ tint: HOT, em: 1, ao: null }, () => m.lathe(0, 96, [[4.4, 72], [2.6, 74.5], [0.4, 75.4]], TL.GLOW, { seg: 6, topUv: 10 }));
  // Tusks jutting from the jaw.
  m.with({ tint: [1, 0.95, 0.85] }, () => { for (const s of [-1, 1]) m.tube([s * 24, 128, 30], [s * 30, 150, 18], 4.2, TL.BRONZE, { r1: 0.6, seg: 7, uvV: 20 }); });
  // Headlamps on the ram shoulders, marker lamps on the jaw.
  for (const s of [-1, 1]) { lamp(m, s * 44, 108, 33.5, AMBER, 1.2); lamp(m, s * 20, 132, 33.5, AMBER, 0.8); }
  // Sand banked on the deck corners and in the ram's lee.
  for (const [x, y, r] of [[-38, -128, 8], [36, -130, 7], [-36, 4, 6], [38, -60, 7], [-34, 64, 5], [0, -92, 5], [-46, 98, 6], [46, 100, 6], [-28, 92, 5], [30, 90, 5]]) drift(m, x, y, y > 88 ? 33 : 58, r, R);
  return m;
}

/** Chassis, cylinders, slide bars, splashers, trailing-truck mounting (all static). */
function locoFrame() {
  const m = new TankMesh(), L = SB.loco;
  m.with({ tint: STEEL, ao: [10, 26] }, () => {
    m.box(0, -8, 12, 88, 262, 18, TL.DARK, { bevel: 1 });
    for (const s of [-1, 1]) {
      // Cylinder block + steam chest with the slide bars running back to the drivers.
      m.tube([s * 63, 102, 30], [s * 63, 128, 30], 9, TL.BRONZE, { seg: 12, caps: true, capLayer: TL.DARK, uvV: 20 });
      m.box(s * 58, 115, 36, 10, 26, 8, TL.DARK, { bevel: 1.5 });
      for (const z of [26, 34]) m.box(s * 67, 92, z - 0.8, 3, 22, 1.6, TL.BARREL, { bevel: 0.2 });
      // Splashers over each driver and leaf-spring hangers on the frame.
      for (const y of L.drivers) {
        m.box(s * 48, y, 22, 4, 10, 8, TL.DARK, { bevel: 0.6 });
        m.box(s * 46, y, 28, 3, 30, 3, TL.BARREL, { bevel: 0.4 });
      }
      // Brake hangers between the drivers.
      for (let k = 0; k < L.drivers.length - 1; k++) m.box(s * 47, (L.drivers[k] + L.drivers[k + 1]) / 2, 14, 3, 6, 14, TL.DARK, { bevel: 0.4 });
    }
  });
  return m;
}

/** Unit wheel disc facing +x (scaled per instance: x = thickness, y = z = radius). */
function wheel() {
  const m = new TankMesh();
  m.with({ tint: [0.9, 0.86, 0.8] }, () => {
    m.tube([0, 0, 0], [1, 0, 0], 1, TL.DARK, { caps: 'end', capLayer: TL.RWHEEL, seg: 18, uvU: 2, uvV: 6 });
    m.tube([-0.2, 0, 0], [0.12, 0, 0], 1.1, TL.BARREL, { seg: 18, uvV: 4 }); // flange
  });
  return m;
}

/** Coupling rod (rod space: crank pins at the driver y's, z = 0). */
function rodC() {
  const m = new TankMesh(), L = SB.loco;
  m.with({ tint: [1, 0.95, 0.85] }, () => {
    m.box(0, (L.drivers[0] + L.drivers[3]) / 2, -2, 3.6, L.drivers[0] - L.drivers[3] + 8, 4, TL.BRONZE, { bevel: 0.6, uv: 30 });
    for (const y of L.drivers) m.tube([-2, y, 0], [3, y, 0], 3.2, TL.GOLD, { seg: 10, caps: 'end', uvV: 6 });
  });
  return m;
}

/** Main rod: crank-pin end at the origin, crosshead end at +y = mainLen. */
function rodM() {
  const m = new TankMesh(), Ln = SB.loco.mainLen;
  m.with({ tint: [1, 0.95, 0.85] }, () => {
    m.box(0, Ln / 2, -2.2, 3.4, Ln, 4.4, TL.GOLD, { bevel: 0.6, uv: 30 });
    m.tube([-2, 0, 0], [3, 0, 0], 4, TL.BRONZE, { seg: 10, caps: 'end', uvV: 6 });
  });
  return m;
}

/** Crosshead block + piston rod running forward into the cylinder. */
function cross() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.box(0, 0, -3, 5, 8, 6, TL.DARK, { bevel: 0.6 });
    m.tube([0, 3, 0], [0, 26, 0], 1.6, TL.BARREL, { seg: 8, uvV: 20 });
  });
  return m;
}

/** Two-axle bogie: outside frames with axle boxes and leaf springs, bolster across. */
function bogie() {
  const m = new TankMesh(), G = SB.gauge;
  m.with({ tint: STEEL, ao: [10, 30] }, () => {
    for (const s of [-1, 1]) {
      m.box(s * (G + 10), 0, 14, 4, 56, 12, TL.DARK, { bevel: 0.8 });
      for (const y of SB.bogie.axles) {
        m.box(s * (G + 11), y, 18, 7, 9, 12, TL.DARK, { bevel: 1 });                  // axle box
        for (let k = 0; k < 3; k++) m.box(s * (G + 11), y, 30 + k * 1.6, 5, 22 - k * 5, 1.4, TL.BARREL, { bevel: 0.2 }); // leaf spring
      }
    }
    m.box(0, 0, 24, G * 2 + 22, 12, 6, TL.DARK, { bevel: 1 });                        // bolster
  });
  return m;
}

/** Drawbar between two vehicles: spans y 0..1 (scaled to the gap), at z = 0. */
function coupler() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.box(0, 0.5, -3, 8, 1, 6, TL.DARK, { bevel: 0, uv: 20 });
    m.box(0, 0.5, 3, 3, 1, 1.4, TL.BRONZE, { bevel: 0, uv: 20 });
  });
  return m;
}

// ---------------------------------------------------------------- cars

/** Shared car underframe: frame, deck, end beams, buffers, skirt armour between the bogies. */
function underframe(m, half, bogieY) {
  m.with({ tint: STEEL, ao: [20, 34] }, () => {
    m.box(0, 0, 20, 90, half * 2 - 6, 14, TL.DARK, { bevel: 1 });
    for (const s of [-1, 1]) m.box(0, s * (half - 4), 22, 98, 8, 12, TL.DARK, { bevel: 1.5 });
  });
  m.with({ tint: W }, () => m.box(0, 0, 34, 98, half * 2 - 2, 3, TL.BRONZE, { bevel: 1, uv: 70 }));
  const inner = bogieY - 30;
  m.with({ tint: GOLDT, ao: [22, 38] }, () => { for (const s of [-1, 1]) m.box(s * 48, 0, 22, 4, inner * 2, 16, TL.GOLD, { bevel: 1, uv: 80 }); });
  buffers(m, half, 1);
  buffers(m, -half, -1);
}

function car1() {
  const m = new TankMesh(), R = rnd(23), C = SB.cars[0], h = C.half;
  underframe(m, h, C.bogies[0]);
  // Armoured casemate carrying the howitzer.
  m.with({ tint: GOLDT, ao: [37, 52] }, () => m.loft([
    { pts: [-46, -66, 46, -66, 46, 30, 36, 40, -36, 40, -46, 30], z: 37 },
    { pts: [-43, -62, 43, -62, 43, 27, 34, 37, -34, 37, -43, 27], z: 58 },
    { pts: [-37, -57, 37, -57, 37, 22, 29, 31, -29, 31, -37, 22], z: 64 },
  ], { layer: TL.GOLD, uv: 100 }));
  m.with({ tint: STEEL, ao: [62, 68] }, () => m.lathe(C.how[0], C.how[1], [[24, 63], [24, 66], [22.5, 67]], TL.DARK, { seg: 20 }));
  stencil(m, 22, 18, 64.05, 18, 12);
  // Rotary-gun rings on the front deck, ammunition bins between them.
  for (const [x, y, z] of C.rot) m.with({ tint: STEEL }, () => m.lathe(x, y, [[15, z], [15, z + 2.5], [13.5, z + 3]], TL.DARK, { seg: 16 }));
  m.with({ tint: STEEL }, () => { m.box(0, 78, 37, 18, 22, 9, TL.DARK, { bevel: 1.2 }); m.box(0, 52, 37, 26, 10, 5, TL.DARK, { bevel: 1 }); });
  stripe(m, 0, 66.5, 46.05, 18, 3);
  // Rear deck: shell racks and crates.
  m.with({ tint: W }, () => {
    for (let k = 0; k < 4; k++) m.tube([-26 + k * 6, -100, 41], [-26 + k * 6, -76, 41], 2.6, TL.GOLD, { seg: 8, caps: true, capLayer: TL.BRONZE, uvV: 20 });
    m.box(22, -88, 37, 22, 20, 10, TL.BRONZE, { bevel: 1.2, uv: 40 });
    m.box(22, -88, 47, 18, 16, 0.6, TL.SBMARK, { bevel: 0, uv: 30 });
  });
  for (const s of [-1, 1]) { lamp(m, s * 44, h - 4, 37, AMBER, 0.8); lamp(m, s * 44, -h + 4, 37, RED, 0.8); }
  stripe(m, 0, h - 3, 37.05, 70, 4);
  for (const [x, y, r] of [[-36, -96, 6], [38, 94, 5], [-38, 40, 5], [36, -70, 6], [0, 0, 4]]) drift(m, x, y, Math.abs(y) < 40 && Math.abs(x) < 37 ? 64 : 37, r, R);
  return m;
}

function car2() {
  const m = new TankMesh(), R = rnd(29), C = SB.cars[1], h = C.half;
  underframe(m, h, C.bogies[0]);
  // Armoured bulwarks along both sides, launcher rings, spare-rocket racks.
  m.with({ tint: GOLDT, ao: [37, 48] }, () => { for (const s of [-1, 1]) m.box(s * 45, 0, 37, 7, h * 2 - 20, 11, TL.GOLD, { bevel: 1.4, uv: 80 }); });
  for (const [x, y] of C.pods) m.with({ tint: STEEL }, () => m.lathe(x, y, [[15, 37], [15, 41], [13, 42]], TL.DARK, { seg: 16 }));
  m.with({ tint: W }, () => {
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const x = s * (6 + k * 6);
      m.tube([x, -50, 40], [x, -14, 40], 2.4, TL.BRONZE, { seg: 8, caps: 'end', capLayer: TL.SCORCH, uvV: 20 });
    }
    // Fuel tanks at the rear.
    for (const s of [-1, 1]) {
      m.tube([s * 20, -96, 48], [s * 20, -58, 48], 10, TL.BRONZE, { seg: 14, caps: true, capLayer: TL.GOLD, uvU: 2, uvV: 30 });
      m.tube([s * 20, -80, 48], [s * 20, -76, 48], 10.6, TL.SBMARK, { seg: 14, uvU: 2, uvV: 30 });
    }
  });
  // Loading crane mast at the front.
  m.with({ tint: STEEL }, () => { m.tube([0, 72, 37], [0, 72, 70], 2.4, TL.DARK, { seg: 8, uvV: 20 }); m.tube([0, 72, 68], [0, 38, 60], 1.6, TL.DARK, { seg: 6, uvV: 20 }); m.box(0, 84, 37, 26, 14, 8, TL.DARK, { bevel: 1 }); });
  stripe(m, 0, h - 3, 37.05, 70, 4);
  stencil(m, 0, 60, 37.05, 26, 16);
  for (const s of [-1, 1]) { lamp(m, s * 44, h - 4, 48, AMBER, 0.8); lamp(m, s * 44, -h + 4, 48, RED, 0.8); }
  for (const [x, y, r] of [[-30, 90, 5], [34, -40, 6], [-36, -20, 5], [30, 70, 5]]) drift(m, x, y, 37, r, R);
  return m;
}

function car3() {
  const m = new TankMesh(), R = rnd(31), C = SB.cars[2], h = C.half;
  underframe(m, h, C.bogies[0]);
  m.with({ tint: GOLDT, ao: [37, 56] }, () => m.loft([
    { pts: [-46, -46, 46, -46, 46, 62, 38, 70, -38, 70, -46, 62], z: 37 },
    { pts: [-43, -43, 43, -43, 43, 59, 36, 66, -36, 66, -43, 59], z: 66 },
    { pts: [-37, -38, 37, -38, 37, 54, 31, 60, -31, 60, -37, 54], z: 72 },
  ], { layer: TL.GOLD, uv: 100 }));
  // Roof: skylights, hatches, antenna masts, searchlights.
  m.with({ tint: AMBER, em: 1, ao: null }, () => { for (const y of [-20, 0, 20, 40]) for (const s of [-1, 1]) m.box(s * 22, y, 72, 10, 7, 0.8, TL.GLOW, { bevel: 0 }); });
  hatch(m, 0, 30, 72, 8);
  m.with({ tint: STEEL }, () => {
    for (const [x, y, hgt] of [[-30, -30, 44], [30, 50, 36]]) { m.tube([x, y, 72], [x, y, 72 + hgt], 0.9, TL.BARREL, { seg: 5, uvV: 20 }); m.box(x, y, 72, 5, 5, 3, TL.DARK, { bevel: 0.4 }); }
    m.tube([C.radar[0], C.radar[1], 37], [C.radar[0], C.radar[1], C.radar[2] - 4], 3, TL.DARK, { seg: 10, uvV: 30 });
    m.lathe(C.radar[0], C.radar[1], [[10, 37], [9, 42], [6, 44]], TL.DARK, { seg: 12 });
  });
  for (const s of [-1, 1]) { lamp(m, s * 30, 64, 72, [1.6, 1.5, 1.2], 1.1); lamp(m, s * 44, h - 4, 37, AMBER, 0.8); lamp(m, s * 44, -h + 4, 37, RED, 0.9); }
  stencil(m, 0, -10, 72.05, 30, 20);
  stripe(m, 0, -h + 3, 37.05, 70, 4);
  m.with({ tint: W }, () => { for (const s of [-1, 1]) m.box(s * 26, -78, 37, 22, 22, 10, TL.BRONZE, { bevel: 1.2, uv: 40 }); });
  for (const [x, y, r] of [[-32, 50, 6], [34, -30, 5], [0, -86, 6], [36, 80, 5]]) drift(m, x, y, Math.abs(y) < 55 && Math.abs(x) < 38 ? 72 : 37, r, R);
  return m;
}

// ---------------------------------------------------------------- weapons

function scBase() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => m.lathe(0, 0, [[15, -1], [15, 3], [13.5, 4.5]], TL.DARK, { seg: 16 }));
  m.with({ tint: GOLDT }, () => m.lathe(0, 0, [[13.4, 4], [12.8, 10], [10, 14.5], [5, 16.5]], TL.GOLD, { seg: 12, uv: 40 }));
  m.with({ tint: STEEL }, () => { m.box(0, 7, 3, 18, 8, 10, TL.DARK, { bevel: 1.2 }); m.box(-7, -6, 14.5, 5, 6, 3, TL.DARK, { bevel: 0.6 }); });
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(-7, -3.2, 15.4, 3, 0.6, 1.4, TL.GLOW, { bevel: 0 }));
  return m;
}

function scBarrel() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.tube([0, 2, 0], [0, 40, 0], 2.7, TL.BARREL, { seg: 10, uvV: 30 });
    m.tube([0, 14, 0], [0, 26, 0], 3.6, TL.BRONZE, { seg: 10, uvV: 10 }); // heat jacket
    m.tube([0, 38, 0], [0, 46, 0], 3.8, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.SCORCH, uvV: 10 });
  });
  return m;
}

function mbTurret() {
  const m = new TankMesh();
  m.with({ tint: GOLDT, ao: [0, 8] }, () => m.loft([
    { pts: [-30, -26, 30, -26, 34, -10, 34, 20, 24, 30, -24, 30, -34, 20, -34, -10], z: 0 },
    { pts: [-28, -24, 28, -24, 32, -9, 32, 18, 22, 27, -22, 27, -32, 18, -32, -9], z: 12 },
    { pts: [-24, -20, 24, -20, 28, -7, 28, 15, 19, 23, -19, 23, -28, 15, -28, -7], z: 18 },
  ], { layer: TL.GOLD, uv: 70 }));
  m.with({ tint: STEEL }, () => {
    m.box(0, 26, 4, 44, 10, 14, TL.DARK, { bevel: 2 });                 // mantlet
    m.lathe(14, -8, [[8, 18], [7.5, 22], [5, 24]], TL.DARK, { seg: 10 }); // commander's sight
    m.box(-14, -10, 18, 14, 14, 1.4, TL.GRILLE, { bevel: 0.2, uv: 16 });  // breech vents
  });
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(14, -2.6, 21, 6, 0.6, 1.6, TL.GLOW, { bevel: 0 }));
  stripe(m, 0, -22, 18.05, 40, 3);
  stencil(m, -6, 6, 18.05, 22, 14);
  return m;
}

function mbBarrel() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.tube([0, 0, 0], [0, 86, 0], 4.2, TL.BARREL, { seg: 12, uvV: 40 });
    m.tube([0, 30, 0], [0, 46, 0], 6, TL.DARK, { seg: 12, uvV: 20 });   // fume extractor
    m.tube([0, 84, 0], [0, 100, 0], 6.2, TL.DARK, { seg: 12, caps: 'end', capLayer: TL.SCORCH, uvV: 20 });
    for (const y of [89, 94]) m.box(0, y, -1.5, 15, 1.4, 3, TL.DARK, { bevel: 0.2 });
  });
  m.with({ tint: W }, () => m.tube([0, 6, 0], [0, 18, 0], 5.2, TL.BRONZE, { seg: 12, uvV: 10 }));
  return m;
}

/** Mortar battery: pivot on its rear edge, six tubes facing +y (elevates about x). */
function mortar() {
  const m = new TankMesh(), L = SB.loco;
  m.with({ tint: GOLDT, ao: null }, () => m.box(0, 16, 0, 42, 32, 17, TL.GOLD, { bevel: 2, uv: 60 }));
  m.with({ tint: STEEL }, () => {
    for (const [x, , z] of L.mortarTubes) m.tube([x, 26, z], [x, 34, z], 3.8, TL.BARREL, { seg: 10, caps: 'end', capLayer: TL.SCORCH, uvV: 12 });
    m.box(0, 4, 17, 24, 8, 2.5, TL.DARK, { bevel: 0.8 });
  });
  for (const s of [-1, 1]) stripe(m, s * 16, 16, 17.05, 6, 26);
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(0, 18, 17.1, 14, 2, 0.6, TL.GLOW, { bevel: 0 }));
  return m;
}

function howTurret() {
  const m = new TankMesh();
  m.with({ tint: GOLDT, ao: [0, 6] }, () => m.loft([
    { pts: [-23, -22, 23, -22, 26, -6, 26, 14, 18, 22, -18, 22, -26, 14, -26, -6], z: 0 },
    { pts: [-21, -20, 21, -20, 24, -5, 24, 12, 16, 20, -16, 20, -24, 12, -24, -5], z: 13 },
    { pts: [-17, -16, 17, -16, 20, -3, 20, 9, 13, 16, -13, 16, -20, 9, -20, -3], z: 18 },
  ], { layer: TL.GOLD, uv: 60 }));
  m.with({ tint: STEEL }, () => { m.box(0, 19, 4, 30, 8, 12, TL.DARK, { bevel: 1.6 }); m.box(10, -10, 18, 8, 8, 3, TL.DARK, { bevel: 0.6 }); });
  stripe(m, 0, -18, 18.05, 30, 3);
  return m;
}

function howBarrel() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    m.tube([0, 0, 0], [0, 60, 0], 5, TL.BARREL, { seg: 12, uvV: 30 });
    m.tube([0, 58, 0], [0, 70, 0], 7.2, TL.DARK, { seg: 12, caps: 'end', capLayer: TL.SCORCH, uvV: 10 });
    m.box(0, 64, -2, 18, 2, 4, TL.DARK, { bevel: 0.3 });
  });
  m.with({ tint: W }, () => m.tube([0, 4, 0], [0, 20, 0], 6.4, TL.BRONZE, { seg: 12, uvV: 10 }));
  return m;
}

function rotBase() {
  const m = new TankMesh();
  m.with({ tint: GOLDT }, () => m.lathe(0, 0, [[13, 0], [12.5, 8], [10, 13], [5, 14.5]], TL.GOLD, { seg: 12, uv: 40 }));
  m.with({ tint: STEEL }, () => { m.box(0, 8, 3, 12, 10, 10, TL.DARK, { bevel: 1 }); m.box(0, -10, 2, 14, 8, 9, TL.BRONZE, { bevel: 1 }); });
  m.with({ tint: AMBER, em: 1, ao: null }, () => m.box(4, 2, 14.2, 3, 3, 0.6, TL.GLOW, { bevel: 0 }));
  return m;
}

/** Six-barrel rotary cluster spinning about +y (barrel space: axis through the origin). */
function gatling() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, x = Math.cos(a) * 3.2, z = Math.sin(a) * 3.2; m.tube([x, 4, z], [x, 42, z], 1.3, TL.BARREL, { seg: 6, caps: 'end', capLayer: TL.SCORCH, uvV: 20 }); }
    for (const y of [10, 30, 40]) m.tube([0, y, 0], [0, y + 2.4, 0], 5.2, TL.DARK, { seg: 10, uvV: 6 });
    m.tube([0, 0, 0], [0, 8, 0], 6, TL.BRONZE, { seg: 10, uvV: 6 });
  });
  return m;
}

/** Rocket launcher: pivot under its rear edge, 3×3 tubes opening toward +y. */
function rocketPod() {
  const m = new TankMesh(), C = SB.cars[1];
  m.with({ tint: GOLDT, ao: null }, () => m.box(0, 4, 0, 32, 36, 28, TL.GOLD, { bevel: 2, uv: 50 }));
  m.with({ tint: STEEL }, () => { for (const [x, y, z] of C.tubes) m.tube([x, y - 2, z], [x, y, z], 3.5, TL.DARK, { seg: 10, caps: 'end', capLayer: TL.SCORCH, uvV: 6 }); });
  m.with({ tint: W }, () => m.quad([[-16.1, -12, 4], [-16.1, 18, 4], [-16.1, 18, 12], [-16.1, -12, 12]], [[0, 0], [1, 0], [1, -0.4], [0, -0.4]], TL.SBMARK, [0, 4, 14]));
  stripe(m, 0, 18, 28.05, 28, 4);
  return m;
}

function radar() {
  const m = new TankMesh();
  m.with({ tint: STEEL }, () => {
    for (let k = -3; k <= 3; k++) m.box(k * 8, -Math.abs(k) * 1.6, 0, 7.6, 2, 18 - Math.abs(k) * 1.5, TL.GRILLE, { bevel: 0.2, uv: 12 });
    m.tube([0, 0, 6], [0, 14, 9], 1, TL.BARREL, { seg: 5, uvV: 10 });
    m.box(0, 14, 8, 4, 3, 3, TL.DARK, { bevel: 0.4 });
  });
  return m;
}

function wreck() {
  const m = new TankMesh(), R = rnd(37);
  m.with({ tint: W }, () => {
    m.lathe(0, 0, [[15, -1], [14, 3], [10, 6]], TL.SCORCH, { seg: 9 });
    for (let k = 0; k < 4; k++) m.tube([R() * 12 - 6, R() * 12 - 6, 3], [R() * 30 - 15, R() * 30 - 15, 8 + R() * 10], 2.4, TL.SCORCH, { seg: 6, uvV: 10 });
    m.box(-4, 6, 4, 14, 10, 4, TL.SCORCH, { bevel: 1, rot: -0.7 });
  });
  return m;
}

/** Build every part once (pure data, reusable across GL contexts). */
export function buildSandbreaker() {
  const out = {
    loco: loco(), locoFrame: locoFrame(), wheel: wheel(), rodC: rodC(), rodM: rodM(), cross: cross(),
    bogie: bogie(), coupler: coupler(), car1: car1(), car2: car2(), car3: car3(),
    scBase: scBase(), scBarrel: scBarrel(), mbTurret: mbTurret(), mbBarrel: mbBarrel(), mortar: mortar(),
    howTurret: howTurret(), howBarrel: howBarrel(), rotBase: rotBase(), gatling: gatling(),
    rocketPod: rocketPod(), radar: radar(), wreck: wreck(),
  };
  return Object.fromEntries(Object.entries(out).map(([k, m]) => [k, m.finish()]));
}
