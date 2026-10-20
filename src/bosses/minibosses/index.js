import ground from './ground.js';
import sea from './sea.js';
import aerial from './aerial.js';
import mecha from './mecha.js';
import extraterrestrial from './extraterrestrial.js';
import abyssal from './abyssal.js';

// The 30 level mini-bosses (one per campaign level, see stages/campaign.js).
// Spawned through BossController like the main bosses; not part of the
// main-boss roster (practice list, rotation, Warden unlocks).

export const MINIBOSS_LIST = [...ground, ...sea, ...aerial, ...mecha, ...extraterrestrial, ...abyssal];
export const MINIBOSSES = Object.fromEntries(MINIBOSS_LIST.map((d) => [d.id, d]));
