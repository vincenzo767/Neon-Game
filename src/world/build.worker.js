import { buildChunk } from './chunkBuilder.js';
import { MATERIAL_NAMES, paintMaterial } from './materials.js';
import { noiseSet } from './paint/noise.js';

// Arena build Worker: paints terrain chunks and material tiles off the main
// thread (OffscreenCanvas) and returns ImageBitmaps + mesh arrays as
// transferables, so the game loop never stalls on Canvas2D work.

const bitmap = (c) => (c ? createImageBitmap(c, { premultiplyAlpha: 'premultiply' }) : null);

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === 'warm') { noiseSet(); self.postMessage({ id: m.id, ok: true }); return; }
    if (m.type === 'materials') {
      const imgs = await Promise.all(MATERIAL_NAMES.map((n) => bitmap(paintMaterial(n))));
      self.postMessage({ id: m.id, ok: true, names: MATERIAL_NAMES, imgs }, imgs);
      return;
    }
    if (m.type === 'chunk') {
      const r = buildChunk(m.cfg, m.layer, m.k, m.quality);
      const [canvas, glow] = await Promise.all([bitmap(r.canvas), bitmap(r.glow)]);
      const transfer = [r.plane.v.buffer, r.plane.i.buffer];
      if (r.solid) transfer.push(r.solid.v.buffer, r.solid.i.buffer);
      for (const mv of r.movers) transfer.push(mv.mesh.v.buffer, mv.mesh.i.buffer);
      if (canvas) transfer.push(canvas);
      if (glow) transfer.push(glow);
      self.postMessage({ id: m.id, ok: true, chunk: { ...r, canvas, glow } }, transfer);
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err && err.stack || err) });
  }
};
