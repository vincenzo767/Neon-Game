// LIN v2 rig (ASSET_NOTES.md "Rebuild v2"): the whip (left hand; handle half +
// tip half, split by process-art), the spear (right hand) and the two butterfly
// wings, on the shared rig path (layers.json `rig: true`).
// - The whip is swung out in front of the mecha (turned about his hand) and
//   lashes across the front with every volley, alternating left and right; the
//   tip half lags behind the handle and whips after it. Its crystals light up in
//   a wave from the handle to the tip (rigState().glow, for the FX).
// - The spear thrusts along its axis with each focus throw; the ultimate draws
//   it back and tilts it while charging, then thrusts.
// - The wings beat like the art test's butterfly flap (mechaArt `flap`: the
//   phase and depth come from linArt.animate), flaring while charging.

export const RIG = {
  order: ['wingL', 'wingR', 'body', 'spearR', 'whipRootL', 'whipTipL'],
  attach: {
    whipMid: 'whipRootL', whipJoint: 'whipRootL',
    whipTip: 'whipTipL', whip: 'whipTipL',
    spearTip: 'spearR', spear: 'spearR', blade: 'spearR',
  },
};

const FRONT = 0.73;   // rad: the whip's turn about his hand, from his side (as painted) to in front of the mecha
const LASH = 0.2;     // rad each way across the front
const THRUST = 24, DRAW = 16; // @2x px the spear slides along its axis

/** Rig state on p.ps.lr (created on first use). */
export function rigState(p) {
  return p.ps.lr || (p.ps.lr = {
    out: 0, lash: 0, lashT: 0, slow: 0, dir: 1, glow: 99, last: -99,
    ext: 0, extT: 0, extHold: 0, tilt: 0, tiltT: 0, flare: 0, flareT: 0, coil: 0, coilT: 0,
  });
}

/** One step. */
export function step(p) {
  const r = rigState(p), alive = p.state === 'alive';
  // The whip swings out in front (and back to his side when he's down).
  r.out += ((alive ? 1 : 0) - r.out) * 0.12;
  if (p.t - r.last > 12) r.lashT = Math.sin(p.t * 0.05) * 0.04; // idle sway
  r.lash += (r.lashT - r.lash) * 0.45;
  r.slow += (r.lash - r.slow) * 0.18; // the tip half follows the handle late
  r.glow++;
  r.coil += (r.coilT - r.coil) * 0.2; r.coilT = 0;
  // Spear: thrust / drawn back / rest.
  if (r.extHold > 0) r.extHold--; else r.extT = 0;
  r.ext += (r.extT - r.ext) * (r.extT > r.ext ? 0.6 : 0.25);
  r.tilt += (r.tiltT - r.tilt) * 0.15; r.tiltT = 0;
  r.flare += (Math.max(r.flareT, p.focus ? 0.3 : 0) - r.flare) * 0.12; r.flareT = 0;
}

/** A lash: the whip sweeps across the front the other way, and its crystals light up. */
export function lash(p) {
  const r = rigState(p);
  r.dir = -r.dir;
  r.lashT = r.dir * LASH;
  r.glow = 0;
  r.last = p.t;
  return r.dir;
}

/** The spear thrusts (n steps held out). */
export function thrust(p, n = 4) { const r = rigState(p); r.extT = 1; r.extHold = n; }
/** The spear is drawn back and tilted inward (call each step while charging). */
export function drawBack(p, k = 1) { const r = rigState(p); r.extT = -k; r.extHold = 2; r.tiltT = k; }
/** Wings flare toward f this step; the whip coils toward c (0..1) this step. */
export function flare(p, f) { const r = rigState(p); r.flareT = Math.max(r.flareT, f); }
export function coil(p, c) { const r = rigState(p); r.coilT = Math.max(r.coilT, c); }

const rotv = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Pose of a layer (A: the anchors in @2x px). */
export function pose(p, name, A) {
  const r = rigState(p), ps = p.ps;
  if (name === 'wingL' || name === 'wingR') {
    // The art test's butterfly flap (mechaArt wingPose), plus the rig's flare.
    const s = name === 'wingL' ? -1 : 1, fl = Math.max(ps.flare || 0, r.flare), fold = ps.fold || 0;
    const breath = Math.sin(p.t * 0.06), beat = 0.5 - 0.5 * Math.cos(ps.flapPh || 0);
    const out = fl * 8 - fold * 6 + breath * 0.8;
    return {
      ox: s * out,
      rot: s * (0.035 * (fl - fold) + 0.006 * breath + 0.05 * beat - 0.06 * fold - 0.05 * r.flare),
      sx: 1 - (ps.flapAmp || 0.2) * beat * (1 - 0.5 * r.flare) - fold * 0.4 + fl * 0.04,
    };
  }
  if (name === 'spearR') {
    const d = r.ext >= 0 ? r.ext * THRUST : r.ext * DRAW;
    return { rot: -0.14 * r.tilt, ty: -d };
  }
  // Whip: the handle half turns about the hand; the tip half turns about the joint on top of it.
  const coilK = r.coil;
  const root = r.out * FRONT + r.lash - 0.25 * coilK;
  if (name === 'whipRootL') return { rot: root };
  const lag = (r.slow - r.lash) * 1.6 + 0.5 * coilK;
  const P = A.whipHand, J = A.whipJoint, dx = J[0] - P[0], dy = J[1] - P[1];
  const [ax, ay] = rotv(dx, dy, root), [bx, by] = rotv(dx, dy, root + lag);
  return { rot: root + lag, ox: ax - bx, oy: ay - by };
}
