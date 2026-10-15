import { createMechaArt } from './art/mechaArt.js';
import { RIG, pose } from './brunoRig.js';

// BRUNO v2 (ASSET_NOTES.md "Rebuild v2"): the Ironhound as a heavy-artillery
// component mecha, built on the shared mecha-art module's rig path. The layers
// (hand guns, shoulder cannons, side cannons, body) and their motion come from
// brunoRig.js; the FX drawn around them come from brunoFx.js (RIG_FX).
// Everything is visual except `anchor()`, which also places Bruno's real shot
// origins (hand-gun bores, shoulder-cannon mouths and long barrels, side
// cannons). The feet (top of the sprite: he flies feet-first) never fire.

// From fx_reference.png: violet outside, orange inside (white-hot centre).
export const PAL = {
  core: [2.6, 1.9, 1.1],
  hot: [2.2, 0.95, 0.25],
  mid: [1.15, 0.35, 1.9],
  edge: [0.55, 0.12, 1.1],
};

/** FX hooks around the rig's layers; filled in by brunoFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const brunoArt = createMechaArt({
  id: 'bruno',
  pal: PAL,
  // Built-in copy of bruno.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 418, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [209, 227.7], head: [209, 280.3],
      muzzleL: [79.2, 10.9], muzzleR: [338.7, 10.9],
      chanL: [81.2, 89.8], chanR: [336.8, 89.8],
      gripL: [90.4, 181.7], gripR: [327.6, 181.7],
      elbowL: [90.4, 217.9], elbowR: [327.6, 217.9],
      shoulderPivotL: [44.4, 247.4], shoulderPivotR: [373.6, 247.4],
      shoulderJointL: [34.6, 101.3], shoulderJointR: [383.4, 101.3],
      shoulderTipL: [22.8, 10.3], shoulderTipR: [395.2, 10.3],
      wideL: [34.6, 125.9], wideR: [383.4, 125.9],
      housingL: [34.6, 175.2], housingR: [383.4, 175.2],
      sidePivotL: [159.4, 359.1], sidePivotR: [258.6, 359.1],
      sideJointL: [149.5, 300], sideJointR: [268.4, 300],
      sideTipL: [140.3, 260.6], sideTipR: [277.6, 260.6],
      podL: [89.8, 349.9], podR: [328.2, 349.9],
      packL: [183, 349.9], packR: [234.9, 349.9],
    },
  },
  flames: [
    // The original violet plumes, at the new art's propulsion points: wide plumes from
    // the shoulder-pod ports, smaller ones from the backpack struts.
    { name: 'podL', len: 28, wid: 20, hot: 0.3, i: 4 },
    { name: 'podR', len: 28, wid: 20, hot: 0.3, i: 5 },
    { name: 'packL', len: 16, wid: 9, hot: 0.45, i: 6 },
    { name: 'packR', len: 16, wid: 9, hot: 0.45, i: 7 },
  ],
  nozzles: ['podL', 'podR'],
  exhaust: ['podL', 'podR', 'packL', 'packR'],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, brunoArt.anchorData().anchors),
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 90,
});
