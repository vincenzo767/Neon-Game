import { shade, mix } from './core.js';

// Terrain surface painters. Each paints a material over a region (o.path, a
// path function, or the whole chunk) using colour fills + world-anchored
// noise layers, so neighbouring chunks continue seamlessly.
//
// Scales are world units per noise tile: the grain layer is sized so one
// noise texel ≈ one texture pixel (128 / ppu) — finer detail comes from the
// GPU detail texture.

const g = (p) => 128 / p.ppu; // grain scale for 1:1 speckle

function within(p, o, fn) {
  if (o.path) p.clip(o.path, fn); else fn(p);
}

export function asphalt(p, o = {}) {
  const base = o.color || [0.2, 0.2, 0.205];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1400, 'soft-light', 0.55);
    p.noise('fbm', 300, 'soft-light', 0.45);
    p.noise('grain', g(p), 'overlay', 0.5);
    p.noise('grain', g(p) * 2.3, 'soft-light', 0.35, { ox: 31, oy: 17 });
    p.patch('fbm_60', 420, shade(base, 0.55), 0.35);                 // tar-rich dark patches
    p.patch('fine_70', 90, shade(base, 1.45), 0.18 * (o.wear ?? 1)); // bleached worn spots
    if (o.dust) p.patch('large_50', 900, o.dust, o.dustAlpha ?? 0.35, { detail: ['fine', 60, 0.5] });
  });
}

export function concrete(p, o = {}) {
  const base = o.color || [0.55, 0.54, 0.51];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1200, 'soft-light', 0.5);
    p.noise('fbm', 260, 'soft-light', 0.4);
    p.noise('grain', g(p), 'overlay', 0.3);
    p.patch('fbm_60', 360, shade(base, 0.7), 0.3);
    p.patch('fine_70', 70, shade(base, 0.8), 0.2);
    if (o.joints) {
      const [jx, jy] = o.joints, { x0, x1, y0, y1 } = p.rect;
      for (let x = Math.floor(x0 / jx) * jx; x <= x1; x += jx) p.line([x, y0 - 4, x, y1 + 4], 0.6, shade(base, 0.45), 0.6);
      for (let y = Math.floor(y0 / jy) * jy; y <= y1; y += jy) p.line([x0 - 4, y, x1 + 4, y], 0.6, shade(base, 0.45), 0.6);
    }
  });
}

export function dirt(p, o = {}) {
  const base = o.color || [0.38, 0.31, 0.24];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1500, 'soft-light', 0.6);
    p.noise('fbm', 340, 'soft-light', 0.55);
    p.noise('grain', g(p), 'overlay', 0.55);
    p.patch('fbm_50', 500, shade(base, 0.7), 0.4);
    p.patch('fine_60', 120, shade(base, 1.25), 0.25);
    p.patch('grain_90', g(p), shade(base, 0.55), 0.5); // pebbles
  });
}

export function sand(p, o = {}) {
  const base = o.color || [0.78, 0.62, 0.42];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1800, 'soft-light', 0.55);
    // Wind ripples: stretched streak noise, rotated to the wind.
    p.noise('streak', 160, 'soft-light', 0.55, { rot: o.wind ?? 0.35, sy: 0.35 });
    p.noise('streak', 70, 'overlay', 0.25, { rot: (o.wind ?? 0.35) + 0.05, sy: 0.3, ox: 17 });
    p.noise('grain', g(p), 'overlay', 0.35);
    p.patch('fbm_60', 600, shade(base, 0.82), 0.35);
    p.patch('fbm_70', 300, shade(base, 1.12, [1, 0.95, 0.85], 0.2), 0.3);
  });
}

export function snow(p, o = {}) {
  const base = o.color || [0.84, 0.88, 0.94];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1600, 'soft-light', 0.35);
    p.patch('fbm_50', 520, [0.66, 0.73, 0.86], 0.4);                 // blue hollows
    p.noise('streak', 140, 'soft-light', 0.3, { rot: o.wind ?? -0.4, sy: 0.4 }); // wind sastrugi
    p.patch('fine_70', 80, [1, 1, 1], 0.35);
    p.patch('grain_97', g(p), [1, 1, 1], 0.9);                       // sparkle
    if (o.dirty) p.patch('fbm_70', 300, [0.45, 0.43, 0.42], o.dirty);
  });
}

export function gravel(p, o = {}) {
  const base = o.color || [0.46, 0.44, 0.41];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('grain', g(p), 'overlay', 0.85);
    p.noise('grain', g(p) * 1.7, 'overlay', 0.5, { ox: 11 });
    p.noise('fbm', 300, 'soft-light', 0.5);
    p.patch('fbm_60', 400, shade(base, 0.7), 0.35);
  });
}

