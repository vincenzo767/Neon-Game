// Difficulty table: the single source of truth for every difficulty-scaled
// value (UPDATE_01 §3.2). Systems read from here; nothing else hard-codes
// difficulty numbers.
//
// Interpretation notes:
//  * `lives` = total ships at the start (the Player stores spare ships, so it
//    starts with lives - 1 in reserve). Medium (4) matches the M2/M3 default.
//  * `bombs` is the Medium-relative bomb stock: each pilot keeps their own
//    bomb identity, offset by (bombs - 3), never below 1. See startingBombs().
//  * `loopScaling` multiplies the per-loop growth terms in StageGen; the
//    within-loop stage ramp is unchanged.
//  * Medium is ×1.0 everywhere, so it reproduces the M3 tuning exactly
//    (except revenge bullets, which now follow this table instead of loop ≥ 2).

export const DIFFICULTIES = [
  {
    id: 'standard', name: 'STANDARD', color: '#3ef0ff', rgb: [0.25, 0.94, 1.0],
    desc: 'Recommended for a first patrol. Slower, sparser fire and spare ships.',
    bulletSpeed: 0.8, density: 0.7, enemyHp: 0.8,
    bossPhases: 3, desperation: false,
    lives: 5, bombs: 4, loopScaling: 0.75, revenge: false, scoreMul: 1.0,
  },
  {
    id: 'medium', name: 'MEDIUM', color: '#5dff8a', rgb: [0.36, 1.0, 0.54],
    desc: 'The precinct baseline: arcade-standard danmaku.',
    bulletSpeed: 1.0, density: 1.0, enemyHp: 1.0,
    bossPhases: 3, desperation: false,
    lives: 4, bombs: 3, loopScaling: 1.0, revenge: false, scoreMul: 1.5,
  },
  {
    id: 'hard', name: 'HARD', color: '#ffb020', rgb: [1.0, 0.69, 0.13],
    desc: 'Faster, thicker storms. Bosses fight four phases.',
    bulletSpeed: 1.2, density: 1.3, enemyHp: 1.25,
    bossPhases: 4, desperation: false,
    lives: 3, bombs: 3, loopScaling: 1.25, revenge: false, scoreMul: 2.0,
  },
  {
    id: 'extreme', name: 'EXTREME', color: '#ff3a3a', rgb: [1.0, 0.23, 0.23],
    desc: 'Every kill spits revenge fire. Bosses fight all five phases.',
    bulletSpeed: 1.4, density: 1.6, enemyHp: 1.5,
    bossPhases: 5, desperation: false,
    lives: 2, bombs: 2, loopScaling: 1.5, revenge: true, scoreMul: 3.0,
  },
  {
    id: 'hell', name: 'HELL', color: '#ff1438', rgb: [1.0, 0.08, 0.22],
    desc: 'One ship. One bomb. Dense revenge fire and desperate bosses.',
    bulletSpeed: 1.7, density: 2.0, enemyHp: 2.0,
    bossPhases: 5, desperation: true,
    lives: 1, bombs: 1, loopScaling: 2.0, revenge: 'dense', scoreMul: 5.0,
  },
];

export const DEFAULT_DIFFICULTY = 'standard';

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES.find((d) => d.id === DEFAULT_DIFFICULTY);
}

/** Spare ships the Player starts with (Player.lives counts reserves). */
export const startingReserve = (cfg) => Math.max(0, cfg.lives - 1);

/** Bomb stock for a pilot on a difficulty (pilot identity kept, offset from Medium). */
export const startingBombs = (cfg, pilotDef) => Math.max(1, pilotDef.bombStock + cfg.bombs - 3);
