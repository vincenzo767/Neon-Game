// SERA rig (ASSET_NOTES.md): the drawing arm (her right fist and gauntlet) on the
// shared rig path (layers.json `rig: true`). The bow is held across her body;
// every Frost Shard leaves the nock at the drawing fist.
// - While she fires, the arm draws back along her aim between volleys (the
//   energy string stretches with it, seraFx.js); each volley releases it with a
//   forward snap and a small recoil of the whole mecha.
// - Glacial Focus draws faster; the limbs' glow follows the draw (for the FX).

export const RIG = {
  order: ['body', 'armR'],
  attach: { nock: 'armR' },
};

const DRAW = 9;   // @2x px the fist slides back at full draw
const SNAP = 4;   // and forward on the release

/** Rig state on p.ps.sr (created on first use). */
export function rigState(p) {
  return p.ps.sr || (p.ps.sr = { draw: 0, kick: 0, last: -99, flare: 0, flareT: 0, charge: 0, chargeT: 0 });
}

/** One step. */
export function step(p) {
  const r = rigState(p), firing = p.state === 'alive' && p.t - r.last < 10;
  // Between volleys the string draws back again (faster in focus).
  r.draw += ((firing ? 1 : 0) - r.draw) * (firing ? (p.focus ? 0.5 : 0.3) : 0.12);
  r.kick *= 0.7;
  r.flare += (Math.max(r.flareT, p.focus ? 0.4 : 0) - r.flare) * 0.12; r.flareT = 0;
  r.charge += (r.chargeT - r.charge) * 0.15; r.chargeT = 0;
}

/** A volley leaves the bow: the string snaps forward. */
export function release(p) { const r = rigState(p); r.draw = 0; r.kick = 1; r.last = p.t; }
/** The armour flares toward f this step (special, ultimate). */
export function flare(p, f) { const r = rigState(p); r.flareT = Math.max(r.flareT, f); }
/** The bow blazes toward k this step (the ultimate's activation). */
export function charge(p, k) { const r = rigState(p); r.chargeT = Math.max(r.chargeT, k); }

/** A slow hover breath, plus the release's recoil (world units added to y). */
export function bob(p) {
  const r = rigState(p);
  return Math.sin(p.t * 0.06) * 0.9 + r.kick * 0.8;
}

/** Pose of a layer. */
export function pose(p, name) {
  if (name !== 'armR') return null;
  const r = rigState(p);
  return { ty: DRAW * r.draw - SNAP * r.kick };
}
