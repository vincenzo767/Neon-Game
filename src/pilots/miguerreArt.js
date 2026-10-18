import { createMechaArt } from './art/mechaArt.js';
import { RIG, pose, bob } from './miguerreRig.js';

// MIGUERRE v2 (ASSET_NOTES.md "Rebuild v2"): the horned, winged sword knight
// (src/pilot concept art/Miguerre Zo'Rajah, new-top-down-sprite.png) as a
// component mecha on the shared mecha-art module's rig path. The sword arm, the
// claw arm and the bat wings move as miguerreRig.js says; the body and wings
// draw from the weapon-free `under` image (miguerre_wings@2x.png), so the
// swinging sword leaves no hole. The FX around them come from miguerreFx.js
// (RIG_FX). Flies feet-first: the legs (feet) never fire. Every void beam leaves
// the horns on his head. No thrusters: he flies on his wings. 150 units tall
// (sword tip to wing tips; a wingspan of about 102, like Oduya's).

// Owner's theme: void-cosmic red. Glowing red, black, and white-hot cores.
export const PAL = {
  core: [2.7, 2.2, 2.2],
  hot: [2.6, 0.45, 0.4],
  mid: [1.7, 0.08, 0.1],
  edge: [0.55, 0.02, 0.04],
  dark: [0.03, 0.0, 0.01], // void black (alpha-blended)
};
export const DARK = PAL.dark;

/** FX hooks around the rig's layers; filled in by miguerreFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const miguerreArt = createMechaArt({
  id: 'miguerre',
  pal: PAL,
  // Built-in copy of miguerre.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 252, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [126, 183.8], head: [126, 216.8], core: [126, 217.9],
      hornL: [112.1, 223.8], hornR: [139.9, 223.8],
      hornRootL: [120.1, 211.6], hornRootR: [131.9, 211.6],
      hornTipL: [101.7, 241.3], hornTipR: [150.3, 241.3],
      spike: [126, 69.4], footL: [99.8, 73], footR: [152.2, 73],
      shoulderR: [154.1, 202.6], grip: [188.2, 193.2], guard: [194.1, 146],
      swordMid: [200.3, 75.3], swordTip: [206.9, 6.5], pommel: [187.5, 248.8],
      shoulderL: [97.9, 202.6], claw: [60.7, 149.6],
      wingPivotL: [99.8, 226.2], wingPivotR: [152.2, 226.2],
      wingTipL: [6.9, 134.7], wingTipR: [245.1, 134.7],
      wingLowL: [21.1, 363.4], wingLowR: [230.9, 363.4],
      wingMidL: [33.8, 263.9], wingMidR: [218.2, 263.9],
    },
  },
  flames: [], // no thrusters: the wings beat (miguerreRig.js)
  exhaust: [],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, miguerreArt.anchorData().anchors),
    bob,
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  // v2 owner's feedback: as big on screen as Oduya. The art's height includes the long
  // sword held upright, so at 100 his wingspan was only 68 units (Oduya's: 113).
  size: 150,
});
