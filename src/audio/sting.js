// Minimal Web Audio stings for menus (M4a). The full audio engine with a
// mixer, ducking and adaptive music arrives in M6 and will absorb these.
// The AudioContext is created lazily on the first call, which always comes
// from a key/pad press, so browser autoplay rules are satisfied.

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function envGain(c, t, peak, attack, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  g.connect(c.destination);
  return g;
}

/** Short UI blip for menu navigation. */
export function playUiTick(volume = 0.8) {
  const c = audio();
  if (!c || volume <= 0) return;
  const t = c.currentTime;
  const g = envGain(c, t, 0.08 * volume, 0.004, 0.06);
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(1320, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.08);
}

/** Bright two-note confirm. */
export function playConfirm(volume = 0.8) {
  const c = audio();
  if (!c || volume <= 0) return;
  const t = c.currentTime;
  [660, 990].forEach((f, i) => {
    const g = envGain(c, t + i * 0.07, 0.1 * volume, 0.005, 0.18);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t + i * 0.07);
    o.connect(g);
    o.start(t + i * 0.07);
    o.stop(t + i * 0.07 + 0.25);
  });
}

/** Distorted siren + sub growl for highlighting HELL difficulty. */
export function playHellWarning(volume = 0.8) {
  const c = audio();
  if (!c || volume <= 0) return;
  const t = c.currentTime;
  const out = envGain(c, t, 0.22 * volume, 0.02, 1.1);

  // Hard-clipping waveshaper for the "distorted" character.
  const shaper = c.createWaveShaper();
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 6);
  }
  shaper.curve = curve;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 1.0);
  shaper.connect(lp);
  lp.connect(out);

  // Two detuned saws (beating sub growl) + a falling square siren.
  for (const f of [55, 58.3]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.connect(shaper);
    o.start(t);
    o.stop(t + 1.2);
  }
  const s = c.createOscillator();
  s.type = 'square';
  s.frequency.setValueAtTime(620, t);
  s.frequency.linearRampToValueAtTime(240, t + 0.45);
  s.frequency.linearRampToValueAtTime(520, t + 0.6);
  s.frequency.linearRampToValueAtTime(200, t + 1.1);
  const sg = c.createGain();
  sg.gain.value = 0.35;
  s.connect(sg);
  sg.connect(shaper);
  s.start(t);
  s.stop(t + 1.2);
}
