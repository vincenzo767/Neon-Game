// Musical identity per faction (UPDATE_02 §6, prompt §6). Data only: the
// sequencer in music.js reads these and never hard-codes a faction.
//
// Each style is a small "song kit":
//   bpm, root (MIDI note of the tonic in the bass octave), scale (semitones),
//   swing (0..1 delay of off-16ths), prog (scale degree per bar),
//   seventh (add the 7th to chords),
//   drums: 16-step strings per voice ('x' hit, 'o' accent/open, '.' rest),
//   bass / arp / pad / lead: instrument settings,
//   motif: the faction's leitmotif, 2 bars of 16 tokens each — a scale
//          degree (may be negative or ≥ 7 for other octaves), '-' to hold
//          the previous note, '.' for a rest.
//   boss: overrides for the archetype boss theme (same leitmotif, harder).
//
// Layers (what the intensity system turns on and off):
//   pad → bass → drums → arp → lead → perc
// Stage tracks start sparse and add layers as bullet density rises; boss
// themes start at "full minus lead" and every phase adds or changes a layer.

export const LAYERS = ['pad', 'bass', 'drums', 'arp', 'lead', 'perc'];

/** Layers on at each intensity level (0 calm … 4 everything). */
export const LEVEL_LAYERS = [
  ['pad', 'bass'],
  ['pad', 'bass', 'drums'],
  ['pad', 'bass', 'drums', 'arp'],
  ['pad', 'bass', 'drums', 'arp', 'lead'],
  ['pad', 'bass', 'drums', 'arp', 'lead', 'perc'],
];

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10];

