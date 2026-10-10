// Pilot damage balance (M7c). A multiplier on every point of damage the
// pilot deals (shots, beams, specials, bombs, ultimates). Instant-kill and
// phase-clear flags are unaffected.
//
// Method: sustained DPS at full power, 8 s of fire, against one large
// stationary target 180 units ahead (boss-like) with normal fire and with
// focus, plus a line of six small targets (wave clear). Pilots outside
// roughly ±30 % of the median boss DPS (~95) were pulled about halfway back,
// so their identities (slow heavy hitters, utility pilots) survive:
//
//   pilot    boss DPS  why
//   nova       52      most of her value is hacked allies (not measured)
//   holt       63      the twin's mirrored fire rarely converges on one target
//   pike       71      drones scramble rather than add sustained fire
//   aiko       72      tornado cells are defensive (bullet grinding)
//   dax       136      heat ramp rewards holding fire; trimmed lightly
//   bruno     148      slow armoured gunship; trimmed but still the hardest hitter
//   rufus   ~110      untouched: a random gun every 2 s makes single runs swing
//                     51–148; three runs average near the median
//
// Measured after the piercing re-hit cooldown (World.PIERCE_REHIT), which
// already brought Kairo / Tess / Sera / Cass from ~430 down to ~100–117.
// Vincenzo is excluded on purpose (Legendary: meant to be overwhelming).
// Re-measure with scratch tooling before changing these (see PROGRESS.md).

export const PILOT_DAMAGE = {
  nova: 1.35,
  holt: 1.2,
  pike: 1.15,
  aiko: 1.1,
  dax: 0.9,
  bruno: 0.85,
};

/** Damage multiplier for a pilot id (1 if untuned). */
export const pilotDamage = (id) => PILOT_DAMAGE[id] ?? 1;
