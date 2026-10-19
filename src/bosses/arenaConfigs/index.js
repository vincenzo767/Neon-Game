import ground from './ground.js';
import aerial from './aerial.js';
import naval from './naval.js';
import mecha from './mecha.js';
import extraterrestrial from './extraterrestrial.js';
import abyssal from './abyssal.js';
import midboss from './midboss.js';

// All authored phase-arena configurations, by stable id.
// Archetype files: ground, aerial, naval, mecha, extraterrestrial, abyssal.

/** The 150 main-boss phase arenas. */
export const ARENA_LIST = [...ground, ...aerial, ...naval, ...mecha, ...extraterrestrial, ...abyssal];
/** Optional mid-boss arena profiles (not part of the boss rotation). */
export const MIDBOSS_ARENAS = midboss;

export const ARENAS = Object.fromEntries([...ARENA_LIST, ...MIDBOSS_ARENAS].map((a) => [a.id, a]));
