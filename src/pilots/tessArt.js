import { createMechaArt } from './art/mechaArt.js';
import { createMechaFx } from './art/mechaFx.js';

// TESS ART TEST: the hand-made Wireghost mecha (src/pilot concept art/Tess
// Kuro, ASSET_NOTES.md), built on the shared mecha-art module. The sprite
// flies feet-first; the leg blades (feet) never fire. Wire-blade crescents
// leave the two forearm blades.

// Owner's choice for every effect: violet outside, a scarlet band, orange inside (white-hot centre).
export const PAL = {
  core: [2.6, 1.9, 1.1],
  hot: [2.2, 0.95, 0.25],
  rim: [2.0, 0.05, 0.08],
  mid: [1.15, 0.35, 1.9],
  edge: [0.55, 0.12, 1.1],
};

export const tessArt = createMechaArt({
  id: 'tess',
  pal: PAL,
  // Built-in copy of tess.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 266, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [133.1, 224.5], head: [133.1, 254.8],
      bladeL: [39.1, 160.6], bladeR: [227.1, 160.6],
      ventL: [75.7, 292.7], ventR: [190.4, 292.7],
      packL: [125, 288.9], packR: [141.2, 288.9],
    },
  },
  flames: [
    // Wide plumes from the rear of the shoulder armour, smaller ones beside the head's rear spike.
    { name: 'ventL', len: 26, wid: 17, hot: 0.3, i: 4 },
    { name: 'ventR', len: 26, wid: 17, hot: 0.3, i: 5 },
    { name: 'packL', len: 15, wid: 7, hot: 0.45, i: 6 },
    { name: 'packR', len: 15, wid: 7, hot: 0.45, i: 7 },
  ],
  nozzles: ['packL', 'packR'],
  exhaust: ['ventL', 'ventR', 'packL', 'packR'],
  wingAnchors: ['blade', 'vent'],
  size: 90,
});

// Shared muzzle flare + hit sparks in Tess's palette (shots and slashes are drawn by tessFx.js).
export const tessMechaFx = createMechaFx(tessArt, { body: [1.9, 0.75, 0.1] });
