import { WORLD_W } from '../core/constants.js';
import { spawnEnemy, ENEMIES } from '../entities/enemies/index.js';
import { spawnArenaBoss } from '../bosses/index.js';
import { NO_BOMB_BOSS } from '../core/scoring.js';
import { TEMPLATES } from './waves.js';
import { RNG } from '../core/RNG.js';

// Runs a generated stage plan on a World, step by step:
//   intro (banner) → wave sets (timed spawns; a set ends when it is
//   cleared or times out) → mid-boss → waves → boss → tally.
// Communicates with the scene purely through world events:
//   stageIntro, warning, bossIntro, bossDown, bossEscape, tally
// Boss arena mode (M4b): a boss section with an `arena` spec spawns a
// data-driven boss (bosses/) and brackets it with arenaEnter / arenaExit.
// Level rework: mid-boss sections carry a spec too (the level's own
// mini-boss, `mini: true`), and a main boss calls in reinforcements from the
// level's wave pool while it fights (bossSummon).

const INTRO_STEPS = 160;
const SET_GAP = 70;
const SET_TIMEOUT = 600;        // steps after a set's last spawn before moving on
const MIDBOSS_TIMEOUT = 60 * 50; // mid-boss leaves if not destroyed in time

/**
 * Optional arena for a mid-boss (arena rework §22): the stage section's
 * `arenaId` or the enemy definition's `arena`. None configured → null and the
 * mid-boss keeps the stage background (no transition, no phases, no rewards).
 */
function midbossArena(s) {
  if (s.arenaId) return s.arenaId;
  const def = ENEMIES[s.id];
  return (def && def.arena) || null;
}
const WARNING_STEPS = { midboss: 110, boss: 200 };
const SUMMON_ALIVE_CAP = 5;     // no reinforcements while this many escorts are still up

