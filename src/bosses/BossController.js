import { WORLD_W } from '../core/constants.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL, DMG_INSTANT_PHASE_CLEAR } from '../core/damage.js';

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
    const hpScale = (diff.bossHp || 1) * (1 + 0.35 * (this.mk - 1));
    for (const p of this.phases) p.hp = Math.max(1, Math.round(p.hp * hpScale));
    const total = this.phases.reduce((a, p) => a + p.hp, 0);
    // floors[i]: HP left when phase i is cleared.
    let rest = total;
    this.floors = this.phases.map((p) => (rest -= p.hp));
    this.name = `${def.name}${mkSuffix(this.mk)}`;

    const r = w.r;
    const medals = Array(6 + 2 * this.mk).fill('M');
    this.e = w.spawnEnemy({
      kind: `boss:${def.id}`, name: this.name, x: WORLD_W / 2, y: -110, r: def.r || 40, hp: total,
      f: r.frame(def.sprite), f2: def.sprite2 ? r.frame(def.sprite2) : null, scale: def.scale || 1,
      glow: def.glow || null, boss: true, blast: 0, armor: 1,
      score: (def.score || 100000) * this.mk, ult: 40,
      drops: ['P', 'P', 'P', 'B', ...medals, ...(this.mk > 1 ? ['L'] : [])],
      // Hud boss bar: phase floors as HP fractions = one segment per phase.
      def: { boss: true, phases: this.floors.slice(0, -1).map((f) => f / total) },
      ai: () => this.update(),
      onDamage: (e, dmg, flags) => this.onDamage(dmg, flags),
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
    if (this.def.update) this.def.update(this, w);
    // Ease toward the movement target.
    e.x += (this.mx - e.x) * 0.08;
    e.y += (this.my - e.y) * 0.08;
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
    this._setState('fight');
  }

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
    e.rot += 0.02 + 0.15 * Math.sin((st / TR.end) * Math.PI);
    if (st % 9 === 0) w.explosions.sparks(e.x, e.y, 6, this.def.glow || [1, 0.5, 0.8], 5, 22, 4);
    if (st === TR.arena) this._emit('bossArena', { arena: next.arena, fx: next.transitionFx, dur: TR.arenaDur });
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
    const st = this.st, e = this.e, w = this.w, R = w.fxRng;
    if (w.bullets.count) this._clearBullets();
    const style = this.def.deathSequence || 'chain_explode';
    this.mx = this.dieX + Math.sin(st * 1.3) * 3;
    // Defeated during the fly-in: drift on-screen so the death stays visible.
    this.my = style === 'sink_and_explode' ? Math.max(90, this.dieY) + st * 0.45 : Math.max(90, this.dieY);
    e.rot += style === 'spin_out' ? 0.05 + st * 0.002 : 0;
    if (st < DEATH.chain) {
      // Stage 1: rolling chain of hull blasts, accelerating.
      const every = Math.max(3, 10 - Math.floor(st / 16));
      if (st % every === 0) {
        w.explosions.blast(e.x + R.range(-e.r, e.r) * 1.1, e.y + R.range(-e.r, e.r) * 0.8, R.range(0.6, 1.2), this.def.glow);
        w.g.camera.addTrauma(0.08);
      }
      e.flash = st % 4 < 2 ? 2 : 0;
    } else if (st === DEATH.final) {
      // Stage 2: core breach.
      w.explosions.breakApart(e.x, e.y, e.r, 8);
      w.g.renderer.post.flash(1, 0.95, 0.85, 0.8, 0.025);
      w.g.renderer.post.shockwave(e.x, e.y, 0.06, 0.02, 0.9);
    } else if (st >= DEATH.kill) {
      // Stage 3: hand over to the normal enemy death (score, medals, director).
      e.hp = 0;
      w.killEnemy(e);
      if (w.boss === e) w.boss = null;
    }
  }
}

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
