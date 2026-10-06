import { RNG } from '../core/RNG.js';
import { BIOMES } from './biomes.js';
import { EXTRA_BIOMES } from './biomesExtra.js';
import { TEMPLATES } from './waves.js';
import { getDifficulty } from '../core/difficulty.js';
import { bossForStage } from '../bosses/index.js';

// Procedural stage generator. Everything derives from (runSeed, stageIndex)
// so a seed reproduces the exact same infinite sequence of stages.
//
// Stage flow: intro → 3–5 wave sets → mid-boss → 2–3 wave sets → boss → tally
// A loop is STAGES_PER_LOOP stages; each loop raises bullet density/speed,
// enemy HP and elite frequency (rate set by the difficulty's loopScaling).

export const STAGES_PER_LOOP = 5;

/**
 * Difficulty knobs consumed by World.diff, the pattern library and enemy factory.
 * `cfg` is a difficulty from core/difficulty.js: it multiplies the base values
 * and the per-loop growth rate (L terms). Medium (all ×1) = the M3 tuning.
 */
export function difficulty(loop, stageInLoop, cfg = getDifficulty('medium')) {
  const L = (loop - 1) * cfg.loopScaling, s = stageInLoop;
  return {
    density: Math.min(2.6, 1 + 0.07 * s + 0.3 * L) * cfg.density,
    speed: Math.min(1.6, 1 + 0.03 * s + 0.12 * L) * cfg.bulletSpeed,
    fireRate: 1 / (1 + 0.05 * s + 0.2 * L),
    hp: (1 + 0.05 * s + 0.25 * L) * cfg.enemyHp,
    bossHp: (1 + 0.1 * s + 0.4 * L) * cfg.enemyHp,
    revenge: cfg.revenge,
    eliteChance: loop === 1 ? (s >= 3 ? 0.08 : 0) : Math.min(0.5, 0.15 * L + 0.04 * s),
    // Consumed by the M4 boss framework.
    bossPhases: cfg.bossPhases,
    desperation: cfg.desperation,
    difficultyId: cfg.id,
  };
}

/** Biome order for a loop: seeded shuffle; loop 1 always opens on the Skyway. */
function biomeOrder(seed, loop) {
  const R = new RNG(`${seed}:biomes:${loop}`);
  const list = [...BIOMES];
  for (let i = list.length - 1; i > 0; i--) {
    const j = R.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  if (loop === 1) {
    const k = list.findIndex((b) => b.id === 'skyway');
    [list[0], list[k]] = [list[k], list[0]];
  }
  // Update 02: deal one of the new biomes into the loop (own RNG stream, so
  // the M3 shuffle above is drawn exactly as before). Never the opener.
  const X = new RNG(`${seed}:biomes+:${loop}`);
  list.splice(X.int(1, STAGES_PER_LOOP - 1), 0, EXTRA_BIOMES[(loop + X.int(0, 1)) % EXTRA_BIOMES.length]);
  return list;
}

function pickTemplate(R, biome, index, exclude) {
  const pool = TEMPLATES.filter((t) => t.minStage <= index && (!t.ground || biome.ground) && !exclude.has(t.id));
  let total = 0;
  const weights = pool.map((t) => {
    let w = 1;
    for (const tag of t.tags) w = Math.max(w, biome.bias[tag] || 1);
    total += w;
    return w;
  });
  let r = R.next() * total;
  for (let i = 0; i < pool.length; i++) if ((r -= weights[i]) <= 0) return pool[i];
  return pool[pool.length - 1];
}

function buildSets(R, count, biome, index, diff, budget) {
  const sets = [];
  const ctx = {
    ev: (t, id, x, y, p = null) => ({ t, id, x, y, p, elite: R.next() < diff.eliteChance }),
  };
  for (let s = 0; s < count; s++) {
    const events = [];
    const used = new Set();
    let spent = 0, start = 0;
    const target = budget * R.range(0.75, 1.05);
    while (spent < target && used.size < 3) {
      const tpl = pickTemplate(R, biome, index, used);
      if (!tpl) break;
      used.add(tpl.id);
      spent += tpl.cost;
      for (const ev of tpl.build(R, ctx)) { ev.t += start; events.push(ev); }
      start += R.int(70, 150);
    }
    events.sort((a, b) => a.t - b.t);
    sets.push({ events, names: [...used] });
  }
  return sets;
}

/**
 * @param seed run seed string
 * @param index global stage index (0-based)
 * @param difficultyId core/difficulty.js id (default 'medium' = M3 tuning)
 */
export function generateStage(seed, index, difficultyId = 'medium') {
  const loop = Math.floor(index / STAGES_PER_LOOP) + 1;
  const stageInLoop = index % STAGES_PER_LOOP;
  const order = biomeOrder(seed, loop);
  const biome = order[stageInLoop % order.length];
  const diff = difficulty(loop, stageInLoop, getDifficulty(difficultyId));
  const R = new RNG(`${seed}:stage:${index}`);
  const budget = 5 + stageInLoop * 1.2 + (loop - 1) * 2.5;
  return {
    seed, index, loop, stageInLoop, number: index + 1, biome, diff, difficultyId,
    sections: [
      { type: 'intro' },
      { type: 'waves', sets: buildSets(R, R.int(3, 5), biome, index, diff, budget) },
      { type: 'midboss', id: 'gatekeeper' },
      { type: 'waves', sets: buildSets(R, R.int(2, 3), biome, index, diff, budget * 1.1) },
      // `arena`: main boss from the archetype rotation (M4b boss arena mode).
      { type: 'boss', id: 'syndicateCore', arena: bossForStage(seed, index) },
      { type: 'tally' },
    ],
  };
}