export function grass(p, o = {}) {
  const base = o.color || [0.25, 0.32, 0.16];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1400, 'soft-light', 0.6);
    p.noise('fbm', 260, 'soft-light', 0.5);
    p.noise('grain', g(p), 'overlay', 0.5);
    p.patch('fbm_60', 380, shade(base, 1.25, [0.6, 0.55, 0.3], 0.25), 0.4);
    p.patch('fine_70', 90, shade(base, 0.7), 0.3);
    if (o.dry) p.patch('large_50', 900, [0.48, 0.42, 0.25], o.dry);
  });
}

export function rock(p, o = {}) {
  const base = o.color || [0.42, 0.4, 0.37];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('ridged', 520, 'overlay', 0.6);
    p.noise('fbm', 300, 'soft-light', 0.55);
    p.noise('grain', g(p), 'overlay', 0.4);
    p.patch('ridged_70', 520, shade(base, 0.5), 0.45);
    p.patch('fbm_70', 380, shade(base, 1.3), 0.25);
  });
}

/** Burnt battlefield ground: ash-grey soil with scorch, cinders and pale ash drifts. */
export function ash(p, o = {}) {
  const base = o.color || [0.3, 0.29, 0.28];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1400, 'soft-light', 0.6);
    p.noise('fbm', 280, 'soft-light', 0.55);
    p.noise('grain', g(p), 'overlay', 0.6);
    p.patch('fbm_50', 520, [0.08, 0.075, 0.07], 0.5);              // scorched soil
    p.patch('fine_60', 110, [0.62, 0.6, 0.58], 0.3);               // ash drifts
    p.patch('grain_90', g(p), [0.04, 0.04, 0.04], 0.6);            // cinders
  });
}

export function mud(p, o = {}) {
  const base = o.color || [0.24, 0.2, 0.16];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1200, 'soft-light', 0.6);
    p.noise('fbm', 220, 'soft-light', 0.6);
    p.noise('grain', g(p), 'overlay', 0.4);
    p.patch('fbm_70', 260, [0.1, 0.1, 0.11], 0.5);                 // wet pools
    p.patch('fine_70', 70, shade(base, 1.3), 0.25);
  });
}

/** Steel deck plate: plates, weld seams, scuffs and rust bleed. */
export function steelDeck(p, o = {}) {
  const base = o.color || [0.3, 0.31, 0.31];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('fbm', 240, 'soft-light', 0.5);
    p.noise('grain', g(p), 'overlay', 0.35);
    p.patch('fbm_60', 300, [0.32, 0.16, 0.07], 0.35 * (o.rust ?? 1));
    const [jx, jy] = o.plates || [48, 32], { x0, x1, y0, y1 } = p.rect;
    for (let x = Math.floor(x0 / jx) * jx; x <= x1; x += jx) p.line([x, y0 - 4, x, y1 + 4], 0.7, [0.08, 0.08, 0.08], 0.7);
    for (let y = Math.floor(y0 / jy) * jy; y <= y1; y += jy) p.line([x0 - 4, y, x1 + 4, y], 0.7, [0.08, 0.08, 0.08], 0.7);
  });
}

/** Ice sheet: blue-white, pressure ridges, cracks, snow dusting. */
export function ice(p, o = {}) {
  const base = o.color || [0.62, 0.76, 0.86];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1400, 'soft-light', 0.6);
    p.patch('ridged_70', 600, [0.85, 0.93, 1], 0.45);
    p.patch('fbm_60', 400, [0.9, 0.93, 0.97], 0.45);             // snow dust
    p.noise('grain', g(p), 'soft-light', 0.3);
  });
}

/** Ocean / lake bed: sand, silt and scattered stones. */
export function seabed(p, o = {}) {
  const base = o.color || [0.42, 0.4, 0.33];
  within(p, o, () => {
    p.allPath().fill(base);
    p.noise('large', 1500, 'soft-light', 0.6);
    p.noise('streak', 140, 'soft-light', 0.4, { rot: 0.2, sy: 0.4 });
    p.noise('fbm', 260, 'soft-light', 0.5);
    p.noise('grain', g(p), 'overlay', 0.4);
    p.patch('fbm_60', 420, shade(base, 0.6), 0.4);
    p.patch('grain_90', g(p), shade(base, 0.45), 0.6);
  });
}

export { shade, mix };
