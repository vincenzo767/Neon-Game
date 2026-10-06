import { PlayScene } from './PlayScene.js';
import { StageDirector } from '../stages/StageDirector.js';
import { generateStage } from '../stages/StageGen.js';
import { Arena } from '../bosses/Arena.js';
import { ARCHETYPE_LABEL } from '../bosses/index.js';
import { music } from '../audio/music.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL, DMG_INSTANT_PHASE_CLEAR } from '../core/damage.js';

// The main game: an endless sequence of procedurally generated stages.
// The run is fully determined by the seed (game.seed) plus player input.

const TALLY_COUNT_STEPS = 120;

export class StageScene extends PlayScene {
  constructor(def, opts = {}) {
    super(def);
    this.startStage = opts.stage || 0;
  }

  setup() {
    const g = this.g;
    g.rng.setSeed(g.seed); // replayable: the same seed + inputs = the same run
    this.director = new StageDirector(this.world);
    this.menuHint = `<div class="menu-sub">SEED <b class="seed">${g.seed}</b></div>`;
    g.renderer.background.onLightning = () => {
      g.renderer.post.flash(0.75, 0.8, 1, 0.12, 0.05);
      g.camera.addTrauma(0.05);
    };
    this.tallyState = null;
    // Boss arena mode: owns the background layers while a main boss is up.
    this.arena = new Arena(g, this.world, this.parallax);
    this.beginStage(this.startStage);
  }

  exit() {
    this.arena.reset();
    music.setLayer(null);
    super.exit();
  }

  restartScene() { this.g.setScene(new StageScene(this.def)); }

  beginStage(index) {
    const g = this.g, w = this.world;
    this.stageIndex = index;
    this.arena.reset();
    music.setLayer(null);
    this.plan = generateStage(g.seed, index, this.diffCfg.id);
    g.renderer.background.setBiome(this.plan.biome.bg);
    this.parallax.setStyle(this.plan.biome);
    w.bullets.clearAll();
    w.clearLasers();
    this.director.start(this.plan);
    const p = this.plan;
    this.hud.setStage(`LOOP ${p.loop} · STAGE ${p.loop}-${p.stageInLoop + 1} · ${p.biome.name}`);
  }

  onSceneEvent(type, data) {
    switch (type) {
      case 'stageIntro': {
        const p = data;
        if (p.stageInLoop === 0 && p.loop > 1) {
          this.banner(`LOOP ${p.loop}`, 'THE SYNDICATE ADAPTS · DENSITY UP · ELITES DEPLOYED', 150, 'loop');
          this.g.renderer.post.flash(1, 0.2, 0.4, 0.4, 0.02);
        } else {
          this.banner(`STAGE ${p.loop}-${p.stageInLoop + 1}`, p.biome.name, 150);
        }
        break;
      }
      case 'warning': this._warning(data.boss); break;
      case 'bossIntro': {
        const e = data, c = e.ctrl;
        if (c) {
          // Named intro card: archetype class (or the slot a prototype stands in for) + phase count.
          const label = ARCHETYPE_LABEL[c.archetype] || '';
          const cls = c.def.archetype === c.archetype ? `${label} CLASS` : `${c.def.title || 'PROTOTYPE'} · ${label} SLOT`;
          this.banner(e.name, `${cls} · ${c.total} PHASES`, 130, 'boss');
          break;
        }
        this.banner(e.name, data.def.boss && this.director.section.type === 'boss' ? 'SYNDICATE COMMAND UNIT' : 'MID-BOSS', 120, 'boss');
        break;
      }
      case 'bossDown':
        this.banner(data.type === 'boss' ? 'TARGET DESTROYED' : 'MID-BOSS DOWN', '', 110);
        this.world.cancelAll();
        this.world.clearLasers();
        this.world.autoCollect = 180;
        break;
      case 'bossEscape': this.banner('TARGET ESCAPED', 'NO BONUS', 90); break;
      // ---- boss arena mode (bosses/BossController + bosses/Arena)
      case 'arenaEnter':
        this.arena.enter(this.plan.biome);
        data.stars = this.arena.stars; // phase breaks convert bullets into score stars
        break;
      case 'bossArena': this.arena.transitionTo(data.arena, data.fx, data.dur); break;
      case 'bossPhaseCard': this._phaseCard(data); break;
      case 'bossMusic': music.setLayer(data.layer); break;
      case 'bossPartDown': this.hud.toast(`${data.name} DESTROYED · +${data.medals} MEDALS`, 'gold'); break;
      case 'bossPhaseClear':
        if (data.bonus) this.hud.toast(`PHASE BREAK +${Math.round(data.bonus * this.diffCfg.scoreMul).toLocaleString('en-US')}`, 'gold');
        else if (data.reason === 'timeout') this.hud.toast('PHASE TIMED OUT', 'red');
        break;
      case 'bossTransitionCancel':
        this.arena.finish();
        this._removePhaseCard();
        break;
      case 'arenaExit':
        this.arena.exit();
        music.setLayer(null);
        break;
      case 'tally': this._showTally(data); break;
    }
  }

