// Campaign / level-structure regression test (Node, no browser).
//   node tools/test-campaign.mjs [seeds=40]
//
// Checks the level rework:
//   - the campaign is six archetypes in order, five levels each, the fifth
//     being the archetype's main boss; levels loop at Mk. II, III
//   - every level names an existing boss of its archetype, an arena owned by
//     that boss, and an existing mini-boss of the same archetype; all 30
//     bosses, arenas and mini-bosses are distinct
//   - real-world placement: naval bosses fight on open water, crawlers and
//     walkers on ground (or the seabed), abyssal bosses in the deep
//   - each level plan is intro → 5 waves → mini-boss → 5 waves → boss → tally,
//     deterministic per seed, and only fields units its terrain allows
//   - waves escalate (spawn budget grows set by set) and the campaign
//     difficulty ramps from the first level to the last
//   - mini-bosses have 3 phases, every pattern / part they use exists, and
//     they never get a desperation phase
import { CAMPAIGN_ORDER, LEVELS, levelFor, CAMPAIGN_LENGTH } from '../src/stages/campaign.js';
import { generateStage, templateAllowed } from '../src/stages/StageGen.js';
import { TEMPLATES } from '../src/stages/waves.js';
import { ENEMIES } from '../src/entities/enemies/index.js';
import { BOSSES, ROSTER, MINIBOSSES } from '../src/bosses/index.js';
import { selectPhases } from '../src/bosses/BossController.js';
import { ARENAS } from '../src/bosses/arenaConfigs/index.js';
import { LOOKS } from '../src/bosses/looks.js';

const SEEDS = Number(process.argv[2] || 40);
let fails = 0;
const fail = (m) => { if (fails < 50) console.log('FAIL', m); fails++; };

// ---------------------------------------------------------------- structure
if (CAMPAIGN_ORDER.join() !== 'ground,sea,aerial,mecha,extraterrestrial,abyssal') fail(`archetype order ${CAMPAIGN_ORDER}`);
if (CAMPAIGN_LENGTH !== 30) fail(`campaign length ${CAMPAIGN_LENGTH}`);
const seen = { boss: new Set(), arena: new Set(), mini: new Set() };
const SEA_ENVS = new Set(['ocean', 'harbor', 'arctic', 'coast']);
const DEEP_ENVS = new Set(['seabed', 'ruins', 'flesh']);
const LAND_ENVS = new Set(['terrain', 'city', 'highway', 'battlefield', 'frontline', 'dunesea', 'openpit', 'downtown', 'scrapyard', 'foundry', 'reactor', 'tunnel', 'datacenter']);
for (const a of CAMPAIGN_ORDER) {
  const list = LEVELS[a];
  if (list.length !== 5) fail(`${a} has ${list.length} levels`);
  if (ROSTER[a].length !== 5 || ROSTER[a].some((b) => !list.find((L) => L.boss === b.id))) fail(`${a}: campaign does not cover its roster`);
  list.forEach((L, i) => {
    const b = BOSSES[L.boss], cfg = ARENAS[L.arena], m = MINIBOSSES[L.mini];
    if (!b || b.archetype !== a) fail(`${a} ${i + 1}: boss ${L.boss} missing or wrong archetype`);
    if (!cfg || cfg.boss !== L.boss) fail(`${a} ${i + 1}: arena ${L.arena} missing or not owned by ${L.boss}`);
    if (b && !b.phases.some((p) => p.arena === L.arena)) fail(`${a} ${i + 1}: ${L.arena} is not one of ${L.boss}'s authored arenas`);
    if (!m || m.archetype !== a) fail(`${a} ${i + 1}: mini-boss ${L.mini} missing or wrong archetype`);
    for (const [k, v] of Object.entries({ boss: L.boss, arena: L.arena, mini: L.mini })) { if (seen[k].has(v)) fail(`${k} ${v} used twice`); seen[k].add(v); }
    // Real-world placement.
    if (!cfg || !b) return;
    const look = LOOKS[b.id] || b.look || {};
    if (a === 'sea' && (!SEA_ENVS.has(cfg.env) || L.terrain !== 'sea')) fail(`${L.boss} (warship) is not on open water: ${cfg.env}/${L.terrain}`);
    if (a === 'abyssal' && (!DEEP_ENVS.has(cfg.env) || L.terrain !== 'deep')) fail(`${L.boss} is not in the deep: ${cfg.env}`);
    if (look.anim === 'crawler' && !(LAND_ENVS.has(cfg.env) || DEEP_ENVS.has(cfg.env))) fail(`${L.boss} drives on ${cfg.env} (needs ground)`);
    if (look.anim === 'titan' && !LAND_ENVS.has(cfg.env)) fail(`${L.boss} (walker) stands on ${cfg.env} (needs ground)`);
    if (L.terrain === 'land' && !LAND_ENVS.has(cfg.env) && cfg.env !== 'sky') fail(`${L.arena}: land terrain on ${cfg.env}`);
  });
}
// Mini-bosses that need a surface sit on one.
for (const L of Object.values(LEVELS).flat()) {
  const m = MINIBOSSES[L.mini], cfg = ARENAS[L.arena];
  if (!m || !cfg) continue;
  if (m.look.anim === 'ship' && L.terrain !== 'sea') fail(`${m.id} (ship) on ${L.terrain}`);
  if ((m.look.anim === 'crawler' || m.look.anim === 'titan') && !(LAND_ENVS.has(cfg.env) || DEEP_ENVS.has(cfg.env))) fail(`${m.id} (ground unit) on ${cfg.env}`);
}

