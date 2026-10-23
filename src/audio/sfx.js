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
  cannonFire: [0.07, 2], shellImpact: [0.08, 2], mortarLaunch: [0.1, 2], railFire: [0.1, 1], railCharge: [0.3, 1],
  chuff: [0.06, 1], railClack: [0.09, 1], coupleClank: [0.12, 2], rocketLaunch: [0.06, 2], gatling: [0.05, 1],
  heavyCannon: [0.09, 2], sandBlast: [0.08, 2], steamVent: [0.25, 1], brakeScreech: [0.8, 1], trainHorn: [1.2, 1],
  drillGrind: [0.12, 1], trackClank: [0.1, 1], rockChip: [0.08, 2], auxPop: [0.06, 2], conveyor: [0.2, 2], cannonLoad: [0.3, 1],
  oreCannon: [0.08, 2], hydraulic: [0.3, 1], seismicCrack: [0.4, 1], seismicErupt: [0.1, 2], coreCharge: [1, 1], coreBlast: [0.6, 1],
  rockfall: [0.8, 1], boulderImpact: [0.08, 2], boreRev: [0.8, 1],
  engineRoar: [0.35, 1], tireScreech: [0.25, 1], turboSpool: [1.2, 1], turboBlast: [0.8, 1], rotaryCannon: [0.07, 1], autoCannon: [0.05, 2],
  barrierCrash: [0.5, 1], repairHum: [0.45, 1], turbineCharge: [1.2, 1], turbineDischarge: [0.8, 1],
  crawlerStep: [0.09, 2], crawlerLand: [0.25, 1], crawlerLeap: [0.4, 1], climbScrape: [0.3, 1], executionAlarm: [1.5, 1],
  navalGun: [0.08, 2], shipHorn: [2.5, 1], vlsLaunch: [0.1, 2], waterSplash: [0.08, 2], chargeSplash: [0.06, 2], depthCharge: [0.1, 2],
  ciws: [0.07, 1], thunder: [1.2, 1], shipEngine: [1.2, 1],
};

