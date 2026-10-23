// Pack Ice Lead: ONE map model shared by the arena environment
// (world/env/polar.js: the lead, floes, bergs, wrecks) and the WHITEOUT
// BREAKER rig (where shells land on ice or water, where the escort wrecks
// burn), so an impact always shatters ice exactly where ice is drawn.
// World space: x right, y forward (up the screen), z up; the sea is z = 0.
//
// Layout (repeats every PERIOD along y)
//   - The LEAD: a straight channel of open black water down x = 0, its
//     ragged edges leadEdge(side, y) ≈ 190–215 from the centreline. The
//     warship lies stationary in it (hull ±126).
//   - The FLOE BAND: a belt of thick, broken floes (3D slabs, dark water in
//     the seams) from the lead edge out to FLOE_OUT beyond it.
//   - The PACK: continuous snow-covered sea ice beyond the floe band, with
//     pressure ridges, refrozen leads and frozen-in wrecks.
//   - BERGS: towering icebergs and ice-cliff walls standing in the pack on
//     both sides (they lean out of the frame: the lead reads as a canyon).
//   - ESCORTS: burning escort warships stopped in the water lane between the
//     hull and the floes (the fortress's screen, shot to pieces).

export const PERIOD = 4096;
export const CHUNK = 512;
export const NCH = PERIOD / CHUNK;            // 8
export const FLOE_OUT = 96;                   // width of the 3D floe band beyond the lead edge
const TAU = Math.PI * 2;
const pmod = (a, n) => ((a % n) + n) % n;

/** Distance from the centreline to the lead's edge on `side` (−1 left, +1 right). */
export function leadEdge(side, y) {
  const ph = side > 0 ? 0.9 : 3.7;
  return 202 + 9 * Math.sin((TAU * 3 * y) / PERIOD + ph) + 5 * Math.sin((TAU * 11 * y) / PERIOD + ph * 1.7) + 2.5 * Math.sin((TAU * 29 * y) / PERIOD + ph * 3.1);
}

/** Is world (x, y) on ice (floe band or pack)? Open water otherwise. */
export function iceAt(x, y) {
  const s = x >= 0 ? 1 : -1;
  return s * x > leadEdge(s, y) + 2;
}

// ---------------------------------------------------------------- escorts

/** Burning escorts stopped in the water lane, per chunk of the period: [side, offset y, type, rot]. */
const ESCORTS = [
  [[-1, 140, 'frigate', 0.06], [1, 400, 'destroyer', -0.05]],
  [[1, 210, 'frigate', -0.08]],
  [[-1, 60, 'destroyer', 0.04], [1, 330, 'patrol', 0.3]],
  [[-1, 280, 'frigate', -0.05]],
  [[1, 120, 'destroyer', 0.05], [-1, 420, 'patrol', -0.25]],
  [[-1, 200, 'destroyer', -0.04], [1, 470, 'frigate', 0.07]],
  [[1, 300, 'frigate', 0.05]],
  [[-1, 110, 'frigate', 0.07], [1, 380, 'destroyer', -0.04]],
];

/** Escorts of chunk j (any integer): [{ id, type, side, x, y, rot }]. Bow toward −y (they were screening the fortress). */
export function escortsAt(j) {
  return ESCORTS[pmod(j, NCH)].map(([side, oy, type, rot], i) => {
    const y = j * CHUNK + oy;
    return { id: `${j}:${i}`, type, side, x: side * (type === 'patrol' ? 166 : 171), y, rot: Math.PI + rot };
  });
}

export function escortsIn(ya, yb) {
  const out = [];
  for (let j = Math.floor(ya / CHUNK) - 1; j <= Math.floor(yb / CHUNK) + 1; j++) for (const e of escortsAt(j)) if (e.y >= ya && e.y <= yb) out.push(e);
  return out;
}

// ------------------------------------------------------------------ bergs

/**
 * Icebergs of chunk j: { x, y, r (footprint radius), l (elongation along y),
 * h (height), seed, wall (a long ice-cliff wall) }. Two to three a side; one
 * wall a side every other chunk.
 */
export function bergsAt(j) {
  const k = pmod(j, NCH), out = [];
  const T = [
    [[-1, 90, 52, 1.6, 120], [1, 250, 60, 2.6, 165, 1], [-1, 420, 40, 1.2, 80]],
    [[1, 60, 44, 1.3, 95], [-1, 230, 64, 2.8, 180, 1], [1, 440, 50, 1.5, 110]],
    [[-1, 150, 56, 1.8, 140], [1, 330, 48, 1.4, 100]],
    [[1, 130, 62, 2.7, 175, 1], [-1, 310, 46, 1.3, 90], [-1, 480, 54, 1.7, 125]],
    [[-1, 40, 50, 1.5, 105], [1, 260, 42, 1.2, 85], [-1, 330, 66, 2.9, 190, 1]],
    [[1, 100, 58, 1.9, 150], [-1, 300, 48, 1.4, 100], [1, 450, 52, 1.6, 115]],
    [[-1, 180, 62, 2.6, 170, 1], [1, 380, 56, 1.8, 135]],
    [[1, 30, 60, 2.8, 185, 1], [-1, 200, 44, 1.3, 95], [1, 360, 50, 1.5, 110]],
  ][k];
  T.forEach(([side, oy, r, l, h, wall], i) => {
    const y = j * CHUNK + oy;
    const d = wall ? 0 : 12 + ((k * 37 + i * 53) % 46);
    out.push({ x: side * (leadEdge(side, y) + FLOE_OUT + d + r * 0.45), y, r, l, h, seed: k * 13 + i * 7 + 1, wall: !!wall, side });
  });
  return out;
}
