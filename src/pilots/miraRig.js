import { createRig } from './art/mechaRig.js';

// MIRA v2: the Halo Sprite as a component mecha (ASSET_NOTES.md "Rebuild v2").
// Wings, recoil and layer poses come from the shared rig (art/mechaRig.js);
// Mira's own part is the focus cycle around her needle stream. Visual only:
// the focus needles fire exactly as before, the cycle only lights the chest
// (owner: no beam, decision 2 B).
//
// Layers (process-art `parts`, mira.layers.json): gunL/R (cannon, side tube and
// fist, pivot at the elbow), innerRootL/R + innerTipL/R (the gold blade pair,
// the long blade's upper half telescopes), outerRootL/R + outerTipL/R (the
// white side blade), body.
//
// Tier configurations:     normal fire     inner array   outer array
//   T1 chest cannon        chest emitter   folded        folded
//   T2 dual cannons        both cannons    folded        folded
//   T3 inner deployment    both cannons    deployed      folded
//   T4 full power          both cannons    deployed      deployed
// Folded, both arrays swing out and down past the shoulders and lie along the
// ladder fins (inner over outer). Deploy runs inner then outer; a tier loss
// retracts outer then inner.

export const RIG = {
  // Blade arrays: steps to deploy / retract, folded swing (rad, left side; negative =
  // counter-clockwise on screen: out past the side and down), tip telescoping, lock point.
  inner: { deploy: 40, retract: 22, swing: -2.62, slide: 0.85, lockAt: 0.6 },
  outer: { deploy: 56, retract: 26, swing: -1.62, slide: 0.85, lockAt: 0.6 },
  // Cannons: recoil (@2x px back along the barrel, per tier; T1 they hold still) and recovery.
  recoil: [0, 5, 6, 7],
  recover: 0.26,
  // Slower, softer idle sway than Kairo's; the blades open a little in focus.
  breathe: { inner: 0.038, outer: 0.031, amp: 0.014, flare: 0.04 },
  // Focus cycle (steps): the chest charges before the stream, then winds down after it.
  focus: { charge: 10, recover: 16 },
  // VFX intensity per tier (index 0 = T1): muzzle flash, cannon channel glow, full-power aura.
  fx: {
    flash: [1, 1.25, 1.4, 1.55],
    channel: [0.3, 1, 1.1, 1.25],   // T1: the cannons idle (the chest fires)
    aura: [0, 0, 0.35, 1],
  },
  // Draw order (back to front): folded blades lie under everything, the cannons over the
  // blades and under the shoulder armour.
  order: ['outerTipL', 'outerTipR', 'outerRootL', 'outerRootR', 'innerTipL', 'innerTipR', 'innerRootL', 'innerRootR', 'gunL', 'gunR', 'body'],
  // Anchors that ride a layer (muzzles recoil with the cannons, tips fold with the blades).
  attach: {
    muzzleL: 'gunL', muzzleR: 'gunR', chanL: 'gunL', chanR: 'gunR', gripL: 'gunL', gripR: 'gunR', elbowL: 'gunL', elbowR: 'gunR',
    innerPivotL: 'innerRootL', innerPivotR: 'innerRootR', innerJointL: 'innerRootL', innerJointR: 'innerRootR',
    innerTipL: 'innerTipL', innerTipR: 'innerTipR',
    outerPivotL: 'outerRootL', outerPivotR: 'outerRootR', outerJointL: 'outerRootL', outerJointR: 'outerRootR',
    outerTipL: 'outerTipL', outerTipR: 'outerTipR',
  },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rig = createRig(RIG);

/** Fresh rig state (p.ps.mr): the shared fields plus the focus cycle's. */
export function rigState() {
  return rig.state({
    fs: 'off', ft: 0,   // focus cycle: off → charge → active → recover → off
    want: false,        // fire() asked for focus this step
    alt: 0,             // tier 3: which cannon fires the centre needle (alternates per volley)
    vol: 0,             // focus volley flash at the chest (steps left)
  });
}

/**
 * Advance the rig one step. Returns events for the FX layer:
 * { deploy3, deploy4, lock3, lock4, retract3, retract4, charge, active, release }.
 */
export function step(p) {
  const mr = p.ps.mr, ev = rig.step(p, mr);
  if (mr.vol > 0) mr.vol--;
  // Focus cycle (visual): the stream starts once the chest has charged; until then
  // the normal fan keeps firing, so no shot is lost.
  const want = mr.want && p.focus && p.state === 'alive';
  mr.want = false;
  mr.ft++;
  if (want) {
    if (mr.fs === 'off' || mr.fs === 'recover') { mr.fs = 'charge'; mr.ft = 0; ev.charge = true; }
    else if (mr.fs === 'charge' && mr.ft >= RIG.focus.charge) { mr.fs = 'active'; mr.ft = 0; ev.active = true; }
  } else if (mr.fs === 'charge') { mr.fs = 'off'; mr.ft = 0; }
  else if (mr.fs === 'active') { mr.fs = 'recover'; mr.ft = 0; ev.release = true; }
  else if (mr.fs === 'recover' && mr.ft >= RIG.focus.recover) { mr.fs = 'off'; mr.ft = 0; }
  return ev;
}

/** The cannons fired this step (recoil and armour flash on both). */
export function fired(p) { rig.fired(p.ps.mr); }

/** The chest emitter fired (tier-1 fan, or a focus volley). */
export function chestFired(p, focus = false) {
  const mr = p.ps.mr;
  mr.chestT = 6;
  if (focus) mr.vol = 4;
}

/** Focus level 0..1: rising while charging, 1 while streaming, falling while recovering. */
export function focusLevel(mr) {
  if (mr.fs === 'charge') return clamp01(mr.ft / RIG.focus.charge);
  if (mr.fs === 'active') return 1;
  if (mr.fs === 'recover') return 1 - clamp01(mr.ft / RIG.focus.recover);
  return 0;
}

/** Pose of one layer (mechaArt rig; see art/mechaRig.js). */
export function pose(p, name, A) {
  const mr = p.ps.mr;
  if (!mr) return {};
  return rig.pose(p, mr, name, A);
}
