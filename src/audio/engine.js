// Audio engine (M6): one AudioContext, a master mixer and the shared assets
// (noise buffers, reverb impulses) every synth voice draws on.
//
// Signal graph
//
//   music voices ─► musicIn ─► musicFilter (bomb "underwater" low-pass,
//                                pause muffle) ─► musicDuck ─► musicVol ─┐
//   sfx voices ───► sfxIn ─────────────────────► sfxDuck ──► sfxVol ───┤
//   any voice ────► reverbSend ─► hall convolver ──────────────────────┤
//                   cathedralSend ─► 5 s convolver (Trumpet, choir) ───┤
//                                                                      ▼
//                                  master ─► soft clip ─► limiter ─► out
//
// Ducking: bombs and ultimates pull the music down (and the low-pass sweeps
// it "underwater") while the impact plays on top.
//
// Everything is synthesized at runtime; there are no sound files. The context
// is created on the first key or pointer press (browser autoplay rules) and
// every public call is a no-op until then, so the game never waits on audio.

let ctx = null;
let settings = null;
const listeners = new Set();
export const bus = {};
export const buf = {};
export const stats = { voices: 0, dropped: 0, peak: 0, played: {} }; // debug / test counters

/** The live AudioContext, or null before the first user gesture. */
export function audioCtx() { return ctx && ctx.state !== 'closed' ? ctx : null; }

/** True once the context exists and is running. */
export function audioReady() { return !!ctx && ctx.state === 'running'; }

/** Called with the context once it exists (music starts its scheduler here). */
export function onAudioReady(fn) {
  if (ctx) fn(ctx); else listeners.add(fn);
}

function vol(key, def) {
  const v = settings ? settings.get(key) : def;
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : def;
}

/** Hook the engine to the persistent settings and unlock on the first gesture. */
export function attachAudio(s) {
  settings = s;
  s.onChange((key) => {
    if (key === 'musicVolume' || key === 'sfxVolume') applyVolumes();
  });
  const unlock = () => {
    ensureAudio();
    if (ctx && ctx.state === 'running') {
      for (const ev of ['keydown', 'pointerdown', 'touchstart', 'gamepadconnected']) window.removeEventListener(ev, unlock, true);
    }
  };
  for (const ev of ['keydown', 'pointerdown', 'touchstart', 'gamepadconnected']) window.addEventListener(ev, unlock, true);
  // Pads have no DOM press event; poll lightly until a button goes down.
  const padPoll = setInterval(() => {
    if (ctx && ctx.state === 'running') { clearInterval(padPoll); return; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.buttons.some((b) => b.pressed)) { unlock(); break; }
  }, 250);
}

/** Create (or resume) the context. Safe to call any time. */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
    build(ctx);
    for (const fn of listeners) fn(ctx);
    listeners.clear();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function gain(c, v = 1) { const g = c.createGain(); g.gain.value = v; return g; }

function build(c) {
  const sr = c.sampleRate;

  // ---- shared buffers
  buf.white = noiseBuffer(c, 2, (s) => Math.random() * 2 - 1);
  let b0 = 0, b1 = 0, b2 = 0;
  buf.pink = noiseBuffer(c, 2, () => {
    // Paul Kellet's economy pink filter.
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.2;
  });
  let br = 0;
  buf.brown = noiseBuffer(c, 2, () => { br = (br + 0.02 * (Math.random() * 2 - 1)) / 1.02; return br * 3.5; });

  // ---- master chain
  bus.limiter = c.createDynamicsCompressor();
  bus.limiter.threshold.value = -6;
  bus.limiter.knee.value = 4;
  bus.limiter.ratio.value = 14;
  bus.limiter.attack.value = 0.002;
  bus.limiter.release.value = 0.18;
  bus.clip = c.createWaveShaper();
  bus.clip.curve = softClipCurve(2048, 1.4);
  bus.clip.oversample = '2x';
  bus.master = gain(c, 0.9);
  bus.master.connect(bus.clip);
  bus.clip.connect(bus.limiter);
  bus.analyser = c.createAnalyser();
  bus.analyser.fftSize = 1024;
  bus.limiter.connect(bus.analyser);
  bus.limiter.connect(c.destination);

  // ---- music
  bus.musicVol = gain(c, 0);
  bus.musicDuck = gain(c, 1);
  bus.musicFilter = c.createBiquadFilter();
  bus.musicFilter.type = 'lowpass';
  bus.musicFilter.frequency.value = 20000;
  bus.musicFilter.Q.value = 0.9;
  bus.musicIn = gain(c, 1);
  bus.musicIn.connect(bus.musicFilter);
  bus.musicFilter.connect(bus.musicDuck);
  bus.musicDuck.connect(bus.musicVol);
  bus.musicVol.connect(bus.master);

  // ---- sfx
  bus.sfxVol = gain(c, 0);
  bus.sfxDuck = gain(c, 1);
  bus.sfxIn = gain(c, 1);
  bus.sfxIn.connect(bus.sfxDuck);
  bus.sfxDuck.connect(bus.sfxVol);
  bus.sfxVol.connect(bus.master);

  // ---- reverbs (sends are post-volume per source: they feed the matching vol bus)
  bus.hall = c.createConvolver();
  bus.hall.buffer = impulse(c, 2.2, 2.6, sr);
  bus.reverbSfx = gain(c, 1);
  bus.reverbMusic = gain(c, 1);
  const hallOutSfx = gain(c, 0.55), hallOutMusic = gain(c, 0.5);
  // One convolver per bus keeps the volume sliders honest for the tails.
  const hall2 = c.createConvolver();
  hall2.buffer = bus.hall.buffer;
  bus.reverbSfx.connect(bus.hall); bus.hall.connect(hallOutSfx); hallOutSfx.connect(bus.sfxVol);
  bus.reverbMusic.connect(hall2); hall2.connect(hallOutMusic); hallOutMusic.connect(bus.musicFilter);

  bus.cathedral = c.createConvolver();
  bus.cathedral.buffer = impulse(c, 5.5, 1.8, sr);
  bus.cathedralSend = gain(c, 1);
  const cathOut = gain(c, 0.7);
  bus.cathedralSend.connect(bus.cathedral); bus.cathedral.connect(cathOut); cathOut.connect(bus.sfxVol);

  // Feedback echo for leads and some sfx (tempo set by the music engine).
  bus.delay = c.createDelay(2);
  bus.delay.delayTime.value = 0.32;
  bus.delayFb = gain(c, 0.32);
  const delayLp = c.createBiquadFilter();
  delayLp.type = 'lowpass'; delayLp.frequency.value = 3200;
  bus.delaySend = gain(c, 1);
  const delayOut = gain(c, 0.4);
  bus.delaySend.connect(bus.delay);
  bus.delay.connect(delayLp); delayLp.connect(bus.delayFb); bus.delayFb.connect(bus.delay);
  delayLp.connect(delayOut); delayOut.connect(bus.musicFilter);

  applyVolumes();
}

