// Options (M7b, prompt §8): graphics quality, CRT filter, screen shake,
// master / music / SFX volume and keyboard remapping. Everything is stored
// through core/Settings (localStorage) and applies immediately.
//
// Key remap: pick an action, press the new key. The key becomes the
// action's primary binding and is removed from every other gameplay action
// so one key never drives two of them. Menu keys (confirm/back) keep their
// own bindings. Esc cancels a capture.

import { MenuScene } from './MenuScene.js';
import { playConfirm, playBack } from '../audio/sting.js';

const QUALITIES = ['low', 'medium', 'high'];
const SHAKES = [0, 0.5, 1, 1.5];
const REMAP = [
  ['up', 'MOVE UP'], ['down', 'MOVE DOWN'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'],
  ['shot', 'SHOT'], ['focus', 'FOCUS'], ['bomb', 'BOMB'], ['special', 'SPECIAL'],
  ['ultimate', 'ULTIMATE'], ['pause', 'PAUSE'],
];
const GAMEPLAY = REMAP.map(([a]) => a);

/** Human-readable key name for a KeyboardEvent.code. */
export function keyName(code) {
  if (!code) return '—';
  const m = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', Backspace: 'BKSP', Backquote: '`', Tab: 'TAB' };
  if (m[code]) return m[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

const pct = (v) => `${Math.round(v * 100)}%`;
const clamp01 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;

export class OptionsScene extends MenuScene {
  build() {
    this.page = 'main';
    this.capturing = null;
    this._mainRows();
  }

  _mainRows() {
    const s = this.g.settings;
    const cycle = (key, list, d) => {
      const i = list.indexOf(s.get(key));
      s.set(key, list[(Math.max(0, i) + d + list.length) % list.length]);
    };
    const vol = (key, label, def) => ({
      label, value: () => pct(s.get(key) ?? def),
      left: () => s.set(key, clamp01((s.get(key) ?? def) - 0.1)),
      right: () => s.set(key, clamp01((s.get(key) ?? def) + 0.1)),
    });
    this.page = 'main';
    this.index = 0;
    this.rows = [
      { label: 'GRAPHICS QUALITY', hint: 'Render scale and bloom (LOW for older GPUs)', value: () => s.get('quality').toUpperCase(), left: () => cycle('quality', QUALITIES, -1), right: () => cycle('quality', QUALITIES, 1) },
      { label: 'CRT FILTER', hint: 'Scanlines, curvature and phosphor glow', value: () => (s.get('crt') ? 'ON' : 'OFF'), left: () => s.set('crt', !s.get('crt')), right: () => s.set('crt', !s.get('crt')) },
      { label: 'SCREEN SHAKE', hint: 'Camera shake intensity', value: () => pct(s.get('shake')), left: () => cycle('shake', SHAKES, -1), right: () => cycle('shake', SHAKES, 1) },
      vol('masterVolume', 'MASTER VOLUME', 1),
      vol('musicVolume', 'MUSIC VOLUME', 0.7),
      vol('sfxVolume', 'SFX VOLUME', 0.8),
      { label: 'CONTROLS', hint: 'Remap keyboard controls', confirm: () => this._keyRows() },
      { label: 'BACK', confirm: () => this.onBack() },
    ];
    this._frame('OPTIONS', 'SYSTEM CONFIGURATION');
  }

  _keyRows() {
    const s = this.g.settings;
    this.page = 'keys';
    this.index = 0;
    this.rows = REMAP.map(([a, label]) => ({
      label,
      hint: 'Z / ENTER: press a new key for this action',
      value: () => (s.data.keys[a] || []).map(keyName).join(' / ') || '—',
      confirm: () => this._capture(a),
    }));
    this.rows.push(
      { label: 'RESET TO DEFAULTS', hint: 'Restore every key binding', confirm: () => { s.resetBindings(); this.renderRows(); } },
      { label: 'BACK', confirm: () => this._mainRows() },
    );
    this._frame('CONTROLS', 'KEYBOARD · GAMEPAD USES THE STANDARD LAYOUT');
  }

  _frame(title, sub) {
    this.html(`
      <div class="mscreen options">
        <div class="ms-title">${title}<span>${sub}</span></div>
        <div class="ms-list opt-list"></div>
        <div class="ms-rowhint"></div>
        <div class="ms-foot"><b>↑↓</b> choose · <b>◀▶</b> change · <b>Z</b> select · <b>X / ESC</b> back</div>
        <div class="opt-capture"></div>
      </div>`);
    this.renderRows();
  }

  _capture(action) {
    this.capturing = action;
    const box = this.root.querySelector('.opt-capture');
    box.innerHTML = `<div>PRESS A KEY FOR <b>${REMAP.find(([a]) => a === action)[1]}</b><small>ESC cancels</small></div>`;
    box.classList.add('on');
    // Give the confirm key time to be released before listening.
    setTimeout(() => this.g.input.captureNextKey((code) => this._bind(action, code)), 150);
  }

  _bind(action, code) {
    const box = this.root.querySelector('.opt-capture');
    box.classList.remove('on');
    this.capturing = null;
    if (code === 'Escape') { playBack(); return; }
    const s = this.g.settings;
    const keys = JSON.parse(JSON.stringify(s.data.keys));
    for (const a of GAMEPLAY) if (a !== action) keys[a] = (keys[a] || []).filter((k) => k !== code);
    keys[action] = [code, ...(keys[action] || []).filter((k) => k !== code)];
    s.set('keys', keys);
    playConfirm();
    this.renderRows();
  }

  onBack() {
    if (this.page === 'keys') { this._mainRows(); this.index = 6; this.renderRows(); return; }
    import('./TitleScene.js').then(({ TitleScene }) => this.g.setScene(new TitleScene({ index: 3 })));
  }

  tick() {
    if (this.capturing) return; // the next key goes to the remap
    this.navRows();
  }
}
