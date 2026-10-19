import { PlayScene } from './PlayScene.js';
import { StageDirector } from '../stages/StageDirector.js';
import { generateStage } from '../stages/StageGen.js';
import { Arena } from '../bosses/Arena.js';
import { ARCHETYPE_LABEL, BOSSES, MINIBOSSES } from '../bosses/index.js';
import { ensureBossArt } from '../bosses/bossArt.js';
import { ENEMIES } from '../entities/enemies/index.js';
import { NAVAL_PACK } from '../entities/enemies/naval.js';
import { TEMPLATES } from '../stages/waves.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL, DMG_INSTANT_PHASE_CLEAR } from '../core/damage.js';
import { stageFactions, factionForArchetype } from '../data/factions/index.js';
import { showFactionCard } from '../ui/factionCard.js';
import { recordBossDefeat, recordBossSeen } from '../pilots/unlocks.js';
import { levelFor } from '../stages/campaign.js';

// The main game: the campaign (stages/campaign.js) — six archetypes of five
// levels, each level played start to finish in its boss's arena, looping at
// a higher Mk. The run is fully determined by the seed plus player input.

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
    // Bosses reach the arena's world-space FX (craters, splashes, wakes) via w.arena.fx.
    this.world.arena = this.arena;
    this.beginStage(this.startStage);
  }

  exit() {
    this.arena.reset();
    music.setLayer(null);
    super.exit();
  }

  restartScene() { this.g.setScene(new StageScene(this.def)); }

  /** Stage plan for global stage `index` (M7b: practice overrides it). */
  makePlan(index) { return generateStage(this.g.seed, index, this.diffCfg.id); }

  /** After the tally closes (M7b: practice overrides it). */
  nextStage() { this.beginStage(this.stageIndex + 1); }

  /** "loop-stage" reached, for ranking entries (M7a). */
  stageLabel() { return this.plan ? (this.plan.level ? this.plan.level.label : `${this.plan.loop}-${this.plan.stageInLoop + 1}`) : ''; }

  beginStage(index) {
    const g = this.g, w = this.world;
    this.stageIndex = index;
    this.plan = this.makePlan(index);
    const lv = this.plan.level;
    this.arena.reset(lv ? lv.arena : null); // keeps the level arena if it was prefetched during the tally
    // Update 02: who owns this territory, and whose colours each enemy wears
    // (split territories change hands by unit type or after the mid-boss).
    this.factions = stageFactions(this.plan);
    music.setStage(this.factions.main.id); // M6: the owning faction's musical identity
    this.upperLevels = false;
    w.factionOf = (def) => this.factions.resolve(def, this.upperLevels);
    // M7c: later stages fade in from the previous one (the first one cuts in).
    if (index > this.startStage) g.renderer.background.fadeTo(this.plan.biome.bg, 90);
    else g.renderer.background.setBiome(this.plan.biome.bg);
    this.parallax.setStyle(this.plan.biome);
    // Level rework: the level's arena is on screen from the first wave.
    if (lv && this.arena.showLevel(lv.arena, this.plan.biome)) w.groundSpeed = (y) => this.arena.groundSpeed(y);
    else w.groundSpeed = null;
    this._preloadLevelArt();
    w.bullets.clearAll();
    w.clearLasers();
    this.director.start(this.plan);
    const p = this.plan;
    this.waveLabel = '';
    this._setStageLine();
  }

  /** HUD stage line: level, current wave, arena. */
  _setStageLine() {
    const p = this.plan;
    if (!p.level) { this.hud.setStage(`LOOP ${p.loop} · STAGE ${p.loop}-${p.stageInLoop + 1} · ${p.biome.name}`); return; }
    this.hud.setStage(`${p.level.title}${this.waveLabel ? ` · ${this.waveLabel}` : ''} · ${p.biome.name}`);
  }

  onSceneEvent(type, data) {
    switch (type) {
      case 'stageIntro': {
        // Faction intro card (+ the loop story line at the start of a loop).
        const p = data;
        if (p.stageInLoop === 0 && p.loop > 1) this.g.renderer.post.flash(1, 0.2, 0.4, 0.4, 0.02);
        showFactionCard(this.fxLayer, p, this.factions);
        break;
      }
      case 'warning':
        this.waveLabel = data.boss ? 'BOSS' : 'MID-BOSS';
        this._setStageLine();
        this._warning(data.boss);
        if (this.arena.locked) { /* level mode: the arena is already up */ }
        else if (data.boss) this._prefetchBossArena(); // arena rework: build phase 1's arena during the WARNING
        else if (data.midArena) this.arena.prefetch({ id: data.midArena });
        break;
      case 'bossIntro': {
        const e = data, c = e.ctrl;
        if (c && c.def.mini) {
          const fac = factionForArchetype(c.archetype);
          this.banner(e.name, `${fac ? `${fac.short} · ` : ''}MID-BOSS · ${c.def.title || ''}`, 120, 'boss');
          break;
        }
        if (c) {
          if (this.ranked !== false) recordBossSeen(c.def.id, c.mk || 1); // M7b: unlocks it in practice
          // Named intro card: archetype class (or the slot a prototype stands in for) + phase count.
          const label = ARCHETYPE_LABEL[c.archetype] || '';
          const lv = this.plan.level;
          const cls = c.def.archetype === c.archetype ? `${lv && lv.main ? 'MAIN BOSS · ' : ''}${label} CLASS` : `${c.def.title || 'PROTOTYPE'} · ${label} SLOT`;
          const fac = factionForArchetype(c.archetype);
          this.banner(e.name, `${fac ? `${fac.short} · ` : ''}${cls} · ${c.total} PHASES`, 130, 'boss');
          break;
        }
        this.banner(e.name, data.def.boss && this.director.section.type === 'boss' ? 'SYNDICATE COMMAND UNIT' : 'MID-BOSS', 120, 'boss');
        break;
      }
      case 'bossDown':
        this.banner(data.type === 'boss' ? 'TARGET DESTROYED' : 'MID-BOSS DOWN', '', 110);
        if (data.type === 'midboss') this.upperLevels = true; // the climb continues (split territories)
        if (data.type === 'boss') this._prefetchNextLevel();
        this.world.cancelAll();
        this.world.clearLasers();
        this.world.autoCollect = 180;
        break;
      case 'bossEscape': this.banner('TARGET ESCAPED', 'NO BONUS', 90); break;
      // ---- boss arena mode (bosses/BossController + bosses/Arena)
      case 'arenaEnter':
        if (!this.arena.locked) this.arena.enter(this.plan.biome);
        data.stars = this.arena.stars; // phase breaks convert bullets into score stars
        break;
      case 'bossArena': {
        // Level mode: one arena per level — a phase only changes its mood.
        if (this.arena.locked) { this.arena.mood(data.arena); break; }
        this.arena.transitionTo(data.arena, data.fx, data.dur);
        // Build the arena after this one while this phase is fought.
        const c = this.director.bossCtrl, next = c && c.phases[c.index + 2];
        if (next) this.arena.prefetch(next.arena);
        break;
      }
      case 'bossPhaseCard': this._phaseCard(data); break;
      case 'bossMusic': music.setLayer(data.layer); break;
      case 'bossPartDown': this.hud.toast(`${data.name} DESTROYED · +${data.medals} MEDALS`, 'gold'); break;
      case 'waveStart': {
        const last = data.number === data.total, before = data.number === data.total / 2;
        this.banner(`WAVE ${data.number}`, last ? 'FINAL WAVE · THE BOSS IS NEXT' : before ? 'LAST WAVE BEFORE THE MID-BOSS' : `${data.number} / ${data.total}`, 120, 'wave');
        this.waveLabel = `WAVE ${data.number}/${data.total}`;
        this._setStageLine();
        if (data.number > 1) this.g.renderer.post.flash(1, 0.9, 0.6, 0.12, 0.03);
        break;
      }
      case 'bossSummon':
        this.hud.toast('REINFORCEMENTS INBOUND', 'red');
        if (data.e) this.world.explosions.sparks(data.e.x, data.e.y + 20, 14, [1, 0.6, 0.3], 4, 22, 4);
        break;
      case 'bossDefeated': {
        if (data.ctrl.def.mini) break;
        // M5: Warden's Verdict copies the last boss defeated; the first defeat unseals Warden.
        const arch = data.ctrl.archetype;
        this.world.lastBossArchetype = arch;
        if (!this.attract && recordBossDefeat(arch)) // M7b: never from the attract demo
          this.hud.toast('PERSONNEL FILE UNSEALED · "WARDEN" UNLOCKED', 'gold');
        break;
      }
      case 'bossPhaseClear':
        if (data.bonus) this.hud.toast(`PHASE BREAK +${Math.round(data.bonus * this.diffCfg.scoreMul).toLocaleString('en-US')}`, 'gold');
        else if (data.reason === 'timeout') this.hud.toast('PHASE TIMED OUT', 'red');
        break;
      case 'bossTransitionCancel':
        this.arena.finish();
        this._removePhaseCard();
        break;
      // Optional mid-boss arena: the shared arena system shows it for the fight
      // and crossfades back to the stage biome afterwards.
      case 'midbossArena':
        this.arena.enter(this.plan.biome);
        this.arena.transitionTo({ id: data.arena }, 'flash', 90);
        break;
      case 'midbossArenaExit':
        this.arena.exit();
        break;
      case 'arenaExit':
        this.arena.exit();
        music.setLayer(null);
        break;
      case 'tally': this._showTally(data); break;
    }
  }

  /**
   * Draw this level's boss, mini-boss and unit art now, while the level's
   * arena loads under its cover, instead of mid-fight when they first spawn.
   */
  _preloadLevelArt() {
    const r = this.g.renderer;
    if (!r.addFrames) return;
    for (const sec of this.plan.sections) {
      const def = sec.arena && (BOSSES[sec.arena.id] || MINIBOSSES[sec.arena.id]);
      if (def) ensureBossArt(r, def);
      for (const set of sec.sets || []) for (const ev of set.events) { const ed = ENEMIES[ev.id]; if (ed && ed.pack) ensureBossArt(r, ed.pack); }
    }
    for (const id of this.plan.reinforce || []) { const t = TEMPLATES.find((x) => x.id === id); if (t && t.tags.includes('naval')) ensureBossArt(r, NAVAL_PACK); }
  }

  /** Build the next level's arena while the tally is up (practice has no next level). */
  _prefetchNextLevel() {
    if (this.practice || !this.plan.level) return;
    this.arena.prefetch({ id: levelFor(this.stageIndex + 1).arena });
  }

  /** Start building the main boss's first arena (the WARNING gives it ~3 s). */
  _prefetchBossArena() {
    const sec = this.plan.sections.find((s2) => s2.type === 'boss');
    const def = sec && sec.arena && BOSSES[sec.arena.id];
    if (def && def.phases[0]) this.arena.prefetch(def.phases[0].arena);
  }

  _warning(isBoss) {
    const el = document.createElement('div');
    el.className = 'warning';
    // The main boss's faction names the threat (Update 02).
    const sec = isBoss && this.plan.sections.find((s) => s.type === 'boss');
    const fac = sec && sec.arena && factionForArchetype(sec.arena.archetype);
    const text = isBoss ? (fac ? fac.warning : 'SYNDICATE COMMAND UNIT APPROACHING') : 'HEAVY UNIT INBOUND';
    el.innerHTML = `<div class="stripe"></div><b>WARNING</b><small>${text}</small><div class="stripe"></div>`;
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
        <div class="menu-sub">${p.level ? p.level.title : `STAGE ${p.loop}-${p.stageInLoop + 1}`} · ${p.biome.name}</div>
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
    if (st.t < TALLY_COUNT_STEPS && st.t % 6 === 0) sfx.play('tallyTick'); // M7a: count-up ticks
    const done = st.t >= TALLY_COUNT_STEPS;
    if ((done && this.g.input.pressed('confirm')) || st.t > TALLY_COUNT_STEPS + 420) {
      this.world.score += st.data.total;
      this.tallyState = null;
      this.blockPause = false;
      this._hideOverlay();
      this.g.renderer.post.flash(1, 1, 1, 0.5, 0.04);
      this.nextStage();
    }
  }

  // ------------------------------------------------------------ boss arena

  _phaseCard(d) {
    this._removePhaseCard();
    const el = document.createElement('div');
    el.className = `phase-card${d.desperation ? ' desperation' : ''}`;
    const pips = Array.from({ length: d.total }, (_, i) => `<i class="${i < d.number - 1 ? 'done' : i === d.number - 1 ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `<small>${d.boss}</small><b>${d.desperation ? 'FINAL' : `PHASE ${d.number}`} — ${d.name}</b><div class="pc-pips">${pips}</div>`;
    // Long arena names ("FROZEN WEAPONS FACILITY") shrink to fit the card.
    const title = `${d.desperation ? 'FINAL' : `PHASE ${d.number}`} — ${d.name}`;
    if (title.length > 26) el.querySelector('b').style.fontSize = `calc(${(17 * Math.max(0.6, 26 / title.length)).toFixed(2)} * var(--u))`;
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
    this._renderShadows(b, alpha);
    const c = this.bossCtrl;
    if (c) c.renderUnder(b, alpha);
  }

  /** Update 02 §4.3: airborne units cast a drop shadow down-right onto the ground layer. */
  _renderShadows(b, alpha) {
    for (const e of this.world.enemies.active) {
      if (!e.alive || e.ground || !e.f || e.ctrl || e.kind === 'bosspart') continue;
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      const w = e.f.w * e.scale, h = e.f.h * e.scale, off = 6 + w * 0.12;
      b.draw(e.f, x + off, y + off * 1.5, w * 0.92, h * 0.92, e.rot, 0, 0, 0, 0.3, 0);
    }
  }

  renderOverlay(b, alpha) {
    const c = this.bossCtrl;
    if (c) c.renderSurface(b, alpha); // hull animation + damage: under the vision veil
    this.arena.renderOver(b, alpha);
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
    else if (!this.arena.loading) this.director.update(); // a level starts once its arena is built
    // Wave clock on the HUD stage line ("WAVE 3/10 · 0:42").
    const left = this.director.waveLeft;
    if (left >= 0 && left % 30 === 0 && this.director.set) {
      const sec = Math.ceil(left / 60);
      this.waveLabel = `WAVE ${this.director.set.number}/${this.director.section.totalWaves} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this._setStageLine();
    }
    const dbg = this.g.debug, p = this.plan, d = this.director;
    const c = d.bossCtrl;
    dbg.set('boss', c && c.e.ctrl === c && (c.e.alive || this.arena.active)
      ? `${c.def.id} [${c.archetype} mk${c.mk}] ${c.state} ${c.number}/${c.total} · arena ${this.arena.cur ? this.arena.cur.theme : '-'}${this.arena.transitioning ? ' (fx)' : ''} · music ${music.layer || '-'}`
      : '-');
    dbg.set('stage', `${p.number} ${p.level ? p.level.label : `(loop ${p.loop})`} ${p.biome.id} · ${d.section ? d.section.type : '-'}${d.section && d.section.type === 'waves' ? ` set ${d.setIdx + 1}/${d.section.sets.length}` : ''}`);
    dbg.set('diff', `dens ${p.diff.density.toFixed(2)} spd ${p.diff.speed.toFixed(2)} elite ${(p.diff.eliteChance * 100) | 0}%`);
  }
}

