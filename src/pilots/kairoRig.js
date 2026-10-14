// KAIRO v2: the Stormlance as a component mecha (ASSET_NOTES.md "Rebuild v2").
// One config table (RIG) holds the timings, retracted angles and intensities;
// `step()` runs the state machines once per fixed step (60 Hz); `pose()` turns
// that state into a pose per layer for mechaArt's rig renderer. Visual only,
// except the focus-beam state, which gates the beam's damage (approved: a
// 0.2 s chest charge before the beam is live).
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
    flash: [1, 1.25, 1.45, 1.75],
    channel: [0.5, 0.85, 1, 1.25],
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
const easeOut = (u) => 1 - (1 - u) ** 3;
/** Ease-out with a small overshoot: the blade swings past and settles (the lock). */
const easeBack = (u) => { const c = 1.6; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

/** Fresh rig state (p.ps.kr). */
export function rigState() {
  return {
    inner: 0, outer: 0,            // deployment 0 (retracted) .. 1 (locked out)
    innerDir: 0, outerDir: 0,      // +1 deploying, -1 retracting, 0 still
    lockInner: 0, lockOuter: 0,    // lock-flash timers (steps left)
    wave3: 0, wave4: 0,            // tier-transition wave timers
    recL: 0, recR: 0,              // cannon recoil 0..1
    fireT: 99,                     // steps since the cannons last fired
    flashL: 0, flashR: 0,          // armour illumination after a shot
    fs: 'off', ft: 0,              // focus beam state + steps in it
    want: false,                   // fire() asked for the beam this step
    beamTop: 0,                    // beam reach while collapsing (world y)
  };
}

/**
 * Advance the rig one step. Returns events for the FX layer:
 * { deploy3, deploy4, lock3, lock4, retract3, retract4, charge, active, release }.
 */
export function step(p) {
  const kr = p.ps.kr, ev = {}, tier = p.tier;
  // Tier configuration: inner first on the way up, outer first on the way down.
  const wantInner = tier >= 3 ? 1 : 0, wantOuter = tier >= 4 ? 1 : 0;
  const move = (key, want, C, gate, lockKey, evUp, evDown, evLock) => {
    const v = kr[key];
    if (want > v && gate) {
      if (kr[key + 'Dir'] !== 1) ev[evUp] = true;
      kr[key + 'Dir'] = 1;
      kr[key] = Math.min(1, v + 1 / C.deploy);
      if (kr[key] === 1) { kr[key + 'Dir'] = 0; kr[lockKey] = 18; ev[evLock] = true; }
    } else if (want < v && gate) {
      if (kr[key + 'Dir'] !== -1) ev[evDown] = true;
      kr[key + 'Dir'] = -1;
      kr[key] = Math.max(0, v - 1 / C.retract);
      if (kr[key] === 0) kr[key + 'Dir'] = 0;
    } else kr[key + 'Dir'] = 0;
  };
  move('inner', wantInner, RIG.inner, wantInner === 1 || kr.outer === 0, 'lockInner', 'deploy3', 'retract3', 'lock3');
  move('outer', wantOuter, RIG.outer, wantOuter === 0 || kr.inner === 1, 'lockOuter', 'deploy4', 'retract4', 'lock4');
  if (ev.deploy3) kr.wave3 = 40;
  if (ev.deploy4) kr.wave4 = 60;
  for (const k of ['lockInner', 'lockOuter', 'wave3', 'wave4', 'flashL', 'flashR']) if (kr[k] > 0) kr[k]--;
  // Cannon recovery.
  kr.recL *= 1 - RIG.recover; kr.recR *= 1 - RIG.recover;
  kr.fireT++;
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
export function fired(p) {
  const kr = p.ps.kr;
  kr.recL = kr.recR = 1;
  kr.flashL = kr.flashR = 6;
  kr.fireT = 0;
}

/** Charge of the focus beam 0..1 (charging), 1 while active, falling while recovering. */
export function beamLevel(kr) {
  if (kr.fs === 'charge') return clamp01(kr.ft / RIG.beam.charge);
  if (kr.fs === 'active') return 1;
  if (kr.fs === 'recover') return 1 - clamp01(kr.ft / RIG.beam.recover);
  return 0;
}

/**
 * Pose of one layer (mechaArt rig): `A` = anchors (@2x px, getAnchors()).
 * Blades: the root swings about its pivot (with an overshoot that reads as the
 * lock); the tip telescopes out of the root along the blade's axis, then rides
 * the same swing. Cannons: recoil back along the barrel, a small outward kick,
 * a slow stabilising sway, and a lag when banking.
 */
export function pose(p, name, A) {
  const kr = p.ps.kr;
  if (!kr) return {};
  const side = name.endsWith('L') ? -1 : 1, t = p.t;
  if (name.startsWith('gun')) {
    const rec = side < 0 ? kr.recL : kr.recR, kick = RIG.recoil[p.tier - 1] * rec;
    const focusLift = beamLevel(kr) * 0.05; // cannons part slightly while the chest fires
    return {
      ty: kick, // back along the barrel (the barrel points up the screen)
      rot: side * (0.022 * rec + 0.006 * Math.sin(t * 0.05 + side) + focusLift) - p.bank * 0.03,
      ox: -p.bank * 2.5,
    };
  }
  const blade = name.startsWith('inner') ? 'inner' : 'outer', C = RIG[blade], d = kr[blade];
  const swingU = easeBack(clamp01(d / C.lockAt)), extU = easeOut(clamp01((d - C.lockAt * 0.75) / (1 - C.lockAt * 0.75)));
  const flare = p.ps.flare || 0, s = name.endsWith('L') ? 'L' : 'R';
  // Deployed blades breathe and flare outward in focus; banking pulls the far wing in.
  const live = d * (side * (0.012 * Math.sin(t * (blade === 'inner' ? 0.045 : 0.037) + (blade === 'inner' ? 0 : 1.7)) + 0.05 * flare) - p.bank * 0.04);
  const rot = (side < 0 ? C.swing : -C.swing) * (1 - swingU) + live; // left swings by C.swing; the right mirrors it
  if (name.includes('Root')) return { rot };
  // Tip: slide back toward the root along pivot → tip, before the swing.
  const pv = A[`${blade}Pivot${s}`], tp = A[`${blade}Tip${s}`], jn = A[`${blade}Joint${s}`];
  const ax = tp[0] - pv[0], ay = tp[1] - pv[1], L = Math.hypot(ax, ay) || 1;
  const slide = Math.hypot(tp[0] - jn[0], tp[1] - jn[1]) * C.slide * (1 - extU);
  return { rot, tx: -ax / L * slide, ty: -ay / L * slide };
}
