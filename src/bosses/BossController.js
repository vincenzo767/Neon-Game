import { WORLD_W } from '../core/constants.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL, DMG_INSTANT_PHASE_CLEAR } from '../core/damage.js';
import { FADE_OUT } from '../fx/Particles.js';
import { BossKit } from './kit.js';
import { BossLook } from './look.js';
import { LOOKS } from './looks.js';

// Runtime for a data-driven main boss (UPDATE_01 §1.3–1.5, §2.6).
//
// The boss is one World enemy whose HP is the sum of its phases' HP; phase
// boundaries are HP floors (the boss bar shows one segment per phase).
// Damage never crosses a floor: the overflow is dropped and the phase ends.
//
// States
//   enter       fly in, invulnerable; arena takes over with phase 1's theme
//   fight       phase patterns + movement run; damage applies
//   transition  ~2.4 s: bullets → score stars, invulnerable transform,
//               arena crossfade, "PHASE N — NAME" card, music layer switch
//   dying       multi-stage death sequence; ends in World.killEnemy, which
//               awards score + medals and lets the StageDirector advance
//
// Every defeat (HP, timeout of the final phase, INSTANT_KILL) goes through
// _defeat() → dying → killEnemy. A defeat requested during `enter` or
// `transition` first cancels that sequence (bossTransitionCancel lets the
// scene snap the arena), so nothing is left half-way.
//
// World events emitted (handled by StageScene):
//   bossArena {arena, fx, dur}       start an arena crossfade
//   bossPhaseCard {number, total, name, desperation}
//   bossMusic {layer}                music layer switch (audio engine: M6)
//   bossPhaseClear {index, bonus, timeout}
//   bossTransitionCancel             a defeat interrupted a transition
//   bossDefeated {ctrl}              death sequence started

const ENTER_STEPS = 160;
const TR = { arena: 18, arenaDur: 96, card: 88, music: 104, end: 144 };
const DEATH = { chain: 110, final: 112, kill: 150 };
const PHASE_TIME = 60 * 75;   // a phase that outlasts this ends without its bonus
const HOME_Y = 150;
const EPS = 0.001;
const EASE = 0.08;

