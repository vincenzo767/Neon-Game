import { createMechaArt } from './art/mechaArt.js';
import { createMechaFx } from './art/mechaFx.js';

// ODUYA ART TEST: the hand-made Thunderjaw mecha (src/pilot concept art/Oduya
// Rex, ASSET_NOTES.md), built on the shared mecha-art module. The sprite flies
// feet-first; the gold drill legs (feet) never fire. All lightning leaves the
// two gold fists. The biggest mecha: 100 units tall.

// Owner's choice for every effect: blue outside, white inside.
export const PAL = {
  core: [2.6, 2.7, 2.8],
  hot: [1.5, 2.0, 2.6],
  mid: [0.35, 0.75, 2.4],
  edge: [0.15, 0.3, 1.4],
};

export const oduyaArt = createMechaArt({
  id: 'oduya',
  pal: PAL,
  // Built-in copy of oduya.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 421, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [210.5, 152.9], head: [210.5, 201.9], crown: [210.5, 58],
      fistL: [99.4, 137.6], fistR: [321.6, 137.6],
      ventL: [122.3, 281.5], ventR: [298.7, 281.5],
      maneL: [201.9, 330.5], maneR: [219.1, 330.5],
    },
  },
  flames: [
    // Wide blue-white plumes from the wing roots, smaller ones from the gold mane.
    { name: 'ventL', len: 30, wid: 22, hot: 0.4, i: 4 },
    { name: 'ventR', len: 30, wid: 22, hot: 0.4, i: 5 },
    { name: 'maneL', len: 18, wid: 9, hot: 0.6, i: 6 },
    { name: 'maneR', len: 18, wid: 9, hot: 0.6, i: 7 },
  ],
  nozzles: ['ventL', 'ventR'],
  exhaust: ['ventL', 'ventR', 'maneL', 'maneR'],
  wingAnchors: ['fist', 'vent'],
  size: 100,
});

// Thunder spears (focus): long white lances in a blue glow, ring pulses (tag 4).
export const oduyaMechaFx = createMechaFx(oduyaArt, {
  body: [1.4, 1.8, 2.3],
  lanceLen: () => 70,
});
