import { WORLD_W, WORLD_H } from '../core/constants.js';
import { GRAZE_RADIUS } from '../core/constants.js';
import { FADE_OUT } from '../fx/Particles.js';

// Generic player craft driven entirely by a pilot definition
// (see src/pilots/*.js). The Player owns the shared rules: movement, focus,
// lives, power tiers, bombs + death-bomb window, special cooldown, ultimate
// meter, options and respawn. Pilots supply the weapons and abilities.
//
// State machine:  alive ─hit─► dying ─(bomb within window)─► alive
//                                 └─timeout─► dead ─► respawning ─► alive
//                                                └─(no lives)─► gameover

export const MAX_POWER = 400;
export const DEATHBOMB_WINDOW = 15;  // steps after a hit where a bomb still saves you
const RESPAWN_DELAY = 50;
const SPEED_TUNE = [1, 1.08, 1.16, 1.24];

export class Player {
  constructor(world, def, opts = {}) {
    this.w = world;
    this.def = def;
    const r = world.r;
    this.x = this.px = WORLD_W / 2;
    this.y = this.py = WORLD_H - 70;
    this.lives = opts.lives ?? 3;
    this.bombs = def.bombStock;
    this.power = opts.power ?? 0;
    this.speedLevel = 0;
    this.state = 'alive';
    this.stateT = 0;
    this.invuln = opts.demo ? 0 : 120;
    this.focus = false;
    this.firing = false;
    this.fireCd = 0;
    this.specialCd = 0;
    this.specialT = 0;
    this.bombT = 0;
    this.ultT = 0;
    this.ult = opts.ult ?? 0;
    this.bank = 0;
    this.t = 0;
    this.demo = !!opts.demo;
    this.demoFocus = false;
    this.deaths = 0;
    this.bombsUsed = 0;
    this.hitR = def.hitbox;
    this.moveX = 0;
    this.moveY = 0;
    this.speedMul = 1;      // pilots may modify (e.g. brace mode)
    this.alpha = 1;         // pilots may modify (e.g. cloak)
    this.options = [];
    this.frames = [1, 2, 3, 4].map((t) => r.frame(`ship_${def.id}_${t}`));
    this.optFrame = def.optionSprite ? r.frame(def.optionSprite) : null;
    this.F = world.F;
    this.ps = {};           // pilot-private state
    if (def.init) def.init(this, world);
  }

  get tier() { return Math.min(4, 1 + Math.floor(this.power / 100)); }
  get collidable() { return this.state === 'alive'; }
  get invulnerable() { return this.invuln > 0 || this.bombT > 0 || this.ultT > 0 || this.ps.phase > 0; }
  get specialReady() { return this.specialCd === 0; }
  get specialFrac() { return this.def.special ? 1 - this.specialCd / this.def.special.cooldown : 1; }

  addPower(n) {
    const before = this.tier;
    this.power = Math.min(MAX_POWER, this.power + n);
    if (this.tier > before) {
      const F = this.F, H = this.w.fxHigh;
      const i = H.spawn(F.ring, this.x, this.y, 0, 0, 24);
      if (i >= 0) { H.size(i, 20, 160); H.color(i, ...this.def.color.map((c) => c * 2)); H.look(i, 0.9, 1); }
      this.w.r.post.flash(this.def.color[0], this.def.color[1], this.def.color[2], 0.15, 0.03);
      this.w.event('tier', this.tier);
    }
  }

  addUlt(n) {
    if (this.ultT > 0 || this.demo) return;
    const was = this.ult;
    this.ult = Math.min(100, this.ult + n);
    if (was < 100 && this.ult >= 100) this.w.event('ultReady');
  }

  onGraze() { this.addUlt(this.ps.cloak > 0 ? 0.7 : 0.35); }

  // ----------------------------------------------------------------- update

  update() {
    const w = this.w, def = this.def;
    this.px = this.x; this.py = this.y;
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.specialCd > 0) this.specialCd--;
    if (this.fireCd > 0) this.fireCd--;

    switch (this.state) {
      case 'dying':
        if (!this.demo && w.g.input.pressed('bomb') && this.bombs > 0) {
          this.state = 'alive';
          this._bomb(true);
        } else if (--this.stateT <= 0) this._die();
        this._tickAbilities();
        this._updateOptions();
        return;
      case 'dead':
        if (--this.stateT <= 0) {
          this.state = 'respawning';
          this.stateT = 45;
          this.x = this.px = WORLD_W / 2;
          this.y = this.py = WORLD_H + 40;
        }
        return;
      case 'respawning':
        this.y += (WORLD_H - 80 - this.y) * 0.12;
        this._updateOptions();
        if (--this.stateT <= 0) { this.state = 'alive'; this.invuln = 180; }
        return;
      case 'gameover':
        return;
    }

