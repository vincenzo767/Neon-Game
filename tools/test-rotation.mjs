// Boss rotation + gameplay-contract regression test (Node, no browser).
//   node tools/test-rotation.mjs [seeds=300]
//
// Checks the two-level seeded selection and the phase contract:
//   - archetype decks are identical to the pre-rework implementation
//     (same RNG stream `${seed}:bossdeck:${k}`), each deck is a permutation
//     of the six archetypes and no archetype repeats across a deck boundary
//   - Mk. progression is min(3, deck + 1), independent of roster size
//   - variant selection is deterministic per seed, covers every boss of an
//     archetype once per variant cycle, never repeats a boss across a cycle
//     boundary, and is roughly uniform across seeds
//   - every authored phase references an existing arena config owned by that
//     boss and phase; difficulty phase sets are 1,3,5 / 1,2,4,5 / all and
//     Extreme appends a desperation phase whose arena resolves
import { ARCHETYPES, ROSTER, BOSSES, archetypeDeck, bossForStage, variantFor, FLAGSHIP } from '../src/bosses/index.js';
import { selectPhases } from '../src/bosses/BossController.js';
import { ARENAS, ARENA_LIST } from '../src/bosses/arenaConfigs/index.js';
import { arenaConfig, resolveArena } from '../src/bosses/arenas.js';
import { RNG } from '../src/core/RNG.js';

const SEEDS = Number(process.argv[2] || 300);
let fails = 0;
const fail = (msg) => { if (fails < 40) console.log('FAIL', msg); fails++; };