/** Which authored phases (0-4) are kept for a given phase count. */
const DEFAULT_PHASE_SETS = { 1: [4], 2: [0, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

const MK_NAMES = ['', '', ' MK. II', ' MK. III'];
export const mkSuffix = (mk) => MK_NAMES[Math.min(3, mk)] || '';

// ------------------------------------------------------------- movement

/** Built-in movement styles; a phase picks one with move: { type, ...params }. */
export const BOSS_MOVES = {
  hover(c, m) {
    const t = c.pt;
    return [WORLD_W / 2 + Math.sin(t * (m.freq ?? 0.01)) * (m.amp ?? 110), (m.y ?? HOME_Y) + Math.sin(t * 0.023) * 10];
  },
  sweep(c, m) {
    const t = c.pt;
    return [WORLD_W / 2 + Math.sin(t * (m.freq ?? 0.016)) * (m.amp ?? 170), (m.y ?? HOME_Y - 20)];
  },
  figure8(c, m) {
    const t = c.pt * (m.freq ?? 0.012);
    return [WORLD_W / 2 + Math.sin(t) * (m.amp ?? 130), (m.y ?? HOME_Y) + Math.sin(t * 2) * (m.ampY ?? 40)];
  },
  center(c, m) { return [WORLD_W / 2, m.y ?? HOME_Y]; },
};

// ----------------------------------------------------------- controller

export class BossController {
  /**
   * @param def  boss data (bosses/<archetype>/<id>.js)
   * @param spec { id, archetype, mk } from the rotation (bosses/index.js)
   */
  constructor(w, def, spec = {}) {
    this.w = w;
    this.def = def;
    this.mk = Math.max(1, spec.mk || 1);
    this.archetype = spec.archetype || def.archetype;
    this.stars = null;        // ScoreStars, attached by the scene's arena (else plain cancel)
    const diff = w.diff;
    this.phases = selectPhases(def, diff.bossPhases ?? 5, !!diff.desperation);
    const hpScale = (this.hpScale = (diff.bossHp || 1) * (1 + 0.35 * (this.mk - 1)));
    for (const p of this.phases) p.hp = Math.max(1, Math.round(p.hp * hpScale));
    const total = this.phases.reduce((a, p) => a + p.hp, 0);
    // floors[i]: HP left when phase i is cleared.
    let rest = total;
    this.floors = this.phases.map((p) => (rest -= p.hp));
    this.name = `${def.name}${mkSuffix(this.mk)}`;

    const r = w.r;
    const medals = Array(6 + 2 * this.mk).fill('M');
    // M4d: retrofitted bosses draw their own weak-point glow (bosses/look.js)
    // instead of the full-body halo, and use a softer hit flash.
    const retro = !!LOOKS[def.id];
    this.e = w.spawnEnemy({
      kind: `boss:${def.id}`, name: this.name, x: WORLD_W / 2, y: -110, r: def.r || 40, hp: total,
      f: r.frame(def.sprite), f2: def.sprite2 ? r.frame(def.sprite2) : null, scale: def.scale || 1,
      glow: retro ? null : def.glow || null, ...(retro ? { flashA: 0.15 } : {}), boss: true, blast: 0, armor: 1,
      score: (def.score || 100000) * this.mk, ult: 40,
      drops: ['P', 'P', 'P', 'B', ...medals, ...(this.mk > 1 ? ['L'] : [])],
      // Hud boss bar: phase floors as HP fractions = one segment per phase.
      def: { boss: true, phases: this.floors.slice(0, -1).map((f) => f / total) },
      ai: () => this.update(),
      onDamage: (e, dmg, flags) => {
        const d = this.onDamage(dmg, flags);
        if (d > 0) this.look.hit(); // faction hit effect (cosmetic)
        return d;
      },
      ctrl: this,
    });
    w.boss = this.e;

    this.state = 'enter';
    this.st = 0;            // steps in state
    this.pt = 0;            // steps in current phase (patterns / movement clock)
    this.index = -1;
    this.phase = null;
    this.shield = 0;        // > 0: only IGNORES_SHIELDS damage lands (dives, barriers)
    this.intensity = 1;
    this.data = this.e.data; // pattern state (spiral angles etc.)
    this.pendingDefeat = false;
    this.pendingPhaseClear = false;
    this.pendingPhaseEnd = false;
    this.defeatCause = null;
    this.pingT = 0;
    this.log = [];          // state history (tests / debug)
    this.mx = WORLD_W / 2;
    this.my = HOME_Y;
    this.ease = EASE;       // movement easing; attacks may raise it for one step (charges)
    this.kit = new BossKit(this);
    this.look = new BossLook(this);  // M4d visual layer (no gameplay effect)
    this.visR = this.look.visR;      // visual hull radius for death blasts
  }

  get number() { return this.index + 1; }
  get total() { return this.phases.length; }
  get floor() { return this.floors[this.index] ?? 0; }
  get vulnerable() { return this.state === 'fight'; }

  _emit(type, data) { this.w.event(type, data); }

  _setState(s) {
    this.state = s;
    this.st = 0;
    this.log.push(`${s}${s === 'fight' ? this.number : ''}`);
  }

  // ------------------------------------------------------------- damage

  /** World.damage hook: returns the HP to subtract (never crosses a floor). */
  onDamage(dmg, flags) {
    const e = this.e;
    if (flags & DMG_INSTANT_KILL) {
      if (this.state !== 'dying') { this.pendingDefeat = true; this.defeatCause = 'instantKill'; }
      return 0;
    }
    if (this.state !== 'fight') { this._ping(); return 0; }
    if (this.shield > 0 && !(flags & DMG_IGNORES_SHIELDS)) { this._ping(); return 0; }
    if (flags & DMG_INSTANT_PHASE_CLEAR) { this.pendingPhaseClear = true; return 0; }
    if (this.pendingPhaseEnd) return 0;
    const room = e.hp - this.floor;
    if (dmg >= room - EPS) {
      this.pendingPhaseEnd = true;
      return Math.max(0, room - EPS);
    }
    return dmg;
  }

  /** "No effect" spark when hitting an invulnerable / shielded boss. */
  _ping() {
    if (this.w.t - this.pingT < 5) return;
    this.pingT = this.w.t;
    const e = this.e, R = this.w.fxRng;
    this.w.explosions.hitSpark(e.x + R.range(-e.r, e.r) * 0.6, e.y + e.r * 0.5, Math.PI / 2, [0.7, 0.8, 1]);
  }

  /** Clear enemy bullets (→ score stars when an arena hosts them) and lasers. */
  _clearBullets() {
    const w = this.w;
    if (this.stars) this.stars.absorb();
    else w.cancelAll();
    w.clearLasers();
  }

  // ------------------------------------------------------------- update

  update() {
    const w = this.w, e = this.e;
    this.st++;
    if (this.pendingDefeat && this.state !== 'dying') this._defeat(this.defeatCause || 'hp');
    else if (this.state === 'fight') {
      if (this.pendingPhaseClear) this._endPhase('instant');
      else if (this.pendingPhaseEnd || e.hp - this.floor <= EPS * 2) this._endPhase('hp');
      else if (this.pt > (this.phase.time || PHASE_TIME)) this._endPhase('timeout');
    }
    this.pendingPhaseClear = false;

    switch (this.state) {
      case 'enter': this._updateEnter(); break;
      case 'fight': this._updateFight(); break;
      case 'transition': this._updateTransition(); break;
      case 'dying': this._updateDeath(); break;
    }
    if (this.shield > 0) this.shield--;
    this.kit.update();
    this.look.update();
    if (this.def.update) this.def.update(this, w);
    // Ease toward the movement target.
    e.x += (this.mx - e.x) * this.ease;
    e.y += (this.my - e.y) * this.ease;
    this.ease = EASE;
  }

  _updateEnter() {
    const st = this.st;
    if (st === 1) {
      const p0 = this.phases[0];
      this._emit('bossArena', { arena: p0.arena, fx: p0.transitionFx, dur: TR.arenaDur + 20 });
      this._emit('bossMusic', { layer: p0.musicLayer });
    }
    this.mx = WORLD_W / 2;
    this.my = Math.min(HOME_Y, -110 + st * 2.2);
    if (st === ENTER_STEPS - 30) this._card(0);
    if (st >= ENTER_STEPS) this._startPhase(0);
  }

  _card(i) {
    const p = this.phases[i];
    this._emit('bossPhaseCard', { number: i + 1, total: this.total, name: p.name, desperation: !!p.desperation, boss: this.name });
  }

  _startPhase(i) {
    this.index = i;
    this.phase = this.phases[i];
    this.pt = 0;
    this.shield = 0;
    this.intensity = this.phase.intensity || 1;
    this.pendingPhaseEnd = false;
    this.e.hp = this.floor + this.phase.hp; // exact, whatever happened before
    this._setForm(this.phase.sprite);
    if (!this.def.transitionSpin) this.e.rot = 0;
    this._setState('fight');
    this.kit.spawnParts(this.phase.parts);
    if (this.phase.onStart) this.phase.onStart(this, this.w);
  }

  /** Swap the boss sprite (transforming phases); null = the default sprite. */
  _setForm(sprite) {
    const f = this.w.r.frame(sprite || this.def.sprite);
    if (this.e.f === f) return false;
    this.e.f = f;
    return true;
  }

  /** Teleport: move instantly (no interpolation smear). */
  snap(x, y) {
    const e = this.e;
    e.x = e.px = this.mx = x;
    e.y = e.py = this.my = y;
  }

  renderUnder(b, alpha) { this.look.renderUnder(b, alpha); this.kit.renderUnder(b, alpha); }
  /** Hull overlays (animation, damage decals): before the arena's vision veil. */
  renderSurface(b, alpha) { this.look.renderSurface(b, alpha); }
  renderOver(b, alpha) { this.look.renderOver(b, alpha); this.kit.renderOver(b, alpha); }

  _updateFight() {
    const c = this, w = this.w, ph = this.phase;
    this.pt++;
    const m = ph.move || { type: 'hover' };
    [this.mx, this.my] = (BOSS_MOVES[m.type] || BOSS_MOVES.hover)(c, m);
    // Attacks wait for the boss to settle after a transition.
    if (this.pt < 30) return;
    const atk = this.def.attacks || {};
    for (const name of ph.patterns || []) {
      const fn = atk[name];
      if (fn) fn(c, w, this.pt - 30);
    }
  }

  _endPhase(reason) {
    const w = this.w;
    const i = this.index, last = i >= this.total - 1;
    const bonus = reason === 'timeout' ? 0 : 5000 * (i + 1) * this.mk;
    if (bonus) w.score += bonus;
    this._emit('bossPhaseClear', { index: i, bonus, reason });
    if (last) { this._defeat(reason === 'instant' ? 'instantPhaseClear' : reason); return; }
    this.e.hp = this.floor;
    this.kit.clearPhase();
    this._clearBullets();
    this._setState('transition');
    // Phase-break hit: flash, shockwave, a couple of armour bursts.
    const e = this.e, post = w.g.renderer.post;
    post.flash(1, 1, 1, 0.45, 0.05);
    post.shockwave(e.x, e.y, 0.04, 0.02, 0.7);
    w.g.camera.addTrauma(0.4);
    for (let k = 0; k < 3; k++) {
      w.explosions.schedule(k * 6, () => {
        const R = w.fxRng;
        w.explosions.blast(e.x + R.range(-e.r, e.r), e.y + R.range(-e.r, e.r) * 0.6, R.range(0.8, 1.2), this.def.glow);
      });
    }
  }

  _updateTransition() {
    const st = this.st, e = this.e, w = this.w, next = this.phases[this.index + 1];
    // Anything spawned late (split bullets, stray patterns) converts too.
    if (w.bullets.count) this._clearBullets();
    // Transform: drift to centre, shudder, spin up.
    this.mx = WORLD_W / 2;
    this.my = HOME_Y - 20 + Math.sin(st * 0.08) * 8;
    e.x += Math.sin(st * 1.7) * 1.2 * (1 - st / TR.end);
    // Spinning cores spin up; hulls shudder.
    if (this.def.transitionSpin) e.rot += 0.02 + 0.15 * Math.sin((st / TR.end) * Math.PI);
    else e.rot = Math.sin(st * 0.7) * 0.06 * (1 - st / TR.end);
    if (st % 9 === 0) w.explosions.sparks(e.x, e.y, 6, this.def.glow || [1, 0.5, 0.8], 5, 22, 4);
    if (st === TR.arena) this._emit('bossArena', { arena: next.arena, fx: next.transitionFx, dur: TR.arenaDur });
    // Transformation: the new form appears at the arena swap, in a burst.
    if (st === TR.arena + TR.arenaDur / 2 && this._setForm(next.sprite)) {
      w.explosions.sparks(e.x, e.y, 30, this.def.glow || [1, 1, 1], 8, 30, 5);
      w.g.renderer.post.flash(1, 1, 1, 0.35, 0.05);
      w.g.renderer.post.shockwave(e.x, e.y, 0.03, 0.02, 0.6);
    }
    if (st === TR.card) this._card(this.index + 1);
    if (st === TR.music) this._emit('bossMusic', { layer: next.musicLayer });
    if (st >= TR.end) this._startPhase(this.index + 1);
  }

  // ------------------------------------------------------------ defeat

  /** The one defeat path (HP, final-phase timeout, instant flags). */
  _defeat(cause) {
    if (this.state === 'dying') return;
    if (this.state === 'enter' || this.state === 'transition') this._emit('bossTransitionCancel', { ctrl: this, from: this.state });
    this.defeatCause = cause;
    this.pendingDefeat = false;
    this.pendingPhaseEnd = false;
    this.shield = 0;
    this.e.hp = Math.max(EPS, Math.min(this.e.hp, EPS * 2));
    this.kit.clearPhase();
    this._clearBullets();
    this._setState('dying');
    this.dieX = this.e.x;
    this.dieY = this.e.y;
    this._emit('bossDefeated', { ctrl: this, cause });
    const post = this.w.g.renderer.post;
    post.flash(1, 1, 1, 0.6, 0.03);
    post.aberrate(0.02);
    this.w.g.hitStop(10);
  }

  _updateDeath() {
    const st = this.st, e = this.e, w = this.w;
    if (w.bullets.count) this._clearBullets();
    // Defeated during the fly-in: drift on-screen so the death stays visible.
    this.mx = this.dieX + Math.sin(st * 1.3) * 3;
    this.my = Math.max(90, this.dieY);
    const style = DEATH_STYLES[this.def.deathSequence] || DEATH_STYLES.chain_explode;
    if (st < DEATH.chain) {
      // Stage 1: archetype-specific breakdown (motion + effects).
      style.step(this, st, e, w, w.fxRng);
      if (style.flash !== false) e.flash = st % 4 < 2 ? 2 : 0;
    } else if (st === DEATH.final) {
      // Stage 2: core breach.
      if (style.final) style.final(this, e, w);
      else w.explosions.breakApart(e.x, e.y, e.r, 8);
      w.g.renderer.post.flash(1, 0.95, 0.85, 0.8, 0.025);
      w.g.renderer.post.shockwave(e.x, e.y, 0.06, 0.02, 0.9);
    } else if (st > DEATH.final && style.after) {
      style.after(this, st, e, w);
    }
    if (st >= DEATH.kill) {
      // Stage 3: hand over to the normal enemy death (score, medals, director).
      e.hp = 0;
      w.killEnemy(e);
      if (w.boss === e) w.boss = null;
    }
  }
}

// ------------------------------------------------------- death styles

/** Rolling hull blasts that speed up. */
function chainBlasts(c, st, e, w, R, tint = c.def.glow, spread = 1.1) {
  const every = Math.max(3, 10 - Math.floor(st / 16));
  if (st % every === 0) {
    const r = c.visR || e.r; // across the whole (visual) hull
    w.explosions.blast(e.x + R.range(-r, r) * spread, e.y + R.range(-r, r) * 0.8, R.range(0.6, 1.2), tint);
    w.g.camera.addTrauma(0.08);
  }
}

function particle(w, frame, x, y, vx, vy, life, size, rgb, rgb1, drag = 0.95, grav = 0, add = 1) {
  const H = w.fxHigh;
  const i = H.spawn(frame, x, y, vx, vy, life);
  if (i < 0) return;
  H.size(i, size[0], size[1]);
  H.color(i, rgb[0], rgb[1], rgb[2], rgb1[0], rgb1[1], rgb1[2]);
  H.phys(i, drag, grav);
  H.look(i, 1, add, FADE_OUT, 0.3);
}

/**
 * deathSequence → per-step stage-1 behaviour (+ optional final / after).
 * Every style runs inside the same timeline and ends in killEnemy, so all
 * of them pay out score + medals and hand control back identically.
 */
export const DEATH_STYLES = {
  chain_explode: { step: (c, st, e, w, R) => chainBlasts(c, st, e, w, R) },

  // Ground: ammunition cooks off; fire columns and flying track links.
  tank_cookoff: {
    step(c, st, e, w, R) {
      chainBlasts(c, st, e, w, R, [1, 0.45, 0.1]);
      if (st % 6 === 0) {
        const x = e.x + R.range(-e.r, e.r) * 0.6;
        for (let k = 0; k < 4; k++) particle(w, w.F.glow, x, e.y, R.range(-0.6, 0.6), R.range(-5, -2.5), R.range(20, 34), [26, 8], [2, 1.2, 0.4], [1, 0.2, 0]);
      }
      if (st % 14 === 0) for (let k = 0; k < 6; k++) particle(w, w.F.spark, e.x + R.sign() * e.r * 0.7, e.y + R.range(-e.r, e.r) * 0.6, R.sign() * R.range(2, 6), R.range(-5, -1), 50, [6, 3], [1.4, 1.2, 1], [0.4, 0.4, 0.4], 0.97, 0.15, 0);
      c.my = Math.max(90, c.dieY) + st * 0.1;
    },
  },

  // Aerial: loses lift, spins and drifts down trailing smoke.
  spin_out: {
    step(c, st, e, w, R) {
      chainBlasts(c, st, e, w, R, [0.5, 0.8, 1]);
      e.rot += 0.01 + st * 0.0006;
      c.mx = c.dieX + Math.sin(st * 0.03) * 60;
      c.my = Math.max(90, c.dieY) + st * 1.1;
      if (st % 2 === 0) {
        const L = w.fxLow, i = L.spawn(w.r.frame('smoke'), e.x + R.range(-20, 20), e.y, R.range(-0.3, 0.3), -1, 70);
        if (i >= 0) { L.size(i, 20, 60); L.color(i, 0.15, 0.15, 0.18, 0.05, 0.05, 0.06); L.phys(i, 0.97, -0.01); L.look(i, 0.7, 0); }
      }
    },
  },

  // Sea: lists, sinks, splash rings and a final underwater burst.
  sink_and_explode: {
    step(c, st, e, w, R) {
      chainBlasts(c, st, e, w, R, [1, 0.7, 0.3], 0.6);
      c.my = Math.max(90, c.dieY) + st * 0.5;
      e.rot += (0.0015 - e.rot * 0.01);
      e.scale += (c.def.scale * 0.75 - e.scale) * 0.01;
      if (st % 10 === 0) particle(w, w.F.ring, e.x + R.range(-40, 40), e.y + R.range(-80, 80), 0, 0, 40, [10, 90], [0.8, 1.2, 1.5], [0.2, 0.4, 0.8]);
    },
    final(c, e, w) {
      w.explosions.breakApart(e.x, e.y, e.r, 6);
      for (let k = 0; k < 40; k++) { const a = w.fxRng.angle(), s = w.fxRng.range(2, 7); particle(w, w.F.glow, e.x, e.y, Math.cos(a) * s, Math.sin(a) * s, 40, [14, 4], [0.8, 1.6, 2], [0.1, 0.4, 0.8]); }
    },
  },

  // Mecha: locks up, light bursts from armour cracks, reactor white-out.
  meltdown: {
    flash: false,
    step(c, st, e, w, R) {
      c.mx = c.dieX + R.range(-1, 1) * (st / 40);
      if (st % 12 === 0) {
        const ang = R.angle(), len = R.range(300, 700);
        c.kit.fx.push({ t: 0, life: 200, ang, len, draw: (b, F, f) => {
          const k = Math.min(1, f.t / 20), x = e.x, y = e.y;
          b.draw(F.laser, x + Math.cos(f.ang) * f.len * k / 2, y + Math.sin(f.ang) * f.len * k / 2, f.len * k, 10 + f.t * 0.15, f.ang, 2.2, 2.1, 1.8, 0.8, 1);
        } });
        w.g.renderer.post.aberrate(0.004);
      }
      if (st % 20 === 0) w.explosions.blast(e.x + R.range(-e.r, e.r) * 0.5, e.y + R.range(-e.r, e.r) * 0.5, 0.7, [1, 0.3, 0.2]);
      e.flash = st > 70 ? 2 : (st % 6 < 3 ? 2 : 0);
      w.g.camera.addTrauma(0.03);
    },
  },

  // Alien: collapses inward to a point, then a glyph shockwave.
  implode: {
    flash: false,
    step(c, st, e, w, R) {
      e.scale += (0.15 - e.scale) * 0.02;
      e.rot += 0.02 + st * 0.001;
      for (let k = 0; k < 2; k++) {
        const a = R.angle(), d = R.range(120, 220);
        particle(w, w.F.spark, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, -Math.cos(a) * d / 24, -Math.sin(a) * d / 24, 24, [6, 2], [0.6, 2, 0.6], [1, 0.3, 1.6], 1);
      }
      if (st % 30 === 0) w.g.renderer.post.shockwave(e.x, e.y, -0.02, 0.02, 0.4);
    },
    final(c, e, w) {
      w.explosions.blast(e.x, e.y, 2.8, [0.5, 1, 0.4]);
      for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; particle(w, w.F.spark, e.x, e.y, Math.cos(a) * 9, Math.sin(a) * 9, 50, [10, 2], [0.8, 2, 0.8], [0.6, 0.2, 1.4], 0.97); }
    },
  },

  // Abyssal: eyes close, the body flickers out of existence into black ash.
  dissolve: {
    flash: false,
    step(c, st, e, w, R) {
      if (!c.baseF) c.baseF = e.f;
      e.f = R.chance(st / 140) ? null : c.baseF;
      for (let k = 0; k < 3; k++) {
        const L = w.fxLow, i = L.spawn(w.r.frame('smoke'), e.x + R.range(-e.r, e.r), e.y + R.range(-e.r, e.r) * 0.8, R.range(-0.5, 0.5), R.range(-1.2, -0.2), 60);
        if (i >= 0) { L.size(i, 14, 50); L.color(i, 0.05, 0.0, 0.06, 0, 0, 0); L.phys(i, 0.97, -0.01); L.look(i, 0.9, 0); }
      }
      if (st % 25 === 0) { w.g.renderer.post.aberrate(0.01); w.g.renderer.post.heat(0.4); }
    },
    final(c, e, w) {
      e.f = null;
      w.explosions.blast(e.x, e.y, 2.4, [0.6, 0.1, 0.8]);
    },
  },
};

// ------------------------------------------------------------ helpers

/**
 * Filter the 5 authored phases down to `count` (difficulty), optionally
 * appending a desperation phase (Hell). Returns fresh copies.
 */
export function selectPhases(def, count, desperation) {
  const authored = def.phases;
  const n = Math.max(1, Math.min(authored.length, count));
  const set = (def.phaseSets && def.phaseSets[n]) || (authored.length === 5 ? DEFAULT_PHASE_SETS[n] : null)
    || authored.map((_, i) => i).slice(authored.length - n);
  const out = set.map((i) => ({ ...authored[i] }));
  if (desperation) {
    const last = authored[authored.length - 1];
    const d = def.desperation || {};
    out.push({
      ...last,
      name: 'DESPERATION',
      hp: Math.round(last.hp * 0.5),
      intensity: (last.intensity || 1) * 1.4,
      arena: { ...last.arena, tint: [0.45, 0, 0.04, 0.22] },
      transitionFx: 'screen_tear',
      musicLayer: `${last.musicLayer || def.id}_desperation`,
      ...d,
      desperation: true,
    });
  }
  return out;
}
