import { createMechaArt } from './art/mechaArt.js';
import { RIG, pose } from './linRig.js';

// LIN v2 (ASSET_NOTES.md "Rebuild v2"): the Petal Engine as a component mecha
// on the same sprite, built on the shared mecha-art module's rig path. The whip
// (left hand, handle and tip halves), the spear (right hand) and the butterfly
// wings move as linRig.js says; the body and wings draw from the weapon-free
// `under` image (lin_wings@2x.png), so the moved weapons leave no hole. The FX
// around them come from linFx.js (RIG_FX). The crystal legs (feet) never fire.
// No thrusters: the butterfly wings beat. 90 units tall.

// Owner's choice for every effect: glowing emerald green, black and white.
export const PAL = {
  core: [2.5, 2.7, 2.5],
  hot: [0.75, 2.6, 1.15],
  mid: [0.12, 1.45, 0.5],
  edge: [0.03, 0.45, 0.16],
};
/** The black part: drawn alpha-blended (additive light can't make black). */
export const DARK = [0.01, 0.05, 0.03];

/** FX hooks around the rig's layers; filled in by linFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const linArt = createMechaArt({
  id: 'lin',
  pal: PAL,
  // Built-in copy of lin.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 409, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [204.5, 201.4], head: [204.5, 238.5], core: [204.5, 127.3],
      blade: [296.2, 84.1], spear: [298.7, 13.1], whip: [39.3, 16.2],
      whipHand: [145.9, 189.1], whipJoint: [50.2, 100.2], whipMid: [93.4, 149], whipTip: [44, 7.5],
      spearHand: [295.6, 189.1], spearTip: [298.7, 13.1],
      wingL: [167.5, 220], wingR: [241.6, 220], wingPivotL: [152, 220], wingPivotR: [257, 220],
    },
  },
  flames: [],
  flap: true, // animate() still advances the beat phase; linRig.js poses the wings from it
  // Pilot-texture extras: the swarm turret, and the owner's two big FX picks
  // (drawn a few times per frame, so they stay out of the shared atlas).
  extras: { turret: 'turret', cosmic: 'fxCosmic', star: 'fxStar' },
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, linArt.anchorData().anchors),
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 90,
});
