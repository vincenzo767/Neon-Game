import { TilePainter, TILE } from './paint/tile.js';
import { css, shade, hex, mix } from './paint/core.js';
import { RNG } from '../core/RNG.js';

// Shared material library for arena solids (roofs, façades, concrete, rust,
// rock, ice, containers, ...). Each material is a seamless 256² tile painted
// procedurally once per session and uploaded as one layer of a
// TEXTURE_2D_ARRAY (real REPEAT wrapping, full mip chain).
//
// Catalog entry:  name: { paint(tp, R), size: [u, v] world units per repeat,
//                         em: emissive multiplier (lit windows, lava), cut: alpha-tested }
// Tile coordinates: x along the surface, y UP (façade height / roof north).
//
// Status of every entry: PROCEDURAL (generated at runtime, no external file).

const S = TILE;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers

function grime(tp, k = 1) {
  tp.tn('large', 1, 'soft-light', 0.5 * k);
  tp.tn('fbm', 1, 'overlay', 0.3 * k);
  tp.tn('grain', 2, 'overlay', 0.25 * k);
}

/** Vertical rain streaks / soot running down a wall. */
function streaks(tp, color, alpha = 0.25) {
  tp.patch('fine_60', S / 2, color, alpha, { sy: 2 });
}

function windowGrid(tp, R, o) {
  const { cols, rows, wf = 0.6, hf = 0.55, glass, frame, lit = 0, litCol = [1, 0.8, 0.5], broken = 0, blinds = 0.3 } = o;
  const bw = S / cols, bh = S / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const w = bw * wf, h = bh * hf, x = i * bw + (bw - w) / 2, y = j * bh + (bh - h) * 0.55;
    tp.rectPath(x - 1, y - 1, w + 2, h + 2).fill(frame);
    const g = shade(glass, R.range(0.75, 1.15));
    tp.linear(x, y + h, x + w, y, [[0, shade(g, 1.35)], [0.5, g], [1, shade(g, 0.7)]], () => tp.rectPath(x, y, w, h));
    if (R.chance(blinds)) tp.rectPath(x, y + h * R.range(0.35, 0.8), w, h * 0.25).fill([0.75, 0.72, 0.66], 0.55);
    if (lit && R.chance(lit)) tp.rectPath(x, y, w, h).fill(shade(litCol, R.range(0.6, 1)), 0.9);
    if (broken && R.chance(broken)) {
      tp.rectPath(x, y, w, h).fill([0.02, 0.02, 0.02], 0.9);
      tp.line([x, y + h, x + w * R.range(0.3, 0.7), y + h * R.range(0.2, 0.6)], 0.8, [0.5, 0.55, 0.6], 0.6);
    }
    // Sill shadow.
    tp.rectPath(x - 1, y - 2.5, w + 2, 1.5).fill([0, 0, 0], 0.35);
  }
}

function panelSeams(tp, nx, ny, color = [0, 0, 0], alpha = 0.35, w = 1.2) {
  for (let i = 0; i <= nx; i++) tp.line([(i * S) / nx, -2, (i * S) / nx, S + 2], w, color, alpha);
  for (let j = 0; j <= ny; j++) tp.line([-2, (j * S) / ny, S + 2, (j * S) / ny], w, color, alpha);
}

function rivets(tp, nx, ny, color, r = 1.3) {
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = ((i + 0.5) * S) / nx, y = ((j + 0.5) * S) / ny;
    tp.circlePath(x, y, r).fill(color);
    tp.circlePath(x - 0.4, y + 0.4, r * 0.5).fill([1, 1, 1], 0.35);
  }
}

function corrugated(tp, color, n = 32, horizontal = false) {
  tp.base(color);
  for (let i = 0; i < n; i++) {
    const a = (i * S) / n, b = ((i + 0.5) * S) / n;
    if (horizontal) {
      tp.rectPath(-1, a, S + 2, S / n / 2).fill([1, 1, 1], 0.12);
      tp.rectPath(-1, b, S + 2, S / n / 2).fill([0, 0, 0], 0.18);
    } else {
      tp.rectPath(a, -1, S / n / 2, S + 2).fill([1, 1, 1], 0.12);
      tp.rectPath(b, -1, S / n / 2, S + 2).fill([0, 0, 0], 0.18);
    }
  }
}

function rustPatches(tp, k = 1) {
  tp.tp('fbm_60', 1, [0.42, 0.2, 0.08], 0.55 * k, { detail: ['grain', 128, 0.6] });
  tp.tp('fine_70', 1, [0.28, 0.12, 0.05], 0.5 * k);
}

function gravelRoof(tp, base) {
  tp.base(base);
  tp.tn('grain', 2, 'overlay', 0.7);
  tp.tn('grain', 1, 'soft-light', 0.5);
  tp.tn('fbm', 1, 'soft-light', 0.45);
  tp.tp('fbm_70', 1, shade(base, 0.6), 0.35);
}

// ---------------------------------------------------------------- catalog

