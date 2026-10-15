// BRUNO v2 tuning (ASSET_NOTES.md "Rebuild v2"): every gameplay number of the kit in
// one place, owner-approved. Damage is per shell / blast before dmgMul(); the FX
// (brunoFx.js) read these values but never decide damage.

export const BRUNO = {
  tierDmg: [1.0, 1.2, 1.45, 1.75],          // central tier multiplier (shots and focus)
  flak: { dmg: 1.6, r: 20, cd: 8 },          // normal fan: per shell, burst radius, cadence
  side: { dmg: 1.6, r: 20, speed: 10 },      // tiers 3-4: one shell per side cannon per volley
  // Focus barrage: per-shell damage by tier (tuned to about 1.4x normal fire, tools/dps.mjs),
  // burst radius, cadence, speed. T1-T2: the wide-bore cannons; T3-T4: + the long barrels.
  focus: { dmg: [7.0, 9.8, 6.3, 7.7], r: 34, cd: 10, speed: 12 },
  // Reactive Shield: duration, sphere radius, bonus per absorbed attack, bonus cap
  // (+1.0 = x2), steps of laser / body contact per absorbed "attack", bonus kept after
  // the shield ends, then faded out over `fade`.
  shield: { dur: 360, r: 64, per: 0.02, cap: 1.0, touchEvery: 10, hold: 300, fade: 60, form: 12 },
  bomb: { r: 200, dmg: 25, grow: 18 },       // opening blast: radius, damage (once per enemy), expansion steps
  // Ultimate: bombing run (steps), bomber waves (start steps), drop rhythm, run bombs,
  // the nuke's warning start, drop time, damage (once per enemy, the whole playfield), tail.
  ult: { run: 360, waves: [1, 100, 200], dropEvery: 6, bombDmg: 9, bombR: 60, warn: 300, drop: 36, nukeDmg: 60, tail: 80 },
};

export const clampT = (p) => Math.max(0, Math.min(3, p.tier - 1));

/** Shield bonus in effect now: full while shielded and for `hold` after, then fading to 0. */
export function ampNow(p) {
  const ps = p.ps;
  if (!ps.amp) return 0;
  if (ps.shield) return ps.amp;
  return ps.amp * Math.min(1, (ps.ampT || 0) / BRUNO.shield.fade);
}

/** Damage multiplier for Bruno's shots and focus: tier x (1 + shield bonus). */
export const dmgMul = (p) => BRUNO.tierDmg[clampT(p)] * (1 + ampNow(p));

/** Shield radius while it forms (overshoots, then settles). */
export function shieldR(t) {
  const C = BRUNO.shield, u = Math.min(1, t / C.form);
  return C.r * (1 + 0.12 * Math.sin(u * Math.PI)) * (1 - (1 - u) ** 3);
}
