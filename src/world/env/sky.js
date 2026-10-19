import { coverField } from '../paint/clouds.js';
import { paintHeightfield, mountainHeight, hillHeight } from '../paint/heightfield.js';
import { sampleField } from '../paint/noise.js';
import { shade, mix } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// SKY / ALTITUDE: flying high over terrain or sea, through cloud layers.
//
//   ground  far below (z = groundZ): mountains (heightfield with snow line),
//           desert, farmland, ice sheet, or open sea (water surface)
//   decks   cloud layers at several heights (alpha, lit from the sun, with
//           their shadows painted onto the ground below)
//   wisps   sparse near clouds above the action that rush past (speed cue)
//   extras  storm: towering dark cells, lightning, rain; aurora curtains at
//           night; re-entry plasma streaks
//
// Params:
//   ground  'mountains' | 'sea' | 'desert' | 'farmland' | 'ice' | 'none' |
//           'fjord' (mountains cut by a sea inlet) | 'canyon' (red-rock mesas
//           and a winding river gorge)
//   groundZ (default -2200), cover 0..1 (cloud amount), decks [z...],
//   storm 0..1, aurora 0..1, wisps 0..1, snowline (height), dawn (bool tint)
//   cloudLit / cloudShade / cloudBase colours, seaDeep / seaShallow

const DEFAULT_DECKS = [-760, -330];