    // Inputs (demo mode drives itself for the pilot-select preview).
    let mx, my, shoot, focus, bombP = false, specP = false, ultP = false;
    if (this.demo) {
      mx = Math.sin(this.t * 0.025) * 0.5;
      my = 0;
      shoot = true;
      focus = this.demoFocus;
    } else {
      const inp = w.g.input;
      mx = inp.moveX; my = inp.moveY;
      shoot = inp.down('shot');
      focus = inp.down('focus');
      bombP = inp.pressed('bomb');
      specP = inp.pressed('special');
      ultP = inp.pressed('ultimate');
    }
    this.focus = focus;
    this.moveX = mx;
    this.moveY = my;

    // Movement (abilities like phase-dash may take over).
    if (!this.ps.moveLock) {
      const base = focus ? def.speed.focus : def.speed.normal;
      const sp = base * SPEED_TUNE[this.speedLevel] * this.speedMul;
      this.x += mx * sp;
      this.y += my * sp;
    }
    this.x = Math.min(WORLD_W - 12, Math.max(12, this.x));
    this.y = Math.min(WORLD_H - 18, Math.max(22, this.y));
    this.bank += (mx - this.bank) * 0.2;

    if (def.update) def.update(this, w);

    if (specP && def.special) {
      if (this.specialCd === 0) {
        this.specialCd = def.special.cooldown;
        this.specialT = def.special.duration || 0;
        def.special.activate(this, w);
        w.event('special', def.special.name);
      } else w.event('notReady', 'special');
    }
    if (bombP && this.bombs > 0 && this.bombT === 0 && this.ultT === 0) this._bomb(false);
    if (ultP) {
      if (this.ult >= 100 && this.ultT === 0 && this.bombT === 0) this._ultimate();
      else if (this.ultT === 0) w.event('notReady', 'ultimate');
    }
    this._tickAbilities();
    this._updateOptions();

    this.firing = shoot;
    if (shoot) def.fire(this, w);

