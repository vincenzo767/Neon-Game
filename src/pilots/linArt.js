import { createMechaArt } from './art/mechaArt.js';

// LIN ART TEST: the hand-made Petal Engine (src/pilot concept art/Lin Hayase,
// ASSET_NOTES.md), built on the shared mecha-art module. The sprite flies
// feet-first; the crystal legs (feet) never fire. No thrusters: the butterfly
// wings beat (`flap`) and are drawn under the body, so the spear (right hand)
// and whip (left hand) stay on top. 90 units tall.

// Owner's choice for every effect: glowing emerald green, black and white.
export const PAL = {
  core: [2.5, 2.7, 2.5],
  hot: [0.75, 2.6, 1.15],
  mid: [0.12, 1.45, 0.5],
  edge: [0.03, 0.45, 0.16],
};
/** The black part: drawn alpha-blended (additive light can't make black). */
export const DARK = [0.01, 0.05, 0.03];

export const linArt = createMechaArt({
  id: 'lin',
  pal: PAL,
  // Built-in copy of lin.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 409, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [204.5, 201.4], head: [204.5, 238.5], core: [204.5, 127.3],
      blade: [296.2, 84.1], spear: [298.7, 13.1], whip: [39.3, 16.2],
      wingL: [167.5, 220], wingR: [241.6, 220],
    },
  },
  flames: [],
  flap: true,
  // Pilot-texture extras: the swarm turret, and the owner's two big FX picks
  // (drawn a few times per frame, so they stay out of the shared atlas).
  extras: { turret: 'turret', cosmic: 'fxCosmic', star: 'fxStar' },
  size: 90,
});
