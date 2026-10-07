// Synth voice primitives shared by the SFX library and the music sequencer.
//
// Every voice is fire-and-forget: it builds a tiny node graph, schedules its
// envelope at time `t` (AudioContext seconds), and lets the nodes stop and be
// collected. `out` is the destination node; `send` optionally routes a copy
// into reverb / echo buses: { rev, cath, echo } amounts 0..1.

import { buf, bus, stats, driveCurve } from './engine.js';

const waves = new WeakMap();

/** Cached PeriodicWaves: 'pulse25', 'pulse12', 'organ', 'reed'. */
export function wave(c, name) {
  let m = waves.get(c);
  if (!m) { m = {}; waves.set(c, m); }
  if (m[name]) return m[name];
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    if (name === 'pulse25' || name === 'pulse12') {
      const d = name === 'pulse25' ? 0.25 : 0.125;
      im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
    } else if (name === 'organ') {
      im[k] = [0, 1, 0.6, 0.25, 0.4, 0, 0.15, 0, 0.2][k] || 0;
    } else if (name === 'reed') {
      // Odd-heavy, bright: an accordion / shanty reed.
      im[k] = (k % 2 ? 1 : 0.35) / Math.pow(k, 0.9);
    } else if (name === 'glass') {
      im[k] = [0, 1, 0, 0.5, 0, 0, 0, 0.35, 0, 0, 0, 0.12][k] || 0;
    }
  }
  m[name] = c.createPeriodicWave(re, im);
  return m[name];
}

function setWave(c, o, type) {
  if (type === 'sine' || type === 'square' || type === 'sawtooth' || type === 'triangle') o.type = type;
  else o.setPeriodicWave(wave(c, type));
}

/** Count live voices for the stats readout. */
function track(node, stopAt) {
  stats.voices++;
  node.onended = () => { stats.voices--; };
  node.stop(stopAt);
}

function sends(c, node, send) {
  if (!send) return;
  if (send.rev) { const g = c.createGain(); g.gain.value = send.rev; node.connect(g); g.connect(send.music ? bus.reverbMusic : bus.reverbSfx); }
  if (send.cath) { const g = c.createGain(); g.gain.value = send.cath; node.connect(g); g.connect(bus.cathedralSend); }
  if (send.echo) { const g = c.createGain(); g.gain.value = send.echo; node.connect(g); g.connect(bus.delaySend); }
}

/**
 * Amplitude envelope gain node: attack to `peak`, then exponential decay to
 * silence over `dur` (or hold `sus` until `dur - rel` then release).
 */
export function envelope(c, t, { peak = 0.3, a = 0.005, dur = 0.2, sus = 0, rel = 0.08 }) {
  const g = c.createGain(), gg = g.gain;
  gg.setValueAtTime(0.0001, t);
  gg.linearRampToValueAtTime(peak, t + a);
  if (sus > 0) {
    gg.setTargetAtTime(peak * sus, t + a, Math.max(0.01, (dur - a) * 0.15));
    gg.setValueAtTime(peak * sus, t + Math.max(a, dur - rel));
    gg.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    gg.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.005, dur));
  }
  return g;
}

function filterNode(c, t, f, dur) {
  if (!f) return null;
  const n = c.createBiquadFilter();
  n.type = f.type || 'lowpass';
  n.Q.value = f.q ?? 0.8;
  n.frequency.setValueAtTime(f.f, t);
  if (f.f2) n.frequency.exponentialRampToValueAtTime(f.f2, t + (f.ft ?? dur));
  if (f.gain !== undefined) n.gain.value = f.gain;
  return n;
}

/**
 * Oscillator voice.
 * { type, f, f2 (glide target), ft (glide time), dur, peak, a, sus, rel,
 *   detune (cents), unison (n voices spread by `spread` cents), vib {rate, depth},
 *   filter {type, f, f2, ft, q}, drive, pan, send }
 */