export const MATERIALS = {
  // ------------------------------------------------------------ roofs
  roof_gravel: { size: [90, 90], paint(tp) { gravelRoof(tp, [0.42, 0.41, 0.39]); } },
  roof_gravel_dark: { size: [90, 90], paint(tp) { gravelRoof(tp, [0.26, 0.26, 0.26]); tp.tp('large_50', 1, [0.08, 0.07, 0.06], 0.35); } },
  roof_tar: {
    size: [110, 110],
    paint(tp, R) {
      tp.base([0.15, 0.15, 0.16]);
      grime(tp, 0.8);
      for (let i = 0; i < 6; i++) tp.line([-2, (i * S) / 6 + 4, S + 2, (i * S) / 6 + 4], 2, [0.08, 0.08, 0.09], 0.6);
      tp.tp('fbm_70', 1, [0.3, 0.29, 0.27], 0.3);
      for (let i = 0; i < 6; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 40, 0.8, [0.05, 0.05, 0.05], 0.6, 1)); }
    },
  },
  roof_metal: {
    size: [70, 70],
    paint(tp) {
      corrugated(tp, [0.46, 0.48, 0.5], 24);
      tp.tn('fbm', 1, 'soft-light', 0.5);
      rustPatches(tp, 0.5);
      panelSeams(tp, 1, 4, [0, 0, 0], 0.4, 1.5);
    },
  },
  roof_concrete: {
    size: [120, 120],
    paint(tp, R) {
      tp.base([0.55, 0.54, 0.51]);
      grime(tp);
      panelSeams(tp, 4, 4, [0.1, 0.1, 0.1], 0.35, 1);
      tp.tp('fbm_60', 1, [0.3, 0.3, 0.29], 0.3);
      for (let i = 0; i < 4; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 50, 0.7)); }
    },
  },
  roof_burnt: {
    size: [100, 100],
    paint(tp, R) {
      tp.base([0.12, 0.11, 0.1]);
      tp.tn('grain', 2, 'overlay', 0.6);
      tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tp('fbm_50', 1, [0.03, 0.03, 0.03], 0.8);
      tp.tp('fine_70', 2, [0.36, 0.33, 0.3], 0.35);
      for (let i = 0; i < 5; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 60, 1.2, [0.01, 0.01, 0.01], 0.8)); }
    },
  },

  // ---------------------------------------------------------- façades
  facade_office: {
    size: [96, 76],
    paint(tp, R) {
      tp.base([0.5, 0.5, 0.49]); grime(tp, 0.6);
      windowGrid(tp, R, { cols: 4, rows: 4, wf: 0.72, hf: 0.58, glass: [0.13, 0.17, 0.22], frame: [0.25, 0.26, 0.27] });
      streaks(tp, [0.15, 0.14, 0.13], 0.25);
    },
  },
  facade_office_night: {
    size: [96, 76], em: 1.4,
    paint(tp, R) {
      tp.base([0.12, 0.12, 0.13]); grime(tp, 0.4);
      windowGrid(tp, R, { cols: 4, rows: 4, wf: 0.72, hf: 0.58, glass: [0.03, 0.04, 0.06], frame: [0.06, 0.06, 0.07], lit: 0.35, litCol: [1, 0.78, 0.45] });
    },
  },
  facade_brick: {
    size: [80, 64],
    paint(tp, R) {
      tp.base([0.45, 0.24, 0.17]);
      for (let j = 0; j < 32; j++) {
        const y = (j * S) / 32, off = j % 2 ? 8 : 0;
        tp.line([-2, y, S + 2, y], 1.4, [0.62, 0.58, 0.52], 0.55);
        for (let i = 0; i < 16; i++) { const x = i * 16 + off; tp.line([x, y, x, y + S / 32], 1, [0.62, 0.58, 0.52], 0.45); tp.rectPath(x + 0.5, y + 0.7, 15, 6.5).fill(shade([0.48, 0.25, 0.18], R.range(0.75, 1.2)), 0.6); }
      }
      grime(tp, 0.7);
      windowGrid(tp, R, { cols: 3, rows: 3, wf: 0.45, hf: 0.55, glass: [0.1, 0.12, 0.14], frame: [0.82, 0.8, 0.74] });
      streaks(tp, [0.12, 0.1, 0.08], 0.3);
    },
  },
  facade_glass: {
    size: [64, 60],
    paint(tp, R) {
      tp.base([0.16, 0.22, 0.28]);
      tp.linear(0, 0, S, S, [[0, [0.12, 0.17, 0.24]], [0.45, [0.42, 0.5, 0.58]], [0.55, [0.24, 0.3, 0.38]], [1, [0.1, 0.14, 0.2]]]);
      tp.tn('large', 1, 'soft-light', 0.6);
      panelSeams(tp, 4, 5, [0.07, 0.08, 0.09], 0.9, 2.5);
      for (let i = 0; i < 20; i++) if (R.chance(0.5)) tp.rectPath(R.int(0, 3) * 64 + 2, R.int(0, 4) * 51.2 + 2, 60, 47).fill([0.6, 0.7, 0.8], R.range(0.03, 0.12));
    },
  },
  facade_glass_night: {
    size: [64, 60], em: 1.2,
    paint(tp, R) {
      tp.base([0.04, 0.05, 0.07]);
      for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) if (R.chance(0.3)) tp.rectPath(i * 64 + 2, j * 51.2 + 2, 60, 47).fill(shade([0.9, 0.85, 0.7], R.range(0.4, 0.9)), 0.7);
      panelSeams(tp, 4, 5, [0.01, 0.01, 0.02], 0.9, 2.5);
    },
  },
  facade_concrete: {
    size: [110, 90],
    paint(tp, R) {
      tp.base([0.58, 0.57, 0.53]); grime(tp, 0.9);
      panelSeams(tp, 3, 3, [0.15, 0.15, 0.15], 0.4, 1.2);
      windowGrid(tp, R, { cols: 3, rows: 3, wf: 0.4, hf: 0.3, glass: [0.12, 0.14, 0.16], frame: [0.3, 0.3, 0.3], blinds: 0 });
      streaks(tp, [0.18, 0.17, 0.15], 0.4);
    },
  },
  facade_burnt: {
    size: [96, 76],
    paint(tp, R) {
      tp.base([0.3, 0.29, 0.27]); grime(tp, 1);
      windowGrid(tp, R, { cols: 4, rows: 4, wf: 0.72, hf: 0.58, glass: [0.03, 0.03, 0.03], frame: [0.12, 0.11, 0.1], broken: 0.6, blinds: 0 });
      // Soot plumes above window openings.
      tp.patch('fine_50', S / 2, [0.04, 0.035, 0.03], 0.75, { sy: 2 });
      tp.tp('fbm_60', 1, [0.05, 0.04, 0.04], 0.6);
    },
  },
  facade_industrial: {
    size: [80, 80],
    paint(tp) {
      corrugated(tp, [0.42, 0.44, 0.44], 28);
      tp.tn('fbm', 1, 'soft-light', 0.5);
      rustPatches(tp, 0.6);
      tp.rectPath(-1, 0, S + 2, 18).fill([0.25, 0.25, 0.24], 0.9);
      streaks(tp, [0.2, 0.12, 0.06], 0.3);
    },
  },

  // --------------------------------------------------------- concrete
  concrete: {
    size: [80, 80],
    paint(tp, R) {
      tp.base([0.6, 0.59, 0.56]); grime(tp, 0.8);
      tp.tp('fbm_60', 1, [0.42, 0.41, 0.39], 0.35);
      tp.tn('grain', 2, 'overlay', 0.35);
      for (let i = 0; i < 3; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 45, 0.7, [0.1, 0.1, 0.1], 0.5)); }
      tp.line([-2, S / 2, S + 2, S / 2], 1.5, [0.2, 0.2, 0.2], 0.3); // form-work joint
    },
  },
  concrete_dark: {
    size: [80, 80],
    paint(tp, R) {
      tp.base([0.34, 0.33, 0.31]); grime(tp, 1);
      tp.tp('fbm_50', 1, [0.18, 0.17, 0.16], 0.45);
      streaks(tp, [0.1, 0.09, 0.08], 0.4);
      for (let i = 0; i < 3; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 45, 0.8, [0.05, 0.05, 0.05], 0.6)); }
    },
  },
  concrete_scorched: {
    size: [80, 80],
    paint(tp) {
      tp.base([0.4, 0.38, 0.36]); grime(tp, 1);
      tp.tp('fbm_50', 1, [0.05, 0.045, 0.04], 0.8);
      tp.tp('fine_60', 2, [0.02, 0.02, 0.02], 0.5);
    },
  },
  asphalt_tile: {
    size: [60, 60],
    paint(tp) {
      tp.base([0.2, 0.2, 0.21]);
      tp.tn('grain', 2, 'overlay', 0.7); tp.tn('grain', 1, 'soft-light', 0.4);
      tp.tn('fbm', 1, 'soft-light', 0.5);
    },
  },
  rebar: {
    size: [40, 40], cut: true,
    paint(tp, R) {
      for (let i = 0; i < 8; i++) tp.line([i * 32 + 6, -4, i * 32 + 6 + R.range(-8, 8), S + 4], 3, [0.3, 0.17, 0.09], 1);
      for (let j = 0; j < 8; j++) tp.line([-4, j * 32 + 10, S + 4, j * 32 + 10 + R.range(-6, 6)], 2.4, [0.33, 0.19, 0.1], 1);
    },
  },

  // ------------------------------------------------------------ metal
  steel_painted: {
    size: [60, 60],
    paint(tp) {
      tp.base([0.36, 0.4, 0.42]); grime(tp, 0.6);
      panelSeams(tp, 2, 2, [0.05, 0.06, 0.07], 0.5, 1.4);
      rivets(tp, 8, 8, [0.22, 0.24, 0.26], 1);
      rustPatches(tp, 0.35);
    },
  },
  steel_yellow: {
    size: [60, 60],
    paint(tp) {
      tp.base([0.78, 0.6, 0.12]); grime(tp, 0.8);
      panelSeams(tp, 2, 2, [0.15, 0.1, 0.02], 0.5, 1.4);
      rustPatches(tp, 0.5);
    },
  },
  rust: {
    size: [60, 60],
    paint(tp) {
      tp.base([0.36, 0.2, 0.11]);
      tp.tn('grain', 2, 'overlay', 0.8);
      tp.tn('fbm', 1, 'soft-light', 0.7);
      tp.tp('fbm_50', 1, [0.2, 0.09, 0.04], 0.6);
      tp.tp('fine_70', 2, [0.55, 0.3, 0.14], 0.4);
    },
  },
  metal_dark: {
    size: [50, 50],
    paint(tp) {
      tp.base([0.18, 0.19, 0.2]); grime(tp, 0.7);
      panelSeams(tp, 2, 4, [0, 0, 0], 0.5, 1.2);
      rivets(tp, 4, 8, [0.3, 0.31, 0.32], 1.1);
    },
  },
  grating: {
    size: [24, 24], cut: true,
    paint(tp) {
      for (let i = 0; i < 16; i++) {
        tp.rectPath(i * 16, -1, 3, S + 2).fill([0.3, 0.31, 0.3]);
        tp.rectPath(-1, i * 16, S + 2, 2).fill([0.24, 0.24, 0.24]);
      }
    },
  },
  lattice_grey: {
    size: [16, 16], cut: true,
    paint(tp) {
      const c = [0.72, 0.73, 0.74];
      tp.rectPath(0, 0, 22, S).fill(c); tp.rectPath(S - 22, 0, 22, S).fill(c);
      tp.line([11, 0, S - 11, S], 10, c); tp.line([11, S, S - 11, 0], 10, c);
      tp.rectPath(0, 0, S, 18).fill(c);
      tp.tn('fbm', 1, 'multiply', 0.25);
    },
  },
  lattice: {
    size: [30, 30], cut: true,
    paint(tp) {
      const c = [0.78, 0.58, 0.14];
      tp.rectPath(0, 0, 18, S).fill(c); tp.rectPath(S - 18, 0, 18, S).fill(c);
      tp.line([9, 0, S - 9, S], 12, c); tp.line([9, S, S - 9, 0], 12, c);
      tp.rectPath(0, 0, S, 14).fill(c);
      tp.tn('fbm', 1, 'multiply', 0.4);
    },
  },

  // ------------------------------------------------------- containers
  ...Object.fromEntries([
    ['container_red', [0.55, 0.13, 0.08]], ['container_blue', [0.1, 0.27, 0.48]], ['container_green', [0.17, 0.36, 0.22]],
    ['container_orange', [0.78, 0.38, 0.1]], ['container_grey', [0.5, 0.52, 0.53]], ['container_teal', [0.08, 0.4, 0.42]],
  ].map(([name, col]) => [name, {
    size: [40, 40],
    paint(tp) {
      corrugated(tp, col, 20);
      tp.tn('fbm', 1, 'soft-light', 0.55);
      rustPatches(tp, 0.55);
      tp.rectPath(-1, -1, S + 2, 10).fill(shade(col, 0.5), 0.8);
      tp.rectPath(-1, S - 9, S + 2, 10).fill(shade(col, 0.5), 0.8);
    },
  }])),

  // ------------------------------------------------------- natural
  rock: {
    size: [120, 120],
    paint(tp) {
      tp.base([0.4, 0.38, 0.35]);
      tp.tn('ridged', 1, 'overlay', 0.7);
      tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tn('grain', 2, 'overlay', 0.4);
      tp.tp('ridged_70', 1, [0.15, 0.14, 0.13], 0.5);
      tp.tp('fbm_70', 2, [0.62, 0.6, 0.56], 0.25);
    },
  },
  rock_dark: {
    size: [120, 120],
    paint(tp) {
      tp.base([0.2, 0.19, 0.19]);
      tp.tn('ridged', 1, 'overlay', 0.7);
      tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tn('grain', 2, 'overlay', 0.4);
      tp.tp('ridged_70', 1, [0.07, 0.07, 0.07], 0.6);
    },
  },
  rock_sand: {
    size: [140, 110],
    paint(tp) {
      tp.base([0.66, 0.5, 0.34]);
      for (let j = 0; j < 14; j++) tp.rectPath(-1, j * 18.3, S + 2, 4 + (j % 3) * 2).fill([0.45, 0.31, 0.2], 0.35); // strata
      tp.tn('ridged', 1, 'overlay', 0.55);
      tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tn('grain', 2, 'overlay', 0.35);
    },
  },
  snow: {
    size: [100, 100],
    paint(tp) {
      tp.base([0.86, 0.9, 0.95]);
      tp.tn('fbm', 1, 'multiply', 0.12);
      tp.tn('large', 1, 'soft-light', 0.4);
      tp.tp('fbm_60', 1, [0.68, 0.75, 0.86], 0.35);
      tp.tn('grain', 2, 'soft-light', 0.3);
    },
  },
  ice: {
    size: [120, 120],
    paint(tp, R) {
      tp.base([0.62, 0.78, 0.86]);
      tp.tn('large', 1, 'soft-light', 0.6);
      tp.tp('ridged_70', 1, [0.88, 0.95, 1], 0.4);
      for (let i = 0; i < 8; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 70, 0.9, [0.95, 1, 1], 0.6, 2)); }
    },
  },
  dirt: {
    size: [90, 90],
    paint(tp) {
      tp.base([0.36, 0.3, 0.24]);
      tp.tn('grain', 2, 'overlay', 0.6); tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tp('fbm_60', 1, [0.24, 0.2, 0.16], 0.4);
    },
  },
  scorch: {
    size: [80, 80],
    paint(tp) {
      tp.base([0.07, 0.065, 0.06]);
      tp.tn('grain', 2, 'overlay', 0.6); tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tp('fine_70', 2, [0.25, 0.23, 0.21], 0.3);
    },
  },
  sign_green: {
    size: [34, 14],
    paint(tp, R) {
      tp.base([0.05, 0.36, 0.2]);
      tp.tn('fbm', 1, 'soft-light', 0.4);
      tp.rectPath(6, 6, S - 12, S - 12).stroke([0.92, 0.94, 0.9], 5, 0.9);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) if (R.chance(0.8)) tp.rectPath(26 + k * 32 + R.range(-3, 3), 60 + i * 52, R.range(14, 26), 22).fill([0.92, 0.94, 0.9], 0.85);
      tp.tn('grain', 2, 'overlay', 0.25);
    },
  },
  canopy_edge: {
    size: [60, 6],
    paint(tp) { tp.base([0.9, 0.9, 0.88]); tp.rectPath(-1, 90, S + 2, 76).fill([0.75, 0.12, 0.08]); tp.tn('fbm', 1, 'soft-light', 0.3); },
  },
  ...Object.fromEntries([0, 1, 2, 3].map((k) => [`billboard_${k}`, {
    size: [60, 24],
    paint(tp, R) {
      const pal = [[[0.9, 0.82, 0.2], [0.1, 0.12, 0.15]], [[0.12, 0.35, 0.65], [0.95, 0.95, 0.92]], [[0.75, 0.1, 0.12], [0.98, 0.9, 0.75]], [[0.15, 0.45, 0.25], [0.95, 0.85, 0.3]]][k];
      tp.base(pal[0]);
      tp.linear(0, 0, S, S, [[0, [1, 1, 1], 0.15], [1, [0, 0, 0], 0.25]]);
      tp.circlePath(70 + R.range(-20, 20), 128, 64).fill(pal[1], 0.9);
      for (let i = 0; i < 3; i++) tp.rectPath(150, 70 + i * 40, R.range(60, 95), 22).fill(pal[1], 0.9);
      tp.rectPath(0, 0, S, 10).fill([0.2, 0.2, 0.2]); tp.rectPath(0, S - 10, S, 10).fill([0.2, 0.2, 0.2]);
      tp.tp('fbm_60', 1, [0.3, 0.28, 0.25], 0.35); // weathered
    },
  }])),
  tunnel_wall: {
    size: [96, 64],
    paint(tp, R) {
      tp.base([0.52, 0.5, 0.46]); grime(tp, 0.9);
      panelSeams(tp, 4, 3, [0.18, 0.17, 0.15], 0.6, 1.6);
      tp.rectPath(-1, 150, S + 2, 14).fill([0.72, 0.6, 0.2], 0.85);          // safety band
      for (let i = 0; i < 4; i++) tp.rectPath(i * 64 + 26, 150, 12, 14).fill([0.12, 0.12, 0.12], 0.7);
      tp.rectPath(-1, 20, S + 2, 6).fill([0.2, 0.2, 0.2], 0.6);              // cable duct
      streaks(tp, [0.16, 0.15, 0.12], 0.45);
      tp.tp('fbm_60', 1, [0.25, 0.24, 0.22], 0.3);
    },
  },
  lane_green: { size: [7, 7], em: 2.2, paint(tp) { tp.base([0.04, 0.05, 0.05]); tp.line([128, 40, 128, 210], 26, [0.2, 1, 0.45]); tp.line([70, 150, 128, 215, 186, 150], 26, [0.2, 1, 0.45]); } },
  lane_red: { size: [7, 7], em: 2.2, paint(tp) { tp.base([0.05, 0.04, 0.04]); tp.line([60, 60, 196, 196], 28, [1, 0.12, 0.08]); tp.line([60, 196, 196, 60], 28, [1, 0.12, 0.08]); } },
  ...Object.fromEntries([0, 1, 2, 3].map((k) => [`bale_${k}`, {
    size: [16, 10],
    paint(tp, R) {
      tp.base([0.3, 0.27, 0.24]);
      const cols = [[0.55, 0.1, 0.08], [0.12, 0.25, 0.45], [0.7, 0.7, 0.68], [0.15, 0.15, 0.16], [0.6, 0.5, 0.15], [0.2, 0.35, 0.2]];
      for (let i = 0; i < 60; i++) {
        const x = R.range(0, S), y = R.range(0, S), w = R.range(20, 70), h = R.range(6, 18);
        tp.wrap((dx, dy) => tp.rectPath(x + dx, y + dy, w, h).fill(cols[(i + k) % cols.length], R.range(0.5, 0.9)));
      }
      for (let j = 0; j < 12; j++) tp.line([-2, j * 21.3, S + 2, j * 21.3 + R.range(-4, 4)], 2, [0.05, 0.05, 0.05], 0.6);
      rustPatches(tp, 0.8);
      tp.tn('grain', 2, 'overlay', 0.5);
    },
  }])),
  furnace_mouth: {
    size: [70, 50], em: 1.8,
    paint(tp) {
      tp.base([0.2, 0.19, 0.18]); grime(tp, 0.8);
      const g = tp.ctx.createLinearGradient(0, 30, 0, 170);
      g.addColorStop(0, 'rgb(255,250,200)'); g.addColorStop(0.5, 'rgb(255,150,40)'); g.addColorStop(1, 'rgb(150,40,5)');
      tp.ctx.fillStyle = g; tp.ctx.fillRect(40, 30, 176, 140);
      tp.rectPath(36, 26, 184, 148).stroke([0.08, 0.07, 0.06], 8, 1);
      tp.rectPath(-1, 200, S + 2, 30).fill([0.12, 0.11, 0.1]);
    },
  },
  molten_top: {
    size: [30, 30], em: 2.4,
    paint(tp) {
      tp.base([1, 0.45, 0.08]);
      tp.tn('fbm', 1, 'multiply', 0.55);
      tp.tp('ridged_70', 1, [0.25, 0.08, 0.03], 0.75);
      tp.tp('fine_70', 2, [1, 0.9, 0.55], 0.5);
    },
  },
  hesco: {
    size: [20, 20],
    paint(tp) {
      tp.base([0.55, 0.48, 0.36]);
      tp.tn('fbm', 1, 'soft-light', 0.5); tp.tn('grain', 2, 'overlay', 0.5);
      for (let i = 0; i <= 8; i++) { tp.line([i * 32, -2, i * 32, S + 2], 1.6, [0.3, 0.3, 0.28], 0.8); tp.line([-2, i * 32, S + 2, i * 32], 1.6, [0.3, 0.3, 0.28], 0.8); }
      tp.rectPath(-1, -1, S + 2, 12).fill([0.38, 0.36, 0.3]);
    },
  },
  ...Object.fromEntries([['hull_grey', [0.42, 0.45, 0.48]], ['hull_red', [0.48, 0.12, 0.08]], ['hull_black', [0.12, 0.12, 0.13]], ['hull_blue', [0.12, 0.24, 0.4]]].map(([n, col]) => [n, {
    size: [80, 12],
    paint(tp) {
      tp.base(col); grime(tp, 0.7);
      tp.rectPath(-1, 0, S + 2, 70).fill([0.35, 0.1, 0.07], 0.95);            // antifouling below the waterline
      tp.rectPath(-1, 68, S + 2, 6).fill([0.9, 0.9, 0.86], 0.6);              // boot-top line
      for (let i = 0; i < 8; i++) tp.line([i * 32, 74, i * 32, S], 1, [0, 0, 0], 0.25); // plate seams
      streaks(tp, [0.3, 0.16, 0.08], 0.45);                                    // rust runs
    },
  }])),
  ...Object.fromEntries([['deck_grey', [0.36, 0.38, 0.4]], ['deck_rust', [0.4, 0.3, 0.24]], ['deck_red', [0.45, 0.16, 0.12]]].map(([n, col]) => [n, {
    size: [40, 40],
    paint(tp) {
      tp.base(col); grime(tp, 0.8);
      panelSeams(tp, 4, 4, [0, 0, 0], 0.3, 1);
      tp.tp('fbm_60', 1, [0.28, 0.14, 0.07], 0.35);
      tp.rectPath(120, -1, 16, S + 2).fill([0.85, 0.85, 0.8], 0.25);         // walkway paint
    },
  }])),
  superstructure: {
    size: [40, 24],
    paint(tp, R) {
      tp.base([0.66, 0.68, 0.7]); grime(tp, 0.6);
      for (let i = 0; i < 6; i++) tp.rectPath(14 + i * 40, 120, 18, 26).fill([0.1, 0.13, 0.16], 0.9);   // portholes / windows
      tp.rectPath(-1, 40, S + 2, 4).fill([0.3, 0.3, 0.3], 0.5);
      streaks(tp, [0.3, 0.2, 0.12], 0.35);
    },
  },
  reactor_core: {
    size: [40, 40], em: 2.6,
    paint(tp) {
      tp.base([1, 0.55, 0.25]);
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) tp.circlePath(i * 28.4 + 14, j * 28.4 + 14, 9).fill([1, 0.9, 0.6]);
      tp.tn('fbm', 1, 'multiply', 0.45);
    },
  },
  control_panel: {
    size: [30, 20], em: 0.9,
    paint(tp, R) {
      tp.base([0.22, 0.24, 0.26]); grime(tp, 0.5);
      for (let i = 0; i < 40; i++) tp.rectPath(R.range(10, 240), R.range(60, 230), R.range(4, 12), R.range(3, 8)).fill(R.pick([[1, 0.15, 0.1], [0.2, 1, 0.3], [1, 0.75, 0.1], [0.4, 0.7, 1]]), 0.9);
      tp.rectPath(20, 20, 216, 30).fill([0.05, 0.07, 0.08]);
    },
  },
  cooling_tower: {
    size: [120, 120],
    paint(tp) {
      tp.base([0.66, 0.65, 0.62]); grime(tp, 0.8);
      tp.patch('fine_60', S / 2, [0.42, 0.41, 0.4], 0.5, { sy: 2 });
      for (let j = 0; j < 8; j++) tp.line([-2, j * 32, S + 2, j * 32], 1, [0.3, 0.3, 0.3], 0.3);
    },
  },
  containment: {
    size: [100, 80],
    paint(tp) {
      tp.base([0.8, 0.8, 0.78]); grime(tp, 0.5);
      for (let j = 0; j < 6; j++) tp.line([-2, j * 42.7, S + 2, j * 42.7], 1.2, [0.4, 0.4, 0.4], 0.4);
      for (let i = 0; i < 8; i++) tp.line([i * 32, -2, i * 32, S + 2], 1, [0.45, 0.45, 0.45], 0.25);
    },
  },
  stack_stripes: {
    size: [40, 80],
    paint(tp) {
      for (let j = 0; j < 8; j++) tp.rectPath(-1, j * 32, S + 2, 32).fill(j % 2 ? [0.85, 0.85, 0.82] : [0.7, 0.12, 0.08]);
      grime(tp, 0.7);
    },
  },
  station_hull: {
    size: [30, 30],
    paint(tp) {
      tp.base([0.82, 0.83, 0.84]); grime(tp, 0.35);
      panelSeams(tp, 4, 2, [0.35, 0.35, 0.36], 0.6, 1.4);
      for (let i = 0; i < 4; i++) tp.rectPath(i * 64 + 8, 20, 22, 216).fill([0.92, 0.9, 0.82], 0.5);       // MLI blanket patches
      rivets(tp, 8, 4, [0.55, 0.55, 0.56], 1.2);
    },
  },
  solar_panel: {
    size: [24, 24],
    paint(tp) {
      tp.base([0.06, 0.1, 0.22]);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) tp.rectPath(i * 32 + 1.5, j * 32 + 1.5, 29, 29).fill([0.1, 0.17, 0.35]);
      tp.linear(0, 0, S, S, [[0, [0.5, 0.6, 0.9], 0.25], [0.5, [0.2, 0.3, 0.6], 0], [1, [0.4, 0.5, 0.8], 0.2]]);
      panelSeams(tp, 2, 2, [0.75, 0.75, 0.78], 0.9, 3);
    },
  },
  foil_gold: {
    size: [20, 20],
    paint(tp) {
      tp.base([0.75, 0.58, 0.22]);
      tp.tn('fbm', 1, 'overlay', 0.7); tp.tn('fine', 2, 'overlay', 0.6);
      tp.tp('fine_70', 2, [1, 0.88, 0.55], 0.5);
    },
  },
  alien_hull: {
    size: [60, 60], em: 0.6,
    paint(tp, R) {
      tp.base([0.08, 0.1, 0.1]);
      tp.tn('ridged', 1, 'overlay', 0.7);
      tp.tp('ridged_70', 1, [0.2, 0.26, 0.24], 0.6);
      for (let i = 0; i < 10; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 80, 1.4, [0.25, 1, 0.45], 0.8, 2)); }
      tp.tn('fbm', 1, 'soft-light', 0.5);
    },
  },
  tether: { size: [30, 30], paint(tp) { tp.base([0.55, 0.56, 0.6]); for (let j = 0; j < 8; j++) tp.rectPath(-1, j * 32, S + 2, 6).fill([0.25, 0.25, 0.28]); grime(tp, 0.4); } },
  vent_rock: {
    size: [40, 40],
    paint(tp) {
      tp.base([0.12, 0.11, 0.11]);
      tp.tn('ridged', 1, 'overlay', 0.7); tp.tn('grain', 2, 'overlay', 0.5);
      tp.tp('fbm_60', 1, [0.35, 0.28, 0.2], 0.45);          // mineral crust
      tp.tp('fine_70', 2, [0.75, 0.68, 0.45], 0.3);
    },
  },
  ...Object.fromEntries([['car_red', [0.6, 0.1, 0.08]], ['car_white', [0.85, 0.86, 0.85]], ['car_black', [0.1, 0.1, 0.11]], ['car_blue', [0.12, 0.22, 0.42]], ['car_silver', [0.6, 0.62, 0.64]], ['car_taxi', [0.92, 0.75, 0.1]]].map(([n, col]) => [n, {
    size: [11, 26],
    paint(tp) {
      tp.base(col);
      tp.rectPath(30, 150, 196, 56).fill([0.1, 0.14, 0.2]);                  // windscreen
      tp.rectPath(36, 60, 184, 34).fill([0.1, 0.14, 0.2]);                   // rear window
      tp.rectPath(40, 94, 176, 56).fill(shade(col, 1.12));                  // roof
      tp.linear(0, 0, S, 0, [[0, [0, 0, 0], 0.35], [0.3, [1, 1, 1], 0.12], [1, [0, 0, 0], 0.35]]);
      tp.rectPath(20, 236, 50, 12).fill([1, 0.95, 0.8]); tp.rectPath(186, 236, 50, 12).fill([1, 0.95, 0.8]);
      tp.rectPath(20, 6, 50, 10).fill([0.7, 0.05, 0.05]); tp.rectPath(186, 6, 50, 10).fill([0.7, 0.05, 0.05]);
    },
  }])),
  helipad: {
    size: [70, 70],
    paint(tp) {
      tp.base([0.3, 0.32, 0.33]); grime(tp, 0.5);
      tp.circlePath(128, 128, 110).stroke([0.9, 0.85, 0.2], 10, 0.9);
      tp.rectPath(78, 68, 22, 120).fill([0.92, 0.92, 0.9]); tp.rectPath(156, 68, 22, 120).fill([0.92, 0.92, 0.9]); tp.rectPath(78, 117, 100, 22).fill([0.92, 0.92, 0.9]);
      tp.rectPath(0, 0, S, 8).fill([0.85, 0.85, 0.82]); tp.rectPath(0, S - 8, S, 8).fill([0.85, 0.85, 0.82]);
    },
  },
  plaza_paving: {
    size: [40, 40],
    paint(tp) {
      tp.base([0.62, 0.6, 0.56]); grime(tp, 0.6);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) tp.rectPath(i * 32 + 1, j * 32 + 1, 30, 30).fill(shade([0.62, 0.6, 0.56], (i + j) % 2 ? 0.92 : 1.05), 0.8);
    },
  },
  roof_garden: {
    size: [60, 60],
    paint(tp, R) {
      tp.base([0.24, 0.32, 0.16]); tp.tn('fbm', 1, 'soft-light', 0.6);
      for (let i = 0; i < 30; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.radial(x + dx, y + dy, R.range(10, 22), [[0, [0.3, 0.42, 0.18], 0.9], [1, [0.2, 0.28, 0.12], 0]])); }
      tp.rectPath(0, 120, S, 16).fill([0.6, 0.58, 0.52]);
    },
  },
  alien_crystal: {
    size: [30, 60], em: 0.7,
    paint(tp, R) {
      tp.linear(0, 0, S, S, [[0, [0.35, 0.2, 0.55]], [0.5, [0.75, 0.6, 0.95]], [1, [0.25, 0.5, 0.6]]]);
      for (let i = 0; i < 14; i++) { const x = R.range(0, S); tp.wrap((dx) => tp.line([x + dx, -2, x + dx + R.range(-30, 30), S + 2], R.range(1, 3), [0.95, 0.9, 1], 0.5)); }
      tp.tn('fbm', 1, 'soft-light', 0.5);
    },
  },
  server_rack: {
    size: [8, 24], em: 1.1,
    paint(tp, R) {
      tp.base([0.06, 0.065, 0.07]);
      for (let j = 0; j < 16; j++) {
        tp.rectPath(8, j * 16 + 2, 240, 12).fill([0.13, 0.14, 0.15]);
        for (let i = 0; i < 10; i++) if (R.chance(0.55)) tp.rectPath(14 + i * 22, j * 16 + 6, 3, 3).fill(R.pick([[0.2, 1, 0.35], [0.2, 1, 0.35], [0.3, 0.7, 1], [1, 0.6, 0.1], [1, 0.15, 0.1]]));
      }
      tp.rectPath(0, 0, 8, S).fill([0.2, 0.2, 0.22]); tp.rectPath(S - 8, 0, 8, S).fill([0.2, 0.2, 0.22]);
    },
  },
  rack_top: {
    size: [10, 10],
    paint(tp) {
      tp.base([0.16, 0.17, 0.18]);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) tp.circlePath(i * 16 + 8, j * 16 + 8, 3).fill([0.05, 0.05, 0.06]);
      panelSeams(tp, 1, 2, [0.3, 0.3, 0.32], 0.8, 3);
    },
  },
  asteroid: {
    size: [90, 90],
    paint(tp, R) {
      tp.base([0.3, 0.27, 0.24]);
      tp.tn('ridged', 1, 'overlay', 0.7); tp.tn('fbm', 1, 'soft-light', 0.6); tp.tn('grain', 2, 'overlay', 0.5);
      for (let i = 0; i < 10; i++) { const x = R.range(0, S), y = R.range(0, S), r = R.range(6, 24); tp.wrap((dx, dy) => { tp.circlePath(x + dx, y + dy, r).fill([0.12, 0.11, 0.1], 0.6); tp.circlePath(x + dx - r * 0.2, y + dy + r * 0.2, r * 0.85).stroke([0.5, 0.46, 0.42], 1.5, 0.5); }); }
    },
  },
  stone_algae: {
    size: [70, 70],
    paint(tp) {
      tp.base([0.38, 0.4, 0.36]); grime(tp, 1);
      tp.tp('fbm_50', 1, [0.18, 0.3, 0.22], 0.6, { detail: ['grain', 128, 0.6] });
      tp.tp('fine_60', 2, [0.32, 0.42, 0.28], 0.5);
      for (let j = 0; j < 8; j++) tp.line([-2, j * 32, S + 2, j * 32], 1.5, [0.1, 0.12, 0.1], 0.5);
    },
  },
  facade_drowned: {
    size: [96, 76],
    paint(tp, R) {
      tp.base([0.3, 0.34, 0.32]); grime(tp, 1);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) tp.rectPath(i * 64 + 10, j * 64 + 18, 44, 34).fill([0.02, 0.04, 0.05]);
      tp.tp('fbm_50', 1, [0.16, 0.28, 0.2], 0.65);
      tp.patch('fine_60', S / 2, [0.12, 0.2, 0.16], 0.5, { sy: 2 });
    },
  },
  marble: {
    size: [60, 60],
    paint(tp, R) {
      tp.base([0.78, 0.76, 0.72]);
      for (let i = 0; i < 6; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 120, 1.2, [0.45, 0.42, 0.4], 0.45, 2)); }
      tp.tn('fbm', 1, 'soft-light', 0.4);
      panelSeams(tp, 2, 2, [0.4, 0.38, 0.36], 0.5, 1.4);
    },
  },
  stained_glass: {
    size: [30, 30], em: 1.3,
    paint(tp, R) {
      tp.base([0.05, 0.05, 0.06]);
      for (let i = 0; i < 40; i++) {
        const x = R.range(0, S), y = R.range(0, S), r = R.range(12, 30), col = R.pick([[0.8, 0.15, 0.15], [0.15, 0.35, 0.85], [0.9, 0.7, 0.2], [0.2, 0.6, 0.35], [0.6, 0.25, 0.7]]);
        tp.wrap((dx, dy) => tp.poly([x + dx, y + dy - r, x + dx + r * 0.9, y + dy, x + dx, y + dy + r, x + dx - r * 0.9, y + dy]).fill(col, 0.9));
      }
      for (let i = 0; i < 9; i++) { tp.line([i * 32, -2, i * 32 + 10, S + 2], 3, [0.03, 0.03, 0.03], 1); tp.line([-2, i * 32, S + 2, i * 32 + 8], 3, [0.03, 0.03, 0.03], 1); }
    },
  },
  bone: {
    size: [30, 60],
    paint(tp) {
      tp.base([0.8, 0.74, 0.62]); grime(tp, 0.7);
      tp.patch('fine_60', S / 2, [0.55, 0.45, 0.35], 0.45, { sy: 2 });
      tp.tp('fbm_70', 1, [0.92, 0.88, 0.8], 0.35);
    },
  },
  flesh_wall: {
    size: [80, 80], em: 0.15,
    paint(tp, R) {
      tp.base([0.42, 0.1, 0.12]);
      tp.tn('fbm', 1, 'soft-light', 0.7); tp.tn('ridged', 1, 'overlay', 0.45);
      for (let i = 0; i < 12; i++) { const x = R.range(0, S), y = R.range(0, S); tp.wrap((dx, dy) => tp.crack(R, x + dx, y + dy, R.angle(), 90, 2.2, [0.55, 0.05, 0.12], 0.8, 3)); }
      tp.tp('fine_70', 2, [0.85, 0.55, 0.5], 0.3);
    },
  },
  flesh_vessel: {
    size: [20, 40], em: 0.4,
    paint(tp) {
      tp.base([0.5, 0.06, 0.12]);
      tp.patch('fine_60', S / 2, [0.75, 0.15, 0.2], 0.6, { sy: 2 });
      tp.linear(0, 0, S, 0, [[0, [0, 0, 0], 0.45], [0.5, [1, 0.6, 0.6], 0.2], [1, [0, 0, 0], 0.45]]);
    },
  },
  sandstone: {
    size: [80, 60],
    paint(tp) {
      tp.base([0.66, 0.56, 0.4]); grime(tp, 0.8);
      for (let j = 0; j < 8; j++) { tp.line([-2, j * 32, S + 2, j * 32], 1.6, [0.4, 0.33, 0.24], 0.7); for (let i = 0; i < 4; i++) tp.line([i * 64 + (j % 2) * 32, j * 32, i * 64 + (j % 2) * 32, j * 32 + 32], 1.2, [0.4, 0.33, 0.24], 0.6); }
      tp.tp('fbm_60', 1, [0.45, 0.38, 0.28], 0.35);
    },
  },
  timber: {
    size: [20, 60],
    paint(tp) {
      tp.base([0.36, 0.25, 0.15]);
      tp.patch('fine_60', S / 2, [0.24, 0.16, 0.1], 0.7, { sy: 2 });
      tp.tn('grain', 2, 'overlay', 0.4);
      for (let i = 0; i < 4; i++) tp.line([i * 64 + 30, -2, i * 64 + 34, S + 2], 1.5, [0.15, 0.1, 0.06], 0.6);
    },
  },
  train_side: {
    size: [62, 22],
    paint(tp) {
      tp.base([0.7, 0.72, 0.74]); grime(tp, 0.7);
      tp.rectPath(-1, 100, S + 2, 14).fill([0.15, 0.35, 0.6]);
      for (let i = 0; i < 6; i++) tp.rectPath(i * 42 + 8, 130, 30, 60).fill([0.1, 0.13, 0.16]);
      tp.rectPath(118, 20, 20, 170).fill([0.3, 0.32, 0.34]);
    },
  },
  train_roof: {
    size: [18, 62],
    paint(tp) { tp.base([0.5, 0.52, 0.54]); grime(tp, 0.9); for (let j = 0; j < 4; j++) tp.rectPath(80, j * 64 + 20, 96, 24).fill([0.3, 0.31, 0.33]); },
  },
  tarp_canvas: {
    size: [50, 50],
    paint(tp) {
      tp.base([0.32, 0.34, 0.24]);
      tp.tn('fbm', 1, 'soft-light', 0.6);
      tp.tn('grain', 2, 'overlay', 0.4);
      for (let i = 0; i < 4; i++) tp.line([i * 64 + 32, -2, i * 64 + 32, S + 2], 2, [0, 0, 0], 0.25);
    },
  },
};

/** Stable material order → array layer index. */
export const MATERIAL_NAMES = Object.keys(MATERIALS);
export const MATERIAL_INDEX = Object.fromEntries(MATERIAL_NAMES.map((n, i) => [n, i]));

/** Paint one material tile (returns its canvas). Deterministic per name. */
export function paintMaterial(name) {
  const m = MATERIALS[name];
  if (!m) throw new Error(`unknown material "${name}"`);
  const tp = new TilePainter(S);
  m.paint(tp, new RNG(`mat:${name}`));
  return tp.canvas;
}

export const materialInfo = (name) => MATERIALS[name] || null;
export { hex, mix, css };
