import { Atlas } from '../core/gl/Atlas.js';

// Lazily built boss art (roster expansion). The main atlas is full, so each
// added boss draws its hull and part sprites into a small atlas of its own,
// built the first time the boss is needed (stage start / practice), uploaded
// as its own texture and registered with the renderer by name.
//
// A boss definition opts in with `art(add)`: add(name, w, h, drawFn, scale)
// rasterises a sprite exactly like the main atlas builders do. The CPU canvas
// is released after upload; after a WebGL context restore the art is redrawn
// and the existing frame objects are updated in place.

const BUILT = new Map(); // def.id → { frames: Map(name → frame), restores, ms }

function draw(r, def) {
  const scale = r.atlas.size >= 4096 ? 1.5 : 1.0;
  for (const size of [2048, 4096]) {
    try {
      const atlas = new Atlas(size, 1);
      def.art((name, w, h, fn, s = scale) => atlas.add(name, w, h, fn, { scale: s }));
      const tex = atlas.upload(r.gl);
      for (const fr of atlas.frames) fr.tex = tex;
      atlas.canvas.width = atlas.canvas.height = 1; // free the CPU copy
      return atlas.frames;
    } catch (err) {
      if (!/Atlas full/.test(err.message) || size === 4096) throw err;
    }
  }
  return [];
}

export function ensureBossArt(r, def) {
  if (!def || !def.art) return;
  const rec = BUILT.get(def.id);
  if (rec) {
    if (rec.restores !== r.restores) {
      for (const nf of draw(r, def)) {
        const of = rec.frames.get(nf.name);
        if (of) Object.assign(of, { u0: nf.u0, v0: nf.v0, u1: nf.u1, v1: nf.v1, tex: nf.tex });
      }
      rec.restores = r.restores;
    }
    return;
  }
  const t0 = performance.now();
  const frames = draw(r, def);
  r.addFrames(frames);
  BUILT.set(def.id, { frames: new Map(frames.map((f) => [f.name, f])), restores: r.restores, ms: Math.round(performance.now() - t0) });
}

export const bossArtStats = () => Object.fromEntries([...BUILT].map(([k, v]) => [k, v.ms]));
