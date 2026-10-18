// MIGUERRE v2 rig (ASSET_NOTES.md "Rebuild v2"): the sword arm (right: arm, hand
// and the long pole-sword, turning about the shoulder), the claw arm (left) and
// the two bat wings, on the shared rig path (layers.json `rig: true`).
// - No thrusters: he flies on his wings. A real wing beat: a quick, strong
//   downstroke (the wings spread and sweep forward) and a slower upstroke (they
//   rise and fold, narrowing as seen from above). Faster when moving, a slow
//   glide while focused, held spread for the swing and the ultimate. The body
//   lifts with each downstroke (rig `bob`). `stroke` marks the bottom of each
//   downstroke for the gust FX.
// - The sword swings for the Crescent of Chaos: wind-up (drawn back and out,
//   trembling), slash across the front (right to left), follow-through, return.
//   The crescent tears off the blade at SWING.launch, mid-slash.
// - The claw reaches during the wind-up and clenches through the ultimate.
// - The horns glow as the void beams leave them (both at once, owner's 1B).

export const RIG = {
  order: ['wingL', 'wingR', 'body', 'clawL', 'swordR'],
  attach: {
    grip: 'swordR', guard: 'swordR', swordMid: 'swordR', swordTip: 'swordR', pommel: 'swordR',
    claw: 'clawL',
    wingTipL: 'wingL', wingLowL: 'wingL', wingMidL: 'wingL',
    wingTipR: 'wingR', wingLowR: 'wingR', wingMidR: 'wingR',
  },
};

/** The swing's timeline (steps from the press). */
export const SWING = { wind: 14, launch: 19, slash: 24, hold: 40, end: 64 };
const BACK = 0.55, CROSS = -1.75; // rad: drawn back (out), and across the front at the end of the slash
const DOWN = 0.38;                // share of the beat cycle spent on the downstroke

const smooth = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

/** Rig state on p.ps.mr (created on first use). */
export function rigState(p) {
  return p.ps.mr || (p.ps.mr = {
    ph: 0.5, rate: 1 / 60, amp: 0.3, stroke: false, spread: 0, spreadT: 0,
    swingT: -1, claw: 0, clench: 0, clenchT: 0, hornL: 0, hornR: 0, hornT: 99, charge: 0, chargeT: 0,
  });
}

/** Wing raise 0 (spread, bottom of the downstroke) .. 1 (raised, top of the upstroke). */
export function raise(p) {
  const ph = rigState(p).ph;
  return ph < DOWN ? 1 - smooth(ph / DOWN) : smooth((ph - DOWN) / (1 - DOWN));
}

/** One step. */
export function step(p) {
  const r = rigState(p), alive = p.state === 'alive';
  const moving = Math.abs(p.moveX || 0) + Math.abs(p.moveY || 0) > 0.2, up = (p.moveY || 0) < -0.2;
  const glide = p.focus && alive, held = r.spreadT > 0.5;
  const rate = held ? 1 / 85 : glide ? 1 / 110 : up ? 1 / 30 : moving ? 1 / 40 : 1 / 60;
  const amp = held ? 0.2 : glide ? 0.14 : up ? 0.42 : moving ? 0.36 : 0.3;
  r.rate += (rate - r.rate) * 0.08;
  r.amp += (amp - r.amp) * 0.08;
  const ph0 = r.ph;
  r.ph = (r.ph + r.rate) % 1;
  r.stroke = alive && ph0 < DOWN && r.ph >= DOWN; // the bottom of a downstroke
  r.spread += (Math.max(r.spreadT, glide ? 0.35 : 0) - r.spread) * 0.12; r.spreadT = 0;
  // The swing runs on its own clock; the claw reaches with its wind-up.
  if (r.swingT >= 0 && ++r.swingT > SWING.end) r.swingT = -1;
  const reach = r.swingT >= 0 && r.swingT < SWING.hold ? 1 : 0;
  r.claw += (reach - r.claw) * 0.18;
  r.clench += (r.clenchT - r.clench) * 0.15; r.clenchT = 0;
  r.charge += (r.chargeT - r.charge) * 0.2; r.chargeT = 0;
  r.hornL *= 0.78; r.hornR *= 0.78; r.hornT++;
}

/** Start the sword swing (the special). */
export function swing(p) { const r = rigState(p); r.swingT = 0; }
/** Steps into the swing, or -1. */
export const swingT = (p) => rigState(p).swingT;
/** Hold the wings spread toward f this step. */
export function spread(p, f) { const r = rigState(p); r.spreadT = Math.max(r.spreadT, f); }
/** The claw clenches toward c (0..1) this step. */
export function clench(p, c) { const r = rigState(p); r.clenchT = Math.max(r.clenchT, c); }
/** The horns blaze toward k (0..1) this step (the ultimate's charge). */
export function charge(p, k) { const r = rigState(p); r.chargeT = Math.max(r.chargeT, k); }
/** A void beam leaves the horns: both flare. */
export function hornFlash(p) { const r = rigState(p); r.hornL = r.hornR = 1; r.hornT = 0; }

/** The sword arm's turn about the shoulder now (rad; + = out and back, − = across the front). */
export function swordRot(p) {
  const r = rigState(p), t = r.swingT;
  const idle = Math.sin(p.t * 0.045) * 0.03;
  if (t < 0) return idle;
  if (t < SWING.wind) return idle + BACK * smooth(t / SWING.wind) + Math.sin(t * 2.3) * 0.02 * (t / SWING.wind);
  if (t < SWING.slash) { const u = (t - SWING.wind) / (SWING.slash - SWING.wind); return BACK + (CROSS - BACK) * u * u * (3 - 2 * u); }
  if (t < SWING.hold) return CROSS + 0.1 * Math.sin((t - SWING.slash) / (SWING.hold - SWING.slash) * Math.PI);
  return idle + CROSS * (1 - smooth((t - SWING.hold) / (SWING.end - SWING.hold)));
}

/** The body lifts on each downstroke (world units added to y). */
export function bob(p) {
  const r = rigState(p);
  return (raise(p) - 0.5) * 1.6 * (r.amp / 0.3) + Math.sin(p.t * 0.07) * 0.3;
}

/** Pose of a layer (A: the anchors in @2x px). */
export function pose(p, name, A) {
  const r = rigState(p);
  if (name === 'wingL' || name === 'wingR') {
    const s = name === 'wingL' ? -1 : 1, up = raise(p), sp = r.spread;
    // Forward sweep on the downstroke, back on the upstroke; + rot turns the left wing forward.
    const fwd = (0.13 * (1 - up) - 0.07 * up) * (1 - 0.6 * sp) + 0.08 * sp;
    return {
      rot: -s * fwd - s * 0.04 * r.charge,
      ox: s * (sp * 7 + r.charge * 4),
      sx: 1 - r.amp * up * (1 - 0.5 * sp) + 0.06 * sp,
    };
  }
  if (name === 'swordR') return { rot: swordRot(p) };
  if (name === 'clawL') {
    const tremble = r.clench * Math.sin(p.t * 1.7) * 0.025;
    return { rot: Math.sin(p.t * 0.05 + 1) * 0.025 + 0.2 * r.claw - 0.1 * r.clench + tremble, s: 1 - 0.03 * r.clench };
  }
  return null;
}
