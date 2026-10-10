// Adaptive procedural music (M6). Replaces the M4b stub; `music.setLayer()`
// and `music.layer` keep their meaning (bosses request a layer per phase).
//
// A look-ahead step sequencer (Chris Wilson's "tale of two clocks"): a
// 25 ms timer schedules every 16th note ~120 ms ahead on the AudioContext
// clock, so timing stays sample-accurate even when frames hitch.
//
// What plays is a *deck*: one faction style (themes.js) with a gain node per
// layer. The intensity level decides which layers are open, so the same
// song thins out in quiet stretches and fills in as bullet density rises.
//
//   stage track   faction of the stage (setStage); intensity 0-4 from the
//                 audio director; the mid-boss raises the floor
//   boss theme    setLayer('sea_p3'): the archetype's faction style in its
//                 boss form; every phase changes key, layers or drums;
//                 '_desperation' speeds up, distorts and goes a half step up
//   menu          the Precinct theme
//
// Track changes land on the next bar with a riser + crash fill so a phase
// change sounds like a section change rather than a cut.

import { audioCtx, onAudioReady, bus } from './engine.js';
import { tone, noise, fm, kick, snare, clap, hat, metal, pad, pluck, hz } from './synth.js';
import { STYLES, LEVEL_LAYERS, LAYERS, FACTION_STYLE, parseLayer, parseMotif } from './themes.js';

const LOOKAHEAD = 0.12;   // seconds scheduled ahead (grows if the main thread stalls)
const MAX_LOOKAHEAD = 0.35;
const TICK_MS = 25;

/** Boss phase → arrangement (transpose semitones, level, extras). */
const PHASE_ARR = [
  null,
  { trans: 0, level: 3 },
  { trans: 0, level: 4, alt: true },
  { trans: 2, level: 4, bassOct: true },
  { trans: 3, level: 4, alt: true, hats2x: true, leadUp: true },
  { trans: 5, level: 4, bassOct: true, hats2x: true, leadUp: true, harmony: true },
];

function merge(base, over) {
  if (!over) return base;
  const out = { ...base, ...over };
  for (const k of ['drums', 'bass', 'pad', 'arp', 'lead', 'perc']) {
    if (over[k]) out[k] = { ...base[k], ...over[k] };
  }
  return out;
}

class Deck {
  constructor(c, spec) {
    const base = STYLES[spec.style] || STYLES.precinct;
    const st = spec.boss ? merge(base, base.boss) : base;
    this.spec = spec;
    this.st = st;
    this.styleId = spec.style;
    const arr = spec.boss ? PHASE_ARR[Math.min(5, Math.max(1, spec.phase || 1))] : { trans: 0 };
    this.arr = { ...arr };
    if (spec.desperation) Object.assign(this.arr, { trans: (arr.trans || 0) + 1, level: 4, hats2x: true, leadUp: true, harmony: true, bassOct: true, drive: true });
    this.bpm = st.bpm * (spec.desperation ? 1.08 : 1);
    this.motif = parseMotif(st.motif);
    this.out = c.createGain();
    this.out.gain.value = base.gain || 1; // M7c loudness trim per style (themes.js)
    this.out.connect(bus.musicIn);
    this.gains = {};
    for (const l of LAYERS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.gains[l] = g;
    }
    this.open = new Set();
    this.lastBass = 0;
  }

  get sixteenth() { return 60 / this.bpm / 4; }

  /** Open exactly `layers` (ramped so changes never click). */
  setLayers(c, layers, t, ramp = 0.25) {
    const want = new Set(layers);
    for (const l of LAYERS) {
      const on = want.has(l);
      const g = this.gains[l].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on ? 1 : 0, t + ramp);
    }
    this.open = want;
  }

  fadeOut(c, t, dur) {
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + dur);
    setTimeout(() => { try { this.out.disconnect(); } catch { /* gone */ } }, (dur + 3) * 1000);
  }

  /** Semitone offset of scale degree `d` (wraps into other octaves). */
  deg(d) {
    const sc = this.st.scale, n = sc.length;
    const o = Math.floor(d / n), k = ((d % n) + n) % n;
    return sc[k] + 12 * o;
  }

  /** MIDI notes of the chord on scale degree `d` at `octave` above the bass root. */
  chord(d, octave = 1) {
    const st = this.st, root = st.root + 12 * octave + (this.arr.trans || 0);
    if (st.power || st.pad.power) return [root + this.deg(d), root + this.deg(d + 4), root + this.deg(d) + 12];
    const tones = [d, d + 2, d + 4];
    if (st.seventh) tones.push(d + 6);
    return tones.map((x) => root + this.deg(x));
  }
}

