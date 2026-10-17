// TESS v2 rig (ASSET_NOTES.md "Rebuild v2"): the two arms, each split at the
// elbow by process-art (`armRoot`: upper arm and elbow armour, pivot at the
// shoulder; `armTip`: forearm, clawed hand and blade). Every volley is a
// visible slash by one arm, alternating: the next arm winds back while the
// other one throws, snaps forward and inward across the body on release (the
// crescents leave its blade), follows through, and settles. The elbow bends
// more than the shoulder, so the blade whips. Clones share the pose.

const REST = { sh: 0, el: 0 };
const WOUND = { sh: -0.16, el: -0.36 };   // wound back and out
const MID = { sh: 0.04, el: 0.14 };       // the release frame: mid-snap
const PEAK = { sh: 0.2, el: 0.55 };       // follow-through, inward across the body

export const RIG = {
  // Upper arms under the body (the shoulder armour covers them), blades over it.
  order: ['armRootL', 'armRootR', 'body', 'armTipL', 'armTipR'],
  attach: {
    bladeTipL: 'armTipL', bladeTipR: 'armTipR',
    bladeMidL: 'armTipL', bladeMidR: 'armTipR',
    bladeBaseL: 'armTipL', bladeBaseR: 'armTipR',
    wristL: 'armTipL', wristR: 'armTipR',
    elbowL: 'armRootL', elbowR: 'armRootR',
  },
};

const arm = () => ({ r: 99, sh: 0, el: 0, rel: 0 });

/** Rig state on p.ps.tr (created on first use). */
export function rigState(p) {
  return p.ps.tr || (p.ps.tr = { L: arm(), R: arm(), next: -1, last: -99 });
}

const lerp = (a, b, u) => ({ sh: a.sh + (b.sh - a.sh) * u, el: a.el + (b.el - a.el) * u });
const ease = (u) => u * u * (3 - 2 * u);

/** One step: each arm eases toward its slash curve (or rest / wound when idle). */
export function step(p) {
  const tr = rigState(p), firing = p.t - tr.last < 10;
  for (const s of ['L', 'R']) {
    const a = tr[s], o = tr[s === 'L' ? 'R' : 'L'];
    a.r++;
    a.rel *= 0.8;
    // The next arm winds back while the other one is mid-throw.
    const base = firing && o.r < 7 && a.r >= 4 ? WOUND : REST;
    let t;
    if (a.r < 2) t = lerp(MID, PEAK, a.r / 2);
    else if (a.r < 4) t = PEAK;
    else if (a.r < 9) t = lerp(PEAK, base, ease((a.r - 4) / 5));
    else t = base;
    const breathe = Math.sin(p.t * 0.05 + (s === 'L' ? 0 : 1.3)) * 0.015;
    a.sh += (t.sh + breathe - a.sh) * 0.55;
    a.el += (t.el + breathe - a.el) * 0.55;
  }
}

/** A throw by arm `side` (-1 left, +1 right): it snaps to the release pose. Returns the side. */
export function release(p, side) {
  const tr = rigState(p), a = tr[side < 0 ? 'L' : 'R'];
  a.r = 0; a.sh = MID.sh; a.el = MID.el; a.rel = 1;
  tr.last = p.t;
  tr.next = -side;
  return side;
}

/** How hard arm `side` is swinging right now (0..1, for the blade flare). */
export const swing = (p, side) => rigState(p)[side < 0 ? 'L' : 'R'].rel;

const rotv = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * Pose of a layer. Inward is clockwise for the left arm (its blade points up
 * and left) and anticlockwise for the right. The blade (tip) turns about the
 * elbow on top of the shoulder turn: as a rotation about the shared pivot by
 * the sum, plus the offset that keeps the elbow where the upper arm put it.
 */
export function pose(p, name, A) {
  const L = name.endsWith('L'), a = rigState(p)[L ? 'L' : 'R'], sg = L ? 1 : -1;
  const sh = sg * a.sh, el = sg * a.el;
  if (name.startsWith('armRoot')) return { rot: sh };
  const P = A[L ? 'shoulderL' : 'shoulderR'], E = A[L ? 'elbowL' : 'elbowR'];
  const dx = E[0] - P[0], dy = E[1] - P[1];
  const [ax, ay] = rotv(dx, dy, sh), [bx, by] = rotv(dx, dy, sh + el);
  return { rot: sh + el, ox: ax - bx, oy: ay - by };
}
