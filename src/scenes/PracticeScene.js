// Practice run (M7b, prompt §8): a single boss fight on its home territory.
// It is a StageScene with a two-section plan (boss → tally), unranked, and
// it returns to the practice boss list instead of the next stage.

import { StageScene } from './StageScene.js';
import { generateStage } from '../stages/StageGen.js';
import { BIOMES } from '../stages/biomes.js';
import { EXTRA_BIOMES } from '../stages/biomesExtra.js';
import { BIOME_OWNERS, factionForArchetype } from '../data/factions/index.js';
import { BOSSES } from '../bosses/index.js';

/** First biome owned by the faction behind an archetype (the boss's home turf). */
function homeBiome(archetype) {
  const fac = factionForArchetype(archetype);
  const all = [...BIOMES, ...EXTRA_BIOMES];
  return (fac && all.find((b) => (BIOME_OWNERS[b.id] || {}).main === fac.id)) || BIOMES[0];
}

export class PracticeScene extends StageScene {
  /** @param practice {{id, mk}} boss id and Mk. variant */
  constructor(def, practice) {
    super(def);
    this.practice = practice;
    this.ranked = false;
  }

  setup() {
    super.setup();
    this.menuHint = `<div class="menu-sub">PRACTICE · ${BOSSES[this.practice.id].name} MK.${'I'.repeat(this.practice.mk)}</div>`;
  }

  makePlan(index) {
    const base = generateStage(this.g.seed, index, this.diffCfg.id);
    const def = BOSSES[this.practice.id], mk = this.practice.mk || 1;
    return {
      ...base,
      biome: homeBiome(def.archetype),
      sections: [
        { type: 'boss', id: 'syndicateCore', arena: { id: def.id, archetype: def.archetype, mk, deck: mk - 1, fallback: false } },
        { type: 'tally' },
      ],
    };
  }

  stageLabel() {
    const def = BOSSES[this.practice.id];
    return `${def.name} MK.${'I'.repeat(this.practice.mk || 1)}`;
  }

  restartScene() { this.g.setScene(new PracticeScene(this.def, this.practice)); }

  /** Tally closed: the fight is over → results → the boss list. */
  nextStage() { this.endRun(); }

  afterResults() {
    import('./PracticeSelectScene.js').then(({ PracticeSelectScene }) => {
      this.g.setScene(new PracticeSelectScene({ id: this.practice.id }));
    });
  }

  /** Pause → quit goes back to the boss list too. */
  pilotSelect() {
    this.afterResults();
    this.leaving = true;
  }
}