export default {
  id: 'sky',
  label: 'Altitude / clouds',
  defaults: { ground: 'mountains', groundZ: -2200, cover: 0.55, decks: DEFAULT_DECKS, storm: 0, aurora: 0, wisps: 0.4, snowline: 520, peaks: 1 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const sh = new RNG(`${seed}:sky`).range(0, 50);
    const S = { P, seed, dust: [0.85, 0.87, 0.9] };
    const gz = P.groundZ;
    const valley = (y) => 380 * Math.sin(y / 2900 + sh) + 160 * Math.sin(y / 1100) + 70 * Math.sin(y / 330 + sh * 2);
    // Peaks never reach the flight level: cap relief to 70% of the altitude.
    const amp = Math.min(1500 * P.peaks, Math.max(200, -gz * 0.7));
    const fjord = mountainHeight({ amp, floor: 0.22, sharp: 1.3, valley, valleyW: 620, base: -90 });
    const mesa = (x, y) => {
      const f = sampleField('fbm', x, y, 2600) * 0.75 + sampleField('large', x, y, 6000) * 0.25;
      const lv = Math.max(0, (f - 0.38) / 0.62) * 4, step = Math.floor(lv), fr = lv - step;
      const terr = (step + Math.min(1, fr * 6)) / 4;                                       // flat-topped tiers
      const gorge = Math.min(1, Math.abs(x - valley(y)) / 260);
      return terr * 520 * gorge * gorge + (sampleField('ridged', x, y, 900) - 0.5) * 30;
    };
    const height = P.ground === 'mountains' ? mountainHeight({ amp, floor: 0.3, sharp: 1.5 })
      : P.ground === 'fjord' ? fjord : P.ground === 'canyon' ? mesa
      : P.ground === 'desert' ? hillHeight({ amp: 140 }) : P.ground === 'farmland' ? hillHeight({ amp: 60, scale: 1.5 }) : P.ground === 'ice' ? hillHeight({ amp: 90 }) : null;
    S.height = height;
    const storm = P.storm;
    const cover = coverField(sh, 1, (P.cover - 0.5) * 0.55, 1.7 + storm * 0.6);
    S.cover = cover;
    const layers = [];
    const alt = Math.max(400, -gz), GX = Math.min(1900, Math.round(520 + alt * 0.62)), GL = alt < 1500 ? 1024 : 1536;
    const GPPU = Math.min(0.62, Math.max(0.22, 0.22 * 2200 / alt));
    if (P.ground !== 'none' && P.ground !== 'sea') {
      layers.push({
        // Resolution follows altitude: low passes (fjords, canyons) need a
        // denser texture and mesh than ground seen from the stratosphere.
        id: 'ground', z: gz, x0: -GX, x1: GX, length: GL, ppu: GPPU, grid: height ? [Math.round(GX / 30), Math.round(GL / 30)] : [1, 1], height, flatLight: !!height,
        layout: (c) => ({ seed: c.R.next() }),
        paint: (p, lay, nb, c) => paintGround(p, c, S, sh),
      });
    }
    const cols = cloudColours(cfg, P);
    // Cloud decks are GPU cloud surfaces (world/WorldGL drawCloud): crisp at any
    // resolution, self-shadowed toward the sun, slowly drifting and evolving.
    const decks = P.decks || DEFAULT_DECKS, nd = decks.length;
    const clouds = decks.map((z, i) => {
      const depth = nd > 1 ? 1 - i / (nd - 1) : 0;           // 1 = lowest deck
      const dark = depth * (0.35 + storm * 0.4);
      const tone = (c0) => c0.map((v) => v * (1 - dark));
      const full = i === 0 && (P.ground === 'none' || storm > 0.5);
      return {
        type: 'cloud', z,
        cloud: [full ? 1.25 : Math.min(1, P.cover * (1.0 - i * 0.24) + storm * 0.05), (1.3 - i * 0.25) * (P.cloudScale || 1) + (i === nd - 1 ? storm * 0.4 : 0), 0.1 + storm * 0.04, 26 + storm * 26],
        lit: tone(cols.lit), shade: tone(cols.shade), base: tone(cols.base),
        drift: [(P.drift || 4) * (1 + i * 0.5), 1 + i], seed: i * 17.3 + sh, alpha: 0.98,
      };
    });
    if (P.wisps > 0) clouds.push({ type: 'cloud', z: 170, cloud: [0.22 + P.wisps * 0.12, 0.7, 0.18, 16], lit: cols.lit, shade: cols.shade, base: cols.shade, drift: [10, 3], seed: 91 + sh, alpha: 0.1 + 0.16 * P.wisps });
    S.clouds = clouds;
    // A carrier layer for FX anchors (lightning, aurora) at the top deck.
    const deckTop = decks.at(-1);
    layers.push({
      id: 'fxhost', z: deckTop, x0: -10, x1: 10, length: 1024, ppu: 0.05, blend: true, alpha: 0,
      layout: (c) => {
        const R = c.R, anchors = [];
        if (storm > 0) for (let k = 0; k < 2 + 4 * storm; k++) anchors.push({ type: 'lightning', x: R.range(-600, 600), y: R.range(c.y0, c.y1), z: deckTop + R.range(-40, 40), s: R.range(0.8, 1.4), rate: 0.0015 + storm * 0.003 });
        if (P.aurora > 0) for (let k = 0; k < 2; k++) anchors.push({ type: 'aurora', x: R.range(-500, 500), y: R.range(c.y0, c.y1), z: deckTop + 120, s: R.range(1, 1.6), c: R.chance(0.7) ? [0.25, 1, 0.55] : [0.7, 0.35, 1] });
        return { anchors };
      },
    });
    S.layers = layers;
    // Haze between the camera and decks far below is thin: long fog distances.
    const A = { sky: { mode: 0, top: cols.skyTop, bottom: cols.skyBottom }, surfaces: [...clouds], fog: [1500 + (P.haze ?? 0) * -900, 5200, 0.6], fogCol: cols.skyBottom };
    if (P.ground === 'fjord') A.surfaces.unshift({ type: 'water', z: gz, deep: P.seaDeep || [0.02, 0.06, 0.08], shallow: P.seaShallow || [0.05, 0.13, 0.15], sky: cols.skyBottom, wave: [1.2, 0.5, 0.45, 0.6], foam: [0.1, 0.5, 0.2, 0] });
    if (P.ground === 'sea') A.surfaces.unshift({ type: 'water', z: gz - 2, deep: P.seaDeep || [0.02, 0.07, 0.12], shallow: P.seaShallow || [0.05, 0.16, 0.22], sky: cols.skyBottom, wave: [1.6, 0.6, 0.5, 0.9], foam: [0.15, 0.7, 0.3, 0] });
    S.atmosphere = A;
    S.surfacesTopDown = [{ z: (P.decks || DEFAULT_DECKS).at(-1), water: false }];
    return S;
  },
};

function cloudColours(cfg, P) {
  const c = baseCloudColours(cfg, P);
  if (P.cloudLit) c.lit = P.cloudLit;
  if (P.cloudShade) c.shade = P.cloudShade;
  if (P.cloudBase) c.base = P.cloudBase;
  return c;
}

