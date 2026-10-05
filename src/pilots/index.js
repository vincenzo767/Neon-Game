import kairo from './kairo.js';
import mira from './mira.js';
import bruno from './bruno.js';
import tess from './tess.js';

// Pilot registry. To add a pilot: create src/pilots/<id>.js exporting a
// definition (see kairo.js for the full shape) and list it here.

export const PILOTS = [kairo, mira, bruno, tess];

// The full 16-pilot roster. Entries without a definition are shown on the
// select screen as CLASSIFIED until they're implemented (M5).
export const ROSTER = [
  kairo, mira, bruno, tess,
  { id: 'oduya', name: 'ODUYA REX', vehicle: 'THUNDERJAW', locked: true },
  { id: 'lin', name: 'LIN HAYASE', vehicle: 'PETAL ENGINE', locked: true },
  { id: 'dax', name: 'DAX MORROW', vehicle: 'OVERCLOCK', locked: true },
  { id: 'sera', name: 'SERA VOSS', vehicle: 'GLACIER', locked: true },
  { id: 'nova', name: 'NOVA-7', vehicle: 'CIPHER', locked: true },
  { id: 'rufus', name: 'RUFUS GRAINE', vehicle: 'JUNKYARD SAINT', locked: true },
  { id: 'aiko', name: 'AIKO BRANDT', vehicle: 'TEMPEST', locked: true },
  { id: 'pike', name: 'MAJ. ELDON PIKE', vehicle: 'BASTION', locked: true },
  { id: 'zuri', name: 'ZURI ANKARA', vehicle: 'SOLAR FANG', locked: true },
  { id: 'cass', name: 'CASS RIVERA', vehicle: 'PULSE RIDER', locked: true },
  { id: 'holt', name: 'HOLT & HOLT', vehicle: 'GEMINI', locked: true },
  { id: 'warden', name: '"WARDEN"', vehicle: 'VERDICT', locked: true },
];

export function pilotById(id) { return PILOTS.find((p) => p.id === id) || PILOTS[0]; }

export const PILOT_SPRITES = PILOTS.map((p) => p.sprites);
