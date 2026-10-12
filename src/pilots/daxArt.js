import { createMechaArt } from './art/mechaArt.js';

// DAX ART TEST: the hand-made Overclock void knight (src/pilot concept art/Dax
// Morrow, ASSET_NOTES.md), built on the shared mecha-art module. The sprite
// flies feet-first; the legs (feet) never fire. Every void beam leaves the
// red chest core (owner's choice). 90 units tall.

// Owner's theme: void-cosmic red. Glowing red, black, and white-hot cores.
export const PAL = {
  core: [2.7, 2.2, 2.2],
  hot: [2.6, 0.45, 0.4],
  mid: [1.7, 0.08, 0.1],
  edge: [0.55, 0.02, 0.04],
  dark: [0.03, 0.0, 0.01], // void black (alpha-blended)
};
export const DARK = PAL.dark;

export const daxArt = createMechaArt({
  id: 'dax',
  pal: PAL,
  // Built-in copy of dax.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 303, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [151.5, 215.2], head: [151.5, 240.4], core: [151.5, 215.2], spike: [151.5, 44],
      lensL: [46.1, 138.2], lensR: [256.6, 138.2],
      ventL: [113.8, 314.8], ventR: [189.5, 314.8],
      packL: [140.3, 293.5], packR: [162.9, 293.5],
    },
  },
  flames: [
    // Void plumes: black outside, red, white-hot core; wide from the fin roots, small from the spine.
    { name: 'ventL', len: 34, wid: 8, hot: 0.35, i: 2 },
    { name: 'ventR', len: 34, wid: 8, hot: 0.35, i: 3 },
    { name: 'packL', len: 22, wid: 5, hot: 0.6, i: 4 },
    { name: 'packR', len: 22, wid: 5, hot: 0.6, i: 5 },
  ],
  exhaust: ['ventL', 'ventR'],
  // Pilot-texture extras: the owner's big FX picks (drawn a few times per frame).
  extras: { ghost: 'fxGhost', crescent: 'fxCrescent', ult: 'fxUlt' },
  size: 90,
});
