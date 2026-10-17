import { createMechaArt } from './art/mechaArt.js';
import { createMechaFx } from './art/mechaFx.js';
import { RIG, pose } from './tessRig.js';

// TESS v2 (ASSET_NOTES.md "Rebuild v2"): the Wireghost as a blade component
// mecha, built on the shared mecha-art module's rig path. The arms (upper arm
// + forearm and blade, split at the elbow) and their slash motion come from
// tessRig.js; the FX drawn around them come from tessFx.js (RIG_FX).
// Everything is visual except `anchor()`, which also places Tess's real shot
// origins (points along the swinging blade). The leg blades (top of the
// sprite: she flies feet-first) never fire.

// Owner's choice for every effect: violet outside, a scarlet band, orange inside (white-hot centre).
export const PAL = {
  core: [2.6, 1.9, 1.1],
  hot: [2.2, 0.95, 0.25],
  rim: [2.0, 0.05, 0.08],
  mid: [1.15, 0.35, 1.9],
  edge: [0.55, 0.12, 1.1],
};

/** FX hooks around the rig's layers; filled in by tessFx.js (avoids an import cycle). */
export const RIG_FX = { before: null, overlay: null };

export const tessArt = createMechaArt({
  id: 'tess',
  pal: PAL,
  // Built-in copy of tess.anchors.json (gameplay anchors never depend on the file loading).
  defaults: {
    image: { w: 436, h: 372, artH: 360, pad: 6 },
    anchors: {
      hitbox: [217.9, 241.9], head: [217.9, 273.5], waist: [217.9, 181.9],
      bladeTipL: [13.9, 19.3], bladeTipR: [421.9, 19.3],
      bladeMidL: [59.7, 90.3], bladeMidR: [376.1, 90.3],
      bladeBaseL: [107.1, 174], bladeBaseR: [328.7, 174],
      wristL: [126, 204], wristR: [309.8, 204],
      elbowL: [127.6, 241.9], elbowR: [308.2, 241.9],
      shoulderL: [151.3, 254.5], shoulderR: [284.5, 254.5],
      ventL: [189.2, 312.9], ventR: [246.6, 312.9],
      packL: [208.7, 319.3], packR: [227.1, 319.3],
    },
  },
  flames: [
    // Wide plumes from the shoulder-spike roots, smaller ones beside the head's rear spike.
    { name: 'ventL', len: 18, wid: 8, hot: 0.2, i: 4 },
    { name: 'ventR', len: 18, wid: 8, hot: 0.2, i: 5 },
    { name: 'packL', len: 10, wid: 4, hot: 0.25, i: 6 },
    { name: 'packR', len: 10, wid: 4, hot: 0.25, i: 7 },
  ],
  nozzles: [],
  exhaust: ['ventL', 'ventR'],
  rig: {
    order: RIG.order,
    attach: RIG.attach,
    pose: (p, name) => pose(p, name, tessArt.anchorData().anchors),
    before: (p, b, api, name) => RIG_FX.before && RIG_FX.before(p, b, api, name),
    overlay: (p, b, api) => RIG_FX.overlay && RIG_FX.overlay(p, b, api),
  },
  size: 90,
});

// Shared muzzle flare + hit sparks in Tess's palette (shots and slashes are drawn by tessFx.js).
export const tessMechaFx = createMechaFx(tessArt, { body: [1.9, 0.75, 0.1] });
