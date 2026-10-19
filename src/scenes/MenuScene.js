// Shared base for the full-screen menus (M7b): title, ranking, options,
// practice select, results. It owns the backdrop (level rework: one of the
// game's real arenas flying by — fx/menuBackdrop.js), the menu theme and a
// small list-menu helper so each screen only describes rows.
//
// Row: { label, value?: () => string, left?(), right?(), confirm?(),
//        disabled?: boolean, hint?: string }
// Subclasses implement build() (DOM) and optionally tick() / onBack().

import { Parallax } from '../fx/Parallax.js';
import { menuBackdrop, updateMenuBackdrop, renderMenuCover } from '../fx/menuBackdrop.js';
import { BIOMES } from '../stages/biomes.js';
import { music } from '../audio/music.js';
import { playUiTick, playConfirm, playBack } from '../audio/sting.js';
import { handleDevKeys } from './devKeys.js';
import '../ui/menus.css';

export class MenuScene {
  constructor(opts = {}) { this.opts = opts; }

  enter(g) {
    this.g = g;
    this.t = 0;
    this.index = 0;
    this.rows = [];
    if (this.menuMusic !== false) music.menu();
    const biome = this.biome || BIOMES[0];
    g.renderer.background.setBiome(biome.bg);
    this.parallax = new Parallax(g, biome);
    menuBackdrop(g);
    this.build();
  }

  exit() { this.g.hud.innerHTML = ''; }

  /** Replace the HUD layer with this screen's markup. */
  html(markup) {
    this.g.hud.innerHTML = markup;
    this.root = this.g.hud.firstElementChild;
  }

  // ------------------------------------------------------------ list menu

  /** Render `rows` into the element matching `sel` (call after changes). */
  renderRows(sel = '.ms-list') {
    const box = this.g.hud.querySelector(sel);
    if (!box) return;
    box.innerHTML = this.rows.map((r, i) => {
      const v = r.value ? `<span class="ms-val">${r.left || r.right ? '◀ ' : ''}${r.value()}${r.left || r.right ? ' ▶' : ''}</span>` : '';
      return `<div class="ms-row${i === this.index ? ' sel' : ''}${r.disabled ? ' off' : ''}${r.header ? ' hdr' : ''}"><span class="ms-label">${r.label}</span>${v}</div>`;
    }).join('');
    // Long lists scroll: keep the selected row in view.
    const cur = box.querySelector('.ms-row.sel');
    if (cur && box.scrollHeight > box.clientHeight) cur.scrollIntoView({ block: 'nearest' });
    const hint = this.g.hud.querySelector('.ms-rowhint');
    if (hint) hint.textContent = (this.rows[this.index] && this.rows[this.index].hint) || '';
  }

  /** Up/down/left/right/confirm/back over `rows`. Returns true if it acted. */
  navRows() {
    const inp = this.g.input, n = this.rows.length;
    if (!n) return false;
    let acted = false;
    const move = (d) => {
      let i = this.index;
      for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!this.rows[i].skip) break; }
      this.index = i;
      playUiTick();
      acted = true;
    };
    if (inp.pressed('up')) move(-1);
    if (inp.pressed('down')) move(1);
    const r = this.rows[this.index];
    if (inp.pressed('left') && r.left) { r.left(); playUiTick(); acted = true; }
    if (inp.pressed('right') && r.right) { r.right(); playUiTick(); acted = true; }
    if (inp.pressed('confirm') && !r.disabled) {
      if (r.confirm) { playConfirm(); r.confirm(); return true; }
      if (r.right) { r.right(); playUiTick(); acted = true; }
    } else if (inp.pressed('confirm') && r.disabled) { playBack(); }
    if (inp.pressed('back') && this.onBack) { playBack(); this.onBack(); return true; }
    if (acted) this.renderRows();
    return acted;
  }

  // ---------------------------------------------------------------- loop

  update() {
    const g = this.g;
    this.t++;
    if (this.tick) { if (this.tick() === false) return; } else this.navRows();
    if (g.scene !== this) return;
    handleDevKeys(g);
    g.renderer.background.update();
    updateMenuBackdrop(g);
  }

  render(r) {
    renderMenuCover(r.batch, r.frame('white'));
  }
}
