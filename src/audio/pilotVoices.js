// Per-pilot sound identity (prompt §6: "distinct per-pilot shot sounds").
// Data keyed by pilot id, so pilot files stay untouched:
//
//   shot(c, out, t, s)     one volley; s = {focus, tier, pan, p}
//   gap                    min seconds between shot sounds (volley cadence)
//   special(c, out, t, s)  the special's activation sound
//   pitch                  base Hz used by the generic ultimate / bomb colour
//   gain                   loudness trim (M7c: measured RMS evened to ~-36 dBFS)
//
// Shot sounds sit low in the mix (they repeat ~10×/s): short, mostly
// filtered, never sub-heavy so explosions and the music keep the bottom end.

import { tone, noise, fm, metal, kick, pad, hz } from './synth.js';

const ECHO = { echo: 0.12 };

export const PILOT_VOICES = {
  // Rail lances: a bright, fast descending zap with a crack.
  kairo: {
    gap: 0.075, pitch: 880, gain: 1.62,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'sawtooth', f: s.focus ? 2400 : 1900, f2: 300, ft: 0.07, dur: 0.08, peak: 0.05, filter: { type: 'bandpass', f: 2600, q: 1.2 }, pan: s.pan });
      noise(c, o, t, { dur: 0.02, peak: 0.03, filter: { type: 'highpass', f: 6000 }, pan: s.pan });
    },
    special(c, o, t) { // phase dash: whoosh + pitch rip
      noise(c, o, t, { dur: 0.35, peak: 0.25, a: 0.02, filter: { type: 'bandpass', f: 800, f2: 6000, ft: 0.3, q: 2 } });
      tone(c, o, t, { type: 'sawtooth', f: 200, f2: 2400, ft: 0.25, dur: 0.3, peak: 0.08, filter: { type: 'lowpass', f: 3000 } });
    },
  },
  // Light needles: a soft glassy tick with a homing "seek" shimmer.
  mira: {
    gap: 0.09, pitch: 1320, gain: 1.46,
    shot(c, o, t, s) {
      fm(c, o, t, { f: s.focus ? 1760 : 1320, ratio: 2, index: 1.2, dur: 0.07, peak: 0.04, a: 0.002, pan: s.pan });
    },
    special(c, o, t) { // shield orbs: rising bell triad
      [0, 4, 7].forEach((n, i) => fm(c, o, t + i * 0.05, { f: hz(76 + n), ratio: 3.5, index: 2, dur: 0.6, peak: 0.08, send: { rev: 0.4 } }));
    },
  },
  // Flak spread: a punchy low "chunk" of a heavy autocannon.
  bruno: {
    gap: 0.11, pitch: 220, gain: 0.54,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'square', f: 180, f2: 70, ft: 0.06, dur: 0.08, peak: 0.07, filter: { type: 'lowpass', f: 1200 }, pan: s.pan });
      noise(c, o, t, { dur: 0.05, peak: 0.07, filter: { type: 'lowpass', f: 2500 }, pan: s.pan });
    },
    special(c, o, t) { // brace: armour slam
      metal(c, o, t, { f: 150, bp: 1400, dur: 0.5, peak: 0.16, q: 4, send: { rev: 0.3 } });
      kick(c, o, t, { f0: 140, f1: 50, dur: 0.3, peak: 0.5, click: 0.2 });
    },
  },
  // Wire blades: a short metallic "shing".
  tess: {
    gap: 0.08, pitch: 1500, gain: 3.05,
    shot(c, o, t, s) {
      noise(c, o, t, { dur: 0.06, peak: 0.05, filter: { type: 'bandpass', f: s.focus ? 7000 : 5200, f2: 3000, ft: 0.05, q: 4 }, pan: s.pan });
      metal(c, o, t, { f: 900, bp: 8000, dur: 0.05, peak: 0.02, q: 2, pan: s.pan });
    },
    special(c, o, t) { // cloak: a downward shimmer into silence
      noise(c, o, t, { dur: 0.6, peak: 0.12, a: 0.01, filter: { type: 'bandpass', f: 9000, f2: 400, ft: 0.6, q: 3 } });
      fm(c, o, t, { f: 1200, f2: 300, ratio: 1.5, index: 2, dur: 0.6, peak: 0.06 });
    },
  },
  // Plasma mortars: a hollow "thoonk" launch.
  oduya: {
    gap: 0.14, pitch: 330, gain: 0.5,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'sine', f: 520, f2: 130, ft: 0.09, dur: 0.12, peak: 0.1, pan: s.pan });
      noise(c, o, t, { dur: 0.04, peak: 0.04, filter: { type: 'bandpass', f: 900, q: 2 }, pan: s.pan });
    },
    special(c, o, t) { // ground-slam EMP: thud + electric crackle
      kick(c, o, t, { f0: 120, f1: 30, dur: 0.6, peak: 0.7, click: 0.3, drive: 2 });
      for (let k = 0; k < 6; k++) noise(c, o, t + 0.05 + k * 0.04, { dur: 0.03, peak: 0.1, filter: { type: 'bandpass', f: 3000 + k * 600, q: 6 } });
    },
  },
  // Seed spread: a soft wooden pluck, like a seed pod popping.
  lin: {
    gap: 0.1, pitch: 660, gain: 0.88,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'triangle', f: s.focus ? 990 : 740, f2: 520, ft: 0.03, dur: 0.07, peak: 0.07, pan: s.pan });
      noise(c, o, t, { dur: 0.015, peak: 0.03, filter: { type: 'bandpass', f: 2200, q: 3 }, pan: s.pan });
    },
    special(c, o, t) { // bloom: a rising chime chord
      [0, 4, 7, 11, 14].forEach((n, i) => tone(c, o, t + i * 0.04, { type: 'triangle', f: hz(72 + n), dur: 0.7, peak: 0.06, send: { rev: 0.5 } }));
    },
  },
  // Overclock cannons: the pitch climbs with engine heat.
  dax: {
    gap: 0.065, pitch: 300, gain: 0.66,
    shot(c, o, t, s) {
      const heat = Math.min(1, ((s.p && (s.p.ps.nova ? 100 : s.p.ps.heat)) || 0) / 100);
      tone(c, o, t, { type: 'square', f: 260 + heat * 340, f2: 110, ft: 0.05, dur: 0.06, peak: 0.05, drive: 2, filter: { type: 'lowpass', f: 1800 + heat * 2000 }, pan: s.pan });
    },
    special(c, o, t) { // vent blast: steam roar + rumble
      noise(c, o, t, { dur: 0.7, peak: 0.3, a: 0.01, filter: { type: 'lowpass', f: 5000, f2: 400, ft: 0.7 } });
      tone(c, o, t, { type: 'sawtooth', f: 80, f2: 40, dur: 0.6, peak: 0.15, drive: 3, filter: { type: 'lowpass', f: 400 } });
    },
  },
  // Frost shards: brittle crystalline ticks.
  sera: {
    gap: 0.09, pitch: 2200, gain: 1.33,
    shot(c, o, t, s) {
      fm(c, o, t, { f: s.focus ? 2600 : 2100, ratio: 3.7, index: 1.5, dur: 0.06, peak: 0.035, a: 0.001, pan: s.pan });
      noise(c, o, t, { dur: 0.03, peak: 0.02, filter: { type: 'highpass', f: 8000 }, pan: s.pan });
    },
    special(c, o, t) { // cryo shell: icy crackle freezing over
      for (let k = 0; k < 8; k++) fm(c, o, t + k * 0.03, { f: 3000 - k * 200, ratio: 3.7, index: 2, dur: 0.15, peak: 0.05 });
      noise(c, o, t, { dur: 0.8, peak: 0.1, a: 0.1, filter: { type: 'highpass', f: 5000 }, send: { rev: 0.5 } });
    },
  },
  // Packet stream: digital bit-crushed chirps.
  nova: {
    gap: 0.08, pitch: 1000, gain: 4,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'pulse12', f: s.focus ? 1600 : 1200, f2: 2400, ft: 0.03, dur: 0.045, peak: 0.035, pan: s.pan });
      tone(c, o, t + 0.025, { type: 'pulse12', f: 800, dur: 0.02, peak: 0.02, pan: s.pan });
    },
    special(c, o, t) { // firewall: modem-ish data burst
      for (let k = 0; k < 10; k++) tone(c, o, t + k * 0.025, { type: 'square', f: [1200, 2400, 1800, 600][k % 4], dur: 0.02, peak: 0.04 });
      noise(c, o, t, { dur: 0.3, peak: 0.08, filter: { type: 'bandpass', f: 2000, q: 1 } });
    },
  },
  // Scrap hopper: junky, clanky, a bit random.
  rufus: {
    gap: 0.1, pitch: 400, gain: 2.4,
    shot(c, o, t, s) {
      const r = Math.random();
      metal(c, o, t, { f: 200 + r * 300, bp: 2000 + r * 3000, dur: 0.07, peak: 0.04, q: 3, pan: s.pan });
      noise(c, o, t, { dur: 0.04, peak: 0.04, filter: { type: 'bandpass', f: 1200 + r * 1500, q: 2 }, pan: s.pan });
    },
    special(c, o, t) { // magnet pull: rising hum
      tone(c, o, t, { type: 'sawtooth', f: 60, f2: 240, ft: 0.8, dur: 0.9, peak: 0.12, unison: 2, spread: 30, filter: { type: 'lowpass', f: 600, f2: 2500, ft: 0.8, q: 6 } });
    },
  },
  // Rotor streams: a chopping whump.
  aiko: {
    gap: 0.085, pitch: 500, gain: 1.43,
    shot(c, o, t, s) {
      noise(c, o, t, { dur: 0.05, peak: 0.06, filter: { type: 'bandpass', f: s.focus ? 1500 : 1000, q: 3 }, pan: s.pan });
      tone(c, o, t, { type: 'triangle', f: 420, f2: 260, dur: 0.05, peak: 0.04, pan: s.pan });
    },
    special(c, o, t) { // downdraft: swirling wind
      noise(c, o, t, { dur: 1, peak: 0.2, a: 0.1, filter: { type: 'bandpass', f: 400, f2: 2400, ft: 1, q: 3 }, send: { rev: 0.3 } });
    },
  },
  // Bastion cannons: big, slow, booming.
  pike: {
    gap: 0.16, pitch: 160, gain: 0.34,
    shot(c, o, t, s) {
      kick(c, o, t, { f0: 180, f1: 60, dur: 0.12, peak: 0.16, click: 0.08 });
      noise(c, o, t, { dur: 0.08, peak: 0.06, filter: { type: 'lowpass', f: 1800 }, pan: s.pan });
    },
    special(c, o, t) { // scramble: a launch klaxon
      [0, 0.18].forEach((d) => tone(c, o, t + d, { type: 'square', f: 660, f2: 880, dur: 0.15, peak: 0.06, filter: { type: 'lowpass', f: 2400 } }));
    },
  },
  // Solar darts: warm, airy, translucent.
  zuri: {
    gap: 0.09, pitch: 1100, gain: 1.16,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'sine', f: s.focus ? 1400 : 1100, f2: 1700, ft: 0.05, dur: 0.07, peak: 0.04, pan: s.pan, send: ECHO });
    },
    special(c, o, t) { // solar flare: bright swell
      pad(c, o, t, { freqs: [hz(69), hz(76), hz(81)], dur: 0.9, peak: 0.12, a: 0.05, type: 'sawtooth', cutoff: 6000, cutoff2: 800 });
    },
  },
  // Sonic rings: a "wub"; the downbeat volley is a real bass drop (see sfx.js).
  cass: {
    gap: 0.11, pitch: 128, gain: 0.76,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'sawtooth', f: s.focus ? 330 : 220, dur: 0.1, peak: 0.06, filter: { type: 'lowpass', f: 300, f2: 2400, ft: 0.05, q: 8 }, pan: s.pan });
    },
    special(c, o, t) { // drop the beat: scratch + clap
      tone(c, o, t, { type: 'sawtooth', f: 900, f2: 200, ft: 0.08, dur: 0.1, peak: 0.08, filter: { type: 'bandpass', f: 1500, q: 2 } });
      tone(c, o, t + 0.1, { type: 'sawtooth', f: 200, f2: 1100, ft: 0.08, dur: 0.1, peak: 0.08, filter: { type: 'bandpass', f: 1500, q: 2 } });
    },
  },
  // Split fire: two slightly detuned blips, left and right.
  holt: {
    gap: 0.08, pitch: 700, gain: 1.46,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'square', f: 700, f2: 420, dur: 0.05, peak: 0.03, filter: { type: 'lowpass', f: 2600 }, pan: -0.5 });
      tone(c, o, t + 0.012, { type: 'square', f: 712, f2: 428, dur: 0.05, peak: 0.03, filter: { type: 'lowpass', f: 2600 }, pan: 0.5 });
    },
    special(c, o, t) { // tether: a stretched electric hum
      tone(c, o, t, { type: 'sawtooth', f: 110, dur: 0.5, peak: 0.1, unison: 2, spread: 20, filter: { type: 'bandpass', f: 900, q: 6 } });
    },
  },
  // Adaptive verdict: a gavel-like knock with a judge's echo.
  warden: {
    gap: 0.1, pitch: 440, gain: 0.87,
    shot(c, o, t, s) {
      tone(c, o, t, { type: 'triangle', f: 560, f2: 280, ft: 0.03, dur: 0.06, peak: 0.07, pan: s.pan });
      noise(c, o, t, { dur: 0.02, peak: 0.04, filter: { type: 'bandpass', f: 1800, q: 3 }, pan: s.pan });
    },
    special(c, o, t) { // objection: gavel bang ×2
      [0, 0.16].forEach((d) => {
        tone(c, o, t + d, { type: 'triangle', f: 420, f2: 200, ft: 0.04, dur: 0.12, peak: 0.2 });
        noise(c, o, t + d, { dur: 0.05, peak: 0.12, filter: { type: 'bandpass', f: 1500, q: 2 }, send: { rev: 0.5 } });
      });
    },
  },
  // Holy bullets: a choir-tinged bright chime, ever so faintly heavenly.
  vincenzo: {
    gap: 0.07, pitch: 587, gain: 0.98,
    shot(c, o, t, s) {
      fm(c, o, t, { f: s.focus ? 1174 : 880, ratio: 2, index: 0.8, dur: 0.1, peak: 0.035, a: 0.002, pan: s.pan, send: { rev: 0.2 } });
    },
    special(c, o, t) {
      pad(c, o, t, { freqs: [hz(62), hz(66), hz(69)], dur: 1.2, peak: 0.1, a: 0.1, formants: [[700, 1], [1150, 0.6]], unison: 3, send: { cath: 0.5 } });
    },
  },
};

/** Fallback for unknown pilot ids. */
export const DEFAULT_VOICE = PILOT_VOICES.kairo;
