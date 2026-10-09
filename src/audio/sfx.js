// Sound-effect library (M6). Every effect is synthesized on demand.
//
//   sfx.play(id, opts)   fire an effect; throttled per id so a 60-kill frame
//                        or 1,500 grazing bullets never spawn 1,500 voices
//   sfx.shot(def, s)     the pilot's own shot voice (pilotVoices.js)
//   sfx.beam(on, f)      a sustained beam hum (one persistent voice)
//
// Layering follows the prompt: explosions are a sub-bass thump + a noise
// burst + a metallic tail; bombs are a heavy impact with the music swept
// "underwater"; Vincenzo's Trumpet is a brass blast into a 5 s cathedral.

import { audioCtx, bus, duck, stats } from './engine.js';
import { tone, noise, fm, kick, metal, pad, snare, hz } from './synth.js';
import { PILOT_VOICES, DEFAULT_VOICE } from './pilotVoices.js';

/** Min seconds between two plays of the same id, and max voices per 100 ms. */
const LIMIT = {
  explode0: [0.03, 3], explode1: [0.05, 3], explode2: [0.08, 2], explode3: [0.15, 2],
  graze: [0.028, 3], medal: [0.035, 3], item: [0.05, 2], power: [0.05, 2],
  bossTick: [0.07, 1], laser: [0.12, 1], sparkle: [0.06, 2], shot: [0.04, 2],
  enemyShot: [0.05, 1], grab: [0.08, 2],
};

const last = new Map();
const burst = new Map();

function allow(id, now) {
  const lim = LIMIT[id];
  if (!lim) return true;
  const prev = last.get(id) ?? -1;
  if (now - prev < lim[0]) { stats.dropped++; return false; }
  const b = burst.get(id);
  if (b && now - b.t < 0.1) {
    if (b.n >= lim[1]) { stats.dropped++; return false; }
    b.n++;
  } else burst.set(id, { t: now, n: 1 });
  last.set(id, now);
  return true;
}

