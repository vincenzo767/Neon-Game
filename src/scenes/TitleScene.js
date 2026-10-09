// Title screen (M7b, prompt §8 flow: title → attract demo → difficulty →
// pilot select). START, PRACTICE, RANKING, OPTIONS. Left idle for
// ATTRACT_AFTER steps it runs the attract cycle (demo play → ranking → back).

import { MenuScene } from './MenuScene.js';
import { DifficultySelectScene } from './DifficultySelectScene.js';
import { CITY, BREACH } from '../data/lore/world.js';
import { bossesSeen } from '../pilots/unlocks.js';

export const ATTRACT_AFTER = 60 * 20;

export class TitleScene extends MenuScene {
  build() {
    const g = this.g, seen = Object.keys(bossesSeen()).length;
    this.idle = 0;
    this.index = this.opts.index || 0;
    this.rows = [
      { label: 'START', hint: 'Endless procedural run: pick a difficulty, then a pilot', confirm: () => g.setScene(new DifficultySelectScene()) },
      {
        label: 'PRACTICE', disabled: seen === 0,
        hint: seen ? `Fight any boss you have reached (${seen} unlocked)` : 'Reach a syndicate boss in a run to unlock practice',
        confirm: () => import('./PracticeSelectScene.js').then(({ PracticeSelectScene }) => g.setScene(new PracticeSelectScene())),
      },
      { label: 'RANKING', hint: 'Local high-score tables per difficulty', confirm: () => import('./RankingScene.js').then(({ RankingScene }) => g.setScene(new RankingScene())) },
      { label: 'OPTIONS', hint: 'Graphics, CRT, shake, audio, controls', confirm: () => import('./OptionsScene.js').then(({ OptionsScene }) => g.setScene(new OptionsScene())) },
    ];
    this.html(`
      <div class="mscreen title">
        <div class="tt-logo">
          <small>${CITY.name.toUpperCase()} · ${CITY.year}</small>
          <b class="tt-neon">NEON PRECINCT</b>
          <b class="tt-over">OVERDRIVE</b>
        </div>
        <div class="tt-tag">${BREACH.coverUp}</div>
        <div class="ms-list title-list"></div>
        <div class="ms-rowhint"></div>
        <div class="ms-foot"><b>↑↓</b> choose · <b>Z / ENTER</b> select · <span class="tt-blink">PRESS START</span></div>
        <div class="tt-ver">ALL AUDIO + ART SYNTHESIZED AT RUNTIME · SEED ${g.seed}</div>
      </div>`);
    this.renderRows();
  }

  tick() {
    const inp = this.g.input;
    const any = ['up', 'down', 'left', 'right', 'confirm', 'back', 'shot', 'pause'].some((a) => inp.down(a));
    this.idle = any ? 0 : this.idle + 1;
    if (this.navRows()) return;
    if (this.idle > ATTRACT_AFTER) {
      import('./AttractScene.js').then(({ AttractScene }) => this.g.setScene(new AttractScene()));
      this.idle = -1e9;
    }
  }
}
