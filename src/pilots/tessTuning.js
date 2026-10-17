// TESS v2 tuning (ASSET_NOTES.md "Rebuild v2", approved 1 A, 2 A, 3 B, 4 A,
// 5 yes, 6 yes, 8 yes). Every gameplay number of the kit lives here.

export const TESS = {
  // Crescent Blades: one volley every `cd` steps, the swinging arm alternates.
  // Per tier: crescents per volley, size (× the T1 crescent), speed (units / step), damage each.
  blades: {
    cd: 6,
    n: [2, 3, 4, 6],
    size: [1.0, 1.25, 1.5, 1.8],
    speed: [12, 14, 16, 18],
    dmg: [2.3, 2.75, 3.05, 2.75],
    r: 7,               // T1 hit radius (× size)
    turn: [0.11, 0.12, 0.13, 0.14], // homing turn rate (rad / step)
    spread: 0.75,       // launch angles: up ± this (rad), random
    seek: 80,           // steps a crescent keeps chasing before it flies straight on
  },
  // Focus: two glitch clones ahead of her that throw her exact volley.
  clones: { at: [[-70, -90], [70, -90]], follow: 0.22, mul: 0.6, fade: 10 },
  // Special: Shadow Form (every attack phases through her).
  shadow: { dur: 600, cd: 1800 },
  // Bomb: Thousand Cuts + a three-crescent fan from her and from each clone.
  bomb: { dur: 150, at: 14, fan: [-0.38, 0, 0.38], w: 110, speed: 7, dmg: 14 },
  // Ultimate: Void Cross Annihilation.
  ult: {
    dur: 540,
    compress: 36,        // steps gathering at Tess
    speed: 4,            // units / step
    top: 190,            // the cross detonates when its core reaches this height (the cloud rises above it)
    maxTravel: 150,
    crit: 42,            // critical compression at the top
    w: 360,              // crescent width
    spear: 150,          // vertical spear length ahead of the core
    bossDmg: 10, bossEvery: 5,
    nukeDmg: 80,
  },
};

export const clampT = (p) => Math.max(0, Math.min(3, p.tier - 1));
