// Attract demo (M7b, prompt §8): after the title sits idle, a random pilot
// flies a real procedural stage on a random seed under an autopilot, then
// the ranking boards page by, then the title returns. Any key drops back to
// the title. Nothing here is ranked, saved or unlocked.
//
// Autopilot: steer under the nearest enemy, pushed away from nearby enemy
// bullets (inverse-square repulsion on their predicted positions); focus
// when the air is thick; special on cooldown; one showcase ultimate.
// The demo ship can't die (it would end the demo early).

import { StageScene } from './StageScene.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';
import { ROSTER } from '../pilots/index.js';
import { randomSeedString } from '../core/RNG.js';

const DEMO_STEPS = 60 * 36;
const ULT_AT = 60 * 14;

function autopilot(p, w) {
  const B = w.bullets;
  let rx = 0, ry = 0, near = 0, close = 0;
  for (let i = 0; i < B.count; i++) {
    // Look a few steps ahead along the bullet's velocity.
    const bx = B.x[i] + (B.vx ? B.vx[i] * 6 : 0), by = B.y[i] + (B.vy ? B.vy[i] * 6 : 0);
    const dx = p.x - bx, dy = p.y - by, d2 = dx * dx + dy * dy;
    if (d2 > 90 * 90) continue;
    near++;
    if (d2 < 26 * 26) close++;
    const k = 900 / Math.max(60, d2);
    rx += dx * k / 30; ry += dy * k / 30;
  }
  const tgt = w.nearestEnemy(p.x, p.y - 200, 600);
  const tx = tgt ? tgt.x : WORLD_W / 2 + Math.sin(p.t * 0.01) * 120;
  const ty = WORLD_H - 110 + Math.sin(p.t * 0.013) * 30;
  // Keep off the walls so the demo ship stays on show.
  const wall = p.x < 60 ? (60 - p.x) / 30 : p.x > WORLD_W - 60 ? (WORLD_W - 60 - p.x) / 30 : 0;
  let mx = (tx - p.x) / 50 + rx + wall, my = (ty - p.y) / 60 + ry;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; } else if (m < 0.08) { mx = 0; my = 0; }
  return {
    mx, my,
    focus: near > 8,
    bomb: close > 4 && p.bombs > 0 && p.bombT === 0,
    special: p.specialReady && p.t % 240 === 0,
    ultimate: p.t === ULT_AT,
  };
}

export class AttractScene extends StageScene {
  constructor() {
    const pool = ROSTER.filter((d) => !d.legendary && d.id !== 'warden');
    super(pool[Math.floor(Math.random() * pool.length)], { stage: Math.floor(Math.random() * 6) });
    this.attract = true;
    this.ranked = false;
    this.difficultyId = 'medium';
    this.playerOpts = { demo: true };
  }

  enter(g) {
    this.savedSeed = g.seed;
    g.seed = randomSeedString();
    super.enter(g);
  }

  setup() {
    super.setup();
    const p = this.world.player;
    p.autopilot = autopilot;
    p.power = 300;      // show the pilot near full power
    p.hit = () => {};   // the demo never ends in a game over
    this.blockPause = true;
    this.g.hud.querySelector('.hud-hint').innerHTML = '<span class="tt-blink">DEMO PLAY · PRESS START</span>';
  }

  exit() {
    super.exit();
    this.g.seed = this.savedSeed;
  }

  update() {
    const g = this.g, inp = g.input;
    if (this.leaving) return;
    if (['confirm', 'back', 'pause', 'shot', 'bomb'].some((a) => inp.pressed(a))) return this._go('title');
    const p = this.world.player;
    if (p.t === ULT_AT - 1) p.ult = 100; // one showcase ultimate (demo ships don't charge it)
    this.blockPause = true;
    if (this.tallyState || this.run.steps > DEMO_STEPS) return this._go('ranking');
    super.update();
  }

  _go(where) {
    this.leaving = true;
    if (where === 'title') import('./TitleScene.js').then(({ TitleScene }) => this.g.setScene(new TitleScene()));
    else import('./RankingScene.js').then(({ RankingScene }) => this.g.setScene(new RankingScene({ attract: true })));
  }
}