/** Slider curve: perceptual (squared) so 50 % sounds like half. */
export function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const m = vol('musicVolume', 0.7), s = vol('sfxVolume', 0.8);
  bus.musicVol.gain.setTargetAtTime(m * m * 0.55, t, 0.05); // music sits ~4 dB under the sfx
  bus.sfxVol.gain.setTargetAtTime(s * s, t, 0.05);
}

/** The current slider value (0..1) for a mix bus. */
export function volume(key) { return vol(key, key === 'musicVolume' ? 0.7 : 0.8); }

// ------------------------------------------------------------------ ducking

let duckUntil = 0;

/**
 * Pull the music (and optionally sfx) down for `dur` seconds. `underwater`
 * also sweeps the music low-pass down to ~280 Hz and back (the bomb sound).
 */
export function duck(dur, { music = 0.3, sfx = 1, underwater = false, attack = 0.03 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime, end = Math.max(t + dur, duckUntil);
  duckUntil = end;
  const g = bus.musicDuck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(music, t + attack);
  g.setValueAtTime(music, end);
  g.linearRampToValueAtTime(1, end + 0.6);
  if (sfx < 1) {
    const s = bus.sfxDuck.gain;
    s.cancelScheduledValues(t);
    s.setValueAtTime(s.value, t);
    s.linearRampToValueAtTime(sfx, t + attack);
    s.setValueAtTime(sfx, end);
    s.linearRampToValueAtTime(1, end + 0.4);
  }
  if (underwater) {
    const f = bus.musicFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.min(20000, f.value), t);
    f.exponentialRampToValueAtTime(280, t + 0.12);
    f.setValueAtTime(280, Math.max(t + 0.13, end - 0.4));
    f.exponentialRampToValueAtTime(20000, end + 0.9);
  }
}

/** Pause menu: muffle the music (true) or open it back up. */
export function muffle(on) {
  if (!ctx) return;
  const t = ctx.currentTime, f = bus.musicFilter.frequency;
  f.cancelScheduledValues(t);
  f.setTargetAtTime(on ? 600 : 20000, t, on ? 0.08 : 0.15);
  const g = bus.sfxDuck.gain;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(on ? 0.0 : 1, t, 0.03);
}

/** Output peak (0..1) for tests and the debug overlay. */
const peakBuf = new Float32Array(1024);
export function measurePeak() {
  if (!ctx) return 0;
  bus.analyser.getFloatTimeDomainData(peakBuf);
  let p = 0;
  for (let i = 0; i < peakBuf.length; i++) { const a = Math.abs(peakBuf[i]); if (a > p) p = a; }
  stats.peak = p;
  return p;
}

// ------------------------------------------------------------------ assets

function noiseBuffer(c, seconds, fn) {
  const n = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = fn(i);
  return b;
}

/** Stereo exponential-decay noise impulse (a cheap but convincing room). */
function impulse(c, seconds, decay, sr) {
  const n = Math.floor(sr * seconds);
  const b = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      // Darken the tail as it decays (air absorption) with a moving one-pole.
      const a = 0.25 + 0.7 * k;
      lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
      d[i] = lp * Math.pow(1 - k, decay) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
    }
  }
  return b;
}

function softClipCurve(n, drive) {
  const c = new Float32Array(n), norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / norm;
  }
  return c;
}

/** Reusable distortion curves, keyed by drive. */
const curves = new Map();
export function driveCurve(drive) {
  let c = curves.get(drive);
  if (!c) { c = softClipCurve(1024, drive); curves.set(drive, c); }
  return c;
}

/** Test/debug handle. */
if (typeof window !== 'undefined') {
  window.__npoAudio = { get ctx() { return ctx; }, bus, stats, measurePeak };
}
