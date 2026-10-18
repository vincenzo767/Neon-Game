// ODUYA v2 tuning (ASSET_NOTES.md "Rebuild v2", approved 1 A, 2 A, 3 yes,
// 4 A, 5 yes). The strand rules and damage are the art test's; new here are
// the leader travel, the fist arcs that replace the coils, and the ultimate.

export const ODUYA = {
  leader: { speed: 60 },         // units / step a strand's leader races along its chain (damage lands on arrival)
  fistArcs: { reach: 230, dmg: 0.48 }, // per strike, coilCount(strands) arcs from the fist (= the old coils' 7.2 DPS each)
  web: { speed: 40 },            // Thundershock's web, units / step
  storm: { cloudY: 56, from: 12, to: 116, every: 4, clap: 116 }, // Storm Cell (same 27 strikes as before)
  ult: {
    dur: 420,
    charge: 60,                  // steps gathering the thunder core between the fists
    travel: 180,                 // steps up the screen
    top: 150,                    // the core stops here
    crit: 36,                    // critical charge before the detonation
    lashR: 220, lashDmg: 3, lashEvery: 6,
    cancelR: 120,
    nukeDmg: 60,
  },
};