// ---------------------------------------------------------------- mini-bosses
if (Object.keys(MINIBOSSES).length !== 30) fail(`expected 30 mini-bosses, found ${Object.keys(MINIBOSSES).length}`);
for (const m of Object.values(MINIBOSSES)) {
  if (!m.mini || m.phases.length !== 3) fail(`${m.id}: not a 3-phase mini-boss`);
  if (!m.art || !m.sprite || !m.look || !m.look.weak || !m.look.sites) fail(`${m.id}: art / look incomplete`);
  for (const ph of m.phases) {
    for (const p of ph.patterns) if (typeof m.attacks[p] !== 'function') fail(`${m.id}: pattern ${p} missing`);
    for (const p of ph.parts || []) if (!m.parts || !m.parts[p]) fail(`${m.id}: part ${p} missing`);
    if (ph.arena) fail(`${m.id}: a mini-boss phase must not change the arena`);
  }
  for (const n of [3, 4, 5]) { const out = selectPhases(m, n, true); if (out.some((p) => p.desperation)) fail(`${m.id}: desperation phase`); if (!out.length) fail(`${m.id}: no phases for ${n}`); }
}

// ---------------------------------------------------------------- level plans
const BLOCK = { sea: ['ground', 'road'], sky: ['ground', 'road', 'naval'], space: ['ground', 'road', 'naval', 'rotor', 'bomber'], deep: ['ground', 'road', 'naval', 'rotor', 'bomber', 'wing'], land: ['naval'] };
const units = (sets) => sets.reduce((n, s) => n + s.events.length, 0);
const rampUp = [0, 0], rampDiff = [];
for (let s = 0; s < SEEDS; s++) {
  const seed = `C${s}`;
  for (let i = 0; i < 36; i++) {
    const p = generateStage(seed, i, 'normal'), q = generateStage(seed, i, 'normal');
    if (JSON.stringify(p) !== JSON.stringify(q)) fail(`${seed} level ${i} not deterministic`);
    const L = levelFor(i);
    if (p.sections.map((x) => x.type).join() !== 'intro,waves,midboss,waves,boss,tally') fail(`${seed} ${i}: sections ${p.sections.map((x) => x.type)}`);
    const w1 = p.sections[1].sets, w2 = p.sections[3].sets;
    if (w1.length !== 5 || w2.length !== 5) fail(`${seed} ${i}: ${w1.length} + ${w2.length} wave sets`);
    if (p.sections[2].arena.id !== L.mini || p.sections[4].arena.id !== L.boss) fail(`${seed} ${i}: wrong mini-boss / boss`);
    if (p.level.mk !== Math.min(3, Math.floor(i / 30) + 1)) fail(`${seed} ${i}: mk ${p.level.mk}`);
    for (const set of [...w1, ...w2]) for (const name of set.names) {
      const t = TEMPLATES.find((x) => x.id === name);
      if (!templateAllowed(t, L.terrain) || t.tags.some((g) => (BLOCK[L.terrain] || []).includes(g))) fail(`${seed} ${i}: ${name} on ${L.terrain}`);
    }
    for (const set of [...w1, ...w2]) for (const ev of set.events) if (!ENEMIES[ev.id]) fail(`${seed} ${i}: unknown enemy ${ev.id}`);
    // One-minute waves, numbered 1-10, spawning across the whole minute.
    [...w1, ...w2].forEach((set, j) => {
      if (set.duration !== 3600) fail(`${seed} ${i}: wave ${j + 1} lasts ${set.duration} steps`);
      if (set.number !== j + 1) fail(`${seed} ${i}: wave numbered ${set.number}, expected ${j + 1}`);
      const last = set.events.length ? set.events[set.events.length - 1].t : 0;
      if (last < 2400 || last >= 3600) fail(`${seed} ${i}: wave ${j + 1} spawns end at ${last}`);
      if (set.events.some((e) => e.t < 0)) fail(`${seed} ${i}: negative spawn time`);
    });
    for (const id of p.reinforce) if (!templateAllowed(TEMPLATES.find((x) => x.id === id), L.terrain)) fail(`${seed} ${i}: reinforcement ${id} on ${L.terrain}`);
    // Escalation: the last waves of a level outweigh the first ones.
    rampUp[0] += units(w1.slice(0, 2)); rampUp[1] += units(w2.slice(3));
    if (s === 0 && i < 30) rampDiff.push(p.diff);
  }
}
if (!(rampUp[1] > rampUp[0] * 1.3)) fail(`waves do not escalate: first two sets ${rampUp[0]} units vs last two ${rampUp[1]}`);
for (const k of ['density', 'hp', 'bossHp', 'eliteChance']) {
  for (let i = 1; i < rampDiff.length; i++) if (rampDiff[i][k] < rampDiff[i - 1][k] - 1e-9) fail(`difficulty ${k} drops at level ${i + 1}`);
  if (!(rampDiff[29][k] > rampDiff[0][k])) fail(`difficulty ${k} does not ramp`);
}

console.log(`campaign: ${CAMPAIGN_ORDER.length} archetypes × 5 levels · ${Object.keys(MINIBOSSES).length} mini-bosses · ${SEEDS} seeds × 36 levels`);
console.log(`waves: first two sets ${rampUp[0]} units, last two ${rampUp[1]} units (all seeds)`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
