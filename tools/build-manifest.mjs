// Asset manifest generator (arena rework §23). Run: node tools/build-manifest.mjs
//
// Derives the manifest from the live data so it cannot drift from the code:
//   bosses  sprite keys + dimensions (lazy boss atlases or the main atlas),
//           breakable-part / minion sprites, idle animation, faction hit FX,
//           death sequence, transitions and music layers per phase
//   arenas  environment module, layers (depth, resolution, blending), GPU
//           surfaces (water / lava / clouds / planet / black hole / sky),
//           materials referenced by the generated geometry, world-space FX
//           anchors, screen particles, lighting, loading behaviour
// Writes docs/asset-manifest.json and docs/ASSET_MANIFEST.md.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, 'src', p)).href);
globalThis.location = globalThis.location || { search: '' };

const { ARENA_LIST, MIDBOSS_ARENAS } = await imp('bosses/arenaConfigs/index.js');
const { ENVS } = await imp('world/env/index.js');
const { MeshBuilder } = await imp('world/MeshBuilder.js');
const { arenaSetup } = await imp('world/chunkBuilder.js');
const { RNG } = await imp('core/RNG.js');
const { ROSTER, ARCHETYPES, ARCHETYPE_LABEL } = await imp('bosses/index.js');
const { LOOKS } = await imp('bosses/looks.js');

// Record material usage while meshes are generated.
let usedMats = null;
const origMat = MeshBuilder.prototype.mat;
MeshBuilder.prototype.mat = function (name) { if (usedMats) usedMats.add(name); return origMat.call(this, name); };

// ------------------------------------------------------------------ bosses
const bosses = [];
for (const a of ARCHETYPES) for (const def of ROSTER[a]) {
  const sprites = [];
  if (def.art) def.art((name, w, h, fn, scale = 1) => sprites.push({ key: name, w, h, scale, atlas: `lazy boss atlas (${def.id})` }));
  else {
    sprites.push({ key: def.sprite, atlas: 'main atlas (bosses/art.js, hulls.js)' });
    for (const ph of def.phases) if (ph.sprite && !sprites.some((s) => s.key === ph.sprite)) sprites.push({ key: ph.sprite, atlas: 'main atlas' });
  }
  const parts = Object.entries(def.parts || {}).map(([k, p]) => ({ id: k, label: p.label, sprite: p.sprite, hp: p.hp }));
  const look = LOOKS[def.id] || def.look || {};
  bosses.push({
    id: def.id, name: def.name, title: def.title || '', archetype: a, primary: def.sprite, scale: def.scale, hitRadius: def.r,
    sprites, parts, idleAnimation: look.anim || 'none', faction: look.faction, organic: !!look.organic,
    shadow: !!look.shadow, deathSequence: def.deathSequence,
    phases: def.phases.map((p, i) => ({ n: i + 1, name: p.name, arena: p.arena, transition: p.transitionFx, music: p.musicLayer, patterns: p.patterns, parts: p.parts || [] })),
    desperation: (def.desperation && def.desperation.name) || null,
  });
}

