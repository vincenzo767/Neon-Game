// Mini-boss defaults (level rework). A mini-boss is a full BossController
// boss — own art (lazy atlas), look, breakable parts, telegraphed hazards —
// cut down to three short phases: it holds the middle of its level between
// waves 5 and 6. It never changes the arena, has no music layers of its own
// (the level's music keeps playing), no desperation phase and smaller drops.
//
// Difficulty → phases: Easy / Normal play phases 1 and 3, Hard and above all three.

export const MINI_SETS = { 1: [2], 2: [0, 2], 3: [0, 2], 4: [0, 1, 2], 5: [0, 1, 2] };
const MINI_PHASE_TIME = 60 * 45;

export function mini(def) {
  return {
    mini: true, score: 30000, deathSequence: 'chain_explode', phaseSets: MINI_SETS,
    ...def,
    phases: def.phases.map((p) => ({ transitionFx: 'flash', musicLayer: null, time: MINI_PHASE_TIME, ...p })),
  };
}