// Reference implementation of the original archetype deck (git HEAD before the rework).
const refCache = new Map();
function refDeck(seed, k) {
  const key = `${seed}|${k}`;
  if (refCache.has(key)) return refCache.get(key);
  const R = new RNG(`${seed}:bossdeck:${k}`);
  const deck = [...ARCHETYPES];
  for (let i = deck.length - 1; i > 0; i--) { const j = R.int(0, i); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  if (k > 0) { const prev = refDeck(seed, k - 1); if (deck[0] === prev[prev.length - 1]) [deck[0], deck[1]] = [deck[1], deck[0]]; }
  refCache.set(key, deck);
  return deck;
}

const counts = Object.fromEntries(Object.values(ROSTER).flat().map((b) => [b.id, 0]));
for (let s = 0; s < SEEDS; s++) {
  const seed = `T${s}`;
  for (let k = 0; k < 8; k++) {
    const d = archetypeDeck(seed, k), r = refDeck(seed, k);
    if (d.join() !== r.join()) fail(`${seed} deck ${k} differs from the original stream: ${d} vs ${r}`);
    if (new Set(d).size !== ARCHETYPES.length) fail(`${seed} deck ${k} is not a permutation`);
    if (k > 0 && d[0] === archetypeDeck(seed, k - 1).at(-1)) fail(`${seed} deck ${k} repeats an archetype across the boundary`);
  }
  // 30 stages = 5 decks: each archetype appears 5 times → its 5 bosses once each.
  const seen = Object.fromEntries(ARCHETYPES.map((a) => [a, []]));
  for (let i = 0; i < 60; i++) {
    const a = bossForStage(seed, i), b = bossForStage(seed, i);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${seed} stage ${i} not deterministic`);
    if (a.mk !== Math.min(3, Math.floor(i / 6) + 1)) fail(`${seed} stage ${i} mk ${a.mk}`);
    if (!BOSSES[a.id] || BOSSES[a.id].archetype !== a.archetype) fail(`${seed} stage ${i} boss ${a.id} not in archetype ${a.archetype}`);
    if (a.fallback || a.recovered) fail(`${seed} stage ${i} used a fallback (${a.id})`);
    seen[a.archetype].push(a.id);
    if (i < 30) counts[a.id]++;
  }
  for (const ar of ARCHETYPES) {
    const L = ROSTER[ar].length, ids = seen[ar];
    for (let c = 0; c + L <= ids.length; c += L) if (new Set(ids.slice(c, c + L)).size !== L) fail(`${seed} ${ar} cycle ${c / L} does not cover the roster: ${ids.slice(c, c + L)}`);
    for (let c = L; c < ids.length; c += L) if (ids[c] === ids[c - 1]) fail(`${seed} ${ar} repeats ${ids[c]} across a cycle boundary`);
  }
}
// Uniformity: every boss should appear in the first 30 stages of every seed exactly once.
for (const [id, n] of Object.entries(counts)) if (n !== SEEDS) fail(`${id} appeared ${n} times in ${SEEDS} seeds (expected ${SEEDS})`);

// Recovery: a disabled boss is skipped deterministically, the flagship stays reachable.
{
  const id = ROSTER.ground[1].id;
  BOSSES[id].disabled = true;
  for (let s = 0; s < 50; s++) for (let n = 0; n < 10; n++) { const v = variantFor(`R${s}`, 'ground', n); if (v.id === id) fail('disabled boss selected'); }
  delete BOSSES[id].disabled;
  if (!FLAGSHIP.ground) fail('no ground flagship');
}

// Phase / arena contract.
const SETS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
for (const b of Object.values(ROSTER).flat()) {
  // Sectioned bosses (WHITEOUT BREAKER) declare their own phase sets: every phase on the
  // boss's own arena configs, the sets and the desperation phase follow the boss.
  const sectioned = !!b.phaseSets;
  if (!sectioned && b.phases.length !== 5) fail(`${b.id} has ${b.phases.length} phases`);
  b.phases.forEach((ph, i) => {
    const cfg = ARENAS[ph.arena];
    if (!cfg) return fail(`${b.id} phase ${i + 1} arena ${ph.arena} missing`);
    if (cfg.boss !== b.id || (!sectioned && cfg.phase !== i + 1)) fail(`${b.id} phase ${i + 1} → ${ph.arena} owned by ${cfg.boss} p${cfg.phase}`);
    if (!ph.musicLayer || !/^(ground|aerial|sea|mecha|alien|abyssal)_p[1-5]$/.test(ph.musicLayer)) fail(`${b.id} phase ${i + 1} musicLayer ${ph.musicLayer}`);
    for (const p of ph.patterns || []) if (!b.attacks || typeof b.attacks[p] !== 'function') fail(`${b.id} phase ${i + 1} pattern ${p} not defined`);
    for (const p of ph.parts || []) if (!b.parts || !b.parts[p]) fail(`${b.id} phase ${i + 1} part ${p} not defined`);
  });
  for (const [n, set] of Object.entries(SETS)) {
    const out = selectPhases(b, Number(n), false);
    if (out.map((p) => b.phases.findIndex((q) => q.name === p.name)).join() !== (sectioned ? b.phaseSets[n] : set).join()) fail(`${b.id} phase set for ${n}: ${out.map((p) => p.name)}`);
  }
  const ext = selectPhases(b, 5, true);
  const nExt = (sectioned ? b.phaseSets[5].length : 5) + 1;
  if (ext.length !== nExt || !ext[nExt - 1].desperation) fail(`${b.id} extreme has no desperation phase`);
  else {
    const r = resolveArena(ext[nExt - 1].arena);
    if (!r.world || !arenaConfig(`${b.phases[b.phases.length - 1].arena}~desperation`)) fail(`${b.id} desperation arena does not resolve`);
  }
}
// Every config is used by exactly one boss phase.
const used = new Set(Object.values(ROSTER).flat().flatMap((b) => b.phases.map((p) => p.arena)));
// A sectioned boss fights on one world; its other configs are moods of it (owned, not phase-bound).
for (const b of Object.values(ROSTER).flat()) if (b.phaseSets) for (const a of ARENA_LIST) if (a.boss === b.id) used.add(a.id);
for (const a of ARENA_LIST) if (!used.has(a.id)) fail(`arena ${a.id} is not referenced by any boss`);
if (ARENA_LIST.length !== 150) fail(`expected 150 boss arena configs, found ${ARENA_LIST.length}`);

console.log(`rotation: ${SEEDS} seeds × 60 stages · ${Object.values(ROSTER).flat().length} bosses · ${ARENA_LIST.length} boss arenas`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
