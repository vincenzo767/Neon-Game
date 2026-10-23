// The Burning Overpass: ONE map model shared by the arena environment
// (world/env/overpass.js: asphalt, blocks, climbable structures) and the
// COLOSSUS CRAWLER rig (foot placement, climbing routes, leap targets), so
// the machine only ever stands on, climbs or lands on geometry that is drawn.
// World space: x right, y forward (up the screen), z up.
//
// Layout
//   - A straight sixteen-lane urban highway centred on x = 0: two
//     carriageways of seven lanes either side of a painted median, shoulders,
//     curbs, sidewalks. City blocks start at |x| = ROAD.face.
//   - CLIMB SITES: explicitly configured traversal targets, one per chunk,
//     alternating sides (so one every SITE_STEP along each side). Each site
//     is an axis-aligned block whose inner face looks onto the road and
//     whose flat top is a valid standing / landing surface:
//       garage   multi-storey car park (open decks on columns, roof deck)
//       deck     collapsed elevated-highway stub on piers (broken end at the road)
//       podium   damaged office podium with a tower set back behind it
//     A site defines its climb entry (the road in front of its inner face),
//     the wall footholds (its inner face), its roof pad, and leap links
//     (any other site or road point within LEAP_MAX).
//   - Everything else beside the road is solid: feet are kept off it.
//
// Everything repeats every PERIOD (the arena layer is periodic, so the
// chunks are built once and the duel never waits for terrain).

export const PERIOD = 8192;
export const CHUNK = 512;
export const NCH = PERIOD / CHUNK;            // 16

export const ROAD = {
  lane: 26,
  lanes: 7,           // per carriageway
  median: 10,         // half-width of the painted median
  half: 206,          // asphalt half-width (lanes + shoulder)
  curb: 210,          // curb line
  face: 240,          // city blocks / site inner faces start here
  walk: 238,          // outer edge of the sidewalk
  body: 90,           // lateral range of the crawler's body on the road (its legs span ±160)
};

export const SITE_DEPTH = 360;               // across (x) — the pad must hold the crawler's stance
export const SITE_HALF = 180;                // along (y)
export const LEAP_MAX = 1250;                // longest leap the crawler will take

// One entry per chunk of the period: kind and roof height (the side alternates).
const TABLE = [
  ['garage', 92], ['deck', 80], ['podium', 108], ['garage', 96],
  ['podium', 100], ['garage', 88], ['deck', 84], ['podium', 112],
  ['garage', 94], ['podium', 104], ['deck', 78], ['garage', 90],
  ['podium', 110], ['garage', 98], ['deck', 82], ['podium', 106],
];

const pmod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Climb site of chunk j (any integer; repeats every NCH). */
export function siteAt(j) {
  const [kind, top] = TABLE[pmod(j, NCH)];
  const side = pmod(j, 2) ? 1 : -1;
  const y = j * CHUNK + CHUNK / 2;
  const hd = kind === 'deck' ? 150 : SITE_HALF;
  const x0 = ROAD.face, x1 = ROAD.face + SITE_DEPTH;
  return {
    j, kind, top, side, y, y0: y - hd, y1: y + hd, hd,
    x0, x1,                                            // |x| range of the block
    cx: side * (x0 + SITE_DEPTH / 2), cy: y,           // pad centre (where the body stands)
    face: side * x0,                                   // inner wall plane (world x)
    entry: [side * (x0 - 150), y],                     // road point in front of the wall (climb start)
  };
}

/** Site index (chunk) of world y. */
export const siteIndex = (y) => Math.floor(y / CHUNK);

/** Sites whose centre lies in [ya, yb]. */
export function sitesIn(ya, yb) {
  const out = [];
  for (let j = Math.floor((ya - CHUNK / 2) / CHUNK); j <= Math.ceil((yb - CHUNK / 2) / CHUNK); j++) {
    const s = siteAt(j);
    if (s.y >= ya && s.y <= yb) out.push(s);
  }
  return out;
}

/** The site whose block contains world (x, y), or null. */
export function siteContaining(x, y) {
  const s = siteAt(siteIndex(y));
  if (Math.sign(x) !== s.side) return null;
  const ax = Math.abs(x);
  return ax >= s.x0 && ax <= s.x1 && y >= s.y0 && y <= s.y1 ? s : null;
}

/** Height of the walkable surface at (x, y): a site's roof, else the street. */
export function surfaceZ(x, y) {
  const s = siteContaining(x, y);
  return s ? s.top : 0;
}

/**
 * A valid foothold near the desired point (x, y, z): out = [x, y, z, nx, ny, nz].
 *  - inside a site's block and high enough: on its roof (kept off the edges)
 *  - inside a site's block but low: on its inner wall (climbing)
 *  - against any other block: pulled back onto the sidewalk (never inside a building)
 *  - else the street.
 * `on` (a site) keeps a foot on that site's roof even at its very edge.
 */
export function footHold(x, y, z, out = [0, 0, 0, 0, 0, 1], on = null) {
  const s = on || siteContaining(x, y);
  out[1] = y;
  if (s && (on || z >= s.top - 46)) {
    const ax = clamp(Math.abs(x), s.x0 + 8, s.x1 - 8);
    out[0] = s.side * ax; out[1] = clamp(y, s.y0 + 8, s.y1 - 8); out[2] = s.top;
    out[3] = 0; out[4] = 0; out[5] = 1;
    return out;
  }
  if (s) {
    out[0] = s.side * (s.x0 - 3); out[2] = clamp(z, 10, s.top - 8);
    out[3] = -s.side; out[4] = 0; out[5] = 0;
    return out;
  }
  out[0] = clamp(x, -(ROAD.face - 5), ROAD.face - 5); out[2] = 0;
  out[3] = 0; out[4] = 0; out[5] = 1;
  return out;
}

/** Road point for a body centre: kept on the asphalt with room for the legs. */
export function roadPoint(x, y, out = [0, 0]) {
  out[0] = clamp(x, -ROAD.body, ROAD.body); out[1] = y;
  return out;
}

/** Median / lane-line offsets for painting (from x = 0). */
export function laneLines() {
  const dashed = [], solid = [];
  for (const s of [-1, 1]) {
    for (let k = 1; k < ROAD.lanes; k++) dashed.push(s * (ROAD.median + 2 + k * ROAD.lane));
    solid.push(s * (ROAD.median + 2), s * (ROAD.median + 2 + ROAD.lanes * ROAD.lane));
  }
  return { dashed, solid };
}
