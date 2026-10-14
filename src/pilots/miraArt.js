import { createMechaArt } from './art/mechaArt.js';
import { RIG, pose } from './miraRig.js';

// MIRA v2 (ASSET_NOTES.md "Rebuild v2"): the Halo Sprite as a component mecha,
// built on the shared mecha-art module's rig path. The layers (hand cannons,
// the gold inner blade pair, the white outer blades, body) and their motion
// come from miraRig.js; the FX drawn around them come from miraFx.js (RIG_FX).
// Everything is visual except `anchor()`, which also places Mira's real shot
// origins (the chest emitter, the cannon muzzles). The feet (top of the
// sprite: she flies feet-first) never fire.

// From fx_reference.png: white-hot core → yellow → amber-gold → orange edge.
export const PAL = {
  core: [2.6, 2.4, 1.9],
  hot: [2.0, 1.5, 0.45],
  mid: [1.6, 0.75, 0.12],
  edge: [1.1, 0.32, 0.1],
};

/** FX hooks around the rig's layers; filled in by miraFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const miraArt = createMechaArt({
  id: 'mira',
  pal: PAL,
  // Built-in copy of mira.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 438, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [219.1, 188.3], chest: [219.1, 177], head: [219.1, 230],
      muzzleL: [121.7, 97.6], muzzleR: [316.5, 97.6],
      chanL: [122.4, 127.2], chanR: [315.9, 127.2],
      gripL: [135.2, 162.5], gripR: [303, 162.5],
      elbowL: [133.6, 196.3], elbowR: [304.6, 196.3],
      innerPivotL: [106.3, 196.3], innerPivotR: [331.9, 196.3],
      innerJointL: [85.4, 101.5], innerJointR: [352.8, 101.5],
      innerTipL: [70, 40.4], innerTipR: [368.3, 40.4],
      outerPivotL: [96.6, 201.1], outerPivotR: [341.6, 201.1],
      outerJointL: [50, 170.6], outerJointR: [388.2, 170.6],
      outerTipL: [6.6, 143.9], outerTipR: [431.6, 143.9],
      ventL: [139.1, 361.2], ventR: [299.1, 361.2],
      packL: [214.9, 329.7], packR: [223.3, 329.7],
      footL: [186.6, 275], footR: [251.6, 275],
    },
  },
  flames: [
    // The original gold plumes, at the new art's propulsion points: wide plumes from
    // the ladder-vent fins and the backpack spike (kept mostly amber), foot flames
    // at the gold skirt plates.
    { name: 'ventL', len: 26, wid: 18, hot: 0.35, i: 4 },
    { name: 'ventR', len: 26, wid: 18, hot: 0.35, i: 5 },
    { name: 'packL', len: 18, wid: 11, hot: 0.35, i: 6 },
    { name: 'packR', len: 18, wid: 11, hot: 0.35, i: 7 },
    { name: 'footL', len: 11, wid: 6, i: 0 },
    { name: 'footR', len: 11, wid: 6, i: 1 },
  ],
  nozzles: ['packL', 'packR'],
  exhaust: ['ventL', 'ventR', 'footL', 'footR'],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, miraArt.anchorData().anchors),
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 90,
});
