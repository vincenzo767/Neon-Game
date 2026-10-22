// The Dune Sea main line: ONE railway centreline shared by the arena
// environment (ballast, sleepers, rails) and the SANDBREAKER train rig
// (bogies, wheels, couplings), so the train always runs on the rails that are
// drawn. World space: x right, y forward (up the screen), z up.
//
// The line meanders gently (≈ ±42 units) so the convoy visibly follows a
// curve without ever leaving the corridor. Everything about it repeats every
// PERIOD world units: the Dune Sea arena is a periodic ("treadmill") world, so
// a convoy that runs the field backward for minutes never needs new terrain
// built mid-fight (world/env/dunesea.js, ArenaWorld periodic layers).

export const PERIOD = 4096;

export const RAIL = {
  half: 55,          // rail centre-lines at railX ± half (broad siege gauge)
  bedHalf: 80,       // ballast top half-width
  bedZ: 3,           // ballast top above the ground
  sleeperHalf: 76,   // sleeper half-length (across the line)
  sleeperW: 9,       // sleeper width (along the line)
  sleeperStep: 16,   // sleeper spacing (divides PERIOD)
  sleeperZ: [3, 6],  // sleeper bottom / top
  railZ: [6, 12],    // rail foot / head top
  top: 12,           // wheel contact height (rail head)
  joint: 128,        // rail length between fishplate joints (divides PERIOD)
};

const TAU = Math.PI * 2;
const A1 = 30, P1 = 0.7, A2 = 12, P2 = 2.3;
const W1 = TAU / PERIOD, W2 = (3 * TAU) / PERIOD;

/** Centreline x at world y. */
export const railX = (y) => A1 * Math.sin(y * W1 + P1) + A2 * Math.sin(y * W2 + P2);

/** dx/dy of the centreline. */
export const railSlope = (y) => A1 * W1 * Math.cos(y * W1 + P1) + A2 * W2 * Math.cos(y * W2 + P2);

/** Horizontal distance of (x, y) from the centreline. */
export const railDist = (x, y) => Math.abs(x - railX(y));

/** y wrapped into [0, PERIOD). */
export const wrapY = (y) => ((y % PERIOD) + PERIOD) % PERIOD;
