// Ranking screen (M7b): the local high-score boards (M7a), one per
// difficulty plus the Legendary boards that have entries. ◀▶ switches
// board. In attract mode the boards page by themselves and any key returns
// to the title.

import { MenuScene } from './MenuScene.js';
import { DIFFICULTIES } from '../core/difficulty.js';
import { loadBoard, boards } from '../core/hiscores.js';
import { rankingTableHtml } from '../ui/ranking.js';
import { playUiTick, playBack } from '../audio/sting.js';

const PAGE_STEPS = 60 * 4;

export class RankingScene extends MenuScene {
  build() {
    const have = new Set(boards());
    this.tabs = [];
    for (const d of DIFFICULTIES) {
      this.tabs.push({ id: d.id, name: d.name, color: d.color });
      if (have.has(`${d.id}.legendary`)) this.tabs.push({ id: `${d.id}.legendary`, name: `${d.name} · LEGENDARY`, color: '#ffd870' });
    }
    const want = this.opts.board || this.g.difficultyId || 'standard';
    this.tab = Math.max(0, this.tabs.findIndex((t) => t.id === want));
    this.html(`
      <div class="mscreen ranking">
        <div class="ms-title">RANKING<span>PRECINCT 9 · SERVICE RECORDS</span></div>
        <div class="rk-tabs"></div>
        <div class="rk-board"></div>
        <div class="ms-foot">${this.opts.attract ? '<span class="tt-blink">PRESS START</span>' : '<b>◀▶</b> board · <b>X / ESC</b> back'}</div>
      </div>`);
    this._show();
  }

  _show() {
    const t = this.tabs[this.tab];
    this.root.style.setProperty('--dc', t.color);
    this.root.querySelector('.rk-tabs').innerHTML = `◀ <b>${t.name}</b> ▶ <small>${this.tab + 1}/${this.tabs.length}</small>`;
    const rows = loadBoard(t.id);
    this.root.querySelector('.rk-board').innerHTML = rankingTableHtml(rows, { rows: 10 })
      + (rows.length ? '' : '<div class="rk-empty">NO RECORDS YET</div>');
  }

  tick() {
    const inp = this.g.input, n = this.tabs.length;
    if (this.opts.attract) {
      if (['confirm', 'back', 'shot', 'pause', 'up', 'down'].some((a) => inp.pressed(a))) return this._title();
      if (this.t % PAGE_STEPS === 0) {
        // Page through the standard boards once, then hand back to the title.
        if (this.t / PAGE_STEPS >= DIFFICULTIES.length) return this._title();
        this.tab = (this.tab + 1) % n;
        this._show();
      }
      return;
    }
    if (inp.pressed('left')) { this.tab = (this.tab + n - 1) % n; this._show(); playUiTick(); }
    if (inp.pressed('right')) { this.tab = (this.tab + 1) % n; this._show(); playUiTick(); }
    if (inp.pressed('back') || inp.pressed('confirm')) { playBack(); this._title(); }
  }

  _title() {
    import('./TitleScene.js').then(({ TitleScene }) => this.g.setScene(new TitleScene({ index: 2 })));
    this.opts.attract = false;
    this.tick = () => false;
    return false;
  }
}
