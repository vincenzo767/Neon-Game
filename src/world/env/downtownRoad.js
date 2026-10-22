// The Downtown Siege boulevard: ONE road model shared by the arena
// environment (asphalt, markings, curbs, islands, buildings set back from it)
// and the URBAN DEVASTATOR rig (lane targets, turns, fork choices, camera
// framing), so the car always drives on the road that is drawn.
// World space: x right, y forward (up the screen), z up.
//
// Geometry
//   - A twelve-lane boulevard (two carriageways of six lanes, centred at
//     ±ROAD.base) whose centreline runs straight between intersections and
//     BENDS at them: roadX(y) is piecewise linear through one keypoint per
//     intersection, the corners rounded with parabolic blends (± ROAD.blend
//     along y). "Turn left / turn right" happens at real junctions.
//   - Two FORKS per period: past a junction the carriageways part around a
//     raised island (their centres move out from ±base to ±split) and merge
//     again before the junction after next. A driver picks a branch.
//   - Intersections every SEG units (cross streets, crosswalks, stop lines).
//
// Everything repeats every PERIOD world units (a periodic "treadmill" world,
// see ArenaWorld periodic layers): the chase covers the period in ~30 s, and
// no terrain is ever built during the duel.

export const PERIOD = 8192;
export const SEG = 512;                   // intersection spacing
export const NSEG = PERIOD / SEG;         // 16
export const X0 = 256;                    // first intersection centre (chunk middle)

export const ROAD = {
  lane: 24,          // lane width
  half: 166,         // unsplit boulevard: 12 lanes + shoulders
  edge: 144,         // solid edge line offset (unsplit)
  sidewalk: 34,      // sidewalk width outside the asphalt
  base: 72,          // carriageway centre offset on the unsplit road
  forkHalf: 94,      // half-width of one carriageway (asphalt)
  forkEdge: 72,      // its edge lines (from the carriageway centre)
  split: 196,        // carriageway centre offset at full split
  blend: 170,        // corner rounding (± along y)
  cross: 32,         // cross-street half-width
  carRange: 54,      // lateral range of the boss car's centre on the unsplit road (car is ±95)
};

// Centreline at each intersection (keypoints). Bends of 12–17° between them;
// forks sit on the straight runs (4→6 and 12→14).
const KX = [0, 0, 150, 150, 0, 0, 0, -150, -150, -40, -40, 120, 0, 0, 0, 0];
const FORKS = [4, 12];                     // fork starts (intersection index)
const DIVERGE = 420;                       // length of the diverge / merge ramps
const FORK_IN = 46;                        // first ramp starts this far past the junction

const pmod = (a, n) => ((a % n) + n) % n;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const dsmooth = (t) => (t <= 0 || t >= 1 ? 0 : 6 * t * (1 - t));

/** y wrapped into [0, PERIOD). */
export const wrapY = (y) => pmod(y, PERIOD);

/** Centre y of intersection k (any integer; repeats every NSEG). */
export const crossY = (k) => k * SEG + X0;

/** Nearest intersection index to world y. */
export const crossIndex = (y) => Math.round((y - X0) / SEG);

const kx = (k) => KX[pmod(k, NSEG)];
const segSlope = (k) => (kx(k + 1) - kx(k)) / SEG; // slope of the run k → k+1

/** Centreline x at world y. */
export function roadX(y) {
  const k = crossIndex(y), yk = crossY(k), B = ROAD.blend;
  const d = y - yk;
  if (Math.abs(d) < B) {
    const s1 = segSlope(k - 1), s2 = segSlope(k), u = d + B;
    return kx(k) - s1 * B + s1 * u + ((s2 - s1) * u * u) / (4 * B);
  }
  return d > 0 ? kx(k) + segSlope(k) * d : kx(k) + segSlope(k - 1) * d;
}

/** dx/dy of the centreline. */
export function roadSlope(y) {
  const k = crossIndex(y), yk = crossY(k), B = ROAD.blend;
  const d = y - yk;
  if (Math.abs(d) < B) {
    const s1 = segSlope(k - 1), s2 = segSlope(k), u = d + B;
    return s1 + ((s2 - s1) * u) / (2 * B);
  }
  return d > 0 ? segSlope(k) : segSlope(k - 1);
}