function baseCloudColours(cfg, P) {
  const pre = (cfg.light && cfg.light.preset) || 'afternoon';
  if (P.storm > 0.5) return { lit: [0.8, 0.82, 0.88], shade: [0.44, 0.46, 0.53], base: [0.13, 0.14, 0.18], skyTop: [0.12, 0.13, 0.17], skyBottom: [0.2, 0.22, 0.27] };
  if (pre === 'dawn') return { lit: [1, 0.86, 0.74], shade: [0.74, 0.66, 0.72], base: [0.45, 0.42, 0.55], skyTop: [0.35, 0.42, 0.62], skyBottom: [0.85, 0.62, 0.55] };
  if (pre === 'dusk' || pre === 'smoke') return { lit: [1, 0.72, 0.48], shade: [0.7, 0.52, 0.48], base: [0.38, 0.3, 0.36], skyTop: [0.3, 0.25, 0.4], skyBottom: [0.9, 0.5, 0.3] };
  if (pre === 'desert') return { lit: [1, 0.92, 0.8], shade: [0.82, 0.72, 0.62], base: [0.6, 0.5, 0.42], skyTop: [0.42, 0.52, 0.68], skyBottom: [0.86, 0.76, 0.62] };
  if (pre === 'arctic') return { lit: [1, 1, 1], shade: [0.78, 0.84, 0.92], base: [0.52, 0.6, 0.72], skyTop: [0.38, 0.52, 0.74], skyBottom: [0.74, 0.82, 0.92] };
  if (pre === 'night') return { lit: [0.55, 0.62, 0.75], shade: [0.32, 0.36, 0.46], base: [0.14, 0.16, 0.22], skyTop: [0.02, 0.03, 0.07], skyBottom: [0.05, 0.07, 0.12] };
  return { lit: [1, 1, 1], shade: [0.8, 0.83, 0.9], base: [0.55, 0.6, 0.7], skyTop: [0.35, 0.5, 0.75], skyBottom: [0.65, 0.75, 0.88] };
}

