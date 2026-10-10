import { STEP, MAX_STEPS_PER_FRAME } from './constants.js';
import { Settings } from './Settings.js';
import { Input } from './Input.js';
import { Camera } from './Camera.js';
import { RNG, randomSeedString } from './RNG.js';
import { Renderer } from './gl/Renderer.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { PILOT_SPRITES } from '../pilots/index.js';
import { buildEnemySprites } from '../entities/enemies/index.js';
import { buildBossSprites } from '../bosses/art.js';
import { buildFactionSkins } from '../fx/factionSkins.js';

// Top-level engine object: owns subsystems and runs the fixed-step loop.
//
// Loop model: simulation advances in fixed 1/60 s steps (deterministic,
// seed-replayable); rendering happens once per display frame and
// interpolates positions by `alpha` so 120/144 Hz monitors stay smooth.
//
// Hit-stop freezes simulation for N steps while the camera, post-FX and
// rendering keep running — the classic "impact freeze" that sells hits.

export class Game {
  constructor({ canvas, stage, hud, debug }) {
    this.settings = new Settings();
    this.input = new Input(this.settings);
    this.camera = new Camera(this.settings);
    this.renderer = new Renderer(canvas, stage, this.settings, [...PILOT_SPRITES, buildEnemySprites, buildBossSprites, buildFactionSkins]);
    this.hud = hud;
    this.debug = new DebugOverlay(debug, this);

    this.seed = randomSeedString();
    this.rng = new RNG(this.seed);         // gameplay only
    this.fxRng = new RNG(Date.now() >>> 0); // cosmetic only

    this.scene = null;
    this.frameCount = 0;   // simulation steps executed (excludes hit-stop)
    this.time = 0;         // real seconds since start
    this.hitstop = 0;
    this.acc = 0;
    this.last = 0;
    this.cpuMs = 0;
    this.running = false;
    this.turbo = 0;
  }

  setScene(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    scene.enter(this);
  }

  hitStop(steps) { this.hitstop = Math.max(this.hitstop, steps); }

  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  _frame = (now) => {
    if (!this.running) return;
    requestAnimationFrame(this._frame);
    const t0 = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    // M7c: while the WebGL context is lost the game is frozen (no blind play).
    if (this.renderer.lost) { this.acc = 0; return; }
    if (dt > 0.25) dt = 0.25; // tab was hidden; don't spiral
    this.time += dt;
    this.acc += dt;

    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this._step();
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // fell behind: drop time
    for (let k = 0; k < this.turbo; k++) this._step(); // dev: fast-forward (window.__npo.turbo = n)

    // During hit-stop nothing moves, so render the latest state exactly.
    const alpha = this.hitstop > 0 ? 1 : this.acc / STEP;
    this._render(alpha);
    this.cpuMs = performance.now() - t0;
    this.debug.frame(dt);
  };

  _step() {
    if (this.hitstop > 0) {
      // Don't poll during the freeze: latched presses carry over to the
      // first live step instead of being swallowed by the hit-stop.
      this.hitstop--;
    } else if (this.scene) {
      this.input.poll();
      if (this.input.pressed('debug')) this.debug.toggle();
      this.scene.update(STEP);
      this.frameCount++;
    }
    this.camera.update(STEP);
    this.renderer.post.update(STEP);
  }

  _render(alpha) {
    const r = this.renderer;
    r.begin(this.camera, this.time, alpha);
    if (this.scene) this.scene.render(r, alpha);
    r.end(this.camera);
  }
}
