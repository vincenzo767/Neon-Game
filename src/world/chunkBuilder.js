import { ENVS } from './env/index.js';
import { Painter } from './paint/core.js';
import { makeCanvas } from './paint/noise.js';
import { MeshBuilder } from './MeshBuilder.js';
import { lighting } from './lighting.js';
import { RNG } from '../core/RNG.js';
import { meshShip } from './kit/ships.js';

// Pure chunk builder: (arena config, layer id, chunk index, quality) →
// painted terrain texture (+ optional glow map), plane mesh, solids mesh and
// FX anchors. Deterministic: content is seeded from the arena id and chunk
// index only. Runs in the build Worker, or on the main thread as a fallback.

const SETUPS = new Map();

/** Env setup for an arena config (cached; env setup is cheap and pure). */
export function arenaSetup(cfg) {
  let s = SETUPS.get(cfg.id);
  if (s && s.cfg === cfg) return s;
  if (s && JSON.stringify(s.cfg) === JSON.stringify(cfg)) return s;
  const env = ENVS[cfg.env];
  if (!env) throw new Error(`arena ${cfg.id}: unknown env "${cfg.env}"`);
  const S = env.setup(cfg);
  s = { cfg, env, S, light: lighting(cfg), layouts: new Map() };
  if (SETUPS.size > 24) SETUPS.clear();
  SETUPS.set(cfg.id, s);
  return s;
}

function ctxFor(s, layer, k) {
  const len = layer.length;
  return {
    k, y0: k * len, y1: (k + 1) * len, x0: layer.x0, x1: layer.x1, z: layer.z,
    R: new RNG(`${s.cfg.seed || s.cfg.id}:${layer.id}:${k}`), cfg: s.cfg, S: s.S, P: s.S.P || {}, light: s.light,
  };
}

function layoutOf(s, layer, k) {
  const key = `${layer.id}:${k}`;
  let L = s.layouts.get(key);
  if (!L) {
    const c = ctxFor(s, layer, k);
    L = layer.layout ? layer.layout(c) : {};
    L.k = k; L.y0 = c.y0; L.y1 = c.y1;
    if (s.layouts.size > 64) s.layouts.delete(s.layouts.keys().next().value);
    s.layouts.set(key, L);
  }
  return L;
}

/**
 * Build one chunk.
 * @param quality { ppu: multiplier on the layer's texel density, glow: bool }
 * @returns { layer, k, canvas, glow, plane: {v, i}, solid: {v, i} | null, anchors, movers, ms }
 */
export function buildChunk(cfg, layerId, k, quality = { ppu: 1 }) {
  const t0 = performance.now();
  const s = arenaSetup(cfg);
  const layer = s.S.layers.find((l) => l.id === layerId);
  if (!layer) throw new Error(`arena ${cfg.id}: no layer "${layerId}"`);
  const c = ctxFor(s, layer, k);
  const lay = layoutOf(s, layer, k);
  const nb = [layoutOf(s, layer, k - 1), layoutOf(s, layer, k + 1)];
  let canvas = null, glow = null;
  if (layer.paint) {
    const ppu = layer.ppu * (quality.ppu || 1);
    const rect = { x0: layer.x0, x1: layer.x1, y0: c.y0, y1: c.y1 };
    canvas = makeCanvas((layer.x1 - layer.x0) * ppu, layer.length * ppu);
    const env = { sun: s.light.paintSun, shadow: s.light.shadow, light: s.light };
    if (layer.glow && quality.glow !== false) {
      glow = makeCanvas((layer.x1 - layer.x0) * ppu * 0.5, layer.length * ppu * 0.5);
      env.glow = new Painter(glow, rect, ppu * 0.5, { sun: s.light.paintSun });
    }
    const p = new Painter(canvas, rect, ppu, env);
    layer.paint(p, lay, nb, c);
  }
  const mb = new MeshBuilder(s.light.mesh);
  if (layer.mesh) layer.mesh(mb, lay, c);
  // Movers: each gets its own mesh (drawn with a moving offset at runtime).
  const movers = (lay.movers || []).map((m) => {
    const b = new MeshBuilder(s.light.mesh);
    let stacks = [];
    if (layer.moverMesh) stacks = layer.moverMesh(b, m, c) || [];
    else if (m.kind === 'ship') stacks = meshShip(b, m.type, m.x, m.y, m.rot, { burnt: m.burnt }) || [];
    return { ...m, mesh: b.finish(), stacks };
  });
  const pb = new MeshBuilder(s.light.mesh);
  const [nx, ny] = layer.grid || [1, 1];
  pb.plane(layer.x0, layer.x1, c.y0, c.y1, layer.z, { nx, ny, height: layer.height, flat: layer.flatLight });
  return {
    layer: layerId, k, canvas, glow,
    plane: pb.finish(), solid: mb.empty ? null : mb.finish(),
    anchors: lay.anchors || [], movers,
    ms: Math.round(performance.now() - t0),
  };
}

/** Layer metadata (no functions) for the main thread. */
export function layerInfo(cfg) {
  const s = arenaSetup(cfg);
  return s.S.layers.map((l) => ({ id: l.id, z: l.z, x0: l.x0, x1: l.x1, length: l.length, cut: !!l.cut, blend: !!l.blend, glow: !!l.glow, detail: l.detail }));
}
