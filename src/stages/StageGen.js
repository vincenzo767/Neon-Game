import { RNG } from '../core/RNG.js';
import { BIOMES } from './biomes.js';
import { EXTRA_BIOMES } from './biomesExtra.js';
import { TEMPLATES } from './waves.js';
import { getDifficulty } from '../core/difficulty.js';
import { bossForStage } from '../bosses/index.js';
import { levelFor, LEVELS_PER_ARCHETYPE } from './campaign.js';
import { resolveArena, arenaConfig } from '../bosses/arenas.js';

// Procedural stage generator. Everything derives from (runSeed, stageIndex)
// so a seed reproduces the exact same infinite sequence of stages.
//
// Level flow (campaign.js): intro → 5 one-minute waves → the level's
// mini-boss → 5 one-minute waves → the level's boss → tally. The whole level plays in the boss's
// arena. Waves get bigger and meaner one by one; the campaign ramps from the
// first ground level to the abyssal main boss, and each further pass of the
// campaign (Mk. II, III) adds the loop scaling of the difficulty preset.

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

/**
 * Difficulty for a campaign level: `rank` 0..1 through the 30 levels (never
 * easier than the level before), `cycle` (campaign loop) adds the preset's
 * loop scaling. Within an archetype the bosses themselves step up too: the
 * boss controller scales HP and pattern rate by the level's place (rank 0..4),
 * so the fifth, the main boss, is the hardest.
 */
export function levelDifficulty(level, cfg = getDifficulty('medium')) {
  const L = level.cycle * cfg.loopScaling, p = level.rank;
  return {
    density: Math.min(2.6, 1 + 0.5 * p + 0.3 * L) * cfg.density,
    speed: Math.min(1.6, 1 + 0.2 * p + 0.12 * L) * cfg.bulletSpeed,
    fireRate: 1 / (1 + 0.35 * p + 0.2 * L),
    hp: (1 + 0.6 * p + 0.25 * L) * cfg.enemyHp,
    bossHp: (1 + 0.45 * p + 0.4 * L) * cfg.enemyHp,
    revenge: cfg.revenge,
    eliteChance: Math.min(0.5, 0.04 + 0.2 * p + 0.15 * L),
    bossPhases: cfg.bossPhases,
    desperation: cfg.desperation,
    difficultyId: cfg.id,
  };
}

// Wave templates a terrain cannot field (real-world logic: no tanks on the
// sea, no helicopters in orbit, nothing with wings under water).
const TERRAIN_BLOCK = {
  land: new Set(['naval']),
  sea: new Set(['ground', 'road']),
  sky: new Set(['ground', 'road', 'naval']),
  space: new Set(['ground', 'road', 'naval', 'rotor', 'bomber']),
  deep: new Set(['ground', 'road', 'naval', 'rotor', 'bomber', 'wing']),
};
const TERRAIN_BIAS = {
  land: { ground: 2.2, road: 1.4, heavy: 1.2 },
  sea: { naval: 3, air: 1, bomber: 1.4 },
  sky: { air: 2, bomber: 2, heavy: 1.3 },
  space: { orbit: 2.2, spinner: 2, swarm: 1.6, laser: 1.5 },
  deep: { mine: 2.4, swarm: 2, orbit: 1.6, spinner: 1.4 },
};

/** A stage-biome-shaped record for a level, built from its arena config. */
export function levelBiome(level) {
  const cfg = arenaConfig(level.arena);
  const rec = resolveArena({ id: level.arena });
  return {
    id: level.arena, name: (cfg ? cfg.name : level.arena).toUpperCase(),
    terrain: level.terrain, ground: level.terrain === 'land' || level.terrain === 'sea',
    bias: TERRAIN_BIAS[level.terrain] || {},
    bg: rec.bg, parallax: rec.parallax,
  };
}

export const templateAllowed = (t, terrain) => !t.tags.some((g) => (TERRAIN_BLOCK[terrain] || TERRAIN_BLOCK.land).has(g));

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
  const pool = TEMPLATES.filter((t) => t.minStage <= index && (!t.ground || biome.ground) && !exclude.has(t.id)
    && (!biome.terrain || templateAllowed(t, biome.terrain)));
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

/**
 * `ramp` (optional): per-set growth — set s gets budget × (1 + ramp.budget·(s + ramp.from))
 * and elite chance + ramp.elite·(s + ramp.from), so every wave is a little
 * bigger and meaner than the one before.
 */
