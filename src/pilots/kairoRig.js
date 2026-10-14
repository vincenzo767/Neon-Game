import { createRig } from './art/mechaRig.js';

// KAIRO v2: the Stormlance as a component mecha (ASSET_NOTES.md "Rebuild v2").
// One config table (RIG) holds the timings, retracted angles and intensities.
// The wings, recoil and layer poses come from the shared rig (art/mechaRig.js);
// the focus-beam state machine is Kairo's own and lives here. `step()` runs
// both once per fixed step (60 Hz); `pose()` gives mechaArt's rig renderer a
// pose per layer. Visual only, except the focus-beam state, which gates the
// beam's damage (approved: a 0.2 s chest charge before the beam is live).
//
// Layers (process-art `parts`, kairo.layers.json): gunL/R (cannon + fist +
// forearm, pivot at the elbow), innerRootL/R + innerTipL/R (inner blade in two
// sections), outerRootL/R + outerTipL/R (outer blade in two sections), body.
//
// Tier configurations:            inner wings   outer wings   cannons
//   T1 base                       retracted     retracted     standard
//   T2 enhanced cannons           retracted     retracted     enhanced
//   T3 inner wing deployment      deployed      retracted     enhanced
//   T4 full power                 deployed      deployed      maximum
// Deploying runs inner then outer; retracting (tier loss) runs outer then inner.

export const RIG = {
  // Blade deployment: steps to deploy / retract, retracted swing (rad, left side;
  // negative = counter-clockwise on screen, i.e. out past the side and down),
  // and how far the tip section telescopes into the root (fraction of its length).
  inner: { deploy: 36, retract: 22, swing: -2.27, slide: 0.9, lockAt: 0.62 },
  outer: { deploy: 54, retract: 26, swing: -2.39, slide: 0.9, lockAt: 0.6 },
  // Cannons: recoil kick (@2x px back along the barrel, per tier) and recovery rate.
  recoil: [6, 7.5, 8.5, 10],
  recover: 0.24,
  // Focus beam: charge (no damage) → active → recovery (collapse to the chest).
  beam: { charge: 12, recover: 9 },
  // VFX intensity per tier (index 0 = T1): muzzle flash, channel glow, trail, aura.
  fx: {
    flash: [1, 1.5, 1.65, 1.85],
    channel: [0.35, 1, 1.1, 1.3],   // T1: the cannons idle (they fire from T2)
    trail: [0.6, 0.85, 1, 1.25],
    aura: [0, 0, 0.35, 1],
  },
  // Layer draw order (back to front): retracted blades fold under everything,
  // the cannons sit over the blades and under the shoulder armour.
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

// Shared wings + recoil; the cannons part slightly while the chest beam fires.
const rig = createRig({ ...RIG, gunLift: (p) => beamLevel(p.ps.kr) * 0.05 });

/** Fresh rig state (p.ps.kr): the shared fields plus the focus beam's. */
export function rigState() {
  return rig.state({
    fs: 'off', ft: 0,              // focus beam state + steps in it
    want: false,                   // fire() asked for the beam this step
    beamTop: 0,                    // beam reach while collapsing (world y)
  });
}

/**
 * Advance the rig one step. Returns events for the FX layer:
 * { deploy3, deploy4, lock3, lock4, retract3, retract4, charge, active, release }.
 */
export function step(p) {
  const kr = p.ps.kr, ev = rig.step(p, kr);
  // Focus beam: off → charge (0.2 s, no damage) → active → recovery (collapse) → off.
  const want = kr.want && p.focus && p.state === 'alive';
  kr.want = false;
  kr.ft++;
  if (want) {
    if (kr.fs === 'off' || kr.fs === 'recover') { kr.fs = 'charge'; kr.ft = 0; ev.charge = true; }
    else if (kr.fs === 'charge' && kr.ft >= RIG.beam.charge) { kr.fs = 'active'; kr.ft = 0; ev.active = true; }
  } else if (kr.fs === 'charge') { kr.fs = 'off'; kr.ft = 0; }
  else if (kr.fs === 'active') { kr.fs = 'recover'; kr.ft = 0; ev.release = true; }
  else if (kr.fs === 'recover' && kr.ft >= RIG.beam.recover) { kr.fs = 'off'; kr.ft = 0; }
  return ev;
}

/** The cannons fired this step (both together; recoil and armour flash per side). */
export function fired(p) { rig.fired(p.ps.kr); }

/** Tier 1 fired from the chest emitter: a chest flash, the cannons stay still. */
export function chestFired(p) {
  p.ps.kr.chestT = 6;
}

/** Charge of the focus beam 0..1 (charging), 1 while active, falling while recovering. */
export function beamLevel(kr) {
  if (kr.fs === 'charge') return clamp01(kr.ft / RIG.beam.charge);
  if (kr.fs === 'active') return 1;
  if (kr.fs === 'recover') return 1 - clamp01(kr.ft / RIG.beam.recover);
  return 0;
}

/** Pose of one layer (mechaArt rig; see art/mechaRig.js). */
export function pose(p, name, A) {
  const kr = p.ps.kr;
  if (!kr) return {};
  return rig.pose(p, kr, name, A);
}
