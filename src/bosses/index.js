import { RNG } from '../core/RNG.js';
import { BossController } from './BossController.js';
import prototype from './test/prototype.js';
import ground from './ground/index.js';
import aerial from './aerial/index.js';
import sea from './sea/index.js';
import mecha from './mecha/index.js';
import extraterrestrial from './extraterrestrial/index.js';
import abyssal from './abyssal/index.js';
import { MINIBOSSES } from './minibosses/index.js';

// Boss registry + endless-mode rotation (UPDATE_01 §1.6, arena rework §6).
//
// Two independent seeded layers:
//
//  A. ARCHETYPE deck (unchanged since M4b): stage bosses are dealt from
//     shuffled decks of the six archetypes, one deck per six stages. Every
//     archetype appears once per deck; a new deck never opens with the
//     archetype that closed the previous one. Deck k fields Mk. (k + 1),
//     capped at Mk. III. Stream: `${seed}:bossdeck:${k}`.
//
//  B. VARIANT decks, one sequence per archetype: an archetype's n-th
//     appearance in the run (n = the archetype deck index, since each deck
//     holds every archetype exactly once) takes entry n mod L of variant deck
//     ⌊n / L⌋ — a seeded shuffle of that archetype's roster (L bosses).
//     No variant repeats until all L have fought; a new variant deck never
//     opens with the variant that closed the previous one.
//     Stream: `${seed}:variantdeck:${archetype}:${m}` (separate from A).
//
// Recovery: a roster entry that is missing or `disabled` is skipped by walking
// forward through the same deck (wrapping); if every entry is unavailable the
// flagship is used, then the framework prototype. Selection never reads
// gameplay state or any other RNG, so the same seed always gives the same
// sequence.
//
// Old seeds: the archetype order and Mk. progression are identical to the
// pre-roster game; which boss of the archetype appears is new (previously
// always the flagship). Saved progression is keyed by boss id (practice
// unlocks) and archetype (Warden), both of which are unaffected.

export const ARCHETYPES = ['ground', 'aerial', 'sea', 'mecha', 'extraterrestrial', 'abyssal'];
export const ARCHETYPE_LABEL = {
  ground: 'GROUND TANK', aerial: 'AERIAL', sea: 'NAVAL', mecha: 'MECHA',
  extraterrestrial: 'EXTRATERRESTRIAL', abyssal: 'ABYSSAL', prototype: 'PROTOTYPE',
};

/** Stable roster order per archetype (flagship first). */
export const ROSTER = { ground, aerial, sea, mecha, extraterrestrial, abyssal };
const ROSTER_IDS = Object.fromEntries(Object.entries(ROSTER).map(([a, list]) => [a, list.map((b) => b.id)]));
export const FLAGSHIP = Object.fromEntries(Object.entries(ROSTER_IDS).map(([a, ids]) => [a, ids[0]]));

/** All boss definitions by id (the 30-boss roster + the framework prototype). */
export const BOSSES = {
  ...Object.fromEntries(Object.values(ROSTER).flat().map((b) => [b.id, b])),
  [prototype.id]: prototype,
};

/** Stand-in when nothing in an archetype is available (kept for safety). */
export const FALLBACK_BOSS = prototype.id;

const available = (id) => !!BOSSES[id] && !BOSSES[id].disabled;

function shuffled(list, R) {
  const d = [...list];
  for (let i = d.length - 1; i > 0; i--) {
    const j = R.int(0, i);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const deckCache = new Map();

/** Archetype order for deck k of a run. */
export function archetypeDeck(seed, k) {
  const key = `${seed}|${k}`;
  if (deckCache.has(key)) return deckCache.get(key);
  const deck = shuffled(ARCHETYPES, new RNG(`${seed}:bossdeck:${k}`));
  if (k > 0) {
    const prev = archetypeDeck(seed, k - 1);
    if (deck[0] === prev[prev.length - 1]) [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  if (deckCache.size > 256) deckCache.clear();
  deckCache.set(key, deck);
  return deck;
}

const variantCache = new Map();

/** Variant deck m of an archetype for a run (a shuffle of its roster). */
export function variantDeck(seed, archetype, m) {
  const key = `${seed}|${archetype}|${m}`;
  if (variantCache.has(key)) return variantCache.get(key);
  const ids = ROSTER_IDS[archetype] || [];
  const deck = shuffled(ids, new RNG(`${seed}:variantdeck:${archetype}:${m}`));
  if (m > 0 && deck.length > 1) {
    const prev = variantDeck(seed, archetype, m - 1);
    if (deck[0] === prev[prev.length - 1]) [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  if (variantCache.size > 512) variantCache.clear();
  variantCache.set(key, deck);
  return deck;
}

/** Boss variant for the n-th appearance of an archetype in a run. */
export function variantFor(seed, archetype, n) {
  const ids = ROSTER_IDS[archetype] || [];
  const L = ids.length;
  if (!L) return { id: FALLBACK_BOSS, recovered: true };
  const deck = variantDeck(seed, archetype, Math.floor(n / L));
  const at = n % L;
  for (let s = 0; s < L; s++) {
    const id = deck[(at + s) % L];
    if (available(id)) return { id, recovered: s > 0 };
  }
  return available(FLAGSHIP[archetype]) ? { id: FLAGSHIP[archetype], recovered: true } : { id: FALLBACK_BOSS, recovered: true };
}

/**
 * Boss for global stage `index` of a run.
 * @returns {{ id, archetype, mk, deck, variant, fallback }}
 */
export function bossForStage(seed, index) {
  const n = ARCHETYPES.length;
  const k = Math.floor(index / n);
  const archetype = archetypeDeck(seed, k)[index % n];
  const v = variantFor(seed, archetype, k);
  return { id: v.id, archetype, mk: Math.min(3, k + 1), deck: k, variant: k, fallback: v.id === FALLBACK_BOSS, recovered: v.recovered };
}

export { MINIBOSSES };

/** Spawn a boss (main or a level's mini-boss) from a spec; returns the World enemy (e.ctrl = controller). */
export function spawnArenaBoss(w, spec) {
  const def = BOSSES[spec.id] || MINIBOSSES[spec.id] || BOSSES[FALLBACK_BOSS];
  return new BossController(w, def, spec).e;
}
