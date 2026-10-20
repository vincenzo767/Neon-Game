import { RNG } from '../../core/RNG.js';
import { sampleField } from '../paint/noise.js';

// PLANETARY ORBIT: the planet far below (surface shader: oceans, continents,
// weather systems and their shadows, the terminator with city lights),
// orbital structures passing close by with strong parallax: a station truss
// with pressurised modules and solar arrays, satellites and debris, and
// optionally an alien hull (ribbed plating with glowing vents) or a space
// elevator tether.
//
// Params: planet 'earth' | 'mars' | 'ice' | 'ocean' | 'alien' | 'night' |
//         'gas' | 'jupiter' | 'crimson' (gas giants: banded, no surface)
//         station 0..1, debris 0..1, hull 'none' | 'alien', tether (bool),
//         altitude (planet depth below, default 14000), terminator (world x),
//         ring 0..1 (a planetary ring plane far below: banded ice and rock
//         with scattered boulders), ringCol [r,g,b]

const LEN = 640;

const PLANETS = {
  earth: { ocean: [0.03, 0.12, 0.3], land: [0.22, 0.32, 0.14], land2: [0.52, 0.44, 0.3], ice: [0.9, 0.93, 0.97], cloudCol: [0.95, 0.96, 0.98], planet: [0.45, 0.5, 1, -1e6], atmo: [0.35, 0.55, 0.95] },
  night: { ocean: [0.03, 0.12, 0.3], land: [0.22, 0.32, 0.14], land2: [0.52, 0.44, 0.3], ice: [0.9, 0.93, 0.97], cloudCol: [0.95, 0.96, 0.98], planet: [0.5, 0.45, 1, 600], atmo: [0.35, 0.55, 0.95] },
  mars: { ocean: [0.42, 0.18, 0.1], land: [0.62, 0.32, 0.18], land2: [0.45, 0.24, 0.16], ice: [0.92, 0.88, 0.85], cloudCol: [0.85, 0.7, 0.6], planet: [0.6, 0.15, 1.2, -1e6], atmo: [0.8, 0.5, 0.35] },
  ice: { ocean: [0.55, 0.68, 0.8], land: [0.85, 0.9, 0.96], land2: [0.62, 0.72, 0.84], ice: [1, 1, 1], cloudCol: [0.95, 0.97, 1], planet: [0.7, 0.35, 1, -1e6], atmo: [0.6, 0.75, 1] },
  ocean: { ocean: [0.02, 0.15, 0.32], land: [0.25, 0.4, 0.2], land2: [0.6, 0.55, 0.38], ice: [0.92, 0.95, 1], cloudCol: [0.96, 0.97, 1], planet: [0.25, 0.45, 1, -1e6], atmo: [0.35, 0.6, 1] },
  // Gas giants (u_gas): band colours come from ocean / land / land2 / ice, storms from cloudCol.
  gas: { ocean: [0.38, 0.24, 0.15], land: [0.72, 0.52, 0.34], land2: [0.26, 0.15, 0.1], ice: [0.86, 0.76, 0.6], cloudCol: [0.8, 0.36, 0.2], planet: [0, 0, 1.4, -1e6], atmo: [0.8, 0.65, 0.5], gas: 1 },
  jupiter: { ocean: [0.42, 0.3, 0.22], land: [0.8, 0.7, 0.56], land2: [0.5, 0.3, 0.2], ice: [0.9, 0.86, 0.76], cloudCol: [0.75, 0.3, 0.18], planet: [0, 0, 1.0, -1e6], atmo: [0.85, 0.72, 0.58], gas: 1 },
  crimson: { ocean: [0.4, 0.06, 0.06], land: [0.75, 0.22, 0.14], land2: [0.25, 0.04, 0.06], ice: [0.95, 0.55, 0.35], cloudCol: [1, 0.75, 0.4], planet: [0, 0, 1.2, -1e6], atmo: [0.9, 0.3, 0.2], gas: 1 },
  alien: { ocean: [0.08, 0.25, 0.2], land: [0.3, 0.18, 0.35], land2: [0.55, 0.45, 0.25], ice: [0.8, 0.95, 0.85], cloudCol: [0.75, 0.9, 0.8], planet: [0.55, 0.55, 1.3, -1e6], atmo: [0.35, 0.85, 0.6] },
};

