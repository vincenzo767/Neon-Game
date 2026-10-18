import { createMechaArt } from './art/mechaArt.js';
import { RIG, pose, bob } from './seraRig.js';

// SERA (ASSET_NOTES.md): the white-and-blue crystal archer (src/pilot concept
// art/Sera Voss, top-down-sprite.png, with its painted arrows removed) as a
// component mecha on the shared mecha-art module's rig path. The drawing arm
// moves as seraRig.js says; the body draws from the `under` image
// (sera_wings@2x.png), so the drawn-back fist leaves no hole. The FX around it
// (the energy string, the bow's glow, the Zero Field) come from seraFx.js
// (RIG_FX). Flies feet-first: the crystal leg spikes never fire. Every Frost
// Shard leaves the nock. No thrusters: she hovers on her ice-blade wings.
// 100 units tall.

// Owner's palette: ice blue, cyan, pale blue-white, white; deep glacial blue shadows.
export const PAL = {
  core: [2.4, 2.7, 3.0],
  hot: [1.1, 2.3, 3.0],
  mid: [0.35, 1.1, 2.2],
  edge: [0.08, 0.3, 0.8],
  dark: [0.02, 0.06, 0.16], // glacial shadow (alpha-blended)
};
export const DARK = PAL.dark;

/** FX hooks around the rig's layers; filled in by seraFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const seraArt = createMechaArt({
  id: 'sera',
  pal: PAL,
  // Built-in copy of sera.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 408, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [201.8, 175.3], head: [202.1, 195.2], nock: [252.9, 188.5], grip: [143.4, 154.4],
      riser: [199.9, 163.6], stringL: [22.4, 164.2], stringR: [381.8, 162.6],
      limbL: [73.6, 213.2], limbR: [329.4, 194.2], footL: [190.4, 58.4], footR: [226.7, 72.6],
      bladeL: [7.3, 323.7], bladeR: [395.7, 323.7], lowL: [89.4, 367.9], lowR: [313.6, 367.9],
    },
  },
  flames: [], // no thrusters: frost vapour off the ice-blade wings (seraFx.js)
  exhaust: [],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name),
    bob,
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 100,
});
