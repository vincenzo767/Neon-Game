// Scoring rules (M7a, prompt §5). Data + small pure helpers; the World,
// StageDirector and PlayScene call into these so every number lives here.
//
//   Kill combo   kills within COMBO_WINDOW steps of each other build a chain;
//                the chain sets a multiplier (×1.0 … ×4.0) on kill score.
//   Medals       each medal collected is worth more than the last (+100,
//                up to 10,000); letting one fall off-screen resets the value.
//   Boss bonus   a main boss or mid-boss defeated without bombing during
//                the fight pays a NO-BOMB bonus in the stage tally.
//   Extends      score thresholds grant a 1UP. Thresholds scale with the
//                difficulty score multiplier so harder modes don't extend
//                for free.
//
// All gains still pass through World.score, which applies the difficulty
// score multiplier (UPDATE_01 §3).

export const COMBO_WINDOW = 120;          // steps between kills before the chain drops
export const COMBO_STEP = 8;              // kills per multiplier step
export const COMBO_INC = 0.25;            // multiplier added per step
export const COMBO_MAX = 4;

/** Kill-combo multiplier for a chain length. */
export function comboMult(chain) {
  return Math.min(COMBO_MAX, 1 + Math.floor(chain / COMBO_STEP) * COMBO_INC);
}

export const MEDAL_START = 100;
export const MEDAL_STEP = 100;
export const MEDAL_MAX = 10000;

/** NO-BOMB boss bonus, per loop. */
export const NO_BOMB_BOSS = { boss: 300000, midboss: 80000 };

/** Raw extend thresholds (before the difficulty multiplier); then every EXTEND_EVERY. */
export const EXTENDS = [2000000, 6000000, 12000000];
export const EXTEND_EVERY = 12000000;
export const MAX_LIVES = 8;

/** The n-th extend threshold (0-based) for a difficulty score multiplier. */
export function extendAt(n, scoreMul = 1) {
  const raw = n < EXTENDS.length ? EXTENDS[n] : EXTENDS[EXTENDS.length - 1] + (n - EXTENDS.length + 1) * EXTEND_EVERY;
  return raw * scoreMul;
}

/**
 * Per-run extend tracker. `check()` returns how many new extends the score
 * has crossed since the last call (normally 0 or 1).
 */
export class ExtendTracker {
  constructor(scoreMul = 1) {
    this.scoreMul = scoreMul;
    this.n = 0;
  }

  get next() { return extendAt(this.n, this.scoreMul); }

  // `n` is never reset: after a continue (score back to ~0) the next extend
  // is still the next unclaimed threshold, so extends can't be farmed.
  check(score) {
    let got = 0;
    while (score >= this.next) { this.n++; got++; }
    return got;
  }
}
