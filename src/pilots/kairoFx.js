import { createMechaFx, crowdFactor, SHARD_TAG } from './art/mechaFx.js';
import { kairoArt } from './kairoArt.js';

// KAIRO ART TEST, Step 4: Kairo's weapon effects, rebuilt in code from the
// "Rifle shot effects" and "Burst / Charged shot" rows of FX Sprite Sheet.png
// (shared implementation: art/mechaFx.js).

/** Hit radius of a main lance per power tier (the bright core is 2r wide). */
export const LANCE_R = [5, 5, 5.5, 6];

const fx = createMechaFx(kairoArt, {
  body: [0.25, 0.85, 1.45], // cyan-blue, below the bloom's white clip
  lanceLen: (t) => 34 + 8 * t,
});

export { SHARD_TAG, crowdFactor };
export const { renderShots, renderBeam, renderChargeOrb, muzzleFlash, hitSpark } = fx;