/** Heading of the road (0 = straight up the screen, + = toward +x). */
export const roadDir = (y) => Math.atan(roadSlope(y));

/** Fork containing world y, or null: { k (start junction), y0, y1 (span), a, b (ramp ends) }. */
export function forkAt(y) {
  const k = crossIndex(y);
  for (const s of [k - 2, k - 1, k]) {
    if (!FORKS.includes(pmod(s, NSEG))) continue;
    const y0 = crossY(s) + FORK_IN, y1 = crossY(s + 2) - FORK_IN;
    if (y >= y0 && y <= y1) return { k: s, y0, y1, a: y0 + DIVERGE, b: y1 - DIVERGE };
  }
  return null;
}

/**
 * Carriageway centre offset from roadX: ROAD.base on the unsplit road (each
 * carriageway is one half of the boulevard), growing to ROAD.split in a fork.
 */
export function splitAt(y) {
  const f = forkAt(y), B = ROAD.base, A = ROAD.split - B;
  if (!f) return B;
  if (y < f.a) return B + A * smooth((y - f.y0) / DIVERGE);
  if (y > f.b) return B + A * smooth((f.y1 - y) / DIVERGE);
  return ROAD.split;
}

/** d(split)/dy. */
export function splitSlope(y) {
  const f = forkAt(y), A = ROAD.split - ROAD.base;
  if (!f) return 0;
  if (y < f.a) return (A * dsmooth((y - f.y0) / DIVERGE)) / DIVERGE;
  if (y > f.b) return -(A * dsmooth((f.y1 - y) / DIVERGE)) / DIVERGE;
  return 0;
}

/** True where the boulevard is split into two carriageways. */
export const isSplit = (y) => splitAt(y) > ROAD.base + 0.5;

/** Outer half-width of the asphalt (from roadX) at y. */
export const envelope = (y) => splitAt(y) + ROAD.forkHalf;

/** Island half-width (raised median between the fork carriageways), 0 if none. */
export const islandHalf = (y) => Math.max(0, splitAt(y) - ROAD.forkHalf);

/** Next fork whose diverge starts after world y: { k, y0, y1, a, b }. */
export function nextFork(y) {
  let best = null;
  const k0 = Math.floor((y - X0) / SEG) - 2;
  for (let s = k0; s <= k0 + NSEG + 2; s++) {
    if (!FORKS.includes(pmod(s, NSEG))) continue;
    const y0 = crossY(s) + FORK_IN, y1 = crossY(s + 2) - FORK_IN;
    if (y0 > y && (!best || y0 < best.y0)) best = { k: s, y0, y1, a: y0 + DIVERGE, b: y1 - DIVERGE };
  }
  return best;
}

/** Next intersection with a real bend after y: { k, y, turn (+1 right / −1 left), size (rad) }. */
export function nextBend(y) {
  for (let k = crossIndex(y) - 1; k < crossIndex(y) + NSEG + 1; k++) {
    const yk = crossY(k);
    if (yk - ROAD.blend <= y) continue;
    const a0 = Math.atan(segSlope(k - 1)), a1 = Math.atan(segSlope(k));
    if (Math.abs(a1 - a0) > 0.05) return { k, y: yk, turn: Math.sign(a1 - a0), size: Math.abs(a1 - a0) };
  }
  return null;
}

/** True if world y is inside an intersection box (cross street + crosswalks). */
export const atCross = (y, pad = 0) => Math.abs(y - crossY(crossIndex(y))) < ROAD.cross + 14 + pad;

/**
 * Lateral offsets (from roadX) of the lane lines at y, for painting:
 * { dashed, solid, yellow (centre double line), gore (half-width of the
 * hatched area where the carriageways part, 0 if none) }.
 */
export function laneLines(y) {
  const s = splitAt(y), L = ROAD.lane, E = ROAD.forkEdge;
  const dashed = [], solid = [];
  for (const side of [-1, 1]) {
    const c = side * s;
    for (let k = -2; k <= 2; k++) dashed.push(c + k * L);
    solid.push(c + side * E);
    // Inner edge lines appear as the carriageways part (they bound the gore, then the island).
    if (s - E > 3) solid.push(c - side * E);
  }
  return { dashed, solid, yellow: s - E <= 3 ? [-1.6, 1.6] : [], gore: s - E > 3 && s - ROAD.forkHalf < 4 ? s - E : 0 };
}