export default {
  id: 'orbit',
  label: 'Planetary orbit',
  defaults: { planet: 'earth', station: 0.7, debris: 0.6, hull: 'none', tether: false, altitude: 14000 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const pl = { ...(PLANETS[P.planet] || PLANETS.earth) };
    if (P.terminator != null) pl.planet = [...pl.planet.slice(0, 3), P.terminator];
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.7, 0.72, 0.75] };
    S.atmosphere = { surfaces: [{ type: 'planet', z: -P.altitude, ...pl }], sky: { mode: 1, top: [0, 0, 0.01], bottom: [0.01, 0.02, 0.05], accent: [0.2, 0.3, 0.6] } };
    S.layers = [];
    if (P.ring > 0) S.layers.push({
      id: 'ring', z: -1400, x0: -2600, x1: 2600, length: 2048, ppu: 0.16, blend: true,
      layout: (c) => ({ seed: c.R.next() }),
      paint: (p, lay, nb, c) => paintRing(p, c, P),
    });
    S.layers.push({
      id: 'orbit', z: 0, x0: -10, x1: 10, length: LEN, ppu: 0.05,
      layout: (c) => layout(c, S),
      mesh: (mb, lay) => mesh(mb, lay, S),
    });
    S.surfacesTopDown = [{ z: -60 }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { truss: null, modules: [], panels: [], sats: [], junk: [], ribs: [], plates: [], anchors: [] };
  if (P.station > 0 && R.chance(P.station + 0.2)) {
    const x = R.sign() * R.range(240, 330), z = R.range(-260, -120);
    lay.truss = { x, z };
    for (let y = y0 + 40; y < y1 - 40; y += R.range(110, 170)) {
      const kind = R.next();
      if (kind < 0.45) lay.modules.push({ x: x + R.sign() * 26, y, z: z + 8, r: R.range(12, 18), l: R.range(60, 110) });
      else if (kind < 0.85) lay.panels.push({ x, y, z, span: R.range(140, 220), w: R.range(36, 52) });
      lay.anchors.push({ type: 'beacon', x, y, z: z + 14, c: R.chance(0.5) ? [1, 0.15, 0.1] : [0.3, 1, 0.4], period: 70 + R.int(0, 30) });
    }
  }
  for (let i = 0; i < 2 * P.debris; i++) if (R.chance(0.6)) lay.sats.push({ x: R.range(-420, 420), y: R.range(y0, y1), z: R.range(-420, 60), rot: R.angle(), tilt: R.range(-0.5, 0.5) });
  for (let i = 0; i < 8 * P.debris; i++) lay.junk.push({ x: R.range(-460, 460), y: R.range(y0, y1), z: R.range(-500, 80), s: R.range(3, 10), rot: R.angle() });
  if (P.hull === 'alien') {
    for (let y = Math.ceil(y0 / 128) * 128; y < y1; y += 128) {
      lay.ribs.push({ y, s: -1 });
      lay.anchors.push({ type: 'glow', x: -300, y: y + 64, z: -40, r: 46, c: [0.3, 1, 0.45], a: 0.5, flicker: true });
    }
    for (let y = Math.ceil(y0 / 64) * 64; y < y1; y += 64) lay.plates.push({ y, h: R.range(-40, 40) });
    if (R.chance(0.5)) lay.anchors.push({ type: 'steam', x: -280, y: R.range(y0, y1), z: 20, s: 1.6 });
  }
  if (P.tether) lay.anchors.push({ type: 'beacon', x: 0, y: (y0 + y1) / 2, z: -300, c: [1, 0.8, 0.3], period: 40 });
  return lay;
}