function buildSets(R, count, biome, index, diff, budget, ramp = null) {
  const sets = [];
  let elite = diff.eliteChance;
  const ctx = {
    ev: (t, id, x, y, p = null) => ({ t, id, x, y, p, elite: R.next() < elite }),
  };
  for (let s = 0; s < count; s++) {
    const events = [];
    const used = new Set();
    let spent = 0, start = 0;
    const k = ramp ? s + ramp.from : 0;
    elite = Math.min(0.6, diff.eliteChance + (ramp ? ramp.elite * k : 0));
    const target = budget * (ramp ? 1 + ramp.budget * k : 1) * R.range(0.75, 1.05);
    const cap = ramp ? 3 + Math.floor(k / 4) : 3;
    while (spent < target && used.size < cap) {
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

// Timed waves (level rework): every wave lasts one minute. Formations keep
// arriving through the whole minute — the spawn budget is spread over the
// window, grows wave by wave, and the last few seconds stay quiet so the
// wave can be cleared before the next one is announced.
export const WAVE_STEPS = 60 * 60;
const SPAWN_FROM = 40, SPAWN_TO = WAVE_STEPS - 60 * 6;
const FORMATIONS_PER_MINUTE = 4.5; // the old wave set's budget, ~4.5 times per minute

/**
 * `count` one-minute waves. Wave k (k = from .. from + count - 1) spends
 * budget × (1 + 0.1·k) × FORMATIONS_PER_MINUTE, its elite chance is
 * +2 % per wave, and later waves field more formations at once.
 */
function buildWaves(R, count, biome, index, diff, budget, from) {
  const waves = [];
  let elite = diff.eliteChance;
  const ctx = { ev: (t, id, x, y, p = null) => ({ t, id, x, y, p, elite: R.next() < elite }) };
  for (let s = 0; s < count; s++) {
    const k = s + from;
    elite = Math.min(0.6, diff.eliteChance + 0.02 * k);
    const total = budget * (1 + 0.1 * k) * FORMATIONS_PER_MINUTE * R.range(0.92, 1.05);
    const events = [], names = [], recent = [];
    let t = SPAWN_FROM;
    // Formations until the spawn window closes: the budget sets the density, the window the length.
    while (t < SPAWN_TO) {
      const tpl = pickTemplate(R, biome, index, new Set(recent));
      if (!tpl) break;
      recent.push(tpl.id); if (recent.length > 2) recent.shift();
      names.push(tpl.id);
      for (const ev of tpl.build(R, ctx)) { ev.t = Math.round(ev.t + t); if (ev.t < SPAWN_TO + 120) events.push(ev); }
      // The minute is shared out by cost: a heavy formation buys more time.
      // (never more than 10 s of quiet between formations).
      t += Math.min(600, Math.max(60, (tpl.cost / total) * (SPAWN_TO - SPAWN_FROM) * R.range(0.8, 1.2)));
    }
    events.sort((a, b) => a.t - b.t);
    waves.push({ events, names, duration: WAVE_STEPS, number: k + 1 });
  }
  return waves;
}

/**
 * @param seed run seed string
 * @param index global stage index (0-based) = campaign level
 * @param difficultyId core/difficulty.js id (default 'medium' = M3 tuning)
 */
export function generateStage(seed, index, difficultyId = 'medium') {
  const level = levelFor(index);
  const biome = levelBiome(level);
  const diff = levelDifficulty(level, getDifficulty(difficultyId));
  const R = new RNG(`${seed}:level:${index}`);
  const k = index % 30;
  const budget = 4.5 + 6 * level.rank + 2.5 * level.cycle;
  const spec = (id, extra = {}) => ({ id, archetype: level.archetype, mk: level.mk, rank: level.pos, ...extra });
  return {
    seed, index, number: index + 1, level, biome, diff, difficultyId,
    // Kept for ranking / tally code: loop = campaign pass, stageInLoop = level in the archetype.
    loop: level.cycle + 1, stageInLoop: level.pos, levelsPerArchetype: LEVELS_PER_ARCHETYPE,
    // Wave templates the bosses may call in as reinforcements.
    reinforce: TEMPLATES.filter((t) => t.reinforce && templateAllowed(t, level.terrain)).map((t) => t.id),
    sections: [
      { type: 'intro' },
      { type: 'waves', sets: buildWaves(R, 5, biome, k, diff, budget, 0), totalWaves: 10 },
      { type: 'midboss', id: 'gatekeeper', arena: spec(level.mini, { mini: true }) },
      { type: 'waves', sets: buildWaves(R, 5, biome, k, diff, budget, 5), totalWaves: 10 },
      { type: 'boss', id: 'syndicateCore', arena: spec(level.boss) },
      { type: 'tally' },
    ],
  };
}

/** The pre-campaign stage generator (biome loops + archetype decks), kept for reference. */
export function generateLegacyStage(seed, index, difficultyId = 'medium') {
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
