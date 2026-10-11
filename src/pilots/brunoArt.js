import { createMechaArt } from './art/mechaArt.js';

// BRUNO ART TEST: the hand-made Ironhound mecha (src/pilot concept art/Bruno
// Hagen, ASSET_NOTES.md), built on the shared mecha-art module. The sprite
// flies feet-first; the feet never fire. The flak fan leaves the two big
// cannons, the siege shells the two long barrels.

// From fx_reference.png: violet outside, orange inside (white-hot centre).
export const PAL = {
  core: [2.6, 1.9, 1.1],
  hot: [2.2, 0.95, 0.25],
  mid: [1.15, 0.35, 1.9],
  edge: [0.55, 0.12, 1.1],
};

export const brunoArt = createMechaArt({
  id: 'bruno',
  pal: PAL,
  // Built-in copy of bruno.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 255, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [127.5, 229.1], head: [127.5, 266.4],
      cannonL: [20.4, 186.1], cannonR: [234.6, 186.1],
      barrelL: [27.9, 121.5], barrelR: [227.1, 121.5],
      podL: [62.6, 365.3], podR: [192.3, 365.3],
      packL: [103.6, 353.3], packR: [151.3, 353.3],
    },
  },
  flames: [
    // Wide plumes from the shoulder-pod vents, smaller ones from the backpack struts.
    { name: 'podL', len: 28, wid: 20, hot: 0.3, i: 4 },
    { name: 'podR', len: 28, wid: 20, hot: 0.3, i: 5 },
    { name: 'packL', len: 16, wid: 9, hot: 0.45, i: 6 },
    { name: 'packR', len: 16, wid: 9, hot: 0.45, i: 7 },
  ],
  nozzles: ['podL', 'podR'],
  exhaust: ['podL', 'podR', 'packL', 'packR'],
  wingAnchors: ['cannon', 'barrel', 'pod'],
  size: 90,
});