// ------------------------------------------------------------------ arenas
const SURF = (s) => s.type === 'cloud' ? 'cloud deck (GPU cloud shader)' : s.type === 'water' ? 'water (GPU wave shader)' : s.type === 'lava' ? 'lava / molten (GPU flow shader)' : s.type === 'planet' ? `planet surface (GPU planet shader${s.gas ? ', gas giant' : ''})` : s.type === 'blackhole' ? 'black hole + accretion disc (GPU lensing shader)' : s.type;
const arenas = [];
for (const cfg of [...ARENA_LIST, ...MIDBOSS_ARENAS]) {
  const s = arenaSetup(cfg);
  const S = s.S, A = S.atmosphere || {};
  const anchors = {}, mats = new Set();
  let movers = 0;
  const layers = S.layers.map((L) => {
    for (const k of [0, 1, 2, 3]) {
      const c = { k, y0: k * L.length, y1: (k + 1) * L.length, x0: L.x0, x1: L.x1, z: L.z, R: new RNG(`${cfg.id}:${L.id}:${k}`), cfg, S, P: S.P || {}, light: s.light };
      const lay = L.layout ? L.layout(c) : {};
      lay.k = k; lay.y0 = c.y0; lay.y1 = c.y1;
      for (const an of lay.anchors || []) anchors[an.type] = (anchors[an.type] || 0) + 1;
      movers += (lay.movers || []).length;
      usedMats = mats;
      const mb = new MeshBuilder(s.light.mesh);
      if (L.mesh) L.mesh(mb, lay, c);
      for (const m of lay.movers || []) if (L.moverMesh) L.moverMesh(mb, m);
      usedMats = null;
    }
    const w = Math.round((L.x1 - L.x0) * L.ppu), h = Math.round(L.length * L.ppu);
    return { id: L.id, z: L.z, chunkLength: L.length, texture: `${w}×${h}px (ppu ${L.ppu})`, mode: L.blend ? 'alpha blended' : L.cut ? 'alpha-cut opaque' : 'opaque', glowMap: !!L.glow, relief: L.height ? `heightfield mesh ${L.grid ? L.grid.join('×') : ''}` : 'flat / props only' };
  });
  arenas.push({
    id: cfg.id, name: cfg.name, owner: cfg.boss || cfg.midboss, phase: cfg.phase || null, env: cfg.env, envLabel: ENVS[cfg.env].label,
    params: cfg.params, lighting: cfg.light, scroll: cfg.scroll, wind: cfg.wind,
    layers, surfaces: (A.surfaces || []).map(SURF), sky: A.sky ? ['gradient', 'starfield', 'underwater', 'none'][A.sky.mode] || `mode ${A.sky.mode}` : null,
    materials: [...mats].sort(), fxAnchors: anchors, movers: movers > 0,
    screenParticles: [cfg.weather !== 'none' ? cfg.weather : null, ...(cfg.ambient || [])].filter(Boolean),
    transition: cfg.transition, music: cfg.music, visibility: cfg.visibility || null, desperation: cfg.desperation ? cfg.desperation.name : null,
  });
}

// ------------------------------------------------------------------ shared
const shared = {
  materials: 'world/materials.js — 99 procedural materials painted once at boot into a TEXTURE_2D_ARRAY (256² layers, mipmapped); shared by every arena, rebuilt on context restore',
  noise: 'world/WorldGL.js — one 256² tileable noise texture (rich fbm / smooth / fine / ridged channels) used by every surface shader',
  fxAtlas: 'world/fxAtlas.js — flames, smoke, dust, glow, pool, ember, spark, ring, foam, cone, flake, chunk (procedural, one small atlas)',
  shaders: 'world/WorldGL.js — lit (baked light + height fog + glow + alpha cut), water, lava, cloud, planet (+gas giant), black hole, sky',
  transitions: 'bosses/transitions.js — flash, fade, screen_tear, water_flood, lava_flood, warp_tunnel, darkness_swallow, membrane, armor_break, rockfall, sandstorm, ice_crack, cloud_burst (procedural, no textures)',
  music: 'audio/themes.js — six archetype styles (ironclad / stratos / blacktide / helix / outerstar / drowned), phase layers p1..p5 + desperation; generated, no audio files',
  loading: 'Arena worlds are built per chunk in a module Worker (OffscreenCanvas → ImageBitmap), ~0.1–0.8 s per chunk; phase 1 builds during the boss WARNING, phase i+2 while phase i is fought; at most 3 arena worlds alive (shown + incoming + prefetched), the oldest released (GPU textures + buffers) when a fourth is needed; boss art atlases are drawn lazily on first spawn and kept for the session; everything is rebuilt after a WebGL context loss',
  referenceBoards: 'src/bosses/ground/*.png are concept / reference boards (art direction only); they are not loaded by the game',
};
const gaps = [
  'Audio: no per-boss music or SFX files exist; bosses use the six procedural archetype music styles (layers p1–p5). A per-boss soundtrack would need new stems per boss (30 × 5 layers).',
  'Boss art: the 24 new bosses are procedural Canvas2D illustrations (greeble kit, top-down, lit upper-left), not painted or 3D-rendered sprites; replacing them needs 30 top-down sprites at the listed sizes (transparent PNG, premultiplied on upload) plus part sprites.',
  'Environment textures are procedural (materials.js / paint/*), not photographic; there are no external texture files to license or ship.',
];