export function tone(c, out, t, o) {
  const dur = o.dur ?? 0.2;
  const env = envelope(c, t, o);
  let head = env;
  const filt = filterNode(c, t, o.filter, dur);
  if (filt) { filt.connect(head); head = filt; }
  if (o.drive) {
    const sh = c.createWaveShaper();
    sh.curve = driveCurve(o.drive);
    sh.connect(head); head = sh;
  }
  const n = o.unison || 1, spread = o.spread ?? 12;
  let vib = null;
  if (o.vib) {
    vib = c.createOscillator();
    vib.frequency.value = o.vib.rate;
    const vg = c.createGain(); vg.gain.value = o.vib.depth;
    vib.connect(vg);
    vib.vg = vg;
    vib.start(t + (o.vib.delay || 0));
    vib.stop(t + dur + 0.05);
  }
  const lvl = n > 1 ? 1 / Math.sqrt(n) : 1;
  const mix = c.createGain();
  mix.gain.value = lvl;
  mix.connect(head);
  for (let k = 0; k < n; k++) {
    const osc = c.createOscillator();
    setWave(c, osc, o.type || 'sine');
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) {
      if (o.lin) osc.frequency.linearRampToValueAtTime(o.f2, t + (o.ft ?? dur));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.ft ?? dur));
    }
    osc.detune.value = (o.detune || 0) + (n > 1 ? (k / (n - 1) - 0.5) * 2 * spread : 0);
    if (vib) vib.vg.connect(osc.frequency);
    osc.connect(mix);
    osc.start(t);
    track(osc, t + dur + 0.05);
  }
  let tail = env;
  if (o.pan) {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    env.connect(p); tail = p;
  }
  tail.connect(out);
  sends(c, tail, o.send);
  return env;
}

/**
 * Filtered noise voice.
 * { color: 'white'|'pink'|'brown', dur, peak, a, sus, rel, filter, rate, pan, send }
 */
export function noise(c, out, t, o) {
  const dur = o.dur ?? 0.2;
  const src = c.createBufferSource();
  src.buffer = buf[o.color || 'white'];
  src.loop = true;
  src.playbackRate.value = o.rate || 1;
  const env = envelope(c, t, o);
  const filt = filterNode(c, t, o.filter, dur);
  if (filt) { src.connect(filt); filt.connect(env); } else src.connect(env);
  let tail = env;
  if (o.pan) {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    env.connect(p); tail = p;
  }
  tail.connect(out);
  sends(c, tail, o.send);
  src.start(t, Math.random() * 1.5);
  track(src, t + dur + 0.05);
  return env;
}

/**
 * Two-operator FM voice (bells, glass, alien chimes).
 * { f, ratio, index, dur, peak, a, decayIndex, send }
 */
export function fm(c, out, t, o) {
  const dur = o.dur ?? 1;
  const car = c.createOscillator(), mod = c.createOscillator();
  car.frequency.value = o.f;
  mod.frequency.value = o.f * (o.ratio ?? 3.5);
  const mg = c.createGain();
  const idx = (o.index ?? 4) * o.f;
  mg.gain.setValueAtTime(idx, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * (o.decayIndex ?? 0.05)), t + dur);
  mod.connect(mg); mg.connect(car.frequency);
  if (o.f2) car.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const env = envelope(c, t, o);
  car.connect(env);
  let tail = env;
  if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; env.connect(p); tail = p; }
  tail.connect(out);
  sends(c, tail, o.send);
  mod.start(t); car.start(t);
  mod.stop(t + dur + 0.05);
  track(car, t + dur + 0.05);
  return env;
}

// ------------------------------------------------------------------ drums

/** Pitch-swept sine kick with a click; `drive` for industrial grit. */
export function kick(c, out, t, { f0 = 150, f1 = 42, dur = 0.42, peak = 0.9, click = 0.25, drive = 0, send } = {}) {
  tone(c, out, t, { type: 'sine', f: f0, f2: f1, ft: dur * 0.35, dur, peak, a: 0.002, drive, send });
  if (click) noise(c, out, t, { dur: 0.015, peak: click, a: 0.001, filter: { type: 'highpass', f: 2500 } });
}

