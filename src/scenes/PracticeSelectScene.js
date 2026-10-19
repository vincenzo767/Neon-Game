// Practice boss list (M7b, prompt §8: "practice mode for any unlocked boss").
// A boss unlocks once it has appeared in a ranked run; its Mk. II / III
// variants unlock when those have been reached. Pick boss, Mk. and
// difficulty, then a pilot. All 30 bosses are listed, grouped under their
// six archetypes (header rows are skipped by the cursor; the list scrolls).

import { MenuScene } from './MenuScene.js';
import { BOSSES, ARCHETYPES, ARCHETYPE_LABEL, ROSTER } from '../bosses/index.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from '../core/difficulty.js';
import { factionForArchetype } from '../data/factions/index.js';
import { bossesSeen } from '../pilots/unlocks.js';
import { PilotSelectScene } from './PilotSelectScene.js';

const ROMAN = ['', 'I', 'II', 'III'];

export class PracticeSelectScene extends MenuScene {
  build() {
    const g = this.g, seen = bossesSeen();
    this.mk = {};
    void BOSSES;
    let di = Math.max(0, DIFFICULTIES.findIndex((d) => d.id === (g.difficultyId || g.settings.data.difficulty || DEFAULT_DIFFICULTY)));
    const bossRow = (b) => {
      const max = seen[b.id] || 0, fac = factionForArchetype(b.archetype);
      this.mk[b.id] = Math.max(1, max);
      if (!max) return { label: '??? — NOT YET ENCOUNTERED', disabled: true, hint: `${ARCHETYPE_LABEL[b.archetype]} CLASS · reach it in a run to unlock`, value: () => 'LOCKED' };
      const cyc = (d) => { this.mk[b.id] = ((this.mk[b.id] - 1 + d + max) % max) + 1; };
      return {
        label: b.name, id: b.id,
        hint: `${fac ? fac.short : ''} · ${ARCHETYPE_LABEL[b.archetype]} CLASS · ${b.phases.length} PHASES AUTHORED`,
        value: () => `MK.${ROMAN[this.mk[b.id]]}`,
        left: max > 1 ? () => cyc(-1) : null, right: max > 1 ? () => cyc(1) : null,
        confirm: () => {
          g.difficultyId = DIFFICULTIES[di].id;
          g.setScene(new PilotSelectScene({ practice: { id: b.id, mk: this.mk[b.id] } }));
        },
      };
    };
    this.rows = [];
    for (const a of ARCHETYPES) {
      const list = ROSTER[a] || [];
      if (!list.length) continue;
      const known = list.filter((b) => seen[b.id]).length;
      this.rows.push({ label: `${ARCHETYPE_LABEL[a]}  ·  ${known}/${list.length}`, skip: true, header: true });
      for (const b of list) this.rows.push(bossRow(b));
    }
    this.rows.push(
      { label: 'DIFFICULTY', hint: 'Practice uses this difficulty (unranked)', value: () => DIFFICULTIES[di].name, left: () => { di = (di + DIFFICULTIES.length - 1) % DIFFICULTIES.length; }, right: () => { di = (di + 1) % DIFFICULTIES.length; } },
      { label: 'BACK', confirm: () => this.onBack() },
    );
    const want = this.rows.findIndex((r) => r.id && r.id === this.opts.id);
    this.index = want >= 0 ? want : Math.max(0, this.rows.findIndex((r) => !r.disabled && !r.skip));
    this.html(`
      <div class="mscreen practice">
        <div class="ms-title">PRACTICE<span>SYNDICATE COMMAND UNITS ON FILE</span></div>
        <div class="ms-list pr-list"></div>
        <div class="ms-rowhint"></div>
        <div class="ms-foot"><b>↑↓</b> boss · <b>◀▶</b> Mk. / difficulty · <b>Z</b> choose pilot · <b>X / ESC</b> back</div>
      </div>`);
    this.renderRows();
  }

  onBack() {
    import('./TitleScene.js').then(({ TitleScene }) => this.g.setScene(new TitleScene({ index: 1 })));
  }
}