    this._exhaust();
  }

  _tickAbilities() {
    const def = this.def, w = this.w;
    if (this.specialT > 0) {
      this.specialT--;
      if (def.special.update) def.special.update(this, w, def.special.duration - this.specialT);
      if (this.specialT === 0 && def.special.end) def.special.end(this, w);
    }
    if (this.bombT > 0) {
      this.bombT--;
      def.bomb.update(this, w, def.bomb.duration - this.bombT);
      if (this.bombT === 0 && def.bomb.end) def.bomb.end(this, w);
    }
    if (this.ultT > 0) {
      this.ultT--;
      def.ultimate.update(this, w, def.ultimate.duration - this.ultT);
      if (this.ultT === 0) {
        if (def.ultimate.end) def.ultimate.end(this, w);
        this.invuln = Math.max(this.invuln, 60);
      }
    }
  }

  _bomb(counter) {
    const w = this.w, def = this.def, post = w.r.post;
    this.bombs--;
    this.bombsUsed++;
    this.bombT = def.bomb.duration;
    this.invuln = Math.max(this.invuln, def.bomb.duration + 30);
    w.bombId = (w.bombId || 0) + 1;
    w.autoCollect = 90;
    w.cancelAll();
    post.flash(...def.color, 0.45, 0.03);
    post.aberrate(0.02);
    post.shockwave(this.x, this.y, 0.05, 0.02, 1.0);
    w.g.camera.addTrauma(0.45);
    w.g.input.rumble(0.9, 0.6, 350);
    def.bomb.activate(this, w);
    w.event('bomb', { name: def.bomb.name, counter });
  }

  _ultimate() {
    const w = this.w, def = this.def;
    this.ult = 0;
    this.ultT = def.ultimate.duration;
    this.invuln = Math.max(this.invuln, def.ultimate.duration + 30);
    w.cancelAll();
    def.ultimate.activate(this, w);
    w.event('ultimate', def);   // scene shows the cut-in (+ hit-stop freeze)
  }

  hit() {
    if (this.state !== 'alive') return;
    if (this.def.onHit && this.def.onHit(this, this.w)) return; // absorbed (e.g. brace)
    this.state = 'dying';
    this.stateT = DEATHBOMB_WINDOW;
    const post = this.w.r.post;
    post.flash(1, 0.1, 0.2, 0.35, 0.04);
    post.aberrate(0.03);
    this.w.g.hitStop(5);
    this.w.event('hit');
  }

  _die() {
    const w = this.w, post = w.r.post;
    this.deaths++;
    this.lives--;
    w.explosions.blast(this.x, this.y, 1.8, this.def.color);
    w.cancelCircle(this.x, this.y, 170);
    post.flash(1, 0.2, 0.25, 0.5, 0.03);
    post.aberrate(0.04);
    w.g.camera.addTrauma(0.75);
    w.g.camera.kick(0, 10);
    w.g.hitStop(10);
    w.g.input.rumble(1, 1, 400);
    // Lose half a tier of power, scattered as recoverable P items.
    const lost = Math.min(this.power, 50);
    this.power -= lost;
    for (let k = 0; k < Math.ceil(lost / 25) + 1; k++) w.spawnItem('P', this.x, this.y - 20, 2);
    this.bombs = Math.max(this.bombs, this.def.bombStock);
    this.specialCd = 0;
    this.specialT = 0;
    this.ps.moveLock = false;
    if (this.def.reset) this.def.reset(this, w);
    if (this.lives < 0) {
      this.lives = 0;
      this.state = 'gameover';
      w.event('gameover');
    } else {
      this.state = 'dead';
      this.stateT = RESPAWN_DELAY;
      w.event('death');
    }
  }

  /** Continue after game over. */
  continueGame() {
    this.lives = 2;
    this.state = 'dead';
    this.stateT = 10;
    this.bombs = this.def.bombStock;
  }

  _updateOptions() {
    const layout = this.def.optionLayout ? this.def.optionLayout(this) : null;
    const n = layout ? layout.length : 0;
    while (this.options.length < n) this.options.push({ x: this.x, y: this.y, px: this.x, py: this.y, i: this.options.length });
    this.options.length = n;
    for (let k = 0; k < n; k++) {
      const o = this.options[k];
      o.px = o.x; o.py = o.y;
      o.x += (this.x + layout[k][0] - o.x) * 0.35;
      o.y += (this.y + layout[k][1] - o.y) * 0.35;
    }
  }

  _exhaust() {
    const H = this.w.fxHigh, R = this.w.fxRng, c = this.def.engineColor, F = this.F;
    for (const [ex, ey] of this.def.engines) {
      const i = H.spawn(F.glow, this.x + ex, this.y + ey, R.range(-0.2, 0.2), R.range(2.5, 4), R.range(7, 12));
      if (i < 0) return;
      H.size(i, R.range(8, 11), 2);
      H.color(i, c[0] * 2, c[1] * 2, c[2] * 2, c[0] * 0.4, c[1] * 0.3, c[2]);
      H.look(i, 0.7 * this.alpha, 1, FADE_OUT);
    }
  }

  // ----------------------------------------------------------------- render

  get renderX() { return this._rx; }
  get renderY() { return this._ry; }

  render(b, alpha) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    this._rx = x; this._ry = y;
    if (this.state === 'dead' || this.state === 'gameover') return;
    const def = this.def, F = this.F;
    if (def.renderBelow) def.renderBelow(this, b, x, y, alpha);

    // Options.
    if (this.optFrame) {
      for (const o of this.options) {
        const ox = o.px + (o.x - o.px) * alpha, oy = o.py + (o.y - o.py) * alpha;
        b.draw(F.glow, ox, oy, 26, 26, 0, def.color[0], def.color[1], def.color[2], 0.35 * this.alpha, 1);
        const rot = def.optionSpin ? this.t * def.optionSpin + o.i : 0;
        b.draw(this.optFrame, ox, oy, this.optFrame.w, this.optFrame.h, rot, 1, 1, 1, this.alpha, 0);
      }
    }

    // Ship (tier variant), banking squash, invulnerability blink.
    let a = this.alpha;
    if (this.invuln > 0 && this.bombT === 0 && this.ultT === 0 && (this.t >> 2) & 1) a *= 0.35;
    const f = this.frames[this.tier - 1];
    const squash = 1 - Math.abs(this.bank) * 0.18;
    b.draw(f, x, y, f.w * squash, f.h, this.bank * 0.06, 1, 1, 1, a, 0);
    if (this.state === 'dying') b.draw(f, x, y, f.w, f.h, 0, 3, 0.6, 0.6, 0.9, 1);

    // Engine glow.
    const c = def.engineColor;
    const fl = 0.85 + 0.15 * Math.sin(this.t * 1.9);
    for (const [ex, ey] of def.engines) {
      b.draw(F.glow, x + ex, y + ey, 13 * fl, 19 * fl, 0, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 0.9 * this.alpha, 1);
    }
    if (def.renderAbove) def.renderAbove(this, b, x, y, alpha);
  }

  /** Pilot full-screen FX layer (bombs, ultimates) above particles. */
  renderFx(b, alpha) {
    if (this.def.renderFx) this.def.renderFx(this, b, alpha);
  }

  renderTop(b) {
    if (this.state !== 'alive' || !this.focus || this.demo) return;
    const x = this._rx, y = this._ry, F = this.F;
    b.draw(F.ring, x, y, GRAZE_RADIUS * 2.6, GRAZE_RADIUS * 2.6, 0, 0.3, 0.9, 1, 0.22, 1);
    const s = this.hitR * 4;
    b.draw(F.hitbox, x, y, s, s, this.t * 0.05, 1, 1, 1, 1, 0);
  }
}
