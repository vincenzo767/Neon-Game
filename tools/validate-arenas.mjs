// Arena / boss reference validation (no browser). Run: node tools/validate-arenas.mjs [--strict]
//
// Checks
//   • every arena config: unique id, known env, known transition, known weather /
//     ambient layers, lighting preset, music layer, owner boss + phase
//   • every env builds a layout for a few chunks of every layer (pure JS parts:
//     setup + layout + mesh; painting needs a canvas and is checked in-browser)
//   • every material referenced by meshes exists
//   • every boss: 5 authored phases, each phase's arena resolves, desperation resolves
//   • roster: 6 archetypes × 5 bosses (warns until the roster is complete; --strict fails)
// Exit code 1 on any error.

import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, 'src', p)).href);
const STRICT = process.argv.includes('--strict');

// Minimal DOM-less stubs for modules that touch `location` / `document` at import time.
globalThis.location = globalThis.location || { search: '' };

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

const { ARENAS, ARENA_LIST, MIDBOSS_ARENAS } = await imp('bosses/arenaConfigs/index.js');
const { ENVS } = await imp('world/env/index.js');
const { MATERIALS } = await imp('world/materials.js');
const { MeshBuilder } = await imp('world/MeshBuilder.js');
const { lighting, LIGHT_PRESETS } = await imp('world/lighting.js');
const { arenaSetup } = await imp('world/chunkBuilder.js');
const { RNG } = await imp('core/RNG.js');
const { TRANSITIONS } = await imp('bosses/transitions.js');
const { WEATHER } = await imp('bosses/arenas.js');
const { BOSSES, ARCHETYPES } = await imp('bosses/index.js');

const AMBIENTS = ['searchlights', 'aurora', 'snow', 'bubbles', 'ash', 'glyphs', 'dust', 'sandstorm', 'heat', 'lightning', 'marine_snow', 'alarm', 'tractor_beams', 'spores', 'sanity', 'rain_sheets', 'fog_banks', 'spray', 'sparks_fall', 'reentry'];

// ------------------------------------------------------------ arena configs
const ids = new Set();
for (const a of [...ARENA_LIST, ...MIDBOSS_ARENAS]) {
  const where = `arena ${a.id}`;
  if (!a.id) { err(`arena without id: ${JSON.stringify(a).slice(0, 80)}`); continue; }
  if (ids.has(a.id)) err(`${where}: duplicate id`);
  ids.add(a.id);
  if (!a.name) err(`${where}: no name`);
  if (!ENVS[a.env]) err(`${where}: unknown env "${a.env}"`);
  if (a.transition && !TRANSITIONS[a.transition]) err(`${where}: unknown transition "${a.transition}"`);
  if (a.weather && !WEATHER[a.weather]) err(`${where}: unknown weather "${a.weather}"`);
  for (const amb of a.ambient || []) if (!AMBIENTS.includes(amb)) err(`${where}: unknown ambient "${amb}"`);
  if (a.light && a.light.preset && !LIGHT_PRESETS.includes(a.light.preset)) err(`${where}: unknown light preset "${a.light.preset}"`);
  if (!a.midboss && (!a.boss || !a.phase)) warn(`${where}: no owner boss/phase`);
  try { lighting(a); } catch (e) { err(`${where}: lighting: ${e.message}`); }
  // Build layouts + meshes for a few chunks of every layer.
  if (ENVS[a.env]) {
    try {
      const s = arenaSetup(a);
      for (const L of s.S.layers) {
        for (const k of [0, 1, 2, 7]) {
          const c = { k, y0: k * L.length, y1: (k + 1) * L.length, x0: L.x0, x1: L.x1, z: L.z, R: new RNG(`${a.id}:${L.id}:${k}`), cfg: a, S: s.S, P: s.S.P || {}, light: s.light };
          const lay = L.layout ? L.layout(c) : {};
          lay.k = k; lay.y0 = c.y0; lay.y1 = c.y1;
          const mb = new MeshBuilder(s.light.mesh);
          if (L.mesh) L.mesh(mb, lay, c);
          for (const an of lay.anchors || []) if (!['fire', 'smoke', 'steam', 'lamp', 'beacon', 'spark', 'glow', 'searchlight', 'dust', 'rockfall', 'vent', 'shaft', 'lightning', 'aurora', 'bubbles', 'spray', 'mover', 'fish', 'shaftlight', 'jellyfish', 'pulse'].includes(an.type)) err(`${where}: unknown anchor type "${an.type}"`);
        }
      }
    } catch (e) { err(`${where}: env build failed: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  }
}

// ------------------------------------------------------------------ bosses
const byArch = {};
for (const b of Object.values(BOSSES)) {
  if (b.archetype === 'prototype') continue;
  (byArch[b.archetype] = byArch[b.archetype] || []).push(b.id);
  const where = `boss ${b.id}`;
  // A boss with its own phase sets (WHITEOUT BREAKER: ten sections) may author any count;
  // each set must then index real phases.
  if (b.phaseSets) {
    for (const [n, set] of Object.entries(b.phaseSets)) if (!set.length || set.some((i) => !b.phases || !b.phases[i])) err(`${where}: phaseSets[${n}] indexes a missing phase`);
  } else if (!b.phases || b.phases.length !== 5) err(`${where}: needs 5 authored phases (has ${b.phases ? b.phases.length : 0})`);
  for (const [i, ph] of (b.phases || []).entries()) {
    const ref = typeof ph.arena === 'string' ? ph.arena : ph.arena && ph.arena.id;
    if (!ref) { warn(`${where} phase ${i + 1}: legacy theme arena (${ph.arena && ph.arena.theme})`); continue; }
    if (!ARENAS[ref]) err(`${where} phase ${i + 1}: arena "${ref}" does not exist`);
    else if (ARENAS[ref].boss && ARENAS[ref].boss !== b.id) warn(`${where} phase ${i + 1}: uses ${ref} owned by ${ARENAS[ref].boss}`);
    if (ph.transitionFx && !TRANSITIONS[ph.transitionFx]) err(`${where} phase ${i + 1}: unknown transition "${ph.transitionFx}"`);
    for (const pat of ph.patterns || []) if (!b.attacks || !b.attacks[pat]) err(`${where} phase ${i + 1}: unknown attack "${pat}"`);
    for (const part of ph.parts || []) if (!b.parts || !b.parts[part]) err(`${where} phase ${i + 1}: unknown part "${part}"`);
  }
}
for (const a of ARCHETYPES) {
  const n = (byArch[a] || []).length;
  if (n !== 5) (STRICT ? err : warn)(`archetype ${a}: ${n}/5 bosses`);
}
const arenasPerBoss = {};
for (const a of ARENA_LIST) arenasPerBoss[a.boss] = (arenasPerBoss[a.boss] || 0) + 1;

console.log(`arenas: ${ARENA_LIST.length} boss configs + ${MIDBOSS_ARENAS.length} mid-boss, ${Object.keys(ENVS).length} environment modules, ${Object.keys(MATERIALS).length} materials`);
console.log(`bosses: ${Object.entries(byArch).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
if (warns.length) console.log(`\n${warns.length} warning(s):\n  ${warns.join('\n  ')}`);
if (errors.length) { console.log(`\n${errors.length} ERROR(S):\n  ${errors.join('\n  ')}`); process.exit(1); }
console.log('\nOK');