export function snare(c, out, t, { peak = 0.45, dur = 0.2, tone: tf = 190, snap = 1, send, filter } = {}) {
  tone(c, out, t, { type: 'triangle', f: tf * 1.6, f2: tf, ft: 0.05, dur: dur * 0.6, peak: peak * 0.6, a: 0.001 });
  noise(c, out, t, { dur, peak: peak * snap, a: 0.001, filter: filter || { type: 'highpass', f: 1400, q: 0.6 }, send });
}

export function clap(c, out, t, { peak = 0.4, send } = {}) {
  for (let k = 0; k < 3; k++) {
    noise(c, out, t + k * 0.011, { dur: k === 2 ? 0.18 : 0.02, peak, a: 0.001, filter: { type: 'bandpass', f: 1300, q: 1.6 }, send: k === 2 ? send : null });
  }
}

export function hat(c, out, t, { open = false, peak = 0.16, f = 8000, pan = 0 } = {}) {
  noise(c, out, t, { dur: open ? 0.28 : 0.045, peak, a: 0.001, filter: { type: 'highpass', f, q: 0.7 }, pan });
}

/**
 * Metallic hit: six inharmonic squares (the classic analogue cymbal trick)
 * through a band-pass. Low `f` gives clanks and anvils; high gives ride bells.
 */
export function metal(c, out, t, { f = 320, dur = 0.5, peak = 0.12, q = 3, bp = 3000, send, pan = 0 } = {}) {
  const env = envelope(c, t, { peak, a: 0.001, dur });
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = bp; filt.Q.value = q;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = Math.min(bp * 0.5, 4000);
  filt.connect(hp); hp.connect(env);
  for (const r of [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523]) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f * r;
    o.connect(filt);
    o.start(t);
    track(o, t + dur + 0.02);
  }
  let tail = env;
  if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; env.connect(p); tail = p; }
  tail.connect(out);
  sends(c, tail, send);
}

// ------------------------------------------------------------- instruments

/** Detuned-saw pad / brass / choir (formant) chord voice. */
export function pad(c, out, t, { freqs, dur = 2, peak = 0.08, a = 0.4, type = 'sawtooth', cutoff = 1800, cutoff2, q = 0.7, unison = 2, spread = 9, formants = null, send } = {}) {
  const env = envelope(c, t, { peak, a, dur, sus: 0.85, rel: Math.min(0.6, dur * 0.4) });
  const lvl = 1 / Math.sqrt(freqs.length * unison);
  const mix = c.createGain(); mix.gain.value = lvl;
  if (formants) {
    // Vowel: parallel band-passes ("ah" ≈ 700 / 1150 Hz) summed into the envelope.
    for (const [ff, fg] of formants) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 5;
      const g = c.createGain(); g.gain.value = fg * 2.5;
      mix.connect(bp); bp.connect(g); g.connect(env);
    }
  } else {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = q;
    lp.frequency.setValueAtTime(cutoff, t);
    if (cutoff2) lp.frequency.exponentialRampToValueAtTime(cutoff2, t + dur);
    mix.connect(lp); lp.connect(env);
  }
  for (const f of freqs) {
    for (let k = 0; k < unison; k++) {
      const o = c.createOscillator();
      setWave(c, o, type);
      o.frequency.value = f;
      o.detune.value = unison > 1 ? (k / (unison - 1) - 0.5) * 2 * spread : 0;
      o.connect(mix);
      o.start(t);
      track(o, t + dur + 0.05);
    }
  }
  env.connect(out);
  sends(c, env, send);
  return env;
}

/** Karplus-ish pluck: a filtered saw blip with a fast filter decay. */
export function pluck(c, out, t, { f, dur = 0.25, peak = 0.12, type = 'sawtooth', bright = 4, pan = 0, send } = {}) {
  return tone(c, out, t, { type, f, dur, peak, a: 0.002, filter: { type: 'lowpass', f: Math.min(16000, f * bright * 2), f2: f * 1.2, ft: dur * 0.8, q: 2 }, pan, send });
}

/** Note number → Hz (A4 = 69). */
export const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
