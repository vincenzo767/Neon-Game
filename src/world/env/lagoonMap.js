// Lagoon Anchorage: ONE map model shared by the arena environment
// (world/env/lagoon.js: shores, shallows, quays, installations) and the
// CORAL SIEGE rig (navigation, coastal-bombardment targets, buoys), so the
// battleship only ever steams down water that is drawn as navigable and
// shells structures that really stand on the shore.
// World space: x right, y forward (up the screen), z up; the sea is z = 0.
//
// Layout
//   - A deep-water CHANNEL winds up the lagoon: its centreline channelX(y)
//     bends gently (the ship follows those bends: real turns, not a straight
//     slide). The waterline on each side sits halfBank(y) from it.
//   - PORT bank (x < 0): fishing village, palm beach and jungle, wooden
//     jetties, a lighthouse on a rocky point, a few gun pits.
//   - STARBOARD bank (x > 0): the naval anchorage: a concrete quay wall,
//     piers with moored and burning vessels, fuel tanks, bunkers, a radar
//     tower, warehouses, cranes.
//   - SHOALS: coral heads near each bank on the inside of the bends.
//   - INSTALLATIONS: explicitly configured shore targets (bunker, fuel tank,
//     radar, battery, depot) — the bombardment can only target these, and
//     the environment builds exactly these structures at these points.
//   - BUOYS: channel markers (red to port, green to starboard).
//
// Everything repeats every PERIOD (the arena layers are periodic: built
// once, the duel never waits for terrain).

export const PERIOD = 4096;
export const CHUNK = 512;
export const NCH = PERIOD / CHUNK;            // 8
const TAU = Math.PI * 2;
const pmod = (a, n) => ((a % n) + n) % n;

/** Channel centreline (world x) at y. */
export function channelX(y) {
  return 44 * Math.sin((TAU * 2 * y) / PERIOD + 0.7) + 16 * Math.sin((TAU * 5 * y) / PERIOD + 2.1);
}

/** Slope dx/dy of the centreline. */
export function channelSlope(y) {
  return 44 * Math.cos((TAU * 2 * y) / PERIOD + 0.7) * ((TAU * 2) / PERIOD) + 16 * Math.cos((TAU * 5 * y) / PERIOD + 2.1) * ((TAU * 5) / PERIOD);
}

/** Distance from the centreline to the waterline on `side` (−1 port, +1 starboard). */
export function halfBank(side, y) {
  const ph = side > 0 ? 1.3 : 4.1;
  return 266 + 16 * Math.sin((TAU * 3 * y) / PERIOD + ph) + 9 * Math.sin((TAU * 11 * y) / PERIOD + ph * 2);
}

/** Waterline x on `side` at y. */
export const shoreX = (side, y) => channelX(y) + side * halfBank(side, y);

/** Lateral room for the ship's centreline either side of the channel centre (hull + sponsons ±150). */
export const SHIP_ROOM = 40;

// ---------------------------------------------------------------- shore

/** One table per chunk of the period: installations on each bank (offset y inside the chunk, inland distance). */
const TABLE = [
  { s: [['tank', 120, 70], ['bunker', 360, 34]], p: [['battery', 260, 46]] },
  { s: [['radar', 210, 64], ['depot', 420, 92]], p: [['bunker', 130, 40]] },
  { s: [['tank', 90, 74], ['tank', 330, 80]], p: [['lighthouse', 300, 18]] },
  { s: [['bunker', 160, 36], ['battery', 400, 52]], p: [['battery', 90, 48]] },
  { s: [['depot', 120, 96], ['radar', 380, 66]], p: [['bunker', 330, 38]] },
  { s: [['tank', 240, 72], ['bunker', 450, 34]], p: [['battery', 180, 50]] },
  { s: [['battery', 110, 50], ['tank', 340, 76]], p: [['bunker', 420, 40]] },
  { s: [['depot', 200, 94], ['bunker', 440, 36]], p: [['battery', 260, 46]] },
];

const SIZE = { tank: 26, bunker: 22, radar: 18, depot: 34, battery: 20, lighthouse: 12 };

/** Installations of chunk j (any integer): [{ id, kind, side, x, y, r, inland }]. */
export function installationsAt(j) {
  const row = TABLE[pmod(j, NCH)], out = [];
  for (const [side, list] of [[1, row.s], [-1, row.p]]) {
    list.forEach(([kind, oy, inland], i) => {
      const y = j * CHUNK + oy, x = shoreX(side, y) + side * inland;
      out.push({ id: `${j}:${side}:${i}`, kind, side, x, y, r: SIZE[kind], inland });
    });
  }
  return out;
}

/** Installations whose y lies in [ya, yb]. */
export function installationsIn(ya, yb) {
  const out = [];
  for (let j = Math.floor(ya / CHUNK) - 1; j <= Math.floor(yb / CHUNK) + 1; j++) for (const it of installationsAt(j)) if (it.y >= ya && it.y <= yb) out.push(it);
  return out;
}

/** Piers on the starboard quay: one per chunk at a fixed offset; the length stops well clear of the channel. */
export function pierAt(j) {
  const y = j * CHUNK + [300, 60, 230, 420, 260, 100, 470, 330][pmod(j, NCH)];
  const root = shoreX(1, y), len = Math.max(18, Math.min(46, root - channelX(y) - 214));
  return { y, root, tip: root - len, len };
}

/** Wooden jetties on the port beach. */
export function jettyAt(j) {
  const y = j * CHUNK + [180, 400, 120, 330, 450, 210, 360, 60][pmod(j, NCH)];
  const root = shoreX(-1, y), len = Math.max(16, Math.min(40, channelX(y) - 214 - root));
  return { y, root, tip: root + len, len };
}

/** Coral shoals (submerged heads) near the banks on the inside of the bends. */
export function shoalsAt(j) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const y = j * CHUNK + 128 + i * 256, side = channelSlope(y) > 0 === (i === 0) ? 1 : -1;
    out.push({ x: shoreX(side, y) - side * (34 + 10 * Math.sin(j * 3.1 + i)), y, r: 30 + 8 * Math.cos(j * 1.7 + i * 2), side });
  }
  return out;
}

/** Channel buoys: [{ x, y, side }] every 256 along each edge of the fairway. */
export function buoysIn(ya, yb) {
  const out = [];
  for (let k = Math.floor(ya / 256); k <= Math.ceil(yb / 256); k++) {
    const y = k * 256 + 64, side = k & 1 ? 1 : -1;
    out.push({ x: channelX(y) + side * 212, y, side, k });
  }
  return out;
}