  _warning(isBoss) {
    const el = document.createElement('div');
    el.className = 'warning';
    el.innerHTML = `<div class="stripe"></div><b>WARNING</b><small>${isBoss ? 'SYNDICATE COMMAND UNIT APPROACHING' : 'HEAVY UNIT INBOUND'}</small><div class="stripe"></div>`;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), isBoss ? 3300 : 1900);
    this.g.renderer.post.flash(1, 0, 0.1, 0.18, 0.01);
  }

  // ------------------------------------------------------------------ tally

  _showTally(data) {
    this.tallyState = { data, t: 0, closed: false };
    this.blockPause = true;
  }

  _renderTally() {
    const st = this.tallyState, d = st.data, p = d.plan;
    const k = Math.min(1, st.t / TALLY_COUNT_STEPS);
    const rows = d.rows.map(([label, val, pts], i) => {
      const rk = Math.min(1, Math.max(0, k * d.rows.length - i));
      return `<div class="tally-row" style="opacity:${rk > 0 ? 1 : 0.15}"><span>${label}</span><i>${val}</i><b>${Math.round(pts * rk).toLocaleString('en-US')}</b></div>`;
    }).join('');
    const total = Math.round(d.total * k).toLocaleString('en-US');
    this.overlayEl.innerHTML = `
      <div class="menu tally">
        <h2>STAGE CLEAR</h2>
        <div class="menu-sub">STAGE ${p.loop}-${p.stageInLoop + 1} · ${p.biome.name}</div>
        ${rows}
        <div class="tally-row total"><span>STAGE BONUS</span><i>${this.diffCfg.scoreMul > 1 ? `×${this.diffCfg.scoreMul} ${this.diffCfg.name}` : ''}</i><b>${total}</b></div>
        <div class="tally-next">${k >= 1 ? 'PRESS <b>Z</b> TO CONTINUE' : '&nbsp;'}</div>
        <div class="tally-seed">SEED ${this.g.seed} · ${this.diffCfg.name}</div>
      </div>`;
    this.overlayEl.classList.add('show');
  }

  _tickTally() {
    const st = this.tallyState;
    st.t++;
    if (st.t % 3 === 0 || st.t === 1) this._renderTally();
    const done = st.t >= TALLY_COUNT_STEPS;
    if ((done && this.g.input.pressed('confirm')) || st.t > TALLY_COUNT_STEPS + 420) {
      this.world.score += st.data.total;
      this.tallyState = null;
      this.blockPause = false;
      this._hideOverlay();
      this.g.renderer.post.flash(1, 1, 1, 0.5, 0.04);
      this.beginStage(this.stageIndex + 1);
    }
  }

  // ------------------------------------------------------------ boss arena

  _phaseCard(d) {
    this._removePhaseCard();
    const el = document.createElement('div');
    el.className = `phase-card${d.desperation ? ' desperation' : ''}`;
    const pips = Array.from({ length: d.total }, (_, i) => `<i class="${i < d.number - 1 ? 'done' : i === d.number - 1 ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `<small>${d.boss}</small><b>${d.desperation ? 'FINAL' : `PHASE ${d.number}`} — ${d.name}</b><div class="pc-pips">${pips}</div>`;
    this.fxLayer.appendChild(el);
    this.phaseCardEl = el;
    el.timer = setTimeout(() => el.remove(), 2400);
  }

  _removePhaseCard() {
    const el = this.phaseCardEl;
    if (!el) return;
    clearTimeout(el.timer);
    el.remove();
    this.phaseCardEl = null;
  }

  /** Live boss controller (for its hazard / well layers), or null. */
  get bossCtrl() {
    const c = this.director.bossCtrl;
    return c && c.e.ctrl === c && c.e.alive ? c : null;
  }

  renderUnderlay(b, alpha, t) {
    this.arena.renderUnder(b, alpha, t);
    const c = this.bossCtrl;
    if (c) c.renderUnder(b, alpha);
  }

  renderOverlay(b, alpha) {
    this.arena.renderOver(b, alpha);
    const c = this.bossCtrl;
    if (c) c.renderOver(b, alpha);
  }

  /** Dev (vite dev server only): B = skip to the boss, N = phase-clear hit, M = instant-kill hit. */
  _devBossKeys() {
    if (!import.meta.env.DEV) return;
    const inp = this.g.input, w = this.world, d = this.director;
    if (inp.keyPressed('KeyB') && !this.tallyState) {
      const idx = this.plan.sections.findIndex((s) => s.type === 'boss');
      if (d.si < idx) {
        for (const e of w.enemies.active) e.alive = false;
        w.cancelAll();
        w.clearLasers();
        d.si = idx - 1;
        d._next();
        this.banner('DEV: BOSS', 'SKIPPED TO MAIN BOSS', 60);
      }
    }
    if (w.boss && inp.keyPressed('KeyN')) w.damage(w.boss, 1, DMG_IGNORES_SHIELDS | DMG_INSTANT_PHASE_CLEAR);
    if (w.boss && inp.keyPressed('KeyM')) w.damage(w.boss, 1, DMG_IGNORES_SHIELDS | DMG_INSTANT_KILL);
  }

  tick() {
    this._devBossKeys();
    this.arena.update();
    if (this.tallyState) this._tickTally();
    else this.director.update();
    const dbg = this.g.debug, p = this.plan, d = this.director;
    const c = d.bossCtrl;
    dbg.set('boss', c && c.e.ctrl === c && (c.e.alive || this.arena.active)
      ? `${c.def.id} [${c.archetype} mk${c.mk}] ${c.state} ${c.number}/${c.total} · arena ${this.arena.cur ? this.arena.cur.theme : '-'}${this.arena.transitioning ? ' (fx)' : ''} · music ${music.layer || '-'}`
      : '-');
    dbg.set('stage', `${p.number} (loop ${p.loop}) ${p.biome.id} · ${d.section ? d.section.type : '-'}${d.section && d.section.type === 'waves' ? ` set ${d.setIdx + 1}/${d.section.sets.length}` : ''}`);
    dbg.set('diff', `dens ${p.diff.density.toFixed(2)} spd ${p.diff.speed.toFixed(2)} elite ${(p.diff.eliteChance * 100) | 0}%`);
  }
}

