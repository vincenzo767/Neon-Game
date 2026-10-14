// Shared component-mecha rig (ART_PIPELINE.md "Component mecha"): the tier
// wing state machines, cannon recoil and armour-flash timers, and the pose of
// each rigged layer. Visual only. Each pilot configures it in its own
// <pilot>Rig.js and keeps its attack logic there or in the pilot file (Kairo:
// the chest beam; Mira: the focus needle-stream cycle).
//
//   const rig = createRig({ inner, outer, recoil, recover, breathe, gunLift });
//
// inner / outer  blade arrays: { deploy, retract (steps), swing (rad, left side;
//                folded = rotated by this much about the pivot; the right side
//                mirrors it), slide (fraction of the tip section that telescopes
//                into the root), lockAt (deployment fraction where the swing
//                locks; the tip extends after it) }
// recoil         per-tier kick (@2x px back along the barrel); recover: decay rate
// breathe        optional { inner, outer, amp, flare } idle sway rates (rad/step),
//                amplitude, and outward flare in focus
// gunLift(p)     optional extra outward cannon rotation (e.g. Kairo's beam)
//
// Layer names: gun<L|R>, <inner|outer>Root<L|R>, <inner|outer>Tip<L|R>; the
// anchors <blade>Pivot<s>, <blade>Joint<s>, <blade>Tip<s> place the tips.
// Tiers: inner blades deploy at tier 3, outer at tier 4; deploy inner then
// outer, retract (tier loss) outer then inner.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (u) => 1 - (1 - u) ** 3;
/** Ease-out with a small overshoot: the blade swings past and settles (the lock). */
const easeBack = (u) => { const c = 1.6; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

export function createRig(C) {
  const br = { inner: 0.045, outer: 0.037, amp: 0.012, flare: 0.05, ...(C.breathe || {}) };

  /** Fresh rig state (`extra`: the pilot's own fields, e.g. a focus-cycle state). */
  function state(extra = {}) {
    return {
      inner: 0, outer: 0,            // deployment 0 (folded) .. 1 (locked out)
      innerDir: 0, outerDir: 0,      // +1 deploying, -1 retracting, 0 still
      lockInner: 0, lockOuter: 0,    // lock-flash timers (steps left)
      wave3: 0, wave4: 0,            // tier-transition wave timers
      recL: 0, recR: 0,              // cannon recoil 0..1
      fireT: 99,                     // steps since the cannons last fired
      flashL: 0, flashR: 0,          // armour illumination after a shot
      chestT: 0,                     // chest-emitter flash after a chest volley
      ...extra,
    };
  }

  /**
   * Advance the wings and timers one step (60 Hz). Returns events for the FX layer:
   * { deploy3, deploy4, lock3, lock4, retract3, retract4 }.
   */
  function step(p, kr) {
    const ev = {}, tier = p.tier;
    // Tier configuration: inner first on the way up, outer first on the way down.
    const wantInner = tier >= 3 ? 1 : 0, wantOuter = tier >= 4 ? 1 : 0;
    const move = (key, want, B, gate, lockKey, evUp, evDown, evLock) => {
      const v = kr[key];
      if (want > v && gate) {
        if (kr[key + 'Dir'] !== 1) ev[evUp] = true;
        kr[key + 'Dir'] = 1;
        kr[key] = Math.min(1, v + 1 / B.deploy);
        if (kr[key] === 1) { kr[key + 'Dir'] = 0; kr[lockKey] = 18; ev[evLock] = true; }
      } else if (want < v && gate) {
        if (kr[key + 'Dir'] !== -1) ev[evDown] = true;
        kr[key + 'Dir'] = -1;
        kr[key] = Math.max(0, v - 1 / B.retract);
        if (kr[key] === 0) kr[key + 'Dir'] = 0;
      } else kr[key + 'Dir'] = 0;
    };
    move('inner', wantInner, C.inner, wantInner === 1 || kr.outer === 0, 'lockInner', 'deploy3', 'retract3', 'lock3');
    move('outer', wantOuter, C.outer, wantOuter === 0 || kr.inner === 1, 'lockOuter', 'deploy4', 'retract4', 'lock4');
    if (ev.deploy3) kr.wave3 = 40;
    if (ev.deploy4) kr.wave4 = 60;
    for (const k of ['lockInner', 'lockOuter', 'wave3', 'wave4', 'flashL', 'flashR', 'chestT']) if (kr[k] > 0) kr[k]--;
    // Cannon recovery.
    kr.recL *= 1 - C.recover; kr.recR *= 1 - C.recover;
    kr.fireT++;
    return ev;
  }

  /** The cannons fired this step: both, or one side ('L' / 'R'). Recoil and armour flash per side. */
  function fired(kr, side) {
    if (side !== 'R') { kr.recL = 1; kr.flashL = 6; }
    if (side !== 'L') { kr.recR = 1; kr.flashR = 6; }
    kr.fireT = 0;
  }

  /**
   * Pose of one layer (mechaArt rig): `A` = anchors (@2x px, getAnchors()).
   * Blades: the root swings about its pivot (with an overshoot that reads as the
   * lock); the tip telescopes out of the root along the blade's axis, then rides
   * the same swing. Cannons: recoil back along the barrel, a small outward kick,
   * a slow stabilising sway, and a lag when banking.
   */
  function pose(p, kr, name, A) {
    const side = name.endsWith('L') ? -1 : 1, t = p.t;
    if (name.startsWith('gun')) {
      const rec = side < 0 ? kr.recL : kr.recR, kick = C.recoil[p.tier - 1] * rec;
      const lift = C.gunLift ? C.gunLift(p) : 0;
      return {
        ty: kick, // back along the barrel (the barrel points up the screen)
        rot: side * (0.022 * rec + 0.006 * Math.sin(t * 0.05 + side) + lift) - p.bank * 0.03,
        ox: -p.bank * 2.5,
      };
    }
    const blade = name.startsWith('inner') ? 'inner' : 'outer', B = C[blade], d = kr[blade];
    const swingU = easeBack(clamp01(d / B.lockAt)), extU = easeOut(clamp01((d - B.lockAt * 0.75) / (1 - B.lockAt * 0.75)));
    const flare = p.ps.flare || 0, s = name.endsWith('L') ? 'L' : 'R';
    // Deployed blades breathe and flare outward in focus; banking pulls the far wing in.
    const live = d * (side * (br.amp * Math.sin(t * br[blade] + (blade === 'inner' ? 0 : 1.7)) + br.flare * flare) - p.bank * 0.04);
    const rot = (side < 0 ? B.swing : -B.swing) * (1 - swingU) + live; // left swings by B.swing; the right mirrors it
    if (name.includes('Root')) return { rot };
    // Tip: slide back toward the root along pivot → tip, before the swing.
    const pv = A[`${blade}Pivot${s}`], tp = A[`${blade}Tip${s}`], jn = A[`${blade}Joint${s}`];
    const ax = tp[0] - pv[0], ay = tp[1] - pv[1], L = Math.hypot(ax, ay) || 1;
    const slide = Math.hypot(tp[0] - jn[0], tp[1] - jn[1]) * B.slide * (1 - extU);
    return { rot, tx: -ax / L * slide, ty: -ay / L * slide };
  }

  return { state, step, fired, pose };
}
