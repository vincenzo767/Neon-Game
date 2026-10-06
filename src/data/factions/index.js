import ironclad from './ironclad.js';
import stratos from './stratos.js';
import blacktide from './blacktide.js';
import helix from './helix.js';
import outerstar from './outerstar.js';
import drowned from './drowned.js';
import { RNG } from '../../core/RNG.js';

// The Undercrown: six syndicate factions (UPDATE_02 §2). Systems read the
// faction data through these helpers only (additive hooks; nothing in M1–M4c
// depends on a faction existing).

export const FACTIONS = { ironclad, stratos, blacktide, helix, outerstar, drowned };
export const FACTION_IDS = Object.keys(FACTIONS);
export const factionById = (id) => FACTIONS[id] || null;

/** Boss archetype → owning faction (UPDATE_02 §2: each syndicate owns one archetype). */
export const ARCHETYPE_FACTION = {
  ground: 'ironclad', aerial: 'stratos', sea: 'blacktide', mecha: 'helix', extraterrestrial: 'outerstar', abyssal: 'drowned',
};
export const factionForArchetype = (a) => FACTIONS[ARCHETYPE_FACTION[a]] || null;

/**
 * Biome ownership (§2.7). Split territories:
 *   Corporate Spire  — Helix on the ground, Stratos in the skies (by unit type)
 *   Orbital Elevator — Helix on the lower levels, the Choir on the upper
 *                      levels (the stage climbs: before / after the mid-boss)
 */
export const BIOME_OWNERS = {
  skyway: { main: 'ironclad' },
  foundry: { main: 'ironclad' },
  storm: { main: 'stratos' },
  harbor: { main: 'blacktide' },
  spire: { main: 'helix', ground: 'helix', air: 'stratos' },
  datacore: { main: 'helix' },
  elevator: { main: 'helix', lower: 'helix', upper: 'outerstar' },
  undercity: { main: 'drowned' },
  crater: { main: 'outerstar' },
};

/**
 * Home faction of every M3 enemy (§3: "existing M3 enemies get a faction
 * field"). Applied to the roster defs as `def.faction` by `tagEnemyRoster`;
 * outside a stage (test range) enemies wear their home colours.
 */
export const ENEMY_HOME_FACTION = {
  drone: 'helix', dart: 'stratos', car: 'ironclad', bike: 'ironclad', turret: 'helix', flak: 'ironclad',
  truck: 'ironclad', tank: 'ironclad', walker: 'helix', carrier: 'stratos', minelayer: 'blacktide',
  gunship: 'stratos', sniper: 'helix', laserpod: 'helix', spinner: 'outerstar', bug: 'outerstar',
  bomber: 'stratos', orbiter: 'outerstar', splitter: 'outerstar', seeker: 'blacktide', frigate: 'blacktide',
  gatekeeper: 'helix', syndicateCore: 'helix',
};

export function tagEnemyRoster(enemies) {
  for (const [id, f] of Object.entries(ENEMY_HOME_FACTION)) if (enemies[id]) enemies[id].faction = f;
}

/**
 * Faction presentation for a generated stage plan: the faction that owns the
 * territory, its dispatch line (seeded, so a seed always briefs the same) and
 * a resolver for which faction's colours a spawned enemy wears.
 */
export function stageFactions(plan) {
  const own = BIOME_OWNERS[plan.biome.id] || { main: 'ironclad' };
  const main = FACTIONS[own.main];
  const R = new RNG(`${plan.seed}:dispatch:${plan.index}`);
  const line = main.dispatch[R.int(0, main.dispatch.length - 1)].replace('{territory}', titleCase(plan.biome.name));
  const second = own.air ? FACTIONS[own.air] : own.upper ? FACTIONS[own.upper] : null;
  return {
    own, main, second, line,
    /** Faction id for an enemy def; `upper` = the stage has passed its mid-boss. */
    resolve(def, upper = false) {
      if (own.air) return def.ground ? own.ground : own.air;
      if (own.upper) return upper ? own.upper : own.lower;
      return own.main;
    },
  };
}

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
