import { createMechaArt, SIZES } from './art/mechaArt.js';

// KAIRO ART TEST (KAIRO_ART_TEST.md): the hand-made Stormlance mecha, built on
// the shared mecha-art module (art/mechaArt.js). Everything is visual except
// `anchor()`, which also places Kairo's real shot origins (chest gun + rifles).

// Sampled from FX Sprite Sheet.png: white-hot core → cyan → electric blue → violet edge.
export const PAL = {
  core: [2.2, 2.4, 2.6],
  cyan: [0.45, 1.35, 2.0],
  blue: [0.22, 0.5, 1.7],
  violet: [0.45, 0.25, 1.1],
};

export const kairoArt = createMechaArt({
  id: 'kairo',
  pal: { core: PAL.core, hot: PAL.cyan, mid: PAL.blue, edge: PAL.violet },
  // Built-in copy of kairo.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 228, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [114, 193.5], head: [114, 263.9],
      gunL: [98, 130.4], gunR: [130, 130.4],
      rifleL: [12.3, 48], rifleR: [216.1, 48],
      beam: [114, 125.1],
      packL: [99.6, 314.8], packR: [128.3, 314.8],
      footL: [84.6, 312.4], footR: [143.3, 312.4],
      calfL: [52.6, 308], calfR: [175.3, 308],
    },
  },
  flames: [
    // Wide blue back plumes from under the skirt (kept mostly blue), foot flames,
    // and small flames on the red binder vents (drawn over the art).
    { name: 'packL', len: 24, wid: 16, hot: 0.35, i: 4 },
    { name: 'packR', len: 24, wid: 16, hot: 0.35, i: 5 },
    { name: 'footL', len: 12, wid: 7, i: 0 },
    { name: 'footR', len: 12, wid: 7, i: 1 },
    { name: 'calfL', len: 5, wid: 3.5, cap: 1.6, over: true, i: 2 },
    { name: 'calfR', len: 5, wid: 3.5, cap: 1.6, over: true, i: 3 },
  ],
  nozzles: ['packL', 'packR'],
  exhaust: ['packL', 'packR', 'footL', 'footR'],
  wingAnchors: ['rifle', 'wing'],
  size: 90,
});

export { SIZES };
export const {
  LOOK, anchor, anchorData, unitsPerPx, animatedAnchor, animate, renderMecha, exhaust,
} = kairoArt;
export const kairoFrames = kairoArt.frames;
export const buildKairoSprites = kairoArt.buildSprites;
