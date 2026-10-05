import { PlayScene } from './PlayScene.js';
import { TestSpawner, DENSITY } from './testEnemies.js';

// TEST RANGE: a sandbox for any pilot against placeholder waves with
// selectable bullet density (1-4). Reachable from pilot select with C.

export class TestRangeScene extends PlayScene {
  setup() {
    this.ranked = false; // sandbox: no hi-score
    this.world.density = 1;
    this.spawner = new TestSpawner(this.world);
    this.menuHint = '<div class="menu-sub">TEST RANGE · 1-4 bullet density</div>';
    this.banner('TEST RANGE', `${this.def.name} · ${this.def.vehicle}`, 140);
    this.hud.setStage('TEST RANGE');
  }

  restartScene() { this.g.setScene(new TestRangeScene(this.def)); }

  onSceneEvent(type) {
    if (type === 'coreDown') this.banner('CORE DOWN', 'BREAK-APART SEQUENCE', 110);
  }

  tick() {
    const inp = this.g.input;
    for (let k = 0; k < 4; k++) {
      if (inp.keyPressed(`Digit${k + 1}`)) {
        this.world.density = k;
        this.banner(`DENSITY ${DENSITY[k].label}`, 'BULLET STRESS TEST', 70);
      }
    }
    this.spawner.update();
  }
}
