import kairo from './kairo.js';
import mira from './mira.js';
import bruno from './bruno.js';
import tess from './tess.js';
import oduya from './oduya.js';
import lin from './lin.js';
import dax from './dax.js';
import sera from './sera.js';
import nova from './nova.js';
import rufus from './rufus.js';
import aiko from './aiko.js';
import pike from './pike.js';
import zuri from './zuri.js';
import cass from './cass.js';
import holt from './holt.js';
import warden from './warden.js';
import vincenzo from './vincenzo.js';
import { isUnlocked } from './unlocks.js';

// Pilot registry. To add a pilot: create src/pilots/<id>.js exporting a
// definition (see kairo.js for the full shape) and list it here.

export const PILOTS = [kairo, mira, bruno, tess, oduya, lin, dax, sera, nova, rufus, aiko, pike, zuri, cass, holt, warden, vincenzo];

/** The 16 standard pilots in roster order, plus the Legendary slot (#17). */
export const ROSTER = PILOTS;
export const LEGENDARY_INDEX = PILOTS.indexOf(vincenzo);

/**
 * The roster as the select screen shows it right now: locked pilots
 * ("Warden" until a main boss has been defeated) are replaced by a sealed
 * stub that keeps the slot, name and unlock hint.
 */
export function getRoster() {
  return PILOTS.map((p) => (isUnlocked(p.id) ? p : {
    id: p.id, name: p.name, vehicle: p.vehicle, locked: true, unlockHint: p.unlockHint, css: p.css,
  }));
}

export function pilotById(id) { return PILOTS.find((p) => p.id === id) || PILOTS[0]; }

export const PILOT_SPRITES = PILOTS.map((p) => p.sprites);