export const STYLES = {
  // Precinct 9 — the player's own theme: menus, prototype boss, fallback.
  precinct: {
    name: 'PRECINCT 9 · SYNTHWAVE PURSUIT',
    bpm: 112, root: 45, scale: AEOLIAN, swing: 0,
    prog: [0, 5, 2, 6], seventh: true,
    drums: {
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      hat: '..x...x...x...xo',
      kit: 'synthwave',
    },
    perc: { pattern: 'x.......x..x....', voice: 'tom' },
    bass: { wave: 'sawtooth', pattern: 'x.o.x.o.x.o.x.o.', cutoff: 900, peak: 0.2 },
    pad: { wave: 'sawtooth', cutoff: 1400, peak: 0.07, unison: 3 },
    arp: { wave: 'pulse25', pattern: [0, 1, 2, 3, 2, 1], rate: 1, octave: 1, peak: 0.05, echo: 0.3 },
    lead: { wave: 'sawtooth', octave: 2, peak: 0.075, vib: 5, echo: 0.35, cutoff: 3200 },
    motif: [
      '0 - - 2 - - 4 - 6 - 5 - 4 - 2 -',
      '3 - - 4 - - 2 - - - . . 0 - 1 -',
    ],
    boss: { bpm: 128, prog: [0, 6, 5, 4], drums: { kick: 'x...x...x...x.x.', hat: 'xxoxxxoxxxoxxxox' } },
  },

  // Ironclad Brotherhood — industrial foundry metal: phrygian, distorted
  // chug bass, anvil clanks, power chords. Treads and pistons.
  ironclad: {
    name: 'IRONCLAD · FOUNDRY INDUSTRIAL',
    bpm: 136, root: 40, scale: PHRYGIAN, swing: 0,
    prog: [0, 0, 1, 0, 0, 0, 5, 1], power: true,
    drums: {
      kick: 'x..x..x.x..x..x.',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      kit: 'industrial',
    },
    perc: { pattern: '..x.......x...x.', voice: 'anvil' },
    bass: { wave: 'sawtooth', pattern: 'xxx.xxx.xx.xx.x.', cutoff: 700, peak: 0.22, drive: 5 },
    pad: { wave: 'sawtooth', cutoff: 700, peak: 0.06, unison: 2, power: true },
    arp: { wave: 'square', pattern: [0, 0, 1, 0, 2, 0, 1, 0], rate: 1, octave: 0, peak: 0.05, cutoff: 1400 },
    lead: { wave: 'sawtooth', octave: 1, peak: 0.07, drive: 4, cutoff: 2400, vib: 3 },
    motif: [
      '0 - . 0 1 - 0 - . . 3 - 1 - 0 -',
      '0 - . 0 1 - 3 - 4 - 3 - 1 - . .',
    ],
    boss: { bpm: 144, prog: [0, 1, 0, 5, 0, 1, 6, 5], drums: { kick: 'x.xx..x.x.xx..x.', snare: '....x..x....x...' } },
  },

  // Stratos Cartel — liquid drum & bass in the sky-lanes: bright lydian,
  // two-step breaks, reese bass, fast airy arps.
  stratos: {
    name: 'STRATOS · SKY-LANE DRUM & BASS',
    bpm: 174, root: 41, scale: LYDIAN, swing: 0,
    prog: [0, 1, 5, 4], seventh: true,
    drums: {
      kick: 'x.........x.....',
      snare: '....x.......x...',
      hat: 'x.xxx.xxx.xxx.xo',
      kit: 'breaks',
    },
    perc: { pattern: '.......x.....x..', voice: 'ghost' },
    bass: { wave: 'sawtooth', pattern: 'x-------x---x---', cutoff: 520, peak: 0.2, reese: true },
    pad: { wave: 'triangle', cutoff: 3000, peak: 0.08, unison: 3 },
    arp: { wave: 'pulse12', pattern: [0, 2, 4, 2, 1, 3, 5, 3], rate: 1, octave: 2, peak: 0.04, echo: 0.4 },
    lead: { wave: 'sawtooth', octave: 2, peak: 0.065, vib: 6, echo: 0.45, cutoff: 4200 },
    motif: [
      '4 - - - 3 - 4 - 6 - - - 7 - - -',
      '6 - 4 - 3 - - - 1 - 2 - 3 - - -',
    ],
    boss: { bpm: 176, prog: [5, 4, 0, 1], drums: { kick: 'x.x.......x.....', hat: 'xxxxxxxxxxxxxxxo' } },
  },

  // Black Tide — a pirate shanty run through a synth rig: swung dorian,
  // reed "accordion" lead, oom-pah off-beats, foghorn swells, bubbles.
  blacktide: {
    name: 'BLACK TIDE · SALT-SYNTH SHANTY',
    bpm: 124, root: 38, scale: DORIAN, swing: 0.35,
    prog: [0, 3, 0, 6], seventh: false,
    drums: {
      kick: 'x.....x...x.....',
      snare: '....x.......x...',
      hat: '..x...x...x...x.',
      kit: 'deck',
    },
    perc: { pattern: 'x...............', voice: 'foghorn', every: 2 },
    bass: { wave: 'sine', pattern: 'x...o...x...o...', cutoff: 600, peak: 0.28, sub: true },
    pad: { wave: 'reed', cutoff: 1600, peak: 0.05, unison: 2 },
    arp: { wave: 'reed', pattern: 'oompah', rate: 2, octave: 1, peak: 0.06, cutoff: 2200 },
    lead: { wave: 'reed', octave: 2, peak: 0.07, vib: 6, cutoff: 3000, echo: 0.2 },
    motif: [
      '0 - - 0 2 - 4 - 3 - - 2 1 - - -',
      '4 - - 4 3 - 2 - 1 - - 2 0 - - -',
    ],
    boss: { bpm: 132, prog: [0, 6, 3, 4], drums: { kick: 'x..x..x...x..x..', snare: '....x...x...x...' } },
  },

  // Helix Dynamics — cold corporate electro: harmonic minor, a precise
  // 16th sequencer bass, gated organ pads, glitchy data blips.
  helix: {
    name: 'HELIX DYNAMICS · CORPORATE ELECTRO',
    bpm: 150, root: 45, scale: HARMONIC_MINOR, swing: 0,
    prog: [0, 3, 4, 0, 5, 3, 4, 4], seventh: false,
    drums: {
      kick: 'x...x...x...x..x',
      snare: '....x.......x...',
      hat: 'xxxxxxxxxxxxxxxx',
      kit: 'electro',
    },
    perc: { pattern: 'x.x..x.x.xx..x.x', voice: 'data' },
    bass: { wave: 'square', pattern: 'xoxxxoxxxoxxxoxx', cutoff: 1100, peak: 0.16 },
    pad: { wave: 'organ', cutoff: 2600, peak: 0.07, unison: 1, gate: 'x.x.x.x.x.x.x.x.' },
    arp: { wave: 'pulse25', pattern: [0, 1, 2, 1, 3, 2, 1, 2], rate: 1, octave: 2, peak: 0.045, echo: 0.2 },
    lead: { wave: 'square', octave: 2, peak: 0.06, glide: 0.04, cutoff: 3600, echo: 0.25 },
    motif: [
      '0 - 2 - 4 - 6 - 7 - 6 - 4 - 6 -',
      '5 - 4 - 2 - 4 - 0 - - - . . . .',
    ],
    boss: { bpm: 156, prog: [0, 5, 3, 4], drums: { kick: 'x..xx...x..xx..x', hat: 'xoxxxoxxxoxxxoxx' } },
  },

  // Choir of the Outer Star — alien hymn: whole-tone harmony, FM glass
  // bells, gliding theremin lead, 5-against-4 crystal percussion.
  outerstar: {
    name: 'OUTER STAR · CRYSTAL HYMN',
    bpm: 104, root: 48, scale: WHOLE_TONE, swing: 0,
    prog: [0, 1, 0, 3], seventh: false,
    drums: {
      kick: 'x.......x.....x.',
      snare: '........x.......',
      hat: 'x..x..x..x..x..x',
      kit: 'glass',
    },
    perc: { pattern: 'x....x....x....x', voice: 'glyph' },
    bass: { wave: 'sine', pattern: 'x-------o-------', cutoff: 800, peak: 0.24, glide: 0.18 },
    pad: { wave: 'glass', cutoff: 4000, peak: 0.06, unison: 3 },
    arp: { wave: 'fm', pattern: [0, 2, 4, 3, 1, 5], rate: 2, octave: 2, peak: 0.07, echo: 0.45 },
    lead: { wave: 'sine', octave: 2, peak: 0.09, vib: 7, vibDepth: 18, glide: 0.12, echo: 0.4 },
    motif: [
      '0 - - - 3 - - - 5 - 4 - - - - -',
      '2 - - - 6 - - - 5 - - - 3 - - -',
    ],
    boss: { bpm: 112, prog: [0, 3, 1, 4], drums: { kick: 'x.....x...x.....', hat: 'x.xx.xx.xx.xx.xx' } },
  },

  // Drowned Covenant — sunken requiem: locrian, a slow heartbeat, choir
  // formant pads, bell tolls, a brown-noise undertow.
  drowned: {
    name: 'DROWNED COVENANT · SUNKEN REQUIEM',
    bpm: 78, root: 35, scale: LOCRIAN, swing: 0,
    prog: [0, 0, 1, 4], seventh: false,
    drums: {
      kick: 'x..x............',
      snare: '................',
      hat: '..x...x...x...x.',
      kit: 'heart',
    },
    perc: { pattern: 'x...............', voice: 'toll' },
    bass: { wave: 'sine', pattern: 'x---------------', cutoff: 300, peak: 0.26, drone: true },
    pad: { wave: 'sawtooth', cutoff: 900, peak: 0.08, unison: 2, choir: true },
    arp: { wave: 'triangle', pattern: [0, 2, 1, 4], rate: 2, octave: 1, peak: 0.06, echo: 0.5 },
    lead: { wave: 'organ', octave: 2, peak: 0.06, vib: 4, cutoff: 1800, echo: 0.35, choir: true },
    motif: [
      '0 - - - 1 - - - 0 - - - -1 - - -',
      '3 - - - 2 - 1 - 0 - - - - - . .',
    ],
    boss: { bpm: 84, prog: [0, 1, 4, 3], drums: { kick: 'x..x....x..x....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' } },
  },
};

