import { createMechaArt, SIZES } from './art/mechaArt.js';
import { RIG, pose } from './kairoRig.js';

// KAIRO v2 (ASSET_NOTES.md "Rebuild v2"): the Stormlance as a component mecha,
// built on the shared mecha-art module's rig path. The layers (cannons,
// two-section inner and outer wing blades, body) and their motion come from
// kairoRig.js; the FX drawn around each layer come from kairoFx.js (RIG_FX).
// Everything is visual except `anchor()`, which also places Kairo's real shot
// origins (hand-cannon muzzles, wing-tip emitters, the chest beam emitter).
// The feet (top of the sprite: he flies feet-first) never fire.

// White-hot core → cyan → electric blue → violet edge (the reference's cyan energy).
export const PAL = {
  core: [2.2, 2.4, 2.6],
  cyan: [0.45, 1.35, 2.0],
  blue: [0.22, 0.5, 1.7],
  violet: [0.45, 0.25, 1.1],
};

/** FX hooks around the rig's layers; filled in by kairoFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const kairoArt = createMechaArt({
  id: 'kairo',
  pal: { core: PAL.core, hot: PAL.cyan, mid: PAL.blue, edge: PAL.violet },
  // Built-in copy of kairo.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 445, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [220.1, 183.9], chest: [220.1, 183.9], head: [220.1, 226.7],
      muzzleL: [135.1, 101.5], muzzleR: [305.1, 101.5],
      chanL: [141, 154.2], chanR: [299.1, 154.2],
      gripL: [159.2, 137.7], gripR: [281, 137.7],
      elbowL: [144.3, 192.1], elbowR: [295.8, 192.1],
      innerPivotL: [123.6, 188.8], innerPivotR: [316.6, 188.8],
      innerJointL: [95.6, 117], innerJointR: [344.6, 117],
      innerTipL: [64.6, 44.2], innerTipR: [375.6, 44.2],
      outerPivotL: [98.2, 262.9], outerPivotR: [342, 262.9],
      outerJointL: [51.8, 175.3], outerJointR: [388.4, 175.3],
      outerTipL: [5.7, 88], outerTipR: [434.5, 88],
      thrL: [205.9, 318.9], thrR: [234.3, 318.9],
      finL: [113, 314], finR: [327.1, 314],
      footL: [212.5, 10.6], footR: [230.6, 24.4],
    },
  },
  flames: [
    // Wide blue plumes at the backpack's base, small flames on the lower-fin vents.
    { name: 'thrL', len: 19, wid: 8, hot: 0.5, cap: 2.2, i: 0 },
    { name: 'thrR', len: 19, wid: 8, hot: 0.5, cap: 2.2, i: 1 },
    { name: 'finL', len: 10, wid: 5, cap: 1.8, i: 2 },
    { name: 'finR', len: 10, wid: 5, cap: 1.8, i: 3 },
  ],
  nozzles: ['thrL', 'thrR'],
  exhaust: ['thrL', 'thrR'],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, kairoArt.anchorData().anchors),
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 90,
});

export { SIZES };
export const {
  LOOK, anchor, anchorData, unitsPerPx, animatedAnchor, animate, renderMecha, exhaust,
} = kairoArt;
export const kairoFrames = kairoArt.frames;
export const buildKairoSprites = kairoArt.buildSprites;