export const music = {
  layer: null,        // current boss layer id (null = stage / menu track)
  mode: null,         // 'menu' | 'stage' (boss layers ride on top of 'stage')
  deck: null,
  stageStyle: 'precinct',
  want: 0,            // intensity requested by the director (0..4)
  floor: 0,           // minimum level (mid-boss, boss)
  hold: null,         // {layers, until}: breakdown (boss warning)
  pending: null,      // deck to swap in at the next bar
  step: 0,
  bar: 0,
  nextT: 0,
  timer: null,
  muted: false,
  _wantSpec: null,

  // --------------------------------------------------------------- control

  /** Boss phase layer (bosses emit this); null returns to the stage track. */
  setLayer(name) {
    this.layer = name || null;
    const p = parseLayer(this.layer);
    if (!p) { this.floor = 0; this._play({ style: this.stageStyle }, true); return; }
    this.floor = 0;
    this._play({ style: p.style, boss: true, phase: p.phase, desperation: p.desperation }, true);
  },

  /** Stage track for the faction that owns the territory. */
  setStage(factionId) {
    this.mode = 'stage';
    this.stageStyle = FACTION_STYLE[factionId] || 'precinct';
    this.layer = null;
    this.floor = 0;
    this.want = 0;
    this.hold = null;
    this._play({ style: this.stageStyle }, false);
  },

  /** Menus: the Precinct theme, full arrangement. */
  menu() {
    this.mode = 'menu';
    this.layer = null;
    this.floor = 3;
    this.hold = null;
    if (this.deck && this.deck.spec.menu) return;
    this._play({ style: 'precinct', menu: true }, false);
  },

  /** Intensity 0..4 from the audio director (applied on bar lines). */
  setIntensity(level) { this.want = level; },

  /** Minimum layer level (mid-boss fights keep the drums in). */
  setFloor(level) { this.floor = level; },

  /** Strip back to the pad for `bars` bars (boss WARNING). */
  breakdown(bars) {
    const c = audioCtx();
    if (!c || !this.deck) return;
    this.hold = { layers: ['pad', 'perc'], until: this.bar + bars };
    this.deck.setLayers(c, this.hold.layers, c.currentTime + 0.05, 0.4);
  },

  /** Short jingle over a ducked track: 'clear' (stage clear) or 'gameover'. */
  stinger(kind) {
    const c = audioCtx();
    if (!c) return;
    const d = this.deck || new Deck(c, { style: 'precinct' });
    const t = c.currentTime + 0.05, out = bus.musicIn;
    if (kind === 'clear') {
      if (this.deck) this.deck.setLayers(c, ['pad'], t, 0.3);
      this.hold = { layers: ['pad'], until: this.bar + 3 };
      const ch = d.chord(0, 2), s = 0.11;
      ch.concat([ch[0] + 12]).forEach((n, i) => {
        tone(c, out, t + i * s, { type: d.st.lead.wave === 'fm' ? 'sine' : d.st.lead.wave, f: hz(n), dur: 0.5, peak: 0.08, a: 0.005, filter: { type: 'lowpass', f: 4000 }, send: { rev: 0.4, music: true } });
      });
      pad(c, out, t + 4 * s, { freqs: d.chord(0, 2).map(hz), dur: 2.2, peak: 0.09, a: 0.02, type: 'sawtooth', cutoff: 3000, cutoff2: 900, unison: 3, send: { rev: 0.5, music: true } });
      tone(c, out, t + 4 * s, { type: 'sawtooth', f: hz(ch[0] + 12), dur: 2.1, peak: 0.07, sus: 0.7, rel: 0.8, vib: { rate: 5, depth: 6, delay: 0.3 }, filter: { type: 'lowpass', f: 3600 }, send: { rev: 0.5, echo: 0.3, music: true } });
    } else if (kind === 'gameover') {
      this.stop(0.8);
      const root = 45;
      [0, -2, -4, -5].forEach((n, i) => {
        tone(c, out, t + i * 0.42, { type: 'triangle', f: hz(root + 12 + n), dur: 0.9, peak: 0.1, a: 0.01, send: { rev: 0.6, music: true } });
      });
      pad(c, out, t + 1.7, { freqs: [hz(root - 7), hz(root - 4), hz(root)], dur: 3, peak: 0.08, a: 0.3, cutoff: 900, cutoff2: 200, send: { rev: 0.6, music: true } });
    }
  },

  /** Fade the current track out and stop sequencing. */
  stop(fade = 1) {
    const c = audioCtx();
    this._wantSpec = null;
    this.pending = null;
    if (!c || !this.deck) { this.deck = null; return; }
    this.deck.fadeOut(c, c.currentTime, fade);
    this.deck = null;
  },

  info() {
    const d = this.deck;
    if (!d) return 'off';
    return `${d.styleId}${d.spec.boss ? ` boss p${d.spec.phase}${d.spec.desperation ? ' DESP' : ''}` : ''} ${Math.round(d.bpm)}bpm L[${[...d.open].join(',')}] bar ${this.bar}`;
  },

  // ------------------------------------------------------------ internals

  _play(spec, fill) {
    this._wantSpec = spec;
    const c = audioCtx();
    if (!c) return; // started on unlock (see bottom)
    const cur = this.deck;
    if (cur && sameSpec(cur.spec, spec)) { this.pending = null; return; }
    const deck = new Deck(c, spec);
    if (!cur) {
      this.deck = deck;
      this.step = 0; this.bar = 0;
      this.nextT = c.currentTime + 0.08;
      this._applyLevel(c, this.nextT);
      this._echo(c);
      this._run();
      return;
    }
    this.pending = { deck, fill };
  },

  _swap(c, t) {
    const { deck, fill } = this.pending;
    this.pending = null;
    const old = this.deck;
    if (old) old.fadeOut(c, t, fill ? 0.15 : 0.6);
    // A breakdown still running (boss WARNING) carries over to the new track.
    const rem = this.hold ? this.hold.until - this.bar : 0;
    this.deck = deck;
    this.step = 0; this.bar = 0;
    if (rem > 0) {
      this.hold.until = rem;
      deck.setLayers(c, this.hold.layers, t, 0.05);
    } else {
      this.hold = null;
      this._applyLevel(c, t, 0.05);
    }
    this._echo(c);
    if (fill) this._crash(c, t);
  },

  _echo(c) {
    const d = this.deck;
    bus.delay.delayTime.setTargetAtTime(Math.min(1.5, d.sixteenth * 3), c.currentTime, 0.1);
  },

  _level() {
    const d = this.deck;
    if (d.spec.menu) return 3 + (this.bar % 16 >= 8 ? 1 : 0);
    if (d.spec.boss) return Math.max(d.arr.level || 3, this.want >= 4 ? 4 : 0);
    return Math.max(0, Math.min(4, Math.max(this.want, this.floor)));
  },

  _applyLevel(c, t, ramp) {
    const d = this.deck;
    if (this.hold && this.bar < this.hold.until) return;
    this.hold = null;
    const layers = LEVEL_LAYERS[this._level()];
    const same = layers.length === d.open.size && layers.every((l) => d.open.has(l));
    if (!same) d.setLayers(c, layers, t, ramp);
  },

  _run() {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick(), TICK_MS);
  },

  _tick() {
    const c = audioCtx();
    // Adaptive look-ahead: if timer ticks arrive late (busy main thread,
    // slow GPU), schedule further ahead so notes never land in the past.
    const now = performance.now(), gap = this._lastTick ? (now - this._lastTick) / 1000 : 0;
    this._lastTick = now;
    this.ahead = Math.min(MAX_LOOKAHEAD, Math.max(LOOKAHEAD, (this.ahead || LOOKAHEAD) * 0.995, gap * 1.6));
    if (!c || !this.deck) {
      if (!this.deck && !this.pending) { clearInterval(this.timer); this.timer = null; }
      return;
    }
    // Tab was hidden (timers throttled): skip ahead instead of a burst.
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    while (this.deck && this.nextT < c.currentTime + this.ahead) {
      const t = this.nextT;
      if (this.step === 0) {
        if (this.pending) this._swap(c, t);
        else this._applyLevel(c, t, 0.3);
        // A fill on the last beat before a scheduled swap would need
        // knowledge of the future; instead the riser plays on request.
      }
      if (this.step === 12 && this.pending && this.pending.fill) this._riser(c, t, this.deck.sixteenth * 4);
      this._schedule(c, t, this.step, this.bar);
      const d = this.deck, sx = d.sixteenth;
      this.nextT += sx;
      if (++this.step >= 16) { this.step = 0; this.bar++; }
    }
  },

  // -------------------------------------------------------------- playback

  _schedule(c, t0, s, bar) {
    const d = this.deck, st = d.st, sx = d.sixteenth, arr = d.arr;
    const swing = st.swing && s % 2 ? st.swing * sx * 0.5 : 0;
    const t = t0 + swing;
    const g = d.gains, open = d.open;
    const pi = bar % st.prog.length;
    const chordDeg = st.prog[pi];
    const altDeg = arr.alt ? st.prog[(pi + 1) % st.prog.length] : chordDeg;
    const deg = bar % 2 ? altDeg : chordDeg;
    const rootMidi = st.root + (arr.trans || 0) + d.deg(deg);
    const music = true;

    // ---- drums
    if (open.has('drums')) {
      const dr = st.drums, kit = dr.kit;
      const k = dr.kick[s], sn = dr.snare[s];
      let h = dr.hat[s];
      if (arr.hats2x && h === '.') h = 'x';
      if (k !== '.') this._kick(c, g.drums, t, kit, s, k === 'o', arr.drive);
      if (sn !== '.') this._snare(c, g.drums, t, kit);
      if (h !== '.') this._hat(c, g.drums, t, kit, h === 'o', s);
      // Turnaround fill on the last beat of every 4th bar.
      if (bar % 4 === 3 && s >= 12 && (s % 2 === 0 || kit === 'breaks')) this._snare(c, g.drums, t, kit, 0.5 + (s - 12) * 0.12);
    } else if (open.has('pad') && st.drums.kit === 'heart' && st.drums.kick[s] !== '.') {
      // The Covenant's heartbeat never fully stops.
      this._kick(c, g.pad, t, 'heart', s, false, false, 0.5);
    }

    // ---- perc
    if (open.has('perc') && st.perc) {
      const pc = st.perc;
      const every = pc.every || 1;
      if (pc.pattern[s] !== '.' && bar % every === 0) this._perc(c, g.perc, t, pc.voice, rootMidi, s, bar, d);
    }

    // ---- bass
    if (open.has('bass')) {
      const b = st.bass, ch = b.pattern[s];
      if (ch === 'x' || ch === 'o') {
        let len = 1;
        while (s + len < 16 && b.pattern[s + len] === '-') len++;
        let n = rootMidi + (ch === 'o' ? 12 : 0) + (arr.bassOct && s % 4 === 2 ? 12 : 0);
        const dur = len * sx * (len > 1 ? 0.98 : 0.8);
        const f = hz(n);
        const peak = b.peak * (s % 4 === 0 ? 1 : 0.8);
        if (b.reese) {
          tone(c, g.bass, t, { type: 'sawtooth', f, dur, peak, a: 0.01, sus: 0.9, rel: 0.05, unison: 3, spread: 22, filter: { type: 'lowpass', f: b.cutoff * 1.6, f2: b.cutoff * 0.7, ft: dur, q: 3 } });
          tone(c, g.bass, t, { type: 'sine', f: f / 2, dur, peak: peak * 0.8, a: 0.01, sus: 0.9, rel: 0.05 });
        } else if (b.sub) {
          tone(c, g.bass, t, { type: 'sine', f, dur, peak, a: 0.005, sus: 0.7, rel: 0.05 });
          tone(c, g.bass, t, { type: 'triangle', f: f * 2, dur: dur * 0.5, peak: peak * 0.25, a: 0.003 });
        } else if (b.drone) {
          tone(c, g.bass, t, { type: 'sine', f, dur: 16 * sx, peak, a: 0.4, sus: 0.9, rel: 0.6 });
          tone(c, g.bass, t, { type: 'sawtooth', f: f * 2, dur: 16 * sx, peak: peak * 0.12, a: 0.8, sus: 0.8, rel: 0.6, filter: { type: 'lowpass', f: 220, q: 4 } });
          noise(c, g.bass, t, { color: 'brown', dur: 16 * sx, peak: 0.18, a: 1, sus: 0.8, rel: 0.8, filter: { type: 'lowpass', f: 260 } });
        } else if (b.glide && d.lastBass) {
          tone(c, g.bass, t, { type: b.wave, f: hz(d.lastBass), f2: f, ft: b.glide, dur, peak, a: 0.01, sus: 0.8, rel: 0.1, filter: { type: 'lowpass', f: b.cutoff } });
        } else {
          tone(c, g.bass, t, { type: b.wave, f, dur, peak, a: 0.004, sus: 0.6, rel: 0.04, drive: b.drive || (arr.drive ? 3 : 0), filter: { type: 'lowpass', f: b.cutoff * 2.2, f2: b.cutoff * 0.6, ft: Math.min(dur, 0.18), q: 4 } });
        }
        d.lastBass = n;
      }
    }

    // ---- pad
    if (open.has('pad')) {
      const p = st.pad;
      const freqs = d.chord(deg, 1).map(hz);
      if (p.gate) {
        if (p.gate[s] !== '.') pad(c, g.pad, t, { freqs, dur: sx * 1.6, peak: p.peak * 1.4, a: 0.005, type: p.wave, cutoff: p.cutoff, unison: p.unison || 1 });
      } else if (s === 0) {
        const opts = { freqs, dur: 16 * sx * 1.02, peak: p.peak, a: Math.min(0.5, 4 * sx), type: p.wave, cutoff: p.cutoff, unison: p.unison || 2, send: { rev: 0.35, music } };
        if (p.choir) opts.formants = bar % 2 ? [[400, 1], [800, 0.55]] : [[700, 1], [1150, 0.6]];
        pad(c, g.pad, t, opts);
      }
    }

    // ---- arp
    if (open.has('arp')) {
      const a = st.arp, rate = a.rate || 1;
      if (s % rate === 0) {
        const tones = d.chord(deg, 1 + a.octave);
        if (a.pattern === 'oompah') {
          // Oom-pah: bass note on the beat, a short chord stab on the off-beat.
          if (s % 4 === 2) pad(c, g.arp, t, { freqs: tones.map(hz), dur: sx * 1.5, peak: a.peak, a: 0.004, type: a.wave, cutoff: a.cutoff, unison: 1 });
        } else {
          const i = (s / rate + bar * Math.ceil(16 / rate)) % a.pattern.length;
          const idx = a.pattern[i];
          const n = tones[idx % tones.length] + 12 * Math.floor(idx / tones.length);
          const send = { echo: a.echo || 0, rev: 0.15, music };
          if (a.wave === 'fm') fm(c, g.arp, t, { f: hz(n), ratio: 3.01, index: 2.5, dur: rate * sx * 3, peak: a.peak, a: 0.002, send, pan: (i % 2 ? 0.3 : -0.3) });
          else pluck(c, g.arp, t, { f: hz(n), dur: rate * sx * 1.4, peak: a.peak, type: a.wave, bright: a.cutoff ? a.cutoff / hz(n) / 2 : 5, pan: (i % 2 ? 0.25 : -0.25), send });
        }
      }
    }

    // ---- lead (the leitmotif: 4-bar call and answer)
    if (open.has('lead')) {
      const L = st.lead, phraseBar = bar % 4, local = (phraseBar % 2) * 16 + s;
      const shift = phraseBar === 2 ? 2 : 0;
      for (const nt of d.motif) {
        if (nt.step !== local) continue;
        const oct = L.octave + (arr.leadUp ? 1 : 0);
        const n = st.root + (arr.trans || 0) + 12 * oct + d.deg(nt.deg + shift);
        const dur = nt.len * sx * 0.95;
        this._lead(c, g.lead, t, L, n, dur, d);
        if (arr.harmony) this._lead(c, g.lead, t, L, st.root + (arr.trans || 0) + 12 * oct + d.deg(nt.deg + shift - 2), dur, d, 0.55);
      }
    }
  },

  _lead(c, out, t, L, n, dur, d, mul = 1) {
    const f = hz(n);
    const send = { echo: L.echo || 0, rev: 0.25, music: true };
    if (L.choir) {
      pad(c, out, t, { freqs: [f], dur: dur + 0.1, peak: L.peak * 1.6 * mul, a: 0.06, type: 'sawtooth', unison: 3, spread: 10, formants: [[600, 1], [1050, 0.6]], send });
      return;
    }
    const prev = d.lastLead;
    tone(c, out, t, {
      type: L.wave, f: L.glide && prev ? prev : f, f2: L.glide && prev ? f : undefined, ft: L.glide,
      dur: dur + 0.04, peak: L.peak * mul, a: 0.008, sus: 0.75, rel: Math.min(0.12, dur * 0.4),
      vib: L.vib ? { rate: L.vib, depth: L.vibDepth || 7, delay: Math.min(0.25, dur * 0.5) } : null,
      drive: L.drive || 0, filter: { type: 'lowpass', f: L.cutoff || 5000, q: 1 }, send,
    });
    if (mul === 1) d.lastLead = f;
  },

  _kick(c, out, t, kit, s, accent, drive, mul = 1) {
    switch (kit) {
      case 'industrial': kick(c, out, t, { f0: 170, f1: 38, dur: 0.32, peak: 0.85 * mul, click: 0.3, drive: 3 }); break;
      case 'breaks': kick(c, out, t, { f0: 130, f1: 48, dur: 0.28, peak: 0.8 * mul, click: 0.2 }); break;
      case 'electro': kick(c, out, t, { f0: 120, f1: 46, dur: 0.5, peak: 0.85 * mul, click: 0.15, drive: drive ? 2 : 0 }); break;
      case 'deck': kick(c, out, t, { f0: 110, f1: 50, dur: 0.3, peak: 0.75 * mul, click: 0.1 }); break;
      case 'glass': kick(c, out, t, { f0: 90, f1: 40, dur: 0.6, peak: 0.7 * mul, click: 0.05 }); break;
      case 'heart': kick(c, out, t, { f0: 85, f1: 34, dur: 0.35, peak: (s === 0 || s === 8 ? 0.8 : 0.5) * mul, click: 0 }); break;
      default: kick(c, out, t, { f0: 140, f1: 44, dur: 0.38, peak: 0.85 * mul, click: 0.2, drive: drive ? 2 : 0 });
    }
  },

  _snare(c, out, t, kit, mul = 1) {
    switch (kit) {
      case 'industrial':
        snare(c, out, t, { peak: 0.4 * mul, tone: 170 });
        metal(c, out, t, { f: 190, bp: 1800, dur: 0.22, peak: 0.08 * mul });
        break;
      case 'breaks': snare(c, out, t, { peak: 0.42 * mul, tone: 230, dur: 0.16 }); break;
      case 'electro': clap(c, out, t, { peak: 0.36 * mul, send: { rev: 0.2, music: true } }); break;
      case 'deck':
        clap(c, out, t, { peak: 0.28 * mul });
        tone(c, out, t, { type: 'triangle', f: 640, f2: 420, dur: 0.06, peak: 0.12 * mul, a: 0.001 });
        break;
      case 'glass': clap(c, out, t, { peak: 0.22 * mul, send: { rev: 0.7, music: true } }); break;
      case 'heart': noise(c, out, t, { dur: 0.6, peak: 0.12 * mul, a: 0.2, filter: { type: 'bandpass', f: 500, q: 2 }, send: { rev: 0.6, music: true } }); break;
      default: snare(c, out, t, { peak: 0.38 * mul, tone: 200, dur: 0.24, send: { rev: 0.35, music: true } });
    }
  },

  _hat(c, out, t, kit, open, s) {
    const vel = s % 4 === 2 ? 1 : 0.6;
    switch (kit) {
      case 'industrial': metal(c, out, t, { f: 540, bp: 9000, dur: open ? 0.2 : 0.05, peak: 0.05 * vel, q: 1 }); break;
      case 'deck': noise(c, out, t, { dur: 0.06, peak: 0.12 * vel, a: 0.01, filter: { type: 'bandpass', f: 6500, q: 1.5 } }); break;
      case 'glass': fm(c, out, t, { f: 2900 + (s % 3) * 410, ratio: 1.41, index: 1.5, dur: 0.12, peak: 0.03 * vel, a: 0.001, pan: (s % 3 - 1) * 0.5 }); break;
      case 'heart': noise(c, out, t, { dur: 0.09, peak: 0.05, a: 0.002, filter: { type: 'bandpass', f: 2400, q: 6 }, send: { rev: 0.5, music: true } }); break;
      case 'electro': hat(c, out, t, { open, peak: 0.1 * vel, f: 9500 }); break;
      default: hat(c, out, t, { open, peak: 0.12 * vel, f: 7500, pan: s % 8 < 4 ? -0.15 : 0.15 });
    }
  },

  _perc(c, out, t, voice, rootMidi, s, bar, d) {
    switch (voice) {
      case 'tom': tone(c, out, t, { type: 'sine', f: s < 8 ? 170 : 130, f2: 80, dur: 0.3, peak: 0.25, a: 0.002, send: { rev: 0.3, music: true } }); break;
      case 'anvil': metal(c, out, t, { f: 260 + (s % 3) * 40, bp: 2600, dur: 0.5, peak: 0.07, q: 6, send: { rev: 0.3, music: true }, pan: s < 8 ? -0.4 : 0.4 }); break;
      case 'ghost': snare(c, out, t, { peak: 0.12, tone: 230, dur: 0.08 }); break;
      case 'foghorn':
        tone(c, out, t, { type: 'sawtooth', f: hz(rootMidi), dur: 1.8, peak: 0.07, a: 0.25, sus: 0.8, rel: 0.6, unison: 2, spread: 14, vib: { rate: 3, depth: 4 }, filter: { type: 'lowpass', f: 380, q: 2 }, send: { rev: 0.5, music: true } });
        // Bubbles: rising sine blips.
        for (let k = 0; k < 4; k++) tone(c, out, t + 0.9 + k * 0.13, { type: 'sine', f: 380 + k * 90, f2: 900 + k * 160, dur: 0.07, peak: 0.04, a: 0.003 });
        break;
      case 'data': {
        // Deterministic "random" blips: the corporation's data stream.
        const r = ((bar * 16 + s) * 2654435761) >>> 0;
        const n = rootMidi + 36 + d.deg(r % 7);
        tone(c, out, t, { type: 'pulse12', f: hz(n), dur: 0.04, peak: 0.035, a: 0.001, pan: (((r >>> 8) % 3) - 1) * 0.6 });
        break;
      }
      case 'glyph': fm(c, out, t, { f: hz(rootMidi + 36 + d.deg((s / 5) | 0)), ratio: 1.41, index: 3, dur: 1.4, peak: 0.05, a: 0.002, send: { rev: 0.6, echo: 0.3, music: true }, pan: (s % 2 ? 0.5 : -0.5) }); break;
      case 'toll': fm(c, out, t, { f: hz(rootMidi + 24), ratio: 2.76, index: 3, decayIndex: 0.2, dur: 4.5, peak: 0.07, a: 0.002, send: { rev: 0.7, music: true } }); break;
    }
  },

  /** Noise riser into a section change. */
  _riser(c, t, dur) {
    noise(c, bus.musicIn, t, { dur, peak: 0.12, a: dur * 0.9, filter: { type: 'bandpass', f: 600, f2: 7000, ft: dur, q: 2 } });
    for (let k = 0; k < 4; k++) snare(c, bus.musicIn, t + k * dur / 4, { peak: 0.15 + k * 0.08, tone: 210, dur: 0.1 });
  },

  _crash(c, t) {
    noise(c, bus.musicIn, t, { dur: 1.6, peak: 0.2, a: 0.002, filter: { type: 'highpass', f: 4500 }, send: { rev: 0.4, music: true } });
    metal(c, bus.musicIn, t, { f: 420, bp: 7000, dur: 1.2, peak: 0.06, q: 1 });
    kick(c, bus.musicIn, t, { f0: 160, f1: 40, dur: 0.6, peak: 0.9 });
  },
};

function sameSpec(a, b) {
  return a.style === b.style && !!a.boss === !!b.boss && (a.phase || 0) === (b.phase || 0) && !!a.desperation === !!b.desperation && !!a.menu === !!b.menu;
}

// Start whatever was requested before the first user gesture unlocked audio.
onAudioReady(() => {
  const spec = music._wantSpec;
  if (spec) { music._wantSpec = null; music._play(spec, false); }
});