fs.writeFileSync(path.join(ROOT, 'docs/asset-manifest.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), shared, gaps, bosses, arenas }, null, 1));

// ------------------------------------------------------------------ markdown
const md = [];
md.push('# Asset Manifest — Bosses and Arenas', '', '_Generated by `node tools/build-manifest.mjs` from the live data. Machine-readable copy: `docs/asset-manifest.json`._', '');
md.push('## Shared resources', '');
for (const [k, v] of Object.entries(shared)) md.push(`- **${k}** — ${v}`);
md.push('', '## Known gaps (reported, not substituted)', '');
for (const g of gaps) md.push(`- ${g}`);
md.push('', `## Bosses (${bosses.length})`, '');
for (const a of ARCHETYPES) {
  md.push(`### ${ARCHETYPE_LABEL[a]}`, '');
  for (const b of bosses.filter((x) => x.archetype === a)) {
    md.push(`#### ${b.name}${b.title ? ` — ${b.title.toLowerCase()}` : ''} (\`${b.id}\`)`, '');
    md.push(`- Sprites: ${b.sprites.map((s) => `\`${s.key}\`${s.w ? ` ${s.w}×${s.h}${s.scale !== 1 ? ` @${s.scale}x` : ''}` : ''}`).join(', ')} — ${b.sprites[0] ? b.sprites[0].atlas : ''}`);
    md.push(`- Parts: ${b.parts.length ? b.parts.map((p) => `${p.id} (${p.label}, \`${p.sprite}\`, ${p.hp} HP)`).join('; ') : 'none'}`);
    md.push(`- Animation: idle \`${b.idleAnimation}\`${b.shadow ? ', ground shadow' : ''}${b.organic ? ', organic damage (ichor)' : ', mechanical damage (smoke, sparks, shed plates)'} · faction hit FX \`${b.faction}\` · death \`${b.deathSequence}\``);
    md.push(`- Phases: ${b.phases.map((p) => `${p.n}. ${p.name} → \`${p.arena}\` (${p.transition}, ${p.music})`).join(' · ')}${b.desperation ? ` · Extreme: ${b.desperation}` : ''}`, '');
  }
}
md.push(`## Arenas (${arenas.length})`, '');
md.push('| Arena | Owner · phase | Environment | Layers | GPU surfaces | Materials | FX anchors | Particles | Transition |', '|---|---|---|---|---|---|---|---|---|');
for (const r of arenas) {
  md.push(`| ${r.name} \`${r.id}\` | ${r.owner}${r.phase ? ` · P${r.phase}` : ' (mid-boss)'} | ${r.env} | ${r.layers.map((L) => `${L.id} z${L.z} ${L.mode}${L.glowMap ? '+glow' : ''}`).join('; ')} | ${r.surfaces.join('; ') || '—'} | ${r.materials.length} | ${Object.entries(r.fxAnchors).map(([k, v]) => `${k}×${v}`).join(' ') || '—'} | ${r.screenParticles.join(', ') || '—'} | ${r.transition} |`);
}
md.push('');
fs.writeFileSync(path.join(ROOT, 'docs/ASSET_MANIFEST.md'), md.join('\n'));
console.log(`manifest: ${bosses.length} bosses, ${arenas.length} arenas → docs/ASSET_MANIFEST.md, docs/asset-manifest.json`);
