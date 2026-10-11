import { createMechaArt } from './art/mechaArt.js';
import { createMechaFx } from './art/mechaFx.js';

// MIRA ART TEST: the hand-made Halo Sprite mecha (src/pilot concept art/Mira
// Solenne, ASSET_NOTES.md), built on the shared mecha-art module. The sprite
// flies feet-first; the feet never fire. Needles leave from the chest gun,
// the arm guns add the outermost pair from tier 3.

// From fx_reference.png: white-hot core → yellow → amber-gold → orange edge.
export const PAL = {
  core: [2.6, 2.4, 1.9],
  hot: [2.0, 1.5, 0.45],
  mid: [1.6, 0.75, 0.12],
  edge: [1.1, 0.32, 0.1],
};

export const miraArt = createMechaArt({
  id: 'mira',
  pal: PAL,
  // Built-in copy of mira.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 249, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [123.2, 181.3], head: [123.2, 268.7],
      gun: [123.2, 113.3],
      armL: [52.4, 148.5], armR: [194.4, 148.5],
      ventL: [43.9, 359.7], ventR: [204.1, 359.7],
      packL: [116.7, 316], packR: [130, 316],
      footL: [97.3, 301.4], footR: [149.5, 301.4],
    },
  },
  flames: [
    // Wide gold plumes from the ladder-vent fins and the centre exhaust (kept
    // mostly amber), plus foot flames at the gold skirt plates.
    { name: 'ventL', len: 26, wid: 18, hot: 0.35, i: 4 },
    { name: 'ventR', len: 26, wid: 18, hot: 0.35, i: 5 },
    { name: 'packL', len: 18, wid: 11, hot: 0.35, i: 6 },
    { name: 'packR', len: 18, wid: 11, hot: 0.35, i: 7 },
    { name: 'footL', len: 11, wid: 6, i: 0 },
    { name: 'footR', len: 11, wid: 6, i: 1 },
  ],
  nozzles: ['packL', 'packR'],
  exhaust: ['ventL', 'ventR', 'footL', 'footR'],
  wingAnchors: ['arm', 'vent'],
  size: 90,
});

export const miraFx = createMechaFx(miraArt, {
  body: [1.45, 0.95, 0.22], // amber-gold, below the bloom's white clip
  lanceLen: (t) => 20 + 4 * t, // needles: shorter and slower than Kairo's lances
});
