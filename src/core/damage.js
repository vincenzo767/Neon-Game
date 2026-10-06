// Damage flags (UPDATE_01 §2.6). A bitmask carried by every damage source:
// World.damage / damageCircle / damageLine, beams, and player shots
// (BulletSystem.dflags). Plain damage passes 0.
//
//   IGNORES_SHIELDS      hits through armour < 1 and boss shields (dives,
//                        barriers). Never through a boss phase transition:
//                        there is no phase to damage then.
//   INSTANT_KILL         destroys any enemy. A main boss is defeated outright,
//                        through its normal defeat path (death sequence,
//                        score, medals, arena hand-back, stage tally). Works
//                        mid-transition: the transition is cancelled safely.
//   INSTANT_PHASE_CLEAR  a main boss's current phase ends at once, so the
//                        arena transition still plays. Any other enemy
//                        (including mid-bosses) is destroyed.

export const DMG_IGNORES_SHIELDS = 1;
export const DMG_INSTANT_KILL = 2;
export const DMG_INSTANT_PHASE_CLEAR = 4;
export const DMG_INSTANT = DMG_INSTANT_KILL | DMG_INSTANT_PHASE_CLEAR;

/** Build a mask from named flags: dmgFlags({ ignoresShields: true, instantKill: true }). */
export function dmgFlags({ ignoresShields = false, instantKill = false, instantPhaseClear = false } = {}) {
  return (ignoresShields ? DMG_IGNORES_SHIELDS : 0)
    | (instantKill ? DMG_INSTANT_KILL : 0)
    | (instantPhaseClear ? DMG_INSTANT_PHASE_CLEAR : 0);
}
