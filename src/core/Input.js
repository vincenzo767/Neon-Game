// Unified keyboard + gamepad input, sampled once per fixed simulation step.
//
// Key presses are "latched": a key tapped and released between two steps
// still registers as down for one step, so quick taps are never dropped.

export const ACTIONS = [
  'up', 'down', 'left', 'right', 'shot', 'focus', 'bomb', 'special',
  'ultimate', 'pause', 'confirm', 'back', 'debug',
];

const DEADZONE = 0.22;

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.keys = new Set();        // currently held codes
    this.latched = new Set();     // pressed since last poll
    this.rawPrev = new Set();     // codes held at previous poll (for raw edges)
    this.rawNow = new Set();
    this.state = Object.create(null);
    this.prev = Object.create(null);
    for (const a of ACTIONS) { this.state[a] = false; this.prev[a] = false; }

    this.moveX = 0;
    this.moveY = 0;
    this.lastDevice = 'keyboard';
    this.padIndex = -1;
    this._captureCb = null;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  _onKeyDown = (e) => {
    if (this._captureCb) {
      e.preventDefault();
      const cb = this._captureCb;
      this._captureCb = null;
      cb(e.code);
      return;
    }
    // Stop the page from scrolling / browser shortcuts stealing game keys.
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Backquote' || e.code === 'F3') {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    this.latched.add(e.code);
    this.lastDevice = 'keyboard';
  };

  _onKeyUp = (e) => { this.keys.delete(e.code); };

  /** Next physical key press is delivered to cb instead of the game (key remap UI). */
  captureNextKey(cb) { this._captureCb = cb; }

  _readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) { this.padIndex = i; return p; }
    }
    this.padIndex = -1;
    return null;
  }

  /** Called exactly once per fixed step, before game logic. */
  poll() {
    const keyMap = this.settings.data.keys;
    const padMap = this.settings.data.pad;
    const pad = this._readPad();

    for (const a of ACTIONS) {
      this.prev[a] = this.state[a];
      let v = false;
      const codes = keyMap[a];
      if (codes) {
        for (let i = 0; i < codes.length; i++) {
          if (this.keys.has(codes[i]) || this.latched.has(codes[i])) { v = true; break; }
        }
      }
      if (!v && pad) {
        const btns = padMap[a];
        if (btns) {
          for (let i = 0; i < btns.length; i++) {
            const b = pad.buttons[btns[i]];
            if (b && (b.pressed || b.value > 0.5)) { v = true; this.lastDevice = 'gamepad'; break; }
          }
        }
      }
      this.state[a] = v;
    }

    // Movement vector: digital (normalised diagonal) or analog stick.
    let mx = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    let my = (this.state.down ? 1 : 0) - (this.state.up ? 1 : 0);
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    if (pad && pad.axes.length >= 2) {
      const ax = pad.axes[0], ay = pad.axes[1];
      const mag = Math.hypot(ax, ay);
      if (mag > DEADZONE) {
        // Radial deadzone, rescaled so movement starts smoothly from 0.
        const k = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag;
        mx = ax * k; my = ay * k;
        this.lastDevice = 'gamepad';
      }
    }
    this.moveX = mx;
    this.moveY = my;

    // Raw key edges (used for debug/dev toggles that are not remappable).
    const tmp = this.rawPrev; this.rawPrev = this.rawNow; this.rawNow = tmp;
    this.rawNow.clear();
    for (const k of this.keys) this.rawNow.add(k);
    for (const k of this.latched) this.rawNow.add(k);

    this.latched.clear();
  }

  down(a) { return this.state[a]; }
  pressed(a) { return this.state[a] && !this.prev[a]; }
  released(a) { return !this.state[a] && this.prev[a]; }
  keyPressed(code) { return this.rawNow.has(code) && !this.rawPrev.has(code); }

  /** Light rumble on supported gamepads (Chrome/Edge). */
  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    if (this.padIndex < 0) return;
    const pad = navigator.getGamepads()[this.padIndex];
    const act = pad && pad.vibrationActuator;
    if (act && act.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    }
  }
}
