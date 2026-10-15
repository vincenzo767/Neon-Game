import { createRig } from './art/mechaRig.js';

// BRUNO v2: the Ironhound as a heavy-artillery component mecha (ASSET_NOTES.md
// "Rebuild v2"). The arsenal expands with the tiers (no wings): the shared rig
// (art/mechaRig.js) drives the two artillery arrays, the hand-gun recoil and
// the layer poses; Bruno's own part is the shoulder-cannon focus cycle and the
// shoulder recoil. Visual only, except the focus state, which decides when
// the shoulder barrage fires (gameplay numbers live in bruno.js, BRUNO).
//
// Layers (process-art `parts`, bruno.layers.json): gunL/R (inner long barrel +
// forearm and fist, pivot at the elbow), shoulderRootL/R (black housing +
// wide-bore cannon) + shoulderTipL/R (outer long barrel, telescopes into the
// housing), sideRootL/R (side-cannon base) + sideTipL/R (its barrel and
// magenta mouth), body.
//
// Tier configurations:   hand guns      shoulder cannons            side cannons
//   T1 base              fire           compact (lowered, tucked,   retracted
//                                       long barrel telescoped)
//   T2 enhanced          fire, hotter   compact                     retracted
//   T3 expansion         fire           raised + locked, long       half out
//                                       barrel 60 % out
//   T4 full arsenal      max            fully deployed              fully out
// Deploy runs shoulder then side; a tier loss retracts side then shoulder.

export const RIG = {
  names: { inner: 'shoulder', outer: 'side' },
  levels: { inner: [0, 0, 0.6, 1], outer: [0, 0, 0.5, 1] },
  // Shoulder cannons: compact = turned slightly in, slid down and in (@2x px), the long
  // barrel telescoped 85 % into the housing. They rise, turn out and lock at 60 %, then
  // the barrel extends.
  inner: { deploy: 42, retract: 24, swing: 0.1, slide: 0.85, lockAt: 0.6, shift: [7, 30] },
  // Side cannons: retracted = sunk back toward the torso, barrel slid into the base.
  outer: { deploy: 32, retract: 20, swing: 0, slide: 0.8, lockAt: 0.5, shift: [8, 14] },
  // Hand guns: recoil (@2x px back along the barrel, per tier) and recovery.
  recoil: [5, 6, 7, 8],
  recover: 0.28,
  // Heavy artillery barely sways.
  breathe: { inner: 0.03, outer: 0.033, amp: 0.004, flare: 0 },
  // Shoulder cannons: recoil per focus volley (@2x px) and recovery.
  shoulderKick: 9,
  shoulderRecover: 0.2,
  // Focus cycle (steps): the shoulder cannons charge 0.25 s before the barrage, then recover.
  focus: { charge: 15, recover: 12 },
  // VFX intensity per tier (index 0 = T1): muzzle flash, hand-gun channel, artillery aura.
  fx: {
    flash: [1, 1.3, 1.45, 1.7],
    channel: [0.55, 1, 1.1, 1.35],
    aura: [0, 0, 0.45, 1],
  },
  // Draw order (back to front): side cannons under everything (they sit under the
  // torso armour), shoulder cannons under the hand guns, the body last.
  order: ['sideTipL', 'sideTipR', 'sideRootL', 'sideRootR', 'shoulderTipL', 'shoulderTipR', 'shoulderRootL', 'shoulderRootR', 'gunL', 'gunR', 'body'],
  // Anchors that ride a layer.
  attach: {
    muzzleL: 'gunL', muzzleR: 'gunR', chanL: 'gunL', chanR: 'gunR', gripL: 'gunL', gripR: 'gunR', elbowL: 'gunL', elbowR: 'gunR',
    shoulderPivotL: 'shoulderRootL', shoulderPivotR: 'shoulderRootR', shoulderJointL: 'shoulderRootL', shoulderJointR: 'shoulderRootR',
    wideL: 'shoulderRootL', wideR: 'shoulderRootR', housingL: 'shoulderRootL', housingR: 'shoulderRootR',
    shoulderTipL: 'shoulderTipL', shoulderTipR: 'shoulderTipR',
    sidePivotL: 'sideRootL', sidePivotR: 'sideRootR', sideJointL: 'sideRootL', sideJointR: 'sideRootR',
    sideTipL: 'sideTipL', sideTipR: 'sideTipR',
  },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rig = createRig(RIG);

/** Fresh rig state (p.ps.br): the shared fields plus the focus cycle's. */
export function rigState() {
  return rig.state({
    fs: 'off', ft: 0,   // focus cycle: off → charge → active → recover → off
    want: false,        // fire() asked for focus this step
    recS: 0,            // shoulder-cannon recoil 0..1
    volT: 99,           // steps since the last shoulder volley
    alt: 0,             // odd flak counts: which hand gun fires the middle shell
  });
}

/**
 * Advance the rig one step. Returns events for the FX layer:
 * { deploy3, lock3 (shoulder cannons), deploy4, lock4 (side cannons), retract3, retract4,
 *   charge, active, release }.
 */
export function step(p) {
  const br = p.ps.br, ev = rig.step(p, br);
  br.recS *= 1 - RIG.shoulderRecover;
  br.volT++;
  const want = br.want && p.focus && p.state === 'alive';
  br.want = false;
  br.ft++;
  if (want) {
    if (br.fs === 'off' || br.fs === 'recover') { br.fs = 'charge'; br.ft = 0; ev.charge = true; }
    else if (br.fs === 'charge' && br.ft >= RIG.focus.charge) { br.fs = 'active'; br.ft = 0; ev.active = true; }
  } else if (br.fs === 'charge') { br.fs = 'off'; br.ft = 0; }
  else if (br.fs === 'active') { br.fs = 'recover'; br.ft = 0; ev.release = true; }
  else if (br.fs === 'recover' && br.ft >= RIG.focus.recover) { br.fs = 'off'; br.ft = 0; }
  return ev;
}

/** The hand guns fired this step (recoil and armour flash on both). */
export function fired(p) { rig.fired(p.ps.br); }

/** The shoulder cannons fired a focus volley. */
export function volleyFired(p) {
  const br = p.ps.br;
  br.recS = 1;
  br.volT = 0;
}

/** Focus level 0..1: rising while charging, 1 during the barrage, falling while recovering. */
export function focusLevel(br) {
  if (br.fs === 'charge') return clamp01(br.ft / RIG.focus.charge);
  if (br.fs === 'active') return 1;
  if (br.fs === 'recover') return 1 - clamp01(br.ft / RIG.focus.recover);
  return 0;
}

/** Pose of one layer (mechaArt rig; see art/mechaRig.js), plus the shoulder cannons' recoil and charge brace. */
export function pose(p, name, A) {
  const br = p.ps.br;
  if (!br) return {};
  const ps = rig.pose(p, br, name, A);
  if (name.startsWith('shoulder')) {
    // Recoil straight back; while charging the cannons settle (a fading tremor) as they align.
    const shake = br.fs === 'charge' ? 0.6 * (1 - focusLevel(br)) * Math.sin(p.t * 1.7) : 0;
    ps.oy = (ps.oy || 0) + RIG.shoulderKick * br.recS + shake;
  }
  return ps;
}
