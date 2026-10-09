// Results (M7b): the end-of-run summary after GAME OVER (prompt §8 flow).
// Rows count up one after another; Z continues to wherever the run came
// from (pilot select, or the practice boss list).

import { MenuScene } from './MenuScene.js';
import { rankLabel } from '../ui/ranking.js';
import { sfx } from '../audio/sfx.js';

const ROW_STEPS = 14;

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const time = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export class ResultsScene extends MenuScene {
  build() {
    const S = this.opts.summary;
    this.rows = [];
    this.lines = [
      ['PILOT', `${S.def.name}`],
      ['DIFFICULTY', S.diff.name],
      [S.practice ? 'BOSS' : 'STAGE REACHED', S.stage || '—'],
      ['FLIGHT TIME', time(S.seconds)],
      ['ENEMIES DESTROYED', fmt(S.kills)],
      ['MAX CHAIN', fmt(S.maxChain)],
      ['GRAZE', fmt(S.graze)],
      ['BOMBS USED', fmt(S.bombs)],
      ['SHIPS LOST', fmt(S.deaths)],
      ['CONTINUES', fmt(S.continues)],
    ];
    const rank = S.ranked && S.rank >= 0 ? `<div class="rs-rank">${rankLabel(S.rank)} PLACE · ${S.diff.name}</div>` : '';
    this.html(`
      <div class="mscreen results" style="--dc:${S.def.css || '#3ef0ff'}">
        <div class="ms-title">${S.practice ? 'PRACTICE RESULTS' : 'MISSION REPORT'}<span>SEED ${S.seed}</span></div>
        <div class="rs-score"><small>FINAL SCORE</small><b>${fmt(S.score)}</b>${rank}</div>
        <div class="rs-lines">${this.lines.map(([k, v]) => `<div class="rs-line"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        <div class="ms-foot rs-next">&nbsp;</div>
      </div>`);
    this.lineEls = [...this.root.querySelectorAll('.rs-line')];
  }

  tick() {
    const shown = Math.min(this.lines.length, Math.floor(this.t / ROW_STEPS));
    this.lineEls.forEach((el, i) => el.classList.toggle('on', i < shown));
    if (this.t % ROW_STEPS === 0 && shown <= this.lines.length && shown > 0) sfx.play('tallyTick');
    const done = shown >= this.lines.length;
    if (done && !this.ready) {
      this.ready = true;
      this.root.querySelector('.rs-next').innerHTML = 'PRESS <b>Z</b> TO CONTINUE';
    }
    const inp = this.g.input;
    if (inp.pressed('confirm') || inp.pressed('back')) {
      if (!done) { this.t = this.lines.length * ROW_STEPS; return; } // skip the count-up
      this.opts.next();
      this.tick = () => false;
    }
  }
}