/** musicLayer prefixes used by the boss data (see bosses/*) → style id. */
export const LAYER_STYLE = {
  ground: 'ironclad',
  aerial: 'stratos',
  sea: 'blacktide',
  mecha: 'helix',
  alien: 'outerstar',
  abyssal: 'drowned',
  prototype: 'precinct',
};

/** Faction ids (data/factions) → style id. */
export const FACTION_STYLE = {
  ironclad: 'ironclad',
  stratos: 'stratos',
  blacktide: 'blacktide',
  helix: 'helix',
  outerstar: 'outerstar',
  drowned: 'drowned',
};

/**
 * Parse a musicLayer id ('sea_p3', 'abyssal_p5_desperation',
 * 'titan_enforcer_desperation'…) into {style, phase, desperation}.
 */
export function parseLayer(name) {
  if (!name) return null;
  const desperation = name.endsWith('_desperation');
  const m = /^([a-z]+)(?:_p(\d+))?/.exec(name);
  const style = (m && LAYER_STYLE[m[1]]) || 'precinct';
  const phase = m && m[2] ? +m[2] : desperation ? 5 : 1;
  return { style, phase, desperation };
}

/** Parse a motif row into [{step, deg, len}] (16 steps per bar). */
export function parseMotif(rows) {
  const notes = [];
  let resting = true; // '-' after a rest stays a rest
  rows.forEach((row, bar) => {
    const tok = row.trim().split(/\s+/);
    tok.forEach((t, i) => {
      const step = bar * 16 + i;
      if (t === '-') { if (!resting) notes[notes.length - 1].len++; return; }
      if (t === '.') { resting = true; return; }
      resting = false;
      notes.push({ step, deg: +t, len: 1 });
    });
  });
  return notes;
}
