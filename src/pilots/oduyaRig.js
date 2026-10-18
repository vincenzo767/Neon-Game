// ODUYA v2 rig (ASSET_NOTES.md "Rebuild v2"): the two arms, each split at the
// elbow by process-art (`armRoot`: elbow joint and upper arm, pivot at the
// shoulder; `armTip`: gauntlet and gold fist), and the two lightning wings.
// Every bolt is a punch by one arm, alternating: the next gauntlet draws back
// down its axis while the other one strikes; on release it shoots out along its
// axis (turned a little toward the target), kicks back and settles. Both arms
// can be driven together (clap, upward punch, the ultimate's raise and thrust).
// Wings flare while charging / in focus and fold back a little with each punch.

export const RIG = {
  // Wings behind everything, upper arms under the body, gauntlets over it.
  order: ['wingL', 'wingR', 'armRootL', 'armRootR', 'body', 'armTipL', 'armTipR'],
  attach: {
    fistL: 'armTipL', fistR: 'armTipR',
    wristL: 'armTipL', wristR: 'armTipR',
    elbowL: 'armRootL', elbowR: 'armRootR',
    wingTipL: 'wingL', wingTipR: 'wingR', wingLowL: 'wingL', wingLowR: 'wingR',
    ventL: 'wingL', ventR: 'wingR',
  },
};

const PUNCH = 30;   // @2x px the gauntlet shoots out along its axis
const DRAW = 12;    // @2x px it draws back while winding up

const arm = () => ({ r: 99, ext: 0, sh: 0, aim: 0, aimT: 0, rel: 0, hold: 0, holdT: 0 });

/** Rig state on p.ps.or (created on first use). */
export function rigState(p) {
  return p.ps.or || (p.ps.or = { L: arm(), R: arm(), next: -1, last: -99, flare: 0, flareT: 0, fold: { L: 0, R: 0 } });
}

/** One step: each arm eases along its punch curve; the wings follow their flare target. */
export function step(p) {
  const or = rigState(p), firing = p.t - or.last < 8;
  for (const s of ['L', 'R']) {
    const a = or[s], o = or[s === 'L' ? 'R' : 'L'];
    a.r++;
    a.rel *= 0.75;
    let ext;
    if (a.holdT > 0) { a.holdT--; ext = a.hold; }                              // a held pose (charge, raise)
    else if (a.r < 1) ext = 1;                                                  // full extension: the bolt leaves
    else if (a.r < 3) ext = 0.55;                                               // kick back
    else ext = firing && o.r < 3 && a.r >= 3 ? -1 : 0;                          // draw back for the next strike
    a.ext += (ext - a.ext) * (a.r < 1 ? 1 : 0.5);
    a.sh += ((a.ext > 0 ? 0.05 * a.ext : 0.04 * a.ext) - a.sh) * 0.5;
    a.aim += ((a.r < 6 ? a.aimT : 0) - a.aim) * 0.4;
    or.fold[s] *= 0.8;
  }
  const want = Math.max(or.flareT, p.focus ? 0.45 : 0);
  or.flare += (want - or.flare) * 0.12;
  or.flareT = 0;
}

/**
 * A punch by arm `side` (-1 left, +1 right), turned toward (tx, ty) if given
 * (world offsets from the fist). Returns the side.
 */
export function punch(p, side, aimAng = null) {
  const or = rigState(p), s = side < 0 ? 'L' : 'R', a = or[s];
  a.r = 0; a.ext = 1; a.rel = 1;
  // Turn toward the target: the fist's rest direction is up and outward.
  if (aimAng !== null) {
    const rest = side < 0 ? -2.01 : -1.13; // atan2 of the gauntlet axis (wrist → fist) on each side
    let d = aimAng - rest; d = Math.atan2(Math.sin(d), Math.cos(d));
    a.aimT = Math.max(-0.22, Math.min(0.22, d * 0.35));
  } else a.aimT = 0;
  or.fold[s] = 1;
  or.last = p.t;
  or.next = -side;
  return side;
}

/** Hold both arms at an extension for n steps (−1 drawn back … 1 thrust out). */
export function hold(p, ext, n) {
  const or = rigState(p);
  for (const s of ['L', 'R']) { or[s].hold = ext; or[s].holdT = n; }
}

/** Wings flare toward f (0..1) this step (call every step while charging). */
export function flare(p, f) { const or = rigState(p); or.flareT = Math.max(or.flareT, f); }

/** How hard arm `side` just struck (0..1), and how far it is drawn back (0..1, the fist charging). */
export const strikeLevel = (p, side) => rigState(p)[side < 0 ? 'L' : 'R'].rel;
export const charge = (p, side) => Math.max(0, -rigState(p)[side < 0 ? 'L' : 'R'].ext);
export const flareLevel = (p) => rigState(p).flare;

const rotv = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * Pose of a layer. The gauntlet slides along its own axis (wrist → fist) in its
 * frame, turns about the elbow by `aim` on top of the shoulder turn (as a
 * rotation about the shared pivot plus the offset that keeps the elbow in
 * place). Wings turn about their root: outward when flaring, back when folding.
 */
export function pose(p, name, A) {
  const or = rigState(p), L = name.endsWith('L'), s = L ? 'L' : 'R', sg = L ? 1 : -1, a = or[s];
  if (name.startsWith('wing')) {
    const breathe = Math.sin(p.t * 0.06 + (L ? 0 : 1.1)) * 0.012;
    return { rot: sg * (-0.14 * or.flare + 0.05 * or.fold[s] + breathe) };
  }
  const sh = sg * a.sh;
  if (name.startsWith('armRoot')) return { rot: sh };
  const P = A[L ? 'shoulderL' : 'shoulderR'], E = A[L ? 'elbowL' : 'elbowR'];
  const Wr = A[L ? 'wristL' : 'wristR'], Fi = A[L ? 'fistL' : 'fistR'];
  const ax = Fi[0] - Wr[0], ay = Fi[1] - Wr[1], al = Math.hypot(ax, ay) || 1;
  const d = a.ext >= 0 ? a.ext * PUNCH : a.ext * DRAW;
  const dx = E[0] - P[0], dy = E[1] - P[1], el = a.aim;
  const [px, py] = rotv(dx, dy, sh), [qx, qy] = rotv(dx, dy, sh + el);
  return { rot: sh + el, tx: ax / al * d, ty: ay / al * d, ox: px - qx, oy: py - qy };
}
