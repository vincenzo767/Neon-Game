// Menu stings (M4a/M5), now routed through the M6 engine so they obey the
// SFX slider and the master limiter. The exported names are unchanged.
// The `volume` argument is kept for compatibility; the mixer applies the
// SFX volume, so it only matters when a caller passes 0 (mute).

import { ensureAudio } from './engine.js';
import { sfx } from './sfx.js';

function go(id, volume, opts) {
  if (volume <= 0) return;
  ensureAudio(); // always called from a key/pad press
  sfx.play(id, opts);
}

/** Short UI blip for menu navigation. */
export function playUiTick(volume = 0.8) { go('uiTick', volume); }

/** Bright two-note confirm. */
export function playConfirm(volume = 0.8) { go('uiConfirm', volume); }

/** Two-note back / cancel. */
export function playBack(volume = 0.8) { go('uiBack', volume); }

/** Distorted siren + sub growl for highlighting HELL difficulty. */
export function playHellWarning(volume = 0.8) { go('hellWarning', volume); }

/** Legendary select sting (M5): a synthesized choir chord into the cathedral. */
export function playChoir(volume = 0.8) { go('choir', volume); }
