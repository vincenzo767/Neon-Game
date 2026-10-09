// Persistent user settings (localStorage). Every read/write is guarded so the
// game still runs in private windows or when storage is blocked.

const STORAGE_KEY = 'npo.settings.v1';

// Keyboard bindings use KeyboardEvent.code (layout independent).
export const DEFAULT_KEY_BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  shot: ['KeyZ', 'KeyJ', 'Space'],
  focus: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  bomb: ['KeyX', 'KeyL'],
  special: ['KeyC', 'KeyI'],
  ultimate: ['KeyV', 'KeyU'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'KeyZ', 'Space'],
  back: ['Escape', 'Backspace', 'KeyX'],
  debug: ['Backquote', 'F3'],
};

// Gamepad bindings use the W3C "standard" mapping button indices.
export const DEFAULT_PAD_BINDINGS = {
  up: [12], down: [13], left: [14], right: [15],
  shot: [0, 7],
  focus: [5, 4, 6],
  bomb: [1],
  special: [2],
  ultimate: [3],
  pause: [9],
  confirm: [0],
  back: [1],
  debug: [],
};

export const QUALITY_PRESETS = {
  low: { renderScale: 0.6, dprCap: 1, bloom: 0.8 },
  medium: { renderScale: 0.85, dprCap: 1.5, bloom: 1.0 },
  high: { renderScale: 1.0, dprCap: 2, bloom: 1.0 },
};

const DEFAULTS = {
  quality: 'high',
  crt: false,
  shake: 1.0, // 0..1.5 multiplier
  masterVolume: 1.0, // M7b
  musicVolume: 0.7,
  sfxVolume: 0.8,
  keys: DEFAULT_KEY_BINDINGS,
  pad: DEFAULT_PAD_BINDINGS,
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export class Settings {
  constructor() {
    this.data = clone(DEFAULTS);
    this.listeners = new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(this.data, saved);
        // Merge bindings so newly added actions get defaults.
        this.data.keys = { ...clone(DEFAULT_KEY_BINDINGS), ...(saved.keys || {}) };
        this.data.pad = { ...clone(DEFAULT_PAD_BINDINGS), ...(saved.pad || {}) };
      }
    } catch { /* storage unavailable: use defaults */ }
  }

  get(key) { return this.data[key]; }

  set(key, value) {
    this.data[key] = value;
    this.save();
    for (const fn of this.listeners) fn(key, value);
  }

  get qualityPreset() { return QUALITY_PRESETS[this.data.quality] || QUALITY_PRESETS.high; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  resetBindings() {
    this.set('keys', clone(DEFAULT_KEY_BINDINGS));
    this.set('pad', clone(DEFAULT_PAD_BINDINGS));
  }
}
