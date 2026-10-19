import { snow as snowSurf, ice as iceSurf } from '../paint/surfaces.js';
import { meshBoulder } from '../kit/terrain.js';
import { meshShip, shipSize } from '../kit/ships.js';
import { sampleField } from '../paint/noise.js';
import { RNG } from '../../core/RNG.js';

// ARCTIC WATERS: pack ice broken into floes on black water, pressure ridges,
// snow-covered floes, an open lead (an icebreaker's channel) along the flight
// path, icebergs rising out of the water, frozen-in wrecks.
//
//   water  surface at z = 0 (cold, dark)
//   ice    floe layer at z = 1.5 (cut: open water between floes and in the lead)
//
// Params: cover 0..1 (ice amount), lead (half-width of the open channel),
//         bergs 0..1, wrecks 0..1, shelf (bool: a continuous ice shelf edge on one side)

const LEN = 512, IZ = 1.5;

export default {
  id: 'arctic',
  label: 'Arctic waters / pack ice',
  defaults: { cover: 0.65, lead: 90, bergs: 0.5, wrecks: 0.25, shelf: false },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.85, 0.9, 0.95] };
    S.leadX = (y) => 40 * Math.sin(y / 520) + 20 * Math.sin(y / 190);
    S.atmosphere = { surfaces: [{ type: 'water', z: 0, deep: [0.01, 0.04, 0.06], shallow: [0.03, 0.1, 0.13], sky: [0.55, 0.62, 0.7], wave: [0.3, 1.4, 0.5, 0.25], foam: [0.04, 0.95, 0.06, 0], wind: [1, -0.4] }] };
    S.layers = [{
      id: 'ice', z: IZ, x0: -540, x1: 540, length: LEN, ppu: 1.1, cut: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    }];
    S.surfacesTopDown = [{ z: IZ, contains: (x, y) => floeAt(S, x, y) }, { z: 0, water: true }];
    return S;
  },
};

/** Is (x, y) on ice? Cellular floes thinned by cover, cleared along the lead. */
function floeAt(S, x, y) {
  const P = S.P;
  if (Math.abs(x - S.leadX(y)) < P.lead) return false;
  if (P.shelf && x > 260 + 40 * Math.sin(y / 400)) return true;
  const v = sampleField('fbm', x + 900, y - 300, 700) * 0.6 + sampleField('large', x, y, 2600) * 0.4;
  // Narrow leads cracking the pack into separate floes.
  const crack = Math.abs(sampleField('ridged', x, y, 900) - 0.5);
  return v > 0.62 - P.cover * 0.32 && sampleField('ridged', x * 1.3, y * 1.3, 1100) < 0.86 && crack > 0.012;
}

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { bergs: [], wrecks: [], ridges: [], anchors: [] };
  for (let i = 0; i < 3 * P.bergs; i++) if (R.chance(0.6)) {
    const x = R.sign() * R.range(160, 460), y = R.range(y0, y1);
    lay.bergs.push({ x, y, r: R.range(30, 70), h: R.range(30, 90), seed: R.next() });
  }
  if (R.chance(P.wrecks)) {
    const type = R.pick(['trawler', 'freighter', 'tug']), x = R.sign() * R.range(200, 400), y = R.range(y0 + 80, y1 - 80);
    lay.wrecks.push({ type, x, y, rot: R.range(-0.6, 0.6) + (R.chance(0.5) ? Math.PI : 0) });
    lay.anchors.push({ type: 'smoke', x, y, z: 12, s: 1, dark: 0.6 });
  }
  for (let i = 0; i < 6; i++) { const x = R.range(-520, 520), y = R.range(y0, y1), a = R.range(-0.5, 0.5); lay.ridges.push({ x, y, a, l: R.range(60, 180) }); }
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  iceSurf(p, { color: [0.7, 0.8, 0.88] });
  snowSurf(p, { path: () => p.allPath(), color: [0.86, 0.9, 0.95], dirty: 0 });
  p.patch('fbm_60', 300, [0.62, 0.74, 0.84], 0.45);      // bare blue ice patches
  p.patch('large_50', 700, [0.7, 0.78, 0.86], 0.35);       // older, greyer floes
  p.noise('ridged', 260, 'soft-light', 0.35);              // wind-packed relief
  // Pressure ridges: rubble lines of broken ice.
  for (const L of all) for (const r of L.ridges) {
    const R = new RNG(`ridge:${r.x}:${r.y}`), c0 = Math.cos(r.a), s0 = Math.sin(r.a);
    for (let k = 0; k < r.l / 3; k++) {
      const t = (k / (r.l / 3) - 0.5) * r.l, x = r.x + c0 * t + R.range(-3, 3), y = r.y + s0 * t + R.range(-3, 3), sz = R.range(1.5, 4);
      p.shadowBox(x, y, sz, sz, sz * 1.2, R.angle());
      p.at(x, y, R.angle(), (cx) => { cx.fillStyle = `rgba(${210 + R.int(0, 40)},${225 + R.int(0, 25)},${240 + R.int(0, 15)},1)`; cx.fillRect(-sz / 2, -sz / 2, sz, sz); });
    }
  }
  p.props(() => new RNG(`ar:${lay.seed}`), () => {
    for (const L of all) for (const b of L.bergs) p.shadowCircle(b.x, b.y, b.r * 0.85, b.h, 0, 10);
    for (const L of all) for (const w of L.wrecks) { const sz = shipSize(w.type); p.shadowBox(w.x, w.y, sz.b, sz.l, 18, w.rot); }
  }, 0.45, 4);
  // Floe mask: punch out open water (with a thin darker rim of slush on the edge).
  const W = p.canvas.width, H = p.canvas.height;
  const img = p.ctx.getImageData(0, 0, W, H), d = img.data;
  const { x0, x1 } = p.rect;
  for (let j = 0; j < H; j++) {
    const y = y1 - ((j + 0.5) / H) * (y1 - y0);
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0);
      if (!floeAt(S, x, y)) d[(j * W + i) * 4 + 3] = 0;
      else if (!floeAt(S, x + 5, y) || !floeAt(S, x - 5, y) || !floeAt(S, x, y + 5) || !floeAt(S, x, y - 5)) { const o = (j * W + i) * 4; d[o] *= 0.78; d[o + 1] *= 0.84; d[o + 2] *= 0.9; }
    }
  }
  p.ctx.putImageData(img, 0, 0);
}

function mesh(mb, lay) {
  for (const b of lay.bergs) meshBoulder(mb, b.x, b.y, b.r, b.h, b.seed, 'ice', -6);
  for (const w of lay.wrecks) meshShip(mb, w.type, w.x, w.y, w.rot, { burnt: true, lowered: true });
}