function mesh(mb, lay, S) {
  const P = S.P;
  if (lay.truss) {
    const { x, z } = lay.truss, y0 = lay.y0 - 2, y1 = lay.y1 + 2;
    // Square truss spine (four longerons + lattice faces).
    mb.prism([x - 7, y0, x + 7, y0, x + 7, y1, x - 7, y1], z - 7, z + 7, { side: 'lattice_grey', top: 'lattice_grey' });
    for (const m of lay.modules) {
      mb.lathe(m.x, m.y, [[0, z - 2], [m.r * 0.8, z], [m.r, z + 4]], 'station_hull', { seg: 14, top: false });
      // Cylinder lying along y: built as a beam with a round-ish section (octagonal prism walls).
      mb.beam([m.x, m.y - m.l / 2, m.z + m.r * 0.5], [m.x, m.y + m.l / 2, m.z + m.r * 0.5], m.r * 1.6, m.r * 1.6, 'station_hull');
      mb.beam([m.x, m.y - m.l / 2 - 4, m.z + m.r * 0.5], [m.x, m.y + m.l / 2 + 4, m.z + m.r * 0.5], m.r * 0.8, m.r * 0.8, 'metal_dark');
    }
    for (const pn of lay.panels) {
      for (const s of [-1, 1]) {
        const xa = x + s * 10, xb = x + s * pn.span;
        mb.beam([xa, pn.y, z], [xb, pn.y, z], 3, 3, 'steel_painted');
        mb.box((xa + xb) / 2 + s * 4, pn.y, z - 1, Math.abs(xb - xa) - 8, pn.w, 1.2, 0, { top: 'solar_panel', side: 'metal_dark' });
      }
      mb.box(x, pn.y, z - 10, 18, 18, 20, 0, { top: 'station_hull', side: 'station_hull' });
    }
  }
  for (const s of lay.sats) {
    const c = Math.cos(s.rot), q = Math.sin(s.rot);
    mb.box(s.x, s.y, s.z, 14, 18, 12, s.rot, { top: 'foil_gold', side: 'foil_gold' });
    for (const side of [-1, 1]) mb.box(s.x + c * side * 34, s.y + q * side * 34, s.z + 5, 46, 14, 1, s.rot, { top: 'solar_panel', side: 'metal_dark' });
    mb.lathe(s.x - q * 10, s.y + c * 10, [[0, s.z + 12], [7, s.z + 15], [0.1, s.z + 16]], 'steel_painted', { seg: 10 });
  }
  for (const j of lay.junk) mb.box(j.x, j.y, j.z, j.s, j.s * 1.4, j.s * 0.4, j.rot, { top: 'metal_dark', side: 'foil_gold' });
  for (const r of lay.ribs) {
    // Alien hull rib arching over the left flank.
    const pts = [[-480, r.y, -320], [-420, r.y, -120], [-340, r.y, 30], [-260, r.y, 60]];
    for (let i = 0; i < pts.length - 1; i++) mb.beam(pts[i], pts[i + 1], 22 - i * 4, 18, 'alien_hull');
  }
  for (const pl of lay.plates) mb.box(-400, pl.y, -340 + pl.h * 0.2, 260, 60, 200 + pl.h, 0, { top: 'alien_hull', side: 'alien_hull' });
  if (P.tether) mb.beam([0, lay.y0 - 2, -3000], [0, lay.y1 + 2, -3000], 30, 30, 'tether');
}

/** Ring plane: bands run along the flight path (the ring is vast); density
 *  varies across x with gaps, with grainy ice/rock texture and boulders. */
function paintRing(p, c, P) {
  p.ctx.clearRect(-1e5, -1e5, 2e5, 2e5);
  const W = p.canvas.width, H = p.canvas.height, img = p.ctx.createImageData(W, H), d = img.data, { x0, x1, y0, y1 } = p.rect;
  const col = P.ringCol || [0.42, 0.4, 0.38];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    const x = x0 + (i / W) * (x1 - x0), y = y1 - (j / H) * (y1 - y0);
    const band = sampleField('fbm', x, 0, 900) * 0.7 + sampleField('fine', x, 0, 140) * 0.3;
    const gap = Math.min(1, Math.abs(Math.sin(x / 520)) * 3);
    const grain = sampleField('fine', x, y, 40);
    // The ring's inner edge crosses the view: open space (the planet) on one side.
    const edge = Math.max(0, Math.min(1, (x + 120) / 160));
    const a = Math.min(1, Math.max(0, band - 0.3) * 3.2) * gap * edge * (0.55 + 0.45 * grain) * P.ring;
    const k = 0.7 + 0.5 * grain;
    for (let jj = 0; jj < 2; jj++) for (let ii = 0; ii < 2; ii++) { const o4 = ((j + jj) * W + i + ii) * 4; d[o4] = Math.min(255, col[0] * k * 255); d[o4 + 1] = Math.min(255, col[1] * k * 255); d[o4 + 2] = Math.min(255, col[2] * k * 255); d[o4 + 3] = Math.min(215, a * 255); }
  }
  p.ctx.putImageData(img, 0, 0);
  const R = new RNG(`ring:${c.y0}`);
  for (let k = 0; k < 160; k++) { const x = R.range(-40, x1), y = R.range(y0, y1); p.circlePath(x, y, R.range(3, 14)).fill([col[0] * 0.6, col[1] * 0.58, col[2] * 0.55], 0.9); }
}