const LIB = {
  // ------------------------------------------------------------ explosions
  // size 0 small drone … 3 large gunship. Three layers: thump, burst, tail.
  explode0(c, o, t, s) {
    kick(c, o, t, { f0: 160, f1: 50, dur: 0.16, peak: 0.25, click: 0 });
    noise(c, o, t, { dur: 0.2, peak: 0.16, a: 0.002, filter: { type: 'lowpass', f: 5000, f2: 500, ft: 0.18 }, pan: s.pan });
  },
  explode1(c, o, t, s) {
    kick(c, o, t, { f0: 140, f1: 38, dur: 0.3, peak: 0.45, click: 0.1 });
    noise(c, o, t, { dur: 0.4, peak: 0.25, a: 0.002, filter: { type: 'lowpass', f: 6000, f2: 300, ft: 0.35 }, pan: s.pan });
    metal(c, o, t + 0.02, { f: 240, bp: 3000, dur: 0.3, peak: 0.03, q: 2, pan: s.pan });
  },
  explode2(c, o, t, s) {
    kick(c, o, t, { f0: 120, f1: 30, dur: 0.6, peak: 0.7, click: 0.2, drive: 1.5 });
    noise(c, o, t, { color: 'pink', dur: 0.9, peak: 0.4, a: 0.003, filter: { type: 'lowpass', f: 7000, f2: 200, ft: 0.8 }, pan: s.pan, send: { rev: 0.25 } });
    metal(c, o, t + 0.03, { f: 180, bp: 2400, dur: 0.7, peak: 0.05, q: 3, pan: s.pan, send: { rev: 0.3 } });
  },
  explode3(c, o, t, s) {
    kick(c, o, t, { f0: 110, f1: 24, dur: 1.2, peak: 0.95, click: 0.3, drive: 2 });
    noise(c, o, t, { color: 'pink', dur: 1.8, peak: 0.55, a: 0.004, filter: { type: 'lowpass', f: 8000, f2: 150, ft: 1.6 }, pan: s.pan, send: { rev: 0.35 } });
    noise(c, o, t + 0.12, { color: 'brown', dur: 1.5, peak: 0.35, a: 0.05, filter: { type: 'lowpass', f: 400 } });
    metal(c, o, t + 0.05, { f: 130, bp: 1800, dur: 1.3, peak: 0.07, q: 4, send: { rev: 0.4 } });
  },

  // Boss death: a chain of blasts over ~2.5 s, then the big one.
  bossDeath(c, o, t) {
    for (let k = 0; k < 7; k++) LIB.explode2(c, o, t + k * 0.28 + Math.random() * 0.08, { pan: (Math.random() - 0.5) * 1.2 });
    LIB.explode3(c, o, t + 2.2, { pan: 0 });
    noise(c, o, t, { dur: 2.3, peak: 0.12, a: 2.0, filter: { type: 'bandpass', f: 300, f2: 5000, ft: 2.2, q: 1.5 } });
    tone(c, o, t + 2.2, { type: 'sine', f: 55, f2: 20, dur: 2.5, peak: 0.5 });
  },

  partDown(c, o, t, s) {
    LIB.explode2(c, o, t, s);
    metal(c, o, t, { f: 110, bp: 1200, dur: 1.2, peak: 0.12, q: 5, send: { rev: 0.4 } });
  },

  // ------------------------------------------------------------ feedback
  graze(c, o, t, s) {
    // Pitch rises with the graze streak (s.streak 0..1).
    const f = 2600 + (s.streak || 0) * 1800;
    tone(c, o, t, { type: 'sine', f, dur: 0.035, peak: 0.05, a: 0.001, pan: s.pan });
    noise(c, o, t, { dur: 0.015, peak: 0.03, filter: { type: 'highpass', f: 9000 }, pan: s.pan });
  },
  bossTick(c, o, t, s) {
    noise(c, o, t, { dur: 0.03, peak: 0.05, filter: { type: 'bandpass', f: 3500, q: 3 }, pan: s.pan });
  },
  sparkle(c, o, t) {
    for (let k = 0; k < 5; k++) fm(c, o, t + k * 0.035, { f: 2000 + Math.random() * 2500, ratio: 2, index: 1, dur: 0.18, peak: 0.03, pan: (Math.random() - 0.5) });
  },
  laser(c, o, t, s) {
    // Telegraph: a rising charge whine.
    tone(c, o, t, { type: 'sawtooth', f: 300, f2: 1800, ft: 0.6, dur: 0.65, peak: 0.04, a: 0.1, filter: { type: 'bandpass', f: 1200, f2: 4000, ft: 0.6, q: 4 }, pan: s.pan });
  },
  enemyShot(c, o, t, s) {
    tone(c, o, t, { type: 'triangle', f: 520, f2: 320, dur: 0.05, peak: 0.025, pan: s.pan });
  },

  // ------------------------------------------------------------ items
  power(c, o, t) {
    tone(c, o, t, { type: 'triangle', f: hz(79), dur: 0.08, peak: 0.08 });
    tone(c, o, t + 0.05, { type: 'triangle', f: hz(86), dur: 0.12, peak: 0.08 });
  },
  bombItem(c, o, t) {
    fm(c, o, t, { f: hz(67), ratio: 3.5, index: 3, dur: 0.5, peak: 0.1, send: { rev: 0.3 } });
    tone(c, o, t + 0.06, { type: 'triangle', f: hz(79), dur: 0.2, peak: 0.08 });
  },
  speedItem(c, o, t) {
    tone(c, o, t, { type: 'sawtooth', f: 300, f2: 2400, ft: 0.18, dur: 0.2, peak: 0.06, filter: { type: 'lowpass', f: 3000 } });
  },
  medal(c, o, t, s) {
    // Brighter as the medal value climbs (s.level 0..1).
    const n = 84 + Math.round((s.level || 0) * 12);
    fm(c, o, t, { f: hz(n), ratio: 4, index: 1.5, dur: 0.25, peak: 0.06, a: 0.001, pan: s.pan });
  },
  medalBreak(c, o, t) {
    // The medal chain shatters: a falling glass arpeggio.
    [24, 19, 12, 7, 0].forEach((n, i) => fm(c, o, t + i * 0.05, { f: hz(72 + n), ratio: 3.5, index: 1.5, dur: 0.2, peak: 0.05 }));
    noise(c, o, t, { dur: 0.25, peak: 0.08, filter: { type: 'highpass', f: 5000 } });
  },
  bonus(c, o, t) {
    // Boss bonus: a bright coin cascade into a chord.
    for (let k = 0; k < 8; k++) fm(c, o, t + k * 0.06, { f: hz(84 + [0, 4, 7, 12, 7, 12, 16, 19][k]), ratio: 4, index: 1.2, dur: 0.3, peak: 0.05, pan: k % 2 ? 0.3 : -0.3 });
    pad(c, o, t + 0.5, { freqs: [hz(72), hz(76), hz(79), hz(84)], dur: 1.2, peak: 0.08, a: 0.01, cutoff: 6000, cutoff2: 1500, unison: 3, send: { rev: 0.4 } });
  },
  extend(c, o, t) {
    [0, 4, 7, 12, 16].forEach((n, i) => tone(c, o, t + i * 0.08, { type: 'square', f: hz(72 + n), dur: i === 4 ? 0.5 : 0.1, peak: 0.07, filter: { type: 'lowpass', f: 4000 }, send: { rev: 0.3 } }));
  },
  tier(c, o, t, s) {
    const top = s.level >= 4;
    [0, 4, 7, 12].forEach((n, i) => tone(c, o, t + i * 0.05, { type: 'sawtooth', f: hz(67 + n + (s.level || 1) * 2), dur: 0.18, peak: 0.06, filter: { type: 'lowpass', f: 5000 }, send: { rev: 0.25 } }));
    if (top) pad(c, o, t + 0.2, { freqs: [hz(79), hz(83), hz(86)], dur: 0.8, peak: 0.08, a: 0.01, cutoff: 6000, cutoff2: 1000, unison: 3, send: { rev: 0.4 } });
  },
  ultReady(c, o, t) {
    [0, 7, 12, 16, 19].forEach((n, i) => fm(c, o, t + i * 0.06, { f: hz(72 + n), ratio: 2, index: 2, dur: 0.8, peak: 0.05, send: { rev: 0.5, echo: 0.2 } }));
  },
  notReady(c, o, t) {
    tone(c, o, t, { type: 'square', f: 110, dur: 0.12, peak: 0.06, filter: { type: 'lowpass', f: 800 } });
  },

  // ------------------------------------------------------------ player
  playerHit(c, o, t) {
    // The death-bomb window opens: a glitchy alarm the player can react to.
    tone(c, o, t, { type: 'square', f: 1600, f2: 200, ft: 0.18, dur: 0.2, peak: 0.12, drive: 3, filter: { type: 'lowpass', f: 4000 } });
    noise(c, o, t, { dur: 0.12, peak: 0.12, filter: { type: 'bandpass', f: 2500, q: 2 } });
  },
  playerDeath(c, o, t) {
    LIB.explode3(c, o, t, { pan: 0 });
    tone(c, o, t + 0.1, { type: 'sawtooth', f: 880, f2: 55, ft: 1.2, dur: 1.3, peak: 0.1, filter: { type: 'lowpass', f: 2000, f2: 200, ft: 1.2 }, send: { rev: 0.4 } });
  },

  // Bomb: heavy impact; the caller also sweeps the music underwater.
  bomb(c, o, t, s) {
    kick(c, o, t, { f0: 100, f1: 22, dur: 1.4, peak: 1, click: 0.4, drive: 2.5 });
    noise(c, o, t, { color: 'pink', dur: 1.6, peak: 0.5, a: 0.003, filter: { type: 'lowpass', f: 9000, f2: 120, ft: 1.4 }, send: { rev: 0.4 } });
    tone(c, o, t, { type: 'sawtooth', f: s.pitch || 220, f2: 30, ft: 1.2, dur: 1.3, peak: 0.12, unison: 3, spread: 30, filter: { type: 'lowpass', f: 1600, f2: 100, ft: 1.2 } });
    metal(c, o, t + 0.04, { f: 90, bp: 900, dur: 1.4, peak: 0.08, q: 6, send: { rev: 0.5 } });
  },

  // Ultimate: a riser through the cut-in, then the impact when play resumes.
  ultimate(c, o, t, s) {
    const d = s.delay || 1;
    noise(c, o, t, { dur: d, peak: 0.25, a: d * 0.95, filter: { type: 'bandpass', f: 300, f2: 8000, ft: d, q: 2 } });
    tone(c, o, t, { type: 'sawtooth', f: (s.pitch || 440) / 4, f2: s.pitch || 440, ft: d, dur: d, peak: 0.1, a: d * 0.8, unison: 3, spread: 20, filter: { type: 'lowpass', f: 600, f2: 6000, ft: d } });
    LIB.bomb(c, o, t + d, s);
    pad(c, o, t + d, { freqs: [1, 1.5, 2, 2.52].map((r) => (s.pitch || 440) / 2 * r), dur: 2.5, peak: 0.12, a: 0.01, cutoff: 8000, cutoff2: 600, unison: 3, send: { rev: 0.6 } });
  },

  cutin(c, o, t, s) {
    const d = s.delay || 1.5;
    noise(c, o, t, { dur: d, peak: 0.2, a: d * 0.9, filter: { type: 'bandpass', f: 200, f2: 5000, ft: d, q: 3 } });
    tone(c, o, t, { type: 'sawtooth', f: 41, dur: d + 1, peak: 0.2, a: 0.2, unison: 3, spread: 25, drive: 3, filter: { type: 'lowpass', f: 200, f2: 1500, ft: d } });
    LIB.explode3(c, o, t + d, { pan: 0 });
  },

  // ------------------------------------------------------------ Vincenzo
  // The Trumpet: deep brass blast, a semitone scoop up, cathedral tail.
  trumpet(c, o, t) {
    const chord = [34, 41, 46, 50, 53, 58]; // B♭ power + major, three octaves
    for (const n of chord) {
      tone(c, o, t, {
        type: 'sawtooth', f: hz(n - 1), f2: hz(n), ft: 0.12, dur: 1.6, peak: 0.07, a: 0.04, sus: 0.8, rel: 0.6,
        unison: 3, spread: 8, vib: { rate: 5.5, depth: 5, delay: 0.3 },
        filter: { type: 'lowpass', f: 300, f2: 3200, ft: 0.18, q: 2 }, send: { cath: 0.9 },
      });
    }
    kick(c, o, t, { f0: 90, f1: 25, dur: 1.5, peak: 0.9, click: 0.2, drive: 1.5 });
    noise(c, o, t, { dur: 0.6, peak: 0.15, a: 0.01, filter: { type: 'lowpass', f: 5000, f2: 300, ft: 0.6 }, send: { cath: 0.6 } });
  },
  voidSlash(c, o, t) {
    noise(c, o, t, { dur: 0.35, peak: 0.3, a: 0.005, filter: { type: 'bandpass', f: 6000, f2: 300, ft: 0.3, q: 3 }, send: { rev: 0.3 } });
    tone(c, o, t, { type: 'sawtooth', f: 60, f2: 30, dur: 0.6, peak: 0.18, drive: 4, filter: { type: 'lowpass', f: 500 } });
  },
  grab(c, o, t) {
    // Dark hands pull a target into the rift: a crunch, then it sinks away.
    LIB.explode2(c, o, t, { pan: 0 });
    tone(c, o, t, { type: 'sawtooth', f: 90, f2: 30, ft: 0.9, dur: 1, peak: 0.15, unison: 3, spread: 40, filter: { type: 'lowpass', f: 600, f2: 120, ft: 0.9 } });
    noise(c, o, t + 0.05, { color: 'brown', dur: 1, peak: 0.3, a: 0.02, filter: { type: 'lowpass', f: 1500, f2: 150, ft: 0.9 }, send: { rev: 0.4 } });
  },
  choir(c, o, t, s) {
    const v = s.volume ?? 1;
    pad(c, o, t, { freqs: [146.8, 220, 293.7, 370, 440, 587.3], dur: 2.6, peak: 0.2 * v, a: 0.35, unison: 3, spread: 7, formants: [[700, 1], [1150, 0.6]], send: { cath: 0.5 } });
  },

  // ------------------------------------------------------------ stage / boss
  warningBoss(c, o, t) {
    // Two-tone siren, three cycles, over sub hits.
    for (let k = 0; k < 6; k++) {
      tone(c, o, t + k * 0.42, { type: 'square', f: k % 2 ? 660 : 880, dur: 0.4, peak: 0.07, a: 0.01, sus: 0.9, rel: 0.05, filter: { type: 'bandpass', f: 1400, q: 1.2 }, send: { rev: 0.3 } });
      if (k % 2 === 0) kick(c, o, t + k * 0.42, { f0: 80, f1: 30, dur: 0.6, peak: 0.6, click: 0 });
    }
  },
  warningMid(c, o, t) {
    for (let k = 0; k < 3; k++) tone(c, o, t + k * 0.22, { type: 'square', f: 1240, dur: 0.12, peak: 0.06, filter: { type: 'lowpass', f: 3000 } });
  },
  bossIntro(c, o, t, s) {
    // "Braam": a giant detuned brass swell, low and wide.
    const root = s.root || 40;
    pad(c, o, t, { freqs: [hz(root - 12), hz(root - 5), hz(root)], dur: 2.8, peak: 0.25, a: 0.08, type: 'sawtooth', cutoff: 200, cutoff2: 1600, q: 3, unison: 3, spread: 18, send: { rev: 0.5 } });
    kick(c, o, t, { f0: 70, f1: 22, dur: 2, peak: 0.9, click: 0.1, drive: 2 });
  },
  phaseClear(c, o, t) {
    // Glass break into a chime cascade (bullets turn into score stars).
    noise(c, o, t, { dur: 0.5, peak: 0.25, a: 0.002, filter: { type: 'highpass', f: 3000 }, send: { rev: 0.4 } });
    for (let k = 0; k < 10; k++) fm(c, o, t + 0.05 + k * 0.045, { f: hz(84 + [0, 4, 7, 12, 16, 19, 24, 19, 16, 12][k]), ratio: 3.5, index: 1.2, dur: 0.5, peak: 0.045, pan: (k % 2 ? 0.4 : -0.4), send: { rev: 0.3 } });
    kick(c, o, t, { f0: 120, f1: 35, dur: 0.6, peak: 0.6 });
  },
  arenaShift(c, o, t, s) {
    // The arena crossfade: a long filtered whoosh.
    const d = s.dur || 1.6;
    noise(c, o, t, { color: 'pink', dur: d, peak: 0.2, a: d * 0.5, filter: { type: 'bandpass', f: 200, f2: 3000, ft: d, q: 1.5 }, send: { rev: 0.5 } });
  },
  stageIntro(c, o, t) {
    noise(c, o, t, { dur: 1.2, peak: 0.12, a: 0.6, filter: { type: 'bandpass', f: 400, f2: 4000, ft: 1.2, q: 2 } });
    metal(c, o, t + 1.1, { f: 300, bp: 5000, dur: 0.8, peak: 0.06, q: 2, send: { rev: 0.5 } });
  },
  tallyTick(c, o, t) { tone(c, o, t, { type: 'square', f: 1760, dur: 0.03, peak: 0.03 }); },

  // Bass drop for Cass's downbeat ring.
  bassDrop(c, o, t, s) {
    kick(c, o, t, { f0: 90, f1: 40, dur: 0.4, peak: 0.35, click: 0 });
    tone(c, o, t, { type: 'sawtooth', f: 55, dur: 0.35, peak: 0.06, filter: { type: 'lowpass', f: 900, f2: 120, ft: 0.3, q: 6 }, pan: s.pan });
  },

  // ------------------------------------------------------------ UI
  uiTick(c, o, t) {
    tone(c, o, t, { type: 'square', f: 1320, f2: 880, ft: 0.05, dur: 0.065, peak: 0.08, a: 0.004 });
  },
  uiConfirm(c, o, t) {
    [660, 990].forEach((f, i) => tone(c, o, t + i * 0.07, { type: 'triangle', f, dur: 0.2, peak: 0.1, a: 0.005 }));
  },
  uiBack(c, o, t) {
    [880, 587].forEach((f, i) => tone(c, o, t + i * 0.06, { type: 'triangle', f, dur: 0.15, peak: 0.08, a: 0.005 }));
  },
  hellWarning(c, o, t) {
    tone(c, o, t, { type: 'sawtooth', f: 55, dur: 1.2, peak: 0.16, unison: 2, spread: 100, drive: 6, filter: { type: 'lowpass', f: 2400, f2: 500, ft: 1 } });
    tone(c, o, t, { type: 'square', f: 620, f2: 200, ft: 1.1, dur: 1.15, peak: 0.06, drive: 6, filter: { type: 'lowpass', f: 2400, f2: 500, ft: 1 } });
  },
};