/** Per-pilot output: one persistent gain node per voice (its loudness trim, M7c). */
const outs = new Map();
function voiceOut(c, v) {
  if (!v.gain || v.gain === 1) return bus.sfxIn;
  let g = outs.get(v);
  if (!g || g.context !== c) {
    g = c.createGain();
    g.gain.value = v.gain;
    g.connect(bus.sfxIn);
    outs.set(v, g);
  }
  return g;
}

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

  // ------------------------------------------------------------ White Fang (siege tank)
  // Railgun: capacitor whine climbing to a crack-and-boom discharge.
  railCharge(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 160, f2: 2400, ft: 0.95, dur: 1.0, peak: 0.05, a: 0.2, filter: { type: 'bandpass', f: 800, f2: 5200, ft: 0.95, q: 5 }, pan: s.pan });
    tone(c, o, t, { type: 'sine', f: 55, f2: 110, ft: 0.95, dur: 1.0, peak: 0.12, a: 0.3, pan: s.pan });
  },
  railFire(c, o, t, s) {
    noise(c, o, t, { dur: 0.08, peak: 0.35, a: 0.001, filter: { type: 'highpass', f: 2500 }, pan: s.pan });
    kick(c, o, t, { f0: 180, f1: 34, dur: 0.7, peak: 0.85, click: 0.4, drive: 1.6 });
    tone(c, o, t, { type: 'sawtooth', f: 2600, f2: 180, ft: 0.35, dur: 0.45, peak: 0.07, filter: { type: 'lowpass', f: 6000, f2: 500, ft: 0.4 }, pan: s.pan, send: { rev: 0.35 } });
    metal(c, o, t + 0.02, { f: 90, bp: 2200, dur: 0.9, peak: 0.06, q: 4, pan: s.pan, send: { rev: 0.4 } });
  },
  mortarLaunch(c, o, t, s) {
    kick(c, o, t, { f0: 120, f1: 45, dur: 0.35, peak: 0.55, click: 0.15 });
    noise(c, o, t, { color: 'pink', dur: 0.5, peak: 0.18, a: 0.004, filter: { type: 'bandpass', f: 900, f2: 300, ft: 0.4, q: 1.2 }, pan: s.pan });
    tone(c, o, t + 0.05, { type: 'sine', f: 900, f2: 1500, ft: 0.6, dur: 0.7, peak: 0.02, pan: s.pan });
  },
  shellImpact(c, o, t, s) {
    LIB.explode1(c, o, t, s);
    noise(c, o, t + 0.04, { dur: 0.35, peak: 0.1, filter: { type: 'highpass', f: 4000, f2: 7000, ft: 0.3 }, pan: s.pan }); // ice shatter
    for (let k = 0; k < 4; k++) tone(c, o, t + 0.05 + k * 0.03, { type: 'sine', f: 2400 + Math.random() * 2400, dur: 0.12, peak: 0.015, pan: s.pan });
  },
  cannonFire(c, o, t, s) {
    kick(c, o, t, { f0: 200, f1: 70, dur: 0.16, peak: 0.3, click: 0.2 });
    noise(c, o, t, { dur: 0.14, peak: 0.12, a: 0.001, filter: { type: 'lowpass', f: 3000, f2: 600, ft: 0.12 }, pan: s.pan });
  },
  ramRev(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 38, f2: 95, ft: 0.9, dur: 1.1, peak: 0.16, a: 0.15, filter: { type: 'lowpass', f: 300, f2: 900, ft: 0.9 }, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 1.1, peak: 0.16, a: 0.3, filter: { type: 'lowpass', f: 500 } });
  },
  ramImpact(c, o, t, s) {
    LIB.explode2(c, o, t, s);
    metal(c, o, t, { f: 70, bp: 900, dur: 1.4, peak: 0.12, q: 6, send: { rev: 0.5 } });
    noise(c, o, t, { color: 'brown', dur: 1.2, peak: 0.3, a: 0.01, filter: { type: 'lowpass', f: 300, f2: 80, ft: 1.1 } });
  },
  avalanche(c, o, t) {
    noise(c, o, t, { color: 'brown', dur: 4.2, peak: 0.32, a: 1.3, filter: { type: 'lowpass', f: 220, f2: 520, ft: 3.5 } });
    noise(c, o, t + 0.8, { color: 'pink', dur: 3.4, peak: 0.08, a: 1.2, filter: { type: 'bandpass', f: 1200, q: 0.8 }, send: { rev: 0.3 } });
  },

  // ------------------------------------------------------------ Sandbreaker (siege train)
  // Exhaust beat: one chuff per quarter turn of the drivers (s.v = load 0..1).
  chuff(c, o, t, s) {
    const v = s.v ?? 0.6;
    noise(c, o, t, { color: 'brown', dur: 0.22, peak: 0.05 + 0.09 * v, a: 0.004, filter: { type: 'lowpass', f: 420 + 500 * v, f2: 160, ft: 0.2 }, pan: s.pan });
    noise(c, o, t, { color: 'pink', dur: 0.16, peak: 0.02 + 0.03 * v, a: 0.002, filter: { type: 'bandpass', f: 1400, q: 1.2 }, pan: s.pan });
  },
  // Wheels over a rail joint: a double "clack-clack".
  railClack(c, o, t, s) {
    for (const d of [0, 0.075]) metal(c, o, t + d, { f: 320, bp: 2600, dur: 0.07, peak: 0.022 * (s.v ?? 1), q: 3, pan: s.pan });
  },
  coupleClank(c, o, t, s) {
    metal(c, o, t, { f: 140, bp: 1500, dur: 0.35, peak: 0.07, q: 5, pan: s.pan, send: { rev: 0.25 } });
    kick(c, o, t, { f0: 160, f1: 70, dur: 0.12, peak: 0.18, click: 0.2 });
  },
  trainHorn(c, o, t, s) {
    for (const f of [110, 138.6, 164.8]) tone(c, o, t, { type: 'sawtooth', f, dur: 1.5, peak: 0.05, a: 0.08, filter: { type: 'lowpass', f: 900, f2: 1400, ft: 0.3 }, pan: s.pan, send: { rev: 0.45 } });
    tone(c, o, t, { type: 'sine', f: 55, dur: 1.5, peak: 0.12, a: 0.1, pan: s.pan });
  },
  brakeScreech(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 2900, f2: 2200, ft: 1.2, dur: 1.3, peak: 0.022, a: 0.06, filter: { type: 'bandpass', f: 3200, q: 9 }, pan: s.pan, send: { rev: 0.3 } });
    noise(c, o, t, { color: 'pink', dur: 1.3, peak: 0.07, a: 0.05, filter: { type: 'bandpass', f: 4200, q: 3 }, pan: s.pan });
  },
  steamVent(c, o, t, s) {
    noise(c, o, t, { color: 'white', dur: 0.9, peak: 0.07, a: 0.02, filter: { type: 'highpass', f: 2600, f2: 1600, ft: 0.8 }, pan: s.pan, send: { rev: 0.2 } });
  },
  rocketLaunch(c, o, t, s) {
    noise(c, o, t, { color: 'pink', dur: 0.6, peak: 0.12, a: 0.01, filter: { type: 'bandpass', f: 500, f2: 2600, ft: 0.5, q: 1.4 }, pan: s.pan });
    kick(c, o, t, { f0: 130, f1: 60, dur: 0.15, peak: 0.2, click: 0.1 });
  },
  gatling(c, o, t, s) {
    for (let k = 0; k < 3; k++) noise(c, o, t + k * 0.03, { dur: 0.03, peak: 0.07, a: 0.001, filter: { type: 'bandpass', f: 1800, q: 1.5 }, pan: s.pan });
  },
  heavyCannon(c, o, t, s) {
    kick(c, o, t, { f0: 150, f1: 30, dur: 0.7, peak: 0.8, click: 0.35, drive: 1.6 });
    noise(c, o, t, { color: 'pink', dur: 0.6, peak: 0.25, a: 0.002, filter: { type: 'lowpass', f: 5000, f2: 300, ft: 0.5 }, pan: s.pan, send: { rev: 0.35 } });
    metal(c, o, t + 0.02, { f: 80, bp: 1600, dur: 0.6, peak: 0.04, q: 4, pan: s.pan, send: { rev: 0.4 } });
  },
  sandBlast(c, o, t, s) {
    LIB.explode1(c, o, t, s);
    noise(c, o, t + 0.05, { color: 'brown', dur: 0.8, peak: 0.16, a: 0.02, filter: { type: 'lowpass', f: 900, f2: 200, ft: 0.7 }, pan: s.pan });
  },
  engineFail(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 140, f2: 30, ft: 2.4, dur: 2.6, peak: 0.12, a: 0.05, filter: { type: 'lowpass', f: 700, f2: 150, ft: 2.4 }, pan: s.pan });
    LIB.steamVent(c, o, t + 0.3, s);
    LIB.brakeScreech(c, o, t + 0.1, s);
  },

  // ------------------------------------------------------------ Iron Vein (mining fortress)
  // Cutter in the rock: a low grinding rumble, grit, a metallic squeal (s.v = load 0..1).
  drillGrind(c, o, t, s) {
    const v = s.v ?? 0.6;
    noise(c, o, t, { color: 'brown', dur: 0.5, peak: 0.08 + 0.1 * v, a: 0.05, filter: { type: 'lowpass', f: 260 + 300 * v }, pan: s.pan });
    noise(c, o, t, { color: 'pink', dur: 0.45, peak: 0.02 + 0.04 * v, a: 0.04, filter: { type: 'bandpass', f: 1600 + 900 * v, q: 2 }, pan: s.pan });
    tone(c, o, t, { type: 'sawtooth', f: 55 + 30 * v, f2: 60 + 34 * v, ft: 0.4, dur: 0.5, peak: 0.04 + 0.04 * v, a: 0.05, filter: { type: 'lowpass', f: 400 }, pan: s.pan });
    if (v > 0.5) metal(c, o, t + 0.1, { f: 380, bp: 3200, dur: 0.25, peak: 0.012 * v, q: 8, pan: s.pan });
  },
  trackClank(c, o, t, s) {
    const v = s.v ?? 0.5;
    metal(c, o, t, { f: 110, bp: 900, dur: 0.14, peak: 0.03 + 0.04 * v, q: 4, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 0.2, peak: 0.04 * v, a: 0.005, filter: { type: 'lowpass', f: 300 }, pan: s.pan });
  },
  rockChip(c, o, t, s) {
    noise(c, o, t, { dur: 0.09, peak: 0.1, a: 0.001, filter: { type: 'bandpass', f: 1400, q: 1.4 }, pan: s.pan });
    kick(c, o, t, { f0: 140, f1: 60, dur: 0.12, peak: 0.16, click: 0.15 });
  },
  auxPop(c, o, t, s) {
    kick(c, o, t, { f0: 260, f1: 90, dur: 0.09, peak: 0.18, click: 0.25 });
    noise(c, o, t, { dur: 0.06, peak: 0.07, a: 0.001, filter: { type: 'highpass', f: 1800 }, pan: s.pan });
  },
  conveyor(c, o, t, s) {
    for (let k = 0; k < 5; k++) metal(c, o, t + k * 0.05, { f: 210, bp: 1300, dur: 0.05, peak: 0.016, q: 3, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 0.32, peak: 0.06, a: 0.02, filter: { type: 'lowpass', f: 500 }, pan: s.pan });
  },
  cannonLoad(c, o, t, s) {
    metal(c, o, t, { f: 120, bp: 1100, dur: 0.25, peak: 0.06, q: 5, pan: s.pan });
    tone(c, o, t + 0.08, { type: 'sawtooth', f: 90, f2: 420, ft: 0.45, dur: 0.5, peak: 0.03, filter: { type: 'lowpass', f: 1500 }, pan: s.pan });
  },
  oreCannon(c, o, t, s) {
    kick(c, o, t, { f0: 140, f1: 32, dur: 0.6, peak: 0.7, click: 0.3, drive: 1.5 });
    noise(c, o, t, { color: 'pink', dur: 0.5, peak: 0.2, a: 0.002, filter: { type: 'lowpass', f: 4200, f2: 260, ft: 0.45 }, pan: s.pan, send: { rev: 0.3 } });
    noise(c, o, t + 0.04, { dur: 0.2, peak: 0.05, filter: { type: 'bandpass', f: 2200, q: 1 }, pan: s.pan });
  },
  hydraulic(c, o, t, s) {
    noise(c, o, t, { color: 'white', dur: 0.6, peak: 0.05, a: 0.03, filter: { type: 'bandpass', f: 3000, f2: 1800, ft: 0.5, q: 2 }, pan: s.pan });
    tone(c, o, t, { type: 'triangle', f: 160, f2: 110, ft: 0.6, dur: 0.6, peak: 0.05, a: 0.05, pan: s.pan });
  },
  seismicCrack(c, o, t, s) {
    noise(c, o, t, { color: 'brown', dur: 1.6, peak: 0.28, a: 0.25, filter: { type: 'lowpass', f: 160, f2: 320, ft: 1.2 }, pan: s.pan });
    for (let k = 0; k < 6; k++) noise(c, o, t + 0.2 + k * 0.17, { dur: 0.05, peak: 0.07, a: 0.001, filter: { type: 'bandpass', f: 900 + k * 200, q: 2 }, pan: s.pan });
  },
  seismicErupt(c, o, t, s) {
    LIB.explode1(c, o, t, s);
    noise(c, o, t + 0.03, { color: 'brown', dur: 0.6, peak: 0.16, a: 0.01, filter: { type: 'lowpass', f: 700, f2: 180, ft: 0.5 }, pan: s.pan });
  },
  coreCharge(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 40, f2: 160, ft: 1.6, dur: 1.7, peak: 0.12, a: 0.3, filter: { type: 'lowpass', f: 300, f2: 1600, ft: 1.6 }, pan: s.pan, send: { rev: 0.3 } });
    tone(c, o, t, { type: 'sine', f: 220, f2: 880, ft: 1.6, dur: 1.7, peak: 0.03, a: 0.4, pan: s.pan });
    noise(c, o, t, { color: 'pink', dur: 1.7, peak: 0.05, a: 0.8, filter: { type: 'bandpass', f: 1200, q: 1 }, pan: s.pan });
  },
  coreBlast(c, o, t, s) {
    LIB.explode3(c, o, t, s);
    tone(c, o, t, { type: 'sine', f: 70, f2: 28, ft: 1.2, dur: 1.4, peak: 0.3, a: 0.005, pan: s.pan });
  },
  rockfall(c, o, t, s) {
    noise(c, o, t, { color: 'brown', dur: 2.2, peak: 0.22, a: 0.4, filter: { type: 'lowpass', f: 260, f2: 480, ft: 1.8 }, pan: s.pan });
    for (let k = 0; k < 8; k++) noise(c, o, t + 0.15 + k * 0.2, { dur: 0.05, peak: 0.05, a: 0.001, filter: { type: 'bandpass', f: 1200 + (k % 3) * 400, q: 2 }, pan: s.pan });
  },
  boulderImpact(c, o, t, s) {
    kick(c, o, t, { f0: 110, f1: 30, dur: 0.5, peak: 0.6, click: 0.2, drive: 1.3 });
    noise(c, o, t, { color: 'brown', dur: 0.7, peak: 0.2, a: 0.004, filter: { type: 'lowpass', f: 900, f2: 160, ft: 0.6 }, pan: s.pan });
    noise(c, o, t + 0.02, { dur: 0.18, peak: 0.07, filter: { type: 'bandpass', f: 1800, q: 1 }, pan: s.pan });
  },
  boreRev(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 32, f2: 110, ft: 1.2, dur: 1.4, peak: 0.16, a: 0.2, filter: { type: 'lowpass', f: 260, f2: 1100, ft: 1.2 }, pan: s.pan });
    tone(c, o, t + 0.3, { type: 'square', f: 70, f2: 240, ft: 1.0, dur: 1.1, peak: 0.03, a: 0.3, filter: { type: 'bandpass', f: 900, q: 3 }, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 1.4, peak: 0.16, a: 0.4, filter: { type: 'lowpass', f: 420 } });
  },

  // ------------------------------------------------------------ Urban Devastator (pursuit supercar)
  // V-twin-ish roar: detuned saws through a sweeping lowpass (s.v = throttle 0..1).
  engineRoar(c, o, t, s) {
    const v = s.v ?? 0.5;
    for (const d of [0, 0.7]) tone(c, o, t, { type: 'sawtooth', f: 46 + 30 * v + d, f2: 60 + 50 * v + d, ft: 0.5, dur: 0.6, peak: 0.05 + 0.06 * v, a: 0.06, filter: { type: 'lowpass', f: 300 + 500 * v, f2: 500 + 900 * v, ft: 0.5 }, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 0.55, peak: 0.05 + 0.06 * v, a: 0.05, filter: { type: 'lowpass', f: 400 + 300 * v }, pan: s.pan });
  },
  tireScreech(c, o, t, s) {
    const v = s.v ?? 0.7;
    tone(c, o, t, { type: 'sawtooth', f: 1900, f2: 1500, ft: 0.4, dur: 0.45, peak: 0.016 * v, a: 0.03, filter: { type: 'bandpass', f: 2300, q: 7 }, pan: s.pan });
    noise(c, o, t, { color: 'pink', dur: 0.45, peak: 0.06 * v, a: 0.03, filter: { type: 'bandpass', f: 2800, q: 2.5 }, pan: s.pan });
  },
  turboSpool(c, o, t, s) {
    tone(c, o, t, { type: 'sine', f: 400, f2: 3800, ft: 1.4, dur: 1.6, peak: 0.05, a: 0.2, pan: s.pan, send: { rev: 0.3 } });
    tone(c, o, t, { type: 'sawtooth', f: 60, f2: 160, ft: 1.4, dur: 1.6, peak: 0.08, a: 0.3, filter: { type: 'lowpass', f: 400, f2: 1400, ft: 1.4 }, pan: s.pan });
  },
  turboBlast(c, o, t, s) {
    kick(c, o, t, { f0: 110, f1: 40, dur: 0.5, peak: 0.5, click: 0.2, drive: 1.4 });
    noise(c, o, t, { color: 'pink', dur: 1.1, peak: 0.2, a: 0.01, filter: { type: 'bandpass', f: 800, f2: 3000, ft: 0.6, q: 0.9 }, pan: s.pan, send: { rev: 0.3 } });
    tone(c, o, t, { type: 'sawtooth', f: 70, f2: 150, ft: 0.8, dur: 1, peak: 0.1, a: 0.02, filter: { type: 'lowpass', f: 700 }, pan: s.pan });
  },
  rotaryCannon(c, o, t, s) {
    for (let k = 0; k < 5; k++) noise(c, o, t + k * 0.022, { dur: 0.02, peak: 0.06, a: 0.001, filter: { type: 'bandpass', f: 2200, q: 1.8 }, pan: s.pan });
    tone(c, o, t, { type: 'square', f: 180, dur: 0.12, peak: 0.02, a: 0.005, filter: { type: 'lowpass', f: 900 }, pan: s.pan });
  },
  autoCannon(c, o, t, s) {
    kick(c, o, t, { f0: 240, f1: 90, dur: 0.1, peak: 0.18, click: 0.25 });
    noise(c, o, t, { dur: 0.08, peak: 0.08, a: 0.001, filter: { type: 'bandpass', f: 1500, q: 1.2 }, pan: s.pan });
  },
  barrierCrash(c, o, t, s) {
    LIB.explode2(c, o, t, s);
    metal(c, o, t, { f: 90, bp: 1400, dur: 1.0, peak: 0.12, q: 5, pan: s.pan, send: { rev: 0.4 } });
    for (let k = 0; k < 6; k++) noise(c, o, t + 0.05 + k * 0.07, { color: 'pink', dur: 0.12, peak: 0.08, a: 0.002, filter: { type: 'bandpass', f: 900 + k * 300, q: 2 }, pan: s.pan });
  },
  repairHum(c, o, t, s) {
    for (const f of [330, 495, 660]) tone(c, o, t, { type: 'sine', f, f2: f * 1.02, ft: 0.5, dur: 0.6, peak: 0.025, a: 0.15, pan: s.pan, send: { rev: 0.5 } });
    noise(c, o, t, { color: 'white', dur: 0.5, peak: 0.02, a: 0.1, filter: { type: 'bandpass', f: 5200, q: 4 }, pan: s.pan });
  },
  turbineCharge(c, o, t, s) {
    tone(c, o, t, { type: 'sawtooth', f: 90, f2: 900, ft: 1.4, dur: 1.5, peak: 0.07, a: 0.3, filter: { type: 'lowpass', f: 600, f2: 3000, ft: 1.4 }, pan: s.pan });
    tone(c, o, t, { type: 'sine', f: 600, f2: 2400, ft: 1.4, dur: 1.5, peak: 0.04, a: 0.4, pan: s.pan, send: { rev: 0.4 } });
  },
  turbineDischarge(c, o, t, s) {
    kick(c, o, t, { f0: 160, f1: 28, dur: 0.9, peak: 0.85, click: 0.4, drive: 1.8 });
    noise(c, o, t, { color: 'white', dur: 0.9, peak: 0.26, a: 0.002, filter: { type: 'lowpass', f: 9000, f2: 600, ft: 0.8 }, pan: s.pan, send: { rev: 0.5 } });
    tone(c, o, t, { type: 'square', f: 1400, f2: 120, ft: 0.6, dur: 0.7, peak: 0.05, a: 0.002, filter: { type: 'bandpass', f: 1800, q: 1.5 }, pan: s.pan });
  },

  // ------------------------------------------------------------ Colossus Crawler (eight-legged siege machine)
  // Heavy footfall: a low thud, a metal clank of the foot pad, grit (s.v = weight 0..1).
  crawlerStep(c, o, t, s) {
    const v = s.v ?? 0.6;
    kick(c, o, t, { f0: 90, f1: 34, dur: 0.32, peak: 0.25 + 0.3 * v, click: 0.1, drive: 1.2 });
    metal(c, o, t + 0.01, { f: 140, bp: 900, dur: 0.25, peak: 0.03 + 0.03 * v, q: 6, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 0.3, peak: 0.06 * v, a: 0.004, filter: { type: 'lowpass', f: 600 }, pan: s.pan });
  },
  crawlerLand(c, o, t, s) {
    const v = s.v ?? 1;
    kick(c, o, t, { f0: 120, f1: 22, dur: 1.0, peak: 0.9 * v, click: 0.4, drive: 1.8 });
    LIB.explode2(c, o, t, s);
    metal(c, o, t + 0.02, { f: 70, bp: 700, dur: 1.2, peak: 0.1 * v, q: 4, pan: s.pan, send: { rev: 0.5 } });
    noise(c, o, t, { color: 'brown', dur: 1.4, peak: 0.25 * v, a: 0.01, filter: { type: 'lowpass', f: 900, f2: 140, ft: 1.2 }, pan: s.pan });
  },
  crawlerLeap(c, o, t, s) {
    kick(c, o, t, { f0: 80, f1: 40, dur: 0.5, peak: 0.5, click: 0.2, drive: 1.3 });
    noise(c, o, t, { color: 'pink', dur: 0.9, peak: 0.16, a: 0.02, filter: { type: 'bandpass', f: 500, f2: 2200, ft: 0.7, q: 0.8 }, pan: s.pan, send: { rev: 0.3 } });
    tone(c, o, t, { type: 'sawtooth', f: 60, f2: 140, ft: 0.6, dur: 0.7, peak: 0.08, a: 0.03, filter: { type: 'lowpass', f: 600 }, pan: s.pan });
  },
  climbScrape(c, o, t, s) {
    noise(c, o, t, { color: 'pink', dur: 0.6, peak: 0.07, a: 0.05, filter: { type: 'bandpass', f: 1400, q: 1.5 }, pan: s.pan });
    for (let k = 0; k < 4; k++) noise(c, o, t + 0.1 + k * 0.12, { dur: 0.05, peak: 0.05, a: 0.001, filter: { type: 'bandpass', f: 900 + k * 300, q: 2 }, pan: s.pan });
  },
  // Klaxon: two alternating tones, three times.
  executionAlarm(c, o, t, s) {
    for (let k = 0; k < 6; k++) tone(c, o, t + k * 0.2, { type: 'square', f: k & 1 ? 620 : 880, dur: 0.18, peak: 0.05, a: 0.01, filter: { type: 'lowpass', f: 2400 }, pan: s.pan, send: { rev: 0.3 } });
  },

  // ------------------------------------------------------------ Coral Siege (battleship)
  // Main gun: a deep concussive boom, a blast of air, a long rolling rumble across the water.
  navalGun(c, o, t, s) {
    const v = s.v ?? 1;
    kick(c, o, t, { f0: 120, f1: 22, dur: 1.1, peak: 0.95 * v, click: 0.45, drive: 2 });
    noise(c, o, t, { color: 'pink', dur: 0.7, peak: 0.3 * v, a: 0.002, filter: { type: 'lowpass', f: 4200, f2: 220, ft: 0.6 }, pan: s.pan, send: { rev: 0.45 } });
    noise(c, o, t + 0.08, { color: 'brown', dur: 1.8, peak: 0.16 * v, a: 0.1, filter: { type: 'lowpass', f: 320, f2: 90, ft: 1.6 }, pan: s.pan, send: { rev: 0.5 } });
  },
  shipHorn(c, o, t, s) {
    const v = s.v ?? 1;
    for (const f of [73, 110, 146.5]) tone(c, o, t, { type: 'sawtooth', f, dur: 1.9, peak: 0.05 * v, a: 0.15, filter: { type: 'lowpass', f: 700 }, pan: s.pan, send: { rev: 0.6 } });
  },
  vlsLaunch(c, o, t, s) {
    noise(c, o, t, { color: 'white', dur: 0.25, peak: 0.12, a: 0.002, filter: { type: 'highpass', f: 1800 }, pan: s.pan });
    kick(c, o, t + 0.12, { f0: 110, f1: 50, dur: 0.3, peak: 0.35, click: 0.1 });
    noise(c, o, t + 0.12, { color: 'pink', dur: 1.0, peak: 0.16, a: 0.03, filter: { type: 'bandpass', f: 600, f2: 2400, ft: 0.8, q: 1.2 }, pan: s.pan, send: { rev: 0.3 } });
  },
  waterSplash(c, o, t, s) {
    kick(c, o, t, { f0: 100, f1: 40, dur: 0.45, peak: 0.5, click: 0.15 });
    noise(c, o, t, { color: 'white', dur: 0.9, peak: 0.2, a: 0.004, filter: { type: 'bandpass', f: 2600, f2: 700, ft: 0.8, q: 0.8 }, pan: s.pan, send: { rev: 0.3 } });
  },
  chargeSplash(c, o, t, s) {
    noise(c, o, t, { color: 'white', dur: 0.35, peak: 0.08, a: 0.002, filter: { type: 'bandpass', f: 1800, q: 1 }, pan: s.pan });
  },
  // Depth charge: a muffled underwater thud, then the dome of water breaking the surface.
  depthCharge(c, o, t, s) {
    kick(c, o, t, { f0: 70, f1: 24, dur: 1.0, peak: 0.85, click: 0.05, drive: 1.6 });
    noise(c, o, t, { color: 'brown', dur: 0.6, peak: 0.25, a: 0.01, filter: { type: 'lowpass', f: 260 } });
    noise(c, o, t + 0.18, { color: 'white', dur: 1.3, peak: 0.2, a: 0.03, filter: { type: 'bandpass', f: 2200, f2: 600, ft: 1.2, q: 0.7 }, pan: s.pan, send: { rev: 0.4 } });
  },
  ciws(c, o, t, s) {
    for (let k = 0; k < 5; k++) noise(c, o, t + k * 0.018, { dur: 0.02, peak: 0.06, a: 0.001, filter: { type: 'bandpass', f: 2400, q: 1.6 }, pan: s.pan });
  },
  thunder(c, o, t, s) {
    noise(c, o, t, { color: 'white', dur: 0.15, peak: 0.12, a: 0.001, filter: { type: 'highpass', f: 1500 }, pan: s.pan });
    noise(c, o, t + 0.05, { color: 'brown', dur: 2.6, peak: 0.4, a: 0.05, filter: { type: 'lowpass', f: 420, f2: 70, ft: 2.4 }, pan: s.pan, send: { rev: 0.6 } });
  },
  shipEngine(c, o, t, s) {
    const v = s.v ?? 0.6;
    tone(c, o, t, { type: 'sawtooth', f: 38, f2: 41, ft: 1.4, dur: 1.5, peak: 0.05 * v, a: 0.3, filter: { type: 'lowpass', f: 180 }, pan: s.pan });
    noise(c, o, t, { color: 'brown', dur: 1.5, peak: 0.05 * v, a: 0.3, filter: { type: 'lowpass', f: 300 }, pan: s.pan });
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
  // Enemy volleys speak the owning faction's weapon language (M7c, §4.5):
  // slug thunks, needle zips, torpedo pops, Helix zaps, glass pings, void thuds.
  enemyShot(c, o, t, s) {
    const p = s.pan || 0;
    switch (s.style) {
      case 'ironclad': tone(c, o, t, { type: 'square', f: 220, f2: 90, dur: 0.06, peak: 0.03, filter: { type: 'lowpass', f: 900 }, pan: p }); break;
      case 'stratos': tone(c, o, t, { type: 'sawtooth', f: 2400, f2: 900, ft: 0.04, dur: 0.045, peak: 0.015, filter: { type: 'bandpass', f: 2600, q: 2 }, pan: p }); break;
      case 'blacktide': tone(c, o, t, { type: 'sine', f: 300, f2: 700, ft: 0.05, dur: 0.06, peak: 0.035, pan: p }); break;
      case 'helix': tone(c, o, t, { type: 'pulse12', f: 1500, f2: 600, ft: 0.04, dur: 0.045, peak: 0.018, pan: p }); break;
      case 'outerstar': fm(c, o, t, { f: 1900, ratio: 1.41, index: 1.2, dur: 0.12, peak: 0.02, pan: p }); break;
      case 'drowned': tone(c, o, t, { type: 'sine', f: 140, f2: 70, dur: 0.12, peak: 0.04, pan: p }); break;
      default: tone(c, o, t, { type: 'triangle', f: 520, f2: 320, dur: 0.05, peak: 0.025, pan: p });
    }
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
    v.shot(c, voiceOut(c, v), now + 0.005, s);
  },

  special(def) {
    const c = audioCtx();
    if (!c || c.state !== 'running') return;
    const v = PILOT_VOICES[def.id] || DEFAULT_VOICE;
    stats.played.special = (stats.played.special || 0) + 1;
    v.special(c, bus.sfxIn, c.currentTime + 0.005); // the gain trim is for the shot voice only
  },

  pitchOf(def) { return (PILOT_VOICES[def.id] || DEFAULT_VOICE).pitch; },

  /** Play a pilot voice's own omb / ultimate sound if it has one. */
  voiceFx(def, kind, s) {
    const v = PILOT_VOICES[def.id], fn = v && v[kind];
    if (!fn) return false;
    const c = audioCtx();
    if (!c || c.state !== 'running') return true;
    stats.played[kind] = (stats.played[kind] || 0) + 1;
    try { fn.call(v, c, bus.sfxIn, c.currentTime + 0.005, s); } catch (err) { console.warn('sfx', kind, err); }
    return true;
  },

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
    // A pilot voice may bring its own bomb sound (e.g. Oduya's thunderstorm).
    if (!this.voiceFx(def, 'bomb', { dur: seconds })) this.play('bomb', { pitch: this.pitchOf(def) });
    duck(Math.max(1, seconds), { music: 0.35, underwater: true });
  },

  /** Ultimate: riser over the cut-in, impact on release, music ducked. */
  ultimate(def, cutinSeconds, seconds) {
    if (!this.voiceFx(def, 'ultimate', { delay: cutinSeconds, dur: seconds })) this.play('ultimate', { pitch: this.pitchOf(def), delay: cutinSeconds });
    // A pilot's own (long) ultimate sound keeps the music ducked for its whole length.
    const hold = PILOT_VOICES[def.id] && PILOT_VOICES[def.id].ultimate ? seconds : Math.min(4, seconds);
    duck(cutinSeconds + hold, { music: 0.25, underwater: true, attack: 0.2 });
  },
};

export const SFX_IDS = Object.keys(LIB);
