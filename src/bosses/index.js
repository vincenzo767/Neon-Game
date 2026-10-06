import { RNG } from '../core/RNG.js';
import { BossController } from './BossController.js';
import prototype from './test/prototype.js';
import colossusCrawler from './ground/colossusCrawler.js';
import skywardenCarrier from './aerial/skywardenCarrier.js';
import leviathanDreadnought from './sea/leviathanDreadnought.js';
import titanEnforcer from './mecha/titanEnforcer.js';
import hiveSovereign from './extraterrestrial/hiveSovereign.js';
import mawOfTheDeep from './abyssal/mawOfTheDeep.js';

// Boss registry + endless-mode rotation (UPDATE_01 §1.6).
//
// Rotation: stage bosses are dealt from shuffled "decks" of the six
// archetypes, one deck per six stages. Every archetype appears once per deck
// before any repeats, and a new deck never opens with the archetype that
// closed the previous one, so the same archetype never fights twice in a row.
// Deck k (0-based) fields Mk. (k + 1) variants, capped at Mk. III.
// Everything derives from the run seed: same seed, same boss sequence.

export const ARCHETYPES = ['ground', 'aerial', 'sea', 'mecha', 'extraterrestrial', 'abyssal'];
export const ARCHETYPE_LABEL = {
  ground: 'GROUND TANK', aerial: 'AERIAL', sea: 'NAVAL', mecha: 'MECHA',
  extraterrestrial: 'EXTRATERRESTRIAL', abyssal: 'ABYSSAL', prototype: 'PROTOTYPE',
};

/** All boss definitions by id: one per archetype (M4c) + the framework prototype. */
export const BOSSES = {
  ...Object.fromEntries([colossusCrawler, skywardenCarrier, leviathanDreadnought, titanEnforcer, hiveSovereign, mawOfTheDeep].map((b) => [b.id, b])),
  [prototype.id]: prototype,
};

/** Stand-in for an archetype with no authored boss (none since M4c; kept for safety). */
export const FALLBACK_BOSS = prototype.id;

const byArchetype = (a) => Object.values(BOSSES).filter((b) => b.archetype === a).map((b) => b.id);

const deckCache = new Map();

/** Archetype order for deck k of a run. */
export function archetypeDeck(seed, k) {
  const key = `${seed}|${k}`;
  if (deckCache.has(key)) return deckCache.get(key);
  const R = new RNG(`${seed}:bossdeck:${k}`);
  const deck = [...ARCHETYPES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = R.int(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (k > 0) {
    const prev = archetypeDeck(seed, k - 1);
    if (deck[0] === prev[prev.length - 1]) [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  if (deckCache.size > 256) deckCache.clear();
  deckCache.set(key, deck);
  return deck;
}

/**
 * Boss for global stage `index` of a run.
 * @returns {{ id, archetype, mk, deck, fallback }}
 */
export function bossForStage(seed, index) {
  const n = ARCHETYPES.length;
  const k = Math.floor(index / n);
  const archetype = archetypeDeck(seed, k)[index % n];
  const ids = byArchetype(archetype);
  const id = ids.length ? ids[new RNG(`${seed}:boss:${index}`).int(0, ids.length - 1)] : FALLBACK_BOSS;
  return { id, archetype, mk: Math.min(3, k + 1), deck: k, fallback: !ids.length };
}

/** Spawn a main boss from a rotation spec; returns the World enemy (e.ctrl = controller). */
export function spawnArenaBoss(w, spec) {
  const def = BOSSES[spec.id] || BOSSES[FALLBACK_BOSS];
  return new BossController(w, def, spec).e;
}