/** Steps until the next boss reinforcement: 14 s early on → 7 s for a late main boss's last phase. */
function summonDelay(plan, ctrl) {
  const lv = plan.level || { rank: 0.5, main: false };
  const ph = ctrl ? ctrl.number : 1;
  return Math.round(60 * Math.max(6.5, 14 - 4 * lv.rank - 0.9 * ph - (lv.main ? 1 : 0)));
}

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
    this.bossBonus = 0;      // M7a: NO-BOMB boss bonuses earned this stage (raw, before loop)
    this.bossClears = [];
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
        this.midArena = s.type === 'midboss' ? midbossArena(s) : null;
        this.w.event('warning', { boss: s.type === 'boss', midArena: this.midArena });
        break;
      case 'tally': {
        // Optional pilot hook: the stage is cleared (e.g. Miguerre's Chaos Clones dissolve).
        const pl = this.w.player;
        if (pl && pl.def.stageClear) pl.def.stageClear(pl, this.w);
        this.w.event('tally', this.tally());
        break;
      }
    }
  }

  _startSet() {
    this.set = this.section.sets[this.setIdx];
    this.setT = 0;
    this.evIdx = 0;
    this.gap = -1;
    // Timed waves announce themselves ("WAVE 3").
    if (this.set.duration) this.w.event('waveStart', { number: this.set.number, total: this.section.totalWaves || this.set.number, duration: this.set.duration });
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

  /** Steps left in the current timed wave (HUD), or -1. */
  get waveLeft() {
    const s = this.section;
    return s && s.type === 'waves' && this.set && this.set.duration ? Math.max(0, this.set.duration - this.setT) : -1;
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
    // Timed wave (level rework): exactly `duration` steps, then the next one.
    if (set.duration) {
      if (this.setT >= set.duration) {
        this.setIdx++;
        if (this.setIdx >= this.section.sets.length) this._next();
        else this._startSet();
      }
      return;
    }
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
        this.bossBombs = w.player.bombsUsed; // M7a: NO-BOMB boss bonus window opens
        this.bossCtrl = s.arena ? this.bossE.ctrl : null;
        this.summon = { n: 0, t: 0, q: [], next: summonDelay(this.plan, null) };
        if (s.arena) w.event('arenaEnter', this.bossCtrl);
        else if (this.midArena) w.event('midbossArena', { arena: this.midArena });
        w.event('bossIntro', this.bossE);
      }
      return;
    }
    const e = this.bossE;
    this.bossT++;
    if (s.type === 'boss' && e.alive) this._updateSummon();
    if (this.bossDownT < 0) {
      if (!e.alive) {
        const killed = e.hp <= 0;
        this.bossDownT = killed ? 150 : 40;
        if (w.boss === e) w.boss = null;
        if (killed && w.player.bombsUsed === this.bossBombs) {
          const bonus = NO_BOMB_BOSS[s.type] || 0;
          this.bossBonus += bonus;
          this.bossClears.push(s.type);
          w.event('bossNoBomb', { type: s.type, bonus: bonus * this.plan.loop });
        }
        w.event(killed ? 'bossDown' : 'bossEscape', { e, type: s.type });
        if (s.arena) w.event('arenaExit', this.bossCtrl);
        else if (this.midArena) { w.event('midbossArenaExit', { arena: this.midArena }); this.midArena = null; }
      } else if (s.type === 'midboss' && !this.bossCtrl && this.bossT > MIDBOSS_TIMEOUT && e.data.ph === 1) {
        e.data.ph = 2; // retreat (hover mover exit phase)
        e.untargetable = true;
      }
    } else if (--this.bossDownT <= 0) this._next();
  }

  /**
   * Boss reinforcements: while the main boss fights, every few seconds (sooner
   * in later phases and later levels) it calls in one small formation from
   * the level's own wave pool — boats on the sea, armour on land, drones in
   * orbit. Never during a phase transition; held back while escorts are up.
   */
  _updateSummon() {
    const w = this.w, c = this.bossCtrl, sm = this.summon, pool = this.plan.reinforce || [];
    if (!c || !pool.length) return;
    for (let i = sm.q.length - 1; i >= 0; i--) {
      const ev = sm.q[i];
      if (--ev.t > 0) continue;
      spawnEnemy(w, ev.id, ev.x, ev.y, ev.p, ev.elite);
      sm.q.splice(i, 1);
    }
    if (c.state !== 'fight') return;
    if (++sm.t < sm.next) return;
    // A boss may hold its reinforcements (e.g. while a lethal telegraph is up).
    if (c.def.summonHold && c.def.summonHold(c)) { sm.t = sm.next - 30; return; }
    let alive = 0;
    for (const en of w.enemies.active) if (en.alive && !en.boss && !en.ctrl && en.kind !== 'bosspart' && en.kind !== 'bossminion') alive++;
    if (alive >= SUMMON_ALIVE_CAP) { sm.t = sm.next - 60; return; }
    const R = new RNG(`${this.plan.seed}:summon:${this.plan.index}:${sm.n}`);
    // ...and restrict which formations it calls in (a fortress covering the screen takes no boats).
    const fits = (id) => !c.def.summonFilter || c.def.summonFilter(TEMPLATES.find((t) => t.id === id), c);
    const allowed = pool.filter(fits);
    if (!allowed.length) return;
    const ids = allowed.filter((id) => TEMPLATES.find((t) => t.id === id).minStage <= this.plan.index % 30);
    const pick = R.pick(ids.length ? ids : allowed);
    const tpl = TEMPLATES.find((t) => t.id === pick);
    const elite = this.plan.diff.eliteChance + 0.05 * c.number;
    const ctx = { ev: (t, id, x, y, p = null) => ({ t, id, x, y, p, elite: R.next() < elite }) };
    for (const ev of tpl.build(R, ctx)) { ev.t = Math.max(1, ev.t); sm.q.push(ev); }
    sm.n++;
    sm.t = 0;
    sm.next = summonDelay(this.plan, c);
    w.event('bossSummon', { e: this.bossE, name: tpl.id });
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
      ['NO-BOMB BOSS', this.bossClears.length ? this.bossClears.map((t) => (t === 'boss' ? 'BOSS' : 'MID')).join(' + ') : '—', this.bossBonus * loop],
    ];
    return { plan: this.plan, rows, total: rows.reduce((a, r) => a + r[2], 0) };
  }
}