export const sfx = {
  /** Fire effect `id`. opts: {pan, delay, ...effect params}. */
  play(id, opts = {}) {
    const c = audioCtx();
    if (!c || c.state !== 'running') return;
    const fn = LIB[id];
    if (!fn) return;
    const now = c.currentTime;
    if (!allow(id, now)) return;
    stats.played[id] = (stats.played[id] || 0) + 1;
    try { fn(c, bus.sfxIn, now + 0.005 + (opts.at || 0), opts); } catch (err) { console.warn('sfx', id, err); }
  },

  /** The pilot's shot voice (throttled to the pilot's cadence). */
  shot(def, s) {
    const c = audioCtx();
    if (!c || c.state !== 'running') return;
    const v = PILOT_VOICES[def.id] || DEFAULT_VOICE;
    const now = c.currentTime, prev = last.get('shot') ?? -1;
    if (now - prev < v.gap) return;
    last.set('shot', now);
    stats.played.shot = (stats.played.shot || 0) + 1;
    v.shot(c, bus.sfxIn, now + 0.005, s);
  },

  special(def) {
    const c = audioCtx();
    if (!c || c.state !== 'running') return;
    const v = PILOT_VOICES[def.id] || DEFAULT_VOICE;
    stats.played.special = (stats.played.special || 0) + 1;
    v.special(c, bus.sfxIn, c.currentTime + 0.005);
  },

  pitchOf(def) { return (PILOT_VOICES[def.id] || DEFAULT_VOICE).pitch; },

  /** Sustained beam hum: on/off with a pitch; one persistent voice. */
  beam(on, f = 220) {
    const c = audioCtx();
    if (!c) return;
    let b = this._beam;
    if (!b && on) {
      b = this._beam = {};
      b.g = c.createGain(); b.g.gain.value = 0;
      b.lp = c.createBiquadFilter(); b.lp.type = 'lowpass'; b.lp.frequency.value = 1800; b.lp.Q.value = 4;
      b.o1 = c.createOscillator(); b.o1.type = 'sawtooth';
      b.o2 = c.createOscillator(); b.o2.type = 'sawtooth'; b.o2.detune.value = 14;
      b.lfo = c.createOscillator(); b.lfo.frequency.value = 18;
      const lg = c.createGain(); lg.gain.value = 500;
      b.lfo.connect(lg); lg.connect(b.lp.frequency);
      b.o1.connect(b.lp); b.o2.connect(b.lp); b.lp.connect(b.g); b.g.connect(bus.sfxIn);
      b.o1.start(); b.o2.start(); b.lfo.start();
      b.on = false;
    }
    if (!b) return;
    const t = c.currentTime;
    if (on) {
      b.o1.frequency.setTargetAtTime(f, t, 0.05);
      b.o2.frequency.setTargetAtTime(f * 1.5, t, 0.05);
    }
    if (on !== b.on) {
      b.on = on;
      b.g.gain.setTargetAtTime(on ? 0.045 : 0, t, on ? 0.02 : 0.06);
    }
  },

  /** Bomb: impact + underwater music sweep for the bomb's length. */
  bomb(def, seconds) {
    this.play('bomb', { pitch: this.pitchOf(def) });
    duck(Math.max(1, seconds), { music: 0.35, underwater: true });
  },

  /** Ultimate: riser over the cut-in, impact on release, music ducked. */
  ultimate(def, cutinSeconds, seconds) {
    this.play('ultimate', { pitch: this.pitchOf(def), delay: cutinSeconds });
    duck(cutinSeconds + Math.min(4, seconds), { music: 0.25, underwater: true, attack: 0.2 });
  },
};

export const SFX_IDS = Object.keys(LIB);
