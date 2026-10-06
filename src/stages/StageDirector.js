import { WORLD_W } from '../core/constants.js';
import { spawnEnemy } from '../entities/enemies/index.js';
import { spawnArenaBoss } from '../bosses/index.js';

// Runs a generated stage plan on a World, step by step:
//   intro (banner) → wave sets (timed spawns; a set ends when it is
//   cleared or times out) → mid-boss → waves → boss → tally.
// Communicates with the scene purely through world events:
//   stageIntro, warning, bossIntro, bossDown, bossEscape, tally
// Boss arena mode (M4b): a boss section with an `arena` spec spawns a
// data-driven boss (bosses/) and brackets it with arenaEnter / arenaExit,
// so the scene hands the background layers to the boss arena and back.

const INTRO_STEPS = 160;
const SET_GAP = 70;
const SET_TIMEOUT = 600;        // steps after a set's last spawn before moving on
const MIDBOSS_TIMEOUT = 60 * 50; // mid-boss leaves if not destroyed in time
const WARNING_STEPS = { midboss: 110, boss: 200 };

export class StageDirector {
  constructor(world) {
    this.w = world;
    this.plan = null;
  }

  start(plan) {
    const w = this.w, p = w.player;
    this.plan = plan;
    this.si = -1;
    this.done = false;
    w.diff = plan.diff;
    w.maxChain = 0;
    this.stats = {
      kills: w.kills, spawned: w.spawned, graze: w.graze,
      deaths: p.deaths, bombs: p.bombsUsed, score: w.score,
    };
    this._next();
  }

  get section() { return this.plan.sections[this.si]; }

  _next() {
    this.si++;
    const s = this.section;
    this.t = 0;
    if (!s) { this.done = true; return; }
    switch (s.type) {
      case 'intro': this.w.event('stageIntro', this.plan); break;
      case 'waves': this.setIdx = 0; this._startSet(); break;
      case 'midboss':
      case 'boss':
        this.bossE = null;
        this.bossDownT = -1;
        this.w.event('warning', { boss: s.type === 'boss' });
        break;
      case 'tally': this.w.event('tally', this.tally()); break;
    }
  }

  _startSet() {
    this.set = this.section.sets[this.setIdx];
    this.setT = 0;
    this.evIdx = 0;
    this.gap = -1;
  }

  update() {
    if (!this.plan || this.done) return;
    const s = this.section;
    this.t++;
    switch (s.type) {
      case 'intro':
        if (this.t >= INTRO_STEPS) this._next();
        break;
      case 'waves': this._updateWaves(); break;
      case 'midboss':
      case 'boss': this._updateBoss(s); break;
      case 'tally': break; // the scene calls advance() when the tally closes
    }
  }

  _updateWaves() {
    if (this.gap >= 0) {
      if (--this.gap <= 0) {
        this.setIdx++;
        if (this.setIdx >= this.section.sets.length) this._next();
        else this._startSet();
      }
      return;
    }
    const set = this.set, ev = set.events;
    while (this.evIdx < ev.length && ev[this.evIdx].t <= this.setT) {
      const e = ev[this.evIdx++];
      spawnEnemy(this.w, e.id, e.x, e.y, e.p, e.elite);
    }
    this.setT++;
    if (this.evIdx >= ev.length) {
      const last = ev.length ? ev[ev.length - 1].t : 0;
      let airAlive = 0;
      for (const en of this.w.enemies.active) if (en.alive && !en.ground) airAlive++;
      if ((airAlive === 0 && this.setT > last + 60) || this.setT > last + SET_TIMEOUT) this.gap = SET_GAP;
    }
  }

  _updateBoss(s) {
    const w = this.w;
    if (!this.bossE) {
      if (this.t >= WARNING_STEPS[s.type]) {
        this.bossE = s.arena ? spawnArenaBoss(w, s.arena) : spawnEnemy(w, s.id, WORLD_W / 2, -90);
        this.bossT = 0;
        this.bossCtrl = s.arena ? this.bossE.ctrl : null;
        if (s.arena) w.event('arenaEnter', this.bossCtrl);
        w.event('bossIntro', this.bossE);
      }
      return;
    }
    const e = this.bossE;
    this.bossT++;
    if (this.bossDownT < 0) {
      if (!e.alive) {
        const killed = e.hp <= 0;
        this.bossDownT = killed ? 150 : 40;
        if (w.boss === e) w.boss = null;
        w.event(killed ? 'bossDown' : 'bossEscape', { e, type: s.type });
        if (s.arena) w.event('arenaExit', this.bossCtrl);
      } else if (s.type === 'midboss' && this.bossT > MIDBOSS_TIMEOUT && e.data.ph === 1) {
        e.data.ph = 2; // retreat (hover mover exit phase)
        e.untargetable = true;
      }
    } else if (--this.bossDownT <= 0) this._next();
  }

  /** Stage tally / bonus breakdown. */
  tally() {
    const w = this.w, p = w.player, st = this.stats, loop = this.plan.loop;
    const killed = w.kills - st.kills, spawned = Math.max(1, w.spawned - st.spawned);
    const rate = Math.min(1, killed / spawned);
    const graze = w.graze - st.graze;
    const noMiss = p.deaths === st.deaths;
    const noBomb = p.bombsUsed === st.bombs;
    const rows = [
      ['DESTROY RATE', `${Math.round(rate * 100)}%`, Math.round(rate * 100) * 500],
      ['GRAZE', graze, graze * 50],
      ['MAX CHAIN', w.maxChain, w.maxChain * 200],
      ['NO MISS', noMiss ? 'CLEAR' : '—', noMiss ? 100000 * loop : 0],
      ['NO BOMB', noBomb ? 'CLEAR' : '—', noBomb ? 50000 * loop : 0],
    ];
    return { plan: this.plan, rows, total: rows.reduce((a, r) => a + r[2], 0) };
  }
}