const FIELD_COLS = [[0.38, 0.45, 0.2], [0.66, 0.58, 0.32], [0.3, 0.36, 0.18], [0.46, 0.36, 0.24], [0.42, 0.48, 0.24], [0.56, 0.5, 0.3], [0.34, 0.27, 0.19], [0.74, 0.7, 0.28]];
const hash2 = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function paintGround(p, c, S, sh) {
  const P = S.P;
  const snow = P.snowline, h = S.height;
  const col = {
    mountains: (z, slope, x, y) => {
      const rock = mix([0.36, 0.34, 0.31], [0.24, 0.23, 0.22], sampleField('fine', x, y, 400));
      const forest = [0.16, 0.21, 0.14];
      let cc = z < 220 ? mix(forest, rock, Math.min(1, z / 220 + slope)) : rock;
      const sn = Math.max(0, Math.min(1, (z - snow + sampleField('fbm', x, y, 900) * 260 - 130) / 120)) * (1 - Math.min(1, slope * 1.6));
      cc = mix(cc, [0.92, 0.94, 0.98], sn);
      return cc;
    },
    desert: (z, slope, x, y) => mix([0.78, 0.6, 0.4], [0.6, 0.42, 0.28], sampleField('fbm', x, y, 800) * 0.6 + slope),
    farmland: (z, slope, x, y) => {
      // Irregular field parcels (warped grid) with crop rows, hedgerows and
      // farm tracks along the boundaries.
      const wx = x + (sampleField('fbm', x, y, 1800) - 0.5) * 140 + 1e5, wy = y + (sampleField('fbm', x + 500, y, 1800) - 0.5) * 140 + 1e5;
      const fx = Math.floor(wx / 170), fy = Math.floor(wy / 130), lx = wx - fx * 170, ly = wy - fy * 130;
      const k = hash2(fx, fy), k2 = hash2(fy + 7, fx - 3);
      const edge = Math.min(lx, 170 - lx, ly, 130 - ly);
      if (edge < 1.6) return k2 < 0.3 ? [0.52, 0.48, 0.4] : [0.14, 0.2, 0.1];
      if (edge < 4.5 && k2 > 0.25) return mix([0.1, 0.17, 0.08], [0.18, 0.26, 0.12], sampleField('fine', x, y, 60));
      let c = FIELD_COLS[Math.floor(k * FIELD_COLS.length)];
      const row = 0.5 + 0.5 * Math.sin((k2 > 0.5 ? lx : ly) * 1.9);
      c = c.map((v) => v * (0.88 + 0.12 * row));
      return mix(mix(c, [0.42, 0.42, 0.3], 0.3), shade(c, 0.85), sampleField('fbm', x, y, 300) * 0.5);
    },
    ice: (z, slope, x, y) => mix([0.86, 0.9, 0.96], [0.62, 0.74, 0.86], sampleField('ridged', x, y, 1400) * 0.7),
    fjord: (z, slope, x, y) => {
      if (z < 0) return mix([0.08, 0.1, 0.1], [0.2, 0.2, 0.18], Math.max(0, 1 + z / 90));      // drowned valley floor
      const rock = mix([0.34, 0.33, 0.31], [0.22, 0.22, 0.22], sampleField('fine', x, y, 400));
      let cc = z < 260 ? mix([0.14, 0.2, 0.13], rock, Math.min(1, z / 260 + slope * 1.4)) : rock;
      const sn = Math.max(0, Math.min(1, (z - snow + sampleField('fbm', x, y, 900) * 260 - 130) / 120)) * (1 - Math.min(1, slope * 1.6));
      return mix(cc, [0.92, 0.94, 0.98], sn);
    },
    canyon: (z, slope, x, y) => {
      const band = (Math.floor(z / 46) % 3) / 2;
      const rock = mix(mix([0.72, 0.4, 0.24], [0.56, 0.3, 0.2], band), [0.82, 0.62, 0.42], sampleField('fine', x, y, 500) * 0.35);
      const top = mix([0.66, 0.5, 0.34], [0.5, 0.42, 0.28], sampleField('fbm', x, y, 700));
      return z < 12 ? [0.42, 0.36, 0.26] : mix(top, rock, Math.min(1, slope * 2.4));
    },
  }[P.ground] || ((z) => [0.4, 0.4, 0.38]);
  paintHeightfield(p, h || (() => 0), col, { eps: 30, step: 2, shadows: P.ground === 'canyon' || P.ground === 'fjord' || P.ground === 'mountains' ? { range: 1600, steps: 10 } : null });
  // River in the gorge floor.
  if (P.ground === 'canyon') { const pts = []; for (let y = p.rect.y0 - 40; y <= p.rect.y1 + 40; y += 30) pts.push(380 * Math.sin(y / 2900 + sh) + 160 * Math.sin(y / 1100) + 70 * Math.sin(y / 330 + sh * 2), y); p.line(pts, 70, [0.3, 0.34, 0.2], 0.45, { cap: 'round' }); p.line(pts, 26, [0.12, 0.2, 0.17], 0.95, { cap: 'round' }); p.line(pts, 8, [0.3, 0.42, 0.36], 0.35, { cap: 'round' }); }
  if (P.ground === 'farmland') {
    // A country road and a river meander through the parcels.
    const road = [], river = [];
    for (let y = p.rect.y0 - 40; y <= p.rect.y1 + 40; y += 30) { road.push(260 + 120 * Math.sin(y / 1300 + sh), y); river.push(-420 + 180 * Math.sin(y / 900 + sh * 3) + 60 * Math.sin(y / 260), y); }
    p.line(river, 22, [0.14, 0.2, 0.2], 0.9, { cap: 'round' });
    p.line(road, 6, [0.5, 0.48, 0.44], 0.85, { cap: 'round' });
  }
  p.noise('fbm', 2200, 'soft-light', 0.35);
  // Cloud shadows from the deck above (offset along the sun).
  const sun = p.sun, k = (P.decks || DEFAULT_DECKS)[0] - P.groundZ;
  const dx = sun.dx * k / Math.tan(sun.elev), dy = sun.dy * k / Math.tan(sun.elev);
  p.layer((pp) => {
    const W = pp.canvas.width, H = pp.canvas.height, img = pp.ctx.createImageData(W, H), d = img.data, { x0, x1, y0, y1 } = pp.rect;
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
      const x = x0 + (i / W) * (x1 - x0) - dx, y = y1 - (j / H) * (y1 - y0) - dy;
      const a = Math.max(0, S.cover(x, y) - 0.35) * 1.6;
      for (let jj = 0; jj < 2; jj++) for (let ii = 0; ii < 2; ii++) { const o4 = ((j + jj) * W + i + ii) * 4; d[o4 + 3] = Math.min(255, a * 160); }
    }
    pp.ctx.putImageData(img, 0, 0);
  }, { alpha: 0.75, blur: 20 });
  void sh;
}

export { shade };
